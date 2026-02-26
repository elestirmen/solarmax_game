import test from 'node:test';
import assert from 'node:assert/strict';

import { getRulesetConfig, normalizeRulesetMode, normalizeNodeKindForRuleset } from '../assets/sim/ruleset.js';

test('classic ruleset disables upgrades and extra penalties', function () {
    var classic = getRulesetConfig('classic');
    assert.equal(classic.allowUpgrade, false);
    assert.equal(classic.applyExtraPenalties, false);
    assert.equal(classic.simplifyNodeKinds, true);
});

test('advanced ruleset keeps node kinds and upgrades enabled', function () {
    var advanced = getRulesetConfig('advanced');
    assert.equal(advanced.allowUpgrade, true);
    assert.equal(advanced.applyExtraPenalties, true);
    assert.equal(advanced.simplifyNodeKinds, false);
    assert.equal(normalizeNodeKindForRuleset('turret', 'advanced'), 'turret');
});

test('ruleset normalization falls back to advanced', function () {
    assert.equal(normalizeRulesetMode('unknown'), 'advanced');
    assert.equal(normalizeNodeKindForRuleset('forge', 'classic'), 'core');
});
