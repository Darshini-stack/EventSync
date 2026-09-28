const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: [true, 'Ticket code is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    passCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    department: {
      type: String,
      trim: true,
    },
    year: {
      type: String,
      trim: true,
    },
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
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: [true, 'Registration reference is required'],
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'CANCELLED'],
        message: '{VALUE} is not a valid ticket status',
      },
      default: 'ACTIVE',
    },
    qrPayload: {
      type: String,
      required: [true, 'QR payload is required'],
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Concurrency-safe partial unique index:
// Guarantees at most ONE ACTIVE ticket per registration.
// CANCELLED tickets are excluded from this unique filter.
ticketSchema.index(
  { registration: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
  }
);

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
