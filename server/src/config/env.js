const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventsync',
  jwtSecret: process.env.JWT_SECRET,
  adminAccessCode: process.env.ADMIN_ACCESS_CODE,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  publicAppUrl: process.env.PUBLIC_APP_URL || null,
  almostFullThreshold: parseInt(process.env.NOTIFICATION_ALMOST_FULL_THRESHOLD, 10) || 5,
};

// Strict validation of required secrets
if (!config.jwtSecret || config.jwtSecret.trim() === '') {
  console.error('[FATAL] JWT_SECRET must be defined in server/.env');
  process.exit(1);
}

if (!config.adminAccessCode || config.adminAccessCode.trim() === '') {
  console.error('[FATAL] ADMIN_ACCESS_CODE must be defined in server/.env');
  process.exit(1);
}

module.exports = config;
