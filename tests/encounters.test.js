import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEncounterState, stepEncounterState } from '../assets/sim/encounters.js';

function nodes() {
    return [
        { id: 0, pos: { x: 140, y: 120 }, radius: 24, owner: -1, units: 18, level: 1, kind: 'core', gate: false, strategic: false, defense: false, assimilationProgress: 1, assimilationLock: 0 },
        { id: 1, pos: { x: 420, y: 260 }, radius: 24, owner: -1, units: 18, level: 1, kind: 'core', gate: false, strategic: false, defense: false, assimilationProgress: 1, assimilationLock: 0 },
        { id: 2, pos: { x: 740, y: 420 }, radius: 24, owner: 0, units: 18, level: 1, kind: 'core', gate: false, strategic: false, defense: false, assimilationProgress: 1, assimilationLock: 0 },
    ];
}

test('buildEncounterState stamps node metadata onto selected objective nodes', function () {
    var mapNodes = nodes();
    var encounters = buildEncounterState([{ type: 'mega_turret', nodeId: 0 }, { type: 'relay_core', nodeId: 1 }], mapNodes, 'encounter-seed');

    assert.equal(encounters.length, 2);
    assert.equal(mapNodes[0].encounterType, 'mega_turret');
    assert.equal(mapNodes[1].encounterType, 'relay_core');
    assert.equal(mapNodes[1].strategic, true);
});

test('stepEncounterState tracks control ticks for owned and assimilated encounter nodes', function () {
    var state = {
        nodes: nodes(),
        encounters: buildEncounterState([{ type: 'relay_core', nodeId: 2 }], nodes(), 'encounter-seed'),
    };
    state.nodes[2].encounterType = 'relay_core';
    stepEncounterState(state);

    assert.equal(state.encounters[0].controlTicksByPlayer[0], 1);
    assert.equal(state.encounterContext.relayCoreCountByPlayer[0], 1);
});
