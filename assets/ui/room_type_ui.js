function roomModeHint(roomMode) {
    if (roomMode === 'daily') {
        return 'Günlük oda: harita, oyun listesi ve doktrin günün meydan okuma ayarlarına kilitlenir.';
    }
    if (roomMode === 'custom') {
        return 'Özel oda: yüklenen harita slot, tohum ve karşılaşma düzenini belirler. Önce Araçlar bölümünden harita yükle.';
    }
    return 'Standart oda: tohum, gezegen sayısı, zorluk, oyun listesi ve doktrin host tarafında ortak belirlenir.';
}

export function getRoomTypeUiState(roomMode) {
    var mode = roomMode === 'daily' || roomMode === 'custom' ? roomMode : 'standard';
    var locksMapConfig = mode === 'daily' || mode === 'custom';

    return {
        roomMode: mode,
        disableSeed: locksMapConfig,
        disableNodeCount: locksMapConfig,
        disableDifficulty: locksMapConfig,
        disableRulesMode: locksMapConfig,
        disablePlaylist: mode !== 'standard',
        disableDoctrine: mode !== 'standard',
        nodeLabelOpacity: locksMapConfig ? '0.45' : '1',
        hintText: roomModeHint(mode),
    };
}

export function applyRoomTypeUiState(elements, state) {
    elements = elements && typeof elements === 'object' ? elements : {};
    state = state && typeof state === 'object' ? state : {};

    if (elements.roomTypeSelect && elements.roomTypeSelect.value !== state.roomMode) elements.roomTypeSelect.value = state.roomMode || 'standard';
    if (elements.seedInput) elements.seedInput.disabled = !!state.disableSeed;
    if (elements.nodeInput) elements.nodeInput.disabled = !!state.disableNodeCount;
    if (elements.difficultySelect) elements.difficultySelect.disabled = !!state.disableDifficulty;
    if (elements.rulesModeSelect) elements.rulesModeSelect.disabled = !!state.disableRulesMode;
    if (elements.playlistSelect) elements.playlistSelect.disabled = !!state.disablePlaylist;
    if (elements.doctrineSelect) elements.doctrineSelect.disabled = !!state.disableDoctrine;
    if (elements.nodeLabel) elements.nodeLabel.style.opacity = state.nodeLabelOpacity || '1';
    if (elements.modeHint) elements.modeHint.textContent = state.hintText || '';
}
