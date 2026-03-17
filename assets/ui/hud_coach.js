function coachItem(key, text) {
    return { key: key, text: text };
}

export function buildHudCoachItems(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var nodeCount = Math.max(0, Math.floor(Number(opts.nodeCount) || 0));
    var fleetCount = Math.max(0, Math.floor(Number(opts.fleetCount) || 0));
    var ownedCount = Math.max(0, Math.floor(Number(opts.ownedCount) || 0));
    var sendPct = Math.max(10, Math.min(100, Math.round(Number(opts.sendPct) || 50)));

    if (opts.commandMode === 'flow') {
        return [
            coachItem('SOL', 'Hedef node seç'),
            coachItem('BOŞ', 'Boşa tıklayıp iptal et'),
            coachItem('%' + sendPct, 'Flow dalga oranı hazır'),
        ];
    }

    if (!nodeCount && !fleetCount) {
        return [
            coachItem('SOL', 'Bir node seç'),
            coachItem('SHIFT', 'Çoklu seçime ekle'),
            coachItem('1-0', 'Gönderim %' + sendPct),
        ];
    }

    if (fleetCount && !nodeCount) {
        return [
            coachItem('SOL', 'Nodea tekrar fırlat'),
            coachItem('BOŞ', 'Park hattını taşı'),
            coachItem('SHIFT', 'Filoya seçim ekle'),
        ];
    }

    if (ownedCount > 1 || fleetCount > 1) {
        return [
            coachItem('SOL', 'Toplu gönder'),
            coachItem('SAĞ', 'Flow ya da savunma'),
            coachItem('%' + sendPct, 'Aktif gönderim oranı'),
        ];
    }

    if (ownedCount === 1) {
        return [
            coachItem('SOL', 'Hedefe birlik gönder'),
            coachItem('SAĞ', 'Defense veya flow'),
            coachItem('U', 'Upgrade dene'),
        ];
    }

    if (nodeCount > 0) {
        return [
            coachItem('SHIFT', 'Kendi nodeunu seçime ekle'),
            coachItem('A', 'Tüm node\'larını seç'),
            coachItem('%' + sendPct, 'Hazır gönderim oranı'),
        ];
    }

    return [
        coachItem('SOL', 'Komut başlat'),
        coachItem('SAĞ', 'Alternatif emir'),
        coachItem('%' + sendPct, 'Gönderim oranı'),
    ];
}

export function renderHudCoach(container, items) {
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(items) || !items.length) return;

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
