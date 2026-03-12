<p align="center">
  <img src="https://img.shields.io/badge/Stellar%20Conquest-v1.0.0-blue?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/JavaScript-ES%20Modules-yellow?style=flat-square" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square" alt="Vite" />
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square" alt="Socket.IO" />
</p>

<h1 align="center">Stellar Conquest</h1>

<p align="center">
  <strong>Real-time space conquest strategy</strong> - fast macro decisions, deep map control, no micro-management clutter.
</p>

<p align="center">
  <a href="./README.md">TR</a> • <a href="./README.en.md">EN</a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#how-to-play">How to Play</a> •
  <a href="#setup">Setup</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#live-demo">Live Demo</a>
</p>

---

## Summary

**Stellar Conquest** is a browser-based strategy game about capturing planets, routing fleets, controlling space, and beating opponents through timing and positioning. The design emphasizes macro decision-making over unit spam or high-APM micro. It supports both singleplayer and real-time multiplayer rooms.

---

## Quick Start

```bash
# Install dependencies
npm install

# Singleplayer / development mode
npm run dev
# -> http://localhost:5173

# Multiplayer server
npm run server
# -> http://localhost:3000
```

**One-command Docker launch:**

```bash
docker compose up -d --build
```

---

## Features

### Core Mechanics

| Mechanic | Description |
|--------|-------------|
| **Planet capture** | Capture through fleet dispatch and attrition-based combat |
| **Flow links** | Set routes once and let your economy reinforce automatically |
| **Parked fleets** | Hold deep space, stage attacks, and decay when unsupported |
| **Territory and assimilation** | Borders grow from fully assimilated worlds |
| **Defense systems** | Defensive nodes, turrets, and defense fields |
| **Map features** | Wormholes, gravity wells, and barrier gates |

### Game Modes

- **Skirmish** - Free matches against AI or friends
- **Campaign** - Structured handcrafted mission ladder
- **Daily Challenge** - Seeded procedural scenario with daily variation
- **Custom Maps** - JSON-based custom map import/export flow
- **Multiplayer** - Real-time Socket.IO rooms for up to 6 players

### AI

- Fast heuristic AI designed to run in the browser
- Multiple difficulty levels with dynamic tuning
- Aware of territory, turrets, supply, and local threat geometry

---

## How to Play

### Core Controls (PC)

| Action | Control |
|-------|---------|
| Select planet | Left click |
| Multi-select | Shift + left click |
| Box selection | Drag on empty space |
| Send fleet | Left click target while a source is selected |
| Group send | Ctrl + drag and release |
| Toggle flow | Right click on target |
| Defense mode | Right click on your own planet |
| Camera pan | Middle mouse + drag |
| Zoom | Mouse wheel |

### Keyboard Shortcuts

| Key | Function |
|-----|----------|
| `1`-`9` | Send percentage (10-90) |
| `0` | Send percentage 100 |
| `U` | Upgrade selected planets |
| `A` | Select all owned planets |
| `Esc` / `P` | Pause / resume |

### Mobile

- Use one finger to select and drag
- Use two fingers to pan and zoom the map

---

## Project Structure

```text
stellar_conquest.html   Main game page
game.js                 Single canonical client implementation
server.js               Multiplayer server (Express + Socket.IO)
index.html              Vite development entry

assets/
  sim/                  Deterministic simulation modules shared by client and server
    ai.js               AI heuristics and target scoring
    barrier.js          Barrier gate dispatch rules
    cap.js              Unit cap calculations
    command_apply.js    Authoritative command application
    defense_field.js    Defense field damage and stats
    dispatch_math.js    Fleet send amount calculations
    fleet_step.js       Fleet movement and arrival resolution
    flow_step.js        Flow link dispatch logic
    holding_decay.js    Parked fleet decay logic
    map_gen.js          Procedural map generation
    territory.js        Territory radius and border geometry
    turret.js           Turret targeting and damage
    ...
  campaign/
    levels.js           Campaign mission definitions
    daily_challenge.js  Daily challenge generation
    objectives.js       Objective evaluation logic
  ui/
    renderers.js        Leaderboard, mission, and room list rendering
  audio.js              Audio engine

tests/                  Node.js built-in test coverage for simulation modules
```

---

## Setup

### Requirements

- **Node.js** 18+
- **npm** or **pnpm**

### Singleplayer / Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

### Multiplayer Server

```bash
npm run server
```

Open `http://localhost:3000`.

### Production Build

```bash
npm run build
```

Output is written to `dist/`. `server.js` auto-detects:

- **dist mode** if `dist/` exists
- **source mode** otherwise

### Docker Deployment

```bash
docker compose up -d --build
```

The game server runs in the `solarmax-app` container on port `3000`.

| Detail | Value |
|-------|-------|
| Container name | `solarmax-app` |
| Internal port | `3000` |
| Persistent data | `./data` volume |
| External network | `npm-net` must already exist |

If you run behind a reverse proxy, enable WebSocket forwarding for Socket.IO. The current live setup uses Nginx Proxy Manager with Let's Encrypt TLS.

---

## Tests

The project uses the built-in Node.js test runner.

```bash
npm test
```

Modules under `assets/sim/` have matching tests under `tests/`. Coverage includes fleet movement, dispatch math, territory logic, turret damage, flow propagation, map generation, sync hashing, and more.

---

## Multiplayer Protocol Notes

- Room codes are 5 characters long
- Match results are accepted only after **all active players** report the same winner index
- Rematch and result votes are cleared when players disconnect
- The server runs the authoritative simulation tick and uses sync hashes to keep clients aligned

---

## Live Demo

**[https://solarmax.urgup.keenetic.link](https://solarmax.urgup.keenetic.link)**

---

## Tech Stack

| Layer | Technology |
|------|------------|
| Client | Plain JavaScript (ES modules), Canvas 2D |
| Dev server | Vite 5 |
| Multiplayer | Express 4 + Socket.IO 4 |
| Build | Vite |
| Tests | Node.js built-in `node:test` |
| Containerization | Docker + Docker Compose |

No framework and no heavy runtime. The core game logic still lives in a directly readable `game.js` file.

---

## Design Philosophy

The game is built around **fast macro decisions instead of heavy micro**:

- **Simple input loop** - select, drag/send, set flow, reposition, choose timing. New systems should create better decisions, not more buttons.
- **Map-level depth** - mechanics should influence routes, territory, timing windows, and objective pressure instead of memorized unit rosters.
- **Cross-mode reuse** - good features should work in skirmish, campaign, daily challenge, custom maps, and multiplayer.
- **Readability first** - the player should understand visually why a fleet is fast, slow, contested, protected, unsupplied, or decaying.

---

## Roadmap

This roadmap exists to do three things:

- deepen the current core game loop
- expand mode and content variety
- build a stronger long-term competitive and community shell

The key principle is simple: the game should become deeper through better decisions, not through more UI clutter.

### Recommended Delivery Order

If time is limited, the recommended order is:

1. **Territory 2.0 and Contested Fronts**
2. **Sector Mutators v1**
3. **AI Frontier Awareness**
4. **Visual Readability Pass**
5. **Commander / Doctrine System**
6. **Campaign Expansion**
7. **PvE Objectives and Boss Encounters**
8. **Mode Wrappers and Playlists**
9. **Competitive Layer**
10. **Faction Identity**
11. **Social and Community Features**

This order prioritizes features that reuse existing mechanics, reinforce the game's identity, and carry relatively low technical risk.

### Short-Term Focus

#### 1. Territory 2.0 and Contested Fronts

**Goal**

- turn territory from a passive speed/protection modifier into a real frontline system

**Scope**

- create `contested zones` where fully assimilated enemy borders overlap
- disable or reduce territory bonuses inside contested space
- render contested space with a neutral but readable visual language
- differentiate parked fleet behavior between backline and frontline areas
- stop AI from evaluating contested regions as safe territory

**Why it matters**

- borders gain real strategic meaning
- "where did I secure control?" becomes as important as "what did I capture?"
- parked fleets gain a natural strategic role

**Dependencies**

- stronger border rendering
- consistent rules in local and authoritative simulation
- frontier-aware AI target scoring

**Success criteria**

- players can intuitively read safe vs contested territory
- contested space becomes a natural battle concentration area

#### 2. Sector Mutators v1

**Goal**

- prevent matches from feeling too similar by adding one dominant environmental rule per map

**Scope**

- one main mutator such as ion storms, blackout sectors, pulse-rich regions, or collapse corridors
- deterministic generation tied to the seed
- mutator data preserved in daily challenge, campaign, and multiplayer state
- short mutator description surfaced in HUD or mission UI

**Why it matters**

- opening routes and timing windows change without changing the controls
- daily challenges feel like real scenarios rather than minor stat variations
- campaign levels gain stronger identity

**Dependencies**

- map manifest and generation integration
- anomaly rendering language
- network snapshot support for mutator metadata

**Success criteria**

- players remember matches by their rule twist
- mutators change routing and tempo instead of acting as hidden number buffs

#### 3. AI Frontier Awareness

**Goal**

- make AI harder in a way that feels natural rather than unfair

**Scope**

- stop drip-feeding into turrets and heavily defended nodes
- use parked fleets or staging before major pushes
- understand the difference between safe, contested, and enemy territory
- avoid overextending immediately after a fresh capture
- improve capital pressure timing against the human player

**Why it matters**

- difficulty feels more credible
- AI looks stronger because it makes better choices
- singleplayer and sandbox value increase

**Dependencies**

- territory 2.0
- better defense and turret threat scoring

**Success criteria**

- hard AI should look less self-destructive
- losses should feel tied to timing and positioning rather than AI cheats

#### 4. Visual Readability Pass

**Goal**

- keep expanding system depth readable instead of visually noisy

**Scope**

- contested border presentation
- clearer states for supplied / decaying / parked / boosted fleets
- anomaly and mutator overlays that remain readable without dominating the screen
- tighter mobile HUD adaptation
- improved mission and end-of-match feedback structure

**Why it matters**

- new mechanics should be learned visually, not only through text
- mobile clarity degrades quickly when systems expand

**Success criteria**

- players ask "why did that happen?" less often
- the HUD remains stable as more systems are added

### Mid-Term Focus

#### 5. Commander / Doctrine System

**Goal**

- give players a pre-match strategic identity

**Scope**

- one passive, one active, one tradeoff per doctrine
- candidate lines: `Logistics`, `Assimilation`, `Siege`, `Territory`, `Pulse`
- lobby or pre-match doctrine selection
- AI profile alignment with doctrines
- campaign missions that teach doctrine-specific play

**Risk**

- overly strong actives could turn the game into micro-heavy ability spam

**Success criteria**

- doctrine choice creates real opening and priority differences
- the system does not become a second action-bar game

#### 6. Campaign Expansion

**Goal**

- evolve the campaign from a difficulty ladder into a structured teaching and challenge track

**Scope**

- survival missions
- escort / protection missions
- sector holding missions
- mutator tutorial missions
- boss sectors
- multi-stage objectives and bonus goals

**Success criteria**

- each mission teaches or tests one main idea
- players remember mission identity, not only mission number

#### 7. PvE Objectives and Boss Encounters

**Goal**

- move the game beyond pure elimination as the only meaningful objective structure

**Scope**

- neutral mega-turrets
- ancient core / relay structures
- timed defense events
- special maps with shared threats
- a boss encounter framework reusable in campaign and daily challenge

**Design rule**

- boss content should create map-control and timing problems, not bullet-hell behavior

**Success criteria**

- PvE content creates new route and priority decisions
- it does not collapse into "just build more units"

#### 8. Mode Wrappers and Playlists

**Goal**

- package the same core game into clearly different session styles

**Scope**

- `Ranked`
- `Chaos`
- `Ironman`
- `Puzzle Sector`
- `Zen`
- `Frontier`

**Why it matters**

- the same mechanics can serve different player moods
- the front menu gains stronger structure

**Success criteria**

- playlists feel like different styles of play, not just stat presets

### Long-Term Focus

#### 9. Competitive Layer

**Goal**

- turn multiplayer into a durable long-term progression and comparison space

**Scope**

- Elo / MMR
- seasonal structure
- spectator mode
- match history
- post-match timelines and economy breakdowns

**Dependencies**

- robust authoritative sync
- reliable match-history data
- better reconnect and stability behavior

**Success criteria**

- players have reasons to return beyond ad-hoc room creation

#### 10. Faction Identity

**Goal**

- add asymmetry without losing readability

**Scope**

- different doctrine defaults
- light differences in territory, assimilation, or logistics behavior
- anomaly interaction bonuses
- biome or world-trait supported identities

**Avoid**

- too many separate unit classes
- large counter charts
- high-APM requirements

**Success criteria**

- factions feel strategically different while keeping the same input language

#### 11. Social and Community Features

**Goal**

- give the game a layer that outlives a single match

**Scope**

- shareable challenge seeds
- featured daily / weekly sectors
- community map showcases
- tournament or event playlists
- clan / squad support if the audience justifies it

**Success criteria**

- players return not only to play but to compare, share, and revisit content

### Explicit Non-Goals

- huge tech trees
- too many separate unit classes
- high-APM active ability spam
- one-off systems that only work in a single obscure mode
- AI that is "difficult" only because of hidden economy cheats
- mobile UI that degenerates into a graveyard of tiny buttons

### How To Measure Success

Roadmap work should improve at least some of these outcomes:

- more distinct match stories
- more natural-feeling AI
- more meaningful border, parked fleet, and route decisions
- more memorable campaign missions
- better multiplayer retention
- more depth without collapsing the HUD or input flow

If a feature does not clearly improve one of those outcomes, it should be questioned before implementation.

## Prompt Library For Roadmap Work

These prompts are designed for coding agents or LLM workflows operating inside this repository.

### Prompt 1 - Territory 2.0 and Contested Fronts

```text
Implement the `Territory 2.0 and Contested Fronts` feature in this repository.

First inspect the current territory, holding decay, fleet movement, parked fleet, and render flow.
Focus especially on:
- game.js
- assets/sim/territory.js
- assets/sim/fleet_step.js
- assets/sim/holding_decay.js
- assets/sim/server_sim.js

Desired behavior:
- when two enemy players' fully assimilated territory areas overlap, create a `contested zone`
- territory speed bonuses must not apply inside contested space
- parked fleet decay protection must not apply inside contested space
- contested space must have a readable but restrained visual treatment
- AI must stop evaluating contested space as safe backline territory

Constraints:
- local and authoritative simulation must use the same rules
- do not damage mobile readability
- keep CPU cost low
- do not break snapshot or sync logic

Expected output:
- code changes
- relevant tests
- build verification
- short technical summary
```

### Prompt 2 - Sector Mutators v1

```text
Design and implement `Sector Mutators v1` for this repository.

Inspect the current map generation, challenge, campaign, and shared simulation flow first.
Look at:
- assets/sim/map_gen.js
- assets/campaign/daily_challenge.js
- assets/campaign/levels.js
- game.js
- assets/sim/server_sim.js

Goal:
- each match can have one dominant environmental rule
- that rule must be deterministic from the seed
- it must be preserved in multiplayer snapshots

For the first version, implement at most 2 mutators:
- ion storm: fleets move slower inside a region
- blackout zone: territory bonuses are disabled inside a region

Constraints:
- the mutator effect must behave identically in local and server simulation
- visuals must stay readable
- do not break daily challenge or custom map flows

Deliver:
- code
- tests
- short documentation update if needed
- build result
```

### Prompt 3 - AI Frontier Awareness

```text
Improve the AI in this repository so it becomes harder but also more natural.

Inspect the AI decision flow carefully:
- game.js
- assets/sim/ai.js
- assets/sim/shared_config.js

Problems to address:
- drip-feeding into defended or turret targets
- attacking without understanding frontier geometry
- weak use of parked fleets and staging

Desired improvements:
- reduce low-odds attacks into fortified targets
- score contested vs enemy territory differently
- use parked fleet staging when opportunities appear
- stabilize newly captured worlds before overextending too aggressively

Constraints:
- browser-side CPU cost must remain reasonable
- difficulty presets should stay intact
- hard difficulty should feel meaningfully smarter, not just faster

Deliver:
- code changes
- test scenarios
- short behavior summary
```

### Prompt 4 - Visual Readability and Mobile HUD

```text
Perform a UI and render readability pass for this repository.

Inspect:
- stellar_conquest.html
- game.js
- assets/ui/renderers.js

Goals:
- add a restrained visual language for contested borders
- make parked, unsupplied, decaying, and boosted fleets more distinguishable
- make mutator and anomaly overlays visible without overwhelming the map
- improve mobile HUD density and information hierarchy

Constraints:
- preserve the existing visual identity
- think mobile-first
- avoid expensive effects that hurt performance

Expected output:
- CSS and canvas render changes
- short explanation of which readability problems were solved
- optional before/after space usage notes
```

### Prompt 5 - Commander / Doctrine System

```text
Design and implement a first playable `Commander / Doctrine System` for this repository.

Initial target:
- add 3 doctrines
- each doctrine must have 1 passive bonus, 1 active ability, and 1 tradeoff

Suggested starting set:
- Logistics
- Assimilation
- Siege

Inspect:
- game.js
- server.js
- assets/sim/*
- stellar_conquest.html

Constraints:
- do not turn this into a heavy tech tree
- actives should not require high APM
- think about multiplayer snapshot and AI compatibility

Expected output:
- data model
- UI selection flow
- local and server integration
- tests
- balance risk notes
```

### Prompt 6 - Campaign Plus PvE Boss Framework

```text
Design a reusable `PvE objective / boss framework` for this repository to strengthen campaign and daily challenge content.

Initial target:
- one mega turret boss
- one ancient relay core objective

Inspect:
- assets/campaign/levels.js
- assets/campaign/objectives.js
- assets/campaign/daily_challenge.js
- game.js
- assets/sim/server_sim.js

Constraints:
- boss design should create routing, timing, and map-control problems
- do not turn encounters into bullet-hell mechanics
- keep encounter state compatible with shared simulation

Deliver:
- common encounter/state model
- 1 to 2 example missions
- tests and build verification
```

### Prompt 7 - Competitive Layer Planning

```text
Create an implementation plan for the `Competitive Layer` in this repository.

Target areas:
- Elo / MMR
- seasons
- spectator mode
- match history

First inspect the existing multiplayer and authoritative sync architecture.
Then output:
- current state
- missing infrastructure
- technical risks
- phased delivery plan
- milestone names
- issue list

Important:
- do not start by writing code
- first produce an architecture and rollout plan grounded in this repo
```

### Prompt 8 - Convert The Roadmap Into GitHub Issues And Milestones

```text
Convert the roadmap in this repository into a GitHub issue and milestone structure.

Expected output:
- 3 milestones: short term, mid term, long term
- clear issue titles under each milestone
- for each issue include:
  - problem statement
  - scope
  - acceptance criteria
  - technical notes
  - dependencies

Rules:
- keep issues reasonably small
- break large roadmap themes into pieces that can be shipped in one or a few commits
- prioritize work that strengthens the current game identity first
```

---

## License

Private project.
