# Water Balloon Arcade (물풍선 대작전)

[한국어](README.md) | **English**

A Crazy Arcade-style 2D water balloon game, ported from a working HTML prototype
(`../크레이지아케이드 (1)/물풍선 대작전.dc.html`) to **React 18 + Vite**.

Game rules, tuning values and pixel sprite data are copied from the prototype as-is
and are not changed arbitrarily. (Full brief: [PROMPT.md](PROMPT.md))

## Running

```bash
npm install
npm run dev      # Vite dev server
npm run build    # production build (dist/)
npm run preview  # preview the build
npm test         # Vitest
```

## Controls

| Input | Action |
|---|---|
| Arrow keys / WASD | Move |
| Space | Place a water balloon |
| X | Needle (pop your own balloon immediately) |

## Module Structure

- `src/game/` — **pure JS game engine** with no React dependency (loop, AI, renderer, sprites, maps)
- `src/screens/` — four screens: title → character select → map select → game
- `src/components/` — HUD bar, result overlay, pixel canvas
- `src/hooks/useGame.js` — engine lifecycle + HUD snapshot subscription (the engine owns the loop)

Further reading (Korean):

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module structure and the engine/React boundary
- [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md) — rules and tuning reference (includes frozen values)
- [docs/WORK-SPLIT.md](docs/WORK-SPLIT.md) — multi-session work split
- [src/game/README.md](src/game/README.md) — prototype → module porting map

## Acceptance Criteria

- [x] Screen transitions and restart-from-result work. (headless browser check, 0 console errors)
- [x] Pixels stay crisp when switching tiles between 64/128/256. (integer scaling + pixelated, all three)
- [x] Bots do not blow themselves up (escape-route check).
- [x] No unreachable areas on a map (BFS connectivity repair).
- [x] 60fps held, no console errors.
- Result paths: loss and draw verified. The win path takes the same code branch, so risk is low,
  but **a manual play-through is recommended**.

QA/debug URL parameters: `?t=<seconds>` match length, `?bots=<1..3>` bot count.
(e.g. `?t=8` reproduces the draw overlay immediately)
