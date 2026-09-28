import { describe, it, expect, vi, afterEach } from 'vitest';
import { key } from '../src/game/constants.js';
import { dangerSet, bfs, think, driveBot, SKILL_PRESETS } from '../src/game/ai.js';
import { makeGame, makeEnt } from './helpers.js';

describe('dangerSet', () => {
  it('풍선 폭발 범위와 물줄기 타일을 포함한다', () => {
    const g = makeGame({});
    g.balloons.push({ tx: 2, ty: 2, owner: 0, at: performance.now(), power: 1 });
    g.water.set(key(9, 9), performance.now());
    const d = dangerSet(g);
    expect(d.has(key(2, 2))).toBe(true);
    expect(d.has(key(3, 2))).toBe(true);
    expect(d.has(key(9, 9))).toBe(true);
    expect(d.has(key(5, 5))).toBe(false);
  });
});

describe('bfs', () => {
  it('하드 블록을 우회하는 경로를 찾는다', () => {
    const g = makeGame({ rows: ['.H.............', '.H.............'] });
    const e = makeEnt(g, 0, 0);
    const p = bfs(g, e, 0, 0, (x, y) => x === 2 && y === 0, null);
    expect(p).toBeTruthy();
    expect(p[p.length - 1]).toEqual([2, 0]);
    // (1,0),(1,1) 하드라 아래로 돌아가야 함
    expect(p.length).toBeGreaterThan(2);
  });

  it('완전히 포위되면 null', () => {
    const g = makeGame({ rows: ['.H.............', 'HH.............'] });
    const e = makeEnt(g, 0, 0);
    const p = bfs(g, e, 0, 0, (x, y, k) => k !== key(0, 0), null);
    expect(p).toBeNull();
  });
});

describe('think', () => {
  it('위험 타일 위에 있으면 안전 타일로 탈출 경로를 잡는다', () => {
    const g = makeGame({});
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true });
    g.ents.push(player, bot);
    g.balloons.push({ tx: 0, ty: 1, owner: 9, at: performance.now(), power: 2 }); // (0,0) 위험
    think(g, bot, '보통');
    expect(bot.path.length).toBeGreaterThan(0);
    const d = dangerSet(g);
    const last = bot.path[bot.path.length - 1];
    expect(d.has(key(last[0], last[1]))).toBe(false);
  });

  it('갇힌 상대가 있으면 그쪽으로 사냥 경로를 잡는다', () => {
    const g = makeGame({});
    const player = makeEnt(g, 3, 0, { state: 'trapped', trappedAt: performance.now() });
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true });
    g.ents.push(player, bot);
    think(g, bot, '보통');
    expect(bot.path.length).toBeGreaterThan(0);
    expect(bot.path[bot.path.length - 1]).toEqual([3, 0]);
  });

  it('상자 인접 + 탈출 경로 확보 시에만 풍선을 설치한다 (자살 방지)', () => {
    const g = makeGame({ rows: ['.S.............'] });
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true });
    g.ents.push(player, bot);
    think(g, bot, '보통');
    expect(g.balloons).toHaveLength(1); // 설치했고
    expect(g.balloons[0].owner).toBe(1);
    const blast = new Set(dangerSet(g));
    const last = bot.path[bot.path.length - 1];
    expect(blast.has(key(last[0], last[1]))).toBe(false); // 탈출 지점은 폭발권 밖
  });

  it('탈출로가 기존 위험(물줄기)을 경유해야만 하면 설치하지 않는다', () => {
    // 구석 봇: 오른쪽은 상자, 아래는 물줄기 → 예전엔 설치 후 물로 걸어들어가 사망했다
    const g = makeGame({ rows: ['.S.............'] });
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true });
    g.ents.push(player, bot);
    g.water.set(key(0, 1), performance.now());
    think(g, bot, '보통');
    expect(g.balloons).toHaveLength(0);
  });

  it('위험 위에서 탈출할 때 위험 타일을 밟지 않는 경로를 우선한다', () => {
    const g = makeGame({});
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 2, 0, { id: 1, isBot: true });
    g.ents.push(player, bot);
    g.balloons.push({ tx: 0, ty: 0, owner: 9, at: performance.now(), power: 3 }); // (0..3,0) 위험
    think(g, bot, '보통');
    const d = dangerSet(g);
    // 경로의 모든 칸이 안전해야 한다 (시작 칸 제외)
    bot.path.forEach(([x, y]) => expect(d.has(key(x, y)), `(${x},${y})`).toBe(false));
    expect(bot.path.length).toBeGreaterThan(0);
  });

  it('탈출 경로가 없으면 설치하지 않는다', () => {
    // 봇을 하드로 가둔 1×2 통로: 설치하면 폭발권 밖으로 못 나감
    const g = makeGame({
      rows: [
        '.SH............',
        'HHH............'
      ]
    });
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true });
    g.ents.push(player, bot);
    think(g, bot, '보통');
    expect(g.balloons).toHaveLength(0);
  });
});

describe('driveBot', () => {
  it('경로를 따라 이동한다', () => {
    const g = makeGame({});
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true, nextThink: Infinity });
    g.ents.push(player, bot);
    bot.path = [[1, 0], [2, 0]];
    const x0 = bot.x;
    driveBot(g, bot, 0.05, performance.now(), '보통');
    expect(bot.x).toBeGreaterThan(x0);
  });

  it('다음 경로 타일이 위험해지면 스테일 경로를 버리고 재계획한다', () => {
    const g = makeGame({});
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true, nextThink: Infinity });
    g.ents.push(player, bot);
    bot.path = [[1, 0], [2, 0]];             // 재계산 주기 사이에 만든 스테일 경로
    g.water.set(key(1, 0), performance.now()); // 그 사이 (1,0)에 물줄기 발생
    driveBot(g, bot, 0.05, performance.now(), '보통');
    // 물줄기 타일로 걸어들어가지 않아야 한다
    expect(bot.path.length === 0 || key(bot.path[0][0], bot.path[0][1]) !== key(1, 0)).toBe(true);
    const [tx] = [Math.floor(bot.x / g.T)];
    expect(tx).toBe(0);
  });
});

describe('난이도 프리셋', () => {
  afterEach(() => vi.restoreAllMocks());

  it('보통은 기존 수치(재계산 220ms · 근접 2.6T)를 그대로 쓰고 사냥 반경이 없다', () => {
    expect(SKILL_PRESETS['보통']).toEqual({ thinkInterval: 220, closeDistance: 2.6 });
    expect(SKILL_PRESETS['쉬움']).toMatchObject({ thinkInterval: 420, closeDistance: 1.5 });
    expect(SKILL_PRESETS['어려움'].thinkInterval).toBe(130);
  });

  it('보통·어려움은 판단에 난수를 쓰지 않고, 쉬움만 쓴다', () => {
    const spy = vi.spyOn(Math, 'random');
    const g = makeGame({});
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true });
    g.ents.push(player, bot);
    think(g, bot, '보통');
    think(g, bot, '어려움');
    expect(spy).not.toHaveBeenCalled();
    think(g, bot, '쉬움');
    expect(spy).toHaveBeenCalled();
  });

  it('쉬움은 가끔 위험 칸에서 탈출 판단을 놓친다', () => {
    const g = makeGame({});
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true });
    g.ents.push(player, bot);
    g.balloons.push({ tx: 0, ty: 1, owner: 9, at: performance.now(), power: 2 }); // (0,0) 이 폭발 범위
    const last = () => bot.path[bot.path.length - 1];

    vi.spyOn(Math, 'random').mockReturnValue(0.9); // 제대로 판단 — 가까운 안전 칸으로 탈출
    think(g, bot, '쉬움');
    expect(dangerSet(g).has(key(...last()))).toBe(false);
    expect(last()).not.toEqual([14, 12]);

    vi.spyOn(Math, 'random').mockReturnValue(0.1); // 놓침 — 위험을 모른 채 평소처럼 플레이어에게 간다
    bot.path = [];
    think(g, bot, '쉬움');
    expect(last()).toEqual([14, 12]);
  });

  it('어려움은 사냥 반경 안의 플레이어를 블록보다 먼저 쫓는다', () => {
    // 봇 (7,6) 오른쪽에 소프트 블록, 플레이어는 왼쪽 5칸 — 보통은 블록, 어려움은 플레이어 쪽으로
    const rows = Array.from({ length: 13 }, () => '...............');
    rows[6] = '.........S.....';
    const make = () => {
      const g = makeGame({ rows });
      const player = makeEnt(g, 2, 6);
      const bot = makeEnt(g, 7, 6, { id: 1, isBot: true });
      g.ents.push(player, bot);
      return { g, bot };
    };
    const normal = make();
    think(normal.g, normal.bot, '보통');
    const hard = make();
    think(hard.g, hard.bot, '어려움');
    expect(normal.bot.path[0][0]).toBeGreaterThan(7);
    expect(hard.bot.path[0][0]).toBeLessThan(7);
  });
});

describe('driveBot 레인 정렬', () => {
  it('칸 중앙에서 벗어난 채 옆으로 꺾어야 하면 먼저 레인을 맞춰 벽 모서리에 끼지 않는다', () => {
    // (1,1) 이 하드 블록. 봇은 (0,0) 칸 오른쪽 끝·아래로 치우쳐 있고(경로가 칸 사이에서 바뀐 직후) (1,0) 으로 가야 한다
    const g = makeGame({ rows: ['...............', '.H.............'] });
    const player = makeEnt(g, 14, 12);
    const bot = makeEnt(g, 0, 0, { id: 1, isBot: true, nextThink: Infinity });
    bot.x += g.T * 0.2;
    bot.y += g.T * 0.3;
    g.ents.push(player, bot);
    bot.path = [[1, 0]];
    for (let i = 0; i < 60 && bot.path.length; i++) driveBot(g, bot, 0.016, performance.now(), '어려움');
    expect(bot.path.length).toBe(0); // (1,0) 도착
  });
});
