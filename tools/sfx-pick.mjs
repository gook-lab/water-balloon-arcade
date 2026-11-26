#!/usr/bin/env node
// 효과음 다듬기 — docs/upgrade/sfx/<key>-<n>.mp3 후보를 앞뒤 무음 자르기 · 최고점 −1dB 맞추기 · 짧은 페이드아웃으로 다듬습니다.
// 쓰임: node tools/sfx-pick.mjs
//   docs/upgrade/sfx/norm/<key>-<n>.mp3 — 모든 후보를 같은 기준으로 다듬은 것(비교 듣기용, index.html 이 씀)
//   public/sfx/<key>.mp3                — tools/sfx-picks.json 에서 고른 번호(게임이 씀)
// 필요: ffmpeg · ffprobe
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'docs/upgrade/sfx')
const NORM = join(SRC, 'norm')
const OUT = join(ROOT, 'public/sfx')
const picks = JSON.parse(readFileSync(join(ROOT, 'tools/sfx-picks.json'), 'utf8'))
const { sounds } = JSON.parse(readFileSync(join(ROOT, 'tools/sfx-prompts.json'), 'utf8'))
mkdirSync(NORM, { recursive: true })
mkdirSync(OUT, { recursive: true })

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
/** 최고점(dB) — volumedetect 는 결과를 stderr 로 내니 셸로 합쳐 읽습니다 */
const maxDb = (file) => {
  const r = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af volumedetect -f null - 2>&1`], { encoding: 'utf8' })
  return Number(r.match(/max_volume: (-?[\d.]+) dB/)[1])
}
const dur = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }))

const rows = []
for (const f of readdirSync(SRC).filter((f) => /^[a-zA-Z]+-\d+\.mp3$/.test(f)).sort()) {
  const src = join(SRC, f)
  const tmp = join(NORM, `.${f}.wav`)
  // 1) 앞 무음 자르기 → 뒤집어 뒤 무음 자르기(-50dB 아래를 무음으로)
  ff(['-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse', tmp])
  // 2) 최고점을 −1dB 로, 끝 30ms 페이드아웃
  const gain = -1 - maxDb(tmp)
  const d = dur(tmp)
  const out = join(NORM, f)
  ff(['-i', tmp, '-af', `volume=${gain.toFixed(2)}dB,afade=t=out:st=${Math.max(0, d - 0.03).toFixed(3)}:d=0.03`, '-c:a', 'libmp3lame', '-b:a', '128k', out])
  execFileSync('rm', [tmp])
  rows.push({ f, gain: gain.toFixed(1), d: dur(out).toFixed(2) })
}
for (const [key, n] of Object.entries(picks)) copyFileSync(join(NORM, `${key}-${n}.mp3`), join(OUT, `${key}.mp3`))

// 비교 듣기 페이지 — 파일로 바로 엽니다(서버 필요 없음)
const prompt = Object.fromEntries(sounds.map((s) => [s.key, s.prompt]))
const keys = [...new Set(rows.map((r) => r.f.split('-')[0]))]
const html = `<!doctype html><meta charset="utf-8"><title>물풍선 효과음 후보</title>
<style>body{font:15px/1.5 system-ui;background:#14122a;color:#eeecf7;max-width:860px;margin:24px auto;padding:0 16px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #3a356a;padding:8px;text-align:left;vertical-align:top}
.pick{color:#58e6d9;font-weight:700}small{color:#b3aed6}audio{width:220px;height:32px}</style>
<h1>물풍선 대작전 — 효과음 후보 (ElevenLabs)</h1>
<p><small>모두 같은 기준(앞뒤 무음 자르기 · 최고점 −1dB)으로 다듬은 것입니다. <span class="pick">●</span> 이 지금 게임에 들어가는 후보입니다(tools/sfx-picks.json).</small></p>
<table><tr><th>소리</th><th>후보 1</th><th>후보 2</th></tr>
${keys
  .map((k) => {
    const cell = (n) => {
      const r = rows.find((x) => x.f === `${k}-${n}.mp3`)
      return r ? `<td>${picks[k] === n ? '<span class="pick">● </span>' : ''}<audio controls preload="none" src="norm/${k}-${n}.mp3"></audio><br><small>${r.d}s · 키움 ${r.gain}dB</small></td>` : '<td>—</td>'
    }
    return `<tr><td><b>${k}</b><br><small>${prompt[k] ?? ''}</small></td>${cell(1)}${cell(2)}</tr>`
  })
  .join('\n')}
</table>`
writeFileSync(join(SRC, 'index.html'), html)
console.log(rows.map((r) => `${r.f} ${r.d}s gain ${r.gain}dB`).join('\n'))
console.log(`→ public/sfx ${Object.keys(picks).length}개 · 비교 페이지 docs/upgrade/sfx/index.html`)
