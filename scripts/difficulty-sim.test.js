// 난이도 헤드리스 시뮬 — 가짜 시계로 엔진을 렌더 없이 돌려, 조작 없이 서 있는 플레이어를
// 봇 3마리가 얼마나 빨리 잡는지 난이도별로 잰다. 봇 AI 에 난수가 섞여 있어 기본 테스트에서는 빠지고
// 수동으로 돌린다:  npm run sim:difficulty   (판 수: SIM_N, 기본 30)
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/game/renderer.js', () => ({ draw: vi.fn(), drawStatic: vi.fn(), drawParts: vi.fn(), drawMapPreview: vi.fn() }));

let clock = 0;
globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
vi.spyOn(performance, 'now').mockImplementation(() => clock);

const { GameEngine } = await import('../src/game/engine.js');

const STEP_MS = 16, LIMIT_MS = 120_000;

function runMatch(skill, mapIdx) {
  clock = 0;
  const engine = new GameEngine({ canvas: null, charIdx: 0, mapIdx, tileSize: 100, matchSeconds: 999, botCount: 3, botSkill: skill });
  engine.start();
  clearInterval(engine.timer);
  while (clock < LIMIT_MS && !engine.finished && engine.g.ents[0].state === 'alive') {
    clock += STEP_MS;
    engine.step(engine.g);
  }
  const caught = engine.g.ents[0].state !== 'alive';
  engine.stop();
  // 못 잡은 판은 제한시간으로 친다 (중도절단)
  return { caught, ms: caught ? clock : LIMIT_MS };
}

function summarize(skill, n) {
  const runs = Array.from({ length: n }, (_, i) => runMatch(skill, i % 3));
  const caughtRate = runs.filter((r) => r.caught).length / n;
  const meanMs = runs.reduce((a, r) => a + r.ms, 0) / n;
  return { skill, caughtRate, meanS: meanMs / 1000 };
}

describe.skipIf(!process.env.SIM)('난이도 헤드리스 시뮬', () => {
  it('쉬움 < 보통 < 어려움 순으로 가만히 있는 플레이어를 빨리 잡는다', () => {
    const N = Number(process.env.SIM_N || 30);
    const rows = ['쉬움', '보통', '어려움'].map((s) => summarize(s, N));
    console.table(rows.map((r) => ({ 난이도: r.skill, 잡은비율: r.caughtRate.toFixed(2), 평균시간s: r.meanS.toFixed(1) })));
    const [easy, normal, hard] = rows;
    // 잡기까지 평균 시간(못 잡은 판 = 제한시간)이 난이도 순으로 짧아져야 한다
    expect(easy.meanS).toBeGreaterThan(normal.meanS);
    expect(normal.meanS).toBeGreaterThan(hard.meanS);
  }, 600_000);
});
