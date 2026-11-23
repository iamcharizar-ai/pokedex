// News told once, in whichever app told it first (core/events.ts): the key, what has been told, and what is left to write.
//   node --test tools/told.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { TOLD, newsKey, toldOf, toldPayload } from '../core/events.ts'

const hatch = { kind: 'hatch', day: '2026-11-23', uid: 'rhyhorn.2026-11-23', form: 'rhyhorn', egg: 'trail-egg' }

test('a piece of news has one key, and two of one kind are told apart', () => {
  assert.equal(newsKey(hatch), newsKey({ ...hatch }))
  assert.notEqual(newsKey(hatch), newsKey({ ...hatch, uid: 'onix.2026-11-23', form: 'onix' }))
  const boss = { kind: 'boss', day: '2026-11-23', week: '2026-11-23', form: 'gengar', level: 20, what: 'appear' }
  assert.notEqual(newsKey(boss), newsKey({ ...boss, what: 'left' }), 'a boss that came is not a boss that left')
  assert.notEqual(newsKey({ kind: 'level', day: 'd', uid: 'u', form: 'f', level: 5 }), newsKey({ kind: 'level', day: 'd', uid: 'u', form: 'f', level: 6 }))
})

test('what was told is read back from the ledger rows of either app', () => {
  const uses = [
    { day: '2026-11-23', item: '', uid: '', what: TOLD, to: `${newsKey(hatch)},a|b` },
    { day: '2026-11-23', item: '', uid: '', what: 'feed', to: 'ignored' },
    { day: '2026-11-23', item: '', uid: '', what: TOLD },
  ]
  const told = toldOf(uses)
  assert.deepEqual([...told].sort(), ['a|b', newsKey(hatch)].sort())
})

test('only what is not told yet is written, once, and nothing when nothing is left', () => {
  const told = new Set([newsKey(hatch)])
  const p = toldPayload([newsKey(hatch), 'x', 'x', 'y'], told)
  assert.equal(p.what, TOLD)
  assert.equal(p.uid, '')
  assert.deepEqual(p.to.split(','), ['x', 'y'])
  assert.equal(toldPayload([newsKey(hatch)], told), null)
  assert.equal(toldPayload([], told), null)
})
