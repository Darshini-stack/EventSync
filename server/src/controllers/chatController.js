/**
 * chatController.js
 * Controller for POST /api/chat.
 * Provides role-based context:
 * - EVENTADMIN: Injects real MongoDB administrative metrics (total registrations, teams, attendance rates, certificate counts).
 * - STUDENT: Strictly isolates student data (only own registrations, teams, attendance, certificates, passes).
 * Handles localized Creator Card, Wikipedia photo enrichment where applicable, and Groq AI responses.
 */

const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Attendance = require('../models/Attendance');
const Certificate = require('../models/Certificate');
const Ticket = require('../models/Ticket');
const { generateChatResponse } = require('../services/llmService');
const { fetchPersonThumbnail } = require('../services/wikipediaService');
const { CREATOR_DATA } = require('../config/creatorConfig');

const PROJECT_CREATOR_DATA = CREATOR_DATA;

const handleChatMessage = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message text is required.',
      });
    }

    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to chat with EventSync Assistant.',
      });
    }

    const userRole = currentUser.role === 'EVENTADMIN' ? 'EVENTADMIN' : 'STUDENT';

    let sanitizedUserData = {};
    let sanitizedAdminData = {};

    // 1. Role-based data fetching
    if (userRole === 'EVENTADMIN') {
      const [allEvents, allRegistrations, allAttendances, allCertificates] = await Promise.all([
        Event.find({}).sort({ date: 1 }).lean(),
        Registration.find({ status: 'REGISTERED' }).populate('event', 'title date').lean(),
        Attendance.find({}).lean(),
        Certificate.find({}).lean(),
      ]);

      const totalRegistrations = allRegistrations.length;
      const totalTeams = allRegistrations.filter(
        (r) => (r.teamMembers && r.teamMembers.length > 0) || (r.teamSize && r.teamSize > 1)
      ).length;

      const presentCount = allAttendances.filter((a) => a.status === 'PRESENT' || a.status === 'CHECKED_IN').length;
      const absentCount = allAttendances.filter((a) => a.status === 'ABSENT').length;
      const notMarkedCount = allAttendances.filter((a) => a.status === 'NOT_MARKED').length;
      const totalAttendanceLogged = presentCount + absentCount;
      const attendanceRate = totalAttendanceLogged > 0
        ? `${Math.round((presentCount / totalAttendanceLogged) * 100)}%`
        : '0%';

      const certIssuedCount = allCertificates.filter((c) => c.status === 'ISSUED' || c.status === 'RECEIVED').length;
      const certNotIssuedCount = allCertificates.filter((c) => c.status === 'NOT_ISSUED').length;
      const certReceivedCount = allCertificates.filter((c) => c.status === 'RECEIVED').length;

      sanitizedAdminData = {
        adminName: currentUser.name,
        adminEmail: currentUser.email,
        metrics: {
          totalEvents: allEvents.length,
          totalRegistrations,
          totalTeams,
          attendance: {
            present: presentCount,
            absent: absentCount,
            notMarked: notMarkedCount,
            attendanceRate,
          },
          certificates: {
            issued: certIssuedCount,
            notIssued: certNotIssuedCount,
            received: certReceivedCount,
          },
        },
        eventsSummary: allEvents.map((ev) => {
          const evIdStr = String(ev._id);
          const eventRegs = allRegistrations.filter(
            (r) => r.event && String(r.event._id || r.event) === evIdStr
          );
          const eventAtts = allAttendances.filter(
            (a) => a.event && String(a.event._id || a.event) === evIdStr
          );
          const eventCerts = allCertificates.filter(
            (c) => c.event && String(c.event._id || c.event) === evIdStr
          );

          const teamsCount = eventRegs.filter(
            (r) => (r.teamMembers && r.teamMembers.length > 0) || (r.teamSize && r.teamSize > 1)
          ).length;

          const presentStudents = eventAtts
            .filter((a) => a.status === 'PRESENT' || a.status === 'CHECKED_IN')
            .map((a) => a.memberName || a.memberRollNumber || 'Student');

          const absentStudents = eventAtts
            .filter((a) => a.status === 'ABSENT')
            .map((a) => a.memberName || a.memberRollNumber || 'Student');

          const notMarkedStudents = eventAtts
            .filter((a) => a.status === 'NOT_MARKED')
            .map((a) => a.memberName || a.memberRollNumber || 'Student');

          const certIssuedStudents = eventCerts
            .filter((c) => c.status === 'ISSUED' || c.status === 'RECEIVED')
            .map((c) => c.memberName || c.memberRollNumber || 'Student');

          const certReceivedStudents = eventCerts
            .filter((c) => c.status === 'RECEIVED')
            .map((c) => c.memberName || c.memberRollNumber || 'Student');

          const registeredParticipants = eventRegs.map((r) => ({
            name: r.fullName || 'Student',
            rollNumber: r.rollNumber || '',
            department: r.department || '',
            teamName: r.teamName || '',
            isTeam: (r.teamMembers && r.teamMembers.length > 0) || (r.teamSize && r.teamSize > 1),
            members: (r.teamMembers || []).map((m) => `${m.name} (${m.rollNumber})`),
          }));

          return {
            title: ev.title,
            eventId: evIdStr,
            status: ev.status,
            date: ev.date,
            registrationDeadline: ev.registrationDeadline,
            capacity: ev.capacity,
            activeRegistrations: eventRegs.length,
            seatsLeft: Math.max(0, (ev.capacity || 0) - eventRegs.length),
            teamsCount,
            registeredParticipants,
            presentStudents,
            absentStudents,
            notMarkedStudents,
            certIssuedStudents,
            certReceivedStudents,
          };
        }),
      };
    } else {
      // Fetch strictly THIS student's own data (Guaranteed student privacy isolation)
      const [myRegistrations, myAttendance, myCertificates, myPasses] = await Promise.all([
        Registration.find({ student: currentUser._id, status: 'REGISTERED' }).populate('event').lean(),
        Attendance.find({ student: currentUser._id }).populate('event').lean(),
        Certificate.find({ student: currentUser._id }).populate('event').lean(),
        Ticket.find({ student: currentUser._id, status: 'ACTIVE' }).populate('event').lean(),
      ]);

      sanitizedUserData = {
        student: {
          name: currentUser.name,
          email: currentUser.email,
          studentId: currentUser.studentId || '',
          department: currentUser.department || '',
          year: currentUser.year || '',
        },
        registrations: myRegistrations.map((r) => ({
          eventName: r.event?.title || 'Unknown Event',
          eventId: r.event?._id?.toString(),
          status: r.status,
          registeredAt: r.registeredAt,
          rollNumber: r.rollNumber || currentUser.studentId || '',
          department: r.department || currentUser.department || '',
          year: r.year || currentUser.year || '',
          teamSize: r.teamSize || 1,
          teamName: r.teamName || '',
          teamMembers: (r.teamMembers || []).map((m) => ({
            name: m.name,
            rollNumber: m.rollNumber,
            department: m.department,
            year: m.year,
            attendanceStatus: m.attendanceStatus,
            certificateStatus: m.certificateStatus,
          })),
        })),
        attendance: myAttendance.map((a) => ({
          eventName: a.event?.title || 'Unknown Event',
          eventId: a.event?._id?.toString(),
          status: a.status,
          markedAt: a.markedAt,
        })),
        certificates: myCertificates.map((c) => ({
          eventName: c.event?.title || 'Unknown Event',
          eventId: c.event?._id?.toString(),
          status: c.status,
          issuedAt: c.issuedAt,
          receivedAt: c.receivedAt,
        })),
        digitalPasses: myPasses.map((p) => ({
          eventName: p.event?.title || 'Unknown Event',
          passCode: p.ticketCode || p.passCode,
          status: p.status,
        })),
      };
    }

    // 2. Fetch published events with live dynamic seats and coordinator info (available to all)
    const publishedEvents = await Event.find({ status: 'PUBLISHED' }).sort({ date: 1 }).lean();

    const sanitizedEventsData = await Promise.all(
      publishedEvents.map(async (ev) => {
        const activeRegs = await Registration.countDocuments({
          event: ev._id,
          status: 'REGISTERED',
        });
        const seatsLeft = Math.max(0, (ev.capacity || 0) - activeRegs);

        return {
          eventName: ev.title,
          description: ev.description,
          date: ev.date,
          time: ev.time,
          venue: ev.venue,
          registrationDeadline: ev.registrationDeadline,
          capacity: ev.capacity,
          maxTeamSize: ev.maxTeamSize || 1,
          seatsLeft,
          category: ev.category,
          mode: ev.mode || 'Offline',
          prizeMoney: ev.prizeMoney !== undefined ? ev.prizeMoney : 0,
          firstPrize: ev.firstPrize || 0,
          secondPrize: ev.secondPrize || 0,
          thirdPrize: ev.thirdPrize || 0,
          participationCertificateAvailable: ev.participationCertificateAvailable !== false,
          facultyCoordinatorName: ev.facultyCoordinatorName || '',
          coordinators: (ev.coordinators || []).map((c) => ({
            name: c.coordinatorName || c.name || '',
            phone: c.coordinatorPhone || c.phone || '',
          })),
        };
      })
    );

    // 3. Generate structured response via LLM service (with context and safe fallback)
    const chatResult = await generateChatResponse({
      message: message.trim(),
      history: Array.isArray(history) ? history.slice(-10) : [],
      userRole,
      userData: sanitizedUserData,
      adminData: sanitizedAdminData,
      eventsData: sanitizedEventsData,
      projectCreatorData: PROJECT_CREATOR_DATA,
    });

    // 4. Enrich card photos appropriately
    if (chatResult && chatResult.type === 'invention_card') {
      const personName = (chatResult.person || chatResult.name || '').toLowerCase();
      // If it's the EventSync creator card, use the local verified photo asset
      if (
        personName.includes('priya') ||
        personName.includes('atmakuru') ||
        personName.includes('darshini') ||
        personName.includes('eventsync') ||
        personName.includes('creator') ||
        personName.includes('developer')
      ) {
        chatResult.photoUrl = CREATOR_DATA.localPhoto || '/src/assets/creator.jpg';
        chatResult.imageUrl = CREATOR_DATA.localPhoto || '/src/assets/creator.jpg';
      } else {
        // If an invention card was returned for an external figure, enrich with verified Wikipedia photo
        try {
          const wikiTitle = chatResult.wikipedia_title || chatResult.person || '';
          if (wikiTitle && typeof fetchPersonThumbnail === 'function') {
            const photoUrl = await fetchPersonThumbnail(wikiTitle);
            chatResult.photoUrl = photoUrl;
            chatResult.imageUrl = photoUrl;
          }
        } catch (wikiErr) {
          console.warn('[ChatController] Wikipedia thumbnail fetch error:', wikiErr.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: chatResult,
    });
  } catch (error) {
    console.error('[ChatController Error]:', error);
    // Never crash or return an unhandled 500 error to the student
    return res.status(200).json({
      success: true,
      data: {
        type: 'text',
        message: 'Kshaminchandi, oka chinna technical issue vachindi. Please malli adagandi (Please try asking again).',
      },
    });
  }
};

module.exports = { handleChatMessage };
