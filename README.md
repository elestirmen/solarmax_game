# Stellar Conquest

Real-time space conquest strategy game with singleplayer and multiplayer.

## Project State

- Single canonical game client source: `game.js`
- Main UI page: `stellar_conquest.html`
- Multiplayer server: `server.js`
- Audio module: `assets/audio.js`

The old parallel TypeScript game implementation was removed to keep one source of truth.

## Run

```bash
npm install
```

### Singleplayer / local client

```bash
npm run dev
```

Open `http://localhost:5173`.

### Multiplayer server

```bash
npm run server
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

This produces `dist/` with Vite output.

`server.js` auto-detects:

- `dist` mode if a built bundle exists
- `source` mode otherwise

## Multiplayer Notes

- Room code length is fixed to 5 characters
- Match result is accepted only after all active players report the same winner index
- Rematch/result votes are cleaned when players disconnect

## License

Private project.
