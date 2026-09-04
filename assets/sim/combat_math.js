import { SIM_CONSTANTS, nodeLevelDefMult, nodeTypeOf } from './shared_config.js';

/**
 * The one defence formula.
 *
 * This used to exist twice: once in resolveCombatOutcome, which decides fights, and
 * once inside the dispatch forecast, which told the player whether a fight was winnable.
 * The two disagreed - the forecast used level x1.08 / bulwark x1.16 / turret x1.42 while
 * the sim used level x1.2 / bulwark x1.4 x tune / turret x1.7 - so the HUD understated
 * every defended world and the attack the player was shown as winnable often was not.
 * Both callers now read from here, so a balance change moves the prediction with it.
 *
 * @returns {number} Multiplier applied to a world's garrison to get its defence strength.
 */
export function garrisonDefenseMultiplier(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var node = opts.node || {};
    var owner = Number(node.owner);
    var isHeld = Number.isFinite(owner) && owner >= 0;

    var tuneDef = Number(opts.tuneDef);
    if (!Number.isFinite(tuneDef) || tuneDef <= 0) tuneDef = SIM_CONSTANTS.DEF_FACTOR;

    var turretCaptureResist = Number(opts.turretCaptureResist);
    if (!Number.isFinite(turretCaptureResist) || turretCaptureResist <= 0) turretCaptureResist = SIM_CONSTANTS.TURRET_CAPTURE_RESIST;

    var defenseBonus = Number(opts.defenseBonus);
    if (!Number.isFinite(defenseBonus) || defenseBonus <= 0) defenseBonus = SIM_CONSTANTS.DEFENSE_BONUS;

    var typeDef = Number(opts.typeDef);
    if (!Number.isFinite(typeDef) || typeDef <= 0) typeDef = Number(nodeTypeOf(node).def) || 1;

    var levelDef = Number(opts.levelDefMult);
    if (!Number.isFinite(levelDef) || levelDef <= 0) levelDef = Number(nodeLevelDefMult(node)) || 1;

    // Neutral worlds have no standing doctrine, so the global defence factor is a
    // held-world advantage only. Taking an empty world costs exactly its garrison.
    var multiplier = (isHeld ? tuneDef : 1) * typeDef * levelDef;
    if (node.kind === 'turret') multiplier *= turretCaptureResist * Math.max(0.5, Number(node.turretCaptureResistMult) || 1);
    if (node.defense) multiplier *= defenseBonus;
    multiplier *= Math.max(0.4, Number(opts.extraMultiplier) || 1);
    return multiplier;
}

/** Defence strength of a world, in attacker-ship equivalents. */
export function garrisonDefenseStrength(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var node = opts.node || {};
    var units = Math.max(0, Math.floor(Number(node.units) || 0));
    return units * garrisonDefenseMultiplier(opts);
}
