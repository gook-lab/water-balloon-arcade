// 확인 촬영(node tools/title-check.mjs, 레포 루트 · 미리보기 서버 5343) — 타이틀 세 크기, 로딩 화면(정상 · 느린 망 · 실패), 404. 결과는 docs/art/key-art-src/check/
import path from 'node:path';
import { chromium, shot, SIZES, sleep } from '../docs/upgrade/qa/lib.mjs';
const BASE = 'http://127.0.0.1:5343';
const OUT = path.resolve('docs/art/key-art-src/check');
const browser = await chromium.launch();
const report = {};
for (const [name, vp] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await sleep(900);
  report['title-' + name] = await page.evaluate(() => {
    const st = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '한 판 하기').getBoundingClientRect();
    const over = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map((el) => el.className || el.tagName).slice(0, 5);
    return { scrollW: document.documentElement.scrollWidth, vw: innerWidth, scrollH: document.documentElement.scrollHeight, vh: innerHeight, startBottom: Math.round(st.bottom), bootGone: !document.getElementById('boot'), over };
  });
  report['title-' + name].errs = errs;
  await shot(page, path.join(OUT, `title-${vp.width}x${vp.height}.png`));
  if (name !== 'desktop') await shot(page, path.join(OUT, `title-${vp.width}x${vp.height}-full.png`), { fullPage: true });
  await ctx.close();
}
// 로딩 화면 — 진입 스크립트를 붙잡아 둔 채 촬영, 15초 뒤 느린 망 안내
{
  const ctx = await browser.newContext({ viewport: SIZES.desktop });
  const page = await ctx.newPage();
  await page.route('**/assets/*.js', () => {}); // 응답하지 않음
  await page.goto(BASE + '/', { waitUntil: 'commit' });
  await page.waitForSelector('#boot');
  await sleep(600);
  await shot(page, path.join(OUT, 'loading-1440x900.png'));
  await sleep(15200);
  report.slow = await page.evaluate(() => ({ cls: document.getElementById('boot').className, help: getComputedStyle(document.querySelector('.boot-help')).display }));
  await shot(page, path.join(OUT, 'loading-slow-1440x900.png'));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: SIZES.portrait });
  const page = await ctx.newPage();
  await page.route('**/assets/*.js', (r) => r.fulfill({ status: 404, body: 'nope' }));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await sleep(800);
  report.fail = await page.evaluate(() => ({ cls: document.getElementById('boot').className, text: document.querySelector('.boot-help-text').textContent }));
  await shot(page, path.join(OUT, 'loading-fail-390x844.png'));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: SIZES.desktop, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await shot(page, path.join(OUT, 'loading-nojs-1440x900.png'));
  await page.goto(BASE + '/404.html', { waitUntil: 'load' });
  await sleep(600);
  await shot(page, path.join(OUT, '404-1440x900.png'));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: SIZES.portrait, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/404.html', { waitUntil: 'load' });
  await sleep(600);
  report['404-portrait'] = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, vw: innerWidth }));
  await shot(page, path.join(OUT, '404-390x844.png'));
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 1));
