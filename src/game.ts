/* =========================================================
   game.ts – Core game engine: state machine, fixed-tick loop,
             map gen, production, combat, fleet dispatch, flow
   ========================================================= */

import {
    GameNode, Fleet, FlowLink, Player, Camera,
    fleetPool,
} from './entities';
import {
    TICK_DT, BASE_PRODUCTION_RATE, MAX_NODE_UNITS,
    NODE_MIN_RADIUS, NODE_MAX_RADIUS, NODE_MIN_DISTANCE,
    NEUTRAL_MAX_UNITS,
    BASE_VISION_RADIUS, COLORS,
    FLOW_AMOUNT_FRACTION, MAP_WIDTH, MAP_HEIGHT, MAP_PADDING,
    TuningParams, defaultTuning, Difficulty,
} from './constants';
import { SeededRNG, dist, hashSeed } from './utils';
import { computeControlPoint, bezierPoint, bezierArcLength } from './bezier';
import { FogState, createFogState, updateVisibility } from './fog';
import { aiDecide, AICommand } from './ai';
import { ReplayRecorder, ReplayPlayer, ReplayInputEvent } from './replay';

/* ---- Game State Enum ---- */
export type GameState = 'mainMenu' | 'playing' | 'paused' | 'gameOver' | 'replayMode';

/* ---- Game Instance ---- */
export class Game {
    // State
    state: GameState = 'mainMenu';
    winner = -1;  // -1 = none, player index if won

    // Simulation
    tick = 0;
    speed = 1;        // 1x, 2x, 4x
    rng!: SeededRNG;
    seed = 42;
    difficulty: Difficulty = 'normal';

    // Entities
    nodes: GameNode[] = [];
    fleets: Fleet[] = [];       // active fleets (refs from pool)
    flowLinks: FlowLink[] = [];
    players: Player[] = [];
    humanPlayer = 0;

    // Fog
    fog!: FogState;

    // Camera
    camera: Camera = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, zoom: 1 };

    // Tuning
    tuning: TuningParams = defaultTuning();

    // Replay
    recorder = new ReplayRecorder();
    replayPlayer: ReplayPlayer | null = null;

    // AI timing
    private aiTickCounters: number[] = [];
    private nextFlowLinkId = 0;

    /* ---- Initialize game ---- */
    init(seedStr: string, nodeCount: number, difficulty: Difficulty): void {
        this.seed = typeof seedStr === 'string' && seedStr.length > 0
            ? (isNaN(Number(seedStr)) ? hashSeed(seedStr) : Number(seedStr))
            : 42;
        this.difficulty = difficulty;
        this.rng = new SeededRNG(this.seed);
        this.tick = 0;
        this.speed = 1;
        this.winner = -1;
        this.tuning = defaultTuning();
        this.nextFlowLinkId = 0;

        // Release all pooled fleets
        for (const f of this.fleets) {
            fleetPool.release(f);
        }
        this.fleets = [];
        this.flowLinks = [];

        // Players: human + 1 AI
        const aiCount = difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : 3;
        this.players = [];
        for (let i = 0; i <= aiCount; i++) {
            this.players.push({
                index: i,
                color: COLORS.players[i % COLORS.players.length],
                isAI: i > 0,
                alive: true,
            });
        }
        this.humanPlayer = 0;
        this.aiTickCounters = new Array(this.players.length).fill(0);

        // Generate map
        this.generateMap(nodeCount);

        // Fog
        this.fog = createFogState(this.players.length, this.nodes.length);
        for (let p = 0; p < this.players.length; p++) {
            updateVisibility(this.fog, p, this.nodes, this.tick);
        }

        // Camera: center on player's first node
        const playerNode = this.nodes.find(n => n.owner === 0);
        if (playerNode) {
            this.camera.x = playerNode.pos.x;
            this.camera.y = playerNode.pos.y;
        }
        this.camera.zoom = 1;

        // Replay recorder
        this.recorder.init(this.seed, nodeCount, difficulty);
        this.replayPlayer = null;

        this.state = 'playing';
    }

    /* ---- Map generation ---- */
    private generateMap(nodeCount: number): void {
        this.nodes = [];

        // Place nodes with minimum distance constraint
        const maxAttempts = 1000;
        let placed = 0;
        let attempts = 0;

        while (placed < nodeCount && attempts < maxAttempts) {
            const x = this.rng.nextFloat(MAP_PADDING, MAP_WIDTH - MAP_PADDING);
            const y = this.rng.nextFloat(MAP_PADDING, MAP_HEIGHT - MAP_PADDING);
            const radius = this.rng.nextFloat(NODE_MIN_RADIUS, NODE_MAX_RADIUS);

            // Check min distance
            let tooClose = false;
            for (const existing of this.nodes) {
                if (dist({ x, y }, existing.pos) < NODE_MIN_DISTANCE) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) {
                this.nodes.push({
                    id: placed,
                    pos: { x, y },
                    radius,
                    owner: -1,
                    units: this.rng.nextInt(2, NEUTRAL_MAX_UNITS),
                    productionAccum: 0,
                    maxUnits: MAX_NODE_UNITS,
                    visionRadius: BASE_VISION_RADIUS + radius * 2,
                    selected: false,
                });
                placed++;
            }
            attempts++;
        }

        // Assign starting nodes to players
        if (this.nodes.length >= this.players.length) {
            // Sort nodes by distance from corners to spread players out
            const corners = [
                { x: MAP_PADDING, y: MAP_PADDING },
                { x: MAP_WIDTH - MAP_PADDING, y: MAP_HEIGHT - MAP_PADDING },
                { x: MAP_PADDING, y: MAP_HEIGHT - MAP_PADDING },
                { x: MAP_WIDTH - MAP_PADDING, y: MAP_PADDING },
            ];

            for (let p = 0; p < this.players.length; p++) {
                const corner = corners[p % corners.length];
                let bestNode: GameNode | null = null;
                let bestDist = Infinity;
                for (const node of this.nodes) {
                    if (node.owner !== -1) continue;
                    const d = dist(node.pos, corner);
                    if (d < bestDist) {
                        bestDist = d;
                        bestNode = node;
                    }
                }
                if (bestNode) {
                    bestNode.owner = p;
                    bestNode.units = 15;
                    bestNode.radius = Math.max(bestNode.radius, 28); // at least medium
                }
            }
        }
    }

    /* ---- Fixed tick update ---- */
    update(): void {
        if (this.state !== 'playing' && this.state !== 'replayMode') return;

        // Replay: apply events for this tick
        if (this.replayPlayer && this.state === 'replayMode') {
            const events = this.replayPlayer.getEventsForTick(this.tick);
            for (const evt of events) {
                this.applyReplayEvent(evt);
            }
            if (this.replayPlayer.isFinished(this.tick)) {
                this.state = 'gameOver';
                return;
            }
        }

        // Production
        for (const node of this.nodes) {
            if (node.owner < 0) continue;
            const rate = BASE_PRODUCTION_RATE * this.tuning.productionMultiplier *
                (node.radius / NODE_MAX_RADIUS);
            node.productionAccum += rate;
            if (node.productionAccum >= 1) {
                const add = Math.floor(node.productionAccum);
                node.units = Math.min(node.maxUnits, node.units + add);
                node.productionAccum -= add;
            }
        }

        // Fleet movement
        this.updateFleets();

        // Flow link dispatch
        this.updateFlowLinks();

        // AI decisions
        for (let p = 1; p < this.players.length; p++) {
            if (!this.players[p].alive) continue;
            this.aiTickCounters[p]++;
            const interval = this.tuning.aiDecisionInterval;
            if (this.aiTickCounters[p] >= interval) {
                this.aiTickCounters[p] = 0;
                const commands = aiDecide(
                    p, this.nodes, this.fleets, this.flowLinks,
                    this.players, this.fog, this.difficulty, this.tuning, this.tick,
                );
                for (const cmd of commands) {
                    this.executeAICommand(p, cmd);
                }
            }
        }

        // Update fog
        for (let p = 0; p < this.players.length; p++) {
            updateVisibility(this.fog, p, this.nodes, this.tick);
        }

        // Check win/lose
        this.checkGameEnd();

        this.tick++;
    }

    /* ---- Fleet movement & arrival ---- */
    private updateFleets(): void {
        for (let i = this.fleets.length - 1; i >= 0; i--) {
            const fleet = this.fleets[i];
            if (!fleet.active) continue;

            // Advance along bezier
            const distPerTick = (fleet.speed * this.tuning.fleetSpeed / FLEET_SPEED_BASE) * TICK_DT;
            const dt = distPerTick / fleet.arcLength;
            fleet.t += dt;

            if (fleet.t >= 1) {
                // Arrived at target
                this.fleetArrive(fleet);
                fleetPool.release(fleet);
                this.fleets.splice(i, 1);
            } else {
                // Update position
                const srcNode = this.nodes[fleet.sourceId];
                const tgtNode = this.nodes[fleet.targetId];
                const cp = { x: fleet.cpx, y: fleet.cpy };
                const pos = bezierPoint(srcNode.pos, cp, tgtNode.pos, fleet.t);
                fleet.x = pos.x;
                fleet.y = pos.y;
            }
        }
    }

    private fleetArrive(fleet: Fleet): void {
        const target = this.nodes[fleet.targetId];
        if (target.owner === fleet.owner || target.owner === -1 && fleet.count > 0) {
            if (target.owner === fleet.owner) {
                // Reinforce
                target.units += fleet.count;
                if (target.units > target.maxUnits) target.units = target.maxUnits;
            } else {
                // Attack neutral/enemy
                this.resolveCombat(fleet, target);
            }
        } else {
            this.resolveCombat(fleet, target);
        }
    }

    private resolveCombat(fleet: Fleet, target: GameNode): void {
        if (target.owner === fleet.owner) {
            target.units += fleet.count;
            return;
        }

        const attackPower = fleet.count;
        const defenseMult = (target.owner >= 0 ? this.tuning.defenseFactor : 1);
        const defensePower = target.units * defenseMult;

        if (attackPower > defensePower) {
            // Attacker wins
            const remaining = attackPower - defensePower;
            target.owner = fleet.owner;
            target.units = Math.max(1, Math.floor(remaining));
            // Clear flow links owned by previous owner targeting this node
            this.flowLinks = this.flowLinks.filter(
                fl => !(fl.targetId === target.id && fl.owner !== fleet.owner)
            );
        } else {
            // Defender wins
            target.units = Math.max(0, (defensePower - attackPower) / defenseMult);
        }
    }

    /* ---- Flow links ---- */
    private updateFlowLinks(): void {
        for (const link of this.flowLinks) {
            if (!link.active) continue;

            const srcNode = this.nodes[link.sourceId];
            // Only flow from owned nodes
            if (srcNode.owner !== link.owner) {
                link.active = false;
                continue;
            }

            link.tickAccum++;
            if (link.tickAccum >= this.tuning.flowTickInterval) {
                link.tickAccum = 0;
                const amount = Math.max(1, Math.floor(srcNode.units * FLOW_AMOUNT_FRACTION));
                if (srcNode.units > amount + 2) {
                    this.dispatchFleet(link.owner, [link.sourceId], link.targetId, amount);
                }
            }
        }
    }

    /* ---- Dispatch fleet (packets) ---- */
    dispatchFleet(owner: number, sourceIds: number[], targetId: number, totalOverride?: number): void {
        const target = this.nodes[targetId];
        if (!target) return;

        for (const srcId of sourceIds) {
            const src = this.nodes[srcId];
            if (!src || src.owner !== owner) continue;

            const count = totalOverride
                ? Math.min(totalOverride, Math.floor(src.units) - 1)
                : Math.max(1, Math.floor(src.units * 0.5) - 1);
            if (count <= 0) continue;
            src.units -= count;

            const fleet = fleetPool.acquire();
            fleet.active = true;
            fleet.owner = owner;
            fleet.count = count;
            fleet.sourceId = srcId;
            fleet.targetId = targetId;
            fleet.t = 0;
            fleet.speed = FLEET_SPEED_BASE;
            fleet.x = src.pos.x;
            fleet.y = src.pos.y;

            // Compute bezier control point
            const cp = computeControlPoint(src.pos, target.pos);
            fleet.cpx = cp.x;
            fleet.cpy = cp.y;
            fleet.arcLength = bezierArcLength(src.pos, cp, target.pos);
            if (fleet.arcLength < 1) fleet.arcLength = 1;

            this.fleets.push(fleet);
        }
    }

    dispatchFleetPercent(owner: number, sourceIds: number[], targetId: number, percent: number): void {
        const target = this.nodes[targetId];
        if (!target) return;

        for (const srcId of sourceIds) {
            const src = this.nodes[srcId];
            if (!src || src.owner !== owner) continue;

            const count = Math.max(1, Math.floor(src.units * percent));
            if (count <= 0 || src.units <= 1) continue;
            src.units -= count;

            const fleet = fleetPool.acquire();
            fleet.active = true;
            fleet.owner = owner;
            fleet.count = count;
            fleet.sourceId = srcId;
            fleet.targetId = targetId;
            fleet.t = 0;
            fleet.speed = FLEET_SPEED_BASE;
            fleet.x = src.pos.x;
            fleet.y = src.pos.y;

            const cp = computeControlPoint(src.pos, target.pos);
            fleet.cpx = cp.x;
            fleet.cpy = cp.y;
            fleet.arcLength = bezierArcLength(src.pos, cp, target.pos);
            if (fleet.arcLength < 1) fleet.arcLength = 1;

            this.fleets.push(fleet);
        }
    }

    /* ---- Flow link management ---- */
    addFlowLink(owner: number, sourceId: number, targetId: number): void {
        // Check if link already exists
        const existing = this.flowLinks.find(
            f => f.sourceId === sourceId && f.targetId === targetId && f.owner === owner
        );
        if (existing) {
            existing.active = !existing.active;
            return;
        }
        this.flowLinks.push({
            id: this.nextFlowLinkId++,
            sourceId,
            targetId,
            owner,
            tickAccum: 0,
            active: true,
        });
    }

    removeFlowLink(owner: number, sourceId: number, targetId: number): void {
        this.flowLinks = this.flowLinks.filter(
            f => !(f.sourceId === sourceId && f.targetId === targetId && f.owner === owner)
        );
    }

    /* ---- AI command execution ---- */
    private executeAICommand(playerIndex: number, cmd: AICommand): void {
        switch (cmd.type) {
            case 'sendPacket':
                this.dispatchFleetPercent(playerIndex, cmd.sources, cmd.targetId, cmd.percent);
                break;
            case 'toggleFlow':
                if (cmd.sources.length > 0) {
                    this.addFlowLink(playerIndex, cmd.sources[0], cmd.targetId);
                }
                break;
            case 'removeFlow':
                if (cmd.sources.length > 0) {
                    this.removeFlowLink(playerIndex, cmd.sources[0], cmd.targetId);
                }
                break;
        }
    }

    /* ---- Replay event application ---- */
    private applyReplayEvent(evt: ReplayInputEvent): void {
        switch (evt.type) {
            case 'select': {
                const ids = evt.data['nodeIds'] as number[];
                const append = evt.data['append'] as boolean;
                if (!append) {
                    for (const n of this.nodes) n.selected = false;
                }
                for (const id of ids) {
                    if (this.nodes[id]) this.nodes[id].selected = true;
                }
                break;
            }
            case 'deselect':
                for (const n of this.nodes) n.selected = false;
                break;
            case 'sendPacket': {
                const sources = evt.data['sources'] as number[];
                const targetId = evt.data['targetId'] as number;
                const percent = evt.data['percent'] as number;
                this.dispatchFleetPercent(this.humanPlayer, sources, targetId, percent);
                break;
            }
            case 'toggleFlow': {
                const srcId = evt.data['sourceId'] as number;
                const tgtId = evt.data['targetId'] as number;
                this.addFlowLink(this.humanPlayer, srcId, tgtId);
                break;
            }
            case 'removeFlow': {
                const srcId = evt.data['sourceId'] as number;
                const tgtId = evt.data['targetId'] as number;
                this.removeFlowLink(this.humanPlayer, srcId, tgtId);
                break;
            }
            case 'speedChange':
                this.speed = evt.data['speed'] as number;
                break;
            default:
                break;
        }
    }

    /* ---- Win/Lose check ---- */
    private checkGameEnd(): void {
        // Count nodes per player
        const nodeCounts = new Map<number, number>();
        for (const node of this.nodes) {
            if (node.owner >= 0) {
                nodeCounts.set(node.owner, (nodeCounts.get(node.owner) || 0) + 1);
            }
        }

        // Also count fleets
        const fleetCounts = new Map<number, number>();
        for (const fleet of this.fleets) {
            if (fleet.active) {
                fleetCounts.set(fleet.owner, (fleetCounts.get(fleet.owner) || 0) + 1);
            }
        }

        // Mark dead players
        for (const player of this.players) {
            if (!player.alive) continue;
            const hasNodes = (nodeCounts.get(player.index) || 0) > 0;
            const hasFleets = (fleetCounts.get(player.index) || 0) > 0;
            if (!hasNodes && !hasFleets) {
                player.alive = false;
            }
        }

        // Check if only one player remains
        const alivePlayers = this.players.filter(p => p.alive);
        if (alivePlayers.length === 1) {
            this.winner = alivePlayers[0].index;
            if (this.state === 'playing') {
                this.state = 'gameOver';
            }
        } else if (alivePlayers.length === 0) {
            // Draw (shouldn't happen normally)
            this.winner = -1;
            if (this.state === 'playing') {
                this.state = 'gameOver';
            }
        }
    }

    /* ---- Replay mode start ---- */
    startReplay(data: ReturnType<ReplayRecorder['export']>): void {
        this.init(String(data.seed), data.nodeCount, data.difficulty as Difficulty);
        this.replayPlayer = new ReplayPlayer(data);
        this.state = 'replayMode';
    }
}

// Internal reference constant
const FLEET_SPEED_BASE = 80;
