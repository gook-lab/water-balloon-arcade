// QA 결과 요약 · 비교 — out/ 의 JSON 에서 핵심 수치만 뽑아 표로 찍는다.
// 사용: node docs/upgrade/qa/summary.mjs --label <이번> [--base <기준>]
import fs from 'node:fs';
import path from 'node:path';
import { args } from './lib.mjs';

const A = args({ out: path.join(path.dirname(new URL(import.meta.url).pathname), 'out') });
const read = (kind, label, file) => { try { return JSON.parse(fs.readFileSync(path.join(A.out, kind, label, file), 'utf8')); } catch { return null; } };

function metrics(label) {
  const m = {};
  const s = read('smoke', label, 'smoke.json');
  if (s) {
    for (const f of s.flows) {
      if (f.fail) { m[`흐름 ${f.size}`] = 'FAIL'; continue; }
      const ok = f.steps.restart.resultGone && f.steps.toMap && f.steps.toChar && f.steps.backToTitle;
      m[`흐름 ${f.size}`] = `${ok ? 'ok' : 'BROKEN'} · 오류 ${f.errors.length} · 넘침 ${Object.values(f.steps).filter((v) => v && v.hOverflow).length} · 게임 시작 scrollY ${f.steps.game.scrollY}`;
    }
    const k = s.keyboard;
    if (k && !k.fail) m['키보드'] = `카드 포커스 ${k.charCardFocusable}/${k.mapCardFocusable} · 결과 Space ${k.spaceActivatesRestart} · Enter ${k.enterActivatesRestart ?? k.spaceActivatesRestart}`;
  }
  const p = read('play', label, 'play.json');
  if (p) {
    m['플레이 점검'] = `${p.checks.filter((c) => c.ok).length}/${p.checks.length} 통과`;
    const fails = p.checks.filter((c) => !c.ok).map((c) => c.name);
    if (fails.length) m['플레이 실패'] = fails.join(', ');
    m['맵'] = `${p.maps.length}판 · 막힘 ${p.maps.filter((x) => x.unreachable || x.blockedSpawn.length).length} · 오류 ${p.maps.reduce((a, x) => a + x.errors.length, 0)} · 하드블록 ${p.maps.slice(0, 7).map((x) => x.theme + ' ' + x.hard).join(' / ')}`;
  }
  const a = read('a11y', label, 'a11y.json');
  if (a) {
    m['axe 위반'] = Object.entries(a.axe).map(([k, v]) => `${k} ${v.violations.length}`).join(' · ');
    m['작은 글자 대비 미달'] = Object.values(a.contrast).flat().filter((x) => !x.pass).length;
    m['축소 모션'] = `reduce 에서 도는 애니메이션 ${a.motion.reduce?.running.length}`;
    m['소리'] = a.audio ? `제스처 전 ctx ${a.audio.beforeGesture.contexts} → 후 ${a.audio.afterGesture.state} · 끔 master ${a.audio.muted.master}` : '-';
  }
  const f = read('perf', label, 'perf.json');
  if (f) {
    for (const r of f.fps) m[`fps ${r.name}`] = `${r.fps} · p95 ${r.p95FrameMs}ms · step ${r.stepAvgMs}ms`;
    for (const r of f.load) m[`로딩 ${r.name}`] = `${r.totalKB}KB · FCP ${r['first-contentful-paint']}ms · load ${r.loadMs}ms`;
    if (f.restart) m['다시 하기 20회'] = `nodes ${f.restart.restart[0].nodes}→${f.restart.restart.at(-1).nodes} · heap ${f.restart.restart[0].heapMB}→${f.restart.restart.at(-1).heapMB}MB`;
  }
  const mem = read('perf', label + '-memory', 'perf.json');
  if (mem && mem.memory) m['긴 판 힙'] = `${mem.memory.samples[0].heapMB}→${mem.memory.samples.at(-1).heapMB}MB (${mem.memory.samples.at(-1).tSec}s)`;
  const mo = read('mobile', label + '-chromium', 'mobile.json');
  if (mo) for (const d of mo.devices) m[`휴대폰 ${d.name}`] = `캔버스 비율 ${d.canvas.aspect}/${d.canvas.expected} · 터치 이동 ${d.touchEffect.moved}px · 풍선 ${d.touchEffect.balloonsPlaced} · 방치 ${d.idleOutcome.kind} ${d.idleOutcome.sec}s`;
  return m;
}

const cur = metrics(A.label);
const base = A.base ? metrics(A.base) : null;
const keys = [...new Set([...Object.keys(base || {}), ...Object.keys(cur)])];
for (const k of keys) {
  const c = cur[k] ?? '-';
  if (base) { const b = base[k] ?? '-'; console.log(`${String(b) === String(c) ? ' ' : '*'} ${k}\n    기준 ${b}\n    이번 ${c}`); }
  else console.log(`${k}: ${c}`);
}
