// 화면 흐름 스모크 — 세 크기 × (타이틀 → 캐릭터 → 맵 → 게임 → 결과 → 다시 하기 → 맵 바꾸기(옛 맵 변경) → 캐릭터)
// 버튼 이름은 lib.mjs NAMES 후보(새 이름 · 옛 이름)로 찾는다 — 1단계 기준선과 같은 스크립트로 비교.
// + 키보드만으로 끝까지 가기(데스크톱) + 콘솔 오류 · 가로 넘침 · 화면 밖 버튼.
// 실행: node docs/upgrade/qa/smoke.mjs --url http://127.0.0.1:5310 --label local
import path from 'node:path';
import { chromium, SIZES, args, shot, collectErrors, ENGINE_PROBE, clickText, findButton, waitButton, waitPlaying, NAMES, writeJson, sleep } from './lib.mjs';

const A = args({ url: 'http://127.0.0.1:5310', label: 'local', out: path.join(path.dirname(new URL(import.meta.url).pathname), 'out') });
const OUT = path.join(A.out, 'smoke', A.label);
const BASE = A.url.replace(/\/$/, '');

/** 가로 넘침 · 화면 밖(좌우)으로 잘린 버튼/카드 */
async function layoutCheck(page) {
  return page.evaluate(() => {
    const W = window.innerWidth, H = window.innerHeight;
    const doc = document.documentElement;
    const clipped = [];
    document.querySelectorAll('button, .pick-card, canvas, .pixel-panel').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.left < -1 || r.right > W + 1) clipped.push({ el: el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : ''), text: (el.innerText || '').slice(0, 20), left: Math.round(r.left), right: Math.round(r.right) });
    });
    const below = [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().top > H).map((b) => b.innerText);
    const hud = document.querySelector('.pixel-panel'); const hudTop = hud ? Math.round(hud.getBoundingClientRect().top) : null;
    return { vw: W, vh: H, scrollY: Math.round(window.scrollY), hudTop, scrollW: doc.scrollWidth, scrollH: doc.scrollHeight, hOverflow: doc.scrollWidth > W + 1, clipped, buttonsBelowFold: below };
  });
}

async function flow(browser, sizeName) {
  const vp = SIZES[sizeName];
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = collectErrors(page);
  await page.addInitScript(ENGINE_PROBE);
  const res = { size: sizeName, viewport: vp, steps: {} };
  const dir = path.join(OUT, sizeName);
  const t0 = Date.now();
  await page.goto(BASE + '/?t=4&bots=3', { waitUntil: 'networkidle' });
  await sleep(400);
  res.steps.title = await layoutCheck(page); await shot(page, path.join(dir, '1-title.png'), { fullPage: true });
  await clickText(page, NAMES.start); await sleep(350);
  res.steps.select = await layoutCheck(page); await shot(page, path.join(dir, '2-select.png'), { fullPage: true });
  await clickText(page, NAMES.next); await sleep(350);
  res.steps.map = await layoutCheck(page); await shot(page, path.join(dir, '3-map.png'), { fullPage: true });
  await clickText(page, NAMES.enter); await sleep(1200);
  res.steps.game = await layoutCheck(page); await shot(page, path.join(dir, '4-game.png'));
  await page.waitForSelector('text=다시 하기', { timeout: 20000 });
  await sleep(500);
  res.steps.result = await layoutCheck(page);
  res.steps.result.kind = await page.evaluate(() => window.__wbaEngine()?.finished);
  await shot(page, path.join(dir, '5-result.png'));
  await clickText(page, NAMES.restart); await sleep(600);
  res.steps.restart = { resultGone: (await findButton(page, NAMES.restart)) === null, engineFinished: await page.evaluate(() => window.__wbaEngine()?.finished ?? null) };
  await waitButton(page, NAMES.changeMap, 20000);
  res.steps.changeMapName = await clickText(page, NAMES.changeMap); await sleep(300);
  res.steps.toMap = await page.getByRole('heading', { name: NAMES.mapTitle[0] }).count() > 0 || await page.locator('text=' + NAMES.mapTitle[1]).count() > 0;
  await clickText(page, NAMES.enter);
  await waitButton(page, NAMES.changeChar, 20000);
  await sleep(300);
  res.steps.changeCharName = await clickText(page, NAMES.changeChar); await sleep(300);
  res.steps.toChar = await page.getByRole('heading', { name: NAMES.charTitle[0] }).count() > 0 || await page.locator('text=' + NAMES.charTitle[1]).count() > 0;
  await clickText(page, NAMES.back); await sleep(200);
  res.steps.backToTitle = (await findButton(page, NAMES.start)) !== null;
  res.ms = Date.now() - t0;
  res.errors = errs;
  await ctx.close();
  return res;
}

/** 키보드만으로 끝까지 — Tab 순서 · 포커스 표시 · Enter/Space 동작 */
async function keyboardOnly(browser) {
  const ctx = await browser.newContext({ viewport: SIZES.desktop });
  const page = await ctx.newPage();
  const errs = collectErrors(page);
  await page.addInitScript(ENGINE_PROBE);
  await page.goto(BASE + '/?t=4&bots=1', { waitUntil: 'networkidle' });
  const dir = path.join(OUT, 'keyboard');
  const focusInfo = () => page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'BODY' };
    const cs = getComputedStyle(el);
    return { tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 16), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, focusVisible: el.matches(':focus-visible') };
  });
  const order = async (screen, n) => {
    const seq = [];
    for (let i = 0; i < n; i++) { await page.keyboard.press('Tab'); seq.push(await focusInfo()); }
    return { screen, seq };
  };
  const out = { orders: [], notes: [] };
  // 타이틀: Tab 순회 (12번) 후 시작 버튼(「한 판 하기」 · 옛 「게임 시작」)까지 Tab
  out.orders.push(await order('title', 12));
  await shot(page, path.join(dir, 'title-focus.png'));
  await page.goto(BASE + '/?t=4&bots=1', { waitUntil: 'networkidle' });
  let found = false;
  for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); if (NAMES.start.includes((await focusInfo()).text)) { found = true; break; } }
  out.notes.push({ reachStart: found });
  await page.keyboard.press('Enter'); await sleep(300);
  out.afterStartFocus = await focusInfo();
  out.orders.push(await order('select', 4));
  // 캐릭터 카드가 포커스로 잡히는지 (div onClick 이라 안 잡힐 것으로 예상)
  out.charCardFocusable = await page.evaluate(() => [...document.querySelectorAll('.pick-card')].some((c) => c.tabIndex >= 0));
  await shot(page, path.join(dir, 'select-focus.png'));
  // 다음 버튼으로 이동
  for (let i = 0; i < 12; i++) { if ((await focusInfo()).text === '다음') break; await page.keyboard.press('Tab'); }
  await page.keyboard.press('Enter'); await sleep(300);
  out.orders.push(await order('map', 4));
  out.mapCardFocusable = await page.evaluate(() => [...document.querySelectorAll('.pick-card')].some((c) => c.tabIndex >= 0));
  for (let i = 0; i < 12; i++) { if (NAMES.enter.includes((await focusInfo()).text)) break; await page.keyboard.press('Tab'); }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__wbaEngine && window.__wbaEngine());
  out.inGameFocus = await focusInfo();
  await waitPlaying(page);
  await page.waitForSelector('text=다시 하기', { timeout: 20000 });
  await sleep(400);
  out.resultFocusOnOpen = await focusInfo();
  out.orders.push(await order('result', 4));
  await shot(page, path.join(dir, 'result-focus.png'));
  // 결과 화면: Space 로 '다시 하기' 가 눌리는가 (엔진 keydown 이 Space preventDefault)
  for (let i = 0; i < 12; i++) { if ((await focusInfo()).text === '다시 하기') break; await page.keyboard.press('Tab'); }
  const before = await page.evaluate(() => window.__wbaEngine());
  await page.keyboard.press('Space'); await sleep(500);
  out.spaceActivatesRestart = (await page.locator('text=다시 하기').count()) === 0;
  if (!out.spaceActivatesRestart) {
    await page.keyboard.press('Enter'); await sleep(500);
    out.enterActivatesRestart = (await page.locator('text=다시 하기').count()) === 0;
  }
  void before;
  out.errors = errs;
  await ctx.close();
  return out;
}

const browser = await chromium.launch();
const summary = { url: BASE, label: A.label, at: new Date().toISOString(), flows: [], keyboard: null };
for (const s of (A.sizes ? String(A.sizes).split(',') : Object.keys(SIZES))) {
  try { summary.flows.push(await flow(browser, s)); } catch (e) { summary.flows.push({ size: s, fail: String(e).slice(0, 300) }); }
}
try { summary.keyboard = await keyboardOnly(browser); } catch (e) { summary.keyboard = { fail: String(e).slice(0, 300) }; }
await browser.close();
writeJson(path.join(OUT, 'smoke.json'), summary);

// 한 줄 판정 출력
let bad = 0;
for (const f of summary.flows) {
  if (f.fail) { bad++; console.log(`FAIL ${f.size}: ${f.fail}`); continue; }
  const over = Object.entries(f.steps).filter(([, v]) => v && v.hOverflow).map(([k]) => k);
  const clip = Object.entries(f.steps).filter(([, v]) => v && v.clipped && v.clipped.length).map(([k, v]) => `${k}(${v.clipped.length})`);
  const flowOk = f.steps.restart.resultGone && f.steps.toMap && f.steps.toChar && f.steps.backToTitle;
  if (!flowOk || f.errors.length) bad++;
  console.log(`${f.size.padEnd(9)} flow=${flowOk ? 'ok' : 'BROKEN'} result=${f.steps.result.kind} errors=${f.errors.length} hOverflow=[${over}] clipped=[${clip}] ${f.ms}ms`);
}
const k = summary.keyboard;
if (k.fail) console.log('keyboard FAIL', k.fail);
else console.log(`keyboard reachStart=${k.notes[0].reachStart} charCardFocusable=${k.charCardFocusable} mapCardFocusable=${k.mapCardFocusable} resultFocusOnOpen=${k.resultFocusOnOpen.tag} spaceRestart=${k.spaceActivatesRestart} enterRestart=${k.enterActivatesRestart}`);
console.log(`→ ${path.join(OUT, 'smoke.json')}`);
process.exit(bad ? 1 : 0);
