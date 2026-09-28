const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// Helper to safely emit Socket.IO events to specific user room
const emitToUser = (userId, eventName, payload) => {
  try {
    const { getIO } = require('../sockets');
    const io = getIO();
    io.to(`user:${userId.toString()}`).emit(eventName, payload);
  } catch (err) {
    // Non-blocking in tests or when socket is uninitialized
  }
};

/**
 * Creates a single persistent notification and delivers it to the user's private Socket.IO room.
 * Implements deduplication via dedupeKey to ensure idempotency.
 */
const createNotification = async ({
  recipient,
  user,
  type,
  title,
  message,
  event = null,
  registration = null,
  payment = null,
  ticket = null,
  attendance = null,
  dedupeKey = null,
}) => {
  const targetRecipient = recipient || user;
  if (!targetRecipient || !mongoose.Types.ObjectId.isValid(targetRecipient)) {
    throw new Error('A valid recipient ObjectId is required.');
  }

  // 1. Check idempotency if dedupeKey is provided
  if (dedupeKey) {
    const existing = await Notification.findOne({ dedupeKey: dedupeKey.trim() });
    if (existing) {
      return existing;
    }
  }

  // 2. Create notification document in MongoDB
  let notification;
  try {
    notification = await Notification.create({
      recipient: targetRecipient,
      type,
      title: title.trim(),
      message: message.trim(),
      event,
      registration,
      payment,
      ticket,
      attendance,
      dedupeKey: dedupeKey ? dedupeKey.trim() : undefined,
      isRead: false,
    });
  } catch (err) {
    // If duplicate key race condition occurred on dedupeKey, resolve existing
    if (err.code === 11000 && dedupeKey) {
      const existing = await Notification.findOne({ dedupeKey: dedupeKey.trim() });
      if (existing) return existing;
    }
    throw err;
  }

  // 3. Emit real-time notification to the user's private Socket.IO room ONLY
  const socketPayload = {
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    event: notification.event,
    registration: notification.registration,
    ticket: notification.ticket,
    attendance: notification.attendance,
    read: notification.isRead,
    isRead: notification.isRead,
    dedupeKey: notification.dedupeKey,
    createdAt: notification.createdAt,
  };

  emitToUser(targetRecipient, 'notification:new', socketPayload);
  emitToUser(targetRecipient, 'notification_created', notification);

  // 4. Update real-time unread count
  try {
    const unreadCount = await Notification.countDocuments({ recipient: targetRecipient, isRead: false });
    emitToUser(targetRecipient, 'unread_count_updated', { count: unreadCount, unreadCount });
  } catch (e) {}

  return notification;
};

/**
 * Bulk creation of notifications (e.g. for notifying registered students of an event update or cancellation).
 */
const createNotifications = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const created = [];
  for (const item of items) {
    try {
      const notif = await createNotification(item);
      created.push(notif);
    } catch (err) {
      console.warn('[NotificationService] Error creating notification item:', err.message);
    }
  }
  return created;
};

/**
 * Fetches paginated notifications for the authenticated user.
 * Strictly scoped to req.user._id (recipient).
 */
const getUserNotifications = async (userId, { page = 1, limit = 20, unreadOnly = false } = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (p - 1) * l;

  const filter = { recipient: userId };
  if (unreadOnly === true || unreadOnly === 'true') {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l)
      .populate('event', 'title date venue time isPaid fee status')
      .populate('ticket', 'ticketCode status')
      .populate('payment', 'amount status transactionId')
      .populate('registration', 'status registeredAt')
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
      hasNextPage: p * l < total,
      hasPrevPage: p > 1,
    },
  };
};

/**
 * Returns current unread notification count for authenticated user.
 */
const getUnreadCount = async (userId) => {
  return await Notification.countDocuments({ recipient: userId, isRead: false });
};

/**
 * Marks a specific notification as read.
 * Strictly verifies ownership (recipient === userId).
 */
const markAsRead = async (notificationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) return null;

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) return null;

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });
    emitToUser(userId, 'notification:read', { notificationId: notification._id });
    emitToUser(userId, 'notification_read', { notificationId: notification._id });
    emitToUser(userId, 'unread_count_updated', { count: unreadCount, unreadCount });
  }

  return notification;
};

/**
 * Marks all unread notifications as read for authenticated user.
 */
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  emitToUser(userId, 'notification:read_all', { modifiedCount: result.modifiedCount });
  emitToUser(userId, 'notification_read_all', { modifiedCount: result.modifiedCount });
  emitToUser(userId, 'unread_count_updated', { count: 0, unreadCount: 0 });

  return result.modifiedCount;
};

/**
 * Deletes a notification belonging to authenticated user.
 * Strictly verifies ownership (recipient === userId).
 */
const deleteNotification = async (notificationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) return null;

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) return null;

  const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });
  emitToUser(userId, 'notification_deleted', { notificationId });
  emitToUser(userId, 'unread_count_updated', { count: unreadCount, unreadCount });

  return notification;
};

/**
 * Notifies active students when an event is published.
 */
const notifyEventPublished = async ({ event }) => {
  if (!event || !event._id) return [];
  const User = require('../models/User');
  const students = await User.find({ role: 'STUDENT' }, '_id').lean();
  const notifs = [];
  for (const student of students) {
    const notif = await createNotification({
      recipient: student._id,
      type: 'EVENT_PUBLISHED',
      title: 'New Event Published',
      message: `${event.title} is now open for registration.`,
      event: event._id,
      dedupeKey: `EVENT_PUBLISHED:${event._id}:${student._id}`,
    });
    if (notif) notifs.push(notif);
  }
  return notifs;
};

/**
 * Notifies a student upon successful event registration.
 */
const notifyRegistrationSuccess = async ({ registration, event, studentId }) => {
  const targetUser = studentId || registration?.student;
  const eventTitle = event?.title || 'Campus Event';
  const eventId = event?._id || registration?.event;
  return await createNotification({
    recipient: targetUser,
    type: 'REGISTRATION_SUCCESS',
    title: 'Registration Successful',
    message: `You successfully registered for ${eventTitle}. Your Digital Event Pass is ready.`,
    event: eventId,
    registration: registration?._id,
    dedupeKey: `REG_SUCCESS:${registration?._id}`,
  });
};

/**
 * Notifies registered students when an event's details are updated.
 */
const notifyEventUpdated = async ({ event, changedField }) => {
  if (!event || !event._id) return [];
  const Registration = require('../models/Registration');
  const activeRegs = await Registration.find({ event: event._id, status: 'REGISTERED' }).lean();
  const title = 'Event Updated';
  const message = changedField
    ? `${changedField} for ${event.title} has been changed. Please check the updated event details.`
    : `${event.title} has been updated. Please check the latest event details.`;

  const notifs = [];
  for (const reg of activeRegs) {
    const notif = await createNotification({
      recipient: reg.student,
      type: 'EVENT_UPDATED',
      title,
      message,
      event: event._id,
      registration: reg._id,
      dedupeKey: `EVENT_UPDATED:${event._id}:${reg.student}:${Date.now()}`,
    });
    if (notif) notifs.push(notif);
  }
  return notifs;
};

/**
 * Notifies registered students when capacity increases.
 */
const notifyCapacityIncreased = async ({ event, oldCapacity, newCapacity }) => {
  if (!event || !event._id || newCapacity <= oldCapacity) return [];
  const Registration = require('../models/Registration');
  const activeRegs = await Registration.find({ event: event._id, status: 'REGISTERED' }).lean();
  const notifs = [];
  for (const reg of activeRegs) {
    const notif = await createNotification({
      recipient: reg.student,
      type: 'CAPACITY_INCREASED',
      title: 'Event Capacity Increased',
      message: `Capacity for ${event.title} has increased from ${oldCapacity} to ${newCapacity}.`,
      event: event._id,
      registration: reg._id,
      dedupeKey: `CAPACITY_INC:${event._id}:${reg.student}:${newCapacity}`,
    });
    if (notif) notifs.push(notif);
  }
  return notifs;
};

/**
 * Notifies eligible students / admin when remaining seats <= 10% or <= 5.
 */
const notifySeatsNearlyFull = async ({ event, remainingSeats }) => {
  if (!event || !event._id) return null;
  const capacity = event.capacity || 100;
  const threshold = Math.max(5, Math.floor(capacity * 0.1));
  if (remainingSeats > threshold) return null;

  let adminNotif = null;
  if (event.createdBy) {
    adminNotif = await createNotification({
      recipient: event.createdBy,
      type: 'EVENT_ALMOST_FULL',
      title: `Event Almost Full: ${event.title}`,
      message: `Event "${event.title}" has reached limited capacity (${remainingSeats} seats remaining).`,
      event: event._id,
      dedupeKey: `SEATS_NEARLY_FULL:${event._id}`,
    });
  }
  return adminNotif;
};

/**
 * Notifies student when attendance is updated (PRESENT / ABSENT).
 * Strictly skips if previousStatus === status.
 */
const notifyAttendanceUpdated = async ({ studentId, event, status, previousStatus, registrationId, attendanceId }) => {
  if (previousStatus === status) return null; // Strictly skip duplicate status!
  if (!['PRESENT', 'ABSENT'].includes(status)) return null;

  const eventTitle = event?.title || 'Campus Event';
  const eventId = event?._id || event;
  const message = status === 'PRESENT'
    ? `Your attendance for ${eventTitle} has been marked Present.`
    : `Your attendance for ${eventTitle} has been marked Absent.`;

  return await createNotification({
    recipient: studentId,
    type: status === 'PRESENT' ? 'ATTENDANCE_MARKED_PRESENT' : 'ATTENDANCE_MARKED_ABSENT',
    title: 'Attendance Updated',
    message,
    event: eventId,
    registration: registrationId,
    attendance: attendanceId,
    dedupeKey: `ATT_NOTIF:${registrationId || studentId}:${status}:${Date.now()}`,
  });
};

/**
 * Notifies student when certificate is issued.
 */
const notifyCertificateIssued = async ({ certificate, event, studentId }) => {
  const eventTitle = event?.title || 'Campus Event';
  const eventId = event?._id || certificate?.event;
  const targetUser = studentId || certificate?.student;
  return await createNotification({
    recipient: targetUser,
    type: 'CERTIFICATE_ISSUED',
    title: 'Certificate Issued',
    message: `Your participation certificate for ${eventTitle} has been issued.`,
    event: eventId,
    registration: certificate?.registration,
    dedupeKey: `CERT_ISSUED:${certificate?._id || targetUser}`,
  });
};

/**
 * Notifies student when certificate receipt is confirmed.
 */
const notifyCertificateReceived = async ({ certificate, event, studentId }) => {
  const eventTitle = event?.title || 'Campus Event';
  const eventId = event?._id || certificate?.event;
  const targetUser = studentId || certificate?.student;
  return await createNotification({
    recipient: targetUser,
    type: 'CERTIFICATE_RECEIVED',
    title: 'Certificate Receipt Confirmed',
    message: `Your certificate receipt for ${eventTitle} has been recorded.`,
    event: eventId,
    registration: certificate?.registration,
    dedupeKey: `CERT_RECEIVED:${certificate?._id || targetUser}`,
  });
};

/**
 * Notifies registered students when registration deadline passes.
 */
const notifyRegistrationClosed = async ({ event, studentId }) => {
  const eventTitle = event?.title || 'Campus Event';
  const eventId = event?._id || event;
  return await createNotification({
    recipient: studentId,
    type: 'REGISTRATION_CLOSED',
    title: 'Registration Closed',
    message: `Registration for ${eventTitle} is now closed.`,
    event: eventId,
    dedupeKey: `REGISTRATION_CLOSED:${eventId}:${studentId}`,
  });
};

/**
 * 24-hour reminder before event.
 */
const notifyEventReminder24H = async ({ event, studentId, registrationId }) => {
  return await createNotification({
    recipient: studentId,
    type: 'EVENT_REMINDER_24H',
    title: 'Event Tomorrow',
    message: `${event.title} starts tomorrow at ${event.time || 'scheduled time'}. Venue: ${event.venue || 'Campus'}.`,
    event: event._id,
    registration: registrationId,
    dedupeKey: `EVENT_REMINDER_24H:${event._id}:${studentId}`,
  });
};

/**
 * 1-hour reminder before event.
 */
const notifyEventReminder1H = async ({ event, studentId, registrationId }) => {
  return await createNotification({
    recipient: studentId,
    type: 'EVENT_REMINDER_1H',
    title: 'Event Starting Soon',
    message: `${event.title} starts in about 1 hour. Venue: ${event.venue || 'Campus'}.`,
    event: event._id,
    registration: registrationId,
    dedupeKey: `EVENT_REMINDER_1H:${event._id}:${studentId}`,
  });
};

module.exports = {
  createNotification,
  createNotifications,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  notifyEventPublished,
  notifyRegistrationSuccess,
  notifyEventUpdated,
  notifyCapacityIncreased,
  notifySeatsNearlyFull,
  notifyAttendanceUpdated,
  notifyCertificateIssued,
  notifyCertificateReceived,
  notifyRegistrationClosed,
  notifyEventReminder24H,
  notifyEventReminder1H,
};
