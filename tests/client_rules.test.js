import test from 'node:test';
import assert from 'node:assert/strict';

import * as clientRules from '../assets/app/client_rules.js';
import * as sharedConfig from '../assets/sim/shared_config.js';

test('client rule adapter re-exports shared gameplay rules', function () {
    assert.equal(clientRules.SIM_CONSTANTS, sharedConfig.SIM_CONSTANTS);
    assert.equal(clientRules.NODE_TYPE_DEFS, sharedConfig.NODE_TYPE_DEFS);
    assert.equal(clientRules.DIFFICULTY_PRESETS, sharedConfig.DIFFICULTY_PRESETS);
    assert.equal(clientRules.PLAYER_COLORS, sharedConfig.PLAYER_COLORS);

    assert.deepEqual(clientRules.defaultTune(), sharedConfig.defaultTune());
    assert.deepEqual(clientRules.difficultyConfig('hard'), sharedConfig.difficultyConfig('hard'));

    var node = { kind: 'bulwark', level: 2, radius: 24, supplied: true };
    assert.equal(clientRules.nodeTypeOf(node), sharedConfig.nodeTypeOf(node));
    assert.equal(clientRules.nodeCapacity(node), sharedConfig.nodeCapacity(node));
    assert.equal(clientRules.upgradeCost(node), sharedConfig.upgradeCost(node));
});

test('client and server defense field config share the same defaults', function () {
    assert.deepEqual(clientRules.buildDefenseFieldConfig(), sharedConfig.buildDefenseFieldConfig());
    assert.deepEqual(clientRules.buildDefenseFieldConfig({ baseDps: 3.1 }), {
        ...sharedConfig.buildDefenseFieldConfig(),
        baseDps: 3.1,
    });
});
