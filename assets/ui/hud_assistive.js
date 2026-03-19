export var HUD_ACTION_HELP_DEFAULT = 'Komutların üstüne gel: ne yaptıkları ve kısayolları burada görünür.';

var NODE_TYPE_TIPS = {
    core: 'Dengeli temel gezegen. Güvenli açılışlar ve genel amaçlı cepheler için uygundur.',
    forge: 'Üretimi yüksek ama savunması zayıf. Ekonomiyi hızlandırır, yalnız kalırsa çabuk düşer.',
    bulwark: 'Savunma ve kapasite odaklıdır. Dar boğaz tutmak ve kuşatma emmek için idealdir.',
    relay: 'Akış ve filo hızı güçlüdür. Takviye hattı kurmak ve cepheyi hızlı çevirmek için kullan.',
    nexus: 'Her alanda hafif bonus veren hibrit gezegendir. Esnek orta oyun nodu olarak öne çıkar.',
    turret: 'Üretim yapmaz; menzile giren düşmana otomatik ateş eder. Saldırıdan önce çevresi temizlenmelidir.',
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

    if (opts.commandMode === 'flow') return 'FLOW hedefi';
    if (!nodeCount && !fleetCount) return opts.online ? 'Canlı maç' : 'Hazır';
    if (fleetCount && !nodeCount) return fleetCount > 1 ? (fleetCount + ' park filo') : 'Park filo';
    if (nodeCount + fleetCount > 1) return (nodeCount + fleetCount) + ' seçim';
    if (nodeCount === 1 && opts.selectedNodeLabel) return String(opts.selectedNodeLabel);
    return 'Seçim';
}

export function buildHudHintText(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var nodeCount = Math.max(0, Math.floor(Number(opts.nodeCount) || 0));
    var fleetCount = Math.max(0, Math.floor(Number(opts.fleetCount) || 0));
    var ownedCount = Math.max(0, Math.floor(Number(opts.ownedCount) || 0));

    if (opts.commandMode === 'flow') return 'FLOW modu: hedef gezegene tıkla. Boş alana tıklarsan komut modu kapanır.';
    if (!nodeCount && !fleetCount) return 'Sol tıkla bir gezegen seç. Sağ tık flow veya savunma açar; boş uzaya bırakmak park filo kurar.';
    if (fleetCount && !nodeCount) return 'Park filo seçili: hedef node\'a tıkla ya da boş noktaya bırakıp staging hattını taşı.';
    if (ownedCount > 1 || fleetCount > 1) return 'Toplu emir hazır: hedefe sol tıkla, sağ tıkla flow veya savunma kullan, boşluğa bırakıp staging kur.';
    if (ownedCount === 1) return 'Seçili node hazır: hedefe sol tıkla birlik gönder, sağ tıkla flow veya defense değiştir.';
    if (nodeCount > 0) return 'Bu node sana ait değil. Emir vermek için önce kendi bir node veya park filo seç.';
    return 'Seçimi hedefe sürükle ya da kısa yol tuşlarıyla gönderim yüzdesini değiştir.';
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
