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

export function mechanicsProgressionInfo(preset) {
    var normalized = normalizeMechanicsPreset(preset);
    var labels = {
        primitive: { title: 'TEMEL FETİH', unlock: 'Standart gezegenler · üretim · filo · fetih' },
        anomaly: { title: 'ANOMALİLER AÇILDI', unlock: 'Solucan deliği ve özel harita yapıları' },
        logistics: { title: 'LOJİSTİK AÇILDI', unlock: 'Otomatik flow hatları ve rota ekonomisi' },
        economy: { title: 'EKONOMİ AÇILDI', unlock: 'Gezegen sınıfları ve yükseltmeler' },
        frontier: { title: 'CEPHE SİSTEMLERİ AÇILDI', unlock: 'Savunma, asimilasyon ve güç alanları' },
        advanced: { title: 'TAM SPEKTRUM', unlock: 'Stratejik pulse, doktrinler ve küresel olaylar' },
    };
    return Object.assign({ preset: normalized }, labels[normalized]);
}
