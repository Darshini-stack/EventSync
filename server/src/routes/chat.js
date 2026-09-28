const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { chatRateLimiter } = require('../middleware/rateLimiter');
const { handleChatMessage } = require('../controllers/chatController');

/**
 * POST /api/chat
 * Authenticated AI Chatbot endpoint with rate limiting.
 */
router.post('/', authenticateToken, chatRateLimiter, handleChatMessage);

module.exports = router;
