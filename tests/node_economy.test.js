import test from 'node:test';
import assert from 'node:assert/strict';

import { stepNodeEconomy } from '../assets/sim/node_economy.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

test('stepNodeEconomy produces units and updates owner counts through shared rules', function () {
    var nodes = [
        {
            id: 0,
            owner: 0,
            kind: 'core',
            level: 1,
            radius: 36,
            units: 10,
            maxUnits: 20,
            prodAcc: 0,
            assimilationProgress: 1,
            defense: false,
        },
    ];
    var stats = { unitsProduced: 0 };

    var result = stepNodeEconomy({
        nodes: nodes,
        humanIndex: 0,
        powerByPlayer: { 0: 10 },
        supplyByPlayer: { 0: new Set([0]) },
        ownerUnits: { 0: 10 },
        ownerCaps: { 0: 20 },
        tune: { prod: 10, aiAssist: false },
        diffCfg: { humanProdMult: 1, aiProdMult: 1 },
        rules: { applyExtraPenalties: true },
        stats: stats,
        constants: {
            baseProd: 1,
            nodeRadiusMax: 36,
            isolatedProdPenalty: 0.4,
            capSoftStart: 0.8,
            capSoftFloor: 0.2,
            ddaMaxBoost: 0.5,
            defenseProdPenalty: 0.7,
            strategicPulseProd: 1.5,
            strategicPulseAssim: 1.2,
            defenseAssimBonus: 1.1,
            assimBaseRate: 0.001,
            assimUnitBonus: 0.0001,
            assimGarrisonFloor: 0.35,
            assimLevelResist: 0.3,
        },
        callbacks: {
            clamp: clamp,
            nodeTypeOf: function () { return { prod: 1, def: 1 }; },
            nodeCapacity: function () { return 20; },
            nodeLevelProdMult: function () { return 1; },
            strategicPulseAppliesToNode: function () { return false; },
            isNodeAssimilated: function () { return true; },
        },
    });

    assert.equal(nodes[0].units, 20);
    assert.equal(result.ownerUnits[0], 20);
    assert.equal(result.totalProduced, 10);
    assert.equal(stats.unitsProduced, 10);
});

test('stepNodeEconomy advances assimilation before production and keeps unassimilated nodes unsupplied', function () {
    var nodes = [
        {
            id: 4,
            owner: 1,
            kind: 'bulwark',
            level: 2,
            radius: 24,
            units: 12,
            maxUnits: 30,
            prodAcc: 0.2,
            assimilationProgress: 0.5,
            assimilationLock: 0,
            defense: true,
        },
    ];

    stepNodeEconomy({
        nodes: nodes,
        humanIndex: 0,
        powerByPlayer: { 0: 80, 1: 30 },
        supplyByPlayer: { 1: new Set([4]) },
        ownerUnits: { 1: 12 },
        ownerCaps: { 1: 100 },
        tune: { prod: 2, aiAssist: true },
        diffCfg: { humanProdMult: 1, aiProdMult: 1 },
        rules: { applyExtraPenalties: true },
        stats: {},
        constants: {
            baseProd: 1,
            nodeRadiusMax: 36,
            isolatedProdPenalty: 0.4,
            capSoftStart: 0.8,
            capSoftFloor: 0.2,
            ddaMaxBoost: 0.5,
            defenseProdPenalty: 0.7,
            strategicPulseProd: 1.5,
            strategicPulseAssim: 1.5,
            defenseAssimBonus: 1.2,
            assimBaseRate: 0.02,
            assimUnitBonus: 0.001,
            assimGarrisonFloor: 0.35,
            assimLevelResist: 0.3,
        },
        callbacks: {
            clamp: clamp,
            nodeTypeOf: function () { return { prod: 1, def: 1.4 }; },
            nodeCapacity: function () { return 30; },
            nodeLevelProdMult: function () { return 1.15; },
            strategicPulseAppliesToNode: function (nodeId) { return nodeId === 4; },
            isNodeAssimilated: function (node) { return (node.assimilationProgress || 0) >= 1; },
        },
    });

    assert.ok(nodes[0].assimilationProgress > 0.5);
    assert.equal(nodes[0].supplied, false);
    assert.equal(nodes[0].units, 12);
});
