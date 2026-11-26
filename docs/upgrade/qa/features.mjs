// 1라운드(r1) 새 기능 점검 — 카운트다운 · 일시정지 · 판 시계 멈춤 · 탭 숨김 · 창 blur · 결과 화면 포커스 · 결과 복사 ·
// 효과음 12개 · og/favicon · 세 크기 가로 넘침. 옛 빌드(phase 없음)에서는 해당 항목을 n/a 로 남긴다.
// 실행: node docs/upgrade/qa/features.mjs --url http://127.0.0.1:5310 --label r1
import path from 'node:path';
import { chromium, SIZES, args, shot, collectErrors, ENGINE_PROBE, enterGame, clickText, findButton, waitButton, NAMES, writeJson, sleep } from './lib.mjs';

const A = args({ url: 'http://127.0.0.1:5310', label: 'r1', out: path.join(path.dirname(new URL(import.meta.url).pathname), 'out') });
const OUT = path.join(A.out, 'features', A.label);
const BASE = A.url.replace(/\/$/, '');
const R = { url: BASE, label: A.label, at: new Date().toISOString(), checks: [], overflow: [], errors: [] };
const check = (name, ok, detail) => {
  const v = ok === null ? 'n/a' : ok ? 'PASS' : 'FAIL';
  R.checks.push({ name, ok: ok === null ? null : !!ok, detail });
  console.log(`${v} ${name} ${detail ? JSON.stringify(detail) : ''}`);
};

const browser = await chromium.launch();
const newPage = async (vp = SIZES.desktop) => {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = collectErrors(page);
  await page.addInitScript(ENGINE_PROBE);
  return { ctx, page, errs };
};
// 판 시계(엔진 식 그대로, ms) · HUD 시계 글자
const clockMs = (page) => page.evaluate(() => { const e = window.__wbaEngine(); return Math.round(e.matchSeconds * 1000 - (performance.now() - e.g.start)); });
const hudText = (page) => page.locator('.pixel-panel').innerText().then((t) => t.replace(/\s+/g, ' '));
const phase = (page) => page.evaluate(() => window.__wbaEngine()?.phase ?? null);
const focusText = (page) => page.evaluate(() => (document.activeElement?.innerText || document.activeElement?.tagName || '').trim());

// ---------- 1. 카운트다운 · 일시정지 · 시계 · 탭 숨김 · blur ----------
{
  const { ctx, page, errs } = await newPage();
  await page.goto(BASE + '/?bots=1&t=120', { waitUntil: 'networkidle' });
  await enterGame(page, { waitPlay: false });
  const hasPhase = await page.evaluate(() => 'phase' in window.__wbaEngine());
  R.hasPhase = hasPhase;
  if (!hasPhase) {
    check('카운트다운 · 일시정지(옛 빌드)', null, { reason: 'engine.phase 없음' });
  } else {
    // 카운트다운: 첫 단계와 그 동안 Space 가 막히는가
    const p0 = await phase(page);
    const seen = new Set([p0]);
    await page.keyboard.press('Space');
    const ballDuringCount = await page.evaluate(() => window.__wbaEngine().g.balloons.filter((b) => b.owner === 0).length);
    const tC = Date.now();
    await shot(page, path.join(OUT, 'countdown.png'));
    while (Date.now() - tC < 5000) { const p = await phase(page); seen.add(p); if (p === 'playing') break; await sleep(40); }
    check('카운트다운: countdown → playing', p0 === 'countdown' && seen.has('playing'), { first: p0, seen: [...seen], ms: Date.now() - tC });
    check('카운트다운: 그 동안 Space 로 풍선이 안 놓임', ballDuringCount === 0, { ballDuringCount });
    await sleep(800);

    // Esc → 일시정지 화면, 첫 버튼 포커스
    const hud0 = await hudText(page);
    const c0 = await clockMs(page); // 멈추기 직전 판 시계
    await page.keyboard.press('Escape');
    await sleep(250);
    const paused = { phase: await phase(page), overlay: await page.locator('.pause-overlay').count(), focus: await focusText(page) };
    await shot(page, path.join(OUT, 'pause.png'));
    check('일시정지: Esc 로 열림', paused.phase === 'paused' && paused.overlay === 1, paused);
    check('일시정지: 「계속할게요」로 포커스', paused.focus === '계속할게요', { focus: paused.focus });
    // 멈춘 동안 봇 · HUD 가 그대로인가 (3초). 판 시계는 이어진 뒤 「멈추기 직전 값」에서 다시 흐르는지로 본다
    // (멈춘 동안에는 g.start 를 옮기지 않고 resume 때 한꺼번에 옮기므로 멈춘 중에 식으로 읽으면 줄어 보인다)
    const tPause = Date.now();
    const b1 = await page.evaluate(() => window.__wbaEngine().g.ents.map((x) => [Math.round(x.x), Math.round(x.y)]));
    await sleep(3000);
    const hud1 = await hudText(page);
    const b2 = await page.evaluate(() => window.__wbaEngine().g.ents.map((x) => [Math.round(x.x), Math.round(x.y)]));
    // 「계속할게요」 → 이어짐. 시계는 멈춘 3초를 빼고 이어져야 한다
    await page.getByRole('button', { name: '계속할게요', exact: true }).click();
    await sleep(100);
    const c2 = await clockMs(page);
    const resumed = { phase: await phase(page), overlay: await page.locator('.pause-overlay').count() };
    check('일시정지: 「계속할게요」로 이어짐', resumed.phase === 'playing' && resumed.overlay === 0, resumed);
    const pausedMs = Date.now() - tPause;
    check('일시정지: 멈춘 동안 판 시계 · 봇 · HUD 그대로', c0 - c2 >= 0 && c0 - c2 < 800 && pausedMs > 3000 && JSON.stringify(b1) === JSON.stringify(b2) && hud0.match(/\d+:\d+/)?.[0] === hud1.match(/\d+:\d+/)?.[0],
      { clockBeforePauseMs: c0, clockAfterResumeMs: c2, lostMs: c0 - c2, pausedMs, botsSame: JSON.stringify(b1) === JSON.stringify(b2), hudClock: [hud0.match(/\d+:\d+/)?.[0], hud1.match(/\d+:\d+/)?.[0]] });
    // 이어진 뒤 시계가 다시 흐르는가
    await sleep(1200);
    const c3 = await clockMs(page);
    check('일시정지: 이어진 뒤 시계가 다시 흐름', c2 - c3 > 900, { flowedMs: c2 - c3 });

    // HUD 일시정지 버튼 · P 키
    await page.getByRole('button', { name: '일시정지' }).click(); await sleep(200);
    const byBtn = await phase(page);
    await page.keyboard.press('p'); await sleep(200);
    check('일시정지: HUD 버튼으로 열고 P 로 닫힘', byBtn === 'paused' && (await phase(page)) === 'playing', { byBtn, afterP: await phase(page) });

    // 탭 숨김(headless 는 실제 숨김이 안 되므로 visibilityState 를 덮어쓰고 이벤트를 보낸다 — 모사)
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(200);
    const hidden = await phase(page);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300);
    const back = { phase: await phase(page), overlay: await page.locator('.pause-overlay').count() };
    check('탭 숨김(모사): 자동 일시정지 · 돌아와도 멈춘 채', hidden === 'paused' && back.phase === 'paused' && back.overlay === 1, { hidden, back });
    await page.keyboard.press('Escape'); await sleep(200);

    // 창 blur: 방향키를 누른 채 blur → 눌림이 풀려 멈추는가
    await page.keyboard.down('ArrowDown'); await sleep(150);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const y1 = await page.evaluate(() => window.__wbaEngine().g.ents[0].y);
    await sleep(400);
    const y2 = await page.evaluate(() => window.__wbaEngine().g.ents[0].y);
    await page.keyboard.up('ArrowDown');
    const keys = await page.evaluate(() => Object.entries(window.__wbaEngine().keys).filter(([, v]) => v).map(([k]) => k));
    check('창 blur: 누르던 키가 풀림', Math.abs(y2 - y1) < 2, { movedAfterBlur: Math.round(y2 - y1), keysAfter: keys });

    // 일시정지 → 「나갈래요」 → 타이틀
    await page.keyboard.press('Escape'); await sleep(200);
    await page.getByRole('button', { name: '나갈래요', exact: true }).click(); await sleep(300);
    check('일시정지: 「나갈래요」로 타이틀', (await findButton(page, NAMES.start)) !== null);
  }
  R.errors.push(...errs.map((e) => 'pause: ' + e));
  await ctx.close();
}

// ---------- 2. 결과 화면: 첫 버튼 포커스 · 결과 복사 · 복사 동작 ----------
{
  const { ctx, page, errs } = await newPage();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await page.goto(BASE + '/?bots=3&t=3', { waitUntil: 'networkidle' });
  await enterGame(page);
  await waitButton(page, NAMES.restart, 20000);
  await sleep(400);
  const focus = await focusText(page);
  check('결과: 첫 버튼(다시 하기)에 포커스', focus === '다시 하기', { focus });
  const copyBtn = await page.getByRole('button', { name: '결과 복사', exact: true }).count();
  check('결과: 「결과 복사」 버튼 있음', copyBtn === 1, { copyBtn });
  if (copyBtn) {
    await page.getByRole('button', { name: '결과 복사', exact: true }).click(); await sleep(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'ERR ' + e.message);
    const msg = await page.locator('.result-share [aria-live]').innerText().catch(() => '');
    check('결과: 복사하면 글이 클립보드에 들어감', clip && !clip.startsWith('ERR') && clip.length > 10, { clip: clip.slice(0, 120), msg });
  }
  const dlg = await page.evaluate(() => { const d = document.querySelector('.result-overlay'); return d && { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), label: d.getAttribute('aria-labelledby') }; });
  check('결과: role=dialog · aria-modal', dlg?.role === 'dialog' && dlg?.modal === 'true', dlg);
  await shot(page, path.join(OUT, 'result.png'));
  R.errors.push(...errs.map((e) => 'result: ' + e));
  await ctx.close();
}

// ---------- 3. 정적 파일: 효과음 12 · og · favicon ----------
{
  const ctx = await browser.newContext();
  const keys = ['ui', 'place', 'pin', 'burst', 'crate', 'itemGood', 'itemBad', 'trapped', 'die', 'win', 'lose', 'draw'];
  const sfx = [];
  for (const k of keys) {
    const r = await ctx.request.get(`${BASE}/sfx/${k}.mp3`);
    const body = await r.body();
    sfx.push({ k, status: r.status(), type: r.headers()['content-type'], bytes: body.length });
  }
  const ok = sfx.filter((x) => x.status === 200 && /audio|mpeg/.test(x.type || '') && x.bytes > 500).length;
  R.sfx = sfx;
  check(`효과음 ${keys.length}개 200`, ok === keys.length, { ok, totalKB: +(sfx.reduce((a, x) => a + x.bytes, 0) / 1024).toFixed(1), bad: sfx.filter((x) => x.status !== 200).map((x) => x.k) });
  for (const f of ['/og.png', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png']) {
    const r = await ctx.request.get(BASE + f);
    check(`정적 파일 ${f} 200`, r.status() === 200, { status: r.status(), type: r.headers()['content-type'], bytes: (await r.body()).length });
  }
  // index.html 메타: og:image · favicon 링크 · analytics 태그
  const html = await (await ctx.request.get(BASE + '/')).text();
  R.meta = { ogImage: (html.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || null, icon: /rel="icon"/.test(html), analytics: /_vercel\/insights|@vercel\/analytics|va\.vercel-scripts/.test(html) };
  check('index.html 메타: og:image · icon', !!R.meta.ogImage && R.meta.icon, R.meta);
  await ctx.close();
}

// ---------- 4. 세 크기 가로 넘침: 타이틀 · 캐릭터 · 맵 · 게임 · 일시정지 · 결과 ----------
for (const [name, vp] of Object.entries(SIZES)) {
  const { ctx, page, errs } = await newPage(vp);
  const over = async (step) => {
    const m = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, vw: innerWidth }));
    R.overflow.push({ size: name, step, ...m, over: m.scrollW > m.vw + 1 });
  };
  await page.goto(BASE + '/?bots=3&t=4', { waitUntil: 'networkidle' });
  await sleep(300); await over('title');
  await clickText(page, NAMES.start); await sleep(300); await over('select');
  await clickText(page, NAMES.next); await sleep(300); await over('map');
  await clickText(page, NAMES.enter);
  await page.waitForFunction(() => window.__wbaEngine && window.__wbaEngine());
  await sleep(300); await over('countdown');
  if (R.hasPhase) {
    await page.keyboard.press('Escape'); await sleep(300); await over('pause');
    await shot(page, path.join(OUT, `${name}-pause.png`));
    await page.keyboard.press('Escape');
  }
  await waitButton(page, NAMES.restart, 20000); await sleep(500); await over('result');
  await shot(page, path.join(OUT, `${name}-result.png`));
  R.errors.push(...errs.map((e) => `overflow ${name}: ` + e));
  await ctx.close();
}
const overs = R.overflow.filter((x) => x.over);
check('가로 넘침 0 (390×844 · 844×390 · 1440×900 × 6화면)', overs.length === 0, { overs, steps: R.overflow.length });
check('콘솔 오류 · 실패 요청 0', R.errors.length === 0, { errors: R.errors.slice(0, 8) });

await browser.close();
writeJson(path.join(OUT, 'features.json'), R);
const fails = R.checks.filter((c) => c.ok === false).length;
console.log(`checks ${R.checks.filter((c) => c.ok).length}/${R.checks.length} (fail ${fails}, n/a ${R.checks.filter((c) => c.ok === null).length})`);
console.log(`→ ${path.join(OUT, 'features.json')}`);
process.exit(fails ? 1 : 0);
