import { normalizeCustomMapConfig } from '../sim/custom_map.js';
import { normalizeRulesetMode } from '../sim/ruleset.js';

function clampDelayTicks(value) {
    if (value < 6) return 6;
    if (value > 18) return 18;
    return value;
}

export function getSocketEndpoint(locationLike) {
    if (!locationLike) return undefined;
    if (locationLike.protocol === 'file:') return 'http://127.0.0.1:3000';
    if (locationLike.port === '5173') {
        return locationLike.protocol + '//' + locationLike.hostname + ':3000';
    }
    return undefined;
}

export function buildCreateRoomRequest(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var skirmish = opts.skirmish && typeof opts.skirmish === 'object' ? opts.skirmish : {};
    var mode = opts.mode === 'daily' || opts.mode === 'custom' ? opts.mode : 'standard';

    return {
        action: 'create',
        playerName: opts.playerName || '',
        mode: mode,
        seed: skirmish.seed,
        nodeCount: skirmish.nodeCount,
        difficulty: skirmish.difficulty,
        fogEnabled: !!skirmish.fogEnabled,
        rulesMode: skirmish.rulesMode,
        playlist: skirmish.playlist,
        doctrineId: skirmish.doctrineId,
        customMap: mode === 'custom' ? (opts.customMap || null) : null,
    };
}

export function buildJoinRoomRequest(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    return {
        action: 'join',
        playerName: opts.playerName || '',
        roomCode: String(opts.roomCode || '').trim().toUpperCase(),
        reconnectToken: opts.reconnectToken || '',
    };
}

export function resetOnlineRoomState(net, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    net.online = false;
    net.authoritativeEnabled = false;
    net.authoritativeReady = false;
    net.roomCode = '';
    net.players = [];
    net.isHost = false;
    net.localPlayerIndex = 0;
    net.pendingCommands = [];
    net.matchId = '';
    net.lastAppliedSeq = -1;
    net.syncHashSentTick = -1;
    net.syncWarningTick = -99999;
    net.syncWarningText = '';
    net.syncHistory = [];
    net.commandHistory = [];
    net.resyncRequestId = '';
    net.lastSummaryTick = -1;
    net.lastPingWallMs = 0;
    net.resumePending = !!opts.preserveResume;
}

export function applyRoomStateNetState(net, state) {
    state = state && typeof state === 'object' ? state : {};
    net.roomCode = state.code || '';
    net.isHost = !!state.isHost;
    net.players = Array.isArray(state.players) ? state.players : [];
    net.pendingJoin = false;
    net.resumePending = false;
}

export function buildRoomStateMenuPatches(state, fallbackSkirmish) {
    state = state && typeof state === 'object' ? state : {};
    fallbackSkirmish = fallbackSkirmish && typeof fallbackSkirmish === 'object' ? fallbackSkirmish : {};

    var config = state.config && typeof state.config === 'object' ? state.config : null;
    if (!config) return null;

    return {
        skirmish: {
            seed: config.seed || fallbackSkirmish.seed,
            nodeCount: config.nodeCount || fallbackSkirmish.nodeCount,
            difficulty: config.difficulty || fallbackSkirmish.difficulty,
            rulesMode: normalizeRulesetMode(config.rulesMode || 'advanced'),
            playlist: config.playlist || 'standard',
            doctrineId: config.doctrineId || 'auto',
            fogEnabled: config.fogEnabled === true,
        },
        multiplayer: {
            roomType: config.mode === 'daily' ? 'daily' : (config.mode === 'custom' ? 'custom' : 'standard'),
        },
    };
}

export function computeOnlineCommandTick(currentTick, lastPingMs) {
    var rtt = typeof lastPingMs === 'number' && lastPingMs > 0 ? lastPingMs : 180;
    var delayTicks = clampDelayTicks(Math.round((rtt / 2) / 33.33) + 4);
    return currentTick + delayTicks;
}

export function beginOnlineMatch(net, payload, socketId) {
    payload = payload && typeof payload === 'object' ? payload : {};
    var players = Array.isArray(payload.players) ? payload.players : [];

    net.players = players;
    net.pendingJoin = false;
    net.resumePending = false;
    net.matchId = payload.matchId || '';
    net.authoritativeEnabled = payload.authoritative === true;
    net.authoritativeReady = false;
    net.online = true;
    net.pendingCommands = [];
    net.syncDrift = 0;
    net.lastPingTick = 0;
    net.lastAppliedSeq = -1;
    net.syncHashSentTick = -1;
    net.syncWarningTick = -99999;
    net.syncWarningText = '';
    net.syncHistory = [];
    net.commandHistory = [];
    net.resyncRequestId = '';
    net.lastSummaryTick = -1;
    net.lastPingWallMs = 0;

    var self = players.find(function (player) { return player && player.socketId === socketId; });
    net.localPlayerIndex = self ? self.index : 0;

    return {
        players: players,
        localPlayerIndex: net.localPlayerIndex,
        onlineCustomMap: payload.mode === 'custom' && payload.customMap ? normalizeCustomMapConfig(payload.customMap) : null,
    };
}

export function buildOnlineMatchInitOptions(payload, ctx) {
    payload = payload && typeof payload === 'object' ? payload : {};
    ctx = ctx && typeof ctx === 'object' ? ctx : {};
    var players = Array.isArray(ctx.players) ? ctx.players : [];
    var onlineCustomMap = ctx.onlineCustomMap || null;

    return {
        keepTuning: false,
        fogEnabled: !!payload.fogEnabled,
        rulesMode: payload.rulesMode || 'advanced',
        humanCount: Number(payload.humanCount || players.length || 2),
        aiCount: Number(payload.aiCount || 0),
        localPlayerIndex: Number.isFinite(ctx.localPlayerIndex) ? ctx.localPlayerIndex : 0,
        mapFeature: payload.mapFeature || 'none',
        mapMutator: payload.mapMutator || 'auto',
        customMap: onlineCustomMap,
        tuneOverrides: onlineCustomMap ? onlineCustomMap.tuneOverrides || null : null,
        playlist: payload.playlist || 'standard',
        doctrineId: payload.doctrineId || 'auto',
        encounters: payload.encounters || [],
        objectives: payload.objectives || [],
        missionScript: payload.missionScript || null,
        endOnObjectives: payload.endOnObjectives === true,
    };
}

export function buildOnlineMatchStatusText(payload, localPlayerIndex, authoritativeEnabled) {
    payload = payload && typeof payload === 'object' ? payload : {};
    var parts = ['Online maç başladı. Sen P' + (Number(localPlayerIndex) + 1) + ' oldun.'];
    if (payload.mode === 'daily' && payload.challengeTitle) parts.push('Günlük: ' + payload.challengeTitle);
    if (payload.mode === 'custom' && payload.customMapName) parts.push('Custom: ' + payload.customMapName);
    if (authoritativeEnabled) parts.push('Sunucu state senkronu bekleniyor...');
    return parts.join(' | ');
}
