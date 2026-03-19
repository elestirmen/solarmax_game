import test from 'node:test';
import assert from 'node:assert/strict';

import { canvasToViewportPoint, findHoveredNodeAtScreen, worldToScreenPoint } from '../assets/app/hover_target.js';

test('worldToScreenPoint projects world coordinates with camera and viewport', function () {
    var screen = worldToScreenPoint(
        { x: 140, y: 90 },
        { x: 100, y: 50, zoom: 2 },
        { width: 800, height: 600 },
    );

    assert.deepEqual(screen, { x: 480, y: 380 });
});

test('findHoveredNodeAtScreen returns the closest visible node under the cursor', function () {
    var nodes = [
        { id: 1, pos: { x: 100, y: 100 }, radius: 20 },
        { id: 2, pos: { x: 108, y: 100 }, radius: 20 },
        { id: 3, pos: { x: 300, y: 300 }, radius: 24 },
    ];

    var hovered = findHoveredNodeAtScreen({
        nodes: nodes,
        screenPos: { x: 505, y: 400 },
        camera: { x: 0, y: 0, zoom: 1 },
        viewport: { width: 800, height: 600 },
    });

    assert.equal(hovered.id, 2);
});

test('findHoveredNodeAtScreen ignores nodes rejected by the visibility test', function () {
    var nodes = [
        { id: 1, pos: { x: 100, y: 100 }, radius: 24, hidden: true },
        { id: 2, pos: { x: 300, y: 100 }, radius: 24, hidden: false },
    ];

    var hovered = findHoveredNodeAtScreen({
        nodes: nodes,
        screenPos: { x: 500, y: 400 },
        camera: { x: 0, y: 0, zoom: 1 },
        viewport: { width: 800, height: 600 },
        visibilityTest: function (node) { return node.hidden !== true; },
    });

    assert.equal(hovered, null);
});

test('canvasToViewportPoint maps canvas pixels back to viewport pixels', function () {
    var viewport = canvasToViewportPoint(
        { x: 400, y: 200 },
        { left: 20, top: 10, width: 500, height: 250 },
        { width: 1000, height: 500 },
    );

    assert.deepEqual(viewport, { x: 220, y: 110 });
});
