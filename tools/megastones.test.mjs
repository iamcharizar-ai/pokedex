// Mega Stone pictures: every one is the wiki's 24px art blown up pixel for pixel (never smoothed), and the Megas without one are known.
//   node --test tools/megastones.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import { SPECIES } from '../core/species.ts'
import { MEGASTONE_ART } from '../src/lib/megastone-art.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'sprites/megastones')
const SRC = path.join(ROOT, 'tools/megastones-src')
const SCALE = 8
const everyMega = Object.values(SPECIES).flatMap((s) => s.m ?? [])
/** Megas with no stone picture: they keep the drawn orb. Add a name here only while one is missing. */
const NO_PICTURE = []

test('every Mega has a stone picture, except the ones known not to', () => {
  assert.deepEqual(everyMega.filter((f) => !MEGASTONE_ART.has(f)).sort(), [...NO_PICTURE].sort())
  for (const f of MEGASTONE_ART) assert.ok(fs.existsSync(path.join(OUT, `${f}.png`)), `${f}.png exists`)
  assert.equal(fs.readdirSync(OUT).length, MEGASTONE_ART.size, 'no stray file in sprites/megastones')
})

test('each picture is 8 times a 24px source, with every output pixel a copy of one source pixel (no smoothing, no new colours)', () => {
  const sources = fs.readdirSync(SRC)
  assert.equal(sources.length, MEGASTONE_ART.size, 'one source per picture')
  for (const form of MEGASTONE_ART) {
    const out = PNG.sync.read(fs.readFileSync(path.join(OUT, `${form}.png`)))
    assert.equal(out.width, 24 * SCALE); assert.equal(out.height, 24 * SCALE)
    // find its source by comparing the top-left of each: the one whose blown-up copy is identical
    const match = sources.find((f) => {
      const src = PNG.sync.read(fs.readFileSync(path.join(SRC, f)))
      if (src.width !== 24 || src.height !== 24) return false
      for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
        const s = ((Math.floor(y / SCALE)) * 24 + Math.floor(x / SCALE)) * 4, o = (y * out.width + x) * 4
        if (src.data.readUInt32BE(s) !== out.data.readUInt32BE(o)) return false
      }
      return true
    })
    assert.ok(match, `${form} is an exact blow-up of one of the wiki sources`)
  }
})

test('the sources are clean pixel art: each pixel fully opaque or fully clear', () => {
  for (const f of fs.readdirSync(SRC)) {
    const p = PNG.sync.read(fs.readFileSync(path.join(SRC, f)))
    for (let i = 3; i < p.data.length; i += 4) assert.ok(p.data[i] === 0 || p.data[i] === 255, `${f} has a half-clear pixel`)
  }
})
