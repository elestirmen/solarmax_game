import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceMissionState, applyMissionScript, getActiveMissionPhase } from '../assets/sim/mission_script.js';

function makeState(overrides) {
    return Object.assign({
        tick: 0,
        state: 'playing',
        winner: -1,
        human: 0,
        nodes: [],
        objectives: [],
        encounters: [],
        stats: {},
        missionScript: null,
        missionState: null,
        missionFailureText: '',
        endOnObjectives: true,
    }, overrides || {});
}

test('mission script applies the first phase objectives and advances when complete', function () {
    var state = makeState({
        tick: 60,
        ownedNodes: 1,
        nodes: [
            { id: 0, owner: 0, assimilationProgress: 1, assimilationLock: 0 },
            { id: 1, owner: -1, assimilationProgress: 1, assimilationLock: 0 },
        ],
        missionScript: {
            phases: [
                {
                    id: 'alpha',
                    title: 'Alpha',
                    objectives: [{ id: 'take-1', type: 'control_node_ids', nodeIds: [1], target: 1, label: 'Node 1 al' }],
                },
                {
                    id: 'beta',
                    title: 'Beta',
                    objectives: [{ id: 'hold-2', type: 'owned_nodes', target: 2, label: '2 node tut' }],
                },
            ],
        },
    });

    applyMissionScript(state, state.missionScript);
    assert.equal(getActiveMissionPhase(state.missionScript, state.missionState).id, 'alpha');
    assert.equal(state.objectives[0].id, 'take-1');

    state.nodes[1].owner = 0;
    var result = advanceMissionState(state, { tickRate: 30 });

    assert.equal(result.phaseAdvanced, true);
    assert.equal(state.missionState.phaseIndex, 1);
    assert.equal(state.missionState.phaseStartedTick, 60);
    assert.equal(state.objectives[0].id, 'hold-2');
});

test('mission script failure conditions can end the mission before elimination', function () {
    var state = makeState({
        tick: 220,
        ownedNodes: 1,
        missionScript: {
            phases: [
                {
                    id: 'survive',
                    title: 'Survive',
                    objectives: [{ id: 'stay', type: 'survive_until_tick', target: 500, label: '500 tick dayan' }],
                    lossConditions: [{ type: 'owned_nodes_below', target: 2, graceTick: 180, message: 'Omurga coktu.' }],
                },
            ],
        },
    });

    applyMissionScript(state, state.missionScript);
    var result = advanceMissionState(state, { tickRate: 30 });

    assert.equal(result.failed, true);
    assert.equal(state.state, 'gameOver');
    assert.equal(state.winner, -1);
    assert.equal(state.missionFailureText, 'Omurga coktu.');
});

test('objective-only missions still resolve victory without a phase script', function () {
    var state = makeState({
        tick: 90,
        ownedNodes: 3,
        objectives: [{ id: 'hold-three', type: 'owned_nodes', target: 3, label: '3 node tut' }],
    });

    var result = advanceMissionState(state, { tickRate: 30 });

    assert.equal(result.won, true);
    assert.equal(state.state, 'gameOver');
    assert.equal(state.winner, 0);
});
