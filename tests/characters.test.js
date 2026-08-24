import { describe, it, expect } from 'vitest';
import { BODY, CHARS } from '../src/game/characters.js';

const LEGAL = new Set(['.', 'o', 'b', 'd', 'w', 'e', 'a']);

describe('캐릭터 도트맵 무결성', () => {
  it('BODY는 16×16, 팔레트 키만 사용', () => {
    expect(BODY).toHaveLength(16);
    BODY.forEach((row, i) => {
      expect(row.length, `BODY row ${i}`).toBe(16);
      [...row].forEach((c) => expect(LEGAL.has(c), `BODY row ${i} char '${c}'`).toBe(true));
    });
  });

  it('CHARS 6종, id 유일, over 행도 16칸·팔레트 키만', () => {
    expect(CHARS).toHaveLength(6);
    expect(new Set(CHARS.map((c) => c.id)).size).toBe(6);
    CHARS.forEach((ch) => {
      Object.entries(ch.over).forEach(([k, row]) => {
        expect(+k).toBeGreaterThanOrEqual(0);
        expect(+k).toBeLessThan(16);
        expect(row.length, `${ch.id} over[${k}]`).toBe(16);
        [...row].forEach((c) => expect(LEGAL.has(c), `${ch.id} over[${k}] '${c}'`).toBe(true));
      });
    });
  });

  it('시작 스탯은 원본 그대로 (비주얼 리워크에서 불변)', () => {
    const stats = Object.fromEntries(CHARS.map((c) => [c.id, c.base]));
    expect(stats.coco).toEqual({ maxBalloons: 1, power: 1, speed: 3, pins: 0 });
    expect(stats.mungchi).toEqual({ maxBalloons: 1, power: 2, speed: 3, pins: 0 });
    expect(stats.ppyong).toEqual({ maxBalloons: 1, power: 1, speed: 5, pins: 0 });
    expect(stats.tori).toEqual({ maxBalloons: 2, power: 1, speed: 3, pins: 0 });
    expect(stats.penggu).toEqual({ maxBalloons: 2, power: 2, speed: 2, pins: 0 });
    expect(stats.robo).toEqual({ maxBalloons: 1, power: 1, speed: 4, pins: 1 });
  });
});
