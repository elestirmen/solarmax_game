import { SIM_CONSTANTS } from './shared_config.js';

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

function normalizeTick(value, fallback) {
    var tick = Math.floor(Number(value));
    if (!Number.isFinite(tick)) return fallback;
    return tick;
}

export function normalizeNodeUpgradeState(node) {
    if (!node || typeof node !== 'object') return node;
    node.upgradeStartTick = normalizeTick(node.upgradeStartTick, -1);
    node.upgradeCompleteTick = normalizeTick(node.upgradeCompleteTick, -1);
    node.upgradeTargetLevel = Math.max(0, Math.floor(Number(node.upgradeTargetLevel) || 0));
    node.lastUpgradeStartTick = normalizeTick(node.lastUpgradeStartTick, -1);
    node.lastUpgradeCompleteTick = normalizeTick(node.lastUpgradeCompleteTick, -1);
    if (node.upgradeCompleteTick <= node.upgradeStartTick) {
        node.upgradeStartTick = -1;
        node.upgradeCompleteTick = -1;
        node.upgradeTargetLevel = 0;
    }
    return node;
}

export function isNodeUpgradePending(node, tick) {
    normalizeNodeUpgradeState(node);
    if (!node) return false;
    if (node.upgradeTargetLevel <= (Number(node.level) || 1)) return false;
    if (node.upgradeStartTick < 0 || node.upgradeCompleteTick < 0) return false;
    if (tick === undefined || tick === null) return true;
    return node.upgradeCompleteTick > normalizeTick(tick, 0);
}

export function beginNodeUpgrade(node, tick, durationTicks) {
    normalizeNodeUpgradeState(node);
    if (!node || isNodeUpgradePending(node, tick)) return false;
    var level = Math.max(1, Math.floor(Number(node.level) || 1));
    var startTick = Math.max(0, normalizeTick(tick, 0));
    var duration = Math.max(1, Math.floor(Number(durationTicks) || SIM_CONSTANTS.UPGRADE_DURATION_TICKS || 1));
    node.upgradeStartTick = startTick;
    node.upgradeCompleteTick = startTick + duration;
    node.upgradeTargetLevel = level + 1;
    node.lastUpgradeStartTick = startTick;
    return true;
}

export function clearNodeUpgradeState(node) {
    normalizeNodeUpgradeState(node);
    if (!node) return node;
    node.upgradeStartTick = -1;
    node.upgradeCompleteTick = -1;
    node.upgradeTargetLevel = 0;
    return node;
}

export function getNodeUpgradeProgress(node, tick) {
    normalizeNodeUpgradeState(node);
    if (!isNodeUpgradePending(node)) return 0;
    var startTick = Math.max(0, node.upgradeStartTick);
    var completeTick = Math.max(startTick + 1, node.upgradeCompleteTick);
    var currentTick = normalizeTick(tick, startTick);
    return clamp((currentTick - startTick) / Math.max(1, completeTick - startTick), 0, 1);
}

export function getNodeUpgradeVisualLevel(node, tick) {
    var level = Math.max(1, Number(node && node.level) || 1);
    if (!isNodeUpgradePending(node)) return level;
    var targetLevel = Math.max(level, Number(node.upgradeTargetLevel) || level);
    var progress = getNodeUpgradeProgress(node, tick);
    var eased = progress * progress * (3 - 2 * progress);
    return level + (targetLevel - level) * eased;
}

export function resolvePendingNodeUpgrades(nodes, tick, nodeCapacityFn) {
    var completed = [];
    if (!Array.isArray(nodes) || typeof nodeCapacityFn !== 'function') return completed;
    var currentTick = Math.max(0, normalizeTick(tick, 0));
    for (var i = 0; i < nodes.length; i++) {
        var node = normalizeNodeUpgradeState(nodes[i]);
        if (!isNodeUpgradePending(node)) continue;
        if (node.upgradeCompleteTick > currentTick) continue;
        node.level = Math.max(Math.floor(Number(node.level) || 1), Math.floor(Number(node.upgradeTargetLevel) || 1));
        node.maxUnits = nodeCapacityFn(node);
        if ((Number(node.units) || 0) > node.maxUnits) node.units = node.maxUnits;
        node.lastUpgradeCompleteTick = currentTick;
        clearNodeUpgradeState(node);
        completed.push(node);
    }
    return completed;
}
