# game/ 모듈 이식 안내

이 폴더의 파일들은 프로토타입 `물풍선 대작전.dc.html` 의 `class Component` 에서 잘라 옮겼다.
아래 대응표대로 옮기면 누락이 없다.

> **이식 완료 (2026-08-24).** 대응표 대비 한 가지 변경: engine.js 와 ai.js 가 공유하는
> 규칙 함수(`tileOf` `balloonAt` `solidFor` `blastTiles` `tryPlace` `moveEnt` `spawnParts`)는
> 순환 import 를 피하려고 **`rules.js`** 로 분리했다. 모두 첫 인자로 game 상태를 받는
> 순수 함수다. engine.js 에는 루프/입력/HUD/burst·usePin·pickUp·kill 만 남는다.

| 원본 위치 | 옮길 파일 | 내용 |
|---|---|---|
| 파일 상단 상수 | constants.js | `NX`, `NY`, `S`, `FUSE`, `WATER_MS`, `TRAP_MS`, `ITEM_DEFS`, `ITEM_POOL`, `key()`, `clamp()` |
| `BODY`, `CHARS` | characters.js | 캐릭터 6종 도트맵 + 팔레트 + 시작 스탯 |
| `BLOCK`, `BLOCK2`, `TOUGH`, `HARD`, `HARD2`, `GLYPHS` | sprites.js | 도트맵 + `buildSprite`, `charSprite`, `blockSprite`, `decoSprite`, `itemSprite`, `balloonSprite`, `waterSprite`, `bubbleSprite`, `discSprite` (모듈 스코프 Map 캐시) |
| `MAPS`, `layoutHard`, `buildMap` | maps.js | 테마 팔레트 + 레이아웃 규칙 + 상자 배치 + 연결성 보정 |
| `dangerSet`, `bfs`, `think`, `driveBot` | ai.js | 순수 함수로. 첫 인자로 게임 상태를 받게 시그니처만 바꾼다 |
| `drawStatic`, `draw`, `drawParts`, `drawMapPreview` | renderer.js | 정적 레이어 캐시(`dirty` 플래그) 유지 |
| `startGame`, `loop`, `tick`, `step`, `moveEnt`, `solidFor`, `blastTiles`, `tryPlace`, `usePin`, `burst`, `pickUp`, `kill`, `spawnParts`, `updateParts` | engine.js | `GameEngine` 클래스 본체 |

## GameEngine 인터페이스

```js
new GameEngine({
  canvas,          // HTMLCanvasElement
  charIdx,         // 0..5
  mapIdx,          // 0..5 (5 = 랜덤)
  tileSize,        // 64 | 128 | 256
  matchSeconds,    // 기본 180
  botCount,        // 1..3
  botSkill,        // '쉬움' | '보통' | '어려움'
  onHud,           // ({ maxBalloons, power, speed, pins, botsAlive, clockSec, mapName }) => void
  onFinish         // ('win' | 'lose' | 'draw') => void
});

engine.start();  // 맵 생성 + 키 리스너 등록 + rAF 루프 + 80ms 폴백 타이머
engine.stop();   // rAF/타이머 취소 + 리스너 해제
```

탭이 비활성이면 브라우저가 rAF를 멈춘다. 원본처럼 `setInterval(80)` 에서
`performance.now() - lastTick > 150` 일 때 `tick()` 을 직접 부르는 폴백을 반드시 유지하라.
