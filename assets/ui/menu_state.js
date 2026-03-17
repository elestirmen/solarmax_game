import { doctrineName } from '../sim/doctrine.js';
import { playlistName } from '../sim/playlists.js';
import { normalizeRulesetMode } from '../sim/ruleset.js';

export var MENU_PANEL_META = {
    hub: { title: '', copy: '' },
    single_customize: { title: 'Oyunu Özelleştir', copy: 'Serbest maç ayarları ikinci katmanda durur; hızlı başlat akışından ayrıdır.' },
    content: { title: 'Senaryo ve Challenge', copy: 'Kampanya ve günlük challenge aynı panelde toplanır; serbest maç ayarlarından ayrıdır.' },
    multiplayer: { title: 'Çok Oyunculu', copy: 'İlk ekranda yalnızca nick, oda listesi, oda kur ve koda katıl akışı görünür.' },
    host_setup: { title: 'Oda Kurulumu', copy: 'Host ayarları ayrı açılır; standard room varsayımları shared menu state üzerinden korunur.' },
    tools: { title: 'Araçlar', copy: 'Özel harita, liderlik ve yardım ana oyun başlatma akışından ayrıldı.' },
};

export function clampMenuNodeCount(value) {
    var count = Math.floor(Number(value));
    if (!Number.isFinite(count)) count = 16;
    return Math.max(8, Math.min(30, count));
}

export function normalizeMenuDifficulty(value) {
    return value === 'easy' || value === 'hard' ? value : 'normal';
}

export function normalizeMenuRulesMode(value) {
    return normalizeRulesetMode(value || 'advanced');
}

export function normalizeMenuPlaylist(value) {
    var raw = value === null || value === undefined ? '' : String(value).trim();
    return raw || 'standard';
}

export function normalizeMenuDoctrine(value) {
    var raw = value === null || value === undefined ? '' : String(value).trim();
    return raw || 'auto';
}

export function normalizeMenuRoomType(value) {
    return value === 'daily' || value === 'custom' ? value : 'standard';
}

export function normalizeMenuSeed(value) {
    var raw = value === null || value === undefined ? '' : String(value).trim();
    return raw || '42';
}

export function normalizeMenuPanel(panel) {
    if (panel === 'quick_start') return 'hub';
    return MENU_PANEL_META[panel] ? panel : 'hub';
}

export function menuRulesModeLabel(mode) {
    return normalizeMenuRulesMode(mode) === 'classic' ? 'Klasik' : 'Gelişmiş';
}

export function menuDifficultyLabel(diff) {
    if (diff === 'easy') return 'Kolay';
    if (diff === 'hard') return 'Zor';
    return 'Normal';
}

export function menuDoctrineMenuLabel(doctrineId) {
    if (!doctrineId || doctrineId === 'auto') return 'Doktrin Otomatik';
    return doctrineName(doctrineId);
}

export function menuBackTarget(panel) {
    return panel === 'host_setup' ? 'multiplayer' : 'hub';
}

export function buildMenuHeroSummary(skirmish) {
    var state = skirmish && typeof skirmish === 'object' ? skirmish : {};
    var seed = normalizeMenuSeed(state.seed);
    var difficulty = normalizeMenuDifficulty(state.difficulty);
    var playlist = playlistName(state.playlist || 'standard');
    var doctrine = menuDoctrineMenuLabel(state.doctrineId);
    var rulesMode = menuRulesModeLabel(state.rulesMode);
    var fogLabel = state.fogEnabled ? 'Sis Açık' : 'Sis Kapalı';

    return {
        seedChip: 'Seed ' + seed,
        playlistChip: playlist,
        doctrineChip: doctrine,
        modeChip: rulesMode,
        fogChip: fogLabel,
        quickStatus: 'Hızlı başlat | ' + clampMenuNodeCount(state.nodeCount) + ' node | ' + menuDifficultyLabel(difficulty) + ' | ' + playlist + ' | ' + doctrine,
        stagePlaylistLabel: 'OYUN LISTESI // ' + String(playlist).toUpperCase(),
        stageDoctrineLabel: 'DOKTRIN // ' + String(doctrine).toUpperCase(),
    };
}

export function createInitialMenuState(values) {
    values = values && typeof values === 'object' ? values : {};
    var skirmish = values.skirmish && typeof values.skirmish === 'object' ? values.skirmish : {};
    var multiplayer = values.multiplayer && typeof values.multiplayer === 'object' ? values.multiplayer : {};

    return {
        panel: normalizeMenuPanel(values.panel || 'hub'),
        skirmish: {
            seed: normalizeMenuSeed(skirmish.seed),
            nodeCount: clampMenuNodeCount(skirmish.nodeCount),
            difficulty: normalizeMenuDifficulty(skirmish.difficulty),
            playlist: normalizeMenuPlaylist(skirmish.playlist),
            doctrineId: normalizeMenuDoctrine(skirmish.doctrineId),
            rulesMode: normalizeMenuRulesMode(skirmish.rulesMode),
            fogEnabled: !!skirmish.fogEnabled,
        },
        multiplayer: {
            playerName: String(multiplayer.playerName || '').trim(),
            joinCode: String(multiplayer.joinCode || '').trim().toUpperCase(),
            roomType: normalizeMenuRoomType(multiplayer.roomType),
        },
    };
}

export function buildMenuLobbyMeta(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var roomCode = String(opts.roomCode || '').trim().toUpperCase();
    if (roomCode) return 'Canlı oda // ' + roomCode;
    if (opts.connected === false) return 'Sunucuya bağlanılıyor';
    var roomCount = Math.max(0, Math.floor(Number(opts.roomCount) || 0));
    if (!roomCount) return 'Henüz açık oda yok';
    return roomCount + ' aktif oda tarandı';
}
