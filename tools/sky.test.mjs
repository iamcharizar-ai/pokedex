// The sky maths: continuous palette, the sun and moon on their arcs, the weather from sleep.
//   node --test tools/sky.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { THEME_CLOCK, bodyAt, darkAt, paletteAt, weatherOf } from '../src/screens/sky.ts'

const m = (h, min = 0) => h * 60 + min

test('the palette is the old one at the old times, and blends between them with no jump', () => {
  assert.equal(paletteAt(m(12)).sky1, '#7cc8ff')       // day
  assert.equal(paletteAt(m(0)).sky1, '#121a3d')        // night
  assert.equal(paletteAt(m(22)).sky2, '#2c3d7a')
  // a minute either side of any time is nearly the same colour: no hard step between morning and day
  const dist = (a, b) => [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0)
  for (let t = 0; t < 1440; t += 1) assert.ok(dist(paletteAt(t).sky1, paletteAt(t + 1).sky1) < 20, `a jump at minute ${t}`)
  // midnight wraps cleanly
  assert.equal(paletteAt(m(23, 59)).sky1, paletteAt(m(24)).sky1)
  assert.equal(paletteAt(m(-1)).sky1, paletteAt(m(23, 59)).sky1)
})

test('it is darkest at night, brightest by day, and in between at dawn and dusk', () => {
  assert.equal(darkAt(m(12)), 0)
  assert.equal(darkAt(m(0)), 1)
  assert.ok(darkAt(m(22)) === 1)
  assert.ok(darkAt(m(7)) > 0 && darkAt(m(7)) < 0.25)
  assert.ok(darkAt(m(19)) > 0.3 && darkAt(m(19)) < 1)
})

test('the sun crosses from six to half past six, the moon the rest, each on an arc', () => {
  assert.equal(bodyAt(m(12, 15)).kind, 'sun')
  assert.equal(bodyAt(m(23)).kind, 'moon')
  assert.equal(bodyAt(m(3)).kind, 'moon')
  const rise = bodyAt(m(6)), noon = bodyAt(m(12, 15)), set = bodyAt(m(18, 29))
  assert.ok(rise.x < noon.x && noon.x < set.x, 'it moves left to right')
  assert.ok(noon.y < rise.y && noon.y < set.y, 'it is highest in the middle')
  assert.ok(Math.abs(noon.x - 50) < 2)
  const midnightMoon = bodyAt(m(0, 0))
  assert.ok(midnightMoon.y < 40, 'the moon is high at about midnight')
  for (let t = 0; t < 1440; t += 7) { const b = bodyAt(t); assert.ok(b.x >= 8 && b.x <= 92 && b.y >= 16 && b.y <= 86, `off the sky at ${t}`) }
})

test('last night sets the weather, and a missing night is never a bad one', () => {
  assert.equal(weatherOf(95).clouds, 0)
  assert.equal(weatherOf(95).weather, 'clear')
  assert.equal(weatherOf(85).weather, 'fair')
  assert.equal(weatherOf(70).weather, 'cloudy')
  assert.equal(weatherOf(50).weather, 'overcast')
  assert.equal(weatherOf(20).weather, 'rain')
  assert.equal(weatherOf(20).rain, true)
  assert.equal(weatherOf(80).weather, 'fair', '80 fills the pillar, so it is fair')
  assert.equal(weatherOf(79).weather, 'cloudy')
  assert.equal(weatherOf(null).rain, false)
  assert.equal(weatherOf(null).gloom, 0)
  // worse sleep is never clearer
  let last = -1
  for (const s of [95, 85, 70, 50, 20]) { const g = weatherOf(s).gloom; assert.ok(g >= last); last = g }
})

test('a bought scene pins the sky', () => {
  assert.equal(THEME_CLOCK['theme-beach'], 720)
  assert.equal(THEME_CLOCK['theme-cave'], null)
  assert.equal(bodyAt(THEME_CLOCK['theme-night']).kind, 'moon')
})
