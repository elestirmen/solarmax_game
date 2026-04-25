import test from 'node:test';
import assert from 'node:assert/strict';

import { SIM_CONSTANTS, buildDefenseFieldConfig, pickNodeKindForRadius, upgradeCost } from '../assets/sim/shared_config.js';

function TestRNG(seed) {
    this.s = seed | 0;
    if (!this.s) this.s = 1;
}

TestRNG.prototype.next = function () {
    var t = this.s += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

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
    var planetKinds = ['core', 'forge', 'bulwark', 'relay', 'nexus', 'gate', 'turret'];
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

test('pickNodeKindForRadius keeps nexus comparatively rare even among large planets', function () {
    var rng = new TestRNG(12376);
    var counts = { core: 0, forge: 0, bulwark: 0, relay: 0, nexus: 0 };
    for (var i = 0; i < 2000; i++) {
        counts[pickNodeKindForRadius(31, rng, { minRadius: 18, maxRadius: 36 })] += 1;
    }

    assert.equal(counts.nexus < counts.bulwark, true);
    assert.equal(counts.nexus < counts.core, true);
    assert.equal(counts.nexus < 240, true);
});

test('defense field config is sourced from shared constants', function () {
    assert.deepEqual(buildDefenseFieldConfig(), {
        baseRangePad: SIM_CONSTANTS.DEFENSE_FIELD_RANGE_PAD,
        baseDps: SIM_CONSTANTS.DEFENSE_FIELD_DPS,
        levelRangeBonus: SIM_CONSTANTS.DEFENSE_FIELD_LEVEL_RANGE,
        levelDpsBonus: SIM_CONSTANTS.DEFENSE_FIELD_LEVEL_DPS,
        defenseDpsBonus: SIM_CONSTANTS.DEFENSE_FIELD_DEFENSE_BONUS,
        bulwarkDpsBonus: SIM_CONSTANTS.DEFENSE_FIELD_BULWARK_BONUS,
        relayRangeBonus: SIM_CONSTANTS.DEFENSE_FIELD_RELAY_RANGE,
    });
});
