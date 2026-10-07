/**
 * qrUrlHelper.js
 * Centralized dynamic URL resolver for Event Registration QR codes.
 *
 * Guarantees:
 * - Never hardcodes localhost, 127.0.0.1, a fixed IP, or third-party domains.
 * - Dynamically determines browser-accessible frontend origin.
 * - For mobile/LAN access: converts loopback (localhost) to the host's actual physical LAN IP
 *   so scanning the screen from a mobile device connects directly to the frontend.
 * - If user is already accessing via LAN IP or public domain, preserves that origin.
 * - Encodes canonical format: <origin>/events/<REAL_MONGODB_EVENT_ID>/register
 */

const { getLocalIpAddress } = require('./network');
const config = require('../config/env');

/**
 * Resolves the browser-accessible frontend origin dynamically based on request context and network.
 *
 * @param {Object} [req] - Express request object
 * @returns {string} Fully qualified frontend origin (e.g. "http://10.91.99.248:5173" or "https://domain.com")
 */
const getAccessibleFrontendOrigin = (req) => {
  // 1. Check client-supplied origin in body, query, or headers
  const candidate =
    req?.body?.clientOrigin ||
    req?.body?.clientUrl ||
    req?.query?.clientUrl ||
    req?.get?.('x-client-origin') ||
    req?.get?.('origin') ||
    req?.get?.('referer');

  if (candidate && typeof candidate === 'string') {
    try {
      const parsed = new URL(candidate.trim());
      const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

      // If client came from a non-localhost origin (e.g. mobile on LAN: http://192.168.x.x:5173 or real domain), use it!
      if (!isLoopback) {
        return `${parsed.protocol}//${parsed.host}`;
      }

      // If client is on localhost, resolve with server's physical LAN IP so phones can scan the QR code!
      const lanIp = getLocalIpAddress();
      const port = parsed.port || '5173';
      if (lanIp) {
        return `${parsed.protocol}//${lanIp}:${port}`;
      }
      return `${parsed.protocol}//${parsed.host}`;
    } catch (e) {
      // ignore parse error and proceed
    }
  }

  const isProduction = config.nodeEnv === 'production' || !!process.env.RENDER;

  // 2. In production, prioritize configured PUBLIC_APP_URL or production frontend
  if (isProduction) {
    if (config.publicAppUrl && !config.publicAppUrl.includes('localhost')) {
      return config.publicAppUrl.replace(/\/+$/, '');
    }
    // Default production domain fallback
    return 'https://event-sync-tan.vercel.app';
  }

  // 3. In development / local testing, resolve with LAN IP if available
  const lanIp = getLocalIpAddress();
  if (lanIp) {
    return `http://${lanIp}:5173`;
  }

  // 4. Fallback to clientUrl or localhost in local development
  return (config.clientUrl || 'http://localhost:5173').replace(/\/+$/, '');
};

/**
 * Builds the canonical public event registration URL for a given event ID.
 *
 * @param {string|Object} eventId - MongoDB ObjectId or event object
 * @param {Object} [req] - Express request object
 * @returns {string} The complete registration URL
 */
const buildEventRegistrationUrl = (eventId, req) => {
  if (!eventId) return '';
  const rawId = typeof eventId === 'object' && eventId._id ? String(eventId._id) : String(eventId);
  const origin = getAccessibleFrontendOrigin(req);
  return `${origin}/events/${rawId}/register`;
};

module.exports = {
  getAccessibleFrontendOrigin,
  buildEventRegistrationUrl,
};
