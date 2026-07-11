import test from 'node:test';
import assert from 'node:assert/strict';

import { initFog, updateVis } from '../assets/sim/fog.js';

test('selecting a node does not change fog visibility', function () {
    var nodes = [
        { id: 0, owner: 0, units: 10, radius: 20, visionR: 100, selected: false, pos: { x: 0, y: 0 } },
        { id: 1, owner: 1, units: 10, radius: 20, visionR: 100, selected: false, pos: { x: 110, y: 0 } },
    ];
    var fog = initFog(2, 2);
    updateVis(fog, 0, nodes, 0);
    assert.equal(fog.vis[0][1], undefined);

    nodes[0].selected = true;
    updateVis(fog, 0, nodes, 1);
    assert.equal(fog.vis[0][1], undefined);
});
