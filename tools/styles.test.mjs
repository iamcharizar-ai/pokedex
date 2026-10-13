// The stylesheet structure stays what UI-OVERHAUL.md says it is:
//   - every colour, face and size is defined once, in styles/tokens.css
//   - every stylesheet is reached through styles/index.css, which sets the layer order
//   node --test tools/styles.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(import.meta.dirname, '..', 'src')
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
const css = walk(SRC).filter((f) => f.endsWith('.css'))
const rel = (f) => path.relative(SRC, f).replaceAll('\\', '/')

test('only tokens.css defines root values', () => {
  for (const f of css.filter((f) => rel(f) !== 'styles/tokens.css')) {
    const s = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.ok(!/:root\s*\{/.test(s), `${rel(f)} defines :root values: put them in styles/tokens.css`)
  }
})

test('every stylesheet is imported once, by the entry, into a layer', () => {
  const entry = fs.readFileSync(path.join(SRC, 'styles', 'index.css'), 'utf8')
  assert.match(entry, /@layer\s+tokens\s*,\s*legacy\s*,\s*screens\s*,\s*motion\s*;/, 'the layer order is declared first')
  for (const f of css.filter((f) => rel(f) !== 'styles/index.css')) {
    const name = rel(f).replace(/^styles\//, './').replace(/^(?!\.)/, '../')
    const hits = entry.split('\n').filter((l) => l.includes(`'${name}'`) && /layer\(/.test(l))
    assert.equal(hits.length, 1, `${rel(f)} must be imported once into a layer in styles/index.css`)
  }
  // and nothing imports a stylesheet around the entry
  for (const f of walk(SRC).filter((f) => /\.(tsx?|jsx?)$/.test(f))) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/import\s+['"]([^'"]+\.css)['"]/g)) {
      if (m[1].startsWith('@fontsource')) continue
      assert.ok(/styles\/index\.css$/.test(m[1]), `${rel(f)} imports ${m[1]}: only styles/index.css is imported from code`)
    }
  }
})
