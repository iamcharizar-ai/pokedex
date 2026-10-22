// Rules version 14: every item asks a question (RULES-V14.md).
//   node --test core/v14.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, buildFacts, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { HEART_CAP, MAX_LEVEL, RESEARCH_SLOTS, V14_START, WILD_HP, levelOf, researchCut } from './rules.ts'
import { BATTLE_SHELF, BERRY_HEARTS, COLLECTOR_MULT, COLLECTOR_WANTS, DOMAIN_SHOPS, DOMAIN_V13, MART_POOL, PARTY_VITAMIN, RARE_SHELF_V13, TREASURE, collectorWants, treasurePrice } from './economy.ts'
import { VITAMIN_STEP } from './economy.ts'
import { DAY_STARTS_DEFAULT, DAY_STARTS_EARLIEST, DAY_STARTS_LATEST, dayStartsAt, wakingDay } from './day.ts'

const H = (id: string, tag: HabitFact['tag'], worth: number, frac: number): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac, done: frac >= 1 })
/** a day `n` days after version 14 began: every pillar (a perfect day) or only two (the wild Pokemon is worn down, not caught) */
const day = (n: number, all = true): DayFacts => ({
  day: addDays(V14_START, n),
  habits: [H('leetcode-coding', 'code', 100, 1), H('gym', 'fitness', 100, 1), H('woodshed-guitar', 'guitar', 100, all ? 1 : 0), H('arbor-morning', 'arbor', 30, all ? 1 : 0)],
})
const run = (n: number, all = true) => Array.from({ length: n }, (_, i) => day(i, all))
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })
const use = (facts: DayFacts[], i: number, ...uses: { what: string; item?: string; uid?: string; to?: string }[]) =>
  facts.map((f, k) => (k === i ? { ...f, uses: [...(f.uses ?? []), ...uses.map((u) => ({ day: f.day, item: u.item ?? '', uid: u.uid ?? '', what: u.what, ...(u.to ? { to: u.to } : {}) }))] } : f))
type Mon = ReturnType<typeof foldGame>['queue'][number]
const hearts = (m: Mon) => (m.together ?? 0) + (m.fed ?? 0)

test('a berry can be fed to any Pokemon you own, not only the partner', () => {
  const days = run(4)
  const before = fold(days)
  const target = before.queue[0]
  const g = fold(use(days, 3, { what: 'feed', item: 'oran-berry', uid: target.uid }))
  assert.equal(hearts(g.queue.find((m) => m.uid === target.uid)!), hearts(target) + 1)
  assert.equal(hearts(g.partner), hearts(before.partner), 'the partner got nothing')
  // naming no one still feeds the partner, as before
  const p = fold(use(days, 3, { what: 'feed', item: 'oran-berry' }))
  assert.equal(hearts(p.partner), hearts(before.partner) + 1)
})

test('a berry is refused once a Pokemon has every bond level, so none is thrown away', () => {
  const days = run(30)
  const g0 = fold(days)
  const target = g0.queue[0]
  const buys = Array.from({ length: 60 }, () => ({ what: 'buy', item: 'sweet-heart', to: 'rare' }))
  const feeds = Array.from({ length: 60 }, () => ({ what: 'feed', item: 'sweet-heart', uid: target.uid }))
  const g = fold(use(use(days, 28, ...buys), 29, ...feeds))
  const fed = g.queue.find((m) => m.uid === target.uid)!
  assert.ok(hearts(fed) >= HEART_CAP && hearts(fed) < HEART_CAP + 3, `${hearts(fed)} hearts`)
  assert.ok((g.inv['sweet-heart'] ?? 0) > 0, 'the rest stay in the bag')
})

test('a berry is food, not bait: thrown with a ball it is neither spent nor adds HP', () => {
  const days = [...run(6), ...Array.from({ length: 3 }, (_, i) => day(6 + i, false))]
  const plain = fold(use(days, 7, { what: 'throw', item: 'premier-ball' }))
  const withBerry = fold(use(days, 7, { what: 'throw', item: 'premier-ball', to: 'oran-berry' }))
  assert.equal(plain.wild.hp, withBerry.wild.hp)
  assert.equal(plain.inv['oran-berry'] ?? 0, withBerry.inv['oran-berry'] ?? 0)
})

test('a berry that costs less never feeds more hearts, in any currency', () => {
  const shelves = [MART_POOL, BATTLE_SHELF, RARE_SHELF_V13, ...Object.values(DOMAIN_SHOPS).map((s) => s.stock), ...Object.values(DOMAIN_V13)]
  for (const cur of ['coins', 'gems', 'marks'] as const) {
    const offers = shelves.flat().flatMap((o) => (BERRY_HEARTS[o.item] && o[cur] ? [{ item: o.item, price: o[cur] as number, hearts: BERRY_HEARTS[o.item] }] : []))
    for (const a of offers) for (const b of offers) if (a.price < b.price) assert.ok(a.hearts <= b.hearts, `${a.item} (${a.price} ${cur}, ${a.hearts} hearts) vs ${b.item} (${b.price} ${cur}, ${b.hearts} hearts)`)
  }
})

test('the Collector wants a few treasures a day and pays double for them', () => {
  const d = addDays(V14_START, 5)
  const wants = collectorWants(d)
  assert.equal(wants.length, COLLECTOR_WANTS)
  assert.deepEqual(collectorWants(d), wants, 'the same list on every device')
  for (const id of wants) assert.equal(treasurePrice(id, d), TREASURE[id][1] * COLLECTOR_MULT)
  const other = Object.keys(TREASURE).find((id) => !wants.includes(id))!
  assert.equal(treasurePrice(other, d), TREASURE[other][1])
  assert.equal(treasurePrice(wants[0], addDays(V14_START, -1)), TREASURE[wants[0]][1], 'before version 14 there is no list')
  // in the fold: selling on a day pays that day's price
  const days = run(6)
  const g0 = fold(days)
  const t = Object.keys(g0.inv).find((id) => TREASURE[id])
  if (t) {
    const sold = fold(use(days, 5, { what: 'sell', item: t, to: '1' }))
    assert.equal(sold.wallet.coins - g0.wallet.coins, treasurePrice(t, days[5].day))
  }
})

test("a party member's vitamins count a third", () => {
  const days = run(14)
  const g0 = fold(days)
  const member = g0.queue[0]
  const g = fold(use(days, 13, { what: 'buy', item: 'calcium', to: 'code' }, { what: 'vitamin', item: 'calcium', uid: member.uid }))
  assert.equal(g.queue.find((m) => m.uid === member.uid)!.vits?.code, 1)
  assert.ok(Math.abs(g.power.domain.code.vitamin - g0.power.domain.code.vitamin - VITAMIN_STEP * PARTY_VITAMIN) < 1e-9)
})

test('from version 14 a night the band never read can be reported by hand, as a core habit; unticked it is still not part of the day', () => {
  const lib = [{ id: 'leetcode-coding', tier: 'pillar', spans: [{ from: '1970-01-01', to: null }] }, { id: 'sleep-before-10', tier: 'pillar', spans: [{ from: '1970-01-01', to: null }] }]
  const d0 = addDays(V14_START, -1), d1 = V14_START, d2 = addDays(V14_START, 1)
  const facts = buildFacts({ today: d2, habits: lib, ticks: { [d1]: { 'sleep-before-10': `${d1}T08:00:00` } }, body: { [d0]: { sleepScore: 84 } } })
  const s1 = facts.find((f) => f.day === d1)!.habits.find((h) => h.id === 'sleep-before-10')!
  assert.equal(s1.selfReported, true)
  assert.equal(s1.pillar, false)
  assert.equal(s1.worth, 30)
  assert.equal(facts.find((f) => f.day === d2)!.habits.find((h) => h.id === 'sleep-before-10'), undefined, 'not ticked, not read: not part of the day')
})

test('the day starts two hours before you usually wake, between 04:00 and 07:00', () => {
  const nights = (wakes: string[]) => Object.fromEntries(wakes.map((w, i) => [addDays('2026-10-10', i), { wake: `${addDays('2026-10-10', i)}T${w}` }]))
  assert.equal(dayStartsAt({}, '2026-10-20'), DAY_STARTS_DEFAULT, 'no history yet')
  assert.equal(dayStartsAt(nights(['08:00', '08:20']), '2026-10-20'), DAY_STARTS_DEFAULT, 'two nights are not enough')
  assert.equal(dayStartsAt(nights(['07:30', '08:20', '08:20', '08:50', '07:50', '08:20', '08:00']), '2026-10-20'), 6 * 60 + 20)
  assert.equal(dayStartsAt(nights(['05:00', '05:10', '05:20']), '2026-10-20'), DAY_STARTS_EARLIEST)
  assert.equal(dayStartsAt(nights(['11:00', '11:30', '11:50']), '2026-10-20'), DAY_STARTS_LATEST)
  assert.equal(dayStartsAt(nights(['14:00', '15:00', '16:00']), '2026-10-20'), DAY_STARTS_DEFAULT, 'afternoon naps are not nights')
  // the night filed under today does not move today's start
  const n = nights(['08:00', '08:00', '08:00'])
  assert.equal(dayStartsAt({ ...n, '2026-10-20': { wake: '2026-10-20T11:00' } }, '2026-10-20'), 6 * 60)
  const none = () => false
  assert.equal(wakingDay(new Date('2026-10-21T06:10:00'), none, 6 * 60 + 20), '2026-10-20')
  assert.equal(wakingDay(new Date('2026-10-21T06:20:00'), none, 6 * 60 + 20), '2026-10-21')
})

test('nobody is sold from version 14: the Box is the Professor\'s', () => {
  const days = run(4)
  const g0 = fold(days)
  const g = fold(use(days, 3, { what: 'transfer', uid: g0.queue[0].uid }))
  assert.equal(g.queue.length, g0.queue.length)
  assert.equal(g.wallet.coins, g0.wallet.coins)
})

test('the Professor studies the desk on days with a pillar, and each rank weakens the wild Pokemon to come', () => {
  const g = fold(run(60))
  const r = g.research
  assert.ok(r.desk.length > 0 && r.desk.length <= RESEARCH_SLOTS)
  const party = new Set([g.partner.uid, ...g.team.map((m) => m.uid)])
  assert.ok(r.desk.every((m) => !party.has(m.uid)), 'nobody in the party is on the desk')
  assert.ok(r.rank >= 1, `rank ${r.rank}`)
  assert.equal(r.cut, researchCut(r.rank))
  const ranks = g.moments.filter((m) => m.kind === 'research')
  assert.equal(ranks.length, r.rank)
  // a wild Pokemon met after the first rank comes weaker
  const firstRank = (ranks[0] as { day: string }).day
  const appear = g.moments.find((m) => m.kind === 'appear' && m.day > firstRank) as { rarity: keyof typeof WILD_HP } | undefined
  if (appear && g.wild.from > firstRank) assert.ok(g.wild.max < WILD_HP[g.wild.rarity])
})

test('the desk is yours to choose', () => {
  const days = run(10)
  const g0 = fold(days)
  const pick = g0.queue[g0.queue.length - 1]
  const g = fold(use(days, 9, { what: 'team', to: '' }, { what: 'study', to: pick.uid }))
  assert.deepEqual(g.research.desk.map((m) => m.uid), [pick.uid])
  assert.equal(g.research.chosen, true)
  const back = fold(use(use(days, 8, { what: 'study', to: pick.uid }), 9, { what: 'study', to: 'auto' }))
  assert.equal(back.research.chosen, false)
})

test('a fully trained Pokemon can lead again, goes on to level 100, and there steps aside', () => {
  const days = run(240)
  const g0 = fold(days.slice(0, 60))
  assert.ok(g0.graduates.length > 0, 'someone was fully trained')
  const grad = g0.graduates[0]
  const led = use(days, 60, { what: 'lead', uid: grad.uid })
  const g1 = fold(led.slice(0, 62))
  assert.equal(g1.partner.uid, grad.uid)
  assert.equal(g1.next.what, 'master')
  const g = fold(led)
  const mastered = g.moments.find((m) => m.kind === 'master') as { uid: string } | undefined
  assert.ok(mastered, 'it reached level 100')
  assert.equal(mastered!.uid, grad.uid)
  const it = g.graduates.find((m) => m.uid === grad.uid)!
  assert.equal(levelOf(it.xp), MAX_LEVEL)
  assert.notEqual(g.partner.uid, grad.uid)
})
