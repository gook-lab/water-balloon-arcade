// QA 공용 헬퍼 — 레포 src/ 를 건드리지 않고 URL 만 받아 점검한다.
// Playwright 는 승인된 경로(dokkaebi-quest)에서 빌려 쓴다. PLAYWRIGHT_PATH 로 바꿀 수 있다.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_PATH || '/Users/kyb-ontact/sonix/toy/dokkaebi-quest/node_modules/playwright';
export const { chromium, devices } = require(PW);

export const AXE_PATH = process.env.AXE_PATH || '/Users/kyb-ontact/sonix/fe/sonix_homepage/node_modules/axe-core/axe.min.js';

export function args(defaults = {}) {
  const out = { ...defaults };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
    out[k] = v;
  }
  return out;
}

export function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }

/** 1280px 이하로 줄여 저장 (macOS sips). 원본은 지운다. */
export async function shot(page, file, opts = {}) {
  ensureDir(path.dirname(file));
  await page.screenshot({ path: file, ...opts });
  try {
    const info = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
    const [w, h] = [/pixelWidth: (\d+)/, /pixelHeight: (\d+)/].map((re) => Number(info.match(re)[1]));
    if (Math.max(w, h) > 1280) execFileSync('sips', ['-Z', '1280', file], { stdio: 'ignore' });
  } catch { /* sips 없으면 그대로 */ }
  return file;
}

export const SIZES = {
  desktop: { width: 1440, height: 900 },
  landscape: { width: 844, height: 390 },
  portrait: { width: 390, height: 844 }
};

/** 콘솔 오류 · 페이지 예외 · 실패 요청 수집 */
export function collectErrors(page) {
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => errs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`[http ${r.status()}] ${r.url()}`); });
  return errs;
}

/**
 * 페이지 안에서 GameEngine 인스턴스를 찾는 함수(문자열로 주입).
 * React fiber 를 캔버스에서 위로 타고 올라가 useGame 의 engineRef(current.g 가 있는 ref)를 찾는다.
 * 프로덕션 번들에서도 __reactFiber$ 키는 붙어 있다.
 */
export const ENGINE_PROBE = `
window.__wbaEngine = function () {
  const cvs = [...document.querySelectorAll('canvas')];
  for (const cv of cvs) {
    const fk = Object.keys(cv).find((k) => k.startsWith('__reactFiber$'));
    let f = fk && cv[fk];
    while (f) {
      let h = f.memoizedState;
      while (h && typeof h === 'object' && 'next' in h) {
        const v = h.memoizedState;
        if (v && v.current && v.current.g && typeof v.current.step === 'function') return v.current;
        h = h.next;
      }
      f = f.return;
    }
  }
  return null;
};
window.__wbaState = function () {
  const e = window.__wbaEngine();
  if (!e || !e.g) return null;
  const g = e.g, T = g.T;
  return {
    finished: e.finished, T, theme: g.theme.id, themeName: g.theme.name,
    ents: g.ents.map((x) => ({ id: x.id, isBot: x.isBot, state: x.state, tx: Math.floor(x.x / T), ty: Math.floor(x.y / T), x: x.x, y: x.y,
      maxBalloons: x.maxBalloons, power: x.power, speed: x.speed, pins: x.pins, passBalloon: x.passBalloon, passBlock: x.passBlock, slowUntil: x.slowUntil })),
    balloons: g.balloons.map((b) => ({ owner: b.owner, tx: b.tx, ty: b.ty })),
    water: g.water.size, items: [...g.items.entries()], parts: g.parts.length,
    grid: g.grid.map((r) => r.map((c) => ({ empty: '.', soft: 's', tough: 't', hard: '#' })[c] || '?').join(''))
  };
};
`;

/**
 * 화면 버튼 이름 후보 — 1라운드(r1)에서 이름이 바뀌었다. 새 이름을 앞에 두고 옛 이름도 받아
 * 1단계 기준선(live · local)과 같은 스크립트로 비교한다.
 */
export const NAMES = {
  start: ['한 판 하기', '게임 시작'],
  next: ['다음'],
  enter: ['시작하기', '입장'],
  back: ['뒤로'],
  restart: ['다시 하기'],
  changeMap: ['맵 바꾸기', '맵 변경'],
  changeChar: ['캐릭터 바꾸기', '캐릭터'],
  charTitle: ['누구로 할까요?', '캐릭터 선택'],
  mapTitle: ['어디서 할까요?', '맵 선택'],
  resume: ['계속할게요']
};
const asList = (t) => (Array.isArray(t) ? t : [t]);

/** 후보 중 지금 화면에 있는 버튼 이름(없으면 null) */
export async function findButton(page, text) {
  for (const n of asList(text)) if (await page.getByRole('button', { name: n, exact: true }).count()) return n;
  return null;
}

/** 후보 이름 가운데 하나가 버튼으로 뜰 때까지 기다린다 */
export async function waitButton(page, text, timeout = 15000) {
  await page.waitForFunction((names) => [...document.querySelectorAll('button')].some((b) => names.includes(b.textContent.trim())), asList(text), { timeout, polling: 100 });
  return findButton(page, text);
}

/** 화면 버튼을 텍스트(또는 후보 목록)로 눌러 진행 */
export async function clickText(page, text) {
  const name = (await findButton(page, text)) ?? (await waitButton(page, text, 5000));
  await page.getByRole('button', { name, exact: true }).first().click();
  return name;
}

/** 옵션 줄(role=group 라벨) 안의 버튼. 옛 빌드처럼 그룹이 없으면 문서 전체에서 이름(또는 옛 이름)으로 찾는다 */
export async function optionButton(page, group, name, oldName = name) {
  const g = page.getByRole('group', { name: group, exact: true });
  if (await g.count()) return g.getByRole('button', { name, exact: true });
  return page.getByRole('button', { name: oldName, exact: true });
}

/**
 * 판이 실제로 열릴 때까지 — r1 부터는 3·2·1 카운트다운(phase 'countdown') 동안 입력이 막힌다.
 * phase 가 없으면 옛 빌드이니 기다리지 않는다. 판이 이미 끝났으면 바로 돌아간다.
 */
export async function waitPlaying(page, timeout = 10000) {
  await page.waitForFunction(() => {
    const e = window.__wbaEngine && window.__wbaEngine();
    if (!e) return false;
    return !('phase' in e) || e.phase === 'playing' || !!e.finished;
  }, null, { timeout, polling: 50 });
}

/** 타이틀 → 캐릭터 → 맵 → 게임 (마우스). mapIdx 는 카드 순서. waitPlay=false 면 카운트다운을 기다리지 않는다 */
export async function enterGame(page, { mapIdx = 0, charIdx = 0, waitPlay = true } = {}) {
  await clickText(page, NAMES.start);
  if (charIdx) await page.locator('.pick-card').nth(charIdx).click();
  await clickText(page, NAMES.next);
  if (mapIdx) await page.locator('.pick-card').nth(mapIdx).click();
  await clickText(page, NAMES.enter);
  await page.waitForFunction(() => window.__wbaEngine && window.__wbaEngine());
  if (waitPlay) await waitPlaying(page);
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
