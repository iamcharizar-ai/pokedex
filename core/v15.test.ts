// Rules version 15: the first weeks of play, read back (AUDIT-2026-10-27.md).
//   node --test core/v15.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { CLAIM_AUTO, MILESTONE_EVERY, V15_START } from './rules.ts'
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

// ── level milestones ──
const full = (from: string, n: number): DayFacts[] =>
  Array.from({ length: n }, (_, i) => ({ day: addDays(from, i), habits: [work(), H('gym', 'fitness', 100, 1), H('woodshed-guitar', 'guitar', 100, 1), H('arbor-morning', 'arbor', 100, 1)] }))
/** the first day count at which a milestone is waiting in Collect, and the game then */
function firstMilestone(from: string) {
  for (let n = 1; n <= 60; n++) {
    const facts = full(from, n)
    const g = foldGame(facts)
    const h = g.held.find((x) => x.key.startsWith('level:'))
    if (h) return { facts, g, h }
  }
  return null
}
const withUse = (facts: DayFacts[], u: { what: string; item?: string; to?: string }): DayFacts[] =>
  facts.map((f, k) => (k === facts.length - 1 ? { ...f, uses: [...(f.uses ?? []), { day: f.day, item: u.item ?? '', uid: '', what: u.what, ...(u.to ? { to: u.to } : {}) }] } : f))

test('from version 15 every fifth level of the partner waits in Collect as a choice of two', () => {
  const m = firstMilestone(V15_START)
  assert.ok(m, 'a milestone within sixty full days')
  assert.equal(m!.h.choice?.length, 2)
  assert.notDeepEqual(m!.h.choice![0], m!.h.choice![1])
  assert.equal(Number(m!.h.key.split(':')[2]) % MILESTONE_EVERY, 0)
})

test('claiming a milestone with the second option pays the second, and only it', () => {
  const m = firstMilestone(V15_START)!
  const [a, b] = m.h.choice!
  const g = foldGame(withUse(m.facts, { what: 'claim', to: m.h.key, item: '1' }))
  assert.ok(!g.held.some((x) => x.key === m.h.key), 'collected')
  assert.equal(g.wallet.coins - m.g.wallet.coins, b.coins)
  assert.equal(g.wallet.gems - m.g.wallet.gems, b.gems)
  for (const [id, n] of b.items) assert.equal((g.inv[id] ?? 0) - (m.g.inv[id] ?? 0), n)
  for (const [id] of a.items) if (!b.items.some(([x]) => x === id)) assert.equal(g.inv[id] ?? 0, m.g.inv[id] ?? 0)
})

test('a milestone left alone pays its first option by itself after CLAIM_AUTO days', () => {
  const m = firstMilestone(V15_START)!
  const later = foldGame(full(V15_START, m.facts.length + CLAIM_AUTO))
  assert.ok(!later.held.some((x) => x.key === m.h.key))
  const [a] = m.h.choice!
  for (const [id, n] of a.items) assert.ok((later.inv[id] ?? 0) >= n)
})

test('before version 15 a level reached is no milestone', () => {
  const g = foldGame(full(addDays(V15_START, -40), 39))
  assert.ok(!g.held.some((x) => x.key.startsWith('level:')))
})
