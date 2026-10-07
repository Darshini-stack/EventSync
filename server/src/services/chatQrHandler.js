/**
 * chatQrHandler.js
 * Dedicated Registration QR resolution and generation handler for EventSync Assistant.
 *
 * Implements:
 * 1. Intent detection for event registration QR queries (e.g. "show QR for Dumb Charades", "give me the QR", "where is the registration QR?")
 * 2. Dynamic event resolution from MongoDB using resolveTargetEvent (supports title match, ordinal, context history, or explicit ID)
 * 3. Generation of real canonical registration URLs and QR code data URLs via existing 'qrcode' dependency
 * 4. Distinct 'registration_qr' and 'qr_error' response contracts
 *
 * ZERO-MOCK COMPLIANCE:
 * - Never returns fake, hardcoded, or simulated QR codes
 * - Always grounds in real live MongoDB Event records
 */

const qrcode = require('qrcode');
const Event = require('../models/Event');
const config = require('../config/env');
const { resolveTargetEvent } = require('./eventResolutionService');
const { buildEventRegistrationUrl } = require('../utils/qrUrlHelper');

/**
 * Determines whether the user's message is requesting an event registration QR code.
 *
 * @param {string} message - Current user utterance
 * @param {Array} [history] - Conversation history
 * @returns {boolean}
 */
const isRegistrationQrRequest = (message = '', history = []) => {
  const q = String(message || '').toLowerCase().trim();

  // Explicit QR phrases
  const qrKeywords = [
    'registration qr',
    'register qr',
    'registration qr code',
    'register qr code',
    'qr for registration',
    'qr code for registration',
    'event registration qr',
    'show qr',
    'show the qr',
    'show registration qr',
    'give me the qr',
    'give me qr',
    'open registration qr',
    'where is the qr',
    'where is the registration qr',
    'scan to register',
    'qr to register',
    'qr code to register',
    'qr code for this event',
    'qr for this event',
    'qr code of this event',
    'qr for the event',
    'qr code for',
    'qr for',
    // Telugu / Tanglish
    'qr chupinchu',
    'qr code chupinchu',
    'registration qr chupinchu',
    'qr ivvu',
    'qr code ivvu',
    'registration qr ivvu',
  ];

  if (qrKeywords.some((kw) => q.includes(kw))) {
    return true;
  }

  // Regex check for phrases like "show ... qr", "open ... qr"
  if (/\b(?:show|get|give|display|open|provide|find|need)\b.*\bqr\b/i.test(q)) {
    return true;
  }

  // Direct "qr code" query when in event context
  if (/^qr(?:\s+code)?$/i.test(q)) {
    return true;
  }

  return false;
};

/**
 * Handles an event registration QR request dynamically using MongoDB Event data.
 *
 * @param {Object} params
 * @param {string} params.message
 * @param {Array} [params.history]
 * @param {string} [params.eventId]
 * @returns {Promise<Object>} Formatted response data
 */
const handleRegistrationQrRequest = async ({ message = '', history = [], eventId = null, req = null }) => {
  try {
    const q = String(message || '').trim();

    // 1. Dynamically resolve the target event from MongoDB
    const { event, source } = await resolveTargetEvent({
      message: q,
      history,
      eventId,
    });

    // 2. If no event could be determined
    if (!event) {
      // Check if user named an event that doesn't exist in DB
      const targetMatch = q.match(/(?:for|about|of)\s+([a-zA-Z0-9\s]+?)(?:\.|\?|$)/i);
      if (targetMatch && targetMatch[1] && targetMatch[1].trim().length > 2) {
        const attemptedName = targetMatch[1].trim();
        return {
          type: 'qr_error',
          message: `I could not find an event titled "${attemptedName}" in the database. Please check the event name and try again.`,
        };
      }

      // Generic clarification request
      return {
        type: 'text',
        message: 'Which event would you like the registration QR code for? Please tell me the event title (for example, "Show QR for Dumb Charades") or open an event page.',
      };
    }

    // 3. Verify event is active/valid in MongoDB
    const fullEvent = await Event.findById(event._id).lean();
    if (!fullEvent) {
      return {
        type: 'qr_error',
        message: 'The requested event could not be found in EventSync.',
      };
    }

    // 4. Construct canonical public registration URL dynamically
    const registrationUrl = buildEventRegistrationUrl(fullEvent._id, req);
    console.log(`[ChatQrHandler] Generated dynamic registration URL for event "${fullEvent.title}": ${registrationUrl}`);

    // 5. Generate high-quality QR code data URL
    const qrDataUrl = await qrcode.toDataURL(registrationUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });

    const venueInfo = fullEvent.venue ? ` at **${fullEvent.venue}**` : '';
    const dateInfo = fullEvent.date ? ` on **${new Date(fullEvent.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}**` : '';

    return {
      type: 'registration_qr',
      eventId: String(fullEvent._id),
      eventTitle: fullEvent.title,
      category: fullEvent.category || 'General',
      venue: fullEvent.venue || '',
      date: fullEvent.date || null,
      time: fullEvent.time || '',
      registrationUrl,
      qrValue: registrationUrl,
      dataUrl: qrDataUrl,
      qrDataUrl,
      resolvedVia: source,
      message: `Here is the official registration QR code for **${fullEvent.title}**${venueInfo}${dateInfo}. Scan with any mobile camera or click below to register.`,
    };
  } catch (err) {
    console.error('[ChatQrHandler] Error generating registration QR:', err);
    return {
      type: 'qr_error',
      message: 'Unable to retrieve registration QR code at this moment. Please try again or open the event page directly.',
    };
  }
};

module.exports = {
  isRegistrationQrRequest,
  handleRegistrationQrRequest,
};
