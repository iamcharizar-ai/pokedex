// Which CSS rules style a class no code uses any more?
//
//   node tools/css-unused.mjs          list them
//   node tools/css-unused.mjs --fix    remove them (then run the screenshots: they must not change)
//
// A rule is unused when every selector in it names a class that appears nowhere
// in src/ (as a word, or as the start of a built name like `tile-${x}`). Classes
// that end in a number (`st1`, `b2`) are kept: they are usually built at run time.
// This is how the dead rules of the map, the farm and the old trainer screens
// were found; run it after deleting a screen.
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(import.meta.dirname, '..', 'src')
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
const files = walk(SRC)
const code = [...files.filter((f) => /\.(tsx?|jsx?)$/.test(f)), path.resolve(SRC, '..', 'index.html')].map((f) => fs.readFileSync(f, 'utf8')).join('\n')
// the core can name a class too (a moment's kind becomes `k-${kind}`)
const core = fs.readdirSync(path.resolve(SRC, '..', 'core')).filter((f) => f.endsWith('.ts') && !f.includes('test')).map((f) => fs.readFileSync(path.resolve(SRC, '..', 'core', f), 'utf8')).join('\n')
const haystack = code + '\n' + core
const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const cache = new Map()
const used = (c) => {
  if (cache.has(c)) return cache.get(c)
  let ok = new RegExp(`(?<![\\w-])${esc(c)}(?![\\w-])`).test(haystack) || /\d$/.test(c)
  if (!ok) {
    const parts = c.split('-')
    for (let i = 1; i < parts.length && !ok; i++) {
      const pre = parts.slice(0, i).join('-') + '-'
      ok = new RegExp(`${esc(pre)}\\$\\{`).test(haystack) || new RegExp(`['"\`]${esc(pre)}['"\`]\\s*\\+`).test(haystack)
    }
  }
  cache.set(c, ok)
  return ok
}

const fix = process.argv.includes('--fix')
let total = 0
for (const file of files.filter((f) => f.endsWith('.css') && !f.endsWith('tokens.css') && !f.endsWith('styles/index.css'))) {
  let text = fs.readFileSync(file, 'utf8')
  const crlf = text.includes('\r\n')
  text = text.replace(/\r\n/g, '\n')
  const scrub = text.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
  const stack = []
  const rules = []
  let from = 0
  for (let i = 0; i < scrub.length; i++) {
    const ch = scrub[i]
    if (ch === '{') { stack.push({ sel: scrub.slice(from, i).trim(), start: from }); from = i + 1 }
    else if (ch === '}') { const r = stack.pop(); if (r && !r.sel.startsWith('@')) rules.push({ ...r, end: i + 1 }); from = i + 1 }
    else if (ch === ';' && !stack.length) from = i + 1
  }
  const dead = rules.filter((r) => {
    if (!r.sel) return false
    const parts = r.sel.split(',').map((p) => p.trim())
    return parts.every((p) => {
      const cs = [...p.replace(/\[[^\]]*\]/g, '').matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c))
      return cs.some((c) => !used(c))
    })
  })
  // nested inside another dead rule: the outer one covers it
  const top = dead.filter((r) => !dead.some((o) => o !== r && o.start <= r.start && o.end >= r.end))
  if (top.length) console.log(`${path.relative(SRC, file)}: ${top.length} unused`)
  for (const r of top) console.log('   ' + r.sel.replace(/\s+/g, ' ').slice(0, 100))
  total += top.length
  if (fix && top.length) {
    for (const r of [...top].sort((a, b) => b.start - a.start)) {
      let s = r.start
      while (s < r.end && /\s/.test(scrub[s])) s++
      let e = r.end
      while (e < text.length && (text[e] === ' ' || text[e] === '\t')) e++
      if (text[e] === '\n') e++
      text = text.slice(0, s) + text.slice(e)
    }
    fs.writeFileSync(file, crlf ? text.replace(/\n/g, '\r\n') : text)
  }
}
console.log(`${total} unused rule${total === 1 ? '' : 's'}${fix ? ' removed' : ''}`)
