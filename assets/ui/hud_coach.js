function coachItem(key, text) {
    return { key: key, text: text };
}

export function buildHudCoachItems(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var nodeCount = Math.max(0, Math.floor(Number(opts.nodeCount) || 0));
    var fleetCount = Math.max(0, Math.floor(Number(opts.fleetCount) || 0));
    var ownedCount = Math.max(0, Math.floor(Number(opts.ownedCount) || 0));
    var sendPct = Math.max(10, Math.min(100, Math.round(Number(opts.sendPct) || 50)));
    var touchMode = opts.coarsePointer === true;

    if (opts.commandMode === 'flow') {
        return [
            coachItem(touchMode ? 'DOKUN' : 'SOL', 'Hedef gezegen: flow'),
            coachItem('BOŞ', 'İptal'),
            coachItem('%' + sendPct, 'Dalga gücü'),
        ];
    }

    if (!nodeCount && !fleetCount) {
        if (touchMode) {
            return [
                coachItem('DOKUN', 'Gezegen seç'),
                coachItem('2 PARMAK', 'Kamera / zoom'),
                coachItem('%' + sendPct, 'Gönderim oranı'),
            ];
        }
        return [
            coachItem('SOL', 'Gezegen seç'),
            coachItem('SHIFT', 'Seçime ekle'),
            coachItem('1–0', 'Gönder %' + sendPct),
        ];
    }

    if (fleetCount && !nodeCount) {
        if (touchMode) {
            return [
                coachItem('DOKUN', 'Hedefe gönder'),
                coachItem('BOŞ', 'Konumu taşı'),
                coachItem('%' + sendPct, 'Gönderim oranı'),
            ];
        }
        return [
            coachItem('SOL', 'Hedefe gönder'),
            coachItem('BOŞ', 'Konumu taşı'),
            coachItem('SHIFT', 'Filo ekle'),
        ];
    }

    if (ownedCount > 1 || fleetCount > 1) {
        if (touchMode) {
            return [
                coachItem('DOKUN', 'Toplu gönder'),
                coachItem('KOMUT', 'Savunma / flow'),
                coachItem('%' + sendPct, 'Gönderim oranı'),
            ];
        }
        return [
            coachItem('SOL', 'Toplu gönder'),
            coachItem('SAĞ', 'Savunma / flow'),
            coachItem('%' + sendPct, 'Gönderim oranı'),
        ];
    }

    if (ownedCount === 1) {
        if (touchMode) {
            return [
                coachItem('DOKUN', 'Hedefe gönder'),
                coachItem('KOMUT', 'Savunma / flow'),
                coachItem('%' + sendPct, 'Gönderim oranı'),
            ];
        }
        return [
            coachItem('SOL', 'Gönder'),
            coachItem('SAĞ', 'Savunma veya flow'),
            coachItem('U', 'Yükselt'),
        ];
    }

    if (nodeCount > 0) {
        if (touchMode) {
            return [
                coachItem('DOKUN', 'Kendi gezegenini seç'),
                coachItem('KOMUT', 'Kaynak eylemleri'),
                coachItem('%' + sendPct, 'Gönderim oranı'),
            ];
        }
        return [
            coachItem('SHIFT', 'Kendi dünyanı ekle'),
            coachItem('A', 'Hepsini seç'),
            coachItem('%' + sendPct, 'Oran %' + sendPct),
        ];
    }

    return [
        coachItem('SOL', 'Başlat'),
        coachItem('SAĞ', 'Alternatif'),
        coachItem('%' + sendPct, '%' + sendPct + ' gönder'),
    ];
}

export function renderHudCoach(container, items) {
    if (!container) return;
    items = Array.isArray(items) ? items : [];
    var renderKey = items.map(function (item) { return (item && item.key || '') + ':' + (item && item.text || ''); }).join('|');
    if (container.dataset && container.dataset.coachKey === renderKey) return;
    if (container.dataset) container.dataset.coachKey = renderKey;
    container.replaceChildren();
    if (!items.length) return;

    var doc = container.ownerDocument || document;
    var frag = doc.createDocumentFragment();
    for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        var chip = doc.createElement('div');
        chip.className = 'hud-coach-chip';

        var key = doc.createElement('span');
        key.className = 'hud-coach-key';
        key.textContent = item.key || '';

        var text = doc.createElement('span');
        text.className = 'hud-coach-text';
        text.textContent = item.text || '';

        chip.appendChild(key);
        chip.appendChild(text);
        frag.appendChild(chip);
    }
    container.appendChild(frag);
}
