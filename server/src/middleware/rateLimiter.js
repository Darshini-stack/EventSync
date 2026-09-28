/**
 * rateLimiter.js
 * In-memory sliding-window rate limiter for sensitive endpoints like POST /api/chat.
 * Prevents spamming and respects API resource limits.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30; // Max 30 requests per minute per IP or User ID

const requestLog = new Map();

// Periodic cleanup of stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestLog.entries()) {
    const valid = timestamps.filter((t) => now - t < WINDOW_MS);
    if (valid.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, valid);
    }
  }
}, 5 * 60 * 1000);

const chatRateLimiter = (req, res, next) => {
  const identifier = (req.user && req.user._id ? req.user._id.toString() : req.ip) || 'anonymous';
  const now = Date.now();

  const timestamps = requestLog.get(identifier) || [];
  const validTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS) {
    res.set('Retry-After', '60');
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please wait a moment before sending another message.',
      type: 'text',
      data: {
        type: 'text',
        message: 'Too many requests. Konchem aagi malli message cheyandi (Please wait a minute before sending another message).',
      },
    });
  }

  validTimestamps.push(now);
  requestLog.set(identifier, validTimestamps);
  next();
};

module.exports = { chatRateLimiter };
