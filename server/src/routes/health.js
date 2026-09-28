const express = require('express');
const { getDBStatus } = require('../config/db');
const { getSocketStats } = require('../sockets');
const { getLocalIpAddress } = require('../utils/network');
const config = require('../config/env');

const router = express.Router();

// GET /api/health - Comprehensive system health diagnostic endpoint
router.get('/', (req, res) => {
  const dbStatus = getDBStatus();
  const socketStats = getSocketStats();
  const uptimeSeconds = Math.floor(process.uptime());
  const lanIp = getLocalIpAddress();

  const isHealthy = dbStatus.isConnected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    apiVersion: 'v1',
    message: isHealthy 
      ? 'EventSync backend services operational' 
      : 'EventSync services running with degraded dependencies',
    timestamp: new Date().toISOString(),
    uptime: uptimeSeconds,
    environment: config.nodeEnv,
    server: {
      port: config.port,
      host: config.host,
      pid: process.pid,
      nodeVersion: process.version,
    },
    network: {
      localUrl: `http://localhost:${config.port}`,
      lanIp: lanIp || null,
      lanUrl: lanIp ? `http://${lanIp}:${config.port}` : null,
    },
    database: {
      type: 'MongoDB',
      status: dbStatus.state,
      isConnected: dbStatus.isConnected,
      host: dbStatus.host,
      databaseName: dbStatus.name,
    },
    socket: {
      initialized: socketStats.isInitialized,
      connectedClients: socketStats.connectedClients,
    },
  });
});

module.exports = router;
