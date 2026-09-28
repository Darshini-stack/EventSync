const express = require('express');
const {
  getEvents,
  getAdminEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventPoster,
  getEventRegistrationQr,
} = require('../controllers/eventController');
const { createRegistration } = require('../controllers/registrationController');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { uploadPoster } = require('../middleware/upload');

const router = express.Router();

// Helper to gracefully handle multer errors for poster uploads
const handlePosterUpload = (req, res, next) => {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.includes('multipart/form-data')) {
    return next();
  }
  uploadPoster.single('poster')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Poster file size exceeds 5MB limit.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid poster file upload.',
      });
    }
    next();
  });
};

// GET /api/events/admin/all - EventAdmin only (MUST be declared before /:id)
router.get(
  '/admin/all',
  authenticateToken,
  requireRole('EVENTADMIN'),
  getAdminEvents
);

// GET /api/events - Public dynamic events catalog (only PUBLISHED)
router.get('/', getEvents);

// GET /api/events/:id/poster - Public stream of event poster image
router.get('/:id/poster', getEventPoster);

// GET /api/events/:id/registration-qr - Public (or EventAdmin) QR code encoding registration link
router.get('/:id/registration-qr', optionalAuth, getEventRegistrationQr);

// GET /api/events/:id - Public (PUBLISHED only) or EventAdmin (DRAFT/PUBLISHED/CANCELLED)
router.get('/:id', optionalAuth, getEventById);

// POST /api/events/:id/register - Registration route alias (Student or Admin)
router.post(
  '/:id/register',
  authenticateToken,
  requireRole('STUDENT', 'EVENTADMIN'),
  createRegistration
);

// POST /api/events - Create new event (EventAdmin only)
router.post(
  '/',
  authenticateToken,
  requireRole('EVENTADMIN'),
  handlePosterUpload,
  createEvent
);

// PUT /api/events/:id - Update existing event (EventAdmin only)
router.put(
  '/:id',
  authenticateToken,
  requireRole('EVENTADMIN'),
  handlePosterUpload,
  updateEvent
);

// PATCH /api/events/:id/status - Update event status (EventAdmin only)
router.patch(
  '/:id/status',
  authenticateToken,
  requireRole('EVENTADMIN'),
  updateEvent
);

// DELETE /api/events/:id - Delete event from MongoDB (EventAdmin only)
router.delete(
  '/:id',
  authenticateToken,
  requireRole('EVENTADMIN'),
  deleteEvent
);

module.exports = router;

