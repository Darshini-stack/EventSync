const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { chatRateLimiter } = require('../middleware/rateLimiter');
const { handleChatMessage, proxyImage } = require('../controllers/chatController');

/**
 * GET /api/chat/image-proxy
 * Public image proxy for generated AI artwork (bypasses CORS & browser adblockers).
 */
router.get('/image-proxy', proxyImage);

/**
 * POST /api/chat
 * Authenticated AI Chatbot endpoint with rate limiting.
 */
router.post('/', authenticateToken, chatRateLimiter, handleChatMessage);

module.exports = router;
