const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: [true, 'Registration reference is required'],
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
    markedAt: {
      type: Date,
      default: null,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['NOT_MARKED', 'PRESENT', 'ABSENT', 'CHECKED_IN', 'CANCELLED'],
        message: '{VALUE} is not a valid attendance status',
      },
      default: 'NOT_MARKED',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Concurrency-Safe Unique Index:
// Guarantees one attendance record per attendee (primary or specific team member) within a registration.
attendanceSchema.index({ registration: 1, memberRollNumber: 1 }, { unique: true });
attendanceSchema.index({ event: 1 });
attendanceSchema.index({ student: 1 });
attendanceSchema.index({ ticket: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
