/* =========================================================
   replay.ts – Deterministic input recording & playback
   ========================================================= */

export type InputEventType =
    | 'select'
    | 'deselect'
    | 'marquee'
    | 'sendPacket'
    | 'toggleFlow'
    | 'removeFlow'
    | 'speedChange'
    | 'pause'
    | 'resume';

export interface ReplayInputEvent {
    tick: number;
    type: InputEventType;
    data: Record<string, unknown>;
}

export interface ReplayData {
    seed: number;
    nodeCount: number;
    difficulty: string;
    events: ReplayInputEvent[];
}

export class ReplayRecorder {
    private events: ReplayInputEvent[] = [];
    private _seed = 0;
    private _nodeCount = 0;
    private _difficulty = 'normal';

    init(seed: number, nodeCount: number, difficulty: string): void {
        this.events = [];
        this._seed = seed;
        this._nodeCount = nodeCount;
        this._difficulty = difficulty;
    }

    record(tick: number, type: InputEventType, data: Record<string, unknown> = {}): void {
        this.events.push({ tick, type, data });
    }

    export(): ReplayData {
        return {
            seed: this._seed,
            nodeCount: this._nodeCount,
            difficulty: this._difficulty,
            events: [...this.events],
        };
    }

    exportJSON(): string {
        return JSON.stringify(this.export(), null, 2);
    }
}

export class ReplayPlayer {
    private data: ReplayData;
    private eventIndex = 0;
    speed = 1;
    paused = false;

    constructor(data: ReplayData) {
        this.data = data;
    }

    get seed(): number { return this.data.seed; }
    get nodeCount(): number { return this.data.nodeCount; }
    get difficulty(): string { return this.data.difficulty; }
    get totalEvents(): number { return this.data.events.length; }

    /**
     * Get all events for the given tick.
     */
    getEventsForTick(tick: number): ReplayInputEvent[] {
        const result: ReplayInputEvent[] = [];
        while (
            this.eventIndex < this.data.events.length &&
            this.data.events[this.eventIndex].tick === tick
        ) {
            result.push(this.data.events[this.eventIndex]);
            this.eventIndex++;
        }
        return result;
    }

    /**
     * Check if replay has finished (no more events and past last event tick).
     */
    isFinished(currentTick: number): boolean {
        if (this.data.events.length === 0) return currentTick > 60;
        return this.eventIndex >= this.data.events.length &&
            currentTick > this.data.events[this.data.events.length - 1].tick + 90;
    }

    reset(): void {
        this.eventIndex = 0;
        this.speed = 1;
        this.paused = false;
    }
}
