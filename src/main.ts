/* =========================================================
   main.ts – Entry point: game loop, DOM wiring, event handlers
   ========================================================= */

import { Game, GameState } from './game';
import { render } from './render';
import {
    InputState, createInputState,
    screenToWorld, hitTestNode, nodesInRect, applyZoom,
} from './input';
import { TICK_DT, defaultTuning, Difficulty } from './constants';

/* ---- DOM refs ---- */
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Overlays
const mainMenu = document.getElementById('mainMenu')!;
const pauseOverlay = document.getElementById('pauseOverlay')!;
const gameOverOverlay = document.getElementById('gameOverOverlay')!;
const hud = document.getElementById('hud')!;
const replayBar = document.getElementById('replayBar')!;
const tuningPanel = document.getElementById('tuningPanel')!;
const tuneOpenBtn = document.getElementById('tuneOpenBtn')!;

// Menu inputs
const seedInput = document.getElementById('seedInput') as HTMLInputElement;
const randomSeedBtn = document.getElementById('randomSeedBtn')!;
const nodeCountInput = document.getElementById('nodeCountInput') as HTMLInputElement;
const nodeCountLabel = document.getElementById('nodeCountLabel')!;
const difficultySelect = document.getElementById('difficultySelect') as HTMLSelectElement;
const startBtn = document.getElementById('startBtn')!;
const loadReplayBtn = document.getElementById('loadReplayBtn')!;
const replayFileInput = document.getElementById('replayFileInput') as HTMLInputElement;

// Pause
const resumeBtn = document.getElementById('resumeBtn')!;
const quitBtn = document.getElementById('quitBtn')!;

// Game Over
const gameOverTitle = document.getElementById('gameOverTitle')!;
const gameOverMsg = document.getElementById('gameOverMsg')!;
const replayBtn = document.getElementById('replayBtn')!;
const exportReplayBtn = document.getElementById('exportReplayBtn')!;
const restartBtn = document.getElementById('restartBtn')!;

// HUD
const hudTick = document.getElementById('hudTick')!;
const hudPercent = document.getElementById('hudPercent')!;
const sendPercentSlider = document.getElementById('sendPercent') as HTMLInputElement;
const pauseBtn = document.getElementById('pauseBtn')!;
const speedBtn = document.getElementById('speedBtn')!;

// Replay bar
const replaySlower = document.getElementById('replaySlower')!;
const replayPauseBtn = document.getElementById('replayPause')!;
const replayFaster = document.getElementById('replayFaster')!;
const replaySpeedLabel = document.getElementById('replaySpeedLabel')!;
const replayTickLabel = document.getElementById('replayTickLabel')!;
const replayStopBtn = document.getElementById('replayStop')!;

// Tuning
const tuneProduction = document.getElementById('tuneProduction') as HTMLInputElement;
const tuneFleetSpeed = document.getElementById('tuneFleetSpeed') as HTMLInputElement;
const tuneDefense = document.getElementById('tuneDefense') as HTMLInputElement;
const tuneFlowInterval = document.getElementById('tuneFlowInterval') as HTMLInputElement;
const tuneAIAggression = document.getElementById('tuneAIAggression') as HTMLInputElement;
const tuneAIBuffer = document.getElementById('tuneAIBuffer') as HTMLInputElement;
const tuneAIDecision = document.getElementById('tuneAIDecision') as HTMLInputElement;
const tuneResetBtn = document.getElementById('tuneResetBtn')!;
const tuneToggleBtn = document.getElementById('tuneToggleBtn')!;
const tuneValEls = {
    production: document.getElementById('tuneProductionVal')!,
    fleetSpeed: document.getElementById('tuneFleetSpeedVal')!,
    defense: document.getElementById('tuneDefenseVal')!,
    flowInterval: document.getElementById('tuneFlowIntervalVal')!,
    aiAggression: document.getElementById('tuneAIAggressionVal')!,
    aiBuffer: document.getElementById('tuneAIBufferVal')!,
    aiDecision: document.getElementById('tuneAIDecisionVal')!,
};

/* ---- Game & Input ---- */
const game = new Game();
const input: InputState = createInputState();
let tuningOpen = false;
let lastReplayData: ReturnType<typeof game.recorder.export> | null = null;

/* ---- Canvas resize ---- */
function resizeCanvas(): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ---- UI State management ---- */
function showUI(state: GameState): void {
    mainMenu.classList.toggle('hidden', state !== 'mainMenu');
    pauseOverlay.classList.toggle('hidden', state !== 'paused');
    gameOverOverlay.classList.toggle('hidden', state !== 'gameOver');

    const inGame = state === 'playing' || state === 'paused' || state === 'replayMode';
    hud.classList.toggle('hidden', !inGame || state === 'replayMode');
    replayBar.classList.toggle('hidden', state !== 'replayMode');

    if (state === 'playing' && tuningOpen) {
        tuningPanel.classList.remove('hidden');
        tuneOpenBtn.classList.add('hidden');
    } else if (state === 'playing') {
        tuningPanel.classList.add('hidden');
        tuneOpenBtn.classList.remove('hidden');
    } else {
        tuningPanel.classList.add('hidden');
        tuneOpenBtn.classList.add('hidden');
    }
}

/* ---- Menu events ---- */
nodeCountInput.addEventListener('input', () => {
    nodeCountLabel.textContent = nodeCountInput.value;
});

randomSeedBtn.addEventListener('click', () => {
    seedInput.value = String(Math.floor(Math.random() * 100000));
});

startBtn.addEventListener('click', () => {
    const seed = seedInput.value || '42';
    const nodeCount = parseInt(nodeCountInput.value, 10);
    const difficulty = difficultySelect.value as Difficulty;
    game.init(seed, nodeCount, difficulty);
    input.selectedNodes.clear();
    showUI('playing');
});

loadReplayBtn.addEventListener('click', () => {
    replayFileInput.click();
});

replayFileInput.addEventListener('change', () => {
    const file = replayFileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result as string);
            game.startReplay(data);
            showUI('replayMode');
        } catch (e) {
            alert('Invalid replay file: ' + e);
        }
    };
    reader.readAsText(file);
});

/* ---- Pause events ---- */
pauseBtn.addEventListener('click', () => {
    if (game.state === 'playing') {
        game.state = 'paused';
        showUI('paused');
    }
});

resumeBtn.addEventListener('click', () => {
    if (game.state === 'paused') {
        game.state = 'playing';
        showUI('playing');
    }
});

quitBtn.addEventListener('click', () => {
    game.state = 'mainMenu';
    showUI('mainMenu');
});

/* ---- Speed ---- */
const speeds = [1, 2, 4];
let speedIndex = 0;
speedBtn.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % speeds.length;
    game.speed = speeds[speedIndex];
    speedBtn.textContent = `${game.speed}x`;
    game.recorder.record(game.tick, 'speedChange', { speed: game.speed });
});

/* ---- Send percent ---- */
sendPercentSlider.addEventListener('input', () => {
    input.sendPercent = parseInt(sendPercentSlider.value, 10);
    hudPercent.textContent = `Send: ${input.sendPercent}%`;
});

/* ---- Game Over ---- */
replayBtn.addEventListener('click', () => {
    if (lastReplayData) {
        game.startReplay(lastReplayData);
        showUI('replayMode');
    }
});

exportReplayBtn.addEventListener('click', () => {
    if (!lastReplayData) return;
    const blob = new Blob([JSON.stringify(lastReplayData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stellar-conquest-replay-${lastReplayData.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

restartBtn.addEventListener('click', () => {
    game.state = 'mainMenu';
    showUI('mainMenu');
});

/* ---- Replay bar events ---- */
replaySlower.addEventListener('click', () => {
    if (game.replayPlayer) {
        game.replayPlayer.speed = Math.max(0.25, game.replayPlayer.speed / 2);
        replaySpeedLabel.textContent = `${game.replayPlayer.speed}x`;
    }
});

replayFaster.addEventListener('click', () => {
    if (game.replayPlayer) {
        game.replayPlayer.speed = Math.min(8, game.replayPlayer.speed * 2);
        replaySpeedLabel.textContent = `${game.replayPlayer.speed}x`;
    }
});

replayPauseBtn.addEventListener('click', () => {
    if (game.replayPlayer) {
        game.replayPlayer.paused = !game.replayPlayer.paused;
        replayPauseBtn.textContent = game.replayPlayer.paused ? '▶' : '⏸';
    }
});

replayStopBtn.addEventListener('click', () => {
    game.state = 'mainMenu';
    showUI('mainMenu');
});

/* ---- Tuning panel ---- */
function syncTuningUI(): void {
    tuneProduction.value = String(game.tuning.productionMultiplier);
    tuneFleetSpeed.value = String(game.tuning.fleetSpeed);
    tuneDefense.value = String(game.tuning.defenseFactor);
    tuneFlowInterval.value = String(game.tuning.flowTickInterval);
    tuneAIAggression.value = String(game.tuning.aiAggression);
    tuneAIBuffer.value = String(game.tuning.aiBuffer);
    tuneAIDecision.value = String(game.tuning.aiDecisionInterval);
    updateTuneLabels();
}

function updateTuneLabels(): void {
    tuneValEls.production.textContent = parseFloat(tuneProduction.value).toFixed(1);
    tuneValEls.fleetSpeed.textContent = tuneFleetSpeed.value;
    tuneValEls.defense.textContent = parseFloat(tuneDefense.value).toFixed(1);
    tuneValEls.flowInterval.textContent = tuneFlowInterval.value;
    tuneValEls.aiAggression.textContent = parseFloat(tuneAIAggression.value).toFixed(1);
    tuneValEls.aiBuffer.textContent = tuneAIBuffer.value;
    tuneValEls.aiDecision.textContent = tuneAIDecision.value;
}

function readTuning(): void {
    if (game.state === 'replayMode') return; // locked during replay
    game.tuning.productionMultiplier = parseFloat(tuneProduction.value);
    game.tuning.fleetSpeed = parseFloat(tuneFleetSpeed.value);
    game.tuning.defenseFactor = parseFloat(tuneDefense.value);
    game.tuning.flowTickInterval = parseInt(tuneFlowInterval.value, 10);
    game.tuning.aiAggression = parseFloat(tuneAIAggression.value);
    game.tuning.aiBuffer = parseInt(tuneAIBuffer.value, 10);
    game.tuning.aiDecisionInterval = parseInt(tuneAIDecision.value, 10);
    updateTuneLabels();
}

[tuneProduction, tuneFleetSpeed, tuneDefense, tuneFlowInterval,
    tuneAIAggression, tuneAIBuffer, tuneAIDecision].forEach(el => {
        el.addEventListener('input', readTuning);
    });

tuneResetBtn.addEventListener('click', () => {
    game.tuning = defaultTuning();
    syncTuningUI();
});

tuneToggleBtn.addEventListener('click', () => {
    tuningOpen = false;
    tuningPanel.classList.add('hidden');
    tuneOpenBtn.classList.remove('hidden');
});

tuneOpenBtn.addEventListener('click', () => {
    tuningOpen = true;
    tuningPanel.classList.remove('hidden');
    tuneOpenBtn.classList.add('hidden');
    syncTuningUI();
});

/* ---- Canvas mouse events ---- */
canvas.addEventListener('mousedown', (e: MouseEvent) => {
    if (game.state !== 'playing') return;

    const world = screenToWorld(e.offsetX, e.offsetY, game.camera, canvas);
    input.mouseWorld = world;
    input.mouseScreen = { x: e.offsetX, y: e.offsetY };

    // Middle mouse: pan
    if (e.button === 1) {
        input.panActive = true;
        input.panLastScreen = { x: e.offsetX, y: e.offsetY };
        e.preventDefault();
        return;
    }

    // Right click: flow link
    if (e.button === 2) {
        const node = hitTestNode(world, game.nodes);
        if (node && input.selectedNodes.size > 0 && node.owner !== game.humanPlayer) {
            // Create flow link from each selected node
            for (const srcId of input.selectedNodes) {
                const src = game.nodes[srcId];
                if (src && src.owner === game.humanPlayer) {
                    game.addFlowLink(game.humanPlayer, srcId, node.id);
                    game.recorder.record(game.tick, 'toggleFlow', {
                        sourceId: srcId,
                        targetId: node.id,
                    });
                }
            }
        }
        e.preventDefault();
        return;
    }

    // Left click
    const clickedNode = hitTestNode(world, game.nodes);
    input.shiftHeld = e.shiftKey;

    if (clickedNode && clickedNode.owner === game.humanPlayer) {
        // Select own node
        if (!e.shiftKey) {
            for (const n of game.nodes) n.selected = false;
            input.selectedNodes.clear();
        }
        clickedNode.selected = true;
        input.selectedNodes.add(clickedNode.id);
        game.recorder.record(game.tick, 'select', {
            nodeIds: [...input.selectedNodes],
            append: e.shiftKey,
        });
    } else if (clickedNode && input.selectedNodes.size > 0) {
        // Clicked enemy/neutral with selection: send fleet
        const sources = [...input.selectedNodes];
        const percent = input.sendPercent / 100;
        game.dispatchFleetPercent(game.humanPlayer, sources, clickedNode.id, percent);
        game.recorder.record(game.tick, 'sendPacket', {
            sources,
            targetId: clickedNode.id,
            percent,
        });
    } else {
        // Start drag/marquee on empty space
        if (input.selectedNodes.size > 0) {
            // Start drag (fleet send targeting line)
            input.dragActive = true;
            // Use the centroid of selected nodes as drag start
            let cx = 0, cy = 0, count = 0;
            for (const id of input.selectedNodes) {
                cx += game.nodes[id].pos.x;
                cy += game.nodes[id].pos.y;
                count++;
            }
            input.dragStart = { x: cx / count, y: cy / count };
            input.dragEnd = world;
            input.dragSourceNodes = [...input.selectedNodes];
        } else {
            if (!e.shiftKey) {
                for (const n of game.nodes) n.selected = false;
                input.selectedNodes.clear();
                game.recorder.record(game.tick, 'deselect', {});
            }
            input.marqueeActive = true;
            input.marqueeStart = { x: e.offsetX, y: e.offsetY };
            input.marqueeEnd = { x: e.offsetX, y: e.offsetY };
        }
    }
});

canvas.addEventListener('mousemove', (e: MouseEvent) => {
    const world = screenToWorld(e.offsetX, e.offsetY, game.camera, canvas);
    input.mouseWorld = world;
    input.mouseScreen = { x: e.offsetX, y: e.offsetY };

    if (input.panActive) {
        const dx = (e.offsetX - input.panLastScreen.x) / game.camera.zoom;
        const dy = (e.offsetY - input.panLastScreen.y) / game.camera.zoom;
        game.camera.x -= dx;
        game.camera.y -= dy;
        input.panLastScreen = { x: e.offsetX, y: e.offsetY };
        return;
    }

    if (input.dragActive) {
        input.dragEnd = world;
        return;
    }

    if (input.marqueeActive) {
        input.marqueeEnd = { x: e.offsetX, y: e.offsetY };
    }
});

canvas.addEventListener('mouseup', (e: MouseEvent) => {
    if (e.button === 1) {
        input.panActive = false;
        return;
    }

    if (input.dragActive) {
        // Drop on a node → send fleet
        const world = screenToWorld(e.offsetX, e.offsetY, game.camera, canvas);
        const targetNode = hitTestNode(world, game.nodes);
        if (targetNode && input.dragSourceNodes.length > 0) {
            const percent = input.sendPercent / 100;
            game.dispatchFleetPercent(game.humanPlayer, input.dragSourceNodes, targetNode.id, percent);
            game.recorder.record(game.tick, 'sendPacket', {
                sources: input.dragSourceNodes,
                targetId: targetNode.id,
                percent,
            });
        }
        input.dragActive = false;
        input.dragSourceNodes = [];
        return;
    }

    if (input.marqueeActive) {
        // Select all own nodes in marquee rect (screen coords → world)
        const startW = screenToWorld(input.marqueeStart.x, input.marqueeStart.y, game.camera, canvas);
        const endW = screenToWorld(input.marqueeEnd.x, input.marqueeEnd.y, game.camera, canvas);
        const ids = nodesInRect(startW, endW, game.nodes, game.humanPlayer);
        if (ids.length > 0) {
            if (!input.shiftHeld) {
                for (const n of game.nodes) n.selected = false;
                input.selectedNodes.clear();
            }
            for (const id of ids) {
                game.nodes[id].selected = true;
                input.selectedNodes.add(id);
            }
            game.recorder.record(game.tick, 'select', {
                nodeIds: [...input.selectedNodes],
                append: input.shiftHeld,
            });
        }
        input.marqueeActive = false;
    }
});

canvas.addEventListener('wheel', (e: WheelEvent) => {
    if (game.state !== 'playing' && game.state !== 'replayMode') return;
    applyZoom(game.camera, e.deltaY, input.mouseWorld);
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());

/* ---- Keyboard ---- */
window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (game.state === 'playing') {
        if (e.key === 'Escape' || e.key === 'p') {
            game.state = 'paused';
            showUI('paused');
        }
        if (e.key === 'a') {
            // Select all own nodes
            for (const n of game.nodes) {
                if (n.owner === game.humanPlayer) {
                    n.selected = true;
                    input.selectedNodes.add(n.id);
                }
            }
        }
    } else if (game.state === 'paused') {
        if (e.key === 'Escape' || e.key === 'p') {
            game.state = 'playing';
            showUI('playing');
        }
    }
});

/* ---- Game loop ---- */
let accumulator = 0;
let lastTime = 0;
let prevState: GameState = 'mainMenu';

function gameLoop(timestamp: number): void {
    const rawDt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // State change detection
    if (game.state !== prevState) {
        showUI(game.state);
        if (game.state === 'gameOver') {
            lastReplayData = game.recorder.export();
            gameOverTitle.textContent = game.winner === game.humanPlayer ? '🏆 Victory!' : '💀 Defeat';
            gameOverMsg.textContent = game.winner === game.humanPlayer
                ? `You conquered all stars in ${game.tick} ticks!`
                : `You were eliminated at tick ${game.tick}.`;
        }
        prevState = game.state;
    }

    // Fixed tick updates
    if (game.state === 'playing' || game.state === 'replayMode') {
        const effectiveSpeed = game.state === 'replayMode' && game.replayPlayer
            ? (game.replayPlayer.paused ? 0 : game.replayPlayer.speed)
            : game.speed;

        accumulator += rawDt * effectiveSpeed;

        while (accumulator >= TICK_DT) {
            game.update();
            accumulator -= TICK_DT;
        }

        // Update HUD
        hudTick.textContent = `Tick: ${game.tick}`;
        if (game.state === 'replayMode') {
            replayTickLabel.textContent = `Tick: ${game.tick}`;
        }
    }

    // Render
    if (game.state !== 'mainMenu') {
        render(
            ctx, canvas, game.camera,
            game.nodes, game.fleets, game.flowLinks, game.players,
            game.fog, game.humanPlayer, game.tick, rawDt,
            {
                active: input.marqueeActive,
                start: input.marqueeStart,
                end: input.marqueeEnd,
            },
            {
                active: input.dragActive,
                start: input.dragStart,
                end: input.dragEnd,
            },
        );
    }

    requestAnimationFrame(gameLoop);
}

/* ---- Start ---- */
showUI('mainMenu');
requestAnimationFrame((ts) => {
    lastTime = ts;
    gameLoop(ts);
});
