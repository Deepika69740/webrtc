const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

const rooms = new Map(); // roomId -> Set of clients

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case 'create-room':
        handleCreateRoom(ws);
        break;
      case 'join-room':
        handleJoinRoom(ws, data.roomId);
        break;
      case 'offer':
      case 'answer':
      case 'candidate':
        forwardMessage(data);
        break;
      case 'leave-room':
        handleLeaveRoom(ws, data.roomId);
        break;
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Clean up any rooms this client was in
    rooms.forEach((clients, roomId) => {
      if (clients.has(ws)) {
        clients.delete(ws);
        if (clients.size === 0) {
          rooms.delete(roomId);
        } else {
          // Notify remaining clients that peer left
          clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'peer-left' }));
            }
          });
        }
      }
    });
  });
});

function handleCreateRoom(ws) {
  const roomId = uuidv4();
  rooms.set(roomId, new Set([ws]));
  ws.send(JSON.stringify({ type: 'room-created', roomId }));
  console.log(`Room created: ${roomId}`);
}

function handleJoinRoom(ws, roomId) {
  const room = rooms.get(roomId);
  
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }
  
  if (room.size >= 2) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
    return;
  }
  
  room.add(ws);
  ws.send(JSON.stringify({ type: 'room-joined', roomId }));
  
  // Notify the other client that a peer has joined
  room.forEach(client => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'peer-joined' }));
    }
  });
  
  console.log(`Client joined room: ${roomId}`);
}

function handleLeaveRoom(ws, roomId) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
}

function forwardMessage(data) {
  const room = rooms.get(data.roomId);
  if (room) {
    room.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client !== data.sender) {
        client.send(JSON.stringify(data));
      }
    });
  }
}