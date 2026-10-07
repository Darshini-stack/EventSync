import { io } from 'socket.io-client';

let socket = null;

export const getSocketUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    const { hostname, port } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isPrivateLan = /(^127\.)|(^10\.)|(^172\.(1[6-9]|2[0-9]|3[0-1])\.)|(^192\.168\.)/.test(hostname);
    const isDevServer = port === '5173' || port === '5174' || Boolean(import.meta.env.DEV);

    if (isLocalhost || isPrivateLan || isDevServer) {
      return window.location.origin;
    }
  }

  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname.endsWith('vercel.app')) {
      return 'https://eventsync-fn5p.onrender.com';
    }
    return window.location.origin;
  }

  return envUrl || 'https://eventsync-fn5p.onrender.com';
};

export const initSocket = () => {
  if (socket) return socket;

  const url = getSocketUrl();
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('eventsync_token') : null;
  console.log(`[Socket.IO Client] Initializing connection to: ${url}`);

  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 10000,
    auth: {
      token: token || undefined,
    },
  });

  socket.on('connect', () => {
    const currentToken = typeof localStorage !== 'undefined' ? localStorage.getItem('eventsync_token') : null;
    if (currentToken) {
      socket.emit('authenticate', { token: currentToken });
    }
  });

  return socket;
};

export const authenticateSocket = (token) => {
  const s = getSocket();
  if (s && token) {
    s.emit('authenticate', { token });
  }
};

export const logoutSocket = () => {
  if (socket) {
    socket.emit('logout');
  }
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

