# 물풍선 대작전 QA 기준선 (1단계 진단, 2026-11-26)

## 세 줄 요약

1. 데스크톱 키보드 플레이는 기준선이 탄탄합니다. lint · 테스트 59개 · 빌드가 통과하고, 실제 키 입력 점검 21개와 맵 10판이 로컬 · 라이브 모두 통과했습니다. 승리 화면은 자동 조종 8판 중 5판에서 실제로 띄웠고, fps 60 · 긴 판 메모리 평탄 · 콘솔 오류 0입니다.
2. 큰 결함은 세 가지이고 모두 데스크톱 밖이나 키보드 접근성 쪽입니다. 세로 화면 · 좁은 창에서 게임 판이 찌그러지고(비율 0.63~0.99, 정상 1.15), 터치 기기에서는 조작 수단도 안내도 없으며, 키보드만으로는 캐릭터 · 맵을 고를 수 없습니다.
3. 2단계 회귀 도구를 `docs/upgrade/qa/` 에 남겼습니다. `bash docs/upgrade/qa/run-all.sh <URL> <label>` 한 줄로 같은 점검을 다시 돌리고, `summary.mjs --base` 로 기준선과 비교합니다.

버그 수: **치명 0 · 큼 3 · 작음 17**.

## 측정 조건 — 환경 · 도구

| 항목 | 값 |
|---|---|
| 대상 | 로컬 `http://127.0.0.1:5310`(리드의 vite preview, `dist/`) · 라이브 `https://water-balloon-arcade-ebon.vercel.app` · 자동 조종용 dev 서버 5312(스크래치 clone, main `8eb538d`) |
| 브라우저 | Playwright 1.64.1. Chromium headless shell을 쓰고, 휴대폰 점검만 WebKit을 함께 썼습니다 |
| 접근성 엔진 | axe-core 4.10.2(로컬 사본) |
| Node | v24.16.0 |
| 기계 부하 | 측정 중 load average 4~12였습니다(다른 세션의 vitest가 함께 돌았음). fps · 시간 값은 이 조건의 값입니다 |
| 엔진 상태 읽기 | React fiber로 `useGame` 의 엔진 ref를 찾아 **읽기만** 했습니다(`lib.mjs` 의 `ENGINE_PROBE`). `src/` 는 고치지 않았습니다 |
| 주입한 것 | 아이템 점검은 옆 칸에 아이템을 놓았고, 승리(라이브) 점검은 봇 칸에 물 한 칸을 놓았습니다. 긴 판 메모리 점검에서는 내 캐릭터를 무적으로 두었습니다. 판정 · 탈락 · 결과는 모두 실제 엔진이 냈습니다 |

## 정적 검증 — lint · 테스트 · 빌드

CI와 같은 조건을 맞추려고 스크래치에 새로 clone한 뒤 `npm ci` 로 깨끗하게 설치해서 쟀습니다. 로그는 `qa/logs/` 에 있습니다.

| 항목 | 결과 | 근거 |
|---|---|---|
| `npm run lint` | 통과, 경고 0 | `qa/logs/lint.log` |
| `npx vitest run --reporter=verbose` | 파일 6 통과 · 1 건너뜀, 시험 59 통과 · 1 건너뜀(60). 0.58초 | `qa/logs/vitest.log` |
| `npm run build` (vite 8.3.1) | 통과, 0.49초. JS 191.71KB(gzip 63.55KB) · CSS 2.81KB(gzip 1.08KB) · 글꼴 woff2 44.62KB + woff 147.90KB · html 0.61KB | `qa/logs/build.log` |
| `npm run sim:difficulty` (N=30) | 가만히 선 플레이어를 잡은 비율은 쉬움 0.43 · 보통 0.80 · 어려움 0.67이고, 평균 시간은 105.5s · 97.6s · 87.9s입니다. 평균 시간은 난이도 순서대로 줄지만 잡은 비율은 보통이 어려움보다 높습니다(N=30, 난수) | `qa/logs/sim-difficulty.log` |
| 제 QA 스크립트(`docs/upgrade/qa/*.mjs`)를 넣은 채 `eslint .` | 통과. 커밋되어도 CI lint를 깨지 않습니다 | 스크래치 clone에서 실행 |

라이브는 새로 빌드한 main과 같은 해시(`index-CUHooIwZ.js`)입니다. 로컬 5310은 다른 빌드입니다(작음 S17 참고).

## 화면 흐름 — 세 크기 × 로컬 · 라이브

명령은 `node docs/upgrade/qa/smoke.mjs --url <URL> --label <local|live>` 입니다. 순서는 타이틀 → 캐릭터 → 맵 → 게임 → 결과(`?t=4`) → 다시 하기 → 맵 변경 → 입장 → 캐릭터 → 뒤로(타이틀)입니다.

| 크기 | 흐름 | 콘솔 오류 | 가로 넘침 | 게임 시작 시 스크롤 | 근거 |
|---|---|---|---|---|---|
| 1440×900 | 끝까지 됨 | 0 | 없음 | 0 | `qa/out/smoke/{local,live}/desktop/` |
| 844×390 | 끝까지 됨 | 0 | 없음. 다만 타이틀의 「게임 시작」, 맵 화면의 「입장」이 첫 화면 아래에 있습니다 | **61px**(HUD가 화면 밖) | `qa/out/smoke/local/landscape/` |
| 390×844 | 끝까지 됨 | 0 | **타이틀**(scrollWidth 442/390) | **64px** | `qa/out/smoke/local/portrait/` |

로컬과 라이브의 결과는 모든 항목에서 같았습니다. 「처음으로」 버튼은 없습니다. 결과 화면에서 타이틀로 가려면 「캐릭터 → 뒤로」 두 단계를 거쳐야 합니다.

**키보드만으로 진행**(데스크톱)은 Tab · Enter로 끝까지 갈 수 있습니다. 다만 다음이 걸립니다.

- Tab 순서는 타이틀 옵션 11개 → 게임 시작, 캐릭터 · 맵 화면은 뒤로 → 다음(입장), 결과 화면은 다시 하기 → 맵 변경 → 캐릭터입니다. 화면 순서대로라 자연스럽습니다.
- 캐릭터 · 맵 **카드에는 포커스가 가지 않습니다**. 기본값(코코 · 초록 들판)으로만 진행됩니다(큼 B3).
- 결과 화면이 떠도 포커스는 body에 남아 있고, 포커스가 간 버튼도 Space로는 눌리지 않습니다(작음 S4 · S5).
- 포커스 링은 브라우저 기본값(파랑 + 흰 이중 링)입니다. 보이기는 하지만 얇고 픽셀 테마와 어긋납니다(`qa/out/smoke/local/keyboard/focus-ring-zoom.png`).

## 게임 플레이 — 실제 키 입력 점검

명령은 `node docs/upgrade/qa/play.mjs --url <URL> --label <이름>` 입니다. 로컬과 라이브 모두 **21/21 통과**했습니다(`qa/out/play/{local,live}/play.json`).

| 점검 | 실측 |
|---|---|
| 이동(방향키 · WASD) | 300ms 누르면 x가 64에서 200~208로 갑니다. `s` 250ms면 y가 64에서 178로 갑니다 |
| 한글 IME(`code=KeyS`, `key=ㄴ`) | 아래로 이동합니다(64 → 185). v7 계약이 유지됩니다 |
| 풍선 설치 · 상한 | Space로 내 칸에 1개가 놓입니다. 상한 1에서 Space를 두 번 눌러도 1개입니다 |
| 바늘(X, 로보) | 두 칸 비켜선 뒤 X를 누르면 즉시 터집니다(물 3칸, 바늘 1 → 0). 바늘이 0개일 때 X는 반응이 없습니다 |
| 갇힘 → 탈락 | 풍선을 놓고 **2,629~2,636ms** 뒤에 갇힙니다(FUSE 2600). 갇히고 **4,026~4,027ms** 뒤에 탈락합니다(TRAP_MS 4000). 탈락에서 「패배」 화면까지는 811~839ms입니다(사라지는 연출 820ms) |
| 아이템 7종 줍기 | 물풍선 · 물줄기 · 롤러 · 바늘 · 풍선통과 · 블록통과 · 거북이 모두 걸어서 주우면 스탯이 +1(또는 켜짐)되고 칸에서 사라집니다. HUD도 `풍 2 줄 2 속 4 침 1` 로 바뀝니다 |
| 승리 화면 | 라이브 · 로컬에서는 봇 1명의 칸에 물을 놓아 확인했습니다. 실제 엔진이 갇힘 → 4초 → 탈락 → `win` 을 내고 「승리!」와 「남은 상대 0」이 보였습니다. 승리 후 다시 하기도 됩니다 |
| **실제 승리(자동 조종)** | dev 5312에서 게임의 봇 AI(`driveBot`, 어려움 설정)로 내 캐릭터를 운전했습니다. 쉬움 봇 1명을 상대로 8판을 돌려 **5승 3패**였고, 승리까지 29~80초가 걸렸습니다. 승리 화면은 `qa/out/play/dev-autopilot/autopilot-win.png` 에 있습니다. README의 「승리는 수동 확인 권장」 항목은 이것으로 닫아도 됩니다 |
| 무승부 | `?t=3` 으로 「무승부」 화면이 뜹니다 |

**맵 7종 + 랜덤 3판**에서는 도달할 수 없는 칸이 0이었고, 스폰 코너 8칸이 막힌 판도 0, 콘솔 오류도 0이었습니다. 바닥 텍스처는 초록 들판과 던전에만 적용됩니다(설계대로). 랜덤은 매번 다른 테마로 들어갔습니다(눈 · 던전 · 공장 / 라이브는 용암 · 유적 · 들판). 여덟 판을 모은 그림은 `qa/out/play/local/maps-sheet.png` 입니다.

| 맵 | 하드블록 칸 수(실측) | 비고 |
|---|---|---|
| 초록 들판 | 38 | |
| 모래 해변 | 36 | |
| 눈 언덕 | 44 | 상자와 하드블록이 둘 다 회색입니다(S16) |
| 용암 동굴 | 35 | |
| **고철 공장** | **14** | 레이아웃상 43칸인데, 연결성 보정이 50판 평균 29칸을 엽니다. 「대각선 벽」이 거의 남지 않습니다(S9) |
| 던전 지하실 | 40 | 바닥 자갈과 하드블록의 명도가 비슷합니다(S16) |
| 고대 유적 | 26 | |

## 성능 — fps · 로딩 · 메모리

명령은 `node docs/upgrade/qa/perf.mjs --url <URL> --label <이름> --only fps,load,restart` 이고, 긴 판은 `--only memory` 로 따로 돌립니다.

**fps**는 rAF 간격으로 8초씩 쟀습니다(입장 1.5초 뒤부터). 같은 구간에 `engine.step` 소요 시간도 쟀습니다. step에는 그리기가 포함됩니다.

| 조건 | fps | 프레임 p95 | 20ms 넘는 프레임 | step 평균 / p95 |
|---|---|---|---|---|
| 맵 7종, 봇 3, 타일 128 | 60.0~60.1 | 16.9~17.6ms | 0.6~1.5% | 0.17~0.26 / 0.2~0.4ms |
| 들판, 봇 1 · 2 | 60.0 · 60.1 | 16.9 · 16.8ms | 0.6 · 0.8% | 0.17 · 0.18ms |
| 들판, 봇 3, 타일 64 | 60.1 | 16.9ms | 0% | 0.18ms |
| **들판, 봇 3, 타일 256** | **58.8** | **20.5ms** | **6.2%** | **6.08 / 9.2ms** |

**첫 로딩**(라이브, 캐시 끔)은 세 번 쟀습니다. 「4G 모사」는 1.6Mbps · 지연 150ms 조건입니다.

| 조건 | 전송량 | 요청 | FCP | load | networkidle |
|---|---|---|---|---|---|
| 그대로 #1 · #2 | 183.7KB | 6 | 540 · 572ms | 480 · 497ms | 1.26 · 1.30s |
| 4G 모사 | 183.8KB | 6 | 1,392ms | 1,006ms | 2.31s |

전송량은 JS 64KB, CSS 66KB, 글꼴 52.9KB입니다. CSS 66KB 가운데 **64.7KB가 Google Fonts CSS**(Jua · Gothic A1 폴백)입니다(S13). 바닥 텍스처 PNG(1.9KB · 9.7KB)는 게임에 들어갈 때 받습니다.

**메모리**는 GC를 강제한 뒤 CDP `Performance.getMetrics` 로 쟀습니다.

- 긴 판(5분 30초, 봇 3, 내 캐릭터 무적): JS 힙이 3.42MB(30초)에서 3.62MB(330초)로 거의 평평합니다. DOM 노드는 117~118, 리스너는 163으로 그대로입니다. 상자는 90초쯤 모두 부서졌고, 파티클은 0~67개 사이를 오갔습니다(`qa/out/perf/local-memory/perf.json`).
- 다시 하기 20회: 노드 110 → 114, 리스너 166 → 166, 힙 3.12 → 3.53MB이고 늘다가 멈춥니다. 「맵 변경 → 입장」 20회는 노드 114 → 178에서 멈추고 리스너는 166 → 169입니다. **누수는 없습니다**.
  - 처음에는 Playwright `locator.click` 이 누른 요소를 붙잡아 두는 바람에 회당 노드 16 · 리스너 3씩 느는 것처럼 보였습니다. 페이지 안 `element.click()` 으로 바꾸자 사라졌습니다. 스크립트는 이 방식으로 고쳐 두었습니다.

## 휴대폰 실태 — 터치 기기에서 보이는 것 · 못 하는 것

명령은 `node docs/upgrade/qa/mobile.mjs --url <URL> --label <이름> [--engine webkit]` 입니다. 로컬은 Chromium, 라이브는 WebKit으로 봤고 결과는 같았습니다(`qa/out/mobile/`). 그림을 모은 것은 `qa/out/mobile/mobile-sheet-local.png` 입니다.

| 기기(모사) | 보이는 것 | 할 수 없는 것 |
|---|---|---|
| iPhone 13 세로(390×664) | 타이틀이 가로로 넘칩니다(제목 왼쪽 −52px 잘림, 레이아웃 폭 441px). 「게임 시작」은 아래로 스크롤해야 보입니다. 카드 탭으로 고르기는 됩니다. 게임 판은 **359×478, 비율 0.75**(정상 1.154)로 세로로 늘어납니다. 시작부터 HUD가 92px 위로 밀려 시계가 안 보입니다 | 탭 · 스와이프 · 길게 누르기 모두 **이동 0px, 풍선 0개**입니다. 방치하면 58초(Chromium) · 89초(WebKit) 뒤 패배합니다 |
| iPhone 13 가로(750×340) | 판이 284×246(타일 약 19px)으로 작습니다. HUD가 52px 위로 밀립니다. 결과 버튼 글자가 한 글자씩 세로로 꺾입니다 | 위와 같습니다. 방치하면 87~115초 뒤 패배합니다 |
| Pixel 7 세로(412×839) | 판이 379×604, **비율 0.627**입니다 | 위와 같습니다. 방치하면 92~105초 뒤 패배합니다 |

공통으로 확인한 것은 다음과 같습니다.

- 「PC 전용 · 키보드 필요」 같은 안내 문구가 없습니다. 화면 아래 「방향키 이동 · 스페이스 물풍선 · X 바늘」만 보입니다.
- 캔버스 `touch-action` 이 `auto` 라 판 위를 쓸면 페이지가 스크롤 · 확대됩니다.
- 소리는 첫 탭으로 잠금이 풀립니다(AudioContext `running`).
- 2단계 터치 설계에 쓸 근거 두 가지:
  - 세로 화면에서 15×13 판을 정비율로 넣으면 폭이 약 360px이고, 타일은 약 24px입니다(계산값). 그 아래 남는 높이 약 300px에 패드와 버튼을 둘 수 있습니다(추정).
  - 가로 화면은 판이 19px 타일까지 줄어듭니다. 높이 기준 배치가 더 맞습니다.

## 소리 — 잠금 해제 · 설정 · 탭 전환

명령은 `node docs/upgrade/qa/a11y.mjs` 의 소리 절이고, 실제 autoplay 정책 플래그(`--autoplay-policy=user-gesture-required`)를 켠 채 쟀습니다.

| 점검 | 결과 |
|---|---|
| 제스처 전 | AudioContext 0개, 소리 없음(정상) |
| 첫 클릭 뒤 | AudioContext 1개 `running`, master 0.7, 타이틀 BGM 시작 |
| 볼륨 낮음 | master 0.3 |
| 끔 | master 0, 볼륨 줄이 사라짐, localStorage `{"muted":true,"volume":0.3}` 저장, 새로고침 뒤에도 「끔」 유지 |
| 끔 상태의 BGM | 스케줄러가 계속 돌며 2초에 오실레이터 4개를 만듭니다(작음 S14) |
| 탭 전환(숨김) | headless에서는 다른 탭을 앞으로 가져와도 `visibilityState` 가 바뀌지 않아 **재현하지 못했습니다**. 코드상 `visibilitychange` 처리가 없습니다. 그래서 숨김 탭에서도 BGM이 이어지고(AudioContext를 멈추지 않음) 판도 80ms 폴백 타이머로 계속 진행될 것으로 **추정**합니다(S6). 사람 손 확인이 필요합니다 |

## 접근성 — 대비 · 포커스 · 축소 모션 · 스크린리더

| 점검 | 결과 | 근거 |
|---|---|---|
| 작은 글자 대비(14px 이하, 직접 계산) | **미달 0**. 가장 낮은 값은 HUD 맵 이름(11px) 5.62:1, 타이틀 옵션 라벨(12px) 6.84:1, 조작 안내(12px) 6.84:1입니다 | `qa/out/a11y/local/a11y.json` `contrast` |
| axe 위반 | 다섯 화면 모두 moderate 3종입니다: `landmark-one-main` · `page-has-heading-one` · `region`. serious 이상은 0입니다. 타이틀의 `color-contrast` 7건은 그라데이션 바탕이라 「판정 불가(incomplete)」로 나왔고, 직접 계산으로는 통과입니다 | 같은 파일 `axe` |
| 제목 · 랜드마크 | h1~h6 0개, main 0개입니다. `lang="ko"` 와 `<title>물풍선 대작전</title>` 은 있습니다 | `structure` |
| 버튼 이름 | 모든 버튼에 글자 이름이 있습니다. 다만 타일 · 난이도 · 사운드 · 볼륨 옵션은 `aria-pressed` 가 없어서 무엇이 골라졌는지 보조기술에 전달되지 않고, 「64px」처럼 그룹 라벨 없이 읽힙니다 | `aria-title.yml` |
| 게임 · 결과 | 게임 캔버스에 이름이나 역할이 없습니다. 결과 화면에 `role=dialog` · `aria-live` 가 없어서 HUD · 결과 · 안내 글이 한 덩어리 글로 읽힙니다 | `aria-result.yml` |
| 축소 모션 | `prefers-reduced-motion: reduce` 에서도 떠다니는 무한 애니메이션(키프레임, 2단계에서 `floatBob` 으로 이름 바꿈)이 계속 돕니다. 게임 안 파티클 · 깜빡임도 끌 수 없습니다 | `motion` |
| 포커스 순서 · 표시 | 「화면 흐름」 절을 봅니다 | |

## 버그 — 심각도 · 재현 · 근거

경로의 `qa/` 는 `docs/upgrade/qa/` 입니다. 줄 번호는 main `8eb538d` 기준입니다.

### 큼 (3)

| ID | 버그 | 재현 단계 | 기대 / 실제 | 근거 | 의심 위치 |
|---|---|---|---|---|---|
| B1 | 세로 화면 · 좁은 창에서 게임 판 비율이 찌그러짐 | 390×844(또는 휴대폰 세로, 데스크톱 700×900)로 입장합니다 | 15:13(1.154) 그대로 줄어들어야 합니다 / iPhone 0.75 · Pixel 0.627 · 700×900 0.994로 세로로 늘어납니다. 조건은 창 폭 < 0.9 × 높이입니다 | `qa/out/smoke/local/portrait/4-game.png`, `qa/out/smoke/local/desktop-700x900-game.png`, `qa/out/mobile/mobile-sheet-local.png` | `src/screens/GameScreen.jsx:18`. `height:72vh` 와 `maxWidth:92vw` 가 동시에 걸리면 `aspectRatio` 가 무시됩니다 |
| B2 | 터치 기기에서 조작 수단도 안내도 없음 | 휴대폰으로 열고 탭으로 입장한 뒤 판을 탭 · 스와이프 · 길게 누릅니다 | 조작하거나 「PC 전용」 안내가 떠야 합니다 / 이동 0px, 풍선 0개입니다. 58~115초 뒤 그냥 집니다 | `qa/out/mobile/*/mobile.json`(`touchEffect`, `idleOutcome`) | 입력은 `src/game/engine.js:72-88` 의 keydown · keyup뿐입니다 |
| B3 | 키보드만으로 캐릭터 · 맵을 고를 수 없음 | Tab으로 캐릭터 선택 화면을 돕니다 | 카드가 포커스를 받고 Enter · 화살표로 골라야 합니다 / 카드에 포커스가 가지 않아(`div onClick`, tabIndex −1) 기본값으로만 진행됩니다 | `qa/out/smoke/local/smoke.json`(`charCardFocusable:false`) | `src/screens/CharacterSelect.jsx:37`, `src/screens/MapSelect.jsx:27` |

### 작음 (17)

| ID | 버그 | 재현 단계 | 기대 / 실제 | 근거 | 의심 위치 |
|---|---|---|---|---|---|
| S1 | 작은 화면에서 게임이 스크롤된 채 시작해 HUD가 화면 밖에 있음 | 844×390에서 맵 화면을 내려 「입장」을 누릅니다 | 게임 화면은 맨 위에서 시작해야 합니다 / scrollY 61, HUD top −39로 시계 · 남은 상대가 안 보입니다. 방향키는 preventDefault라 키로 올릴 수도 없습니다 | `qa/out/smoke/local/landscape/4-game.png` | `src/App.jsx` 화면 전환에 스크롤 초기화가 없습니다. `src/game/engine.js:74` |
| S2 | 세로 화면 타이틀이 가로로 넘쳐 왼쪽이 잘림 | 390×844로 첫 화면을 봅니다 | 제목 · 캐릭터 줄이 폭에 맞아야 합니다 / scrollWidth 442. 제목이 left −52로 잘리고 스크롤로도 못 봅니다. 휴대폰에서는 레이아웃 폭이 441px로 넓어집니다 | `qa/out/smoke/local/portrait/1-title.png` | `src/screens/TitleScreen.jsx:88`(76px nowrap), `:92`(480px 캔버스) |
| S3 | 좁은 화면 결과 버튼 글자가 세로로 꺾임 | 844×390에서 판을 끝냅니다 | 버튼 글자가 한 줄이어야 합니다 / 「다 / 시 / 하 / 기」처럼 한 글자씩 꺾이고, 안내 글이 판 밖으로 넘칩니다 | `qa/out/smoke/local/landscape/5-result.png` | `src/components/ResultOverlay.jsx:18-20`(21px · 고정 padding) |
| S4 | 결과 화면에서 Space로 버튼이 안 눌림 | 결과 화면에서 Tab으로 「다시 하기」에 간 뒤 Space를 누릅니다 | 눌려야 합니다 / 안 눌립니다(Enter는 됩니다). 끝난 뒤에도 엔진 keydown이 Space를 preventDefault합니다 | `smoke.json`(`spaceActivatesRestart:false`) | `src/game/engine.js:74` |
| S5 | 결과 화면이 떠도 포커스 이동 · 스크린리더 알림이 없음 | 판을 끝냅니다 | 첫 버튼으로 포커스가 가고 결과가 읽혀야 합니다 / 포커스는 body에 남고 알림도 없습니다 | `smoke.json`(`resultFocusOnOpen: BODY`), `qa/out/a11y/local/aria-result.yml` | `src/components/ResultOverlay.jsx:11` |
| S6 | 게임 중 나가기 · 일시정지가 없고, 탭을 숨겨도 판이 계속됨 | 판 도중 타이틀로 가려 하거나 다른 탭으로 갑니다 | 멈추거나 나갈 수 있어야 합니다 / 버튼이 없어 판이 끝나야만 나갈 수 있습니다. 숨김 처리 코드도 없습니다(숨김 동작은 headless로 재현하지 못한 **추정**) | 코드 | `src/screens/GameScreen.jsx`(버튼 없음), `src/game/engine.js:90-93` |
| S7 | 창을 전환할 때 누르던 키가 풀리지 않을 수 있음 | 방향키를 누른 채 Alt+Tab으로 나갔다 돌아옵니다 | 키가 풀려야 합니다 / `blur` 처리가 없어 keyup을 놓치면 계속 걷습니다(**코드 근거 추정**, 사람 손 확인 필요) | 코드 | `src/game/engine.js:86-88` |
| S8 | 타이틀 문구 「5개의 맵」이 실제와 다름 | 타이틀을 봅니다 | 7개(+랜덤)여야 합니다 / 「6명의 캐릭터, 5개의 맵」으로 나옵니다 | `qa/out/smoke/local/desktop/1-title.png` | `src/screens/TitleScreen.jsx:89` |
| S9 | 고철 공장의 대각선 벽이 거의 사라짐 | 고철 공장으로 입장합니다 | 「대각선 벽. 시야가 좁음」이어야 합니다 / 하드블록 43칸 중 평균 29칸이 연결성 보정으로 열려 14칸만 남습니다(50판, 매번 14) | `qa/out/play/local/maps/4-factory-factory.png` | `src/game/maps.js:82-89`(고립 칸 이웃 하드블록을 모두 엶) |
| S10 | 축소 모션 설정을 무시함 | OS 「동작 줄이기」를 켜고 엽니다 | 떠다니는 애니메이션이 멈춰야 합니다 / 떠다니는 키프레임이 계속 돕니다 | `a11y.json` `motion` | `src/styles.css:113`, `TitleScreen.jsx:92`, `CharacterSelect.jsx:16` |
| S11 | 보조기술용 구조 정보가 없음 | 스크린리더로 엽니다 | 제목 · 선택 상태 · 게임 영역 이름이 있어야 합니다 / h1 · main 0개, 옵션 `aria-pressed` 없음, 캔버스 이름 없음(axe moderate 3종 × 5화면) | `qa/out/a11y/local/` | `src/screens/*.jsx`, `TitleScreen.jsx:10-31`(OptionRow) |
| S12 | 타일 256에서 프레임 비용이 커짐 | 타일 256을 고르고 봇 3으로 입장합니다 | 60fps를 유지해야 합니다 / 58.8fps, step 6.08ms(p95 9.2), 20ms 넘는 프레임 6.2%입니다(캔버스 3840×3328) | `qa/out/perf/local/perf.json` | `src/game/renderer.js`(정적 레이어 + 동적 레이어 전체 그리기) |
| S13 | 첫 로딩의 35%가 거의 안 쓰는 폴백 폰트 CSS | 라이브를 캐시 없이 엽니다 | / 183.7KB 중 Google Fonts CSS 64.7KB + 글꼴 9.1KB가 Jua · Gothic A1 폴백 몫입니다. 화면은 Neo둥근모입니다 | `qa/out/perf/live-load/perf.json` | `index.html:7-8` |
| S14 | 음소거해도 BGM 스케줄러가 계속 돎 | 사운드 「끔」 | 스케줄러가 멈춰야 합니다 / master 0인 채로 2초에 오실레이터 4개를 계속 만듭니다(들리지 않는 낭비) | `a11y.json` `audio.muted` | `src/audio/audio.js:186`, `setMuted` 가 `stopBgm` 을 부르지 않음 |
| S15 | 봇이 자기 물줄기에 갇히는 일이 남아 있음 | 헤드리스 시뮬(봇 3, 맵 7 × 4판 × 2분, 플레이어 정지 · 무적) | README 수용 기준은 「봇이 자기 풍선에 자살하지 않습니다」 / 168 봇·분당 자기 물줄기에 갇힘이 쉬움 40 · 보통 14 · 어려움 25번입니다(연쇄로 일찍 터진 경우 포함). 자동 조종도 던전에서 6초 만에 자멸한 판이 1번 있습니다 | `qa/selftrap-sim.test.js.txt`(실행법은 아래) | `src/game/ai.js` `think` 설치 판정(연쇄 · 다른 봇 풍선과의 겹침은 고려하지 않음 — 추정) |
| S16 | 던전 · 눈 언덕에서 블록 구분이 약함 | 두 맵에 들어갑니다 | 부술 수 있는 것과 없는 것이 한눈에 갈려야 합니다 / 던전은 바닥 자갈과 하드블록의 명도가 비슷하고, 눈 언덕은 상자와 하드블록이 둘 다 회색입니다(눈으로 본 판단) | `qa/out/play/local/snow-dungeon-zoom.png` | `src/game/maps.js:12-21`(팔레트) · `sprites.js` 블록 틴트 |
| S17 | 로컬 개발 환경이 lockfile과 어긋남 | 레포에서 `npm run lint` 를 돌립니다 | 통과해야 합니다 / `eslint: command not found`(127). `node_modules` 가 8/26 설치본(vite 5.4.21, lock은 8.3.1)이라 5310 `dist/`(`index-DSCkv1ZH.js` 194,101B)가 라이브(`index-CUHooIwZ.js` 191,710B)와 다른 빌드입니다 | `qa/logs/`, 이 문서 「정적 검증」 | 레포 `node_modules`. `npm ci` 로 맞추면 됩니다(리드 판단) |

문서와 실제가 다른 곳도 있습니다. 버그로 세지 않았습니다.

- brief `00-common.md` 의 `?t=<타일크기>` 는 실제로 **제한 시간(초)** 입니다(`src/App.jsx:23`).
- `docs/ARCHITECTURE.md` 의 「맵 5종+랜덤」(51행)과 「Vite 5」(빌드 절)는 옛 정보입니다. 지금은 7종과 vite 8입니다.

## 통과한 것 — 2단계 비교 기준

- lint 경고 0, 시험 59/60(1 건너뜀), 빌드 JS gzip 63.55KB.
- 세 크기 × 로컬 · 라이브에서 화면 흐름이 끝까지 되고 콘솔 오류 · 실패 요청 · 4xx가 0입니다.
- 실제 키 입력 점검 21/21: 이동 · WASD · IME · 풍선 · 상한 · 바늘 · 아이템 7종 · HUD 갱신 · 갇힘 2.6초 · 탈락 4초 · 패배 · 승리 · 무승부 · 다시 하기.
- 맵 10판 모두 도달할 수 없는 칸 0, 스폰 막힘 0.
- 자동 조종으로 실제 승리 5/8.
- 데스크톱 60fps(타일 64 · 128, 맵 7종, 봇 1~3), step 평균 0.3ms 이하.
- 라이브 첫 로딩 183.7KB · FCP 0.54~0.57초.
- 5분 30초 판 힙 평탄, 다시 하기 · 화면 왕복 40회 누수 없음.
- 작은 글자 대비 미달 0, 포커스 링 보임, Tab 순서 자연스러움.
- 소리 잠금 해제 · 볼륨 · 끔 · 설정 저장.

## 회귀 도구 — 실행법

모든 스크립트는 URL만 받습니다. `src/` 를 고치지 않고, 결과는 `docs/upgrade/qa/out/<점검>/<label>/` 에 JSON · PNG(1280px 이하)로 남습니다. Playwright는 승인된 `dokkaebi-quest/node_modules/playwright` 를 빌려 씁니다(`PLAYWRIGHT_PATH` 로 바꿀 수 있음). axe는 `AXE_PATH`(기본 `~/sonix/fe/sonix_homepage/node_modules/axe-core/axe.min.js`)를 씁니다.

```sh
# 한 번에 (약 15분, --memory 를 붙이면 +6분)
bash docs/upgrade/qa/run-all.sh http://127.0.0.1:5310 stage2
# 기준선과 비교 (다른 줄 앞에 * 표시)
node docs/upgrade/qa/summary.mjs --label stage2 --base local

# 하나씩
node docs/upgrade/qa/smoke.mjs  --url <URL> --label <이름>      # 화면 흐름 3크기 + 키보드
node docs/upgrade/qa/play.mjs   --url <URL> --label <이름>      # 키 입력 점검 + 맵 10판
node docs/upgrade/qa/play.mjs   --url http://127.0.0.1:5312 --label ap --autopilot 8 --skill 쉬움 --bots 1 --t 90
                                                                # 실제 승리(자동 조종) — /src 를 주는 dev 서버 필요
node docs/upgrade/qa/a11y.mjs   --url <URL> --label <이름>      # axe · 대비 · 축소 모션 · 소리
node docs/upgrade/qa/perf.mjs   --url <URL> --label <이름> --only fps,load,restart
node docs/upgrade/qa/perf.mjs   --url <URL> --label <이름>-memory --only memory --minutes 5.5
node docs/upgrade/qa/mobile.mjs --url <URL> --label <이름> [--engine webkit]

# 봇 자멸 시뮬 (레포 밖 clone 에서): scripts/ 로 복사해 vitest 로 돌린다
cp docs/upgrade/qa/selftrap-sim.test.js.txt <clone>/scripts/selftrap-sim.test.js
cd <clone> && SIM=1 timeout 300 npx vitest run scripts/selftrap-sim.test.js --silent=false --reporter=verbose
```

기준선 label은 `local`(5310) · `live`(라이브) · `dev-autopilot` · `local-memory` · `live-load` · `live-webkit`(휴대폰)입니다. 2단계에서는 같은 label 이름 규칙으로 돌려 `summary.mjs --base` 로 비교합니다. fps는 기계 부하에 흔들리므로 같은 조건에서 두 번 이상 재서 비교하는 것을 권합니다.

## 리드에게 — 사용자 결정이 필요한 것

1. **휴대폰 대응 범위**: 「PC 전용」 안내만 붙일지(B2 최소 해결), 터치 조작(가상 패드 + 풍선 · 바늘 버튼)까지 넣을지 정해야 합니다. 넣는다면 세로 화면까지 지원할지도 함께 정해야 합니다. 15×13 가로형 판이라 세로에서는 타일이 약 24px가 됩니다(계산).
2. **일시정지 · 나가기 · 탭 숨김 자동 정지**: 지금은 `ARCHITECTURE.md` 의 「탭 비활성에도 80ms 폴백으로 계속 진행」이 계약입니다. 바꾸려면 이 계약을 고쳐야 합니다(S6 · S7).
3. **고철 공장 맵**: 연결성 보정 방식을 바꿔 대각선 벽을 살릴지, 설명 문구를 실제에 맞게 바꿀지 정해야 합니다. `maps.js` 의 「레이아웃 규칙 변경 금지」 원칙과 맞물립니다(S9).
4. **봇 자멸 허용선**: 쉬움의 실수는 의도된 것입니다. 보통 · 어려움에서도 남아 있는 자기 물줄기 갇힘(168 봇·분당 14 · 25)을 AI로 줄일지, README 수용 기준 문구를 고칠지 정해야 합니다(S15). 난이도 시뮬에서 잡은 비율이 보통 0.80 > 어려움 0.67로 뒤집힌 것도 함께 볼 거리입니다.
5. **타일 256 옵션**: 유지할지(S12), 그리고 폴백 웹폰트 Jua · Gothic A1을 뺄지(S13, 첫 로딩 약 74KB 절감) 정해야 합니다.
6. **QA 산출물 커밋 범위**: `docs/upgrade/qa/out/` 은 PNG 113장으로 약 34MB입니다. 스크립트 · 보고서 · 대표 그림만 커밋하고 나머지는 `.gitignore` 할지 정해야 합니다(리드 판단).
7. **로컬 `node_modules` 재설치**: 5310 미리보기가 라이브와 다른 vite로 빌드된 상태입니다. 2단계 비교 전에 `npm ci` 로 맞출지 정해야 합니다(S17, 리드 판단. 저는 레포 `node_modules` 를 건드리지 않았습니다).
