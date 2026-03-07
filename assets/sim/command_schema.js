export var COMMAND_TYPES = ['send', 'flow', 'rmFlow', 'upgrade', 'toggleDefense'];
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

export function sanitizeCommandData(type, rawData, opts) {
    rawData = rawData && typeof rawData === 'object' ? rawData : {};
    opts = opts || {};
    var nodeListLimit = Math.max(1, Math.floor(Number(opts.nodeListLimit) || 30));

    if (!ALLOWED_COMMAND_TYPES.has(type)) return null;

    if (type === 'send') {
        var sources = sanitizeNodeIdList(rawData.sources, nodeListLimit);
        var targetId = sanitizeNodeId(rawData.tgtId !== undefined ? rawData.tgtId : rawData.targetId);
        var pctRaw = Number(rawData.pct !== undefined ? rawData.pct : rawData.percent);
        if (sources.length === 0 || targetId === null || !Number.isFinite(pctRaw)) return null;
        return {
            sources: sources,
            tgtId: targetId,
            pct: Math.max(0.05, Math.min(1, pctRaw)),
        };
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
