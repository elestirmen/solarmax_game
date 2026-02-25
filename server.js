import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
const ROOM_CODE_LENGTH = 5;
const MAX_LEADERBOARD_ENTRIES = 500;
const DEFAULT_ROOM_CONFIG = {
    seed: '42',
    nodeCount: 16,
    difficulty: 'normal',
    fogEnabled: false,
};
const DIST_DIR = path.join(__dirname, 'dist');
const HAS_DIST_BUILD =
    fs.existsSync(path.join(DIST_DIR, 'stellar_conquest.html')) &&
    fs.existsSync(path.join(DIST_DIR, 'assets'));
const STATIC_ROOT = HAS_DIST_BUILD ? DIST_DIR : __dirname;

const rooms = new Map();
const socketToRoom = new Map();
const leaderboard = [];
const EMOTES = ['gg', 'gl', 'hf', 'wp', 'oops', 'nice', 'wait'];
const ALLOWED_COMMAND_TYPES = new Set(['send', 'flow', 'rmFlow', 'upgrade', 'toggleDefense']);
const MAX_COMMAND_DELAY_TICKS = 300;

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

function toFiniteInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
}

function sanitizeNodeId(value) {
    const n = toFiniteInt(value);
    if (n === null || n < 0) return null;
    return n;
}

function sanitizeNodeIdList(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const result = [];
    for (const item of value) {
        const id = sanitizeNodeId(item);
        if (id === null || seen.has(id)) continue;
        seen.add(id);
        result.push(id);
        if (result.length >= 30) break;
    }
    return result;
}

function sanitizeCommandData(type, rawData = {}) {
    if (!rawData || typeof rawData !== 'object') return null;
    const data = rawData;

    if (type === 'send') {
        const sources = sanitizeNodeIdList(data.sources);
        const targetId = sanitizeNodeId(data.tgtId ?? data.targetId);
        const pctRaw = Number(data.pct ?? data.percent);
        if (sources.length === 0 || targetId === null || !Number.isFinite(pctRaw)) return null;
        return {
            sources,
            tgtId: targetId,
            pct: Math.max(0.05, Math.min(1, pctRaw)),
        };
    }

    if (type === 'flow' || type === 'rmFlow') {
        const srcId = sanitizeNodeId(data.srcId ?? data.sourceId);
        const tgtId = sanitizeNodeId(data.tgtId ?? data.targetId);
        if (srcId === null || tgtId === null || srcId === tgtId) return null;
        return { srcId, tgtId };
    }

    if (type === 'upgrade' || type === 'toggleDefense') {
        const nodeIds = sanitizeNodeIdList(data.nodeIds);
        if (nodeIds.length > 0) return { nodeIds };

        const nodeId = sanitizeNodeId(data.nodeId);
        if (nodeId === null) return null;
        return { nodeId };
    }

    return null;
}

function normalizeWinnerIndex(raw, room) {
    const value = toFiniteInt(raw);
    if (value === null) return null;
    if (value === -1) return -1; // draw
    return room.players.some(p => p.index === value) ? value : null;
}

function recordMatchResult(room, winnerIndex) {
    for (const participant of room.players) {
        leaderboard.push({
            name: participant.name,
            wins: winnerIndex >= 0 && participant.index === winnerIndex ? 1 : 0,
            games: 1,
            ts: Date.now(),
        });
    }
    if (leaderboard.length > MAX_LEADERBOARD_ENTRIES) {
        leaderboard.splice(0, leaderboard.length - MAX_LEADERBOARD_ENTRIES);
    }
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
        code = '';
        for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
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
        rematchVotes: new Set(),
        resultReports: new Map(),
        resultCommitted: false,
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
    room.rematchVotes = new Set();
    room.resultReports = new Map();
    room.resultCommitted = false;

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
    if (room.hostId !== socketId) {
        io.to(socketId).emit('roomError', { message: 'Sadece host oyunu baslatabilir.' });
        emitRoomState(room);
        return;
    }
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

    if (room.rematchVotes instanceof Set) room.rematchVotes.delete(socketId);
    if (room.resultReports instanceof Map) room.resultReports.delete(socketId);

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
        if (room.players.length < 2) {
            room.started = false;
            room.startedAt = 0;
            room.rematchVotes = new Set();
            room.resultReports = new Map();
            room.resultCommitted = false;
            io.to(code).emit('roomClosed', { message: 'Yeterli oyuncu kalmadi. Oda lobiye dondu.' });
            emitLobbyState();
        }
        return;
    }

    // Reassign contiguous indices.
    room.players.forEach((p, idx) => { p.index = idx; });
    emitRoomState(room);
    emitLobbyState();
}

function sendPublicFile(res, relativePath) {
    const absPath = path.join(STATIC_ROOT, relativePath);
    res.sendFile(absPath, (err) => {
        if (err && !res.headersSent) {
            res.status(err.statusCode || 404).end();
        }
    });
}

app.use('/assets', express.static(path.join(STATIC_ROOT, 'assets')));
app.get('/', (_req, res) => sendPublicFile(res, 'stellar_conquest.html'));
app.get('/stellar_conquest.html', (_req, res) => sendPublicFile(res, 'stellar_conquest.html'));
app.get('/index.html', (_req, res) => {
    const indexPath = path.join(STATIC_ROOT, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
        return;
    }
    res.redirect('/');
});
if (!HAS_DIST_BUILD) {
    app.get('/game.js', (_req, res) => sendPublicFile(res, 'game.js'));
}
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
        const roomCode = String(payload.roomCode || '').trim().toUpperCase();
        if (roomCode.length !== ROOM_CODE_LENGTH) {
            socket.emit('roomError', { message: `Oda kodu ${ROOM_CODE_LENGTH} karakter olmali.` });
            emitLobbyState(socket.id);
            return;
        }
        room = getRoom(roomCode);
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
        if (!ALLOWED_COMMAND_TYPES.has(type)) return;
        const data = sanitizeCommandData(type, payload.data || {});
        if (!data) return;

        let targetTick = Number(payload.tick);
        const serverCurrentTick = nowTick(room.startedAt);
        // İstemcinin ilettiği tick çok geçmişteyse sunucu anının 2 ilerisini kabul et
        if (isNaN(targetTick) || targetTick < serverCurrentTick) {
            targetTick = serverCurrentTick + 2;
        } else {
            targetTick = Math.floor(targetTick);
            if (targetTick > serverCurrentTick + MAX_COMMAND_DELAY_TICKS) {
                targetTick = serverCurrentTick + MAX_COMMAND_DELAY_TICKS;
            }
        }

        const command = {
            playerIndex: player.index,
            tick: targetTick,
            type,
            data,
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
        if (!(room.rematchVotes instanceof Set)) room.rematchVotes = new Set();
        const player = room.players.find(p => p.socketId === socket.id);
        if (player) room.rematchVotes.add(socket.id);
        if (room.rematchVotes.size >= room.players.length && room.players.length >= 2) {
            room.started = false;
            room.startedAt = 0;
            room.rematchVotes = new Set();
            room.resultReports = new Map();
            room.resultCommitted = false;
            startRoomMatch(room);
        } else if (room.players.length >= 2) {
            io.to(code).emit('rematchVote', { name: player ? player.name : '?', count: room.rematchVotes.size, total: room.players.length });
        }
    });

    socket.on('reportResult', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        if (!(room.resultReports instanceof Map)) room.resultReports = new Map();

        let winnerIndex = normalizeWinnerIndex(payload.winnerIndex, room);
        if (winnerIndex === null && payload.winner === true) {
            winnerIndex = player.index;
        }
        if (winnerIndex === null) return;

        room.resultReports.set(socket.id, winnerIndex);

        // Keep report map aligned with active room players.
        for (const reporterId of Array.from(room.resultReports.keys())) {
            if (!room.players.some(p => p.socketId === reporterId)) {
                room.resultReports.delete(reporterId);
            }
        }

        if (room.resultReports.size < room.players.length) return;

        const reportedWinners = Array.from(room.resultReports.values());
        const consensus = reportedWinners.every(v => v === reportedWinners[0]);
        if (!consensus) {
            room.resultReports.clear();
            io.to(code).emit('resultConflict', { message: 'Sonuc raporlari uyusmadi. Lutfen tekrar raporlayin.' });
            return;
        }
        if (room.resultCommitted) return;
        room.resultCommitted = true;

        const confirmedWinner = reportedWinners[0];
        recordMatchResult(room, confirmedWinner);

        const winnerPlayer = room.players.find(p => p.index === confirmedWinner);
        io.to(code).emit('matchResultConfirmed', {
            winnerIndex: confirmedWinner,
            winnerName: winnerPlayer ? winnerPlayer.name : null,
            draw: confirmedWinner < 0,
        });
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

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} zaten kullanimda. Baska bir port deneyin veya once mevcut sureci durdurun.`);
        process.exit(1);
    }
    throw err;
});

server.listen(PORT, () => {
    const rootMode = HAS_DIST_BUILD ? 'dist' : 'source';
    console.log(`Stellar server listening on http://localhost:${PORT} (${rootMode} mode)`);
});
