/* =========================================================
   ai.ts – Score-based AI decision system
   ========================================================= */

import { GameNode, Fleet, FlowLink, Player } from './entities';
import { dist } from './utils';
import { FogState, isNodeVisible } from './fog';
import { TuningParams, Difficulty } from './constants';

interface AITarget {
    nodeId: number;
    score: number;
}

/**
 * AI decision: evaluate all possible targets, pick best, dispatch fleets.
 * Returns a list of commands to execute.
 */
export interface AICommand {
    type: 'sendPacket' | 'toggleFlow' | 'removeFlow';
    sources: number[];        // source node ids
    targetId: number;
    percent: number;
}

export function aiDecide(
    playerIndex: number,
    nodes: GameNode[],
    _fleets: Fleet[],
    flowLinks: FlowLink[],
    _players: Player[],
    fog: FogState,
    difficulty: Difficulty,
    tuning: TuningParams,
    currentTick: number,
): AICommand[] {
    const commands: AICommand[] = [];
    const ownNodes = nodes.filter(n => n.owner === playerIndex);
    if (ownNodes.length === 0) return commands;

    // Decide if AI uses fog-limited info (Hard mode)
    const useFog = difficulty === 'hard';

    // Gather potential targets (enemy and neutral nodes)
    const targets: AITarget[] = [];
    for (const node of nodes) {
        if (node.owner === playerIndex) continue;

        // In hard mode, AI can only see nodes in its vision
        if (useFog && !isNodeVisible(fog, playerIndex, node.id)) continue;

        const targetUnits = useFog
            ? (isNodeVisible(fog, playerIndex, node.id) ? node.units : fog.lastSeen[playerIndex][node.id].units)
            : node.units;

        // Score: higher = more attractive target
        // Factors: low enemy units, close distance, neutral bonus
        let score = 0;
        const nearestOwned = closestOwnedNode(ownNodes, node);
        const d = nearestOwned ? dist(nearestOwned.pos, node.pos) : 9999;

        // Distance penalty (closer is better)
        score += Math.max(0, 500 - d) * 0.5;

        // Weakness bonus (fewer units = easier target)
        score += Math.max(0, 50 - targetUnits) * 2;

        // Neutral bonus (easy capture)
        if (node.owner === -1) score += 40;

        // Strategic: larger nodes more valuable
        score += node.radius * 0.8;

        // Apply aggression tuning
        score *= tuning.aiAggression;

        targets.push({ nodeId: node.id, score });
    }

    if (targets.length === 0) return commands;

    // Sort by score descending
    targets.sort((a, b) => b.score - a.score);

    // Strategy: attack top 1-2 targets
    const attackCount = Math.min(2, targets.length);

    for (let i = 0; i < attackCount; i++) {
        const target = targets[i];
        const targetNode = nodes[target.nodeId];
        const targetUnits = useFog
            ? (isNodeVisible(fog, playerIndex, target.nodeId) ? targetNode.units : fog.lastSeen[playerIndex][target.nodeId].units)
            : targetNode.units;

        // Find sources: nearby owned nodes with enough units
        const sourceCandidates = ownNodes
            .filter(n => n.units > tuning.aiBuffer)
            .sort((a, b) => dist(a.pos, targetNode.pos) - dist(b.pos, targetNode.pos));

        if (sourceCandidates.length === 0) continue;

        // Calculate how many units we need (considering defense factor)
        const needed = targetUnits * tuning.defenseFactor + 5;
        let totalAvailable = 0;
        const sources: number[] = [];

        for (const src of sourceCandidates) {
            const available = src.units - tuning.aiBuffer;
            if (available <= 0) continue;
            sources.push(src.id);
            totalAvailable += available;
            if (totalAvailable >= needed) break;
            if (sources.length >= 3) break; // max 3 sources per attack
        }

        if (totalAvailable < needed * 0.5 && targetNode.owner !== -1) continue; // not enough

        const percent = Math.min(0.7, needed / totalAvailable);

        // Decide: send packet or establish flow link
        // Use flow links for sustained pressure on large targets
        const useFlow = targetNode.owner !== -1 &&
            targetUnits > 15 &&
            ((currentTick + playerIndex * 7 + target.nodeId * 3) % 11 === 0) &&
            !flowLinks.some(f => f.owner === playerIndex && f.targetId === target.nodeId && f.active);

        if (useFlow && sources.length > 0) {
            commands.push({
                type: 'toggleFlow',
                sources: [sources[0]],
                targetId: target.nodeId,
                percent: 0,
            });
        }

        commands.push({
            type: 'sendPacket',
            sources,
            targetId: target.nodeId,
            percent: Math.max(0.3, percent),
        });
    }

    // Cleanup: remove flow links to nodes we now own
    for (const link of flowLinks) {
        if (link.owner === playerIndex && link.active) {
            const targetNode = nodes[link.targetId];
            if (targetNode.owner === playerIndex) {
                commands.push({
                    type: 'removeFlow',
                    sources: [link.sourceId],
                    targetId: link.targetId,
                    percent: 0,
                });
            }
        }
    }

    void currentTick; // used for future timing features
    return commands;
}

function closestOwnedNode(ownNodes: GameNode[], target: GameNode): GameNode | null {
    let best: GameNode | null = null;
    let bestD = Infinity;
    for (const n of ownNodes) {
        const d = dist(n.pos, target.pos);
        if (d < bestD) {
            bestD = d;
            best = n;
        }
    }
    return best;
}
