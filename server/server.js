const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../client')));
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const wss = new WebSocket.Server({ server });
const rooms = new Map();
const clientRooms = new WeakMap();

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'create-room': handleCreateRoom(ws); break;
        case 'join-room': handleJoinRoom(ws, data.roomId); break;
        case 'offer':
        case 'answer':
        case 'candidate': forwardMessage(data); break;
        case 'leave-room': handleLeaveRoom(ws, data.roomId); break;
        default: throw new Error(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    const roomId = clientRooms.get(ws);
    roomId && handleLeaveRoom(ws, roomId);
  });
});

function handleCreateRoom(ws) {
  const roomId = uuidv4();
  rooms.set(roomId, new Set([ws]));
  clientRooms.set(ws, roomId);
  
  ws.send(JSON.stringify({ 
    type: 'room-created', 
    roomId 
  }));
}

function handleJoinRoom(ws, roomId) {
  const room = rooms.get(roomId);
  
  if (!room) {
    return ws.send(JSON.stringify({
      type: 'error',
      message: 'Room not found'
    }));
  }
  
  if (room.size >= 2) {
    return ws.send(JSON.stringify({
      type: 'error',
      message: 'Room is full'
    }));
  }

  room.add(ws);
  clientRooms.set(ws, roomId);
  
  ws.send(JSON.stringify({ 
    type: 'room-joined', 
    roomId 
  }));
  
  const [otherClient] = [...room].filter(client => client !== ws);
  otherClient?.send(JSON.stringify({ type: 'peer-joined' }));
}

function handleLeaveRoom(ws, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(ws);
  clientRooms.delete(ws);
  
  const [remainingClient] = [...room];
  remainingClient?.send(JSON.stringify({ type: 'peer-left' }));
  
  if (room.size === 0) rooms.delete(roomId);
}

function forwardMessage(data) {
  const room = rooms.get(data.roomId);
  if (!room) return;

  const sender = data.sender;
  const recipient = [...room].find(client => client !== sender);
  
  recipient?.send(JSON.stringify(data));
}