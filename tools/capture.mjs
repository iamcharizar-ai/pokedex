// Before/after pictures for a phase (UI-REWORK-HANDOFF §4): phone (390) and desktop (1280) of the tabs named,
// from the built app under a fixture, with sprites shown (not masked) so the owner sees the real screen.
//
//   node tools/capture.mjs <outdir> [fixture=late] [Shop Pokedex Journey ...]
//
// Needs `npm run build` first. Nothing here touches the real game (?fixture= switches the ledger off).
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = 5198
const [out, ...rest] = process.argv.slice(2)
if (!out) { console.error('usage: node tools/capture.mjs <outdir> [fixture=late] [tabs...]'); process.exit(2) }
const fx = rest.find((a) => a.startsWith('fixture='))?.slice(8) ?? 'late'
const tabs = rest.filter((a) => !a.includes('='))
const TABS = tabs.length ? tabs : ['Shop', 'Pokedex', 'Journey']
fs.mkdirSync(out, { recursive: true })

const child = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 250))
}
const browser = await chromium.launch()
try {
  for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' })
    await ctx.addInitScript(() => {
      const style = document.createElement('style')
      style.textContent = '*,*::before,*::after{content-visibility:visible!important}'
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    })
    const page = await ctx.newPage()
    await page.goto(`http://localhost:${PORT}/?fixture=${fx}&tour=0`)
    await page.waitForSelector('.navbar button')
    await page.waitForTimeout(700)
    for (const spec of TABS) {
      // "Shop:Marks" opens the Shop tab, then the sub-menu button whose text is Marks
      const [tab, sub] = spec.split(':')
      await page.click(`.navbar button[aria-label="${tab}"]`)
      await page.waitForTimeout(500)
      if (sub) { await page.locator('.pmenu-btn', { hasText: sub }).first().click(); await page.waitForTimeout(400) }
      // scroll through so lazy images load, then back to the top
      const h = await page.evaluate(() => document.documentElement.scrollHeight)
      for (let y = 0; y < h; y += 700) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(60) }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(300)
      const file = path.join(out, `${fx}-${spec.toLowerCase().replace(/[^a-z]+/g, '-')}-${label}.png`)
      await page.screenshot({ path: file, fullPage: true })
      console.log(file)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  child.kill()
}
