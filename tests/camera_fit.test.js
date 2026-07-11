import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOpeningCamera, selectOpeningFocusNodes } from '../assets/app/camera_fit.js';

var nodes = [
    { id: 0, owner: 0, radius: 26, pos: { x: 100, y: 500 } },
    { id: 1, owner: -1, radius: 20, pos: { x: 260, y: 460 } },
    { id: 2, owner: -1, radius: 20, pos: { x: 390, y: 540 } },
    { id: 3, owner: 1, radius: 28, pos: { x: 900, y: 500 } },
];

test('opening focus starts at the capital and chooses nearest visible targets', function () {
    var focus = selectOpeningFocusNodes({
        nodes: nodes,
        playerIndex: 0,
        capitalId: 0,
        targetCount: 2,
        visibleTest: function (node) { return node.id !== 2; },
    });
    assert.deepEqual(focus.map(function (node) { return node.id; }), [0, 1, 3]);
});

test('compact opening camera zooms out enough to include a useful first decision area', function () {
    var camera = buildOpeningCamera({
        nodes: nodes,
        playerIndex: 0,
        capitalId: 0,
        viewportWidth: 393,
        viewportHeight: 727,
        compact: true,
    });

    assert.ok(camera);
    assert.ok(camera.zoom >= 0.42 && camera.zoom <= 0.82);
    assert.deepEqual(camera.focusNodeIds.slice(0, 3), [0, 1, 2]);
    assert.ok(camera.x > 100, 'camera shifts toward the first targets');
    assert.ok(camera.y > 460, 'camera accounts for the bottom command deck');
});
