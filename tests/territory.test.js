import test from 'node:test';
import assert from 'node:assert/strict';

import { getTerritoryOwnersAtPoint, isPointInsideFriendlyTerritory, territoryRadiusForNode } from '../assets/sim/territory.js';

test('territoryRadiusForNode scales with node size and level', function () {
    var levelOne = territoryRadiusForNode({ owner: 0, radius: 20, level: 1, kind: 'core', pos: { x: 0, y: 0 } });
    var levelThree = territoryRadiusForNode({ owner: 0, radius: 28, level: 3, kind: 'core', pos: { x: 0, y: 0 } });

    assert.equal(levelOne > 0, true);
    assert.equal(levelThree > levelOne, true);
});

test('isPointInsideFriendlyTerritory matches only owned node borders', function () {
    var nodes = [
        { owner: 0, radius: 24, level: 1, kind: 'core', pos: { x: 0, y: 0 } },
        { owner: 1, radius: 24, level: 1, kind: 'core', pos: { x: 220, y: 0 } },
    ];

    assert.equal(isPointInsideFriendlyTerritory({
        owner: 0,
        point: { x: 90, y: 0 },
        nodes: nodes,
    }), true);
    assert.equal(isPointInsideFriendlyTerritory({
        owner: 0,
        point: { x: 220, y: 0 },
        nodes: nodes,
    }), false);
});

test('isPointInsideFriendlyTerritory ignores nodes that are not fully assimilated', function () {
    var nodes = [
        { owner: 0, radius: 24, level: 1, kind: 'core', pos: { x: 0, y: 0 }, assimilationProgress: 0.6, assimilationLock: 0 },
    ];

    assert.equal(isPointInsideFriendlyTerritory({
        owner: 0,
        point: { x: 90, y: 0 },
        nodes: nodes,
        callbacks: {
            isNodeTerritoryActive: function (node) {
                return node.assimilationProgress >= 1 && (node.assimilationLock || 0) <= 0;
            },
        },
    }), false);
});

test('isPointInsideFriendlyTerritory treats overlapping enemy borders as contested', function () {
    var nodes = [
        { owner: 0, radius: 24, level: 1, kind: 'core', pos: { x: 0, y: 0 } },
        { owner: 1, radius: 24, level: 1, kind: 'core', pos: { x: 110, y: 0 } },
    ];

    assert.equal(isPointInsideFriendlyTerritory({
        owner: 0,
        point: { x: 55, y: 0 },
        nodes: nodes,
    }), false);
    assert.equal(isPointInsideFriendlyTerritory({
        owner: 1,
        point: { x: 55, y: 0 },
        nodes: nodes,
    }), false);
});

test('getTerritoryOwnersAtPoint marks blackout zones as bonus-blocked without erasing ownership', function () {
    var nodes = [
        { owner: 0, radius: 24, level: 1, kind: 'core', pos: { x: 0, y: 0 } },
    ];
    var presence = getTerritoryOwnersAtPoint({
        point: { x: 50, y: 0 },
        nodes: nodes,
        callbacks: {
            isTerritoryBonusBlockedAtPoint: function () { return true; },
        },
    });

    assert.equal(presence.owners[0], true);
    assert.equal(presence.ownerCount, 1);
    assert.equal(presence.bonusBlocked, true);
    assert.equal(isPointInsideFriendlyTerritory({
        owner: 0,
        point: { x: 50, y: 0 },
        nodes: nodes,
        callbacks: {
            isTerritoryBonusBlockedAtPoint: function () { return true; },
        },
    }), false);
});
