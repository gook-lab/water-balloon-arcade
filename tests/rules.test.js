import { describe, it, expect } from 'vitest';
import { key } from '../src/game/constants.js';
import { tileOf, balloonAt, solidFor, blastTiles, tryPlace, moveEnt, spawnParts } from '../src/game/rules.js';
import { makeGame, makeEnt } from './helpers.js';

describe('blastTiles', () => {
  it('하드에서 멈추고, 소프트는 포함 후 멈춘다', () => {
    const g = makeGame({
      rows: [
        '...............',
        '...............',
        '.....H.........',
        '...............',
        '..S............'
      ]
    });
    // (2,2) power 3: 우측은 (3,2),(4,2)까지(5,2 하드 직전), 하측은 (2,3),(2,4 소프트 포함) 후 정지
    const out = blastTiles(g, { tx: 2, ty: 2, power: 3 });
    expect(out).toContain(key(2, 2));
    expect(out).toContain(key(4, 2));
    expect(out).not.toContain(key(5, 2));
    expect(out).toContain(key(2, 4));
    expect(out).not.toContain(key(2, 5));
    expect(out).toContain(key(0, 2)); // 좌측 power 3 중 경계 내
    expect(out).toContain(key(2, 0));
  });

  it('맵 경계를 넘지 않는다', () => {
    const g = makeGame({});
    const out = blastTiles(g, { tx: 0, ty: 0, power: 8 });
    out.forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('solidFor', () => {
  it('경계 밖·하드는 항상 막힘, 상자는 passBlock 없으면 막힘', () => {
    const g = makeGame({ rows: ['.SH............'] });
    const e = makeEnt(g, 0, 0);
    expect(solidFor(g, e, -1, 0)).toBe(true);
    expect(solidFor(g, e, 2, 0)).toBe(true);   // hard
    expect(solidFor(g, e, 1, 0)).toBe(true);   // soft
    e.passBlock = true;
    expect(solidFor(g, e, 1, 0)).toBe(false);
    expect(solidFor(g, e, 2, 0)).toBe(true);   // hard 는 통과 불가
  });

  it('풍선 타일은 ignore 집합에 있으면 통과', () => {
    const g = makeGame({});
    const e = makeEnt(g, 0, 0);
    g.balloons.push({ tx: 1, ty: 0, owner: 9, at: performance.now(), power: 1 });
    expect(solidFor(g, e, 1, 0)).toBe(true);
    e.ignore.add(key(1, 0));
    expect(solidFor(g, e, 1, 0)).toBe(false);
  });
});

describe('tryPlace', () => {
  it('현재 타일에 설치, 같은 타일 중복·동시 설치 상한 준수', () => {
    const g = makeGame({});
    const e = makeEnt(g, 3, 3);
    g.ents.push(e);
    tryPlace(g, e);
    expect(g.balloons).toHaveLength(1);
    expect(g.balloons[0]).toMatchObject({ tx: 3, ty: 3, owner: 0, power: 1 });
    expect(e.ignore.has(key(3, 3))).toBe(true); // 밟고 선 자기 풍선은 통과 허용

    tryPlace(g, e); // 같은 타일 중복 금지
    expect(g.balloons).toHaveLength(1);

    e.x = g.T * 5.5; // 다른 타일로 이동해도 maxBalloons=1 이면 불가
    tryPlace(g, e);
    expect(g.balloons).toHaveLength(1);

    e.maxBalloons = 2;
    tryPlace(g, e);
    expect(g.balloons).toHaveLength(2);
  });

  it('죽은/갇힌 엔티티는 설치 불가', () => {
    const g = makeGame({});
    const e = makeEnt(g, 0, 0, { state: 'trapped' });
    g.ents.push(e);
    tryPlace(g, e);
    expect(g.balloons).toHaveLength(0);
  });
});

describe('moveEnt', () => {
  it('속도 공식: (2.3 + 0.42*(speed-1)) * tile px/s', () => {
    const g = makeGame({});
    const e = makeEnt(g, 5, 5); // speed 3
    const x0 = e.x;
    moveEnt(g, e, 1, 0, 0.1);
    expect(e.x - x0).toBeCloseTo((2.3 + 0.42 * 2) * g.T * 0.1, 5);
    expect(e.dir).toBe('right');
  });

  it('거북이 상태면 45% 속도', () => {
    const g = makeGame({});
    const e = makeEnt(g, 5, 5, { slowUntil: performance.now() + 5000 });
    const x0 = e.x;
    moveEnt(g, e, 1, 0, 0.1);
    expect(e.x - x0).toBeCloseTo((2.3 + 0.42 * 2) * g.T * 0.1 * 0.45, 5);
  });

  it('하드 블록에 막힌다 (엔진 dt 클램프 0.05 계약 하에서)', () => {
    // engine.step 은 dt 를 0.05 로 클램프한다 — 그 계약 안에서는 스윕 없이도 터널링이 없다
    const g = makeGame({ rows: ['.H.............'] });
    const e = makeEnt(g, 0, 0);
    for (let i = 0; i < 40; i++) moveEnt(g, e, 1, 0, 0.05);
    expect(tileOf(g, e)[0]).toBe(0);
    expect(e.x + e.r).toBeLessThanOrEqual(g.T); // 벽 앞에서 정지
  });

  it('레인 정렬: 가로 이동 시 세로가 타일 중앙으로 수렴한다', () => {
    const g = makeGame({});
    const e = makeEnt(g, 5, 5);
    e.y = 5 * g.T + g.T / 2 + 22; // 칸 안에서 아래로 치우친 상태
    for (let i = 0; i < 20; i++) moveEnt(g, e, 1, 0, 0.05);
    expect(e.y).toBeCloseTo(5 * g.T + g.T / 2, 5); // 행 중앙으로 스냅
    expect(e.x).toBeGreaterThan(5 * g.T + g.T / 2); // 진행은 계속
  });

  it('레인 정렬: 세로 이동 시 가로가 타일 중앙으로 수렴한다', () => {
    const g = makeGame({});
    const e = makeEnt(g, 5, 5);
    e.x = 5 * g.T + g.T / 2 - 17;
    for (let i = 0; i < 20; i++) moveEnt(g, e, 0, 1, 0.05);
    expect(e.x).toBeCloseTo(5 * g.T + g.T / 2, 5);
    expect(e.y).toBeGreaterThan(5 * g.T + g.T / 2);
  });

  it('풍선 타일을 벗어나면 ignore 가 해제된다', () => {
    const g = makeGame({});
    const e = makeEnt(g, 0, 0);
    g.ents.push(e);
    tryPlace(g, e);
    expect(e.ignore.size).toBe(1);
    for (let i = 0; i < 30; i++) moveEnt(g, e, 1, 0, 0.05);
    expect(e.ignore.size).toBe(0);
    expect(balloonAt(g, 0, 0)).toBeTruthy();
  });
});

describe('spawnParts', () => {
  it('파티클 상한 260 근처에서 추가를 멈춘다', () => {
    const g = makeGame({});
    for (let i = 0; i < 100; i++) spawnParts(g, 'splash', 0, 0, 10, '#fff');
    expect(g.parts.length).toBeLessThanOrEqual(271); // 260 초과 시 스폰 중단 (마지막 배치 +10 여유)
  });
});
