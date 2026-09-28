/**
 * EventSync - Centralized Application & Registration URL Helper
 *
 * Provides a single source of truth for constructing public application
 * and event registration URLs. Guarantees that registration QR codes and
 * shareable registration links use the configured public/LAN domain and
 * NEVER hardcode localhost for shareable or production URLs.
 */

/**
 * Returns the public base URL of the frontend application.
 *
 * Priority:
 * 1. import.meta.env.VITE_PUBLIC_APP_URL (if defined and non-empty)
 * 2. If in browser and hostname is NOT 'localhost' or '127.0.0.1' (e.g. LAN IP or deployed domain), window.location.origin
 * 3. Fallback: window.location.origin (or 'http://localhost:5173')
 *
 * @returns {string} The public application base URL (without trailing slash)
 */
export const getPublicAppUrl = () => {
  const envUrl = import.meta.env.VITE_PUBLIC_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin && typeof origin === 'string') {
      return origin.replace(/\/+$/, '');
    }
  }

  return 'http://localhost:5173';
};

/**
 * Constructs the canonical public Event Registration URL for a given event ID.
 * All registration QR codes, shareable links, and copy actions MUST use this helper.
 *
 * Example output:
 * - Production: https://YOUR_DEPLOYED_DOMAIN/events/68a1.../register
 * - Local Wi-Fi / LAN testing: http://192.168.x.x:5173/events/68a1.../register
 *
 * @param {string} eventId - MongoDB ObjectId of the event
 * @returns {string} The complete, canonical public event registration URL
 */
export const getEventRegistrationUrl = (eventId) => {
  if (!eventId) return '';
  const baseUrl = getPublicAppUrl();
  return `${baseUrl}/events/${eventId}/register`;
};
