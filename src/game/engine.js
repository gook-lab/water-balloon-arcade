// GameEngine — React와 무관한 순수 JS 게임 엔진.
// 게임 루프(rAF + 80ms 폴백 타이머)와 상태를 소유하고, HUD 값이 바뀔 때만 onHud 콜백을 부른다.
// 판의 단계(phase)는 countdown → playing ⇄ paused → finished 이고, 바뀔 때마다 onPhase 를 부른다.
// 카운트다운 · 일시정지 동안 흐른 시간은 shiftTime 으로 모든 기준 시각을 미뤄 판 시계에서 뺀다.
import { NX, NY, FUSE, WATER_MS, TRAP_MS, ITEM_POOL, key, clamp } from './constants.js';
import { CHARS } from './characters.js';
import { MAPS, buildMap } from './maps.js';
import { tileOf, balloonAt, blastTiles, tryPlace, moveEnt, spawnParts } from './rules.js';
import { driveBot } from './ai.js';
import { draw } from './renderer.js';

// 시작 카운트다운 — 3 · 2 · 1 을 COUNT_STEP_MS 씩 보여 준 뒤 「시작!」을 GO_MS 동안 띄운다(판은 이미 진행).
export const COUNT_FROM = 3;
export const COUNT_STEP_MS = 600;
export const GO_MS = 600;
// 일시정지 · 카운트다운이 끝날 때 함께 미루는 엔티티 시각 필드
const ENT_TIME_FIELDS = ['trappedAt', 'slowUntil', 'nextThink', 'dieAt', 'sparkAt', 'bubAt', 'dustAt'];

// 물리 키 기준 정규화 — 한글 IME 모드에서 e.key 가 'ㅌ'/'Process' 로 들어와도
// WASD·X 가 동작하도록 e.code(KeyW 등)를 우선한다.
function keyName(e) {
  if (/^Key[A-Z]$/.test(e.code || '')) return e.code.slice(3).toLowerCase();
  if (e.code === 'Space') return ' ';
  return (e.key || '').toLowerCase();
}

export class GameEngine {
  constructor(opts) {
    this.opts = opts;
    this.canvas = opts.canvas;
    this.T = parseInt(opts.tileSize ?? 128, 10);
    this.matchSeconds = parseInt(opts.matchSeconds ?? 180, 10);
    this.botCount = clamp(parseInt(opts.botCount ?? 3, 10), 1, 3);
    this.skill = opts.botSkill ?? '보통';
    this.onSound = opts.onSound || null; // 사운드 배선 — 엔진은 이름만 방출, 재생은 바깥(audio 모듈) 몫
    this.keys = {};
    this.finished = null;
    // 단계: start() 가 countdown 으로 연다. 시험처럼 start() 없이 step 을 돌리면 바로 playing.
    this.phase = 'playing';
    this.count = 0;       // countdown 에서 보이는 숫자
    this.countAt = 0;     // 카운트다운을 연 시각
    this.holdAt = 0;      // 시계가 멈춘 시각(카운트다운 · 일시정지)
    this.resumeTo = null; // 일시정지를 풀면 돌아갈 단계
    this.goUntil = 0;     // 「시작!」을 내릴 시각
    this.lastPhase = null;
    // 판 통계 — 결과 화면 · 기록(records.js)이 쓴다. 「나」는 ents[0](id 0).
    this.stats = { survivalMs: null, trapped: 0, popped: 0, items: 0 };
    this.lastHud = null;
    this.raf = null;
    this.timer = null;
    this.lastTick = 0;
    this.stopped = false;
  }

  me() { return this.g && this.g.ents[0]; }

  sound(name) { if (this.onSound) this.onSound(name); }

  start() {
    const T = this.T;
    let theme = MAPS[this.opts.mapIdx] || MAPS[0];
    if (theme.layout === 'random') {
      const pool = MAPS.filter((m) => m.layout !== 'random');
      theme = pool[Math.floor(Math.random() * pool.length)];
    }
    const built = buildMap(theme);
    const ch = CHARS[this.opts.charIdx] || CHARS[0];
    const mk = (i, cx, cy, isBot, cfg) => ({
      id: i, isBot, ch: cfg, x: cx * T + T / 2, y: cy * T + T / 2, r: T * 0.29,
      dir: 'down', walk: 0,
      maxBalloons: cfg.base.maxBalloons, power: cfg.base.power, speed: cfg.base.speed, pins: cfg.base.pins,
      passBalloon: false, passBlock: false, slowUntil: 0,
      state: 'alive', trappedAt: 0, ignore: new Set(), path: [], nextThink: 0
    });
    const ents = [mk(0, 0, 0, false, ch)];
    const others = CHARS.filter((c) => c.id !== ch.id).sort(() => Math.random() - 0.5);
    const spots = [[NX - 1, 0], [0, NY - 1], [NX - 1, NY - 1]];
    for (let i = 0; i < this.botCount; i++) {
      const c = others[i % others.length];
      ents.push(mk(i + 1, spots[i][0], spots[i][1], true, {
        ...c,
        base: { maxBalloons: 1, power: this.skill === '어려움' ? 2 : 1, speed: this.skill === '어려움' ? 4 : 3, pins: 0 }
      }));
    }
    this.g = {
      T, theme, grid: built.grid, vars: built.vars, deco: built.deco,
      items: new Map(), balloons: [], water: new Map(), waterOwner: new Map(), ents, parts: [], pops: [],
      start: performance.now(), last: performance.now(), dirty: true, layer: null
    };
    if (this.canvas) { this.canvas.width = NX * T; this.canvas.height = NY * T; }

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);

    // rAF 가 멈춘 경우의 80ms 폴백 타이머(원본 tick 구조). 탭이 숨으면 onVisibility 가 판을 멈추므로
    // 숨은 탭에서 판이 흐르지는 않는다 — 멈춘 단계의 step 은 아무것도 하지 않는다.
    this.timer = setInterval(() => {
      if (performance.now() - this.lastTick > 150) this.tick();
    }, 80);
    this.enterCountdown();
    this.loop();
    this.pushHud();
  }

  stop() {
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
    }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /* ---------------- 입력 ---------------- */
  onKeyDown = (e) => {
    const k = keyName(e);
    if (k === 'escape' || k === 'p') {
      if (e.repeat) return;
      if (this.phase === 'paused') { e.preventDefault?.(); this.resume(); }
      else if (this.phase === 'playing' || this.phase === 'countdown') { e.preventDefault?.(); this.pause(); }
      return;
    }
    // 끝났거나 멈춘 뒤에는 키를 가로채지 않는다 — Space 가 결과 · 일시정지 화면 버튼을 누를 수 있게(QA S4)
    if (this.phase !== 'playing' && this.phase !== 'countdown') return;
    if (k.startsWith('arrow') || k === ' ') e.preventDefault?.();
    if (this.keys[k]) return;
    this.keys[k] = true;
    // 카운트다운 동안은 눌림만 기록하고 풍선 · 바늘은 쓰지 않는다
    if (this.phase !== 'playing') return;
    if (k === ' ') {
      const n = this.g.balloons.length;
      tryPlace(this.g, this.me());
      if (this.g.balloons.length > n) this.sound('place');
    }
    if (k === 'x') this.usePin(this.me());
  };

  onKeyUp = (e) => { this.keys[keyName(e)] = false; };

  // 창을 떠나면 keyup 을 놓칠 수 있으니 눌린 키를 모두 푼다(QA S7)
  onBlur = () => { this.keys = {}; };

  // 탭이 숨으면 자동 일시정지(QA S6). 돌아와도 저절로 풀지 않는다 — 사람이 「계속할게요」를 누른다.
  onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') this.pause();
  };

  /* ---------------- 단계 · 시각 ---------------- */
  emitPhase() {
    const p = { phase: this.phase, count: this.phase === 'countdown' ? this.count : 0, go: this.phase === 'playing' && this.goUntil > 0 };
    const l = this.lastPhase;
    if (l && l.phase === p.phase && l.count === p.count && l.go === p.go) return;
    this.lastPhase = p;
    if (this.opts.onPhase) this.opts.onPhase(p);
  }

  enterCountdown(now = performance.now()) {
    if (this.phase !== 'paused') this.holdAt = now; // 일시정지에서 돌아온 경우는 처음 멈춘 시각을 그대로
    this.phase = 'countdown';
    this.countAt = now;
    this.count = COUNT_FROM;
    this.sound('count');
    this.emitPhase();
  }

  /** 카운트다운 · 일시정지 동안 흐른 d ms 만큼 판의 모든 기준 시각을 미룬다 — 도화선 · 물줄기 · 갇힘 · 거북이 · 판 시계. */
  shiftTime(d) {
    const g = this.g;
    if (!g || !(d > 0)) return;
    g.start += d;
    g.last += d;
    g.balloons.forEach((b) => { b.at += d; });
    g.water.forEach((at, k) => g.water.set(k, at + d));
    g.ents.forEach((e) => {
      ENT_TIME_FIELDS.forEach((f) => { if (typeof e[f] === 'number' && e[f] > 0) e[f] += d; });
    });
    g.pops.forEach((p) => { p.at += d; });
  }

  /** 판을 멈춘다(Esc · P · HUD 버튼 · 탭 숨김). 끝난 판에서는 아무것도 하지 않는다. */
  pause() {
    if (!this.g || (this.phase !== 'playing' && this.phase !== 'countdown')) return;
    if (this.phase === 'playing') this.holdAt = performance.now();
    this.resumeTo = this.phase;
    this.phase = 'paused';
    this.keys = {};
    this.goUntil = 0;
    this.emitPhase();
  }

  /** 멈춘 판을 잇는다. 카운트다운 도중에 멈췄으면 카운트다운을 처음부터 다시 센다. */
  resume() {
    if (this.phase !== 'paused') return;
    const now = performance.now();
    if (this.resumeTo === 'countdown') { this.enterCountdown(now); return; }
    this.shiftTime(now - this.holdAt);
    this.holdAt = 0;
    this.phase = 'playing';
    this.emitPhase();
  }

  begin(now) {
    this.shiftTime(now - this.holdAt);
    this.holdAt = 0;
    this.phase = 'playing';
    this.goUntil = now + GO_MS;
    this.sound('go');
    this.emitPhase();
  }

  loop = () => {
    if (this.stopped) return;
    this.raf = requestAnimationFrame(this.loop);
    this.tick();
  };

  tick() {
    if (this.stopped || !this.g) return;
    this.lastTick = performance.now();
    try { this.step(this.g); } catch (err) { console.error('loop error', err); }
  }

  step(g) {
    const now = performance.now();
    if (this.phase === 'paused') return; // 그림도 멈춘다 — 마지막 프레임이 일시정지 화면 뒤에 남는다
    if (this.phase === 'countdown') {
      const n = COUNT_FROM - Math.floor((now - this.countAt) / COUNT_STEP_MS);
      if (n > 0) {
        if (n !== this.count) { this.count = n; this.sound('count'); this.emitPhase(); }
        g.last = now;
        draw(g, this.canvas); // 입력 · 봇 · 시계는 멈추고 판만 보여 준다
        return;
      }
      this.begin(now);
    }
    if (this.goUntil && now >= this.goUntil) { this.goUntil = 0; this.emitPhase(); }
    const dt = Math.min(0.05, (now - g.last) / 1000);
    g.last = now;
    if (!this.finished) {
      g.balloons.slice().forEach((b) => { if (now - b.at > FUSE) this.burst(b); });
      g.water.forEach((at, k) => {
        if (now - at > WATER_MS) { g.water.delete(k); if (g.waterOwner) g.waterOwner.delete(k); }
      });
      const me = g.ents[0];
      if (me.state === 'alive') {
        let vx = 0, vy = 0;
        if (this.keys['arrowleft'] || this.keys['a']) vx -= 1;
        if (this.keys['arrowright'] || this.keys['d']) vx += 1;
        if (this.keys['arrowup'] || this.keys['w']) vy -= 1;
        if (this.keys['arrowdown'] || this.keys['s']) vy += 1;
        moveEnt(g, me, vx, vy, dt);
      }
      g.ents.forEach((e) => { if (e.isBot && e.state === 'alive') driveBot(g, e, dt, now, this.skill); });
      g.ents.forEach((e) => {
        if (e.state === 'dead') return;
        if (e.state === 'dying') {
          if (now - (e.sparkAt || 0) > 110) {
            e.sparkAt = now;
            spawnParts(g, 'rise', e.x + (Math.random() - 0.5) * g.T * 0.4, e.y - g.T * 0.2, 1, '#ffd23f');
          }
          if (now - e.dieAt > 820) e.state = 'dead';
          return;
        }
        const [tx, ty] = tileOf(g, e), k = key(tx, ty), wa = g.water.get(k);
        if (e.state === 'alive') {
          this.pickUp(e, k);
          if (wa !== undefined) {
            e.state = 'trapped'; e.trappedAt = now; e.path = []; e.trail = null; e.bubAt = now;
            // 물줄기 주인 — 내(id 0) 풍선 물줄기에 봇이 갇혔을 때만 「가둔 수」로 센다
            e.trappedBy = g.waterOwner ? g.waterOwner.get(k) : undefined;
            if (e.isBot && e.trappedBy === 0) this.stats.trapped++;
            this.sound('trapped');
            spawnParts(g, 'splash', e.x, e.y, 14, '#bfefff');
          }
        } else if (e.state === 'trapped') {
          if (now - (e.bubAt || 0) > 160) {
            e.bubAt = now;
            spawnParts(g, 'rise', e.x + (Math.random() - 0.5) * g.T * 0.5, e.y + g.T * 0.1, 1, 'rgba(255,255,255,.85)');
          }
          // 갇힌 상태에서 물을 다시 맞으면 즉시 탈락
          if (wa !== undefined && wa > e.trappedAt + 150) this.kill(e, g.waterOwner ? g.waterOwner.get(k) : undefined);
          else if (now - e.trappedAt > TRAP_MS) this.kill(e, undefined);
        }
      });
      // 갇힌 상대 터치 → 즉시 터뜨리기 (클래식 규칙)
      g.ents.forEach((a) => {
        if (a.state !== 'alive') return;
        g.ents.forEach((t2) => {
          if (t2 === a || t2.state !== 'trapped') return;
          if (Math.abs(a.x - t2.x) < g.T * 0.6 && Math.abs(a.y - t2.y) < g.T * 0.6) this.kill(t2, a.id);
        });
      });
      const botsLeft = g.ents.filter((e) => e.isBot && e.state !== 'dead').length;
      const left = Math.max(0, this.matchSeconds - Math.floor((now - g.start) / 1000));
      if (g.ents[0].state === 'dead') this.finish('lose');
      else if (botsLeft === 0) this.finish('win');
      else if (left <= 0) this.finish('draw');
      this.pushHud();
    }
    this.updateParts(dt);
    draw(g, this.canvas);
  }

  usePin(e) {
    if (!e || e.pins <= 0 || e.state !== 'alive') return;
    const b = this.g.balloons.find((b) => b.owner === e.id);
    if (!b) return;
    e.pins--;
    this.sound('pin');
    this.burst(b);
  }

  burst(b) {
    const g = this.g, i = g.balloons.indexOf(b);
    if (i < 0) return;
    g.balloons.splice(i, 1);
    this.sound('burst');
    const now = performance.now();
    const owners = g.waterOwner || (g.waterOwner = new Map());
    blastTiles(g, b).forEach((k) => {
      g.water.set(k, now);
      owners.set(k, b.owner); // 겹친 칸은 마지막에 터진 풍선 주인 — 연쇄는 연쇄된 풍선의 주인
      const [x, y] = k.split(',').map(Number);
      if (g.grid[y][x] === 'tough') {
        g.grid[y][x] = 'soft'; g.vars.set(k, 0); g.dirty = true;
        this.sound('crate');
        spawnParts(g, 'chip', x * g.T + g.T / 2, y * g.T + g.T / 2, 7, g.theme.hard[0]);
      } else if (g.grid[y][x] === 'soft') {
        g.grid[y][x] = 'empty'; g.vars.delete(k); g.dirty = true;
        this.sound('crate');
        spawnParts(g, 'chip', x * g.T + g.T / 2, y * g.T + g.T / 2, 10, g.theme.soft[1]);
        if (Math.random() < 0.42) {
          g.items.set(k, ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)]);
          // 드랍 팝 이펙트 — 흰 반짝이 상승 파티클로 시선 유도 (v5 아이템 가시성)
          spawnParts(g, 'rise', x * g.T + g.T / 2, y * g.T + g.T / 2, 4, '#ffffff');
        }
      }
      spawnParts(g, 'splash', x * g.T + g.T / 2, y * g.T + g.T / 2, 3, '#bfefff');
      const other = balloonAt(g, x, y);
      if (other) this.burst(other); // 연쇄 폭발
    });
  }

  pickUp(e, k) {
    const g = this.g, it = g.items.get(k);
    if (!it) return;
    g.items.delete(k);
    if (!e.isBot) { this.stats.items++; this.sound(it === 'turtle' ? 'itemBad' : 'itemGood'); }
    if (it === 'balloon') e.maxBalloons = Math.min(8, e.maxBalloons + 1);
    else if (it === 'power') e.power = Math.min(8, e.power + 1);
    else if (it === 'speed') e.speed = Math.min(7, e.speed + 1);
    else if (it === 'needle') e.pins = Math.min(5, e.pins + 1);
    else if (it === 'passBalloon') e.passBalloon = true;
    else if (it === 'passBlock') e.passBlock = true;
    else if (it === 'turtle') e.slowUntil = performance.now() + 7000;
  }

  /** 탈락. by 는 터뜨린 쪽 id(터치 팝 · 물 재격) — 시간이 다 돼 터지면 undefined. */
  kill(e, by) {
    e.state = 'dying'; e.dieAt = performance.now(); e.trail = null; e.killedBy = by;
    if (e.isBot && by === 0) this.stats.popped++;
    if (e === this.me() && this.g) this.stats.survivalMs = Math.max(0, e.dieAt - this.g.start);
    this.sound('die');
    spawnParts(this.g, 'splash', e.x, e.y, 18, '#ffffff');
    spawnParts(this.g, 'splash', e.x, e.y, 12, '#7fd8ff');
    this.g.pops.push({ x: e.x, y: e.y, at: performance.now() });
  }

  updateParts(dt) {
    const g = this.g;
    if (!g.parts) return;
    g.parts = g.parts.filter((p) => {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gr * dt;
      return p.life < p.max;
    });
    const now = performance.now();
    g.pops = g.pops.filter((p) => now - p.at < 340);
  }

  finish(kind) {
    if (this.finished) return;
    this.finished = kind;
    this.phase = 'finished';
    this.goUntil = 0;
    this.keys = {};
    this.sound(kind); // 'win' | 'lose' | 'draw'
    this.emitPhase();
    if (this.opts.onFinish) this.opts.onFinish(kind, this.report());
  }

  /** 판 통계 스냅샷 — 생존 시간(일시정지 · 카운트다운 제외) · 가둔 수 · 터뜨린 수 · 먹은 아이템 수 · 최종 스탯. */
  report() {
    const g = this.g, me = this.me();
    const cap = this.matchSeconds * 1000;
    const survivalMs = this.stats.survivalMs ?? (g ? performance.now() - g.start : 0);
    return {
      survivalMs: Math.round(Math.max(0, Math.min(cap, survivalMs))),
      trapped: this.stats.trapped,
      popped: this.stats.popped,
      items: this.stats.items,
      final: me ? { maxBalloons: me.maxBalloons, power: me.power, speed: me.speed, pins: me.pins } : null
    };
  }

  // HUD 스냅샷 — 값이 실제로 바뀔 때만 onHud 호출 (프레임마다 setState 금지)
  pushHud() {
    const me = this.me();
    if (!me || !this.opts.onHud) return;
    const g = this.g;
    const botsAlive = g.ents.filter((e) => e.isBot && (e.state === 'alive' || e.state === 'trapped')).length;
    const clockSec = Math.max(0, this.matchSeconds - Math.floor((performance.now() - g.start) / 1000));
    const hud = {
      maxBalloons: me.maxBalloons, power: me.power, speed: me.speed, pins: me.pins,
      botsAlive, clockSec, mapName: g.theme.name
    };
    const l = this.lastHud;
    if (!l || Object.keys(hud).some((k) => hud[k] !== l[k])) {
      this.lastHud = hud;
      this.opts.onHud(hud);
    }
  }
}
