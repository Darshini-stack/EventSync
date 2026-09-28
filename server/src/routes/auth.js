const express = require('express');
const {
  register,
  adminRegister,
  login,
  adminLogin,
  getMe,
  updateProfile,
  logout,
} = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public Authentication Endpoints
router.post('/register', register);
router.post('/admin/register', adminRegister);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/logout', logout);

// Protected Identity & Profile Endpoint
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);

// Role Test Endpoint (For verifying 403 Forbidden against non-admin callers)
router.get(
  '/admin-only-test',
  authenticateToken,
  requireRole('EVENTADMIN'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Access granted: You have verified EventAdmin privileges.',
      user: req.user.toJSON(),
    });
  }
);

module.exports = router;
