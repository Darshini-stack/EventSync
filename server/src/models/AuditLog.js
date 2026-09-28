const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Audit actor is required'],
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      enum: [
        'STUDENT_REGISTERED',
        'ATTENDANCE_MARKED',
        'ATTENDANCE_CHANGED',
        'CERTIFICATE_ISSUED',
        'CERTIFICATE_RECEIPT_CONFIRMED',
        'EVENT_CREATED',
        'EVENT_PUBLISHED',
        'EVENT_EDITED',
        'PAYMENT_SUBMITTED',
        'PAYMENT_APPROVED',
        'PAYMENT_REJECTED',
        'PAYMENT_RETRY_SUBMITTED',
      ],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Audit entityId is required'],
    },
    entityType: {
      type: String,
      default: 'Event',
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
