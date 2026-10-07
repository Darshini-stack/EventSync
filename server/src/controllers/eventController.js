const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const qrcode = require('qrcode');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { posterUploadDir } = require('../middleware/upload');
const config = require('../config/env');
const { getLocalIpAddress } = require('../utils/network');
const { buildEventRegistrationUrl } = require('../utils/qrUrlHelper');

const ALLOWED_CATEGORIES = [
  'Technology',
  'Workshop',
  'Seminar',
  'Hackathon',
  'Hackathon / Innovation',
  'Cultural',
  'Sports',
  'College',
  'Other',
];

const ALLOWED_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'COMPLETED',
  'CANCELLED',
];

/**
 * Timezone-safe calendar date parser.
 * Guarantees that calendar dates entered by Admin (e.g. YYYY-MM-DD) do not shift across timezones.
 */
const parseSafeDate = (val, isEndOfDay = false) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    const [y, m, d] = val.trim().split('-').map(Number);
    return isEndOfDay
      ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
      : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// Helper to safely emit real-time events via Socket.IO
const emitSocketEvent = (eventName, payload) => {
  try {
    const { getIO } = require('../sockets');
    const io = getIO();
    io.emit(eventName, payload);
  } catch (err) {
    // Socket emit failure should not interrupt database transaction
    console.warn(`[Socket.IO] Broadcast warning for ${eventName}:`, err.message);
  }
};

/**
 * GET /api/events
 * Public endpoint: Returns all PUBLISHED events from MongoDB.
 * Zero hardcoded or mock data. Returns [] if no published events exist.
 */
const getEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ status: 'PUBLISHED' })
      .sort({ date: 1 })
      .populate('createdBy', 'name email')
      .lean();

    const enrichedEvents = await Promise.all(
      events.map(async (ev) => {
        const activeRegs = await Registration.countDocuments({
          event: ev._id,
          status: 'REGISTERED',
        });
        const seatsLeft = Math.max(0, (ev.capacity || 0) - activeRegs);
        return {
          ...ev,
          availableSeats: seatsLeft,
          seatsLeft,
          activeRegistrationsCount: activeRegs,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enrichedEvents.length,
      data: enrichedEvents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/admin/all
 * Protected endpoint (EVENTADMIN only):
 * Returns all events across all statuses (DRAFT, PUBLISHED, CANCELLED).
 * Returns live database summary counts.
 */
const getAdminEvents = async (req, res, next) => {
  try {
    const [events, total, published, draft, cancelled] = await Promise.all([
      Event.find()
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email')
        .lean(),
      Event.countDocuments(),
      Event.countDocuments({ status: 'PUBLISHED' }),
      Event.countDocuments({ status: 'DRAFT' }),
      Event.countDocuments({ status: 'CANCELLED' }),
    ]);

    return res.status(200).json({
      success: true,
      counts: {
        total,
        published,
        draft,
        cancelled,
      },
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:id
 * Dynamic single event detail lookup:
 * - Public callers can only view PUBLISHED events.
 * - Authenticated EVENTADMIN callers may view DRAFT, PUBLISHED, or CANCELLED events.
 */
const getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fast-fail if MongoDB is not ready to prevent query buffering/hanging
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database service is temporarily unavailable. Please retry shortly.',
      });
    }

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id.trim())) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    const event = await Event.findById(id.trim()).populate('createdBy', 'name email').lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    // Role-sensitive visibility check: Public can view PUBLISHED, REGISTRATION_OPEN, REGISTRATION_CLOSED, or COMPLETED events; Admin can view all
    const isEventAdmin = req.user && req.user.role === 'EVENTADMIN';
    const isViewableStatus = ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'COMPLETED'].includes(event.status);
    if (!isViewableStatus && !isEventAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    const activeRegs = await Registration.countDocuments({
      event: event._id,
      status: 'REGISTERED',
    });
    const seatsLeft = Math.max(0, (event.capacity || 0) - activeRegs);
    const enrichedEvent = {
      ...event,
      availableSeats: seatsLeft,
      seatsLeft,
      activeRegistrationsCount: activeRegs,
    };

    return res.status(200).json({
      success: true,
      data: enrichedEvent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/events
 * Protected endpoint (EVENTADMIN only):
 * Creates and persists a new real event into MongoDB.
 * Zero demo/seed data.
 */
const createEvent = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      date,
      time,
      venue,
      capacity,
      isPaid,
      fee,
      gradient,
      status,
      mode,
      registrationDeadline,
      maxTeamSize,
      prizeMoney,
      participationCertificateAvailable,
      facultyCoordinatorName,
      coordinators,
    } = req.body;

    // 1. Validate required fields
    if (!title || !description || !category || !date || !time || !venue || capacity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category, date, time, venue, and capacity are required.',
      });
    }

    // 2. Validate string lengths
    const trimmedTitle = String(title).trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Event title must be between 3 and 150 characters.',
      });
    }

    const trimmedDescription = String(description).trim();
    if (trimmedDescription.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Event description must be at least 10 characters.',
      });
    }

    // 3. Validate category
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Supported categories: ${ALLOWED_CATEGORIES.join(', ')}`,
      });
    }

    // 4. Validate date
    const parsedDate = parseSafeDate(date);
    if (!parsedDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event date format.',
      });
    }

    // 5. Validate capacity
    const numCapacity = parseInt(capacity, 10);
    if (isNaN(numCapacity) || numCapacity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be a positive integer of at least 1.',
      });
    }

    // 6. Admission type & Fee handling
    const booleanIsPaid = isPaid === true || isPaid === 'true';
    let numFee = 0;
    if (booleanIsPaid) {
      const parsedFee = parseFloat(fee);
      if (isNaN(parsedFee) || parsedFee < 0) {
        return res.status(400).json({
          success: false,
          message: 'Fee must be a valid non-negative number for paid events.',
        });
      }
      numFee = parsedFee;
    }

    // 7. Validate status
    let initialStatus = 'DRAFT';
    if (status && ALLOWED_STATUSES.includes(status)) {
      initialStatus = status;
    }

    let parsedDeadline = null;
    if (registrationDeadline) {
      parsedDeadline = parseSafeDate(registrationDeadline, true);
      if (!parsedDeadline) {
        return res.status(400).json({
          success: false,
          message: 'Invalid registration deadline date format.',
        });
      }
      const deadlineDayStr = parsedDeadline.toISOString().split('T')[0];
      const eventDayStr = parsedDate.toISOString().split('T')[0];
      if (deadlineDayStr > eventDayStr) {
        return res.status(400).json({
          success: false,
          message: 'Registration deadline cannot be after the event date.',
        });
      }
    }
    const parsedStartDate = parseSafeDate(req.body.registrationStartDate);
    const eventMode = ['Offline', 'Online', 'Hybrid'].includes(mode) ? mode : 'Offline';
    const teamSize = Math.max(1, Math.min(10, parseInt(maxTeamSize, 10) || 5));

    // Prize money & positions (1st, 2nd, 3rd)
    const { firstPrize, secondPrize, thirdPrize } = req.body;
    const parsedFirstPrize = Math.max(0, parseFloat(firstPrize) || 0);
    const parsedSecondPrize = Math.max(0, parseFloat(secondPrize) || 0);
    const parsedThirdPrize = Math.max(0, parseFloat(thirdPrize) || 0);
    let parsedPrizeMoney = Math.max(0, parseFloat(prizeMoney) || 0);
    if (!parsedPrizeMoney && (parsedFirstPrize || parsedSecondPrize || parsedThirdPrize)) {
      parsedPrizeMoney = parsedFirstPrize + parsedSecondPrize + parsedThirdPrize;
    }

    // Participation certificate availability
    const certAvailable =
      participationCertificateAvailable === undefined
        ? true
        : participationCertificateAvailable === true ||
          participationCertificateAvailable === 'true';

    // Faculty coordinator (name only, no phone)
    const facultyName = facultyCoordinatorName ? String(facultyCoordinatorName).trim() : '';

    // Student coordinators (max 3)
    let parsedCoordinators = [];
    if (coordinators) {
      let coordList = coordinators;
      if (typeof coordList === 'string') {
        try {
          coordList = JSON.parse(coordList);
        } catch (e) {
          coordList = [];
        }
      }
      if (Array.isArray(coordList)) {
        if (coordList.length > 3) {
          return res.status(400).json({
            success: false,
            message: 'A maximum of 3 student coordinators can be configured.',
          });
        }
        parsedCoordinators = coordList
          .slice(0, 3)
          .map((c) => ({
            coordinatorName: String(c.coordinatorName || c.name || '').trim(),
            coordinatorPhone: String(c.coordinatorPhone || c.phone || '').trim(),
          }))
          .filter((c) => c.coordinatorName || c.coordinatorPhone);
      }
    }

    // 8. Process optional uploaded poster
    let posterData = undefined;
    if (req.file) {
      posterData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
      };
    } else if (req.body.posterBase64) {
      const mime = req.body.posterMimeType || 'image/png';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid poster format. Only JPEG, PNG, and WEBP images are allowed.',
        });
      }
      const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png';
      const safeFilename = `poster_${crypto.randomUUID()}${ext}`;
      const safePath = path.join(posterUploadDir, safeFilename);
      const buffer = Buffer.from(req.body.posterBase64, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Poster file size exceeds 5MB limit.',
        });
      }
      fs.writeFileSync(safePath, buffer);
      posterData = {
        filename: safeFilename,
        originalName: req.body.posterFilename || `poster${ext}`,
        path: safePath,
        mimetype: mime,
        size: buffer.length,
        uploadedAt: new Date(),
      };
    }

    // 9. Create event document in MongoDB
    // createdBy is STRICTLY bound from authenticated user; client-supplied value is ignored
    const newEvent = await Event.create({
      title: trimmedTitle,
      description: trimmedDescription,
      category,
      mode: eventMode,
      registrationStartDate: parsedStartDate,
      registrationDeadline: parsedDeadline,
      maxTeamSize: teamSize,
      date: parsedDate,
      time: String(time).trim(),
      venue: String(venue).trim(),
      capacity: numCapacity,
      availableSeats: numCapacity, // On initial creation before RSVPs exist
      isPaid: booleanIsPaid,
      fee: numFee,
      prizeMoney: parsedPrizeMoney,
      firstPrize: parsedFirstPrize,
      secondPrize: parsedSecondPrize,
      thirdPrize: parsedThirdPrize,
      participationCertificateAvailable: certAvailable,
      facultyCoordinatorName: facultyName,
      coordinators: parsedCoordinators,
      gradient: gradient && typeof gradient === 'string' ? gradient.trim() : undefined,
      status: initialStatus,
      poster: posterData,
      createdBy: req.user._id,
    });

    // 9. Real-time broadcast
    emitSocketEvent('event_created', {
      eventId: newEvent._id,
      status: newEvent.status,
    });

    // 10. Generate persistent notifications
    try {
      const notificationService = require('../services/notificationService');
      const User = require('../models/User');

      // Admin confirmation: EVENT_CREATED
      await notificationService.createNotification({
        recipient: req.user._id,
        type: 'EVENT_CREATED',
        title: 'Event Created',
        message: `Event "${newEvent.title}" has been successfully created with status ${newEvent.status}.`,
        event: newEvent._id,
      });

      // If created directly as PUBLISHED: notify eligible students
      if (newEvent.status === 'PUBLISHED') {
        const students = await User.find({ role: 'STUDENT' }, '_id').lean();
        for (const student of students) {
          await notificationService.createNotification({
            recipient: student._id,
            type: 'EVENT_PUBLISHED',
            title: `New Event Published: ${newEvent.title}`,
            message: `A new event "${newEvent.title}" is now open for registration. Venue: ${newEvent.venue || 'Campus'}.`,
            event: newEvent._id,
            dedupeKey: `EVENT_PUBLISHED:${newEvent._id}:${student._id}`,
          });
        }
      }
    } catch (notifErr) {
      console.warn('[Notification] Warning sending event_created notification:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      data: newEvent,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    next(error);
  }
};

/**
 * PUT /api/events/:id
 * Protected endpoint (EVENTADMIN only):
 * Updates allowed fields of an existing event in MongoDB.
 * Protects _id and createdBy ownership.
 */
const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    const oldStatus = event.status;
    const oldCapacity = event.capacity;
    const oldDate = event.date ? event.date.toISOString() : null;
    const oldTime = event.time;
    const oldVenue = event.venue;
    const oldFee = event.fee;
    const oldTitle = event.title;
    const oldDesc = event.description;
    const oldCategory = event.category;

    const {
      title,
      description,
      category,
      date,
      time,
      venue,
      capacity,
      isPaid,
      fee,
      gradient,
      status,
      mode,
      registrationDeadline,
      prizeMoney,
      participationCertificateAvailable,
      facultyCoordinatorName,
      coordinators,
    } = req.body;

    // Validate fields if provided
    if (title !== undefined) {
      const trimmedTitle = String(title).trim();
      if (trimmedTitle.length < 3 || trimmedTitle.length > 150) {
        return res.status(400).json({
          success: false,
          message: 'Event title must be between 3 and 150 characters.',
        });
      }
      event.title = trimmedTitle;
    }

    if (description !== undefined) {
      const trimmedDescription = String(description).trim();
      if (trimmedDescription.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Event description must be at least 10 characters.',
        });
      }
      event.description = trimmedDescription;
    }

    if (category !== undefined) {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Supported categories: ${ALLOWED_CATEGORIES.join(', ')}`,
        });
      }
      event.category = category;
    }

    if (date !== undefined) {
      const parsedDate = parseSafeDate(date);
      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid event date format.',
        });
      }
      event.date = parsedDate;
    }

    if (time !== undefined) {
      event.time = String(time).trim();
    }

    if (venue !== undefined) {
      event.venue = String(venue).trim();
    }

    if (capacity !== undefined) {
      const numCapacity = parseInt(capacity, 10);
      if (isNaN(numCapacity) || numCapacity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Capacity must be a positive integer of at least 1.',
        });
      }
      const activeRegCount = await Registration.countDocuments({
        event: event._id,
        status: 'REGISTERED',
      });
      if (numCapacity < activeRegCount) {
        return res.status(400).json({
          success: false,
          message: `Capacity (${numCapacity}) cannot be lower than the current number of active registrations (${activeRegCount}).`,
        });
      }
      event.capacity = numCapacity;
      event.availableSeats = Math.max(0, numCapacity - activeRegCount);
    }

    if (mode !== undefined) {
      event.mode = ['Offline', 'Online', 'Hybrid'].includes(mode) ? mode : 'Offline';
    }

    if (req.body.registrationStartDate !== undefined) {
      event.registrationStartDate = parseSafeDate(req.body.registrationStartDate);
    }

    if (registrationDeadline !== undefined) {
      if (!registrationDeadline) {
        event.registrationDeadline = null;
      } else {
        const parsed = parseSafeDate(registrationDeadline, true);
        if (!parsed) {
          return res.status(400).json({
            success: false,
            message: 'Invalid registration deadline date format.',
          });
        }
        const evDate = event.date || new Date();
        const deadlineDayStr = parsed.toISOString().split('T')[0];
        const eventDayStr = new Date(evDate).toISOString().split('T')[0];
        if (deadlineDayStr > eventDayStr) {
          return res.status(400).json({
            success: false,
            message: 'Registration deadline cannot be after the event conducting date.',
          });
        }
        event.registrationDeadline = parsed;
      }
    }

    const { firstPrize, secondPrize, thirdPrize } = req.body;
    if (firstPrize !== undefined) {
      event.firstPrize = Math.max(0, parseFloat(firstPrize) || 0);
    }
    if (secondPrize !== undefined) {
      event.secondPrize = Math.max(0, parseFloat(secondPrize) || 0);
    }
    if (thirdPrize !== undefined) {
      event.thirdPrize = Math.max(0, parseFloat(thirdPrize) || 0);
    }

    if (prizeMoney !== undefined) {
      const parsedPrize = parseFloat(prizeMoney);
      if (isNaN(parsedPrize) || parsedPrize < 0) {
        return res.status(400).json({
          success: false,
          message: 'Prize money must be a non-negative number.',
        });
      }
      event.prizeMoney = parsedPrize;
    } else if (firstPrize !== undefined || secondPrize !== undefined || thirdPrize !== undefined) {
      if ((event.firstPrize || event.secondPrize || event.thirdPrize) && (!event.prizeMoney || event.prizeMoney === 0)) {
        event.prizeMoney = (event.firstPrize || 0) + (event.secondPrize || 0) + (event.thirdPrize || 0);
      }
    }

    if (participationCertificateAvailable !== undefined) {
      event.participationCertificateAvailable =
        participationCertificateAvailable === true ||
        participationCertificateAvailable === 'true';
    }

    if (facultyCoordinatorName !== undefined) {
      event.facultyCoordinatorName = String(facultyCoordinatorName).trim();
    }

    if (coordinators !== undefined) {
      let coordList = coordinators;
      if (typeof coordList === 'string') {
        try {
          coordList = JSON.parse(coordList);
        } catch (e) {
          coordList = [];
        }
      }
      if (Array.isArray(coordList)) {
        if (coordList.length > 3) {
          return res.status(400).json({
            success: false,
            message: 'A maximum of 3 student coordinators can be configured.',
          });
        }
        event.coordinators = coordList
          .slice(0, 3)
          .map((c) => ({
            coordinatorName: String(c.coordinatorName || c.name || '').trim(),
            coordinatorPhone: String(c.coordinatorPhone || c.phone || '').trim(),
          }))
          .filter((c) => c.coordinatorName || c.coordinatorPhone);
      }
    }

    if (isPaid !== undefined) {
      event.isPaid = isPaid === true || isPaid === 'true';
      if (!event.isPaid) {
        event.fee = 0;
      }
    }

    if (fee !== undefined && event.isPaid) {
      const numFee = parseFloat(fee) || 0;
      if (numFee < 0) {
        return res.status(400).json({
          success: false,
          message: 'Fee cannot be negative.',
        });
      }
      event.fee = numFee;
    }

    if (gradient !== undefined) {
      event.gradient = gradient ? String(gradient).trim() : undefined;
    }

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}`,
        });
      }
      event.status = status;
    }

    // Process optional poster update / removal
    if (req.body.removePoster === true || req.body.removePoster === 'true') {
      if (event.poster && event.poster.path && fs.existsSync(event.poster.path)) {
        try { fs.unlinkSync(event.poster.path); } catch (e) {}
      }
      event.poster = undefined;
    } else if (req.file) {
      if (event.poster && event.poster.path && fs.existsSync(event.poster.path)) {
        try { fs.unlinkSync(event.poster.path); } catch (e) {}
      }
      event.poster = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
      };
    } else if (req.body.posterBase64) {
      const mime = req.body.posterMimeType || 'image/png';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid poster format. Only JPEG, PNG, and WEBP images are allowed.',
        });
      }
      const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png';
      const safeFilename = `poster_${crypto.randomUUID()}${ext}`;
      const safePath = path.join(posterUploadDir, safeFilename);
      const buffer = Buffer.from(req.body.posterBase64, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Poster file size exceeds 5MB limit.',
        });
      }
      if (event.poster && event.poster.path && fs.existsSync(event.poster.path)) {
        try { fs.unlinkSync(event.poster.path); } catch (e) {}
      }
      fs.writeFileSync(safePath, buffer);
      event.poster = {
        filename: safeFilename,
        originalName: req.body.posterFilename || `poster${ext}`,
        path: safePath,
        mimetype: mime,
        size: buffer.length,
        uploadedAt: new Date(),
      };
    }

    await event.save();

    // Real-time broadcast
    emitSocketEvent('event_updated', {
      eventId: event._id,
      status: event.status,
    });

    // Generate persistent notifications for affected users
    try {
      const notificationService = require('../services/notificationService');
      const Registration = require('../models/Registration');
      const User = require('../models/User');

      // 1. Transition to PUBLISHED: notify students
      if (oldStatus !== 'PUBLISHED' && event.status === 'PUBLISHED') {
        const students = await User.find({ role: 'STUDENT' }, '_id').lean();
        for (const student of students) {
          await notificationService.createNotification({
            recipient: student._id,
            type: 'EVENT_PUBLISHED',
            title: `Event Published: ${event.title}`,
            message: `"${event.title}" is now published and open for registrations!`,
            event: event._id,
            dedupeKey: `EVENT_PUBLISHED:${event._id}:${student._id}`,
          });
        }
      }

      // 2. Transition to CANCELLED: notify registered students
      if (oldStatus !== 'CANCELLED' && event.status === 'CANCELLED') {
        const activeRegs = await Registration.find({ event: event._id, status: 'REGISTERED' }).lean();
        for (const reg of activeRegs) {
          await notificationService.createNotification({
            recipient: reg.student,
            type: 'EVENT_CANCELLED',
            title: `Event Cancelled: ${event.title}`,
            message: `Notice: "${event.title}" scheduled for ${event.date ? new Date(event.date).toLocaleDateString() : ''} has been cancelled by administration.`,
            event: event._id,
            registration: reg._id,
          });
        }
      }

      // 3. Capacity increased on published event: notify registered students
      if (event.capacity > oldCapacity && oldCapacity > 0) {
        const activeRegs = await Registration.find({ event: event._id, status: 'REGISTERED' }).lean();
        for (const reg of activeRegs) {
          await notificationService.createNotification({
            recipient: reg.student,
            type: 'CAPACITY_INCREASED',
            title: `Capacity Increased: ${event.title}`,
            message: `Seating capacity for "${event.title}" was expanded from ${oldCapacity} to ${event.capacity}.`,
            event: event._id,
            registration: reg._id,
          });
        }
      }

      // 4. Meaningful schedule or venue update: notify registered students
      const detailsChanged =
        (event.date && event.date.toISOString() !== oldDate) ||
        event.time !== oldTime ||
        event.venue !== oldVenue ||
        event.fee !== oldFee ||
        event.title !== oldTitle ||
        event.description !== oldDesc ||
        event.category !== oldCategory;

      if (event.status === 'PUBLISHED' && detailsChanged && oldStatus === 'PUBLISHED') {
        const activeRegs = await Registration.find({ event: event._id, status: 'REGISTERED' }).lean();
        for (const reg of activeRegs) {
          await notificationService.createNotification({
            recipient: reg.student,
            type: 'EVENT_UPDATED',
            title: `Event Updated: ${event.title}`,
            message: `Event details for "${event.title}" have been updated. Venue: ${event.venue || 'Campus'}, Time: ${event.time || ''}.`,
            event: event._id,
            registration: reg._id,
          });
        }
      }
    } catch (notifErr) {
      console.warn('[Notification] Warning sending event_updated notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully.',
      data: event,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    next(error);
  }
};

/**
 * DELETE /api/events/:id
 * Protected endpoint (EVENTADMIN only):
 * Permanently removes event document from MongoDB.
 */
const deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    // Clean up stored poster file if exists
    if (event.poster && event.poster.path && fs.existsSync(event.poster.path)) {
      try { fs.unlinkSync(event.poster.path); } catch (e) {}
    }

    // Real-time broadcast
    emitSocketEvent('event_deleted', {
      eventId: id,
    });

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:id/poster
 * Public endpoint: Streams the stored event poster image.
 * Returns 404 if event has no poster or file is missing from disk.
 */
const getEventPoster = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const event = await Event.findById(id).select('poster status');
    if (!event || !event.poster || !event.poster.path) {
      return res.status(404).json({ success: false, message: 'No poster found for this event.' });
    }

    const posterPath = path.resolve(event.poster.path);
    if (!fs.existsSync(posterPath)) {
      // Fallback: check uploads/posters in current repository by filename
      const localFilenamePath = event.poster.filename
        ? path.resolve(__dirname, '../../uploads/posters', event.poster.filename)
        : null;
      if (localFilenamePath && fs.existsSync(localFilenamePath)) {
        res.setHeader('Content-Type', event.poster.mimetype || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(localFilenamePath);
      }
      return res.status(404).json({ success: false, message: 'Poster file is missing from server storage.' });
    }

    res.setHeader('Content-Type', event.poster.mimetype || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(posterPath);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:id/registration-qr
 * Public endpoint: Dynamically generates a QR code encoding ONLY the registration URL.
 * Concept: <current application origin>/events/<realEventId>/register
 */
const getEventRegistrationQr = async (req, res, next) => {
  try {
    // Fast-fail if MongoDB is not ready to prevent query buffering/hanging
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database service is temporarily unavailable. Please retry shortly.',
      });
    }

    const { id } = req.params;
    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id.trim())) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const event = await Event.findById(id.trim()).select('title status');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const isEventAdmin = req.user && req.user.role === 'EVENTADMIN';
    const isPublicStatus = ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'COMPLETED', 'DRAFT'].includes(event.status);
    if (!isPublicStatus && !isEventAdmin) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Resolve dynamic, accessible event registration URL (supports LAN, mobile, desktop, and production)
    const registrationUrl = buildEventRegistrationUrl(event._id, req);
    console.log(`[EventController] Registration QR generated for "${event.title}": ${registrationUrl}`);

    if (req.query.format === 'json') {
      const dataUrl = await qrcode.toDataURL(registrationUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      return res.status(200).json({
        success: true,
        eventId: event._id,
        eventTitle: event.title,
        registrationUrl,
        dataUrl,
        data: {
          eventId: event._id,
          eventTitle: event.title,
          registrationUrl,
          encodedUrl: registrationUrl,
          dataUrl,
        },
      });
    }

    const qrBuffer = await qrcode.toBuffer(registrationUrl, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.status(200).send(qrBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEvents,
  getAdminEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventPoster,
  getEventRegistrationQr,
};

