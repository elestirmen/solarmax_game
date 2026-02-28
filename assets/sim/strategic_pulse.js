export function getStrategicPulseState(opts) {
    opts = opts || {};
    var strategicNodeIds = Array.isArray(opts.strategicNodeIds) ? opts.strategicNodeIds : [];
    var tick = Math.max(0, Math.floor(Number(opts.tick) || 0));
    var cycleTicks = Math.max(1, Math.floor(Number(opts.cycleTicks) || 540));
    var activeTicks = Math.max(1, Math.min(cycleTicks, Math.floor(Number(opts.activeTicks) || 300)));
    var seed = Math.abs(Math.floor(Number(opts.seed) || 0));

    if (!strategicNodeIds.length) {
        return {
            active: false,
            nodeId: -1,
            cycle: 0,
            phase: 0,
            remainingTicks: 0,
        };
    }

    var cycle = Math.floor(tick / cycleTicks);
    var phase = tick % cycleTicks;
    var offset = seed % strategicNodeIds.length;
    var nodeId = strategicNodeIds[(cycle + offset) % strategicNodeIds.length];
    var active = phase < activeTicks;
    var remainingTicks = active ? (activeTicks - phase) : (cycleTicks - phase);

    return {
        active: active,
        nodeId: Number(nodeId),
        cycle: cycle,
        phase: phase,
        remainingTicks: remainingTicks,
    };
}

export function isStrategicPulseActiveForNode(nodeId, pulseState) {
    return !!pulseState && pulseState.active === true && Number(pulseState.nodeId) === Number(nodeId);
}
