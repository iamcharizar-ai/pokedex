// node --test core/
import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, buildFacts, inTime, mondayOf, type DayFacts, type FactsInput, type HabitFact } from './facts.ts'
import { BOSS_HEAL, BOSS_KILL_GEMS, KILL_CAP, bossDayChanged, bossLevel, bossOf, catchChance, memberPower, strikeOf, weekChance, type BossCard, type Member } from './boss.ts'
import { listAdds, listsOf, sleepOf } from './events.ts'
import { happenedAt, inOrder, settled } from './order.ts'
import { foldGame, isGym, leaderOf, statsOf } from './fold.ts'
import { LEAGUES, lineup } from './gyms.ts'
import { beats, weakDomains } from './types.ts'
import {
  BALL_MULT, CLAIM_AUTO, DAILY_PAY, PAY_STREAK, REVIEW_GEMS, EGG_DAYS, GAME_START, GEMS, LEADER_HP, MEGA_BONUS, REPEL_DAYS, SEASON_STEP, SLEEP_DEEP, SLIP, STAKES_FROM, TEAM_BONUS, TEAM_NATURE, TEAM_SIZE, WEAK_MULT, WILD_HP, WILD_STAY,
  ballFor, bondLevel, evolveAt, graduateAt, levelOf, momentumMult, regionsOpen, wildHit, xpForLevel,
} from './rules.ts'
import { BALLS, BOND_PARTY, CHEST, rng, DOMAIN_SHOPS, FEATS, FORGE_COST, GEAR, GEAR_ITEMS, LURES, MART_POOL, SELL, STANDING, forgeShard, lureTypes, martDeals, throwHp } from './economy.ts'
import { SPECIES } from './species.ts'

const H = (id: string, tag: HabitFact['tag'], worth: number, frac: number): HabitFact =>
  ({ id, tag, worth, pillar: worth === 100, frac, done: frac >= 1 })

/** A day described by how much of each thing was done (0..1). `chores` is the share of the ten chores ticked. */
function dayOn(date: string, o: { code?: number; gym?: number; guitar?: number; arbor?: number; sleep?: number; chores?: number } = {}): DayFacts {
  const ticked = Math.round(10 * (o.chores ?? 0))
  return {
    day: date,
    habits: [
      H('leetcode-coding', 'code', 100, o.code ?? 0),
      H('gym', 'fitness', 100, o.gym ?? 0),
      H('woodshed-guitar', 'guitar', 100, o.guitar ?? 0),
      H('arbor-morning', 'arbor', 30, o.arbor ?? 0),
      H('sleep-before-10', 'sleep', 30, o.sleep ?? 0),
      ...Array.from({ length: 10 }, (_, i) => H(`chore-${i}`, 'routine', 1, i < ticked ? 1 : 0)),
    ],
  }
}
const day = (n: number, o: Parameters<typeof dayOn>[1] = {}) => dayOn(addDays(GAME_START, n), o)
/** the older tests judge what a day earns, not when it is collected: everything is paid at once */
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })
const ALL = { code: 1, gym: 1, guitar: 1, arbor: 1, sleep: 1, chores: 1 }
const run = (n: number, o: Parameters<typeof day>[1]) => Array.from({ length: n }, (_, i) => day(i, o))
type G = ReturnType<typeof foldGame>
const caught = (g: G) => g.moments.flatMap((m) => (m.kind === 'catch' ? [m] : []))
const withUse = (facts: DayFacts[], i: number, ...uses: Omit<NonNullable<DayFacts['uses']>[number], 'day'>[]) =>
  facts.map((f, k) => (k === i ? { ...f, uses: uses.map((u) => ({ day: f.day, ...u })) } : f))
const use = (facts: DayFacts[], i: number, ...uses: { what: string; item?: string; uid?: string; to?: string }[]) =>
  withUse(facts, i, ...uses.map((u) => ({ item: u.item ?? '', uid: u.uid ?? '', what: u.what, ...(u.to ? { to: u.to } : {}) })))
const THREE = { code: 1, gym: 1, guitar: 1 }
const PILLARS = { code: 1, gym: 1, guitar: 1, arbor: 1 } // no chores: never a perfect day, so nothing is caught on the spot
const HALF = { code: 1, gym: 1 }
/** four fifths of the day ticked and next to no XP (the ten chores, the morning block, last night's sleep): 90 coins a day, an Ultra Ball, and a leader that hardly moves */
const PAYING = { chores: 1, arbor: 1, sleep: 1 }
/** the same facts with the routines of the Strong workouts finished on day `i` */
const withGear = (facts: DayFacts[], i: number, ...routines: string[]) => facts.map((f, k) => (k === i ? { ...f, marks: { ...f.marks, gear: routines } } : f))
const far = (n: number) => addDays(GAME_START, n)
const ev = (at: string, ins: string | undefined, type = 'tick') => ({ at, inserted_at: ins, type })
function night(n: number, score: number, o: Parameters<typeof day>[1] = {}): DayFacts {
  const d = day(n, o)
  return { ...d, body: { sleepScore: score }, habits: d.habits.map((h) => (h.id === 'sleep-before-10' ? { ...H('sleep-before-10', 'sleep', 100, score / 100), done: score >= 80, measured: true as const } : h)) }
}
/** days around STAKES_FROM, built from real dates so the two weeks of grace can be tested */
const around = (before: number, plan: Parameters<typeof dayOn>[1][]): DayFacts[] => plan.map((o, i) => dayOn(addDays(STAKES_FROM, i - before), o))

// ── version 8: the day, the wild Pokemon, showing up ────────────────────────
test('a pillar outweighs the whole routine', () => {
  const g = fold([day(0, { code: 1 })])
  assert.equal(g.today.xp, 100)
  const r = fold([day(0, { chores: 1 })])
  assert.equal(r.today.xp, 10)
  assert.equal(r.today.counts, false)
})

test('the wild Pokemon is worn down by how many habits were ticked, not by how much they were worth', () => {
  // five of fifteen habits, all chores: the XP share is tiny, the ticked share is a third
  const g = fold([day(0, { chores: 0.5 })])
  assert.equal(g.today.done, 5)
  assert.equal(g.today.total, 15)
  assert.equal(g.today.hit, wildHit(5 / 15, BALL_MULT[ballFor(5 / 15)]))
  assert.ok(g.today.hit > 15)
  // the same number of ticks as pillars does the same to the wild Pokemon, and far more to the leader
  const p = fold([day(0, { code: 1, gym: 1, guitar: 1, arbor: 1, sleep: 1 })])
  assert.equal(p.today.hit, wildHit(5 / 15, BALL_MULT.poke))
  assert.ok(g.today.strike <= 5) // five chores are worth five XP
  assert.ok(p.today.strike > 400)
})

test('the ball is how full the day was, whatever was ticked: one share, one curve', () => {
  assert.deepEqual([0.3, 0.49, 0.5, 0.79, 0.8, 1].map(ballFor), ['poke', 'poke', 'great', 'great', 'ultra', 'ultra'])
  // 12 of 15 habits ticked is an Ultra Ball whether they were chores or pillars
  const chores = fold([day(0, { chores: 1, arbor: 1, sleep: 1 })]), work = fold([day(0, { code: 1, gym: 1, guitar: 1, arbor: 1, chores: 0.8 })])
  assert.deepEqual([chores.today.ball, work.today.ball], ['ultra', 'ultra'])
  assert.equal(chores.today.hit, work.today.hit)
  // 7 of 15 is a Poke Ball even when all of the chores were done
  assert.equal(fold([day(0, { chores: 0.7 })]).today.ball, 'poke')
  assert.equal(fold([day(0, { chores: 1 })]).today.ball, 'great') // 10 of 15
})

test('a run of chore days catches in the end, and a perfect day catches on the spot', () => {
  const slow = fold(run(60, { chores: 0.8 }))
  assert.ok(caught(slow).length >= 2)
  assert.ok(caught(slow).every((c) => c.how === 'worn'))
  const g = fold([day(0, ALL)])
  assert.deepEqual(caught(g).map((c) => c.how), ['perfect'])
})

test('showing up pays coins by how much was ticked', () => {
  assert.deepEqual(DAILY_PAY.map((t) => t.coins), [40, 90, 140])
  const pay = (chores: number, rest = {}) => fold([day(0, { chores, ...rest })]).today.pay
  assert.equal(pay(0), 0)
  assert.equal(pay(0.6, { code: 1, gym: 1 }), 40) // 8 of 15
  assert.equal(pay(0.9, { code: 1, gym: 1, guitar: 1 }), 90) // 12 of 15
  assert.equal(pay(1, ALL), 140)
})

test('only the week has quests, and a week pays on the fifth counting day', () => {
  const g = fold(run(7, PILLARS))
  const quests = g.moments.flatMap((m) => (m.kind === 'quest' ? [m] : []))
  assert.deepEqual(quests.map((q) => q.id), ['five-days'])
  assert.equal(g.quests.weekly.map((q) => q.id).join(), 'five-days,catch')
  assert.ok(!('daily' in g.quests))
  // the day's own reward is its pay, and a perfect day pays gems by itself
  const perfect = fold([day(0, ALL)])
  assert.ok(perfect.wallet.gems >= GEMS.perfect + GEMS.catch)
  assert.equal(perfect.wallet.coins, 140)
})

test('a mark per domain per day, and a day of 10,000 steps pays an extra Iron mark', () => {
  const g = fold(run(5, { code: 1 }))
  assert.equal(g.wallet.marks.code, 5)
  assert.equal(g.wallet.marks.fitness, 0)
  const walk = (steps: number) => run(5, { code: 1 }).map((f) => ({ ...f, body: { steps } }))
  assert.equal(fold(walk(10000)).wallet.marks.fitness - fold(walk(9000)).wallet.marks.fitness, 5)
  assert.equal(fold(walk(10000)).counters.walk, 5)
})

// ── version 8: stakes ───────────────────────────────────────────────────────
test('before the stakes begin an empty day costs nothing', () => {
  // 3 to 11 Oct are before STAKES_FROM: an empty day among them (and its settling) costs nothing
  const facts = [...run(3, THREE), day(3, {}), ...Array.from({ length: 4 }, (_, i) => day(4 + i, THREE))]
  assert.ok(facts[7].day < STAKES_FROM)
  assert.equal(fold(facts).moments.filter((m) => m.kind === 'slip').length, 0)
})

test('an empty day is settled two days later, and a late tick saves it', () => {
  const work = (n: number) => Array.from({ length: n }, () => THREE)
  const empty = around(2, [...work(2), {}, THREE, THREE, THREE])
  const g = fold(empty)
  const slip = g.moments.find((m) => m.kind === 'slip')
  assert.ok(slip && slip.kind === 'slip')
  assert.equal(slip.empty, addDays(STAKES_FROM, 0))
  assert.equal(slip.day, addDays(STAKES_FROM, 2))
  assert.equal(slip.leader, SLIP.leader)
  assert.ok(slip.wild > 0 && slip.xp > 0)
  // the same days with one habit ticked on the empty day (a late tick lands in the facts): nothing to settle
  const saved = around(2, [...work(2), { chores: 0.1 }, THREE, THREE, THREE])
  assert.equal(fold(saved).moments.filter((m) => m.kind === 'slip').length, 0)
  // and today and yesterday are never settled yet
  const fresh = around(2, [...work(2), {}, THREE])
  assert.equal(fold(fresh).moments.filter((m) => m.kind === 'slip').length, 0)
})

test('an empty day costs only what is in progress: the level, caught Pokemon and trained ones stay', () => {
  const plan = [...Array.from({ length: 30 }, () => ALL), {}, ALL, ALL, ALL]
  const before = fold(around(30, plan).slice(0, 31))
  const after = fold(around(30, plan))
  assert.ok(after.level >= before.level)
  assert.ok(after.queue.length + after.graduates.length >= before.queue.length + before.graduates.length)
  assert.deepEqual(after.graduates.map((m) => m.uid).slice(0, before.graduates.length), before.graduates.map((m) => m.uid))
  const slip = after.moments.find((m) => m.kind === 'slip')
  assert.ok(slip && slip.kind === 'slip' && slip.xp >= 0)
})

test('a wild Pokemon that is not caught in time flees, and the next one takes its place', () => {
  const first = fold(run(1, {})).moments.find((m) => m.kind === 'appear')
  assert.ok(first && first.kind === 'appear')
  const stay = WILD_STAY[first.rarity]
  // a day with one habit ticked wears it down by next to nothing and is not an empty day
  const idle = (n: number) => run(n, { chores: 0.1 })
  const there = fold(idle(stay + 5))
  const fled = there.moments.find((m) => m.kind === 'flee')
  assert.ok(fled && fled.kind === 'flee')
  assert.ok(fled.day >= STAKES_FROM)
  assert.equal(fled.day, addDays(GAME_START, stay))
  assert.ok(there.dex[first.form] && !there.dex[first.form].own)
  // before the stakes begin nothing flees
  assert.equal(fold(idle(18)).moments.filter((m) => m.kind === 'flee').length, 0)
})

test('Max Repel keeps a wild Pokemon longer, once; both guards are always on the Mart shelf', () => {
  const buy = (item: string) => ({ item, uid: '', what: 'buy', to: 'mart' })
  const facts = around(2, Array.from({ length: 24 }, () => PAYING))
  const g = fold(withUse(facts, 12, buy('max-repel'), buy('revive')))
  assert.equal(g.inv['max-repel'], 1)
  assert.equal(g.inv['revive'], 1)
  assert.deepEqual(STANDING.map((o) => o.item).slice(0, 2), ['max-repel', 'revive'])
  // a day on which a wild Pokemon is still standing after the day's hit
  const k = facts.findIndex((_, i) => i >= 12 && (() => { const w = fold(facts.slice(0, i + 1)).wild; return Boolean(w && !w.caught) })())
  assert.ok(k >= 12)
  const repel = withUse(facts.slice(0, k + 1), k, buy('max-repel'), { item: 'max-repel', uid: '', what: 'repel' })
  assert.equal(fold(repel).wild?.repel, REPEL_DAYS)
  assert.equal(fold(repel).inv['max-repel'] ?? 0, 0)
})

test('a Revive undoes the HP the leader won back on an empty day, and stays in the Bag when there is nothing to undo', () => {
  const plan = Array.from({ length: 14 }, (_, i) => (i === 3 ? {} : PAYING))
  const facts = around(2, plan)
  const plain = fold(facts)
  assert.equal(plain.league.slipped, SLIP.leader)
  const g = fold(withUse(facts, 13, { item: 'revive', uid: '', what: 'buy', to: 'mart' }, { item: 'revive', uid: '', what: 'revive' }))
  assert.equal(g.league.slipped, 0)
  assert.equal(plain.league.hp - g.league.hp, SLIP.leader)
  const none = fold(withUse(around(2, Array.from({ length: 14 }, () => PAYING)), 13, { item: 'revive', uid: '', what: 'buy', to: 'mart' }, { item: 'revive', uid: '', what: 'revive' }))
  assert.equal(none.inv['revive'], 1)
})

// ── the team, the Mart, mastery ─────────────────────────────────────────────
test('a party of six: the partner and five trained Pokemon behind it, each adding to every strike and more to what its nature raised', () => {
  assert.equal(TEAM_SIZE, 5)
  assert.deepEqual([TEAM_BONUS, TEAM_NATURE], [0.02, 0.03])
  const g = fold(run(400, ALL))
  assert.ok(g.team.length > 0 && g.team.length <= 5)
  // each member adds TEAM_BONUS, plus BOND_PARTY for every bond level its hearts reached
  const hearts = (m: (typeof g.team)[number]) => (m.together ?? 0) + (m.fed ?? 0)
  assert.ok(Math.abs(g.power.team - g.team.reduce((sum, m) => sum + TEAM_BONUS + BOND_PARTY * bondLevel(hearts(m)), 0)) < 1e-9)
  assert.ok(g.team.some((m) => bondLevel(hearts(m)) > 0), 'a trained Pokemon keeps its bond for the party')
  for (const t of ['code', 'fitness', 'guitar', 'arbor', 'sleep', 'routine'] as const)
    assert.equal(g.power.domain[t].nature, TEAM_NATURE * g.team.filter((m) => m.nature?.up === t).length, t)
  // the type of a team member no longer matters: the bonus is the same for any leader
  assert.equal(fold(run(400, ALL)).power.team, g.power.team)
})

test('every strike bonus is added and applied once, and the sum is shown', () => {
  const none = fold(run(1, { gym: 1 }))
  assert.deepEqual([none.power.team, none.power.bond, none.power.mega, none.power.item], [0, 0, 0, 0])
  assert.equal(none.today.strike, Math.round(100 * (none.league.weak.includes('fitness') ? WEAK_MULT : 1) * (none.league.edge ? 1.2 : 1)))
  // a held item adds to its own work only, and the Life Orb to all of it
  const buy = (n: number) => withUse(run(14, { gym: 1 }), n, { item: 'muscle-band', uid: '', what: 'buy', to: 'fitness' }, { item: 'muscle-band', uid: '', what: 'hold', to: 'muscle-band' })
  const held = fold(buy(12))
  assert.equal(held.power.domain.fitness.held, 0.15)
  assert.equal(held.power.domain.code.held, 0)
  assert.equal(MEGA_BONUS, 0.1)
})

test('the Mart: three deals a day, the same on every device, and the guards and chore TMs always', () => {
  const g = fold(run(2, THREE))
  assert.equal(g.mart.deals.length, 3)
  assert.deepEqual(g.mart.deals, martDeals(g.today.day, 3))
  assert.ok(MART_POOL.some((o) => o.item === 'net-ball') && MART_POOL.some((o) => o.item === 'sea-incense'))
  assert.deepEqual(g.mart.standing.map((o) => o.item), ['max-repel', 'revive', 'tm-water', 'tm-ice', 'tm-bug', 'tm-poison'])
  assert.deepEqual(DOMAIN_SHOPS.arbor.stock.filter((o) => o.item.startsWith('tm-')).map((o) => o.item), ['tm-grass'])
  assert.deepEqual(DOMAIN_SHOPS.sleep.stock.filter((o) => o.item.startsWith('tm-')).map((o) => o.item), ['tm-dark'])
})

test('marks buy a domain level', () => {
  const facts = run(10, { code: 1 })
  const trained = fold(use(facts, 9, { what: 'train', to: 'code' }))
  assert.equal(trained.mastery.code, 1)
  assert.equal(trained.wallet.marks.code, fold(facts).wallet.marks.code - 4)
})

test('a berry is a heart, and hearts raise the bond', () => {
  const g = fold(use(run(3, PILLARS), 1, { what: 'buy', item: 'oran-berry', to: 'mart' }, { what: 'feed', item: 'oran-berry' }))
  assert.equal(g.bond.mult, 1 + 0.05 * g.bond.level)
})

// ── carried over from the earlier rules, still true ─────────────────────────
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
  // a list written again during its own day only adds to the earlier one
  const evs = [
    { type: 'day_list', day: GAME_START, at: '1', payload: { habits: JSON.stringify([{ id: 'a', tier: 'pillar' }]) } },
    { type: 'day_list', day: GAME_START, at: '2', payload: { habits: JSON.stringify([{ id: 'b', tier: 'core' }]) } },
    { type: 'day_list', day: 'x', at: '3', payload: { habits: '{broken' } },
  ]
  assert.deepEqual(listsOf(evs), { [GAME_START]: [{ id: 'a', tier: 'pillar' }, { id: 'b', tier: 'core' }] })
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

test('every entry in the species table can be reached', async () => {
  const { auditDex } = await import('../tools/audit-dex.mjs')
  const a = auditDex()
  assert.deepEqual(a.unreachable, [])
  assert.deepEqual(a.byChoiceOnly, ['glaceon'])
})

test('Life OS runs the same core', { skip: !fs.existsSync(new URL('../../lifeos/src/game-core', import.meta.url)) }, () => {
  const read = (u: URL) => fs.readFileSync(u, 'utf8').replace(/\r\n/g, '\n')
  for (const f of ['rules.ts', 'facts.ts', 'fold.ts', 'order.ts', 'species.ts', 'gyms.ts', 'events.ts', 'types.ts', 'economy.ts', 'boss.ts'])
    assert.ok(read(new URL(`../../lifeos/src/game-core/${f}`, import.meta.url)) === read(new URL(`./${f}`, import.meta.url)), `${f} differs: run npm run core`)
})

// ── version 6 ────────────────────────────────────────────────────────────────

test('balls have conditions', () => {
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

test('a TM counts as one of the partner types against a leader', () => {
  const leader = leaderOf(0, 0)!
  assert.equal(leader.type, 'Rock')
  const facts = run(7, { arbor: 1 })
  const plain = fold(facts)
  assert.equal(plain.league.edge, false) // Fire does not beat Rock
  const equipped = fold(withUse(facts, 6, { item: 'tm-grass', uid: '', what: 'buy', to: 'arbor' }, { item: '', uid: '', what: 'move', to: 'tm-grass' }))
  assert.equal(equipped.league.edge, true) // Grass does
  assert.deepEqual(equipped.partner.moves, ['tm-grass'])
  // one that is not owned is ignored
  assert.equal(fold(withUse(facts, 6, { item: '', uid: '', what: 'move', to: 'tm-grass' })).partner.moves, undefined)
  // a TM is bought once
  const twice = fold(withUse(run(14, { arbor: 1 }), 13, { item: 'tm-grass', uid: '', what: 'buy', to: 'arbor' }, { item: 'tm-grass', uid: '', what: 'buy', to: 'arbor' }))
  assert.equal(twice.inv['tm-grass'], 1)
})

test('a domain incense offers three of that domain\'s types, and the one picked is the next wild Pokemon', () => {
  const facts = run(8, ALL) // a perfect day catches on the spot, so a new wild Pokemon appears each morning
  const g = fold(withUse(facts, 2, { item: 'odd-incense', uid: '', what: 'buy', to: 'code' }))
  const options = g.wish.options['odd-incense']
  assert.equal(options.length, 3)
  for (const f of options) {
    const t = SPECIES[f]
    assert.ok(lureTypes('code').includes(t.t) || (t.t2 !== undefined && lureTypes('code').includes(t.t2)), `${f} is ${t.t}`)
  }
  // all of the incense in the game are one mechanic, and each has its own three
  assert.deepEqual(Object.keys(g.wish.options).sort(), ['full-incense', ...Object.keys(LURES)].sort())
  const want = fold(run(3, ALL)).wish.options['odd-incense'][1]
  const picked = fold(withUse(facts, 2, { item: 'odd-incense', uid: '', what: 'buy', to: 'code' }, { item: 'odd-incense', uid: '', what: 'wish', to: fold(facts.slice(0, 3)).wish.options['odd-incense'][1] }))
  assert.equal(picked.inv['odd-incense'] ?? 0, 0)
  assert.equal(picked.moments.filter((m) => m.kind === 'appear' && m.day > facts[2].day)[0].form, fold(facts.slice(0, 3)).wish.options['odd-incense'][1])
  assert.ok(want)
  // one that is not among the three is ignored, and the incense is kept
  const junk = fold(withUse(facts, 2, { item: 'odd-incense', uid: '', what: 'buy', to: 'code' }, { item: 'odd-incense', uid: '', what: 'wish', to: 'mewtwo' }))
  assert.deepEqual([junk.inv['odd-incense'], junk.wish.chosen], [1, null])
})

test('the Professor pays coins by rarity, and gems for nothing', () => {
  const facts = run(6, ALL)
  const g = fold(facts)
  const box = g.queue[0]
  assert.ok(box)
  const sold = fold(withUse(facts, 5, { item: '', uid: box.uid, what: 'transfer' }))
  assert.equal(sold.wallet.coins - g.wallet.coins, SELL[SPECIES[box.form].r ?? 'C'])
  assert.equal(sold.wallet.gems, g.wallet.gems)
})

test('every shop sells whole prices of things the table knows', () => {
  for (const s of Object.values(DOMAIN_SHOPS)) for (const o of s.stock) assert.ok(o.item && Number.isInteger(o.marks) && o.marks! > 0, o.item)
  for (const o of MART_POOL) assert.ok(Number.isInteger(o.coins) && o.coins! > 0)
})

// ── the Farm ─────────────────────────────────────────────────────────────────

test('sleep: a morning with no reading is a hand tick worth a core habit, and a reading replaces it', () => {
  const lib = (tier: string) => ({ tier, spans: [{ from: '1970-01-01', to: null }] })
  const d1 = GAME_START, d2 = addDays(GAME_START, 1)
  const input = (ticked: boolean, body: FactsInput['body']): FactsInput => ({
    today: d2,
    habits: [{ id: 'leetcode-coding', ...lib('pillar') }, { id: 'sleep-before-10', ...lib('core') }],
    ticks: ticked ? { [d2]: { 'sleep-before-10': new Date(d2 + 'T08:00:00').toISOString() } } : {},
    body,
  })
  const sleep = (i: FactsInput, d: string) => buildFacts(i).find((f) => f.day === d)!.habits.find((h) => h.id === 'sleep-before-10')!
  // the band has reported on the first day; the second morning has no reading yet
  const waiting = input(false, { [d1]: { sleepScore: 85 } })
  const w = sleep(waiting, d2)
  assert.deepEqual([w.worth, w.pillar, w.frac, w.done, w.measured, w.selfReported], [30, false, 0, false, undefined, true])
  // it can be ticked by hand meanwhile, and pays a core habit
  const ticked = sleep(input(true, { [d1]: { sleepScore: 85 } }), d2)
  assert.deepEqual([ticked.worth, ticked.pillar, ticked.frac, ticked.done], [30, false, 1, true])
  // the reading arrives: the tick is ignored and the score is paid
  const read = sleep(input(true, { [d1]: { sleepScore: 85 }, [d2]: { sleepScore: 70 } }), d2)
  assert.deepEqual([read.worth, read.pillar, read.frac, read.done, read.measured, read.selfReported], [100, true, 0.7, false, true, undefined])
  // nothing is self-reported when no band is in use
  assert.equal(sleep(input(false, {}), d2).selfReported, undefined)
})

test('sleep: Bells come from measured nights only, two for a deep night', () => {
  const marks = (facts: DayFacts[]) => fold(facts).wallet.marks.sleep
  assert.equal(marks([night(0, 70)]), 0)
  assert.equal(marks([night(0, 80)]), 1)
  assert.equal(marks([night(0, SLEEP_DEEP - 1)]), 1)
  assert.equal(marks([night(0, SLEEP_DEEP)]), 2)
  assert.equal(marks([night(0, 85), night(1, 95), night(2, 60)]), 3)
  // a plain hand tick is not a measured night: no Bell, no sleep run, no sleep days
  const ticked = fold(run(10, { sleep: 1 }))
  assert.equal(ticked.wallet.marks.sleep, 0)
  assert.equal(ticked.counters['days:sleep'] ?? 0, 0)
  // measured good nights are a run
  const measured = fold(Array.from({ length: 7 }, (_, i) => night(i, 88)))
  assert.deepEqual(measured.runs.sleep, { cur: 7, best: 7 })
  assert.ok(measured.feats.some((f) => f.id === 'run7-sleep'))
})

test('sleep: HP is the average of measured nights, and a night with no reading is left out', () => {
  const facts = [night(0, 90), day(1, {}), night(2, 70)]
  assert.equal(statsOf(facts).hp, 80)
  // before any reading it is still the share of the hand-ticked habit
  assert.equal(statsOf(run(2, { sleep: 1 })).hp, 100)
  assert.equal(statsOf(run(2, {})).hp, 0)
})

test('sleep: the game says what last night was', () => {
  assert.deepEqual(fold(run(1, {})).sleep, { band: false, state: 'off', score: null, xp: 0 })
  const measured = fold([night(0, 84)])
  assert.deepEqual(measured.sleep, { band: true, state: 'measured', score: 84, xp: 84 })
  // the band was in use, and the next morning is still waiting for its reading
  const waiting = { ...day(1, {}), habits: day(1, {}).habits.map((h) => (h.id === 'sleep-before-10' ? { ...h, worth: 30, pillar: false, selfReported: true as const } : h)) }
  assert.deepEqual(fold([night(0, 84), waiting]).sleep, { band: true, state: 'self', score: null, xp: 0 })
})

test('sleep: the night is read from the ledger with its bed and wake times', () => {
  const ev = (day: string, payload: Record<string, unknown>, at = `${day}T07:00:00Z`) => ({ type: 'vitals', day, at, payload })
  const nights = sleepOf([
    ev('2026-10-08', { bed: '2026-10-07T23:40', wake: '2026-10-08T06:52', sleepMin: 412, awakeMin: 25, deepMin: 70, remMin: 95, lightMin: 247, steps: 4000 }),
    ev('2026-10-08', { sleepScore: 84 }, '2026-10-08T07:01:00Z'),
    ev('2026-10-09', { steps: 5000 }), // nothing about sleep: not a night
    ev('2026-10-10', { sleepMin: 300, sleepScore: 60 }),
    ev('2026-10-10', { sleepScore: null }, '2026-10-10T08:00:00Z'), // taken back
  ])
  assert.deepEqual(nights['2026-10-08'], { day: '2026-10-08', bed: '2026-10-07T23:40', wake: '2026-10-08T06:52', sleepMin: 412, awakeMin: 25, deepMin: 70, remMin: 95, lightMin: 247, score: 84 })
  assert.equal(nights['2026-10-09'], undefined)
  assert.deepEqual(nights['2026-10-10'], { day: '2026-10-10', sleepMin: 300 })
})

// ── version 7: stakes ───────────────────────────────────────────────────────
test('buy a ball, throw it, and the wild Pokemon loses that much at once', () => {
  const facts = run(30, PAYING) // 90 coins a day for showing up
  // a day on which the Mart has a ball we can pay for, and a wild Pokemon is still standing after the day
  const afford = (i: number) => {
    const g = fold(facts.slice(0, i + 1))
    return martDeals(facts[i].day).find((o) => BALLS[o.item] && o.coins! <= g.wallet.coins) && g.wild && !g.wild.caught
  }
  const k = facts.findIndex((_, i) => i >= 6 && afford(i))
  assert.ok(k >= 6)
  const upto = facts.slice(0, k + 1)
  const base = fold(upto)
  const deal = martDeals(upto[k].day).find((o) => BALLS[o.item] && o.coins! <= base.wallet.coins)!
  assert.ok(base.wild && !base.wild.caught)
  const buy = { what: 'buy', item: deal.item, to: 'mart' }
  const bought = fold(use(upto, k, buy))
  assert.equal(bought.inv[deal.item], (base.inv[deal.item] ?? 0) + 1)
  assert.equal(bought.wallet.coins, base.wallet.coins - deal.coins!)
  // cannot throw what is not held
  assert.equal(fold(use(upto, k, { what: 'throw', item: 'master-ball' })).wild!.hp, base.wild.hp)
  const thrown = fold(use(upto, k, buy, { what: 'throw', item: deal.item }))
  const r = SPECIES[base.wild.form]
  const hp = Math.min(base.wild.hp, throwHp(deal.item, { types: [r.t, r.t2], from: base.wild.from, owned: Boolean(base.dex[base.wild.form]?.own) }, upto[k].day))
  assert.equal(thrown.wild!.hp, base.wild.hp - hp)
  assert.equal(thrown.inv[deal.item], base.inv[deal.item] ?? 0)
  assert.equal(thrown.today.hit, base.today.hit + hp)
  assert.equal(thrown.partner.xp, base.partner.xp) // throwing gives no XP
})

test('the Mart no longer sells the Poke Ball', () => {
  assert.ok(!MART_POOL.some((o) => o.item === 'poke-ball'))
  assert.ok(MART_POOL.every((o) => BALLS[o.item]?.hp !== 20))
})

test('a berry is a heart, hearts raise the bond, and the Professor pays coins for a Box Pokemon', () => {
  const facts = run(4, ALL) // four perfect days: four in the Box, and Sprouts to spend
  const g = fold(facts)
  assert.equal(g.queue.length, 4)
  const fed = fold(use(facts, 3, { what: 'buy', item: 'sitrus-berry', to: 'arbor' }, { what: 'feed', item: 'sitrus-berry' }))
  assert.deepEqual([fed.partner.fed, fed.inv['sitrus-berry']], [3, 0])
  assert.deepEqual([bondLevel(9), bondLevel(10), bondLevel(60)], [0, 1, 3])
  const sent = fold(use(facts, 3, { what: 'transfer', uid: g.queue[1].uid }, { what: 'transfer', uid: 'nobody' }))
  assert.deepEqual(sent.queue.map((m) => m.uid), [g.queue[0].uid, g.queue[2].uid, g.queue[3].uid])
  assert.equal(sent.wallet.coins, g.wallet.coins + SELL[SPECIES[g.queue[1].form].r ?? 'C'])
  // the partner cannot be sent away
  assert.equal(fold(use(facts, 3, { what: 'transfer', uid: g.partner.uid })).partner.uid, g.partner.uid)
})

test('Full Incense chooses the next wild Pokemon from three of any type', () => {
  const facts = run(20, ALL) // plenty of gems; a catch every day
  const g = fold(facts.slice(0, 19))
  assert.equal(g.wish.options['full-incense'].length, 3)
  const want = g.wish.options['full-incense'][2]
  const wished = fold(use(facts, 18, { what: 'buy', item: 'full-incense', to: 'rare' }, { what: 'wish', item: 'full-incense', to: want }, { what: 'wish', item: 'full-incense', to: g.wish.options['full-incense'][0] }))
  assert.equal(wished.moments.filter((m) => m.kind === 'appear').at(-1)!.form, want)
  assert.equal(wished.inv['full-incense'], 0)
  // something that is not one of the three is ignored and the incense is kept
  const junk = fold(use(facts.slice(0, 19), 18, { what: 'buy', item: 'full-incense', to: 'rare' }, { what: 'wish', item: 'full-incense', to: 'mewtwo' }))
  assert.deepEqual([junk.inv['full-incense'], junk.wish.chosen], [1, null])
})

test('Strong\'s training gear: each routine drops its own piece, and one of all seven forges a Red Shard', () => {
  assert.equal(GEAR_ITEMS.length, 7)
  const routines = Object.keys(GEAR)
  const facts = run(10, {})
  // the same routine seven times is seven of one piece and no shard
  const same = fold(routines.length ? routines.map((_, i) => i).reduce((f, i) => withGear(f, i, 'd1-chest-delts'), facts) : facts)
  assert.equal(same.inv['protector'], 7)
  assert.equal(same.inv['red-shard'] ?? 0, 0)
  // a routine of your own drops nothing
  assert.equal(fold(withGear(facts, 0, 'my-routine')).inv['protector'] ?? 0, 0)
  // seven different ones, on seven days: a Red Shard, and the pieces are used up
  const cycle = routines.reduce((f, r, i) => withGear(f, i, r), facts)
  const g = fold(cycle)
  assert.equal(g.inv['red-shard'], 1)
  assert.ok(GEAR_ITEMS.every((i) => (g.inv[i] ?? 0) === 0))
  assert.equal(g.counters.sets, 1)
  assert.ok(g.moments.some((m) => m.kind === 'kit' && m.n === 1))
  assert.equal(g.moments.filter((m) => m.kind === 'gear').length, 7)
  // an eighth piece carries over to the next set
  const more = fold(withGear(cycle, 8, 'd3-legs'))
  assert.deepEqual([more.inv['red-shard'], more.inv['power-anklet']], [1, 1])
  // two workouts on one day count as two
  assert.equal(fold(withGear(facts, 0, 'd1-chest-delts', 'd2-lats-biceps')).inv['silver-wing'], 1)
})

test('feats say each thing once: no 25 or 250 day totals, and the gym pays red shards through the kit', () => {
  const ids = FEATS.map((f) => f.id)
  assert.ok(!ids.some((id) => /^days(25|250)-/.test(id)) && !ids.includes('work60'))
  const hundred = FEATS.find((f) => f.id === 'days100-fitness')!
  assert.deepEqual(hundred.reward.items ?? {}, {})
  assert.ok(FEATS.find((f) => f.id === 'days100-code')!.reward.items?.['blue-shard'])
})

test('the team backs the partner, and a theme is bought once', () => {
  const facts = run(260, THREE)
  const g = fold(facts)
  assert.ok(g.graduates.length >= 3)
  assert.deepEqual(g.team.map((m) => m.uid), g.graduates.slice(-TEAM_SIZE).reverse().map((m) => m.uid)) // left alone: the last six trained
  // no team at all never hits harder than the one you have
  const none = fold(use(facts, 60, { what: 'team', to: '' }))
  const sum = (x: G) => x.days.reduce((s, d) => s + d.strike, 0)
  assert.ok(sum(none) <= sum(g))
  assert.equal(none.team.length, 0)
  const picked = fold(use(facts, 259, { what: 'team', to: `${g.graduates[0].uid},nobody,${g.graduates[0].uid}` }))
  assert.deepEqual(picked.team.map((m) => m.uid), [g.graduates[0].uid])
  // a theme: bought once, then worn; one that is not owned is not worn
  const themed = fold(use(facts, 259, { what: 'buy', item: 'theme-cave' }, { what: 'buy', item: 'theme-cave' }, { what: 'theme', to: 'theme-cave' }))
  assert.deepEqual([themed.inv['theme-cave'], themed.theme, themed.wallet.gems], [1, 'theme-cave', g.wallet.gems - 60])
  assert.equal(fold(use(facts, 259, { what: 'theme', to: 'theme-beach' })).theme, '')
})

test('the season is a ladder climbed by the work of the month', () => {
  // 300 XP of work a day: a step every five days
  const g = fold(run(12, THREE))
  const steps = g.moments.flatMap((m) => (m.kind === 'season' ? [m] : []))
  assert.deepEqual(steps.map((m) => m.step), [1, 2])
  assert.deepEqual([steps[0].coins, steps[1].item], [100, 'great-ball'])
  assert.equal(g.inv['great-ball'], 1)
  assert.deepEqual([g.season.step, g.season.into, g.season.need, g.season.next], [2, 600, SEASON_STEP, { gems: 10 }])
  // a new month starts the ladder again, and keeps what was handed over
  const long = fold(run(40, THREE)) // 3 Oct to 11 Nov
  assert.equal(long.season.month, '2026-11')
  assert.equal(long.season.step, Math.floor((11 * 300) / SEASON_STEP))
  assert.ok(long.moments.filter((m) => m.kind === 'season').length > long.season.step)
})

test('a Rare Egg is kept warm by days with two pillars, and hatches into the Box', () => {
  const facts = run(40, ALL) // gems from a catch a day
  const base = fold(facts.slice(0, 30))
  assert.ok(base.wallet.gems >= 150)
  assert.equal(base.egg, null)
  const bought = (n: number) => fold(use(facts.slice(0, n), 29, { what: 'buy', item: 'rare-egg' }))
  assert.deepEqual(bought(30).egg, { have: 0, need: EGG_DAYS })
  assert.deepEqual(bought(33).egg, { have: 3, need: EGG_DAYS })
  const hatched = bought(36)
  assert.equal(hatched.egg, null)
  const h = hatched.moments.find((m) => m.kind === 'hatch')!
  assert.ok(h.kind === 'hatch' && h.day === far(34))
  const mon = hatched.queue.find((m) => m.uid === h.uid)!
  assert.deepEqual([mon.origin, SPECIES[mon.form].r], ['egg', 'R'])
})

test('a chest is opened as it is bought, and holds the same thing on every device', () => {
  const facts = run(40, ALL)
  const base = fold(facts)
  const opened = (n: number) => fold(use(facts, 39, ...Array.from({ length: n }, () => ({ what: 'buy', item: 'chest' }))))
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

test('the Mart shows the same three on every device and sells each once a day', () => {
  const d = addDays(GAME_START, 40)
  assert.deepEqual(martDeals(d), martDeals(d))
  assert.equal(martDeals(d).length, 3)
  assert.equal(martDeals(d, 4).length, 4)
  assert.ok(martDeals(d).every((o) => MART_POOL.some((p) => p.item === o.item)))
  const facts = run(8, ALL)
  const deal = martDeals(facts[7].day).sort((a, b) => (a.coins ?? 0) - (b.coins ?? 0))[0]
  const base = fold(facts).wallet.coins
  const once = fold(withUse(facts, 7, { item: deal.item, uid: '', what: 'buy', to: 'mart' }))
  assert.equal(once.wallet.coins, base - deal.coins!)
  assert.equal(once.inv[deal.item], (fold(facts).inv[deal.item] ?? 0) + 1)
  assert.deepEqual(once.mart.bought, [deal.item])
  const twice = fold(withUse(facts, 7, { item: deal.item, uid: '', what: 'buy', to: 'mart' }, { item: deal.item, uid: '', what: 'buy', to: 'mart' }))
  assert.equal(twice.inv[deal.item], once.inv[deal.item])
  // something not in today's deals cannot be bought
  const off = MART_POOL.find((p) => !martDeals(facts[7].day).some((o) => o.item === p.item))!
  assert.equal(fold(withUse(facts, 7, { item: off.item, uid: '', what: 'buy', to: 'mart' })).inv[off.item] ?? 0, 0)
})

test('a coding day pays a mark, a run forgives one rest day but not two, and the shop takes marks', () => {
  const g = fold(run(5, { code: 1 }))
  assert.equal(g.wallet.marks.code, 5)
  assert.deepEqual(g.runs.code, { cur: 5, best: 5 })
  // a rest day inside a run is forgiven
  const gap = [day(0, { code: 1 }), day(1, { code: 1 }), day(2, {}), day(3, { code: 1 }), day(4, { code: 1 })]
  assert.deepEqual(fold(gap).runs.code, { cur: 4, best: 4 })
  // two in a row end it, and nothing earned is taken back
  const ended = fold([day(0, { code: 1 }), day(1, { code: 1 }), day(2, {}), day(3, {}), day(4, { code: 1 }), day(5, { code: 1 })])
  assert.deepEqual(ended.runs.code, { cur: 2, best: 2 })
  assert.equal(ended.wallet.marks.code, 4)
  // six marks buy a Quick Ball in the code shop
  const bought = fold(withUse(run(7, { code: 1 }), 6, { item: 'quick-ball', uid: '', what: 'buy', to: 'code' }))
  assert.deepEqual([bought.inv['quick-ball'], bought.wallet.marks.code], [1, 1])
  // not with too few
  assert.equal(fold(withUse(run(3, { code: 1 }), 2, { item: 'quick-ball', uid: '', what: 'buy', to: 'code' })).inv['quick-ball'] ?? 0, 0)
  // and the gym shop does not take Machine Parts
  assert.equal(fold(withUse(run(7, { code: 1 }), 6, { item: 'heavy-ball', uid: '', what: 'buy', to: 'fitness' })).inv['heavy-ball'] ?? 0, 0)
})

test('a feat pays once, and the Key Stone is one of them', () => {
  const g = fold(run(7, HALF))
  assert.ok(g.feats.some((f) => f.id === 'work7'))
  // one kind of work alone is enough
  assert.ok(fold(run(7, { code: 1 })).inv['key-stone'])
  assert.equal(fold(run(6, { code: 1 })).inv['key-stone'] ?? 0, 0)
  assert.equal(g.inv['key-stone'], 1)
  assert.equal(g.keyStone, g.feats.find((f) => f.id === 'work7')!.day)
  assert.equal(g.moments.filter((m) => m.kind === 'key').length, 1)
  // a seven-day coding run also pays a blue shard, and nothing is paid twice
  assert.equal(g.inv['blue-shard'], 1)
  const more = fold(run(12, HALF))
  assert.equal(more.feats.filter((f) => f.id === 'work7').length, 1)
  assert.equal(more.inv['key-stone'], 1)
  // every feat has a counter it can be reached by
  for (const f of FEATS) assert.ok(f.n > 0 && f.key, f.id)
  assert.equal(new Set(FEATS.map((f) => f.id)).size, FEATS.length)
  // the eighth badge no longer hands over a Key Stone: there is still one, and it came from the feat
  assert.equal(fold(run(120, THREE)).moments.filter((m) => m.kind === 'key').length, 1)
})

test('a held item makes its domain strike harder, and nothing else', () => {
  const facts = run(14, { guitar: 1 })
  const buy = withUse(facts, 12, { item: 'soothe-bell', uid: '', what: 'buy', to: 'guitar' }, { item: 'soothe-bell', uid: '', what: 'hold', to: 'soothe-bell' })
  const g = fold(buy), plain = fold(facts)
  assert.equal(g.partner.held, 'soothe-bell')
  // the bond and mastery multipliers also round, so allow a point either way
  assert.ok(Math.abs(g.days[13].strike - Math.round(plain.days[13].strike * 1.15)) <= 1)
  assert.equal(g.days[13].xp, plain.days[13].xp)
  // it comes off, and goes back in the bag
  const off = fold(withUse(buy, 13, { item: '', uid: '', what: 'hold', to: '' }))
  assert.equal(off.partner.held, undefined)
  assert.equal(off.inv['soothe-bell'], 1)
  // a code habit is not helped by a gym item, and a gym item cannot be bought with code marks
  const c = fold(withUse(run(14, { code: 1 }), 12, { item: 'soothe-bell', uid: '', what: 'buy', to: 'guitar' }))
  assert.equal(c.partner.held, undefined)
})

test('a once-only held item cannot be bought again while it is worn', () => {
  const facts = run(14, { guitar: 1 })
  const worn = fold(withUse(facts, 12, { item: 'soothe-bell', uid: '', what: 'buy', to: 'guitar' }, { item: 'soothe-bell', uid: '', what: 'hold', to: 'soothe-bell' }))
  const again = fold(withUse(facts, 12, { item: 'soothe-bell', uid: '', what: 'buy', to: 'guitar' }, { item: 'soothe-bell', uid: '', what: 'hold', to: 'soothe-bell' }, { item: 'soothe-bell', uid: '', what: 'buy', to: 'guitar' }))
  assert.equal(again.inv['soothe-bell'] ?? 0, 0)
  assert.equal(again.partner.held, 'soothe-bell')
  assert.equal(again.wallet.marks.guitar, worn.wallet.marks.guitar)
})

test('a Mega Stone is forged from shards, and nothing makes one by itself', () => {
  assert.equal(forgeShard(2, 0, undefined, { 'red-shard': 3 }), 'red-shard')
  assert.equal(forgeShard(2, 0, undefined, { 'blue-shard': 9 }), null)
  assert.equal(forgeShard(2, 1, undefined, { 'yellow-shard': 3 }), 'yellow-shard')
  assert.equal(forgeShard(1, 0, 'arbor', { 'green-shard': 3, 'red-shard': 3 }), 'green-shard')
  assert.equal(forgeShard(1, 0, undefined, { 'blue-shard': 2 }), null)
  const facts = run(900, THREE)
  const g = fold(facts)
  assert.ok(g.keyStone)
  const grads = g.graduates.filter((m) => (SPECIES[m.form].m?.length ?? 0) > 0)
  assert.ok(grads.length >= 1, 'a Pokemon with a Mega form finished training')
  assert.ok(g.graduates.every((m) => !m.megas), 'no badge or graduation registers a Mega any more')
  const m = grads[0]
  const form = SPECIES[m.form].m![0]
  const forged = fold(withUse(facts, 899, { item: '', uid: m.uid, what: 'forge', to: form }))
  const mon = forged.graduates.find((x) => x.uid === m.uid)!
  assert.deepEqual(mon.megas, [form])
  const shard = SPECIES[m.form].m!.length > 1 ? 'red-shard' : forgeShard(1, 0, mon.nature?.up, g.inv)!
  assert.equal(g.inv[shard] - forged.inv[shard], FORGE_COST)
  assert.ok(forged.feats.some((f) => f.id === 'mega1'))
  // forging it twice costs nothing the second time
  const again = fold(withUse(facts, 899, { item: '', uid: m.uid, what: 'forge', to: form }, { item: '', uid: m.uid, what: 'forge', to: form }))
  assert.equal(again.inv[shard], forged.inv[shard])
  // a form it does not have cannot be forged
  assert.equal(fold(withUse(facts, 899, { item: '', uid: m.uid, what: 'forge', to: 'missingno' })).graduates.find((x) => x.uid === m.uid)!.megas, undefined)
})


test('a month-end review pays a Comet Shard, found by the day it was ticked, and it forges any Mega', () => {
  const facts = buildFacts({ habits: [], ticks: { '2026-09-01': { 'month-review': '2026-10-05T09:00:00' } }, today: '2026-10-06' })
  assert.equal(facts.find((f) => f.day === '2026-10-05')?.reviews, 1)
  assert.equal(facts.find((f) => f.day === '2026-10-04')?.reviews, undefined)
  const g = fold(facts)
  assert.equal(g.inv['comet-shard'], 1)
  assert.deepEqual(g.moments.filter((m) => m.kind === 'review').map((m) => m.day), ['2026-10-05'])
  assert.equal(forgeShard(2, 0, undefined, { 'comet-shard': FORGE_COST }), 'comet-shard')
  assert.equal(forgeShard(2, 0, undefined, { 'red-shard': FORGE_COST, 'comet-shard': FORGE_COST }), 'red-shard')
  assert.equal(forgeShard(1, 0, undefined, { 'comet-shard': FORGE_COST - 1 }), null)
})

test('rewards wait to be collected: a claim pays them, and an unclaimed one pays itself after CLAIM_AUTO days', () => {
  const facts = run(2, ALL)
  const g = foldGame(facts)
  const keys = g.held.map((h) => h.key)
  assert.ok(keys.includes(`pay:${facts[1].day}`), 'the showing-up pay is held')
  assert.equal(g.wallet.coins, 0, 'nothing is in the wallet until it is claimed')
  assert.ok(g.wallet.coinsToday > 0, "today's tally still counts what was earned")
  const claim = (day: string, key: string) => ({ day, item: '', uid: '', what: 'claim', to: key })
  const first = facts[0].day
  const claimed = foldGame(facts.map((f) => (f.day === facts[1].day ? { ...f, uses: [claim(f.day, `pay:${first}`)] } : f)))
  assert.ok(claimed.wallet.coins > 0)
  assert.ok(!claimed.held.some((h) => h.key === `pay:${first}`))
  assert.ok(claimed.held.some((h) => h.key === `pay:${facts[1].day}`))
  // a claim for something that is not waiting is ignored
  const stale = foldGame(facts.map((f) => (f.day === facts[1].day ? { ...f, uses: [claim(f.day, 'pay:nope')] } : f)))
  assert.equal(stale.wallet.coins, 0)
  // left alone, it pays itself
  const later = foldGame(run(2 + CLAIM_AUTO, ALL))
  assert.ok(later.wallet.coins > 0)
  assert.ok(!later.held.some((h) => h.key === `pay:${facts[0].day}`))
})

test('a second day running at the streak bar pays a little more, and a month review pays gems with its shard', () => {
  const g = foldGame(run(2, ALL))
  const pays = g.held.filter((h) => h.key.startsWith('pay:'))
  assert.equal(pays.length, 2)
  assert.equal(pays[1].coins, pays[0].coins + PAY_STREAK.coins)
  const r = foldGame(buildFacts({ habits: [], ticks: { '2026-09-01': { 'month-review': '2026-10-05T09:00:00' } }, today: '2026-10-06' }))
  const held = r.held.find((h) => h.key === 'review:1')
  assert.equal(held?.gems, REVIEW_GEMS)
  assert.deepEqual(held?.items, [['comet-shard', 1]])
})

// ── version 10: the weekly boss ─────────────────────────────────────────────

const SHARES = [0.3, 0.25, 0.2, 0.15, 0.1]
const KINDS = ['gym', 'arbor', 'shed', 'sleep', 'life'] as const
const bossCard = (week: string, level: number, o: Partial<BossCard> = {}): BossCard => ({
  week, species: 'dratini', form: 'dragonite', rarity: 'R', mega: false, level,
  tasks: KINDS.map((kind, i) => ({ kind, template: 't', target: 1, share: SHARES[i], text: kind })), ...o,
})
/** `lead` ordinary days, then a boss week whose progress on each day is `ps[day]` (one number for every task, or five). */
function bossWeek(lead: DayFacts[], level: number, ps: (number | number[])[], o: Partial<BossCard> = {}): DayFacts[] {
  const start = addDays(mondayOf(lead[lead.length - 1].day), 7)
  const fill: DayFacts[] = []
  for (let d = addDays(lead[lead.length - 1].day, 1); d < start; d = addDays(d, 1)) fill.push(dayOn(d, ALL))
  const card = bossCard(start, level, o)
  return [...lead, ...fill, ...ps.map((p, i) => ({ ...dayOn(addDays(start, i), ALL), boss: { card, p: Array.isArray(p) ? p : SHARES.map(() => p) } }))]
}

test('boss arithmetic: power is level x rarity x Mega, an empty slot is nothing, and a weak six cannot hurt a Mega legendary much', () => {
  const m = (level: number, rarity: 'C' | 'U' | 'R' | 'L', mega = false): Member => ({ level, rarity, mega })
  assert.equal(memberPower(m(50, 'L', true)), 50 * 1.5 * 1.15)
  assert.equal(bossLevel(160), 42)
  const weak = [m(10, 'C'), ...Array.from({ length: 5 }, () => m(30, 'C'))]
  const elite = [m(50, 'L'), m(50, 'L', true), m(50, 'L', true), m(50, 'R', true), m(50, 'L'), m(50, 'R', true)]
  const rare = { level: 42, rarity: 'R' as const, mega: false }
  const megaL = { level: 42, rarity: 'L' as const, mega: true }
  assert.ok(Math.abs(strikeOf(weak, rare) - Math.pow(160 / (6 * 42), 1.2)) < 1e-9)
  assert.ok(strikeOf(weak, megaL) < 0.36, 'six commons barely scratch a Mega legendary')
  assert.equal(strikeOf(elite, { level: 67, rarity: 'R', mega: false }), 1)
  assert.ok(strikeOf(elite, { level: 67, rarity: 'L', mega: true }) > strikeOf(weak, megaL) * 2)
  // one member is far weaker than six of them: the size of the party counts
  assert.ok(strikeOf([m(50, 'L', true)], rare) < strikeOf(elite, rare) / 2)
  assert.equal(strikeOf([], rare), 0.12)
})

test('a boss week: progress takes HP, the last of it needs every task, an idle day heals, and a kill pays', () => {
  const lead = run(400, ALL)
  // a boss far below the party: every strike is at full strength
  const most = foldGame(bossWeek(lead, 5, [0.5, 0.99]))
  assert.ok(most.boss)
  assert.equal(most.boss.strike, 1)
  assert.equal(most.boss.taken, KILL_CAP, 'without every task done it stops at the cap')
  assert.equal(most.boss.killed, false)
  assert.equal(most.boss.daysLeft, 5)
  const dead = foldGame(bossWeek(lead, 5, [0.5, 1]))
  assert.equal(dead.boss?.taken, 1)
  assert.equal(dead.boss?.hp, 0)
  assert.ok(dead.boss?.killed)
  assert.ok(dead.moments.some((x) => x.kind === 'boss' && x.what === 'appear'))
  assert.ok(dead.moments.some((x) => x.kind === 'boss' && x.what === 'kill'))
  assert.ok(dead.held.some((h) => h.key.endsWith(':kill') && h.gems === BOSS_KILL_GEMS), 'the kill waits in the Collect strip')
  assert.equal(dead.held.filter((h) => /:(25|50|75)$/.test(h.key)).length, 3)
  // a day with no progress gives some back
  const low = foldGame(bossWeek(lead, 400, [0.5]))
  const idle = foldGame(bossWeek(lead, 400, [0.5, 0.5]))
  assert.ok(low.boss && idle.boss)
  assert.ok(Math.abs(idle.boss.taken - (low.boss.taken - BOSS_HEAL)) < 1e-9)
  // work undone comes back off
  const undone = foldGame(bossWeek(lead, 400, [0.5, 0.2]))
  assert.ok(undone.boss && undone.boss.taken < low.boss.taken)
  // no card, no boss
  assert.equal(foldGame(lead).boss, null)
})

test('a boss that is too strong can only be wounded, however much of the card is done', () => {
  const g = foldGame(bossWeek(run(20, ALL), 60, [1], { rarity: 'L', mega: true }))
  assert.ok(g.boss)
  assert.ok(g.boss.strike < 0.2)
  assert.ok(g.boss.taken < 0.35)
  assert.equal(g.boss.canThrow, false, 'it is far too healthy to throw at')
})

test('throwing at a boss: only when it is weak, three times, each one a seeded chance', () => {
  const lead = run(400, ALL)
  const week = bossWeek(lead, 5, [1, 1, 1])
  const start = week[week.length - 3].day
  const at = (i: number, ...uses: { item: string; what: string }[]): DayFacts[] => week.map((f) => (f.day === addDays(start, i) ? { ...f, uses: uses.map((u) => ({ day: f.day, uid: '', ...u })) } : f))
  const instant = (f: DayFacts[]) => foldGame(f, { instant: true })
  const before = instant(week)
  assert.ok(before.boss?.canThrow)
  const balls = before.inv['great-ball'] ?? 0
  assert.ok(balls > 0, 'the first milestone handed over a Great Ball')
  const one = instant(at(1, { item: 'great-ball', what: 'boss-throw' }))
  assert.equal(one.inv['great-ball'] ?? 0, balls - 1)
  assert.equal(one.boss?.throws, 1)
  const chance = catchChance('great-ball', before.boss!.trained, true, 0, before.boss!.strike)
  const hit = rng(`boss-catch:${start}:1`)() < chance
  assert.equal(one.boss?.caught, hit, 'the throw follows the seeded roll')
  assert.equal(one.moments.some((x) => x.kind === 'boss' && x.what === (hit ? 'catch' : 'miss')), true)
  if (hit) assert.ok(one.queue.some((x) => x.base === 'dratini' && x.thrown === 'great-ball'))
  // something that is not a ball, or a boss still healthy, is a tap that does nothing
  assert.equal(instant(at(1, { item: 'oran-berry', what: 'boss-throw' })).boss?.throws, 0)
  const healthy = instant(bossWeek(lead, 400, [0.2, 0.2]).map((f, i, all) => (i === all.length - 1 ? { ...f, uses: [{ day: f.day, uid: '', item: 'great-ball', what: 'boss-throw' }] } : f)))
  assert.equal(healthy.boss?.throws, 0)
  // the chances themselves
  assert.ok(Math.abs(catchChance('ultra-ball', 5, true, 0) - 0.58) < 1e-9)
  assert.ok(Math.abs(catchChance('ultra-ball', 5, false, 0.25) - 0.28 * 0.7) < 1e-9, 'HP still standing costs the throw')
  assert.ok(Math.abs(catchChance('ultra-ball', 5, true, 0, 0.5) - 0.58 * 0.8) < 1e-9, 'an outmatched party throws worse')
  assert.ok(weekChance(catchChance('ultra-ball', 5, true, 0)) > 0.9, 'three throws on a finished card are close to sure')
  assert.ok(weekChance(catchChance('ultra-ball', 5, false, 0.4)) < 0.4, 'three throws at a healthy boss are not')
  assert.equal(catchChance('master-ball', 0, false, 0.4), 0.9)
  assert.equal(catchChance('oran-berry', 5, true, 0), 0)
})

test('a boss week ends: an uncaught one leaves and is logged, and the card and its days are read from the ledger', () => {
  const lead = run(400, ALL)
  const week = bossWeek(lead, 400, [0.3, 0.4])
  const after = [...week, ...Array.from({ length: 7 }, (_, i) => dayOn(addDays(week[week.length - 1].day, i + 1), ALL))]
  const g = foldGame(after)
  assert.equal(g.boss, null)
  assert.equal(g.bossLog.length, 1)
  assert.equal(g.bossLog[0].caught, false)
  assert.ok(g.moments.some((x) => x.kind === 'boss' && x.what === 'left'))
  // the first card of a week stands; the last progress written for a day stands; a day with none carries the last one forward
  const card = bossCard('2026-10-12', 30)
  const ev = (type: string, day: string, payload: Record<string, unknown>) => ({ type, day, at: day, payload })
  const input = bossOf([
    ev('boss_card', '2026-10-12', { card: JSON.stringify(card) }),
    ev('boss_card', '2026-10-12', { card: JSON.stringify({ ...card, level: 99 }) }),
    ev('boss_day', '2026-10-12', { p: JSON.stringify([0.1, 0, 0, 0, 0]) }),
    ev('boss_day', '2026-10-12', { p: JSON.stringify([0.5, 0.2, 0, 0, 0]) }),
    ev('boss_card', '2026-10-19', { card: 'not json' }),
  ])
  assert.equal(input.cards['2026-10-12'].level, 30)
  assert.equal(input.cards['2026-10-19'], undefined)
  assert.deepEqual(input.days['2026-10-12'], [0.5, 0.2, 0, 0, 0])
  const facts = buildFacts({ habits: [], ticks: {}, boss: input, today: '2026-10-14' })
  assert.deepEqual(facts.find((f) => f.day === '2026-10-14')?.boss?.p, [0.5, 0.2, 0, 0, 0])
  assert.equal(facts.find((f) => f.day === '2026-10-11')?.boss, undefined)
  assert.equal(bossDayChanged(undefined, [0, 0, 0, 0, 0]), false)
  assert.equal(bossDayChanged([0.5, 0.2, 0, 0, 0], [0.5, 0.2, 0, 0, 0]), false)
  assert.equal(bossDayChanged([0.5, 0.2, 0, 0, 0], [0.6, 0.2, 0, 0, 0]), true)
})
