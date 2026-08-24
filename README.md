# 물풍선 대작전 (water-balloon-arcade)

크레이지아케이드류 2D 물풍선 아케이드 게임. 완성 동작하는 프로토타입
`../크레이지아케이드 (1)/물풍선 대작전.dc.html` 을 **React 18 + Vite** 프로젝트로 이식한 것이다.

게임 규칙·수치·픽셀 스프라이트 데이터는 프로토타입에서 그대로 복사하며, 새로 발명하지 않는다.
(상세 지시: [PROMPT.md](PROMPT.md))

## 실행

```bash
npm install
npm run dev      # Vite 개발 서버
npm run build    # 프로덕션 빌드 (dist/)
npm run preview  # 빌드 결과 미리보기
npm test         # Vitest — 50 테스트
```

## 조작

| 입력 | 동작 |
|---|---|
| 방향키 / WASD | 이동 |
| Space | 물풍선 설치 |
| X | 바늘 (내 풍선 즉시 터뜨리기) |

## 구조 한눈에

- `src/game/` — React와 무관한 **순수 JS 게임 엔진** (루프·AI·렌더러·스프라이트·맵)
- `src/screens/` — 화면 4종: 타이틀 → 캐릭터 선택 → 맵 선택 → 게임
- `src/components/` — HUD 바, 결과 오버레이, 픽셀 캔버스
- `src/hooks/useGame.js` — 엔진 생성/정리 + HUD 스냅샷 구독 (게임 루프는 엔진 소유)

상세 문서:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 모듈 구조와 엔진/React 경계
- [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md) — 게임 규칙·수치 레퍼런스 (변경 금지 값 포함)
- [docs/WORK-SPLIT.md](docs/WORK-SPLIT.md) — 멀티세션 분업 현황
- [src/game/README.md](src/game/README.md) — 프로토타입 → 모듈 이식 대응표

## 수용 기준 (완료 정의)

- [x] 세 화면 전환과 결과 화면 재시작이 동작한다. (headless 브라우저 검증, 콘솔 에러 0)
- [x] 타일 64/128/256 전환 시 픽셀이 뭉개지지 않는다. (3종 모두 정수배 + pixelated 검증)
- [x] 봇이 자기 풍선에 자살하지 않는다 (탈출 경로 검증).
- [x] 맵에 도달 불가능한 구역이 없다 (BFS 연결성 보정).
- [x] 60fps 유지, 콘솔 에러 없음.
- 결과 경로: 패배·무승부 검증 완료. 승리(win)는 코드상 동일 분기라 리스크 낮으나 **수동 플레이 확인 권장**.

QA/개발용 URL 파라미터: `?t=<초>` 제한시간, `?bots=<1..3>` 봇 수. (예: `?t=8` 로 무승부 즉시 재현)

세부 진행 현황은 [docs/WORK-SPLIT.md](docs/WORK-SPLIT.md) 참조.
