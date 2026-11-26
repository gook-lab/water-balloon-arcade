# 2단계 1라운드 — 공통 규칙 (2026-11-26)

1단계 보고서 세 개(`docs/upgrade/plan.md` · `qa-baseline.md` · `marketing.md`)를 합친 첫 구현 라운드입니다.
사용자 결정(11/26):

- 휴대폰은 **안내 + 화면 깨짐 고치기까지만**. 터치 조작(가상 패드)은 다음 라운드 첫 항목입니다.
- 게임 규칙 수치(봇 추적 대상 · 캐릭터 능력 · 밀물 · 펭구 등)는 **이번에 바꾸지 않습니다**. 다음 라운드에서 시뮬과 함께 정합니다.
- 다른 게임 이름은 **현재 파일 전부에서 정리**(README 한 · 영 · docs · 주석 · CSS 이름). git 이력은 그대로 둡니다.
- 방문 집계는 **페이지 조회만**(Vercel Web Analytics 스크립트 태그, 커스텀 이벤트 없음).

## 일하는 곳

- 각자 자기 **작업 트리**에서 자기 가지로 커밋합니다. main · `upgrade/r1` 에 직접 커밋하지 않습니다. push · 배포 · PR 은 리드가 합니다.
  - 엔진 담당: `~/sonix/toy/water-balloon-arcade/.worktrees/engine` (가지 `upgrade/r1-engine`), 서버 포트 5321
  - 화면 담당: `~/sonix/toy/water-balloon-arcade/.worktrees/ui` (가지 `upgrade/r1-ui`), 서버 포트 5322
  - 마케팅(그림 · 문구 최종본): 레포 본체 `~/sonix/toy/water-balloon-arcade` 의 `docs/upgrade/marketing/final/` 에만 씁니다. 커밋하지 않습니다(리드가 합침).
- 작업 트리에서는 먼저 `npm ci` 를 합니다(`node_modules` 는 트리마다 따로).
- 서버는 자기 포트만 띄우고 끕니다: `lsof -ti :<포트> | xargs kill`. `pkill -f vite` 같은 넓은 명령은 쓰지 않습니다(다른 팀원 · 리드 서버가 같이 죽습니다). 5310 은 리드 것입니다.
- 브라우저 상태 파일: `BROWSE_STATE_FILE=/tmp/wba-r1-<역할>.json`. 캔버스 · 키 입력 확인은 Playwright(`/Users/kyb-ontact/sonix/toy/dokkaebi-quest/node_modules/playwright`)를 써도 됩니다.

## 지켜야 할 것

1. **서로의 파일을 건드리지 않기** — 아래 「파일 주인」 표를 따릅니다. 꼭 필요하면 고치지 말고 최종 보고에 「상대 담당에게 부탁」으로 적습니다.
2. **명령은 포그라운드 + timeout** — 테스트 · 빌드 · 촬영은 `timeout <초>` 포그라운드로. 「백그라운드 완료 알림을 기다린다」며 턴을 끝내지 않습니다.
   테스트: `timeout 600 npx vitest run --reporter=verbose > <로그> 2>&1`.
3. **커밋 전 검증** — `npm run lint` · 테스트 · `npm run build` 통과. 새 기능에는 시험을 붙입니다(수용 기준이 시험으로 적힌 것은 그대로).
4. **커밋** — conventional(`feat(engine): …` 등), 묶음마다 하나. 작성자는 레포 설정(gook-lab)을 그대로 씁니다(`-c user.email=…` 로 바꾸지 않기).
5. **의존성 추가 금지** — `package.json` · lockfile 을 바꾸지 않습니다. 필요하면 보고에 적습니다.
6. **오리지널** — 다른 게임 이름 · 캐릭터 · 그림 · 음악을 쓰지 않습니다.
7. **문구** — 게임 안 UI 는 토스식 해요체(짧게 · 긍정). 문구 원안은 `docs/upgrade/marketing.md` 「게임 안 문구」 표, 없으면 기획 보고서의 「UI 문구 예」.
8. **축소 모션 · 접근성** — 새 연출은 `prefers-reduced-motion` 이면 끄거나 줄입니다. 새 버튼은 키보드로 닿고 이름이 있어야 합니다.
9. **그림** — 촬영본은 1280px 이하. 자기 확인용 촬영은 `docs/upgrade/r1/<역할>/` 에.

## 파일 주인

| 파일 | 주인 |
|---|---|
| `src/game/engine.js` · `src/game/rules.js` · `src/hooks/useGame.js` · `src/audio/audio.js` · 새 `src/records.js` · `src/components/ResultOverlay.jsx` · `src/components/HudBar.jsx` · 새 일시정지 · 카운트다운 컴포넌트 | 엔진 |
| `src/game/renderer.js` · `src/screens/*.jsx` · `src/App.jsx` · `src/styles.css` · `index.html` · `public/`(sfx 제외) · `README.md` · `README.en.md` · `docs/*.md`(upgrade 제외) · `src/game/maps.js`(설명 문구만) · `src/game/characters.js`(설명 문구만) | 화면 |
| `src/screens/GameScreen.jsx` | **둘 다 필요** — 엔진은 일시정지 · 카운트다운 오버레이를 끼우는 줄만, 화면은 휴대폰 안내 · 비율 · 스크롤만. 리드가 합칠 때 맞춥니다 |
| `docs/upgrade/marketing/final/` | 마케팅 |

## 끝나면

최종 응답에: 가지 이름 · 커밋 목록 · 수용 기준별 통과 여부(시험 이름 또는 촬영 경로) · 상대 담당에게 부탁 · 못 한 것.
