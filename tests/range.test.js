import { describe, it, expect } from 'vitest';
import { FUSE, key } from '../src/game/constants.js';
import { blastTiles } from '../src/game/rules.js';
import { rangeTiles, RANGE_WARN_MS } from '../src/game/renderer.js';
import { makeGame } from './helpers.js';

const keysOf = (tiles) => new Set(tiles.map((t) => key(t.x, t.y)));

describe('rangeTiles 물줄기 범위 표시', () => {
  it('풍선이 없으면 칠할 칸이 없다', () => {
    expect(rangeTiles(makeGame(), 0)).toEqual([]);
  });

  it('칠하는 칸 집합 = 풍선별 blastTiles 의 합집합 (벽 · 상자 · 판 끝에서 멈춤 포함)', () => {
    const rows = [
      '...............',
      '.H.H.H.H.H.H.H.',
      '..S............',
      '.H.H.H.H.H.H.H.',
      '...............',
      '.H.H.H.H.H.H.H.',
      '......T........',
      '.H.H.H.H.H.H.H.',
      '...............',
      '.H.H.H.H.H.H.H.',
      '...............',
      '.H.H.H.H.H.H.H.',
      '...............'
    ];
    const g = makeGame({ rows });
    g.balloons.push({ tx: 0, ty: 2, power: 3, at: 0, owner: 0 });
    g.balloons.push({ tx: 4, ty: 6, power: 4, at: 0, owner: 1 });
    g.balloons.push({ tx: 14, ty: 12, power: 8, at: 0, owner: 2 });
    const expected = new Set(g.balloons.flatMap((b) => blastTiles(g, b)));
    const got = rangeTiles(g, 100);
    expect(keysOf(got)).toEqual(expected);
    expect(got).toHaveLength(expected.size); // 겹친 칸은 한 번만
  });

  it(`터지기 ${RANGE_WARN_MS}ms 전부터 hot, 그 전에는 아님`, () => {
    const g = makeGame();
    g.balloons.push({ tx: 7, ty: 6, power: 1, at: 0, owner: 0 });
    expect(rangeTiles(g, FUSE - RANGE_WARN_MS - 1).every((t) => !t.hot)).toBe(true);
    expect(rangeTiles(g, FUSE - RANGE_WARN_MS).every((t) => t.hot)).toBe(true);
  });

  it('겹친 칸은 곧 터질 풍선 쪽(hot)을 따른다', () => {
    const g = makeGame();
    g.balloons.push({ tx: 6, ty: 6, power: 1, at: 1000, owner: 0 }); // 늦게 놓은 풍선
    g.balloons.push({ tx: 8, ty: 6, power: 1, at: 0, owner: 1 });    // 곧 터질 풍선
    const now = FUSE - 100;
    const byKey = new Map(rangeTiles(g, now).map((t) => [key(t.x, t.y), t.hot]));
    expect(byKey.get('7,6')).toBe(true);   // 두 풍선이 겹치는 칸
    expect(byKey.get('5,6')).toBe(false);  // 늦은 풍선만 닿는 칸
    expect(byKey.get('9,6')).toBe(true);
  });
});
