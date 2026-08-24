import { describe, it, expect } from 'vitest';
import { ITEM_ICONS } from '../src/game/sprites.js';
import { ITEM_DEFS, ITEM_POOL } from '../src/game/constants.js';

const LEGAL = new Set(['.', 'o', 'x', 'w', 'a']);

describe('아이템 픽토그램 무결성 (v5)', () => {
  it('풀의 모든 아이템 타입에 아이콘·정의가 있다', () => {
    const types = [...new Set(ITEM_POOL)];
    expect(types.length).toBe(7);
    types.forEach((t) => {
      expect(ITEM_DEFS[t], t).toBeTruthy();
      expect(ITEM_ICONS[t], t).toBeTruthy();
    });
  });

  it('아이콘은 12×12, 팔레트 키만 사용, pal 색 지정 완비', () => {
    Object.entries(ITEM_ICONS).forEach(([t, icon]) => {
      expect(icon.rows, t).toHaveLength(12);
      icon.rows.forEach((row, i) => {
        expect(row.length, `${t} row ${i}`).toBe(12);
        [...row].forEach((c) => expect(LEGAL.has(c), `${t} row ${i} '${c}'`).toBe(true));
      });
      expect(icon.pal.x).toMatch(/^#/);
      expect(icon.pal.a).toMatch(/^#/);
    });
  });

  it('나쁜 아이템은 거북이뿐', () => {
    const bad = Object.entries(ITEM_DEFS).filter(([, d]) => d.bad).map(([k]) => k);
    expect(bad).toEqual(['turtle']);
  });
});
