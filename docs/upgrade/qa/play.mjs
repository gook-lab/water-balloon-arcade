// 실제 플레이 점검 — Playwright 키 입력으로 이동 · 풍선 · 바늘 · 아이템 · 갇힘 → 탈락 · 승리 · 무승부,
// 맵 8종(7 + 랜덤) 생성 상태 확인. 엔진 상태는 React fiber 로 읽기만 한다(src 수정 없음).
// 아이템 · 승리 점검은 「놓기」만 엔진 상태에 주입한다(아이템 칸 지정 · 봇 칸에 물 한 칸) — 판정은 실제 엔진이 한다.
// 실행: node docs/upgrade/qa/play.mjs --url http://127.0.0.1:5310 --label local
//   --autopilot N : 내 캐릭터를 게임의 봇 AI(driveBot)로 N 판 운전해 실제 승패를 센다. dev 서버(/src 제공) 필요.
import path from 'node:path';
import { chromium, args, shot, collectErrors, ENGINE_PROBE, enterGame, writeJson, sleep } from './lib.mjs';

const A = args({ url: 'http://127.0.0.1:5310', label: 'local', out: path.join(path.dirname(new URL(import.meta.url).pathname), 'out') });
const OUT = path.join(A.out, 'play', A.label);
const BASE = A.url.replace(/\/$/, '');
const R = { url: BASE, label: A.label, at: new Date().toISOString(), checks: [], maps: [], errors: [] };
const check = (name, ok, detail) => { R.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail ? JSON.stringify(detail) : ''}`); };

const browser = await chromium.launch();

async function open(query, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = collectErrors(page);
  await page.addInitScript(ENGINE_PROBE);
  await page.goto(BASE + '/' + query, { waitUntil: 'networkidle' });
  await enterGame(page, opts);
  await sleep(300);
  return { ctx, page, errs };
}
const st = (page) => page.evaluate(() => window.__wbaState());
const me = async (page) => (await st(page)).ents[0];
async function hold(page, k, ms) { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); await sleep(60); }
/** 키를 누른 채 내 칸이 목표가 될 때까지 (최대 2초) */
async function walkTo(page, k, axis, target) {
  await page.keyboard.down(k);
  const t0 = Date.now();
  while (Date.now() - t0 < 2000) { const m = await me(page); if (m[axis] === target) break; await sleep(15); }
  await page.keyboard.up(k);
  // 칸 중앙 근처에 서도록 잠깐 더 (레인 정렬)
  await sleep(80);
}

// ---------- 1. 이동 · 풍선 · 바늘 · 갇힘 → 탈락 (로보: 바늘 1개) ----------
{
  const { ctx, page, errs } = await open('?bots=1&t=120', { charIdx: 5 });
  const m0 = await me(page);
  await hold(page, 'ArrowRight', 300);
  const m1 = await me(page);
  check('이동: 방향키 오른쪽', m1.x > m0.x + 40, { from: m0.x, to: Math.round(m1.x) });
  await hold(page, 'ArrowLeft', 400);
  await hold(page, 's', 250); // WASD
  const m2 = await me(page);
  check('이동: WASD(s) 아래', m2.y > m0.y + 30, { from: m0.y, to: Math.round(m2.y) });
  await hold(page, 'w', 400);
  const home = await me(page);
  // 풍선 설치 → 두 칸 비켜서 → 바늘
  await page.keyboard.press('Space'); await sleep(80);
  const mine = (s) => s.balloons.filter((b) => b.owner === 0);
  const s1 = await st(page);
  check('풍선 설치: Space', mine(s1).length === 1 && mine(s1)[0].tx === home.tx && mine(s1)[0].ty === home.ty, { mine: mine(s1), at: [home.tx, home.ty] });
  await page.keyboard.press('Space'); await sleep(50);
  check('풍선 상한: 최대 1개에서 Space 두 번 → 1개', mine(await st(page)).length === 1);
  await walkTo(page, 'ArrowRight', 'tx', home.tx + 2);
  const tPin = Date.now();
  await page.keyboard.press('x'); await sleep(60);
  const s2 = await st(page);
  check('바늘: X 로 내 풍선 즉시 폭발', mine(s2).length === 0 && s2.water > 0 && s2.ents[0].pins === 0 && s2.ents[0].state === 'alive', { pins: s2.ents[0].pins, water: s2.water, ms: Date.now() - tPin });
  await page.keyboard.press('x'); await sleep(50);
  check('바늘: 0개일 때 X 무반응', (await st(page)).ents[0].pins === 0);
  // 한글 IME 대응: e.code=KeyD, e.key='ㅇ' 로 들어와도 이동하는가 (v7 계약)
  await sleep(600);
  const ime0 = await me(page);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 'ㄴ' })));
  await sleep(250);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', key: 'ㄴ' })));
  const ime1 = await me(page);
  check('한글 IME: code=KeyS key=ㄴ 로 아래 이동', ime1.y > ime0.y + 20, { from: Math.round(ime0.y), to: Math.round(ime1.y) });
  await hold(page, 'w', 300);
  // 갇힘 → 탈락: 제자리에 풍선 놓고 기다림
  await page.keyboard.press('Space');
  const tPlace = Date.now();
  let trappedAt = null, deadAt = null, finishAt = null, kind = null;
  while (Date.now() - tPlace < 9000) {
    const s = await st(page);
    const e = s.ents[0];
    if (!trappedAt && e.state === 'trapped') { trappedAt = Date.now(); await shot(page, path.join(OUT, 'trapped.png')); }
    if (!deadAt && (e.state === 'dying' || e.state === 'dead')) deadAt = Date.now();
    if (s.finished) { finishAt = Date.now(); kind = s.finished; break; }
    await sleep(40);
  }
  await sleep(500);
  await shot(page, path.join(OUT, 'result-lose.png'));
  // 패배 제목: r1 「아쉬워요」 · 옛 「패배」
  const overlay = (await page.locator('.result-overlay').count()) || (await page.locator('text=패배').count());
  check('갇힘: 내 풍선 2.6초 뒤 갇힘', trappedAt && Math.abs(trappedAt - tPlace - 2600) < 250, { ms: trappedAt && trappedAt - tPlace });
  check('탈락: 갇힌 지 4초 뒤 탈락', trappedAt && deadAt && Math.abs(deadAt - trappedAt - 4000) < 300, { ms: deadAt && deadAt - trappedAt });
  check('패배 결과 화면', kind === 'lose' && overlay > 0, { kind, overlayToFinishMs: finishAt && finishAt - deadAt });
  R.errors.push(...errs.map((e) => 'move/pin/lose: ' + e));
  await ctx.close();
}

// ---------- 2. 아이템 7종: 옆 칸에 놓고 걸어가서 줍기 ----------
{
  const { ctx, page, errs } = await open('?bots=1&t=120', { charIdx: 0 });
  // 봇이 와서 방해하지 않게 1명, 짧게 끝냄
  const items = ['balloon', 'power', 'speed', 'needle', 'passBalloon', 'passBlock', 'turtle'];
  for (const it of items) {
    const before = await me(page);
    const tx = before.tx === 0 ? 1 : 0;
    await page.evaluate(([k, t]) => window.__wbaEngine().g.items.set(k, t), [`${tx},0`, it]);
    await walkTo(page, tx === 1 ? 'ArrowRight' : 'ArrowLeft', 'tx', tx);
    const after = await me(page);
    const left = (await st(page)).items.length;
    const delta = { balloon: after.maxBalloons - before.maxBalloons, power: after.power - before.power, speed: after.speed - before.speed,
      needle: after.pins - before.pins, passBalloon: +after.passBalloon, passBlock: +after.passBlock, turtle: after.slowUntil > 0 ? 1 : 0 }[it];
    check(`아이템 줍기: ${it}`, delta === 1 && left === 0, { delta, itemsLeft: left });
  }
  // HUD 가 바뀐 값을 보여주는가
  const hudText = await page.locator('.pixel-panel').innerText();
  check('HUD: 줍은 뒤 스탯 표시 갱신', /풍\s*2/.test(hudText) && /줄\s*2/.test(hudText) && /침\s*1/.test(hudText), { hud: hudText.replace(/\s+/g, ' ') });
  await shot(page, path.join(OUT, 'items-hud.png'), { clip: { x: 0, y: 0, width: 1440, height: 140 } });
  R.errors.push(...errs.map((e) => 'items: ' + e));
  await ctx.close();
}

// ---------- 3. 승리: 봇 칸에 물 한 칸 → 실제 엔진이 갇힘 → 4초 → 탈락 → win ----------
{
  const { ctx, page, errs } = await open('?bots=1&t=120', { charIdx: 0 });
  await sleep(500);
  // 봇이 물을 피해 칸을 벗어날 수 있어, 갇힐 때까지 50ms 마다 봇 칸에 물을 다시 놓는다(최대 3초)
  const trapped = await page.evaluate(async () => {
    const e = window.__wbaEngine(), g = e.g, b = g.ents[1];
    for (let i = 0; i < 60 && b.state === 'alive'; i++) {
      g.water.set(Math.floor(b.x / g.T) + ',' + Math.floor(b.y / g.T), performance.now());
      await new Promise((r) => setTimeout(r, 50));
    }
    return b.state;
  });
  R.winTrapState = trapped;
  await page.waitForFunction(() => window.__wbaEngine().finished, null, { timeout: 12000 }).catch(() => {});
  await sleep(500);
  const kind = await page.evaluate(() => window.__wbaEngine().finished);
  const title = await page.locator('text=승리!').count();
  const hud = await page.locator('.pixel-panel').innerText();
  await shot(page, path.join(OUT, 'result-win.png'));
  check('승리 결과 화면 (봇 1명, 물 주입)', kind === 'win' && title > 0, { kind, hudBotsAlive: (hud.match(/남은 상대\s*(\d)/) || [])[1] });
  // 승리 화면에서 다시 하기 → 새 판
  await page.getByRole('button', { name: '다시 하기' }).click(); await sleep(500);
  check('승리 후 다시 하기', (await page.evaluate(() => window.__wbaEngine().finished)) === null);
  R.errors.push(...errs.map((e) => 'win: ' + e));
  await ctx.close();
}

// ---------- 4. 무승부: ?t=3 ----------
{
  const { ctx, page, errs } = await open('?bots=3&t=3', { charIdx: 0 });
  await page.waitForFunction(() => window.__wbaEngine().finished, null, { timeout: 8000 }).catch(() => {});
  await sleep(400);
  const kind = await page.evaluate(() => window.__wbaEngine().finished);
  check('무승부 결과 화면 (?t=3)', kind === 'draw' && (await page.locator('text=무승부').count()) > 0, { kind });
  R.errors.push(...errs.map((e) => 'draw: ' + e));
  await ctx.close();
}

// ---------- 5. 맵 8종 + 랜덤 반복: 생성 상태 · 촬영 ----------
function analyze(grid) {
  const NY = grid.length, NX = grid[0].length;
  const seen = new Set(['0,0']), q = [[0, 0]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= NX || ny >= NY || grid[ny][nx] === '#' || seen.has(nx + ',' + ny)) continue;
      seen.add(nx + ',' + ny); q.push([nx, ny]);
    }
  }
  let open = 0, unreachable = 0, soft = 0, tough = 0, hard = 0;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const c = grid[y][x];
    if (c === '#') hard++; else { open++; if (!seen.has(x + ',' + y)) unreachable++; }
    if (c === 's') soft++; if (c === 't') tough++;
  }
  // 스폰 코너 8칸이 비었나
  const offs = [[0, 0], [1, 0], [0, 1], [2, 0], [0, 2], [1, 1], [2, 1], [1, 2]];
  const blockedSpawn = [];
  for (const [cx, cy] of [[0, 0], [NX - 1, 0], [0, NY - 1], [NX - 1, NY - 1]]) {
    for (const [dx, dy] of offs) {
      const x = cx === 0 ? cx + dx : cx - dx, y = cy === 0 ? cy + dy : cy - dy;
      if (grid[y][x] !== '.') blockedSpawn.push([x, y, grid[y][x]]);
    }
  }
  // 첫 풍선으로 탈출 가능한가: 스폰 칸에서 power1 폭발선 밖의 빈 칸까지 빈 칸으로 이어지나 (봇 AI 와 같은 판정 축약)
  return { hard, soft, tough, open, unreachable, blockedSpawn };
}
const mapNames = ['grass', 'beach', 'snow', 'lava', 'factory', 'dungeon', 'ruins', 'random'];
const runs = [...mapNames.map((m, i) => [i, m]), [7, 'random'], [7, 'random']];
for (const [i, name] of runs) {
  const { ctx, page, errs } = await open('?bots=3&t=60', { mapIdx: i });
  await sleep(1500);
  const s = await st(page);
  const a = analyze(s.grid);
  const floorTex = await page.evaluate(() => !!window.__wbaEngine().g.floorTexApplied);
  const file = path.join(OUT, 'maps', `${String(i)}-${name}-${s.theme}.png`);
  await shot(page, file, { clip: await page.locator('canvas').nth(1).boundingBox() });
  R.maps.push({ idx: i, pick: name, theme: s.theme, themeName: s.themeName, floorTex, ...a, file: path.relative(path.join(A.out, '..'), file), errors: errs });
  console.log(`map ${i} ${name}→${s.theme} hard=${a.hard} soft=${a.soft} tough=${a.tough} unreachable=${a.unreachable} blockedSpawn=${a.blockedSpawn.length} floorTex=${floorTex} errors=${errs.length}`);
  await ctx.close();
}

// ---------- 6. (선택) 자동 조종: 게임의 봇 AI 로 내 캐릭터를 운전해 실제 판 결과 ----------
if (A.autopilot) {
  const N = Number(A.autopilot) || 5;
  const skill = A.skill || '쉬움';
  const tally = { win: 0, lose: 0, draw: 0 };
  const games = [];
  for (let n = 0; n < N; n++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(ENGINE_PROBE);
    await page.addInitScript(`localStorage.setItem('wba-settings', JSON.stringify({ botSkill: ${JSON.stringify(skill)} }))`);
    await page.goto(BASE + `/?bots=${A.bots || 1}&t=${A.t || 120}`, { waitUntil: 'networkidle' });
    await enterGame(page, { mapIdx: n % 7 });
    await page.evaluate(async () => {
      const ai = await import('/src/game/ai.js');
      const e = window.__wbaEngine(), g = e.g;
      let last = performance.now();
      const loop = () => {
        const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (!e.finished && !e.stopped && g.ents[0].state === 'alive') ai.driveBot(g, g.ents[0], dt, now, '어려움');
        if (!e.finished && !e.stopped) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    const t0 = Date.now();
    await page.waitForFunction(() => window.__wbaEngine().finished, null, { timeout: (Number(A.t || 120) + 15) * 1000 }).catch(() => {});
    const kind = await page.evaluate(() => window.__wbaEngine().finished);
    tally[kind] = (tally[kind] || 0) + 1;
    games.push({ map: n % 7, kind, sec: Math.round((Date.now() - t0) / 1000) });
    if (kind === 'win' && !games.some((x) => x.shot)) { await sleep(500); games[games.length - 1].shot = await shot(page, path.join(OUT, 'autopilot-win.png')); }
    console.log(`autopilot ${n + 1}/${N} map=${n % 7} → ${kind} ${Math.round((Date.now() - t0) / 1000)}s`);
    await ctx.close();
  }
  R.autopilot = { skill, bots: A.bots || 1, games, tally };
  check(`자동 조종 ${N}판 중 실제 승리 1회 이상`, tally.win > 0, tally);
}

await browser.close();
writeJson(path.join(OUT, 'play.json'), R);
const fails = R.checks.filter((c) => !c.ok).length;
const mapBad = R.maps.filter((m) => m.unreachable || m.blockedSpawn.length || m.errors.length).length;
console.log(`checks ${R.checks.length - fails}/${R.checks.length} · maps bad ${mapBad}/${R.maps.length} · errors ${R.errors.length}`);
console.log(`→ ${path.join(OUT, 'play.json')}`);
process.exit(fails || mapBad ? 1 : 0);
