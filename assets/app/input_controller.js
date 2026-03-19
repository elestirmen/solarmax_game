export function createInputState() {
    return {
        sel: new Set(),
        selFleets: new Set(),
        marqActive: false,
        marqStart: { x: 0, y: 0 },
        marqEnd: { x: 0, y: 0 },
        dragActive: false,
        dragStart: { x: 0, y: 0 },
        dragEnd: { x: 0, y: 0 },
        dragNodeIds: [],
        dragFleetIds: [],
        dragPending: false,
        dragDownNodeId: -1,
        dragDownFleetId: -1,
        dragDownScreen: { x: 0, y: 0 },
        dragThreshold: 6,
        panActive: false,
        panLast: { x: 0, y: 0 },
        mw: { x: 0, y: 0 },
        ms: { x: 0, y: 0 },
        pointerInsideCanvas: false,
        hoverNodeId: -1,
        hoverSince: 0,
        sendPct: 50,
        shift: false,
        pinchActive: false,
        pinchStartDist: 0,
        pinchStartZoom: 1,
        pinchWorldCenter: { x: 0, y: 0 },
        touchPointOrderPending: false,
        mousePointOrderPending: false,
        commandMode: '',
        touchStart: { x: 0, y: 0 },
        touchEmptyAwait: false,
        touchEmptyStart: { x: 0, y: 0 },
    };
}

function isOwnedNode(nodes, humanIndex, id) {
    var nodeId = Math.floor(Number(id));
    if (!Number.isFinite(nodeId) || nodeId < 0) return false;
    var node = Array.isArray(nodes) ? nodes[nodeId] : null;
    return !!node && node.owner === humanIndex;
}

function isOwnedHoldingFleet(fleets, humanIndex, id) {
    var fleetId = Math.floor(Number(id));
    if (!Number.isFinite(fleetId) || fleetId < 0) return false;
    var list = Array.isArray(fleets) ? fleets : [];
    for (var i = 0; i < list.length; i++) {
        var fleet = list[i];
        if (!fleet || !fleet.active || !fleet.holding || fleet.owner !== humanIndex) continue;
        if ((Number(fleet.id) || 0) === fleetId) return true;
    }
    return false;
}

export function reconcileInputStateAfterAuthoritativeSync(inputState, gameState) {
    inputState = inputState && typeof inputState === 'object' ? inputState : {};
    gameState = gameState && typeof gameState === 'object' ? gameState : {};

    var humanIndex = Number.isFinite(Number(gameState.human)) ? Math.floor(Number(gameState.human)) : 0;
    var nodes = Array.isArray(gameState.nodes) ? gameState.nodes : [];
    var fleets = Array.isArray(gameState.fleets) ? gameState.fleets : [];

    if (!(inputState.sel instanceof Set)) {
        inputState.sel = new Set(Array.isArray(inputState.sel) ? inputState.sel : []);
    }
    if (!(inputState.selFleets instanceof Set)) {
        inputState.selFleets = new Set(Array.isArray(inputState.selFleets) ? inputState.selFleets : []);
    }

    var staleNodeSelections = [];
    inputState.sel.forEach(function (id) {
        if (!isOwnedNode(nodes, humanIndex, id)) staleNodeSelections.push(id);
    });
    for (var i = 0; i < staleNodeSelections.length; i++) inputState.sel.delete(staleNodeSelections[i]);

    var staleFleetSelections = [];
    inputState.selFleets.forEach(function (id) {
        if (!isOwnedHoldingFleet(fleets, humanIndex, id)) staleFleetSelections.push(id);
    });
    for (var fi = 0; fi < staleFleetSelections.length; fi++) inputState.selFleets.delete(staleFleetSelections[fi]);

    var nextDragNodeIds = [];
    var dragNodeIds = Array.isArray(inputState.dragNodeIds) ? inputState.dragNodeIds : [];
    for (var di = 0; di < dragNodeIds.length; di++) {
        if (isOwnedNode(nodes, humanIndex, dragNodeIds[di])) nextDragNodeIds.push(Math.floor(Number(dragNodeIds[di])));
    }
    inputState.dragNodeIds = nextDragNodeIds;

    var nextDragFleetIds = [];
    var dragFleetIds = Array.isArray(inputState.dragFleetIds) ? inputState.dragFleetIds : [];
    for (var dfi = 0; dfi < dragFleetIds.length; dfi++) {
        if (isOwnedHoldingFleet(fleets, humanIndex, dragFleetIds[dfi])) nextDragFleetIds.push(Math.floor(Number(dragFleetIds[dfi])));
    }
    inputState.dragFleetIds = nextDragFleetIds;

    if (!isOwnedNode(nodes, humanIndex, inputState.dragDownNodeId)) {
        inputState.dragDownNodeId = nextDragNodeIds.length ? nextDragNodeIds[0] : -1;
    }
    if (!isOwnedHoldingFleet(fleets, humanIndex, inputState.dragDownFleetId)) {
        inputState.dragDownFleetId = nextDragFleetIds.length ? nextDragFleetIds[0] : -1;
    }

    if (!nextDragNodeIds.length && !nextDragFleetIds.length) {
        inputState.dragActive = false;
        inputState.dragPending = false;
        inputState.dragDownNodeId = -1;
        inputState.dragDownFleetId = -1;
        inputState.touchPointOrderPending = false;
        inputState.mousePointOrderPending = false;
        inputState.touchEmptyAwait = false;
    }

    if (inputState.commandMode && inputState.sel.size === 0) {
        inputState.commandMode = '';
    }

    return inputState;
}

function playSelect(audioSelect) {
    if (typeof audioSelect === 'function') audioSelect();
}

export function attachGameInputController(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};

    var canvas = opts.canvas;
    var windowTarget = opts.windowTarget || window;
    var gameState = opts.gameState;
    var inputState = opts.inputState;

    function hitNodeForTouchPath(w) {
        if (typeof opts.hitNodeTouch === 'function') return opts.hitNodeTouch(w);
        return opts.hitNode(w);
    }

    function syncHoverTooltip(node) {
        if (typeof opts.syncHoverTooltip !== 'function') return;
        opts.syncHoverTooltip({
            node: node || null,
            screenPos: { x: inputState.ms.x, y: inputState.ms.y },
            worldPos: { x: inputState.mw.x, y: inputState.mw.y },
            pointerInsideCanvas: inputState.pointerInsideCanvas === true,
        });
    }

    function updatePointerFromClient(clientX, clientY) {
        if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return false;
        var rect = canvas.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            inputState.pointerInsideCanvas = false;
            return false;
        }
        var inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
        inputState.pointerInsideCanvas = inside;
        if (!inside) return false;
        var sx = (clientX - rect.left) * (canvas.width / rect.width);
        var sy = (clientY - rect.top) * (canvas.height / rect.height);
        inputState.ms = { x: sx, y: sy };
        inputState.mw = opts.screenToWorld(sx, sy);
        return true;
    }

    function clearHoverState() {
        inputState.pointerInsideCanvas = false;
        inputState.hoverNodeId = -1;
        inputState.hoverSince = 0;
        syncHoverTooltip(null);
    }

    /** Pan / sürükleme / kutu seçimi sırasında imleç hâlâ canvas üzerindeyken pointerInsideCanvas sıfırlanmamalı. */
    function resetHoverTrackingOnly() {
        inputState.hoverNodeId = -1;
        inputState.hoverSince = 0;
        syncHoverTooltip({
            node: null,
            screenPos: { x: inputState.ms.x, y: inputState.ms.y },
            pointerInsideCanvas: inputState.pointerInsideCanvas === true,
        });
    }

    function updateHoverState(worldPos) {
        if (gameState.state !== 'playing') {
            clearHoverState();
            return;
        }
        inputState.pointerInsideCanvas = true;
        var hoveredNode = typeof opts.hitNodeAtScreen === 'function'
            ? opts.hitNodeAtScreen(inputState.ms, worldPos)
            : opts.hitNode(worldPos);
        var hoverId = hoveredNode ? hoveredNode.id : -1;
        if (hoverId !== inputState.hoverNodeId) {
            inputState.hoverNodeId = hoverId;
            inputState.hoverSince = hoverId >= 0 ? Date.now() : 0;
        }
        syncHoverTooltip(hoveredNode);
    }

    function handleMouseDown(e) {
        if (gameState.state !== 'playing') return;
        var w = opts.screenToWorld(e.offsetX, e.offsetY);
        inputState.mw = w;
        inputState.ms = { x: e.offsetX, y: e.offsetY };

        if (e.button === 0 && inputState.commandMode) {
            var modeNode = opts.hitNode(w);
            if (modeNode) opts.applyCommandModeTarget(modeNode.id);
            else {
                opts.clearCommandMode();
                opts.showGameToast('Flow modu iptal edildi.');
            }
            e.preventDefault();
            return;
        }

        if (e.button === 1) {
            resetHoverTrackingOnly();
            inputState.panActive = true;
            inputState.panLast = { x: e.offsetX, y: e.offsetY };
            e.preventDefault();
            return;
        }

        if (e.button === 2) {
            var nd = opts.hitNode(w);
            var selectedOwnedSources = 0;
            inputState.sel.forEach(function (sid) {
                var sn = gameState.nodes[sid];
                if (sn && sn.owner === gameState.human) selectedOwnedSources++;
            });
            var rightClickAction = opts.resolveRightClickAction({
                targetExists: !!nd,
                targetOwnerIsHuman: !!(nd && nd.owner === gameState.human),
                targetSelected: !!(nd && inputState.sel.has(nd.id)),
                selectedOwnedCount: selectedOwnedSources,
            });

            if (rightClickAction === 'defense' && nd && nd.owner === gameState.human) {
                var defIds = inputState.sel.has(nd.id) && inputState.sel.size > 0 ? Array.from(inputState.sel) : [nd.id];
                if (!opts.issueOnlineCommand('toggleDefense', { nodeIds: defIds })) {
                    defIds.forEach(function (id) { opts.toggleDefense(gameState.human, id); });
                }
            } else if (rightClickAction === 'flow' && nd) {
                inputState.sel.forEach(function (sid) {
                    var sn = gameState.nodes[sid];
                    if (sn && sn.owner === gameState.human && sid !== nd.id) {
                        var flowData = { srcId: sid, tgtId: nd.id };
                        if (!opts.issueOnlineCommand('flow', flowData)) {
                            opts.applyPlayerCommand(gameState.human, 'flow', flowData);
                        }
                    }
                });
            }
            e.preventDefault();
            return;
        }

        var cn = opts.hitNode(w);
        var hf = cn ? null : opts.hitHoldingFleet(w);
        inputState.shift = e.shiftKey;
        inputState.dragPending = false;
        inputState.dragDownNodeId = -1;
        inputState.dragDownFleetId = -1;

        if (cn && cn.owner === gameState.human && (inputState.sel.size > 0 || inputState.selFleets.size > 0) && !inputState.sel.has(cn.id) && !e.shiftKey) {
            if (opts.sendFromSelectionTo(cn.id)) return;
        }

        if (cn && cn.owner === gameState.human) {
            var dragSelection = null;
            if (inputState.sel.has(cn.id) && (inputState.sel.size > 0 || inputState.selFleets.size > 0)) {
                dragSelection = opts.selectedSendOrder();
            } else if (e.shiftKey) {
                inputState.sel.add(cn.id);
                opts.syncNodeSelectionFlags();
                dragSelection = opts.selectedSendOrder();
                playSelect(opts.audioSelect);
            } else {
                opts.selectNodeIds([cn.id], false);
                dragSelection = { sources: [cn.id], fleetIds: [] };
                playSelect(opts.audioSelect);
            }

            if ((dragSelection.sources.length + dragSelection.fleetIds.length) > 0) {
                inputState.dragPending = true;
                inputState.dragDownNodeId = cn.id;
                inputState.dragDownScreen = { x: e.offsetX, y: e.offsetY };
                inputState.dragNodeIds = dragSelection.sources.slice();
                inputState.dragFleetIds = dragSelection.fleetIds.slice();
                var startPt = opts.centroidForSources(dragSelection.sources, dragSelection.fleetIds);
                inputState.dragStart = startPt || { x: cn.pos.x, y: cn.pos.y };
                inputState.dragEnd = w;
            }
            return;
        }

        if (hf) {
            opts.pruneSelectedFleetIds();
            var fleetDragSelection = null;
            if (inputState.selFleets.has(hf.id) && (inputState.sel.size > 0 || inputState.selFleets.size > 0)) {
                fleetDragSelection = opts.selectedSendOrder();
            } else if (e.shiftKey) {
                inputState.selFleets.add(hf.id);
                opts.syncNodeSelectionFlags();
                fleetDragSelection = opts.selectedSendOrder();
                playSelect(opts.audioSelect);
            } else {
                opts.selectFleetIds([hf.id], false);
                fleetDragSelection = { sources: [], fleetIds: [hf.id] };
                playSelect(opts.audioSelect);
            }

            if ((fleetDragSelection.sources.length + fleetDragSelection.fleetIds.length) > 0) {
                inputState.dragPending = true;
                inputState.dragDownFleetId = hf.id;
                inputState.dragDownScreen = { x: e.offsetX, y: e.offsetY };
                inputState.dragNodeIds = fleetDragSelection.sources.slice();
                inputState.dragFleetIds = fleetDragSelection.fleetIds.slice();
                var fleetStartPt = opts.centroidForSources(fleetDragSelection.sources, fleetDragSelection.fleetIds);
                inputState.dragStart = fleetStartPt || { x: hf.x, y: hf.y };
                inputState.dragEnd = w;
            }
            return;
        }

        if (cn && (inputState.sel.size > 0 || inputState.selFleets.size > 0)) {
            opts.sendFromSelectionTo(cn.id);
            return;
        }

        if (!e.shiftKey && (inputState.sel.size > 0 || inputState.selFleets.size > 0)) {
            var mousePointSelection = opts.selectedSendOrder();
            if (mousePointSelection.sources.length > 0 || mousePointSelection.fleetIds.length > 0) {
                inputState.dragPending = true;
                inputState.dragDownNodeId = mousePointSelection.sources.length > 0 ? mousePointSelection.sources[0] : -1;
                inputState.dragDownFleetId = mousePointSelection.fleetIds.length > 0 ? mousePointSelection.fleetIds[0] : -1;
                inputState.dragDownScreen = { x: e.offsetX, y: e.offsetY };
                inputState.dragNodeIds = mousePointSelection.sources.slice();
                inputState.dragFleetIds = mousePointSelection.fleetIds.slice();
                inputState.dragStart = opts.centroidForSources(mousePointSelection.sources, mousePointSelection.fleetIds) || w;
                inputState.dragEnd = w;
                inputState.mousePointOrderPending = true;
                return;
            }
        }

        if (!e.shiftKey) opts.clearSelection(false);
        inputState.marqActive = true;
        inputState.marqStart = { x: e.offsetX, y: e.offsetY };
        inputState.marqEnd = { x: e.offsetX, y: e.offsetY };
    }

    function handleMouseMove(e) {
        updatePointerFromClient(e.clientX, e.clientY);
        var w = inputState.mw;

        if (inputState.panActive) {
            resetHoverTrackingOnly();
            var dx = (e.offsetX - inputState.panLast.x) / gameState.cam.zoom;
            var dy = (e.offsetY - inputState.panLast.y) / gameState.cam.zoom;
            gameState.cam.x -= dx;
            gameState.cam.y -= dy;
            inputState.panLast = { x: e.offsetX, y: e.offsetY };
            return;
        }

        if (inputState.mousePointOrderPending && !inputState.dragActive) {
            var mdx = e.offsetX - inputState.dragDownScreen.x;
            var mdy = e.offsetY - inputState.dragDownScreen.y;
            var movedPx = Math.sqrt(mdx * mdx + mdy * mdy);
            if (movedPx >= inputState.dragThreshold) {
                inputState.mousePointOrderPending = false;
                inputState.dragPending = false;
                inputState.dragDownNodeId = -1;
                inputState.dragDownFleetId = -1;
                inputState.dragNodeIds = [];
                inputState.dragFleetIds = [];
                if (!inputState.shift) opts.clearSelection(false);
                inputState.marqActive = true;
                inputState.marqStart = { x: inputState.dragDownScreen.x, y: inputState.dragDownScreen.y };
                inputState.marqEnd = { x: e.offsetX, y: e.offsetY };
                return;
            }
        } else if (inputState.dragPending && !inputState.dragActive) {
            var mdx2 = e.offsetX - inputState.dragDownScreen.x;
            var mdy2 = e.offsetY - inputState.dragDownScreen.y;
            var movedPx2 = Math.sqrt(mdx2 * mdx2 + mdy2 * mdy2);
            if (opts.shouldStartDragSend({
                downOnOwnedNode: inputState.dragDownNodeId >= 0 || inputState.dragDownFleetId >= 0,
                movedPx: movedPx2,
                thresholdPx: inputState.dragThreshold,
            })) {
                opts.beginDragSend(inputState.dragNodeIds, inputState.dragFleetIds, w);
            }
        }

        if (inputState.dragActive) {
            resetHoverTrackingOnly();
            inputState.dragEnd = w;
            return;
        }
        if (inputState.marqActive) {
            resetHoverTrackingOnly();
            inputState.marqEnd = { x: e.offsetX, y: e.offsetY };
            return;
        }

        updateHoverState(w);
    }

    function handleMouseUp(e) {
        if (e.button === 1) {
            inputState.panActive = false;
            return;
        }
        if (inputState.dragActive) {
            var w = opts.screenToWorld(e.offsetX, e.offsetY);
            var tn = opts.hitNode(w);
            if (tn) opts.sendFromSourcesTo(inputState.dragNodeIds, inputState.dragFleetIds, tn.id);
            else opts.sendFromSourcesToPoint(inputState.dragNodeIds, inputState.dragFleetIds, w);
            opts.resetDragState();
            return;
        }
        if (inputState.mousePointOrderPending) {
            opts.sendFromSourcesToPoint(inputState.dragNodeIds, inputState.dragFleetIds, opts.screenToWorld(e.offsetX, e.offsetY));
            opts.resetDragState();
            return;
        }
        inputState.dragPending = false;
        inputState.dragDownNodeId = -1;
        inputState.dragDownFleetId = -1;
        if (inputState.marqActive) {
            var sw = opts.screenToWorld(inputState.marqStart.x, inputState.marqStart.y);
            var ew = opts.screenToWorld(inputState.marqEnd.x, inputState.marqEnd.y);
            var ids = opts.nodesInRect(sw, ew, gameState.human);
            var fleetIds = opts.holdingFleetIdsInRect(sw, ew, gameState.human);
            if (ids.length > 0 || fleetIds.length > 0) opts.selectEntityIds(ids, fleetIds, inputState.shift);
            inputState.marqActive = false;
        }
    }

    function handleWheel(e) {
        if (gameState.state !== 'playing') return;
        var f = e.deltaY > 0 ? (1 - opts.zoomSpeed) : (1 + opts.zoomSpeed);
        gameState.cam.zoom *= f;
        gameState.cam.zoom = opts.clamp(gameState.cam.zoom, opts.zoomMin, opts.zoomMax);
        e.preventDefault();
    }

    function handleTouchStart(e) {
        clearHoverState();
        if (gameState.state === 'playing' && e.touches.length === 2) {
            opts.beginTouchPinch(opts.touchScreenPos(e.touches[0]), opts.touchScreenPos(e.touches[1]));
            e.preventDefault();
            return;
        }
        if (e.touches.length !== 1 || gameState.state !== 'playing') return;

        var pos = opts.touchScreenPos(e.touches[0]);
        inputState.touchStart = pos;
        inputState.pinchActive = false;
        inputState.dragPending = false;
        inputState.dragDownNodeId = -1;
        inputState.dragDownFleetId = -1;
        var w = opts.screenToWorld(pos.x, pos.y);
        var cn = hitNodeForTouchPath(w);
        var hf = cn ? null : opts.hitHoldingFleet(w);

        if (inputState.commandMode) {
            if (cn) opts.applyCommandModeTarget(cn.id);
            else {
                opts.clearCommandMode();
                opts.showGameToast('Flow modu iptal edildi.');
            }
            e.preventDefault();
            return;
        }

        if (cn && cn.owner === gameState.human && (inputState.sel.size > 0 || inputState.selFleets.size > 0) && !inputState.sel.has(cn.id)) {
            if (opts.sendFromSelectionTo(cn.id)) {
                e.preventDefault();
                return;
            }
        }

        if (cn && cn.owner === gameState.human) {
            var touchSelection = null;
            if (inputState.sel.has(cn.id) && (inputState.sel.size > 0 || inputState.selFleets.size > 0)) {
                touchSelection = opts.selectedSendOrder();
            } else {
                opts.selectNodeIds([cn.id], false);
                touchSelection = { sources: [cn.id], fleetIds: [] };
                playSelect(opts.audioSelect);
            }
            inputState.dragPending = true;
            inputState.dragDownNodeId = cn.id;
            inputState.dragDownScreen = { x: pos.x, y: pos.y };
            inputState.dragNodeIds = touchSelection.sources.slice();
            inputState.dragFleetIds = touchSelection.fleetIds.slice();
            var touchStartPt = opts.centroidForSources(touchSelection.sources, touchSelection.fleetIds);
            inputState.dragStart = touchStartPt || { x: cn.pos.x, y: cn.pos.y };
            inputState.dragEnd = w;
        } else if (hf) {
            opts.selectFleetIds([hf.id], false);
            inputState.dragPending = true;
            inputState.dragDownFleetId = hf.id;
            inputState.dragDownScreen = { x: pos.x, y: pos.y };
            inputState.dragNodeIds = [];
            inputState.dragFleetIds = [hf.id];
            inputState.dragStart = { x: hf.x, y: hf.y };
            inputState.dragEnd = w;
            playSelect(opts.audioSelect);
        } else if (cn && (inputState.sel.size > 0 || inputState.selFleets.size > 0)) {
            opts.sendFromSelectionTo(cn.id);
        } else if (inputState.sel.size > 0 || inputState.selFleets.size > 0) {
            var pointSelection = opts.selectedSendOrder();
            if (pointSelection.sources.length > 0 || pointSelection.fleetIds.length > 0) {
                inputState.dragPending = true;
                inputState.dragDownNodeId = pointSelection.sources.length > 0 ? pointSelection.sources[0] : -1;
                inputState.dragDownFleetId = pointSelection.fleetIds.length > 0 ? pointSelection.fleetIds[0] : -1;
                inputState.dragDownScreen = { x: pos.x, y: pos.y };
                inputState.dragNodeIds = pointSelection.sources.slice();
                inputState.dragFleetIds = pointSelection.fleetIds.slice();
                inputState.dragStart = opts.centroidForSources(pointSelection.sources, pointSelection.fleetIds) || w;
                inputState.dragEnd = w;
                inputState.touchPointOrderPending = true;
            }
        } else if (typeof opts.isCoarsePointer === 'function' && opts.isCoarsePointer()) {
            inputState.touchEmptyAwait = true;
            inputState.touchEmptyStart = { x: pos.x, y: pos.y };
        } else {
            opts.clearSelection(false);
            inputState.marqActive = true;
            inputState.marqStart = pos;
            inputState.marqEnd = pos;
        }
        e.preventDefault();
    }

    function handleTouchMove(e) {
        if (gameState.state === 'playing' && e.touches.length === 2) {
            clearHoverState();
            var posA = opts.touchScreenPos(e.touches[0]);
            var posB = opts.touchScreenPos(e.touches[1]);
            if (!inputState.pinchActive) opts.beginTouchPinch(posA, posB);
            opts.updateTouchPinch(posA, posB);
            e.preventDefault();
            return;
        }
        if (e.touches.length !== 1 || gameState.state !== 'playing') return;

        var pos = opts.touchScreenPos(e.touches[0]);
        var w = opts.screenToWorld(pos.x, pos.y);
        clearHoverState();

        if (inputState.panActive) {
            var pdx = (pos.x - inputState.panLast.x) / gameState.cam.zoom;
            var pdy = (pos.y - inputState.panLast.y) / gameState.cam.zoom;
            gameState.cam.x -= pdx;
            gameState.cam.y -= pdy;
            inputState.panLast = { x: pos.x, y: pos.y };
            e.preventDefault();
            return;
        }

        if (inputState.touchEmptyAwait && typeof opts.isCoarsePointer === 'function' && opts.isCoarsePointer()) {
            var edx = pos.x - inputState.touchEmptyStart.x;
            var edy = pos.y - inputState.touchEmptyStart.y;
            var emptyMoved = Math.sqrt(edx * edx + edy * edy);
            var panThr = typeof opts.touchPanThresholdPx === 'number' ? opts.touchPanThresholdPx : 12;
            if (emptyMoved >= panThr) {
                inputState.touchEmptyAwait = false;
                inputState.panActive = true;
                inputState.panLast = { x: pos.x, y: pos.y };
                e.preventDefault();
                return;
            }
        }

        if (inputState.touchPointOrderPending && !inputState.dragActive) {
            var tpdx = pos.x - inputState.dragDownScreen.x;
            var tpdy = pos.y - inputState.dragDownScreen.y;
            var tpMoved = Math.sqrt(tpdx * tpdx + tpdy * tpdy);
            if (tpMoved >= inputState.dragThreshold) {
                inputState.touchPointOrderPending = false;
                inputState.dragPending = false;
                inputState.dragDownNodeId = -1;
                inputState.dragDownFleetId = -1;
                inputState.dragNodeIds = [];
                inputState.dragFleetIds = [];
                if (!inputState.shift) opts.clearSelection(false);
                inputState.marqActive = true;
                inputState.marqStart = { x: inputState.dragDownScreen.x, y: inputState.dragDownScreen.y };
                inputState.marqEnd = pos;
            }
        } else if (inputState.dragPending && !inputState.dragActive) {
            var mdx = pos.x - inputState.dragDownScreen.x;
            var mdy = pos.y - inputState.dragDownScreen.y;
            var movedPx = Math.sqrt(mdx * mdx + mdy * mdy);
            if (opts.shouldStartDragSend({
                downOnOwnedNode: inputState.dragDownNodeId >= 0 || inputState.dragDownFleetId >= 0,
                movedPx: movedPx,
                thresholdPx: inputState.dragThreshold,
            })) {
                opts.beginDragSend(inputState.dragNodeIds, inputState.dragFleetIds, w);
            }
        }
        if (inputState.dragActive) inputState.dragEnd = w;
        else if (inputState.marqActive) inputState.marqEnd = pos;
        e.preventDefault();
    }

    function handleTouchEnd(e) {
        if (inputState.pinchActive && e.touches.length < 2) {
            inputState.pinchActive = false;
            if (e.touches.length === 1) {
                inputState.dragPending = false;
                inputState.dragActive = false;
            }
        }
        if (gameState.state !== 'playing') return;

        if (inputState.panActive && e.touches.length === 0) {
            inputState.panActive = false;
            return;
        }

        if (inputState.touchEmptyAwait && e.touches.length === 0 && e.changedTouches.length >= 1) {
            inputState.touchEmptyAwait = false;
            var tapPos = opts.touchScreenPos(e.changedTouches[0]);
            var tedx = tapPos.x - inputState.touchEmptyStart.x;
            var tedy = tapPos.y - inputState.touchEmptyStart.y;
            var tapMoved = Math.sqrt(tedx * tedx + tedy * tedy);
            var tapThr = typeof opts.touchTapThresholdPx === 'number' ? opts.touchTapThresholdPx : 10;
            if (tapMoved < tapThr) opts.clearSelection(false);
            return;
        }

        if (e.changedTouches.length !== 1) return;

        var pos = opts.touchScreenPos(e.changedTouches[0]);
        var w = opts.screenToWorld(pos.x, pos.y);

        if (inputState.dragActive) {
            var tn = hitNodeForTouchPath(w);
            if (tn) opts.sendFromSourcesTo(inputState.dragNodeIds, inputState.dragFleetIds, tn.id);
            else opts.sendFromSourcesToPoint(inputState.dragNodeIds, inputState.dragFleetIds, w);
            opts.resetDragState();
        } else if (inputState.touchPointOrderPending) {
            opts.sendFromSourcesToPoint(inputState.dragNodeIds, inputState.dragFleetIds, w);
            opts.resetDragState();
        } else if (inputState.marqActive) {
            var sw = opts.screenToWorld(inputState.marqStart.x, inputState.marqStart.y);
            var ew = opts.screenToWorld(pos.x, pos.y);
            var ids = opts.nodesInRect(sw, ew, gameState.human);
            var fleetIds = opts.holdingFleetIdsInRect(sw, ew, gameState.human);
            if (ids.length > 0 || fleetIds.length > 0) opts.selectEntityIds(ids, fleetIds, false);
            inputState.marqActive = false;
        } else {
            inputState.dragPending = false;
            inputState.dragDownNodeId = -1;
            inputState.dragDownFleetId = -1;
        }
    }

    function handleMouseLeave() {
        clearHoverState();
    }

    function handleWindowMouseMove(e) {
        if (!e) return;
        if (!updatePointerFromClient(e.clientX, e.clientY)) {
            clearHoverState();
            return;
        }
        if (!inputState.panActive && !inputState.dragActive && !inputState.marqActive) {
            updateHoverState(inputState.mw);
        }
    }

    function handleKeyDown(e) {
        var pauseKey = e.key === 'Escape' || e.key === 'p' || e.key === 'P';
        if (e.key === 'Escape' && opts.isHowToPlayVisible()) {
            opts.closeHowToPlayModal();
            e.preventDefault();
            return;
        }
        if (gameState.state === 'playing') {
            if (pauseKey) {
                opts.togglePauseMenu();
                e.preventDefault();
                return;
            }
            if (opts.isInGameMenuOpen()) return;
            if (e.key === 'a') opts.selectAllHumanNodes();
            if (e.key === 'u' || e.key === 'U') opts.activateSelectionUpgrade();
            if (e.key === 'q' || e.key === 'Q') {
                if (opts.triggerHumanDoctrine()) e.preventDefault();
            }
            if (e.key >= '1' && e.key <= '9') {
                opts.setSendPct(parseInt(e.key, 10) * 10);
            } else if (e.key === '0') {
                opts.setSendPct(100);
            }
        } else if (gameState.state === 'paused' && pauseKey) {
            opts.closePauseMenu();
            e.preventDefault();
        }
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    windowTarget.addEventListener('mousemove', handleWindowMouseMove, true);
    windowTarget.addEventListener('keydown', handleKeyDown);
}
