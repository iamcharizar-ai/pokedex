// Rules version 17: the day's list is the live list.
//   node --test core/v17.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays } from './facts.ts'
import { listAdds, listsOf } from './events.ts'
import { V17_START } from './rules.ts'

const list = (day: string, at: string, ids: string[]) => ({ type: 'day_list', day, at, payload: { habits: JSON.stringify(ids.map((id) => ({ id, tier: 'standard', tag: 'routine' }))) } })

test('from version 17 the latest list written for a day stands, so a habit taken off is off the day', () => {
  const lists = listsOf([list(V17_START, '1', ['a', 'b', 'c']), list(V17_START, '2', ['a', 'c'])])
  assert.deepEqual(lists[V17_START].map((h) => h.id), ['a', 'c'])
})

test('before version 17 the first list stands and a later one can only add', () => {
  const day = addDays(V17_START, -3)
  const lists = listsOf([list(day, '1', ['a', 'b']), list(day, '2', ['a'])])
  assert.deepEqual(lists[day].map((h) => h.id), ['a', 'b'])
})

test('a list is written again from version 17 when it differs in any way, and not when it only reorders', () => {
  const stands = listsOf([list(V17_START, '1', ['a', 'b'])])[V17_START]
  assert.equal(listAdds(stands, [{ id: 'a', tier: 'standard', tag: 'routine' }], V17_START), true, 'a habit taken off')
  assert.equal(listAdds(stands, [{ id: 'b', tier: 'standard', tag: 'routine' }, { id: 'a', tier: 'standard', tag: 'routine' }], V17_START), false, 'the same habits in another order')
  assert.equal(listAdds(stands, [{ id: 'a', tier: 'pillar', tag: 'routine' }, { id: 'b', tier: 'standard', tag: 'routine' }], V17_START), true, 'a tier changed')
  // an earlier day keeps the old question: only an added habit counts
  assert.equal(listAdds(stands, [{ id: 'a', tier: 'standard', tag: 'routine' }], addDays(V17_START, -2)), false)
})
