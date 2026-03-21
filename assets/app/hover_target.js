export function canvasToViewportPoint(screenPos, canvasRect, canvasSize) {
    screenPos = screenPos && typeof screenPos === 'object' ? screenPos : {};
    canvasRect = canvasRect && typeof canvasRect === 'object' ? canvasRect : {};
    canvasSize = canvasSize && typeof canvasSize === 'object' ? canvasSize : {};

    var screenX = Number(screenPos.x) || 0;
    var screenY = Number(screenPos.y) || 0;
    var rectLeft = Number(canvasRect.left) || 0;
    var rectTop = Number(canvasRect.top) || 0;
    var rectWidth = Math.max(1, Number(canvasRect.width) || 0);
    var rectHeight = Math.max(1, Number(canvasRect.height) || 0);
    var canvasWidth = Math.max(1, Number(canvasSize.width) || 0);
    var canvasHeight = Math.max(1, Number(canvasSize.height) || 0);

    return {
        x: rectLeft + screenX * (rectWidth / canvasWidth),
        y: rectTop + screenY * (rectHeight / canvasHeight),
    };
}

export function worldToScreenPoint(point, camera, viewport) {
    point = point && typeof point === 'object' ? point : {};
    camera = camera && typeof camera === 'object' ? camera : {};
    viewport = viewport && typeof viewport === 'object' ? viewport : {};

    var zoom = Number(camera.zoom) || 1;
    var width = Number(viewport.width) || 0;
    var height = Number(viewport.height) || 0;

    return {
        x: ((Number(point.x) || 0) - (Number(camera.x) || 0)) * zoom + width * 0.5,
        y: ((Number(point.y) || 0) - (Number(camera.y) || 0)) * zoom + height * 0.5,
    };
}

export function findHoveredNodeAtScreen(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};

    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var screenPos = opts.screenPos && typeof opts.screenPos === 'object' ? opts.screenPos : {};
    var camera = opts.camera && typeof opts.camera === 'object' ? opts.camera : {};
    var viewport = opts.viewport && typeof opts.viewport === 'object' ? opts.viewport : {};
    var visibilityTest = typeof opts.visibilityTest === 'function' ? opts.visibilityTest : null;

    var pointerX = Number(screenPos.x);
    var pointerY = Number(screenPos.y);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return null;

    var zoom = Math.max(0.01, Number(camera.zoom) || 1);
    var extraRadius = Math.max(0, Number(opts.extraRadius) || 0);
    var minRadius = Math.max(0, Number(opts.minRadius) || 0);
    var radiusScaleFn = typeof opts.radiusScaleFn === 'function' ? opts.radiusScaleFn : null;
    var bestNode = null;
    var bestDistSq = Infinity;

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || !node.pos) continue;
        if (visibilityTest && !visibilityTest(node)) continue;

        var screenNode = worldToScreenPoint(node.pos, camera, viewport);
        var radiusScale = radiusScaleFn ? Math.max(1, Number(radiusScaleFn(node)) || 1) : 1;
        var radius = Math.max(minRadius, (Number(node.radius) || 0) * radiusScale * zoom + extraRadius);
        var dx = pointerX - screenNode.x;
        var dy = pointerY - screenNode.y;
        var distSq = dx * dx + dy * dy;
        if (distSq > radius * radius) continue;
        if (distSq >= bestDistSq) continue;
        bestNode = node;
        bestDistSq = distSq;
    }

    return bestNode;
}
