// Turns successive board states into presentation events - "planet 7 changed hands",
// "a fleet slammed into planet 3", "ships were destroyed in open space".
//
// It works purely by comparing the latest state with the previous sample, so it reads a
// locally simulated match and an authoritative network snapshot the same way. That is
// the point: online players get exactly the effects and sounds a local match gets,
// without the server having to ship presentation data it does not otherwise need.

var ARRIVAL_T = 0.85;
var ARRIVAL_RIM_PAD = 34;

export function createFxDirector() {
    return { primed: false, key: '', nodes: {}, fleets: {} };
}

export function resetFxDirector(director) {
    if (!director) return;
    director.primed = false;
    director.key = '';
    director.nodes = {};
    director.fleets = {};
}

function fleetRecord(fleet) {
    return {
        owner: Math.floor(Number(fleet.owner)),
        count: Math.max(0, Math.floor(Number(fleet.count) || 0)),
        tgtId: Math.floor(Number(fleet.tgtId)),
        srcId: Math.floor(Number(fleet.srcId)),
        holding: !!fleet.holding,
        t: Number(fleet.t) || 0,
        x: Number(fleet.x) || 0,
        y: Number(fleet.y) || 0,
        dirX: Number(fleet.headingX) || 0,
        dirY: Number(fleet.headingY) || 0,
    };
}

function nodeAt(nodes, id) {
    if (!Array.isArray(nodes) || !(id >= 0)) return null;
    var node = nodes[id];
    return node && node.pos ? node : null;
}

function normalize(x, y, fallbackX, fallbackY) {
    var len = Math.sqrt(x * x + y * y);
    if (!(len > 0.0001)) return { x: fallbackX || 0, y: fallbackY || 0 };
    return { x: x / len, y: y / len };
}

// Where on the planet's rim a fleet coming from (fromX, fromY) lands.
function rimPoint(node, fromX, fromY) {
    var r = Math.max(4, Number(node.radius) || 18);
    var d = normalize(fromX - node.pos.x, fromY - node.pos.y, -1, 0);
    return { x: node.pos.x + d.x * r * 0.92, y: node.pos.y + d.y * r * 0.92, nx: d.x, ny: d.y };
}

function reachedTarget(record, node) {
    if (record.t >= ARRIVAL_T) return true;
    if (!node) return false;
    var dx = record.x - node.pos.x;
    var dy = record.y - node.pos.y;
    var reach = (Number(node.radius) || 18) + ARRIVAL_RIM_PAD;
    return dx * dx + dy * dy <= reach * reach;
}

/**
 * @param {object} director  state from createFxDirector()
 * @param {object} state     { key, nodes, fleets }
 *   `key` identifies the match; when it changes the director re-primes silently so a
 *   new map never opens with a burst of phantom captures.
 * @returns {Array} events, in the order they should be presented
 */
export function sampleFxDirector(director, state) {
    var events = [];
    if (!director || !state) return events;
    var nodes = Array.isArray(state.nodes) ? state.nodes : [];
    var fleets = Array.isArray(state.fleets) ? state.fleets : [];
    var key = String(state.key || '') + ':' + nodes.length;

    var nextNodes = {};
    for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni];
        if (!node) continue;
        nextNodes[ni] = { owner: Math.floor(Number(node.owner)), units: Math.floor(Number(node.units) || 0) };
    }
    var nextFleets = {};
    for (var fi = 0; fi < fleets.length; fi++) {
        var fleet = fleets[fi];
        if (!fleet || fleet.active === false) continue;
        if (fleet.id === undefined || fleet.id === null) continue;
        nextFleets[fleet.id] = fleetRecord(fleet);
    }

    if (!director.primed || director.key !== key) {
        director.primed = true;
        director.key = key;
        director.nodes = nextNodes;
        director.fleets = nextFleets;
        return events;
    }

    var prevNodes = director.nodes;
    var prevFleets = director.fleets;
    var impactDirByNode = {};
    var launchOrigins = [];

    // Launches first: a holding fleet that shrinks because it just sent ships out is
    // not taking damage, and the only way to tell is to know what launched this frame.
    for (var newId in nextFleets) {
        if (!Object.prototype.hasOwnProperty.call(nextFleets, newId)) continue;
        if (prevFleets[newId]) continue;
        var born = nextFleets[newId];
        if (born.holding || born.t >= 0.3 || born.count <= 0) continue;
        var src = nodeAt(nodes, born.srcId);
        var launchX = src ? src.pos.x + born.dirX * (Number(src.radius) || 18) : born.x;
        var launchY = src ? src.pos.y + born.dirY * (Number(src.radius) || 18) : born.y;
        launchOrigins.push({ x: born.x, y: born.y });
        events.push({
            type: 'launch', owner: born.owner, srcId: born.srcId, tgtId: born.tgtId,
            x: launchX, y: launchY, dirX: born.dirX, dirY: born.dirY, count: born.count,
        });
    }

    function launchedNear(x, y) {
        for (var i = 0; i < launchOrigins.length; i++) {
            var dx = launchOrigins[i].x - x, dy = launchOrigins[i].y - y;
            if (dx * dx + dy * dy < 60 * 60) return true;
        }
        return false;
    }

    function arrivalEvent(record, count) {
        var target = nodeAt(nodes, record.tgtId);
        if (!target) return;
        var prevOwner = prevNodes[record.tgtId] ? prevNodes[record.tgtId].owner : target.owner;
        var backX = record.x - record.dirX * 40;
        var backY = record.y - record.dirY * 40;
        var rim = rimPoint(target, backX, backY);
        var dir = normalize(target.pos.x - backX, target.pos.y - backY, record.dirX, record.dirY);
        if (prevOwner === record.owner) {
            events.push({ type: 'reinforce', nodeId: record.tgtId, owner: record.owner, count: count, x: rim.x, y: rim.y });
            return;
        }
        impactDirByNode[record.tgtId] = dir;
        events.push({
            type: 'impact', nodeId: record.tgtId, owner: record.owner, targetOwner: prevOwner,
            count: count, x: rim.x, y: rim.y, dirX: dir.x, dirY: dir.y,
        });
    }

    for (var id in prevFleets) {
        if (!Object.prototype.hasOwnProperty.call(prevFleets, id)) continue;
        var before = prevFleets[id];
        var now = nextFleets[id];
        if (!now) {
            if (before.count <= 0) continue;
            if (before.holding) {
                // A parked fleet that vanished either launched its last ships or was
                // worn down; only the second is worth a visual.
                if (!launchedNear(before.x, before.y)) {
                    events.push({ type: 'destroyed', owner: before.owner, x: before.x, y: before.y, count: before.count, holding: true });
                }
                continue;
            }
            var target = nodeAt(nodes, before.tgtId);
            if (reachedTarget(before, target)) arrivalEvent(before, before.count);
            else events.push({ type: 'destroyed', owner: before.owner, x: before.x, y: before.y, count: before.count });
            continue;
        }
        var lost = before.count - now.count;
        if (lost <= 0) continue;
        if (now.holding || before.holding) {
            if (!launchedNear(before.x, before.y)) {
                events.push({ type: 'attrition', owner: now.owner, x: now.x, y: now.y, count: lost });
            }
            continue;
        }
        var tgt = nodeAt(nodes, now.tgtId);
        if (reachedTarget(before, tgt) || reachedTarget(now, tgt)) arrivalEvent(before, lost);
        else events.push({ type: 'attrition', owner: now.owner, x: now.x, y: now.y, count: lost });
    }

    for (var nid in nextNodes) {
        if (!Object.prototype.hasOwnProperty.call(nextNodes, nid)) continue;
        var prevNode = prevNodes[nid];
        var nextNode = nextNodes[nid];
        if (!prevNode || prevNode.owner === nextNode.owner) continue;
        var capturedNode = nodes[nid];
        var dir = impactDirByNode[nid] || { x: 0, y: 0 };
        events.push({
            type: 'capture', nodeId: Math.floor(Number(nid)), fromOwner: prevNode.owner, toOwner: nextNode.owner,
            x: capturedNode.pos.x, y: capturedNode.pos.y, radius: Number(capturedNode.radius) || 18,
            dirX: dir.x, dirY: dir.y, units: nextNode.units,
        });
    }

    director.nodes = nextNodes;
    director.fleets = nextFleets;
    return events;
}
