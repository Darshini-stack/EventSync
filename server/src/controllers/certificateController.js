const mongoose = require('mongoose');
const Certificate = require('../models/Certificate');
const Registration = require('../models/Registration');
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
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
 * GET /api/certificates/admin
 * Protected (EVENTADMIN only):
 * Retrieves certificate roster and dynamic metrics for an event.
 * Shows all registered students, attendance status, and certificate status.
 */
const getAdminCertificates = async (req, res) => {
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
      .populate('student', 'name email studentId department year')
      .populate('event', 'title venue date')
      .sort({ createdAt: -1 })
      .lean();

    // Map each registration with its attendance and certificate status (including team members)
    const roster = [];
    for (const reg of registrations) {
      // 1. Primary attendee
      let primaryCert = await Certificate.findOne({
        registration: reg._id,
        $or: [
          { memberRollNumber: reg.rollNumber },
          { memberRollNumber: '' },
          { memberRollNumber: null },
        ],
      })
        .populate('issuedBy', 'name')
        .lean();

      if (!primaryCert) {
        primaryCert = await Certificate.create({
          student: reg.student?._id || reg.student,
          event: reg.event?._id || reg.event,
          registration: reg._id,
          memberRollNumber: reg.rollNumber || '',
          memberName: reg.fullName || reg.student?.name || 'Student',
          status: 'NOT_ISSUED',
          issuedAt: null,
          issuedBy: null,
          receivedAt: null,
        });
        primaryCert = primaryCert.toObject();
      }

      const primaryAtt = await Attendance.findOne({
        registration: reg._id,
        $or: [
          { memberRollNumber: reg.rollNumber },
          { memberRollNumber: '' },
          { memberRollNumber: null },
        ],
      }).lean();
      const attendanceStatus = primaryAtt ? primaryAtt.status : 'NOT_MARKED';

      roster.push({
        certificateId: primaryCert._id,
        registrationId: reg._id,
        registrationCode: reg.registrationCode || '',
        studentId: reg.student?._id,
        studentName: reg.fullName || reg.student?.name || 'Student',
        rollNumber: reg.rollNumber || reg.student?.studentId || 'N/A',
        department: reg.department || reg.student?.department || 'Other',
        year: reg.year || reg.student?.year || '1st Year',
        email: reg.student?.email || reg.email || '',
        eventId: reg.event?._id || reg.event,
        eventTitle: reg.event?.title || 'Event',
        attendanceStatus,
        certificateStatus: primaryCert.status || 'NOT_ISSUED',
        issuedAt: primaryCert.issuedAt || null,
        issuedBy: primaryCert.issuedBy?.name || null,
        receivedAt: primaryCert.receivedAt || null,
        isTeamMember: false,
        isTeam: (reg.teamMembers && reg.teamMembers.length > 0) || (reg.teamSize > 1),
        teamName: reg.teamName || '',
      });

      // 2. Individual team members
      if (Array.isArray(reg.teamMembers)) {
        for (const tm of reg.teamMembers) {
          let memberCert = await Certificate.findOne({
            registration: reg._id,
            memberRollNumber: tm.rollNumber,
          })
            .populate('issuedBy', 'name')
            .lean();

          if (!memberCert) {
            memberCert = await Certificate.create({
              student: null,
              event: reg.event?._id || reg.event,
              registration: reg._id,
              memberRollNumber: tm.rollNumber,
              memberName: tm.name,
              status: tm.certificateStatus || 'NOT_ISSUED',
              issuedAt: tm.issuedAt || null,
              issuedBy: tm.issuedBy || null,
              receivedAt: null,
            });
            memberCert = memberCert.toObject();
          }

          const memberAtt = await Attendance.findOne({
            registration: reg._id,
            memberRollNumber: tm.rollNumber,
          }).lean();

          roster.push({
            certificateId: memberCert._id,
            registrationId: reg._id,
            registrationCode: reg.registrationCode || '',
            studentId: null,
            studentName: tm.name,
            rollNumber: tm.rollNumber,
            department: tm.department || reg.department || 'Other',
            year: tm.year || reg.year || '1st Year',
            email: '',
            eventId: reg.event?._id || reg.event,
            eventTitle: reg.event?.title || 'Event',
            attendanceStatus: memberAtt ? memberAtt.status : (tm.attendanceStatus || 'NOT_MARKED'),
            certificateStatus: memberCert.status || 'NOT_ISSUED',
            issuedAt: memberCert.issuedAt || null,
            issuedBy: memberCert.issuedBy?.name || null,
            receivedAt: memberCert.receivedAt || null,
            isTeamMember: true,
            isTeam: true,
            primaryStudentName: reg.fullName || reg.student?.name || 'Primary Registrant',
            teamName: reg.teamName || '',
          });
        }
      }
    }

    // Compute dynamic calculated summary metrics
    const totalRegistered = roster.length;
    const present = roster.filter((r) => r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'CHECKED_IN').length;
    const absent = roster.filter((r) => r.attendanceStatus === 'ABSENT').length;
    const certificatesIssued = roster.filter((r) => r.certificateStatus === 'ISSUED' || r.certificateStatus === 'RECEIVED').length;
    const certificatesNotIssued = roster.filter((r) => r.certificateStatus === 'NOT_ISSUED').length;
    const certificatesReceived = roster.filter((r) => r.certificateStatus === 'RECEIVED').length;
    const certificatesNotReceived = roster.filter((r) => r.certificateStatus !== 'RECEIVED').length;

    // List of students who have not received certificates
    const notReceivedList = roster
      .filter((r) => r.certificateStatus !== 'RECEIVED')
      .map((r, idx) => ({
        index: idx + 1,
        studentName: r.studentName,
        rollNumber: r.rollNumber,
        department: r.department,
        certificateStatus: r.certificateStatus,
        registrationId: r.registrationId,
      }));

    return res.status(200).json({
      success: true,
      count: roster.length,
      counts: {
        totalRegistered,
        present,
        absent,
        certificatesIssued,
        certificatesNotIssued,
        certificatesReceived,
        certificatesNotReceived,
      },
      notReceivedList,
      data: roster,
    });
  } catch (error) {
    console.error('[CertificateController] Error in getAdminCertificates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve certificate tracking roster.',
      error: error.message,
    });
  }
};

/**
 * PATCH /api/certificates/status
 * Protected (EVENTADMIN only):
 * Admin marks a certificate as ISSUED (or NOT_ISSUED).
 * Emits real-time Socket.IO certificate:updated and sends student notification.
 */
const updateCertificateStatus = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'EVENTADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. EventAdmin role required to issue certificates.',
      });
    }

    const { registrationId, certificateId, status, memberRollNumber } = req.body;

    const targetStatus = String(status || '').toUpperCase();
    if (!['NOT_ISSUED', 'ISSUED', 'RECEIVED'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be NOT_ISSUED, ISSUED, or RECEIVED.',
      });
    }

    let cert;
    let registration;

    if (certificateId && mongoose.Types.ObjectId.isValid(certificateId)) {
      cert = await Certificate.findById(certificateId);
      if (cert) {
        registration = await Registration.findById(cert.registration)
          .populate('student', 'name email studentId')
          .populate('event', 'title venue');
      }
    } else if (registrationId && mongoose.Types.ObjectId.isValid(registrationId)) {
      registration = await Registration.findById(registrationId)
        .populate('student', 'name email studentId')
        .populate('event', 'title venue');

      if (registration) {
        const isSpecificMember = memberRollNumber && memberRollNumber !== registration.rollNumber;
        if (isSpecificMember) {
          cert = await Certificate.findOne({
            registration: registrationId,
            memberRollNumber,
          });

          if (!cert) {
            const memberObj = (registration.teamMembers || []).find(
              (m) => m.rollNumber.toUpperCase() === String(memberRollNumber).toUpperCase()
            );
            cert = await Certificate.create({
              student: null,
              event: registration.event._id,
              registration: registration._id,
              memberRollNumber,
              memberName: memberObj ? memberObj.name : 'Team Member',
              status: targetStatus,
              issuedAt: targetStatus === 'ISSUED' ? new Date() : null,
              issuedBy: targetStatus === 'ISSUED' ? req.user._id : null,
            });
          }
        } else {
          cert = await Certificate.findOne({
            registration: registrationId,
            $or: [
              { memberRollNumber: registration.rollNumber },
              { memberRollNumber: '' },
              { memberRollNumber: null },
            ],
          });

          if (!cert) {
            cert = await Certificate.create({
              student: registration.student?._id || registration.student,
              event: registration.event._id,
              registration: registration._id,
              memberRollNumber: registration.rollNumber || '',
              memberName: registration.fullName || registration.student?.name || 'Student',
              status: targetStatus,
              issuedAt: targetStatus === 'ISSUED' ? new Date() : null,
              issuedBy: targetStatus === 'ISSUED' ? req.user._id : null,
            });
          }
        }
      }
    }

    if (!cert) {
      return res.status(404).json({
        success: false,
        message: 'Certificate record not found.',
      });
    }

    if (!registration) {
      registration = await Registration.findById(cert.registration)
        .populate('student', 'name email studentId')
        .populate('event', 'title venue');
    }

    const issuedAtDate = targetStatus === 'ISSUED' ? new Date() : null;
    const issuedByAdmin = targetStatus === 'ISSUED' ? req.user._id : null;

    cert.status = targetStatus;
    if (targetStatus === 'ISSUED') {
      cert.issuedAt = issuedAtDate;
      cert.issuedBy = issuedByAdmin;
    } else if (targetStatus === 'NOT_ISSUED') {
      cert.issuedAt = null;
      cert.issuedBy = null;
      cert.receivedAt = null;
    }
    await cert.save();

    // If member roll number is present or matches a team member, update Registration.teamMembers array
    const targetRoll = cert.memberRollNumber || memberRollNumber;
    if (registration && targetRoll && Array.isArray(registration.teamMembers)) {
      const memberIndex = registration.teamMembers.findIndex(
        (m) => m.rollNumber.toUpperCase() === String(targetRoll).toUpperCase()
      );
      if (memberIndex !== -1) {
        registration.teamMembers[memberIndex].certificateStatus = targetStatus;
        registration.teamMembers[memberIndex].issuedAt = issuedAtDate;
        registration.teamMembers[memberIndex].issuedBy = issuedByAdmin;
        await registration.save();
      }
    }

    // 1. Audit Log
    try {
      await AuditLog.create({
        actor: req.user._id,
        action: 'CERTIFICATE_ISSUED',
        entityId: cert._id,
        entityType: 'Certificate',
        eventId: cert.event,
        registrationId: cert.registration,
        details: {
          status: targetStatus,
          studentName: cert.memberName || registration?.student?.name,
          memberRollNumber: cert.memberRollNumber || registration?.rollNumber,
          issuedByAdmin: req.user.name,
          issuedAt: cert.issuedAt,
        },
      });
    } catch (auditErr) {
      console.warn('[AuditLog] Warning recording certificate audit:', auditErr.message);
    }

    // 2. Real-time Socket.IO update (Section 11: certificate:updated)
    const updatePayload = {
      eventId: cert.event,
      registrationId: cert.registration,
      studentId: cert.student,
      memberRollNumber: cert.memberRollNumber,
      memberName: cert.memberName,
      certificateStatus: targetStatus,
      updatedAt: (cert.issuedAt || new Date()).toISOString(),
    };

    emitSocketEvent('certificate:updated', updatePayload);

    // 3. Notification to primary student if applicable
    if (targetStatus === 'ISSUED' && cert.student) {
      try {
        const notificationService = require('../services/notificationService');
        await notificationService.createNotification({
          recipient: cert.student,
          type: 'CERTIFICATE_ISSUED',
          title: 'Certificate Issued',
          message: `Your participation certificate for ${registration?.event?.title || 'Event'} has been issued.`,
          event: cert.event,
          registration: cert.registration,
          dedupeKey: `CERT_ISSUED:${cert._id}`,
        });
      } catch (notifErr) {
        console.warn('[Notification] Warning sending certificate notification:', notifErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Certificate status updated to ${targetStatus}.`,
      data: cert,
    });
  } catch (error) {
    console.error('[CertificateController] Error in updateCertificateStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update certificate status.',
      error: error.message,
    });
  }
};

/**
 * POST /api/certificates/confirm-receipt
 * Protected (STUDENT only):
 * Authenticated student confirms receipt of an issued certificate.
 * Status becomes RECEIVED. Real-time Socket.IO update sent to admin dashboard.
 */
const confirmCertificateReceipt = async (req, res) => {
  try {
    const { registrationId, certificateId } = req.body;

    let cert;
    if (certificateId && mongoose.Types.ObjectId.isValid(certificateId)) {
      cert = await Certificate.findById(certificateId);
    } else if (registrationId && mongoose.Types.ObjectId.isValid(registrationId)) {
      cert = await Certificate.findOne({
        registration: registrationId,
        $or: [{ student: req.user._id }, { memberRollNumber: req.user.studentId }],
      });
      if (!cert) {
        cert = await Certificate.findOne({ registration: registrationId });
      }
    }

    if (!cert) {
      return res.status(404).json({
        success: false,
        message: 'Certificate record not found.',
      });
    }

    // Security & Authorization: Verify ownership
    if (!cert.student || cert.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to confirm receipt of another student's certificate.",
      });
    }

    if (cert.status !== 'ISSUED') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm receipt. Certificate status is ${cert.status} (must be ISSUED).`,
      });
    }

    const receivedAt = new Date();
    cert.status = 'RECEIVED';
    cert.receivedAt = receivedAt;
    await cert.save();

    const registration = await Registration.findById(cert.registration)
      .populate('event', 'title createdBy');

    // Update Registration.teamMembers if member roll number is present or matches primary
    if (registration && Array.isArray(registration.teamMembers)) {
      const targetRoll = cert.memberRollNumber || registration.rollNumber;
      const memberIndex = registration.teamMembers.findIndex(
        (m) => m.rollNumber && m.rollNumber.toUpperCase() === String(targetRoll).toUpperCase()
      );
      if (memberIndex !== -1) {
        registration.teamMembers[memberIndex].certificateStatus = 'RECEIVED';
        registration.teamMembers[memberIndex].receivedAt = receivedAt;
        await registration.save();
      }
    }

    // 1. Audit Log: CERTIFICATE_RECEIPT_CONFIRMED
    try {
      await AuditLog.create({
        actor: req.user._id,
        action: 'CERTIFICATE_RECEIPT_CONFIRMED',
        entityId: cert._id,
        entityType: 'Certificate',
        eventId: cert.event,
        registrationId: cert.registration,
        details: {
          studentName: req.user.name,
          receivedAt,
          eventTitle: registration?.event?.title,
        },
      });
    } catch (auditErr) {
      console.warn('[AuditLog] Warning recording certificate receipt audit:', auditErr.message);
    }

    // 2. Real-time Socket.IO broadcast: certificate:updated
    const updatePayload = {
      eventId: cert.event,
      registrationId: cert.registration,
      studentId: cert.student,
      certificateStatus: 'RECEIVED',
      updatedAt: receivedAt.toISOString(),
      studentName: req.user.name,
    };

    emitSocketEvent('certificate:updated', updatePayload);

    // 3. Student & Admin notification
    try {
      const notificationService = require('../services/notificationService');
      // Notify student
      await notificationService.createNotification({
        recipient: cert.student,
        type: 'CERTIFICATE_RECEIVED',
        title: 'Certificate Receipt Confirmed',
        message: `Your certificate receipt for "${registration?.event?.title || 'Event'}" has been recorded.`,
        event: cert.event,
        registration: cert.registration,
        dedupeKey: `CERT_RECEIVED:${cert._id}`,
      });

      // Notify admin
      if (registration?.event?.createdBy) {
        await notificationService.createNotification({
          recipient: registration.event.createdBy,
          type: 'CERTIFICATE_RECEIPT_CONFIRMED',
          title: 'Certificate Receipt Confirmed',
          message: `${req.user.name} confirmed receipt of their certificate for "${registration.event.title}".`,
          event: cert.event,
          registration: cert.registration,
          dedupeKey: `CERT_CONFIRM:${cert._id}`,
        });
      }
    } catch (notifErr) {
      console.warn('[Notification] Warning sending certificate receipt notifications:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Certificate receipt successfully confirmed!',
      data: cert,
    });
  } catch (error) {
    console.error('[CertificateController] Error in confirmCertificateReceipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm certificate receipt.',
      error: error.message,
    });
  }
};

/**
 * GET /api/certificates/my
 * Protected (STUDENT only):
 * Retrieves authenticated student's own certificate records.
 */
const getMyCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find({ student: req.user._id })
      .populate('event', 'title venue date time status')
      .populate('registration', 'registrationCode department year fullName rollNumber')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: certificates.length,
      data: certificates,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve your certificates.',
      error: error.message,
    });
  }
};

module.exports = {
  getAdminCertificates,
  updateCertificateStatus,
  confirmCertificateReceipt,
  getMyCertificates,
};
