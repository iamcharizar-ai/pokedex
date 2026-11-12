// Rules version 18: the game follows Life OS (a kind of work with no habit on the list is shelved).
//   node --test core/v18.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFacts, addDays, type FactsInput, type HabitLite } from './facts.ts'
import { foldGame } from './fold.ts'
import { V18_START } from './rules.ts'
import { CARD_EVENT, bossOf, liveCard, type BossCard } from './boss.ts'
import { planCard } from '../src/lib/boss.ts'

const FOREVER = [{ from: '1970-01-01', to: null }]
const habit = (id: string, tier = 'pillar', spans: HabitLite['spans'] = FOREVER): HabitLite => ({ id, tier, spans })
const LIBRARY = (guitar: HabitLite['spans'] | null): HabitLite[] => [
  habit('leetcode-coding'), habit('gym'), habit('arbor-morning'), habit('sleep-before-10'), habit('water', 'standard'),
  ...(guitar ? [habit('woodshed-guitar', 'pillar', guitar)] : []),
]
const KINDS = ['gym', 'arbor', 'shed', 'sleep', 'life'] as const
const SHARES = [0.3, 0.25, 0.2, 0.15, 0.1]
const card = (week: string, o: Partial<BossCard> = {}): BossCard => ({
  week, species: 'dratini', form: 'dragonite', rarity: 'R', mega: false, level: 30,
  tasks: KINDS.map((kind, i) => ({ kind, template: 't', target: 1, share: SHARES[i], text: kind })), ...o,
})
const WEEK = V18_START
const input = (habits: HabitLite[], today: string, c: BossCard | null = card(WEEK), o: Partial<FactsInput> = {}): FactsInput => ({
  habits, ticks: {}, today,
  boss: { cards: c ? { [c.week]: c } : {}, days: { [WEEK]: [0.5, 0.4, 0.3, 0.2, 0.1] } },
  ...o,
})
const kinds = (f: ReturnType<typeof buildFacts>, day: string): string[] | undefined => f.find((x) => x.day === day)?.boss?.card.tasks.map((t) => t.kind)

import { setV22Start } from './rules.ts'
setV22Start('2099-01-01') // this file tests the rules before version 22: keep them in force on every date (the oracle, core/oracle.test.ts, ties version 22 to them)

test('V18 starts on a Monday, so a boss week never begins before it', () => {
  assert.equal(new Date(V18_START + 'T12:00:00').getDay(), 1)
})

test('liveCard drops the tasks of a shelved kind, scales the rest back to a whole boss and cuts the progress to match', () => {
  const live = liveCard(card(WEEK), [0.5, 0.4, 0.3, 0.2, 0.1], new Set(['fitness', 'arbor', 'sleep']))
  assert.deepEqual(live.card.tasks.map((t) => t.kind), ['gym', 'arbor', 'sleep', 'life'])
  assert.deepEqual(live.p, [0.5, 0.4, 0.2, 0.1])
  assert.ok(Math.abs(live.card.tasks.reduce((n, t) => n + t.share, 0) - 1) < 1e-9)
  // each keeps its place relative to the others: 0.3 : 0.25 of 0.8
  assert.ok(Math.abs(live.card.tasks[0].share - 0.375) < 1e-9)
})

test('liveCard cuts nothing when every kind is live, or when the list is not known', () => {
  const c = card(WEEK), p = [0.1, 0.2, 0.3, 0.4, 0.5]
  assert.equal(liveCard(c, p, new Set(['fitness', 'arbor', 'guitar', 'sleep'])).card, c)
  assert.equal(liveCard(c, p, null).card, c)
  // the Life task is never cut, even if no habit is tagged routine
  assert.ok(liveCard(c, p, new Set(['fitness'])).card.tasks.some((t) => t.kind === 'life'))
})

test('with the Woodshed habit archived the boss card has no Woodshed task, for the whole week', () => {
  const archived = LIBRARY([{ from: '1970-01-01', to: WEEK }])
  const f = buildFacts(input(archived, addDays(WEEK, 2)))
  assert.deepEqual(kinds(f, addDays(WEEK, 2)), ['gym', 'arbor', 'sleep', 'life'])
  assert.deepEqual(kinds(f, WEEK), ['gym', 'arbor', 'sleep', 'life'])
  const today = f.find((x) => x.day === addDays(WEEK, 2))!
  assert.equal(today.boss!.p.length, 4)
  assert.ok(Math.abs(today.boss!.card.tasks.reduce((n, t) => n + t.share, 0) - 1) < 1e-9)
})

test('with the Woodshed habit on the list the card is whole', () => {
  const f = buildFacts(input(LIBRARY(FOREVER), addDays(WEEK, 2)))
  assert.deepEqual(kinds(f, addDays(WEEK, 2)), ['gym', 'arbor', 'shed', 'sleep', 'life'])
})

test('shelving it in mid-week takes the task off the whole week, so the boss does not heal on work already done', () => {
  const f = buildFacts(input(LIBRARY([{ from: '1970-01-01', to: addDays(WEEK, 2) }]), addDays(WEEK, 3)))
  for (const d of [WEEK, addDays(WEEK, 1), addDays(WEEK, 3)]) assert.deepEqual(kinds(f, d), ['gym', 'arbor', 'sleep', 'life'], d)
  const g = foldGame(f)
  assert.ok(g.boss)
  assert.equal(g.boss.tasks.length, 4)
})

test('a week that closed keeps the card it was judged on, whatever the list says later', () => {
  // the week is over (today is the next Wednesday) and the habit came back: its last day, Sunday, had no Woodshed, so the card stays without it
  const habits = LIBRARY([{ from: '1970-01-01', to: WEEK }, { from: addDays(WEEK, 8), to: null }])
  const f = buildFacts(input(habits, addDays(WEEK, 9)))
  assert.deepEqual(kinds(f, addDays(WEEK, 6)), ['gym', 'arbor', 'sleep', 'life'])
})

test('days and weeks before version 18 are untouched, and so is a list that is not known yet', () => {
  const before = addDays(WEEK, -7)
  const old = buildFacts({ ...input(LIBRARY(null), addDays(before, 2), card(before)), boss: { cards: { [before]: card(before) }, days: {} } })
  assert.deepEqual(kinds(old, addDays(before, 2)), ['gym', 'arbor', 'shed', 'sleep', 'life'])
  assert.equal(old.find((x) => x.day === addDays(before, 2))!.live, undefined)
  const unknown = buildFacts(input([], addDays(WEEK, 2)))
  assert.deepEqual(kinds(unknown, addDays(WEEK, 2)), ['gym', 'arbor', 'shed', 'sleep', 'life'])
  assert.deepEqual(foldGame(unknown).shelved, [])
})

test('the game lists what is shelved from the last day, and a kind comes back with its habit', () => {
  const off = foldGame(buildFacts(input(LIBRARY([{ from: '1970-01-01', to: WEEK }]), addDays(WEEK, 2))))
  assert.deepEqual(off.shelved, ['guitar'])
  const on = foldGame(buildFacts(input(LIBRARY(FOREVER), addDays(WEEK, 2))))
  assert.deepEqual(on.shelved, [])
  // the same list, any later: the last day decides, so putting it back brings it back
  const back = foldGame(buildFacts(input(LIBRARY([{ from: '1970-01-01', to: WEEK }, { from: addDays(WEEK, 2), to: null }]), addDays(WEEK, 2))))
  assert.deepEqual(back.shelved, [])
})

test('Sleep is not shelved while the band reads it, even with the hand habit gone, nor on a morning its reading has not come', () => {
  const noHabit = LIBRARY(FOREVER).filter((h) => h.id !== 'sleep-before-10')
  const band = { [addDays(WEEK, -1)]: { sleepScore: 82 } }
  assert.ok(!foldGame(buildFacts(input(noHabit, addDays(WEEK, 2), card(WEEK), { body: band }))).shelved.includes('sleep'))
  assert.ok(!foldGame(buildFacts(input(LIBRARY(FOREVER), addDays(WEEK, 2), card(WEEK), { body: band }))).shelved.includes('sleep'), 'band in use, this morning unread')
  // no band and no habit: sleep is really off the list
  assert.ok(foldGame(buildFacts(input(noHabit, addDays(WEEK, 2)))).shelved.includes('sleep'))
})

test('a habit given another domain in Life OS stands for that domain', () => {
  const lib = LIBRARY(null)
  lib.push({ ...habit('scales', 'core'), domain: 'guitar' })
  assert.deepEqual(foldGame(buildFacts(input(lib, addDays(WEEK, 2)))).shelved, [])
})

// ── the card's revision ─────────────────────────────────────────────────────
const cardEv = (at: string, c: BossCard) => ({ type: CARD_EVENT, day: c.week, at, payload: { card: JSON.stringify(c) } })

test('the first card of a week stands, unless a newer planner drew one', () => {
  const a = card(WEEK, { species: 'dratini' }), b = card(WEEK, { species: 'larvitar' }), c = card(WEEK, { species: 'bagon', rev: 2 })
  assert.equal(bossOf([cardEv('1', a), cardEv('2', b)]).cards[WEEK].species, 'dratini')
  assert.equal(bossOf([cardEv('1', a), cardEv('2', c)]).cards[WEEK].species, 'bagon', 'a higher revision replaces it')
  assert.equal(bossOf([cardEv('1', c), cardEv('2', a)]).cards[WEEK].species, 'bagon', 'and an older one never replaces it')
  assert.equal(bossOf([cardEv('1', c), cardEv('2', card(WEEK, { species: 'beldum', rev: 2 }))]).cards[WEEK].species, 'bagon', 'the first of a revision stands')
})

// ── the planner ─────────────────────────────────────────────────────────────
const day = (d: string, ids: string[]) => ({ day: d, habits: ids.map((id) => ({ id, tag: 'routine' as const, worth: 3, pillar: false, frac: 1, done: true })) })
const planFor = (habits: HabitLite[], o: Partial<FactsInput> = {}, prior: BossCard[] = []) => {
  const today = addDays(WEEK, 1)
  const inp: FactsInput = {
    habits, ticks: {}, today,
    boss: { cards: Object.fromEntries(prior.map((c) => [c.week, c])), days: {} },
    arbor: { plans: {}, practice: { [addDays(WEEK, -2)]: { 'l-sit': { done: true, at: '' }, 'crow-pose': { done: true, at: '' } } } },
    shed: { plans: {}, logs: { 'alt-picking-1': { [addDays(WEEK, -2)]: { done: true, at: '', feel: 2 } } } },
    ...o,
  }
  const game = foldGame([day(addDays(WEEK, -1), ['water'])])
  return planCard(WEEK, today, game, inp, [], prior.length, true)
}

test('the boss is not the one of the last weeks, even with one region open and a single rare line', () => {
  const prior = [card(addDays(WEEK, -7), { species: 'dratini' })]
  for (let i = 0; i < 1; i++) {
    const c = planFor(LIBRARY(FOREVER), {}, prior)
    assert.ok(c)
    assert.notEqual(c.species, 'dratini')
    assert.equal(c.rev, 2)
  }
})

test('a new card has no Woodshed task while the habit is shelved, and its shares still make a whole boss', () => {
  const off = planFor(LIBRARY([{ from: '1970-01-01', to: WEEK }]))
  assert.ok(off)
  assert.ok(!off.tasks.some((t) => t.kind === 'shed'))
  assert.ok(Math.abs(off.tasks.reduce((n, t) => n + t.share, 0) - 1) < 0.003)
  const on = planFor(LIBRARY(FOREVER))
  assert.ok(on?.tasks.some((t) => t.kind === 'shed'))
  assert.ok(Math.abs(on!.tasks.reduce((n, t) => n + t.share, 0) - 1) < 0.003)
})

test('a week redrawn by the new planner never gets the boss the old planner drew for it', () => {
  const old = card(WEEK, { species: 'dratini' })
  for (const prior of [[old], [card(addDays(WEEK, -7), { species: 'dratini' }), old]]) {
    const c = planFor(LIBRARY(FOREVER), {}, prior)
    assert.ok(c)
    assert.notEqual(c.species, 'dratini')
  }
})
