import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOpeningCamera, buildOverviewCamera, clampCameraToMap, selectOpeningFocusNodes } from '../assets/app/camera_fit.js';

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

test('overview camera frames every world inside the space the HUD leaves free', function () {
    var camera = buildOverviewCamera({
        nodes: nodes,
        viewportWidth: 1440,
        viewportHeight: 900,
        bottomReserve: 180,
        rightReserve: 210,
        padding: 40,
    });
    assert.ok(camera);
    // Project every world and check it lands inside the free area.
    nodes.forEach(function (node) {
        var sx = (node.pos.x - camera.x) * camera.zoom + 720;
        var sy = (node.pos.y - camera.y) * camera.zoom + 450;
        assert.ok(sx - node.radius * camera.zoom >= 0, 'left edge');
        assert.ok(sx + node.radius * camera.zoom <= 1440 - 210, 'clear of the sidebar');
        assert.ok(sy + node.radius * camera.zoom <= 900 - 180, 'clear of the command deck');
    });
});

test('overview camera respects its zoom bounds', function () {
    var camera = buildOverviewCamera({
        nodes: [{ pos: { x: 0, y: 0 }, radius: 20 }, { pos: { x: 10, y: 0 }, radius: 20 }],
        viewportWidth: 1440,
        viewportHeight: 900,
        maxZoom: 1.1,
    });
    assert.equal(camera.zoom, 1.1);
    assert.equal(buildOverviewCamera({ nodes: [] }), null);
});

test('camera clamp keeps the centre within reach of the map', function () {
    var cam = clampCameraToMap({ x: -5000, y: 99999 }, { mapWidth: 1600, mapHeight: 1000, slack: 200 });
    assert.equal(cam.x, -200);
    assert.equal(cam.y, 1200);
    var inside = clampCameraToMap({ x: 800, y: 500 }, { mapWidth: 1600, mapHeight: 1000, slack: 200 });
    assert.deepEqual(inside, { x: 800, y: 500 });
});
