export var HUD_ACTION_HELP_DEFAULT = 'Komutların üzerine gel: kısayol ve kısa açıklama burada görünür.';

var NODE_TYPE_TIPS = {
    core: 'Referans tip: üretim, savunma ve kapasite dengeli. Öğrenme ve genel cephe için güvenli varsayılan.',
    forge: 'Üretim yüksek; savunma ve kapasite biraz zayıf. Ekonomiyi büyütür, tek başına kalınca çabuk düşer.',
    bulwark: 'Kalın garnizon ve yüksek kapasite; üretim nispeten düşük. Dar geçit ve kuşatmayı emmek için ideal.',
    relay: 'Akış (flow) ve filo hızı güçlü. Uzun hatta takviye ve hızlı cephe taşıması için omurga düğümü.',
    nexus: 'Hibrit bonus: biraz üretim, savunma, akış ve kapasite. Esnek orta oyun ve yedek “iyi her şey” köşesi.',
    turret: 'Üretmez; menzil içindeki düşmanı otomatik vurur. Saldırıdan önce çevreyi temizle, tek dalga ile deneme.',
};

var NODE_TYPE_LABELS = {
    core: 'Core',
    forge: 'Forge',
    bulwark: 'Bulwark',
    relay: 'Relay',
    nexus: 'Nexus',
    turret: 'Turret',
};

export function buildHudContextBadge(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var nodeCount = Math.max(0, Math.floor(Number(opts.nodeCount) || 0));
    var fleetCount = Math.max(0, Math.floor(Number(opts.fleetCount) || 0));

    if (opts.commandMode === 'flow') return 'Flow hedefi seçiliyor';
    if (!nodeCount && !fleetCount) return opts.online ? 'Canlı maç' : 'Hazır — kaynak seç';
    if (fleetCount && !nodeCount) return fleetCount > 1 ? (fleetCount + ' park filosu') : 'Park filosu';
    if (nodeCount + fleetCount > 1) return (nodeCount + fleetCount) + ' öğe seçili';
    if (nodeCount === 1 && opts.selectedNodeLabel) return String(opts.selectedNodeLabel);
    return 'Seçim';
}

export function buildHudHintText(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var nodeCount = Math.max(0, Math.floor(Number(opts.nodeCount) || 0));
    var fleetCount = Math.max(0, Math.floor(Number(opts.fleetCount) || 0));
    var ownedCount = Math.max(0, Math.floor(Number(opts.ownedCount) || 0));

    if (opts.commandMode === 'flow') {
        return 'Flow: hedef gezegene tıkla, bağlantıyı aç veya kapat. İptal için boş alana tıkla.';
    }
    if (!nodeCount && !fleetCount) {
        return 'Sol tıkla kendi gezegenini seç. Sağ tık: savunma veya flow. Boş uzaya bırakınca park filosu oluşur.';
    }
    if (fleetCount && !nodeCount) {
        return 'Park filosu seçili: hedefe sol tıkla gönder veya boş noktaya taşı (staging). Shift ile çoklu seçim.';
    }
    if (ownedCount > 1 || fleetCount > 1) {
        return 'Çoklu seçim: hedefe sol tıkla gönder. Sağ tıkla savunma (kendi dünya) veya flow (düşman/tarafsız).';
    }
    if (ownedCount === 1) {
        return 'Kaynak hazır: hedefe sol tıkla gönderim yap. Sağ tık bu dünyada savunmayı açar veya kapatır.';
    }
    if (nodeCount > 0) {
        return 'Bu dünya senin değil. Emir için önce kendi gezegenini veya park filonu seç.';
    }
    return 'Gönderim oranını 1–0 tuşları veya slider ile değiştir; Ctrl+sürükleyerek toplu gönder.';
}

export function buildNodeHoverTip(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var kind = typeof opts.kind === 'string' ? opts.kind : 'core';
    var title = opts.label ? String(opts.label) : (NODE_TYPE_LABELS[kind] || NODE_TYPE_LABELS.core);
    return {
        title: title,
        body: NODE_TYPE_TIPS[kind] || NODE_TYPE_TIPS.core,
    };
}
