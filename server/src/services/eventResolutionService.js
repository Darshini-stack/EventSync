/**
 * eventResolutionService.js
 * Centralized dynamic event resolution service for EventSync Assistant.
 *
 * Resolves target Event documents from MongoDB based on:
 * 1. Explicit eventId
 * 2. Ordinal references ("the second one", "1st event", "rendava event")
 * 3. Title match against MongoDB published events
 * 4. Distinctive keyword match
 * 5. Candidate reference extraction with fuzzy similarity
 * 6. Conversational context in chat history
 *
 * ZERO-MOCK COMPLIANCE:
 * Grounded in live MongoDB Event records.
 */

const mongoose = require('mongoose');
const Event = require('../models/Event');

/**
 * Parses ordinal references like "the second one", "2nd one", "first event", "the third one".
 * Returns 0-based index or -1 if not found.
 */
const parseOrdinalIndex = (text = '') => {
  const t = String(text).toLowerCase();
  if (t.includes('first') || t.includes('1st') || t.includes('modati') || t.includes('1st one')) return 0;
  if (t.includes('second') || t.includes('2nd') || t.includes('rendava') || t.includes('2nd one')) return 1;
  if (t.includes('third') || t.includes('3rd') || t.includes('moodava') || t.includes('3rd one')) return 2;
  if (t.includes('fourth') || t.includes('4th') || t.includes('4th one')) return 3;
  if (t.includes('fifth') || t.includes('5th') || t.includes('5th one')) return 4;
  return -1;
};

/**
 * Extracts titles from a bot message that formatted a numbered list (e.g. "1. **Title**\n2. **Title**")
 */
const extractNumberedListFromText = (text = '') => {
  const lines = String(text).split('\n');
  const items = [];
  for (const line of lines) {
    const match = line.match(/^\s*(?:\d+[\.\)]|[-*])\s*(?:\*\*)?([^*:\n\r]+)(?:\*\*)?/);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 2 && !candidate.toLowerCase().includes('here are')) {
        items.push(candidate);
      }
    }
  }
  return items;
};

/**
 * Calculates string similarity using character Bigram Dice coefficient.
 */
const calculateSimilarity = (str1 = '', str2 = '') => {
  const s1 = String(str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = String(str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const getBigrams = (s) => {
    const bigrams = new Set();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const bg of b1) {
    if (b2.has(bg)) intersection++;
  }
  const total = b1.size + b2.size;
  return total > 0 ? (2 * intersection) / total : 0;
};

/**
 * Extracts candidate event reference from user message by removing action prefixes and Tanglish fillers.
 */
const extractCandidateEventReference = (message = '') => {
  let cleaned = String(message || '')
    .replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:could\s+you\s+)?/i, '')
    .replace(/^(?:show|get|open|display|give\s+me|find)\s+(?:the\s+)?(?:registration\s+)?(?:qr|code|pass|details|info)?\s*(?:for|of|about)?\s*/i, '')
    .replace(/(?:event\s+)?(?:ki|kosam)\s+(?:qr\s+code\s+chupinchu|qr\s+chupinchu|pass\s+chupinchu|details\s+chupinchu|chupinchu|ivvu|ivvandi)/gi, '')
    .replace(/(?:ki|kosam)\s+(?:qr|pass|code|ticket)/gi, '')
    .replace(/\b(?:event\s+ki|event\s+kosam)\b/gi, '')
    .replace(/\b(?:registration\s+qr|register\s+qr|qr\s+code|qr|event)\b/gi, '')
    .replace(/[?.!,:;]+$/g, '')
    .trim();

  return cleaned;
};

/**
 * Helper to fetch published, non-cancelled events from MongoDB safely.
 */
const fetchPublishedEvents = async () => {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      return await Event.find({
        $or: [
          { status: { $exists: false } },
          { status: { $ne: 'CANCELLED' } },
        ],
      }).sort({ date: 1 }).lean();
    }
  } catch (err) {
    console.warn('[EventResolutionService] DB lookup warning:', err.message);
  }
  return [];
};

/**
 * Dynamically resolves the target Event from MongoDB based on:
 * 1. Explicit eventId
 * 2. Ordinal references in history ("the second one")
 * 3. Title match in MongoDB
 * 4. Extracted candidate event reference with fuzzy & phonetic matching
 * 5. Conversational context in chat history
 *
 * @param {Object} params
 * @param {string} params.message
 * @param {Array} [params.history]
 * @param {string} [params.eventId]
 * @returns {Promise<{ event: Object|null, source: string, candidate?: string }>}
 */
const resolveTargetEvent = async ({ message, history = [], eventId = null }) => {
  if (eventId && typeof eventId === 'string' && eventId.trim().length > 0) {
    try {
      const directEvent = await Event.findById(eventId.trim()).lean();
      if (directEvent) {
        return { event: directEvent, source: 'EXPLICIT_ID' };
      }
    } catch (e) {
      console.warn('[EventResolutionService] Invalid eventId passed:', eventId);
    }
  }

  const q = String(message || '').toLowerCase().trim();
  const publishedEvents = await fetchPublishedEvents();

  // 1. Ordinal reference (e.g. "the second one", "1st event", "rendava event")
  const ordinalIndex = parseOrdinalIndex(q);
  if (ordinalIndex >= 0) {
    if (Array.isArray(history) && history.length > 0) {
      const lastAssistantMsg = [...history].reverse().find((m) => m.role === 'assistant');
      if (lastAssistantMsg && typeof lastAssistantMsg.content === 'string') {
        const extractedTitles = extractNumberedListFromText(lastAssistantMsg.content);
        if (extractedTitles.length > ordinalIndex) {
          const candidateTitle = extractedTitles[ordinalIndex];
          const matched = publishedEvents.find(
            (e) =>
              e.title.toLowerCase().includes(candidateTitle.toLowerCase()) ||
              candidateTitle.toLowerCase().includes(e.title.toLowerCase())
          );
          if (matched) {
            return { event: matched, source: 'ORDINAL_HISTORY' };
          }
        }
      }
    }

    if (publishedEvents.length > ordinalIndex) {
      return { event: publishedEvents[ordinalIndex], source: 'ORDINAL_DATABASE' };
    }
  }

  // 2. Direct title match in query against published events
  const sortedByLength = [...publishedEvents].sort((a, b) => b.title.length - a.title.length);
  for (const ev of sortedByLength) {
    const evTitle = ev.title.toLowerCase();
    if (q.includes(evTitle)) {
      return { event: ev, source: 'TITLE_MATCH' };
    }
  }

  // 3. Keyword match for distinctive event names
  for (const ev of sortedByLength) {
    const words = ev.title
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 4 && !['event', '2026', 'hackathon', 'competition', 'annual'].includes(w));
    for (const w of words) {
      if (q.includes(w)) {
        return { event: ev, source: 'KEYWORD_MATCH' };
      }
    }
  }

  // 4. Extracted candidate event reference with fuzzy & phonetic matching
  const candidate = extractCandidateEventReference(message);
  if (candidate && candidate.length > 1) {
    const candLower = candidate.toLowerCase();
    for (const ev of sortedByLength) {
      const evLower = ev.title.toLowerCase();
      const sim = calculateSimilarity(candidate, ev.title);
      const isPhoneticCharades =
        (candLower.includes('dhamshara') || candLower.includes('damshara')) &&
        (evLower.includes('charade') || evLower.includes('dumb'));

      if (
        candLower === evLower ||
        candLower.includes(evLower) ||
        evLower.includes(candLower) ||
        sim >= 0.50 ||
        isPhoneticCharades
      ) {
        return { event: ev, source: 'TITLE_MATCH', candidate };
      }

      // Check category match
      if (ev.category && candLower.includes(ev.category.toLowerCase())) {
        return { event: ev, source: 'CATEGORY_MATCH', candidate };
      }
    }
  }

  // 5. Conversation history context references ("it", "this event", "selected event", etc.)
  const refersToContext =
    /\b(?:it|this\s+event|the\s+event|that\s+event|same\s+event|for\s+it|of\s+it|its|this|that|selected\s+event|current\s+event)\b/i.test(q) ||
    /^(?:show|open|give\s+me|get)?\s*(?:the\s+)?(?:registration\s+)?qr(?:\s+code)?$/i.test(q);

  if (refersToContext && Array.isArray(history) && history.length > 0) {
    for (const msg of [...history].reverse()) {
      if (msg.eventId) {
        const found = publishedEvents.find((e) => String(e._id) === String(msg.eventId));
        if (found) return { event: found, source: 'CONTEXT_EVENT_ID' };
      }
      if (msg.eventTitle) {
        const found = publishedEvents.find((e) => e.title.toLowerCase() === msg.eventTitle.toLowerCase());
        if (found) return { event: found, source: 'CONTEXT_EVENT_TITLE' };
      }
      if (typeof msg.content === 'string') {
        for (const ev of sortedByLength) {
          if (msg.content.toLowerCase().includes(ev.title.toLowerCase())) {
            return { event: ev, source: 'CONTEXT_HISTORY_TEXT' };
          }
        }
      }
    }
  }

  // 6. If user asks explicitly for "the selected event" or "this event" and exactly 1 active event exists in DB
  const explicitSelectedEvent = /\b(?:this\s+event|selected\s+event|current\s+event|that\s+event)\b/i.test(q);
  if (explicitSelectedEvent && publishedEvents.length === 1) {
    return { event: publishedEvents[0], source: 'CONTEXT_SINGLE_EVENT' };
  }

  return { event: null, source: 'NEEDS_EVENT_SPECIFICATION', candidate };
};

module.exports = {
  parseOrdinalIndex,
  extractNumberedListFromText,
  calculateSimilarity,
  extractCandidateEventReference,
  fetchPublishedEvents,
  resolveTargetEvent,
};
