import test from 'node:test';
import assert from 'node:assert/strict';

import {
    campaignMechanicsPreset,
    getMechanicsConfig,
    mechanicsProgressionInfo,
} from '../assets/sim/mechanics.js';

test('primitive preset contains only the conquest core', function () {
    var primitive = getMechanicsConfig('primitive');

    assert.equal(primitive.nodeTypes, false);
    assert.equal(primitive.upgrades, false);
    assert.equal(primitive.flow, false);
    assert.equal(primitive.defense, false);
    assert.equal(primitive.assimilation, false);
    assert.equal(primitive.territory, false);
    assert.equal(primitive.strategicPulse, false);
    assert.equal(primitive.doctrines, false);
    assert.equal(primitive.solarFlare, false);
});

test('campaign mechanics unlock in authored chapter order', function () {
    assert.deepEqual(Array.from({ length: 10 }, function (_, index) {
        return campaignMechanicsPreset(index);
    }), [
        'primitive', 'primitive', 'anomaly', 'logistics', 'logistics',
        'economy', 'economy', 'economy', 'frontier', 'advanced',
    ]);

    assert.match(mechanicsProgressionInfo('frontier').unlock, /Savunma/);
});
