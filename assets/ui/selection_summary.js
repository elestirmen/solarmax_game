/**
 * Selection readout model.
 *
 * The HUD used to concatenate everything it knew about a selection into one
 * pipe-separated sentence ("Forge L2 | Sen | Yükseltme: 96 | Savunma kapalı | ...").
 * That string got longer every time a mechanic was added and was unreadable at a
 * glance - exactly the wrong trade for a live strategy match.
 *
 * This module turns the same information into a structured model - a title, an owner
 * tag, a short list of labelled stats, and at most a couple of notes - so the panel can
 * render a fixed grid whose shape does not change as mechanics come and go. It is pure
 * data in, pure data out: no DOM, no game globals.
 */

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

function pct(value) {
    return Math.round((Number(value) || 0) * 100) + '%';
}

function toStat(label, value, tone) {
    var stat = { label: label, value: String(value) };
    if (tone) stat.tone = tone;
    return stat;
}

function ownerTone(node) {
    if (!node || node.owner < 0) return 'neutral';
    return node.isSelf ? 'self' : 'rival';
}

/** Garrison against the world's ceiling, plus a tone once it is nearly full. */
function garrisonStat(node) {
    var units = Math.max(0, Math.floor(Number(node.units) || 0));
    var maxUnits = Math.max(0, Math.floor(Number(node.maxUnits) || 0));
    if (maxUnits <= 0) return toStat('Garnizon', units);
    var tone = units >= maxUnits ? 'warn' : (units / maxUnits >= 0.9 ? 'notice' : '');
    return toStat('Garnizon', units + '/' + maxUnits, tone);
}

function upgradeStat(upgrade) {
    if (!upgrade) return null;
    if (upgrade.pending) return toStat('Yükseltme', 'L' + upgrade.targetLevel + ' · ' + pct(upgrade.progress), 'notice');
    if (upgrade.maxed) return toStat('Yükseltme', 'Maksimum');
    var value = String(Math.max(0, Math.floor(Number(upgrade.cost) || 0))) + ' birlik';
    return toStat('Yükseltme', value, upgrade.affordable === false ? 'warn' : 'up');
}

/**
 * Build the readout for the current selection.
 *
 * @param {object} opts
 * @param {string} opts.commandMode  Active targeting mode, if any ('flow').
 * @param {Array}  opts.nodes        Selected worlds as plain views (see readme above).
 * @param {object} opts.mechanics    Which systems this match runs.
 * @param {string} opts.idleHint     Copy shown when nothing is selected.
 */
export function buildSelectionSummary(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var fleets = Array.isArray(opts.fleets) ? opts.fleets : [];
    var mechanics = opts.mechanics || {};

    if (opts.commandMode === 'flow') {
        return {
            kind: 'command',
            title: 'Flow hedefi seçiliyor',
            owner: '',
            ownerTone: 'neutral',
            stats: [],
            notes: ['Akışı bağlamak istediğin gezegene tıkla; iptal için Esc.'],
        };
    }

    if (!nodes.length && !fleets.length) {
        return {
            kind: 'empty',
            title: 'Seçim yok',
            owner: '',
            ownerTone: 'neutral',
            stats: [],
            notes: opts.idleHint ? [opts.idleHint] : [],
        };
    }

    // Parked fleets are selectable command sources too, so the readout counts them the
    // same way the context badge does - the two used to disagree whenever a marquee
    // caught a staging fleet.
    if (!nodes.length) return fleetOnlySummary(fleets);
    if (nodes.length === 1 && !fleets.length) return singleNodeSummary(nodes[0], mechanics);
    return multiNodeSummary(nodes, fleets, mechanics);
}

function fleetShipTotal(fleets) {
    var total = 0;
    for (var i = 0; i < fleets.length; i++) total += Math.max(0, Math.floor(Number(fleets[i] && fleets[i].count) || 0));
    return total;
}

function fleetOnlySummary(fleets) {
    return {
        kind: 'fleets',
        title: fleets.length === 1 ? 'Park filosu' : (fleets.length + ' park filosu'),
        owner: 'Sen',
        ownerTone: 'self',
        stats: [toStat('Birlik', String(fleetShipTotal(fleets)))],
        notes: ['Park filoları bölgeyi tutar; tedarik dışında kalırsa yavaşça erir.'],
    };
}

function singleNodeSummary(node, mechanics) {
    node = node || {};
    var stats = [];
    var notes = [];

    stats.push(garrisonStat(node));

    if (mechanics.upgrades && node.upgrade) {
        var upgrade = upgradeStat(node.upgrade);
        if (upgrade) stats.push(upgrade);
    }

    if (mechanics.assimilation && node.assimilation !== null && node.assimilation !== undefined && node.assimilation < 1) {
        stats.push(toStat('Asimilasyon', pct(clamp(node.assimilation, 0, 1)), 'notice'));
    }

    if (mechanics.flow && node.isSelf) {
        stats.push(toStat('Tedarik', node.supplied ? 'Bağlı' : 'Kopuk', node.supplied ? 'up' : 'warn'));
    }

    if (mechanics.defense && node.isSelf) {
        // The stat is listed whenever the match runs defence mode, even before the world
        // has ever been toggled - an absent row would read as "this world can't defend".
        var defense = node.defense || { on: false };
        stats.push(toStat('Savunma', defense.on ? 'Açık' : 'Kapalı', defense.on ? 'up' : ''));
        if (defense.on) {
            notes.push('Savunma açık: dayanıklılık ve asimilasyon artar, üretim ve flow çıkışı düşer.');
        }
        if (defense.field && defense.field.active) {
            stats.push(toStat('Güç alanı', 'r' + Math.round(defense.field.range) + ' · ' + defense.field.dps.toFixed(1) + '/s'));
        }
    }

    if (node.gate) {
        notes.push(node.gate.open
            ? 'GATE açık: bariyerin diğer tarafına geçiş serbest.'
            : 'GATE: ele geçir ve asimilasyonu bitir, geçiş ondan sonra açılır.');
    }
    if (node.encounterName) notes.push(node.encounterName + ' burada.');
    if (node.pulse) notes.push('Stratejik pulse şu an bu gezegeni besliyor.');
    else if (node.strategic) notes.push('Stratejik merkez: pulse döngüsü buraya geldiğinde üretim ve hız bonusu verir.');
    if (node.mutatorName) notes.push(node.mutatorName + ' etki alanı içinde.');

    var levelText = node.level > 1 ? ' · Seviye ' + node.level : '';
    return {
        kind: 'single',
        title: (node.kindLabel || 'Gezegen') + levelText,
        owner: node.ownerLabel || '',
        ownerTone: ownerTone(node),
        stats: stats,
        notes: notes.slice(0, 2),
    };
}

function multiNodeSummary(nodes, fleets, mechanics) {
    fleets = Array.isArray(fleets) ? fleets : [];
    var owned = nodes.filter(function (node) { return node && node.isSelf; });
    var selectedText = nodes.length + ' gezegen' + (fleets.length ? (' + ' + fleets.length + ' filo') : '');
    var stats = [toStat('Seçili', selectedText)];
    var notes = [];

    if (!owned.length) {
        return {
            kind: 'multi',
            title: selectedText + ' seçili',
            owner: 'Sana ait değil',
            ownerTone: 'neutral',
            stats: stats,
            notes: ['Yalnızca kendi gezegenlerinden filo gönderebilirsin.'],
        };
    }

    var units = 0;
    var maxUnits = 0;
    for (var i = 0; i < owned.length; i++) {
        units += Math.max(0, Math.floor(Number(owned[i].units) || 0));
        maxUnits += Math.max(0, Math.floor(Number(owned[i].maxUnits) || 0));
    }
    stats.push(toStat('Toplam garnizon', maxUnits > 0 ? units + '/' + maxUnits : String(units)));
    if (fleets.length) stats.push(toStat('Park filosu', String(fleetShipTotal(fleets))));

    if (mechanics.upgrades) {
        var pending = owned.filter(function (node) { return node.upgrade && node.upgrade.pending; }).length;
        var upgradeable = owned.filter(function (node) { return node.upgrade && !node.upgrade.pending && !node.upgrade.maxed; });
        if (pending) stats.push(toStat('Yükseliyor', String(pending), 'notice'));
        if (upgradeable.length) {
            var minCost = Infinity;
            var maxCost = 0;
            for (var u = 0; u < upgradeable.length; u++) {
                var cost = Math.max(0, Math.floor(Number(upgradeable[u].upgrade.cost) || 0));
                if (cost < minCost) minCost = cost;
                if (cost > maxCost) maxCost = cost;
            }
            stats.push(toStat('Yükseltme', minCost === maxCost ? (minCost + ' birlik') : (minCost + '–' + maxCost + ' birlik'), 'up'));
        } else if (!pending) {
            stats.push(toStat('Yükseltme', 'Maksimum'));
        }
    }

    if (mechanics.flow) {
        var supplied = owned.filter(function (node) { return node.supplied === true; }).length;
        stats.push(toStat('Tedarik', supplied + '/' + owned.length, supplied === owned.length ? 'up' : 'warn'));
    }

    var gates = owned.filter(function (node) { return node.gate && node.gate.open; }).length;
    if (gates > 0) notes.push(gates + ' açık GATE elinde.');

    return {
        kind: 'multi',
        title: selectedText + ' seçili',
        owner: owned.length === nodes.length ? 'Tümü senin' : (owned.length + ' tanesi senin'),
        ownerTone: 'self',
        stats: stats,
        notes: notes.slice(0, 2),
    };
}

/**
 * Global match state as a chip list - barrier, mutator, pulse, doctrine, encounters.
 *
 * These used to be appended to the selection sentence, which meant world state and
 * selection state competed for the same line and neither was readable. They belong
 * together with the other always-on match information instead.
 */
export function buildWorldStatusChips(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var chips = [];

    if (opts.pulse && opts.pulse.active) {
        chips.push({
            id: 'pulse',
            label: 'Pulse',
            value: opts.pulse.ownerLabel ? (opts.pulse.ownerLabel + ' · ' + opts.pulse.seconds + ' sn') : (opts.pulse.seconds + ' sn'),
            tone: opts.pulse.isSelf ? 'up' : 'warn',
            title: opts.pulse.detail || '',
        });
    }

    var barrier = opts.barrier;
    if (barrier && Array.isArray(barrier.gates) && barrier.gates.length) {
        var open = barrier.gates.filter(function (gate) { return gate && gate.open; }).length;
        chips.push({
            id: 'barrier',
            label: 'Bariyer',
            value: open > 0 ? (open + '/' + barrier.gates.length + ' geçit açık') : 'Kapalı',
            tone: open > 0 ? 'up' : 'warn',
            title: barrier.gates.map(function (gate) {
                return gate.label + ': ' + gate.statusText;
            }).join(' · '),
        });
    }

    if (opts.mutatorName) {
        chips.push({ id: 'mutator', label: 'Mutatör', value: opts.mutatorName, tone: 'notice', title: opts.mutatorDetail || '' });
    }

    var encounters = Array.isArray(opts.encounters) ? opts.encounters : [];
    for (var i = 0; i < encounters.length; i++) {
        var encounter = encounters[i] || {};
        chips.push({
            id: 'encounter-' + i,
            label: encounter.name || 'Karşılaşma',
            value: encounter.ownerLabel || '',
            tone: encounter.isSelf ? 'up' : 'notice',
            title: encounter.statusText || '',
        });
    }

    if (opts.doctrine && opts.doctrine.label) {
        chips.push({
            id: 'doctrine',
            label: opts.doctrine.label,
            value: opts.doctrine.statusText || '',
            tone: opts.doctrine.active ? 'up' : '',
            title: opts.doctrine.tradeLine || '',
        });
    }

    return chips;
}
