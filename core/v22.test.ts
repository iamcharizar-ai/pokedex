// Version 22, steps 2 and 3 (GAME-SPEC-V22.md): the words, the day, tracks and berries. Days are dated from V22_START, set here.
//   node --test core/v22.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact, type ItemUse } from './facts.ts'
import { foldGame } from './fold.ts'
import { BERRY_FAVOURITE, BERRY_PLAIN, PILLAR_HIT, TRACK_LEN, WILD_TICKS, V21_FIX, setV22Start } from './rules.ts'
import { partyPower, pillarsOf, shareOf, tierHit, tierOf } from './v22.ts'

const START = V21_FIX
setV22Start(START) // this file runs in its own process: version 22 is on from the first day

const H = (id: string, tag: HabitFact['tag'], worth: number, done: boolean, extra: Partial<HabitFact> = {}): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac: done ? 1 : 0, done, ...extra })
type Did = { code?: boolean; gym?: boolean; arbor?: boolean; sleep?: boolean }
/** a day of the list: pillars done, how many of 8 chores, what was done by hand, and which Strong routines the workout was */
const day = (i: number, did: Did, chores = 4, uses: Omit<ItemUse, 'day'>[] = [], gear: string[] = []): DayFacts => ({
  day: addDays(START, i),
  habits: [
    H('sleep-before-10', 'sleep', 100, Boolean(did.sleep), { frac: did.sleep ? 0.9 : 0, measured: true }),
    H('leetcode-coding', 'code', 100, Boolean(did.code)), H('gym', 'fitness', 100, Boolean(did.gym)), H('arbor-morning', 'arbor', 100, Boolean(did.arbor)),
    ...Array.from({ length: 8 }, (_, k) => H(`chore-${k}`, 'routine', 1, k < chores)),
  ],
  body: { sleepScore: did.sleep ? 90 : 60, steps: 5000 },
  marks: { workouts: did.gym ? 1 : 0, records: 0, clean: 0, owned: 0, gear },
  live: ['sleep', 'code', 'fitness', 'arbor', 'routine'],
  uses: uses.map((u) => ({ ...u, day: addDays(START, i) })),
})
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })

test('the words: a good night is a pillar only beside an effort pillar; the tier counts pillars done; Max is every pillar and three-quarters of the chores', () => {
  const t = (did: Did, chores = 4) => ({ tier: tierOf(day(0, did, chores).habits), pillars: pillarsOf(day(0, did, chores).habits).done.length })
  assert.deepEqual(t({ sleep: true }), { tier: 0, pillars: 0 }) // a night alone: no pillar, no tier
  assert.deepEqual(t({ code: true }), { tier: 1, pillars: 1 })
  assert.deepEqual(t({ code: true, sleep: true }), { tier: 2, pillars: 2 }) // the night counts beside a pillar
  assert.deepEqual(t({ code: true, gym: true, arbor: true }), { tier: 3, pillars: 3 })
  assert.equal(t({ code: true, gym: true, arbor: true, sleep: true }, 8).tier, 4) // every pillar on the list, every chore
  assert.equal(t({ code: true, gym: true, arbor: true, sleep: true }, 2).tier, 3) // not enough chores: still tier 3
  assert.equal(fold([day(0, { sleep: true })]).tier.tier, 0)
  assert.equal(fold([day(0, { code: true, sleep: true })]).tier.pillars, 2)
})

test('the wild Pokemon: one habit ticked, one HP, and nothing multiplies it', () => {
  const g0 = fold([day(0, {}, 0)])
  assert.equal(g0.wild!.hp, WILD_TICKS[g0.wild!.rarity]) // a fixed HP in ticks by rarity
  const g = fold([day(0, { code: true, gym: true }, 8)])
  const ticked = g.today.done
  assert.ok(ticked >= 10)
  assert.equal(g.today.hit, ticked)
  assert.equal(g.wild!.max - g.wild!.hp, ticked)
  // a perfect day catches it on the spot
  const perfect = fold([day(0, { code: true, gym: true, arbor: true, sleep: true }, 8)])
  assert.ok(perfect.today.perfect && perfect.moments.some((m) => m.kind === 'catch' && m.how === 'perfect'))
})

test('the gym leader: each pillar done hits for 100 times the party, the tier multiplies it, chores and a night alone do nothing', () => {
  const hit = (did: Did, chores = 4) => fold([day(0, did, chores)]).today.strike
  assert.equal(hit({}, 8), 0) // chores only
  assert.equal(hit({ sleep: true }, 8), 0) // a night alone
  const one = hit({ code: true })
  assert.ok(one >= PILLAR_HIT, `${one}`) // 100 x (1 + a Lv 1 partner's share)
  // two pillars (code and the night beside it) at tier 2: 2 x 100 x 1.25
  const two = hit({ code: true, sleep: true })
  assert.ok(two > 2 * one * 1.2 && two < 2 * one * tierHit(2) * 1.05, `${two} against ${one}`)
  // the party is the only thing that adds: a Lv 1 partner's share is its level and bond, doubled
  assert.ok(Math.abs(shareOf({ level: 1, hearts: 0, bond: 0, beats: false, mega: false, partner: true }) - 0.004) < 1e-9)
  assert.ok(partyPower([], 250) > partyPower([], 0)) // Trainer levels (every 100 hearts) add
})

test('tracks: seven days of a pillar fill its track, and its prize is a choice of the shard or the egg', () => {
  let days: DayFacts[] = []
  for (let i = 0; i < TRACK_LEN - 1; i++) days.push(day(i, { code: true }))
  let g = foldGame(days)
  assert.equal(g.v22, true)
  assert.equal(g.tracks.code.pips, TRACK_LEN - 1)
  assert.equal(g.held.some((h) => h.key.startsWith('track:code')), false)
  days = [...days, day(TRACK_LEN - 1, { code: true })]
  g = foldGame(days) // not instant: the prize waits in Collect
  const prize = g.held.find((h) => h.key === 'track:code:1')
  assert.ok(prize?.choice, 'a choice waits')
  assert.deepEqual(prize!.choice!.map((o) => o.items[0][0]), ['blue-shard', 'egg-code'])
  assert.equal(g.tracks.code.pips, 0) // it starts again
  assert.equal(g.tracks.code.n, 1)
  assert.ok(g.moments.some((m) => m.kind === 'track' && m.tag === 'code'))
  // marks are not earned any more
  assert.equal(g.wallet.marks.code, 0)
})

test('the Gym track is the seven routines of the split: a routine done twice adds one pip', () => {
  const split = ['d1-chest-delts', 'd2-lats-biceps', 'd3-legs', 'd4-delts-triceps', 'd5-back-biceps', 'd6-chest-flys', 'd7-arms-delts']
  const g = foldGame([day(0, { gym: true }, 4, [], [split[0]]), day(1, { gym: true }, 4, [], [split[0]]), day(2, { gym: true }, 4, [], [split[1]])])
  assert.equal(g.tracks.fitness.pips, 2)
  assert.deepEqual(g.tracks.fitness.kit, [split[0], split[1]])
  const full = foldGame(split.map((r, i) => day(i, { gym: true }, 4, [], [r])))
  assert.deepEqual(full.held.find((h) => h.key === 'track:fitness:1')!.choice!.map((o) => o.items[0][0]), ['red-shard', 'egg-fitness'])
  assert.equal(full.tracks.fitness.pips, 0)
  assert.equal(full.inv['protector'] ?? 0, 0) // no piece in the bag: a routine is a pip
})

test('berries: every pillar done drops its own berry, 2 hearts, or 5 to the Pokemon that likes it best', () => {
  const all: Did = { code: true, gym: true, sleep: true }
  const g = fold([day(0, all, 8)])
  assert.deepEqual([...g.today.berries!].sort(), ['hondew-berry', 'kelpsy-berry', 'pomeg-berry', 'tamato-berry'])
  assert.equal(g.inv['kelpsy-berry'], 1)
  const me = g.partner.uid // Charmander is a Fire type: it likes the Gym's berry
  const hearts = (x: typeof g) => (x.partner.together ?? 0) + (x.partner.fed ?? 0)
  const base = hearts(g)
  const feed = (item: string) => hearts(fold([day(0, all, 8, [{ what: 'feed', item, uid: me }])]))
  assert.equal(feed('hondew-berry') - base, BERRY_PLAIN)
  assert.equal(feed('kelpsy-berry') - base, BERRY_FAVOURITE)
})

test('no comeback and no tier XP bonus: a pillar pays the same whenever it is done', () => {
  const a = fold([day(0, { code: true }), day(1, { code: true })])
  const b = fold([day(0, { code: true }), day(1, {}), day(2, {}), day(3, {}), day(4, { code: true })])
  assert.deepEqual(a.tier.bounty, {})
  assert.deepEqual(b.tier.bounty, {})
})
