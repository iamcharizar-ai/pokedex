// The Today scene as a pixel diorama (src/screens/stage.ts).
//   node --test tools/stage.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILT, biomeOf, layoutFor, lightAt, litFilter, paintBack, paintFront, rng } from '../src/screens/stage.ts'

/** A canvas stand-in that keeps every rectangle drawn. */
function recorder() {
  const rects = []
  return { rects, fillStyle: '', globalAlpha: 1, fillRect(x, y, w, h) { rects.push([x, y, w, h, this.fillStyle, this.globalAlpha]) }, clearRect() {} }
}
const state = (o = {}) => ({ lay: layoutFor(179, 195), minutes: 720, score: 90, theme: '', biome: 'meadow', seed: 'porygon', partnerTc: '#ee8130', aura: null, t: 0, ...o })

test('the place follows the wild Pokemon\'s type; Normal gives way to a second type', () => {
  assert.equal(biomeOf('Grass'), 'meadow')
  assert.equal(biomeOf('Water', 'Poison'), 'shore')
  assert.equal(biomeOf('Normal', 'Flying'), 'cliff')
  assert.equal(biomeOf('Normal'), 'meadow')
  assert.equal(biomeOf('Steel', 'Flying'), 'steel')
  assert.equal(biomeOf('Nonsense'), 'meadow')
  assert.ok(BUILT.includes('meadow'))
})

test('the pads stand on the ground, the wild one farther and smaller, both inside the stage', () => {
  for (const [w, h] of [[179, 195], [198, 127], [240, 130], [160, 100]]) {
    const l = layoutFor(w, h)
    assert.ok(l.horizon > 0 && l.horizon < h)
    for (const sp of [l.foe, l.me]) { assert.ok(sp.y > l.horizon && sp.y + sp.ry + 3 <= h, `${w}x${h}: a pad falls off the stage`); assert.ok(sp.x - sp.rx >= 0 && sp.x + sp.rx <= w) }
    assert.ok(l.foe.y < l.me.y && l.foe.rx < l.me.rx)
  }
})

test('the light on the Pokemon is bounded, and changes by the minute with no jump', () => {
  let prev = lightAt(0)
  for (let m = 1; m < 1440; m++) {
    const l = lightAt(m)
    for (const k of ['b', 's', 'warm']) { assert.ok(l[k] >= 0 && l[k] <= 1, `${k} at ${m}`); assert.ok(Math.abs(l[k] - prev[k]) < 0.05, `${k} jumps at ${m}`) }
    prev = l
  }
  assert.ok(lightAt(720).b > lightAt(1380).b, 'noon is brighter than midnight')
  assert.ok(lightAt(1380, 0).b > lightAt(1380, 1).b, 'gloom dims')
  assert.match(litFilter(lightAt(720)), /^brightness\([\d.]+\) saturate\([\d.]+\) sepia\([\d.]+\)$/)
})

test('every pixel of the place is a whole pixel inside the stage, at every hour, in every weather and scene', () => {
  for (const minutes of [0, 300, 400, 510, 720, 1110, 1170, 1290, 1380]) for (const score of [null, 95, 82, 65, 45, 20]) for (const theme of ['', 'theme-beach', 'theme-cave', 'theme-night']) for (const aura of [null, 'gmax']) for (const t of [0, 37]) {
    const s = state({ minutes, score, theme, aura, t })
    for (const paint of [paintBack, paintFront]) {
      const g = recorder()
      paint(g, s)
      for (const [x, y, w, h] of g.rects) {
        assert.ok([x, y, w, h].every(Number.isInteger), `${paint.name} drew a fraction at ${minutes} (${x},${y},${w},${h})`)
        assert.ok(w > 0 && h > 0 && x < s.lay.w + 20 && y < s.lay.h && x + w > -40 && y + h > -2, `${paint.name} drew off the stage: ${x},${y},${w},${h}`)
      }
    }
  }
})

test('the same Pokemon gets the same place every time; another gets another', () => {
  const draw = (seed) => { const g = recorder(); paintBack(g, state({ seed })); return JSON.stringify(g.rects) }
  assert.equal(draw('porygon'), draw('porygon'))
  assert.notEqual(draw('porygon'), draw('skarmory'))
  const a = rng('x'), b = rng('x')
  for (let i = 0; i < 5; i++) assert.equal(a(), b())
})

test('the partner\'s type tints its own pad, not the wild one\'s', () => {
  const pads = (tc) => { const g = recorder(); paintBack(g, state({ partnerTc: tc })); return g.rects.map((r) => r[4]) }
  const fire = new Set(pads('#ee8130')), water = new Set(pads('#6390f0'))
  assert.notDeepEqual([...fire].sort(), [...water].sort())
})
