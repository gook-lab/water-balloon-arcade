import { describe, it, expect } from 'vitest';
import { NX, NY, key } from '../src/game/constants.js';
import { MAPS, layoutHard, buildMap } from '../src/game/maps.js';

describe('MAPS', () => {
  it('8종(7 테마 + 랜덤), id 중복 없음, 랜덤이 마지막', () => {
    expect(MAPS).toHaveLength(8);
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(8);
    expect(MAPS[MAPS.length - 1].layout).toBe('random');
  });

  it('각 테마는 바닥 2색 + 하드 3색 + 소프트 3색 팔레트를 가진다', () => {
    MAPS.forEach((m) => {
      expect(m.g1).toMatch(/^#/);
      expect(m.g2).toMatch(/^#/);
      expect(m.hard).toHaveLength(3);
      expect(m.soft).toHaveLength(3);
    });
  });
});

describe('layoutHard', () => {
  it('classic: 홀수 격자만 하드', () => {
    expect(layoutHard('classic', 1, 1)).toBe(true);
    expect(layoutHard('classic', 0, 0)).toBe(false);
    expect(layoutHard('classic', 2, 1)).toBe(false);
  });
});

describe('buildMap', () => {
  const themes = MAPS.filter((m) => m.layout !== 'random');

  it('스폰 코너 4곳은 각 3칸(8오프셋)이 비워진다', () => {
    for (const theme of themes) {
      const { grid } = buildMap(theme);
      const offsets = [[0, 0], [1, 0], [0, 1], [2, 0], [0, 2], [1, 1], [2, 1], [1, 2]];
      [[0, 0], [NX - 1, 0], [0, NY - 1], [NX - 1, NY - 1]].forEach(([cx, cy]) => {
        offsets.forEach(([dx, dy]) => {
          const x = cx === 0 ? cx + dx : cx - dx, y = cy === 0 ? cy + dy : cy - dy;
          expect(grid[y][x], `${theme.id} corner (${x},${y})`).toBe('empty');
        });
      });
    }
  });

  it('도달 불가능한 구역이 없다 (상자는 부술 수 있으므로 통과 가능으로 취급)', () => {
    for (const theme of themes) {
      for (let run = 0; run < 15; run++) {
        const { grid } = buildMap(theme);
        const seen = new Set([key(0, 0)]);
        const q = [[0, 0]];
        let h = 0;
        while (h < q.length) {
          const [x, y] = q[h++];
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy, nk = key(nx, ny);
            if (nx < 0 || ny < 0 || nx >= NX || ny >= NY || seen.has(nk) || grid[ny][nx] === 'hard') return;
            seen.add(nk);
            q.push([nx, ny]);
          });
        }
        for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
          if (grid[y][x] !== 'hard') {
            expect(seen.has(key(x, y)), `${theme.id} run ${run} (${x},${y}) unreachable`).toBe(true);
          }
        }
      }
    }
  });

  it('타일 종류는 empty/soft/tough/hard 뿐', () => {
    for (const theme of themes) {
      const { grid } = buildMap(theme);
      grid.flat().forEach((c) => expect(['empty', 'soft', 'tough', 'hard']).toContain(c));
    }
  });
});
