const notificationService = require('../services/notificationService');

/**
 * GET /api/notifications
 * Protected (STUDENT or EVENTADMIN):
 * Retrieves paginated notifications strictly scoped to the authenticated user.
 */
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, unreadOnly } = req.query;
    const result = await notificationService.getUserNotifications(req.user._id, {
      page,
      limit,
      unreadOnly,
    });

    return res.status(200).json({
      success: true,
      count: result.notifications.length,
      notifications: result.notifications,
      data: result.notifications,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 * Protected:
 * Returns the live count of unread notifications for authenticated user.
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user._id);

    return res.status(200).json({
      success: true,
      count: unreadCount,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Protected:
 * Marks a specific notification as read. Enforces strict ownership.
 */
const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user._id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Protected:
 * Marks all unread notifications as read for the authenticated user.
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const modifiedCount = await notificationService.markAllAsRead(req.user._id);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/notifications/:id
 * Protected:
 * Deletes a notification strictly belonging to the authenticated user.
 */
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await notificationService.deleteNotification(req.params.id, req.user._id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
