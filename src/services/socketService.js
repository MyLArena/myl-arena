import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(roomCode, action = 'join', onConnectError) {
    if (this.socket) {
      this.disconnect();
    }

    const normalizedRoomCode = roomCode.toUpperCase();

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      query: { roomCode: normalizedRoomCode, action } 
    });

    this.socket.on('connect_error', (err) => {
      console.error("Error de conexión con el Relay Server:", err);
      if (onConnectError) onConnectError(err);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.off(event);
      this.socket.on(event, callback);
    }
  }

  off(event) {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export const socketService = new SocketService();