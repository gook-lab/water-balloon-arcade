# Water Balloon Arcade (물풍선 대작전)

[한국어](README.md) | **English**

A 2D pixel arcade game: drop water balloons on a grid and trap your rivals in the splash.
Pick one of six characters and seven maps (plus random), then take on three bots in a three-minute round.
Be the last one dry to win.

▶ Play now: https://water-balloon-arcade-ebon.vercel.app/ (desktop with a keyboard; the in-game text is Korean)

Ported from a hand-built HTML prototype to **React 18 + Vite**. The game engine is plain JS kept apart from React,
graphics are Canvas 2D pixel sprites, and the chiptune music is synthesized in code with Web Audio.
Game rules, tuning values and sprite data are carried over from the prototype as-is and are not changed arbitrarily.
(Full brief: [PROMPT.md](PROMPT.md))

## Running

```bash
npm install
npm run dev      # Vite dev server
npm run build    # production build (dist/)
npm run preview  # preview the build
npm test         # Vitest
npm run lint     # ESLint
```

## Controls

| Input | Action |
|---|---|
| Arrow keys / WASD | Move |
| Space | Place a water balloon |
| X | Needle (pop your own balloon immediately) |
| Esc / P | Pause / resume |

## Features

### Difficulty Selection

Pick the bot difficulty (Easy / Normal / Hard) on the title screen; the choice is remembered.
Easy bots sometimes miss danger, Hard bots think more often and chase a nearby player before breaking blocks.
The result screen shows the difficulty of the round. Parameters and headless measurements are in [GAME-DESIGN.md](docs/GAME-DESIGN.md) (Korean).

### Sound — recorded effects, synthesized music

Sound effects are recorded files in `public/sfx/*.mp3` (generated with ElevenLabs). Until a file has loaded,
or if it fails to load, the game plays a synthesized sound in its place. The background music is chiptune
synthesized in code with Web Audio. Sound on/off and volume chosen on the title screen are remembered.

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
