// The Bag's slots: where things lie, and how a move changes it (src/lib/baglayout.ts).
//   node --test tools/bag.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { MIN_SLOTS, moveTo, reconcile, slotCount, tidy } from '../src/lib/baglayout.ts'

test('a new Bag lays things down in order; later finds take the first empty slot', () => {
  assert.deepEqual(reconcile([], ['a', 'b', 'c']), ['a', 'b', 'c'])
  assert.deepEqual(reconcile(['a', null, 'c'], ['a', 'c', 'd']), ['a', 'd', 'c'])
})

test('things used up leave their slot empty; the others stay where they were left', () => {
  assert.deepEqual(reconcile(['a', 'b', 'c'], ['a', 'c']), ['a', null, 'c'])
  assert.deepEqual(reconcile(['a', 'b', 'c', null, null], ['a', 'b', 'c']), ['a', 'b', 'c'], 'empty slots at the end are dropped')
  assert.deepEqual(reconcile(['a', 'a', 'b'], ['a', 'b']), ['a', null, 'b'], 'a thing cannot lie in two slots')
})

test('moving to an empty slot moves it; onto another thing swaps the two', () => {
  assert.deepEqual(moveTo(['a', 'b', 'c'], 'a', 5), [null, 'b', 'c', null, null, 'a'])
  assert.deepEqual(moveTo(['a', 'b', 'c'], 'a', 2), ['c', 'b', 'a'])
  assert.deepEqual(moveTo(['a', 'b'], 'a', 0), ['a', 'b'], 'to where it is: nothing changes')
  assert.deepEqual(moveTo(['a', 'b'], 'x', 1), ['a', 'b'], 'something that is not in the Bag')
})

test('there are three rows at least, and always an empty slot to drop into', () => {
  assert.equal(slotCount([]), MIN_SLOTS)
  assert.equal(slotCount(['a', 'b']), MIN_SLOTS)
  const full = Array.from({ length: MIN_SLOTS }, (_, i) => `i${i}`)
  assert.equal(slotCount(full), MIN_SLOTS + 9)
  assert.equal(slotCount([...full, 'x']), MIN_SLOTS + 9)
})

test('tidy lays everything down again with no gaps', () => {
  assert.deepEqual(tidy(['a', 'b', 'c']), ['a', 'b', 'c'])
})
