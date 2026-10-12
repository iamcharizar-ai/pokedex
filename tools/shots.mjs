// Screenshots of every tab under every fixture, compared with the ones kept in
// tests/baseline/. A change that moves a pixel somewhere it should not fails
// here, and the difference is written to tests/diff/ to look at.
//
//   npm run shots            compare against the baseline (exit 1 on a difference)
//   npm run shots -- --update   take new baselines (after a change you meant to make)
//   npm run shots -- boss    only the fixtures named
//
// Nothing here touches the real game: the page is opened with ?fixture=, which
// switches the ledger off (src/lib/fixtures.ts). Motion is stopped and the
// sprites (animated GIFs, which never hold still) are covered, so a run is the
// same every time.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const BASE = path.join(ROOT, 'tests', 'baseline')
const DIFF = path.join(ROOT, 'tests', 'diff')
const PORT = 5199
const TABS = ['Home', 'Team', 'Shop', 'Pokedex', 'Trainer']
const FIXTURES = ['empty', 'week', 'late', 'boss']
const VIEW = { width: 390, height: 844 }
/** Share of pixels allowed to differ (font smoothing and the like) before a screenshot counts as changed. */
const TOLERANCE = 0.002
/** Longest part of a page that is kept. */
const MAX_HEIGHT = 4500

const args = process.argv.slice(2)
const update = args.includes('--update')
const only = args.filter((a) => !a.startsWith('--'))
const fixtures = only.length ? FIXTURES.filter((f) => only.includes(f)) : FIXTURES

// serve the built app, so the run does not depend on a dev server being open
async function serve() {
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return child } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  child.kill()
  throw new Error('the preview server did not start (run npm run build first)')
}

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) { console.error('no build: run `npm run build` first'); process.exit(2) }
fs.mkdirSync(BASE, { recursive: true })
fs.rmSync(DIFF, { recursive: true, force: true })

const server = await serve()
const browser = await chromium.launch()
let failed = 0, made = 0, same = 0
const heights = []
try {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    // nothing may move, and a fixed clock keeps "today" out of the pictures
    const style = document.createElement('style')
    style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })
  for (const name of fixtures) {
    const page = await ctx.newPage()
    await page.goto(`http://localhost:${PORT}/?fixture=${name}`)
    await page.waitForSelector('.navbar button')
    await page.waitForTimeout(600)
    for (const tab of TABS) {
      await page.click(`.navbar button[aria-label="${tab}"]`)
      await page.waitForTimeout(400)
      await page.evaluate(() => window.scrollTo(0, 0))
      const file = `${name}-${tab.toLowerCase()}.png`
      // the top of the page is what is compared: a tab longer than this is its own finding (see tests/heights.txt)
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      heights.push(`${file.replace('.png', '')}	${height}`)
      const shot = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: VIEW.width, height: Math.min(height, MAX_HEIGHT) }, mask: await page.locator('img.sprite, .fixturetag').all(), maskColor: '#ff00ff' })
      const baseline = path.join(BASE, file)
      if (update || !fs.existsSync(baseline)) { fs.writeFileSync(baseline, shot); made++; continue }
      const a = PNG.sync.read(fs.readFileSync(baseline)), b = PNG.sync.read(shot)
      if (a.width !== b.width || a.height !== b.height) {
        failed++
        fs.mkdirSync(DIFF, { recursive: true })
        fs.writeFileSync(path.join(DIFF, file), shot)
        console.log(`CHANGED  ${file}: ${a.width}x${a.height} became ${b.width}x${b.height}`)
        continue
      }
      const out = new PNG({ width: a.width, height: a.height })
      const n = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0.1 })
      if (n / (a.width * a.height) > TOLERANCE) {
        failed++
        fs.mkdirSync(DIFF, { recursive: true })
        fs.writeFileSync(path.join(DIFF, file), PNG.sync.write(out))
        console.log(`CHANGED  ${file}: ${n} pixels (${((n / (a.width * a.height)) * 100).toFixed(2)}%)  see tests/diff/${file}`)
      } else same++
    }
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
if (!only.length) fs.writeFileSync(path.join(ROOT, 'tests', 'heights.txt'), ['How tall each screen is, in pixels at 390 wide (a phone). A tab past about 2,500 has stuff merged in it.', ...heights, ''].join('\n'))
console.log(`${same} the same, ${made} written, ${failed} changed`)
process.exit(failed ? 1 : 0)
