// What is new in the Bag (src/lib/newitems.ts): more of a thing than was last looked at; looking clears it; a thing used up is new again when found again.
//   node --test tools/newitems.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { newIds, trimmed } from '../src/lib/newitems.ts'

test('a thing is new when there is more of it than was looked at: a first one, or one more', () => {
  assert.deepEqual(newIds({ a: 1, b: 2, c: 1 }, { a: 1, b: 1 }), ['b', 'c'])
  assert.deepEqual(newIds({ a: 1, b: 2 }, { a: 1, b: 2 }), [], 'all looked at')
  assert.deepEqual(newIds({}, { a: 3 }), [], 'nothing held, nothing new')
})

test('using some leaves the rest looked at; using it all and finding it again is new again', () => {
  const seen = { berry: 3, ball: 1 }
  assert.deepEqual(trimmed(seen, { berry: 1, ball: 1 }), { berry: 1, ball: 1 }, 'two used: the one left is still looked at')
  assert.deepEqual(newIds({ berry: 2, ball: 1 }, trimmed(seen, { berry: 1, ball: 1 })), ['berry'], 'one more found after: new')
  assert.deepEqual(trimmed(seen, { ball: 1 }), { berry: 0, ball: 1 }, 'all used: nothing left to have looked at')
  assert.deepEqual(newIds({ berry: 1, ball: 1 }, trimmed(seen, { ball: 1 })), ['berry'])
})
