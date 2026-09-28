const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./env');

// Configure Node.js DNS resolver with Google Public DNS to reliably resolve
// MongoDB Atlas SRV records and avoid querySrv ECONNREFUSED issues on restrictive networks.
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (dnsErr) {
  console.warn('[MongoDB] Failed to configure custom DNS servers:', dnsErr.message);
}

let isConnected = false;

const connectDB = async () => {
  try {
    try {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
    } catch (dnsErr) {
      console.warn('[MongoDB] Failed to set DNS servers before connecting:', dnsErr.message);
    }

    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`);

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
    console.error(`[MongoDB] Initial connection error: ${error.message}`);
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
