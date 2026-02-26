var RULESET_TABLE = {
    classic: {
        mode: 'classic',
        allowUpgrade: false,
        applyExtraPenalties: false,
        simplifyNodeKinds: true,
        baseCap: 190,
        capPerNodeFactor: 46,
    },
    advanced: {
        mode: 'advanced',
        allowUpgrade: true,
        applyExtraPenalties: true,
        simplifyNodeKinds: false,
        baseCap: 180,
        capPerNodeFactor: 42,
    },
};

export function normalizeRulesetMode(mode) {
    var value = String(mode || 'advanced').toLowerCase();
    return value === 'classic' ? 'classic' : 'advanced';
}

export function getRulesetConfig(mode) {
    var normalized = normalizeRulesetMode(mode);
    var cfg = RULESET_TABLE[normalized] || RULESET_TABLE.advanced;
    return {
        mode: cfg.mode,
        allowUpgrade: cfg.allowUpgrade,
        applyExtraPenalties: cfg.applyExtraPenalties,
        simplifyNodeKinds: cfg.simplifyNodeKinds,
        baseCap: cfg.baseCap,
        capPerNodeFactor: cfg.capPerNodeFactor,
    };
}

export function normalizeNodeKindForRuleset(kind, mode) {
    var cfg = getRulesetConfig(mode);
    if (cfg.simplifyNodeKinds) return 'core';
    return kind || 'core';
}
