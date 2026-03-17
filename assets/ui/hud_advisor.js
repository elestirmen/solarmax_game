function makeCard(tone, title, body) {
    return { tone: tone, title: title, body: body };
}

export function buildHudAdvisorCard(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};

    if (opts.commandMode === 'flow') {
        return makeCard('accent', 'FLOW Hazır', 'Kaynaklarını bağlamak için hedef node seç. Boş alana tıklarsan komut modu kapanır.');
    }

    if (opts.selectedOwnedUnassimilated) {
        return makeCard('warning', 'Yeni Fetih', 'Bu node henüz oturmadı. Kısa süre defense aç, garnizonu boşaltma ve asimilasyon bitmeden ileri hatta fazla birlik çekme.');
    }

    if (opts.holdingFleetSelected) {
        return makeCard('accent', 'Park Filo', 'Bu grup staging için ideal. Nodea tekrar fırlatabilir veya boş alana taşıyıp kuşatma hattını yeniden kurabilirsin.');
    }

    if (opts.selectedOwnedUnsupplied) {
        return makeCard('warning', 'Supply Zayıf', 'Seçili node supply dışında. Önce bağlantı kur; aksi halde üretim düşer ve upgrade daha pahalı kalır.');
    }

    if ((Number(opts.capPressure) || 0) > 0.82) {
        return makeCard('warning', 'Cap Strain', 'Birlik kapasiten doluyor. Stok bekletmek yerine cepheye it, flow aç veya upgrade ile yükü erit.');
    }

    if (opts.primaryObjectiveLabel) {
        var objectiveBody = (opts.primaryObjectiveProgress ? (opts.primaryObjectiveLabel + ' | ' + opts.primaryObjectiveProgress) : opts.primaryObjectiveLabel);
        if (opts.primaryObjectiveCoach) objectiveBody += ' | ' + opts.primaryObjectiveCoach;
        return makeCard('objective', opts.primaryObjectiveTitle || 'Öncelikli Hedef', objectiveBody);
    }

    if (opts.mapFeatureType === 'barrier' && (Number(opts.readyGateCount) || 0) <= 0) {
        return makeCard('objective', 'Barrier', 'Karşı tarafa geçiş için önce GATE nodeunu ele geçir ve asimilasyonun tamamlanmasını bekle.');
    }

    if (opts.pulseOwnedActive) {
        return makeCard('accent', 'Pulse Penceresi', 'Pulse sende. Bu kısa pencerede üretim, hız ve asimilasyon bonusunu kullanıp ikinci hattı kır.');
    }

    if ((Number(opts.tick) || 0) < 600) {
        return makeCard('info', 'Açılış Planı', 'Yakın nötr node ile ekonomiyi büyüt, yeni fetihte defense kullan ve ilk relay, wormhole ya da gate hattını erkenden oku.');
    }

    if ((Number(opts.encounterCount) || 0) > 0) {
        return makeCard('objective', 'Encounter', 'Haritadaki özel hedefleri okumadan genişleme. Relay Core ve Mega Turret maç temposunu değiştirir.');
    }

    return null;
}
