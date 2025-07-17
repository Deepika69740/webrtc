// const express = require('express');
// const WebSocket = require('ws');
// const { v4: uuidv4 } = require('uuid');
// const path = require('path');

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Enhanced configuration
// const config = {
//   maxRooms: 100,
//   maxClientsPerRoom: 2,
//   iceServers: [
//     { urls: 'stun:stun.l.google.com:19302' },
//     { urls: 'stun:stun1.l.google.com:19302' }
//   ]
// };

// // Serve static files from client directory
// app.use(express.static(path.join(__dirname, '../client')));

// // Create HTTP server
// const server = app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// // Create WebSocket server with ping/pong
// const wss = new WebSocket.Server({
//   server,
//   clientTracking: true,
//   perMessageDeflate: false
// });

// const rooms = new Map(); // roomId -> Set of clients
// const clientRooms = new WeakMap(); // ws -> roomId

// // Connection heartbeat
// function heartbeat() {
//   this.isAlive = true;
// }

// wss.on('connection', (ws) => {
//   console.log('New client connected');
//   ws.isAlive = true;
//   ws.on('pong', heartbeat);

//   ws.on('message', (message) => {
//     try {
//       const data = JSON.parse(message);
      
//       // Validate message structure
//       if (!data.type) {
//         throw new Error('Missing message type');
//       }

//       switch (data.type) {
//         case 'create-room':
//           handleCreateRoom(ws);
//           break;
//         case 'join-room':
//           if (!data.roomId) throw new Error('Missing roomId');
//           handleJoinRoom(ws, data.roomId);
//           break;
//         case 'offer':
//         case 'answer':
//         case 'candidate':
//           if (!data.roomId) throw new Error('Missing roomId');
//           forwardMessage(data);
//           break;
//         case 'leave-room':
//           if (!data.roomId) throw new Error('Missing roomId');
//           handleLeaveRoom(ws, data.roomId);
//           break;
//         case 'ping':
//           ws.send(JSON.stringify({ type: 'pong' }));
//           break;
//         default:
//           throw new Error(`Unknown message type: ${data.type}`);
//       }
//     } catch (error) {
//       console.error('Message handling error:', error);
//       ws.send(JSON.stringify({ 
//         type: 'error', 
//         message: error.message || 'Invalid message format'
//       }));
//     }
//   });

//   ws.on('close', () => {
//     console.log('Client disconnected');
//     const roomId = clientRooms.get(ws);
//     if (roomId) {
//       handleLeaveRoom(ws, roomId);
//     }
//   });

//   // Send configuration to client
//   ws.send(JSON.stringify({
//     type: 'config',
//     iceServers: config.iceServers
//   }));
// });

// // Health check interval
// const interval = setInterval(() => {
//   wss.clients.forEach((ws) => {
//     if (ws.isAlive === false) {
//       console.log('Terminating dead connection');
//       return ws.terminate();
//     }
//     ws.isAlive = false;
//     ws.ping(() => {});
//   });
// }, 30000);

// wss.on('close', () => {
//   clearInterval(interval);
// });

// // Room management
// function handleCreateRoom(ws) {
//   if (rooms.size >= config.maxRooms) {
//     return ws.send(JSON.stringify({
//       type: 'error',
//       message: 'Maximum rooms reached'
//     }));
//   }

//   const roomId = uuidv4();
//   rooms.set(roomId, new Set([ws]));
//   clientRooms.set(ws, roomId);
  
//   ws.send(JSON.stringify({ 
//     type: 'room-created', 
//     roomId,
//     config: { iceServers: config.iceServers }
//   }));
  
//   console.log(`Room created: ${roomId} (Total rooms: ${rooms.size})`);
// }

// function handleJoinRoom(ws, roomId) {
//   const room = rooms.get(roomId);
  
//   if (!room) {
//     return ws.send(JSON.stringify({ 
//       type: 'error', 
//       message: 'Room not found' 
//     }));
//   }
  
//   if (room.size >= config.maxClientsPerRoom) {
//     return ws.send(JSON.stringify({ 
//       type: 'error', 
//       message: 'Room is full' 
//     }));
//   }

//   // Check if client is already in a room
//   if (clientRooms.get(ws)) {
//     return ws.send(JSON.stringify({
//       type: 'error',
//       message: 'You are already in a room'
//     }));
//   }

//   room.add(ws);
//   clientRooms.set(ws, roomId);
  
//   ws.send(JSON.stringify({ 
//     type: 'room-joined', 
//     roomId,
//     config: { iceServers: config.iceServers }
//   }));
  
//   // Notify other clients in the room
//   const otherClients = Array.from(room).filter(client => client !== ws);
//   otherClients.forEach(client => {
//     if (client.readyState === WebSocket.OPEN) {
//       client.send(JSON.stringify({ 
//         type: 'peer-joined',
//         roomId
//       }));
//     }
//   });
  
//   console.log(`Client joined room: ${roomId} (Occupancy: ${room.size}/${config.maxClientsPerRoom})`);
// }

// function handleLeaveRoom(ws, roomId) {
//   const room = rooms.get(roomId);
//   if (!room) return;

//   room.delete(ws);
//   clientRooms.delete(ws);
  
//   // Notify remaining clients
//   if (room.size > 0) {
//     room.forEach(client => {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send(JSON.stringify({ 
//           type: 'peer-left',
//           roomId
//         }));
//       }
//     });
//   } else {
//     rooms.delete(roomId);
//   }
  
//   console.log(`Client left room: ${roomId} (Remaining: ${room.size || 0})`);
// }

// function forwardMessage(data) {
//   const room = rooms.get(data.roomId);
//   if (!room) return;

//   const sender = data.sender; // Should be set by client
//   const recipients = Array.from(room).filter(client => 
//     client !== sender && client.readyState === WebSocket.OPEN
//   );

//   // Add sequence number for debugging
//   const seq = Date.now();
//   const message = { ...data, _seq: seq };

//   recipients.forEach(client => {
//     try {
//       client.send(JSON.stringify(message));
//     } catch (error) {
//       console.error('Failed to forward message:', error);
//     }
//   });
// }

// // Error handling
// process.on('uncaughtException', (err) => {
//   console.error('Uncaught Exception:', err);
// });

// process.on('unhandledRejection', (reason, promise) => {
//   console.error('Unhandled Rejection at:', promise, 'reason:', reason);
// });

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
  
  // Notify other client
  const [otherClient] = [...room].filter(client => client !== ws);
  otherClient?.send(JSON.stringify({ type: 'peer-joined' }));
}

function handleLeaveRoom(ws, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(ws);
  clientRooms.delete(ws);
  
  // Notify remaining client
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