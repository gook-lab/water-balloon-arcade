// 게임 규칙 순수 함수. 첫 인자로 game 상태 객체를 받는다.
// engine.js 와 ai.js 가 공유한다 (원본 class 메서드 → 순환 import 를 피하기 위해 분리).
import { NX, NY, key, clamp } from './constants.js';

export function tileOf(game, e) {
  const T = game.T;
  return [Math.floor(e.x / T), Math.floor(e.y / T)];
}

export function balloonAt(game, x, y) {
  return game.balloons.find((b) => b.tx === x && b.ty === y);
}

export function solidFor(game, e, x, y) {
  if (x < 0 || y < 0 || x >= NX || y >= NY) return true;
  const c = game.grid[y][x];
  if (c === 'hard') return true;
  if (c === 'soft' || c === 'tough') return !e.passBlock;
  const b = balloonAt(game, x, y);
  if (b) return e.ignore.has(key(x, y)) ? false : !e.passBalloon;
  return false;
}

export function blastTiles(game, b) {
  const out = [key(b.tx, b.ty)];
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
    for (let i = 1; i <= b.power; i++) {
      const x = b.tx + dx * i, y = b.ty + dy * i;
      if (x < 0 || y < 0 || x >= NX || y >= NY) break;
      const c = game.grid[y][x];
      if (c === 'hard') break;
      out.push(key(x, y));
      if (c === 'soft' || c === 'tough') break;
    }
  });
  return out;
}

export function tryPlace(game, e) {
  if (!e || e.state !== 'alive') return;
  const [tx, ty] = tileOf(game, e);
  if (balloonAt(game, tx, ty)) return;
  if (game.balloons.filter((b) => b.owner === e.id).length >= e.maxBalloons) return;
  game.balloons.push({ tx, ty, owner: e.id, at: performance.now(), power: e.power });
  game.ents.forEach((o) => {
    const [ox, oy] = tileOf(game, o);
    if (ox === tx && oy === ty) o.ignore.add(key(tx, ty));
  });
}

export function spawnParts(game, kind, cx, cy, n, color) {
  const T = game.T;
  if (!game.parts || game.parts.length > 260) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (0.25 + Math.random() * 0.85) * T;
    const rise = kind === 'rise', dust = kind === 'dust';
    game.parts.push({
      x: cx, y: cy,
      vx: dust ? (Math.random() - 0.5) * T * 0.3 : Math.cos(a) * sp,
      vy: rise ? -(0.35 + Math.random() * 0.5) * T : dust ? -T * 0.12 : Math.sin(a) * sp - T * 0.45,
      gr: rise || dust ? 0 : 2.4 * T,
      life: 0, max: rise ? 0.85 : dust ? 0.3 : 0.4 + Math.random() * 0.35,
      size: 1 + Math.floor(Math.random() * 2), color
    });
  }
}

// 이동 속도 공식: (2.3 + 0.42 * (speed - 1)) * tile * (느림이면 0.45) px/s
export function moveEnt(game, e, vx, vy, dt) {
  if (!vx && !vy) return;
  const T = game.T;
  const slow = performance.now() < e.slowUntil ? 0.45 : 1;
  const sp = (2.3 + 0.42 * (e.speed - 1)) * T * slow * dt;
  const len = Math.hypot(vx, vy) || 1;
  const dx = (vx / len) * sp, dy = (vy / len) * sp, h = e.r;
  const free = (nx, ny) => {
    const x0 = Math.floor((nx - h) / T), x1 = Math.floor((nx + h) / T);
    const y0 = Math.floor((ny - h) / T), y1 = Math.floor((ny + h) / T);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (solidFor(game, e, x, y)) return false;
    return true;
  };
  let moved = false;
  if (dx && free(e.x + dx, e.y)) { e.x += dx; moved = true; }
  if (dy && free(e.x, e.y + dy)) { e.y += dy; moved = true; }
  // 봄버맨식 레인 정렬: 한 축으로만 이동할 때 수직 축을 타일 중앙으로 끌어당긴다
  // → 캐릭터가 항상 칸 정중앙 레인을 타고 움직인다 (칸 안 상하 유영 방지)
  if (moved) {
    if (vx && !vy) {
      const cy = (Math.floor(e.y / T) + 0.5) * T;
      const ny = e.y + clamp(cy - e.y, -sp, sp);
      if (ny !== e.y && free(e.x, ny)) e.y = ny;
    } else if (vy && !vx) {
      const cx = (Math.floor(e.x / T) + 0.5) * T;
      const nx = e.x + clamp(cx - e.x, -sp, sp);
      if (nx !== e.x && free(nx, e.y)) e.x = nx;
    }
  }
  if (moved) {
    e.walk += (sp / T) * 8;
    const now = performance.now();
    const fast = e.speed >= 5 && now >= e.slowUntil;
    if (fast) {
      e.trail = e.trail || [];
      e.trail.push({ x: e.x, y: e.y, dir: e.dir });
      if (e.trail.length > 3) e.trail.shift();
      if (now - (e.dustAt || 0) > 60) {
        e.dustAt = now;
        spawnParts(game, 'dust', e.x - dx * T * 0.06, e.y + T * 0.28, 2, 'rgba(255,255,255,.8)');
      }
    } else if (e.trail) {
      e.trail = null;
    }
  }
  if (Math.abs(dx) > Math.abs(dy)) e.dir = dx > 0 ? 'right' : 'left';
  else if (dy) e.dir = dy > 0 ? 'down' : 'up';
  e.ignore.forEach((k) => {
    const [bx, by] = k.split(',').map(Number);
    const ov = e.x + h > bx * T && e.x - h < (bx + 1) * T && e.y + h > by * T && e.y - h < (by + 1) * T;
    if (!ov) e.ignore.delete(k);
  });
}
