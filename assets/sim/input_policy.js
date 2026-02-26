export function shouldStartDragSend(opts) {
    opts = opts || {};
    var downOnOwnedNode = !!opts.downOnOwnedNode;
    var movedPx = Number(opts.movedPx);
    var thresholdPx = Number(opts.thresholdPx);

    if (!Number.isFinite(movedPx)) movedPx = 0;
    if (!Number.isFinite(thresholdPx) || thresholdPx < 0) thresholdPx = 0;

    return downOnOwnedNode && movedPx >= thresholdPx;
}
