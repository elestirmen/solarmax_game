export var HUD_ACTION_HELP_DEFAULT = 'Komutların üzerine gel: kısayol ve kısa açıklama burada görünür.';

var NODE_TYPE_TIPS = {
    core: 'Referans tip: üretim, savunma ve kapasite dengeli. Öğrenme ve genel cephe için güvenli varsayılan.',
    forge: 'Üretim yüksek; savunma ve kapasite biraz zayıf. Ekonomiyi büyütür, tek başına kalınca çabuk düşer.',
    bulwark: 'Kalın garnizon ve yüksek kapasite; üretim nispeten düşük. Dar geçit ve kuşatmayı emmek için ideal.',
    relay: 'Akış (flow) ve filo hızı güçlü. Uzun hatta takviye ve hızlı cephe taşıması için omurga düğümü.',
    nexus: 'Hibrit bonus: biraz üretim, savunma, akış ve kapasite. Esnek orta oyun ve yedek “iyi her şey” köşesi.',
    gate: 'Bariyer kapısı. Çizginin üstünde durur; ele geçirildiğinde senin filoların için sınır hattını açar.',
    turret: 'Üretmez; menzil içindeki düşmanı otomatik vurur. Saldırıdan önce çevreyi temizle, tek dalga ile deneme.',
};

var NODE_TYPE_LABELS = {
    core: 'Core',
    forge: 'Forge',
    bulwark: 'Bulwark',
    relay: 'Relay',
    nexus: 'Nexus',
    gate: 'Gate',
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
    var touchMode = opts.coarsePointer === true;

    if (opts.commandMode === 'flow') {
        if (touchMode) {
            return 'Flow: hedef gezegene dokun, bağlantıyı aç veya kapat. İptal için boş alana dokun.';
        }
        return 'Flow: hedef gezegene tıkla, bağlantıyı aç veya kapat. İptal için boş alana tıkla.';
    }
    if (!nodeCount && !fleetCount) {
        if (touchMode) {
            return 'Kendi gezegenine dokunarak seç. Kamerayı taşımak ve zoom için iki parmak kullan. Savunma ve flow alttaki komutlarda.';
        }
        return 'Sol tıkla kendi gezegenini seç. Sağ tık: savunma veya flow. Boş uzaya bırakınca park filosu oluşur.';
    }
    if (fleetCount && !nodeCount) {
        if (touchMode) {
            return 'Park filosu seçili: hedefe dokunarak gönder veya boş noktaya taşı. Gerekirse başka kaynakları da seçip toplu gönder.';
        }
        return 'Park filosu seçili: hedefe sol tıkla gönder veya boş noktaya taşı (staging). Shift ile çoklu seçim.';
    }
    if (ownedCount > 1 || fleetCount > 1) {
        if (touchMode) {
            return 'Çoklu seçim hazır: hedef gezegene dokunarak gönder. Savunma ve flow için alttaki komutları kullan.';
        }
        return 'Çoklu seçim: hedefe sol tıkla gönder. Sağ tıkla savunma (kendi dünya) veya flow (düşman/tarafsız).';
    }
    if (ownedCount === 1) {
        if (touchMode) {
            return 'Kaynak hazır: hedef gezegene dokunarak gönderim yap. Yükseltme, savunma ve flow alttaki komutlarda.';
        }
        return 'Kaynak hazır: hedefe sol tıkla gönderim yap. Sağ tık bu dünyada savunmayı açar veya kapatır.';
    }
    if (nodeCount > 0) {
        if (touchMode) {
            return 'Bu dünya senin değil. Emir vermek için önce kendi gezegenine veya park filona dokun.';
        }
        return 'Bu dünya senin değil. Emir için önce kendi gezegenini veya park filonu seç.';
    }
    if (touchMode) {
        return 'Gönderim oranını alttaki yüzde düğmeleri veya kaydırıcıyla değiştir; seçiliyken sürükleyerek toplu gönder.';
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
