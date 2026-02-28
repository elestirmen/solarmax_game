export function computeFriendlyReinforcementRoom(opts) {
    opts = opts || {};
    var targetUnits = Number(opts.targetUnits);
    var targetMaxUnits = Number(opts.targetMaxUnits);
    var incomingUnits = Number(opts.incomingUnits);

    if (!Number.isFinite(targetUnits)) targetUnits = 0;
    if (!Number.isFinite(targetMaxUnits) || targetMaxUnits < 0) targetMaxUnits = 0;
    if (!Number.isFinite(incomingUnits) || incomingUnits < 0) incomingUnits = 0;

    return Math.max(0, Math.floor(targetMaxUnits - targetUnits - incomingUnits));
}

export function resolveFriendlyArrival(opts) {
    opts = opts || {};
    var targetUnits = Number(opts.targetUnits);
    var targetMaxUnits = Number(opts.targetMaxUnits);
    var sourceUnits = Number(opts.sourceUnits);
    var sourceMaxUnits = Number(opts.sourceMaxUnits);
    var fleetCount = Math.max(0, Math.floor(Number(opts.fleetCount) || 0));

    if (!Number.isFinite(targetUnits)) targetUnits = 0;
    if (!Number.isFinite(targetMaxUnits) || targetMaxUnits < 0) targetMaxUnits = 0;
    if (!Number.isFinite(sourceUnits)) sourceUnits = 0;
    if (!Number.isFinite(sourceMaxUnits) || sourceMaxUnits < 0) sourceMaxUnits = 0;

    var targetRoom = Math.max(0, Math.floor(targetMaxUnits - targetUnits));
    var delivered = Math.min(targetRoom, fleetCount);
    targetUnits += delivered;

    var overflow = fleetCount - delivered;
    var sourceRoom = Math.max(0, Math.floor(sourceMaxUnits - sourceUnits));
    var returned = Math.min(sourceRoom, overflow);
    sourceUnits += returned;

    return {
        targetUnits: targetUnits,
        sourceUnits: sourceUnits,
        delivered: delivered,
        returned: returned,
        lost: overflow - returned,
    };
}
