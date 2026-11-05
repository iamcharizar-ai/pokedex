// Rules version 19: kinds of egg, a Trail Egg found by walking, and steps with no cut at so many a day.
//   node --test core/v19.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { EGG_IDS, EGG_KINDS, DOMAIN_V19, eggNeed, lureTypes, offerFor, workEgg } from './economy.ts'
import { EGG_STEPS, TRAIL_EGG_STEPS, V19_START } from './rules.ts'
import { SPECIES } from './species.ts'
import { setV21Start } from './rules.ts'
setV21Start('2099-01-01') // this file tests the rules before version 21: keep them in force on every date

const H = (id: string, tag: HabitFact['tag'], worth: number): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac: 1, done: true })
const START = '2026-10-03'
/** a full day (every pillar done, so gems, marks and coins come in), with the band's step count when there was one */
const day = (i: number, steps?: number): DayFacts => ({
  day: addDays(START, i),
  habits: [H('leetcode-coding', 'code', 100), H('gym', 'fitness', 100), H('woodshed-guitar', 'guitar', 100), H('arbor-morning', 'arbor', 30), H('sleep-before-10', 'sleep', 30), ...Array.from({ length: 10 }, (_, k) => H(`chore-${k}`, 'routine', 1))],
  ...(steps === undefined ? {} : { body: { steps } }),
})
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })
const I0 = Math.round((Date.parse(V19_START) - Date.parse(START)) / 86400000) // the index of V19_START's day
const BUY = I0 + 3 // a day well after it, when the gems and marks are in
type Use = { what: string; item: string; to?: string }
const withUses = (facts: DayFacts[], i: number, ...uses: Use[]) => facts.map((f, k) => (k === i ? { ...f, uses: uses.map((u) => ({ day: f.day, uid: '', ...u })) } : f))
/** full days, the given step readings from day `from` on (undefined: no reading), and the uses on day `at` */
const game = (from: number, readings: (number | undefined)[], at: number, ...uses: Use[]) => {
  const facts = Array.from({ length: Math.max(from + readings.length, I0 + 10) }, (_, i) => day(i, i >= from ? readings[i - from] : undefined))
  return fold(withUses(facts, at, ...uses))
}
const rareEgg: Use = { what: 'buy', item: 'rare-egg', to: 'rare' }

test('V19 starts on the day it was written, and every egg has a kind with a size', () => {
  assert.equal(V19_START, '2026-11-04')
  assert.deepEqual(EGG_IDS, ['rare-egg', 'trail-egg', ...['code', 'fitness', 'guitar', 'arbor', 'sleep'].map((t) => `egg-${t}`)])
  for (const id of EGG_IDS) assert.ok(EGG_KINDS[id].steps > 0)
})

test('an egg put in after V19 counts every step, with no cut at a goal a day', () => {
  const g = game(BUY + 1, [25000], BUY, rareEgg)
  assert.deepEqual([g.egg?.kind, g.egg?.have, g.egg?.need], ['rare-egg', 25000, 60000], 'one day of 25,000 counts as 25,000')
  const done = game(BUY + 1, [25000, 40000], BUY, rareEgg)
  assert.equal(done.egg, null, '65,000 steps in two days hatch a 60,000 egg')
  const h = done.moments.find((m) => m.kind === 'hatch')!
  assert.ok(h.kind === 'hatch' && h.day === addDays(START, BUY + 2) && h.egg === 'rare-egg')
  assert.equal(SPECIES[done.queue.find((m) => m.uid === h.uid)!.form].r, 'R')
})

test('the day an egg is put in counts nothing, whatever the band read that day', () => {
  const g = game(BUY, [90000, 1000], BUY, rareEgg)
  assert.equal(g.egg?.have, 1000)
})

test('an egg put in before V19 keeps its old size; the days after it count in full', () => {
  assert.equal(eggNeed('rare-egg', addDays(V19_START, -1), false), EGG_STEPS)
  assert.equal(eggNeed('rare-egg', addDays(V19_START, -1), true), 40000)
  assert.equal(eggNeed('rare-egg', V19_START, false), 60000)
  assert.equal(eggNeed('rare-egg', V19_START, true), 48000)
  assert.equal(eggNeed('trail-egg', V19_START, false), 30000)
  assert.equal(eggNeed(workEgg('code'), V19_START, false), 40000)
  // set on 1 Nov (V19 is 4 Nov): 2 and 3 Nov are cut at a goal (10,000 each), 4 Nov is not (12,000), and it is still the old size
  const mid = game(I0 - 3, [12000, 12000, 12000, 12000], I0 - 3, rareEgg)
  assert.deepEqual([mid.egg?.need, mid.egg?.have], [EGG_STEPS, 10000 + 10000 + 12000])
})

test('walking finds a Trail Egg for every TRAIL_EGG_STEPS steps, counted from V19, all of them', () => {
  const none = game(I0 - 2, [300000, 300000], I0 + 5)
  assert.equal(none.trail.walked, 0)
  assert.equal(none.trail.found, 0, 'steps before version 19 find nothing')
  const g = game(I0, [60000, 50000], I0 + 5)
  assert.deepEqual([g.trail.walked, g.trail.found, g.trail.every], [110000, 1, TRAIL_EGG_STEPS])
  assert.equal(g.egg?.kind, 'trail-egg', 'a lone egg goes into the Nursery at once')
  const three = game(I0, [110000, 110000, 110000], I0 + 5)
  assert.equal(three.trail.found, 3)
})

test('a Trail Egg hatches an uncommon Pokemon that starts with ten hearts', () => {
  const g = game(I0, [120000, 31000], I0 + 5)
  // found on the first reading and put in that day (which counts nothing); 31,000 the next day is more than the 30,000 it needs
  const h = g.moments.find((m) => m.kind === 'hatch')!
  assert.ok(h.kind === 'hatch' && h.egg === 'trail-egg')
  const mon = g.queue.find((m) => m.uid === h.uid)!
  assert.equal(SPECIES[mon.form].r, 'U')
  assert.equal(mon.fed, EGG_KINDS['trail-egg'].hearts)
})

test('with two kinds waiting nothing goes in until one is chosen, and the choice counts from the next day', () => {
  const codeEgg: Use = { what: 'buy', item: workEgg('code'), to: 'code' }
  const both = game(BUY + 1, [20000, 20000], BUY, rareEgg, codeEgg)
  assert.equal(both.egg, null, 'two kinds waiting: no egg is put in by itself')
  assert.deepEqual([both.inv['rare-egg'], both.inv[workEgg('code')]], [1, 1])
  const facts = Array.from({ length: BUY + 6 }, (_, i) => day(i, i > BUY ? 8000 : undefined))
  const buys = withUses(facts, BUY, rareEgg, codeEgg)
  const chosen = fold(withUses(buys, BUY + 1, { what: 'warm', item: workEgg('code') }))
  assert.deepEqual([chosen.egg?.kind, chosen.inv[workEgg('code')] ?? 0, chosen.inv['rare-egg']], [workEgg('code'), 0, 1], 'the other egg waits in the Bag')
  assert.equal(chosen.egg?.have, 8000 * 4, 'put in on the day after buying: that day counts nothing, the four after it count 8,000 each')
  // choosing again with an egg already warming does nothing
  const again = fold(withUses(buys, BUY + 2, { what: 'warm', item: workEgg('code') }, { what: 'warm', item: 'rare-egg' }))
  assert.equal(again.egg?.kind, workEgg('code'))
  assert.equal(again.inv['rare-egg'], 1)
})

test("a work egg hatches an uncommon or rare Pokemon of that work's types", () => {
  const g = game(BUY + 1, [41000], BUY, { what: 'buy', item: workEgg('code'), to: 'code' })
  const h = g.moments.find((m) => m.kind === 'hatch')!
  assert.ok(h.kind === 'hatch' && h.egg === workEgg('code'))
  const mon = g.queue.find((m) => m.uid === h.uid)!
  const t = SPECIES[mon.form]
  assert.ok(lureTypes('code').includes(t.t) || (t.t2 !== undefined && lureTypes('code').includes(t.t2)), `${mon.form} is ${t.t}`)
  assert.ok(['U', 'R'].includes(t.r ?? 'C'))
})

test("each kind of work sells its own egg for marks, from V19 on", () => {
  for (const t of ['code', 'fitness', 'guitar', 'arbor', 'sleep'] as const) {
    assert.equal(offerFor(t, workEgg(t), addDays(V19_START, -1), 0), null, `${t}: not before V19`)
    assert.equal(offerFor(t, workEgg(t), V19_START, 0)?.offer.marks, DOMAIN_V19[t][0].marks)
  }
})

test('days before V19 fold exactly as they did: no Trail Egg, no walked steps', () => {
  const g = fold(Array.from({ length: I0 }, (_, i) => day(i, 20000)))
  assert.deepEqual([g.trail.walked, g.trail.found, g.egg], [0, 0, null])
})
