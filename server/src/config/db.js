const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./env');

// Only override DNS resolver in local development if explicitly requested or on local Windows machines
if (!process.env.RENDER && config.nodeEnv !== 'production') {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
  } catch (dnsErr) {
    console.warn('[MongoDB] Failed to configure custom DNS servers:', dnsErr.message);
  }
}

// Disable Mongoose command buffering so queries fail-fast when MongoDB is unavailable
// instead of hanging/buffering indefinitely.
mongoose.set('bufferCommands', false);

let isConnected = false;

const connectDB = async () => {
  const tryConnect = async (uri, isFallback = false) => {
    return await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
  };

  try {
    let conn;
    try {
      conn = await tryConnect(config.mongoUri);
    } catch (primaryErr) {
      const isProduction = process.env.RENDER || config.nodeEnv === 'production';
      const localUri = 'mongodb://127.0.0.1:27017/eventsync';
      if (!isProduction && config.mongoUri !== localUri) {
        console.warn(`[MongoDB] Primary connection failed (${primaryErr.message}). Attempting fallback to local MongoDB: ${localUri}`);
        conn = await tryConnect(localUri, true);
      } else {
        throw primaryErr;
      }
    }

    isConnected = true;
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`);
    console.log(`[MongoDB Diagnostic] mongoose.connection.readyState: ${mongoose.connection.readyState}`);

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err.message);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected from database.');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Reconnected to database.');
      isConnected = true;
    });

    return conn;
  } catch (error) {
    console.error(`[MongoDB] Fatal connection error: ${error.message}`);
    isConnected = false;
    // We do not exit process immediately in development so health-check can report database error
    return null;
  }
};

const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const stateCode = mongoose.connection.readyState;
  return {
    state: states[stateCode] || 'unknown',
    isConnected: stateCode === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
};

module.exports = { connectDB, getDBStatus };
