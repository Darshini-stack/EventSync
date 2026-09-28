const express = require('express');
const {
  getAdminCertificates,
  updateCertificateStatus,
  confirmCertificateReceipt,
  getMyCertificates,
} = require('../controllers/certificateController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/certificates/admin - EventAdmin only
router.get(
  '/admin',
  authenticateToken,
  requireRole('EVENTADMIN'),
  getAdminCertificates
);

// PATCH /api/certificates/status - EventAdmin only
router.patch(
  '/status',
  authenticateToken,
  requireRole('EVENTADMIN'),
  updateCertificateStatus
);

// POST /api/certificates/confirm-receipt - Student only
router.post(
  '/confirm-receipt',
  authenticateToken,
  requireRole('STUDENT'),
  confirmCertificateReceipt
);

// GET /api/certificates/my - Student only
router.get(
  '/my',
  authenticateToken,
  requireRole('STUDENT'),
  getMyCertificates
);

module.exports = router;
