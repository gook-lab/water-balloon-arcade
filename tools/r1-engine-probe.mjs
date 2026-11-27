#!/usr/bin/env node
// 2단계 1라운드 엔진 확인 — 카운트다운 · 일시정지(Esc · HUD 버튼 · 탭 숨김) · 결과 화면(통계 · 새 기록 · 포커스 · Space) ·
// 결과 복사(허용 · 막힘) · 효과음 녹음본 요청을 실제 브라우저로 확인하고 촬영합니다.
// 쓰임: node tools/r1-engine-probe.mjs [주소=http://localhost:5321] [촬영 폴더=docs/upgrade/r1/engine]
// 필요: Playwright — PLAYWRIGHT 환경 변수(기본은 옆 레포 dokkaebi-quest 의 설치본)
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT || `${process.env.HOME}/sonix/toy/dokkaebi-quest/node_modules/playwright`)
const BASE = process.argv[2] || 'http://localhost:5321'
const OUT = resolve(process.argv[3] || 'docs/upgrade/r1/engine')
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, note = '') => { results.push({ name, ok: !!ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function enterGame(page, query) {
  await page.goto(`${BASE}/${query}`)
  await page.getByRole('button', { name: /게임 시작|시작하기/ }).first().click()
  await page.getByRole('button', { name: /^다음$/ }).click()
  await page.getByRole('button', { name: /^(입장|시작하기)$/ }).click()
}

const browser = await chromium.launch()
try {
  /* 1) 카운트다운 · 일시정지 · 결과 · 복사(허용) */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  const sfx = new Map()
  page.on('response', (r) => { const m = r.url().match(/\/sfx\/(\w+)\.mp3/); if (m) sfx.set(m[1], r.status()) })

  // 이전 기록을 심어 둔다 — 보통 1판, 최장 1초 → 이번 판 생존 시간이 새 기록
  await page.goto(`${BASE}/`)
  await page.evaluate(() => localStorage.setItem('wba-records', JSON.stringify({ version: 1, levels: { '보통': { played: 1, wins: 0, streak: 0, bestStreak: 0, longestMs: 1000, mostTrapped: 5 } } })))
  await enterGame(page, '?t=6&bots=1')

  const cd = page.locator('.countdown-overlay')
  await cd.waitFor({ timeout: 3000 })
  check('카운트다운 3 이 뜬다', (await cd.innerText()).trim() === '3')
  await sleep(300) // 튀어나오는 애니메이션(.25s)이 끝난 뒤 촬영
  await page.screenshot({ path: `${OUT}/01-countdown.png` })
  await page.keyboard.press('Space') // 카운트다운 중 Space — 풍선이 놓이면 안 됨(단위 시험이 판정, 여기선 오류 없음만)
  await page.waitForFunction(() => document.querySelector('.countdown-overlay')?.innerText.trim() === '시작!', null, { timeout: 3000 })
  await sleep(300)
  await page.screenshot({ path: `${OUT}/02-go.png` })
  await page.waitForFunction(() => !document.querySelector('.countdown-overlay'), null, { timeout: 3000 })
  check('「시작!」 뒤 카운트다운이 사라진다', true)

  // Esc 일시정지
  await page.keyboard.press('Escape')
  const pause = page.getByRole('dialog', { name: '잠깐 멈췄어요' })
  await pause.waitFor({ timeout: 2000 })
  check('Esc 로 일시정지 화면', await pause.isVisible())
  check('일시정지 첫 버튼에 포커스', (await page.evaluate(() => document.activeElement?.textContent)) === '계속할게요')
  const clockA = await page.locator('.pixel-panel').innerText()
  await sleep(2200)
  const clockB = await page.locator('.pixel-panel').innerText()
  check('멈춘 동안 HUD 시계가 그대로', clockA === clockB, clockA.split('\n').pop())
  await page.screenshot({ path: `${OUT}/03-paused-esc.png` })
  await page.keyboard.press('Escape')
  await pause.waitFor({ state: 'detached', timeout: 2000 })
  check('Esc 로 다시 이어진다', true)

  // HUD 일시정지 버튼
  await page.getByRole('button', { name: '일시정지' }).click()
  await pause.waitFor({ timeout: 2000 })
  check('HUD 「일시정지」 버튼으로 멈춘다', await pause.isVisible())
  await page.getByRole('button', { name: '계속할게요' }).click()
  await pause.waitFor({ state: 'detached', timeout: 2000 })

  // 탭 숨김(visibilitychange)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await pause.waitFor({ timeout: 2000 })
  check('탭을 숨기면 일시정지 화면이 떠 있다', await pause.isVisible())
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await sleep(300)
  check('탭이 돌아와도 사람이 누를 때까지 멈춰 있다', await pause.isVisible())
  await page.screenshot({ path: `${OUT}/04-paused-hidden.png` })
  await page.keyboard.press('Space') // 포커스된 「계속할게요」를 Space 로
  await pause.waitFor({ state: 'detached', timeout: 2000 })
  check('일시정지 화면 버튼이 Space 로 눌린다', true)

  // 결과 화면(?t=6 → 무승부)
  const result = page.locator('.result-overlay')
  await result.waitFor({ timeout: 12000 })
  await sleep(400)
  const resultText = await result.innerText()
  check('결과에 넷(버틴 시간 · 가둔 · 터뜨린 · 아이템)', ['버틴 시간', '가둔 상대', '터뜨린 상대', '먹은 아이템'].every((s) => resultText.includes(s)))
  check('생존 시간이 새 기록 — 가둔 수(이전 5)는 아님', (resultText.match(/새 기록이에요!/g) || []).length === 1)
  check('결과 첫 버튼에 포커스(S5)', (await page.evaluate(() => document.activeElement?.textContent)) === '다시 하기')
  check('결과 문장이 role=status', (await page.locator('.result-overlay [role="status"]').innerText()).includes('무승부'))
  await page.getByRole('button', { name: '결과 복사' }).click()
  await page.getByText('복사했어요').waitFor({ timeout: 2000 })
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  check('결과 복사 — 클립보드 한 줄 + 링크', /^물풍선 대작전 · 보통 · \d+초 버텼어요/.test(clip) && clip.includes('?from=share'), clip.replace('\n', ' ⏎ '))
  await page.screenshot({ path: `${OUT}/05-result.png` })
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('wba-records')).levels['보통'])
  check('기록 저장(판 수 2 · 최장 갱신)', saved.played === 2 && saved.longestMs > 1000, JSON.stringify(saved))
  await page.reload()
  const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('wba-records')).levels['보통'].played)
  check('새로 고침 뒤에도 기록 유지', afterReload === 2)

  // 결과 화면 Space 로 다시 하기(S4)
  await enterGame(page, '?t=4&bots=1')
  await result.waitFor({ timeout: 12000 })
  await sleep(300)
  await page.keyboard.press('Space')
  await page.locator('.countdown-overlay').waitFor({ timeout: 3000 })
  check('결과 화면에서 Space 로 「다시 하기」(S4)', !(await result.count()))

  check('효과음 녹음본 12종 200', sfx.size === 12 && [...sfx.values()].every((s) => s === 200), `${sfx.size}종`)
  check('페이지 오류 · 콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()

  /* 2) 클립보드가 막힌 환경 · localStorage 가 막힌 환경 */
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx2.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new Error('blocked')) }) })
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError') } })
  })
  const page2 = await ctx2.newPage()
  const errors2 = []
  page2.on('pageerror', (e) => errors2.push(String(e)))
  await enterGame(page2, '?t=4&bots=1')
  const result2 = page2.locator('.result-overlay')
  await result2.waitFor({ timeout: 12000 })
  check('localStorage 가 막혀도 판이 끝나 결과가 뜬다', await result2.isVisible())
  await page2.getByRole('button', { name: '결과 복사' }).click()
  const ta = page2.getByRole('textbox', { name: '공유할 결과 글' })
  await ta.waitFor({ timeout: 2000 })
  const sel = await page2.evaluate(() => { const t = document.activeElement; return t && t.tagName === 'TEXTAREA' ? t.value.slice(t.selectionStart, t.selectionEnd) : '' })
  check('클립보드가 막히면 글을 골라 둔 채로 보여 준다', sel.startsWith('물풍선 대작전'))
  await page2.screenshot({ path: `${OUT}/06-copy-blocked.png` })
  check('막힌 환경에서도 페이지 오류 없음', errors2.length === 0, errors2.slice(0, 3).join(' | '))
  await ctx2.close()

  /* 3) 축소 모션 — 오버레이에 애니메이션이 없어야 */
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const page3 = await ctx3.newPage()
  await enterGame(page3, '?t=60&bots=1')
  await page3.locator('.countdown-overlay').waitFor({ timeout: 3000 })
  const anim = await page3.evaluate(() => getComputedStyle(document.querySelector('.countdown-overlay [role="status"]')).animationName)
  check('축소 모션이면 카운트다운 애니메이션 없음', anim === 'none', anim)
  await ctx3.close()
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 통과`)
process.exit(failed.length ? 1 : 0)
