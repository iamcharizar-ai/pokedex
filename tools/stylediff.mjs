// Every element's computed style, compared between two builds across ~100 app states (each tab and sub-menu under
// each fixture, the main sheets, the news window, the tour, the kit page). Screenshots only see the top of a tab;
// this sees everything a CSS change could reach. Used to prove the phase 9 layer move (styles/index.css).
//
//   npx vite build --outDir dist-a      (before the change, e.g. on a stash)
//   npx vite build --outDir dist-b      (after)
//   node tools/stylediff.mjs            prints each state's differences; delete dist-a and dist-b after
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
const root = process.argv[2] ?? path.resolve(import.meta.dirname, '..')
const require = createRequire(path.join(root, 'package.json'))
const { chromium } = require('playwright')

const PROPS = ['display', 'position', 'width', 'height', 'margin-top', 'margin-left', 'padding-top', 'padding-left', 'color', 'background-color', 'background-image', 'border-top-width', 'border-top-color', 'border-left-width', 'border-left-color', 'border-top-left-radius', 'font-family', 'font-size', 'font-weight', 'line-height', 'opacity', 'filter', 'box-shadow', 'transform', 'gap', 'grid-template-columns', 'text-transform', 'letter-spacing', 'visibility', 'z-index', 'top', 'left', 'flex-direction', 'justify-content', 'align-items', 'text-align', 'overflow-x', 'min-height', 'max-width', '-webkit-text-stroke-width']

async function serve(dir, port) {
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(port), '--strictPort', '--outDir', dir], { cwd: root, stdio: 'ignore' })
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) return child } catch {} await new Promise((r) => setTimeout(r, 250)) }
  throw new Error('no server ' + dir)
}

// each state: [name, url query, steps (clicks by selector, or text)]
const STATES = []
for (const fx of ['empty', 'week', 'late', 'boss']) {
  for (const tab of ['Today', 'Party', 'Shop', 'Pokedex', 'Journey']) STATES.push([`${fx}/${tab}`, `fixture=${fx}&tour=0`, [`nav:${tab}`]])
  STATES.push([`${fx}/Party:Box`, `fixture=${fx}&tour=0`, ['nav:Party', 'pm:Box']])
  STATES.push([`${fx}/Party:Lab`, `fixture=${fx}&tour=0`, ['nav:Party', 'pm:Lab']])
  STATES.push([`${fx}/Party:Items`, `fixture=${fx}&tour=0`, ['nav:Party', 'pm:Items']])
  STATES.push([`${fx}/Party:Forge`, `fixture=${fx}&tour=0`, ['nav:Party', 'pm:Forge']])
  STATES.push([`${fx}/Shop:Gems`, `fixture=${fx}&tour=0`, ['nav:Shop', 'pm:Gems']])
  STATES.push([`${fx}/Shop:Marks`, `fixture=${fx}&tour=0`, ['nav:Shop', 'pm:Marks']])
  STATES.push([`${fx}/Journey:Goals`, `fixture=${fx}&tour=0`, ['nav:Journey', 'pm:Goals']])
  STATES.push([`${fx}/Journey:History`, `fixture=${fx}&tour=0`, ['nav:Journey', 'pm:History']])
  STATES.push([`${fx}/Party card sheet`, `fixture=${fx}&tour=0`, ['nav:Party', 'click:.pl .mc']])
  STATES.push([`${fx}/Bag item sheet`, `fixture=${fx}&tour=0`, ['nav:Party', 'pm:Items', 'click:.inv-slot:not(.blank)']])
  STATES.push([`${fx}/Shop ware sheet`, `fixture=${fx}&tour=0`, ['nav:Shop', 'click:.wcard']])
  STATES.push([`${fx}/Dex entry`, `fixture=${fx}&tour=0`, ['nav:Pokedex', 'click:.dexcard']])
  STATES.push([`${fx}/Help`, `fixture=${fx}&tour=0`, ['click:.topbar button[aria-label*="elp"], .topbar .k-help, button[aria-label="How it works"]']])
  STATES.push([`${fx}/Collect`, `fixture=${fx}&tour=0`, ['click:.tb-collect']])
}
STATES.push(['late/news', 'fixture=late&tour=0&news', []])
STATES.push(['week/tour', 'fixture=week&tour=1', []])
STATES.push(['empty/tour', 'fixture=empty&tour=1', []])
STATES.push(['kit', 'kit', []])

async function grab(page, port, [, q, steps]) {
  await page.goto(`http://localhost:${port}/?${q}`)
  await page.waitForTimeout(900)
  for (const s of steps) {
    try {
      if (s.startsWith('nav:')) await page.click(`.navbar button[aria-label="${s.slice(4)}"]`, { timeout: 3000 })
      else if (s.startsWith('pm:')) await page.locator('.pmenu-btn', { hasText: s.slice(3) }).first().click({ timeout: 3000 })
      else if (s.startsWith('click:')) await page.locator(s.slice(6)).first().click({ timeout: 3000 })
    } catch { return null }
    await page.waitForTimeout(450)
  }
  return page.evaluate((PROPS) => {
    const out = {}
    const pathOf = (e) => { const p = []; while (e && e !== document.body) { const i = e.parentElement ? [...e.parentElement.children].indexOf(e) : 0; p.unshift(`${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}:${i}`); e = e.parentElement } return p.join('>') }
    for (const e of document.body.querySelectorAll('*')) {
      if (e.closest('svg') && e.tagName !== 'svg') continue
      const s = getComputedStyle(e)
      const pick = {}
      for (const p of PROPS) pick[p] = s.getPropertyValue(p)
      for (const pe of ['::before', '::after']) { const ps = getComputedStyle(e, pe); if (ps.content && ps.content !== 'none' && ps.content !== 'normal') for (const p of ['background-color', 'background-image', 'width', 'height', 'color', 'content', 'opacity', 'transform', 'display']) pick[pe + p] = ps.getPropertyValue(p) }
      out[pathOf(e)] = pick
    }
    return out
  }, PROPS)
}

const a = await serve('dist-a', 5301), b = await serve('dist-b', 5302)
const browser = await chromium.launch()
let total = 0
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await ctx.addInitScript(() => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)) })
  const pa = await ctx.newPage(), pb = await ctx.newPage()
  for (const st of STATES) {
    const [A, B] = [await grab(pa, 5301, st), await grab(pb, 5302, st)]
    if (!A || !B) { console.log(`skip ${st[0]} (a step failed: ${!A ? 'a' : ''}${!B ? 'b' : ''})`); continue }
    const diffs = []
    for (const k of Object.keys(A)) {
      if (!B[k]) continue
      for (const p of Object.keys(A[k])) if (A[k][p] !== B[k][p]) diffs.push(`${k.split('>').slice(-2).join('>')}  ${p}: ${A[k][p]}  →  ${B[k][p]}`)
    }
    const uniq = [...new Set(diffs)]
    total += uniq.length
    console.log(`${st[0]}: ${uniq.length} differences${uniq.length ? '\n   ' + uniq.slice(0, 25).join('\n   ') : ''}`)
  }
} finally { await browser.close(); a.kill(); b.kill() }
console.log('TOTAL', total)
