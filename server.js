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
const DEFAULT_ROOM_CONFIG = {
    seed: '42',
    nodeCount: 16,
    difficulty: 'normal',
    fogEnabled: false,
};

const rooms = new Map();
const socketToRoom = new Map();
const leaderboard = [];
const EMOTES = ['gg', 'gl', 'hf', 'wp', 'oops', 'nice', 'wait'];

function nowTick(startEpochMs) {
    return Math.max(0, Math.floor((Date.now() - startEpochMs) / (1000 / TICK_RATE)));
}

function normalizeDifficulty(raw) {
    const value = String(raw || DEFAULT_ROOM_CONFIG.difficulty).toLowerCase();
    if (value === 'easy' || value === 'normal' || value === 'hard') return value;
    return DEFAULT_ROOM_CONFIG.difficulty;
}

function normalizeNodeCount(raw) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return DEFAULT_ROOM_CONFIG.nodeCount;
    return Math.max(8, Math.min(30, Math.floor(value)));
}

function normalizeRoomConfig(payload = {}) {
    return {
        seed: String(payload.seed || DEFAULT_ROOM_CONFIG.seed),
        nodeCount: normalizeNodeCount(payload.nodeCount),
        difficulty: normalizeDifficulty(payload.difficulty),
        fogEnabled: payload.fogEnabled === true,
    };
}

function sanitizePlayerName(name) {
    return String(name || '').trim().slice(0, 20);
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
        code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (rooms.has(code));
    return code;
}

function createRoom(configPayload = {}) {
    const code = generateRoomCode();
    const room = {
        code,
        hostId: '',
        createdAt: Date.now(),
        maxPlayers: MAX_ROOM_PLAYERS,
        started: false,
        startedAt: 0,
        players: [],
        config: normalizeRoomConfig(configPayload),
    };
    rooms.set(code, room);
    return room;
}

function getRoom(code) {
    if (!code) return null;
    return rooms.get(String(code).toUpperCase());
}

function roomSnapshot(room, socketId) {
    return {
        code: room.code,
        hostId: room.hostId,
        isHost: room.hostId === socketId,
        started: room.started,
        maxPlayers: room.maxPlayers,
        readyCount: 0,
        allReady: false,
        players: room.players.map(p => ({
            socketId: p.socketId,
            name: p.name,
            index: p.index,
            ready: false,
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
    for (const [code, room] of rooms.entries()) {
        if (!room.started && room.players.length < room.maxPlayers) {
            const host = room.players.find(p => p.socketId === room.hostId);
            list.push({
                code: room.code,
                hostName: host ? host.name : 'Host',
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                difficulty: String(room.config?.difficulty || DEFAULT_ROOM_CONFIG.difficulty),
                nodeCount: Number(room.config?.nodeCount || DEFAULT_ROOM_CONFIG.nodeCount),
                fogEnabled: !!room.config?.fogEnabled,
                createdAt: Number(room.createdAt || 0),
            });
        }
    }
    return list;
}

function emitLobbyState(socketId) {
    const payload = { rooms: publicRoomList() };
    if (socketId) {
        io.to(socketId).emit('lobbyState', payload);
        return;
    }
    io.emit('lobbyState', payload);
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

function requestStartMatch(socketId) {
    const code = socketToRoom.get(socketId);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.started) return;
    if (room.players.length < 2) {
        io.to(socketId).emit('roomError', { message: 'En az 2 oyuncu olmadan baslatamazsin.' });
        emitRoomState(room);
        return;
    }
    startRoomMatch(room);
}

function cleanupPlayer(socketId) {
    const code = socketToRoom.get(socketId);
    if (!code) return;
    const room = rooms.get(code);
    socketToRoom.delete(socketId);

    const socket = io.of('/').sockets.get(socketId);
    if (socket) socket.leave(code);
    if (!room) return;

    // We kept their info before filtering
    const leavingPlayer = room.players.find(p => p.socketId === socketId);

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
        if (leavingPlayer) {
            io.to(code).emit('playerLeft', { index: leavingPlayer.index, name: leavingPlayer.name });
        }
        return;
    }

    // Reassign contiguous indices.
    room.players.forEach((p, idx) => { p.index = idx; });
    emitRoomState(room);
    emitLobbyState();
}

app.use(express.static(__dirname));
app.get('/healthz', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
});

function joinSingleRoom(socket, payload = {}) {
    cleanupPlayer(socket.id);

    const playerName = sanitizePlayerName(payload.playerName);
    if (!playerName) {
        socket.emit('roomError', { message: 'Önce bir isim girin.' });
        emitLobbyState(socket.id);
        return;
    }

    let room = null;
    if (payload.action === 'create') {
        room = createRoom(payload);
        room.hostId = socket.id;
    } else if (payload.action === 'join') {
        room = getRoom(payload.roomCode);
        if (!room) {
            socket.emit('roomError', { message: 'Oda bulunamadı veya kod hatalı.' });
            emitLobbyState(socket.id);
            return;
        }
    } else {
        socket.emit('roomError', { message: 'Geçersiz oda işlemi.' });
        emitLobbyState(socket.id);
        return;
    }

    if (room.started) {
        socket.emit('roomError', { message: 'Bu odada oyun çoktan başlamış.' });
        emitLobbyState(socket.id);
        return;
    }
    if (room.players.length >= room.maxPlayers) {
        socket.emit('roomError', { message: 'Oda dolu!' });
        emitLobbyState(socket.id);
        return;
    }

    room.players.push({
        socketId: socket.id,
        name: playerName,
        index: room.players.length,
    });

    socketToRoom.set(socket.id, room.code);
    socket.join(room.code);
    emitRoomState(room);
    emitLobbyState();
}

io.on('connection', (socket) => {
    socket.emit('connected', { socketId: socket.id });
    emitLobbyState(socket.id);

    socket.on('createRoom', (payload = {}) => {
        joinSingleRoom(socket, payload);
    });

    socket.on('joinRoom', (payload = {}) => {
        joinSingleRoom(socket, payload);
    });

    socket.on('leaveRoom', () => {
        cleanupPlayer(socket.id);
    });

    socket.on('setStartVote', (payload = {}) => {
        if (payload.ready === false) return;
        requestStartMatch(socket.id);
    });

    socket.on('requestLobby', () => {
        emitLobbyState(socket.id);
    });

    socket.on('startMatch', (payload = {}) => {
        requestStartMatch(socket.id);
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

        let targetTick = Number(payload.tick);
        const serverCurrentTick = nowTick(room.startedAt);
        // İstemcinin ilettiği tick çok geçmişteyse sunucu anının 2 ilerisini kabul et
        if (isNaN(targetTick) || targetTick < serverCurrentTick) {
            targetTick = serverCurrentTick + 2;
        }

        const command = {
            playerIndex: player.index,
            tick: targetTick,
            type,
            data: payload.data || {},
        };
        io.to(code).emit('roomCommand', command);
    });

    socket.on('pingTick', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        socket.emit('pongTick', {
            clientTs: payload.clientTs,
            serverTick: nowTick(room.startedAt)
        });
    });

    socket.on('chat', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room) return;
        const player = room.players.find(p => p.socketId === socket.id);
        const msg = String(payload.message || '').trim().slice(0, 120);
        if (msg) io.to(code).emit('chat', { name: player ? player.name : '?', message: msg });
    });

    socket.on('emote', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const em = String(payload.emote || '').toLowerCase();
        if (EMOTES.includes(em)) {
            const room = rooms.get(code);
            const player = room ? room.players.find(p => p.socketId === socket.id) : null;
            io.to(code).emit('emote', { name: player ? player.name : '?', emote: em });
        }
    });

    socket.on('requestRematch', () => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        room.rematchVotes = room.rematchVotes || new Set();
        const player = room.players.find(p => p.socketId === socket.id);
        if (player) room.rematchVotes.add(socket.id);
        if (room.rematchVotes.size >= room.players.length && room.players.length >= 2) {
            room.started = false;
            room.startedAt = 0;
            room.rematchVotes = new Set();
            startRoomMatch(room);
        } else if (room.players.length >= 2) {
            io.to(code).emit('rematchVote', { name: player ? player.name : '?', count: room.rematchVotes.size, total: room.players.length });
        }
    });

    socket.on('reportResult', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        const player = room ? room.players.find(p => p.socketId === socket.id) : null;
        if (player && payload.winner !== undefined) {
            leaderboard.push({ name: player.name, wins: payload.winner ? 1 : 0, games: 1, ts: Date.now() });
            if (leaderboard.length > 100) leaderboard.shift();
        }
    });

    socket.on('requestLeaderboard', () => {
        const byName = {};
        leaderboard.forEach(e => {
            if (!byName[e.name]) byName[e.name] = { name: e.name, wins: 0, games: 0 };
            byName[e.name].wins += e.wins;
            byName[e.name].games += e.games;
        });
        const list = Object.values(byName).sort((a, b) => b.wins - a.wins).slice(0, 10);
        socket.emit('leaderboard', { list });
    });

    socket.on('disconnect', () => {
        cleanupPlayer(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Stellar server listening on http://localhost:${PORT}`);
});
