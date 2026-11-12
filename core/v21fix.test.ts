// Version 21.1: the fixes of 10 Nov 2026 (AUDIT-2026-11-10.md). These days are dated from V21_FIX.
//   node --test core/v21fix.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact, type ItemUse } from './facts.ts'
import { canCandy, foldGame } from './fold.ts'
import { MOMENTUM_WINDOW_STEPS, V21_FIX, levelOf, momentumWindow, setV21Fix } from './rules.ts'

const START = V21_FIX
const H = (id: string, tag: HabitFact['tag'], worth: number, done: boolean, extra: Partial<HabitFact> = {}): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac: done ? 1 : 0, done, ...extra })
/** a day of the list: which effortful pillars were done, the night's score, how many of 8 chores, and what was done by hand */
const day = (i: number, did: { code?: boolean; gym?: boolean; arbor?: boolean }, score = 85, chores = 8, uses: Omit<ItemUse, 'day'>[] = []): DayFacts => ({
  day: addDays(START, i),
  habits: [
    H('sleep-before-10', 'sleep', 100, score >= 80, { frac: score / 100, measured: true }),
    H('leetcode-coding', 'code', 100, Boolean(did.code)), H('gym', 'fitness', 100, Boolean(did.gym)), H('arbor-morning', 'arbor', 100, Boolean(did.arbor)),
    ...Array.from({ length: 8 }, (_, k) => H(`chore-${k}`, 'routine', 1, k < chores)),
  ],
  body: { sleepScore: score, steps: 5000 },
  marks: { workouts: did.gym ? 1 : 0, records: 0, clean: 0, owned: 0, gear: [] },
  live: ['sleep', 'code', 'fitness', 'arbor', 'routine'],
  uses: uses.map((u) => ({ ...u, day: addDays(START, i) })),
})
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })
const all = { code: true, gym: true, arbor: true }
const buyCandy = { what: 'buy', item: 'rare-candy', to: 'rare', uid: '' }

import { setV22Start } from './rules.ts'
setV22Start('2099-01-01') // this file tests the rules before version 22: keep them in force on every date (the oracle, core/oracle.test.ts, ties version 22 to them)

test('momentum is the seven days again: a good night and one pillar is a day that counts, a good night alone is not, and six of seven is the top', () => {
  const counts = (i: number) => day(i, { code: true }, 85, 4) // one effortful pillar and a night of 85
  const night = (i: number) => day(i, {}, 85, 4) // a night of 85 and nothing else
  const at = (days: DayFacts[]) => fold(days).momentum
  assert.deepEqual(at([counts(0)]).steps, MOMENTUM_WINDOW_STEPS)
  // the multiplier looks back over the seven days before today
  assert.equal(at([counts(0), counts(1), counts(2), night(3)]).mult, momentumWindow(3))
  assert.equal(at([counts(0), counts(1), counts(2), counts(3), counts(4), night(5)]).mult, 1.35)
  assert.equal(at([counts(0), counts(1), counts(2), counts(3), counts(4), counts(5), night(6)]).mult, 1.5)
  // one rest day in the seven does not cost the top step
  assert.equal(at([counts(0), counts(1), counts(2), night(3), counts(4), counts(5), counts(6), night(7)]).mult, 1.5)
  // nights alone never count: Sleep is a pillar only beside another
  const nights = at([night(0), night(1), night(2), night(3), night(4), night(5), night(6), night(7)])
  assert.equal(nights.days, 0)
  assert.equal(nights.mult, 1)
})

test('a Rare Candy is for anyone with a level to gain, the partner too, and the screens are asked the same rule', () => {
  // three Max days earn the gems; the candy is bought and given on the fourth
  const base = [day(0, all), day(1, all), day(2, all)]
  const plain = fold([...base, day(3, {})])
  const me = plain.partner.uid
  assert.ok(canCandy(plain, me, addDays(START, 3)))
  const fed = fold([...base, day(3, {}, 85, 8, [buyCandy, { what: 'candy', item: 'rare-candy', uid: me }])])
  const had = plain.inv['rare-candy'] ?? 0 // whatever the days themselves handed over
  assert.equal(levelOf(fed.partner.xp), levelOf(plain.partner.xp) + 1)
  assert.equal(fed.inv['rare-candy'] ?? 0, had) // one bought, one used
  // someone in My Pokemon (the first day was perfect, so the wild one was caught on the spot)
  const boxed = plain.queue[0]
  assert.ok(boxed && canCandy(plain, boxed.uid, addDays(START, 3)))
  const fedBox = fold([...base, day(3, {}, 85, 8, [buyCandy, { what: 'candy', item: 'rare-candy', uid: boxed.uid }])])
  assert.equal(levelOf(fedBox.queue.find((m) => m.uid === boxed.uid)!.xp), levelOf(boxed.xp) + 1)
  assert.equal(fedBox.inv['rare-candy'] ?? 0, had)
})

test('before the fix a candy was for the fully trained only, and canCandy says so: no button for anyone else', () => {
  setV21Fix('2099-01-01')
  try {
    const base = [day(0, all), day(1, all), day(2, all)]
    const plain = fold([...base, day(3, {})])
    assert.equal(canCandy(plain, plain.partner.uid, addDays(START, 3)), false)
    assert.equal(canCandy(plain, plain.queue[0].uid, addDays(START, 3)), false)
    const fed = fold([...base, day(3, {}, 85, 8, [buyCandy, { what: 'candy', item: 'rare-candy', uid: plain.queue[0].uid }])])
    assert.equal(fed.inv['rare-candy'], (plain.inv['rare-candy'] ?? 0) + 1) // bought, and still there
  } finally { setV21Fix(START) }
})

test('a candied Pokemon that takes the lead evolves the same day, not the next', () => {
  // a long run of Max days takes the partner near its first evolution; then it steps back, takes candies in the Box, and leads again
  const days: DayFacts[] = []
  for (let i = 0; i < 40; i++) {
    days.push(day(i, all))
    if (levelOf(fold(days).partner.xp) >= 14) break
  }
  const g = fold(days)
  assert.equal(g.partner.form, 'charmander')
  const me = g.partner.uid, other = g.queue[0].uid, n = days.length
  const need = 16 - levelOf(g.partner.xp)
  const uses = [
    ...Array.from({ length: need }, () => buyCandy),
    { what: 'lead', item: '', uid: other },
    ...Array.from({ length: need }, () => ({ what: 'candy', item: 'rare-candy', uid: me })),
    { what: 'lead', item: '', uid: me },
  ]
  const after = fold([...days, day(n, {}, 85, 0, uses)])
  assert.equal(after.partner.uid, me)
  assert.equal(after.partner.form, 'charmeleon')
})
