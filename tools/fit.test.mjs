// Sprites are scaled by whole numbers only (src/lib/fit.ts).
//   node --test tools/fit.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { fullFit, wholeScale } from '../src/lib/fit.ts'

test('the scale is always a whole number of at least 1', () => {
  for (let w = 1; w <= 300; w += 7) for (const box of [40, 80, 96, 136, 184, 260]) {
    const k = wholeScale(w, w, box)
    assert.ok(Number.isInteger(k) && k >= 1, `${w} in ${box} gave ${k}`)
  }
})

test('it fills the box as nearly as a whole number can, without overflowing it by much', () => {
  assert.equal(wholeScale(69, 56, 136), 2) // Charmeleon's animation: 138, not 136 stretched by 1.97
  assert.equal(wholeScale(97, 67, 136), 1) // Tangrowth's: 97, not 136 stretched by 1.4
  assert.equal(wholeScale(97, 67, 184), 2)
  assert.equal(wholeScale(96, 96, 80), 1) // a still in a smaller box is drawn at its size, never shrunk
  assert.equal(wholeScale(40, 40, 184), 5) // 200: 4.6 rounds up, and 200 is within the 30% slack
  assert.equal(wholeScale(60, 60, 184), 3) // 180
  assert.equal(wholeScale(80, 80, 136), 2) // 160: round(1.7) is 2, and 160 is within the slack
})

test('nothing is ever drawn smaller than it is', () => {
  assert.equal(wholeScale(300, 300, 96), 1)
  assert.equal(wholeScale(0, 0, 96), 1)
})

test('a card enlarges a sprite by a whole number, or marks it to be drawn from the hard-edged copy', () => {
  for (const box of [[30, 40, 66, 90], [10, 5, 86, 92], [40, 60, 56, 80], [0, 0, 96, 96]]) {
    const f = fullFit(box, 100, 170)
    assert.ok(f.smooth || Number.isInteger(f.k), `${box}: k ${f.k} is a fraction but not marked smooth`)
    assert.ok(f.k >= 1 && f.k <= 3.6)
  }
})

test('the numbers the cards were drawn with before the move are the same after it', () => {
  // MonCard's own formula before it moved here (W is 100 on a phone, 132 wider; H is 170)
  const before = (box, narrow) => {
    const W = narrow ? 100 : 132, H = 170
    const [l, t, r, b] = box
    let k = Math.max(1, Math.min(3.6, Math.min((W * 0.82) / Math.max(1, r - l), (H * 0.64) / Math.max(1, b - t))))
    const whole = Math.abs(k - Math.round(k)) < 0.1
    if (whole) k = Math.round(k)
    return { x: Math.round(-((l + r) / 2 - 48) * k), y: Math.round(H * 0.8 - (H / 2 + (b - 48) * k)), k, smooth: !whole }
  }
  for (let i = 0; i < 400; i++) {
    const l = (i * 7) % 40, t = (i * 11) % 50, r = l + 8 + ((i * 13) % (88 - l)), b = t + 8 + ((i * 17) % (88 - t))
    for (const narrow of [true, false]) assert.deepEqual(fullFit([l, t, r, b], narrow ? 100 : 132, 170), before([l, t, r, b], narrow))
  }
})
