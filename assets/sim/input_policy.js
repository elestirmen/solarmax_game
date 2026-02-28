export function shouldStartDragSend(opts) {
    opts = opts || {};
    var downOnOwnedNode = !!opts.downOnOwnedNode;
    var movedPx = Number(opts.movedPx);
    var thresholdPx = Number(opts.thresholdPx);

    if (!Number.isFinite(movedPx)) movedPx = 0;
    if (!Number.isFinite(thresholdPx) || thresholdPx < 0) thresholdPx = 0;

    return downOnOwnedNode && movedPx >= thresholdPx;
}

export function resolveRightClickAction(opts) {
    opts = opts || {};
    var targetExists = !!opts.targetExists;
    var targetOwnerIsHuman = !!opts.targetOwnerIsHuman;
    var targetSelected = !!opts.targetSelected;
    var selectedOwnedCount = Math.max(0, Math.floor(Number(opts.selectedOwnedCount) || 0));

    if (!targetExists) return 'none';

    if (targetOwnerIsHuman) {
        if (selectedOwnedCount > 0 && !targetSelected) return 'flow';
        return 'defense';
    }

    if (selectedOwnedCount > 0) return 'flow';
    return 'none';
}
