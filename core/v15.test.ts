// Rules version 15: the first weeks of play, read back (AUDIT-2026-10-27.md).
//   node --test core/v15.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { V15_START } from './rules.ts'
import { BOSS_MIN_PARTY, BOSS_PARTY, bossNeed } from './boss.ts'

const H = (id: string, tag: HabitFact['tag'], worth: number, frac: number, extra: Partial<HabitFact> = {}): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac, done: frac >= 1, ...extra })
const sleep = (): HabitFact => H('sleep-before-10', 'sleep', 100, 0.9, { measured: true, done: true })
const work = (): HabitFact => H('leetcode-coding', 'code', 100, 1)
/** `n` days counted from `from`: each is only the night's Sleep, or Sleep and one real pillar */
const days = (from: string, n: number, withWork: boolean): DayFacts[] =>
  Array.from({ length: n }, (_, i) => ({ day: addDays(from, i), habits: withWork ? [sleep(), work()] : [sleep()] }))
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })

test('from version 15 a night of Sleep alone makes no day with a pillar; with another pillar it counts as before', () => {
  const alone = fold(days(V15_START, 3, false))
  assert.ok(alone.days.every((d) => d.pillars === 0), 'Sleep alone: no pillar')
  assert.ok(alone.days.every((d) => d.xp > 0), 'the night still pays its XP')
  const both = fold(days(V15_START, 3, true))
  assert.ok(both.days.every((d) => d.pillars === 2), 'Sleep and code: two pillars')
})

test('before version 15 Sleep alone counted, exactly as it did', () => {
  const g = fold(days(addDays(V15_START, -4), 3, false))
  assert.ok(g.days.every((d) => d.pillars === 1))
})

test('Sleep alone for days on end lets the partner doze, which it did not before', () => {
  const g = fold(days(addDays(V15_START, -2), 6, false))
  assert.equal(g.days.find((d) => d.day === addDays(V15_START, -1))!.pillars, 1)
  assert.equal(g.days[g.days.length - 1].pillars, 0)
})

test('a boss needs a party of six before version 15 and three from it', () => {
  assert.equal(bossNeed(addDays(V15_START, -1)), BOSS_PARTY)
  assert.equal(bossNeed(V15_START), BOSS_MIN_PARTY)
})
