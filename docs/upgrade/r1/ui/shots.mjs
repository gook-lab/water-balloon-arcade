// 화면 담당 1라운드 자기 확인 — 세 크기 흐름 · 가로 넘침 · 판 비율 · 결과 버튼 한 줄 · 키보드 고르기 · 축소 모션 · 첫 판 말풍선.
// 사용: node docs/upgrade/r1/ui/shots.mjs --url http://127.0.0.1:5322
// 결과: docs/upgrade/r1/ui/out/*.png (1280px 이하) + report.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, args, shot, ensureDir, collectErrors, ENGINE_PROBE } from '../../qa/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { url = 'http://127.0.0.1:5322' } = args();
const OUT = ensureDir(path.join(here, 'out'));

const SIZES = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'landscape', viewport: { width: 844, height: 390 }, touch: true },
  { name: 'portrait', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'narrow-desktop', viewport: { width: 700, height: 900 } }
];

const layout = () => {
  const d = document.documentElement;
  const cv = document.querySelector('.game-canvas');
  const r = cv && cv.getBoundingClientRect();
  return {
    scrollW: d.scrollWidth, clientW: d.clientWidth, overflowX: d.scrollWidth - d.clientWidth,
    scrollY: window.scrollY,
    board: r ? { w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(3), top: Math.round(r.top), bottom: Math.round(r.bottom) } : null,
    hudTop: (() => { const h = document.querySelector('.pixel-panel'); return h ? Math.round(h.getBoundingClientRect().top) : null; })()
  };
};

const resultButtons = () => [...document.querySelectorAll('.game-frame button')].map((b) => {
  const cs = getComputedStyle(b);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
  const inner = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  return { text: b.textContent, oneLine: inner < lh * 1.6, h: b.clientHeight };
});

async function flow(browser, size, report) {
  const ctx = await browser.newContext({
    viewport: size.viewport,
    deviceScaleFactor: 1,
    ...(size.touch ? { hasTouch: true, isMobile: true } : {})
  });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
  const page = await ctx.newPage();
  const errs = collectErrors(page);
  const r = { size: size.name };
  await page.goto(url + '/?t=4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  r.title = await page.evaluate(layout);
  r.title.touchNotice = await page.locator('.touch-notice').count();
  r.title.legendItems = await page.locator('.item-legend-row').count();
  r.title.touchPop = await page.getByText('갇힌 상대를 건드리면 바로 터져요').count();
  await shot(page, path.join(OUT, `${size.name}-1-title.png`), { fullPage: true });

  await page.getByRole('button', { name: '한 판 하기' }).click();
  await page.waitForTimeout(300);
  r.select = await page.evaluate(layout);
  await shot(page, path.join(OUT, `${size.name}-2-select.png`), { fullPage: true });
  await page.getByRole('button', { name: '다음' }).click();
  await page.waitForTimeout(300);
  r.map = await page.evaluate(layout);
  await shot(page, path.join(OUT, `${size.name}-3-map.png`), { fullPage: true });
  // 작은 화면에서 맨 아래 버튼까지 내려 누른다(스크롤된 채 들어가도 게임은 맨 위에서 시작해야 함)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.waitForTimeout(700);
  r.game = await page.evaluate(layout);
  r.game.tip = await page.locator('.first-tip').count();
  await shot(page, path.join(OUT, `${size.name}-4-game.png`));
  // 엔진 가지가 합쳐진 판이면 일시정지 화면도 본다(Esc)
  await page.waitForTimeout(3300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (await page.locator('.pause-overlay').count()) {
    r.pause = { ...(await page.evaluate(layout)), buttons: await page.evaluate(resultButtons) };
    await shot(page, path.join(OUT, `${size.name}-4b-pause.png`));
    await page.keyboard.press('Escape');
  }
  await page.waitForSelector('.game-frame button', { timeout: 15000 });
  await page.waitForTimeout(500);
  r.result = await page.evaluate(layout);
  r.result.buttons = await page.evaluate(resultButtons);
  await shot(page, path.join(OUT, `${size.name}-5-result.png`));
  r.errors = errs;
  report.push(r);
  await ctx.close();
}

async function keyboard(browser, report) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '한 판 하기' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  // 첫 Tab 은 고른 캐릭터 카드에 닿아야 한다
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => ({ role: document.activeElement.getAttribute('role'), label: document.activeElement.getAttribute('aria-label') }));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const afterArrows = await page.evaluate(() => [...document.querySelectorAll('[role=radio]')].map((e) => e.getAttribute('aria-checked')));
  const focusedAfter = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
  await shot(page, path.join(OUT, 'keyboard-char-focus.png'));
  await page.keyboard.press('End');
  const afterEnd = await page.evaluate(() => [...document.querySelectorAll('[role=radio]')].findIndex((e) => e.getAttribute('aria-checked') === 'true'));
  // 다음 → 맵: Tab 2번(뒤로 → 다음) 후 Enter
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');
  const mapChecked = await page.evaluate(() => [...document.querySelectorAll('[role=radio]')].findIndex((e) => e.getAttribute('aria-checked') === 'true'));
  const mapH1 = await page.evaluate(() => document.querySelector('h1')?.textContent);
  await shot(page, path.join(OUT, 'keyboard-map-focus.png'));
  const struct = await page.evaluate(() => ({ main: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length }));
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const game = await page.evaluate(() => ({
    main: document.querySelectorAll('main').length,
    h1: document.querySelector('h1')?.textContent,
    canvasLabel: document.querySelector('.game-canvas')?.getAttribute('aria-label')
  }));
  report.push({ keyboard: { first, afterArrows, focusedAfter, afterEnd, mapChecked, mapH1, struct, game } });
  await ctx.close();
}

async function motion(browser, report) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const title = await page.evaluate(() => document.getAnimations().length);
  await page.getByRole('button', { name: '한 판 하기' }).click();
  await page.waitForTimeout(300);
  const select = await page.evaluate(() => document.getAnimations().length);
  report.push({ reducedMotion: { titleAnimations: title, selectAnimations: select } });
  await ctx.close();
}

// 물줄기 범위 · 경고 촬영 + 첫 판 말풍선 한 번만
async function range(browser, report) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(ENGINE_PROBE);
  const page = await ctx.newPage();
  await page.goto(url + '/?bots=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '한 판 하기' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.waitForTimeout(800);
  const tip1 = await page.locator('.first-tip').count();
  // 엔진이 카운트다운을 붙이면 그동안 설치가 막힐 수 있어 엔진 상태에 직접 풍선을 놓는다(촬영용)
  await page.evaluate(() => {
    const e = window.__wbaEngine();
    const me = e.g.ents[0];
    me.state = 'alive';
    e.g.balloons.push({ tx: 2, ty: 0, owner: 9, at: performance.now(), power: 2 });
    e.g.balloons.push({ tx: 0, ty: 2, owner: 9, at: performance.now() - 2150, power: 2 });
  });
  await page.waitForTimeout(150);
  await shot(page, path.join(OUT, 'range-normal-and-hot.png'), { clip: await page.locator('.game-frame').boundingBox() });
  await page.waitForTimeout(3000);
  // 다시 하기 / 새로 고침 뒤에는 말풍선이 없다
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '한 판 하기' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.waitForTimeout(800);
  const tip2 = await page.locator('.first-tip').count();
  report.push({ firstTip: { firstGame: tip1, secondGame: tip2 } });
  await ctx.close();
}

const browser = await chromium.launch();
const report = [];
for (const s of SIZES) await flow(browser, s, report);
await keyboard(browser, report);
await motion(browser, report);
await range(browser, report);
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));

