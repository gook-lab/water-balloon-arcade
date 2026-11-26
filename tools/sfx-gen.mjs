#!/usr/bin/env node
// 효과음 생성 — ElevenLabs Sound Effects(POST /v1/sound-generation)로 tools/sfx-prompts.json 의 소리를 만듭니다.
// 쓰임: node --env-file=<키 파일> tools/sfx-gen.mjs [--variants 2] [--only <key>] [--dry-run]
//   결과: docs/upgrade/sfx/<key>-<n>.mp3 (후보). 고른 것은 public/sfx/<key>.mp3 로 옮깁니다(tools/sfx-pick.mjs).
//   이미 있는 파일은 건너뛰어 다시 돌려도 크레딧을 또 쓰지 않습니다. CAP 을 넘길 것 같으면 멈춥니다.
// 키는 환경 변수 ELEVENLABS_API_KEY 로만 받고, 출력 · 파일 어디에도 남기지 않습니다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { model_id, style, sounds } = JSON.parse(readFileSync(join(ROOT, 'tools/sfx-prompts.json'), 'utf8'))
const OUT = join(ROOT, 'docs/upgrade/sfx')
const BASE = 'https://api.elevenlabs.io/v1'
const CAP = 3000 // 이번 묶음 크레딧 상한
const args = process.argv.slice(2)
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt)
const variants = Number(opt('--variants', '2'))
const only = opt('--only', '')
const dry = args.includes('--dry-run')
const key = process.env.ELEVENLABS_API_KEY ?? ''
if (!key) throw new Error('ELEVENLABS_API_KEY 가 없습니다')

async function credits() {
  const res = await fetch(`${BASE}/user/subscription`, { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`구독 조회 실패 ${res.status}`)
  const d = await res.json()
  return d.character_limit - d.character_count
}

async function generate(s, attempt = 1) {
  const res = await fetch(`${BASE}/sound-generation?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text: `${s.prompt}. ${style}`, duration_seconds: s.seconds, prompt_influence: 0.5, model_id }),
    signal: AbortSignal.timeout(120_000),
  })
  // 요청이 몰리면 429 — 잠깐 쉬었다 다시(최대 4번)
  if (res.status === 429 && attempt < 4) {
    await new Promise((r) => setTimeout(r, 3000 * attempt))
    return generate(s, attempt + 1)
  }
  if (!res.ok) throw new Error(`${s.key} 생성 실패 ${res.status} ${(await res.text()).slice(0, 300)}`)
  return Buffer.from(await res.arrayBuffer())
}

mkdirSync(OUT, { recursive: true })
const todo = sounds
  .filter((s) => !only || s.key === only)
  .flatMap((s) => Array.from({ length: variants }, (_, i) => ({ ...s, file: join(OUT, `${s.key}-${i + 1}.mp3`) })))
  .filter((t) => !existsSync(t.file))
const start = await credits()
console.log(`할 것 ${todo.length}개 · 남은 크레딧 ${start}`)
if (dry) process.exit(0)
let used = 0
// 1초당 소모 — 잔액 반영이 늦어 호출 직후엔 0 으로 보일 때가 있으니(11/26) 그때는 넉넉히 100/초로 셉니다
const PER_SEC_GUESS = 100
for (const t of todo) {
  if (used + PER_SEC_GUESS * t.seconds > CAP) {
    console.log(`상한 ${CAP} 에 닿아 멈춥니다(지금까지 ${used})`)
    break
  }
  writeFileSync(t.file, await generate(t))
  used += PER_SEC_GUESS * t.seconds
  console.log(`✓ ${t.file.slice(ROOT.length + 1)} ${t.seconds}s`)
}
console.log(`끝 · 상한 계산용 누계 ${used}(실제 잔액은 몇 분 뒤 --dry-run 으로 확인)`)
