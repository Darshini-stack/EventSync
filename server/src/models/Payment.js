const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
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
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: [true, 'Registration reference is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    proof: {
      filename: { type: String, required: [true, 'Proof filename is required'] },
      originalName: { type: String, required: [true, 'Proof original name is required'] },
      path: { type: String, required: [true, 'Proof file storage path is required'] },
      mimetype: { type: String, required: [true, 'Proof mimetype is required'] },
      size: { type: Number, required: [true, 'Proof file size is required'] },
      uploadedAt: { type: Date, default: Date.now },
    },
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      trim: true,
      minlength: [3, 'Transaction ID must be at least 3 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'APPROVED', 'REJECTED'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'PENDING',
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Concurrency-Safe Partial Unique Index:
// Guarantees at most ONE active payment (PENDING or APPROVED) can ever exist for a given registration.
// REJECTED payments are excluded from this partial index, allowing exactly ONE subsequent retry.
paymentSchema.index(
  { registration: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'APPROVED'] } },
  }
);

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
