// node --test core/
import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, buildFacts, inTime, type DayFacts, type FactsInput, type HabitFact } from './facts.ts'
import { listAdds, listsOf } from './events.ts'
import { golden } from './golden.ts'
import { foldGame, isGym, leaderOf, statsOf } from './fold.ts'
import { LEAGUES, lineup } from './gyms.ts'
import { beats, weakDomains } from './types.ts'
import { CHEST, EGG_DAYS, GAME_START, GEMS, LEADER_HP, SEASON_STEP, SHOP, V3_START, V4_START, V5_START, WEAK_MULT, bondLevel, wildHit5, WILD_HP, ballFor, evolveAt, graduateAt, levelOf, momentumMult, regionsOpenV2, rulesOn, wildHit, xpForLevel } from './rules.ts'
import { SPECIES } from './species.ts'

const H = (id: string, tag: HabitFact['tag'], worth: number, frac: number): HabitFact =>
  ({ id, tag, worth, pillar: worth === 100, frac, done: frac >= 1 })

/** A day described by how much of each thing was done (0..1). */
function day(n: number, o: { code?: number; gym?: number; guitar?: number; arbor?: number; sleep?: number; chores?: number } = {}): DayFacts {
  return {
    day: addDays(GAME_START, n),
    habits: [
      H('leetcode-coding', 'code', 100, o.code ?? 0),
      H('gym', 'fitness', 100, o.gym ?? 0),
      H('woodshed-guitar', 'guitar', 100, o.guitar ?? 0),
      H('arbor-morning', 'arbor', 30, o.arbor ?? 0),
      H('sleep-before-10', 'sleep', 30, o.sleep ?? 0),
      ...Array.from({ length: 10 }, (_, i) => H(`chore-${i}`, 'routine', 1, o.chores ?? 0)),
    ],
  }
}
/** The original rules alone, and the new ones from the first day. */
const NEVER = '9999-01-01'
const fold1 = (f: DayFacts[]) => foldGame(f, { v3From: NEVER, v4From: NEVER, v5From: NEVER, v6From: NEVER })
const fold3 = (f: DayFacts[]) => foldGame(f, { v3From: GAME_START, v4From: NEVER, v5From: NEVER, v6From: NEVER })
const fold4 = (f: DayFacts[]) => foldGame(f, { v3From: GAME_START, v4From: GAME_START, v5From: NEVER, v6From: NEVER })
const fold5 = (f: DayFacts[]) => foldGame(f, { v3From: GAME_START, v4From: GAME_START, v5From: GAME_START, v6From: NEVER })
const fold6 = (f: DayFacts[]) => foldGame(f, { v3From: GAME_START, v4From: GAME_START, v5From: GAME_START, v6From: GAME_START })
const ALL = { code: 1, gym: 1, guitar: 1, arbor: 1, sleep: 1, chores: 1 }
const run = (n: number, o: Parameters<typeof day>[1]) => Array.from({ length: n }, (_, i) => day(i, o))

test('level curve', () => {
  assert.equal(xpForLevel(16), 1536)
  assert.equal(xpForLevel(50), 15000)
  assert.equal(levelOf(0), 1)
  assert.equal(levelOf(1535), 15)
  assert.equal(levelOf(1536), 16)
  assert.equal(evolveAt(3, 1), 16)
  assert.equal(evolveAt(3, 2), 36)
  assert.equal(evolveAt(2, 1), 25)
  assert.equal(evolveAt(1, 1), null)
  assert.equal(graduateAt(1), 30)
})

test('momentum steps', () => {
  assert.deepEqual([0, 2, 3, 4, 5, 6, 7].map(momentumMult), [1, 1, 1.2, 1.2, 1.35, 1.35, 1.5])
})

test('a pillar outweighs the whole routine', () => {
  const g = fold1([day(0, { code: 1 })])
  assert.equal(g.today.xp, 100)
  const r = fold1([day(0, { chores: 1 })])
  assert.equal(r.today.xp, 10)
  assert.equal(r.today.counts, false)
})

test('starter, first evolution, and the day it happens', () => {
  const g = fold1(run(8, { code: 1, gym: 1 })) // 200 a day, momentum kicks in from day 4
  assert.equal(g.partner.base, 'charmander')
  const evo = g.moments.find((m) => m.kind === 'evolve')
  assert.ok(evo && evo.kind === 'evolve')
  assert.equal(evo.form, 'charmeleon')
  // 200,200,200 then x1.2: 240,240 → 1080 … day index 7 crosses 1536
  const total = g.days.reduce((s, d) => s + d.xp, 0)
  assert.equal(total, g.partner.xp)
  assert.ok(g.level >= 16)
  assert.equal(g.next.level, 36)
})

test('momentum looks back, never resets to zero on one miss', () => {
  const facts = run(10, { code: 1, gym: 1 })
  facts[8] = day(8, {}) // a missed day
  const g = fold1(facts)
  assert.equal(g.days[7].mult, 1.5)
  assert.equal(g.days[8].mult, 1.5) // the miss itself still enjoys the run before it
  assert.equal(g.days[9].mult, 1.35) // 6 of the last 7
})

test('perfect day catches, and nothing else does', () => {
  const g = fold1([day(0, { ...ALL, chores: 0.5 }), day(1, ALL)])
  assert.equal(g.perfectDays, 1)
  assert.equal(g.queue.length, 1)
  assert.equal(g.queue[0].from, addDays(GAME_START, 1))
  assert.equal(SPECIES[g.queue[0].base].s, 1)
  assert.equal(SPECIES[g.queue[0].base].g, 1) // Kanto only at the start
  assert.notEqual(g.queue[0].base, 'charmander')
})

test('catches are the same on every device, shiny on the 10th, rare on the 5th', () => {
  const a = fold1(run(10, ALL))
  const b = fold1(run(10, ALL))
  assert.deepEqual(a.moments, b.moments)
  const catches = a.moments.filter((m) => m.kind === 'catch')
  assert.equal(catches.length, 10)
  assert.equal(catches[9].kind === 'catch' && catches[9].shiny, true)
  assert.equal(catches[4].kind === 'catch' && SPECIES[catches[4].form].r, 'R')
  assert.equal(catches[9].kind === 'catch' && SPECIES[catches[9].form].r, 'U') // Kanto has one rare line: no repeat, next rarity down
  assert.equal(new Set(catches.map((c) => c.kind === 'catch' && c.form)).size, 10) // no repeats while there are new lines
})

test('graduation hands over to the queue in order, or to an egg', () => {
  const none = fold1(run(80, { code: 1, gym: 1, guitar: 1 })) // never perfect → eggs
  assert.ok(none.graduates.length >= 1)
  assert.equal(none.graduates[0].form, 'charizard')
  assert.equal(none.graduates[0].xp, 15000)
  assert.equal(none.partner.origin, 'egg')
  const q = fold1(run(40, ALL))
  const first = q.moments.find((m) => m.kind === 'catch')
  const handover = q.moments.find((m) => m.kind === 'partner')
  assert.ok(first && handover && first.kind === 'catch' && handover.kind === 'partner')
  assert.equal(handover.uid, first.uid) // oldest catch first
  assert.equal(handover.origin, 'catch')
})

test('two graduates open the next region', () => {
  const g = fold1(run(160, { code: 1, gym: 1, guitar: 1 }))
  assert.ok(g.graduates.length >= 2)
  assert.ok(g.regions >= 2)
  assert.ok(g.moments.some((m) => m.kind === 'region'))
})

test('mega while momentum is full, X for a gym week, gone when it drops', () => {
  // get Charizard first, with the gym leading
  const base = run(35, { gym: 1, code: 1, guitar: 0 })
  const g = fold1(base)
  assert.equal(g.partner.form, 'charizard')
  assert.equal(g.display, 'charizard-megax')
  assert.equal(g.aura, 'mega')
  assert.ok(g.dex['charizard-megax'])
  const y = fold1(run(35, { gym: 0, code: 1, guitar: 1 }))
  assert.equal(y.display, 'charizard-megay')
  const dropped = fold1([...base, day(35, {}), day(36, { code: 1, gym: 1 })])
  assert.equal(dropped.display, 'charizard')
  assert.equal(dropped.aura, null)
})

test('gigantamax on a perfect day only', () => {
  const facts = [...run(22, { code: 1, gym: 1, guitar: 1 }), day(22, {}), day(23, {}), day(24, ALL)]
  const g = fold1(facts)
  assert.equal(g.partner.form, 'charizard')
  assert.equal(g.display, 'charizard-gmax')
  assert.equal(g.aura, 'gmax')
})

test('two empty days put the partner to sleep and break the bond; a pillar wakes it', () => {
  const g = fold1([day(0, { code: 1 }), day(1, {}), day(2, {}), day(3, {})])
  assert.equal(g.asleep, true)
  assert.equal(g.partner.bond, false)
  const awake = fold1([day(0, { code: 1 }), day(1, {}), day(2, {}), day(3, { code: 1 })])
  assert.equal(awake.asleep, false)
  const one = fold1([day(0, { code: 1 }), day(1, {}), day(2, { code: 1 }), day(3, {})])
  assert.equal(one.asleep, false) // never two in a row
  assert.equal(one.partner.bond, true)
})

test('badge on the fifth counting day of a week', () => {
  // GAME_START is a Saturday: the first full week starts two days later
  const facts = run(9, { code: 1, gym: 1 })
  const g = fold1(facts)
  assert.equal(g.badges.length, 1)
  assert.equal(new Date(g.badges[0] + 'T12:00:00').getDay(), 1)
})

test('branching follows what you did: Eevee', () => {
  // force an Eevee partner by folding with a patched start is not possible, so test the rule on its data
  const e = SPECIES.eevee
  assert.equal(e.e?.length, 8)
  assert.deepEqual([...new Set(e.bt)].length, 8)
  assert.equal(e.bt?.[e.e!.indexOf('flareon')], 'fitness')
  assert.equal(e.bt?.[e.e!.indexOf('jolteon')], 'code')
})

test('every evolution, mega and gigantamax id exists in the table', () => {
  for (const [id, r] of Object.entries(SPECIES)) {
    for (const x of [...(r.e ?? []), ...(r.m ?? []), ...(r.gm ? [r.gm] : [])]) assert.ok(SPECIES[x], `${id} → ${x}`)
    if (r.bt) assert.equal(r.bt.length, r.e?.length, id)
    if (r.s > 1 || r.f) assert.ok(r.b && SPECIES[r.b], id)
  }
})

test('facts: spans, grace period, block proportions', () => {
  const input: FactsInput = {
    today: addDays(GAME_START, 1),
    habits: [
      { id: 'leetcode-coding', tier: 'pillar', spans: [{ from: '1970-01-01', to: null }] },
      { id: 'arbor-morning', tier: 'core', spans: [{ from: '1970-01-01', to: null }] },
      { id: 'woodshed-guitar', tier: 'pillar', spans: [{ from: addDays(GAME_START, 1), to: null }] },
      { id: 'old', tier: 'basic', spans: [{ from: '1970-01-01', to: GAME_START }] },
    ],
    ticks: { [GAME_START]: { 'leetcode-coding': new Date(addDays(GAME_START, 5) + 'T10:00:00').toISOString() } },
    arbor: {
      plans: { [GAME_START]: { morning: ['a', 'b', 'c', 'd'] } },
      practice: { [GAME_START]: { a: { done: true, at: new Date(GAME_START + 'T08:00:00').toISOString() }, b: { done: false, at: '' }, c: { done: true, at: new Date(GAME_START + 'T08:05:00').toISOString() } } },
    },
  }
  const [d0, d1] = buildFacts(input)
  assert.deepEqual(d0.habits.map((h) => h.id), ['leetcode-coding', 'arbor-morning'])
  assert.equal(d0.habits[0].done, false) // ticked five days late
  assert.equal(d0.habits[1].frac, 0.5)
  assert.equal(d1.habits.length, 3)
  assert.equal(inTime(new Date(addDays(GAME_START, 1) + 'T23:00:00').toISOString(), GAME_START), true)
  assert.equal(inTime(new Date(addDays(GAME_START, 2) + 'T00:30:00').toISOString(), GAME_START), false)
})

// ── order.ts ──
import { happenedAt, inOrder, settled } from './order.ts'
const ev = (at: string, ins: string | undefined, type = 'tick') => ({ at, inserted_at: ins, type })

test('a live event is ordered by the server clock, so a slow phone clock cannot undo the order', () => {
  // PC ticks at 12:00:10 (clock right); phone unticks 5 s later by the server, but its clock is 13 s behind
  const tick = ev('2026-10-04T12:00:10.000Z', '2026-10-04T12:00:10.200Z')
  const untick = ev('2026-10-04T12:00:02.000Z', '2026-10-04T12:00:15.300Z', 'untick')
  assert.deepEqual(inOrder([untick, tick]).map((e) => e.type), ['tick', 'untick'])
})

test('an event that waited in an outbox keeps the device clock', () => {
  const queued = ev('2026-10-04T09:00:00.000Z', '2026-10-04T12:30:00.000Z') // made at 9, arrived at 12:30
  const live = ev('2026-10-04T11:00:00.000Z', '2026-10-04T11:00:00.300Z', 'untick')
  assert.deepEqual(inOrder([live, queued]).map((e) => e.type), ['tick', 'untick'])
  assert.equal(happenedAt(queued), Date.parse(queued.at))
})

test('rows without a server stamp fall back to at; settled() rewrites at to the ordering time', () => {
  assert.equal(happenedAt(ev('2026-10-04T12:00:00.000Z', undefined)), Date.parse('2026-10-04T12:00:00.000Z'))
  const [s] = settled([ev('2026-10-04T12:00:02.000Z', '2026-10-04T12:00:15.300Z')])
  assert.equal(s.at, '2026-10-04T12:00:15.300Z')
})

// ── today's slice of the bar ──
test('the bar splits into what was there this morning and what today added', () => {
  const g = fold1([day(0, { code: 1 }), day(1, { gym: 1 })]) // 100 + 100
  assert.equal(g.today.xp, 100)
  assert.equal(g.into, 200 - xpForLevel(levelOf(200)))
  assert.equal(g.intoBeforeToday, Math.max(100, xpForLevel(levelOf(200))) - xpForLevel(levelOf(200)))
  assert.ok(g.intoBeforeToday <= g.into)
  const none = fold1([day(0, { code: 1 }), day(1, {})])
  assert.equal(none.intoBeforeToday, none.into) // nothing today: the whole bar was already there
})

test('a level-up today only counts the part above the new level floor', () => {
  // level 2 starts at 24 XP: 0 → 100 crosses levels 2,3 (54) and 4 (96): today's slice sits above floor of level 4
  const g = fold1([day(0, { code: 1 })])
  assert.equal(levelOf(100), 4)
  assert.equal(g.intoBeforeToday, 0)
  assert.equal(g.into, 100 - 96)
})

test('the wild one is known before the day is perfect, and is the one that gets caught', () => {
  const before = fold1([day(0, { code: 1 })])
  assert.ok(before.wild && !before.wild.caught)
  const after = fold1([day(0, ALL)])
  assert.ok(after.wild?.caught)
  assert.equal(after.wild.form, before.wild.form)
  assert.equal(after.queue[0].base, after.wild.form)
})

// ── rules version 3 ──
type G = ReturnType<typeof foldGame>
const items = (g: G) => g.moments.flatMap((m) => (m.kind === 'item' ? [m] : []))
const stones = (g: G) => Object.values(g.bag).reduce((a, b) => a + b, 0)
const caught = (g: G) => g.moments.flatMap((m) => (m.kind === 'catch' ? [m] : []))
const withUse = (facts: DayFacts[], i: number, ...uses: Omit<NonNullable<DayFacts['uses']>[number], 'day'>[]) =>
  facts.map((f, k) => (k === i ? { ...f, uses: uses.map((u) => ({ day: f.day, ...u })) } : f))
// code + gym only: 200 of the day's 370 XP, no chores, so a Poke Ball
const HALF = { code: 1, gym: 1 }
const HALF_HIT = wildHit(200 / 370, 1)

test('version 3 starts on its own day and leaves earlier days alone', () => {
  const facts = run(40, HALF)
  const a = foldGame(facts), b = fold1(facts)
  const cut = facts.findIndex((f) => f.day >= V3_START)
  assert.ok(cut > 0)
  assert.deepEqual(a.moments.filter((m) => m.day < V3_START), b.moments.filter((m) => m.day < V3_START))
  assert.deepEqual(a.days.slice(0, cut).map((d) => d.xp), b.days.slice(0, cut).map((d) => d.xp))
  assert.equal(b.moments.some((m) => m.kind === 'item' || m.kind === 'gym' || m.kind === 'appear'), false)
})

test('the partner still levels and evolves by itself, exactly as before', () => {
  const facts = run(30, HALF)
  const evo = (g: G) => g.moments.filter((m) => (m.kind === 'evolve' || m.kind === 'level') && m.uid === g.moments.find((x) => x.kind === 'evolve')!.uid)
  assert.deepEqual(evo(fold3(facts)), evo(fold1(facts)))
  assert.equal(fold3(facts).partner.form, 'charizard')
  assert.deepEqual(fold3(facts).days.map((d) => d.xp), fold1(facts).days.map((d) => d.xp))
})

test('one wild Pokemon at a time: each day wears it down, and it is caught when its HP runs out', () => {
  const one = fold3(run(1, HALF))
  assert.ok(one.wild && !one.wild.caught)
  assert.equal(one.wild.max, WILD_HP[one.wild.rarity])
  assert.equal(one.today.hit, HALF_HIT)
  assert.equal(one.wild.hp, one.wild.max - HALF_HIT)
  assert.equal(one.today.ball, 'poke')
  assert.equal(one.dex[one.wild.form].own, undefined) // seen, not yet yours
  // the same one is still there the next day, a little weaker: it does not change daily and never flees
  const two = fold3([...run(1, HALF), day(1, {}), day(2, HALF)])
  assert.equal(two.wild!.form, one.wild.form)
  assert.equal(two.wild!.hp, one.wild.max - 2 * HALF_HIT)
  // it falls on the day the damage adds up, joins the Box, and the next one appears the morning after
  const n = Math.ceil(one.wild.max / HALF_HIT)
  const done = fold3(run(n, HALF))
  assert.deepEqual([done.wild!.caught, done.wild!.hp, done.wild!.form], [true, 0, one.wild.form])
  assert.equal(done.queue.length, 1)
  assert.equal(caught(done)[0].how, 'worn')
  assert.equal(done.dex[one.wild.form].own, done.today.day)
  const after = fold3(run(n + 1, HALF))
  assert.notEqual(after.wild!.form, one.wild.form)
  assert.equal(after.wild!.from, after.today.day)
  assert.equal(after.moments.filter((m) => m.kind === 'appear').length, 2)
})

test('a whole day hits four times as hard as a half day, and the chores decide the ball', () => {
  assert.equal(wildHit(1, 1), 100)
  assert.equal(wildHit(0.5, 1), 25)
  assert.deepEqual([ballFor(0), ballFor(0.49), ballFor(0.5), ballFor(0.79), ballFor(0.8), ballFor(1)], ['poke', 'poke', 'great', 'great', 'ultra', 'ultra'])
  const great = fold3(run(1, { ...HALF, chores: 1 })).today
  assert.equal(great.ball, 'ultra')
  assert.equal(great.hit, wildHit(210 / 370, 1.5))
  assert.equal(fold3(run(1, {})).today.hit, 0) // an empty day does nothing, and costs nothing
})

test('a perfect day catches on the spot, and is the only way to a shiny', () => {
  const g = fold3([day(0, HALF), day(1, ALL)])
  assert.equal(g.wild!.caught, true)
  assert.equal(g.today.hit, g.wild!.max - HALF_HIT) // whatever HP it had left
  assert.equal(caught(g)[0].how, 'perfect')
  assert.equal(g.perfectDays, 1)
  // sixty perfect days: sixty catches, some of them shiny, and a stone on every fifth
  const many = fold3(run(60, ALL))
  assert.equal(caught(many).length, 60)
  const shiny = caught(many).filter((c) => c.shiny).length
  assert.ok(shiny >= 1 && shiny <= 20, `${shiny} shinies in 60`)
  assert.equal(items(many).filter((m) => m.why === 'perfect').length, 12)
  assert.deepEqual(caught(fold3(run(60, ALL))), caught(many)) // the same on every device
  // a worn-down catch is never shiny
  assert.equal(caught(fold3(run(120, HALF))).some((c) => c.shiny), false)
  // every 25th to appear is a legendary
  const spawns = many.moments.flatMap((m) => (m.kind === 'appear' ? [m.rarity] : []))
  assert.equal(spawns[24], 'L')
  assert.equal(spawns.slice(0, 24).includes('L'), false)
})

test('the Box: the oldest is next unless you choose, and choosing is free', () => {
  const facts = run(3, ALL) // three perfect days: three in the Box
  const g = fold3(facts)
  assert.equal(g.queue.length, 3)
  assert.equal(g.nextUp, g.queue[0].uid)
  const pick = g.queue[2]
  const chosen = fold3(withUse(facts, 2, { item: '', uid: pick.uid, what: 'next' }))
  assert.equal(chosen.nextUp, pick.uid)
  assert.deepEqual(chosen.bag, g.bag) // no stone spent
  // when the partner is fully trained, the chosen one takes over; the others stay in the Box
  const long = [...facts, ...Array.from({ length: 40 }, (_, k) => day(3 + k, { code: 1, gym: 1, guitar: 1 }))]
  const led = fold3(withUse(long, 2, { item: '', uid: pick.uid, what: 'next' }))
  assert.equal(led.graduates[0].base, 'charmander')
  assert.equal(led.partner.uid, pick.uid)
  assert.equal(fold3(long).partner.uid, g.queue[0].uid) // untouched: the oldest
  // a choice that is not in the Box is ignored
  assert.equal(fold3(withUse(facts, 2, { item: '', uid: 'nobody', what: 'next' })).nextUp, g.queue[0].uid)
})

test('a gym leader has HP; the domains they are weak to hit harder, and so does a partner with the edge', () => {
  assert.deepEqual(weakDomains('Rock'), ['arbor', 'fitness'])
  assert.deepEqual(weakDomains('Water'), ['arbor', 'code'])
  assert.equal(beats(['Fire', 'Flying'], 'Grass'), true)
  assert.equal(beats(['Fire', undefined], 'Rock'), false)
  // Brock (Rock) against a Charmander: gym counts x1.5, code x1, no edge
  const g = fold3(run(1, HALF))
  assert.equal(leaderOf(g.league.index, g.league.slot)?.name, 'Brock')
  assert.deepEqual(g.league.weak, ['arbor', 'fitness'])
  assert.equal(g.league.edge, false)
  assert.equal(g.today.strike, 100 * WEAK_MULT + 100)
  assert.equal(g.league.hp, LEADER_HP - 250)
  // HP carries over, a day off costs nothing, and the next leader steps up when it reaches zero
  const off = fold3([day(0, HALF), day(1, {}), day(2, HALF)])
  assert.equal(off.league.hp, LEADER_HP - 500)
  const n = Math.ceil(LEADER_HP / 250)
  const won = fold3(run(n, HALF))
  assert.deepEqual([won.league.slot, won.league.hp], [1, LEADER_HP])
  assert.equal(leaderOf(won.league.index, won.league.slot)?.name, 'Misty')
  const gym = won.moments.find((m) => m.kind === 'gym')
  assert.ok(gym && gym.kind === 'gym' && gym.league === 0 && gym.slot === 0)
  // Misty is Water and code is one of her weaknesses; by now the partner is no Charmander either way
  assert.deepEqual(won.league.weak, ['arbor', 'code'])
})

test('Kanto, then the Orange Islands, then Johto when Johto is open', () => {
  assert.deepEqual(LEAGUES.map((l) => l.name).slice(0, 3), ['Kanto', 'Orange Islands', 'Johto'])
  assert.deepEqual(lineup(LEAGUES[1]).map((t) => t.name), ['Cissy', 'Danny', 'Rudy', 'Luana', 'Drake'])
  assert.deepEqual(LEAGUES[1].gyms.map((t) => t.badge), ['Coral-Eye', 'Sea Ruby', 'Spike Shell', 'Jade Star'])
  const g = fold3(run(400, { code: 1, gym: 1, guitar: 1 }))
  const leagues = g.moments.flatMap((m) => (m.kind === 'league' ? [m.league] : []))
  assert.deepEqual(leagues.slice(0, 2), [0, 1]) // Kanto, then Orange without waiting for anything
  assert.ok(g.league.beaten >= 1)
  assert.ok(g.regions >= 2)
  // beating the Orange Crew opens no region: only regional leagues count for that
  const kanto = g.moments.find((m) => m.kind === 'league' && m.league === 0)!
  const orange = g.moments.find((m) => m.kind === 'league' && m.league === 1)!
  const until = (d: string) => fold3(run(400, { code: 1, gym: 1, guitar: 1 }).filter((f) => f.day <= d))
  assert.equal(until(orange.day).league.beaten, until(kanto.day).league.beaten)
  // the Hall of Fame keeps who was there when a Champion fell
  assert.equal(g.hall[0].league, 0)
  assert.equal(g.hall[0].day, kanto.day)
  assert.ok(g.hall[0].partner.form && g.hall[0].stats.atk === 100)
  // stones: every second gym, each of the Elite Four, the Champion: nine for Kanto
  assert.equal(items(until(kanto.day)).filter((m) => m.why !== 'perfect').length, 4 + 4 + 1)
})

test('a region waits for both: its league stands still until two partners are trained', () => {
  assert.deepEqual([regionsOpenV2(0, 1), regionsOpenV2(2, 0), regionsOpenV2(2, 1), regionsOpenV2(9, 1), regionsOpenV2(40, 40)], [1, 1, 2, 2, 9])
  // chores only: leaders fall slowly and nothing is ever fully trained, so Johto's leaders wait
  const slow = fold3(run(400, { code: 1 }))
  if (slow.league.index === 2 && slow.graduates.length < 2) {
    assert.equal(slow.league.waiting, true)
    assert.equal(slow.today.strike, 0)
  }
  assert.equal(fold3(run(1, HALF)).league.waiting, false)
})

test('stones are spent by hand and never needed: Mega for a week, a branch, a change of partner', () => {
  // long enough for a Charizard and a stone from the second gym, on and off so momentum is never full
  const facts = Array.from({ length: 70 }, (_, k) => day(k, k % 3 === 2 ? {} : HALF))
  const g = fold3(facts)
  assert.equal(g.partner.form, 'charizard')
  assert.equal(g.aura, null)
  assert.ok(stones(g) >= 1)
  const stone = Object.keys(g.bag).find((k) => g.bag[k] > 0)!
  const used = fold3(withUse(facts, 69, { item: stone, uid: g.partner.uid, what: 'mega', to: 'charizard-megay' }))
  assert.deepEqual([used.display, used.aura], ['charizard-megay', 'mega'])
  assert.equal(stones(used), stones(g) - 1)
  // bring someone from the Box forward: the old partner goes back to the Box with its XP
  assert.ok(g.queue.length >= 1)
  const swap = fold3(withUse(facts, 69, { item: stone, uid: g.queue[0].uid, what: 'lead' }))
  assert.equal(swap.partner.uid, g.queue[0].uid)
  assert.deepEqual([swap.queue[0].uid, swap.queue[0].xp], [g.partner.uid, g.partner.xp])
  // junk costs nothing
  const junk = fold3(withUse(facts, 69, { item: stone, uid: 'nobody', what: 'lead' }, { item: 'no-such-stone', uid: g.partner.uid, what: 'mega' }, { item: stone, uid: g.partner.uid, what: 'branch', to: 'raichu' }))
  assert.deepEqual(junk.bag, g.bag)
})

test('Mega by itself needs full momentum and every pillar done today', () => {
  const some = fold3(run(40, HALF)) // momentum full, but guitar never done
  assert.equal(some.momentum.days, 7)
  assert.equal(some.aura, null)
  const all = fold3([...run(39, HALF), day(39, { code: 1, gym: 1, guitar: 1 })])
  assert.equal(all.aura, 'mega')
  assert.equal(all.display, 'charizard-megax')
})

test('a branching partner shows which way it is leaning', () => {
  assert.deepEqual(fold3(run(5, HALF)).lean, []) // Charmander does not branch
  // find a branching Pokemon among the first catches and bring it forward
  const facts = run(45, ALL)
  const g = fold3(facts)
  const branchy = g.queue.find((m) => (SPECIES[m.form].e?.length ?? 0) > 1)
  assert.ok(branchy, 'forty-five catches in Kanto include a branching Pokemon')
  const stone = Object.keys(g.bag).find((k) => g.bag[k] > 0)!
  const led = fold3(withUse([...facts, day(45, { gym: 1 })], 44, { item: stone, uid: branchy.uid, what: 'lead' }))
  assert.equal(led.partner.uid, branchy.uid)
  assert.equal(led.lean.length, SPECIES[branchy.form].e!.length)
  assert.ok(led.lean[0].pct >= led.lean[led.lean.length - 1].pct)
  const sum = led.lean.reduce((a, b) => a + b.pct, 0)
  assert.ok(sum >= 97 && sum <= 103, String(sum))
})

test('the measured Sleep pillar pays the score, is done at 80, and cannot spoil a perfect day', () => {
  const lib = (tier: string) => ({ tier, spans: [{ from: '1970-01-01', to: null }] })
  const input: FactsInput = {
    today: addDays(V3_START, 1),
    habits: [{ id: 'leetcode-coding', ...lib('pillar') }, { id: 'sleep-before-10', ...lib('core') }],
    ticks: { [V3_START]: { 'sleep-before-10': new Date(V3_START + 'T08:00:00').toISOString() } },
  }
  const sleep = (i: FactsInput, d: string) => buildFacts(i).find((f) => f.day === d)!.habits.find((h) => h.id === 'sleep-before-10')!
  // no band: the hand tick still counts, as a core habit
  assert.deepEqual([sleep(input, V3_START).worth, sleep(input, V3_START).done, sleep(input, V3_START).pillar], [30, true, false])
  // the band reports: a pillar, paid by score, and the tick is ignored
  const band: FactsInput = { ...input, body: { [V3_START]: { sleepScore: 65 }, [addDays(V3_START, 1)]: { sleepScore: 88, steps: 12000, recovery: 70 } } }
  const a = sleep(band, V3_START), b = sleep(band, addDays(V3_START, 1))
  assert.deepEqual([a.worth, a.pillar, a.frac, a.done, a.measured], [100, true, 0.65, false, true])
  assert.deepEqual([b.frac, b.done], [0.88, true])
  const g = foldGame(buildFacts(band))
  assert.equal(g.today.xp, 88)
  assert.equal(g.today.pillars, 1)
  // a poor night, then everything else done: still a perfect day
  const rough: FactsInput = { ...band, ticks: { [V3_START]: { 'leetcode-coding': new Date(V3_START + 'T09:00:00').toISOString() } } }
  const d0 = foldGame(buildFacts(rough)).days.find((d) => d.day === V3_START)!
  assert.deepEqual([d0.perfect, d0.done, d0.total], [true, 1, 1])
  assert.equal(sleep({ ...band, body: { [addDays(V3_START, 1)]: { sleepScore: 88 } } }, V3_START).pillar, false)
  const s = statsOf(buildFacts(band))
  assert.deepEqual([s.spe, s.def, s.atk], [100, 70, null])
})

test('a frozen day list: editing the library later cannot change what a day was', () => {
  const span = [{ from: '1970-01-01', to: null }]
  const tick = (d: string) => new Date(d + 'T09:00:00').toISOString()
  const input: FactsInput = {
    today: addDays(GAME_START, 1),
    // today's library: Gym was deleted and LeetCode demoted since yesterday
    habits: [{ id: 'leetcode-coding', tier: 'core', name: 'LeetCode', spans: span }],
    ticks: { [GAME_START]: { 'leetcode-coding': tick(GAME_START), gym: tick(GAME_START) } },
    lists: { [GAME_START]: [{ id: 'leetcode-coding', tier: 'pillar' }, { id: 'gym', tier: 'pillar' }] },
  }
  const [d0, d1] = buildFacts(input)
  assert.deepEqual(d0.habits.map((h) => [h.id, h.worth, h.done, h.name]), [['leetcode-coding', 100, true, 'LeetCode'], ['gym', 100, true, undefined]])
  assert.deepEqual(d1.habits.map((h) => [h.id, h.worth]), [['leetcode-coding', 30]]) // no list for that day: the library as it is
  // a list rewritten during its own day replaces the earlier one
  const evs = [
    { type: 'day_list', day: GAME_START, at: '1', payload: { habits: JSON.stringify([{ id: 'a', tier: 'pillar' }]) } },
    { type: 'day_list', day: GAME_START, at: '2', payload: { habits: JSON.stringify([{ id: 'b', tier: 'core' }]) } },
    { type: 'day_list', day: 'x', at: '3', payload: { habits: '{broken' } },
  ]
  assert.deepEqual(listsOf(evs), { [GAME_START]: [{ id: 'b', tier: 'core' }] })
})

test('every leader, in every league', () => {
  assert.equal(LEAGUES.length, 10)
  assert.deepEqual(LEAGUES.filter((l) => l.region !== null).map((l) => l.region), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  for (const l of LEAGUES) {
    for (const t of lineup(l)) {
      assert.ok(t.name && t.type)
      assert.ok(weakDomains(t.type).length >= 1, `${t.name} has a weakness`)
    }
    if (l.region !== null) assert.deepEqual([l.gyms.length, l.four.length], [8, 4])
  }
  assert.equal(leaderOf(0, 0)?.name, 'Brock')
  assert.equal(leaderOf(0, 12)?.name, 'Blue')
  assert.deepEqual([isGym(0, 7), isGym(0, 8), isGym(1, 3), isGym(1, 4)], [true, false, true, false])
})

// ── version 4 ────────────────────────────────────────────────────────────────
const THREE = { code: 1, gym: 1, guitar: 1 }
const far = (n: number) => addDays(GAME_START, n)

test('history stands: the recorded days fold exactly as they did under versions 1 and 3', () => {
  const file = new URL('./fixtures/golden.json', import.meta.url)
  const { facts, expected } = JSON.parse(fs.readFileSync(file, 'utf8')) as { facts: DayFacts[]; expected: unknown }
  assert.deepEqual(golden(foldGame(facts, { v4From: '9999-01-01', v5From: '9999-01-01', v6From: '9999-01-01' })), expected)
})

test('version 4 starts on its own day and leaves every earlier day alone', () => {
  assert.deepEqual([rulesOn(GAME_START), rulesOn(V3_START), rulesOn(V4_START, V3_START, V4_START, '9999-01-01', '9999-01-01'), rulesOn(addDays(V4_START, -1))], [1, 3, 4, 3])
  const facts = Array.from({ length: 200 }, (_, k) => day(k, k % 11 === 3 ? ALL : k % 5 === 4 ? {} : THREE))
  const cut = 120
  const old = fold3(facts.slice(0, cut))
  const g = foldGame(facts, { v3From: GAME_START, v4From: far(cut), v5From: '9999-01-01', v6From: '9999-01-01' })
  assert.deepEqual(g.days.slice(0, cut), old.days)
  assert.deepEqual(g.moments.filter((m) => m.day < far(cut)), old.moments)
  assert.equal(g.version, 4)
  assert.equal(old.version, 3)
})

test('a day list can grow but not shrink', () => {
  const D = V4_START
  const L = (at: string, list: unknown, extra: Record<string, unknown> = {}) => ({ type: 'day_list', day: D, at, payload: { habits: JSON.stringify(list), ...extra } })
  const first = [{ id: 'a', tier: 'pillar', tag: 'code' }, { id: 'b', tier: 'basic', tag: 'routine' }]
  // b taken off, a demoted, c added: only c counts
  const later = [{ id: 'a', tier: 'core', tag: 'guitar' }, { id: 'c', tier: 'core', tag: 'fitness' }]
  assert.deepEqual(listsOf([L('1', first), L('2', later)])[D], [...first, { id: 'c', tier: 'core', tag: 'fitness' }])
  // the same order of lists on a version 3 day: the last one stands, as it always did
  const old = addDays(V4_START, -1)
  assert.deepEqual(listsOf([{ ...L('1', first), day: old }, { ...L('2', later), day: old }])[old], later.map(({ id, tier }) => ({ id, tier })))
  // a deliberate correction replaces the list of the day
  assert.deepEqual(listsOf([L('1', first), L('2', later, { fix: true })])[D], later)
  // an empty list is a list (a day with nothing on it), a broken one is not, and a made-up domain is dropped
  assert.deepEqual(listsOf([L('1', [])])[D], [])
  assert.equal(listsOf([{ type: 'day_list', day: D, at: '1', payload: { habits: '{broken' } }])[D], undefined)
  assert.deepEqual(listsOf([L('1', [{ id: 'a', tier: 'core', tag: 'nonsense' }])])[D], [{ id: 'a', tier: 'core' }])
  // Life OS only writes when it would change something
  assert.equal(listAdds(undefined, first), true)
  assert.equal(listAdds(first, [first[1], first[0]]), false) // a reorder
  assert.equal(listAdds(first, [first[0]]), false) // a removal
  assert.equal(listAdds(first, later), true)
})

test('the domain of a habit comes from the list of the day, then the library, then its id', () => {
  const span = [{ from: '1970-01-01', to: null }]
  const input: FactsInput = {
    today: V4_START,
    habits: [{ id: 'deep-work', tier: 'pillar', domain: 'code', spans: span }, { id: 'gym', tier: 'pillar', spans: span }, { id: 'run', tier: 'pillar', spans: span }],
    ticks: {},
  }
  const tags = (i: FactsInput, d: string) => Object.fromEntries(buildFacts(i).find((f) => f.day === d)!.habits.map((h) => [h.id, h.tag]))
  assert.deepEqual(tags(input, V4_START), { 'deep-work': 'code', gym: 'fitness', run: 'routine' })
  // before version 4 only the id decided, and it still does for those days
  assert.equal(tags(input, addDays(V4_START, -1))['deep-work'], 'routine')
  // the list of the day wins over what the library says now
  const listed: FactsInput = { ...input, lists: { [V4_START]: [{ id: 'deep-work', tier: 'pillar', tag: 'guitar' }, { id: 'run', tier: 'pillar' }] } }
  assert.deepEqual(tags(listed, V4_START), { 'deep-work': 'guitar', run: 'routine' })
  // a pillar that counts as a chore is said out loud
  const g = foldGame(buildFacts(input))
  assert.equal(g.warnings.length, 1)
  assert.match(g.warnings[0], /^run is a pillar with no domain/)
})

test('version 4: the badge is the reward; no stone is earned and none is needed', () => {
  const facts = run(400, THREE)
  const g = fold4(facts)
  assert.ok(g.moments.filter((m) => m.kind === 'gym').length >= 13)
  assert.equal(items(g).length, 0)
  assert.deepEqual(g.bag, {})
  // pace is untouched: the same leaders fall on the same days as under version 3
  const gyms = (x: G) => x.moments.filter((m) => m.kind === 'gym')
  assert.deepEqual(gyms(g), gyms(fold3(facts)))
  assert.deepEqual(g.days.map((d) => [d.xp, d.hit, d.strike]), fold3(facts).days.map((d) => [d.xp, d.hit, d.strike]))
  // a change of partner costs nothing
  const box = fold4(run(3, ALL))
  const led = fold4(withUse(run(3, ALL), 2, { item: '', uid: box.queue[0].uid, what: 'lead' }))
  assert.equal(led.partner.uid, box.queue[0].uid)
  assert.equal(led.queue[0].uid, box.partner.uid)
  // a week of Mega is no longer sold
  const noMega = fold4(withUse(run(70, HALF), 69, { item: 'fire-stone', uid: fold4(run(70, HALF)).partner.uid, what: 'mega' }))
  assert.equal(noMega.moments.some((m) => m.kind === 'use'), false)
})

test('version 4: the Key Stone comes with the eighth Kanto badge, and Mega is kept for good', () => {
  const facts = run(900, THREE)
  const g = fold4(facts)
  const eighth = g.moments.find((m) => m.kind === 'gym' && m.league === 0 && m.slot === 7)!
  const key = g.moments.filter((m) => m.kind === 'key')
  assert.equal(key.length, 1)
  assert.equal(key[0].day, eighth.day)
  assert.equal(g.keyStone, eighth.day)
  const megas = g.moments.flatMap((m) => (m.kind === 'mega' ? [m] : []))
  assert.ok(megas.length >= 1, 'someone with a Mega form was raised in 900 days')
  assert.ok(megas.every((m) => m.day >= eighth.day))
  // nothing with a Mega form finishes training without it once the Key Stone is held
  for (const m of g.graduates.filter((x) => x.graduated! >= eighth.day && SPECIES[x.form].m))
    assert.deepEqual(m.megas, SPECIES[m.form].m, m.uid)
  // registered while it was out in front: drawn as the Mega from then on, even on days with no work at all
  const until = (d: string, extra: DayFacts[] = []) => fold4([...facts.filter((f) => f.day <= d), ...extra])
  const live = megas.find((m) => until(m.day).partner.uid === m.uid)
  assert.ok(live, 'one of them was registered by a leader falling')
  const n = facts.findIndex((f) => f.day === live.day)
  const rest = [day(n + 1, {}), day(n + 2, {}), day(n + 3, {})]
  const idle = until(live.day, rest)
  assert.deepEqual([idle.aura, idle.display, idle.partner.megas], ['mega', live.form, SPECIES[idle.partner.form].m])
  // which form shows is a free choice and changes nothing else
  const plain = fold4(withUse([...facts.filter((f) => f.day <= live.day), ...rest], n + 1, { item: '', uid: live.uid, what: 'show', to: 'base' }))
  assert.deepEqual([plain.aura, plain.display], [null, plain.partner.form])
  assert.equal(plain.partner.xp, idle.partner.xp)
})

test('version 4: bond is never lost, and the days together only count up', () => {
  const facts = [day(0, HALF), day(1, {}), day(2, {}), day(3, {})]
  assert.equal(fold3(facts).partner.bond, false)
  const g = fold4(facts)
  assert.deepEqual([g.partner.bond, g.asleep, g.partner.together], [true, true, 1])
  assert.equal(fold4([...facts, day(4, HALF)]).partner.together, 2)
})

test('version 4: a partner graduates with a nature from what it was raised on', () => {
  // gym and code every day, nothing else: the first of the best (gym) up, the first of the worst (the morning block) down
  const g = fold4(run(80, HALF))
  assert.deepEqual(g.graduates[0].nature, { name: 'Lonely', up: 'fitness', down: 'arbor' })
  // code alone: Sp. Atk up
  assert.equal(fold4(run(200, { code: 1 })).graduates[0].nature?.up, 'code')
  // everything the same: one of the five that change nothing
  assert.deepEqual(fold4(run(80, ALL)).graduates[0].nature, { name: 'Hardy' })
  // raised before version 4: none
  assert.equal(fold3(run(80, HALF)).graduates[0].nature, undefined)
})

test('a catch keeps the ball of its day', () => {
  assert.equal(fold4(run(1, ALL)).queue[0].ball, 'ultra')
  const worn = fold4(run(40, HALF)) // no chores done: worn down with a Poke Ball
  assert.equal(worn.queue[0].ball, 'poke')
})

test('field notes count each domain in its own unit', () => {
  const facts: DayFacts[] = [
    { ...day(0, { code: 1, arbor: 1, guitar: 0.5 }), marks: { workouts: 1, records: 2, clean: 3 }, body: { steps: 4000 } },
    { ...day(1, { code: 1, guitar: 1 }), marks: { owned: 1 }, body: { steps: 25000 } },
    day(2, {}),
  ]
  assert.deepEqual(fold4(facts).notes, { codeDays: 2, arborDays: 1, guitarDays: 1, workouts: 1, records: 2, clean: 3, owned: 1, steps: 14000, stepDays: 2 })
})

test('crossing into version 4 with a stone in the Bag and a Mega week running', () => {
  const facts = Array.from({ length: 80 }, (_, k) => day(k, k % 3 === 2 ? {} : HALF))
  const before = fold3(facts.slice(0, 70))
  const stone = Object.keys(before.bag).find((k) => before.bag[k] > 0)!
  const used = withUse(facts, 69, { item: stone, uid: before.partner.uid, what: 'mega', to: 'charizard-megay' })
  const cross = (n: number) => foldGame(used.slice(0, n), { v3From: GAME_START, v4From: far(72), v5From: '9999-01-01', v6From: '9999-01-01' })
  // the week that was bought runs out as it was bought: days 69 to 75
  assert.deepEqual([cross(74).display, cross(76).display, cross(77).display], ['charizard-megay', 'charizard-megay', 'charizard'])
  // what was in the Bag stays there, and nothing is added to it
  assert.deepEqual(cross(80).bag, cross(72).bag)
  assert.equal(items(cross(80)).filter((m) => m.day >= far(72)).length, 0)
})

// ── version 5 ────────────────────────────────────────────────────────────────
const use = (facts: DayFacts[], i: number, ...uses: { what: string; item?: string; uid?: string; to?: string }[]) =>
  withUse(facts, i, ...uses.map((u) => ({ item: u.item ?? '', uid: u.uid ?? '', what: u.what, ...(u.to ? { to: u.to } : {}) })))

test('version 5 starts on its own day and leaves every earlier day alone', () => {
  assert.deepEqual([rulesOn(addDays(V5_START, -1)), rulesOn(V5_START)], [3, 6]) // versions 4 and 5 were replaced before their first day
  const facts = Array.from({ length: 160 }, (_, k) => day(k, k % 11 === 3 ? ALL : k % 5 === 4 ? {} : THREE))
  const cut = 90
  const old = fold4(facts.slice(0, cut))
  const g = foldGame(facts, { v3From: GAME_START, v4From: GAME_START, v5From: far(cut), v6From: '9999-01-01' })
  assert.deepEqual(g.days.slice(0, cut), old.days)
  assert.deepEqual(g.moments.filter((m) => m.day < far(cut)), old.moments)
  assert.deepEqual([g.version, old.version], [5, 4])
  // nothing was earned before it began
  assert.deepEqual(old.wallet, { coins: 0, gems: 0, coinsToday: 0, gemsToday: 0, marks: { code: 0, fitness: 0, guitar: 0, arbor: 0, sleep: 0 }, marksToday: { code: 0, fitness: 0, guitar: 0, arbor: 0, sleep: 0 } })
})

test('version 5: a coin for each XP of the work, quests pay by themselves, and XP is untouched', () => {
  // gym and code: 200 XP of work, two pillars
  const one = fold5(run(1, HALF))
  assert.equal(one.wallet.coins, 200 + 40) // the work, and "finish two pillars"
  assert.deepEqual(one.quests.daily.map((q) => [q.id, q.done]), [['two-pillars', true], ['all-pillars', false], ['chores', false], ['perfect', false]])
  assert.deepEqual(one.quests.daily[1].have, 2)
  // the same days give the same XP as version 4: coins never touch it
  const facts = run(30, HALF)
  assert.deepEqual(fold5(facts).days.map((d) => d.xp), fold4(facts).days.map((d) => d.xp))
  assert.equal(fold5(facts).partner.xp, fold4(facts).partner.xp)
  // a week of them: five counting days and 2,000 XP of work are both paid, once
  const week = fold5(run(14, HALF))
  const paid = week.moments.flatMap((m) => (m.kind === 'quest' ? [m.id] : []))
  assert.equal(paid.filter((id) => id === 'five-days').length, 2)
  // 200 XP a day never makes 2,000 in a week; 300 a day does, in the one full week
  assert.equal(paid.filter((id) => id === 'week-xp').length, 0)
  assert.equal(fold5(run(14, THREE)).moments.filter((m) => m.kind === 'quest' && m.id === 'week-xp').length, 1)
  assert.ok(week.wallet.gems >= 30)
})

test('version 5: an ordinary day hits harder than under the square', () => {
  assert.equal(wildHit(0.5, 1), 25)
  assert.equal(wildHit5(0.5, 1), 35)
  assert.equal(wildHit5(1, 1.5), wildHit(1, 1.5))
})

test('version 5: buy a ball, throw it, and the wild Pokemon loses that much at once', () => {
  const facts = run(4, HALF) // 4 x 240 coins
  const g = fold5(facts)
  assert.ok(g.wild && !g.wild.caught)
  const hp = g.wild.hp
  // cannot throw what is not held; cannot buy what cannot be paid for
  assert.equal(fold5(use(facts, 3, { what: 'throw', item: 'ultra-ball' })).wild!.hp, hp)
  assert.deepEqual(fold5(use(run(1, HALF), 0, { what: 'buy', item: 'ultra-ball' })).inv, {})
  const bought = fold5(use(facts, 3, { what: 'buy', item: 'ultra-ball' }))
  assert.deepEqual([bought.inv['ultra-ball'], bought.wallet.coins], [1, g.wallet.coins - SHOP['ultra-ball'].coins!])
  const thrown = fold5(use(facts, 3, { what: 'buy', item: 'ultra-ball' }, { what: 'throw', item: 'ultra-ball' }))
  assert.equal(thrown.wild!.hp, hp - 200)
  assert.equal(thrown.inv['ultra-ball'], 0)
  assert.equal(thrown.today.hit, g.today.hit + 200)
  assert.equal(thrown.partner.xp, g.partner.xp)
  // enough of them and it is caught by the ball, kept in that ball, and pays gems
  const many = run(12, HALF)
  const base = fold5(many)
  const left = base.wild!.hp
  const n = Math.ceil(left / 200)
  const acts = Array.from({ length: n }, () => [{ what: 'buy', item: 'ultra-ball' }, { what: 'throw', item: 'ultra-ball' }]).flat()
  const got = fold5(use(many, 11, ...acts))
  if (base.wallet.coins >= n * 350) {
    const c = caught(got).at(-1)!
    assert.deepEqual([c.how, got.queue.at(-1)!.ball, got.wild!.caught], ['ball', 'ultra', true])
    assert.equal(got.wallet.gems, base.wallet.gems + GEMS.catch + 10) // and the week's "catch a Pokemon"
  }
})

test('version 5: a berry is a heart, and the Professor takes a Pokemon for gems', () => {
  const facts = run(3, ALL) // three perfect days: three in the Box
  const g = fold5(facts)
  assert.equal(g.queue.length, 3)
  const fed = fold5(use(facts, 2, { what: 'buy', item: 'berry' }, { what: 'feed' }, { what: 'feed' }))
  assert.deepEqual([fed.partner.fed, fed.inv.berry], [1, 0])
  assert.deepEqual([bondLevel(9), bondLevel(10), bondLevel(60)], [0, 1, 3])
  const sent = fold5(use(facts, 2, { what: 'transfer', uid: g.queue[1].uid }, { what: 'transfer', uid: 'nobody' }))
  assert.deepEqual(sent.queue.map((m) => m.uid), [g.queue[0].uid, g.queue[2].uid])
  assert.equal(sent.wallet.gems, g.wallet.gems + GEMS.transfer)
  // the partner cannot be sent away
  assert.equal(fold5(use(facts, 2, { what: 'transfer', uid: g.partner.uid })).partner.uid, g.partner.uid)
})

test('version 5: incense chooses the next wild Pokemon from three', () => {
  const facts = run(20, ALL) // plenty of gems; a catch every day
  const g = fold5(facts.slice(0, 19))
  assert.equal(g.wish.options.length, 3)
  const want = g.wish.options[2]
  const wished = fold5(use(facts, 18, { what: 'buy', item: 'incense' }, { what: 'wish', to: want }, { what: 'wish', to: g.wish.options[0] }))
  assert.equal(wished.moments.filter((m) => m.kind === 'appear').at(-1)!.form, want)
  assert.equal(wished.inv.incense, 0)
  // something that is not one of the three is ignored and the incense is kept
  const junk = fold5(use(facts.slice(0, 19), 18, { what: 'buy', item: 'incense' }, { what: 'wish', to: 'mewtwo' }))
  assert.deepEqual([junk.inv.incense, junk.wish.chosen], [1, null])
})

test('version 5: the team backs the partner, and a theme is bought once', () => {
  const facts = run(260, THREE)
  const g = fold5(facts)
  assert.ok(g.graduates.length >= 3)
  assert.deepEqual(g.team.map((m) => m.uid), g.graduates.slice(-3).reverse().map((m) => m.uid)) // left alone: the last three trained
  // no team at all never hits harder than the one you have
  const none = fold5(use(facts, 60, { what: 'team', to: '' }))
  const sum = (x: G) => x.days.reduce((s, d) => s + d.strike, 0)
  assert.ok(sum(none) <= sum(g))
  assert.equal(none.team.length, 0)
  const picked = fold5(use(facts, 259, { what: 'team', to: `${g.graduates[0].uid},nobody,${g.graduates[0].uid}` }))
  assert.deepEqual(picked.team.map((m) => m.uid), [g.graduates[0].uid])
  // a theme: bought once, then worn; one that is not owned is not worn
  const themed = fold5(use(facts, 259, { what: 'buy', item: 'theme-cave' }, { what: 'buy', item: 'theme-cave' }, { what: 'theme', to: 'theme-cave' }))
  assert.deepEqual([themed.inv['theme-cave'], themed.theme, themed.wallet.gems], [1, 'theme-cave', g.wallet.gems - 60])
  assert.equal(fold5(use(facts, 259, { what: 'theme', to: 'theme-beach' })).theme, '')
})

test('version 5: the season is a ladder climbed by the work of the month', () => {
  // 300 XP of work a day: a step every five days
  const g = fold5(run(12, THREE))
  const steps = g.moments.flatMap((m) => (m.kind === 'season' ? [m] : []))
  assert.deepEqual(steps.map((m) => m.step), [1, 2])
  assert.deepEqual([steps[0].coins, steps[1].item], [100, 'great-ball'])
  assert.equal(g.inv['great-ball'], 1)
  assert.deepEqual([g.season.step, g.season.into, g.season.need, g.season.next], [2, 600, SEASON_STEP, { gems: 10 }])
  // a new month starts the ladder again, and keeps what was handed over
  const long = fold5(run(40, THREE)) // 3 Oct to 11 Nov
  assert.equal(long.season.month, '2026-11')
  assert.equal(long.season.step, Math.floor((11 * 300) / SEASON_STEP))
  assert.ok(long.moments.filter((m) => m.kind === 'season').length > long.season.step)
})

test('version 5: a Rare Egg is kept warm by days with two pillars, and hatches into the Box', () => {
  const facts = run(40, ALL) // gems from a catch a day
  const base = fold5(facts.slice(0, 30))
  assert.ok(base.wallet.gems >= 150)
  assert.equal(base.egg, null)
  const bought = (n: number) => fold5(use(facts.slice(0, n), 29, { what: 'buy', item: 'rare-egg' }))
  assert.deepEqual(bought(30).egg, { have: 0, need: EGG_DAYS })
  assert.deepEqual(bought(33).egg, { have: 3, need: EGG_DAYS })
  const hatched = bought(36)
  assert.equal(hatched.egg, null)
  const h = hatched.moments.find((m) => m.kind === 'hatch')!
  assert.ok(h.kind === 'hatch' && h.day === far(34))
  const mon = hatched.queue.find((m) => m.uid === h.uid)!
  assert.deepEqual([mon.origin, SPECIES[mon.form].r], ['egg', 'R'])
})

test('version 5: a chest is opened as it is bought, and holds the same thing on every device', () => {
  const facts = run(40, ALL)
  const base = fold5(facts)
  const opened = (n: number) => fold5(use(facts, 39, ...Array.from({ length: n }, () => ({ what: 'buy', item: 'chest' }))))
  const one = opened(1)
  const c = one.moments.find((m) => m.kind === 'chest')!
  assert.ok(c.kind === 'chest' && c.n === 1)
  assert.equal(one.wallet.gems, base.wallet.gems - 30)
  assert.equal(one.inv.chest, undefined) // nothing to keep: it was opened
  if (c.kind === 'chest') {
    if (c.coins) assert.equal(one.wallet.coins, base.wallet.coins + c.coins)
    else assert.equal(one.inv[c.item], (base.inv[c.item] ?? 0) + c.count)
  }
  assert.deepEqual(opened(1).moments.at(-1), one.moments.at(-1))
  // ten of them: every one holds something from the table
  const ten = opened(10).moments.flatMap((m) => (m.kind === 'chest' ? [m] : []))
  assert.equal(ten.length, 10)
  assert.ok(ten.every((m) => m.coins > 0 || CHEST.some((x) => x.item === m.item && x.n === m.count)))
})

test('every entry in the species table can be reached', async () => {
  const { auditDex } = await import('../tools/audit-dex.mjs')
  const a = auditDex()
  assert.deepEqual(a.unreachable, [])
  assert.deepEqual(a.byChoiceOnly, ['glaceon'])
})

test('Life OS runs the same core', { skip: !fs.existsSync(new URL('../../lifeos/src/game-core', import.meta.url)) }, () => {
  const read = (u: URL) => fs.readFileSync(u, 'utf8').replace(/\r\n/g, '\n')
  for (const f of ['rules.ts', 'facts.ts', 'fold.ts', 'order.ts', 'species.ts', 'gyms.ts', 'events.ts', 'types.ts', 'economy.ts'])
    assert.ok(read(new URL(`../../lifeos/src/game-core/${f}`, import.meta.url)) === read(new URL(`./${f}`, import.meta.url)), `${f} differs: run npm run core`)
})

// ── version 6 ────────────────────────────────────────────────────────────────
import { BALLS, DOMAIN_SHOPS, FEATS, FORGE_COST, MART_POOL, SELL, forgeShard, lureTypes, martDeals, throwHp } from './economy.ts'

test('version 6: coins are not XP again, and XP is untouched', () => {
  const six = fold6(run(1, HALF))
  assert.equal(six.wallet.coins, 30) // "finish two pillars" is all a half day pays
  const facts = run(30, HALF)
  assert.deepEqual(fold6(facts).days.map((d) => d.xp), fold5(facts).days.map((d) => d.xp))
  assert.equal(fold6(facts).partner.xp, fold5(facts).partner.xp)
  // 30 half days pay far less than 30 x 200 coins
  assert.ok(fold6(facts).wallet.coins < 30 * 100 + 500)
})

test('version 6: the Mart shows the same three on every device and sells each once a day', () => {
  const d = addDays(GAME_START, 40)
  assert.deepEqual(martDeals(d), martDeals(d))
  assert.equal(martDeals(d).length, 3)
  assert.equal(martDeals(d, 4).length, 4)
  assert.ok(martDeals(d).every((o) => MART_POOL.some((p) => p.item === o.item)))
  const facts = run(8, ALL)
  const deal = martDeals(facts[7].day).sort((a, b) => (a.coins ?? 0) - (b.coins ?? 0))[0]
  const base = fold6(facts).wallet.coins
  const once = fold6(withUse(facts, 7, { item: deal.item, uid: '', what: 'buy', to: 'mart' }))
  assert.equal(once.wallet.coins, base - deal.coins!)
  assert.equal(once.inv[deal.item], 1)
  assert.deepEqual(once.mart.bought, [deal.item])
  const twice = fold6(withUse(facts, 7, { item: deal.item, uid: '', what: 'buy', to: 'mart' }, { item: deal.item, uid: '', what: 'buy', to: 'mart' }))
  assert.equal(twice.inv[deal.item], 1)
  // something not in today's deals cannot be bought
  const off = MART_POOL.find((p) => !martDeals(facts[7].day).some((o) => o.item === p.item))!
  assert.equal(fold6(withUse(facts, 7, { item: off.item, uid: '', what: 'buy', to: 'mart' })).inv[off.item] ?? 0, 0)
})

test('version 6: a coding day pays a mark, a run forgives one rest day but not two, and the shop takes marks', () => {
  const g = fold6(run(5, { code: 1 }))
  assert.equal(g.wallet.marks.code, 5)
  assert.deepEqual(g.runs.code, { cur: 5, best: 5 })
  // a rest day inside a run is forgiven
  const gap = [day(0, { code: 1 }), day(1, { code: 1 }), day(2, {}), day(3, { code: 1 }), day(4, { code: 1 })]
  assert.deepEqual(fold6(gap).runs.code, { cur: 4, best: 4 })
  // two in a row end it, and nothing earned is taken back
  const ended = fold6([day(0, { code: 1 }), day(1, { code: 1 }), day(2, {}), day(3, {}), day(4, { code: 1 }), day(5, { code: 1 })])
  assert.deepEqual(ended.runs.code, { cur: 2, best: 2 })
  assert.equal(ended.wallet.marks.code, 4)
  // six marks buy a Quick Ball in the code shop
  const bought = fold6(withUse(run(7, { code: 1 }), 6, { item: 'quick-ball', uid: '', what: 'buy', to: 'code' }))
  assert.deepEqual([bought.inv['quick-ball'], bought.wallet.marks.code], [1, 1])
  // not with too few
  assert.equal(fold6(withUse(run(3, { code: 1 }), 2, { item: 'quick-ball', uid: '', what: 'buy', to: 'code' })).inv['quick-ball'] ?? 0, 0)
  // and the gym shop does not take Machine Parts
  assert.equal(fold6(withUse(run(7, { code: 1 }), 6, { item: 'heavy-ball', uid: '', what: 'buy', to: 'fitness' })).inv['heavy-ball'] ?? 0, 0)
})

test('version 6: a feat pays once, and the Key Stone is one of them', () => {
  const g = fold6(run(7, HALF))
  assert.ok(g.feats.some((f) => f.id === 'work7'))
  // one kind of work alone is enough
  assert.ok(fold6(run(7, { code: 1 })).inv['key-stone'])
  assert.equal(fold6(run(6, { code: 1 })).inv['key-stone'] ?? 0, 0)
  assert.equal(g.inv['key-stone'], 1)
  assert.equal(g.keyStone, g.feats.find((f) => f.id === 'work7')!.day)
  assert.equal(g.moments.filter((m) => m.kind === 'key').length, 1)
  // a seven-day coding run also pays a blue shard, and nothing is paid twice
  assert.equal(g.inv['blue-shard'], 1)
  const more = fold6(run(12, HALF))
  assert.equal(more.feats.filter((f) => f.id === 'work7').length, 1)
  assert.equal(more.inv['key-stone'], 1)
  // every feat has a counter it can be reached by
  for (const f of FEATS) assert.ok(f.n > 0 && f.key, f.id)
  assert.equal(new Set(FEATS.map((f) => f.id)).size, FEATS.length)
  // the eighth badge no longer hands over a Key Stone: there is still one, and it came from the feat
  assert.equal(fold6(run(120, THREE)).moments.filter((m) => m.kind === 'key').length, 1)
})

test('version 6: balls have conditions', () => {
  const water = { types: ['Water', undefined], from: '2026-10-10', owned: false }
  const fire = { types: ['Fire', undefined], from: '2026-10-10', owned: true }
  assert.equal(throwHp('great-ball', water, '2026-10-10'), 50)
  assert.equal(throwHp('net-ball', water, '2026-10-10'), 80)
  assert.equal(throwHp('net-ball', fire, '2026-10-10'), 40)
  assert.equal(throwHp('quick-ball', fire, '2026-10-10'), 100)
  assert.equal(throwHp('quick-ball', fire, '2026-10-11'), 25)
  assert.equal(throwHp('timer-ball', fire, '2026-10-10'), 15)
  assert.equal(throwHp('timer-ball', fire, '2026-10-13'), 60)
  assert.equal(throwHp('timer-ball', fire, '2026-12-30'), 15 + 15 * 10)
  assert.equal(throwHp('repeat-ball', fire, '2026-10-12'), 75)
  assert.equal(throwHp('repeat-ball', water, '2026-10-12'), 30)
  assert.equal(throwHp('nothing', water, '2026-10-12'), 0)
  assert.ok(Object.keys(BALLS).length >= 10)
})

test('version 6: a held item makes its domain strike harder, and nothing else', () => {
  const facts = run(14, { gym: 1 })
  const buy = withUse(facts, 12, { item: 'muscle-band', uid: '', what: 'buy', to: 'fitness' }, { item: 'muscle-band', uid: '', what: 'hold', to: 'muscle-band' })
  const g = fold6(buy), plain = fold6(facts)
  assert.equal(g.partner.held, 'muscle-band')
  assert.equal(g.days[13].strike, Math.round(plain.days[13].strike * 1.15))
  assert.equal(g.days[13].xp, plain.days[13].xp)
  // it comes off, and goes back in the bag
  const off = fold6(withUse(buy, 13, { item: '', uid: '', what: 'hold', to: '' }))
  assert.equal(off.partner.held, undefined)
  assert.equal(off.inv['muscle-band'], 1)
  // a code habit is not helped by a gym item, and a gym item cannot be bought with code marks
  const c = fold6(withUse(run(14, { code: 1 }), 12, { item: 'muscle-band', uid: '', what: 'buy', to: 'fitness' }))
  assert.equal(c.partner.held, undefined)
})

test('version 6: a TM counts as one of the partner types against a leader', () => {
  const leader = leaderOf(0, 0)!
  assert.equal(leader.type, 'Rock')
  const facts = run(7, { code: 1 })
  const plain = fold6(facts)
  assert.equal(plain.league.edge, false) // Fire does not beat Rock
  const equipped = fold6(withUse(facts, 6, { item: 'tm-water', uid: '', what: 'buy', to: 'code' }, { item: '', uid: '', what: 'move', to: 'tm-water' }))
  assert.equal(equipped.league.edge, true) // Water does
  assert.deepEqual(equipped.partner.moves, ['tm-water'])
  // one that is not owned is ignored
  assert.equal(fold6(withUse(facts, 6, { item: '', uid: '', what: 'move', to: 'tm-water' })).partner.moves, undefined)
  // a TM is bought once
  const twice = fold6(withUse(run(14, { code: 1 }), 13, { item: 'tm-water', uid: '', what: 'buy', to: 'code' }, { item: 'tm-water', uid: '', what: 'buy', to: 'code' }))
  assert.equal(twice.inv['tm-water'], 1)
})

test('version 6: a lure turns the next wild Pokemon toward its domain', () => {
  const facts = run(8, ALL) // a perfect day catches on the spot, so a new wild Pokemon appears each morning
  const lure = fold6(withUse(facts, 2, { item: 'odd-incense', uid: '', what: 'buy', to: 'code' }, { item: 'odd-incense', uid: '', what: 'lure' }))
  assert.equal(lure.inv['odd-incense'] ?? 0, 0)
  const wild = lure.moments.flatMap((m) => (m.kind === 'appear' ? [m] : []))
  const next = wild.find((m) => m.day > facts[2].day)!
  const t = SPECIES[next.form]
  assert.ok(lureTypes('code').includes(t.t) || (t.t2 !== undefined && lureTypes('code').includes(t.t2)), `${next.form} is ${t.t}`)
  assert.equal(lure.lure, null)
})

test('version 6: the Professor pays coins by rarity, and gems for nothing', () => {
  const facts = run(6, ALL)
  const g = fold6(facts)
  const box = g.queue[0]
  assert.ok(box)
  const sold = fold6(withUse(facts, 5, { item: '', uid: box.uid, what: 'transfer' }))
  assert.equal(sold.wallet.coins - g.wallet.coins, SELL[SPECIES[box.form].r ?? 'C'])
  assert.equal(sold.wallet.gems, g.wallet.gems)
})

test('version 6: a Mega Stone is forged from shards, and nothing makes one by itself', () => {
  assert.equal(forgeShard(2, 0, undefined, { 'red-shard': 3 }), 'red-shard')
  assert.equal(forgeShard(2, 0, undefined, { 'blue-shard': 9 }), null)
  assert.equal(forgeShard(2, 1, undefined, { 'yellow-shard': 3 }), 'yellow-shard')
  assert.equal(forgeShard(1, 0, 'arbor', { 'green-shard': 3, 'red-shard': 3 }), 'green-shard')
  assert.equal(forgeShard(1, 0, undefined, { 'blue-shard': 2 }), null)
  const facts = run(900, THREE)
  const g = fold6(facts)
  assert.ok(g.keyStone)
  const grads = g.graduates.filter((m) => (SPECIES[m.form].m?.length ?? 0) > 0)
  assert.ok(grads.length >= 1, 'a Pokemon with a Mega form finished training')
  assert.ok(g.graduates.every((m) => !m.megas), 'no badge or graduation registers a Mega any more')
  const m = grads[0]
  const form = SPECIES[m.form].m![0]
  const forged = fold6(withUse(facts, 899, { item: '', uid: m.uid, what: 'forge', to: form }))
  const mon = forged.graduates.find((x) => x.uid === m.uid)!
  assert.deepEqual(mon.megas, [form])
  const shard = SPECIES[m.form].m!.length > 1 ? 'red-shard' : forgeShard(1, 0, mon.nature?.up, g.inv)!
  assert.equal(g.inv[shard] - forged.inv[shard], FORGE_COST)
  assert.ok(forged.feats.some((f) => f.id === 'mega1'))
  // forging it twice costs nothing the second time
  const again = fold6(withUse(facts, 899, { item: '', uid: m.uid, what: 'forge', to: form }, { item: '', uid: m.uid, what: 'forge', to: form }))
  assert.equal(again.inv[shard], forged.inv[shard])
  // a form it does not have cannot be forged
  assert.equal(fold6(withUse(facts, 899, { item: '', uid: m.uid, what: 'forge', to: 'missingno' })).graduates.find((x) => x.uid === m.uid)!.megas, undefined)
})

test('version 6: every shop sells whole prices of things the table knows', () => {
  for (const s of Object.values(DOMAIN_SHOPS)) for (const o of s.stock) assert.ok(o.item && Number.isInteger(o.marks) && o.marks! > 0, o.item)
  for (const o of MART_POOL) assert.ok(Number.isInteger(o.coins) && o.coins! > 0)
})
