import test from 'node:test';
import assert from 'node:assert/strict';

import { upgradeCost } from '../assets/sim/shared_config.js';

function legacyUpgradeCost(node) {
    var radius = Number(node && node.radius) || 0;
    var level = Number(node && node.level) || 1;
    var cost = 48 + radius * 2.15 + (level - 1) * 36;
    if (node && node.kind === 'relay') cost *= 0.92;
    else if (node && node.kind === 'forge') cost *= 0.95;
    else if (node && node.kind === 'bulwark') cost *= 1.08;
    else if (node && node.kind === 'turret') cost *= 1.12;
    if (node && node.supplied === true) cost *= 0.82;
    return Math.max(28, Math.floor(cost));
}

test('upgrade costs are globally higher than the legacy baseline for every planet type', function () {
    var planetKinds = ['core', 'forge', 'bulwark', 'relay', 'nexus', 'turret'];
    for (var i = 0; i < planetKinds.length; i++) {
        var kind = planetKinds[i];
        var node = { radius: 24, level: 1, kind: kind, supplied: false };
        assert.equal(upgradeCost(node) > legacyUpgradeCost(node), true);
    }
});

test('supplied discount still reduces upgrade cost after the global increase', function () {
    var unsuppliedCost = upgradeCost({ radius: 24, level: 2, kind: 'core', supplied: false });
    var suppliedCost = upgradeCost({ radius: 24, level: 2, kind: 'core', supplied: true });

    assert.equal(suppliedCost < unsuppliedCost, true);
});
