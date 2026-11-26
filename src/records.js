// 판 기록 — 이 브라우저의 localStorage 에만 남는다(서버로 보내지 않음).
// 난이도별로 판 수 · 승수 · 연승 · 최장 생존 · 최다 가둠을 모은다.
// localStorage 가 막혀도(프라이빗 모드 · 사이트 데이터 차단) 예외를 밖으로 내지 않는다 — 게임은 그대로 돈다.
export const RECORDS_KEY = 'wba-records';
const VERSION = 1;

export function emptyRecord() {
  return { played: 0, wins: 0, streak: 0, bestStreak: 0, longestMs: 0, mostTrapped: 0 };
}

export function emptyRecords() {
  return { version: VERSION, levels: {} };
}

function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // 사이트 데이터 차단 시 localStorage 접근 자체가 SecurityError
  }
}

const num = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

function cleanRecord(r) {
  const out = emptyRecord();
  if (r && typeof r === 'object') Object.keys(out).forEach((k) => { out[k] = num(r[k]); });
  return out;
}

/** 저장된 기록을 읽는다. 없거나 깨졌거나 읽을 수 없으면 빈 기록. */
export function loadRecords(storage = defaultStorage()) {
  try {
    const raw = storage && storage.getItem(RECORDS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object' || !data.levels || typeof data.levels !== 'object') return emptyRecords();
    const levels = {};
    Object.entries(data.levels).forEach(([lv, r]) => { levels[lv] = cleanRecord(r); });
    return { version: VERSION, levels };
  } catch {
    return emptyRecords();
  }
}

/** 기록을 쓴다. 성공하면 true, 막혀 있으면 false(예외 없음). */
export function saveRecords(records, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

export function recordFor(records, difficulty) {
  return cleanRecord(records && records.levels ? records.levels[difficulty] : null);
}

/**
 * 한 판 결과를 기록에 더한 새 기록을 돌려준다(입력은 바꾸지 않음).
 * outcome: { result: 'win'|'lose'|'draw', survivalMs, trapped }
 * newBest: 이전 최고를 넘긴 항목만 true. 그 난이도의 첫 판은 비교할 기록이 없어 모두 false.
 */
export function applyResult(records, difficulty, outcome) {
  const prev = recordFor(records, difficulty);
  const win = outcome.result === 'win';
  const survivalMs = num(outcome.survivalMs);
  const trapped = num(outcome.trapped);
  const streak = win ? prev.streak + 1 : 0;
  const next = {
    played: prev.played + 1,
    wins: prev.wins + (win ? 1 : 0),
    streak,
    bestStreak: Math.max(prev.bestStreak, streak),
    longestMs: Math.max(prev.longestMs, survivalMs),
    mostTrapped: Math.max(prev.mostTrapped, trapped)
  };
  const compared = prev.played > 0;
  const newBest = {
    survival: compared && survivalMs > prev.longestMs,
    trapped: compared && trapped > prev.mostTrapped,
    streak: compared && streak > prev.bestStreak
  };
  const base = records && records.levels ? records : emptyRecords();
  return {
    records: { version: VERSION, levels: { ...base.levels, [difficulty]: next } },
    record: next,
    previous: prev,
    newBest
  };
}

/** 읽기 → 더하기 → 쓰기를 한 번에. 저장이 막혀도 이번 판 결과(newBest 등)는 돌려준다. */
export function recordResult(difficulty, outcome, storage = defaultStorage()) {
  const applied = applyResult(loadRecords(storage), difficulty, outcome);
  return { ...applied, saved: saveRecords(applied.records, storage) };
}

/** 1:42 — 타이틀 요약용 짧은 시계 표기 */
export function formatClock(ms) {
  const s = Math.floor(num(ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 1분 42초 · 42초 — 결과 화면 · 공유 문장용 */
export function formatDuration(ms) {
  const s = Math.floor(num(ms) / 1000);
  const m = Math.floor(s / 60), r = s % 60;
  if (!m) return `${r}초`;
  return r ? `${m}분 ${r}초` : `${m}분`;
}

/**
 * 타이틀 한 줄 요약. 그 난이도로 한 판도 안 했으면 null.
 * 예: '보통에서 3승 · 최장 1:42' · '보통에서 2승 · 최장 1:42 · 2연승 중' · '어려움에서 5판 · 최장 0:48'
 */
export function summaryLine(records, difficulty) {
  const r = recordFor(records, difficulty);
  if (!r.played) return null;
  const parts = [`${difficulty}에서 ${r.wins ? `${r.wins}승` : `${r.played}판`}`, `최장 ${formatClock(r.longestMs)}`];
  if (r.streak >= 2) parts.push(`${r.streak}연승 중`);
  return parts.join(' · ');
}

/** 공유 링크 — 지금 페이지 주소에 ?from=share 만 붙인다(설정 · 기록은 넣지 않음). */
export function shareUrl(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return '';
  return `${loc.origin}${loc.pathname}?from=share`;
}

/**
 * 「결과 복사」 문장. 예: '물풍선 대작전 · 보통 · 1분 42초 버텼어요 · 2명 가뒀어요'
 * 이긴 판은 '이겼어요!' 를 붙이고, 가둔 상대가 없으면 그 조각을 뺀다. url 이 있으면 다음 줄에 붙인다.
 */
export function shareText({ difficulty, result, survivalMs, trapped }, url = '') {
  const parts = ['물풍선 대작전'];
  if (difficulty) parts.push(difficulty);
  parts.push(`${formatDuration(survivalMs)} 버텼어요`);
  if (num(trapped) > 0) parts.push(`${num(trapped)}명 가뒀어요`);
  if (result === 'win') parts.push('이겼어요!');
  const line = parts.join(' · ');
  return url ? `${line}\n${url}` : line;
}
