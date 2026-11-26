// 마케팅 그림 촬영 — 실제 게임(엔진 · 렌더러)에서 연출 장면을 만들어 OG · 허브 표지 · 아이콘을 뽑습니다.
// 쓰는 법: 레포 본체에서 `npx vite --port 5313 --strictPort --host 127.0.0.1` 을 띄운 뒤
//   timeout 120 node docs/upgrade/marketing/final/shoot.mjs
// 판은 게임 흐름(타이틀 → 캐릭터 → 맵 → 입장, ?bots=3)으로 들어가고, 엔진 인스턴스를 잡아
// 인물 · 풍선 위치만 놓은 뒤 엔진의 burst() 로 실제로 터뜨립니다. 물줄기가 가장 넓게 퍼진 순간
// performance.now 를 멈춰(dt = 0) 그 장면을 그대로 찍습니다. 난수는 시드로 고정합니다.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/kyb-ontact/sonix/toy/dokkaebi-quest/node_modules/playwright');
const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.WBA_URL || 'http://127.0.0.1:5313';
const SEED = Number(process.env.SEED || 7);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.addInitScript((seed) => {
  let a = seed >>> 0;
  Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.setItem('wba-audio', JSON.stringify({ muted: true, volume: 0.7 })); } catch { /* 무시 */ }
}, SEED);

await page.goto(BASE + '/?bots=3', { waitUntil: 'networkidle' });
// 앱과 같은 모듈 인스턴스(vite dev) 의 start 를 감싸 엔진을 잡습니다
await page.evaluate(async () => {
  const m = await import('/src/game/engine.js');
  const orig = m.GameEngine.prototype.start;
  m.GameEngine.prototype.start = function (...a) { window.__eng = this; return orig.apply(this, a); };
});
await page.getByRole('button', { name: '게임 시작' }).click();
await page.getByRole('button', { name: '다음' }).click();
await page.getByRole('button', { name: '입장' }).click();
await page.waitForFunction(() => window.__eng && window.__eng.g);

// ---- 연출: 초록 들판, 코코(나) · 뭉치(갇힘) · 삐용 · 펭구 ----
await page.evaluate(async () => {
  const { CHARS } = await import('/src/game/characters.js');
  const eng = window.__eng, g = eng.g, T = g.T;
  const ch = (id) => CHARS.find((c) => c.id === id);
  const K = (x, y) => x + ',' + y;
  const set = (x, y, v, variant = 0) => {
    g.grid[y][x] = v; g.vars.delete(K(x, y)); g.deco.delete(K(x, y));
    if (v === 'soft') g.vars.set(K(x, y), variant);
    g.items.delete(K(x, y));
  };
  // 가운데 마당을 비우고(단단한 기둥은 그대로) 테두리에 상자를 둡니다
  for (let y = 2; y <= 10; y++) for (let x = 1; x <= 12; x++) if (g.grid[y][x] !== 'hard') set(x, y, 'empty');
  [[3, 6, 'soft', 1], [4, 6, 'soft', 0], [6, 3, 'soft', 0], [2, 4, 'soft', 1], [2, 7, 'tough'], [10, 3, 'soft', 0],
    [11, 6, 'soft', 1], [11, 8, 'tough'], [3, 9, 'soft', 0], [9, 10, 'soft', 1], [12, 4, 'soft', 0], [2, 9, 'tough']]
    .forEach(([x, y, v, vr]) => set(x, y, v, vr));
  g.items.set(K(10, 5), 'power');
  g.items.set(K(3, 8), 'speed');
  g.items.set(K(8, 8), 'balloon');
  g.balloons.length = 0; g.water.clear(); g.parts.length = 0; g.pops.length = 0;
  g.dirty = true;

  const place = (e, x, y, dir, id) => {
    if (id) e.ch = { ...ch(id), base: e.ch.base };
    e.x = x * T + T / 2; e.y = y * T + T / 2; e.dir = dir; e.walk = 0;
    e.state = 'alive'; e.path = []; e.nextThink = Infinity; e.trail = null;
  };
  const [me, b1, b2, b3] = g.ents;
  place(me, 4, 4, 'down');
  place(b1, 8, 6, 'down', 'penggu');    // 물줄기 끝에서 갇힐 봇(물방울 안에서도 보이게 짙은 색)
  place(b2, 9, 4, 'left', 'ppyong');    // 풍선을 막 놓은 봇
  place(b3, 9, 6, 'left', 'mungchi');   // 갇힌 봇 바로 옆까지 다가온 봇(닿으면 터뜨림)
  const now = performance.now();
  g.balloons.push({ tx: 6, ty: 6, owner: 2, at: now - 2000, power: 2 }); // 터뜨릴 풍선(삐용)
  g.balloons.push({ tx: 8, ty: 4, owner: 2, at: now - 400, power: 1 });  // 삐용이 막 놓은 풍선
  g.balloons.push({ tx: 4, ty: 7, owner: 0, at: now - 2150, power: 1 }); // 곧 터질 내 풍선(주황 깜빡임)
  me.ignore.clear();
  eng.matchSeconds = 999;
  // 물줄기를 실제 엔진 규칙으로 터뜨립니다(상자 부서짐 · 갇힘 판정 포함).
  // 멈출 시각(t0 + 110ms)이 주황 깜빡임이 켜진 프레임(floor(now / 90) 짝수)에 오도록 터뜨리는 순간을 고릅니다
  while (Math.floor((performance.now() + 110) / 90) % 2 === 1) { /* 바쁜 대기, 최대 90ms */ }
  window.__t0 = performance.now();
  eng.burst(g.balloons[0]);
});
// 물줄기가 가장 굵고 아직 진한 순간(life ≈ 0.23, 단계 2 · 불투명도 0.96)으로 시계를 멈춥니다
await page.waitForTimeout(150);
const info = await page.evaluate(() => {
  const t = window.__t0 + 110;
  performance.now = () => t;
  const g = window.__eng.g;
  return { states: g.ents.map((e) => e.ch.id + ':' + e.state), water: g.water.size, items: [...g.items.entries()] };
});
console.log(JSON.stringify(info));
await page.waitForTimeout(120); // 멈춘 시각으로 몇 프레임 더 그리게 둡니다

// 판 그림(T=128, 1920×1664)을 data URL 로 받아 둡니다
const boardUrl = await page.evaluate(() => [...document.querySelectorAll('canvas')].sort((a, b) => b.width - a.width)[0].toDataURL('image/png'));

// ---- 합성 페이지: 같은 페이지(게임 글꼴이 이미 로드됨)에 그립니다 ----
await page.evaluate(async ({ boardUrl }) => {
  const { CHARS } = await import('/src/game/characters.js');
  const { charSprite } = await import('/src/game/sprites.js');
  const img = new Image(); img.src = boardUrl; await img.decode();
  window.__board = img;
  window.__crop = (sx, sy, sw, sh, dw, dh) => { // 타일 좌표(T=128) 기준 자르기, 최근접 확대 · 축소
    const cv = document.createElement('canvas'); cv.width = dw; cv.height = dh;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.drawImage(img, sx * 128, sy * 128, sw * 128, sh * 128, 0, 0, dw, dh);
    return cv;
  };
  window.__chars = (size) => CHARS.map((c) => {
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(charSprite(c, 'down'), 0, 0, size, size);
    return cv;
  });
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#000';
}, { boardUrl });

// OG 1200×630 — 왼쪽 게임 이름 · 훅, 오른쪽 게임 판(타일 80px = 도트 5px)
await page.evaluate(() => {
  const wrap = document.createElement('div');
  wrap.id = 'og';
  wrap.style.cssText = `position:relative;width:1200px;height:630px;overflow:hidden;font-family:var(--font-display);
    background-color:#0e1226;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 2px,transparent 2px 6px),
    radial-gradient(120% 120% at 20% 0%,#2b3566 0%,#141a33 55%,#0e1226 100%);`;
  // 판: 타일 (3.0, 2.9) 부터 7.6 × 6.9 칸 → 608 × 552
  const frame = document.createElement('div');
  frame.style.cssText = 'position:absolute;right:30px;top:27px;padding:8px;border:4px solid #1d2338;border-radius:6px;background:#333f78;box-shadow:inset 0 3px 0 #4a5aa0,0 10px 0 rgba(0,0,0,.45)';
  const board = window.__crop(3.0, 2.9, 7.6, 6.9, 608, 552);
  board.style.cssText = 'display:block;image-rendering:pixelated';
  frame.appendChild(board); wrap.appendChild(frame);
  const left = document.createElement('div');
  left.style.cssText = 'position:absolute;left:48px;top:0;bottom:0;width:490px;display:flex;flex-direction:column;justify-content:center;gap:30px';
  left.innerHTML = `
    <div style="font-size:72px;line-height:1.15;white-space:nowrap;color:#ffd23f;
      text-shadow:4px 0 0 #1d2338,-4px 0 0 #1d2338,0 -4px 0 #1d2338,0 6px 0 #3a4a8f,0 12px 0 rgba(0,0,0,.35)">물풍선 대작전</div>
    <div style="font-size:44px;line-height:1.3;color:#ffffff;text-shadow:0 4px 0 #1d2338">물줄기로 가두고,<br>마지막까지 살아남아요</div>`;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;margin-top:6px';
  window.__chars(64).forEach((cv) => { cv.style.cssText = 'width:64px;height:64px;image-rendering:pixelated'; row.appendChild(cv); });
  left.appendChild(row);
  wrap.appendChild(left);
  document.body.appendChild(wrap);
});
await page.locator('#og').screenshot({ path: path.join(OUT, 'og.png') });

// 허브 표지 800×500 — 판만, 타일 96px(도트 6px). 진열장 360px 폭에서도 인물이 43px 로 보입니다
await page.evaluate(() => {
  document.body.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.id = 'hub';
  wrap.style.cssText = 'width:800px;height:500px;overflow:hidden';
  const board = window.__crop(2.4, 3.55, 800 / 96, 500 / 96, 800, 500);
  board.style.cssText = 'display:block;image-rendering:pixelated';
  wrap.appendChild(board);
  document.body.appendChild(wrap);
});
await page.locator('#hub').screenshot({ path: path.join(OUT, 'hub-cover.png') });

// 확인용 판 전체(1280px 로 줄임)
await page.evaluate(() => {
  document.body.innerHTML = '';
  const cv = window.__crop(0, 0, 15, 13, 960, 832); cv.id = 'full';
  document.body.appendChild(cv);
});
await page.locator('#full').screenshot({ path: path.join(OUT, 'shot-board-full.png') });

// ---- 아이콘: 게임의 물풍선 스프라이트(32×32, balloonSprite(0)) 그대로 ----
const px = await page.evaluate(async () => {
  const { balloonSprite } = await import('/src/game/sprites.js');
  const s = balloonSprite(0);
  window.__ball = s;
  return Array.from(s.getContext('2d').getImageData(0, 0, s.width, s.height).data);
});
// favicon.svg — 같은 줄의 같은 색을 한 사각형으로 묶습니다
const hex = (i) => '#' + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
let rects = '';
for (let y = 0; y < 32; y++) {
  let x = 0;
  while (x < 32) {
    const i = (y * 32 + x) * 4;
    if (px[i + 3] === 0) { x++; continue; }
    const c = hex(i), a = px[i + 3];
    let w = 1;
    while (x + w < 32) { const j = (y * 32 + x + w) * 4; if (hex(j) !== c || px[j + 3] !== a) break; w++; }
    rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"${a < 255 ? ` fill-opacity="${(a / 255).toFixed(2)}"` : ''}/>`;
    x += w;
  }
}
fs.writeFileSync(path.join(OUT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">${rects}</svg>\n`);
// favicon-32.png · apple-touch-icon.png(180, 판 바탕색 위에 4배 · 여백 26px)
await page.evaluate(() => {
  document.body.innerHTML = '';
  const fav = document.createElement('canvas'); fav.width = 32; fav.height = 32;
  fav.getContext('2d').drawImage(window.__ball, 0, 0);
  const at = document.createElement('canvas'); at.width = 180; at.height = 180;
  const c = at.getContext('2d'); c.imageSmoothingEnabled = false;
  c.fillStyle = '#1b2347'; c.fillRect(0, 0, 180, 180);
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(46, 146, 88, 12);   // 게임과 같은 바닥 그림자
  c.drawImage(window.__ball, 26, 22, 128, 128);
  window.__icons = { fav: fav.toDataURL('image/png'), ati: at.toDataURL('image/png') };
});
// 캔버스 픽셀을 그대로 저장합니다(스크린샷은 페이지 바탕이 섞여 투명이 사라짐)
const icons = await page.evaluate(() => window.__icons);
const save = (name, url) => fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
save('favicon-32.png', icons.fav);
save('apple-touch-icon.png', icons.ati);
await browser.close();
