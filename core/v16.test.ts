// Rules version 16: bonds that travel (RULES-V16.md).
//   node --test core/v16.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { HEART_LEVELS, V16_START, bondLevel } from './rules.ts'
import { SIG_CAP, SIG_PARTY, TRAINER_LEVELS, didWork, signatureOf, trainerLevel } from './bond.ts'
import { BATTLE_SHELF_V16, PRICED_BY_HEARTS, battleShelf, martDeals, offerFor } from './economy.ts'

const H = (id: string, tag: HabitFact['tag'], worth: number, frac: number, extra: Partial<HabitFact> = {}): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac, done: frac >= 1, ...extra })
type Kinds = Partial<Record<'code' | 'gym' | 'guitar' | 'arbor' | 'sleep' | 'routine', boolean>>
const ALL: Kinds = { code: true, gym: true, guitar: true, arbor: true, sleep: true, routine: true }
/** one day: the pillars asked for, and two routine habits */
const dayOf = (day: string, k: Kinds = ALL): DayFacts => ({
  day,
  habits: [
    H('leetcode-coding', 'code', 100, k.code ? 1 : 0), H('gym', 'fitness', 100, k.gym ? 1 : 0), H('woodshed-guitar', 'guitar', 100, k.guitar ? 1 : 0),
    H('arbor-morning', 'arbor', 100, k.arbor ? 1 : 0), H('sleep-before-10', 'sleep', 100, k.sleep ? 0.9 : 0.5, { measured: true, done: Boolean(k.sleep) }),
    H('dishes', 'routine', 30, k.routine ? 1 : 0), H('laundry', 'routine', 30, k.routine ? 1 : 0),
  ],
})
const run = (from: string, n: number, k: Kinds = ALL) => Array.from({ length: n }, (_, i) => dayOf(addDays(from, i), k))
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })
const hearts = (m: { together?: number; fed?: number }) => (m.together ?? 0) + (m.fed ?? 0)
const withUses = (facts: DayFacts[], i: number, ...uses: { what: string; item?: string; uid?: string; to?: string }[]) =>
  facts.map((f, k) => (k === i ? { ...f, uses: [...(f.uses ?? []), ...uses.map((u) => ({ day: f.day, item: u.item ?? '', uid: u.uid ?? '', what: u.what, ...(u.to ? { to: u.to } : {}) }))] } : f))

test('the trainer bond is every heart across every Pokemon owned, and its level reads TRAINER_LEVELS', () => {
  const g = fold(run(V16_START, 30))
  const sum = [g.partner, ...g.queue, ...g.graduates].reduce((n, m) => n + hearts(m), 0)
  assert.equal(g.trainer.hearts, sum)
  assert.equal(g.trainer.level, trainerLevel(sum))
  assert.equal(g.trainer.next, TRAINER_LEVELS.find((n) => sum < n) ?? null)
})

test('a new partner keeps the trainer perks: leading another Pokemon does not lower the trainer level', () => {
  const days = run(V16_START, 30)
  const g = fold(days)
  assert.ok(g.queue.length > 0, 'something was caught to lead')
  const next = g.queue[0]
  const led = fold(withUses(days, days.length - 1, { what: 'lead', uid: next.uid }))
  assert.equal(led.partner.uid, next.uid)
  assert.ok(led.trainer.level >= g.trainer.level)
  assert.ok(led.trainer.level >= 1)
})

test('signature strength: the partner in full, the party at half, one kind of work at most SIG_CAP', () => {
  const g = fold(run(V16_START, 40))
  const want: Record<string, number> = {}
  const add = (form: string, s: number) => { const t = signatureOf(form).tag; want[t] = (want[t] ?? 0) + s }
  add(g.partner.form, bondLevel(hearts(g.partner)))
  for (const m of g.team) if (m.uid !== g.partner.uid) add(m.form, bondLevel(hearts(m)) * SIG_PARTY)
  for (const [t, s] of Object.entries(g.sigs)) assert.equal(s, Math.min(SIG_CAP, want[t] ?? 0), t)
})

test('a party member earns a heart on a day of its own kind of work, and not on a day without it', () => {
  const days = run(V16_START, 30)
  const g = fold(days)
  const m = g.team.find((x) => x.uid !== g.partner.uid && hearts(x) < HEART_LEVELS[HEART_LEVELS.length - 1])
  assert.ok(m, 'a party member to watch')
  const tag = signatureOf(m!.form).tag
  const kind: Kinds = { ...ALL, ...(tag === 'fitness' ? { gym: false } : tag === 'routine' ? { routine: false } : { [tag]: false }) }
  const on = fold([...days, dayOf(addDays(V16_START, 30))])
  const off = fold([...days, dayOf(addDays(V16_START, 30), kind)])
  const h = (x: typeof g) => hearts([...x.team].find((y) => y.uid === m!.uid)!)
  assert.equal(h(on) - hearts(m!), 1)
  assert.equal(h(off) - hearts(m!), 0)
})

test('a berry pays double on a day of its Pokemon\'s own kind of work', () => {
  // a day the Mart has Oran Berries on its deals, at least twelve days in (coins to buy one)
  let n = 12
  while (!martDeals(addDays(V16_START, n)).some((o) => o.item === 'oran-berry')) n++
  const days = run(V16_START, n)
  const g = fold(days)
  const tag = signatureOf(g.partner.form).tag
  const idle: Kinds = { ...ALL, ...(tag === 'fitness' ? { gym: false } : { [tag]: false }) }
  const last = addDays(V16_START, n)
  const base = (k: Kinds) => fold([...days, dayOf(last, k)])
  const fed = (k: Kinds) => fold(withUses([...days, dayOf(last, k)], n, { what: 'buy', item: 'oran-berry', to: 'mart' }, { what: 'feed', item: 'oran-berry', uid: g.partner.uid }))
  const gain = (k: Kinds) => hearts(fed(k).partner) - hearts(base(k).partner)
  assert.equal(gain(ALL), 2)
  assert.equal(gain(idle), 1)
})

test('before version 16 nothing changes: the perks are the partner\'s, a berry pays once, no signature works', () => {
  const g = fold(run(addDays(V16_START, -25), 24))
  assert.equal(g.v16, false)
  assert.deepEqual(g.sigToday, { insight: 0, charm: 0, forage: null, dream: 0 })
  assert.ok(Object.values(g.power.domain).every((d) => d.sig === 0))
})

test('the Mart keeps one battle item of each kind from version 16; earlier days keep the three strengths', () => {
  assert.ok(battleShelf(addDays(V16_START, -1)).some((o) => o.item === 'x-attack'))
  assert.ok(!battleShelf(V16_START).some((o) => o.item === 'x-attack' || o.item === 'x-attack-2'))
  assert.ok(BATTLE_SHELF_V16.some((o) => o.item === 'x-attack-3'))
  assert.ok(BATTLE_SHELF_V16.some((o) => o.item === 'guard-spec'))
})

test('kinds of work: a pillar done, a night of 80+, or half the routine', () => {
  const d = dayOf(V16_START, { code: true, sleep: true })
  assert.ok(didWork('code', d.habits))
  assert.ok(!didWork('fitness', d.habits))
  assert.ok(didWork('sleep', d.habits))
  assert.ok(!didWork('routine', d.habits))
  assert.ok(didWork('routine', dayOf(V16_START, { routine: true }).habits))
})

test('a purchase replays at the price it was made at: friendship berries before PRICED_BY_HEARTS cost 2 marks', () => {
  assert.equal(offerFor('fitness', 'kelpsy-berry', addDays(PRICED_BY_HEARTS, -1), 3)?.offer.marks, 2)
  assert.equal(offerFor('fitness', 'kelpsy-berry', PRICED_BY_HEARTS, 3)?.offer.marks, 5)
  // the same currency only: the Garden's Sitrus is marks, before and after
  assert.equal(offerFor('arbor', 'sitrus-berry', addDays(PRICED_BY_HEARTS, -1), 3)?.offer.coins, undefined)
})
