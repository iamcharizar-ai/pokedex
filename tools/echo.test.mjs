// An event written here comes back from the ledger reshaped by Postgres, and must still be taken once.
//   node --test tools/echo.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { keyOf } from '../src/lib/eventkey.ts'

// a throw as this device made it (lib/store.ts useItem), and the same row as the ledger sent it back on 5 Nov 2026
const made = { id: '1b2c', device: 'pokedex-iqgvibry', at: '2026-11-05T20:56:06.000Z', day: '2026-11-05', type: 'item_use', payload: { item: 'luxury-ball', uid: '', what: 'throw', n: 'c3j6rwu8' } }
const echo = { id: '1b2c', device: 'pokedex-iqgvibry', at: '2026-11-05T20:56:06+00:00', day: '2026-11-05', type: 'item_use', payload: { n: 'c3j6rwu8', uid: '', item: 'luxury-ball', what: 'throw' }, inserted_at: '2026-11-05T20:56:06.154747+00:00' }

test('the echo of a throw is the same event: the time as "+00:00" and the payload keys reordered do not matter', () => {
  assert.equal(keyOf(echo), keyOf(made))
  // the id is not needed: an event queued before ids existed still matches its echo
  const { id: _a, ...bare } = made, { id: _b, ...bareEcho } = echo
  assert.equal(keyOf(bareEcho), keyOf(made))
  assert.equal(keyOf(bare), keyOf(echo))
})

test('two real taps of the same ball stay two events', () => {
  const again = { ...made, at: '2026-11-05T20:56:06.000Z', payload: { ...made.payload, n: 'zz000000' } }
  assert.notEqual(keyOf(again), keyOf(made))
  assert.notEqual(keyOf({ ...made, at: '2026-11-05T20:56:07.000Z' }), keyOf(made))
})

test('nested payload values are compared with their keys sorted too', () => {
  assert.equal(keyOf({ ...made, payload: { a: { y: 1, x: 2 } } }), keyOf({ ...made, payload: { a: { x: 2, y: 1 } } }))
})
