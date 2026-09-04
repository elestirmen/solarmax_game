import { garrisonDefenseStrength } from '../sim/combat_math.js';
import { computeSendCount, toSendFraction } from '../sim/dispatch_math.js';

/**
 * Defence the order is actually up against, read from the sim's own formula.
 * `attackMult` folds in the attacker's doctrine and dominance bonuses so the ratio the
 * player is shown is the ratio the fight will use.
 */
function forecastRatio(sendUnits, target, attackMult, tuneDef) {
    var defenseUnits = Math.max(0, Math.round(garrisonDefenseStrength({ node: target, tuneDef: tuneDef })));
    var attackStrength = sendUnits * (Number(attackMult) > 0 ? Number(attackMult) : 1);
    return {
        defenseUnits: defenseUnits,
        ratio: defenseUnits > 0 ? attackStrength / defenseUnits : (sendUnits > 0 ? 3 : 0),
    };
}

export function buildDispatchForecast(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var sourceGroups = Array.isArray(opts.sourceGroups) ? opts.sourceGroups : [];
    var pct = toSendFraction(opts.sendPct);
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

    var forecast = forecastRatio(sendUnits, target, opts.attackMult, opts.tuneDef);
    var defenseUnits = forecast.defenseUnits;
    var ratio = forecast.ratio;
    // The capture threshold is ratio > 1 exactly, so the bands sit around it: below 1 the
    // attack cannot take the world at all, and 1.0-1.15 wins it with almost nothing left.
    var tone = 'danger';
    var label = 'YETERSİZ';
    if (ratio >= 1.35) {
        tone = 'advantage';
        label = 'AVANTAJLI';
    } else if (ratio > 1) {
        tone = 'warning';
        label = 'KIL PAYI';
    }
    return {
        tone: tone,
        label: label,
        summary: sendUnits + ' saldırı · ' + defenseUnits + ' savunma',
        sendUnits: sendUnits,
        defenseUnits: defenseUnits,
        ratio: ratio,
    };
}
