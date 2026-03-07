import test from 'node:test';
import assert from 'node:assert/strict';

import { computeOwnershipMetrics, computeSupplyConnected, getPlayerCapitalId } from '../assets/sim/state_metrics.js';

function dist(a, b) {
    var dx = (a.x || 0) - (b.x || 0);
    var dy = (a.y || 0) - (b.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
}

function isAssimilated(node) {
    return (node.assimilationProgress || 1) >= 1;
}

test('getPlayerCapitalId selects the nearest assimilated owned node and computeSupplyConnected expands from it', function () {
    var playerCapital = {};
    var nodes = [
        { id: 0, owner: 0, pos: { x: 20, y: 20 }, assimilationProgress: 1 },
        { id: 1, owner: 0, pos: { x: 120, y: 40 }, assimilationProgress: 1 },
        { id: 2, owner: 0, pos: { x: 420, y: 420 }, assimilationProgress: 1 },
        { id: 3, owner: 1, pos: { x: 140, y: 30 }, assimilationProgress: 1 },
    ];

    var capital = getPlayerCapitalId({
        playerIndex: 0,
        playerCapital: playerCapital,
        nodes: nodes,
        anchorPositions: [{ x: 0, y: 0 }],
        isNodeAssimilated: isAssimilated,
        distanceFn: dist,
    });
    var connected = computeSupplyConnected({
        playerIndex: 0,
        playerCapital: playerCapital,
        nodes: nodes,
        anchorPositions: [{ x: 0, y: 0 }],
        isNodeAssimilated: isAssimilated,
        distanceFn: dist,
        maxLinkDist: 150,
    });

    assert.equal(capital, 0);
    assert.deepEqual(Array.from(connected).sort(function (a, b) { return a - b; }), [0, 1]);
});

test('computeOwnershipMetrics derives power, cap, units, and supply from shared state', function () {
    var metrics = computeOwnershipMetrics({
        players: [{}, {}],
        nodes: [
            { id: 0, owner: 0, units: 20, maxUnits: 30, pos: { x: 10, y: 10 }, assimilationProgress: 1 },
            { id: 1, owner: 0, units: 15, maxUnits: 24, pos: { x: 80, y: 10 }, assimilationProgress: 1 },
            { id: 2, owner: 1, units: 10, maxUnits: 18, pos: { x: 380, y: 10 }, assimilationProgress: 1 },
        ],
        fleets: [
            { owner: 0, active: true, count: 5 },
            { owner: 1, active: false, count: 20 },
        ],
        playerCapital: {},
        anchorPositions: [{ x: 0, y: 0 }, { x: 400, y: 0 }],
        strategicPulse: { active: true, nodeId: 1 },
        strategicPulseCapBonus: 18,
        rules: { baseCap: 100, capPerNodeFactor: 10 },
        isNodeAssimilated: isAssimilated,
        distanceFn: dist,
        maxLinkDist: 120,
        nodePowerValue: function (node) {
            return (Number(node.units) || 0) + 1;
        },
    });

    assert.equal(metrics.unitByPlayer[0], 40);
    assert.equal(metrics.unitByPlayer[1], 10);
    assert.equal(metrics.capByPlayer[0], 138);
    assert.equal(metrics.capByPlayer[1], 110);
    assert.equal(metrics.powerByPlayer[0], 42);
    assert.equal(metrics.powerByPlayer[1], 11);
    assert.equal(metrics.supplyByPlayer[0].has(1), true);
    assert.equal(metrics.supplyByPlayer[1].has(2), true);
});
