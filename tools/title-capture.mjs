// 대표 그림(Codex) 입력용 실제 게임 촬영 — 레포 루트에서: node tools/title-capture.mjs (미리보기 서버 5343)
import path from 'node:path';
import { chromium, shot, ENGINE_PROBE, enterGame, sleep, clickText, NAMES } from '../docs/upgrade/qa/lib.mjs';
const OUT = path.resolve('docs/art/key-art-src');
const BASE = 'http://127.0.0.1:5343';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(ENGINE_PROBE);
// 1) 캐릭터 고르기 화면 — 여섯 캐릭터
await page.goto(BASE + '/?bots=3&t=120', { waitUntil: 'networkidle' });
await clickText(page, NAMES.start); await sleep(500);
await shot(page, path.join(OUT, 'shot-1-characters.png'));
await clickText(page, NAMES.next); await sleep(300);
await clickText(page, NAMES.enter);
await page.waitForFunction(() => window.__wbaEngine && window.__wbaEngine());
const canvas = page.locator('canvas.game-canvas');
await sleep(4200);
// 2) 플레이 중 — 풍선 놓고 물줄기
await page.keyboard.down('ArrowRight'); await sleep(250); await page.keyboard.up('ArrowRight');
await page.keyboard.press('Space'); await sleep(120);
await page.keyboard.down('ArrowLeft'); await sleep(260); await page.keyboard.up('ArrowLeft');
await page.keyboard.down('ArrowDown'); await sleep(300); await page.keyboard.up('ArrowDown');
for (let i = 0; i < 40; i++) { const w = await page.evaluate(() => window.__wbaEngine().g.water.size); if (w > 0) break; await sleep(100); }
await sleep(120);
await canvas.screenshot({ path: path.join(OUT, 'shot-2-splash.png') });
// 3) 좀 더 진행된 판 — 봇들이 상자를 깬 뒤
await sleep(9000);
await canvas.screenshot({ path: path.join(OUT, 'shot-3-midgame.png') });
await browser.close();
