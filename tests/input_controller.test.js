import test from 'node:test';
import assert from 'node:assert/strict';

import { attachGameInputController, createInputState, reconcileInputStateAfterAuthoritativeSync } from '../assets/app/input_controller.js';

function sortedSetValues(set) {
    return Array.from(set).sort(function (a, b) { return a - b; });
}

function createTouchHarness(config) {
    config = config && typeof config === 'object' ? config : {};
    var handlers = {};
    var canvasHandlers = {};
    var inputState = createInputState();
    var gameState = {
        state: 'playing',
        human: 0,
        nodes: config.nodes || [],
        fleets: config.fleets || [],
        cam: { x: 0, y: 0, zoom: 1 },
    };
    var selectedIds = [];
    var pinchCalls = { begin: 0, update: 0 };

    attachGameInputController({
        canvas: {
            addEventListener: function (name, handler) { canvasHandlers[name] = handler; },
            getBoundingClientRect: function () { return { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 }; },
            width: 200,
            height: 200,
        },
        windowTarget: {
            addEventListener: function (name, handler) { handlers[name] = handler; },
        },
        gameState: gameState,
        inputState: inputState,
        screenToWorld: function (x, y) { return { x: x, y: y }; },
        touchScreenPos: function (touch) { return { x: touch.clientX, y: touch.clientY }; },
        hitNodeTouch: function (worldPos) {
            if (typeof config.hitNodeTouch === 'function') return config.hitNodeTouch(worldPos);
            return null;
        },
        hitNode: function (worldPos) {
            if (typeof config.hitNode === 'function') return config.hitNode(worldPos);
            return null;
        },
        hitNodeAtScreen: function () { return null; },
        hitHoldingFleet: function () { return null; },
        shouldStartDragSend: function () { return false; },
        beginDragSend: function () {},
        sendFromSelectionTo: function () { return false; },
        selectedSendOrder: function () { return { sources: [], fleetIds: [] }; },
        centroidForSources: function () { return null; },
        selectNodeIds: function (ids) {
            selectedIds.push(ids.slice());
            inputState.sel = new Set(ids);
        },
        selectFleetIds: function () {},
        clearSelection: function () {
            inputState.sel.clear();
            inputState.selFleets.clear();
        },
        screenDistance: function () { return 0; },
        nodesInRect: function () { return []; },
        holdingFleetIdsInRect: function () { return []; },
        selectEntityIds: function () {},
        pruneSelectedFleetIds: function () {},
        syncNodeSelectionFlags: function () {},
        sendFromSourcesTo: function () {},
        sendFromSourcesToPoint: function () {},
        resetDragState: function () {},
        applyCommandModeTarget: function () {},
        clearCommandMode: function () {},
        showGameToast: function () {},
        isCoarsePointer: function () { return true; },
        touchPanThresholdPx: 14,
        touchTapThresholdPx: 11,
        beginTouchPinch: function (a, b) {
            pinchCalls.begin++;
            inputState.pinchActive = true;
            if (typeof config.beginTouchPinch === 'function') config.beginTouchPinch(a, b, gameState, inputState);
        },
        updateTouchPinch: function (a, b) {
            pinchCalls.update++;
            if (typeof config.updateTouchPinch === 'function') config.updateTouchPinch(a, b, gameState, inputState);
        },
        audioSelect: function () {},
        clamp: function (value) { return value; },
        zoomSpeed: 0.1,
        zoomMin: 0.2,
        zoomMax: 3,
        resolveRightClickAction: function () { return 'defense'; },
        issueOnlineCommand: function () { return false; },
        toggleDefense: function () {},
        applyPlayerCommand: function () {},
        isHowToPlayVisible: function () { return false; },
        closeHowToPlayModal: function () {},
        togglePauseMenu: function () {},
        isInGameMenuOpen: function () { return false; },
        selectAllHumanNodes: function () {},
        activateSelectionUpgrade: function () {},
        triggerHumanDoctrine: function () { return false; },
        setSendPct: function () {},
        closePauseMenu: function () {},
    });

    return {
        canvasHandlers: canvasHandlers,
        handlers: handlers,
        inputState: inputState,
        gameState: gameState,
        selectedIds: selectedIds,
        pinchCalls: pinchCalls,
    };
}

test('reconcileInputStateAfterAuthoritativeSync preserves valid online selection and drag sources', function () {
    var inputState = createInputState();
    inputState.sel.add(1);
    inputState.sel.add(2);
    inputState.selFleets.add(41);
    inputState.selFleets.add(42);
    inputState.dragActive = true;
    inputState.dragPending = true;
    inputState.dragNodeIds = [1, 3];
    inputState.dragFleetIds = [41, 77];
    inputState.dragDownNodeId = 3;
    inputState.dragDownFleetId = 77;
    inputState.commandMode = 'flow';

    reconcileInputStateAfterAuthoritativeSync(inputState, {
        human: 0,
        nodes: [
            { id: 0, owner: 1 },
            { id: 1, owner: 0 },
            { id: 2, owner: 0 },
            { id: 3, owner: 1 },
        ],
        fleets: [
            { id: 41, owner: 0, active: true, holding: true },
            { id: 42, owner: 0, active: true, holding: true },
            { id: 77, owner: 1, active: true, holding: true },
        ],
    });

    assert.deepEqual(sortedSetValues(inputState.sel), [1, 2]);
    assert.deepEqual(sortedSetValues(inputState.selFleets), [41, 42]);
    assert.deepEqual(inputState.dragNodeIds, [1]);
    assert.deepEqual(inputState.dragFleetIds, [41]);
    assert.equal(inputState.dragActive, true);
    assert.equal(inputState.dragPending, true);
    assert.equal(inputState.dragDownNodeId, 1);
    assert.equal(inputState.dragDownFleetId, 41);
    assert.equal(inputState.commandMode, 'flow');
});

test('reconcileInputStateAfterAuthoritativeSync clears stale online selection and drag state', function () {
    var inputState = createInputState();
    inputState.sel.add(3);
    inputState.selFleets.add(77);
    inputState.dragActive = true;
    inputState.dragPending = true;
    inputState.dragNodeIds = [3];
    inputState.dragFleetIds = [77];
    inputState.dragDownNodeId = 3;
    inputState.dragDownFleetId = 77;
    inputState.commandMode = 'flow';
    inputState.touchPointOrderPending = true;
    inputState.mousePointOrderPending = true;
    inputState.touchEmptyAwait = true;

    reconcileInputStateAfterAuthoritativeSync(inputState, {
        human: 0,
        nodes: [
            { id: 0, owner: 0 },
            { id: 1, owner: 1 },
            { id: 2, owner: 1 },
            { id: 3, owner: 1 },
        ],
        fleets: [
            { id: 77, owner: 1, active: true, holding: true },
        ],
    });

    assert.deepEqual(sortedSetValues(inputState.sel), []);
    assert.deepEqual(sortedSetValues(inputState.selFleets), []);
    assert.deepEqual(inputState.dragNodeIds, []);
    assert.deepEqual(inputState.dragFleetIds, []);
    assert.equal(inputState.dragActive, false);
    assert.equal(inputState.dragPending, false);
    assert.equal(inputState.dragDownNodeId, -1);
    assert.equal(inputState.dragDownFleetId, -1);
    assert.equal(inputState.touchPointOrderPending, false);
    assert.equal(inputState.mousePointOrderPending, false);
    assert.equal(inputState.touchEmptyAwait, false);
    assert.equal(inputState.commandMode, '');
});

test('attachGameInputController ignores game hotkeys while typing in an input', function () {
    var handlers = {};
    var canvasHandlers = {};
    var inputState = createInputState();
    var selectAllCalls = 0;
    var pauseCalls = 0;

    attachGameInputController({
        canvas: {
            addEventListener: function (name, handler) { canvasHandlers[name] = handler; },
            getBoundingClientRect: function () { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; },
            width: 100,
            height: 100,
        },
        windowTarget: {
            addEventListener: function (name, handler) { handlers[name] = handler; },
        },
        gameState: {
            state: 'playing',
            human: 0,
            nodes: [],
            fleets: [],
        },
        inputState: inputState,
        screenToWorld: function () { return { x: 0, y: 0 }; },
        hitNode: function () { return null; },
        hitNodeAtScreen: function () { return null; },
        isHowToPlayVisible: function () { return false; },
        closeHowToPlayModal: function () {},
        togglePauseMenu: function () { pauseCalls++; },
        isInGameMenuOpen: function () { return false; },
        selectAllHumanNodes: function () { selectAllCalls++; },
        activateSelectionUpgrade: function () {},
        triggerHumanDoctrine: function () { return false; },
        setSendPct: function () {},
    });

    handlers.keydown({
        key: 'a',
        target: { tagName: 'input' },
        preventDefault: function () {},
    });
    handlers.keydown({
        key: 'Escape',
        target: { tagName: 'INPUT' },
        preventDefault: function () {},
    });

    assert.equal(selectAllCalls, 0);
    assert.equal(pauseCalls, 0);
});

test('touch tap on an owned node selects it on coarse pointers', function () {
    var harness = createTouchHarness({
        nodes: [{ id: 1, owner: 0, pos: { x: 12, y: 12 } }],
        hitNodeTouch: function (worldPos) {
            return worldPos.x <= 20 && worldPos.y <= 20 ? { id: 1, owner: 0, pos: { x: 12, y: 12 } } : null;
        },
    });

    harness.canvasHandlers.touchstart({
        touches: [{ clientX: 10, clientY: 10 }],
        preventDefault: function () {},
    });
    harness.canvasHandlers.touchend({
        touches: [],
        changedTouches: [{ clientX: 10, clientY: 10 }],
        preventDefault: function () {},
    });

    assert.deepEqual(harness.selectedIds, [[1]]);
    assert.deepEqual(sortedSetValues(harness.inputState.sel), [1]);
});

test('single-finger swipe from empty space does not pan the camera on coarse pointers', function () {
    var harness = createTouchHarness();

    harness.canvasHandlers.touchstart({
        touches: [{ clientX: 20, clientY: 20 }],
        preventDefault: function () {},
    });
    harness.canvasHandlers.touchmove({
        touches: [{ clientX: 40, clientY: 20 }],
        preventDefault: function () {},
    });

    assert.equal(harness.inputState.panActive, false);
    assert.equal(harness.gameState.cam.x, 0);
});

test('single-finger swipe from an owned node cancels tap-select instead of panning', function () {
    var harness = createTouchHarness({
        nodes: [{ id: 1, owner: 0, pos: { x: 12, y: 12 } }],
        hitNodeTouch: function (worldPos) {
            return worldPos.x <= 20 && worldPos.y <= 20 ? { id: 1, owner: 0, pos: { x: 12, y: 12 } } : null;
        },
    });

    harness.canvasHandlers.touchstart({
        touches: [{ clientX: 10, clientY: 10 }],
        preventDefault: function () {},
    });
    harness.canvasHandlers.touchmove({
        touches: [{ clientX: 32, clientY: 10 }],
        preventDefault: function () {},
    });
    harness.canvasHandlers.touchend({
        touches: [],
        changedTouches: [{ clientX: 32, clientY: 10 }],
        preventDefault: function () {},
    });

    assert.deepEqual(harness.selectedIds, []);
    assert.deepEqual(sortedSetValues(harness.inputState.sel), []);
    assert.equal(harness.gameState.cam.x, 0);
});

test('two-finger gesture drives pinch/drag camera updates on coarse pointers', function () {
    var harness = createTouchHarness({
        updateTouchPinch: function (a, b, gameState) {
            gameState.cam.x = Math.round((a.x + b.x) * 0.5);
        },
    });

    harness.canvasHandlers.touchstart({
        touches: [{ clientX: 30, clientY: 30 }, { clientX: 70, clientY: 30 }],
        preventDefault: function () {},
    });
    harness.canvasHandlers.touchmove({
        touches: [{ clientX: 40, clientY: 30 }, { clientX: 80, clientY: 30 }],
        preventDefault: function () {},
    });

    assert.equal(harness.pinchCalls.begin, 1);
    assert.equal(harness.pinchCalls.update, 1);
    assert.equal(harness.gameState.cam.x, 60);
});
