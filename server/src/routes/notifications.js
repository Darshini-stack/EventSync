const express = require('express');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All notification routes strictly require authentication
router.use(authenticateToken);

// Notification queries & counts
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);

// Status updates & deletion
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
