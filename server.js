import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

const PORT = process.env.PORT || 3000;
const TICK_RATE = 30;
const MAX_ROOM_PLAYERS = 6;
const ADMIN_PASSWORD = 'solarmax';

const rooms = new Map();
const socketToRoom = new Map();
let adminSocketId = null;

function nowTick(startEpochMs) {
    return Math.max(0, Math.floor((Date.now() - startEpochMs) / (1000 / TICK_RATE)));
}

function isAdmin(socketId) {
    return adminSocketId === socketId;
}

function emitAdminState(socketId) {
    io.to(socketId).emit('adminState', {
        isAdmin: isAdmin(socketId),
        adminOnline: !!adminSocketId,
    });
}

function emitAdminStateAll() {
    for (const [id] of io.of('/').sockets) {
        emitAdminState(id);
    }
}

function roomSnapshot(room, socketId) {
    const votes = room.startVotes || new Set();
    const readyCount = room.players.reduce((sum, p) => sum + (votes.has(p.socketId) ? 1 : 0), 0);
    return {
        code: room.code,
        hostId: room.hostId,
        isHost: room.hostId === socketId,
        started: room.started,
        maxPlayers: room.maxPlayers,
        readyCount,
        allReady: room.players.length > 0 && readyCount === room.players.length,
        players: room.players.map(p => ({
            socketId: p.socketId,
            name: p.name,
            index: p.index,
            ready: votes.has(p.socketId),
        })),
        config: room.config,
    };
}

function emitRoomState(room) {
    for (const p of room.players) {
        io.to(p.socketId).emit('roomState', roomSnapshot(room, p.socketId));
    }
}

function publicRoomList() {
    const list = [];
    for (const room of rooms.values()) {
        if (room.started) continue;
        if (room.players.length >= room.maxPlayers) continue;
        const host = room.players.find(p => p.socketId === room.hostId);
        list.push({
            code: room.code,
            hostName: host ? host.name : 'Host',
            players: room.players.length,
            maxPlayers: room.maxPlayers,
            difficulty: String(room.config?.difficulty || 'normal'),
            nodeCount: Number(room.config?.nodeCount || 16),
            fogEnabled: !!room.config?.fogEnabled,
            createdAt: Number(room.createdAt || 0),
        });
    }
    list.sort((a, b) => (a.createdAt - b.createdAt) || a.code.localeCompare(b.code));
    return list;
}

function emitLobbyState(socketId) {
    const payload = { rooms: publicRoomList(), adminOnline: !!adminSocketId };
    if (socketId) {
        io.to(socketId).emit('lobbyState', payload);
        return;
    }
    io.emit('lobbyState', payload);
}

function makeRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function createUniqueRoomCode() {
    for (let i = 0; i < 20; i++) {
        const code = makeRoomCode();
        if (!rooms.has(code)) return code;
    }
    return `${Math.floor(Math.random() * 900000 + 100000)}`;
}

function startRoomMatch(room) {
    if (room.started) return;
    if (room.players.length < 2) return;

    room.started = true;
    room.startedAt = Date.now();

    const players = room.players.map(p => ({ socketId: p.socketId, name: p.name, index: p.index }));
    io.to(room.code).emit('matchStarted', {
        roomCode: room.code,
        seed: room.config.seed,
        nodeCount: room.config.nodeCount,
        difficulty: room.config.difficulty,
        fogEnabled: room.config.fogEnabled,
        humanCount: room.players.length,
        aiCount: 0,
        players,
    });
    emitLobbyState();
}

function maybeStartMatch(room) {
    if (room.started) return;
    if (room.players.length < 2) return;
    for (const p of room.players) {
        if (!room.startVotes?.has(p.socketId)) return;
    }
    startRoomMatch(room);
}

function cleanupPlayer(socketId) {
    const code = socketToRoom.get(socketId);
    if (!code) return;
    const room = rooms.get(code);
    socketToRoom.delete(socketId);
    if (!room) return;

    if (room.startVotes) room.startVotes.delete(socketId);
    room.players = room.players.filter(p => p.socketId !== socketId);
    if (room.players.length === 0) {
        rooms.delete(code);
        emitLobbyState();
        return;
    }

    if (room.hostId === socketId) {
        room.hostId = room.players[0].socketId;
    }

    if (room.started) {
        io.to(code).emit('roomClosed', { message: 'A player disconnected. Room closed.' });
        rooms.delete(code);
        for (const p of room.players) socketToRoom.delete(p.socketId);
        emitLobbyState();
        return;
    }

    // Reassign contiguous indices.
    room.players.forEach((p, idx) => { p.index = idx; });
    maybeStartMatch(room);
    if (!room.started) emitRoomState(room);
    emitLobbyState();
}

app.use(express.static(__dirname));
app.get('/healthz', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
});

io.on('connection', (socket) => {
    socket.emit('connected', { socketId: socket.id });
    emitAdminState(socket.id);
    emitLobbyState(socket.id);

    socket.on('adminLogin', (payload = {}) => {
        const password = String(payload.password || '');
        if (password !== ADMIN_PASSWORD) {
            socket.emit('adminError', { message: 'Wrong admin password.' });
            emitAdminState(socket.id);
            return;
        }
        if (adminSocketId && adminSocketId !== socket.id) {
            socket.emit('adminError', { message: 'Admin is already active on another connection.' });
            emitAdminState(socket.id);
            return;
        }
        adminSocketId = socket.id;
        socket.emit('adminAuthOk', { message: 'Admin authenticated.' });
        emitAdminStateAll();
        emitLobbyState();
    });

    socket.on('adminLogout', () => {
        if (!isAdmin(socket.id)) return;
        adminSocketId = null;
        emitAdminStateAll();
        emitLobbyState();
    });

    socket.on('createRoom', (payload = {}) => {
        if (!isAdmin(socket.id)) {
            socket.emit('roomError', { message: 'Only admin can create room.' });
            emitLobbyState(socket.id);
            return;
        }
        cleanupPlayer(socket.id);

        const maxPlayersRaw = Number(payload.maxPlayers);
        const maxPlayers = Number.isFinite(maxPlayersRaw)
            ? Math.max(2, Math.min(MAX_ROOM_PLAYERS, Math.floor(maxPlayersRaw)))
            : 4;

        const code = createUniqueRoomCode();
        const room = {
            code,
            hostId: socket.id,
            createdAt: Date.now(),
            maxPlayers,
            started: false,
            startedAt: 0,
            startVotes: new Set(),
            players: [
                {
                    socketId: socket.id,
                    name: String(payload.playerName || 'Player').slice(0, 20),
                    index: 0,
                },
            ],
            config: {
                seed: String(payload.seed || '42'),
                nodeCount: Number(payload.nodeCount || 16),
                difficulty: String(payload.difficulty || 'normal'),
                fogEnabled: payload.fogEnabled === true,
            },
        };
        rooms.set(code, room);
        socketToRoom.set(socket.id, code);
        socket.join(code);
        emitRoomState(room);
        emitLobbyState();
    });

    socket.on('joinRoom', (payload = {}) => {
        cleanupPlayer(socket.id);

        const code = String(payload.code || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
            socket.emit('roomError', { message: 'Room not found.' });
            return;
        }
        if (room.started) {
            socket.emit('roomError', { message: 'Room already started.' });
            return;
        }
        if (room.players.length >= room.maxPlayers) {
            socket.emit('roomError', { message: 'Room is full.' });
            return;
        }

        const player = {
            socketId: socket.id,
            name: String(payload.playerName || 'Player').slice(0, 20),
            index: room.players.length,
        };
        room.players.push(player);
        if (!room.startVotes) room.startVotes = new Set();
        room.startVotes.delete(socket.id);
        socketToRoom.set(socket.id, code);
        socket.join(code);
        emitRoomState(room);
        emitLobbyState();
    });

    socket.on('leaveRoom', () => {
        cleanupPlayer(socket.id);
    });

    socket.on('setStartVote', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || room.started) return;

        if (!room.startVotes) room.startVotes = new Set();
        const ready = payload.ready !== false;
        if (ready) room.startVotes.add(socket.id);
        else room.startVotes.delete(socket.id);

        maybeStartMatch(room);
        if (!room.started) emitRoomState(room);
        emitLobbyState();
    });

    socket.on('requestLobby', () => {
        emitLobbyState(socket.id);
    });

    socket.on('startMatch', (payload = {}) => {
        // Backward-compatible: treat as "ready" signal.
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || room.started) return;

        if (isAdmin(socket.id)) {
            room.config.seed = String(payload.seed || room.config.seed || '42');
            room.config.nodeCount = Number(payload.nodeCount || room.config.nodeCount || 16);
            room.config.difficulty = String(payload.difficulty || room.config.difficulty || 'normal');
            room.config.fogEnabled = payload.fogEnabled !== undefined ? !!payload.fogEnabled : room.config.fogEnabled;
        }
        if (!room.startVotes) room.startVotes = new Set();
        room.startVotes.add(socket.id);
        maybeStartMatch(room);
        if (!room.started) emitRoomState(room);
        emitLobbyState();
    });

    socket.on('playerCommand', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        const type = String(payload.type || '');
        if (!type) return;
        const tick = nowTick(room.startedAt);
        const command = {
            playerIndex: player.index,
            tick,
            type,
            data: payload.data || {},
        };
        io.to(code).emit('roomCommand', command);
    });

    socket.on('disconnect', () => {
        cleanupPlayer(socket.id);
        if (isAdmin(socket.id)) {
            adminSocketId = null;
            emitAdminStateAll();
            emitLobbyState();
        }
    });
});

server.listen(PORT, () => {
    console.log(`Stellar server listening on http://localhost:${PORT}`);
});
