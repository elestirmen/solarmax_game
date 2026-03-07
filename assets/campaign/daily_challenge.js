function hashString(input) {
    input = String(input || '');
    var hash = 2166136261 >>> 0;
    for (var i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

function pad2(value) {
    return value < 10 ? ('0' + value) : ('' + value);
}

export function dailyChallengeKey(inputDate) {
    if (typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) return inputDate;
    var date = inputDate instanceof Date ? inputDate : new Date();
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function featureLabel(type) {
    if (type === 'wormhole') return 'Wormhole';
    if (type === 'gravity') return 'Gravity';
    if (type === 'barrier') return 'Barrier';
    return 'Standart';
}

function titleParts(hash) {
    var prefixes = ['Nova', 'Solar', 'Zenith', 'Apex', 'Iron', 'Silent', 'Crimson', 'Vector'];
    var suffixes = ['Drift', 'Front', 'Pulse', 'Siege', 'Relay', 'Breach', 'Orbit', 'Signal'];
    return {
        prefix: prefixes[hash % prefixes.length],
        suffix: suffixes[(hash >>> 3) % suffixes.length],
    };
}

function objectiveForFeature(feature, nodeCount, aiCount, hash) {
    if (feature === 'wormhole') {
        return {
            id: 'daily-wormhole',
            type: 'wormhole_dispatches',
            target: 3 + (hash % 3),
            label: 'Wormhole ile hiz baskisi kur',
            remindAt: 240,
            coach: 'Wormhole cikisini alip ritmik kucuk dalgalar gonder; uzun rota oynama.',
        };
    }
    if (feature === 'barrier') {
        return {
            id: 'daily-gate',
            type: 'gate_captures',
            target: 1,
            label: 'En az 1 GATE ele gecir',
            remindAt: 300,
            coach: 'GATE alinmadan haritanin yari gucu kapali kalir; ilk buyuk hedefi dagitma.',
        };
    }
    if (feature === 'gravity') {
        return {
            id: 'daily-pulse',
            type: 'pulse_control_ticks',
            target: 180 + ((hash % 4) * 30),
            label: 'Merkez pulse hattini tut',
            remindAt: 270,
            coach: 'Gravity alanini kestirme gibi kullan; pulse hub etrafinda hizli donus kur.',
        };
    }
    return {
        id: 'daily-owned',
        type: 'owned_nodes',
        target: Math.max(4, Math.min(nodeCount - 2, 4 + aiCount + (hash % 3))),
        label: 'Harita kontrolunu erkenden kur',
        remindAt: 210,
        coach: 'Ekonomi node\'larini baglayip supply zincirini koparma; ilk 2 genisleme tempoyu belirler.',
    };
}

function secondaryObjective(nodeCount, aiCount, hash) {
    var roll = (hash >>> 5) % 3;
    if (roll === 0) {
        return {
            id: 'daily-flow',
            type: 'flow_links_created',
            target: Math.max(1, Math.min(3, 1 + (aiCount > 2 ? 1 : 0))),
            label: 'Arka ekonomi ile cepheyi flow ile bagla',
            optional: true,
        };
    }
    if (roll === 1) {
        return {
            id: 'daily-upgrade',
            type: 'upgrades',
            target: Math.max(2, Math.min(4, 2 + ((nodeCount + aiCount) % 2))),
            label: 'Ekonomini upgrade ile buyut',
            optional: true,
        };
    }
    return {
        id: 'daily-cap',
        type: 'peak_cap_pressure_below',
        target: aiCount >= 4 ? 1.08 : 1.03,
        label: aiCount >= 4 ? 'Strain zirvesini %108 altinda tut' : 'Straini %103 altinda tut',
        optional: true,
    };
}

export function buildDailyChallenge(inputDate) {
    var key = dailyChallengeKey(inputDate);
    var hash = hashString(key);
    var featureOptions = ['none', 'wormhole', 'gravity', 'barrier'];
    var diffOptions = ['normal', 'normal', 'hard', 'easy'];
    var feature = featureOptions[(hash >>> 8) % featureOptions.length];
    var diff = diffOptions[(hash >>> 10) % diffOptions.length];
    var nodeCount = 12 + ((hash >>> 12) % 11);
    var aiCount = 1 + ((hash >>> 16) % 4);
    var fog = ((hash >>> 20) & 1) === 1 && diff !== 'easy';

    if (feature === 'barrier' && aiCount < 2) aiCount = 2;
    if (diff === 'easy' && aiCount > 2) aiCount = 2;

    var timingBase = diff === 'hard' ? 1260 : diff === 'easy' ? 960 : 1110;
    var parts = titleParts(hash);
    var objectives = [
        objectiveForFeature(feature, nodeCount, aiCount, hash),
        secondaryObjective(nodeCount, aiCount, hash),
        {
            id: 'daily-win',
            type: 'win_before_tick',
            target: timingBase + ((hash >>> 22) % 4) * 90,
            label: 'Gunluk challengei tempolu bitir',
            optional: true,
        },
    ];

    return {
        key: key,
        title: parts.prefix + ' ' + parts.suffix,
        blurb: nodeCount + ' node | ' + aiCount + ' AI | ' + diff.toUpperCase() + ' | ' + featureLabel(feature) + (fog ? ' | Fog' : ''),
        seed: 'daily-' + key,
        nc: nodeCount,
        diff: diff,
        aiCount: aiCount,
        fog: fog,
        mapFeature: feature,
        rulesMode: 'advanced',
        hint: 'Bugunun haritasinda tempo degisimi anomali ve pulse etrafinda kuruluyor. Acilisi ekonomi, ikinci hamleyi pozisyon kazanmak icin kullan.',
        objectives: objectives,
    };
}
