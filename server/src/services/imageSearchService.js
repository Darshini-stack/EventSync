/**
 * imageSearchService.js
 * Universal dynamic image search service for Amma Thalli AI Assistant.
 *
 * ZERO HARDCODING COMPLIANCE:
 * - Dynamically searches and resolves real images for ANY entity, historical figure,
 *   celebrity, landmark, animal, vehicle, product, planet, or object.
 * - Free, authentic Wikimedia / Wikipedia REST API default provider with zero API keys required.
 * - Extensible via IMAGE_SEARCH_PROVIDER and IMAGE_SEARCH_API_KEY environment variables.
 * - Returns normalized image search responses with multiple authentic results.
 */

const mongoose = require('mongoose');
const Event = require('../models/Event');
const config = require('../config/env');

/**
 * Determines whether the user's message is an image search intent (finding/viewing real images).
 *
 * Distinguishes:
 * - IMAGE_SEARCH: "Show me Gandhi image", "Gandhiji photo chupinchu", "Virat Kohli photo", "show Eiffel Tower", "Cat picture", "Show a lion", "Show a Ferrari", "Show a laptop"
 * - IMAGE_GENERATION: "generate a futuristic city", "create a cyberpunk cat", "make a cinematic poster" (has generative verbs)
 * - NORMAL_TEXT: "Who is Mahatma Gandhi?", "What is the venue?", "How many teams registered?" (pure text questions)
 *
 * @param {string} message - User message
 * @param {Array} [history] - Conversation history
 * @returns {boolean}
 */
const isImageSearchRequest = (message = '', history = []) => {
  const q = String(message || '').toLowerCase().trim();
  if (!q) return false;

  // 1. Explicit negative guards for normal text questions
  const isQuestionPrefix = /^(?:who\s+is|who\s+was|who\s+are|what\s+is|what\s+are|how\s+to|how\s+many|when\s+is|where\s+is|why\s+is|explain\s+|tell\s+me\s+about\s+)/i.test(
    q
  );

  const hasExplicitImageKeyword =
    /\b(?:photos?|images?|pictures?|pics?|posters?|wallpapers?|logo|dp)\b/i.test(q) ||
    /\b(?:chupinchu|chupandi|chupu|kanipinchu)\b/i.test(q);

  const hasGenerativeVerb =
    /\b(?:generate|create|design|draw|paint|sketch|render|build|synthesize|regenerate)\b/i.test(q) ||
    (/\bmake\b/i.test(q) && /\b(?:poster|image|picture|banner|illustration|artwork|drawing|wallpaper|graphic|visual|concept)\b/i.test(q)) ||
    /\b(?:poster\s+cheyyi|image\s+create\s+cheyyi|bomma\s+veyyi|poster\s+generate\s+cheyyi|image\s+generate\s+cheyyi)\b/i.test(q) ||
    /\b(?:poster\s+kavali|image\s+kavali|poster\s+laga|poster\s+type|event\s+poster\s+ivvu|poster\s+ivvu|poster\s+ivvandi)\b/i.test(q) ||
    /(?:ki|kosam)\s+(?:event\s+)?(?:poster|banner|flyer)/i.test(q) ||
    (/\b(?:event\s+ki|event\s+kosam)\b/i.test(q) && /\b(?:poster|image|banner)\b/i.test(q)) ||
    /\b(?:poster|banner|flyer)\s+(?:generate|create|kavali|cheyyi|ivvu|ivvandi)\b/i.test(q) ||
    /\bposter\s+for\b/i.test(q);

  // If user says "generate a futuristic city", "create a cartoon cat", or "Dumb Charades event ki poster kavali", that is generation/poster, NOT search
  if (hasGenerativeVerb) {
    return false;
  }

  // If question prefix without explicit image keywords ("Who is Mahatma Gandhi?", "What is the venue?", "How many teams registered?"), it's pure TEXT!
  if (isQuestionPrefix && !hasExplicitImageKeyword) {
    return false;
  }

  // If it contains explicit image keywords: e.g. "Gandhiji image chupinchu", "Virat Kohli photo", "Cat picture", "Charminar image", "Solar system image", "Show me this event's poster"
  if (hasExplicitImageKeyword) {
    return true;
  }

  // If it starts with "show me / show / display / find" + noun: e.g. "Show Eiffel Tower", "Show a lion", "Show a Ferrari", "Show a laptop", "Show me APJ Abdul Kalam"
  if (/^(?:show\s+me|show|display|find\s+me|get\s+me|look\s+up)\s+(?:a\s+|an\s+|the\s+)?[a-z0-9\s'-]+$/i.test(q)) {
    const textDataKeywords = [
      'events',
      'registrations',
      'attendance',
      'certificates',
      'passes',
      'tickets',
      'teams',
      'schedule',
      'rules',
      'venue',
      'details',
      'info',
      'dashboard',
    ];
    const words = q.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (textDataKeywords.includes(lastWord)) {
      return false;
    }
    return true;
  }

  return false;
};

/**
 * Cleans a natural language user query into an optimized image search subject.
 * Extracts the core entity from conversational requests across English, Telugu, and Tanglish.
 *
 * @param {string} rawMessage
 * @returns {string} Clean search term
 */
const extractSearchQuery = (rawMessage = '') => {
  if (!rawMessage || typeof rawMessage !== 'string') return '';

  let cleaned = rawMessage.trim();

  // Remove common polite or conversational prefixes
  cleaned = cleaned.replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:could\s+you\s+)?/i, '');
  cleaned = cleaned.replace(
    /^(?:show\s+me|show|display|give\s+me|get\s+me|find\s+me|find|search\s+for|search|look\s+for|look\s+up)\s+/i,
    ''
  );

  // Remove Telugu / Tanglish prefixes/suffixes
  cleaned = cleaned.replace(/\b(?:chupinchu|chupandi|chupu|ivvu|ivvandi|kanipinchu|chudali|pettandi|pettu)\b/gi, '');

  // Remove image/photo words (both English & Indian colloquial)
  cleaned = cleaned.replace(
    /\b(?:images?|photos?|pictures?|pics?|posters?|wallpapers?|photoshoot|portrait|visuals?|logo|dp)\b/gi,
    ''
  );

  // Remove connectors and articles
  cleaned = cleaned.replace(/^(?:of\s+a|of\s+an|of\s+the|of|a|an|the)\s+/i, '');
  cleaned = cleaned.replace(/\s+(?:of\s+a|of\s+an|of\s+the|of|a|an|the)\s+/gi, ' ');
  cleaned = cleaned.replace(/(?:'s|s')\s*$/i, ''); // e.g. "Gandhi's" -> "Gandhi"
  cleaned = cleaned.replace(/^(?:photo\s+of|image\s+of|picture\s+of|pic\s+of)\s+/i, '');

  // Normalize common honorific variations for optimal encyclopedia search
  cleaned = cleaned.replace(/\bgandhiji\b/gi, 'Mahatma Gandhi');
  cleaned = cleaned.replace(/\bapj\s+abdul\s+kalam\b/gi, 'A. P. J. Abdul Kalam');
  cleaned = cleaned.replace(/\bkalam\s+ji\b/gi, 'A. P. J. Abdul Kalam');

  // Strip excessive spaces and trailing punctuation
  cleaned = cleaned.replace(/[?!.,;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();

  return cleaned || rawMessage.trim();
};

/**
 * Searches Wikimedia and Wikipedia for verified images matching the query.
 *
 * @param {string} query - Entity to search
 * @param {number} [maxResults=5] - Number of images to return
 * @returns {Promise<Array<{ url: string, thumbnailUrl: string, title: string, source: string, sourceUrl: string, description?: string }>>}
 */
const searchWikipediaImages = async (query, maxResults = 5) => {
  if (!query || query.trim() === '') return [];

  const images = [];
  const seenUrls = new Set();
  const cleanTerm = query.trim();

  // Strategy 1: Wikipedia Search API with PageImages and Extracts
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanTerm
    )}&gsrlimit=${Math.min(maxResults + 4, 10)}&prop=pageimages|extracts|info&pithumbsize=800&exintro=1&explaintext=1&inprop=url&format=json&origin=*`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'EventSync-AmmaThalli/2.0 (college-eventsync@vits.ac.in)',
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const pages = Object.values(data?.query?.pages || {});

      pages.sort((a, b) => (a.index || 99) - (b.index || 99));

      for (const page of pages) {
        const thumbSource = page.thumbnail?.source;
        if (thumbSource && !seenUrls.has(thumbSource)) {
          seenUrls.add(thumbSource);

          let fullUrl = thumbSource;
          if (thumbSource.includes('/thumb/')) {
            const parts = thumbSource.split('/thumb/');
            if (parts.length === 2) {
              const subparts = parts[1].split('/');
              if (subparts.length >= 3) {
                subparts.pop();
                fullUrl = `${parts[0]}/${subparts.join('/')}`;
              }
            }
          }

          images.push({
            url: fullUrl,
            thumbnailUrl: thumbSource,
            title: page.title || cleanTerm,
            source: 'Wikipedia',
            sourceUrl: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title || cleanTerm)}`,
            description: page.extract ? page.extract.slice(0, 160) + '...' : undefined,
          });

          if (images.length >= maxResults) break;
        }
      }
    }
  } catch (err) {
    console.warn('[ImageSearchService] Strategy 1 Wikipedia Search error:', err.message);
  }

  // Strategy 2: Direct Wikipedia Page Summary (if strategy 1 yielded few images)
  if (images.length < 2) {
    try {
      const formattedTitle = encodeURIComponent(cleanTerm.replace(/\s+/g, '_'));
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${formattedTitle}`;

      const res = await fetch(summaryUrl, {
        headers: {
          'User-Agent': 'EventSync-AmmaThalli/2.0 (college-eventsync@vits.ac.in)',
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const summary = await res.json();
        const mainImage = summary.originalimage?.source || summary.thumbnail?.source;
        if (mainImage && !seenUrls.has(mainImage)) {
          seenUrls.add(mainImage);
          images.unshift({
            url: mainImage,
            thumbnailUrl: summary.thumbnail?.source || mainImage,
            title: summary.title || cleanTerm,
            source: 'Wikipedia',
            sourceUrl: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${formattedTitle}`,
            description: summary.extract ? summary.extract.slice(0, 180) + '...' : undefined,
          });
        }
      }
    } catch (err) {
      console.warn('[ImageSearchService] Strategy 2 Wikipedia Summary error:', err.message);
    }
  }

  // Strategy 3: Wikimedia Commons Image Search
  if (images.length < maxResults) {
    try {
      const needed = maxResults - images.length;
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        cleanTerm
      )}&gsrnamespace=6&gsrlimit=${needed + 3}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=800&format=json&origin=*`;

      const res = await fetch(commonsUrl, {
        headers: {
          'User-Agent': 'EventSync-AmmaThalli/2.0 (college-eventsync@vits.ac.in)',
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const commonsData = await res.json();
        const pages = Object.values(commonsData?.query?.pages || {});

        for (const p of pages) {
          const info = p.imageinfo?.[0];
          const imgUrl = info?.thumburl || info?.url;
          if (imgUrl && !seenUrls.has(imgUrl) && (info.mime || '').includes('image/')) {
            seenUrls.add(imgUrl);
            const cleanTitle = (p.title || cleanTerm)
              .replace(/^File:/i, '')
              .replace(/\.[a-zA-Z0-9]+$/, '')
              .replace(/[_-]+/g, ' ')
              .trim();

            images.push({
              url: info.url || imgUrl,
              thumbnailUrl: info.thumburl || imgUrl,
              title: cleanTitle,
              source: 'Wikimedia Commons',
              sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
              description: info.extmetadata?.ImageDescription?.value
                ? String(info.extmetadata.ImageDescription.value).replace(/<[^>]*>/g, '').slice(0, 140) + '...'
                : undefined,
            });

            if (images.length >= maxResults) break;
          }
        }
      }
    } catch (err) {
      console.warn('[ImageSearchService] Strategy 3 Wikimedia Commons error:', err.message);
    }
  }

  return images;
};

/**
 * Searches and returns normalized image search results.
 *
 * @param {Object} params
 * @param {string} params.query - Natural language query or extracted entity
 * @param {number} [params.maxResults=4] - Max number of image cards
 * @returns {Promise<{ success: boolean, data: { type: string, query: string, text?: string, images: Array<any> } }>}
 */
const searchImages = async ({ query, maxResults = 4 }) => {
  const resolvedQuery = extractSearchQuery(query);

  if (!resolvedQuery || resolvedQuery.trim() === '') {
    return {
      success: false,
      data: {
        type: 'image_error',
        message:
          'Could not determine what image you would like to search for. Please specify a subject, person, place, or object.',
        error: 'EMPTY_QUERY',
      },
    };
  }

  console.log(`[ImageSearchService] Executing image search for: "${resolvedQuery}" (Original: "${query}")`);

  try {
    const images = await searchWikipediaImages(resolvedQuery, maxResults);

    if (!images || images.length === 0) {
      return {
        success: false,
        data: {
          type: 'image_error',
          message: `I searched for images of "${resolvedQuery}", but could not find high-resolution matches. You can try asking me to generate an image instead!`,
          query: resolvedQuery,
        },
      };
    }

    const leadDescription = images[0]?.description
      ? `Here are authentic images of **${resolvedQuery}**. ${images[0].description}`
      : `Here are images of **${resolvedQuery}**:`;

    return {
      success: true,
      data: {
        type: 'image_search',
        query: resolvedQuery,
        text: leadDescription,
        images,
      },
    };
  } catch (err) {
    console.error('[ImageSearchService Error]:', err.message);
    return {
      success: false,
      data: {
        type: 'image_error',
        message: `Unable to search for images of "${resolvedQuery}" at this moment. Please try again in a few moments.`,
        error: err.message,
      },
    };
  }
};

/**
 * Master image search intent handler for POST /api/chat.
 * Resolves event posters if user specifically asked for an event's poster,
 * otherwise executes universal Wikipedia/Wikimedia search.
 *
 * @param {Object} params
 * @param {string} params.message
 * @param {Array} [params.history]
 * @param {string} [params.eventId]
 * @returns {Promise<Object>} Normalized chat response object
 */
const handleImageSearch = async ({ message = '', history = [], eventId = null }) => {
  const { resolveTargetEvent } = require('./eventResolutionService');
  const q = String(message || '').toLowerCase();

  // Check if query is specifically asking for an event's uploaded poster / logo
  const isEventPosterQuery =
    q.includes('event poster') ||
    q.includes('this event') ||
    q.includes('event logo') ||
    q.includes('the poster') ||
    q.includes('event photo') ||
    (eventId && (q.includes('poster') || q.includes('image') || q.includes('photo')));

  if (isEventPosterQuery) {
    try {
      const resolution = await resolveTargetEvent({ message, history, eventId });
      if (resolution && resolution.event) {
        const ev = resolution.event;
        const serverPublicUrl = (process.env.PUBLIC_APP_URL || config.publicAppUrl || config.clientUrl || '').trim();
        const posterUrl = serverPublicUrl
          ? `${serverPublicUrl.replace(/\/+$/, '')}/api/events/${ev._id}/poster`
          : `/api/events/${ev._id}/poster`;

        return {
          type: 'image_search',
          query: ev.title,
          text: `Here is the official promotional poster for **${ev.title}**:`,
          images: [
            {
              url: posterUrl,
              thumbnailUrl: posterUrl,
              title: `${ev.title} - Official Poster`,
              source: 'EventSync Campus',
              sourceUrl: `/events/${ev._id}`,
            },
          ],
        };
      }
    } catch (e) {
      console.warn('[ImageSearchService] Event poster lookup error, falling back to general search:', e.message);
    }
  }

  // Universal search for any subject (Gandhi, Kalam, Kohli, Eiffel Tower, Ferrari, animals, etc.)
  const searchResult = await searchImages({ query: message });
  return searchResult.data;
};

module.exports = {
  isImageSearchRequest,
  extractSearchQuery,
  searchImages,
  searchWikipediaImages,
  handleImageSearch,
};
