const express = require('express');
const {
  createRegistration,
  cancelRegistration,
  getMyRegistrations,
  getAdminRegistrations,
  getRegistrationById,
} = require('../controllers/registrationController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/registrations/my - Student view own registrations (MUST be declared before /:id)
router.get(
  '/my',
  authenticateToken,
  requireRole('STUDENT'),
  getMyRegistrations
);

// GET /api/registrations/admin - EventAdmin only (MUST be declared before /:id)
router.get(
  '/admin',
  authenticateToken,
  requireRole('EVENTADMIN'),
  getAdminRegistrations
);

// GET /api/registrations/:id - Fetch full details for a registration (Admin or Owner)
router.get(
  '/:id',
  authenticateToken,
  getRegistrationById
);

// POST /api/registrations - Create RSVP/Registration (Student only)
router.post(
  '/',
  authenticateToken,
  requireRole('STUDENT'),
  createRegistration
);

// DELETE /api/registrations/:id - Cancel RSVP/Registration (Student or Admin)
router.delete(
  '/:id',
  authenticateToken,
  requireRole('STUDENT', 'EVENTADMIN'),
  cancelRegistration
);

module.exports = router;
