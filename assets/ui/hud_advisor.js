function makeCard(tone, title, body) {
    return { tone: tone, title: title, body: body };
}

export function buildHudAdvisorCard(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};

    if (opts.commandMode === 'flow') {
        return makeCard('accent', 'Flow hedefi', 'Bağlamak istediğin gezegene tıkla. Vazgeçmek için boş alana dokun.');
    }

    if (opts.selectedOwnedUnassimilated) {
        return makeCard('warning', 'Yeni fetih', 'Asimilasyon oturana kadar kısa savunma aç, garnizonu eritme; tamamlanınca flow veya ileri hat.');
    }

    if (opts.holdingFleetSelected) {
        return makeCard('accent', 'Park filosu', 'Kuşatma öncesi birikim için uygun. Tekrar bir dünyaya gönder veya boşlukta konum değiştir.');
    }

    if (opts.selectedOwnedUnsupplied) {
        return makeCard('warning', 'Tedarik dışı', 'Bu dünya omurgaya bağlı değil; üretim düşer. Önce zinciri kapat, sonra yükselt.');
    }

    if ((Number(opts.capPressure) || 0) > 0.82) {
        return makeCard('warning', 'Kapasite doluyor', 'Birikmiş birlik ekonomiyi boğuyor. Cepheye it, flow aç veya seviye yükselt.');
    }

    if (opts.primaryObjectiveLabel) {
        var objectiveBody = (opts.primaryObjectiveProgress ? (opts.primaryObjectiveLabel + ' | ' + opts.primaryObjectiveProgress) : opts.primaryObjectiveLabel);
        if (opts.primaryObjectiveCoach) objectiveBody += ' | ' + opts.primaryObjectiveCoach;
        return makeCard('objective', opts.primaryObjectiveTitle || 'Görev', objectiveBody);
    }

    if (opts.mapFeatureType === 'barrier' && (Number(opts.readyGateCount) || 0) <= 0) {
        return makeCard('objective', 'Bariyer', 'Karşı sahaya geçmek için GATE düğümünü al ve asimilasyonun bitmesini bekle.');
    }

    if (opts.pulseOwnedActive) {
        return makeCard('accent', 'Stratejik pulse', 'Kısa bonus penceresi: üretim ve tempo avantajını kullanıp ikinci hatı kır.');
    }

    if ((Number(opts.tick) || 0) < 600) {
        return makeCard('info', 'İlk dakikalar', 'Yakın nötrü al, yeni fetihte savunmayı unutma; relay, solucan deliği veya kapı hattını erken oku.');
    }

    if ((Number(opts.encounterCount) || 0) > 0) {
        return makeCard('objective', 'Özel hedefler', 'Relay Core ve Mega Turret gibi işaretler maç ritmini değiştirir; genişlemeden önce oku.');
    }

    return null;
}
