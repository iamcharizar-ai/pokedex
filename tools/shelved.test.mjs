// A kind of work shelved in Life OS hides its unfinished feats on every list, and brings them back when the habit returns.
//   node --test tools/shelved.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { FEATS, featDomain } from '../core/economy.ts'
import { featShown } from '../src/lib/shelved.ts'

const guitar = FEATS.find((f) => f.id === 'run30-guitar')
const code = FEATS.find((f) => f.id === 'run30-code')

test('an unfinished feat of a shelved kind of work is hidden; others and earned ones stay', () => {
  assert.equal(featDomain(guitar), 'guitar')
  const off = { feats: [], shelved: ['guitar'] }
  assert.equal(featShown(off, guitar), false)
  assert.equal(featShown(off, code), true)
  assert.equal(featShown({ feats: [{ id: guitar.id }], shelved: ['guitar'] }, guitar), true, 'an earned one stays')
  assert.equal(featShown({ feats: [], shelved: [] }, guitar), true, 'back on the list: shown again')
})
