const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    memberRollNumber: {
      type: String,
      trim: true,
      default: '',
    },
    memberName: {
      type: String,
      trim: true,
      default: '',
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: [true, 'Registration reference is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['NOT_ISSUED', 'ISSUED', 'RECEIVED'],
        message: '{VALUE} is not a valid certificate status',
      },
      default: 'NOT_ISSUED',
      required: true,
    },
    issuedAt: {
      type: Date,
      default: null,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Concurrency-safe unique indexes:
// Guarantees one certificate record per attendee within a registration
certificateSchema.index({ registration: 1, memberRollNumber: 1 }, { unique: true });

const Certificate = mongoose.model('Certificate', certificateSchema);

module.exports = Certificate;
