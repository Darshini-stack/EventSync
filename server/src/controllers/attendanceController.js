const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Ticket = require('../models/Ticket');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
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

/**
 * GET /api/attendance/admin
 * Protected (EVENTADMIN only):
 * Retrieves smart attendance roster for an event.
 * Shows all registered students with attendance status: Not Marked, Present, Absent.
 */
const getAdminAttendance = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'EVENTADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. EventAdmin role required.',
      });
    }

    const { eventId } = req.query;
    const filter = { status: 'REGISTERED' };
    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      filter.event = eventId;
    }

    const registrations = await Registration.find(filter)
      .populate('student', 'name email studentId department year phone')
      .populate('event', 'title venue date time')
      .sort({ createdAt: -1 })
      .lean();

    // Map each registration with its attendance record (including individual team members)
    const roster = [];
    for (const reg of registrations) {
      // 1. Primary attendee
      let primaryAtt = await Attendance.findOne({
        registration: reg._id,
        $or: [
          { memberRollNumber: reg.rollNumber },
          { memberRollNumber: '' },
          { memberRollNumber: null },
        ],
      })
        .populate('markedBy', 'name email')
        .lean();

      if (!primaryAtt) {
        primaryAtt = await Attendance.create({
          student: reg.student?._id || reg.student,
          event: reg.event?._id || reg.event,
          registration: reg._id,
          memberRollNumber: reg.rollNumber || '',
          memberName: reg.fullName || reg.student?.name || 'Student',
          status: 'NOT_MARKED',
          markedBy: null,
          markedAt: null,
        });
        primaryAtt = primaryAtt.toObject();
      }

      // Certificate status for primary attendee
      const primaryCert = await Certificate.findOne({
        registration: reg._id,
        $or: [
          { memberRollNumber: reg.rollNumber },
          { memberRollNumber: '' },
          { memberRollNumber: null },
        ],
      }).lean();

      const isTeam = (reg.teamMembers && reg.teamMembers.length > 0) || (reg.teamSize > 1);

      roster.push({
        registrationId: reg._id,
        registrationCode: reg.registrationCode || '',
        studentId: reg.student?._id,
        studentName: reg.fullName || reg.student?.name || 'Student',
        rollNumber: reg.rollNumber || reg.student?.studentId || 'N/A',
        department: reg.department || reg.student?.department || 'Other',
        year: reg.year || reg.student?.year || '1st Year',
        email: reg.student?.email || reg.email || '',
        phone: reg.phone || reg.student?.phone || '',
        eventId: reg.event?._id || reg.event,
        eventTitle: reg.event?.title || 'Event',
        registrationStatus: reg.status || 'REGISTERED',
        attendanceStatus: primaryAtt.status || 'NOT_MARKED',
        certificateStatus: primaryCert?.status || reg.certificateStatus || 'NOT_ISSUED',
        markedAt: primaryAtt.markedAt || null,
        markedBy: primaryAtt.markedBy ? (primaryAtt.markedBy.name || primaryAtt.markedBy) : null,
        attendanceId: primaryAtt._id,
        isTeamMember: false,
        isTeam,
        teamName: reg.teamName || '',
        role: isTeam ? 'Team Leader' : 'Individual Participant',
      });

      // 2. Additional team members
      if (Array.isArray(reg.teamMembers)) {
        for (const tm of reg.teamMembers) {
          let memberAtt = await Attendance.findOne({
            registration: reg._id,
            memberRollNumber: tm.rollNumber,
          })
            .populate('markedBy', 'name email')
            .lean();

          if (!memberAtt) {
            memberAtt = await Attendance.create({
              student: null,
              event: reg.event?._id || reg.event,
              registration: reg._id,
              memberRollNumber: tm.rollNumber,
              memberName: tm.name,
              status: tm.attendanceStatus || 'NOT_MARKED',
              markedBy: null,
              markedAt: null,
            });
            memberAtt = memberAtt.toObject();
          }

          const memberCert = await Certificate.findOne({
            registration: reg._id,
            memberRollNumber: tm.rollNumber,
          }).lean();

          roster.push({
            registrationId: reg._id,
            registrationCode: reg.registrationCode || '',
            studentId: null,
            studentName: tm.name,
            rollNumber: tm.rollNumber,
            department: tm.department || reg.department || 'Other',
            year: tm.year || reg.year || '1st Year',
            email: tm.email || '',
            phone: tm.phone || '',
            eventId: reg.event?._id || reg.event,
            eventTitle: reg.event?.title || 'Event',
            registrationStatus: reg.status || 'REGISTERED',
            attendanceStatus: memberAtt.status || 'NOT_MARKED',
            certificateStatus: memberCert?.status || tm.certificateStatus || 'NOT_ISSUED',
            markedAt: memberAtt.markedAt || null,
            markedBy: memberAtt.markedBy ? (memberAtt.markedBy.name || memberAtt.markedBy) : null,
            attendanceId: memberAtt._id,
            isTeamMember: true,
            isTeam: true,
            teamName: reg.teamName || '',
            role: 'Team Member',
            primaryStudentName: reg.fullName || reg.student?.name || 'Primary Registrant',
          });
        }
      }
    }

    // Compute dynamic counts from roster
    const totalRegistered = roster.length;
    const presentCount = roster.filter((r) => r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'CHECKED_IN').length;
    const absentCount = roster.filter((r) => r.attendanceStatus === 'ABSENT').length;
    const notMarkedCount = roster.filter((r) => r.attendanceStatus === 'NOT_MARKED').length;
    const attendanceRate = totalRegistered > 0 ? Math.round((presentCount / totalRegistered) * 100) : 0;

    return res.status(200).json({
      success: true,
      count: roster.length,
      counts: {
        total: totalRegistered,
        totalRegistered,
        totalRegistrations: totalRegistered,
        present: presentCount,
        presentCount,
        checkedInCount: presentCount,
        absent: absentCount,
        absentCount,
        notMarked: notMarkedCount,
        notMarkedCount,
        notCheckedInCount: totalRegistered - presentCount,
        attendanceRate,
      },
      metrics: {
        totalRegistrations: totalRegistered,
        checkedInCount: presentCount,
        notCheckedInCount: totalRegistered - presentCount,
        attendanceRate,
      },
      stats: {
        total: totalRegistered,
        present: presentCount,
        absent: absentCount,
        notMarked: notMarkedCount,
        rate: attendanceRate,
      },
      data: roster,
    });
  } catch (error) {
    console.error('[AttendanceController] Error in getAdminAttendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance roster.',
      error: error.message,
    });
  }
};

/**
 * POST /api/attendance/mark
 * Protected (EVENTADMIN only):
 * Admin marks a student's or team member's attendance as Present, Absent, or Not Marked.
 * Immediately emits Socket.IO attendance:updated and persists in MongoDB.
 */
const markAttendance = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'EVENTADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. EventAdmin role required.',
      });
    }

    const { registrationId, status, memberRollNumber } = req.body;

    if (!registrationId || !mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid registrationId is required.',
      });
    }

    const targetStatus = String(status || '').toUpperCase();
    if (!['PRESENT', 'ABSENT', 'NOT_MARKED'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be PRESENT, ABSENT, or NOT_MARKED.',
      });
    }

    const registration = await Registration.findById(registrationId)
      .populate('student', 'name email studentId')
      .populate('event', 'title venue date time');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration record not found.',
      });
    }

    const markedAt = targetStatus === 'NOT_MARKED' ? null : new Date();
    const markedBy = targetStatus === 'NOT_MARKED' ? null : req.user._id;

    const isSpecificMember = memberRollNumber && memberRollNumber !== registration.rollNumber;
    let attendeeName = registration.fullName || registration.student?.name || 'Student';
    let attendeeRoll = registration.rollNumber || '';

    let attendance;
    let previousStatus = 'NOT_MARKED';

    if (isSpecificMember) {
      attendance = await Attendance.findOne({
        registration: registrationId,
        memberRollNumber,
      });
      previousStatus = attendance ? attendance.status : 'NOT_MARKED';

      // Update teamMembers array in Registration doc
      const memberIndex = (registration.teamMembers || []).findIndex(
        (m) => m.rollNumber.toUpperCase() === String(memberRollNumber).toUpperCase()
      );
      if (memberIndex !== -1) {
        attendeeName = registration.teamMembers[memberIndex].name;
        attendeeRoll = registration.teamMembers[memberIndex].rollNumber;
        registration.teamMembers[memberIndex].attendanceStatus = targetStatus;
        registration.teamMembers[memberIndex].markedAt = markedAt;
        registration.teamMembers[memberIndex].markedBy = markedBy;
        await registration.save();
      }

      if (!attendance) {
        attendance = await Attendance.create({
          student: null,
          event: registration.event._id,
          registration: registration._id,
          memberRollNumber,
          memberName: attendeeName,
          status: targetStatus,
          markedAt,
          markedBy,
        });
      } else {
        attendance.status = targetStatus;
        attendance.markedAt = markedAt;
        attendance.markedBy = markedBy;
        attendance.memberName = attendeeName;
        await attendance.save();
      }
    } else {
      attendance = await Attendance.findOne({
        registration: registrationId,
        $or: [
          { memberRollNumber: registration.rollNumber },
          { memberRollNumber: '' },
          { memberRollNumber: null },
        ],
      });
      previousStatus = attendance ? attendance.status : 'NOT_MARKED';

      if (!attendance) {
        attendance = await Attendance.create({
          student: registration.student?._id || registration.student,
          event: registration.event._id,
          registration: registration._id,
          memberRollNumber: registration.rollNumber || '',
          memberName: attendeeName,
          status: targetStatus,
          markedAt,
          markedBy,
        });
      } else {
        attendance.status = targetStatus;
        attendance.markedAt = markedAt;
        attendance.markedBy = markedBy;
        if (!attendance.memberRollNumber && registration.rollNumber) {
          attendance.memberRollNumber = registration.rollNumber;
        }
        await attendance.save();
      }
    }

    // 1. Audit Log: ATTENDANCE_MARKED or ATTENDANCE_CHANGED
    const auditAction = previousStatus === 'NOT_MARKED' ? 'ATTENDANCE_MARKED' : 'ATTENDANCE_CHANGED';
    try {
      await AuditLog.create({
        actor: req.user._id,
        action: auditAction,
        entityId: attendance._id,
        entityType: 'Attendance',
        eventId: registration.event._id,
        registrationId: registration._id,
        details: {
          previousStatus,
          newStatus: targetStatus,
          studentName: attendeeName,
          rollNumber: attendeeRoll,
          adminName: req.user.name,
          timestamp: markedAt,
        },
      });
    } catch (auditErr) {
      console.warn('[AuditLog] Warning recording attendance audit:', auditErr.message);
    }

    // 2. Real-time Socket.IO update
    const updatePayload = {
      eventId: registration.event._id,
      registrationId: registration._id,
      studentId: registration.student?._id,
      memberRollNumber: isSpecificMember ? memberRollNumber : (registration.rollNumber || ''),
      attendanceStatus: targetStatus,
      markedAt: markedAt ? markedAt.toISOString() : null,
      markedBy: req.user.name || 'Event Admin',
    };

    emitSocketEvent('attendance:updated', updatePayload);
    emitSocketEvent('attendance_updated', updatePayload); // legacy alias

    // 3. Persistent student notification (if primary student status changed)
    if (!isSpecificMember && previousStatus !== targetStatus && (targetStatus === 'PRESENT' || targetStatus === 'ABSENT')) {
      try {
        const notificationService = require('../services/notificationService');
        const notifType = targetStatus === 'PRESENT' ? 'ATTENDANCE_MARKED_PRESENT' : 'ATTENDANCE_MARKED_ABSENT';
        const title = 'Attendance Updated';
        const message = targetStatus === 'PRESENT'
          ? `Your attendance for "${registration.event.title}" has been marked Present.`
          : `Your attendance for "${registration.event.title}" has been marked Absent.`;

        await notificationService.createNotification({
          recipient: registration.student._id,
          type: notifType,
          title,
          message,
          event: registration.event._id,
          registration: registration._id,
          dedupeKey: `ATT_NOTIF:${registration._id}:${targetStatus}:${Date.now()}`,
        });
      } catch (notifErr) {
        console.warn('[Notification] Warning sending attendance notification:', notifErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Attendance marked as ${targetStatus} for ${attendeeName}.`,
      data: {
        ...attendance.toObject(),
        attendeeName,
        rollNumber: attendeeRoll,
        student: registration.student,
        event: registration.event,
      },
    });
  } catch (error) {
    console.error('[AttendanceController] Error in markAttendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update attendance status.',
      error: error.message,
    });
  }
};

/**
 * POST /api/attendance/mark-all
 * Protected (EVENTADMIN only):
 * Bulk marks all registered students for an event as Present or Absent.
 */
const markAllAttendance = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'EVENTADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. EventAdmin role required.',
      });
    }

    const { eventId, status } = req.body;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid eventId is required.',
      });
    }

    const targetStatus = String(status || '').toUpperCase();
    if (!['PRESENT', 'ABSENT'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Bulk status must be either PRESENT or ABSENT.',
      });
    }

    const registrations = await Registration.find({ event: eventId, status: 'REGISTERED' });
    const markedAt = new Date();

    for (const reg of registrations) {
      const existing = await Attendance.findOne({ registration: reg._id }).lean();
      const prevStatus = existing ? existing.status : 'NOT_MARKED';

      await Attendance.findOneAndUpdate(
        { registration: reg._id },
        {
          $set: {
            student: reg.student,
            event: reg.event,
            status: targetStatus,
            markedAt,
            markedBy: req.user._id,
          },
        },
        { upsert: true, new: true }
      );

      // Only notify student if attendance status actually changed
      if (prevStatus !== targetStatus && (targetStatus === 'PRESENT' || targetStatus === 'ABSENT')) {
        try {
          const notificationService = require('../services/notificationService');
          await notificationService.createNotification({
            recipient: reg.student,
            type: targetStatus === 'PRESENT' ? 'ATTENDANCE_MARKED_PRESENT' : 'ATTENDANCE_MARKED_ABSENT',
            title: 'Attendance Updated',
            message: `Your attendance for "${event.title || 'Event'}" has been marked ${targetStatus === 'PRESENT' ? 'Present' : 'Absent'}.`,
            event: reg.event,
            registration: reg._id,
            dedupeKey: `ATT_BULK:${reg._id}:${targetStatus}:${Date.now()}`,
          });
        } catch (e) {}
      }

      // Emit individual updates for real-time sync to each student
      emitSocketEvent('attendance:updated', {
        eventId: reg.event,
        registrationId: reg._id,
        studentId: reg.student,
        attendanceStatus: targetStatus,
        markedAt: markedAt.toISOString(),
        markedBy: req.user.name || 'Event Admin',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully marked all ${registrations.length} students as ${targetStatus}.`,
      updatedCount: registrations.length,
    });
  } catch (error) {
    console.error('[AttendanceController] Error in markAllAttendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk update attendance.',
      error: error.message,
    });
  }
};

/**
 * POST /api/attendance/scan-pass
 * Protected (EVENTADMIN only):
 * Scans a student's Digital Event Pass QR code payload (EVENTSYNC:PASS:<passCode>).
 * Previews student details and current attendance status WITHOUT auto-marking attendance.
 */
const scanDigitalPass = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'EVENTADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. EventAdmin role required.',
      });
    }

    const { qrPayload } = req.body;

    if (!qrPayload || typeof qrPayload !== 'string' || qrPayload.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'QR payload is required and cannot be empty.',
      });
    }

    const cleanPayload = qrPayload.trim();

    // Reject Event Registration URLs immediately - Registration QR is NOT a gate ticket pass
    if (
      cleanPayload.includes('/events/') ||
      cleanPayload.includes('/register') ||
      cleanPayload.startsWith('http://') ||
      cleanPayload.startsWith('https://')
    ) {
      return res.status(400).json({
        success: false,
        invalidTicket: true,
        isRegistrationQr: true,
        message: 'Invalid Gate Ticket. Scanned payload is an Event Registration URL, not an attendee entry pass.',
      });
    }

    // Match EVENTSYNC:PASS:<code> or EVENTSYNC:TICKET:<code> or raw code
    const passMatch = cleanPayload.match(/^EVENTSYNC:PASS:([A-Za-z0-9\-]+)$/i);
    const ticketMatch = cleanPayload.match(/^EVENTSYNC:TICKET:([A-Za-z0-9\-]+)$/i);

    if (passMatch && passMatch[1]) {
      passCode = passMatch[1].trim().toUpperCase();
    } else if (ticketMatch && ticketMatch[1]) {
      passCode = ticketMatch[1].trim().toUpperCase();
    } else {
      passCode = cleanPayload.toUpperCase();
    }

    // Resolve Pass/Ticket
    const ticket = await Ticket.findOne({
      $or: [{ passCode }, { ticketCode: passCode }],
      status: 'ACTIVE',
    })
      .populate('student', 'name email studentId department year')
      .populate('event', 'title venue date time capacity status')
      .populate('registration');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `No active digital event pass found matching '${passCode}'.`,
      });
    }

    const registration = ticket.registration || (await Registration.findById(ticket.registration));
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Associated registration not found.',
      });
    }

    // Fetch current attendance status
    const attendance = await Attendance.findOne({ registration: registration._id })
      .populate('markedBy', 'name email');

    const currentStatus = attendance ? attendance.status : 'NOT_MARKED';

    return res.status(200).json({
      success: true,
      message: 'Attendee identified successfully. Please select Present or Absent to mark attendance.',
      data: {
        passCode: ticket.passCode || ticket.ticketCode,
        registrationId: registration._id,
        registrationCode: registration.registrationCode || '',
        studentName: registration.fullName || ticket.student?.name || 'Student',
        rollNumber: registration.rollNumber || ticket.student?.studentId || 'N/A',
        department: registration.department || ticket.student?.department || 'Other',
        year: registration.year || ticket.student?.year || '1st Year',
        eventTitle: ticket.event?.title || 'Event',
        student: {
          _id: ticket.student?._id,
          name: registration.fullName || ticket.student?.name || 'Student',
          rollNumber: registration.rollNumber || ticket.student?.studentId || 'N/A',
          department: registration.department || ticket.student?.department || 'Other',
          year: registration.year || ticket.student?.year || '1st Year',
          email: ticket.student?.email || '',
        },
        event: {
          _id: ticket.event?._id,
          title: ticket.event?.title || 'Event',
          venue: ticket.event?.venue || '',
          date: ticket.event?.date,
          time: ticket.event?.time,
        },
        currentStatus,
        attendanceStatus: currentStatus,
        markedAt: attendance?.markedAt || null,
        markedBy: attendance?.markedBy?.name || null,
      },
    });
  } catch (error) {
    console.error('[AttendanceController] Error in scanDigitalPass:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to scan and verify digital pass.',
      error: error.message,
    });
  }
};

/**
 * POST /api/attendance/check-in
 * POST /api/attendance/scan-ticket
 * Protected (EVENTADMIN only):
 * Fast, reliable, automatic ticket scanner check-in.
 * Resolves exact attendee (primary registrant OR specific team member),
 * validates event matching, marks attendance as PRESENT in MongoDB,
 * and broadcasts updates via Socket.IO.
 */
const checkInTicket = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'EVENTADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. EventAdmin role required.',
      });
    }

    const rawInput = req.body.passCode || req.body.ticketCode || req.body.qrPayload;
    const { eventId, memberRollNumber } = req.body;

    if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
      return res.status(400).json({
        success: false,
        invalidTicket: true,
        message: 'Ticket/Pass Code could not be verified.',
      });
    }

    const cleanPayload = rawInput.trim();

    // Reject Event Registration URLs immediately - Registration QR is NOT a gate ticket pass
    if (
      cleanPayload.includes('/events/') ||
      cleanPayload.includes('/register') ||
      cleanPayload.startsWith('http://') ||
      cleanPayload.startsWith('https://')
    ) {
      return res.status(400).json({
        success: false,
        invalidTicket: true,
        isRegistrationQr: true,
        message: 'Invalid Gate Ticket. Scanned payload is an Event Registration URL, not an attendee entry pass.',
      });
    }

    let code = '';
    let extractedMemberRoll = null;

    // Support EVENTSYNC:PASS:<code>:<roll> or EVENTSYNC:TICKET:<code>:<roll>
    const passWithMember = cleanPayload.match(/^EVENTSYNC:(?:PASS|TICKET):([A-Za-z0-9\-]+):([A-Za-z0-9\-_]+)$/i);
    const standardPass = cleanPayload.match(/^EVENTSYNC:(?:PASS|TICKET):([A-Za-z0-9\-]+)$/i);
    const colonMember = cleanPayload.match(/^([A-Za-z0-9\-]+):([A-Za-z0-9\-_]+)$/);

    if (passWithMember) {
      code = passWithMember[1].trim().toUpperCase();
      extractedMemberRoll = passWithMember[2].trim();
    } else if (standardPass) {
      code = standardPass[1].trim().toUpperCase();
    } else if (colonMember) {
      code = colonMember[1].trim().toUpperCase();
      extractedMemberRoll = colonMember[2].trim();
    } else {
      code = cleanPayload.toUpperCase();
    }

    let ticket = await Ticket.findOne({
      $or: [{ passCode: code }, { ticketCode: code }],
    }).populate('student', 'name email studentId department year');

    // If not found directly, check if input has a hyphenated roll number suffix (e.g. ES-PASS-XXXXXXXX-22CS002)
    if (!ticket && code.includes('-')) {
      const lastDashIdx = code.lastIndexOf('-');
      if (lastDashIdx > 0) {
        const candidateCode = code.substring(0, lastDashIdx);
        const candidateRoll = code.substring(lastDashIdx + 1);
        const candidateTicket = await Ticket.findOne({
          $or: [{ passCode: candidateCode }, { ticketCode: candidateCode }],
        }).populate('student', 'name email studentId department year');

        if (candidateTicket) {
          ticket = candidateTicket;
          code = candidateCode;
          if (!extractedMemberRoll) {
            extractedMemberRoll = candidateRoll;
          }
        }
      }
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        invalidTicket: true,
        message: 'Ticket/Pass Code could not be verified.',
      });
    }

    if (ticket.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: `Ticket is not active (status: ${ticket.status}).`,
      });
    }

    const registration = await Registration.findById(ticket.registration);
    if (!registration || registration.status !== 'REGISTERED') {
      return res.status(400).json({
        success: false,
        message: 'Registration is not active.',
      });
    }

    const event = await Event.findById(ticket.event);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        message: `Cannot check in to event with status: ${event.status}.`,
      });
    }

    // Student mismatch guard
    if (
      ticket.student &&
      registration.student &&
      String(ticket.student._id || ticket.student) !== String(registration.student._id || registration.student)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Ticket student mismatch with registration.',
      });
    }

    // Event mismatch guard
    if (String(ticket.event) !== String(registration.event)) {
      return res.status(400).json({
        success: false,
        message: 'Ticket event mismatch with registration.',
      });
    }

    // Event verification: Reject if ticket belongs to another event
    if (eventId && String(ticket.event) !== String(eventId)) {
      return res.status(400).json({
        success: false,
        wrongEvent: true,
        message: 'This ticket belongs to another event.',
      });
    }

    // Paid event verification
    if (event.isPaid) {
      const payment = await Payment.findOne({ registration: registration._id });
      if (!payment) {
        return res.status(400).json({
          success: false,
          message: 'Admission payment required for this paid event. No payment record found.',
        });
      }
      if (payment.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: `Admission payment is not approved. Current payment status is ${payment.status}.`,
        });
      }
    }

    // Resolve attendee: Primary registrant vs. specific team member
    const requestedRoll = (memberRollNumber || extractedMemberRoll || '').trim();
    let targetRoll = '';
    let targetName = '';
    let isTeamMember = false;
    let teamMemberIndex = -1;

    if (requestedRoll) {
      if (Array.isArray(registration.teamMembers)) {
        teamMemberIndex = registration.teamMembers.findIndex(
          (tm) => tm.rollNumber && tm.rollNumber.trim().toUpperCase() === requestedRoll.toUpperCase()
        );
      }

      if (teamMemberIndex !== -1) {
        isTeamMember = true;
        targetRoll = registration.teamMembers[teamMemberIndex].rollNumber;
        targetName = registration.teamMembers[teamMemberIndex].name;
      } else {
        targetRoll = registration.rollNumber || ticket.student?.studentId || '';
        targetName = registration.fullName || ticket.student?.name || 'Student';
      }
    } else {
      targetRoll = registration.rollNumber || ticket.student?.studentId || '';
      targetName = registration.fullName || ticket.student?.name || 'Student';
    }

    // Check duplicate check-in
    let attendanceFilter = { registration: registration._id };
    if (isTeamMember) {
      attendanceFilter.memberRollNumber = targetRoll;
    } else {
      attendanceFilter.$or = [
        { memberRollNumber: targetRoll },
        { memberRollNumber: '' },
        { memberRollNumber: null },
      ];
    }

    let attendance = await Attendance.findOne(attendanceFilter);

    if (attendance && (attendance.status === 'PRESENT' || attendance.status === 'CHECKED_IN')) {
      return res.status(409).json({
        success: false,
        alreadyCheckedIn: true,
        message: 'Attendee has already been checked in for this event.',
        data: {
          ...(attendance.toObject ? attendance.toObject() : attendance),
          studentName: targetName,
          memberName: targetName,
          memberRollNumber: targetRoll,
          rollNumber: targetRoll,
          eventTitle: event.title,
          eventId: event._id,
          attendanceStatus: 'PRESENT',
          isTeamMember,
        },
      });
    }

    const markedAt = new Date();
    if (!attendance) {
      try {
        attendance = await Attendance.create({
          student: isTeamMember ? null : (registration.student || ticket.student?._id),
          event: event._id,
          registration: registration._id,
          ticket: ticket._id,
          memberRollNumber: targetRoll,
          memberName: targetName,
          status: 'CHECKED_IN',
          markedAt,
          markedBy: req.user._id,
          checkedInAt: markedAt,
          checkedInBy: req.user._id,
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          const raceExisting = await Attendance.findOne(attendanceFilter);
          return res.status(409).json({
            success: false,
            alreadyCheckedIn: true,
            message: 'Attendee has already been checked in for this event.',
            data: raceExisting,
          });
        }
        throw createErr;
      }
    } else {
      attendance.status = 'CHECKED_IN';
      attendance.markedAt = markedAt;
      attendance.markedBy = req.user._id;
      attendance.checkedInAt = markedAt;
      attendance.checkedInBy = req.user._id;
      attendance.ticket = ticket._id;
      attendance.memberRollNumber = targetRoll;
      attendance.memberName = targetName;
      await attendance.save();
    }

    // Synchronize Registration and teamMembers PER MEMBER
    if (isTeamMember && teamMemberIndex !== -1) {
      registration.teamMembers[teamMemberIndex].attendanceStatus = 'PRESENT';
      registration.teamMembers[teamMemberIndex].markedAt = markedAt;
      registration.teamMembers[teamMemberIndex].markedBy = req.user._id;
    } else {
      registration.attendanceStatus = 'PRESENT';
    }
    await registration.save();

    const updatePayload = {
      eventId: event._id,
      registrationId: registration._id,
      studentId: registration.student,
      memberRollNumber: targetRoll,
      memberName: targetName,
      attendanceStatus: 'PRESENT',
      markedAt: markedAt.toISOString(),
      markedBy: req.user.name || 'Event Admin',
      isTeamMember,
    };

    emitSocketEvent('attendance:updated', updatePayload);
    emitSocketEvent('attendance_checked_in', {
      attendanceId: attendance._id,
      ticketId: ticket._id,
      ticketCode: ticket.ticketCode || ticket.passCode,
      eventId: event._id,
      registrationId: registration._id,
      studentId: registration.student,
      checkedInAt: markedAt.toISOString(),
      ...updatePayload,
    });

    // Notify attendee (for primary registrant)
    if (!isTeamMember) {
      try {
        const notificationService = require('../services/notificationService');
        await notificationService.createNotification({
          recipient: registration.student,
          type: 'ATTENDANCE_CONFIRMED',
          title: `Admission Verified: ${event.title}`,
          message: `Your check-in for "${event.title}" has been verified by the administrator.`,
          event: event._id,
          registration: registration._id,
          ticket: ticket._id,
          attendance: attendance._id,
          dedupeKey: `ATT_CONFIRM:${ticket._id}`,
        });
      } catch (notifErr) {
        console.warn('[Notification] Warning sending attendance confirmed notification:', notifErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Ticket verified successfully. Attendance marked PRESENT.',
      data: {
        ...attendance.toObject(),
        studentName: targetName,
        memberName: targetName,
        memberRollNumber: targetRoll,
        rollNumber: targetRoll,
        eventTitle: event.title,
        eventId: event._id,
        attendanceStatus: 'PRESENT',
        isTeamMember,
      },
    });
  } catch (error) {
    console.error('[AttendanceController] Error in checkInTicket:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/attendance/my
 * Protected (STUDENT only):
 * Retrieves the authenticated student's attendance records.
 */
const getMyAttendance = async (req, res) => {
  try {
    const attendanceRecords = await Attendance.find({ student: req.user._id })
      .populate('event', 'title venue date time status')
      .populate('registration', 'registrationCode department year fullName rollNumber')
      .populate('markedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: attendanceRecords.length,
      data: attendanceRecords,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAdminAttendance,
  markAttendance,
  markAllAttendance,
  scanDigitalPass,
  checkInTicket,
  getMyAttendance,
};
