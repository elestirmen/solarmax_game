export function applyPlayerCommandWithOps(playerIndex, type, data, ops) {
    data = data || {};
    ops = ops || {};

    if (type === 'send' && typeof ops.send === 'function') {
        return ops.send(playerIndex, data.sources || [], data.tgtId !== undefined ? data.tgtId : data.targetId, data.pct !== undefined ? data.pct : data.percent);
    }
    if (type === 'flow' && typeof ops.flow === 'function') {
        return ops.flow(playerIndex, data.srcId !== undefined ? data.srcId : data.sourceId, data.tgtId !== undefined ? data.tgtId : data.targetId);
    }
    if (type === 'rmFlow' && typeof ops.rmFlow === 'function') {
        return ops.rmFlow(playerIndex, data.srcId !== undefined ? data.srcId : data.sourceId, data.tgtId !== undefined ? data.tgtId : data.targetId);
    }
    if (type === 'upgrade' && typeof ops.upgrade === 'function') {
        if (Array.isArray(data.nodeIds)) {
            for (var ui = 0; ui < data.nodeIds.length; ui++) ops.upgrade(playerIndex, data.nodeIds[ui]);
            return true;
        }
        return ops.upgrade(playerIndex, data.nodeId);
    }
    if (type === 'toggleDefense' && typeof ops.toggleDefense === 'function') {
        if (Array.isArray(data.nodeIds)) {
            for (var di = 0; di < data.nodeIds.length; di++) ops.toggleDefense(playerIndex, data.nodeIds[di]);
            return true;
        }
        return ops.toggleDefense(playerIndex, data.nodeId);
    }
    return false;
}
