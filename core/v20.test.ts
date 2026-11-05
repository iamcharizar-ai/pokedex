// Rules version 20: a Pokemon put on the Professor's desk studies the day it is put there, and the fold says whether the day studies.
//   node --test core/v20.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { V20_START } from './rules.ts'

const H = (id: string, tag: HabitFact['tag'], worth: number, done = true): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac: done ? 1 : 0, done })
const START = '2026-10-20'
/** every habit done: a perfect day, which catches the wild Pokemon on the spot, so the Box fills a Pokemon a day */
const full = (i: number): DayFacts => ({
  day: addDays(START, i),
  habits: [H('leetcode-coding', 'code', 100), H('gym', 'fitness', 100), H('arbor-morning', 'arbor', 100), H('sleep-before-10', 'sleep', 100), ...Array.from({ length: 5 }, (_, k) => H(`chore-${k}`, 'routine', 1))],
})
const at = (day: string): number => Math.round((Date.parse(day) - Date.parse(START)) / 86400000)
const DAYS = at(V20_START) + 6
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })
type Use = { what: string; to: string }
const withUses = (facts: DayFacts[], uses: Record<number, Use[]>) =>
  facts.map((f, i) => (uses[i] ? { ...f, uses: uses[i].map((u) => ({ day: f.day, item: '', uid: '', ...u })) } : f))

/** Perfect days throughout; the team is left empty early on, so every Pokemon caught is free for the desk (the Professor takes the strongest three). */
const EMPTY_TEAM = 3
const base = Array.from({ length: DAYS }, (_, i) => full(i))
const free: Record<number, Use[]> = { [EMPTY_TEAM]: [{ what: 'team', to: '-,-,-,-,-' }] }

/** The research a day adds, with and without a desk of one (the weakest) set on that day. */
function onTheDay(i: number) {
  const before = fold(withUses(base.slice(0, i), free))
  const weakest = [...before.queue].sort((a, b) => a.xp - b.xp)[0].uid
  const kept = fold(withUses(base.slice(0, i + 1), free)).research
  const moved = fold(withUses(base.slice(0, i + 1), { ...free, [i]: [{ what: 'study', to: weakest }] })).research
  return { kept, moved, desk: before.research.desk.length }
}

test('V20 starts on the day it ships', () => {
  assert.equal(V20_START, '2026-11-05')
})

test('before V20 a desk set today counts from the next day, exactly as it always folded', () => {
  const { kept, moved, desk } = onTheDay(at(V20_START) - 1)
  assert.equal(desk, 3, 'the Professor had a full desk')
  assert.equal(moved.today, kept.today, 'the new desk is not read on the day it was set')
  assert.equal(moved.desk.length, 1, 'but it is the desk from then on')
})

test('from V20 a desk set today studies today', () => {
  const { kept, moved } = onTheDay(at(V20_START) + 1)
  assert.equal(kept.desk.length, 3)
  assert.equal(moved.desk.length, 1)
  assert.ok(moved.today < kept.today, `one on the desk studies less than three, today (${moved.today} vs ${kept.today})`)
  assert.equal(moved.today, moved.perDay, "today's study is the desk as it stands now")
})

test('the fold says whether the day studies, and why not', () => {
  const day = (i: number, done: string[]): DayFacts => ({ ...full(i), habits: full(i).habits.map((h) => (done.includes(h.tag) ? h : { ...h, frac: 0, done: false })) })
  const last = (f: DayFacts) => fold([...base.slice(0, DAYS - 1), f]).research
  assert.equal(last(full(DAYS - 1)).counts, 'pillar')
  assert.equal(last(day(DAYS - 1, ['sleep', 'routine'])).counts, 'sleep', 'Sleep alone is not a day of work')
  assert.equal(last(day(DAYS - 1, ['sleep', 'routine'])).today, 0)
  assert.equal(last(day(DAYS - 1, ['routine'])).counts, 'none')
  assert.equal(last(day(DAYS - 1, ['code'])).counts, 'pillar')
})
