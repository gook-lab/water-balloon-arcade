// 로딩 측정(node tools/title-measure.mjs [URL])
// 느린 망(1.6Mbps · 150ms)에서 첫 그림(FCP) · 타이틀 시작 버튼 표시 시각을 잰다. 3회 중앙값.
import { chromium } from '../docs/upgrade/qa/lib.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:5343';
const browser = await chromium.launch();
const rows = [];
for (let i = 0; i < 3; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
  const t0 = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'commit' });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === '한 판 하기'), null, { timeout: 60000, polling: 50 });
  const tStart = Date.now() - t0;
  await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 60000, polling: 50 });
  const tBootGone = Date.now() - t0;
  await page.waitForLoadState('networkidle');
  const m = await page.evaluate(() => {
    const p = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
    const bytes = performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) + (performance.getEntriesByType('navigation')[0]?.transferSize || 0);
    return { fcp: p ? Math.round(p.startTime) : null, kb: Math.round(bytes / 1024) };
  });
  rows.push({ fcp: m.fcp, startButton: tStart, titleShown: tBootGone, kb: m.kb });
  await ctx.close();
}
await browser.close();
const med = (k) => rows.map((r) => r[k]).sort((a, b) => a - b)[1];
console.log(JSON.stringify({ base: BASE, runs: rows, median: { fcp: med('fcp'), startButton: med('startButton'), titleShown: med('titleShown'), kb: med('kb') } }));
