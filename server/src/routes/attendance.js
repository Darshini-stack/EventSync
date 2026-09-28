const express = require('express');
const {
  checkInTicket,
  getAdminAttendance,
  markAttendance,
  markAllAttendance,
  scanDigitalPass,
  getMyAttendance,
} = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/attendance/admin - EventAdmin only
router.get(
  '/admin',
  authenticateToken,
  requireRole('EVENTADMIN'),
  getAdminAttendance
);

// POST /api/attendance/mark - EventAdmin only (Mark Present / Absent)
router.post(
  '/mark',
  authenticateToken,
  requireRole('EVENTADMIN'),
  markAttendance
);

// POST /api/attendance/mark-all - EventAdmin only (Bulk Mark All Present / Absent)
router.post(
  '/mark-all',
  authenticateToken,
  requireRole('EVENTADMIN'),
  markAllAttendance
);

// POST /api/attendance/scan-pass - EventAdmin only (Identify attendee from QR without auto-marking)
router.post(
  '/scan-pass',
  authenticateToken,
  requireRole('EVENTADMIN'),
  scanDigitalPass
);

// POST /api/attendance/check-in - EventAdmin only (Direct check-in test compatibility)
router.post(
  '/check-in',
  authenticateToken,
  requireRole('EVENTADMIN'),
  checkInTicket
);

// POST /api/attendance/scan-ticket - EventAdmin only (Event-specific ticket scanner)
router.post(
  '/scan-ticket',
  authenticateToken,
  requireRole('EVENTADMIN'),
  checkInTicket
);

// POST /api/attendance/verify-ticket - EventAdmin only (Manual ticket pass code verification)
router.post(
  '/verify-ticket',
  authenticateToken,
  requireRole('EVENTADMIN'),
  checkInTicket
);

// GET /api/attendance/my - Student only
router.get(
  '/my',
  authenticateToken,
  requireRole('STUDENT'),
  getMyAttendance
);

module.exports = router;
