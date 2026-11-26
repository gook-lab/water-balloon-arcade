# 물풍선 대작전 — 공개 문구 최종본 (2단계 1라운드)

작성 2026-11-26 · 마케팅 담당. 훅은 사용자 결정대로 A 「물줄기로 가두고, 마지막까지 살아남아요」입니다.
숫자는 화면과 코드로 확인한 것만 씁니다: 캐릭터 여섯 · 맵 일곱(+랜덤) · 봇 셋 · 한 판 3분.

## README 첫 단락 — 한 · 영 대체 문안

화면 담당이 `README.md` · `README.en.md` 의 제목 아래 첫 단락(지금 5 ~ 9행, 언어 전환 줄 다음)을 아래로 바꿉니다.
프로토타입 폴더 경로는 폴더 이름에 다른 게임 이름이 들어 있어 통째로 지웁니다.

### README.md (한국어)

```markdown
격자 맵에 물풍선을 놓아 물줄기로 상대를 가두는 2D 픽셀 아케이드 게임입니다.
캐릭터 여섯 · 맵 일곱(+랜덤) 중에 골라 봇 셋과 3분 동안 겨룹니다. 마지막까지 살아남으면 이깁니다.

▶ 바로 하기: https://water-balloon-arcade-ebon.vercel.app/ (키보드가 있는 컴퓨터)

손으로 만든 HTML 프로토타입을 **React 18 + Vite** 로 옮겼습니다. 게임 엔진은 React 와 떨어진 순수 JS,
그림은 Canvas 2D 픽셀 스프라이트, 배경 음악은 Web Audio 로 코드에서 합성한 칩튠입니다.
게임 규칙 · 수치 · 스프라이트 데이터는 프로토타입 값을 그대로 옮겼고 임의로 바꾸지 않습니다.
(상세 지시: [PROMPT.md](PROMPT.md))
```

### README.en.md (English)

```markdown
A 2D pixel arcade game: drop water balloons on a grid and trap your rivals in the splash.
Pick one of six characters and seven maps (plus random), then take on three bots in a three-minute round.
Be the last one dry to win.

▶ Play now: https://water-balloon-arcade-ebon.vercel.app/ (desktop with a keyboard; the in-game text is Korean)

Ported from a hand-built HTML prototype to **React 18 + Vite**. The game engine is plain JS kept apart from React,
graphics are Canvas 2D pixel sprites, and the chiptune music is synthesized in code with Web Audio.
Game rules, tuning values and sprite data are carried over from the prototype as-is and are not changed arbitrarily.
(Full brief: [PROMPT.md](PROMPT.md))
```

확인한 사실: 엔진이 React 와 분리됨(`src/game/engine.js` 는 React 를 import 하지 않음), 렌더러는 Canvas 2D(`src/game/renderer.js`),
배경 음악은 코드 합성(`src/audio/audio.js` 의 bgm 스케줄러). 효과음은 이번 라운드에 `public/sfx/*.mp3` 를 쓰고 합성음을 대체로
두므로(엔진 brief E5), 「소리 전부 코드로」라고 쓰지 않고 「배경 음악」으로 범위를 좁혔습니다.

## 메타 태그 — `index.html` `<head>` 최종안

화면 담당이 `index.html` 에 넣고, 그림 넷을 `public/` 로 복사합니다(`og.png` · `favicon.svg` · `favicon-32.png` · `apple-touch-icon.png`).
`og:image` 는 절대 주소여야 메신저가 읽습니다. 도메인이 바뀌면 `og:url` · `og:image` · `twitter:image` 셋을 같이 고칩니다.

```html
<title>물풍선 대작전 — 브라우저 픽셀 물풍선 아케이드</title>
<meta name="description" content="격자 맵에 물풍선을 놓아 물줄기로 상대를 가두는 픽셀 아케이드예요. 캐릭터 여섯 · 맵 일곱 중에 골라 봇 셋과 3분 동안 겨뤄요." />
<meta name="theme-color" content="#0e1226" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

<meta property="og:type" content="website" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:site_name" content="물풍선 대작전" />
<meta property="og:title" content="물풍선 대작전" />
<meta property="og:description" content="물줄기로 가두고, 마지막까지 살아남아요. 설치 없이 브라우저에서 바로 한 판 해요." />
<meta property="og:url" content="https://water-balloon-arcade-ebon.vercel.app/" />
<meta property="og:image" content="https://water-balloon-arcade-ebon.vercel.app/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="초록 들판 맵에서 십자 물줄기에 갇힌 펭구 옆으로 코코와 친구들이 물풍선을 놓는 장면" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="물풍선 대작전" />
<meta name="twitter:description" content="물줄기로 가두고, 마지막까지 살아남아요. 설치 없이 브라우저에서 바로 한 판 해요." />
<meta name="twitter:image" content="https://water-balloon-arcade-ebon.vercel.app/og.png" />
```

| 칸 | 한국어(페이지에 넣는 값) | 영어(README · 레포 설명 · 영문 표면용) |
|---|---|---|
| `<title>` | 물풍선 대작전 — 브라우저 픽셀 물풍선 아케이드 (26자) | Water Balloon Arcade — a pixel water balloon battle in your browser |
| description | 격자 맵에 물풍선을 놓아 물줄기로 상대를 가두는 픽셀 아케이드예요. 캐릭터 여섯 · 맵 일곱 중에 골라 봇 셋과 3분 동안 겨뤄요. (73자) | A pixel arcade game where you drop water balloons on a grid and trap your rivals in the splash. Pick one of six characters and seven maps, then take on three bots in a three-minute round. |
| og:description · twitter:description | 물줄기로 가두고, 마지막까지 살아남아요. 설치 없이 브라우저에서 바로 한 판 해요. (46자) | Trap them in the splash. Be the last one dry. Play right in your browser — no install. |
| og:image:alt | 초록 들판 맵에서 십자 물줄기에 갇힌 펭구 옆으로 코코와 친구들이 물풍선을 놓는 장면 | A grass map where a cross of water has trapped a penguin in a bubble while the other characters drop balloons nearby |

- 영어판 게임 UI 는 미뤘으므로 페이지에는 한국어 값만 넣습니다. 영어 값은 README.en · GitHub 레포 설명 · 허브 영문에 씁니다.
- `og:site_name` 은 게임 이름으로 두었습니다. 허브 소속을 드러내려면 「FEYS 다락 오락실」로 바꾸면 되고, 그 판단은 리드 · 사용자 몫입니다(1단계 결정 거리 8번).
- GitHub 레포 설명(영어 한 줄, 다른 게임 지칭 없음): `A 2D pixel arcade game: trap rivals with water balloons on a grid. React 18 + Vite, plain-JS engine, Canvas.`

## 허브 카드 — 바꿀 문구 표

허브 레포(`~/sonix/toy/game-hub`)는 읽기만 했습니다. 리드가 허브에 넣습니다. 상세(`details.ts`)의 맵 수는 이미 「일곱(또는 랜덤)」으로 고쳐져 있어 그대로 둡니다.

| 자리(허브 파일) | 지금 | 바꿀 문구 |
|---|---|---|
| 훅 `src/data/games.ts` | 물풍선으로 길을 막고 살아남아요 | **물줄기로 가두고, 마지막까지 살아남아요** |
| 소개 `src/data/games.ts` | 격자 맵에 물풍선을 놓아 상대를 가두는 2D 픽셀 아케이드예요. 봇 난이도를 쉬움 · 보통 · 어려움 중에 고르고, 캐릭터와 맵을 골라 한 판 해요. | **격자 맵에 물풍선을 놓아 물줄기로 상대를 가두는 2D 픽셀 아케이드예요. 캐릭터 여섯 · 맵 일곱(또는 랜덤) 중에 골라 봇 셋과 3분 동안 겨뤄요.** |
| 영문 훅 `src/i18n/en/games.ts` | Trap them with water balloons and stay standing | **Trap them in the splash. Be the last one dry.** |
| 영문 소개 `src/i18n/en/games.ts` | A 2D pixel arcade game where you drop water balloons on a grid to trap your rivals. Set the bots to Easy, Normal or Hard, pick a character and a map, and go. | **A 2D pixel arcade game where you drop water balloons on a grid and trap your rivals in the splash. Pick one of six characters and seven maps (or random), then take on three bots in a three-minute round.** |
| 표지 `public/covers/water-balloon-arcade.webp` | 타이틀 화면(설정 버튼) | `final/hub-cover.webp`(800×500, 무손실 9.5KB). 원본은 `final/hub-cover.png` |
| 특징 3 `src/data/details.ts` · 영문 | 칩튠 효과음과 배경음 / Chiptune sound effects and music | 이번 라운드에 효과음이 녹음 파일(`public/sfx/*.mp3`)로 바뀌면 **효과음과 칩튠 배경음 / Sound effects and chiptune music**. 엔진 E5 가 들어가기 전이면 그대로 둡니다 |
| 태그 · 조작 | 아케이드 · 픽셀 · 봇 대전 / … X 바늘 | 그대로(「바늘」 이름은 게임 쪽 결정 뒤에 맞춥니다) |

## 결과 공유 한 줄 — 「결과 복사」 형식(엔진 담당용)

클립보드에 두 줄을 넣습니다. 첫 줄이 결과, 둘째 줄이 링크입니다. 메신저 미리보기에서 첫 줄이 잘리지 않게 50자 안쪽으로 맞췄습니다.

| 결과 | 첫 줄 형식 | 예 |
|---|---|---|
| 승 | `물풍선 대작전 · {봇 실력} · {시간} 만에 이겼어요 · {가둔 수}명 가뒀어요` | 물풍선 대작전 · 보통 · 1분 42초 만에 이겼어요 · 3명 가뒀어요 |
| 패 | `물풍선 대작전 · {봇 실력} · {시간} 버텼어요 · {가둔 수}명 가뒀어요` | 물풍선 대작전 · 보통 · 1분 42초 버텼어요 · 1명 가뒀어요 |
| 무 | `물풍선 대작전 · {봇 실력} · {제한 시간} 끝까지 버텼어요 · {가둔 수}명 가뒀어요` | 물풍선 대작전 · 어려움 · 3분 끝까지 버텼어요 · 2명 가뒀어요 |

둘째 줄(셋 다 같음): `나도 해 보기 → https://water-balloon-arcade-ebon.vercel.app/?from=share`

규칙:
- `{시간}` 은 판 시작부터 끝(승 · 탈락)까지. 60초 미만은 「48초」, 딱 떨어지는 분은 「3분」(「3분 0초」로 쓰지 않음), 그 밖은 「1분 42초」.
- `{가둔 수}` 가 0 이면 「· 0명 가뒀어요」 마디를 통째로 뺍니다(자랑할 수 없는 숫자는 싣지 않습니다).
- 이번 판에 「새 기록이에요!」가 하나라도 떴으면 첫 줄 끝에 ` · 새 기록!` 을 붙입니다(선택).
- `{봇 실력}` 은 화면 표기 그대로 쉬움 · 보통 · 어려움.
- 무승부의 `{제한 시간}` 은 그 판의 제한 시간(기본 3분, `?t=` 로 바뀐 판이면 그 값).
- 영어판은 게임 UI 를 미뤘으므로 만들지 않습니다.

## 그림 파일 — 고른 장면과 쓰는 곳

| 파일 | 크기 | 쓰는 곳 |
|---|---|---|
| `og.png` | 1200×630 · 151KB | `public/og.png` — 메신저 · SNS 미리보기 |
| `hub-cover.png` · `hub-cover.webp` | 800×500 · 21KB / 9.5KB(무손실) | 허브 `public/covers/water-balloon-arcade.webp` |
| `favicon.svg` | 32×32 격자 SVG · 9KB | `public/favicon.svg` |
| `favicon-32.png` | 32×32 · 투명 배경 | `public/favicon-32.png`(SVG 를 못 읽는 브라우저용) |
| `apple-touch-icon.png` | 180×180 · 바탕 `#1b2347` · 풍선 128px · 여백 26px | `public/apple-touch-icon.png` |
| `shoot.mjs` | — | 다시 찍는 스크립트(아래) |
| `shot-board-full.png` · `check-360.png` · `check-icons.png` | 확인용 | 배포하지 않습니다 |

장면: 초록 들판, 가운데 풍선이 십자 물줄기로 터진 순간입니다. 물줄기 오른쪽 끝에서 펭구가 물방울에 갇혀 4초 고리가 막 돌기 시작했고,
뭉치가 바로 옆까지 다가와 있습니다. 왼쪽 위에는 내 캐릭터 코코(머리 위 노란 표시), 위쪽에는 삐용이 막 놓은 파란 풍선,
아래쪽에는 곧 터질 주황 풍선, 왼쪽 끝 상자는 물줄기에 부서지는 중입니다. 게임의 핵심 규칙(놓기 → 십자 물줄기 → 갇힘)이 한 장에 다 들어갑니다.

고른 이유:
- **초록 들판** — 밝은 물색이 초록 위에서 가장 잘 보이고, 기본 맵이라 처음 들어온 사람이 보는 판과 같습니다.
- **갇힌 봇은 펭구** — 물방울이 하늘색이라 뭉치(하늘색)를 넣으면 안 보였습니다(첫 촬영에서 확인). 짙은 남색 펭구는 360px 축소본에서도 물방울 안에 보입니다.
- **허브 표지는 글자 없이 판만** — 허브 카드가 표지 바로 아래에 게임 이름 · 훅을 이미 씁니다. 타일 96px(도트 6px 정수배)로 잘라 진열장 폭 360px 에서 인물이 약 43px 로 보입니다(`check-360.png`).
- **OG 는 이름 + 훅 + 캐릭터 여섯** — 글자는 게임 이름과 훅 한 문장뿐입니다. 판은 타일 80px(도트 5px 정수배)로 잘라 픽셀이 뭉개지지 않습니다. 360px 축소에서 이름 · 훅이 읽히고, 280px(카카오톡 말풍선 폭 정도)에서도 이름은 또렷하고 훅은 작지만 읽힙니다.
- **파비콘은 게임의 물풍선 스프라이트 그대로**(`balloonSprite(0)`, 32×32) — 새로 그리지 않아 게임 안 풍선과 같습니다. 16px 에서는 파란 원 + 흰 반짝임으로 읽힙니다(`check-icons.png`).

### 다시 찍는 법

```sh
# 레포 본체에서
npx vite --port 5313 --strictPort --host 127.0.0.1   # 다른 창
timeout 120 node docs/upgrade/marketing/final/shoot.mjs
```

게임 흐름(타이틀 → 캐릭터 → 맵 → 입장, `?bots=3`)으로 실제 판에 들어가 엔진 인스턴스를 잡고, 인물 · 풍선 위치만 놓은 뒤
엔진의 `burst()` 로 실제로 터뜨립니다(상자 부서짐 · 갇힘 판정은 게임 규칙 그대로). 물줄기가 가장 굵은 순간에
`performance.now` 를 멈춰 찍습니다. 난수는 시드(`SEED`, 기본 7)로 고정해 매번 같은 판이 나옵니다.
렌더러 · 스프라이트가 바뀌면 다시 돌려 새 그림을 뽑으면 됩니다. vite dev 서버가 필요합니다(빌드본 preview 에서는 모듈을 잡을 수 없습니다).

## 확인할 것 — 리드에게

1. 화면 담당이 타이틀 부제를 훅 A 로 바꾸면 OG · 허브 · 타이틀 세 곳의 훅이 같아집니다. 다르게 들어가면 알려 주세요.
2. 효과음 파일(E5)이 들어가면 허브 특징 3 문구를 위 표대로 바꿉니다. README 는 이미 「배경 음악」으로 범위를 좁혀 두어 어느 쪽이어도 맞습니다.
3. `og:site_name` 값(게임 이름 / 허브 이름)은 결정 대기입니다.
4. 공유 줄의 `?from=share` 가 Vercel Web Analytics 페이지 조회에서 따로 보이는지는 확인하지 못했습니다. 안 보이면 다음 라운드에 경로로 나누는 방법(예: `/play`)을 봅니다.
