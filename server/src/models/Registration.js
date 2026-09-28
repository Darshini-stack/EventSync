const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['REGISTERED', 'CANCELLED', 'WAITLISTED'],
        message: '{VALUE} is not a valid registration status',
      },
      default: 'REGISTERED',
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    cancelledAt: {
      type: Date,
    },
    fullName: {
      type: String,
      trim: true,
    },
    rollNumber: {
      type: String,
      trim: true,
    },
    year: {
      type: String,
      enum: {
        values: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
        message: '{VALUE} is not a valid year',
      },
      trim: true,
    },
    department: {
      type: String,
      enum: {
        values: ['CSE', 'AI & ML', 'ECE', 'EEE', 'ME', 'Civil', 'Other'],
        message: '{VALUE} is not a valid department',
      },
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    teamSize: {
      type: Number,
      default: 1,
      min: 1,
    },
    teamName: {
      type: String,
      trim: true,
    },
    teamMembers: [
      {
        name: { type: String, trim: true },
        rollNumber: { type: String, trim: true },
        department: { type: String, trim: true },
        year: { type: String, trim: true },
        attendanceStatus: {
          type: String,
          enum: ['NOT_MARKED', 'PRESENT', 'ABSENT'],
          default: 'NOT_MARKED',
        },
        markedAt: { type: Date, default: null },
        markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        certificateStatus: {
          type: String,
          enum: ['NOT_ISSUED', 'ISSUED', 'RECEIVED'],
          default: 'NOT_ISSUED',
        },
        issuedAt: { type: Date, default: null },
        issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
    registrationCode: {
      type: String,
      trim: true,
    },
    attendanceStatus: {
      type: String,
      enum: ['NOT_MARKED', 'PRESENT', 'ABSENT'],
      default: 'NOT_MARKED',
    },
    certificateStatus: {
      type: String,
      enum: ['NOT_ISSUED', 'ISSUED', 'RECEIVED'],
      default: 'NOT_ISSUED',
    },
  },
  {
    timestamps: true,
  }
);

// Concurrency-safe unique compound index:
// Guarantees a student can NEVER have more than one active (REGISTERED) record for the same event
registrationSchema.index(
  { student: 1, event: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'REGISTERED' },
  }
);

const Registration = mongoose.model('Registration', registrationSchema);

module.exports = Registration;
