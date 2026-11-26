# 물풍선 대작전 고도화 — 공통 규칙 (2026-11-26)

사용자 요청: 「물풍선 대작전 고도화 — 기획 · QA · 마케팅 에이전트 붙여 작업 진행」.
이번은 **1단계 진단**입니다. 세 팀원(기획 · QA · 마케팅)이 같은 게임을 각자 관점으로 보고 보고서를 씁니다.
리드가 세 보고서를 합쳐 2단계(구현 라운드) 범위를 정합니다.

## 대상

- 레포: `~/sonix/toy/water-balloon-arcade` (React 18 + Vite, 순수 JS 엔진 `src/game/`, Vitest, ESLint, GitHub Actions CI)
- 문서: `README.md`, `docs/GAME-DESIGN.md`(규칙 · 수치), `docs/ARCHITECTURE.md`, `src/game/README.md`, `PROMPT.md`(이식 당시 지시 — 「프로토타입 수치 그대로」는 **이식 단계의 원칙**이었습니다. 고도화에서 바꿀 값이 있으면 근거와 함께 제안만 하고, 확정은 사용자가 합니다)
- 라이브: https://water-balloon-arcade-ebon.vercel.app (11/26 공개, dist 만 올린 정적 배포)
- 로컬 미리보기: http://127.0.0.1:5310 (리드가 띄워 둠, 현재 main 빌드). **이 서버를 끄지 마세요.** 직접 서버가 필요하면 자기 포트(기획 5311 · QA 5312 · 마케팅 5313)만 쓰고, 끌 때도 `lsof -ti :<자기포트> | xargs kill` 로 자기 것만.
- QA용 URL 파라미터: `?t=<타일크기>` · `?bots=<수>` (자세한 건 `docs/ARCHITECTURE.md`)
- 허브 카드: https://feys-arcade.vercel.app/#/game/water-balloon-arcade (FEYS 다락 오락실 — 이 게임이 진열된 곳)

## 지켜야 할 것

1. **1단계는 진단만** — `src/` · `tests/` · 설정 파일을 고치지 않습니다. 쓰는 곳은 자기 보고서 파일과 자기 그림 폴더뿐입니다.
   - 기획: `docs/upgrade/plan.md`, `docs/upgrade/plan/`
   - QA: `docs/upgrade/qa-baseline.md`, `docs/upgrade/qa/`
   - 마케팅: `docs/upgrade/marketing.md`, `docs/upgrade/marketing/`
2. **커밋 · push · 배포 금지.** 리드가 합니다(main 은 보호 + pre-commit 가드).
3. **오리지널 유지** — 장르(격자 물풍선 아케이드)는 같아도 되지만, 특정 기존 게임의 이름 · 캐릭터 · 그림 · 음악 · 맵 · UI 를 따라 하는 제안은 하지 않습니다. 공개 문구에 다른 게임 이름을 쓰지 않습니다.
4. **명령은 포그라운드 + timeout** — 테스트 · 빌드 · 촬영은 `timeout <초>` 를 건 포그라운드로 돌리고, 「백그라운드 완료 알림을 기다린다」며 턴을 끝내지 않습니다. 테스트는 `timeout 600 npx vitest run --reporter=verbose > <로그> 2>&1`.
5. **브라우저** — 기본은 gstack browse(`$B`). 팀원마다 상태 파일을 나눕니다: `BROWSE_STATE_FILE=/tmp/wba-<역할>.json`. 캔버스 게임에서 키를 누르고 있거나 여러 키를 섞어야 하면 Playwright 를 씁니다:
   `require('/Users/kyb-ontact/sonix/toy/dokkaebi-quest/node_modules/playwright')` (게임 자동 확인용 예외로 승인된 방식).
6. **그림** — 촬영본은 1280px 이하로 저장하고 Read 합니다(큰 그림을 읽으면 컨텍스트가 빨리 찹니다). 2560px 원본을 Read 하지 마세요. 판단 근거로 쓸 그림은 자기 그림 폴더에 남기고 보고서에서 경로로 짚습니다.
7. **수치는 실측** — 보고서의 숫자(fps, 판 길이, 승률, 로딩 크기 등)는 직접 잰 값만 쓰고 잰 방법을 같이 적습니다. 못 잰 것은 「추정」이라고 씁니다.
8. **문체** — 보고서 본문은 습니다체, 헤딩은 「대상 — 결정」 같은 기술 명사구. 게임 안 UI 문구 제안은 토스식 해요체(짧게 · 긍정).

## 보고 형식

보고서 맨 위에 **세 줄 요약**, 그다음 본문. 끝에 「리드에게 — 사용자 결정이 필요한 것」 절을 둡니다.
끝나면 최종 응답에 보고서 경로 · 세 줄 요약 · 사용자 결정 거리만 짧게 적습니다.
