// 성능 기준선 — (1) rAF 간격 fps + 엔진 step 비용(맵 · 봇 수 · 타일 크기별),
// (2) 첫 로딩 전송량 · 시간(캐시 없음, 그대로 / 4G 모사), (3) 긴 판 메모리(GC 뒤 JS 힙 · DOM 노드).
// 실행: node docs/upgrade/qa/perf.mjs --url <URL> --label <이름> [--only fps,load,memory,restart] [--minutes 5.5] [--sec 8]
// 주의: headless Chromium 값이다. 같은 기계의 다른 부하에 흔들리므로 비교는 같은 조건에서 두 번 이상.
import path from 'node:path';
import { chromium, args, collectErrors, ENGINE_PROBE, enterGame, optionButton, NAMES, writeJson, sleep } from './lib.mjs';

const A = args({ url: 'http://127.0.0.1:5310', label: 'local', out: path.join(path.dirname(new URL(import.meta.url).pathname), 'out'), only: 'fps,load,memory,restart', sec: 8, minutes: 5.5 });
const OUT = path.join(A.out, 'perf', A.label);
const BASE = A.url.replace(/\/$/, '');
const ONLY = String(A.only).split(',');
const R = { url: BASE, label: A.label, at: new Date().toISOString(), fps: [], load: [], memory: null };
const browser = await chromium.launch();

// 게임 안 측정기: rAF 간격 + engine.step 소요(인스턴스 메서드 감싸기, 읽기 전용 계측)
const MEASURE = (sec) => new Promise((resolve) => {
  const e = window.__wbaEngine();
  const steps = [];
  const orig = e.step.bind(e);
  e.step = (g) => { const t = performance.now(); orig(g); steps.push(performance.now() - t); };
  const iv = [];
  let last = performance.now();
  const t0 = last;
  const f = () => {
    const now = performance.now(); iv.push(now - last); last = now;
    if (now - t0 < sec * 1000) requestAnimationFrame(f);
    else {
      e.step = orig;
      const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
      const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      resolve({ frames: iv.length, fps: +(1000 / avg(iv)).toFixed(1), p95FrameMs: +q(iv, 0.95).toFixed(1), maxFrameMs: +Math.max(...iv).toFixed(1),
        over20ms: +(100 * iv.filter((x) => x > 20).length / iv.length).toFixed(1), stepAvgMs: +avg(steps).toFixed(2), stepP95Ms: +q(steps, 0.95).toFixed(2),
        parts: e.g.parts.length, alive: e.g.ents.filter((x) => x.state !== 'dead').length, finished: e.finished });
    }
  };
  requestAnimationFrame(f);
});

async function fpsCase(name, query, mapIdx) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(ENGINE_PROBE);
  await page.goto(BASE + '/' + query, { waitUntil: 'networkidle' });
  // 타일 옵션: r1 은 「화질」 줄의 낮음(64) · 보통(128) · 높음(256), 옛 빌드는 「64px」
  if (/tile=/.test(name)) { const t = name.match(/tile=(\d+)/)[1]; await (await optionButton(page, '화질', { 64: '낮음', 128: '보통', 256: '높음' }[t], t + 'px')).click(); }
  await enterGame(page, { mapIdx });
  await sleep(1500);
  const r = await page.evaluate(MEASURE, Number(A.sec));
  R.fps.push({ name, ...r });
  console.log(`fps ${name.padEnd(28)} ${r.fps}fps p95 ${r.p95FrameMs}ms >20ms ${r.over20ms}% step ${r.stepAvgMs}/${r.stepP95Ms}ms alive ${r.alive}${r.finished ? ' (끝남:' + r.finished + ')' : ''}`);
  await ctx.close();
}

if (ONLY.includes('fps')) {
  const names = ['grass', 'beach', 'snow', 'lava', 'factory', 'dungeon', 'ruins'];
  for (let i = 0; i < names.length; i++) await fpsCase(`map=${names[i]} bots=3`, '?bots=3&t=300', i);
  for (const b of [1, 2]) await fpsCase(`map=grass bots=${b}`, `?bots=${b}&t=300`, 0);
  for (const t of [64, 256]) await fpsCase(`map=grass bots=3 tile=${t}`, '?bots=3&t=300', 0);
}

// ---------- 첫 로딩 ----------
async function loadCase(name, throttle) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (throttle) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  const reqs = new Map();
  cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, { url: e.response.url, status: e.response.status, type: e.type }));
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  const t0 = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const loadMs = Date.now() - t0;
  await page.waitForLoadState('networkidle');
  const idleMs = Date.now() - t0;
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const p = Object.fromEntries(performance.getEntriesByType('paint').map((x) => [x.name, Math.round(x.startTime)]));
    return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), ...p, fontsReady: document.fonts.status };
  });
  // 게임에 들어가야 받는 것(바닥 텍스처)
  await page.addInitScript(ENGINE_PROBE);
  const list = [...reqs.values()].filter((r) => r.bytes != null);
  const total = list.reduce((s, r) => s + r.bytes, 0);
  const by = (re) => list.filter((r) => re.test(r.url)).reduce((s, r) => s + r.bytes, 0);
  const row = { name, loadMs, idleMs, ...nav, requests: list.length, totalKB: +(total / 1024).toFixed(1),
    jsKB: +(by(/\.js(\?|$)/) / 1024).toFixed(1), cssKB: +(by(/\.css(\?|$)|fonts\.googleapis/) / 1024).toFixed(1), fontKB: +(by(/woff2?|gstatic/) / 1024).toFixed(1),
    thirdParty: list.filter((r) => !r.url.startsWith(BASE)).map((r) => `${r.url.slice(0, 70)} ${(r.bytes / 1024).toFixed(1)}KB`) };
  R.load.push(row);
  console.log(`load ${name.padEnd(10)} load ${loadMs}ms idle ${idleMs}ms FCP ${nav['first-contentful-paint']}ms total ${row.totalKB}KB (js ${row.jsKB} css ${row.cssKB} font ${row.fontKB}) req ${row.requests}`);
  await ctx.close();
}
if (ONLY.includes('load')) {
  for (let i = 0; i < 2; i++) await loadCase(`그대로#${i + 1}`, false);
  await loadCase('4G모사', true);
}

// ---------- 긴 판 메모리 ----------
// 봇 3 · 제한 시간 넉넉히. 내 캐릭터는 갇히면 바로 풀어 주는 QA 전용 무적(판이 5분 넘게 이어지게) — 봇 · 풍선 · 파티클은 실제로 돈다.
if (ONLY.includes('memory')) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = collectErrors(page);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.addInitScript(ENGINE_PROBE);
  const minutes = Number(A.minutes);
  await page.goto(BASE + `/?bots=3&t=${Math.ceil(minutes * 60 + 60)}`, { waitUntil: 'networkidle' });
  await enterGame(page, { mapIdx: 0 });
  await page.evaluate(() => {
    const e = window.__wbaEngine();
    setInterval(() => {
      const m = e.g.ents[0];
      if (m.state === 'trapped') { m.state = 'alive'; }
      // 봇이 모두 죽으면 판이 끝나므로 되살려 계속 돌린다
      e.g.ents.forEach((b) => { if (b.isBot && b.state === 'dead') { b.state = 'alive'; b.x = 14 * e.g.T + e.g.T / 2; b.y = 12 * e.g.T + e.g.T / 2; b.path = []; } });
    }, 100);
  });
  const sample = async (tSec) => {
    await cdp.send('HeapProfiler.collectGarbage');
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    const g = await page.evaluate(() => { const e = window.__wbaEngine(); return { finished: e.finished, parts: e.g.parts.length, balloons: e.g.balloons.length, items: e.g.items.size, soft: e.g.grid.flat().filter((c) => c === 'soft' || c === 'tough').length }; });
    return { tSec, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), nodes: m.Nodes, listeners: m.JSEventListeners, ...g };
  };
  const samples = [await sample(0)];
  const t0 = Date.now();
  while ((Date.now() - t0) / 60000 < minutes) {
    await sleep(30000);
    samples.push(await sample(Math.round((Date.now() - t0) / 1000)));
    const s = samples[samples.length - 1];
    console.log(`mem t=${s.tSec}s heap ${s.heapMB}MB nodes ${s.nodes} listeners ${s.listeners} parts ${s.parts} crates ${s.soft} finished ${s.finished}`);
  }
  R.memory = { minutes, samples, errors: errs };
  await ctx.close();
}

// ---------- 다시 하기 · 화면 왕복 반복 뒤 남는 DOM · 리스너 · 힙 ----------
// Playwright locator.click 은 누른 요소를 붙잡아 두어 detached DOM 이 쌓인 것처럼 보인다(11/26 확인).
// 그래서 누르기는 페이지 안 element.click(), 기다리기는 waitForFunction 으로만 한다.
if (ONLY.includes('restart')) {
  const restartCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await restartCtx.newPage();
  const cdp2 = await restartCtx.newCDPSession(p2);
  await cdp2.send('Performance.enable');
  await p2.addInitScript(ENGINE_PROBE);
  await p2.goto(BASE + '/?bots=3&t=3', { waitUntil: 'networkidle' });
  await enterGame(p2, { mapIdx: 0 });
  await sleep(300);
  const heap2 = async () => { await cdp2.send('HeapProfiler.collectGarbage'); const m = Object.fromEntries((await cdp2.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value])); return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), listeners: m.JSEventListeners, nodes: m.Nodes }; };
  // 이름 후보(새 · 옛) 중 있는 버튼을 기다리고 누른다 — 맵 바꾸기/맵 변경, 시작하기/입장
  const waitBtn = (t) => p2.waitForFunction((x) => [...document.querySelectorAll('button')].some((b) => x.includes(b.textContent)), [].concat(t), { timeout: 20000, polling: 200 });
  const press = (t) => p2.evaluate((x) => [...document.querySelectorAll('button')].find((b) => x.includes(b.textContent)).click(), [].concat(t));
  const out = { restart: [], remount: [] };
  for (let i = 0; i <= 20; i++) { await waitBtn('다시 하기'); if (i % 5 === 0) out.restart.push({ round: i, ...(await heap2()) }); await press('다시 하기'); }
  for (let i = 0; i <= 20; i++) { await waitBtn(NAMES.changeMap); if (i % 5 === 0) out.remount.push({ round: i, ...(await heap2()) }); await press(NAMES.changeMap); await waitBtn(NAMES.enter); await press(NAMES.enter); }
  console.log('restart', JSON.stringify(out.restart));
  console.log('remount(맵 변경→입장)', JSON.stringify(out.remount));
  R.restart = out;
  await restartCtx.close();
}


await browser.close();
writeJson(path.join(OUT, 'perf.json'), R);
console.log(`→ ${path.join(OUT, 'perf.json')}`);
