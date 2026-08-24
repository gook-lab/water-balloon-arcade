# 작업 지시 (Claude Code / 개발자용)

첨부된 `물풍선 대작전.dc.html` 은 완성 동작하는 프로토타입이다.
이것을 **React 18 + Vite** 프로젝트로 이식하라. 게임 규칙·수치·픽셀 스프라이트 데이터는
프로토타입에서 **그대로 복사**하고, 새로 발명하지 말 것.

## 원본 파일 구조 이해
`물풍선 대작전.dc.html` 안에는 두 부분이 있다.
1. `<x-dc>` 안의 마크업 — 타이틀 / 캐릭터 선택 / 맵 선택 / 게임 HUD·결과 오버레이 화면
2. `<script data-dc-script>` 안의 `class Component` — 상수, 스프라이트 데이터, 게임 루프, AI, 캔버스 렌더러

이식할 때 1번은 JSX 컴포넌트로, 2번은 **React와 무관한 순수 JS 게임 엔진**으로 분리하라.
게임 루프는 절대 React state로 돌리지 말고, 캔버스에 직접 그리고 HUD 값만 구독 형태로 올려라.

## 목표 파일 트리
```
src/
  main.jsx
  App.jsx                 화면 라우팅 (title | select | map | game)
  screens/
    TitleScreen.jsx
    CharacterSelect.jsx
    MapSelect.jsx
    GameScreen.jsx        캔버스 + HUD + 결과 오버레이
  components/
    HudBar.jsx
    ResultOverlay.jsx
    PixelCanvas.jsx       ref로 canvas 노출, image-rendering: pixelated
  game/
    constants.js          NX/NY/S, FUSE, WATER_MS, TRAP_MS, ITEM_DEFS, ITEM_POOL
    characters.js         CHARS (6종) + BODY 도트 + over 오버레이
    sprites.js            BLOCK, BLOCK2, TOUGH, HARD, HARD2, GLYPHS + buildSprite/캐시
    maps.js               MAPS (5종+랜덤), layoutHard(), buildMap() + 연결성 보정
    engine.js             GameEngine 클래스: start/stop/step/입력/충돌/아이템/파티클
    ai.js                 dangerSet, bfs, think, driveBot
    renderer.js           정적 레이어 + 동적 레이어 draw
  hooks/
    useGame.js            엔진 생성·정리, HUD 스냅샷 구독
```

## 이식 규칙
- `class Component extends DCLogic` 의 메서드를 위 모듈로 그대로 옮긴다. `this.props` 는 엔진 생성자 옵션으로 바꾼다.
- 스프라이트는 문자열 도트맵 → 오프스크린 canvas 16×16 → 캐시(Map). 캐시 키 규칙 유지.
- 렌더는 정수배 확대만 사용. `ctx.imageSmoothingEnabled = false`, CSS `image-rendering: pixelated` 필수.
- `requestAnimationFrame` 루프 + 탭 비활성 대비 `setInterval(80ms)` 폴백(원본 `tick()` 구조) 유지.
- 키 입력은 `window` 리스너, `ArrowKeys/WASD` 이동, `Space` 물풍선, `X` 바늘. 방향키/스페이스 `preventDefault()`.
- HUD(풍선/물줄기/속도/바늘, 남은 상대, 시계)는 60fps로 리렌더하지 말고 값이 바뀔 때만 setState.

## 게임 규칙 (변경 금지)
- 맵 15 × 13 타일. 타일 크기 옵션 64 / 128 / 256px.
- 기본 제한 시간 180초. 봇 3명, 난이도 쉬움/보통/어려움.
- 물풍선 도화선 2600ms, 물줄기 잔류 480ms, 갇힘 유지 4000ms 후 탈락.
- 갇힌 상태에서 물을 다시 맞으면 즉시 탈락.
- 나무상자 파괴 시 42% 확률로 아이템 드랍. 강화상자(tough)는 2회 필요(1타 → 일반 상자).
- 물풍선 연쇄: 폭발 범위에 다른 풍선이 있으면 즉시 연쇄 폭발.
- 스폰 코너 4곳은 각 3칸 비워둠. 맵 생성 후 BFS로 고립 구역이 있으면 하드블록을 열어 연결 보정.

## 아이템 (나무위키 기준 클래식 세트)
| 아이템 | 효과 | 상한 |
|---|---|---|
| 물풍선 | 동시 설치 수 +1 | 8 |
| 물줄기 | 폭발 길이 +1 | 8 |
| 롤러블레이드 | 이동 속도 +1 | 7 |
| 바늘 | 내 풍선 즉시 터뜨리기 1회분 | 5 |
| 물풍선 통과 | 풍선 통과 | on/off |
| 블록 통과 | 상자 통과 | on/off |
| 거북이 | 7초간 속도 45% (나쁜 아이템) | — |

이동 속도 공식: `(2.3 + 0.42 * (speed - 1)) * tile * (느림이면 0.45)` px/s.
속도 5 이상이면 잔상 3겹 + 발밑 먼지 파티클.

## 이펙트
- 갇힘: 물방울 14개 + 풍선 흔들림 + 캐릭터 1px 진동 + 기포 상승(160ms 간격), 잔여시간 링(30% 이하 빨강)
- 탈락: 물방울 30개 + 픽셀 링 확산(340ms) + 캐릭터 회전 상승·축소 페이드(820ms)
- 상자 파괴: 테마 색 파편 7~10개
- 파티클 상한 260개, `gr === 0` 인 것은 캐릭터 아래, 나머지는 위에 그린다.

## 맵 5종 + 랜덤
초록 들판(전면 격자) / 모래 해변(가로 통로 4줄) / 눈 언덕(이중 고리) / 용암 동굴(2×2 클러스터) / 고철 공장(대각선 벽).
각 테마는 바닥 2색 + 하드블록 3색 + 상자 3색 팔레트를 가진다. `MAPS` 배열을 그대로 복사하라.

## 캐릭터 6종
코코(균형) / 뭉치(물줄기 2) / 삐용(속도 5) / 토리(풍선 2) / 펭구(풍선2·물줄기2·속도2) / 로보(속도4·바늘1).
`BODY` 도트맵 + 캐릭터별 `over` 행 오버레이 + 팔레트(`color`/`dark`/`accent`)로 스프라이트를 만든다.
좌우 이동은 수평 반전, 위 방향은 뒷모습 팔레트(눈 숨김).

## AI
BFS 기반. 우선순위: ① 위험 타일이면 안전 타일로 탈출 → ② 좋은 아이템 → ③ 상자 인접 또는 플레이어 근접 시,
탈출 경로가 확보될 때만 설치 → ④ 상자 쪽 이동 → ⑤ 플레이어 추적.
재계산 주기: 쉬움 420ms / 보통 220ms / 어려움 130ms. 어려움은 시작 물줄기 2, 속도 4.

## 수용 기준
- 세 화면 전환과 결과 화면 재시작이 동작한다.
- 타일 64/128/256 전환 시 픽셀이 뭉개지지 않는다.
- 봇이 자기 풍선에 자살하지 않는다(탈출 경로 검증).
- 맵에 도달 불가능한 구역이 없다.
- 60fps 유지, 콘솔 에러 없음.
