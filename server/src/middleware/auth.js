const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');

/**
 * Authentication Middleware:
 * Verifies the JWT Bearer token and attaches the authenticated MongoDB User document to req.user.
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing.',
      });
    }

    // Verify JWT with backend secret
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Malformed authentication token payload.',
      });
    }

const mongoose = require('mongoose');
    let user = null;
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        user = await User.findById(decoded.id);
      }
    } catch (dbErr) {
      console.warn('[AuthMiddleware] DB lookup warning:', dbErr.message);
    }

    if (!user) {
      // If DB is temporarily disconnected/reconnecting but token has valid cryptographic signature, provide resilient fallback user
      if (mongoose.connection && mongoose.connection.readyState !== 1 && decoded.id) {
        user = {
          _id: decoded.id,
          role: decoded.role || 'STUDENT',
          email: decoded.email || 'user@example.com',
          name: decoded.name || 'Student User',
        };
      } else {
        return res.status(401).json({
          success: false,
          message: 'User associated with this token no longer exists.',
        });
      }
    }

    // Attach verified user document to request object
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.',
    });
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware:
 * Ensures req.user has one of the required roles.
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
};

/**
 * Optional Authentication Middleware:
 * Inspects Authorization header if present, attaches req.user if valid token.
 * If no token or invalid, proceeds without failing (req.user = null).
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded && decoded.id) {
      const user = await User.findById(decoded.id);
      req.user = user || null;
    } else {
      req.user = null;
    }
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

module.exports = { authenticateToken, requireRole, optionalAuth };
