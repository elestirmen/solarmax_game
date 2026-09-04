var MECHANICS_PRESETS = {
    primitive: {
        preset: 'primitive',
        nodeTypes: false,
        upgrades: false,
        flow: false,
        defense: false,
        assimilation: false,
        territory: false,
        strategicPulse: false,
        doctrines: false,
        solarFlare: false,
        encounters: false,
    },
    anomaly: {
        preset: 'anomaly',
        nodeTypes: false,
        upgrades: false,
        flow: false,
        defense: false,
        assimilation: false,
        territory: false,
        strategicPulse: false,
        doctrines: false,
        solarFlare: false,
        encounters: false,
    },
    logistics: {
        preset: 'logistics',
        nodeTypes: false,
        upgrades: false,
        flow: true,
        defense: false,
        assimilation: false,
        territory: false,
        strategicPulse: false,
        doctrines: false,
        solarFlare: false,
        encounters: false,
    },
    economy: {
        preset: 'economy',
        nodeTypes: true,
        upgrades: true,
        flow: true,
        defense: false,
        assimilation: false,
        territory: false,
        strategicPulse: false,
        doctrines: false,
        solarFlare: false,
        encounters: false,
    },
    frontier: {
        preset: 'frontier',
        nodeTypes: true,
        upgrades: true,
        flow: true,
        defense: true,
        assimilation: true,
        territory: true,
        strategicPulse: false,
        doctrines: false,
        solarFlare: false,
        encounters: false,
    },
    advanced: {
        preset: 'advanced',
        nodeTypes: true,
        upgrades: true,
        flow: true,
        defense: true,
        assimilation: true,
        territory: true,
        strategicPulse: true,
        doctrines: true,
        solarFlare: true,
        encounters: true,
    },
};

export function normalizeMechanicsPreset(preset) {
    var value = String(preset || 'advanced').toLowerCase();
    return MECHANICS_PRESETS[value] ? value : 'advanced';
}

export function getMechanicsConfig(preset) {
    var normalized = normalizeMechanicsPreset(preset);
    return Object.assign({}, MECHANICS_PRESETS[normalized]);
}

export function campaignMechanicsPreset(levelIndex) {
    var index = Math.max(0, Math.floor(Number(levelIndex) || 0));
    if (index <= 1) return 'primitive';
    if (index === 2) return 'anomaly';
    if (index <= 4) return 'logistics';
    if (index <= 7) return 'economy';
    if (index === 8) return 'frontier';
    return 'advanced';
}

// Ladder order, simplest first. The campaign walks it one rung at a time; the skirmish
// menu offers the same rungs so a free match can be as spare or as loaded as the player
// wants instead of jumping from "nothing on" straight to "everything on".
export var MECHANICS_LADDER = ['primitive', 'anomaly', 'logistics', 'economy', 'frontier', 'advanced'];

export function mechanicsOptionList() {
    return MECHANICS_LADDER.map(function (preset) {
        var info = mechanicsProgressionInfo(preset);
        return { id: preset, name: info.name, title: info.title, unlock: info.unlock };
    });
}

export function mechanicsProgressionInfo(preset) {
    var normalized = normalizeMechanicsPreset(preset);
    // `title` is the campaign unlock banner; `name` is the short form menus use.
    var labels = {
        primitive: { name: 'Temel Fetih', title: 'TEMEL FETİH', unlock: 'Standart gezegenler · üretim · filo · fetih' },
        anomaly: { name: 'Anomaliler', title: 'ANOMALİLER AÇILDI', unlock: 'Solucan deliği ve özel harita yapıları' },
        logistics: { name: 'Lojistik', title: 'LOJİSTİK AÇILDI', unlock: 'Otomatik flow hatları ve rota ekonomisi' },
        economy: { name: 'Ekonomi', title: 'EKONOMİ AÇILDI', unlock: 'Gezegen sınıfları ve yükseltmeler' },
        frontier: { name: 'Cephe Sistemleri', title: 'CEPHE SİSTEMLERİ AÇILDI', unlock: 'Savunma, asimilasyon ve güç alanları' },
        advanced: { name: 'Tam Spektrum', title: 'TAM SPEKTRUM', unlock: 'Stratejik pulse, doktrinler ve küresel olaylar' },
    };
    return Object.assign({ preset: normalized }, labels[normalized]);
}
