const mongoose = require('mongoose');
const crypto = require('crypto');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Attendance = require('../models/Attendance');
const Certificate = require('../models/Certificate');
const AuditLog = require('../models/AuditLog');

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

const ALLOWED_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const ALLOWED_DEPARTMENTS = [
  'Artificial Intelligence (AI)',
  'Computer Science and Engineering (CSE)',
  'Information Technology (IT)',
  'Electronics and Communication Engineering (ECE)',
  'Electrical and Electronics Engineering (EEE)',
  'Mechanical Engineering (ME)',
  'Civil Engineering (CE)',
  'AI',
  'AI & ML',
  'CSE',
  'IT',
  'ECE',
  'EEE',
  'ME',
  'Civil',
  'CE',
  'Other',
];

/**
 * POST /api/registrations
 * Protected (STUDENT only):
 * Creates an event registration using concurrency-safe atomic seat allocation.
 * Enforces all backend validations: deadline, status, duplicate prevention, team members,
 * and initializes Digital Pass, Attendance (NOT_MARKED), and Certificate (NOT_ISSUED).
 */
const createRegistration = async (req, res, next) => {
  try {
    const eventId = req.body.eventId || req.params.id || req.params.eventId;
    const {
      fullName,
      rollNumber,
      year,
      department,
      teamMembers,
    } = req.body;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid eventId is required.',
      });
    }

    // 1. Verify event exists and inspect status
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    // Explicit status checks
    if (event.status === 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Registration is not available. Event is currently in draft mode.',
      });
    }

    if (event.status === 'REGISTRATION_CLOSED') {
      return res.status(400).json({
        success: false,
        message: 'Registration is closed for this event.',
      });
    }

    if (event.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot register. This event has already completed.',
      });
    }

    if (event.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot register. This event has been cancelled.',
      });
    }

    if (event.status !== 'PUBLISHED' && event.status !== 'REGISTRATION_OPEN') {
      return res.status(400).json({
        success: false,
        message: `Registration is not open for this event (current status: ${event.status}).`,
      });
    }

    // 2. Deadline check on BACKEND
    if (event.registrationDeadline) {
      const now = new Date();
      const deadline = new Date(event.registrationDeadline);
      if (now > deadline) {
        return res.status(400).json({
          success: false,
          message: 'Registration deadline has passed. Registration is closed.',
        });
      }
    }

    // 3. Validate Personal Details
    let trimmedName;
    if (fullName !== undefined && fullName !== null) {
      trimmedName = String(fullName).trim();
      if (trimmedName.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Full Name is required and must be at least 2 characters.',
        });
      }
    } else {
      trimmedName = String(req.user?.name || 'Student').trim();
    }

    let trimmedRollNumber;
    if (rollNumber !== undefined && rollNumber !== null) {
      trimmedRollNumber = String(rollNumber).trim();
      if (trimmedRollNumber.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Roll Number is required and must be at least 2 characters.',
        });
      }
    } else {
      trimmedRollNumber = req.user?.studentId || (req.user?._id ? `STU-${req.user._id.toString().slice(-6).toUpperCase()}` : 'STU-001');
    }

    let selectedYear;
    if (year !== undefined && year !== null && String(year).trim() !== '') {
      selectedYear = String(year).trim();
      if (!ALLOWED_YEARS.includes(selectedYear)) {
        return res.status(400).json({
          success: false,
          message: `Invalid Year. Must be one of: ${ALLOWED_YEARS.join(', ')}`,
        });
      }
    } else {
      selectedYear = (req.user?.year && ALLOWED_YEARS.includes(req.user.year))
        ? req.user.year
        : '1st Year';
    }

    let selectedDepartment;
    if (department !== undefined && department !== null && String(department).trim() !== '') {
      selectedDepartment = String(department).trim();
      if (!ALLOWED_DEPARTMENTS.includes(selectedDepartment)) {
        return res.status(400).json({
          success: false,
          message: `Invalid Department. Must be one of: ${ALLOWED_DEPARTMENTS.join(', ')}`,
        });
      }
    } else {
      selectedDepartment = (req.user?.department && ALLOWED_DEPARTMENTS.includes(req.user.department))
        ? req.user.department
        : 'Other';
    }

    // 4. Prevent duplicate active registration
    const existingActiveReg = await Registration.findOne({
      student: req.user._id,
      event: eventId,
      status: 'REGISTERED',
    });

    if (existingActiveReg) {
      return res.status(409).json({
        success: false,
        message: 'You are already registered for this event.',
        alreadyRegistered: true,
        data: existingActiveReg,
      });
    }

    // 5. Validate & sanitize Team Members and enforce unique roll numbers
    const maxMembers = event.maxTeamSize || 5;
    let parsedTeamSize = parseInt(req.body.teamSize, 10);
    if (isNaN(parsedTeamSize) || parsedTeamSize < 1) {
      parsedTeamSize = Array.isArray(teamMembers) && teamMembers.length > 0 ? teamMembers.length + 1 : 1;
    }
    parsedTeamSize = Math.max(1, Math.min(maxMembers, parsedTeamSize));

    const validTeamMembers = [];
    const seenRollNumbers = new Set();
    seenRollNumbers.add(trimmedRollNumber.toUpperCase());

    if (Array.isArray(teamMembers)) {
      for (let i = 0; i < teamMembers.length; i++) {
        const tm = teamMembers[i];
        if (!tm) continue;
        const tmName = String(tm.name || '').trim();
        const tmRoll = String(tm.rollNumber || tm.rollNo || '').trim();
        const tmDept = String(tm.department || tm.branch || selectedDepartment).trim();
        const tmYear = String(tm.year || selectedYear).trim();

        // Skip completely empty optional rows
        if (!tmName && !tmRoll) continue;

        // If partially filled, enforce both
        if (!tmName || !tmRoll) {
          return res.status(400).json({
            success: false,
            message: `Team Member ${i + 1} must include both Name and Roll Number.`,
          });
        }

        const upperRoll = tmRoll.toUpperCase();
        if (seenRollNumbers.has(upperRoll)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate roll number detected: "${tmRoll}". Each participant must have a unique roll number.`,
          });
        }
        seenRollNumbers.add(upperRoll);

        const tmCollege = String(tm.college || req.body.college || req.user?.college || '').trim();
        const tmEmail = String(tm.email || '').trim();
        const tmPhone = String(tm.phone || '').trim();

        validTeamMembers.push({
          name: tmName,
          rollNumber: tmRoll,
          department: tmDept,
          year: tmYear,
          college: tmCollege,
          email: tmEmail,
          phone: tmPhone,
          attendanceStatus: 'NOT_MARKED',
          certificateStatus: 'NOT_ISSUED',
        });

        if (validTeamMembers.length >= maxMembers - 1) break;
      }
    }

    const contactEmail = req.body.email ? String(req.body.email).trim() : (req.user?.email || '');
    const contactPhone = req.body.phone ? String(req.body.phone).trim() : (req.user?.phone || '');
    const studentCollege = req.body.college ? String(req.body.college).trim() : (req.user?.college || '');
    const teamName = req.body.teamName ? String(req.body.teamName).trim() : '';

    // 6. Concurrency-Safe Atomic Seat Allocation:
    // Decrement availableSeats only if > 0 and event is open and deadline has not passed
    const now = new Date();
    const updatedEvent = await Event.findOneAndUpdate(
      {
        _id: eventId,
        status: { $in: ['PUBLISHED', 'REGISTRATION_OPEN'] },
        availableSeats: { $gt: 0 },
        $or: [
          { registrationDeadline: { $exists: false } },
          { registrationDeadline: null },
          { registrationDeadline: { $gte: now } },
        ],
      },
      { $inc: { availableSeats: -1 } },
      { new: true }
    );

    if (!updatedEvent) {
      // Differentiate why seat allocation failed
      const freshCheck = await Event.findById(eventId);
      if (freshCheck && freshCheck.availableSeats <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Event is at full capacity. No seats available.',
        });
      }
      if (freshCheck && freshCheck.registrationDeadline && now > new Date(freshCheck.registrationDeadline)) {
        return res.status(400).json({
          success: false,
          message: 'Registration deadline has passed. Registration closed.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Unable to reserve seat. Event registration is currently unavailable.',
      });
    }

    // 7. Create Registration document
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const registrationCode = `REG-2026-${randomHex}`;

    let registration;
    try {
      registration = await Registration.create({
        student: req.user._id,
        event: eventId,
        status: 'REGISTERED',
        registeredAt: new Date(),
        fullName: trimmedName,
        rollNumber: trimmedRollNumber,
        year: selectedYear,
        department: selectedDepartment,
        college: studentCollege,
        email: contactEmail,
        phone: contactPhone,
        teamSize: parsedTeamSize,
        teamName,
        teamMembers: validTeamMembers,
        registrationCode,
      });
    } catch (createErr) {
      // Rollback atomically allocated seat if registration insertion failed
      await Event.findByIdAndUpdate(eventId, { $inc: { availableSeats: 1 } });
      if (createErr.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'You are already registered for this event.',
        });
      }
      throw createErr;
    }

    // 8. Automatically initialize Certificate records:
    // Primary student certificate + individual certificate for each team member
    try {
      await Certificate.create({
        student: req.user._id,
        event: eventId,
        registration: registration._id,
        memberRollNumber: trimmedRollNumber,
        memberName: trimmedName,
        status: 'NOT_ISSUED',
        issuedAt: null,
        issuedBy: null,
        receivedAt: null,
      });

      for (const tm of validTeamMembers) {
        await Certificate.create({
          student: null,
          event: eventId,
          registration: registration._id,
          memberRollNumber: tm.rollNumber,
          memberName: tm.name,
          status: 'NOT_ISSUED',
          issuedAt: null,
          issuedBy: null,
          receivedAt: null,
        });
      }
    } catch (certErr) {
      console.warn('[Certificate] Warning initializing certificate:', certErr.message);
    }

    // 11. Create AuditLog: STUDENT_REGISTERED
    try {
      await AuditLog.create({
        actor: req.user._id,
        action: 'STUDENT_REGISTERED',
        entityId: registration._id,
        entityType: 'Registration',
        eventId: updatedEvent._id,
        registrationId: registration._id,
        details: {
          fullName: registration.fullName,
          rollNumber: registration.rollNumber,
          department: registration.department,
          year: registration.year,
          teamMembersCount: validTeamMembers.length,
          registrationCode: registration.registrationCode,
          passCode: registration.registrationCode,
        },
      });
    } catch (auditErr) {
      console.warn('[AuditLog] Warning creating audit log:', auditErr.message);
    }

    // 12. Emit Real-time Socket.IO broadcasts
    emitSocketEvent('registration_created', {
      registrationId: registration._id,
      eventId: updatedEvent._id,
      studentId: req.user._id,
      department: registration.department,
      fullName: registration.fullName,
    });

    emitSocketEvent('event_seats_updated', {
      eventId: updatedEvent._id,
      availableSeats: updatedEvent.availableSeats,
      capacity: updatedEvent.capacity,
    });

    // 13. Generate persistent notifications
    try {
      const notificationService = require('../services/notificationService');

      // Student notification: REGISTRATION_SUCCESSFUL
      await notificationService.createNotification({
        recipient: req.user._id,
        type: 'REGISTRATION_SUCCESSFUL',
        title: 'Registration Successful',
        message: `You successfully registered for ${updatedEvent.title}. Your Digital Event Pass is ready.`,
        event: updatedEvent._id,
        registration: registration._id,
        dedupeKey: `REG_SUCCESS:${registration._id}`,
      });

      // Check seats nearly full milestone
      const remainingSeats = updatedEvent.availableSeats;
      const capacity = updatedEvent.capacity || 100;
      if (remainingSeats <= Math.max(5, Math.floor(capacity * 0.10))) {
        await notificationService.notifySeatsNearlyFull({ event: updatedEvent, remainingSeats });
      }

      // Admin notification: STUDENT_REGISTERED
      if (updatedEvent.createdBy) {
        await notificationService.createNotification({
          recipient: updatedEvent.createdBy,
          type: 'STUDENT_REGISTERED',
          title: `New Registration: ${updatedEvent.title}`,
          message: `${registration.fullName} (${registration.department}) registered for "${updatedEvent.title}".`,
          event: updatedEvent._id,
          registration: registration._id,
          dedupeKey: `STUDENT_REG_ADMIN:${registration._id}`,
        });
      }
    } catch (notifErr) {
      console.warn('[Notification] Warning sending notifications:', notifErr.message);
    }

    // Return complete registration data
    const populated = await Registration.findById(registration._id)
      .populate('event', 'title date time venue category mode status gradient maxTeamSize');

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Your seat is confirmed.',
      data: {
        ...populated.toObject(),
        digitalPass: null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/registrations/:id
 * Protected (STUDENT only):
 * Cancels the student's own registration and safely restores exactly 1 seat.
 */
const cancelRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found.',
      });
    }

    // 1. Find registration belonging specifically to the authenticated student
    const registration = await Registration.findOne({
      _id: id,
      student: req.user._id,
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found or you are not authorized to cancel it.',
      });
    }

    if (registration.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Registration is already cancelled.',
      });
    }

    // 2. Mark registration as CANCELLED
    registration.status = 'CANCELLED';
    registration.cancelledAt = new Date();
    await registration.save();

    // 3. Invalidate active digital pass
    await Ticket.updateMany(
      { registration: registration._id, status: 'ACTIVE' },
      { $set: { status: 'CANCELLED' } }
    );

    // 4. Invalidate attendance & certificate
    await Attendance.updateMany(
      { registration: registration._id },
      { $set: { status: 'ABSENT' } }
    );

    // 5. Restore 1 seat (cannot exceed event capacity)
    const eventDoc = await Event.findById(registration.event);
    let updatedEvent = null;
    if (eventDoc) {
      updatedEvent = await Event.findOneAndUpdate(
        { _id: registration.event, availableSeats: { $lt: eventDoc.capacity } },
        { $inc: { availableSeats: 1 } },
        { new: true }
      );
    }

    emitSocketEvent('registration_cancelled', {
      registrationId: registration._id,
      eventId: registration.event,
      studentId: req.user._id,
    });

    if (updatedEvent) {
      emitSocketEvent('event_seats_updated', {
        eventId: updatedEvent._id,
        availableSeats: updatedEvent.availableSeats,
        capacity: updatedEvent.capacity,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Registration cancelled successfully.',
      data: registration,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/my
 * Protected (STUDENT only):
 * Returns all registrations belonging strictly to the calling student.
 */
const getMyRegistrations = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ student: req.user._id })
      .populate('event', 'title date time venue category mode status gradient registrationDeadline')
      .sort({ createdAt: -1 })
      .lean();

    // Attach digital passes, attendance, and certificate statuses for each registration
    const enriched = await Promise.all(
      registrations.map(async (reg) => {
        const [pass, att, cert] = await Promise.all([
          Ticket.findOne({ registration: reg._id, status: 'ACTIVE' }).select('ticketCode passCode qrPayload status').lean(),
          Attendance.findOne({ registration: reg._id }).select('status markedAt').lean(),
          Certificate.findOne({ registration: reg._id }).select('status issuedAt receivedAt').lean(),
        ]);
        return {
          ...reg,
          digitalPass: pass || null,
          attendanceStatus: att ? att.status : 'NOT_MARKED',
          certificateStatus: cert ? cert.status : 'NOT_ISSUED',
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/admin
 * Protected (EVENTADMIN only):
 * Returns registrations with student, event, and team details for event organizers.
 */
const getAdminRegistrations = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.eventId && mongoose.Types.ObjectId.isValid(req.query.eventId)) {
      filter.event = req.query.eventId;
    }

    // Sort chronologically by event to compute dynamic team numbering
    const registrations = await Registration.find(filter)
      .populate('student', 'name email phone studentId department year')
      .populate('event', 'title date venue capacity availableSeats status mode category registrationDeadline')
      .sort({ createdAt: 1 })
      .lean();

    // Map dynamic team numbering per event: Team 1, Team 2...
    const eventTeamCounters = {};
    const enriched = await Promise.all(
      registrations.map(async (reg) => {
        const evId = String(reg.event?._id || reg.event || '');
        if (!eventTeamCounters[evId]) {
          eventTeamCounters[evId] = 1;
        }

        const isTeam = (reg.teamMembers && reg.teamMembers.length > 0) || (reg.teamSize && reg.teamSize > 1);
        let dynamicTeamNumber = 'Individual';
        if (isTeam) {
          dynamicTeamNumber = `Team ${eventTeamCounters[evId]}`;
          eventTeamCounters[evId]++;
        }

        // Fetch primary attendee attendance and certificate
        const [pass, primaryAtt, primaryCert] = await Promise.all([
          Ticket.findOne({ registration: reg._id, status: 'ACTIVE' })
            .select('ticketCode passCode qrPayload status')
            .lean(),
          Attendance.findOne({
            registration: reg._id,
            $or: [{ memberRollNumber: reg.rollNumber }, { memberRollNumber: '' }, { memberRollNumber: null }],
          }).lean(),
          Certificate.findOne({
            registration: reg._id,
            $or: [{ memberRollNumber: reg.rollNumber }, { memberRollNumber: '' }, { memberRollNumber: null }],
          }).lean(),
        ]);

        // Enrich individual team members with their live attendance and certificate records
        const enrichedMembers = await Promise.all(
          (reg.teamMembers || []).map(async (tm) => {
            const [memberAtt, memberCert] = await Promise.all([
              Attendance.findOne({
                registration: reg._id,
                memberRollNumber: tm.rollNumber,
              }).lean(),
              Certificate.findOne({
                registration: reg._id,
                memberRollNumber: tm.rollNumber,
              }).lean(),
            ]);

            return {
              ...tm,
              attendanceStatus: memberAtt ? memberAtt.status : (tm.attendanceStatus || 'NOT_MARKED'),
              markedAt: memberAtt ? memberAtt.markedAt : (tm.markedAt || null),
              certificateStatus: memberCert ? memberCert.status : (tm.certificateStatus || 'NOT_ISSUED'),
              issuedAt: memberCert ? memberCert.issuedAt : (tm.issuedAt || null),
            };
          })
        );

        const passCode = pass?.passCode || pass?.ticketCode || reg.registrationCode || '';
        const attendeesList = [
          {
            name: reg.fullName || reg.student?.name || 'Primary Registrant',
            rollNumber: reg.rollNumber || reg.student?.studentId || '',
            department: reg.department || reg.student?.department || '',
            year: reg.year || reg.student?.year || '',
            email: reg.student?.email || reg.email || '',
            phone: reg.student?.phone || reg.phone || '',
            passCode,
            isPrimary: true,
            attendanceStatus: primaryAtt ? primaryAtt.status : 'NOT_MARKED',
            certificateStatus: primaryCert ? primaryCert.status : 'NOT_ISSUED',
          },
          ...enrichedMembers.map((m) => ({
            name: m.name,
            rollNumber: m.rollNumber,
            department: m.department || reg.department || '',
            year: m.year || reg.year || '',
            email: '',
            phone: '',
            passCode: '',
            isPrimary: false,
            attendanceStatus: m.attendanceStatus || 'NOT_MARKED',
            certificateStatus: m.certificateStatus || 'NOT_ISSUED',
          })),
        ];

        return {
          ...reg,
          email: reg.student?.email || reg.email || '',
          phone: reg.student?.phone || reg.phone || '',
          ticketCode: passCode,
          teamNumber: dynamicTeamNumber,
          displayTeamNumber: dynamicTeamNumber,
          isTeam,
          digitalPass: pass || null,
          primaryAttendanceStatus: primaryAtt ? primaryAtt.status : 'NOT_MARKED',
          primaryCertificateStatus: primaryCert ? primaryCert.status : 'NOT_ISSUED',
          attendanceStatus: primaryAtt ? primaryAtt.status : 'NOT_MARKED',
          certificateStatus: primaryCert ? primaryCert.status : 'NOT_ISSUED',
          teamMembers: enrichedMembers,
          attendees: attendeesList,
        };
      })
    );

    // Return in reverse chronological order for convenient display
    const finalResult = [...enriched].reverse();

    return res.status(200).json({
      success: true,
      count: finalResult.length,
      data: finalResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/:id
 * Protected (EVENTADMIN or owner STUDENT):
 * Returns complete registration details including event, student, team members,
 * payment proof/status, ticket/pass code, attendance, and certificates.
 */
const getRegistrationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format.',
      });
    }

    const reg = await Registration.findById(id)
      .populate('event')
      .populate('student', 'name email studentId department year phone college')
      .lean();

    if (!reg) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found.',
      });
    }

    // Role-based authorization: EventAdmin can view any, Student can view only own
    const isOwner = reg.student && String(reg.student._id || reg.student) === String(req.user.id);
    const isAdmin = req.user.role === 'EVENTADMIN';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view details for this registration.',
      });
    }

    // Associated Payment (if any)
    let payment = null;
    try {
      const Payment = require('../models/Payment');
      payment = await Payment.findOne({
        $or: [
          { registration: reg._id },
          { event: reg.event?._id, student: reg.student?._id || reg.student },
        ],
      }).lean();
    } catch (e) {
      console.warn('Could not load payment for registration details:', e.message);
    }

    // Associated Ticket (if any)
    let ticket = null;
    try {
      ticket = await Ticket.findOne({ registration: reg._id }).lean();
    } catch (e) {
      console.warn('Could not load ticket for registration details:', e.message);
    }

    // Associated Attendance and Certificates
    let attendanceRecords = [];
    try {
      attendanceRecords = await Attendance.find({ registration: reg._id }).lean();
    } catch (e) {}

    let certificateRecords = [];
    try {
      certificateRecords = await Certificate.find({ registration: reg._id }).lean();
    } catch (e) {}

    const passCode = ticket?.ticketCode || reg.ticketCode || reg.registrationCode || '';

    // Build comprehensive response
    const registrationDetails = {
      ...reg,
      email: reg.student?.email || reg.email || '',
      phone: reg.student?.phone || reg.phone || '',
      college: reg.student?.college || reg.college || 'PBR Visvodaya Institute of Technology & Science',
      ticketCode: passCode,
      passCode,
      ticket: ticket || null,
      payment: payment || null,
      attendanceRecords,
      certificateRecords,
    };

    return res.status(200).json({
      success: true,
      data: registrationDetails,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRegistration,
  cancelRegistration,
  getMyRegistrations,
  getAdminRegistrations,
  getRegistrationById,
};
