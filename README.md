# 물풍선 대작전 (water-balloon-arcade)

**한국어** | [English](README.en.md)

격자 맵에 물풍선을 놓아 물줄기로 상대를 가두는 2D 픽셀 아케이드 게임입니다.
캐릭터 여섯 · 맵 일곱(+랜덤) 중에 골라 봇 셋과 3분 동안 겨룹니다. 마지막까지 살아남으면 이깁니다.

▶ 바로 하기: https://water-balloon-arcade-ebon.vercel.app/ (키보드가 있는 컴퓨터)

손으로 만든 HTML 프로토타입을 **React 18 + Vite** 로 옮겼습니다. 게임 엔진은 React 와 떨어진 순수 JS,
그림은 Canvas 2D 픽셀 스프라이트, 배경 음악은 Web Audio 로 코드에서 합성한 칩튠입니다.
게임 규칙 · 수치 · 스프라이트 데이터는 프로토타입 값을 그대로 옮겼고 임의로 바꾸지 않습니다.
(상세 지시: [PROMPT.md](PROMPT.md))

## 실행

```bash
npm install
npm run dev      # Vite 개발 서버
npm run build    # 프로덕션 빌드 (dist/)
npm run preview  # 빌드 결과 미리보기
npm test         # Vitest
npm run lint     # ESLint
```

## 조작

| 입력 | 동작 |
|---|---|
| 방향키 / WASD | 이동 |
| Space | 물풍선 설치 |
| X | 바늘 (내 풍선 즉시 터뜨리기) |
| Esc / P | 일시정지 · 이어 하기 |

## 기능

### 난이도 선택

타이틀 화면에서 봇 난이도(쉬움 / 보통 / 어려움)를 고르면 다음 실행에도 기억합니다.
쉬움 봇은 가끔 위험을 놓치고, 어려움 봇은 더 자주 판단하며 가까운 플레이어를 먼저 쫓습니다.
결과 화면에 이번 판 난이도가 표시됩니다. 파라미터와 헤드리스 측정값은 [GAME-DESIGN.md](docs/GAME-DESIGN.md#난이도별-파라미터-v8) 에 있습니다.

### 소리 — 효과음 녹음 파일 · 배경음 코드 합성

효과음은 `public/sfx/*.mp3` 녹음 파일(ElevenLabs 생성)을 씁니다. 파일을 불러오기 전이나 불러오지 못하면
같은 자리에 코드로 합성한 소리를 대신 냅니다. 배경 음악은 Web Audio 로 코드에서 합성한 칩튠입니다.
타이틀에서 소리 켬 · 끔과 볼륨을 고르면 다음 실행에도 기억합니다.

## 모듈 구조

- `src/game/` — React와 무관한 **순수 JS 게임 엔진** (루프·AI·렌더러·스프라이트·맵)
- `src/screens/` — 화면 4종: 타이틀 → 캐릭터 선택 → 맵 선택 → 게임
- `src/components/` — HUD 바, 결과 오버레이, 픽셀 캔버스
- `src/hooks/useGame.js` — 엔진 생성/정리 + HUD 스냅샷 구독 (게임 루프는 엔진 소유)

상세 문서:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 모듈 구조와 엔진/React 경계
- [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md) — 게임 규칙·수치 레퍼런스 (변경 금지 값 포함)
- [docs/WORK-SPLIT.md](docs/WORK-SPLIT.md) — 멀티세션 분업 현황
- [src/game/README.md](src/game/README.md) — 프로토타입 → 모듈 이식 대응표

## 수용 기준

- [x] 세 화면 전환과 결과 화면 재시작이 동작합니다. (headless 브라우저 검증, 콘솔 에러 0)
- [x] 타일 64/128/256 전환 시 픽셀이 뭉개지지 않습니다. (3종 모두 정수배 + pixelated 검증)
- [x] 봇이 자기 풍선에 자살하지 않습니다 (탈출 경로 검증).
- [x] 맵에 도달 불가능한 구역이 없습니다 (BFS 연결성 보정).
- [x] 60fps 유지, 콘솔 에러 없음.
- 결과 경로: 패배·무승부 검증 완료. 승리(win)는 코드상 동일 분기라 리스크 낮으나 **수동 플레이 확인 권장**.

QA/개발용 URL 파라미터: `?t=<초>` 제한시간, `?bots=<1..3>` 봇 수. (예: `?t=8` 로 무승부 즉시 재현)
