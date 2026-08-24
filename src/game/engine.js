// GameEngine — React와 무관한 순수 JS 게임 엔진.
// 게임 루프(rAF + 80ms 폴백 타이머)와 상태를 소유하고, HUD 값이 바뀔 때만 onHud 콜백을 부른다.
import { NX, NY, FUSE, WATER_MS, TRAP_MS, ITEM_POOL, key, clamp } from './constants.js';
import { CHARS } from './characters.js';
import { MAPS, buildMap } from './maps.js';
import { tileOf, balloonAt, blastTiles, tryPlace, moveEnt, spawnParts } from './rules.js';
import { driveBot } from './ai.js';
import { draw } from './renderer.js';

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
      items: new Map(), balloons: [], water: new Map(), ents, parts: [], pops: [],
      start: performance.now(), last: performance.now(), dirty: true, layer: null
    };
    if (this.canvas) { this.canvas.width = NX * T; this.canvas.height = NY * T; }

    // 물리 키 기준 정규화 — 한글 IME 모드에서 e.key 가 'ㅌ'/'Process' 로 들어와도
    // WASD·X 가 동작하도록 e.code(KeyW 등)를 우선한다.
    const keyName = (e) => {
      if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
      if (e.code === 'Space') return ' ';
      return e.key.toLowerCase();
    };
    this.onKeyDown = (e) => {
      const k = keyName(e);
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      if (this.keys[k]) return;
      this.keys[k] = true;
      if (!this.finished) {
        if (k === ' ') {
          const n = this.g.balloons.length;
          tryPlace(this.g, this.me());
          if (this.g.balloons.length > n) this.sound('place');
        }
        if (k === 'x') this.usePin(this.me());
      }
    };
    this.onKeyUp = (e) => { this.keys[keyName(e)] = false; };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // 탭 비활성 시 rAF가 멈추므로 80ms 폴백 타이머 유지 (원본 tick 구조)
    this.timer = setInterval(() => {
      if (performance.now() - this.lastTick > 150) this.tick();
    }, 80);
    this.loop();
    this.pushHud();
  }

  stop() {
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
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
    const dt = Math.min(0.05, (now - g.last) / 1000);
    g.last = now;
    if (!this.finished) {
      g.balloons.slice().forEach((b) => { if (now - b.at > FUSE) this.burst(b); });
      g.water.forEach((at, k) => { if (now - at > WATER_MS) g.water.delete(k); });
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
            this.sound('trapped');
            spawnParts(g, 'splash', e.x, e.y, 14, '#bfefff');
          }
        } else if (e.state === 'trapped') {
          if (now - (e.bubAt || 0) > 160) {
            e.bubAt = now;
            spawnParts(g, 'rise', e.x + (Math.random() - 0.5) * g.T * 0.5, e.y + g.T * 0.1, 1, 'rgba(255,255,255,.85)');
          }
          // 갇힌 상태에서 물을 다시 맞으면 즉시 탈락
          if (wa !== undefined && wa > e.trappedAt + 150) this.kill(e);
          else if (now - e.trappedAt > TRAP_MS) this.kill(e);
        }
      });
      // 갇힌 상대 터치 → 즉시 터뜨리기 (클래식 규칙)
      g.ents.forEach((a) => {
        if (a.state !== 'alive') return;
        g.ents.forEach((t2) => {
          if (t2 === a || t2.state !== 'trapped') return;
          if (Math.abs(a.x - t2.x) < g.T * 0.6 && Math.abs(a.y - t2.y) < g.T * 0.6) this.kill(t2);
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
    blastTiles(g, b).forEach((k) => {
      g.water.set(k, now);
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
    if (!e.isBot) this.sound(it === 'turtle' ? 'itemBad' : 'itemGood');
    if (it === 'balloon') e.maxBalloons = Math.min(8, e.maxBalloons + 1);
    else if (it === 'power') e.power = Math.min(8, e.power + 1);
    else if (it === 'speed') e.speed = Math.min(7, e.speed + 1);
    else if (it === 'needle') e.pins = Math.min(5, e.pins + 1);
    else if (it === 'passBalloon') e.passBalloon = true;
    else if (it === 'passBlock') e.passBlock = true;
    else if (it === 'turtle') e.slowUntil = performance.now() + 7000;
  }

  kill(e) {
    e.state = 'dying'; e.dieAt = performance.now(); e.trail = null;
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
    this.sound(kind); // 'win' | 'lose' | 'draw'
    if (this.opts.onFinish) this.opts.onFinish(kind);
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
