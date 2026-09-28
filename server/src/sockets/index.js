const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

let io = null;
let activeConnections = 0;

const initSocket = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, postman)
        if (!origin) return callback(null, true);

        // Allow localhost, loopback, or private LAN IPs (10.*, 192.168.*, 172.16-31.*)
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
        const isPrivateLan = /(https?:\/\/)(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);

        if (isLocalhost || isPrivateLan || (allowedOrigins && allowedOrigins.includes(origin))) {
          return callback(null, true);
        }

        return callback(null, true); // Permissive for local dev network access
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    activeConnections += 1;
    const clientIp = socket.handshake.address;

    // 1. Initial Handshake Authentication via auth.token or Authorization header
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization && socket.handshake.headers.authorization.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.split(' ')[1]
        : null);

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        if (decoded && decoded.id) {
          socket.userId = decoded.id.toString();
          socket.join(`user:${socket.userId}`);
          console.log(`[Socket.IO] Authenticated socket ${socket.id} on handshake for user:${socket.userId}`);
        }
      } catch (err) {
        // Token invalid or expired - proceed as unauthenticated guest
      }
    }

    console.log(`[Socket.IO] Client connected: ${socket.id} (IP: ${clientIp}) | User: ${socket.userId || 'anonymous'} | Active: ${activeConnections}`);

    // Initial handshake confirmation
    socket.emit('connection_established', {
      socketId: socket.id,
      userId: socket.userId || null,
      timestamp: new Date().toISOString(),
      message: 'Connected to EventSync Real-time Gateway',
    });

    // 2. Dynamic client authentication (e.g. after login or token refresh)
    // CRITICAL SECURITY: Derives room strictly from signed JWT, rejecting spoofed IDs
    socket.on('authenticate', (authData) => {
      try {
        const authToken = typeof authData === 'string' ? authData : authData?.token;
        if (!authToken) {
          return socket.emit('authentication_error', { message: 'Authentication token missing.' });
        }

        const decoded = jwt.verify(authToken, config.jwtSecret);
        if (!decoded || !decoded.id) {
          return socket.emit('authentication_error', { message: 'Malformed token payload.' });
        }

        if (socket.userId && socket.userId !== decoded.id.toString()) {
          socket.leave(`user:${socket.userId}`);
        }

        socket.userId = decoded.id.toString();
        socket.join(`user:${socket.userId}`);

        socket.emit('authenticated', {
          success: true,
          userId: socket.userId,
          message: 'Successfully joined private user notification room',
        });
        console.log(`[Socket.IO] Authenticated socket ${socket.id} via event for user:${socket.userId}`);
      } catch (err) {
        socket.emit('authentication_error', { message: 'Invalid or expired authentication token.' });
      }
    });

    // 3. Client sign out / room departure
    socket.on('logout', () => {
      if (socket.userId) {
        socket.leave(`user:${socket.userId}`);
        console.log(`[Socket.IO] Socket ${socket.id} left user:${socket.userId} room upon logout`);
        socket.userId = null;
        socket.emit('logged_out', { success: true });
      }
    });

    // 4. Ping-Pong round trip latency check
    socket.on('client_ping', (data) => {
      const now = Date.now();
      socket.emit('server_pong', {
        clientTimestamp: data ? data.timestamp : null,
        serverTimestamp: now,
        message: 'pong',
      });
    });

    socket.on('disconnect', (reason) => {
      activeConnections = Math.max(0, activeConnections - 1);
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason}) | Active clients: ${activeConnections}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO is not initialized yet!');
  }
  return io;
};

const getSocketStats = () => {
  return {
    isInitialized: !!io,
    connectedClients: activeConnections,
  };
};

module.exports = { initSocket, getIO, getSocketStats };
