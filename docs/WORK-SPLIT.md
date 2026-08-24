# 멀티세션 분업 현황

> 최종 갱신: 2026-08-24 18:51 — **안정 상태**. toy-37 측 추가 변경 예정 없음.
> 잔여는 사용자 몫 1건(win 오버레이 육안 확인)과 배포/git 결정뿐.

## 세션 분담

| 세션 | 터미널 | 담당 |
|---|---|---|
| toy-37 | `term_eec6d7a4-f50e-4d47-a4b5-7fdffdf7e739` | **구현**: 프로토타입 → React+Vite 이식, `src/` 전체, 빌드 |
| toy-c7 (이 세션) | — | **문서/모니터링**: `README.md`, `docs/*`, 진행 상황 추적 |

충돌 방지 규칙: toy-c7은 `src/` 를 수정하지 않는다. toy-37은 `docs/` 와 루트 `README.md` 를
수정하지 않는다 (필요하면 SendMessage로 요청).

## 진행 상황

### 완료

- [x] 프로젝트 스캐폴딩 (Vite 5 + React 18, `package.json`, `vite.config.js`)
- [x] `src/` 전체 파일 트리 생성 — PROMPT.md 목표 트리 그대로 + `game/rules.js` 추가
- [x] 프로덕션 빌드 성공 — 178.8KB (gzip 58.4KB)
- [x] 타이틀/선택 화면 CSS (pick-card, info-card 등)
- [x] TitleScreen 설정 UI: 타일 64/128/256, 난이도 쉬움/보통/어려움 (App이 settings state 소유)
- [x] **이식 완료 + QA 통과** (toy-37, headless 브라우저 검증)
  - 전 화면 흐름: title → select → map → game → 결과(패배) → 다시 하기 재시작. 콘솔 에러 0.
  - 게임플레이: 이동, 풍선 설치, 폭발/물줄기, 갇힘(버블+타이머 링), 탈락, 봇 AI(설치·사망), 아이템 드랍, 타이머/남은상대 HUD 갱신
  - 타일 64px 모드: 캔버스 960×832, 픽셀 선명
- [x] 타일 픽셀 무결성 3종 모두 검증: 64(960×832) / 128 / 256(3840×3328) — 정수배 + `image-rendering: pixelated`, 콘솔 에러 0
- [x] 무승부(draw) 경로 검증: `?t=8` 8초 매치로 "무승부 / 시간 초과" 오버레이 + 0:00 표기 확인
- [x] QA용 URL 파라미터 추가: `?t=초`(제한시간), `?bots=1..3` — `App.jsx`의 `initialSettings()`
- [x] 문서 초판: README / ARCHITECTURE / GAME-DESIGN / WORK-SPLIT — toy-c7

- [x] 수치·스프라이트 프로토타입 대조 — 상수·도트맵·수식은 프로토타입에서 **문자 그대로 복사**
      이식 (constants/characters/sprites/maps는 원본 블록 그대로, rules/engine/ai/renderer는
      `this.game` → `game` 치환 수준). 재발명한 수치 없음. 의도적 차이는 4건뿐이며 전부 문서화됨:
      ①rules.js 분리 ②HUD 스냅샷 diff ③TitleScreen 설정 UI ④`?t`/`?bots` 파라미터

- [x] **스프라이트 디테일 업그레이드 v2** (2026-08-24 사용자 지시, toy-37 완료) —
      캐릭터 EPX 업스케일 32×32+셰이딩, 블록 32px 프로시저럴(테마별 디테일), 풍선/물줄기/아이템
      32px 재작업, 물줄기 2프레임 애니메이션. 상세는 ARCHITECTURE.md "스프라이트 파이프라인 v2" 참조.
      검증: 빌드 183KB(gzip 60KB), 콘솔 에러·경고 0, 타일 64/128 스모크 + 스크린샷 육안 확인
      (256은 소스 해상도 무관 경로라 기존 검증 유효)

- [x] **Vitest 테스트 도입** (toy-37) — `npm test`, tests/ 4개 파일 + helpers.js, **35 테스트 전부 통과**.
      maps(스폰·연결성·팔레트) / rules(blastTiles·solidFor·tryPlace·moveEnt·파티클 상한) /
      ai(dangerSet·bfs·자살 방지) / engine(renderer mock — pickUp 상한·burst·usePin·승패 3경로·HUD diff).
      상세는 ARCHITECTURE.md "테스트" 절 참조

- [x] **픽셀 리워크 v3** (사용자 피드백, toy-37 완료) — 캐릭터 도트맵 봄버맨풍 전면 재작성(스탯 불변),
      블록 파괴가능/불가 가독성 개선(하드=다크 스틸+볼트, 상자=우드 틴트), UI 전면 픽셀화(Neo둥근모
      로컬 번들, 하드 섀도, 스캔라인). 테스트 +3(characters.test.js, 총 38 통과), 빌드 183.7KB/gzip 60.5KB

- [x] **게임플레이 개선 v4** (사용자 피드백, toy-37 완료) — ①봇 AI 생존성: 자멸 원인 3개
      봉합(danger 필터 경로, 위험 경유 탈출로 시 설치 포기, 스테일 경로 즉시 재계획)
      ②봄버맨식 레인 이동 어시스트 ③맵 밀도 +0.10~0.12, 신규 테마 2종(던전 지하실·고대 유적,
      총 7종+랜덤), dragon-game PixelLab 바닥 타일 재사용. 테스트 43개 통과, 빌드 185KB/gzip 61KB

- [x] **아이템 가시성 v5** (사용자 피드백, toy-37 완료 · toy-c7 재검증 46/46) — 디스크+글리프
      폐기 → 봄버맨식 32px 사각 패널 + 아이템별 12×12 픽토그램 7종, 2프레임 블링크, 드랍 팝
      파티클. crypt 자갈(최악 대비)에서 가시성 검증. 테스트 46개, 빌드 186KB/gzip 61.4KB.
- [x] **toy-c7 헤드리스 QA (v5 시점)** — 던전 지하실 라운드 실플레이: 타이틀→선택→게임 흐름,
      하드블록/상자 가독성, 물줄기 애니메이션, 봇 교전, 패배 오버레이+재시작, 인게임 아이템
      드랍(스피드 부츠) 가시성, 아이템 도트 7종 렌더 검증. 콘솔 에러 0

- [x] **v6 사운드** (toy-37 완료 · toy-c7 재검증 50/50) — git init(`6a1f4ba` 베이스라인 →
      `85f984c` 사운드). Web Audio 신디사이즈 SFX 13종(연쇄폭발 스로틀 포함) + 칩튠 BGM
      2트랙(타이틀 96bpm/인게임 138bpm, 스텝 시퀀서). 타이틀에 켬/끔+볼륨 3단(localStorage).
      autoplay 정책: 첫 입력에서 AudioContext 언락. 엔진은 `onSound(name)` 콜백만 방출
      (오디오 import 없음, 봇 아이템은 무음). 빌드 192KB/gzip 63.4KB.
      **실제 소리는 사용자 실기기 확인 필요**

- [x] **v7** (toy-37 완료 · toy-c7 재검증 54/54, 커밋 d984a33) — ①바늘(X)·WASD가 한글 IME
      모드에서 무시되던 버그: `e.code` 물리 키 우선 정규화로 수정 ②클래식 "갇힌 상대 터치
      팝" 규칙 신규(T*0.6 접촉 즉시 탈락) + 봇 AI에 갇힌 상대 사냥 우선순위. 빌드 192KB

### 미착수 / 확인 필요 (사용자 몫)

- [ ] 승리(win) 경로 수동 플레이 확인 — 로직은 engine.test.js 승패 판정 테스트로 커버됨.
      실제 플레이 화면(승리 오버레이) 육안 확인만 남음 (`?bots=1` 추천)
- [ ] git 저장소 초기화 여부 결정 (현재 미초기화)
- [ ] 배포 여부 결정 (다른 토이들처럼 Vercel 후보)

## 관련 세션 참고

별도 Orca 터미널의 세 번째 세션이 **roomcast** (3D 인테리어 플래너, `toy/roomcast`)를 전담.
water-balloon-arcade와는 무관. 2026-08-24 밤 기준 피드백 3건(가구 22종·슬라이딩 충돌·undo/redo)
완료, 테스트 51개, git 4커밋 — toy-37 독립 검증 통과. 상세는 `roomcast/docs/STATUS.md`.

## 갱신 로그

| 시각 | 세션 | 내용 |
|---|---|---|
| 2026-08-24 16:40 | toy-c7 | 문서 초판 작성 (README, ARCHITECTURE, GAME-DESIGN, WORK-SPLIT). toy-37에 분업 조율 메시지 발신 |
| 2026-08-24 17:0x | toy-c7 | toy-37 마일스톤 반영: 이식 완료+QA 통과, rules.js 추가, HUD 스냅샷 diff, TitleScreen 설정 UI. ARCHITECTURE.md 갱신 |
| 2026-08-24 17:xx | toy-c7 | 잔여 QA 반영: 타일 3종 무결성·무승부 경로 검증 완료, QA용 URL 파라미터(`?t`/`?bots`) 문서화. win 경로는 수동 확인 권장으로 남김 |
| 2026-08-24 17:xx | toy-c7 | 수치 대조 종결: 문자 그대로 복사 이식 확인(의도적 차이 4건만, 전부 문서화). 잔여는 win 경로 수동 확인(사용자 몫) 1건 |
| 2026-08-24 17:xx | toy-c7 | 사용자 지시로 스프라이트 디테일 업그레이드 착수 결정. GAME-DESIGN.md에 "비주얼은 변경 금지 예외" 방침 기록, toy-37에 작업 브리프 발신 |
| 2026-08-24 | toy-c7 | 스프라이트 v2 완료 반영: EPX 32×32 캐릭터, 프로시저럴 블록, 물줄기 2프레임 애니메이션, `CHAR_SPRITE_SIZE` export, `waterSprite(stage, frame)` 시그니처 변경, GLYPHS 내부화. ARCHITECTURE.md 갱신 |
| 2026-08-24 | toy-c7 | Vitest 도입 반영: 35 테스트 통과, ARCHITECTURE.md 테스트 절 신설, README에 `npm test` 추가. win 경로는 로직 테스트로 커버 — 육안 확인만 잔여. (toy-37이 roomcast 세션에도 동일 취지 지시 전달) |
| 2026-08-24 18:51 | toy-c7 | toy-37 작업 종료 선언 반영 — 물풍선 안정 상태, 추가 변경 예정 없음. roomcast 완료 시 종합 QA 결과 공유 예정 |
| 2026-08-24 | toy-c7 | 픽셀 리워크 v3 반영: 캐릭터 도트맵 재작성·블록 가독성·UI 픽셀화(Neo둥근모 로컬 번들), 테스트 38개. ARCHITECTURE v3 절·GAME-DESIGN 블록 가독성 규칙 신설. roomcast에는 피드백 3건+git init 지시 전달됨(toy-37 경유) |
| 2026-08-24 | toy-c7 | v4 반영: AI 생존성·레인 이동·맵 7종+밀도·PixelLab 바닥 타일. GAME-DESIGN "변경 금지" 원칙을 "코어 수치 불변 + 진화 영역 명시" 체계로 개정, 테스트 43·빌드 185KB 갱신. v5(아이템 가시성) 브리프 발신 |
| 2026-08-24 | toy-c7 | v5 반영: 봄버맨식 아이템 패널+픽토그램 7종+블링크+드랍 팝. ARCHITECTURE v5 절, items.test.js 행, 테스트 46·빌드 186KB. toy-c7 독립 재검증 46/46 통과. 사용자 실기기 확인 대기 |
