// // DOM elements
// const createRoomBtn = document.getElementById('createRoomBtn');
// const joinRoomBtn = document.getElementById('joinRoomBtn');
// const roomIdInput = document.getElementById('roomIdInput');
// const localVideo = document.getElementById('localVideo');
// const remoteVideo = document.getElementById('remoteVideo');
// const statusDiv = document.getElementById('status');
// const toggleVideoBtn = document.getElementById('toggleVideoBtn');
// const toggleAudioBtn = document.getElementById('toggleAudioBtn');
// const leaveRoomBtn = document.getElementById('leaveRoomBtn');

// // Global variables
// let localStream;
// let remoteStream;
// let peerConnection;
// let socket;
// let roomId;
// let isVideoOn = true;
// let isAudioOn = true;
// let isMakingOffer = false;
// let isIgnoringOffer = false;

// // Initialize the app
// init();

// function init() {
//   // Set up event listeners
//   createRoomBtn.addEventListener('click', createRoom);
//   joinRoomBtn.addEventListener('click', joinRoom);
//   toggleVideoBtn.addEventListener('click', toggleVideo);
//   toggleAudioBtn.addEventListener('click', toggleAudio);
//   leaveRoomBtn.addEventListener('click', leaveRoom);
  
//   // Connect to signaling server
//   connectToSignalingServer();
// }

// function connectToSignalingServer() {
//   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//   const host = window.location.host;
//   socket = new WebSocket(`${protocol}//${host}/ws`);
  
//   socket.onopen = () => {
//     updateStatus('Connected to signaling server', 'success');
//   };
  
//   socket.onclose = () => {
//     updateStatus('Disconnected from signaling server', 'error');
//     // Attempt reconnection
//     setTimeout(connectToSignalingServer, 2000);
//   };
  
//   socket.onerror = (error) => {
//     console.error('WebSocket error:', error);
//     updateStatus('Signaling server error', 'error');
//   };
  
//   socket.onmessage = async (event) => {
//     try {
//       const data = JSON.parse(event.data);
      
//       switch (data.type) {
//         case 'room-created':
//           handleRoomCreated(data.roomId);
//           break;
//         case 'room-joined':
//           handleRoomJoined(data.roomId);
//           break;
//         case 'peer-joined':
//           handlePeerJoined();
//           break;
//         case 'peer-left':
//           handlePeerLeft();
//           break;
//         case 'offer':
//           await handleOffer(data);
//           break;
//         case 'answer':
//           await handleAnswer(data);
//           break;
//         case 'candidate':
//           await handleCandidate(data);
//           break;
//         case 'error':
//           updateStatus(data.message, 'error');
//           break;
//         case 'ping':
//           socket.send(JSON.stringify({ type: 'pong' }));
//           break;
//         default:
//           console.warn('Unknown message type:', data.type);
//       }
//     } catch (error) {
//       console.error('Error processing message:', error);
//     }
//   };
// }

// async function createRoom() {
//   try {
//     await getLocalStream();
//     socket.send(JSON.stringify({ type: 'create-room' }));
//   } catch (error) {
//     console.error('Error creating room:', error);
//     updateStatus('Error creating room: ' + error.message, 'error');
//   }
// }

// async function joinRoom() {
//   const roomId = roomIdInput.value.trim();
//   if (!roomId) {
//     updateStatus('Please enter a room ID', 'error');
//     return;
//   }
  
//   try {
//     await getLocalStream();
//     socket.send(JSON.stringify({ type: 'join-room', roomId }));
//   } catch (error) {
//     console.error('Error joining room:', error);
//     updateStatus('Error joining room: ' + error.message, 'error');
//   }
// }

// async function getLocalStream() {
//   try {
//     localStream = await navigator.mediaDevices.getUserMedia({ 
//       video: true, 
//       audio: true 
//     });
//     localVideo.srcObject = localStream;
//     return localStream;
//   } catch (error) {
//     console.error('Error getting user media:', error);
//     updateStatus('Error accessing camera/microphone: ' + error.message, 'error');
//     throw error;
//   }
// }

// function handleRoomCreated(newRoomId) {
//   roomId = newRoomId;
//   updateStatus(`Room created. Room ID: ${roomId}`, 'success');
//   roomIdInput.value = roomId;
//   toggleRoomControls(true);
// }

// function handleRoomJoined(joinedRoomId) {
//   roomId = joinedRoomId;
//   updateStatus(`Joined room: ${roomId}`, 'success');
//   toggleRoomControls(true);
// }

// function handlePeerJoined() {
//   updateStatus('Peer joined the room', 'info');
//   createPeerConnection();
// }

// function handlePeerLeft() {
//   updateStatus('Peer left the room', 'info');
//   if (peerConnection) {
//     peerConnection.close();
//     peerConnection = null;
//   }
//   remoteVideo.srcObject = null;
// }

// function toggleRoomControls(inRoom) {
//   createRoomBtn.disabled = inRoom;
//   joinRoomBtn.disabled = inRoom;
//   roomIdInput.disabled = inRoom;
//   leaveRoomBtn.disabled = !inRoom;
// }

// function createPeerConnection() {
//   if (peerConnection) return;
  
//   peerConnection = new RTCPeerConnection({
//     iceServers: [
//       { urls: 'stun:stun.l.google.com:19302' },
//       { urls: 'stun:stun1.l.google.com:19302' },
//       { urls: 'stun:stun2.l.google.com:19302' }
//     ]
//   });
  
//   // Add local stream to peer connection
//   localStream.getTracks().forEach(track => {
//     peerConnection.addTrack(track, localStream);
//   });
  
//   // ICE Candidate handling
//   peerConnection.onicecandidate = ({ candidate }) => {
//     if (candidate) {
//       socket.send(JSON.stringify({
//         type: 'candidate',
//         candidate,
//         roomId
//       }));
//     }
//   };
  
//   // Track handling
//   peerConnection.ontrack = ({ streams: [stream] }) => {
//     remoteVideo.srcObject = stream;
//   };
  
//   // Connection state handling
//   peerConnection.onconnectionstatechange = () => {
//     switch (peerConnection.connectionState) {
//       case 'disconnected':
//       case 'failed':
//         updateStatus('Connection lost', 'error');
//         break;
//       case 'connected':
//         updateStatus('Connection established', 'success');
//         break;
//     }
//   };
  
//   // Negotiation handling
//   peerConnection.onnegotiationneeded = async () => {
//     try {
//       isMakingOffer = true;
//       await peerConnection.setLocalDescription();
//       socket.send(JSON.stringify({
//         type: 'offer',
//         offer: peerConnection.localDescription,
//         roomId
//       }));
//     } catch (err) {
//       console.error('Negotiation error:', err);
//     } finally {
//       isMakingOffer = false;
//     }
//   };
// }

// async function handleOffer({ offer }) {
//   if (!peerConnection) createPeerConnection();
  
//   try {
//     const offerCollision = (
//       peerConnection.signalingState !== 'stable' ||
//       isMakingOffer
//     );
    
//     isIgnoringOffer = !roomIdInput.value && offerCollision;
//     if (isIgnoringOffer) return;
    
//     await peerConnection.setRemoteDescription(offer);
//     await peerConnection.setLocalDescription();
//     socket.send(JSON.stringify({
//       type: 'answer',
//       answer: peerConnection.localDescription,
//       roomId
//     }));
//   } catch (err) {
//     console.error('Offer handling error:', err);
//   }
// }

// async function handleAnswer({ answer }) {
//   try {
//     await peerConnection.setRemoteDescription(answer);
//   } catch (err) {
//     console.error('Answer handling error:', err);
//   }
// }

// async function handleCandidate({ candidate }) {
//   try {
//     if (isIgnoringOffer) return;
//     await peerConnection.addIceCandidate(candidate);
//   } catch (err) {
//     if (!isIgnoringOffer) {
//       console.error('Candidate handling error:', err);
//     }
//   }
// }

// function toggleVideo() {
//   if (localStream) {
//     const videoTrack = localStream.getVideoTracks()[0];
//     if (videoTrack) {
//       videoTrack.enabled = !videoTrack.enabled;
//       isVideoOn = videoTrack.enabled;
//       toggleVideoBtn.textContent = isVideoOn ? 'Turn Video Off' : 'Turn Video On';
//     }
//   }
// }

// function toggleAudio() {
//   if (localStream) {
//     const audioTrack = localStream.getAudioTracks()[0];
//     if (audioTrack) {
//       audioTrack.enabled = !audioTrack.enabled;
//       isAudioOn = audioTrack.enabled;
//       toggleAudioBtn.textContent = isAudioOn ? 'Turn Audio Off' : 'Turn Audio On';
//     }
//   }
// }

// function leaveRoom() {
//   if (peerConnection) {
//     peerConnection.close();
//     peerConnection = null;
//   }
  
//   if (localStream) {
//     localStream.getTracks().forEach(track => track.stop());
//     localVideo.srcObject = null;
//     localStream = null;
//   }
  
//   if (remoteVideo.srcObject) {
//     remoteVideo.srcObject.getTracks().forEach(track => track.stop());
//     remoteVideo.srcObject = null;
//   }
  
//   if (socket && roomId) {
//     socket.send(JSON.stringify({ type: 'leave-room', roomId }));
//   }
  
//   roomId = null;
//   toggleRoomControls(false);
//   updateStatus('Left the room', 'info');
// }

// function updateStatus(message, type) {
//   statusDiv.textContent = message;
//   statusDiv.className = 'status ' + (type || 'info');
// }

// // Handle page unload
// window.addEventListener('beforeunload', leaveRoom);
// DOM elements
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const statusDiv = document.getElementById('status');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const toggleAudioBtn = document.getElementById('toggleAudioBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

// Global variables
let localStream;
let remoteStream;
let peerConnection;
let socket;
let roomId;
let isVideoOn = true;
let isAudioOn = true;
let isMakingOffer = false;

// Initialize the app
init();

function init() {
  setupEventListeners();
  connectToSignalingServer();
}

function setupEventListeners() {
  createRoomBtn.addEventListener('click', createRoom);
  joinRoomBtn.addEventListener('click', joinRoom);
  toggleVideoBtn.addEventListener('click', toggleVideo);
  toggleAudioBtn.addEventListener('click', toggleAudio);
  leaveRoomBtn.addEventListener('click', leaveRoom);
}

function connectToSignalingServer() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  socket = new WebSocket(`${protocol}//${host}/ws`);
  
  socket.onopen = () => updateStatus('Connected to signaling server', 'success');
  socket.onclose = () => updateStatus('Disconnected - reconnecting...', 'error');
  socket.onerror = (error) => console.error('WebSocket error:', error);
  
  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'room-created': handleRoomCreated(data.roomId); break;
        case 'room-joined': handleRoomJoined(data.roomId); break;
        case 'peer-joined': handlePeerJoined(); break;
        case 'peer-left': handlePeerLeft(); break;
        case 'offer': await handleOffer(data); break;
        case 'answer': await handleAnswer(data); break;
        case 'candidate': await handleCandidate(data); break;
        case 'error': updateStatus(data.message, 'error'); break;
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  };
}

async function createRoom() {
  try {
    await getLocalStream();
    socket.send(JSON.stringify({ type: 'create-room' }));
  } catch (error) {
    handleError('Error creating room:', error);
  }
}

async function joinRoom() {
  const roomId = roomIdInput.value.trim();
  if (!roomId) {
    updateStatus('Please enter a room ID', 'error');
    return;
  }
  
  try {
    await getLocalStream();
    socket.send(JSON.stringify({ type: 'join-room', roomId }));
  } catch (error) {
    handleError('Error joining room:', error);
  }
}

async function getLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    localVideo.srcObject = localStream;
  } catch (error) {
    handleError('Error accessing media devices:', error);
    throw error;
  }
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  // Add local tracks
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // ICE Candidate handling
  peerConnection.onicecandidate = ({ candidate }) => {
    candidate && socket.send(JSON.stringify({
      type: 'candidate',
      candidate,
      roomId
    }));
  };

  // Remote stream handling
  peerConnection.ontrack = ({ streams: [stream] }) => {
    remoteVideo.srcObject = stream;
  };

  // Negotiation handling
  peerConnection.onnegotiationneeded = async () => {
    try {
      isMakingOffer = true;
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.send(JSON.stringify({
        type: 'offer',
        offer: peerConnection.localDescription,
        roomId
      }));
    } catch (err) {
      console.error('Negotiation error:', err);
    } finally {
      isMakingOffer = false;
    }
  };
}

async function handleOffer({ offer }) {
  try {
    if (!peerConnection) createPeerConnection();
    
    const offerCollision = (peerConnection.signalingState !== "stable");
    if (offerCollision) {
      await Promise.all([
        peerConnection.setLocalDescription({ type: "rollback" }),
        peerConnection.setRemoteDescription(offer)
      ]);
    } else {
      await peerConnection.setRemoteDescription(offer);
    }

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({
      type: 'answer',
      answer: peerConnection.localDescription,
      roomId
    }));
  } catch (err) {
    console.error('Offer handling error:', err);
  }
}

async function handleAnswer({ answer }) {
  try {
    await peerConnection.setRemoteDescription(answer);
  } catch (err) {
    console.error('Answer handling error:', err);
  }
}

async function handleCandidate({ candidate }) {
  try {
    await peerConnection.addIceCandidate(candidate);
  } catch (err) {
    console.error('Candidate error:', err);
  }
}

// UI Functions
function toggleVideo() {
  const videoTrack = localStream?.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    isVideoOn = videoTrack.enabled;
    toggleVideoBtn.textContent = isVideoOn ? 'Turn Video Off' : 'Turn Video On';
  }
}

function toggleAudio() {
  const audioTrack = localStream?.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    isAudioOn = audioTrack.enabled;
    toggleAudioBtn.textContent = isAudioOn ? 'Turn Audio Off' : 'Turn Audio On';
  }
}

function leaveRoom() {
  if (peerConnection) peerConnection.close();
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  if (remoteVideo.srcObject) remoteVideo.srcObject.getTracks().forEach(track => track.stop());
  
  socket?.send(JSON.stringify({ type: 'leave-room', roomId }));
  
  resetState();
  updateStatus('Left the room', 'info');
}

function resetState() {
  peerConnection = null;
  localStream = null;
  remoteVideo.srcObject = null;
  roomId = null;
  toggleRoomControls(false);
}

function toggleRoomControls(inRoom) {
  createRoomBtn.disabled = inRoom;
  joinRoomBtn.disabled = inRoom;
  roomIdInput.disabled = inRoom;
  leaveRoomBtn.disabled = !inRoom;
}

function updateStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type || 'info'}`;
}

function handleError(context, error) {
  console.error(context, error);
  updateStatus(`${context.split(':')[0]}: ${error.message}`, 'error');
}

// Cleanup on page exit
window.addEventListener('beforeunload', leaveRoom);