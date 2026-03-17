import test from 'node:test';
import assert from 'node:assert/strict';

import { getRoomTypeUiState } from '../assets/ui/room_type_ui.js';

test('standard room mode keeps shared host controls editable', function () {
    var state = getRoomTypeUiState('standard');

    assert.equal(state.disableSeed, false);
    assert.equal(state.disablePlaylist, false);
    assert.equal(state.nodeLabelOpacity, '1');
    assert.match(state.hintText, /Standart oda/);
});

test('daily room mode locks map and loadout controls', function () {
    var state = getRoomTypeUiState('daily');

    assert.equal(state.disableSeed, true);
    assert.equal(state.disableNodeCount, true);
    assert.equal(state.disablePlaylist, true);
    assert.equal(state.disableDoctrine, true);
    assert.equal(state.nodeLabelOpacity, '0.45');
    assert.match(state.hintText, /Gunluk oda/);
});

test('custom room mode locks generated layout controls and explains dependency', function () {
    var state = getRoomTypeUiState('custom');

    assert.equal(state.disableDifficulty, true);
    assert.equal(state.disableRulesMode, true);
    assert.equal(state.disablePlaylist, true);
    assert.match(state.hintText, /Araclar bolumunden map yukle/);
});
