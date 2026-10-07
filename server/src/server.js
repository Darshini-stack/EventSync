const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { connectDB } = require('./config/db');
const { initSocket } = require('./sockets');
const { getLocalIpAddress } = require('./utils/network');
const { startReminderScheduler, stopReminderScheduler } = require('./services/reminderScheduler');

const startServer = async () => {
  // Connect to MongoDB
  console.log('[Server] Connecting to MongoDB...');
  await connectDB();

  // Create HTTP server
  const httpServer = http.createServer(app);

  // Initialize Socket.IO
  initSocket(httpServer, [config.clientUrl, config.publicAppUrl, 'https://event-sync-tan.vercel.app'].filter(Boolean));

  // Bind to 0.0.0.0 so both laptop and phones on Wi-Fi/LAN can connect
  httpServer.listen(config.port, config.host, () => {
    const lanIp = getLocalIpAddress();
    console.log('---------------------------------------------------------');
    console.log(`[EventSync Server] Running in ${config.nodeEnv.toUpperCase()} mode`);
    console.log(`Local Laptop URL:    http://localhost:${config.port}`);
    console.log(`Local Health Check:  http://localhost:${config.port}/api/health`);
    if (lanIp) {
      console.log(`Network LAN URL:     http://${lanIp}:${config.port}`);
      console.log(`Network LAN Health:  http://${lanIp}:${config.port}/api/health`);
    }
    console.log(`Network Listen Host: ${config.host}:${config.port}`);
    console.log('---------------------------------------------------------');

    // Start background event reminder worker
    startReminderScheduler();
  });

  // Graceful shutdown handling
  const shutdown = (signal) => {
    console.log(`\n[Server] Received ${signal}. Gracefully terminating...`);
    stopReminderScheduler();
    httpServer.close(() => {
      console.log('[Server] HTTP and WebSocket connections closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught Exception:', err);
  });
};

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
