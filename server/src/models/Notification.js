const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'EVENT_CREATED',
  'EVENT_PUBLISHED',
  'REGISTRATION_OPEN',
  'REGISTRATION_SUCCESS',
  'REGISTRATION_SUCCESSFUL',
  'STUDENT_REGISTERED',
  'REGISTRATION_DEADLINE',
  'REGISTRATION_CLOSING_SOON',
  'REGISTRATION_CLOSED',
  'SEATS_NEARLY_FULL',
  'EVENT_ALMOST_FULL',
  'EVENT_UPDATED',
  'EVENT_CANCELLED',
  'CAPACITY_INCREASED',
  'ATTENDANCE_UPDATED',
  'ATTENDANCE_MARKED_PRESENT',
  'ATTENDANCE_MARKED_ABSENT',
  'ATTENDANCE_CONFIRMED',
  'CERTIFICATE_ISSUED',
  'CERTIFICATE_RECEIVED',
  'CERTIFICATE_RECEIPT_CONFIRMED',
  'PAYMENT_SUBMITTED',
  'PAYMENT_APPROVED',
  'PAYMENT_REJECTED',
  'PAYMENT_RETRY_AVAILABLE',
  'WAITLIST_PROMOTED',
  'EVENT_REMINDER_24H',
  'EVENT_REMINDER_1H',
  'TICKET_ISSUED',
  'SYSTEM',
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: 1000,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      default: null,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    dedupeKey: {
      type: String,
      trim: true,
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

// Virtual aliases: user <-> recipient, read <-> isRead
notificationSchema.virtual('user')
  .get(function () {
    return this.recipient;
  })
  .set(function (v) {
    this.recipient = v;
  });

notificationSchema.virtual('read')
  .get(function () {
    return this.isRead;
  })
  .set(function (v) {
    this.isRead = v;
  });

// High-performance compound indexes for user query and unread filtering
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ event: 1, recipient: 1 });
notificationSchema.index({ event: 1, createdAt: -1 });

// Idempotent deduplication index: enforces unique dedupeKey only when present as a non-null string
notificationSchema.index(
  { dedupeKey: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } },
  }
);

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
