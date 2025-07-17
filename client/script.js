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

// Initialize the app
init();

function init() {
  // Set up event listeners
  createRoomBtn.addEventListener('click', createRoom);
  joinRoomBtn.addEventListener('click', joinRoom);
  toggleVideoBtn.addEventListener('click', toggleVideo);
  toggleAudioBtn.addEventListener('click', toggleAudio);
  leaveRoomBtn.addEventListener('click', leaveRoom);
  
  // Connect to signaling server
  connectToSignalingServer();
}

function connectToSignalingServer() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  socket = new WebSocket(`${protocol}//${host}/ws`);
  
  socket.onopen = () => {
    updateStatus('Connected to signaling server', 'success');
  };
  
  socket.onclose = () => {
    updateStatus('Disconnected from signaling server', 'error');
  };
  
  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'room-created':
        handleRoomCreated(data.roomId);
        break;
      case 'room-joined':
        handleRoomJoined(data.roomId);
        break;
      case 'peer-joined':
        handlePeerJoined();
        break;
      case 'peer-left':
        handlePeerLeft();
        break;
      case 'offer':
        await handleOffer(data);
        break;
      case 'answer':
        await handleAnswer(data);
        break;
      case 'candidate':
        await handleCandidate(data);
        break;
      case 'error':
        updateStatus(data.message, 'error');
        break;
    }
  };
}

async function createRoom() {
  try {
    await getLocalStream();
    socket.send(JSON.stringify({ type: 'create-room' }));
  } catch (error) {
    console.error('Error creating room:', error);
    updateStatus('Error creating room: ' + error.message, 'error');
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
    console.error('Error joining room:', error);
    updateStatus('Error joining room: ' + error.message, 'error');
  }
}

async function getLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    return localStream;
  } catch (error) {
    console.error('Error getting user media:', error);
    updateStatus('Error accessing camera/microphone: ' + error.message, 'error');
    throw error;
  }
}

function handleRoomCreated(newRoomId) {
  roomId = newRoomId;
  updateStatus(`Room created. Room ID: ${roomId}`, 'success');
  roomIdInput.value = roomId;
  toggleRoomControls(true);
}

function handleRoomJoined(joinedRoomId) {
  roomId = joinedRoomId;
  updateStatus(`Joined room: ${roomId}`, 'success');
  toggleRoomControls(true);
}

function handlePeerJoined() {
  updateStatus('Peer joined the room', 'info');
  createPeerConnection();
}

function handlePeerLeft() {
  updateStatus('Peer left the room', 'info');
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
}

function toggleRoomControls(inRoom) {
  createRoomBtn.disabled = inRoom;
  joinRoomBtn.disabled = inRoom;
  roomIdInput.disabled = inRoom;
  leaveRoomBtn.disabled = !inRoom;
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      // You may want to add your own TURN server here for better reliability
    ]
  });
  
  // Add local stream to peer connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
  
  // Set up event handlers
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({
        type: 'candidate',
        candidate: event.candidate,
        roomId: roomId
      }));
    }
  };
  
  peerConnection.ontrack = (event) => {
    if (!remoteVideo.srcObject) {
      remoteStream = new MediaStream();
      remoteVideo.srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
  };
  
  peerConnection.oniceconnectionstatechange = () => {
    if (peerConnection.iceConnectionState === 'disconnected') {
      updateStatus('Peer disconnected', 'error');
    }
  };
  
  // For the creator of the room, create an offer
  if (roomId === roomIdInput.value) {
    createOffer();
  }
}

async function createOffer() {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.send(JSON.stringify({
      type: 'offer',
      offer: offer,
      roomId: roomId
    }));
  } catch (error) {
    console.error('Error creating offer:', error);
    updateStatus('Error creating offer: ' + error.message, 'error');
  }
}

async function handleOffer(data) {
  if (!peerConnection) {
    createPeerConnection();
  }
  
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    socket.send(JSON.stringify({
      type: 'answer',
      answer: answer,
      roomId: roomId
    }));
  } catch (error) {
    console.error('Error handling offer:', error);
    updateStatus('Error handling offer: ' + error.message, 'error');
  }
}

async function handleAnswer(data) {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  } catch (error) {
    console.error('Error handling answer:', error);
    updateStatus('Error handling answer: ' + error.message, 'error');
  }
}

async function handleCandidate(data) {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
    updateStatus('Error handling ICE candidate: ' + error.message, 'error');
  }
}

function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isVideoOn = videoTrack.enabled;
      toggleVideoBtn.textContent = isVideoOn ? 'Turn Video Off' : 'Turn Video On';
    }
  }
}

function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isAudioOn = audioTrack.enabled;
      toggleAudioBtn.textContent = isAudioOn ? 'Turn Audio Off' : 'Turn Audio On';
    }
  }
}

function leaveRoom() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    localStream = null;
  }
  
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
    remoteStream = null;
  }
  
  if (socket && roomId) {
    socket.send(JSON.stringify({ type: 'leave-room', roomId }));
  }
  
  roomId = null;
  toggleRoomControls(false);
  updateStatus('Left the room', 'info');
}

function updateStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + (type || 'info');
}