# Stellar Conquest

> Real-time space conquest strategy — fast macro decisions, deep map control, no micromanagement clutter.

Stellar Conquest is a browser-based strategy game where players capture planets, route fleets, control territory, and outmaneuver opponents through timing and positioning — not unit spam. Playable solo or against live opponents in multiplayer rooms.

---

## Features

**Core mechanics**
- Planet capture through fleet dispatch and attrition combat
- Persistent flow links — set routing priorities once and let your economy run
- Parked fleets that hold ground but decay when supply is cut
- Territory and assimilation — borders that grow organically around your worlds
- Turrets and defense fields on fortified nodes
- Wormholes, gravity wells, and barrier gates that reshape routing

**Game modes**
- **Skirmish** — freeform match against AI or friends
- **Campaign** — structured mission ladder with handcrafted objectives
- **Daily challenge** — seeded procedural scenario, one attempt per day
- **Custom maps** — full in-game map editor and export
- **Multiplayer** — real-time rooms with Socket.IO, up to 6 players
- **Replays** — record and replay any match

**AI**
- Heuristic-driven opponent tuned for fast browser execution
- Multiple difficulty levels with dynamic difficulty adjustment
- Aware of territory, turrets, supply, and threat geometry

---

## Project Structure

```
stellar_conquest.html   Main game page (singleplayer entry)
game.js                 Single canonical game client (~6 100 lines, plain JS)
server.js               Multiplayer server (Express + Socket.IO)
index.html              Vite dev entry

assets/
  sim/                  Deterministic simulation modules (shared client ↔ server)
    ai.js               AI heuristics and targeting
    barrier.js          Barrier gate dispatch rules
    cap.js              Unit cap computation
    command_apply.js    Authoritative command application
    defense_field.js    Defense field damage and stats
    dispatch_math.js    Fleet send-count calculation
    fleet_step.js       Fleet movement and arrival resolution
    flow_step.js        Flow link propagation
    holding_decay.js    Parked fleet supply decay
    map_gen.js          Procedural map generation
    match_manifest.js   Match configuration and seed handling
    node_economy.js     Planet production stepping
    reinforcement.js    Friendly reinforcement room computation
    ruleset.js          Ruleset config (territory, assimilation, flow, etc.)
    server_sim.js       Authoritative server-side simulation wrapper
    state_hash.js       Deterministic sync hash
    state_metrics.js    Ownership, supply, and power metrics
    strategic_pulse.js  Timed production pulse events
    territory.js        Territory radius and border geometry
    turret.js           Turret targeting and damage
    ...
  campaign/
    levels.js           Campaign mission definitions
    daily_challenge.js  Daily seed generation
    objectives.js       Objective evaluation logic
  ui/
    renderers.js        Leaderboard, mission panel, room list renderers
  audio.js              Sound engine

tests/                  Node.js built-in test runner — one file per sim module
```

---

## Getting Started

```bash
npm install
```

### Singleplayer / local dev

```bash
npm run dev
```

Open `http://localhost:5173` — Vite serves the client with hot reload.

### Multiplayer server

```bash
npm run server
```

Open `http://localhost:3000` — Express serves the built client and handles Socket.IO rooms.

### Production build

```bash
npm run build
```

Outputs to `dist/`. `server.js` auto-detects:
- **dist mode** — serves the Vite bundle when `dist/` exists
- **source mode** — falls back to raw source files otherwise

---

## Testing

Tests use the Node.js built-in test runner — no extra dependencies required.

```bash
npm test
```

Every simulation module has a corresponding test file in `tests/`. The suite covers fleet movement, dispatch math, territory, turret damage, flow propagation, map generation, state hashing, and more.

---

## Docker Deployment

```bash
docker compose up -d --build
```

Starts the game server in a `solarmax-app` container on port `3000`.

| Detail | Value |
|---|---|
| Container name | `solarmax-app` |
| Internal port | `3000` |
| Persistent data | `./data` volume |
| External network | `npm-net` (must exist) |

If you run the app behind a reverse proxy, enable **WebSocket forwarding** for Socket.IO. The live instance uses Nginx Proxy Manager with Let's Encrypt TLS.

**Live deployment:** [`https://solarmax.urgup.keenetic.link`](https://solarmax.urgup.keenetic.link)

---

## Multiplayer Protocol

- Room codes are 5 characters
- Match result is accepted only after **all active players** report the same winner index
- Rematch and result votes are cleared on player disconnect
- The server runs an authoritative simulation tick and reconciles client state via sync hash

---

## Tech Stack

| Layer | Technology |
|---|---|
| Game client | Plain JavaScript (ES modules), Canvas 2D |
| Dev server | Vite 5 |
| Multiplayer | Express 4 + Socket.IO 4 |
| Build | Vite (ESM bundle) |
| Tests | Node.js built-in `node:test` |
| Container | Docker + Docker Compose |

No frameworks, no heavyweight runtime — the entire game logic runs in a single `game.js` file that can be opened directly in a browser.

---

## Design Philosophy

The game is built around **fast macro decisions over heavy micro**. The guiding principles:

- **Simple input loop** — select, drag/send, set flow, reposition, time your attacks. New systems must create better decisions, not more buttons.
- **Map-level depth** — mechanics should affect routing, territory, timing windows, and objective pressure — not produce more unit types to memorize.
- **Cross-mode reusability** — every feature should work in skirmish, campaign, daily challenge, custom maps, and multiplayer.
- **Readability first** — players should understand why a fleet is faster, slower, decaying, or contested from visuals alone. Mobile must stay viable.

---

## Roadmap

The current game has a strong foundation: real-time planet conquest, campaign scenarios, daily challenges, replays, custom maps, multiplayer rooms, territory, assimilation, and flow mechanics.

The next stage deepens this identity rather than chasing a traditional RTS feature set.

### Short-term (highest leverage, builds on existing systems)

1. **Territory 2.0 and Contested Fronts** — turn territory from a passive modifier into a real frontline system with contested zones, visual distinction, and AI frontier awareness
2. **Sector Mutators v1** — one dominant environmental rule per map (ion storms, pulse-rich sectors, blackout zones, unstable corridors) that changes routing and tempo without changing the control scheme
3. **AI Frontier Awareness** — stop drip-feeding into defended fronts, stage parked fleets before pushes, evaluate contested territory correctly
4. **Visual Readability Pass** — stronger frontier rendering, clearer fleet state indicators, better mobile HUD compression

### Mid-term (identity and retention)

5. **Commander / Doctrine System** — pre-match strategic identity via one passive bonus, one active ability, one tradeoff. Families: Logistics, Assimilation, Siege, Territory, Pulse
6. **Campaign Expansion** — evolve from skirmish ladder to structured teaching and challenge missions with survival, escort, boss, and objective variants
7. **PvE Objectives and Boss Encounters** — mega-turrets, ancient cores, timed defense events — bosses that create spatial problems solved through routing and timing
8. **Mode Wrappers and Playlists** — Ranked, Chaos, Ironman, Puzzle Sector, Zen, Frontier — same controls, different strategic context

### Long-term (competitive shell and ecosystem)

9. **Competitive Layer** — Elo/MMR, seasons, spectator mode, replay browser, match history
10. **Faction Identity** — asymmetry through doctrine defaults and territory behavior differences, not unit production lines
11. **Social and Community Features** — challenge seeds, replay sharing, community map spotlight, tournaments

### What not to build

- Giant tech trees
- Many separate unit classes
- High-APM active ability spam
- One-off mechanics that only work in one obscure mode
- AI that compensates for weakness through production cheats

---

## License

Private project.
