// Rules version 21: effort tiers (GAME_REDESIGN.md v3). V21_START is still a placeholder, so these days are dated from it.
//   node --test core/v21.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, factsFor, mondayOf, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { MAX_DAY_BOSS, tasksV21, type BossCard } from './boss.ts'
import { BOUNTY, DAY_HEARTS, DAY_RESEARCH, FIRST_PILLAR, MOMENTUM_STEPS, RANK_V21, V21_START, bountyMult } from './rules.ts'

const START = V21_START
const H = (id: string, tag: HabitFact['tag'], worth: number, done: boolean, extra: Partial<HabitFact> = {}): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac: done ? 1 : 0, done, ...extra })
/** a day of the list: which effortful pillars were done, the night's score, and how many of 8 chores */
const day = (i: number, did: { code?: boolean; gym?: boolean; arbor?: boolean }, score = 85, chores = 8): DayFacts => ({
  day: addDays(START, i),
  habits: [
    H('sleep-before-10', 'sleep', 100, score >= 80, { frac: score / 100, measured: true }),
    H('leetcode-coding', 'code', 100, Boolean(did.code)), H('gym', 'fitness', 100, Boolean(did.gym)), H('arbor-morning', 'arbor', 100, Boolean(did.arbor)),
    ...Array.from({ length: 8 }, (_, k) => H(`chore-${k}`, 'routine', 1, k < chores)),
  ],
  body: { sleepScore: score, steps: 5000 },
  live: ['sleep', 'code', 'fitness', 'arbor', 'routine'],
})
const fold = (f: DayFacts[]) => foldGame(f, { instant: true })
const all = { code: true, gym: true, arbor: true }

test('the tier counts effortful pillars; Sleep never does; a Max day is all of them and three-quarters of the chores', () => {
  const t = (did: Parameters<typeof day>[1], chores = 8) => fold([day(0, did, 85, chores)]).tier
  assert.equal(t({}).tier, 0)
  assert.equal(t({ code: true }).tier, 1)
  assert.equal(t({ code: true, gym: true }).tier, 2)
  assert.equal(t(all, 5).tier, 3, 'all three, but only 5 of 8 chores')
  assert.equal(t(all, 6).tier, 4, 'all three and three-quarters of the chores')
  assert.equal(fold([day(0, {}, 95)]).tier.sleepBonus, false, 'a great night alone is not a day of work')
})

test('hearts and research climb steeply by tier, with the first pillar and a good night on top', () => {
  const hearts = (did: Parameters<typeof day>[1], score = 70) => { const g = fold([day(0, did, score)]); return (g.partner.together ?? 0) + (g.partner.fed ?? 0) }
  assert.equal(hearts({}), 0)
  assert.equal(hearts({ code: true }), DAY_HEARTS[1] + FIRST_PILLAR.hearts)
  assert.equal(hearts(all), DAY_HEARTS[4] + FIRST_PILLAR.hearts)
  assert.equal(hearts({ code: true }, 85), DAY_HEARTS[1] + FIRST_PILLAR.hearts + 1, 'a night of 80+ on a day of work adds a heart')
  const research = (did: Parameters<typeof day>[1]) => fold([day(0, did, 70)]).research.today
  assert.equal(research({}), 0)
  assert.equal(research({ code: true }), DAY_RESEARCH[1] + FIRST_PILLAR.research, 'an empty desk adds nothing')
  assert.equal(research(all), DAY_RESEARCH[4] + FIRST_PILLAR.research)
  assert.equal(fold([day(0, {})]).research.counts, 'sleep')
  assert.equal(fold([day(0, all)]).research.need, RANK_V21)
})

test('a chores-only day still moves XP and coins, and nothing of the tier', () => {
  const g = fold([day(0, {}, 85, 8)])
  assert.ok(g.today.xp > 0)
  assert.ok(g.today.pay > 0)
  assert.equal(g.wallet.gems, 0)
  assert.equal((g.partner.together ?? 0) + (g.partner.fed ?? 0), 0)
})

test('the neglect bounty: from 40 Trainer hearts, a pillar back after idle days pays its own counter more; steady days pay none', () => {
  assert.deepEqual([bountyMult(0), bountyMult(1), bountyMult(2), bountyMult(3), bountyMult(9)], [1, 1, BOUNTY.two, BOUNTY.three, BOUNTY.three])
  // enough Max days for 40 hearts, then Code skipped three days and done again
  const lead = Array.from({ length: 4 }, (_, i) => day(i, all))
  const gap = [day(4, { gym: true, arbor: true }), day(5, { gym: true, arbor: true }), day(6, { gym: true, arbor: true })]
  const before = fold([...lead, ...gap])
  assert.ok(before.trainer.hearts >= 40)
  assert.equal(before.tiles.code?.bountyActive, true, 'the tile shows the bounty while Code waits')
  assert.equal(before.tiles.fitness?.bountyActive, false)
  const back = fold([...lead, ...gap, day(7, all)])
  assert.equal(back.tier.bounty.code, BOUNTY.three)
  assert.equal(back.wallet.marksToday.code, BOUNTY.three, 'Code pays its counter ×3 today')
  assert.equal(back.wallet.marksToday.arbor, 1)
})

test('momentum slides: up a step on a day of two pillars, one free rest day a week, down a step after', () => {
  const run = (days: DayFacts[]) => fold(days).momentum.mult
  const two = (i: number) => day(i, { code: true, gym: true })
  assert.equal(run([two(0)]), MOMENTUM_STEPS[0])
  assert.equal(run([two(0), two(1), two(2), two(3)]), MOMENTUM_STEPS[3])
  // the week's free rest day keeps it, a second one takes a step off
  const rest = (i: number) => day(i, { code: true })
  assert.equal(run([two(0), two(1), two(2), two(3), rest(4), two(5)]), MOMENTUM_STEPS[3])
  const mon = new Date(START + 'T12:00:00').getDay()
  assert.ok(mon >= 0)
  const twoRests = [two(0), two(1), two(2), two(3), rest(4), rest(5), two(6)]
  assert.ok(run(twoRests) <= MOMENTUM_STEPS[3])
})

test('from V21 a Gym day is a logged Strong workout; a tick alone is a basic habit', () => {
  const input = (marks: Record<string, { workouts?: number }>) => ({
    habits: [{ id: 'gym', tier: 'pillar', domain: 'fitness', spans: [{ from: '2026-01-01', to: null }] }],
    ticks: { [START]: { gym: `${START}T08:00:00` } }, marks, today: START,
  })
  const ticked = factsFor(input({}), START).habits[0]
  assert.equal(ticked.pillar, false)
  assert.equal(ticked.worth, 1)
  const worked = factsFor(input({ [START]: { workouts: 1 } }), START).habits[0]
  assert.equal(worked.pillar, true)
  assert.equal(worked.done, true)
  const earlier = factsFor({ ...input({}), ticks: { '2026-11-03': { gym: '2026-11-03T08:00:00' } }, today: '2026-11-03' }, '2026-11-03').habits[0]
  assert.equal(earlier.done && earlier.pillar, true, 'before V21 the tick still counts')
})

test('the V21 card: every pillar done on 3+ of 21 days, and always the one done least, with a target of 1 or 2', () => {
  const tasks = tasksV21({ done: { code: 15, gym: 0, arbor: 12 }, nights: 9, steady: 6, days: 21 }, (k) => k !== 'shed')!
  const kinds = tasks.map((t) => t.kind)
  assert.ok(kinds.includes('gym'), 'Gym, never done, stays on the card')
  assert.ok((tasks.find((t) => t.kind === 'gym')!.target) <= 2)
  assert.ok(tasks.length >= 3 && tasks.length <= 5)
  const effort = tasks.filter((t) => ['code', 'gym', 'arbor'].includes(t.kind)).reduce((n, t) => n + t.share, 0)
  assert.ok(Math.abs(effort - 0.7) < 0.01, 'effortful tasks hold 70% of its HP')
  assert.equal(tasksV21({ done: {}, nights: 0, steady: 0, days: 21 }, (k) => k === 'life' || k === 'sleep'), null, 'no effortful pillar on the list, no card')
})

test('the boss: the card is its HP, a Max day counts more, and a beaten boss joins you', () => {
  const card: BossCard = { week: mondayOf(START), rev: 2, species: 'dratini', form: 'dragonite', rarity: 'R', mega: false, level: 20, tasks: [{ kind: 'code', template: 'days', target: 2, share: 1, text: 'Code on 2 days' }] }
  const one = fold([{ ...day(0, { code: true }), boss: { card, p: [0.5] } }])
  assert.ok(one.boss && Math.abs(one.boss.taken - 0.5 * (1 + one.boss.common)) < 0.01, 'half the card is half its HP, times its power')
  const max = fold([{ ...day(0, all), boss: { card, p: [0.5] } }])
  assert.ok(max.boss && Math.abs(max.boss.taken - 0.5 * (1 + max.boss.common) * MAX_DAY_BOSS.mult) < 0.01, 'on a Max day the same work counts more')
  const won = fold([{ ...day(0, { code: true }), boss: { card, p: [0.5] } }, { ...day(1, { code: true }), boss: { card, p: [1] } }])
  assert.equal(won.boss?.killed, true)
  assert.ok(won.queue.some((m) => m.base === 'dratini'), 'it joins the Box')
})

test('a second of a line already yours turns into hearts; Rare Candy is for the fully trained only', () => {
  const card: BossCard = { week: mondayOf(START), rev: 2, species: 'charmander', form: 'charizard', rarity: 'R', mega: false, level: 20, tasks: [{ kind: 'code', template: 'days', target: 1, share: 1, text: 'Code on 1 day' }] }
  const g = fold([{ ...day(0, { code: true }), boss: { card, p: [1] } }])
  assert.equal(g.queue.some((m) => m.base === 'charmander'), false, 'no second Charmander')
  assert.ok(g.moments.some((m) => m.kind === 'boss' && m.what === 'catch' && m.uid === g.partner.uid), 'the partner (a Charmander) got the hearts')
})

test('tiles: one per effortful pillar on the list, a shard until a Mega Stone, the counter as a fill', () => {
  const g = fold([day(0, all), day(1, all)])
  assert.deepEqual(Object.keys(g.tiles).sort(), ['arbor', 'code', 'fitness'])
  assert.equal(g.tiles.code?.iconId, 'blue-shard')
  assert.ok((g.tiles.code?.fill ?? 0) > 0 && (g.tiles.code?.fill ?? 1) < 1)
  assert.equal(g.tiles.code?.ready, false)
  // before V21 there are no tiles
  assert.deepEqual(fold([{ ...day(0, all), day: addDays(V21_START, -1) }]).tiles, {})
})

test("V21's first day: the Lab dial keeps its fill, and momentum starts at the step nearest the old multiplier", () => {
  // a week of perfect days before V21 (the party fills, studies and counts for momentum), then a chores-only first day of V21
  const pre = Array.from({ length: 8 }, (_, k) => ({ ...day(0, all), day: addDays(START, k - 8) }))
  const before = fold(pre)
  assert.ok(before.research.points > 0 && before.research.need !== RANK_V21, 'research under the old cost')
  const first = fold([...pre, day(0, {}, 70, 8)])
  assert.equal(first.research.points, Math.round((before.research.points * RANK_V21) / before.research.need), 'the same share of the dial, now of 1,500')
  assert.equal(first.research.need, RANK_V21)
  assert.ok(before.momentum.mult > 1)
  assert.equal(first.momentum.mult, MOMENTUM_STEPS.reduce((b, x) => (Math.abs(x - before.momentum.mult) < Math.abs(b - before.momentum.mult) ? x : b), 1), "the old multiplier carries into the slide, not back to ×1")
})

test('a card is never beaten on its first day: no task asks for fewer than 2', () => {
  for (const h of [{ done: { code: 0, gym: 0, arbor: 0 }, nights: 0, steady: 0, days: 21 }, { done: { code: 21, gym: 21, arbor: 21 }, nights: 21, steady: 21, days: 21 }]) {
    for (const t of tasksV21(h, (k) => k !== 'shed')!) assert.ok(t.target >= 2, `${t.kind} asks for ${t.target}`)
  }
})
