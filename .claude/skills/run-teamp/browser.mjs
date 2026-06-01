#!/usr/bin/env node
/**
 * Teamp 렌더 검증 — 실제 헤드리스 Chromium(Playwright)으로 앱을 띄워
 * React가 #root에 실제로 렌더하는지(=빈 화면·무한 로딩이 아닌지) 확인하고
 * 스크린샷을 남긴다. curl 스모크(smoke.sh)가 못 잡는 런타임/렌더 레이어.
 *
 * 사용: node .claude/skills/run-teamp/browser.mjs
 * 산출: .claude/skills/run-teamp/screenshot.png
 * 종료코드: 렌더 성공=0, 실패=1
 *
 * 전제: .env 존재(빌드용). playwright + chromium 설치돼 있어야 함
 *   (npm i -D playwright && npx playwright install chromium).
 */
import { chromium } from 'playwright'
import { execSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SHOT = resolve(dirname(fileURLToPath(import.meta.url)), 'screenshot.png')
const URL = 'http://localhost:4173/'

let preview, browser, code = 1
const log = (m) => console.log(m)

try {
  log('── 1/3 빌드 ──')
  execSync('npm run build', { cwd: root, stdio: 'ignore' })
  log('✓ 빌드 성공')

  log('── 2/3 preview 기동 ──')
  preview = spawn('npm', ['run', 'preview'], { cwd: root, stdio: 'ignore' })
  // 서버 대기
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(URL); if (r.ok) break } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`✓ preview 기동 (${URL})`)

  log('── 3/3 브라우저 렌더 검증 ──')
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }) // iPhone 폭
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
  // React가 #root에 실제로 마운트할 때까지 대기 (빈 셸이면 실패)
  await page.waitForFunction(() => {
    const r = document.querySelector('#root')
    return r && r.children.length > 0 && r.innerText.trim().length > 0
  }, { timeout: 15000 })

  const title = await page.title()
  const text = (await page.locator('#root').innerText()).replace(/\s+/g, ' ').slice(0, 80)
  await page.screenshot({ path: SHOT, fullPage: false })

  log(`✓ #root 렌더됨 — title="${title}"`)
  log(`✓ 화면 텍스트: "${text}…"`)
  log(`✓ 스크린샷: ${SHOT}`)
  if (errors.length) log(`⚠️ 콘솔 pageerror ${errors.length}건: ${errors.slice(0, 3).join(' | ')}`)
  else log('✓ 페이지 에러 없음')

  log('──────────────────────')
  log('✅ 렌더 검증 통과')
  code = 0
} catch (e) {
  log('❌ 렌더 검증 실패: ' + e.message)
} finally {
  if (browser) await browser.close().catch(() => {})
  if (preview) preview.kill()
  try { execSync('pkill -f "vite preview"', { stdio: 'ignore' }) } catch {}
  process.exit(code)
}
