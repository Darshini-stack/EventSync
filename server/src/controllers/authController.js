const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');

// Helper to generate JWT token with standard expiration
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
};

/**
 * POST /api/auth/register
/**
 * POST /api/auth/register
 * Registration endpoint. Defaults strictly to STUDENT role.
 * If client attempts to register with role EVENTADMIN/ADMIN, requires valid ADMIN_ACCESS_CODE.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, confirmPassword, role, accessCode, studentId, department, year } = req.body;

    // 1. Required field validation
    if (!name || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, phone, password, confirmPassword) are required.',
      });
    }

    // 2. Password mismatch check
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    // 3. Password length requirement
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // 4. Role determination and security check:
    // If client attempts to register as an Admin, enforce strict server-side accessCode verification.
    let userRole = 'STUDENT';
    const requestedRole = (role || '').toUpperCase();
    if (requestedRole === 'EVENTADMIN' || requestedRole === 'ADMIN') {
      if (!accessCode || accessCode.trim() !== config.adminAccessCode) {
        return res.status(401).json({
          success: false,
          message: 'Invalid EventAdmin Access Code. Access denied.',
        });
      }
      userRole = 'EVENTADMIN';
    }

    // 5. Email normalization
    const normalizedEmail = email.toLowerCase().trim();

    // 6. Duplicate email check
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // 7. Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 8. Create User document with strictly verified role
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash,
      role: userRole,
      studentId: studentId ? studentId.trim() : undefined,
      department: department ? department.trim() : undefined,
      year: year ? year.trim() : undefined,
    });

    // 9. Generate JWT token
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: `${userRole === 'EVENTADMIN' ? 'EventAdmin' : 'Student'} registered successfully.`,
      token,
      user: newUser.toJSON(),
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
 * POST /api/auth/admin/register
 * Dedicated EventAdmin Registration (Requires valid ADMIN_ACCESS_CODE from backend environment)
 */
const adminRegister = async (req, res, next) => {
  try {
    const { name, email, phone, password, confirmPassword, accessCode } = req.body;

    if (!name || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, phone, password, confirmPassword) are required.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Strictly validate access code on backend against process.env.ADMIN_ACCESS_CODE
    if (!accessCode || accessCode.trim() !== config.adminAccessCode) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or missing EventAdmin Access Code. Access denied.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newAdmin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash,
      role: 'EVENTADMIN',
    });

    const token = generateToken(newAdmin);

    return res.status(201).json({
      success: true,
      message: 'EventAdmin registered successfully.',
      token,
      user: newAdmin.toJSON(),
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
 * POST /api/auth/login
 * Student & General User Login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by normalized email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Verify password hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/admin/login
 * EventAdmin Login (Requires valid ADMIN_ACCESS_CODE from backend environment)
 */
const adminLogin = async (req, res, next) => {
  try {
    const { email, password, accessCode } = req.body;

    if (!email || !password || !accessCode) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and EventAdmin Access Code are required.',
      });
    }

    // 1. Strictly validate accessCode against backend environment secret
    if (accessCode.trim() !== config.adminAccessCode) {
      return res.status(401).json({
        success: false,
        message: 'Invalid EventAdmin Access Code. Access denied.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Check if user already exists
    let adminUser = await User.findOne({ email: normalizedEmail });

    if (adminUser) {
      // If user exists but is a student, prevent unauthorized privilege escalation
      if (adminUser.role !== 'EVENTADMIN') {
        return res.status(403).json({
          success: false,
          message: 'This account is registered as a Student. Access to EventAdmin portal is forbidden.',
        });
      }

      // Verify password
      const isMatch = await adminUser.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }
    } else {
      // If accessCode is valid and organizer account doesn't exist yet, securely provision EVENTADMIN
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      adminUser = await User.create({
        name: 'EventAdmin',
        email: normalizedEmail,
        phone: '000-000-0000',
        passwordHash,
        role: 'EVENTADMIN',
      });
    }

    // 3. Issue JWT with role EVENTADMIN
    const token = generateToken(adminUser);

    return res.status(200).json({
      success: true,
      message: 'EventAdmin authenticated successfully.',
      token,
      user: adminUser.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Returns authenticated user profile safely from live MongoDB
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user.toJSON(),
  });
};

/**
 * PUT /api/auth/profile
 * Updates authenticated user's academic profile (name, phone, studentId, department, year).
 * Email, role, and password cannot be altered through this endpoint.
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, studentId, department, year } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (name && name.trim()) user.name = name.trim();
    if (phone && phone.trim()) user.phone = phone.trim();
    if (studentId !== undefined) user.studentId = (studentId || '').trim();
    if (department !== undefined) user.department = (department || '').trim();
    if (year !== undefined) user.year = (year || '').trim();

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: user.toJSON(),
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
 * POST /api/auth/logout
 * Stateless token logout acknowledgment
 */
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

module.exports = {
  register,
  adminRegister,
  login,
  adminLogin,
  getMe,
  updateProfile,
  logout,
};
