const mongoose = require('mongoose');
const crypto = require('crypto');
const qrcode = require('qrcode');
const Ticket = require('../models/Ticket');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const Payment = require('../models/Payment');

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
 * Generate a cryptographically secure, human-readable ticket code.
 * Example: ES-TCK-9A2F8B1E
 */
const generateTicketCode = () => {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ES-TCK-${randomHex}`;
};

/**
 * POST /api/tickets
 * Protected (STUDENT only):
 * Generates an active digital ticket for a verified registration.
 *
 * Eligibility Enforcement:
 * 1. Registration must belong to the authenticated student (req.user._id).
 * 2. Registration status must be 'REGISTERED'.
 * 3. Event must exist and be 'PUBLISHED'.
 * 4. Free events: Registration is sufficient.
 * 5. Paid events: Matching payment for the registration must exist and have status 'APPROVED'.
 * 6. Idempotency: If an ACTIVE ticket already exists, returns existing ticket (HTTP 200).
 */
const createTicket = async (req, res, next) => {
  try {
    const { registrationId } = req.body;

    // 1. Validate registrationId
    if (!registrationId || !mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid registrationId is required.',
      });
    }

    // 2. Fetch registration and verify student ownership
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
        message: 'You are not authorized to generate a ticket for another student\'s registration.',
      });
    }

    // 3. Verify registration is active (not cancelled)
    if (registration.status !== 'REGISTERED') {
      return res.status(400).json({
        success: false,
        message: `Cannot generate ticket for a registration with status ${registration.status}. Active registration is required.`,
      });
    }

    // 4. Fetch associated event directly from MongoDB
    const event = await Event.findById(registration.event);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Associated event not found.',
      });
    }

    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        message: `Cannot generate ticket for an event with status ${event.status}.`,
      });
    }

    // 4.5 Paid event verification: Must have an APPROVED payment
    let approvedPayment = null;
    if (event.isPaid) {
      approvedPayment = await Payment.findOne({
        registration: registration._id,
        status: 'APPROVED',
      });

      if (!approvedPayment) {
        return res.status(400).json({
          success: false,
          message: 'Cannot generate ticket for a paid event without an approved payment.',
        });
      }
    }

    // 5. Idempotency Check: Return existing active ticket if already issued
    const existingActiveTicket = await Ticket.findOne({
      registration: registration._id,
      status: 'ACTIVE',
    }).populate('event', 'title date time venue category gradient');

    if (existingActiveTicket) {
      return res.status(200).json({
        success: true,
        message: 'Active digital event pass retrieved.',
        data: existingActiveTicket,
      });
    }

    // 6. Server-side code generation with uniqueness guarantee
    let ticketCode = generateTicketCode();
    let collisionCheck = await Ticket.findOne({ ticketCode });
    while (collisionCheck) {
      ticketCode = generateTicketCode();
      collisionCheck = await Ticket.findOne({ ticketCode });
    }

    const passCode = ticketCode;
    const qrPayload = `EVENTSYNC:TICKET:${ticketCode}`;

    // 7. Create Digital Event Pass (Ticket) document
    try {
      const ticket = await Ticket.create({
        ticketCode,
        passCode,
        student: req.user._id,
        event: event._id,
        registration: registration._id,
        payment: approvedPayment ? approvedPayment._id : null,
        status: 'ACTIVE',
        qrPayload,
        department: registration.department || req.user.department || 'CSE',
        year: registration.year || req.user.year || '1st Year',
        issuedAt: new Date(),
      });

      emitSocketEvent('ticket_issued', {
        ticketId: ticket._id,
        ticketCode: ticket.ticketCode,
        registrationId: registration._id,
        eventId: event._id,
        studentId: req.user._id,
        status: 'ACTIVE',
      });

      // 10. Generate persistent notification: TICKET_ISSUED
      try {
        const notificationService = require('../services/notificationService');
        await notificationService.createNotification({
          recipient: req.user._id,
          type: 'TICKET_ISSUED',
          title: `Digital Pass Ready: ${event.title}`,
          message: `Your digital ticket for "${event.title}" has been issued. Ticket code: ${ticket.ticketCode}.`,
          event: event._id,
          ticket: ticket._id,
          registration: registration._id,
          dedupeKey: `TICKET_ISSUED:${ticket._id}`,
        });
      } catch (notifErr) {
        console.warn('[Notification] Warning sending ticket_issued notification:', notifErr.message);
      }

      await ticket.populate('event', 'title date time venue category isPaid fee gradient');

      return res.status(201).json({
        success: true,
        message: 'Digital QR ticket issued successfully.',
        data: ticket,
      });
    } catch (createErr) {
      // Concurrency race: if two requests simultaneously attempted to create, handle E11000 gracefully
      if (createErr.code === 11000) {
        const raceActiveTicket = await Ticket.findOne({
          registration: registration._id,
          status: 'ACTIVE',
        }).populate('event', 'title date time venue category isPaid fee gradient');

        if (raceActiveTicket) {
          return res.status(200).json({
            success: true,
            message: 'Active digital ticket retrieved.',
            data: raceActiveTicket,
          });
        }
      }
      throw createErr;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/my
 * Protected (STUDENT only):
 * Returns all tickets issued to the authenticated student.
 */
const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ student: req.user._id })
      .populate('event', 'title date time venue category isPaid fee gradient')
      .populate('registration', 'status registeredAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/admin
 * Protected (EVENTADMIN only):
 * Returns ticket roster with student, event, and status metrics.
 */
const getAdminTickets = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && ['ACTIVE', 'CANCELLED'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.eventId && mongoose.Types.ObjectId.isValid(req.query.eventId)) {
      filter.event = req.query.eventId;
    }

    const [tickets, activeCount, cancelledCount] = await Promise.all([
      Ticket.find(filter)
        .populate('student', 'name email phone')
        .populate('event', 'title date time venue category isPaid fee')
        .populate('registration', 'status registeredAt')
        .sort({ createdAt: -1 })
        .lean(),
      Ticket.countDocuments({ status: 'ACTIVE' }),
      Ticket.countDocuments({ status: 'CANCELLED' }),
    ]);

    return res.status(200).json({
      success: true,
      count: tickets.length,
      counts: {
        total: activeCount + cancelledCount,
        active: activeCount,
        cancelled: cancelledCount,
      },
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/:id
 * Protected:
 * Returns single ticket details.
 * Accessible strictly by ticket owner or EVENTADMIN.
 */
const getTicketById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    const ticket = await Ticket.findById(id)
      .populate('student', 'name email phone')
      .populate('event', 'title date time venue category isPaid fee gradient')
      .populate('registration', 'status registeredAt');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    // Ownership check: Student owner or EventAdmin only
    if (req.user.role !== 'EVENTADMIN' && ticket.student._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this digital ticket.',
      });
    }

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/:id/qr
 * Protected:
 * Dynamically generates and streams the QR code PNG image from the stored qrPayload.
 * Accessible strictly by ticket owner or EVENTADMIN.
 */
const getTicketQrImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    // Security check: Only owning student or EVENTADMIN can access ticket QR
    if (req.user.role !== 'EVENTADMIN' && ticket.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this ticket QR.',
      });
    }

    // Support member-specific QR payload for team registrations
    const memberRoll = req.query.memberRollNumber || req.query.rollNumber;
    let payloadToEncode = ticket.qrPayload;
    if (memberRoll && typeof memberRoll === 'string' && memberRoll.trim()) {
      const trimmedRoll = memberRoll.trim();
      const basePassCode = ticket.passCode || ticket.ticketCode;
      payloadToEncode = `EVENTSYNC:PASS:${basePassCode}:${trimmedRoll}`;
    }

    // If client requested JSON format with data URL
    if (req.query.format === 'json') {
      const dataUrl = await qrcode.toDataURL(payloadToEncode, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 320,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      return res.status(200).json({
        success: true,
        ticketCode: ticket.ticketCode,
        qrPayload: payloadToEncode,
        dataUrl,
      });
    }

    // Default: Stream direct PNG image
    const qrBuffer = await qrcode.toBuffer(payloadToEncode, {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(qrBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/registration/:registrationId
 * Protected: Retrieve Digital Event Pass by registrationId.
 * Allowed for the owner student or an EventAdmin.
 */
const getPassByRegistration = async (req, res, next) => {
  try {
    const { registrationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({ success: false, message: 'Invalid registration ID.' });
    }

    const registration = await Registration.findById(registrationId)
      .populate('event', 'title venue date time mode category gradient')
      .populate('student', 'name email studentId department year');

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found.' });
    }

    const isOwner = req.user && req.user._id.toString() === (registration.student?._id || registration.student).toString();
    const isEventAdmin = req.user && req.user.role === 'EVENTADMIN';
    if (!isOwner && !isEventAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    let ticket = await Ticket.findOne({ registration: registrationId, status: 'ACTIVE' });
    if (!ticket) {
      let ticketCode = generateTicketCode();
      let collisionCheck = await Ticket.findOne({ ticketCode });
      while (collisionCheck) {
        ticketCode = generateTicketCode();
        collisionCheck = await Ticket.findOne({ ticketCode });
      }
      const passCode = ticketCode;
      ticket = await Ticket.create({
        ticketCode,
        passCode,
        student: registration.student?._id || registration.student,
        event: registration.event?._id || registration.event,
        registration: registration._id,
        status: 'ACTIVE',
        qrPayload: `EVENTSYNC:TICKET:${ticketCode}`,
        department: registration.department || registration.student?.department || 'CSE',
        year: registration.year || registration.student?.year || '1st Year',
      });
    }

    const qrDataUrl = await qrcode.toDataURL(ticket.qrPayload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
    });

    return res.status(200).json({
      success: true,
      data: {
        passCode: ticket.passCode || ticket.ticketCode,
        ticketCode: ticket.ticketCode,
        qrPayload: ticket.qrPayload,
        qrDataUrl,
        status: ticket.status,
        issuedAt: ticket.issuedAt,
        registrationId: registration._id,
        registrationCode: registration.registrationCode || '',
        studentName: registration.fullName || registration.student?.name || 'Student',
        rollNumber: registration.rollNumber || registration.student?.studentId || 'N/A',
        department: registration.department || registration.student?.department || 'Other',
        year: registration.year || registration.student?.year || '1st Year',
        teamMembers: registration.teamMembers || [],
        event: registration.event,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTicket,
  getMyTickets,
  getAdminTickets,
  getTicketById,
  getTicketQrImage,
  getPassByRegistration,
};
