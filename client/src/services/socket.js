import { io } from 'socket.io-client';

let socket = null;

export const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  return envUrl || 'http://localhost:5000';
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

