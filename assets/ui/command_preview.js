import { computeSendCount } from '../sim/dispatch_math.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function targetDefenseEstimate(target) {
    target = target && typeof target === 'object' ? target : {};
    var units = Math.max(0, Math.floor(Number(target.units) || 0));
    var level = Math.max(1, Math.floor(Number(target.level) || 1));
    var multiplier = 1 + (level - 1) * 0.08;
    if (target.defense) multiplier *= 1.22;
    if (target.kind === 'bulwark') multiplier *= 1.16;
    if (target.kind === 'turret') multiplier *= 1.42;
    return Math.max(0, Math.round(units * multiplier));
}

export function buildDispatchForecast(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var sourceGroups = Array.isArray(opts.sourceGroups) ? opts.sourceGroups : [];
    var pctRaw = Number(opts.sendPct);
    var pct = Number.isFinite(pctRaw) ? (pctRaw > 1 ? pctRaw / 100 : pctRaw) : 0.5;
    pct = clamp(pct, 0.05, 1);
    var sendUnits = Math.max(0, Math.floor(Number(opts.fleetUnits) || 0));
    for (var i = 0; i < sourceGroups.length; i++) {
        var group = sourceGroups[i] || {};
        sendUnits += computeSendCount({
            srcUnits: group.units,
            pct: pct,
            flowMult: Number(group.flowMult) || 1,
        }).sendCount;
    }

    var target = opts.target && typeof opts.target === 'object' ? opts.target : null;
    if (opts.blocked) {
        return { tone: 'blocked', label: 'GEÇİŞ KAPALI', summary: 'Emir bariyer tarafından engelleniyor', sendUnits: sendUnits, defenseUnits: 0, ratio: 0 };
    }
    if (!target) {
        return { tone: 'move', label: sendUnits + ' BİRLİK', summary: 'Park konumuna gönder', sendUnits: sendUnits, defenseUnits: 0, ratio: 1 };
    }

    var humanIndex = Math.floor(Number(opts.humanIndex) || 0);
    if (target.owner === humanIndex) {
        var capacity = Math.max(0, Math.floor(Number(target.capacity !== undefined ? target.capacity : target.maxUnits) || 0));
        var room = capacity > 0 ? Math.max(0, capacity - Math.floor(Number(target.units) || 0) - Math.max(0, Math.floor(Number(opts.incomingFriendlyUnits) || 0))) : sendUnits;
        var accepted = Math.min(sendUnits, room);
        if (accepted <= 0) {
            return { tone: 'blocked', label: 'HEDEF DOLU', summary: 'Bu gezegen daha fazla takviye alamıyor', sendUnits: 0, defenseUnits: 0, ratio: 0 };
        }
        return { tone: 'friendly', label: 'TAKVİYE +' + accepted, summary: accepted + ' birlik dost garnizona katılır', sendUnits: accepted, defenseUnits: 0, ratio: 1 };
    }

    var defenseUnits = targetDefenseEstimate(target);
    var ratio = defenseUnits > 0 ? sendUnits / defenseUnits : (sendUnits > 0 ? 3 : 0);
    var tone = 'danger';
    var label = 'ZAYIF';
    if (ratio >= 1.35) {
        tone = 'advantage';
        label = 'AVANTAJLI';
    } else if (ratio >= 0.9) {
        tone = 'warning';
        label = 'RİSKLİ';
    }
    return {
        tone: tone,
        label: label,
        summary: sendUnits + ' saldırı · ~' + defenseUnits + ' savunma',
        sendUnits: sendUnits,
        defenseUnits: defenseUnits,
        ratio: ratio,
    };
}
