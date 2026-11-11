// Version 22, steps 4 and 5 (GAME-SPEC-V22.md sections 5 to 9): the Lab, hearts and the Trainer, level 50, the shops, the Nursery.
//   node --test core/v22b.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact, type ItemUse } from './facts.ts'
import { canCandy, foldGame } from './fold.ts'
import { FIXTURES, fixture } from '../src/lib/fixtures.ts'
import { ingest } from '../src/lib/ingest.ts'
import { buildFacts } from './facts.ts'
import { LAB_BASE, V21_FIX, V22_START, setV22Start, trainerLevelV22 } from './rules.ts'
import { BALLS_V22, FOSSIL_STEPS, HELD_V22, MART_V22, PICKUP_V22, RARE_V22, convertV22, eggNeed, inNursery, keptV22, labCost, labReward, offerFor, throwHp, trainerOptions } from './economy.ts'

const START = V21_FIX
setV22Start(START)

const H = (id: string, tag: HabitFact['tag'], worth: number, done: boolean, extra: Partial<HabitFact> = {}): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac: done ? 1 : 0, done, ...extra })
type Did = { code?: boolean; gym?: boolean; arbor?: boolean; sleep?: boolean }
const day = (i: number, did: Did, chores = 4, uses: Omit<ItemUse, 'day'>[] = [], steps = 5000): DayFacts => ({
  day: addDays(START, i),
  habits: [
    H('sleep-before-10', 'sleep', 100, Boolean(did.sleep), { frac: did.sleep ? 0.9 : 0, measured: true }),
    H('leetcode-coding', 'code', 100, Boolean(did.code)), H('gym', 'fitness', 100, Boolean(did.gym)), H('arbor-morning', 'arbor', 100, Boolean(did.arbor)),
    ...Array.from({ length: 8 }, (_, k) => H(`chore-${k}`, 'routine', 1, k < chores)),
  ],
  body: { sleepScore: did.sleep ? 90 : 60, steps },
  marks: { workouts: did.gym ? 1 : 0, records: 0, clean: 0, owned: 0, gear: [] },
  live: ['sleep', 'code', 'fitness', 'arbor', 'routine'],
  uses: uses.map((u) => ({ ...u, day: addDays(START, i) })),
})
const all: Did = { code: true, gym: true, arbor: true, sleep: true }
const run = (n: number, did: Did = all, chores = 8, per?: (i: number) => Omit<ItemUse, 'day'>[]): DayFacts[] => Array.from({ length: n }, (_, i) => day(i, did, chores, per?.(i) ?? []))

test('the Lab: everyone outside the party researches, a day pays the pillars done times (20 + the Lab), and ranks pay for ever', () => {
  const g = foldGame(run(8))
  assert.ok(g.lab.members > 0, 'catches go to the Lab')
  assert.ok(g.lab.strength >= g.lab.members) // a Lv 1 is worth at least 1
  assert.equal(g.research.desk.length, 0) // no desk with seats
  // research on a day of four pillars: 4 x (20 + the Lab's strength)
  const first = foldGame(run(1))
  assert.equal(first.lab.today, 4 * (LAB_BASE + first.lab.strength))
  // rank 1 costs 500 and pays 200 coins; rank 2 costs 600 and a berry of your choice; the screen shows the next three in advance
  assert.equal(labCost(0), 175)
  assert.equal(labCost(1), 200)
  assert.equal(labReward(1).coins, 200)
  assert.ok(labReward(2).choice)
  assert.equal(labReward(3).items[0][0], 'rare-candy')
  assert.equal(labReward(4).items[0][0], 'full-incense')
  assert.equal(labReward(5).items[0][0], 'rare-egg')
  assert.ok(labReward(10).items.some(([id]) => id === 'comet-shard'), 'every tenth rank a Comet Shard on top')
  const many = foldGame(run(30))
  assert.ok(many.research.rank >= 3, `rank ${many.research.rank}`)
  assert.equal(many.lab.next.length, 3)
  // a night alone, or chores alone: no effort pillar, no research
  assert.equal(foldGame([day(0, { sleep: true }, 8)]).lab.today, 0)
})

test('hearts: a work day is one heart, berries the rest, and every hundred Trainer hearts is a Trainer level that pays a choice', () => {
  const me = `charmander.${START}`
  // Charmander is a Fire type: it likes the Gym's berry (5 hearts), and every Max day drops one
  const g = foldGame(run(18, all, 8, () => [{ what: 'feed', item: 'kelpsy-berry', uid: me }]))
  const hearts = (g.partner.together ?? 0) + (g.partner.fed ?? 0)
  assert.ok(hearts >= 100, `${hearts}`)
  assert.equal(g.trainer.level, trainerLevelV22(g.trainer.hearts))
  assert.ok(g.trainer.level >= 1)
  const reward = g.held.find((h) => h.key === 'trainer:1')
  assert.ok(reward?.choice, 'a choice of two waits')
  assert.deepEqual(trainerOptions(1).map((o) => o.name), reward!.choice!.map((o) => o.name))
  assert.equal(g.trainer.next, (g.trainer.level + 1) * 100) // no last level
  // none of the old hearts: no tier hearts, nothing from the party's work
  const one = foldGame([day(0, { code: true })])
  assert.equal((one.partner.together ?? 0) + (one.partner.fed ?? 0), 1)
})

test('level 50 is the end: a fully trained Pokemon takes no candy and cannot lead again; the next steps up from the party, else the Lab', () => {
  const g = foldGame(run(34))
  assert.ok(g.graduates.length >= 1, 'a partner was fully trained')
  const done = g.graduates[0]
  assert.equal(canCandy(g, done.uid, addDays(START, 33)), false)
  assert.equal(canCandy(g, g.partner.uid, addDays(START, 33)), true)
  assert.ok(!g.partner.graduated)
  const led = foldGame([...run(34), day(34, {}, 8, [{ what: 'lead', item: '', uid: done.uid }])])
  assert.equal(led.partner.uid === done.uid, false, 'a fully trained Pokemon does not lead again')
})

test('the shops: two of them, nothing sold out for the day, no marks, balls in ticks', () => {
  const d = addDays(START, 3)
  assert.ok(offerFor('mart', 'great-ball', d, 3))
  assert.equal(offerFor('fitness', 'heavy-ball', d, 3), null) // the marks shops are gone
  assert.equal(offerFor('bp', 'expert-belt', d, 3), null) // and the BP Exchange
  assert.equal(offerFor('mart', 'ultra-ball', d, 3), null) // ten balls cut
  assert.ok(offerFor('rare', 'everstone', d, 3) && offerFor('rare', 'rare-candy', d, 3))
  assert.ok(MART_V22.some((o) => o.item === 'nursery-place'))
  for (const id of Object.keys(HELD_V22)) assert.ok(RARE_V22.some((o) => o.item === id), id)
  // a stronger ball is never the worse buy
  const wild = { types: ['Normal', undefined], from: addDays(START, 0), owned: false }
  const great = throwHp('great-ball', wild, d), quick = throwHp('quick-ball', wild, START), timer = throwHp('timer-ball', wild, addDays(START, 10))
  assert.ok(great === 12 && quick === 24 && timer === 4 + 4 * 10)
  assert.equal(throwHp('master-ball', wild, d), 1_000_000)
  // bought the same day twice: fine
  const buy = { what: 'buy', item: 'great-ball', to: 'mart', uid: '' }
  const g = foldGame([...run(3, all, 8), day(3, {}, 8, [buy, buy])], { instant: true })
  const before = foldGame([...run(3, all, 8), day(3, {}, 8)], { instant: true })
  assert.equal((g.inv['great-ball'] ?? 0) - (before.inv['great-ball'] ?? 0), 2)
})

test('what is cut is paid back: a Great Ball for a ball, a Tamato Berry for a berry, a price for the rest', () => {
  assert.deepEqual(convertV22('great-ball', 2), { items: [['great-ball', 2]], coins: 0, gems: 0 })
  assert.deepEqual(convertV22('ultra-ball', 3), { items: [['great-ball', 3]], coins: 0, gems: 0 })
  assert.deepEqual(convertV22('oran-berry', 4), { items: [['tamato-berry', 4]], coins: 0, gems: 0 })
  assert.equal(convertV22('pearl', 2).coins, 120) // a treasure: the Collector's price
  assert.ok(convertV22('x-attack-3', 1).coins > 0)
  assert.equal(convertV22('life-orb', 1).coins, 300) // an earned keepsake
  assert.ok(keptV22('red-shard') && keptV22('comet-shard') && keptV22('key-stone') && keptV22('rare-egg') && keptV22('helix-fossil') && keptV22('fire-stone') && keptV22('red-orb') && keptV22('amulet-coin'))
  assert.ok(!keptV22('ultra-ball') && !keptV22('tm-fire') && !keptV22('calcium') && !keptV22('revive'))
  for (const id of BALLS_V22) assert.ok(keptV22(id))
  // on the first day of version 22 nothing the game no longer has stays in the Bag, and nothing is lost for nothing
  for (const name of FIXTURES) {
    const f = fixture(name)!
    const facts = buildFacts(ingest(f.events, f.config, f.today))
    const was = V22_START
    try {
      setV22Start('2099-01-01')
      const before = foldGame(facts)
      setV22Start(f.today)
      const after = foldGame(facts)
      for (const id of Object.keys(after.inv)) assert.ok(after.inv[id] <= 0 || keptV22(id), `${name}: ${id} is still in the Bag`)
      assert.ok(after.wallet.coins >= before.wallet.coins, `${name}: coins went down`)
      assert.equal(after.partner.uid, before.partner.uid)
      // everyone owned before is still owned (a catch today may differ: the wild Pokemon is worn down by ticks now)
      const owned = new Set([after.partner, ...after.queue, ...after.graduates].map((m) => m.uid))
      for (const m of [before.partner, ...before.queue, ...before.graduates]) if (!m.uid.endsWith(f.today) && !m.uid.includes(`.${f.today}`)) assert.ok(owned.has(m.uid), `${name}: ${m.uid} was lost`)
    } finally { setV22Start(was) }
  }
})

test('the Nursery: a fossil is revived by walking like an egg, and an egg of a track hatches from steps alone', () => {
  assert.equal(inNursery('helix-fossil'), true)
  assert.equal(eggNeed('helix-fossil', START, false), FOSSIL_STEPS)
  assert.equal(eggNeed('helix-fossil', START, true), FOSSIL_STEPS * 0.8) // the Old Charm, held
  // seven days of Code, the egg chosen from the track's prize (claim 1), and 60,000 steps
  const week = Array.from({ length: 7 }, (_, i) => day(i, { code: true }))
  const claim = day(7, {}, 4, [{ what: 'claim', item: '1', uid: '', to: 'track:code:1' }], 25000)
  const g = foldGame([...week, claim, day(8, {}, 4, [], 25000), day(9, {}, 4, [], 25000)])
  assert.ok(g.moments.some((m) => m.kind === 'hatch' && m.egg === 'egg-code'), 'the Code egg hatched')
  assert.equal(g.egg, null)
  assert.equal(g.egg2, null)
})

test('Pickup finds only what is used as it is: coins, a berry, a ball, a Rare Candy, a stone or a fossil', () => {
  const ids = new Set(PICKUP_V22.map(([id]) => id))
  const g = foldGame(run(60, { code: true, gym: true }, 4))
  const finds = g.days.map((d) => d.find).filter(Boolean) as string[]
  assert.ok(finds.length > 0, 'the partner found something')
  for (const f of finds) assert.ok(f === 'coin' || ids.has(f), f)
})
