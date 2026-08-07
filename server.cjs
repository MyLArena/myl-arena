const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- 1. SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND ---
app.use(express.static(path.join(__dirname, 'dist')));

// Registro en memoria de las salas creadas oficialmente
const activeRooms = new Set();

// Endpoint HTTP para verificar existencia de sala antes de conectar sockets
app.get('/api/check-room/:code', (req, res) => {
  const roomCode = req.params.code.toUpperCase();
  const exists = activeRooms.has(roomCode);
  res.json({ exists });
});

io.on('connection', (socket) => {
  const rawRoomCode = socket.handshake.query.roomCode;
  const roomCode = rawRoomCode ? rawRoomCode.toUpperCase() : null;
  const action = socket.handshake.query.action;

  if (!roomCode) {
    socket.disconnect();
    return;
  }

  if (action === 'create') {
    activeRooms.add(roomCode);
    socket.join(roomCode);
    console.log(`Sala CREADA oficialmente: ${roomCode}. Salas activas:`, Array.from(activeRooms));
  } else if (action === 'join') {
    if (activeRooms.has(roomCode)) {
      socket.join(roomCode);
      console.log(`Jugador se UNIÓ con éxito a la sala existente: ${roomCode}`);
      socket.to(roomCode).emit('request_sync');
    } else {
      console.log(`Intento de unión RECHAZADO: la sala ${roomCode} no existe.`);
      socket.emit('room_error', 'La sala introducida no existe o ha expirado.');
      socket.disconnect();
      return;
    }
  }

  // --- SINCRONIZACIÓN DE MESA Y LOGS ---
  socket.on('playerJoined', (deck) => {
    socket.to(roomCode).emit('playerJoined', deck);
  });

  socket.on('syncBoard', (state) => {
    socket.to(roomCode).emit('syncBoard', state);
  });

  socket.on('syncLog', (msg) => {
    socket.to(roomCode).emit('syncLog', msg);
  });

  // --- SINCRONIZACIÓN DE INTERACCIONES Y PING ---
  socket.on('ping', (data) => {
    socket.to(roomCode).emit('ping', data);
  });

  // --- SINCRONIZACIÓN DE MANO REVELADA ---
  socket.on('syncReveal', (isRevealed) => {
    socket.to(roomCode).emit('syncReveal', isRevealed);
  });

  // --- SINCRONIZACIÓN DE CARTAS MOSTRADAS DEL MAZO ---
  socket.on('syncRevealedTop', (modalState) => {
    socket.to(roomCode).emit('syncRevealedTop', modalState);
  });

  socket.on('closeRevealedTop', () => {
    socket.to(roomCode).emit('closeRevealedTop');
  });

  // --- SINCRONIZACIÓN DE CALCULADORA ---
  socket.on('syncCalcLocal', (calcData) => {
    socket.to(roomCode).emit('syncCalcLocal', calcData);
  });

  socket.on('disconnect', () => {
    console.log(`Usuario desconectado de la sala ${roomCode}: ${socket.id}`);
    
    // Tiempo de gracia para evitar borrados accidentales por StrictMode o F5
    setTimeout(() => {
      const room = io.sockets.adapter.rooms.get(roomCode);
      if (!room || room.size === 0) {
        activeRooms.delete(roomCode);
        console.log(`Sala ${roomCode} eliminada por estar vacía de forma permanente.`);
      }
    }, 15000); 
  });
});

// --- 2. RUTA COMODÍN CON EXPRESIÓN REGULAR (Solución definitiva para SPA) ---
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- 3. CONFIGURACIÓN DEL PUERTO PARA RENDER ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor corriendo con validación de salas activas en el puerto ${PORT}`);
});