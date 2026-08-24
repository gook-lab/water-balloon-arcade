// 원본: 물풍선 대작전.dc.html drawStatic / draw / drawParts / drawMapPreview.
// 정적 레이어(바닥+블록)는 game.layer 오프스크린 캔버스에 캐시하고 dirty 플래그로만 다시 그린다.
import { NX, NY, S, FUSE, WATER_MS, TRAP_MS, key, clamp } from './constants.js';
import { layoutHard } from './maps.js';
import { charSprite, blockSprite, decoSprite, itemSprite, balloonSprite, waterSprite, bubbleSprite } from './sprites.js';

// 바닥 텍스처 (dragon-game PixelLab 타일 재사용) — 비동기 로드, 로드 완료 시 dirty 재렌더
const floorTexCache = new Map();
function floorTexRec(theme) {
  if (!theme.floorTex) return null;
  let rec = floorTexCache.get(theme.id);
  if (!rec) {
    const img = new Image();
    rec = { img, loaded: false };
    img.onload = () => { rec.loaded = true; };
    img.src = theme.floorTex.url;
    floorTexCache.set(theme.id, rec);
  }
  return rec;
}

export function drawStatic(game) {
  const T = game.T, th = game.theme;
  if (!game.layer) {
    game.layer = document.createElement('canvas');
    game.layer.width = NX * T;
    game.layer.height = NY * T;
  }
  const ctx = game.layer.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const u = T / S;
  const rec = floorTexRec(th);
  const useTex = !!(rec && rec.loaded);
  game.floorTexApplied = useTex;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    if (useTex) {
      const ft = th.floorTex;
      ctx.drawImage(rec.img, ft.sx, ft.sy, ft.sw, ft.sh, x * T, y * T, T, T);
      if ((x + y) % 2) { // 체커 가독성 유지 (칸 경계 인지)
        ctx.fillStyle = 'rgba(0,0,0,.07)';
        ctx.fillRect(x * T, y * T, T, T);
      }
      continue;
    }
    ctx.fillStyle = (x + y) % 2 ? th.g1 : th.g2;
    ctx.fillRect(x * T, y * T, T, T);
    if (th.id === 'ruins') { // 이끼 얼룩
      const seed = (x * 7 + y * 13) % 5;
      ctx.fillStyle = 'rgba(46,84,58,.25)';
      ctx.fillRect(x * T + (3 + seed * 2) * u, y * T + (4 + seed) * u, 2 * u, u);
      ctx.fillRect(x * T + (10 - seed) * u, y * T + (11 - (seed % 3)) * u, u, 2 * u);
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,.07)';
    const seed = (x * 7 + y * 13) % 5;
    ctx.fillRect(x * T + (2 + seed * 3) * u, y * T + (3 + seed) * u, u, u);
    ctx.fillRect(x * T + (11 - seed) * u, y * T + (10 + (seed % 3)) * u, u, u);
  }
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const k = key(x, y), c = game.grid[y][x];
    if (c === 'empty') {
      if (game.deco.has(k)) ctx.drawImage(decoSprite(th, game.deco.get(k)), x * T, y * T, T, T);
      continue;
    }
    ctx.drawImage(blockSprite(th, c, game.vars.get(k) || 0), x * T, y * T, T, T);
  }
  game.dirty = false;
}

export function drawParts(ctx, game, below) {
  const u = game.T / S;
  if (!game.parts) return;
  game.parts.forEach((p) => {
    if ((p.gr === 0) !== below) return;
    ctx.globalAlpha = clamp(1 - p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x / u) * u, Math.round(p.y / u) * u, p.size * u, p.size * u);
  });
  ctx.globalAlpha = 1;
}

export function draw(game, cv) {
  if (!cv || !game) return;
  const T = game.T, now = performance.now();
  if (cv.width !== NX * T) { cv.width = NX * T; cv.height = NY * T; game.dirty = true; }
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (game.theme.floorTex && !game.floorTexApplied) {
    const rec = floorTexRec(game.theme);
    if (rec && rec.loaded) game.dirty = true; // 텍스처 로드 완료 → 정적 레이어 재렌더
  }
  if (game.dirty || !game.layer) drawStatic(game);
  ctx.drawImage(game.layer, 0, 0);

  game.items.forEach((it, k) => {
    const [x, y] = k.split(',').map(Number);
    const bob = Math.round(Math.sin(now / 320 + x + y) * 2) * (T / S);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.fillRect(x * T + T * 0.28, y * T + T * 0.78, T * 0.44, T * 0.1);
    ctx.globalAlpha = 1;
    ctx.drawImage(itemSprite(it, Math.floor(now / 260) % 2), x * T + T * 0.1, y * T + T * 0.06 + bob, T * 0.8, T * 0.8);
  });
  game.balloons.forEach((b) => {
    const t = (now - b.at) / FUSE;
    const hot = t > 0.78 && Math.floor(now / 90) % 2 === 0;
    const grow = 1 + (Math.floor(now / 110) % 2) * 0.06 + t * 0.06;
    const w = T * 0.86 * grow, off = (T - w) / 2;
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.fillRect(b.tx * T + T * 0.22, b.ty * T + T * 0.8, T * 0.56, T * 0.12);
    ctx.globalAlpha = 1;
    ctx.drawImage(balloonSprite(hot ? 1 : 0), b.tx * T + off, b.ty * T + off, w, w);
  });
  game.water.forEach((at, k) => {
    const [x, y] = k.split(',').map(Number);
    const life = (now - at) / WATER_MS;
    const stage = life < 0.18 ? 0 : life < 0.6 ? 2 : 1;
    ctx.globalAlpha = clamp(1 - Math.pow(life, 2.2), 0, 1);
    ctx.drawImage(waterSprite(stage, Math.floor(now / 120) % 2), x * T, y * T, T, T);
    ctx.globalAlpha = 1;
  });

  const order = game.ents.slice().sort((a, b) => a.y - b.y);
  drawParts(ctx, game, true);
  order.forEach((e) => {
    if (e.state === 'dead') return;
    if (e.state === 'dying') {
      const p = clamp((now - e.dieAt) / 820, 0, 1);
      const ww = T * 0.94 * (1 - p * 0.45);
      ctx.save();
      ctx.globalAlpha = p > 0.65 ? clamp((1 - p) / 0.35, 0, 1) : 1;
      ctx.translate(e.x, e.y - T * (0.08 + p * 0.8));
      ctx.rotate(p * Math.PI * 2.4);
      ctx.drawImage(charSprite(e.ch, 'down'), -ww / 2, -ww * 0.5, ww, ww);
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    const w = T * 0.94, u = T / S;
    const bobStep = e.state === 'alive' ? Math.floor(e.walk) % 2 : 0;
    const px = e.x - w / 2 + (e.state === 'trapped' ? Math.round(Math.sin(now / 55)) * u : 0);
    const py = e.y - w * 0.58 - bobStep * u;
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.fillRect(e.x - T * 0.26, e.y + T * 0.3, T * 0.52, T * 0.12);
    ctx.globalAlpha = 1;
    if (!e.isBot) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(e.x - u * 1.5, py - u * 3.5, u * 3, u * 1.2);
      ctx.fillRect(e.x - u * 0.6, py - u * 4.6, u * 1.2, u * 1.2);
    }
    if (e.trail && e.state === 'alive') {
      e.trail.forEach((t, i) => {
        ctx.globalAlpha = 0.1 + i * 0.07;
        const sp2 = charSprite(e.ch, t.dir === 'up' ? 'up' : 'down');
        if (t.dir === 'left') {
          ctx.save(); ctx.translate(t.x + w / 2, t.y - w * 0.58); ctx.scale(-1, 1);
          ctx.drawImage(sp2, 0, 0, w, w); ctx.restore();
        } else ctx.drawImage(sp2, t.x - w / 2, t.y - w * 0.58, w, w);
      });
      ctx.globalAlpha = 1;
    }
    const sp = charSprite(e.ch, e.dir === 'up' ? 'up' : 'down');
    if (e.dir === 'left') {
      ctx.save(); ctx.translate(px + w, py); ctx.scale(-1, 1);
      ctx.drawImage(sp, 0, 0, w, w); ctx.restore();
    } else {
      ctx.drawImage(sp, px, py, w, w);
    }
    if (e.state === 'trapped') {
      const wob = 1 + Math.sin(now / 130) * 0.05;
      const bw = T * 1.16 * wob, p = 1 - (now - e.trappedAt) / TRAP_MS;
      ctx.drawImage(bubbleSprite(), e.x - bw / 2, e.y - bw * 0.55, bw, bw);
      ctx.strokeStyle = p < 0.3 ? '#ff6f91' : '#ffd23f';
      ctx.lineWidth = Math.max(3, T * 0.045);
      ctx.beginPath();
      ctx.arc(e.x, e.y - bw * 0.05, bw * 0.58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(p, 0, 1));
      ctx.stroke();
    }
  });
  drawParts(ctx, game, false);
  game.pops.forEach((p) => {
    const t = (now - p.at) / 340, r = T * (0.25 + t * 0.75), uu = T / S;
    ctx.globalAlpha = clamp(1 - t, 0, 1);
    ctx.fillStyle = '#cdf3ff';
    for (let a = 0; a < 16; a++) {
      const an = (a / 16) * Math.PI * 2;
      ctx.fillRect(Math.round((p.x + Math.cos(an) * r) / uu) * uu, Math.round((p.y + Math.sin(an) * r * 0.8) / uu) * uu, uu, uu);
    }
  });
  ctx.globalAlpha = 1;
}

export function drawMapPreview(cv, theme) {
  const ctx = cv.getContext('2d'), u = 8;
  ctx.imageSmoothingEnabled = false;
  const layout = theme.layout === 'random' ? 'classic' : theme.layout;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    ctx.fillStyle = (x + y) % 2 ? theme.g1 : theme.g2;
    ctx.fillRect(x * u, y * u, u, u);
    if (layoutHard(layout, x, y)) {
      ctx.fillStyle = theme.hard[1]; ctx.fillRect(x * u, y * u, u, u);
      ctx.fillStyle = theme.hard[0]; ctx.fillRect(x * u, y * u, u, u * 0.35);
    }
  }
  if (theme.layout === 'random') {
    ctx.fillStyle = 'rgba(14,18,38,.62)'; ctx.fillRect(0, 0, NX * u, NY * u);
    ctx.fillStyle = '#ffd23f'; ctx.font = "600 26px 'Jua', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', (NX * u) / 2, (NY * u) / 2);
  }
  [[0, 0], [NX - 1, 0], [0, NY - 1], [NX - 1, NY - 1]].forEach(([x, y], i) => {
    ctx.fillStyle = ['#ff6f91', '#7fd8ff', '#ffd23f', '#9ff0b4'][i];
    ctx.fillRect(x * u + 2, y * u + 2, u - 4, u - 4);
  });
}
