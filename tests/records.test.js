import { describe, it, expect } from 'vitest';
import {
  RECORDS_KEY, loadRecords, saveRecords, applyResult, recordResult, summaryLine,
  formatClock, formatDuration, shareText, shareUrl, emptyRecords
} from '../src/records.js';

function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    raw: m
  };
}
// 프라이빗 모드 · 사이트 데이터 차단 — 읽기 · 쓰기가 모두 예외
const blockedStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); }
};

describe('records — 저장 · 불러오기', () => {
  it('기록이 저장소에 남아 다시 읽힌다(새로 고침 뒤에도 유지)', () => {
    const st = memoryStorage();
    recordResult('보통', { result: 'win', survivalMs: 102000, trapped: 3 }, st);
    expect(JSON.parse(st.raw.get(RECORDS_KEY)).levels['보통'].wins).toBe(1);
    const again = loadRecords(st); // 새 페이지에서 다시 읽은 것과 같다
    expect(again.levels['보통']).toMatchObject({ played: 1, wins: 1, streak: 1, longestMs: 102000, mostTrapped: 3 });
  });

  it('localStorage 가 막혀도 예외 없이 이번 판 결과를 돌려준다', () => {
    expect(() => loadRecords(blockedStorage)).not.toThrow();
    expect(loadRecords(blockedStorage)).toEqual(emptyRecords());
    expect(saveRecords(emptyRecords(), blockedStorage)).toBe(false);
    let out;
    expect(() => { out = recordResult('보통', { result: 'lose', survivalMs: 5000, trapped: 0 }, blockedStorage); }).not.toThrow();
    expect(out.saved).toBe(false);
    expect(out.record.played).toBe(1);
  });

  it('저장소가 없거나(null) 깨진 JSON 이면 빈 기록', () => {
    expect(loadRecords(null)).toEqual(emptyRecords());
    expect(saveRecords(emptyRecords(), null)).toBe(false);
    expect(loadRecords(memoryStorage({ [RECORDS_KEY]: '{oops' }))).toEqual(emptyRecords());
    expect(loadRecords(memoryStorage({ [RECORDS_KEY]: '"text"' }))).toEqual(emptyRecords());
  });

  it('이상한 값은 0 으로 정리한다', () => {
    const st = memoryStorage({ [RECORDS_KEY]: JSON.stringify({ version: 1, levels: { '보통': { played: -2, wins: 'x', longestMs: 1500.7 } } }) });
    expect(loadRecords(st).levels['보통']).toEqual({ played: 0, wins: 0, streak: 0, bestStreak: 0, longestMs: 1500, mostTrapped: 0 });
  });
});

describe('records — 판 수 · 승수 · 연승 · 새 기록', () => {
  it('난이도별로 따로 센다', () => {
    let r = emptyRecords();
    r = applyResult(r, '보통', { result: 'win', survivalMs: 1000, trapped: 1 }).records;
    r = applyResult(r, '어려움', { result: 'lose', survivalMs: 2000, trapped: 0 }).records;
    expect(r.levels['보통']).toMatchObject({ played: 1, wins: 1 });
    expect(r.levels['어려움']).toMatchObject({ played: 1, wins: 0, longestMs: 2000 });
  });

  it('연승은 지거나 비기면 0 으로, 최고 연승은 남는다', () => {
    let r = emptyRecords();
    for (const result of ['win', 'win', 'draw', 'win']) r = applyResult(r, '보통', { result, survivalMs: 1000, trapped: 0 }).records;
    expect(r.levels['보통']).toMatchObject({ played: 4, wins: 3, streak: 1, bestStreak: 2 });
  });

  it('이전 최고를 넘긴 항목에만 새 기록 — 같거나 낮으면 아님', () => {
    let r = applyResult(emptyRecords(), '보통', { result: 'lose', survivalMs: 60000, trapped: 2 }).records;
    const a = applyResult(r, '보통', { result: 'lose', survivalMs: 61000, trapped: 2 });
    expect(a.newBest).toEqual({ survival: true, trapped: false, streak: false });
    r = a.records;
    const b = applyResult(r, '보통', { result: 'lose', survivalMs: 30000, trapped: 3 });
    expect(b.newBest).toEqual({ survival: false, trapped: true, streak: false });
    expect(b.record.longestMs).toBe(61000);
  });

  it('그 난이도의 첫 판은 비교할 기록이 없어 새 기록을 붙이지 않는다', () => {
    const a = applyResult(emptyRecords(), '보통', { result: 'win', survivalMs: 90000, trapped: 3 });
    expect(a.newBest).toEqual({ survival: false, trapped: false, streak: false });
  });

  it('입력 기록은 바꾸지 않는다', () => {
    const r = emptyRecords();
    applyResult(r, '보통', { result: 'win', survivalMs: 1, trapped: 1 });
    expect(r).toEqual(emptyRecords());
  });
});

describe('records — 문장', () => {
  it('summaryLine: 승이 있으면 승수, 없으면 판 수 · 최장 · 2연승 이상', () => {
    expect(summaryLine(emptyRecords(), '보통')).toBeNull();
    let r = emptyRecords();
    r = applyResult(r, '보통', { result: 'lose', survivalMs: 48000, trapped: 0 }).records;
    expect(summaryLine(r, '보통')).toBe('보통에서 1판 · 최장 0:48');
    for (let i = 0; i < 3; i++) r = applyResult(r, '보통', { result: 'win', survivalMs: 102000, trapped: 1 }).records;
    expect(summaryLine(r, '보통')).toBe('보통에서 3승 · 최장 1:42 · 3연승 중');
    expect(summaryLine(r, '어려움')).toBeNull();
  });

  it('시간 표기', () => {
    expect(formatClock(102000)).toBe('1:42');
    expect(formatClock(5000)).toBe('0:05');
    expect(formatDuration(102000)).toBe('1분 42초');
    expect(formatDuration(42000)).toBe('42초');
    expect(formatDuration(120000)).toBe('2분');
    expect(formatDuration(NaN)).toBe('0초');
  });

  it('shareText: 승 · 패 · 무 세 경우와 링크', () => {
    const url = 'https://example.test/?from=share';
    expect(shareText({ difficulty: '보통', result: 'lose', survivalMs: 102000, trapped: 2 }, url))
      .toBe('물풍선 대작전 · 보통 · 1분 42초 버텼어요 · 2명 가뒀어요\nhttps://example.test/?from=share');
    expect(shareText({ difficulty: '어려움', result: 'win', survivalMs: 95000, trapped: 3 }))
      .toBe('물풍선 대작전 · 어려움 · 1분 35초 버텼어요 · 3명 가뒀어요 · 이겼어요!');
    expect(shareText({ difficulty: '쉬움', result: 'draw', survivalMs: 180000, trapped: 0 }))
      .toBe('물풍선 대작전 · 쉬움 · 3분 버텼어요');
  });

  it('shareUrl 은 지금 주소에 ?from=share 만 붙인다', () => {
    expect(shareUrl({ origin: 'https://a.test', pathname: '/game/', search: '?t=10' })).toBe('https://a.test/game/?from=share');
    expect(shareUrl(null)).toBe('');
  });
});
