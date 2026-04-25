function clearElement(node) {
    if (!node) return;
    node.replaceChildren();
}

function createTextElement(doc, tagName, className, text) {
    var el = doc.createElement(tagName);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = '' + text;
    return el;
}

export function renderRoomListUI(container, rooms, opts) {
    opts = opts || {};
    if (!container) return;

    var doc = container.ownerDocument || document;
    clearElement(container);

    if (!rooms || rooms.length === 0) {
        var empty = createTextElement(doc, 'div', 'room-list-empty', opts.connected ? 'Henüz oda yok.' : 'Sunucuya bağlanılıyor...');
        container.appendChild(empty);
        return;
    }

    var frag = doc.createDocumentFragment();
    var featuredIndex = rooms.length ? 0 : -1;
    for (var i = 0; i < rooms.length; i++) {
        var room = rooms[i] || {};
        var isFeatured = i === featuredIndex;
        var item = createTextElement(doc, 'div', 'room-item' + (isFeatured ? ' room-item-featured' : ''));
        var header = createTextElement(doc, 'div', 'room-item-header');
        var title = createTextElement(doc, 'div', 'room-item-title');
        var main = createTextElement(doc, 'div', 'room-item-main');
        var badges = createTextElement(doc, 'div', 'room-item-badges');
        var code = createTextElement(doc, 'span', 'room-item-code', room.code || '-----');
        var owner = createTextElement(doc, 'div', 'room-item-owner', 'Açan: ' + (room.hostName || 'Host'));
        var featuredBadge = isFeatured ? createTextElement(doc, 'span', 'room-item-pill room-item-pill-featured', 'Açık Oda') : null;
        var slots = createTextElement(doc, 'span', 'room-item-pill', (room.players || 0) + '/' + (room.maxPlayers || 0) + ' oyuncu');
        var modeText = room.mode === 'daily'
            ? ((room.modeLabel || 'Günlük') + (room.challengeKey ? (' ' + room.challengeKey) : ''))
            : (room.mode === 'custom' ? (room.modeLabel || 'Özel') : (room.modeLabel || 'Standart'));
        var mode = createTextElement(doc, 'span', 'room-item-pill', modeText);
        var noteLabel = room.mode === 'custom' ? 'Harita' : (room.mode === 'daily' ? 'Meydan okuma' : '');
        var noteText = room.challengeTitle ? (noteLabel + ': ' + room.challengeTitle) : '';
        var note = noteText ? createTextElement(doc, 'div', 'room-item-note', noteText) : null;
        var joinBtn = createTextElement(doc, 'button', 'room-join-btn' + (isFeatured ? ' room-join-btn-featured' : ''), isFeatured ? 'Odaya Katıl' : 'Katıl');
        joinBtn.type = 'button';
        joinBtn.setAttribute('data-room-code', room.code || '');

        title.appendChild(code);
        title.appendChild(owner);
        if (featuredBadge) badges.appendChild(featuredBadge);
        badges.appendChild(slots);
        badges.appendChild(mode);
        header.appendChild(title);
        header.appendChild(joinBtn);
        main.appendChild(badges);
        item.appendChild(header);
        if (note) main.appendChild(note);
        item.appendChild(main);
        frag.appendChild(item);
    }
    container.appendChild(frag);
}

function renderLeaderboardEntries(doc, container, entries, sectionId) {
    if (!entries || entries.length === 0) {
        container.appendChild(createTextElement(doc, 'div', 'leaderboard-row', 'Henüz veri yok.'));
        return;
    }

    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i] || {};
        var row = createTextElement(doc, 'div', 'leaderboard-row');
        if (sectionId === 'daily') {
            row.textContent = (i + 1) + '. ' + (entry.name || '?') + ' - ' + (entry.bestTick || 0) + ' tick';
            if (entry.clears) row.textContent += ' (' + entry.clears + ' tamamlandı)';
        } else {
            row.textContent = (i + 1) + '. ' + (entry.name || '?') + ' - ' + (entry.wins || 0) + ' galibiyet (' + (entry.games || 0) + ' maç)';
        }
        container.appendChild(row);
    }
}

export function renderLeaderboardUI(container, payload) {
    if (!container) return;
    var doc = container.ownerDocument || document;
    clearElement(container);

    var sections = [];
    if (Array.isArray(payload)) sections = [{ id: 'general', entries: payload }];
    else if (payload && Array.isArray(payload.sections)) sections = payload.sections;
    else if (payload && Array.isArray(payload.list)) sections = [{ id: 'general', entries: payload.list }];

    if (!sections.length) {
        container.textContent = 'Henüz veri yok.';
        return;
    }

    var frag = doc.createDocumentFragment();
    for (var i = 0; i < sections.length; i++) {
        var section = sections[i] || {};
        if (section.title) frag.appendChild(createTextElement(doc, 'div', 'mission-title', section.title));
        if (section.subtitle) frag.appendChild(createTextElement(doc, 'div', 'mission-subtitle', section.subtitle));
        renderLeaderboardEntries(doc, frag, Array.isArray(section.entries) ? section.entries : [], section.id || '');
    }
    container.appendChild(frag);
}

export function renderStatRows(container, rows) {
    if (!container) return;
    var doc = container.ownerDocument || document;
    clearElement(container);

    if (!rows || rows.length === 0) return;

    var frag = doc.createDocumentFragment();
    for (var i = 0; i < rows.length; i++) {
        var rowData = rows[i] || {};
        var row = createTextElement(doc, 'div', 'stats-row' + (rowData.emphasis ? ' emphasis' : ''));
        var label = createTextElement(doc, 'span', 'stats-label', rowData.label || '');
        var value = createTextElement(doc, 'span', 'stats-value', rowData.value || '');
        row.appendChild(label);
        row.appendChild(value);
        frag.appendChild(row);
    }
    container.appendChild(frag);
}

export function renderMissionPanel(container, opts) {
    opts = opts || {};
    if (!container) return;

    var doc = container.ownerDocument || document;
    clearElement(container);

    var title = opts.title || '';
    var subtitle = opts.subtitle || '';
    var items = Array.isArray(opts.items) ? opts.items : [];

    if (title) {
        container.appendChild(createTextElement(doc, 'div', 'mission-title', title));
    }
    if (subtitle) {
        container.appendChild(createTextElement(doc, 'div', 'mission-subtitle', subtitle));
    }
    if (!items.length) return;

    var frag = doc.createDocumentFragment();
    for (var i = 0; i < items.length; i++) {
        var itemData = items[i] || {};
        var rowClass = 'mission-row';
        if (itemData.complete) rowClass += ' complete';
        else if (itemData.failed) rowClass += ' failed';
        if (itemData.optional) rowClass += ' optional';

        var row = createTextElement(doc, 'div', rowClass);
        var label = createTextElement(doc, 'span', 'mission-label', itemData.label || '');
        var progress = createTextElement(doc, 'span', 'mission-progress', itemData.progressText || '');
        row.appendChild(label);
        row.appendChild(progress);
        frag.appendChild(row);
    }
    container.appendChild(frag);
}
