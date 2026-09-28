const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const registrationRoutes = require('./routes/registrations');
const paymentRoutes = require('./routes/payments');
const ticketRoutes = require('./routes/tickets');
const attendanceRoutes = require('./routes/attendance');
const certificateRoutes = require('./routes/certificates');
const notificationRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Flexible CORS for Local Development and LAN / Mobile Testing
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isPrivateLan = /(https?:\/\/)(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);

    if (isLocalhost || isPrivateLan || origin === config.clientUrl) {
      return callback(null, true);
    }

    if (config.nodeEnv === 'development') {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// HTTP Request Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root Greeting / API Information Route
app.get('/', (req, res) => {
  res.json({
    name: 'EventSync API',
    version: '1.0.0',
    description: 'Smart Event Management, Payment Verification, QR Attendance & AI Assistant',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      events: '/api/events',
      registrations: '/api/registrations',
      payments: '/api/payments',
      tickets: '/api/tickets',
      attendance: '/api/attendance',
    },
  });
});

// Mount Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

// Centralized 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
