const express = require('express');
const {
  createPayment,
  getMyPayments,
  getAdminPayments,
  getPaymentById,
  getPaymentProof,
  approvePayment,
  rejectPayment,
} = require('../controllers/paymentController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Wrap upload middleware to handle multer errors gracefully
const handleUpload = (req, res, next) => {
  upload.single('proof')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Proof file size exceeds 5MB limit.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    }
    next();
  });
};

// GET /api/payments/my - Student only (MUST be declared before /:id)
router.get(
  '/my',
  authenticateToken,
  requireRole('STUDENT'),
  getMyPayments
);

// GET /api/payments/admin - EventAdmin only (MUST be declared before /:id)
router.get(
  '/admin',
  authenticateToken,
  requireRole('EVENTADMIN'),
  getAdminPayments
);

// POST /api/payments - Submit payment proof (Student only)
router.post(
  '/',
  authenticateToken,
  requireRole('STUDENT'),
  handleUpload,
  createPayment
);

// GET /api/payments/:id/proof - Secure proof streaming (Student owner or EventAdmin)
router.get(
  '/:id/proof',
  authenticateToken,
  getPaymentProof
);

// PUT /api/payments/:id/approve - Approve payment (EventAdmin only)
router.put(
  '/:id/approve',
  authenticateToken,
  requireRole('EVENTADMIN'),
  approvePayment
);

// PUT /api/payments/:id/reject - Reject payment with reason (EventAdmin only)
router.put(
  '/:id/reject',
  authenticateToken,
  requireRole('EVENTADMIN'),
  rejectPayment
);

// PATCH /api/payments/:id/verify - Generic verify endpoint (EventAdmin only)
router.patch(
  '/:id/verify',
  authenticateToken,
  requireRole('EVENTADMIN'),
  (req, res, next) => {
    const { status } = req.body;
    if (status === 'APPROVED') {
      return approvePayment(req, res, next);
    } else if (status === 'REJECTED') {
      return rejectPayment(req, res, next);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be APPROVED or REJECTED.',
      });
    }
  }
);

// GET /api/payments/:id - Single payment detail (Student owner or EventAdmin)
router.get(
  '/:id',
  authenticateToken,
  getPaymentById
);

module.exports = router;
