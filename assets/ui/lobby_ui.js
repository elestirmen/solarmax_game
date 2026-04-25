import { playlistName } from '../sim/playlists.js';

function createTextElement(doc, tagName, className, text) {
    var el = doc.createElement(tagName);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = '' + text;
    return el;
}

function setHidden(node, hidden) {
    if (!node) return;
    node.classList.toggle('hidden', !!hidden);
}

export function setRoomStatusState(node, message, tone) {
    if (!node) return;
    node.textContent = message || '';
    node.classList.remove('info', 'error', 'success');
    node.classList.add(tone === 'error' || tone === 'success' ? tone : 'info');
}

export function renderRoomPlayers(container, players, hostId) {
    if (!container) return;
    container.replaceChildren();
    if (!players || players.length === 0) return;

    for (var i = 0; i < players.length; i++) {
        var player = players[i] || {};
        var el = createTextElement(container.ownerDocument || document, 'span', 'room-player' + (player.socketId === hostId ? ' host' : ''), (player.name || '?') + (player.socketId === hostId ? ' (Host)' : ''));
        container.appendChild(el);
    }
}

export function getLobbyControlState(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var inRoom = !!opts.inRoom;
    var playerCount = Math.max(0, Math.floor(Number(opts.playerCount) || 0));

    return {
        disablePlayerName: inRoom,
        startDisabled: !inRoom || !opts.connected || playerCount < 2,
        startLabel: 'Oyunu Başlat',
        showRoomList: !inRoom,
        showCreateRoom: !inRoom,
        showHostSetup: !inRoom,
        showJoinCode: !inRoom,
        showHostControls: inRoom && !!opts.isHost,
        showLeaveRoom: inRoom,
    };
}

export function applyLobbyControlState(elements, state) {
    elements = elements && typeof elements === 'object' ? elements : {};
    state = state && typeof state === 'object' ? state : {};

    if (elements.playerNameInput) elements.playerNameInput.disabled = !!state.disablePlayerName;
    if (elements.startRoomButton) {
        elements.startRoomButton.disabled = !!state.startDisabled;
        elements.startRoomButton.textContent = state.startLabel || 'Oyunu Başlat';
    }
    setHidden(elements.roomList, !state.showRoomList);
    setHidden(elements.createRoomButton, !state.showCreateRoom);
    setHidden(elements.hostSetupButton, !state.showHostSetup);
    setHidden(elements.joinCodeRow, !state.showJoinCode);
    setHidden(elements.hostControls, !state.showHostControls);
    setHidden(elements.leaveRoomButton, !state.showLeaveRoom);
}

export function buildLobbyListStatus(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    if (!opts.connected) return 'Sunucuya bağlanılıyor...';
    var roomCount = Math.max(0, Math.floor(Number(opts.roomCount) || 0));
    if (!roomCount) return 'Henüz oda yok. Oda Kur ile yeni oda oluştur veya arkadaşından oda kodu al.';
    return roomCount + ' oda mevcut. Birine katıl veya yeni oda kur.';
}

export function buildRoomStatusSummary(state, opts) {
    state = state && typeof state === 'object' ? state : {};
    opts = opts && typeof opts === 'object' ? opts : {};

    var playerCount = Math.max(0, Math.floor(Number(opts.playerCount) || 0));
    var maxPlayers = Math.max(playerCount, Math.floor(Number(state.maxPlayers) || 0));
    var parts = ['Oda: ' + (state.code || '-----') + ' | ' + playerCount + '/' + maxPlayers + ' oyuncu'];
    var preview = state.preview && typeof state.preview === 'object' ? state.preview : null;

    if (preview && preview.mode === 'daily') {
        parts.push('Günlük: ' + ((preview.challengeTitle || '') + (preview.challengeKey ? (' (' + preview.challengeKey + ')') : '')).trim());
        if (preview.aiCount) parts.push('AI ' + preview.aiCount);
    } else if (preview && preview.mode === 'custom') {
        parts.push('Özel: ' + (preview.customMapName || 'Harita'));
        parts.push('Slot ' + (preview.playerCount || maxPlayers || playerCount));
        if (preview.aiCount) parts.push('AI ' + preview.aiCount);
    } else if (preview) {
        parts.push(playlistName(preview.playlist || 'standard'));
    }

    if (playerCount < 2) parts.push('En az 2 oyuncu gerekli');
    else parts.push(opts.isHost ? 'Oyunu başlatabilirsin' : 'Hostun başlatması bekleniyor...');
    return parts.join(' | ');
}
