// Rules version 13: Champion's Road (RULES-V13.md).
//   node --test core/v13.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, buildFacts, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { LEAGUES, lineup } from './gyms.ts'
import { CRIT_MULT, GIGANTAMAX, DYNAMAX, HEART_LEVELS, LEADER_HP, LEVEL_POWER, V13_START, bondLevel, hasPerk, leaderHp, levelOf, xpForLevel } from './rules.ts'
import { BOOST, ITEMS, EVO_ITEMS, FOSSILS, LEGEND_KEYS, PICKUP, REVIVE_COST, TREASURE, VITAMINS, forgeFair, legendFor, pickupFind } from './economy.ts'
import { FACILITIES, bpFor } from './frontier.ts'
import { SPECIES } from './species.ts'

const H = (id: string, tag: HabitFact['tag'], worth: number, frac: number): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac, done: frac >= 1 })
type O = { code?: number; gym?: number; guitar?: number; arbor?: number; sleep?: number; chores?: number }
/** a day `n` days after version 13 began */
function day(n: number, o: O = {}): DayFacts {
  const ticked = Math.round(10 * (o.chores ?? 0))
  return {
    day: addDays(V13_START, n),
    habits: [
      H('leetcode-coding', 'code', 100, o.code ?? 0), H('gym', 'fitness', 100, o.gym ?? 0), H('woodshed-guitar', 'guitar', 100, o.guitar ?? 0),
      H('arbor-morning', 'arbor', 30, o.arbor ?? 0), H('sleep-before-10', 'sleep', 30, o.sleep ?? 0),
      ...Array.from({ length: 10 }, (_, i) => H(`chore-${i}`, 'routine', 1, i < ticked ? 1 : 0)),
    ],
  }
}
const ALL: O = { code: 1, gym: 1, guitar: 1, arbor: 1, sleep: 1, chores: 1 }
const PILLARS: O = { code: 1, gym: 1, guitar: 1, arbor: 1 }
/** two pillars a day: a partner that takes months to train, so its hearts keep climbing */
const HALF: O = { code: 1, gym: 1 }
/** everything but the night: well paid in coins, never perfect */
const BUSY: O = { code: 1, gym: 1, guitar: 1, arbor: 1, chores: 1 }
const run = (n: number, o: O) => Array.from({ length: n }, (_, i) => day(i, o))
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })
const use = (facts: DayFacts[], i: number, ...uses: { what: string; item?: string; uid?: string; to?: string }[]) =>
  facts.map((f, k) => (k === i ? { ...f, uses: [...(f.uses ?? []), ...uses.map((u) => ({ day: f.day, item: u.item ?? '', uid: u.uid ?? '', what: u.what, ...(u.to ? { to: u.to } : {}) }))] } : f))
type G = ReturnType<typeof foldGame>
const kinds = (g: G, k: string) => g.moments.filter((m) => m.kind === k)

test('leaders get tougher the further you go, and a Rematch rank adds more', () => {
  assert.equal(leaderHp(0, 'gym', 0), LEADER_HP)
  assert.equal(leaderHp(0, 'champion', 0), 3200)
  assert.equal(leaderHp(9, 'champion', 0), 7500)
  assert.equal(leaderHp(0, 'gym', 1), 3200)
  // every leader met after version 13 has the HP of where they stand
  const g = fold(run(160, ALL))
  const l = LEAGUES[g.league.index]
  const kind = g.league.slot < l.gyms.length ? 'gym' : g.league.slot >= lineup(l).length - 1 ? 'champion' : 'elite'
  assert.ok(g.league.index > 0, 'it got past Kanto')
  assert.equal(g.league.max, leaderHp(g.league.index, kind, g.league.lap))
})

test("the partner's level adds to every strike", () => {
  const g = fold(run(40, PILLARS))
  assert.equal(g.v13, true)
  assert.ok(Math.abs(g.power.level - LEVEL_POWER * levelOf(g.partner.xp)) < 1e-9)
  assert.ok(g.power.level > 0.1)
})

test('five bond levels, each with a perk', () => {
  assert.deepEqual([...HEART_LEVELS], [10, 30, 60, 100, 150])
  assert.equal(bondLevel(150), 5)
  assert.ok(hasPerk(1, 'pickup') && !hasPerk(1, 'endure') && hasPerk(3, 'focus') && hasPerk(5, 'share'))
})

test('Pickup: from bond level 1 the partner finds things on days with a pillar, better ones further on', () => {
  const g = fold(run(70, PILLARS))
  const finds = kinds(g, 'pickup')
  assert.ok(finds.length >= 8, `found ${finds.length}`)
  // nothing before the tenth heart
  const first = finds[0] as { day: string }
  assert.ok(first.day >= addDays(V13_START, 2), 'nothing before the tenth heart: four pillars a day is four hearts')
  assert.equal(g.counters.pickups, finds.length)
  // the table: tier 0 holds only tier-0 things, every item in it is a real item
  for (const [id] of PICKUP) assert.ok(ITEMS[id], id)
  for (let i = 0; i < 50; i++) assert.equal(PICKUP.find(([id]) => id === pickupFind(`t${i}`, 0))![2], 0)
})

test('Endure: with bond level 2 one empty day a week costs nothing', () => {
  const days = [...run(34, HALF), day(34, {}), day(35, HALF), day(36, HALF), day(37, {}), day(38, HALF), day(39, HALF)]
  const g = fold(days)
  const shielded = kinds(g, 'endure')
  const slips = kinds(g, 'slip')
  assert.equal(shielded.length, 1, 'the first empty day is forgiven')
  assert.equal(slips.length, 1, 'the second, three days later, is not')
  assert.equal(g.endure.ready, false)
})

test('a Guard Spec stands guard over the next empty day, and a Focus Sash over all of them', () => {
  // coins come from showing up; the Mart's battle shelf has the Guard Spec
  let days = [...run(8, ALL), day(8, {}), day(9, ALL), day(10, ALL)]
  days = use(days, 7, { what: 'buy', item: 'guard-spec', to: 'mart' }, { what: 'guard', item: 'guard-spec' })
  const g = fold(days)
  assert.deepEqual(kinds(g, 'endure').map((m) => (m as { how: string }).how), ['guard'])
  assert.equal(kinds(g, 'slip').length, 0)
  assert.equal(g.guard, false)
})

test('critical hits come from bond level 3, and a perfect day Dynamaxes the partner', () => {
  // one pillar a day: a hundred and fifty days to train, so the bond reaches level 3 on day sixty
  const g = fold(run(140, { code: 1 }))
  const crits = g.days.filter((d) => d.crit)
  assert.ok(crits.length >= 3, `${crits.length} critical days`)
  assert.ok(g.days.slice(0, 58).every((d) => !d.crit), 'not before bond level 3 (sixty hearts)')
  assert.equal(g.counters.crits, crits.length)
  // every one of these days is perfect, so every strike is a Dynamax one, and Charmander's line has a Gigantamax form
  const p = fold(run(20, ALL))
  assert.ok(p.days.every((d) => d.strike === 0 || d.max))
  assert.equal(p.counters.dynamax, p.days.filter((d) => d.max).length)
  assert.ok([DYNAMAX, GIGANTAMAX, CRIT_MULT].every((x) => x > 1))
})

test('an X item boosts one domain for one day; the strongest used counts', () => {
  const days = run(12, BUSY)
  const plain = fold(days)
  const boosted = fold(use(use(days, 10, { what: 'buy', item: 'x-attack-3', to: 'mart' }, { what: 'buy', item: 'x-attack', to: 'mart' }), 11, { what: 'boost', item: 'x-attack' }, { what: 'boost', item: 'x-attack-3' }))
  assert.deepEqual(boosted.days[11].boost, { fitness: BOOST['x-attack-3'].add })
  assert.ok(boosted.days[11].strike > plain.days[11].strike)
  assert.equal(boosted.inv['x-attack'] ?? 0, 0)
  // the day after, nothing is boosted
  assert.equal(boosted.days[10].boost, undefined)
})

test('the fair forge: three shards of three different colours, a Comet fills any socket', () => {
  assert.deepEqual(forgeFair({ 'red-shard': 1, 'blue-shard': 1, 'yellow-shard': 1 })?.sort(), ['blue-shard', 'red-shard', 'yellow-shard'])
  assert.equal(forgeFair({ 'red-shard': 3 }), null)
  assert.deepEqual(forgeFair({ 'red-shard': 2, 'comet-shard': 2 }), ['red-shard', 'comet-shard', 'comet-shard'])
  assert.equal(forgeFair({ 'red-shard': 1, 'blue-shard': 1, 'yellow-shard': 1 }, 'red-shard,red-shard,blue-shard'), null)
  assert.deepEqual(forgeFair({ 'red-shard': 1, 'blue-shard': 1, 'green-shard': 1, 'yellow-shard': 4 }, 'red-shard,blue-shard,green-shard'), ['red-shard', 'blue-shard', 'green-shard'])
})

test('the Battle Frontier: runs pay Battle Points, and Symbols at their lines', () => {
  assert.deepEqual([bpFor(1), bpFor(7), bpFor(8), bpFor(14), bpFor(70), bpFor(3, true)], [1, 8, 1, 15, 36, 3])
  const g = fold(run(40, ALL))
  const tower = g.frontier.find((r) => r.id === 'tower')!
  assert.equal(tower.cur, 40)
  assert.ok(tower.silver && tower.gold)
  const pyramid = g.frontier.find((r) => r.id === 'pyramid')!
  assert.ok(pyramid.gold, 'fifteen perfect days')
  assert.ok(g.wallet.bp > 100, `${g.wallet.bp} BP`)
  // a Gold Symbol hands over its Legend key
  assert.ok((g.inv[FACILITIES[0].goldKey] ?? 0) >= 1)
  assert.ok(kinds(g, 'symbol').length >= 4)
  // a run ends after a gap longer than its rest days
  const broken = fold([...run(10, ALL), ...[13, 14].map((n) => day(n, ALL))])
  assert.equal(broken.frontier.find((r) => r.id === 'tower')!.cur, 2)
})

test('a Legend key summons its legend as the next wild Pokemon', () => {
  for (const [id, k] of Object.entries(LEGEND_KEYS)) for (const f of k.forms) assert.ok(SPECIES[f], `${id}: ${f}`)
  const days = run(41, ALL)
  const g = fold(use(days, 40, { what: 'summon', item: 'old-sea-map' }))
  assert.equal(kinds(g, 'summon').length, 1)
  assert.equal(legendFor('old-sea-map', 0), 'mew')
  // tomorrow the legend stands there
  const next = fold([...use(days, 40, { what: 'summon', item: 'old-sea-map' }), day(41, {}), day(42, {})])
  assert.ok(next.moments.some((m) => m.kind === 'appear' && m.form === 'mew'))
})

test('the Lab brings a fossil back, an evolution item evolves someone in My Pokemon, a Rare Candy levels them', () => {
  for (const f of Object.values(FOSSILS)) assert.ok(SPECIES[f.species], f.species)
  for (const id of Object.keys(EVO_ITEMS)) assert.ok(id)
  const days = run(45, ALL)
  const base = fold(days)
  assert.ok(base.wallet.bp >= 40 && base.wallet.coins >= REVIVE_COST)
  const g = fold(use(days, 44, { what: 'buy', item: 'helix-fossil', to: 'bp' }, { what: 'fossil', item: 'helix-fossil' }))
  const omanyte = g.queue.find((m) => m.origin === 'fossil')!
  assert.equal(omanyte.base, 'omanyte')
  // a Rare Candy for it
  const candy = fold(use(days, 44, { what: 'buy', item: 'helix-fossil', to: 'bp' }, { what: 'fossil', item: 'helix-fossil' }, { what: 'buy', item: 'rare-candy', to: 'bp' }, { what: 'candy', item: 'rare-candy', uid: omanyte.uid }))
  assert.equal(levelOf(candy.queue.find((m) => m.uid === omanyte.uid)!.xp), 2)
  assert.equal(xpForLevel(2), candy.queue.find((m) => m.uid === omanyte.uid)!.xp)
  // Omanyte becomes Omastar (Rock / Water): a Water Stone is not on the BP shelf, a Prism Scale (Water, Dragon) is
  const evo = fold(use(days, 44, { what: 'buy', item: 'helix-fossil', to: 'bp' }, { what: 'fossil', item: 'helix-fossil' }, { what: 'buy', item: 'prism-scale', to: 'bp' }, { what: 'evolve', item: 'prism-scale', uid: omanyte.uid }))
  assert.equal(evo.queue.find((m) => m.uid === omanyte.uid)!.form, 'omastar')
  assert.equal(evo.counters.itemevos, 1)
  // an item of the wrong type does nothing
  const wrong = fold(use(days, 44, { what: 'buy', item: 'helix-fossil', to: 'bp' }, { what: 'fossil', item: 'helix-fossil' }, { what: 'buy', item: 'reaper-cloth', to: 'bp' }, { what: 'evolve', item: 'reaper-cloth', uid: omanyte.uid }))
  assert.equal(wrong.queue.find((m) => m.uid === omanyte.uid)!.form, 'omanyte')
})

test('vitamins: one domain of one Pokemon strikes harder, for good; the Collector buys treasures', () => {
  for (const [id] of Object.entries(VITAMINS)) assert.ok(id)
  const days = run(14, PILLARS)
  const g = fold(use(days, 13, { what: 'buy', item: 'calcium', to: 'code' }, { what: 'vitamin', item: 'calcium' }))
  assert.equal(g.partner.vits?.code, 1)
  assert.ok(Math.abs(g.power.domain.code.vitamin - 0.03) < 1e-9)
  // a treasure sells for its price
  const t = fold(run(70, PILLARS))
  const loot = Object.keys(t.inv).find((id) => TREASURE[id] && t.inv[id] > 0)
  assert.ok(loot, 'Pickup found a treasure')
  const sold = fold(use(run(70, PILLARS), 69, { what: 'sell', item: loot!, to: '99' }))
  assert.equal(sold.wallet.coins - t.wallet.coins, TREASURE[loot!][1] * t.inv[loot!])
  assert.equal(sold.inv[loot!], 0)
})

test('after the last Champion the leagues come back at Rematch rank two', () => {
  const g = fold(run(1400, ALL))
  assert.ok(g.league.lap >= 1, `lap ${g.league.lap}, league ${g.league.index}`)
  assert.ok(kinds(g, 'lap').length >= 1)
  assert.ok(g.hall.some((h) => h.lap === 1) || g.league.lap >= 1)
})

test('the day ends when you wake: after midnight it stays yesterday until the night is read, the day is started, or the day starts', async () => {
  const { wakingDay, DAY_STARTS_DEFAULT, clockOf } = await import('./day.ts')
  const at = (iso: string) => new Date(iso)
  const none = () => false
  assert.equal(wakingDay(at('2026-10-20T23:30:00'), none), '2026-10-20')
  assert.equal(wakingDay(at('2026-10-21T01:30:00'), none), '2026-10-20', 'past midnight, still awake: still yesterday')
  assert.equal(wakingDay(at('2026-10-21T03:10:00'), (d) => d === '2026-10-21'), '2026-10-21', 'the band read the night: the new day has begun')
  assert.equal(wakingDay(at('2026-10-21T04:00:00'), none), '2026-10-20', 'no reading and no start by hand yet')
  assert.equal(wakingDay(at(`2026-10-21T${clockOf(DAY_STARTS_DEFAULT)}:00`), none), '2026-10-21', 'the day starts on its own')
})

test('from version 13 a night the band has not read is not part of the day: no tick by hand, never a miss', () => {
  const lib = [{ id: 'leetcode-coding', tier: 'pillar', spans: [{ from: '1970-01-01', to: null }] }, { id: 'sleep-before-10', tier: 'pillar', spans: [{ from: '1970-01-01', to: null }] }]
  const d1 = V13_START, d2 = addDays(V13_START, 1)
  const facts = buildFacts({ today: d2, habits: lib, ticks: { [d2]: { 'sleep-before-10': `${d2}T08:00:00` } }, body: { [d1]: { sleepScore: 84 } } })
  assert.equal(facts.find((f) => f.day === d1)!.habits.find((h) => h.id === 'sleep-before-10')!.measured, true)
  assert.equal(facts.find((f) => f.day === d2)!.habits.find((h) => h.id === 'sleep-before-10'), undefined, 'waiting: not in the day, and the hand tick is ignored')
})
