export var COMMAND_TYPES = ['send', 'flow', 'rmFlow', 'upgrade', 'toggleDefense', 'activateDoctrine'];
export var ALLOWED_COMMAND_TYPES = new Set(COMMAND_TYPES);

export function toFiniteInt(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
}

export function sanitizeNodeId(value) {
    var n = toFiniteInt(value);
    if (n === null || n < 0) return null;
    return n;
}

export function sanitizeNodeIdList(value, limit) {
    if (!Array.isArray(value)) return [];
    limit = Math.max(1, Math.floor(Number(limit) || 30));
    var seen = {};
    var result = [];
    for (var i = 0; i < value.length; i++) {
        var id = sanitizeNodeId(value[i]);
        if (id === null || seen[id]) continue;
        seen[id] = true;
        result.push(id);
        if (result.length >= limit) break;
    }
    return result;
}

export function sanitizeFiniteCoord(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1000) / 1000;
}

export function sanitizePointTarget(value) {
    value = value && typeof value === 'object' ? value : {};
    var x = sanitizeFiniteCoord(value.x);
    var y = sanitizeFiniteCoord(value.y);
    if (x === null || y === null) return null;
    return { x: x, y: y };
}

export function sanitizeFleetIdList(value, limit) {
    return sanitizeNodeIdList(value, limit);
}

export function sanitizeCommandData(type, rawData, opts) {
    rawData = rawData && typeof rawData === 'object' ? rawData : {};
    opts = opts || {};
    var nodeListLimit = Math.max(1, Math.floor(Number(opts.nodeListLimit) || 30));

    if (!ALLOWED_COMMAND_TYPES.has(type)) return null;

    if (type === 'send') {
        var sources = sanitizeNodeIdList(rawData.sources, nodeListLimit);
        var fleetIds = sanitizeFleetIdList(rawData.fleetIds, nodeListLimit);
        var targetId = sanitizeNodeId(rawData.tgtId !== undefined ? rawData.tgtId : rawData.targetId);
        var targetPoint = sanitizePointTarget(rawData.targetPoint !== undefined ? rawData.targetPoint : rawData.point);
        var pctRaw = Number(rawData.pct !== undefined ? rawData.pct : rawData.percent);
        if ((sources.length === 0 && fleetIds.length === 0) || (targetId === null && !targetPoint) || !Number.isFinite(pctRaw)) return null;
        var result = {
            sources: sources,
            fleetIds: fleetIds,
            pct: Math.max(0.05, Math.min(1, pctRaw)),
        };
        if (targetId !== null) result.tgtId = targetId;
        else result.targetPoint = targetPoint;
        return result;
    }

    if (type === 'flow' || type === 'rmFlow') {
        var srcId = sanitizeNodeId(rawData.srcId !== undefined ? rawData.srcId : rawData.sourceId);
        var tgtId = sanitizeNodeId(rawData.tgtId !== undefined ? rawData.tgtId : rawData.targetId);
        if (srcId === null || tgtId === null || srcId === tgtId) return null;
        return { srcId: srcId, tgtId: tgtId };
    }

    if (type === 'upgrade' || type === 'toggleDefense') {
        var nodeIds = sanitizeNodeIdList(rawData.nodeIds, nodeListLimit);
        if (nodeIds.length > 0) return { nodeIds: nodeIds };

        var nodeId = sanitizeNodeId(rawData.nodeId);
        if (nodeId === null) return null;
        return { nodeId: nodeId };
    }

    if (type === 'activateDoctrine') {
        return {};
    }

    return null;
}

export function sanitizeCommandPayload(payload, opts) {
    payload = payload && typeof payload === 'object' ? payload : {};
    var type = String(payload.type || '');
    if (!ALLOWED_COMMAND_TYPES.has(type)) return null;
    var data = sanitizeCommandData(type, payload.data || {}, opts);
    if (!data) return null;
    return {
        type: type,
        data: data,
    };
}
