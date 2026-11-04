// Sprites are scaled by whole numbers only (src/lib/fit.ts).
//   node --test tools/fit.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { wholeScale } from '../src/lib/fit.ts'

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
