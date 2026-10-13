// An accessibility and weight audit of every tab under every fixture.
//
//   npm run build && node tools/a11y.mjs            report
//   node tools/a11y.mjs --strict                    exit 1 if anything is found (for a check)
//
// It opens each tab in a phone-sized browser and reports:
//   small   things you tap that are smaller than 44 x 44 CSS pixels (a thumb needs that)
//   unnamed buttons, links, fields and pictures a screen reader would announce as nothing
//   weight  how many files each tab asks for, and how many bytes
// It does not judge colour contrast or reading order: those want eyes.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = 5194
const TABS = ['Today', 'Party', 'Shop', 'Pokedex', 'Journey']
const FIXTURES = ['empty', 'week', 'late', 'boss']
const MIN = 44
const strict = process.argv.includes('--strict')

const server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 250)) }
const browser = await chromium.launch()
const small = new Map(), unnamed = new Map()
const weight = []
try {
  for (const fx of FIXTURES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    const page = await ctx.newPage()
    let files = 0, bytes = 0
    page.on('response', async (r) => { files++; try { bytes += (await r.body()).length } catch { /* redirects have none */ } })
    await page.goto(`http://localhost:${PORT}/?fixture=${fx}&tour=0`)
    await page.waitForSelector('.navbar button')
    await page.waitForTimeout(700)
    weight.push([`${fx} first load (Today)`, files, bytes])
    for (const tab of TABS) {
      const f0 = files, b0 = bytes
      await page.click(`.navbar button[aria-label="${tab}"]`)
      await page.waitForTimeout(600)
      if (tab !== 'Today') weight.push([`${fx} then ${tab}`, files - f0, bytes - b0])
      const found = await page.evaluate((MIN) => {
        const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
        const desc = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
        const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || e.innerText || e.textContent || '').trim() || (e.querySelector('img[alt]:not([alt=""])') ? 'img' : '')
        const small = [], unnamed = []
        for (const e of document.querySelectorAll('button, a[href], [role=button], summary, input:not([type=hidden]), select, textarea')) {
          if (!visible(e) || e.closest('[aria-hidden=true]') || e.matches('.fixturetag') || (e.tagName === 'A' && e.closest('p, li, small'))) continue // the fixture tag is for testing; a link inside a sentence is exempt, as in WCAG
          const r = e.getBoundingClientRect()
          if (r.width < MIN - 0.5 || r.height < MIN - 0.5) small.push(`${desc(e)} ${Math.round(r.width)}x${Math.round(r.height)} "${name(e).slice(0, 24)}"`)
          if (!name(e)) unnamed.push(desc(e))
        }
        for (const i of document.querySelectorAll('img')) if (visible(i) && !i.hasAttribute('alt')) unnamed.push('img (no alt) ' + (i.getAttribute('src') || '').slice(-30))
        return { small, unnamed }
      }, MIN)
      for (const s of found.small) small.set(s, (small.get(s) ?? 0) + 1)
      for (const s of found.unnamed) unnamed.set(s, (unnamed.get(s) ?? 0) + 1)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  server.kill()
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`
console.log('WEIGHT (files, bytes)')
for (const [k, f, b] of weight) console.log(`  ${k.padEnd(28)} ${String(f).padStart(4)} files  ${kb(b).padStart(8)}`)
console.log(`\nSMALL TARGETS under ${MIN}px: ${small.size} kinds`)
for (const [k, n] of [...small.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}x  ${k}`)
console.log(`\nUNNAMED: ${unnamed.size} kinds`)
for (const [k, n] of [...unnamed.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}x  ${k}`)
process.exit(strict && (small.size || unnamed.size) ? 1 : 0)
