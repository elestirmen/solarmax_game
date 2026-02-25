/* =========================================================
   fog.ts – Fog of War: vision, lastSeen tracking
   ========================================================= */

import { GameNode, Fleet, LastSeen } from './entities';
// utils used inline (dist check is done manually for perf)
import { SELECTED_VISION_BONUS } from './constants';

/**
 * Per-player visibility map.
 * visibleNodes[playerIndex] = Set<nodeId> of currently visible nodes.
 * lastSeen[playerIndex][nodeId] = { tick, owner, units }.
 */
export interface FogState {
    visibleNodes: Set<number>[];        // per player
    lastSeen: LastSeen[][];             // [playerIndex][nodeId]
}

export function createFogState(playerCount: number, nodeCount: number): FogState {
    const visibleNodes: Set<number>[] = [];
    const lastSeen: LastSeen[][] = [];
    for (let p = 0; p < playerCount; p++) {
        visibleNodes.push(new Set());
        const arr: LastSeen[] = [];
        for (let n = 0; n < nodeCount; n++) {
            arr.push({ tick: -1, owner: -1, units: 0 });
        }
        lastSeen.push(arr);
    }
    return { visibleNodes, lastSeen };
}

/**
 * Recompute visibility for a given player.
 */
export function updateVisibility(
    fog: FogState,
    playerIndex: number,
    nodes: GameNode[],
    currentTick: number
): void {
    const visible = fog.visibleNodes[playerIndex];
    visible.clear();

    // Gather all owned nodes with their vision radii
    const ownedVisions: { x: number; y: number; r2: number }[] = [];
    for (const node of nodes) {
        if (node.owner === playerIndex) {
            let vr = node.visionRadius;
            if (node.selected) vr *= SELECTED_VISION_BONUS;
            ownedVisions.push({ x: node.pos.x, y: node.pos.y, r2: vr * vr });
        }
    }

    // Check each node against owned vision
    for (const node of nodes) {
        // Own nodes are always visible
        if (node.owner === playerIndex) {
            visible.add(node.id);
            // Update lastSeen
            fog.lastSeen[playerIndex][node.id] = {
                tick: currentTick,
                owner: node.owner,
                units: Math.floor(node.units),
            };
            continue;
        }

        // Check if within any owned node's vision radius
        for (const ov of ownedVisions) {
            const dx = node.pos.x - ov.x;
            const dy = node.pos.y - ov.y;
            if (dx * dx + dy * dy <= ov.r2) {
                visible.add(node.id);
                fog.lastSeen[playerIndex][node.id] = {
                    tick: currentTick,
                    owner: node.owner,
                    units: Math.floor(node.units),
                };
                break;
            }
        }
    }
}

/**
 * Check if a fleet is visible to a player.
 */
export function isFleetVisible(
    fleet: Fleet,
    playerIndex: number,
    nodes: GameNode[]
): boolean {
    if (fleet.owner === playerIndex) return true;

    for (const node of nodes) {
        if (node.owner === playerIndex) {
            let vr = node.visionRadius;
            if (node.selected) vr *= SELECTED_VISION_BONUS;
            const dx = fleet.x - node.pos.x;
            const dy = fleet.y - node.pos.y;
            if (dx * dx + dy * dy <= vr * vr) return true;
        }
    }
    return false;
}

/**
 * Check if a specific node is visible to a player.
 */
export function isNodeVisible(fog: FogState, playerIndex: number, nodeId: number): boolean {
    return fog.visibleNodes[playerIndex].has(nodeId);
}
