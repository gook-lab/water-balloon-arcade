# 화면 담당에게 — 엔진 담당 결과 넘김 (리드, 2026-11-26)

엔진 담당이 끝났습니다(가지 `upgrade/r1-engine`). 화면 담당이 이어서 할 것만 적습니다. 엔진 가지를 지금 합칠 필요는 없습니다 — 리드가 둘을 합칠 때 연결합니다. 다만 아래 이름에 맞춰 두면 합칠 때 바로 붙습니다.

1. **dev 서버가 파일 변경을 못 보던 문제** — 리드 설정 탓이었습니다(`vite.config.js` 의 `.worktrees` 글롭이 작업 트리 자기 경로까지 걸렀음). `upgrade/r1` 에 고친 커밋 `22e8eae` 가 있습니다. `git merge --ff-only` 는 안 되니 `git cherry-pick 22e8eae` 로 가져가거나, 서버를 다시 띄워 확인하세요.
2. **타이틀 기록 한 줄** — `src/records.js` 가 내보냅니다: `summaryLine(loadRecords(), settings.botSkill)` → 문자열 또는 `null`(그 난이도 판이 없으면). 예: `'보통에서 3승 · 최장 1:42'`, `'어려움에서 5판 · 최장 0:48'`. 엔진 가지에만 있으니, 타이틀에서는 이 함수 이름 그대로 import 하는 줄을 넣어 두고(지금 가지에선 파일이 없어 빌드가 깨지면 `summaryLine` 을 받는 prop 자리만 만들어 두기) 최종 보고에 적어 주세요.
3. **`App.jsx` 에 `onExit`** — 엔진 쪽 `GameScreen` 이 새 prop `onExit` 을 받습니다(일시정지 「나갈래요」). `<GameScreen … onExit={() => setScreen('title')} />` 처럼 타이틀로 보내 주세요(지금 화면 이름 규칙에 맞게).
4. **결과 · 일시정지 · 카운트다운 화면 CSS** — 엔진 담당이 단 클래스: `.result-overlay` · `.result-stats` · `.result-actions` · `.result-share` · `.pause-overlay` · `.countdown-overlay` · `.hud-pause`. 좁은 화면(844×390 · 390×844)에서 버튼 글자 한 줄 · 넘침 0 이 되게 `styles.css` 에서 다듬어 주세요(QA S3).
5. **화면 아래 「타일 128px · 15 × 13」 줄** — GameScreen 화면 쪽 몫입니다. 휴대폰 · 좁은 화면에서 필요 없으면 숨겨도 됩니다.
6. **문서 계약 문장** — `docs/ARCHITECTURE.md` · `docs/GAME-DESIGN.md` 의 「탭이 숨어도 판이 계속」을 아래로 바꿔 주세요:
   > 탭이 숨으면(`visibilitychange`) 엔진이 판을 자동으로 일시정지합니다. 다시 보여도 저절로 이어지지 않고, 사람이 「계속할게요」나 Esc · P 를 눌러야 이어집니다. 일시정지와 시작 카운트다운 동안 흐른 시간만큼 도화선 · 물줄기 · 갇힘 · 거북이 · 봇 판단 · 판 시계 기준 시각을 모두 미루므로, 멈춘 시간은 판에 들어가지 않습니다. 창을 떠나면(`blur`) 눌린 키를 모두 풉니다. 탭이 숨으면 소리(AudioContext)도 쉽니다.
7. **README 의 소리 설명** — 효과음은 이제 `public/sfx/*.mp3`(ElevenLabs 생성, 불러오기 전엔 합성음 대체), 배경음은 코드 합성 칩튠입니다. 마케팅 `copy.md` 문안이 이미 이 범위로 고쳐져 있습니다.
