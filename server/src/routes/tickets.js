const express = require('express');
const {
  createTicket,
  getMyTickets,
  getAdminTickets,
  getTicketById,
  getTicketQrImage,
  getPassByRegistration,
} = require('../controllers/ticketController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/tickets/registration/:registrationId - Student owner or EventAdmin
router.get(
  '/registration/:registrationId',
  authenticateToken,
  getPassByRegistration
);

// GET /api/tickets/my - View own passes (Student or Admin, MUST be declared before /:id)
router.get(
  '/my',
  authenticateToken,
  requireRole('STUDENT', 'EVENTADMIN'),
  getMyTickets
);

// GET /api/tickets/admin - EventAdmin only (MUST be declared before /:id)
router.get(
  '/admin',
  authenticateToken,
  requireRole('EVENTADMIN'),
  getAdminTickets
);

// POST /api/tickets - Generate digital ticket (Student or Admin)
router.post(
  '/',
  authenticateToken,
  requireRole('STUDENT', 'EVENTADMIN'),
  createTicket
);

// GET /api/tickets/:id/qr - Secure QR code stream (Student owner or EventAdmin)
router.get(
  '/:id/qr',
  authenticateToken,
  getTicketQrImage
);

// GET /api/tickets/:id - Single ticket details (Student owner or EventAdmin)
router.get(
  '/:id',
  authenticateToken,
  getTicketById
);

module.exports = router;
