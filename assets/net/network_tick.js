export function isOnlinePingDue(currentTick, lastPingTick, intervalTicks) {
    var now = Math.floor(Number(currentTick) || 0);
    var last = Math.floor(Number(lastPingTick) || 0);
    var interval = Math.max(1, Math.floor(Number(intervalTicks) || 45));
    return !last || now - last >= interval;
}

export function computeOnlineSimSpeed(syncDrift) {
    var drift = Number(syncDrift);
    if (!Number.isFinite(drift)) return 1.0;
    if (drift > 30) return 0.1;
    if (drift > 10) return 0.5;
    if (drift > 3) return 0.85;
    if (drift < -90) return 10.0;
    if (drift < -30) return 4.0;
    if (drift < -10) return 2.0;
    if (drift < -3) return 1.15;
    return 1.0;
}

export function consumePendingNetworkCommands(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var queue = Array.isArray(opts.pendingCommands) ? opts.pendingCommands.slice() : [];
    var currentTick = Math.floor(Number(opts.currentTick) || 0);
    var matchId = opts.matchId || '';
    var lastAppliedSeq = Math.floor(Number(opts.lastAppliedSeq));
    if (!Number.isFinite(lastAppliedSeq)) lastAppliedSeq = -1;

    queue.sort(function (a, b) {
        var tickDelta = ((a && a.tick) || 0) - ((b && b.tick) || 0);
        if (tickDelta !== 0) return tickDelta;
        return (((a && a.seq) || 0) - ((b && b.seq) || 0));
    });

    var dueCommands = [];
    var remainingCommands = [];
    for (var i = 0; i < queue.length; i++) {
        var cmd = queue[i];
        if (!cmd) continue;
        if (cmd.matchId && matchId && cmd.matchId !== matchId) continue;
        if ((cmd.tick || 0) <= currentTick + 1) {
            if (typeof cmd.seq === 'number' && cmd.seq <= lastAppliedSeq) continue;
            dueCommands.push(cmd);
            if (typeof cmd.seq === 'number') lastAppliedSeq = cmd.seq;
        } else {
            remainingCommands.push(cmd);
        }
    }

    return {
        dueCommands: dueCommands,
        remainingCommands: remainingCommands,
        lastAppliedSeq: lastAppliedSeq,
    };
}
