// 접근성 · 소리 점검.
// 접근성: axe-core(로컬 사본) 위반 · 작은 글자 대비 · 제목/랜드마크 · 버튼 이름 · 선택 상태 노출 · 축소 모션 · 접근성 트리 스냅숏.
// 소리: autoplay 잠금 해제(실제 정책 플래그) · 켬/끔 · 볼륨 · 탭 전환(숨김) 때 BGM/게임 진행.
// 실행: node docs/upgrade/qa/a11y.mjs --url <URL> --label <이름>
import fs from 'node:fs';
import path from 'node:path';
import { chromium, AXE_PATH, args, shot, collectErrors, ENGINE_PROBE, enterGame, clickText, optionButton, NAMES, writeJson, sleep, ensureDir } from './lib.mjs';

const A = args({ url: 'http://127.0.0.1:5310', label: 'local', out: path.join(path.dirname(new URL(import.meta.url).pathname), 'out') });
const OUT = ensureDir(path.join(A.out, 'a11y', A.label));
const BASE = A.url.replace(/\/$/, '');
const AXE = fs.readFileSync(AXE_PATH, 'utf8');
const R = { url: BASE, at: new Date().toISOString(), axe: {}, contrast: {}, structure: {}, motion: {}, audio: {} };

// 실제 브라우저와 같은 autoplay 정책(사용자 제스처 필요)으로 띄운다
const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });

// ---- 작은 글자 대비: 글자 색 vs 위로 올라가며 합성한 배경색 (그라데이션 바탕은 body 기본색 #141a33 으로 근사) ----
const CONTRAST = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const base = { r: 0x14, g: 0x1a, b: 0x33, a: 1 };
  const bgOf = (el) => {
    const layers = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
    }
    let bg = base;
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return bg;
  };
  const rows = [];
  document.querySelectorAll('body *').forEach((el) => {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!own) return;
    const cs = getComputedStyle(el);
    const px = parseFloat(cs.fontSize);
    const fg = parse(cs.color);
    if (!fg || el.getBoundingClientRect().width === 0) return;
    const r = ratio(over(fg, bgOf(el)), bgOf(el));
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    rows.push({ text: own.slice(0, 24), px, color: cs.color, ratio: +r.toFixed(2), need: large ? 3 : 4.5, pass: r >= (large ? 3 : 4.5) });
  });
  return rows;
};

const STRUCTURE = () => ({
  lang: document.documentElement.lang,
  title: document.title,
  headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].map((h) => h.tagName + ':' + h.textContent.trim().slice(0, 20)),
  landmarks: [...document.querySelectorAll('main,nav,header,footer,[role=main],[role=dialog],[aria-live]')].map((e) => e.tagName + (e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : '')),
  buttons: [...document.querySelectorAll('button')].map((b) => ({ name: b.innerText.trim(), pressed: b.getAttribute('aria-pressed') })),
  canvases: [...document.querySelectorAll('canvas')].map((c) => ({ label: c.getAttribute('aria-label'), role: c.getAttribute('role'), hidden: c.getAttribute('aria-hidden') })),
  clickableDivs: [...document.querySelectorAll('.pick-card')].map((d) => ({ role: d.getAttribute('role'), tabIndex: d.tabIndex }))
});

async function runAxe(page, name) {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ['violations', 'incomplete'] });
    const pick = (v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) });
    return { violations: res.violations.map(pick), incomplete: res.incomplete.map(pick) };
  });
  R.axe[name] = r;
  R.contrast[name] = (await page.evaluate(CONTRAST)).filter((x) => x.px <= 14 || !x.pass);
  R.structure[name] = await page.evaluate(STRUCTURE);
  fs.writeFileSync(path.join(OUT, `aria-${name}.yml`), await page.locator('body').ariaSnapshot());
  const fails = R.contrast[name].filter((x) => !x.pass);
  console.log(`axe ${name.padEnd(7)} violations=[${r.violations.map((v) => `${v.id}(${v.impact},${v.nodes})`).join(' ')}] smallTextContrastFails=${fails.length} ${fails.slice(0, 4).map((f) => `"${f.text}" ${f.ratio}`).join(' · ')}`);
}

// ---------- 접근성: 화면별 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  collectErrors(page);
  await page.addInitScript(ENGINE_PROBE);
  await page.goto(BASE + '/?t=4&bots=1', { waitUntil: 'networkidle' });
  await sleep(500);
  await runAxe(page, 'title');
  await clickText(page, NAMES.start); await sleep(400);
  await runAxe(page, 'select');
  await clickText(page, NAMES.next); await sleep(400);
  await runAxe(page, 'map');
  await clickText(page, NAMES.enter); await sleep(800);
  await runAxe(page, 'game');
  await page.waitForSelector('text=다시 하기', { timeout: 20000 }); await sleep(500);
  await runAxe(page, 'result');
  await ctx.close();
}

// ---------- 축소 모션 ----------
{
  for (const rm of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: rm });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await sleep(600);
    R.motion[rm] = await page.evaluate(() => ({
      matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      running: document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.constructor.name)
    }));
    console.log(`motion ${rm}: matches=${R.motion[rm].matches} runningAnimations=${R.motion[rm].running.length} [${[...new Set(R.motion[rm].running)]}]`);
    await ctx.close();
  }
}

// ---------- 소리 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = collectErrors(page);
  await page.addInitScript(ENGINE_PROBE);
  await page.addInitScript(() => {
    window.__ac = []; window.__osc = 0; window.__gains = [];
    const AC = window.AudioContext;
    const W = function (...a) { const c = new AC(...a); window.__ac.push(c); return c; };
    W.prototype = AC.prototype; window.AudioContext = W;
    const co = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__osc++; return co.call(this); };
    const cg = AC.prototype.createGain; AC.prototype.createGain = function () { const g = cg.call(this); window.__gains.push(g); return g; };
  });
  await page.goto(BASE + '/?bots=1&t=120', { waitUntil: 'networkidle' });
  await sleep(1000);
  const a = R.audio;
  a.beforeGesture = await page.evaluate(() => ({ contexts: window.__ac.length, osc: window.__osc }));
  await page.mouse.click(5, 5); // 빈 곳 클릭 = 첫 제스처
  await sleep(1200);
  a.afterGesture = await page.evaluate(() => ({ contexts: window.__ac.length, state: window.__ac[0]?.state, osc: window.__osc, master: window.__gains[0]?.gain.value }));
  // 켬/끔 · 볼륨 (master = 첫 gain). r1 은 화질 「낮음」 · 범위 보기 「끔」과 이름이 겹쳐 옵션 줄(group)로 좁힌다
  await (await optionButton(page, '볼륨', '낮음')).click(); await sleep(100);
  a.volLow = await page.evaluate(() => window.__gains[0].gain.value);
  await (await optionButton(page, '사운드', '끔')).click(); await sleep(100);
  const o1 = await page.evaluate(() => window.__osc); await sleep(2000); const o2 = await page.evaluate(() => window.__osc);
  a.muted = { master: await page.evaluate(() => window.__gains[0].gain.value), volumeRowHidden: (await page.getByRole('group', { name: '사운드', exact: true }).count()) ? (await page.getByRole('group', { name: '볼륨', exact: true }).count()) === 0 : (await page.getByRole('button', { name: '낮음' }).count()) === 0, bgmOscPer2sWhileMuted: o2 - o1, saved: await page.evaluate(() => localStorage.getItem('wba-audio')) };
  await page.reload({ waitUntil: 'networkidle' });
  a.persistAfterReload = await page.evaluate(() => {
    const grp = [...document.querySelectorAll('[role=group]')].find((g) => document.getElementById(g.getAttribute('aria-labelledby'))?.textContent === '사운드');
    return [...(grp || document).querySelectorAll('button')].find((b) => b.innerText === '끔')?.className;
  });
  await page.mouse.click(5, 5);
  await (await optionButton(page, '사운드', '켬')).click(); await sleep(100);
  await (await optionButton(page, '볼륨', '중간')).click(); await sleep(100);
  // 게임 안에서 탭 전환
  await enterGame(page, {});
  await sleep(1500);
  const vis = async () => page.evaluate(() => ({ vis: document.visibilityState, osc: window.__osc, ac: window.__ac.map((c) => c.state), clock: window.__wbaEngine().g && Math.max(0, window.__wbaEngine().matchSeconds - Math.floor((performance.now() - window.__wbaEngine().g.start) / 1000)), x: Math.round(window.__wbaEngine().g.ents[0].x) }));
  const v0 = await vis();
  await page.keyboard.down('ArrowRight'); // 키를 누른 채로 탭을 떠난다 (keyup 유실 재현)
  const other = await ctx.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  await sleep(5000);
  const v1 = await vis();
  await page.bringToFront();
  await sleep(1500);
  const v2 = await vis();
  await page.keyboard.up('ArrowRight');
  // headless 에선 bringToFront 로 visibilityState 가 hidden 이 되지 않는다 — hiddenReproduced 로 표시
  a.tabSwitch = { hiddenReproduced: v1.vis === 'hidden', before: v0, hidden5s: v1, back: v2, oscWhileHidden5s: v1.osc - v0.osc };
  console.log('audio', JSON.stringify(a));
  a.errors = errs;
  await ctx.close();
}

await browser.close();
writeJson(path.join(OUT, 'a11y.json'), R);
console.log(`→ ${path.join(OUT, 'a11y.json')}`);
