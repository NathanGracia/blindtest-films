import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    console.log('[socket] initializing client');
    socket = io({
      autoConnect: true,
      // Prefer WebSocket transport in production to avoid xhr polling errors behind some proxies
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('[socket] connected', socket?.id);
    });

    socket.on('connect_error', (err) => {
      console.error('[socket] connect_error', err);
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
