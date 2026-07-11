function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function squaredDistance(a, b) {
    var dx = Number(a.x) - Number(b.x);
    var dy = Number(a.y) - Number(b.y);
    return dx * dx + dy * dy;
}

function resolveCapital(nodes, playerIndex, capitalId) {
    var id = Math.floor(Number(capitalId));
    if (Number.isFinite(id) && nodes[id] && nodes[id].owner === playerIndex) return nodes[id];
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].owner === playerIndex) return nodes[i];
    }
    return nodes[0] || null;
}

export function selectOpeningFocusNodes(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var playerIndex = Math.floor(Number(opts.playerIndex) || 0);
    var capital = resolveCapital(nodes, playerIndex, opts.capitalId);
    if (!capital || !capital.pos) return [];

    var visibleTest = typeof opts.visibleTest === 'function' ? opts.visibleTest : function () { return true; };
    var targetCount = clamp(Math.floor(Number(opts.targetCount) || 3), 1, 8);
    var candidates = [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || node.id === capital.id || !node.pos || !visibleTest(node)) continue;
        candidates.push(node);
    }
    candidates.sort(function (a, b) {
        var ad = squaredDistance(a.pos, capital.pos);
        var bd = squaredDistance(b.pos, capital.pos);
        if (ad !== bd) return ad - bd;
        return Number(a.id) - Number(b.id);
    });

    return [capital].concat(candidates.slice(0, targetCount));
}

export function buildOpeningCamera(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var width = Math.max(240, Number(opts.viewportWidth) || 1280);
    var height = Math.max(320, Number(opts.viewportHeight) || 720);
    var compact = opts.compact === true || width <= 720;
    var focusNodes = selectOpeningFocusNodes({
        nodes: opts.nodes,
        playerIndex: opts.playerIndex,
        capitalId: opts.capitalId,
        visibleTest: opts.visibleTest,
        targetCount: opts.targetCount || (compact ? 3 : 5),
    });
    if (!focusNodes.length) return null;

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < focusNodes.length; i++) {
        var node = focusNodes[i];
        var radius = Math.max(18, Number(node.radius) || 18);
        minX = Math.min(minX, Number(node.pos.x) - radius);
        maxX = Math.max(maxX, Number(node.pos.x) + radius);
        minY = Math.min(minY, Number(node.pos.y) - radius);
        maxY = Math.max(maxY, Number(node.pos.y) + radius);
    }

    var padding = compact ? 76 : 96;
    var bottomReserve = Math.max(0, Number(opts.bottomReserve) || (compact ? 132 : 172));
    var topReserve = Math.max(0, Number(opts.topReserve) || (compact ? 82 : 24));
    var rightReserve = Math.max(0, Number(opts.rightReserve) || (compact ? 12 : 196));
    var leftReserve = Math.max(0, Number(opts.leftReserve) || 12);
    var availableWidth = Math.max(220, width - leftReserve - rightReserve - 24);
    var availableHeight = Math.max(240, height - topReserve - bottomReserve - 24);
    var spanX = Math.max(180, maxX - minX + padding * 2);
    var spanY = Math.max(180, maxY - minY + padding * 2);
    var minZoom = Math.max(0.3, Number(opts.minZoom) || (compact ? 0.42 : 0.5));
    var maxZoom = Math.min(1.25, Number(opts.maxZoom) || (compact ? 0.82 : 1.05));
    var zoom = clamp(Math.min(availableWidth / spanX, availableHeight / spanY), minZoom, maxZoom);
    var centerX = (minX + maxX) * 0.5;
    var centerY = (minY + maxY) * 0.5;

    return {
        x: centerX + (rightReserve - leftReserve) / (2 * zoom),
        y: centerY + (bottomReserve - topReserve) / (2 * zoom),
        zoom: zoom,
        focusNodeIds: focusNodes.map(function (node) { return node.id; }),
    };
}
