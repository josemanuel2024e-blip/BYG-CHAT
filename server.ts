import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface ClientSocket {
  ws: WebSocket;
  userId: string;
  userName: string;
  avatar: string;
}

interface StoredUser {
  id: string; // username slug or user_id
  username: string;
  passwordHash: string; // stored credentials
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  bio: string;
  fingerprint: string;
  xaonId: string;
  createdAt: number;
}

interface StoredRoom {
  id: string;
  name: string;
  type: 'direct' | 'group';
  participants: string[]; // user IDs
  unreadCount: number;
  isEncrypted: boolean;
  fingerprint: string;
  avatar: string;
  createdAt: number;
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// In-Memory Database Stores
const usersStore = new Map<string, StoredUser>();
const roomsStore = new Map<string, StoredRoom>();
const roomMessages = new Map<string, any[]>();
const userTokens = new Map<string, string>(); // token -> userId

// Seed initial registered accounts
const seedUsers: StoredUser[] = [
  {
    id: 'maria_r',
    username: 'maria',
    passwordHash: '123456',
    name: 'María Rodríguez',
    avatar: '👩‍💻',
    status: 'online',
    bio: 'Desarrolladora Web & Apasionada de la Criptografía E2EE',
    fingerprint: '4F12:88AA:99CD:33FE:1100:5544',
    xaonId: 'MA12-RD88',
    createdAt: Date.now() - 100000,
  },
  {
    id: 'carlos_m',
    username: 'carlos',
    passwordHash: '123456',
    name: 'Carlos Mendoza',
    avatar: '👨‍💻',
    status: 'online',
    bio: 'Seguridad en Redes y Sistemas Distribuidos',
    fingerprint: '8801:BB44:2299:1100:8833:9911',
    xaonId: 'CA45-MZ99',
    createdAt: Date.now() - 80000,
  },
];

seedUsers.forEach((u) => usersStore.set(u.id, u));

// Initial room between seed users
const defaultRoom: StoredRoom = {
  id: 'room_general',
  name: 'Canal General BYG',
  type: 'group',
  participants: ['maria_r', 'carlos_m'],
  unreadCount: 0,
  isEncrypted: true,
  fingerprint: '990B:1102:4455:8877:6611:3322',
  avatar: '👥',
  createdAt: Date.now(),
};
roomsStore.set(defaultRoom.id, defaultRoom);

// Active user WebSockets
const connectedUsers = new Map<string, ClientSocket>();
const roomTypingUsers = new Map<string, Set<string>>(); // roomId -> Set of userIds

function broadcastTyping(roomId: string) {
  const typingUserIds = Array.from(roomTypingUsers.get(roomId) || []);
  const typingUserNames = typingUserIds.map(uid => usersStore.get(uid)?.name || 'Alguien');
  
  const payload = JSON.stringify({
    type: 'typing:update',
    payload: {
      roomId,
      users: typingUserNames
    }
  });

  const room = roomsStore.get(roomId);
  connectedUsers.forEach((client, uid) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!room || room.participants.includes(uid) || room.type === 'group') {
        client.ws.send(payload);
      }
    }
  });
}

function broadcastPresence() {
  const onlineList = Array.from(usersStore.values()).map((u) => ({
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    status: connectedUsers.has(u.id) ? 'online' : 'offline',
    fingerprint: u.fingerprint,
    xaonId: u.xaonId,
    bio: u.bio,
  }));

  const payload = JSON.stringify({
    type: 'presence:update',
    onlineUsers: onlineList,
  });

  connectedUsers.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });
}

// WebSocket connection logic
wss.on('connection', (ws: WebSocket) => {
  let currentUserId = '';

  ws.on('message', (data: string) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'user:join': {
          currentUserId = message.userId;
          connectedUsers.set(currentUserId, {
            ws,
            userId: message.userId,
            userName: message.userName || 'Usuario BYG',
            avatar: message.avatar || '',
          });

          // Update online status
          const existingUser = usersStore.get(currentUserId);
          if (existingUser) {
            existingUser.status = 'online';
          }

          broadcastPresence();
          break;
        }

        case 'message:send': {
          const msgData = message.payload;
          const roomId = msgData.receiverId;

          if (!roomMessages.has(roomId)) {
            roomMessages.set(roomId, []);
          }
          roomMessages.get(roomId)!.push(msgData);

          const outboundPayload = JSON.stringify({
            type: 'message:receive',
            payload: msgData,
          });

          // Relay to participants of this room
          const targetRoom = roomsStore.get(roomId);
          connectedUsers.forEach((client, uid) => {
            if (client.ws.readyState === WebSocket.OPEN) {
              // Send if participant in group/direct room or if broad broadcast
              if (!targetRoom || targetRoom.participants.includes(uid) || targetRoom.type === 'group') {
                client.ws.send(outboundPayload);
              }
            }
          });
          break;
        }

        case 'message:delete': {
          const { messageId, roomId } = message.payload;
          const outbound = JSON.stringify({
            type: 'message:delete',
            payload: { messageId, roomId },
          });

          // Relay to participants
          const targetRoom = roomsStore.get(roomId);
          connectedUsers.forEach((client, uid) => {
            if (uid !== currentUserId && client.ws.readyState === WebSocket.OPEN) {
              if (!targetRoom || targetRoom.participants.includes(uid) || targetRoom.type === 'group') {
                client.ws.send(outbound);
              }
            }
          });
          break;
        }

        case 'device:link': {
          const { uid, deviceName } = message.payload;
          console.log(`[AUTH] Linking new device "${deviceName}" for user ${uid}`);
          // In a real app, this would update a database. For now, we relay the success.
          const outbound = JSON.stringify({
            type: 'device:link_success',
            payload: { deviceName, timestamp: Date.now() },
          });
          const client = connectedUsers.get(uid);
          if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(outbound);
          }
          break;
        }

        case 'call:initiate':
        case 'call:accept':
        case 'call:reject':
        case 'call:end':
        case 'call:signal':
        case 'webrtc:offer':
        case 'webrtc:answer':
        case 'webrtc:ice-candidate': {
          const outbound = JSON.stringify({
            type: message.type,
            payload: message.payload,
            senderId: currentUserId,
          });

          // If target userId is specified (for WebRTC signaling), send only to them
          if (message.targetUserId) {
            const target = connectedUsers.get(message.targetUserId);
            if (target && target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(outbound);
            }
          } else {
            // Otherwise broadcast (for backward compatibility with the call system)
            connectedUsers.forEach((client, uid) => {
              if (uid !== currentUserId && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(outbound);
              }
            });
          }
          break;
        }

        case 'typing:start': {
          const { roomId } = message.payload;
          if (!roomTypingUsers.has(roomId)) {
            roomTypingUsers.set(roomId, new Set());
          }
          roomTypingUsers.get(roomId)!.add(currentUserId);
          broadcastTyping(roomId);
          break;
        }

        case 'typing:stop': {
          const { roomId } = message.payload;
          if (roomTypingUsers.has(roomId)) {
            roomTypingUsers.get(roomId)!.delete(currentUserId);
            broadcastTyping(roomId);
          }
          break;
        }
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });

  ws.on('close', () => {
    if (currentUserId) {
      connectedUsers.delete(currentUserId);
      const u = usersStore.get(currentUserId);
      if (u) u.status = 'offline';
      broadcastPresence();
    }
  });
});

// REST Authentication Endpoints
app.post('/api/auth/register', (req, res) => {
  const { username, password, name, avatar, bio } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ message: 'Usuario, contraseña y nombre son obligatorios.' });
  }

  const cleanUsername = username.toLowerCase().trim();
  const userId = cleanUsername.replace(/[^a-z0-9_]/g, '_');

  if (usersStore.has(userId)) {
    return res.status(400).json({ message: 'El nombre de usuario ya está registrado.' });
  }

  const hexRandom = Math.random().toString(36).substring(2, 10).toUpperCase();
  const fingerprint = `BYG:${hexRandom.slice(0, 4)}:${hexRandom.slice(4)}:2026:SAFE`;

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const getL = (n: number) => Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const getD = (n: number) => Array.from({ length: n }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
  const xaonId = `${getL(2)}${getD(2)}-${getL(2)}${getD(2)}`;

  const newUser: StoredUser = {
    id: userId,
    username: cleanUsername,
    passwordHash: password,
    name: name.trim(),
    avatar:
      avatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    status: 'online',
    bio: bio || 'Usuario de BYG CHAT',
    fingerprint,
    xaonId,
    createdAt: Date.now(),
  };

  usersStore.set(userId, newUser);

  // Auto-add user to general room
  const generalRoom = roomsStore.get('room_general');
  if (generalRoom && !generalRoom.participants.includes(userId)) {
    generalRoom.participants.push(userId);
  }

  const token = `byg_token_${userId}_${Date.now()}`;
  userTokens.set(token, userId);

  const { passwordHash, ...userPublic } = newUser;
  res.json({ token, user: userPublic });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
  }

  const cleanUsername = username.toLowerCase().trim();
  const userId = cleanUsername.replace(/[^a-z0-9_]/g, '_');

  const user = usersStore.get(userId);

  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
  }

  const token = `byg_token_${userId}_${Date.now()}`;
  userTokens.set(token, userId);

  const { passwordHash, ...userPublic } = user;
  res.json({ token, user: userPublic });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || (req.query.token as string);

  if (!token || !userTokens.has(token)) {
    return res.status(401).json({ message: 'Sesión no válida o expirada.' });
  }

  const userId = userTokens.get(token)!;
  const user = usersStore.get(userId);

  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado.' });
  }

  const { passwordHash, ...userPublic } = user;
  res.json(userPublic);
});

// Update User Profile Endpoint
app.put('/api/users/profile', (req, res) => {
  const { userId, name, avatar, bio, status } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'ID de usuario requerido.' });
  }

  const user = usersStore.get(userId);
  if (user) {
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;
    if (status) user.status = status;

    usersStore.set(userId, user);
    broadcastPresence();

    const { passwordHash, ...userPublic } = user;
    return res.json({ success: true, user: userPublic });
  }

  res.status(404).json({ message: 'Usuario no encontrado.' });
});

app.get('/api/users', (req, res) => {
  const allUsers = Array.from(usersStore.values()).map(({ passwordHash, ...u }) => ({
    ...u,
    status: connectedUsers.has(u.id) ? 'online' : 'offline',
  }));
  res.json(allUsers);
});

app.get('/api/rooms', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || (req.query.token as string);
  const userId = userTokens.get(token) || (req.query.userId as string);

  const allRooms = Array.from(roomsStore.values());

  if (userId) {
    const userRooms = allRooms.filter(
      (r) => r.participants.includes(userId) || r.type === 'group'
    );
    return res.json(userRooms);
  }

  res.json(allRooms);
});

// Create/get 1-on-1 direct room between users
app.post('/api/rooms/direct', (req, res) => {
  const { currentUserId, targetUserId } = req.body;

  if (!currentUserId || !targetUserId) {
    return res.status(400).json({ message: 'IDs de usuarios inválidos.' });
  }

  const targetUser = usersStore.get(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ message: 'El usuario no existe.' });
  }

  // Check existing direct room
  const existingRoom = Array.from(roomsStore.values()).find(
    (r) =>
      r.type === 'direct' &&
      r.participants.includes(currentUserId) &&
      r.participants.includes(targetUserId)
  );

  if (existingRoom) {
    return res.json(existingRoom);
  }

  // Create new direct room
  const roomId = `room_direct_${Date.now()}`;
  const newRoom: StoredRoom = {
    id: roomId,
    name: targetUser.name,
    type: 'direct',
    participants: [currentUserId, targetUserId],
    unreadCount: 0,
    isEncrypted: true,
    fingerprint: targetUser.fingerprint,
    avatar: targetUser.avatar,
    createdAt: Date.now(),
  };

  roomsStore.set(roomId, newRoom);
  res.json(newRoom);
});

// Create group room
app.post('/api/rooms/group', (req, res) => {
  const { name, creatorId, participantIds } = req.body;

  if (!name || !creatorId) {
    return res.status(400).json({ message: 'Nombre de grupo y creador son requeridos.' });
  }

  const participants = Array.from(new Set([creatorId, ...(participantIds || [])]));
  const roomId = `room_group_${Date.now()}`;
  const hexRandom = Math.random().toString(36).substring(2, 10).toUpperCase();

  const newRoom: StoredRoom = {
    id: roomId,
    name: name.trim(),
    type: 'group',
    participants,
    unreadCount: 0,
    isEncrypted: true,
    fingerprint: `GRP:${hexRandom}:E2EE:SAFE`,
    avatar: '👥',
    createdAt: Date.now(),
  };

  roomsStore.set(roomId, newRoom);
  res.json(newRoom);
});

app.get('/api/messages/:roomId', (req, res) => {
  const { roomId } = req.params;
  const messages = roomMessages.get(roomId) || [];
  res.json(messages);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BYG CHAT Engine', usersCount: usersStore.size });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BYG CHAT Server running on http://localhost:${PORT}`);
  });
}

startServer();
