import { describe, it, expect } from 'vitest';
import {
  TIP_KEY, shouldShowFirstTip, markFirstTipSeen, radioKeyIndex, isTouchFirst, koCount, formatMatchLength
} from '../src/screens/screenUtils.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const blocked = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); }
};

describe('첫 판 말풍선 — 한 번만', () => {
  it('처음엔 보이고, 본 뒤에는 다시 안 보인다', () => {
    const st = memStorage();
    expect(shouldShowFirstTip(st)).toBe(true);
    markFirstTipSeen(st);
    expect(st.getItem(TIP_KEY)).toBe('1');
    expect(shouldShowFirstTip(st)).toBe(false);
  });

  it('저장소가 막혀도 오류 없이 보여 준다', () => {
    expect(shouldShowFirstTip(blocked)).toBe(true);
    expect(() => markFirstTipSeen(blocked)).not.toThrow();
    expect(shouldShowFirstTip(null)).toBe(true);
  });

  it('엔진 판 기록 키(wba-records)와 다른 자기 키를 쓴다', () => {
    expect(TIP_KEY).toBe('wba-seen-tip');
  });
});

describe('radioKeyIndex — 카드 라디오 그룹 화살표 이동', () => {
  it('좌 · 위는 이전, 우 · 아래는 다음, 끝에서 돌아간다', () => {
    expect(radioKeyIndex('ArrowRight', 0, 6)).toBe(1);
    expect(radioKeyIndex('ArrowDown', 5, 6)).toBe(0);
    expect(radioKeyIndex('ArrowLeft', 0, 6)).toBe(5);
    expect(radioKeyIndex('ArrowUp', 3, 6)).toBe(2);
  });
  it('Home · End', () => {
    expect(radioKeyIndex('Home', 4, 8)).toBe(0);
    expect(radioKeyIndex('End', 1, 8)).toBe(7);
  });
  it('다른 키는 null', () => {
    expect(radioKeyIndex('Enter', 2, 6)).toBe(null);
    expect(radioKeyIndex('a', 2, 6)).toBe(null);
    expect(radioKeyIndex('ArrowRight', 0, 0)).toBe(null);
  });
});

describe('isTouchFirst — 휴대폰 안내 조건', () => {
  const win = (q) => ({ matchMedia: (s) => ({ matches: !!q[s] }) });
  it('굵은 포인터만 있으면 true', () => {
    expect(isTouchFirst(win({ '(pointer: coarse)': true }))).toBe(true);
  });
  it('마우스(가는 포인터)가 하나라도 있으면 false', () => {
    expect(isTouchFirst(win({ '(pointer: coarse)': true, '(any-pointer: fine)': true }))).toBe(false);
    expect(isTouchFirst(win({ '(any-pointer: fine)': true }))).toBe(false);
  });
  it('matchMedia 가 없으면 false', () => {
    expect(isTouchFirst({})).toBe(false);
    expect(isTouchFirst(undefined)).toBe(false);
  });
});

describe('타이틀 숫자 문구', () => {
  it('koCount: 1~10 은 고유어, 그 밖은 숫자', () => {
    expect(koCount(6)).toBe('여섯');
    expect(koCount(7)).toBe('일곱');
    expect(koCount(3)).toBe('셋');
    expect(koCount(12)).toBe('12');
  });
  it('formatMatchLength', () => {
    expect(formatMatchLength(180)).toBe('3분');
    expect(formatMatchLength(90)).toBe('1분 30초');
    expect(formatMatchLength(4)).toBe('4초');
  });
});
