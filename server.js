import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { ALLOWED_COMMAND_TYPES, sanitizeCommandData, toFiniteInt } from './assets/sim/command_schema.js';
import {
    DEFAULT_MATCH_CONFIG,
    buildDailyMatchManifest,
    buildRoomMatchManifest,
    buildStandardMatchManifest,
    normalizeRoomConfig,
    normalizeRoomMode,
    todayDateKey,
} from './assets/sim/match_manifest.js';
import { buildCustomMapSnapshot } from './assets/sim/custom_map.js';
import {
    applyCommandToAuthoritativeState,
    buildAuthoritativeState,
    captureAuthoritativeSnapshot,
    computeAuthoritativeSnapshotHash,
    simulateAuthoritativeTick,
} from './assets/sim/server_sim.js';
import { buildInitialMatchSnapshot } from './assets/sim/map_gen.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

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
const STORAGE_TIMEZONE = 'Europe/Istanbul';
const DEFAULT_ROOM_CONFIG = DEFAULT_MATCH_CONFIG;
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = path.join(__dirname, 'data');
const SERVER_STATE_PATH = path.join(DATA_DIR, 'server_state.json');
const HAS_DIST_BUILD =
    fs.existsSync(path.join(DIST_DIR, 'stellar_conquest.html')) &&
    fs.existsSync(path.join(DIST_DIR, 'assets'));
const STATIC_ROOT = HAS_DIST_BUILD ? DIST_DIR : __dirname;
const PERSISTENCE_ENABLED = isMainModule || process.env.ENABLE_SERVER_STORAGE === '1';

const rooms = new Map();
const socketToRoom = new Map();
const leaderboard = [];
const dailyChallengeScores = [];
const EMOTES = ['gg', 'gl', 'hf', 'wp', 'oops', 'nice', 'wait'];
const MAX_COMMAND_DELAY_TICKS = 300;
const COMMAND_RATE_WINDOW_MS = 1000;
const MAX_COMMANDS_PER_WINDOW = 120;
const SYNC_REPORT_TTL_TICKS = 240;
const SYNC_REQUEST_TTL_MS = 4000;
const SUMMARY_TICK_TOLERANCE = 45;
const AUTHORITATIVE_SNAPSHOT_INTERVAL_TICKS = 2;
const AUTHORITATIVE_SNAPSHOT_HISTORY = 8;
const AUTHORITATIVE_SNAPSHOT_MAX_BYTES = 400000;
const ROOM_RESUME_GRACE_MS = 90000;
const commandRate = new Map();

function nowTick(startEpochMs) {
    return Math.max(0, Math.floor((Date.now() - startEpochMs) / (1000 / TICK_RATE)));
}

function getMatchRoster(room) {
    if (room && Array.isArray(room.matchPlayers) && room.matchPlayers.length > 0) {
        return room.matchPlayers;
    }
    return room && Array.isArray(room.players) ? room.players : [];
}

function getMatchPlayerByIndex(room, index) {
    const roster = getMatchRoster(room);
    return roster.find(player => player.index === index) || null;
}

function consumeRateLimit(bucketMap, key, limit, windowMs) {
    const now = Date.now();
    const current = bucketMap.get(key);
    if (!current || now - current.startedAt >= windowMs) {
        bucketMap.set(key, { startedAt: now, count: 1 });
        return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
}

function sanitizePlayerName(name) {
    return String(name || '')
        .replace(/[\u0000-\u001F\u007F<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20);
}

function normalizeWinnerIndex(raw, room) {
    const value = toFiniteInt(raw);
    if (value === null) return null;
    if (value === -1) return -1; // draw
    return getMatchPlayerByIndex(room, value) ? value : null;
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
    persistServerState();
}

function loadPersistentState() {
    if (!PERSISTENCE_ENABLED) return;
    try {
        if (!fs.existsSync(SERVER_STATE_PATH)) return;
        const parsed = JSON.parse(fs.readFileSync(SERVER_STATE_PATH, 'utf8'));
        const general = Array.isArray(parsed?.leaderboard) ? parsed.leaderboard : [];
        const daily = Array.isArray(parsed?.dailyChallengeScores) ? parsed.dailyChallengeScores : [];

        leaderboard.splice(0, leaderboard.length, ...general.slice(-MAX_LEADERBOARD_ENTRIES));
        dailyChallengeScores.splice(0, dailyChallengeScores.length, ...daily.slice(-2000));
    } catch (error) {
        console.warn('Server state load failed:', error.message);
    }
}

function persistServerState() {
    if (!PERSISTENCE_ENABLED) return;
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(SERVER_STATE_PATH, JSON.stringify({
            leaderboard: leaderboard.slice(-MAX_LEADERBOARD_ENTRIES),
            dailyChallengeScores: dailyChallengeScores.slice(-2000),
        }, null, 2));
    } catch (error) {
        console.warn('Server state save failed:', error.message);
    }
}

function recordDailyChallengeScore(room, winnerIndex, finishTick) {
    if (!room || !room.matchManifest || room.matchManifest.mode !== 'daily') return null;
    if (winnerIndex < 0) return null;

    const winner = getMatchPlayerByIndex(room, winnerIndex);
    if (!winner || winner.botControlled) return null;

    const tick = Math.max(0, toFiniteInt(finishTick) || room.lastResultTick || nowTick(room.startedAt));
    const entry = {
        dateKey: room.matchManifest.challengeKey,
        challengeTitle: room.matchManifest.challengeTitle,
        name: winner.name,
        finishTick: tick,
        ts: Date.now(),
        roomCode: room.code,
        difficulty: room.matchManifest.difficulty,
        nodeCount: room.matchManifest.nodeCount,
    };
    dailyChallengeScores.push(entry);
    if (dailyChallengeScores.length > 2000) {
        dailyChallengeScores.splice(0, dailyChallengeScores.length - 2000);
    }
    persistServerState();
    return entry;
}

function buildGeneralLeaderboardList() {
    const byName = {};
    leaderboard.forEach(entry => {
        if (!byName[entry.name]) byName[entry.name] = { name: entry.name, wins: 0, games: 0 };
        byName[entry.name].wins += entry.wins;
        byName[entry.name].games += entry.games;
    });
    return Object.values(byName).sort((a, b) => b.wins - a.wins || a.games - b.games || a.name.localeCompare(b.name)).slice(0, 10);
}

function buildDailyChallengeLeaderboard(dateKey = todayDateKey(STORAGE_TIMEZONE)) {
    const byName = {};
    for (const entry of dailyChallengeScores) {
        if (entry.dateKey !== dateKey) continue;
        if (!byName[entry.name]) {
            byName[entry.name] = {
                name: entry.name,
                bestTick: entry.finishTick,
                attempts: 0,
                clears: 0,
            };
        }
        const bucket = byName[entry.name];
        bucket.attempts += 1;
        bucket.clears += 1;
        if (entry.finishTick < bucket.bestTick) bucket.bestTick = entry.finishTick;
    }
    return Object.values(byName)
        .sort((a, b) => a.bestTick - b.bestTick || b.clears - a.clears || a.name.localeCompare(b.name))
        .slice(0, 10);
}

function buildLeaderboardPayload(dateKey = todayDateKey(STORAGE_TIMEZONE)) {
    const challenge = buildDailyMatchManifest(dateKey, { defaults: DEFAULT_ROOM_CONFIG, timeZone: STORAGE_TIMEZONE });
    return {
        dateKey,
        sections: [
            {
                id: 'general',
                title: 'Genel Liderlik',
                entries: buildGeneralLeaderboardList(),
            },
            {
                id: 'daily',
                title: `Gunluk Challenge - ${challenge.challengeKey}`,
                subtitle: `${challenge.challengeTitle} | ${challenge.challengeBlurb}`,
                entries: buildDailyChallengeLeaderboard(challenge.challengeKey),
            },
        ],
    };
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

function buildMatchId() {
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function buildSyncRequestId() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function buildReconnectToken() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function createRoom(configPayload = {}) {
    const code = generateRoomCode();
    const config = normalizeRoomConfig(configPayload, { defaults: DEFAULT_ROOM_CONFIG, timeZone: STORAGE_TIMEZONE });
    const room = {
        code,
        hostId: '',
        createdAt: Date.now(),
        maxPlayers: config.mode === 'custom' ? Math.min(MAX_ROOM_PLAYERS, Math.max(2, Number(config.playerCount) || MAX_ROOM_PLAYERS)) : MAX_ROOM_PLAYERS,
        started: false,
        startedAt: 0,
        players: [],
        config,
        matchPlayers: [],
        rematchVotes: new Set(),
        resultReports: new Map(),
        resultCommitted: false,
        matchId: '',
        commandSeq: 0,
        syncReports: new Map(),
        pendingSyncRequest: null,
        stateSummaries: new Map(),
        matchManifest: buildRoomMatchManifest({ config, players: [] }, { defaults: DEFAULT_ROOM_CONFIG, timeZone: STORAGE_TIMEZONE }),
        lastResultTick: 0,
        serverSim: null,
        serverCommandQueue: [],
        serverSnapshotHistory: [],
        lastAuthoritativeBroadcastTick: -1,
        serverTickTimer: null,
        resumeExpiryTimer: null,
    };
    rooms.set(code, room);
    return room;
}

function cancelRoomResumeExpiry(room) {
    if (!room || !room.resumeExpiryTimer) return;
    clearTimeout(room.resumeExpiryTimer);
    room.resumeExpiryTimer = null;
}

function scheduleRoomResumeExpiry(room) {
    if (!room || !room.started || room.players.length > 0 || room.resumeExpiryTimer) return;
    room.resumeExpiryTimer = setTimeout(() => {
        const currentRoom = rooms.get(room.code);
        if (!currentRoom || currentRoom !== room) return;
        currentRoom.resumeExpiryTimer = null;
        if (!currentRoom.started || currentRoom.players.length > 0) return;
        resetRoomSimulation(currentRoom);
        rooms.delete(currentRoom.code);
        emitLobbyState();
    }, ROOM_RESUME_GRACE_MS);
    if (typeof room.resumeExpiryTimer.unref === 'function') room.resumeExpiryTimer.unref();
}

function stopRoomSimulation(room) {
    if (!room || !room.serverTickTimer) return;
    clearInterval(room.serverTickTimer);
    room.serverTickTimer = null;
}

function resetRoomSimulation(room) {
    if (!room) return;
    cancelRoomResumeExpiry(room);
    stopRoomSimulation(room);
    room.serverSim = null;
    room.serverCommandQueue = [];
    room.serverSnapshotHistory = [];
    room.lastAuthoritativeBroadcastTick = -1;
}

function getRoomAuthoritativeTick(room) {
    if (room && room.serverSim && room.serverSim.ready && room.serverSim.state) {
        return Math.max(0, Math.floor(Number(room.serverSim.state.tick) || 0));
    }
    return nowTick(room.startedAt);
}

function rememberAuthoritativeSnapshot(room, forceBroadcast = false) {
    if (!room || !room.serverSim || !room.serverSim.ready || !room.serverSim.state) return null;
    const snapshot = captureAuthoritativeSnapshot(room.serverSim.state);
    const hash = computeAuthoritativeSnapshotHash(room.serverSim.state);
    const entry = {
        tick: room.serverSim.state.tick,
        hash,
        snapshot,
    };
    room.serverSnapshotHistory.push(entry);
    if (room.serverSnapshotHistory.length > AUTHORITATIVE_SNAPSHOT_HISTORY) {
        room.serverSnapshotHistory.splice(0, room.serverSnapshotHistory.length - AUTHORITATIVE_SNAPSHOT_HISTORY);
    }

    if (forceBroadcast || room.lastAuthoritativeBroadcastTick < 0 || entry.tick - room.lastAuthoritativeBroadcastTick >= AUTHORITATIVE_SNAPSHOT_INTERVAL_TICKS) {
        room.lastAuthoritativeBroadcastTick = entry.tick;
        io.to(room.code).emit('authoritativeState', {
            matchId: room.matchId,
            tick: entry.tick,
            hash: entry.hash,
            snapshot: entry.snapshot,
        });
    }
    return entry;
}

function findAuthoritativeSnapshot(room, tick) {
    if (!room || !Array.isArray(room.serverSnapshotHistory)) return null;
    for (let i = room.serverSnapshotHistory.length - 1; i >= 0; i--) {
        const entry = room.serverSnapshotHistory[i];
        if (entry && entry.tick === tick) return entry;
    }
    return null;
}

function processRoomAuthoritativeTick(room) {
    if (!room || !room.started || !room.serverSim || !room.serverSim.ready || !room.serverSim.state) return null;
    const state = room.serverSim.state;

    if (Array.isArray(room.serverCommandQueue) && room.serverCommandQueue.length > 0) {
        room.serverCommandQueue.sort((a, b) => {
            const tickDelta = (a.tick || 0) - (b.tick || 0);
            if (tickDelta !== 0) return tickDelta;
            return (a.seq || 0) - (b.seq || 0);
        });
        while (room.serverCommandQueue.length > 0) {
            const command = room.serverCommandQueue[0];
            if ((command.tick || 0) > state.tick + 1) break;
            room.serverCommandQueue.shift();
            applyCommandToAuthoritativeState(state, command.playerIndex, command.type, command.data);
            state.lastAppliedSeq = typeof command.seq === 'number' ? command.seq : state.lastAppliedSeq;
        }
    }

    simulateAuthoritativeTick(state);
    const snapshotEntry = rememberAuthoritativeSnapshot(room, state.state === 'gameOver');

    if (state.state === 'gameOver' && !room.resultCommitted) {
        room.lastResultTick = Math.max(room.lastResultTick || 0, state.tick);
        const confirmed = commitRoomResult(room, state.winner, state.tick);
        if (confirmed) io.to(room.code).emit('matchResultConfirmed', confirmed);
        stopRoomSimulation(room);
    }
    return snapshotEntry;
}

function ensureRoomSimulation(room) {
    if (!room || room.serverTickTimer) return;
    room.serverTickTimer = setInterval(() => {
        processRoomAuthoritativeTick(room);
    }, Math.round(1000 / TICK_RATE));
    if (typeof room.serverTickTimer.unref === 'function') room.serverTickTimer.unref();
}

function installInitialRoomSnapshot(room, snapshot, options = {}) {
    if (!room || !room.started || !room.matchId) return null;
    if (room.serverSim && room.serverSim.ready && room.serverSim.state) {
        return room.serverSnapshotHistory[room.serverSnapshotHistory.length - 1] || rememberAuthoritativeSnapshot(room, options.broadcast === true);
    }
    const serialized = JSON.stringify(snapshot || {});
    if (serialized.length > AUTHORITATIVE_SNAPSHOT_MAX_BYTES) return null;

    room.serverSim = {
        ready: true,
        state: buildAuthoritativeState(JSON.parse(serialized), {
            manifest: room.matchManifest,
            players: room.matchPlayers,
        }),
    };
    room.lastResultTick = Math.max(room.lastResultTick || 0, room.serverSim.state.tick || 0);
    room.serverCommandQueue = Array.isArray(room.serverCommandQueue) ? room.serverCommandQueue : [];
    room.serverSnapshotHistory = [];
    room.lastAuthoritativeBroadcastTick = -1;
    const shouldBroadcast = options.broadcast !== false;
    const initialEntry = rememberAuthoritativeSnapshot(room, shouldBroadcast);
    ensureRoomSimulation(room);
    return initialEntry;
}

function pruneSyncReports(room, currentTick) {
    if (!room || !(room.syncReports instanceof Map)) return;
    for (const tick of Array.from(room.syncReports.keys())) {
        if (tick < currentTick - SYNC_REPORT_TTL_TICKS) {
            room.syncReports.delete(tick);
        }
    }
}

function recordStateHash(room, socketId, payload = {}) {
    if (!room || !room.started) return null;
    if (!room.matchId || String(payload.matchId || '') !== room.matchId) return null;

    const tick = toFiniteInt(payload.tick);
    const hash = String(payload.hash || '').trim().toLowerCase();
    if (tick === null || tick < 0) return null;
    if (!/^[a-f0-9]{8,32}$/.test(hash)) return null;

    if (!(room.syncReports instanceof Map)) room.syncReports = new Map();
    pruneSyncReports(room, tick);

    let report = room.syncReports.get(tick);
    if (!report) {
        report = { hashes: new Map(), emitted: false };
        room.syncReports.set(tick, report);
    }
    report.hashes.set(socketId, hash);

    const activeIds = room.players.map(player => player.socketId).filter(Boolean);
    if (activeIds.length < 2) return null;

    for (const reporterId of Array.from(report.hashes.keys())) {
        if (!activeIds.includes(reporterId)) {
            report.hashes.delete(reporterId);
        }
    }
    if (report.hashes.size < activeIds.length) return null;

    const counts = new Map();
    for (const activeId of activeIds) {
        const value = report.hashes.get(activeId);
        if (!value) return null;
        counts.set(value, (counts.get(value) || 0) + 1);
    }
    if (counts.size <= 1 || report.emitted) return null;

    report.emitted = true;

    let majorityHash = '';
    let majorityCount = 0;
    const hashCounts = [];
    for (const [value, count] of counts.entries()) {
        hashCounts.push({ hash: value, count });
        if (count > majorityCount) {
            majorityHash = value;
            majorityCount = count;
        }
    }
    hashCounts.sort((a, b) => b.count - a.count || String(a.hash).localeCompare(String(b.hash)));

    return {
        tick,
        majorityHash,
        majorityCount,
        hashCounts,
    };
}

function createSyncSnapshotRequest(room, issue) {
    if (!room || !room.started || !issue || !issue.majorityHash) return null;
    if (
        room.pendingSyncRequest &&
        room.pendingSyncRequest.tick === issue.tick &&
        room.pendingSyncRequest.majorityHash === issue.majorityHash &&
        Date.now() - room.pendingSyncRequest.createdAt < SYNC_REQUEST_TTL_MS
    ) {
        return null;
    }

    const report = room.syncReports instanceof Map ? room.syncReports.get(issue.tick) : null;
    if (!report || !(report.hashes instanceof Map)) return null;

    const activeIds = room.players.map(player => player.socketId).filter(Boolean);
    let sourceSocketId = '';
    for (const activeId of activeIds) {
        if (report.hashes.get(activeId) === issue.majorityHash) {
            sourceSocketId = activeId;
            break;
        }
    }
    if (!sourceSocketId) return null;

    const request = {
        requestId: buildSyncRequestId(),
        tick: issue.tick,
        majorityHash: issue.majorityHash,
        sourceSocketId,
        createdAt: Date.now(),
    };
    room.pendingSyncRequest = request;
    return request;
}

function sanitizeAliveIndices(room, rawAlive) {
    const roster = getMatchRoster(room);
    const validIndices = new Set(roster.map(player => player.index));
    const result = [];
    const seen = new Set();
    if (!Array.isArray(rawAlive)) return result;
    for (const value of rawAlive) {
        const index = toFiniteInt(value);
        if (index === null || seen.has(index) || !validIndices.has(index)) continue;
        seen.add(index);
        result.push(index);
        if (result.length >= roster.length) break;
    }
    result.sort((a, b) => a - b);
    return result;
}

function maybeFinalizeMatchFromSummaries(room) {
    if (!room || !room.started || room.resultCommitted) return null;
    if (!(room.stateSummaries instanceof Map)) return null;

    const activeIds = room.players.map(player => player.socketId).filter(Boolean);
    if (activeIds.length < 2) return null;

    const summaries = [];
    for (const activeId of activeIds) {
        const summary = room.stateSummaries.get(activeId);
        if (!summary) return null;
        summaries.push(summary);
    }

    let minTick = summaries[0].tick;
    let maxTick = summaries[0].tick;
    for (const summary of summaries) {
        if (summary.tick < minTick) minTick = summary.tick;
        if (summary.tick > maxTick) maxTick = summary.tick;
    }
    if (maxTick - minTick > SUMMARY_TICK_TOLERANCE) return null;
    if (!summaries.every(summary => summary.gameOver === true)) return null;

    const winnerValues = summaries.map(summary => summary.winnerIndex);
    const explicitWinner = winnerValues.every(value => value === winnerValues[0]) ? winnerValues[0] : null;
    if (explicitWinner !== null && explicitWinner !== undefined) {
        return { winnerIndex: explicitWinner, tick: maxTick };
    }

    const aliveKey = summaries[0].aliveIndices.join(',');
    if (!summaries.every(summary => summary.aliveIndices.join(',') === aliveKey)) return null;

    if (summaries[0].aliveIndices.length === 1) {
        return { winnerIndex: summaries[0].aliveIndices[0], tick: maxTick };
    }
    if (summaries[0].aliveIndices.length === 0) {
        return { winnerIndex: -1, tick: maxTick };
    }
    return null;
}

function recordStateSummary(room, socketId, payload = {}) {
    if (!room || !room.started) return null;
    if (!room.matchId || String(payload.matchId || '') !== room.matchId) return null;

    const tick = toFiniteInt(payload.tick);
    if (tick === null || tick < 0) return null;

    let winnerIndex = null;
    if (payload.winnerIndex !== undefined && payload.winnerIndex !== null && payload.winnerIndex !== '') {
        winnerIndex = normalizeWinnerIndex(payload.winnerIndex, room);
        if (winnerIndex === null) return null;
    }

    const summary = {
        tick,
        gameOver: payload.gameOver === true,
        winnerIndex,
        aliveIndices: sanitizeAliveIndices(room, payload.aliveIndices),
    };

    if (!(room.stateSummaries instanceof Map)) room.stateSummaries = new Map();
    room.stateSummaries.set(socketId, summary);
    if (summary.gameOver && summary.tick > (room.lastResultTick || 0)) {
        room.lastResultTick = summary.tick;
    }

    for (const reporterId of Array.from(room.stateSummaries.keys())) {
        if (!room.players.some(player => player.socketId === reporterId)) {
            room.stateSummaries.delete(reporterId);
        }
    }

    const resolved = maybeFinalizeMatchFromSummaries(room);
    if (resolved && resolved.tick > (room.lastResultTick || 0)) room.lastResultTick = resolved.tick;
    return resolved;
}

function buildConfirmedResultPayload(room, winnerIndex) {
    const winnerPlayer = getMatchPlayerByIndex(room, winnerIndex);
    return {
        winnerIndex,
        winnerName: winnerPlayer ? (winnerPlayer.botControlled ? 'AI' : winnerPlayer.name) : null,
        draw: winnerIndex < 0,
    };
}

function commitRoomResult(room, winnerIndex, finishTick) {
    if (!room || room.resultCommitted) return null;
    room.resultCommitted = true;
    room.lastResultTick = Math.max(0, toFiniteInt(finishTick) || room.lastResultTick || nowTick(room.startedAt));
    recordMatchResult(room, winnerIndex);
    recordDailyChallengeScore(room, winnerIndex, room.lastResultTick);
    return buildConfirmedResultPayload(room, winnerIndex);
}

function getRoom(code) {
    if (!code) return null;
    return rooms.get(String(code).toUpperCase());
}

function roomSnapshot(room, socketId) {
    const preview = room?.started ? room.matchManifest : buildRoomMatchManifest(room, { defaults: DEFAULT_ROOM_CONFIG, timeZone: STORAGE_TIMEZONE });
    const selfPlayer = room.players.find(p => p.socketId === socketId) || room.matchPlayers.find(p => p.socketId === socketId);
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
        preview,
        reconnectToken: selfPlayer ? String(selfPlayer.reconnectToken || '') : '',
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
            const preview = buildRoomMatchManifest(room, { defaults: DEFAULT_ROOM_CONFIG, timeZone: STORAGE_TIMEZONE });
            list.push({
                code: room.code,
                hostName: host ? host.name : 'Host',
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                mode: preview.mode || room.config?.mode || 'standard',
                modeLabel: preview.modeLabel || (normalizeRoomMode(room.config?.mode, { defaults: DEFAULT_ROOM_CONFIG }) === 'daily' ? 'Gunluk' : 'Standart'),
                challengeKey: preview.challengeKey || room.config?.challengeKey || '',
                challengeTitle: preview.challengeTitle || room.config?.challengeTitle || preview.customMapName || room.config?.customMapName || '',
                difficulty: String(preview.difficulty || room.config?.difficulty || DEFAULT_ROOM_CONFIG.difficulty),
                nodeCount: Number(preview.nodeCount || room.config?.nodeCount || DEFAULT_ROOM_CONFIG.nodeCount),
                fogEnabled: !!(preview.fogEnabled ?? room.config?.fogEnabled),
                rulesMode: String(preview.rulesMode || room.config?.rulesMode || DEFAULT_ROOM_CONFIG.rulesMode),
                aiCount: Number(preview.aiCount || 0),
                playlist: preview.playlist || room.config?.playlist || 'standard',
                playlistLabel: preview.playlistLabel || '',
                doctrineId: preview.doctrineId || room.config?.doctrineId || '',
                createdAt: Number(room.createdAt || 0),
            });
        }
    }
    return list;
}

function buildMatchStartedPayload(room, socketId) {
    const roster = Array.isArray(room.matchPlayers) ? room.matchPlayers : [];
    const selfPlayer = roster.find(player => player.socketId === socketId) || room.players.find(player => player.socketId === socketId);
    const humanSlots = roster.filter(player => player && player.humanSlot).length || room.players.length;
    return {
        matchId: room.matchId,
        roomCode: room.code,
        authoritative: true,
        mode: room.matchManifest.mode,
        modeLabel: room.matchManifest.modeLabel,
        challengeKey: room.matchManifest.challengeKey,
        challengeTitle: room.matchManifest.challengeTitle,
        challengeBlurb: room.matchManifest.challengeBlurb,
        challenge: room.matchManifest.mode === 'daily' ? room.matchManifest.challenge : null,
        seed: room.matchManifest.seed,
        nodeCount: room.matchManifest.nodeCount,
        difficulty: room.matchManifest.difficulty,
        fogEnabled: room.matchManifest.fogEnabled,
        rulesMode: room.matchManifest.rulesMode,
        mapFeature: room.matchManifest.mapFeature,
        mapMutator: room.matchManifest.mapMutator,
        playlist: room.matchManifest.playlist || 'standard',
        playlistLabel: room.matchManifest.playlistLabel || '',
        playlistBlurb: room.matchManifest.playlistBlurb || '',
        doctrineId: room.matchManifest.doctrineId || '',
        encounters: Array.isArray(room.matchManifest.encounters) ? room.matchManifest.encounters : [],
        objectives: Array.isArray(room.matchManifest.objectives) ? room.matchManifest.objectives : [],
        endOnObjectives: room.matchManifest.endOnObjectives === true,
        humanCount: humanSlots,
        aiCount: room.matchManifest.aiCount,
        customMap: room.matchManifest.mode === 'custom' ? room.matchManifest.customMap : null,
        customMapName: room.matchManifest.customMapName || '',
        players: roster.map(player => ({
            socketId: player.socketId || '',
            name: player.name,
            index: player.index,
        })),
        reconnectToken: selfPlayer ? String(selfPlayer.reconnectToken || '') : '',
    };
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

    cancelRoomResumeExpiry(room);
    room.started = true;
    room.startedAt = Date.now();
    room.rematchVotes = new Set();
    room.resultReports = new Map();
    room.resultCommitted = false;
    room.matchId = buildMatchId();
    room.commandSeq = 0;
    room.syncReports = new Map();
    room.pendingSyncRequest = null;
    room.stateSummaries = new Map();
    room.matchManifest = buildRoomMatchManifest(room, { defaults: DEFAULT_ROOM_CONFIG, timeZone: STORAGE_TIMEZONE });
    room.lastResultTick = 0;
    resetRoomSimulation(room);

    const players = room.players.map(p => ({ socketId: p.socketId, name: p.name, index: p.index }));
    const aiPlayers = [];
    for (let ai = 0; ai < room.matchManifest.aiCount; ai++) {
        aiPlayers.push({
            socketId: '',
            name: `AI ${ai + 1}`,
            index: room.players.length + ai,
        });
    }
    room.matchPlayers = room.players.map(p => ({
        socketId: p.socketId,
        name: p.name,
        index: p.index,
        connected: true,
        botControlled: false,
        humanSlot: true,
        reconnectToken: p.reconnectToken || buildReconnectToken(),
    })).concat(aiPlayers.map(ai => ({
        socketId: '',
        name: ai.name,
        index: ai.index,
        connected: true,
        botControlled: true,
        humanSlot: false,
        reconnectToken: '',
    })));
    const initialSnapshot = room.matchManifest.mode === 'custom'
        ? buildCustomMapSnapshot(room.matchManifest.customMap, room.matchPlayers)
        : buildInitialMatchSnapshot(room.matchManifest, room.matchPlayers);
    const initialEntry = installInitialRoomSnapshot(room, initialSnapshot, { broadcast: false });

    room.players.forEach(player => {
        io.to(player.socketId).emit('matchStarted', buildMatchStartedPayload(room, player.socketId));
    });
    if (initialEntry) {
        io.to(room.code).emit('authoritativeState', {
            matchId: room.matchId,
            tick: initialEntry.tick,
            hash: initialEntry.hash,
            snapshot: initialEntry.snapshot,
        });
    }
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
    commandRate.delete(socketId);

    const socket = io.of('/').sockets.get(socketId);
    if (socket) socket.leave(code);
    if (!room) return;

    if (room.rematchVotes instanceof Set) room.rematchVotes.delete(socketId);
    if (room.resultReports instanceof Map) room.resultReports.delete(socketId);
    if (room.stateSummaries instanceof Map) room.stateSummaries.delete(socketId);
    if (room.pendingSyncRequest && room.pendingSyncRequest.sourceSocketId === socketId) {
        room.pendingSyncRequest = null;
    }

    // We kept their info before filtering
    const leavingPlayer = room.players.find(p => p.socketId === socketId);

    room.players = room.players.filter(p => p.socketId !== socketId);
    if (room.started) {
        const matchPlayer = room.matchPlayers.find(p => p.socketId === socketId);
        if (matchPlayer) {
            matchPlayer.connected = false;
            matchPlayer.botControlled = true;
            matchPlayer.socketId = '';
            if (room.serverSim && room.serverSim.ready && room.serverSim.state && room.serverSim.state.players[matchPlayer.index]) {
                room.serverSim.state.players[matchPlayer.index].isAI = true;
            }
        }
        if (leavingPlayer) {
            io.to(code).emit('playerLeft', { index: leavingPlayer.index, name: leavingPlayer.name });
        }
        if (room.players.length === 0) {
            room.hostId = '';
            scheduleRoomResumeExpiry(room);
        } else {
            cancelRoomResumeExpiry(room);
            if (room.hostId === socketId || !room.players.some(p => p.socketId === room.hostId)) {
                room.hostId = room.players[0].socketId;
            }
            emitRoomState(room);
        }
        emitLobbyState();
        return;
    }

    if (room.players.length === 0) {
        resetRoomSimulation(room);
        rooms.delete(code);
        emitLobbyState();
        return;
    }

    if (room.hostId === socketId) {
        room.hostId = room.players[0].socketId;
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

function findReconnectableMatchPlayer(room, reconnectToken) {
    const token = String(reconnectToken || '').trim();
    if (!room || !room.started || !token || !Array.isArray(room.matchPlayers)) return null;
    return room.matchPlayers.find(player => player && player.humanSlot && player.reconnectToken === token) || null;
}

function resumeStartedRoomPlayer(socket, room, reconnectToken) {
    const matchPlayer = findReconnectableMatchPlayer(room, reconnectToken);
    if (!matchPlayer) return false;
    if (matchPlayer.connected && matchPlayer.socketId && matchPlayer.socketId !== socket.id) return false;

    cancelRoomResumeExpiry(room);
    matchPlayer.socketId = socket.id;
    matchPlayer.connected = true;
    matchPlayer.botControlled = false;

    if (room.serverSim && room.serverSim.ready && room.serverSim.state && room.serverSim.state.players[matchPlayer.index]) {
        room.serverSim.state.players[matchPlayer.index].isAI = false;
    }

    const existing = room.players.find(player => player.index === matchPlayer.index || player.socketId === socket.id);
    if (existing) {
        existing.socketId = socket.id;
        existing.name = matchPlayer.name;
        existing.index = matchPlayer.index;
        existing.reconnectToken = matchPlayer.reconnectToken;
    } else {
        room.players.push({
            socketId: socket.id,
            name: matchPlayer.name,
            index: matchPlayer.index,
            reconnectToken: matchPlayer.reconnectToken,
        });
    }
    room.players.sort((a, b) => a.index - b.index);

    if (!room.hostId || !room.players.some(player => player.socketId === room.hostId)) {
        room.hostId = socket.id;
    }

    socketToRoom.set(socket.id, room.code);
    socket.join(room.code);
    emitRoomState(room);
    io.to(room.code).emit('playerRejoined', { index: matchPlayer.index, name: matchPlayer.name });
    io.to(socket.id).emit('matchStarted', buildMatchStartedPayload(room, socket.id));

    if (room.serverSim && room.serverSim.ready && room.serverSim.state) {
        io.to(socket.id).emit('authoritativeState', {
            matchId: room.matchId,
            tick: room.serverSim.state.tick,
            hash: computeAuthoritativeSnapshotHash(room.serverSim.state),
            snapshot: captureAuthoritativeSnapshot(room.serverSim.state),
        });
    }
    return true;
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

    if (room.started && payload.action === 'join' && resumeStartedRoomPlayer(socket, room, payload.reconnectToken)) {
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
        reconnectToken: buildReconnectToken(),
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
        if (payload.matchId && String(payload.matchId) !== room.matchId) return;
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;
        if (!consumeRateLimit(commandRate, socket.id, MAX_COMMANDS_PER_WINDOW, COMMAND_RATE_WINDOW_MS)) return;

        const type = String(payload.type || '');
        if (!ALLOWED_COMMAND_TYPES.has(type)) return;
        const data = sanitizeCommandData(type, payload.data || {});
        if (!data) return;

        let targetTick = Number(payload.tick);
        const serverCurrentTick = getRoomAuthoritativeTick(room);
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
            matchId: room.matchId,
            seq: room.commandSeq++,
            playerIndex: player.index,
            tick: targetTick,
            type,
            data,
        };
        if (!Array.isArray(room.serverCommandQueue)) room.serverCommandQueue = [];
        room.serverCommandQueue.push(command);
        if (!room.serverSim || !room.serverSim.ready) {
            io.to(code).emit('roomCommand', command);
        }
    });

    socket.on('initialStateSnapshot', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        if (socket.id !== room.hostId) return;
        if (String(payload.matchId || '') !== room.matchId) return;
        if (room.serverSim && room.serverSim.ready) return;
        if (!payload.snapshot || typeof payload.snapshot !== 'object') return;
        installInitialRoomSnapshot(room, payload.snapshot);
    });

    socket.on('stateHash', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;

        if (room.serverSim && room.serverSim.ready) {
            const tick = toFiniteInt(payload.tick);
            const clientHash = String(payload.hash || '').trim().toLowerCase();
            const serverSnapshot = tick === null ? null : findAuthoritativeSnapshot(room, tick);
            if (serverSnapshot && clientHash && clientHash !== serverSnapshot.hash) {
                io.to(socket.id).emit('authoritativeState', {
                    matchId: room.matchId,
                    tick: serverSnapshot.tick,
                    hash: serverSnapshot.hash,
                    snapshot: serverSnapshot.snapshot,
                });
            }
            return;
        }

        const issue = recordStateHash(room, socket.id, payload);
        if (!issue) return;

        io.to(code).emit('syncIssue', {
            tick: issue.tick,
            majorityHash: issue.majorityHash,
            majorityCount: issue.majorityCount,
            total: room.players.length,
            hashCounts: issue.hashCounts,
        });

        const syncRequest = createSyncSnapshotRequest(room, issue);
        if (syncRequest) {
            io.to(syncRequest.sourceSocketId).emit('requestSyncSnapshot', {
                matchId: room.matchId,
                requestId: syncRequest.requestId,
                tick: syncRequest.tick,
                hash: syncRequest.majorityHash,
            });
        }
    });

    socket.on('syncSnapshot', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started || !room.pendingSyncRequest) return;

        const request = room.pendingSyncRequest;
        if (request.sourceSocketId !== socket.id) return;
        if (String(payload.requestId || '') !== request.requestId) return;
        if (String(payload.matchId || '') !== room.matchId) return;
        if (toFiniteInt(payload.tick) !== request.tick) return;

        const hash = String(payload.hash || '').trim().toLowerCase();
        if (hash !== request.majorityHash) return;
        if (!payload.snapshot || typeof payload.snapshot !== 'object') return;

        const serialized = JSON.stringify(payload.snapshot);
        if (serialized.length > 300000) return;

        room.pendingSyncRequest = null;
        socket.to(code).emit('syncSnapshot', {
            matchId: room.matchId,
            requestId: request.requestId,
            tick: request.tick,
            hash,
            snapshot: JSON.parse(serialized),
        });
    });

    socket.on('stateSummary', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        if (room.serverSim && room.serverSim.ready) return;

        const result = recordStateSummary(room, socket.id, payload);
        if (!result) return;

        const confirmed = commitRoomResult(room, result.winnerIndex, result.tick);
        if (confirmed) io.to(code).emit('matchResultConfirmed', confirmed);
    });

    socket.on('pingTick', (payload = {}) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        socket.emit('pongTick', {
            clientTs: payload.clientTs,
            serverTick: getRoomAuthoritativeTick(room)
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
            room.pendingSyncRequest = null;
            room.stateSummaries = new Map();
            resetRoomSimulation(room);
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
        if (room.serverSim && room.serverSim.ready) return;
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        if (!(room.resultReports instanceof Map)) room.resultReports = new Map();

        let winnerIndex = normalizeWinnerIndex(payload.winnerIndex, room);
        if (winnerIndex === null && payload.winner === true) {
            winnerIndex = player.index;
        }
        if (winnerIndex === null) return;

        const reportedTick = toFiniteInt(payload.tick);
        if (reportedTick !== null && reportedTick > (room.lastResultTick || 0)) {
            room.lastResultTick = reportedTick;
        }

        room.resultReports.set(socket.id, {
            winnerIndex,
            tick: reportedTick,
        });

        // Keep report map aligned with active room players.
        for (const reporterId of Array.from(room.resultReports.keys())) {
            if (!room.players.some(p => p.socketId === reporterId)) {
                room.resultReports.delete(reporterId);
            }
        }

        if (room.resultReports.size < room.players.length) return;

        const reports = Array.from(room.resultReports.values());
        const reportedWinners = reports.map(report => report.winnerIndex);
        const consensus = reportedWinners.every(v => v === reportedWinners[0]);
        if (!consensus) {
            room.resultReports.clear();
            io.to(code).emit('resultConflict', { message: 'Sonuc raporlari uyusmadi. Lutfen tekrar raporlayin.' });
            return;
        }
        const confirmedWinner = reportedWinners[0];
        const finishTick = reports.reduce((maxTick, report) => {
            return report.tick !== null && report.tick > maxTick ? report.tick : maxTick;
        }, room.lastResultTick || 0);
        const confirmed = commitRoomResult(room, confirmedWinner, finishTick);
        if (confirmed) io.to(code).emit('matchResultConfirmed', confirmed);
    });

    socket.on('requestLeaderboard', () => {
        socket.emit('leaderboard', buildLeaderboardPayload(todayDateKey(STORAGE_TIMEZONE)));
    });

    socket.on('requestDailyChallenge', (payload = {}) => {
        const manifest = buildDailyMatchManifest(payload.challengeDate || todayDateKey(STORAGE_TIMEZONE), { defaults: DEFAULT_ROOM_CONFIG, timeZone: STORAGE_TIMEZONE });
        socket.emit('dailyChallenge', {
            challenge: manifest.challenge,
            challengeKey: manifest.challengeKey,
            title: manifest.challengeTitle,
            blurb: manifest.challengeBlurb,
            aiCount: manifest.aiCount,
        });
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

loadPersistentState();

if (isMainModule) {
    server.listen(PORT, () => {
        const rootMode = HAS_DIST_BUILD ? 'dist' : 'source';
        console.log(`Stellar server listening on http://localhost:${PORT} (${rootMode} mode)`);
    });
}

export {
    rooms,
    socketToRoom,
    leaderboard,
    dailyChallengeScores,
    createRoom,
    startRoomMatch,
    cleanupPlayer,
    normalizeWinnerIndex,
    recordMatchResult,
    getMatchRoster,
    sanitizePlayerName,
    recordStateHash,
    createSyncSnapshotRequest,
    recordStateSummary,
    maybeFinalizeMatchFromSummaries,
    commitRoomResult,
    todayDateKey,
    buildDailyMatchManifest,
    buildRoomMatchManifest,
    recordDailyChallengeScore,
    buildDailyChallengeLeaderboard,
    buildLeaderboardPayload,
    installInitialRoomSnapshot,
    processRoomAuthoritativeTick,
    getRoomAuthoritativeTick,
    stopRoomSimulation,
    resumeStartedRoomPlayer,
};
