// 휴대폰 실태 — 터치 기기 모사(iPhone 13 세로 · 가로, Pixel 7)로 열어 무엇이 보이고 무엇을 못 하는지 기록.
// 탭으로 화면을 넘기고, 게임 안에서 탭 · 스와이프 · 길게 누르기가 무엇을 하는지(=아무것도 안 하는지) 엔진 상태로 확인한다.
// 실행: node docs/upgrade/qa/mobile.mjs --url <URL> --label <이름> [--engine chromium|webkit]
import path from 'node:path';
import { createRequire } from 'node:module';
import { devices, args, shot, collectErrors, ENGINE_PROBE, writeJson, sleep } from './lib.mjs';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || '/Users/kyb-ontact/sonix/toy/dokkaebi-quest/node_modules/playwright');
const A = args({ url: 'http://127.0.0.1:5310', label: 'local', engine: 'chromium', out: path.join(path.dirname(new URL(import.meta.url).pathname), 'out') });
const OUT = path.join(A.out, 'mobile', A.label + '-' + A.engine);
const BASE = A.url.replace(/\/$/, '');
const browser = await pw[A.engine].launch();
const R = { url: BASE, engine: A.engine, at: new Date().toISOString(), devices: [] };

const cases = [
  ['iphone13-portrait', devices['iPhone 13']],
  ['iphone13-landscape', devices['iPhone 13 landscape']],
  ['pixel7-portrait', devices['Pixel 7']]
];

for (const [name, dev] of cases) {
  const { defaultBrowserType, ...d } = dev; void defaultBrowserType;
  const ctx = await browser.newContext({ ...d });
  const page = await ctx.newPage();
  const errs = collectErrors(page);
  await page.addInitScript(ENGINE_PROBE);
  await page.addInitScript(() => {
    window.__ac = [];
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const Wrapped = function (...a) { const c = new AC(...a); window.__ac.push(c); return c; };
      Wrapped.prototype = AC.prototype;
      window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    }
  });
  const dir = path.join(OUT, name);
  const row = { name, viewport: d.viewport, notes: [] };
  await page.goto(BASE + '/?bots=3&t=180', { waitUntil: 'networkidle' });
  await sleep(300);
  row.title = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth, vw: innerWidth, scrollH: document.documentElement.scrollHeight, vh: innerHeight,
    pcOnlyNotice: /키보드|PC|데스크톱|터치/.test(document.body.innerText),
    minFontPx: Math.min(...[...document.querySelectorAll('body *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))),
    titleRect: (() => { const t = [...document.querySelectorAll('div')].find((e) => e.textContent === '물풍선 대작전'); const r = t && t.getBoundingClientRect(); return r && { left: Math.round(r.left), right: Math.round(r.right) }; })()
  }));
  await shot(page, path.join(dir, '1-title.png'));
  // 탭으로 진행. 탭이 다른 요소에 가로막히면(가로 넘침으로 레이아웃 뷰포트가 넓어진 경우 등) 기록하고 DOM click 으로 넘어간다
  row.tapBlocked = [];
  const tapOr = async (loc, label) => {
    try { await loc.tap({ timeout: 4000 }); } catch { row.tapBlocked.push(label); await loc.evaluate((el) => el.click()); }
  };
  await tapOr(page.getByRole('button', { name: '게임 시작' }), '게임 시작');
  await sleep(300);
  await tapOr(page.locator('.pick-card').nth(2), '캐릭터 카드'); // 카드 탭으로 고르기
  row.cardTapSelects = await page.evaluate(() => getComputedStyle(document.querySelectorAll('.pick-card')[2]).borderColor);
  await shot(page, path.join(dir, '2-select.png'));
  await tapOr(page.getByRole('button', { name: '다음' }), '다음');
  await sleep(300);
  await shot(page, path.join(dir, '3-map.png'));
  await tapOr(page.getByRole('button', { name: '입장' }), '입장');
  await page.waitForFunction(() => window.__wbaEngine && window.__wbaEngine());
  await sleep(800);
  row.audio = await page.evaluate(() => window.__ac.map((c) => c.state));
  const canvas = page.locator('canvas').nth(1);
  const box = await canvas.boundingBox();
  row.canvas = { cssW: Math.round(box.width), cssH: Math.round(box.height), aspect: +(box.width / box.height).toFixed(3), expected: +(15 / 13).toFixed(3),
    touchAction: await canvas.evaluate((c) => getComputedStyle(c).touchAction), inView: box.y >= 0 && box.y + box.height <= d.viewport.height };
  row.game = await page.evaluate(() => {
    const hud = document.querySelector('.pixel-panel').getBoundingClientRect();
    return { scrollY: Math.round(scrollY), hudTop: Math.round(hud.top), hudBottom: Math.round(hud.bottom), scrollH: document.documentElement.scrollHeight, vh: innerHeight, onScreenControls: document.querySelectorAll('[data-touch], .dpad, .touch-pad').length };
  });
  await shot(page, path.join(dir, '4-game.png'));
  const st0 = await page.evaluate(() => { const s = window.__wbaState(); return { me: s.ents[0], balloons: s.balloons.filter((b) => b.owner === 0).length }; });
  // 탭 · 스와이프 · 길게 누르기
  await canvas.tap({ position: { x: box.width * 0.5, y: box.height * 0.5 }, timeout: 4000 }).catch(() => row.tapBlocked.push('캔버스'));
  await sleep(300);
  const cx = box.x + box.width * 0.2, cy = box.y + box.height * 0.2;
  const cdp = A.engine === 'chromium' ? await ctx.newCDPSession(page) : null;
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 20, y: cy }] }); await sleep(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
    await sleep(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await sleep(300);
  const st1 = await page.evaluate(() => { const s = window.__wbaState(); return { me: s.ents[0], balloons: s.balloons.filter((b) => b.owner === 0).length }; });
  row.touchEffect = { moved: Math.round(Math.hypot(st1.me.x - st0.me.x, st1.me.y - st0.me.y)), balloonsPlaced: st1.balloons - st0.balloons };
  // 손을 놓고 가만히 있으면 몇 초 만에 지나 (터치 기기 사용자의 실제 경험)
  const t0 = Date.now();
  await page.waitForFunction(() => window.__wbaEngine().finished, null, { timeout: 120000 }).catch(() => {});
  row.idleOutcome = { kind: await page.evaluate(() => window.__wbaEngine().finished), sec: Math.round((Date.now() - t0) / 1000) + 1 };
  await sleep(500);
  row.result = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].map((x) => { const r = x.getBoundingClientRect(); return { t: x.innerText.replace(/\n/g, ''), w: Math.round(r.width), h: Math.round(r.height), lines: Math.round(r.height / parseFloat(getComputedStyle(x).lineHeight || 20)) }; }); return b; });
  await shot(page, path.join(dir, '5-result.png'));
  row.errors = errs;
  R.devices.push(row);
  console.log(`${name.padEnd(20)} title hOverflow=${row.title.scrollW > row.title.vw} titleRect=${JSON.stringify(row.title.titleRect)} canvas ${row.canvas.cssW}x${row.canvas.cssH} aspect ${row.canvas.aspect}/${row.canvas.expected} hudTop=${row.game.hudTop} touchMoved=${row.touchEffect.moved} touchBalloons=${row.touchEffect.balloonsPlaced} idle→${row.idleOutcome.kind} ${row.idleOutcome.sec}s audio=${row.audio} tapBlocked=[${row.tapBlocked}] layoutW=${row.title.vw} errors=${errs.length}`);
  await ctx.close();
}
await browser.close();
writeJson(path.join(OUT, 'mobile.json'), R);
console.log(`→ ${path.join(OUT, 'mobile.json')}`);
