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
        var empty = createTextElement(doc, 'div', 'room-list-empty', opts.connected ? 'Henuz oda yok.' : 'Sunucuya baglaniliyor...');
        container.appendChild(empty);
        return;
    }

    var frag = doc.createDocumentFragment();
    for (var i = 0; i < rooms.length; i++) {
        var room = rooms[i] || {};
        var item = createTextElement(doc, 'div', 'room-item');
        var main = createTextElement(doc, 'div', 'room-item-main');
        var code = createTextElement(doc, 'span', 'room-item-code', room.code || '-----');
        var metaText = (room.hostName || 'Host') +
            ' | ' + (room.players || 0) + '/' + (room.maxPlayers || 0) +
            ' | ' + (room.difficulty || 'normal') +
            ' | ' + (room.nodeCount || 0) + ' node' +
            ' | ' + (room.rulesMode || 'advanced');
        var meta = createTextElement(doc, 'span', 'room-item-meta', metaText);
        var joinBtn = createTextElement(doc, 'button', 'room-join-btn secondary-btn', 'Katil');
        joinBtn.type = 'button';
        joinBtn.setAttribute('data-room-code', room.code || '');

        main.appendChild(code);
        main.appendChild(meta);
        item.appendChild(main);
        item.appendChild(joinBtn);
        frag.appendChild(item);
    }
    container.appendChild(frag);
}

export function renderLeaderboardUI(container, list) {
    if (!container) return;
    var doc = container.ownerDocument || document;
    clearElement(container);

    if (!list || list.length === 0) {
        container.textContent = 'Henuz veri yok.';
        return;
    }

    var frag = doc.createDocumentFragment();
    for (var i = 0; i < list.length; i++) {
        var entry = list[i] || {};
        var row = createTextElement(doc, 'div', 'leaderboard-row');
        row.textContent = (i + 1) + '. ' + (entry.name || '?') + ' - ' + (entry.wins || 0) + ' galibiyet (' + (entry.games || 0) + ' mac)';
        frag.appendChild(row);
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
