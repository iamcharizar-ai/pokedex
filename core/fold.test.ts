// node --test core/
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, buildFacts, inTime, type DayFacts, type FactsInput, type HabitFact } from './facts.ts'
import { foldGame, leaderOf, statsOf } from './fold.ts'
import { LEAGUES } from './gyms.ts'
import { GAME_START, V2_START, evolveAt, graduateAt, levelOf, momentumMult, regionsOpenV2, xpForLevel } from './rules.ts'
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
const fold1 = (f: DayFacts[]) => foldGame(f, { v2From: '9999-01-01' })
const fold2 = (f: DayFacts[]) => foldGame(f, { v2From: GAME_START })
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

// ── rules version 2 ──
const items = (g: ReturnType<typeof foldGame>) => g.moments.flatMap((m) => (m.kind === 'item' ? [m] : []))
const stones = (g: ReturnType<typeof foldGame>) => Object.values(g.bag).reduce((a, b) => a + b, 0)
const withUse = (facts: DayFacts[], i: number, ...uses: Omit<NonNullable<DayFacts['uses']>[number], 'day'>[]) =>
  facts.map((f, k) => (k === i ? { ...f, uses: uses.map((u) => ({ day: f.day, ...u })) } : f))

test('version 2 starts on its own day and leaves earlier days alone', () => {
  const facts = run(40, { code: 1, gym: 1 })
  const a = foldGame(facts), b = fold1(facts)
  const cut = facts.findIndex((f) => f.day >= V2_START)
  assert.ok(cut > 0)
  assert.deepEqual(a.days.slice(0, cut), b.days.slice(0, cut))
  assert.deepEqual(a.moments.filter((m) => m.day < V2_START), b.moments.filter((m) => m.day < V2_START))
  assert.equal(b.moments.some((m) => m.kind === 'item' || m.kind === 'gym'), false)
})

test('evolution is automatic in version 2 exactly as before: no stone, no condition', () => {
  const facts = run(200, ALL)
  const a = fold2(facts), b = fold1(facts)
  const evolved = (g: typeof a) => g.moments.filter((m) => m.kind === 'evolve' || m.kind === 'graduate' || m.kind === 'partner')
  assert.deepEqual(evolved(a), evolved(b))
  assert.ok(evolved(a).length > 20)
  assert.equal(a.next.level > a.level, true)
})

test('a badge week beats the next gym and comes with one stone', () => {
  const g = fold2(run(9, { code: 1, gym: 1 })) // code and gym tie: either stone, the same one every time
  assert.equal(g.badges.length, 1)
  assert.deepEqual(g.league, { region: 1, badges: 1, run: 0, beaten: 0 })
  const gym = g.moments.find((m) => m.kind === 'gym')
  assert.ok(gym && gym.kind === 'gym' && gym.region === 1 && gym.slot === 0)
  const [it] = items(g)
  assert.ok(['fire-stone', 'thunder-stone'].includes(it.item))
  assert.equal(stones(g), 1)
  assert.deepEqual(items(fold2(run(9, { code: 1, gym: 1 }))), items(g))
  assert.equal(stones(fold2(run(6, { code: 1, gym: 1 }))), 0) // no badge week yet, no stone
})

test('eight gyms, the Elite Four, then the Champion: thirteen badge weeks, and a missed week costs nothing', () => {
  const g = fold2(run(2 + 13 * 7, { code: 1, gym: 1 }))
  assert.equal(g.badges.length, 13)
  assert.deepEqual(g.league, { region: 2, badges: 0, run: 0, beaten: 1 })
  assert.deepEqual(g.moments.flatMap((m) => (m.kind === 'gym' ? [m.slot] : [])), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  assert.equal(stones(g), 13)
  // a week off in the middle of the Elite Four: the next badge week simply carries on
  const facts = run(2 + 14 * 7, { code: 1, gym: 1 })
  for (let i = 2 + 9 * 7; i < 2 + 10 * 7; i++) facts[i] = day(i, {})
  const paused = fold2(facts)
  assert.equal(paused.badges.length, 13)
  assert.equal(paused.league.beaten, 1)
})

test('a region needs both: the league beaten and two partners fully trained', () => {
  assert.deepEqual([regionsOpenV2(0, 1), regionsOpenV2(2, 0), regionsOpenV2(2, 1), regionsOpenV2(9, 1), regionsOpenV2(40, 40)], [1, 1, 2, 2, 9])
  const trained = fold2(run(160, { code: 1, gym: 1, guitar: 1 })) // 22 weeks: one league beaten on the way
  assert.ok(trained.graduates.length >= 2)
  assert.equal(trained.league.beaten, 1)
  assert.equal(trained.regions, 2)
  const short = fold2(run(2 + 13 * 7, { code: 1, gym: 1 })) // the league, but nothing fully trained twice
  assert.ok(short.graduates.length < 2)
  assert.equal(short.regions, 1)
  assert.equal(short.league.region, 2)
  assert.equal(short.moments.filter((m) => m.kind === 'gym' && m.region === 2).length, 0) // Johto's gyms wait for Johto
})

test('a stone Mega Evolves the partner for a week, without full momentum', () => {
  // Charizard by day 30, then an on-and-off stretch so momentum is never full
  const facts = [...run(30, { gym: 1, code: 1 }), ...Array.from({ length: 12 }, (_, k) => day(30 + k, k % 2 ? { gym: 1, code: 1 } : {}))]
  const g = fold2(facts)
  assert.equal(g.partner.form, 'charizard')
  assert.equal(g.aura, null)
  const stone = Object.keys(g.bag).find((k) => g.bag[k] > 0)!
  const used = fold2(withUse(facts, 38, { item: stone, uid: g.partner.uid, what: 'mega', to: 'charizard-megay' }))
  assert.equal(used.display, 'charizard-megay')
  assert.equal(used.aura, 'mega')
  assert.equal(stones(used), stones(g) - 1)
  assert.ok(used.dex['charizard-megay'])
  // it lasts seven days and then goes
  const later = fold2(withUse([...facts, ...Array.from({ length: 4 }, (_, k) => day(42 + k, {}))], 38, { item: stone, uid: g.partner.uid, what: 'mega', to: 'charizard-megay' }))
  assert.equal(later.display, 'charizard')
  // full momentum still brings Mega on its own, with no stone spent
  const free = fold2(run(40, { gym: 1, code: 1 }))
  assert.equal(free.display, 'charizard-megax')
  assert.equal(stones(free), free.badges.length)
})

test('a stone can choose a branch, or bring a queued Pokemon forward; a use that does not apply keeps the stone', () => {
  const facts = run(45, ALL)
  const g = fold2(facts)
  const eevee = g.queue.find((m) => m.base === 'eevee')
  assert.ok(eevee, 'forty-five perfect days in Kanto catch an Eevee')
  const stone = Object.keys(g.bag).find((k) => g.bag[k] > 0)!
  // choose Flareon now; it still evolves on its own, at its level, once it is the partner
  const picked = fold2(withUse(facts, 44, { item: stone, uid: eevee.uid, what: 'branch', to: 'flareon' }))
  assert.equal(picked.queue.find((m) => m.uid === eevee.uid)!.pick, 'flareon')
  assert.equal(stones(picked), stones(g) - 1)
  const led = fold2(withUse([...facts, ...Array.from({ length: 30 }, (_, k) => day(45 + k, { code: 1, gym: 1, guitar: 1 }))], 44,
    { item: stone, uid: eevee.uid, what: 'branch', to: 'flareon' }, { item: Object.keys(g.bag).find((k) => g.bag[k] > (k === stone ? 1 : 0))!, uid: eevee.uid, what: 'lead' }))
  const now = [led.partner, ...led.graduates].find((m) => m.uid === eevee.uid)!
  assert.deepEqual(now.path.slice(0, 2), ['eevee', 'flareon'])
  assert.ok(led.moments.some((m) => m.kind === 'evolve' && m.form === 'flareon' && m.picked))
  // bringing it forward put the old partner at the front of the queue with its XP
  const swap = fold2(withUse(facts, 44, { item: stone, uid: eevee.uid, what: 'lead' }))
  assert.equal(swap.partner.uid, eevee.uid)
  assert.equal(swap.queue[0].uid, g.partner.uid)
  assert.equal(swap.queue[0].xp, g.partner.xp)
  // junk: a Pokemon that is not there, a branch it does not have, a Mega it does not have, a stone not in the Bag
  const junk = fold2(withUse(facts, 44, { item: stone, uid: 'nobody', what: 'lead' }, { item: stone, uid: eevee.uid, what: 'branch', to: 'raichu' },
    { item: stone, uid: eevee.uid, what: 'mega' }, { item: 'no-such-stone', uid: eevee.uid, what: 'lead' }))
  assert.deepEqual(junk.bag, g.bag)
  assert.equal(junk.partner.uid, g.partner.uid)
})

test('the measured Sleep pillar pays the score, is done at 80, and cannot spoil a perfect day', () => {
  const lib = (tier: string) => ({ tier, spans: [{ from: '1970-01-01', to: null }] })
  const input: FactsInput = {
    today: addDays(V2_START, 1),
    habits: [{ id: 'leetcode-coding', ...lib('pillar') }, { id: 'sleep-before-10', ...lib('core') }],
    ticks: { [V2_START]: { 'sleep-before-10': new Date(V2_START + 'T08:00:00').toISOString() } },
  }
  const sleep = (i: FactsInput, d: string) => buildFacts(i).find((f) => f.day === d)!.habits.find((h) => h.id === 'sleep-before-10')!
  // no band: the hand tick still counts, as a core habit
  assert.deepEqual([sleep(input, V2_START).worth, sleep(input, V2_START).done, sleep(input, V2_START).pillar], [30, true, false])
  // the band reports: a pillar, paid by score, and the tick is ignored
  const band: FactsInput = { ...input, body: { [V2_START]: { sleepScore: 65 }, [addDays(V2_START, 1)]: { sleepScore: 88, steps: 12000, recovery: 70 } } }
  const a = sleep(band, V2_START), b = sleep(band, addDays(V2_START, 1))
  assert.deepEqual([a.worth, a.pillar, a.frac, a.done, a.measured], [100, true, 0.65, false, true])
  assert.deepEqual([b.frac, b.done], [0.88, true])
  const g = foldGame(buildFacts(band))
  assert.equal(g.today.xp, 88)
  assert.equal(g.today.pillars, 1)
  // a poor night, then everything else done: still a perfect day, and the count of what is left leaves sleep out
  const rough: FactsInput = { ...band, ticks: { [V2_START]: { 'leetcode-coding': new Date(V2_START + 'T09:00:00').toISOString() } } }
  const d0 = foldGame(buildFacts(rough)).days.find((d) => d.day === V2_START)!
  assert.deepEqual([d0.perfect, d0.done, d0.total], [true, 1, 1])
  // days before the band's first night keep the old habit
  assert.equal(sleep({ ...band, body: { [addDays(V2_START, 1)]: { sleepScore: 88 } } }, V2_START).pillar, false)
  const s = statsOf(buildFacts(band))
  assert.equal(s.spe, 100)
  assert.equal(s.def, 70)
  assert.equal(s.atk, null) // no gym habit on the list
})

test('every gym leader, in every region', () => {
  assert.equal(LEAGUES.length, 9)
  for (const l of LEAGUES) {
    assert.equal(l.gyms.length, 8)
    assert.equal(l.four.length, 4)
    for (const t of [...l.gyms, ...l.four, l.champion]) assert.ok(t.name && t.type && t.sprite)
  }
  assert.equal(leaderOf(1, 0)?.name, 'Brock')
  assert.equal(leaderOf(1, 11)?.name, 'Lance')
  assert.equal(leaderOf(1, 12)?.name, 'Blue')
})
