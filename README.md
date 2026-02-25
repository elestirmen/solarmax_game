# Stellar Conquest

Real-time node conquest strategy game (Canvas) with fog of war, flow links, replay, and adaptive AI.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` (redirects to `stellar_conquest.html`).

Direct file mode also works: open `stellar_conquest.html`.

## Game Modes

- **Tek Oyunculu (Single Player):** Play against AI. Choose seed, node count, difficulty, and Fog of War.
- **Çok Oyunculu (Multiplayer):** PvP against other players. Create a room or join with a 5-character code.

## Multiplayer Run

```bash
npm install
npm run server
```

Open `http://localhost:3000` on all players (host and remote).

For remote play, share host IP/domain (e.g. `http://192.168.1.20:3000`) instead of `localhost`.

**Flow:**
1. Enter your nick
2. **Oda Kur** – Create room (host sets seed, nodes, difficulty)
3. **Oda Listesi** – See open rooms and click **Katil** to join
4. Or enter **Oda Kodu** and click **Koda Katil**
5. Host clicks **Oyunu Baslat** when 2+ players are ready

If using Vite + HMR:
1. Terminal A: `npm run server`
2. Terminal B: `npm run dev`
3. Open `http://localhost:5173` (socket: `localhost:3000`)

## Controls

- Left click own node: select
- Shift + click: multi-select
- Drag on empty space: marquee select
- Shift + drag: marquee append (selected nodes varken de tarama)
- Ctrl + drag from empty space with selected group to a target: send fleet
- Right click enemy/neutral from selected nodes: toggle flow link
- `A`: select all owned nodes
- `U`: upgrade selected owned nodes (costs units, max level 3)
- `1`..`9`, `0`: set send percent to 10..90, 100
- `P` or `Esc`: pause
- Mouse wheel: zoom
- Middle mouse drag: pan
- Fog of War default: OFF

Online menu:

- `Nick`: every player enters and confirms nick first
- Nick confirmed -> player is auto-joined to the single room
- `Online Baslat`: starts match when room has at least 2 players

## Gameplay Systems

- Node archetypes:
  - `Core`: balanced
  - `Forge`: high production
  - `Bulwark`: high defense and capacity
  - `Relay`: stronger flow/speed logistics
- Node upgrades (levels 1-3): increase production, defense, and capacity.
- Map modifiers (seeded, deterministic):
  - Wormhole pair (fast lane between two distant nodes)
  - Gravity sling zone (temporary fleet speed boost inside radius)
- Adaptive AI:
  - AI archetypes (Rusher/Balancer/Turtle)
  - Score-based target selection with node-type valuation
  - Optional hidden assistance for trailing AI (`tune.aiAssist`)

## Difficulty Balancing

- `Easy`: slower AI decisions, lower AI production, stronger human start, fewer map modifiers.
- `Normal`: baseline values, adaptive AI enabled, mixed map modifiers.
- `Hard`: faster/more aggressive AI, fog-aware AI, stronger AI economy and starts, denser map modifiers.

## Replay

- End game -> `Watch Replay` or `Export Replay`.
- Main menu -> `Load Replay`.
- Replay loader accepts both legacy format (`nc`, `diff`) and TS format (`nodeCount`, `difficulty`).

## Notes

- Runtime game path is `stellar_conquest.html` + `game.js`.
- `vite build` is configured with both `index.html` and `stellar_conquest.html`.
