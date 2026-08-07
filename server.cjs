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

// Almacenamiento robusto de salas, mazos y estados en memoria del servidor
const roomsData = new Map(); // roomCode -> { decks: Map(socketId -> deck), boardState: null }

// Endpoint HTTP para verificar existencia de sala antes de conectar sockets
app.get('/api/check-room/:code', (req, res) => {
  const roomCode = req.params.code.toUpperCase();
  const exists = roomsData.has(roomCode);
  res.json({ exists });
});

// Endpoint HTTP para registrar la sala de inmediato al seleccionarla
app.post('/api/create-room', (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Código requerido' });
  }
  const roomCode = code.toUpperCase();
  if (!roomsData.has(roomCode)) {
    roomsData.set(roomCode, { decks: new Map(), boardState: null });
  }
  console.log(`Sala CREADA por HTTP: ${roomCode}. Salas activas:`, Array.from(roomsData.keys()));
  res.json({ success: true, roomCode });
});

io.on('connection', (socket) => {
  const rawRoomCode = socket.handshake.query.roomCode;
  const roomCode = rawRoomCode ? rawRoomCode.toUpperCase() : null;
  const action = socket.handshake.query.action;

  if (!roomCode) {
    socket.disconnect();
    return;
  }

  socket.join(roomCode);

  if (!roomsData.has(roomCode)) {
    roomsData.set(roomCode, { decks: new Map(), boardState: null });
  }
  const roomInfo = roomsData.get(roomCode);

  if (action === 'create') {
    console.log(`Sala CREADA vía Socket: ${roomCode} (${socket.id})`);
  } else if (action === 'join') {
    console.log(`Jugador se UNIÓ vía Socket: ${roomCode} (${socket.id})`);
    
    // SINCRONIZACIÓN AUTOMÁTICA: Si ya hay mazos en la sala, enviárselos al recién llegado
    for (const [otherSocketId, otherDeck] of roomInfo.decks.entries()) {
      if (otherSocketId !== socket.id) {
        socket.emit('playerJoined', otherDeck);
      }
    }
    if (roomInfo.boardState) {
      socket.emit('syncBoard', roomInfo.boardState);
    }

    socket.to(roomCode).emit('request_sync');
  }

  // --- SINCRONIZACIÓN DE MESA Y LOGS ---
  socket.on('playerJoined', (deck) => {
    roomInfo.decks.set(socket.id, deck);
    console.log(`Jugador ${socket.id} envió su mazo en sala ${roomCode}`);
    socket.to(roomCode).emit('playerJoined', deck);
  });

  socket.on('syncBoard', (state) => {
    roomInfo.boardState = state;
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
    if (roomInfo) {
      roomInfo.decks.delete(socket.id);
    }
    
    setTimeout(() => {
      const room = io.sockets.adapter.rooms.get(roomCode);
      if (!room || room.size === 0) {
        roomsData.delete(roomCode);
        console.log(`Sala ${roomCode} eliminada por estar vacía.`);
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
  console.log(`Servidor corriendo con sincronización robusta en el puerto ${PORT}`);
});