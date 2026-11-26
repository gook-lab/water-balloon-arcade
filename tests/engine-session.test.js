// 판 진행 — 카운트다운 · 일시정지 · 판 통계(가둔 수 · 터뜨린 수 · 아이템) · 키 처리(QA S4 · S6 · S7)
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { key, FUSE, TRAP_MS } from '../src/game/constants.js';
import { makeGame, makeEnt } from './helpers.js';

vi.mock('../src/game/renderer.js', () => ({
  draw: vi.fn(), drawStatic: vi.fn(), drawParts: vi.fn(), drawMapPreview: vi.fn()
}));

const { GameEngine, COUNT_FROM, COUNT_STEP_MS, GO_MS } = await import('../src/game/engine.js');

let t = 0; // 가짜 시계(ms)
beforeEach(() => {
  t = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => t);
});
afterEach(() => vi.restoreAllMocks());

function setup({ bots = 1 } = {}) {
  const onFinish = vi.fn(), onHud = vi.fn(), onSound = vi.fn(), onPhase = vi.fn();
  const engine = new GameEngine({
    canvas: { width: 0, height: 0 }, charIdx: 0, mapIdx: 0, tileSize: 100, matchSeconds: 180, botCount: bots, botSkill: '보통',
    onFinish, onHud, onSound, onPhase
  });
  const g = makeGame({ T: 100 });
  g.start = t; g.last = t;
  engine.g = g;
  const me = makeEnt(g, 0, 0);
  g.ents.push(me);
  const botList = [];
  for (let i = 0; i < bots; i++) {
    const b = makeEnt(g, 14, 12 - i * 4, { id: i + 1, isBot: true, nextThink: Infinity });
    g.ents.push(b); botList.push(b);
  }
  return { engine, g, me, bots: botList, onFinish, onHud, onSound, onPhase };
}

const keyEv = (code, k, extra = {}) => ({ code, key: k, preventDefault: vi.fn(), ...extra });
const SPACE = () => keyEv('Space', ' ');
const lastPhase = (onPhase) => onPhase.mock.calls.at(-1)[0];

describe('물줄기 주인 — 가둔 수', () => {
  it('내 풍선 물줄기에 봇이 갇히면 가둔 수가 1 오른다', () => {
    const { engine, g, bots } = setup();
    const bot = bots[0];
    bot.x = 5 * 100 + 50; bot.y = 5 * 100 + 50;
    g.balloons.push({ tx: 4, ty: 5, owner: 0, at: t, power: 1 });
    engine.burst(g.balloons[0]);
    engine.step(g);
    expect(bot.state).toBe('trapped');
    expect(bot.trappedBy).toBe(0);
    expect(engine.stats.trapped).toBe(1);
  });

  it('다른 봇 풍선이나 자기 풍선 물줄기에 갇힌 건 세지 않는다', () => {
    const { engine, g, bots } = setup({ bots: 2 });
    const [b1, b2] = bots;
    b1.x = 5 * 100 + 50; b1.y = 5 * 100 + 50;
    b2.x = 9 * 100 + 50; b2.y = 9 * 100 + 50;
    g.balloons.push(
      { tx: 4, ty: 5, owner: 2, at: t, power: 1 }, // b2 의 풍선 → b1
      { tx: 9, ty: 8, owner: 2, at: t, power: 1 } // b2 자기 풍선 → b2
    );
    engine.burst(g.balloons[0]);
    engine.burst(g.balloons[0]);
    engine.step(g);
    expect(b1.state).toBe('trapped');
    expect(b2.state).toBe('trapped');
    expect(engine.stats.trapped).toBe(0);
  });

  it('내 풍선이 연쇄로 터뜨린 봇 풍선의 물줄기는 그 봇 몫이다', () => {
    const { engine, g, bots } = setup();
    const bot = bots[0];
    bot.x = 8 * 100 + 50; bot.y = 2 * 100 + 50;
    g.balloons.push(
      { tx: 2, ty: 2, owner: 0, at: t, power: 3 },
      { tx: 5, ty: 2, owner: 1, at: t, power: 3 } // 연쇄 → (8,2)
    );
    engine.burst(g.balloons[0]);
    engine.step(g);
    expect(bot.state).toBe('trapped');
    expect(engine.stats.trapped).toBe(0);
  });

  it('물이 마르면 주인 기록도 지운다', () => {
    const { engine, g } = setup();
    g.balloons.push({ tx: 4, ty: 5, owner: 0, at: t, power: 1 });
    engine.burst(g.balloons[0]);
    expect(g.waterOwner.get(key(4, 5))).toBe(0);
    t += 1000;
    engine.step(g);
    expect(g.water.size).toBe(0);
    expect(g.waterOwner.size).toBe(0);
  });
});

describe('판 통계 — 터뜨린 수 · 아이템 · 생존 시간', () => {
  it('내가 터치로 터뜨리면 1, 봇이 터치로 터뜨린 건 0', () => {
    const { engine, g, me, bots } = setup({ bots: 3 });
    const [b1, b2, b3] = bots;
    b1.state = 'trapped'; b1.trappedAt = t; b1.x = me.x; b1.y = me.y; // 나와 겹침
    b2.state = 'trapped'; b2.trappedAt = t; b2.x = b3.x = 1050; b2.y = b3.y = 1050; // b3 와 겹침
    engine.step(g);
    expect(b1.state).toBe('dying');
    expect(b2.state).toBe('dying');
    expect(engine.stats.popped).toBe(1);
  });

  it('갇힌 봇이 내 물줄기를 다시 맞으면 터뜨린 수 1, 시간이 다 돼 터진 건 0', () => {
    const { engine, g, bots } = setup({ bots: 2 });
    const [b1, b2] = bots;
    b1.state = 'trapped'; b1.trappedAt = t - 1000; b1.x = 550; b1.y = 550;
    b2.state = 'trapped'; b2.trappedAt = t - TRAP_MS - 1; b2.x = 1050; b2.y = 1050;
    g.balloons.push({ tx: 4, ty: 5, owner: 0, at: t, power: 1 });
    engine.burst(g.balloons[0]);
    engine.step(g);
    expect(b1.state).toBe('dying');
    expect(b2.state).toBe('dying');
    expect(engine.stats.popped).toBe(1);
  });

  it('내가 먹은 아이템만 센다', () => {
    const { engine, g, me, bots } = setup();
    g.items.set(key(0, 0), 'speed');
    engine.pickUp(me, key(0, 0));
    g.items.set(key(14, 12), 'power');
    engine.pickUp(bots[0], key(14, 12));
    expect(engine.stats.items).toBe(1);
  });

  it('진 판의 생존 시간은 탈락 순간까지 — onFinish 둘째 인자로 통계를 준다', () => {
    const { engine, g, me, onFinish } = setup();
    me.power = 3;
    t = 42000;
    engine.kill(me);
    t = 43000;
    me.state = 'dead';
    engine.step(g);
    expect(onFinish).toHaveBeenCalledTimes(1);
    const [kind, rep] = onFinish.mock.calls[0];
    expect(kind).toBe('lose');
    expect(rep).toMatchObject({ survivalMs: 42000, trapped: 0, popped: 0, items: 0 });
    expect(rep.final).toEqual({ maxBalloons: 1, power: 3, speed: 3, pins: 0 });
  });

  it('이긴 판의 생존 시간은 끝난 순간까지', () => {
    const { engine, g, bots, onFinish } = setup();
    bots[0].state = 'dead';
    t = 75500;
    engine.step(g);
    expect(onFinish.mock.calls[0][1].survivalMs).toBe(75500);
  });
});

describe('시작 카운트다운', () => {
  it('3 · 2 · 1 동안 풍선이 놓이지 않고 봇 · 시계도 멈춘다', () => {
    const { engine, g, me, bots, onPhase, onSound } = setup();
    const bot = bots[0];
    bot.nextThink = 0; // 판이 돌면 바로 생각할 봇
    engine.enterCountdown();
    expect(lastPhase(onPhase)).toEqual({ phase: 'countdown', count: 3, go: false });
    const ev = SPACE();
    engine.onKeyDown(ev);
    expect(ev.preventDefault).toHaveBeenCalled(); // 화면이 스크롤되지 않게는 막는다
    expect(g.balloons).toHaveLength(0);
    for (const at of [300, 700, 1300]) { t = at; engine.step(g); }
    expect(lastPhase(onPhase)).toEqual({ phase: 'countdown', count: 1, go: false });
    expect(g.balloons).toHaveLength(0);
    expect(bot.nextThink).toBe(0); // 봇이 한 번도 생각하지 않음
    expect(me.x).toBe(50);
    expect(onSound.mock.calls.filter((c) => c[0] === 'count')).toHaveLength(COUNT_FROM);

    // 카운트다운이 끝나면 판 시계는 0초 지난 상태로 시작
    t = COUNT_FROM * COUNT_STEP_MS + 5;
    engine.step(g);
    expect(lastPhase(onPhase)).toEqual({ phase: 'playing', count: 0, go: true });
    expect(onSound.mock.calls.map((c) => c[0])).toContain('go');
    expect(g.start).toBe(t);
    expect(bot.nextThink).toBeGreaterThan(0); // 이제 봇이 움직인다
    engine.pushHud();
    expect(engine.lastHud.clockSec).toBe(180);

    // 눌린 채였던 Space 를 떼고 다시 누르면 풍선이 놓인다
    engine.onKeyUp(SPACE());
    engine.onKeyDown(SPACE());
    expect(g.balloons).toHaveLength(1);

    // 「시작!」은 GO_MS 뒤 내린다
    t += GO_MS + 1;
    engine.step(g);
    expect(lastPhase(onPhase)).toEqual({ phase: 'playing', count: 0, go: false });
  });

  it('카운트다운 중 멈췄다 이으면 카운트다운을 처음부터 다시 센다', () => {
    const { engine, g, onPhase } = setup();
    engine.enterCountdown();
    t = 1000; engine.step(g);
    engine.pause();
    expect(lastPhase(onPhase).phase).toBe('paused');
    t = 9000;
    engine.resume();
    expect(lastPhase(onPhase)).toEqual({ phase: 'countdown', count: 3, go: false });
    t = 9000 + COUNT_FROM * COUNT_STEP_MS + 1;
    engine.step(g);
    expect(engine.phase).toBe('playing');
    expect(g.start).toBe(t); // 멈춘 시간 · 카운트다운 시간 모두 판 시계에서 빠진다
  });
});

describe('일시정지', () => {
  it('10초 멈췄다 이어도 도화선 · 물줄기 · 갇힘 · 거북이 · 판 시계 남은 값이 그대로다', () => {
    const { engine, g, me, bots } = setup();
    const bot = bots[0];
    t = 20000;
    g.balloons.push({ tx: 7, ty: 7, owner: 0, at: 19000, power: 1 });
    bot.state = 'trapped'; bot.trappedAt = 18000; bot.x = 1250; bot.y = 1250;
    g.water.set(key(3, 3), 19800);
    me.slowUntil = 24000;
    engine.step(g);
    engine.pushHud();
    const before = {
      fuse: FUSE - (t - g.balloons[0].at),
      trap: TRAP_MS - (t - bot.trappedAt),
      water: t - g.water.get(key(3, 3)),
      slow: me.slowUntil - t,
      clock: engine.lastHud.clockSec
    };

    engine.pause();
    t += 10000;
    engine.step(g); // 멈춘 동안 step 은 아무것도 바꾸지 않는다
    engine.tick();
    expect(g.balloons).toHaveLength(1);
    expect(bot.state).toBe('trapped');
    engine.resume();

    expect(FUSE - (t - g.balloons[0].at)).toBe(before.fuse);
    expect(TRAP_MS - (t - bot.trappedAt)).toBe(before.trap);
    expect(t - g.water.get(key(3, 3))).toBe(before.water);
    expect(me.slowUntil - t).toBe(before.slow);
    engine.step(g);
    engine.pushHud();
    expect(engine.lastHud.clockSec).toBe(before.clock);
    expect(g.balloons).toHaveLength(1); // 아직 안 터짐
    expect(bot.state).toBe('trapped');
  });

  it('Esc · P 로 멈추고 다시 누르면 잇는다(키 반복은 무시)', () => {
    const { engine, onPhase } = setup();
    engine.onKeyDown(keyEv('Escape', 'Escape'));
    expect(engine.phase).toBe('paused');
    engine.onKeyDown(keyEv('KeyP', 'p', { repeat: true }));
    expect(engine.phase).toBe('paused');
    engine.onKeyDown(keyEv('KeyP', 'ㅔ')); // 한글 IME 에서도 물리 키로
    expect(engine.phase).toBe('playing');
    expect(onPhase.mock.calls.map((c) => c[0].phase)).toEqual(['paused', 'playing']);
  });

  it('멈추면 눌린 키를 모두 풀고, 멈춘 동안 Space 로 풍선이 놓이지 않는다', () => {
    const { engine, g } = setup();
    engine.onKeyDown(keyEv('ArrowLeft', 'ArrowLeft'));
    engine.pause();
    expect(engine.keys).toEqual({});
    engine.onKeyDown(SPACE());
    expect(g.balloons).toHaveLength(0);
  });

  it('끝난 판은 멈추지 않는다', () => {
    const { engine, g, bots } = setup();
    bots[0].state = 'dead';
    engine.step(g);
    engine.pause();
    expect(engine.phase).toBe('finished');
  });

  it('탭이 숨으면 자동으로 멈춘다(visibilitychange)', () => {
    const { engine } = setup();
    const had = 'document' in globalThis;
    const prev = globalThis.document;
    globalThis.document = { visibilityState: 'visible' };
    try {
      engine.onVisibility();
      expect(engine.phase).toBe('playing');
      globalThis.document.visibilityState = 'hidden';
      engine.onVisibility();
      expect(engine.phase).toBe('paused');
      globalThis.document.visibilityState = 'visible';
      engine.onVisibility();
      expect(engine.phase).toBe('paused'); // 돌아와도 사람이 「계속할게요」를 누를 때까지
    } finally {
      if (had) globalThis.document = prev; else delete globalThis.document;
    }
  });
});

describe('키 처리 — QA S4 · S7', () => {
  it('판이 끝나면 Space · 방향키를 막지 않는다(결과 화면 버튼이 Space 로 눌림)', () => {
    const { engine, g, bots } = setup();
    const live = SPACE();
    engine.onKeyDown(live);
    expect(live.preventDefault).toHaveBeenCalled();
    engine.onKeyUp(SPACE());
    bots[0].state = 'dead';
    engine.step(g);
    expect(engine.phase).toBe('finished');
    const sp = SPACE(), ar = keyEv('ArrowDown', 'ArrowDown');
    engine.onKeyDown(sp);
    engine.onKeyDown(ar);
    expect(sp.preventDefault).not.toHaveBeenCalled();
    expect(ar.preventDefault).not.toHaveBeenCalled();
  });

  it('멈춘 동안에도 Space 를 막지 않는다(일시정지 화면 버튼)', () => {
    const { engine } = setup();
    engine.pause();
    const sp = SPACE();
    engine.onKeyDown(sp);
    expect(sp.preventDefault).not.toHaveBeenCalled();
  });

  it('창을 떠나면(blur) 눌린 키를 모두 푼다', () => {
    const { engine, g, me } = setup();
    engine.onKeyDown(keyEv('ArrowRight', 'ArrowRight'));
    expect(engine.keys.arrowright).toBe(true);
    engine.onBlur();
    expect(engine.keys).toEqual({});
    const x0 = me.x;
    t += 16;
    engine.step(g);
    expect(me.x).toBe(x0);
  });
});
