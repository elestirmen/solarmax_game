function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function formatMatchTime(tick, tickRate) {
    var rate = Math.max(1, Number(tickRate) || 30);
    var totalSeconds = Math.max(0, Math.floor((Number(tick) || 0) / rate));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

export function buildTacticalStatus(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var powers = Array.isArray(opts.powers) ? opts.powers : [];
    var humanIndex = Math.max(0, Math.floor(Number(opts.humanIndex) || 0));
    var humanPower = Math.max(0, Number(opts.humanPower !== undefined ? opts.humanPower : powers[humanIndex]) || 0);
    var totalPower = 0;
    for (var i = 0; i < powers.length; i++) totalPower += Math.max(0, Number(powers[i]) || 0);
    var powerShare = totalPower > 0 ? humanPower / totalPower : 0;
    var totalNodes = Math.max(0, Math.floor(Number(opts.totalNodes) || 0));
    var ownedNodes = Math.max(0, Math.floor(Number(opts.ownedNodes) || 0));
    var nodeShare = totalNodes > 0 ? ownedNodes / totalNodes : 0;
    var tick = Math.max(0, Math.floor(Number(opts.tick) || 0));
    var tickRate = Math.max(1, Number(opts.tickRate) || 30);
    var phase = {
        id: 'contested',
        label: 'ÇATIŞMA',
        tone: 'neutral',
        hint: 'Cepheyi genişletirken tedarik hattını koparma.',
    };

    if (tick < tickRate * 25) {
        phase = {
            id: 'opening',
            label: 'AÇILIŞ',
            tone: 'calm',
            hint: 'Yakın nötrleri bağla, ilk üretim omurganı kur.',
        };
    } else if (powerShare <= 0.24) {
        phase = {
            id: 'critical',
            label: 'KRİTİK',
            tone: 'danger',
            hint: 'Cepheyi daralt, savunma ve takviye hattını sabitle.',
        };
    } else if (powerShare >= 0.58 || nodeShare >= 0.55) {
        phase = {
            id: 'dominant',
            label: 'ÜSTÜNLÜK',
            tone: 'success',
            hint: 'Avantajı bekletme; pulse ve flow ile son hattı kır.',
        };
    } else if (powerShare >= 0.4) {
        phase = {
            id: 'pressure',
            label: 'BASKI',
            tone: 'accent',
            hint: 'Tempo sende; zayıf halkaya iki koldan yüklen.',
        };
    }

    return {
        id: phase.id,
        label: phase.label,
        tone: phase.tone,
        hint: phase.hint,
        time: formatMatchTime(tick, tickRate),
        powerShare: clamp(powerShare, 0, 1),
        powerPercent: Math.round(clamp(powerShare, 0, 1) * 100),
        nodeShare: clamp(nodeShare, 0, 1),
    };
}
