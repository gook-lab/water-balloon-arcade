import { describe, it, expect, vi, afterEach } from 'vitest';
import { key } from '../src/game/constants.js';
import { makeGame, makeEnt } from './helpers.js';

// renderer 는 DOM(canvas)에 의존하므로 mock — 엔진 로직만 검증한다.
vi.mock('../src/game/renderer.js', () => ({
  draw: vi.fn(),
  drawStatic: vi.fn(),
  drawParts: vi.fn(),
  drawMapPreview: vi.fn()
}));

const { GameEngine } = await import('../src/game/engine.js');

function makeEngine(over = {}) {
  const onFinish = vi.fn();
  const onHud = vi.fn();
  const onSound = vi.fn();
  const engine = new GameEngine({
    canvas: { width: 0, height: 0 },
    charIdx: 0, mapIdx: 0, tileSize: 100, matchSeconds: 180, botCount: 3, botSkill: '보통',
    onFinish, onHud, onSound, ...over
  });
  engine.g = makeGame({ T: 100 });
  return { engine, onFinish, onHud, onSound };
}

afterEach(() => vi.restoreAllMocks());

describe('pickUp 아이템 상한', () => {
  it('풍선 8 / 물줄기 8 / 속도 7 / 바늘 5 상한, 거북이는 감속 타이머', () => {
    const { engine } = makeEngine();
    const g = engine.g;
    const e = makeEnt(g, 0, 0, { maxBalloons: 8, power: 8, speed: 7, pins: 5 });
    g.ents.push(e);
    const k = key(0, 0);
    for (const [type, field, cap] of [
      ['balloon', 'maxBalloons', 8], ['power', 'power', 8], ['speed', 'speed', 7], ['needle', 'pins', 5]
    ]) {
      g.items.set(k, type);
      engine.pickUp(e, k);
      expect(e[field], type).toBe(cap);
      expect(g.items.has(k)).toBe(false);
    }
    g.items.set(k, 'turtle');
    engine.pickUp(e, k);
    expect(e.slowUntil).toBeGreaterThan(performance.now());
    g.items.set(k, 'passBlock');
    engine.pickUp(e, k);
    expect(e.passBlock).toBe(true);
  });
});

describe('burst', () => {
  it('소프트 파괴 + 물줄기 생성, 42% 확률 아이템 드랍', () => {
    const { engine } = makeEngine();
    const g = engine.g;
    g.grid[2][3] = 'soft';
    g.balloons.push({ tx: 2, ty: 2, owner: 0, at: performance.now(), power: 1 });
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.42 → 드랍
    engine.burst(g.balloons[0]);
    expect(g.grid[2][3]).toBe('empty');
    expect(g.water.has(key(2, 2))).toBe(true);
    expect(g.water.has(key(3, 2))).toBe(true);
    expect(g.items.has(key(3, 2))).toBe(true);
    expect(g.dirty).toBe(true);
  });

  it('아이템 미드랍 (random ≥ 0.42)', () => {
    const { engine } = makeEngine();
    const g = engine.g;
    g.grid[2][3] = 'soft';
    g.balloons.push({ tx: 2, ty: 2, owner: 0, at: performance.now(), power: 1 });
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    engine.burst(g.balloons[0]);
    expect(g.items.size).toBe(0);
  });

  it('강화상자는 1타에 일반 상자가 된다', () => {
    const { engine } = makeEngine();
    const g = engine.g;
    g.grid[2][3] = 'tough';
    g.balloons.push({ tx: 2, ty: 2, owner: 0, at: performance.now(), power: 1 });
    engine.burst(g.balloons[0]);
    expect(g.grid[2][3]).toBe('soft');
  });

  it('폭발 범위의 다른 풍선은 즉시 연쇄 폭발한다', () => {
    const { engine } = makeEngine();
    const g = engine.g;
    g.balloons.push(
      { tx: 2, ty: 2, owner: 0, at: performance.now(), power: 2 },
      { tx: 4, ty: 2, owner: 1, at: performance.now(), power: 1 }
    );
    engine.burst(g.balloons[0]);
    expect(g.balloons).toHaveLength(0);
    expect(g.water.has(key(5, 2))).toBe(true); // 연쇄된 풍선의 물줄기
  });
});

describe('usePin', () => {
  it('바늘 1개 소모로 자기 풍선을 즉시 터뜨린다', () => {
    const { engine } = makeEngine();
    const g = engine.g;
    const e = makeEnt(g, 0, 0, { pins: 1 });
    g.ents.push(e);
    g.balloons.push({ tx: 0, ty: 0, owner: 0, at: performance.now(), power: 1 });
    engine.usePin(e);
    expect(e.pins).toBe(0);
    expect(g.balloons).toHaveLength(0);
    engine.usePin(e); // 바늘 없으면 no-op
    expect(e.pins).toBe(0);
  });
});

describe('승패 판정 (step)', () => {
  it('플레이어 dead → lose', () => {
    const { engine, onFinish } = makeEngine();
    const g = engine.g;
    g.ents.push(makeEnt(g, 0, 0, { state: 'dead' }), makeEnt(g, 14, 0, { id: 1, isBot: true }));
    engine.step(g);
    expect(onFinish).toHaveBeenCalledWith('lose');
  });

  it('봇 전멸 → win', () => {
    const { engine, onFinish } = makeEngine();
    const g = engine.g;
    g.ents.push(makeEnt(g, 0, 0), makeEnt(g, 14, 0, { id: 1, isBot: true, state: 'dead' }));
    engine.step(g);
    expect(onFinish).toHaveBeenCalledWith('win');
  });

  it('시간 초과(양측 생존) → draw', () => {
    const { engine, onFinish } = makeEngine();
    engine.matchSeconds = 0;
    const g = engine.g;
    g.ents.push(makeEnt(g, 0, 0), makeEnt(g, 14, 0, { id: 1, isBot: true, nextThink: Infinity }));
    engine.step(g);
    expect(onFinish).toHaveBeenCalledWith('draw');
  });

  it('finish 는 한 번만 발화한다', () => {
    const { engine, onFinish } = makeEngine();
    const g = engine.g;
    g.ents.push(makeEnt(g, 0, 0, { state: 'dead' }), makeEnt(g, 14, 0, { id: 1, isBot: true }));
    engine.step(g);
    engine.step(g);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe('사운드 배선 (onSound 콜백 — 엔진은 이름만 방출)', () => {
  it('폭발·상자 파괴가 burst/crate 를 방출한다', () => {
    const { engine, onSound } = makeEngine();
    const g = engine.g;
    g.grid[2][3] = 'soft';
    g.balloons.push({ tx: 2, ty: 2, owner: 0, at: performance.now(), power: 1 });
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    engine.burst(g.balloons[0]);
    const names = onSound.mock.calls.map((c) => c[0]);
    expect(names).toContain('burst');
    expect(names).toContain('crate');
  });

  it('플레이어 아이템 획득: 좋음/나쁨 구분, 봇 획득은 무음', () => {
    const { engine, onSound } = makeEngine();
    const g = engine.g;
    const me = makeEnt(g, 0, 0);
    const bot = makeEnt(g, 1, 0, { id: 1, isBot: true });
    g.ents.push(me, bot);
    g.items.set(key(0, 0), 'balloon');
    engine.pickUp(me, key(0, 0));
    g.items.set(key(0, 0), 'turtle');
    engine.pickUp(me, key(0, 0));
    g.items.set(key(1, 0), 'speed');
    engine.pickUp(bot, key(1, 0));
    const names = onSound.mock.calls.map((c) => c[0]);
    expect(names).toEqual(['itemGood', 'itemBad']); // 봇 획득은 방출 없음
  });

  it('바늘 사용 → pin, 갇힘 → trapped, 탈락 → die', () => {
    const { engine, onSound } = makeEngine();
    const g = engine.g;
    const me = makeEnt(g, 0, 0, { pins: 1 });
    g.ents.push(me, makeEnt(g, 14, 0, { id: 1, isBot: true, nextThink: Infinity }));
    g.balloons.push({ tx: 0, ty: 0, owner: 0, at: performance.now(), power: 1 });
    engine.usePin(me);
    expect(onSound.mock.calls.map((c) => c[0])).toContain('pin');
    onSound.mockClear();
    g.water.set(key(0, 0), performance.now()); // 플레이어가 서 있는 칸에 물
    engine.step(g);
    expect(onSound.mock.calls.map((c) => c[0])).toContain('trapped');
    onSound.mockClear();
    engine.kill(me);
    expect(onSound.mock.calls.map((c) => c[0])).toContain('die');
  });

  it('승패 결정 시 결과음을 정확히 1회 방출한다', () => {
    const { engine, onSound } = makeEngine();
    const g = engine.g;
    g.ents.push(makeEnt(g, 0, 0), makeEnt(g, 14, 0, { id: 1, isBot: true, state: 'dead' }));
    engine.step(g);
    engine.step(g);
    expect(onSound.mock.calls.filter((c) => c[0] === 'win')).toHaveLength(1);
  });
});

describe('HUD 스냅샷', () => {
  it('값이 바뀔 때만 onHud 를 부른다', () => {
    const { engine, onHud } = makeEngine();
    const g = engine.g;
    g.ents.push(makeEnt(g, 0, 0), makeEnt(g, 14, 0, { id: 1, isBot: true, nextThink: Infinity }));
    engine.pushHud();
    const n1 = onHud.mock.calls.length;
    engine.pushHud(); // 변화 없음
    expect(onHud.mock.calls.length).toBe(n1);
    g.ents[0].power = 3;
    engine.pushHud();
    expect(onHud.mock.calls.length).toBe(n1 + 1);
    expect(onHud.mock.calls.at(-1)[0]).toMatchObject({ power: 3, botsAlive: 1 });
  });
});
