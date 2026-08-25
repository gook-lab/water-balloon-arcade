# 아키텍처

> 최종 갱신: 2026-08-24 (이식 완료 + QA 통과 시점 기준)

## 핵심 원칙: 엔진과 React의 경계

게임 루프는 **엔진이 소유**한다. React는 화면 라우팅과 HUD 표시만 담당한다.

- `src/game/` 은 React를 import하지 않는 순수 JS 모듈이다.
- 엔진은 캔버스에 직접 그린다. React state로 프레임을 돌리지 않는다.
- HUD 값(풍선/물줄기/속도/바늘, 남은 상대, 시계)은 **값이 실제로 바뀔 때만** `onHud` 콜백으로
  올라온다. 구현 방식: 이벤트 카운터가 아니라, 엔진이 매 step마다 HUD 스냅샷을 만들어
  직전 스냅샷과 **diff한 뒤 변경이 있을 때만** `onHud`를 호출한다. 프레임마다 호출 금지 —
  60fps 리렌더를 막기 위한 계약이다.

```
React (화면/HUD)                순수 JS 엔진 (src/game/)
┌─────────────────┐            ┌──────────────────────────┐
│ App.jsx 라우팅   │            │ GameEngine               │
│ title→select→   │  생성/정리  │  start(): 맵생성+키리스너 │
│ map→game        │──────────▶│           +rAF+80ms폴백   │
│                 │            │  stop(): 전부 해제        │
│ useGame 훅      │◀──────────│                          │
│  hud, result    │  onHud     │ ai.js / renderer.js /    │
│  restart()      │  onFinish  │ maps.js / sprites.js ... │
└─────────────────┘            └──────────────────────────┘
```

## 화면 흐름 (App.jsx)

`title → select(캐릭터) → map(맵) → game`. 단순 useState 라우팅이며 라우터 라이브러리 없음.
GameScreen에서 `onChangeMap`/`onChangeChar`로 뒤로 이동 가능. 결과 오버레이의 재시작은
`useGame.restart()`가 `round` 카운터를 올려 엔진을 재생성하는 방식.

설정(settings)은 **App이 state로 소유**하고 TitleScreen에 `onSettingsChange`로 내려준다.
TitleScreen에서 타일 크기(64/128/256)와 난이도(쉬움/보통/어려움)를 조정할 수 있다.
기본값: 타일 128, 180초, 봇 3, 보통.

**QA/개발용 URL 파라미터**: `App.jsx`의 `initialSettings()`가 초기 설정을 만들 때
`?t=<초>`(제한시간)와 `?bots=<1..3>`(봇 수)를 파싱한다. `DEFAULT_SETTINGS`는 그대로이며,
파라미터가 없으면 기본값이 쓰인다. 예: `?t=8` → 8초 매치로 무승부 오버레이를 즉시 확인.

## 모듈 맵

| 파일 | 역할 |
|---|---|
| `src/main.jsx` | React 루트 마운트 |
| `src/App.jsx` | 화면 라우팅 (`title \| select \| map \| game`) + 기본 설정 (타일 128, 180초, 봇 3, 보통) |
| `src/screens/TitleScreen.jsx` | 타이틀 + 설정 UI (타일 크기, 난이도) |
| `src/screens/CharacterSelect.jsx` | 캐릭터 6종 선택 |
| `src/screens/MapSelect.jsx` | 맵 5종+랜덤 선택 (미리보기는 renderer의 `drawMapPreview`) |
| `src/screens/GameScreen.jsx` | 캔버스 + HUD + 결과 오버레이 조립 |
| `src/components/PixelCanvas.jsx` | ref로 canvas 노출, `image-rendering: pixelated` |
| `src/components/HudBar.jsx` | 스탯/남은 상대/시계 표시 |
| `src/components/ResultOverlay.jsx` | 승/패/무 + 재시작 버튼 |
| `src/hooks/useGame.js` | 엔진 생성·정리, HUD/결과 구독, restart |
| `src/game/constants.js` | `NX/NY/S`, `FUSE`, `WATER_MS`, `TRAP_MS`, `ITEM_DEFS`, `ITEM_POOL`, `key()`, `clamp()` |
| `src/game/characters.js` | `CHARS` 6종 + `BODY` 도트맵 + `over` 오버레이 (16×16 원본 도트 유지) |
| `src/game/sprites.js` | v2 스프라이트 파이프라인 (아래 절 참조). `buildSprite`, 각종 `*Sprite`, `CHAR_SPRITE_SIZE`. `GLYPHS`는 이 모듈 내부 전용 |
| `src/game/maps.js` | `MAPS` 테마 팔레트(7종+랜덤) + `layoutHard()` + `buildMap()` + BFS 연결성 보정 |
| `src/game/rules.js` | **PROMPT.md 목표 트리에 없던 추가 모듈.** `tileOf` / `balloonAt` / `solidFor` / `blastTiles` / `tryPlace` / `moveEnt` / `spawnParts` 순수 함수. engine.js와 ai.js가 공유한다 — 둘 사이 순환 import를 막기 위해 분리 |
| `src/game/engine.js` | `GameEngine` 클래스: start/stop/step/입력/아이템/파티클 (규칙 판정은 rules.js 위임) |
| `src/game/ai.js` | `dangerSet`, `bfs`, `think`, `driveBot` — 순수 함수, 첫 인자로 게임 상태 |
| `src/game/renderer.js` | 정적 레이어(dirty 플래그 캐시) + 동적 레이어 draw + `drawMapPreview`. 물줄기는 `waterSprite(stage, Math.floor(now/120)%2)` 로 2프레임 애니메이션. v4: `public/tilesets/` 바닥 텍스처(crypt_a2·meadow, dragon-game PixelLab 타일 재사용)를 비동기 로드 후 dirty 재렌더 + 체커 오버레이 |

이식 대응표(프로토타입 원본 위치 → 모듈)는 [src/game/README.md](../src/game/README.md) 참조.

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
engine.start();
engine.stop();
```

## 런타임 계약

1. **rAF + 폴백 타이머**: 탭 비활성 시 브라우저가 rAF를 멈추므로, `setInterval(80ms)`에서
   `performance.now() - lastTick > 150` 이면 `tick()` 을 직접 호출하는 폴백을 유지한다.
2. **픽셀 렌더**: 정수배 확대만. `ctx.imageSmoothingEnabled = false` + CSS `image-rendering: pixelated`.
3. **스프라이트 캐시**: 오프스크린 canvas → 모듈 스코프 Map 캐시. 캐시 키 규칙 유지
   (물줄기는 프레임 포함 `wa{stage}f{frame}`). 좌표계는 여전히 S=16 월드 단위(`u = T/S`) —
   스프라이트 해상도(32px)와 월드 단위는 별개다.
4. **키 입력**: `window` 리스너. 방향키/스페이스는 `preventDefault()`. `engine.stop()` 에서 반드시 해제.
   v7: 키 판정은 `keyName(e)`이 물리 키 `e.code`(KeyX/KeyW…) 우선 정규화 — 한글 IME 모드에서
   X/WASD가 'ㅌ'/'Process'로 들어와 무시되던 버그의 재발 방지 계약.
5. **파티클 상한 260개**. `gr === 0` 인 파티클은 캐릭터 아래, 나머지는 위에 그린다.

## 스프라이트 파이프라인 v2 — 32px 렌더 + 캐시

2026-08-24 사용자 지시로 비주얼을 프로토타입 16×16보다 고디테일로 재작업했다.
규칙 수치·좌표계·렌더 계약은 불변.

| 대상 | 방식 |
|---|---|
| 캐릭터 6종 | 16×16 도트맵·`over` 오버레이는 **원본 유지**, EPX(Scale2x) 업스케일로 32×32 생성 후 셰이딩 패스(상단 림라이트, 하단/우측 셰도, 머리 스펙큘러). `CHAR_SPRITE_SIZE = 32` export — HudBar·CharacterSelect 캔버스가 이 값을 사용(구 S=16 참조 제거) |
| 블록/상자 | 문자열 도트맵 폐기 → **32px 프로시저럴 드로잉**. softCrate(v0 가로/v1 세로 플랭크+네일), toughCrate(이중 금속 프레임+X브레이스+리벳 8개), hardBlock(스톤 베벨+리세스, v1은 4분할). 테마별 디테일: grass 잎사귀 / beach 모래 물결 / snow 반짝임 / lava 균열 / factory 추가 리벳 — 전부 팔레트 파생색만 사용 |
| 물풍선 | 32px, 4단 셰이딩+스펙큘러+하단 매듭. hot(도화선 임박) 팔레트 유지 |
| 물줄기 | 32px 재작업(라운드 코어+거품 가장자리+셰머 블롭) + **2프레임 애니메이션**. renderer가 `waterSprite(stage, Math.floor(now/120)%2)` 호출, 캐시 키 `wa{stage}f{frame}` |
| 아이템/버블 | 아이템 32px 디스크 + 글리프 2배 + 드롭섀도. 버블 32px 이중 림 |

기타: `GLYPHS`는 sprites.js 내부로 이동(외부 참조 없음). `getImageData`에 `willReadFrequently`
지정으로 콘솔 경고 0. 검증: 빌드 183KB(gzip 60KB), 타일 64/128 스모크 + 스크린샷 육안 확인.

### v3 리워크 — 캐릭터 도트맵 재작성·블록 가독성·UI 픽셀화

| 대상 | 내용 |
|---|---|
| 캐릭터 도트맵 | `characters.js` 전면 재작성 — 봄버맨풍 실루엣(안테나 보블+둥근 헬멧+흰 페이스플레이트+세로 눈+발). 6종 개성은 `over` 행으로: 뭉치 고양이 귀 / 삐용 볏+부리 / 토리 곰 귀 / 펭구 흰 배+부리 / 로보 바이저+볼트. **스탯(base)은 불변** — characters.test.js가 원본 고정을 가드. EPX 32px 파이프라인 유지 |
| 블록 가독성 | 피드백 "파괴 가능/불가 구분 안 됨" 해결. 하드블록 = `mixGray(0.55)` + 강한 다크 시프트 → 전 테마 공통 어두운 강철/스톤 + 볼트 4개 마커. 상자(soft·tough) = `mixWarm(#c98a4a, 0.24)` 우드 틴트. 명도+색온도 이중 신호라 눈 언덕처럼 양쪽이 한색이던 테마에서도 즉시 구분 |
| UI 픽셀화 | 폰트 Neo둥근모(`@kfonts/neodgm` **로컬 번들**, main.jsx에서 CSS import — DungGeunMo CDN 404로 npm 패키지 전환). 버튼/카드/패널 radius 4 + 3px 아웃라인 + 블러 없는 하드 섀도, 타이틀 로고 노랑+아웃라인 텍스트섀도, 배경 스캔라인+체커, HUD 칩 사각형화. Jua/Gothic A1은 폴백 유지 |

### v5 아이템 가시성 — 패널형 아이콘 + 블링크

아이템이 바닥·블록 사이에서 눈에 띄지 않는다는 사용자 피드백에서 출발했다.

| 대상 | 내용 |
|---|---|
| 아이템 패널 | 디스크+글리프 방식 폐기(`GLYPHS`·`discSprite` 제거) → **봄버맨식 32px 사각 패널**: 굵은 아웃라인 + 아이템색 고명도 틴트 배경 + 하단 셰이드 밴드 + 흰 내부 테두리, 그 위에 12×12 픽토그램 2배 스케일+드롭섀도. `ITEM_ICONS` export(도트맵+pal) |
| 픽토그램 7종 | 물풍선=풍선+매듭 / 물줄기=물약병(시안 액체) / 롤러=부츠+바퀴 / 바늘=대각 바늘+실귀 / 풍선통과=유령 풍선 / 블록통과=상자+더블 셰브런 / 거북이=탑뷰 거북. 나쁜 아이템(거북이)은 패널 틴트 0.42(일반 0.62)로 구분 |
| 블링크 | 2프레임(260ms) 흰 테두리 명멸+반짝이 점. 캐시 키 `it{type}f{frame}`, renderer가 frame 전달(waterSprite 패턴과 동일) |
| 드랍 팝 | `engine.burst` 아이템 드랍 시 흰 rise 파티클 4개로 시선 유도 |
| 대비 검증 | crypt 자갈 바닥(최악 대비 케이스)에서 확대 캡처 확인 — 밝은 패널+흰 테두리가 어두운 바닥에서 명확히 뜸 |

HUD 칩(풍/줄/속/침)은 변경 없음 — 색 언어(핑크/시안/노랑/흰)가 패널과 일치.

## 사운드 (v6)

`src/audio/audio.js` — Web Audio API 신디사이즈, 외부 에셋 0.

- **SFX 13종**: ui/place/pin/burst(노이즈+저역 스윕)/crate/itemGood(상승 아르페지오)/
  itemBad(하강)/trapped(버블)/die/win(팡파레)/lose/draw. 연쇄폭발 다발음은 이름별 스로틀(40~120ms).
- **BGM 2트랙**: 32스텝 시퀀서 칩튠 루프 — 타이틀 96bpm / 인게임 138bpm. square 리드 +
  triangle 베이스 + 노이즈 햇, 0.25s 룩어헤드 스케줄러. App이 화면 전환 시 `startBgm` 스위칭.
- **설정**: 타이틀에 켬/끔 + 볼륨 3단, localStorage `wba-audio` 저장.
- **autoplay 정책**: `installUnlock()` — 첫 pointerdown/keydown에서 AudioContext 생성/resume,
  그 전 BGM 요청은 pending 지연.
- **엔진 순수성 유지**: 엔진은 `opts.onSound(name)` 콜백으로 이름만 방출하고 오디오를
  import하지 않는다. 봇의 아이템 획득은 무음. `useGame`이 `playSfx`를 연결.

## 테스트 (Vitest)

`npm test` = `vitest run`. `tests/` 파일 + `helpers.js`, 50 테스트.
(v4에서 +5: 레인 정렬 2, AI 회귀 3 — "물 경유 탈출로면 미설치", "탈출 경로 전 칸 안전",
"스테일 경로 폐기". maps.test는 8종 기준. v5에서 +3: items.test.js.)

| 파일 | 커버 범위 |
|---|---|
| `tests/maps.test.js` | 스폰 코너 3칸 확보, 연결성(도달 불가 구역 없음 — 테마별 15회 반복), 팔레트 구조 |
| `tests/rules.test.js` | `blastTiles`(하드 정지·소프트 포함 후 정지·경계), `solidFor`(passBlock·풍선 ignore), `tryPlace`(중복·상한·ignore), `moveEnt`(속도 공식·거북이 45%·벽 정지·ignore 해제), 파티클 상한 |
| `tests/ai.test.js` | `dangerSet`, `bfs` 우회/포위 시 null, `think` 위험 탈출·탈출 경로 확보 시에만 설치(자살 방지)·탈출 불가 시 미설치, `driveBot` 이동 |
| `tests/engine.test.js` | renderer를 `vi.mock`(DOM 의존 차단). `pickUp` 상한(8/8/7/5·거북이), `burst`(소프트 파괴·42% 드랍·tough→soft·연쇄), `usePin`, 승패 판정(lose/win/draw·1회 발화), HUD 스냅샷 diff |
| `tests/characters.test.js` | 도트맵 16×16·팔레트 키 무결성, `over` 행 검증, **스탯 원본 고정 가드**(v3 비주얼 리워크가 base 스탯을 못 건드리게) |
| `tests/items.test.js` | `ITEM_ICONS` 풀 7종 아이콘 완비, 12×12·팔레트 키 무결성, bad=turtle 유일 |

테스트 가능성 설계: rules/maps/ai는 DOM 무의존 순수 모듈이라 node에서 직접 실행되고,
engine만 renderer를 mock한다 — 엔진/React 경계 원칙이 테스트에서도 그대로 배당금을 준다.
(guk-lab-docs의 headless-harness 플레이북과 같은 원칙)

승패 판정 3경로(lose/win/draw)가 엔진 테스트로 커버되면서, 기존에 남아 있던
"win 경로 수동 확인" 리스크도 로직 수준에서는 해소됐다.

## 빌드

Vite 5 + `@vitejs/plugin-react`. 런타임 의존성은 react/react-dom + `@kfonts/neodgm`(픽셀 폰트,
로컬 번들 — CDN 미사용). 개발 의존성에 Vitest. 현재 빌드 크기 약 192KB (gzip 63.4KB).
git 저장소 초기화됨 (2026-08-24, `6a1f4ba` 베이스라인).
