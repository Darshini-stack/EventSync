const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const AuditLog = require('../models/AuditLog');
const { uploadDir } = require('../middleware/upload');

// Helper to safely emit real-time events via Socket.IO
const emitSocketEvent = (eventName, payload) => {
  try {
    const { getIO } = require('../sockets');
    const io = getIO();
    io.emit(eventName, payload);
  } catch (err) {
    console.warn(`[Socket.IO] Broadcast warning for ${eventName}:`, err.message);
  }
};

/**
 * POST /api/payments
 * Protected (STUDENT only):
 * Submits payment proof for a paid event registration.
 * Amount is derived strictly from Event.fee in MongoDB.
 * Enforces:
 *  - 1 active payment (PENDING or APPROVED) per registration
 *  - Free events rejected
 *  - Exactly ONE retry allowed after rejection
 */
const createPayment = async (req, res, next) => {
  try {
    const { registrationId, transactionId, proofBase64, proofFilename, proofMimeType } = req.body;

    // 1. Validate registrationId
    if (!registrationId || !mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid registrationId is required.',
      });
    }

    // 2. Validate transactionId
    if (!transactionId || typeof transactionId !== 'string' || transactionId.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A valid transaction ID (minimum 3 characters) is required.',
      });
    }

    // 3. Find registration and verify ownership
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration record not found.',
      });
    }

    if (registration.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to submit payment for this registration.',
      });
    }

    if (registration.status !== 'REGISTERED') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit payment for a registration with status ${registration.status}.`,
      });
    }

    // 4. Fetch Event directly from MongoDB to verify paid status and read real fee
    const event = await Event.findById(registration.event);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Associated event not found in database.',
      });
    }

    if (!event.isPaid || !event.fee || event.fee <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This event is free of charge. Payment proof is not required.',
      });
    }

    // 5. Inspect existing payments for this registration
    const existingPayments = await Payment.find({ registration: registrationId }).sort({ createdAt: -1 });

    const activePending = existingPayments.find((p) => p.status === 'PENDING');
    if (activePending) {
      return res.status(409).json({
        success: false,
        message: 'A payment proof is already pending verification for this registration.',
      });
    }

    const activeApproved = existingPayments.find((p) => p.status === 'APPROVED');
    if (activeApproved) {
      return res.status(409).json({
        success: false,
        message: 'Payment for this registration has already been approved and finalized.',
      });
    }

    const rejectedPayments = existingPayments.filter((p) => p.status === 'REJECTED');
    if (rejectedPayments.length >= 2) {
      return res.status(400).json({
        success: false,
        message: 'Maximum payment retry limit (1 retry) reached for this registration.',
      });
    }

    const isRetry = rejectedPayments.length === 1;

    // 6. Process uploaded proof file (supports multipart file or base64 payload)
    let proofData = null;

    if (req.file) {
      proofData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
      };
    } else if (proofBase64) {
      // Decode base64 proof buffer (used in automated tests and fallback)
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      const mime = proofMimeType || 'image/png';
      if (!allowedMimes.includes(mime)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proof format. Only JPEG, PNG, WEBP images and PDF files are allowed.',
        });
      }

      const ext = mime === 'application/pdf' ? '.pdf' : mime === 'image/jpeg' ? '.jpg' : '.png';
      const safeFilename = `proof_${crypto.randomUUID()}${ext}`;
      const filePath = path.join(uploadDir, safeFilename);

      const buffer = Buffer.from(proofBase64, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Proof file size exceeds 5MB limit.',
        });
      }

      fs.writeFileSync(filePath, buffer);

      proofData = {
        filename: safeFilename,
        originalName: proofFilename || `proof${ext}`,
        path: filePath,
        mimetype: mime,
        size: buffer.length,
        uploadedAt: new Date(),
      };
    }

    if (!proofData) {
      return res.status(400).json({
        success: false,
        message: 'Payment proof file is required. Please upload an image or PDF proof.',
      });
    }

    // 7. Security: Payment amount is strictly derived from Event.fee
    const paymentAmount = Number(event.fee);

    // 8. Create Payment document
    const payment = await Payment.create({
      student: req.user._id,
      event: event._id,
      registration: registration._id,
      amount: paymentAmount,
      proof: proofData,
      transactionId: transactionId.trim(),
      status: 'PENDING',
      retryCount: isRetry ? 1 : 0,
      submittedAt: new Date(),
    });

    // 9. Create Audit Log record
    await AuditLog.create({
      actor: req.user._id,
      action: isRetry ? 'PAYMENT_RETRY_SUBMITTED' : 'PAYMENT_SUBMITTED',
      entityId: payment._id,
      entityType: 'Payment',
      details: {
        amount: paymentAmount,
        transactionId: payment.transactionId,
        retryCount: payment.retryCount,
        eventId: event._id,
        registrationId: registration._id,
      },
    });

    // 10. Emit safe real-time Socket.IO event (no sensitive transaction/proof data broadcast)
    emitSocketEvent('payment_status_updated', {
      paymentId: payment._id,
      registrationId: registration._id,
      eventId: event._id,
      studentId: req.user._id,
      status: 'PENDING',
    });

    // 11. Generate persistent admin notification: PAYMENT_SUBMITTED
    try {
      const notificationService = require('../services/notificationService');
      const User = require('../models/User');
      const admins = await User.find({ role: 'EVENTADMIN' }, '_id').lean();
      for (const admin of admins) {
        await notificationService.createNotification({
          recipient: admin._id,
          type: 'PAYMENT_SUBMITTED',
          title: 'New Payment Submitted',
          message: `Student submitted payment for "${event.title}". Transaction ID: ${payment.transactionId}.`,
          event: event._id,
          payment: payment._id,
          registration: registration._id,
        });
      }
    } catch (notifErr) {
      console.warn('[Notification] Warning sending payment_submitted notification:', notifErr.message);
    }

    await payment.populate('event', 'title fee isPaid date venue');

    return res.status(201).json({
      success: true,
      message: isRetry
        ? 'Payment proof resubmitted successfully. Pending verification.'
        : 'Payment proof submitted successfully. Pending verification.',
      data: payment,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A payment submission is already active for this registration.',
      });
    }
    next(error);
  }
};

/**
 * GET /api/payments/my
 * Protected (STUDENT only):
 * Returns payments belonging strictly to the authenticated student.
 */
const getMyPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ student: req.user._id })
      .populate('event', 'title fee isPaid date venue gradient')
      .populate('registration', 'status registeredAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/admin
 * Protected (EVENTADMIN only):
 * Returns payment submissions with student and event details for verification.
 */
const getAdminPayments = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && ['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.eventId && mongoose.Types.ObjectId.isValid(req.query.eventId)) {
      filter.event = req.query.eventId;
    }

    const [payments, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Payment.find(filter)
        .populate('student', 'name email phone')
        .populate('event', 'title fee isPaid date venue')
        .populate('registration', 'status registeredAt')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
      Payment.countDocuments({ status: 'PENDING' }),
      Payment.countDocuments({ status: 'APPROVED' }),
      Payment.countDocuments({ status: 'REJECTED' }),
    ]);

    return res.status(200).json({
      success: true,
      count: payments.length,
      counts: {
        total: pendingCount + approvedCount + rejectedCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/:id
 * Protected:
 * Returns single payment detail. Student can only access their own.
 */
const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.',
      });
    }

    const payment = await Payment.findById(id)
      .populate('student', 'name email phone')
      .populate('event', 'title fee isPaid date venue')
      .populate('registration', 'status registeredAt')
      .populate('reviewedBy', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.',
      });
    }

    // Authorization check: EventAdmin or owning student only
    if (req.user.role !== 'EVENTADMIN' && payment.student._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this payment record.',
      });
    }

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/:id/proof
 * Protected:
 * Securely streams the stored payment proof file.
 * Accessible strictly by the owning student or an authorized EVENTADMIN.
 */
const getPaymentProof = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Payment proof not found.',
      });
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment proof not found.',
      });
    }

    // Security check: Only owning student or EVENTADMIN can access proof file
    if (req.user.role !== 'EVENTADMIN' && payment.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to view this proof document.',
      });
    }

    const proofPath = payment.proof ? payment.proof.path : null;
    if (!proofPath || !fs.existsSync(proofPath)) {
      return res.status(404).json({
        success: false,
        message: 'Payment proof file is missing from server storage.',
      });
    }

    // Prevent path traversal outside uploads directory
    const resolvedPath = path.resolve(proofPath);
    if (!resolvedPath.startsWith(uploadDir)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid proof path.',
      });
    }

    res.setHeader('Content-Type', payment.proof.mimetype || 'application/octet-stream');
    return res.sendFile(resolvedPath);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/payments/:id/approve
 * Protected (EVENTADMIN only):
 * Approves a PENDING payment proof.
 */
const approvePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
      });
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
      });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Only PENDING payments can be approved. Current status is ${payment.status}.`,
      });
    }

    payment.status = 'APPROVED';
    payment.reviewedBy = req.user._id;
    payment.reviewedAt = new Date();
    await payment.save();

    // Create Audit Log
    await AuditLog.create({
      actor: req.user._id,
      action: 'PAYMENT_APPROVED',
      entityId: payment._id,
      entityType: 'Payment',
      details: {
        amount: payment.amount,
        transactionId: payment.transactionId,
      },
    });

    // Emit Socket.IO event
    emitSocketEvent('payment_status_updated', {
      paymentId: payment._id,
      registrationId: payment.registration,
      eventId: payment.event,
      studentId: payment.student,
      status: 'APPROVED',
    });

    // Generate persistent student notification: PAYMENT_APPROVED
    try {
      const notificationService = require('../services/notificationService');
      const eventDoc = await Event.findById(payment.event).select('title').lean();
      const eventTitle = eventDoc ? eventDoc.title : 'Event';
      await notificationService.createNotification({
        recipient: payment.student,
        type: 'PAYMENT_APPROVED',
        title: 'Payment Approved',
        message: `Your payment of ₹${payment.amount} for "${eventTitle}" has been approved. You can now generate your digital ticket!`,
        event: payment.event,
        payment: payment._id,
        registration: payment.registration,
        dedupeKey: `PAYMENT_APPROVED:${payment._id}`,
      });
    } catch (notifErr) {
      console.warn('[Notification] Warning sending payment_approved notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment approved successfully.',
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/payments/:id/reject
 * Protected (EVENTADMIN only):
 * Rejects a PENDING payment proof. Requires rejectionReason.
 */
const rejectPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
      });
    }

    if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A valid rejection reason (minimum 3 characters) is required to reject a payment.',
      });
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
      });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Only PENDING payments can be rejected. Current status is ${payment.status}.`,
      });
    }

    payment.status = 'REJECTED';
    payment.rejectionReason = rejectionReason.trim();
    payment.reviewedBy = req.user._id;
    payment.reviewedAt = new Date();
    await payment.save();

    // Create Audit Log
    await AuditLog.create({
      actor: req.user._id,
      action: 'PAYMENT_REJECTED',
      entityId: payment._id,
      entityType: 'Payment',
      details: {
        rejectionReason: payment.rejectionReason,
      },
    });

    // Emit Socket.IO event
    emitSocketEvent('payment_status_updated', {
      paymentId: payment._id,
      registrationId: payment.registration,
      eventId: payment.event,
      studentId: payment.student,
      status: 'REJECTED',
      rejectionReason: payment.rejectionReason,
    });

    // Generate persistent student notifications: PAYMENT_REJECTED & PAYMENT_RETRY_AVAILABLE
    try {
      const notificationService = require('../services/notificationService');
      const eventDoc = await Event.findById(payment.event).select('title').lean();
      const eventTitle = eventDoc ? eventDoc.title : 'Event';

      await notificationService.createNotification({
        recipient: payment.student,
        type: 'PAYMENT_REJECTED',
        title: 'Payment Proof Rejected',
        message: `Your payment proof for "${eventTitle}" was rejected. Reason: "${payment.rejectionReason}".`,
        event: payment.event,
        payment: payment._id,
        registration: payment.registration,
      });

      // If retry is permitted (retryCount < 1)
      if (payment.retryCount < 1) {
        await notificationService.createNotification({
          recipient: payment.student,
          type: 'PAYMENT_RETRY_AVAILABLE',
          title: 'Payment Retry Available',
          message: `You have 1 retry available to submit a valid payment receipt for "${eventTitle}".`,
          event: payment.event,
          payment: payment._id,
          registration: payment.registration,
          dedupeKey: `PAYMENT_RETRY_AVAILABLE:${payment._id}`,
        });
      }
    } catch (notifErr) {
      console.warn('[Notification] Warning sending payment_rejected notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment rejected.',
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPayment,
  getMyPayments,
  getAdminPayments,
  getPaymentById,
  getPaymentProof,
  approvePayment,
  rejectPayment,
};
