// Version 22, step 6 (GAME-SPEC-V22.md section 10): feats are milestones, rewards are paid at once, no quests or season, the Pyramid counts Max days,
// every Champion hands over a Legend key, every legend is one deed.
//   node --test core/v22c.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { CLAIM_AUTO, V21_FIX, setV22Start } from './rules.ts'
import { FEATS, FEATS_LIVE, LEGEND_DEEDS, LEGEND_KEYS, REMATCH_KEYS, championKey, featReward } from './economy.ts'
import { FACILITIES, SILVER_GEMS } from './frontier.ts'
import { LEAGUES } from './gyms.ts'

const START = V21_FIX
setV22Start(START)

const H = (id: string, tag: HabitFact['tag'], worth: number, done: boolean, extra: Partial<HabitFact> = {}): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac: done ? 1 : 0, done, ...extra })
const max = (i: number): DayFacts => ({
  day: addDays(START, i),
  habits: [
    H('sleep-before-10', 'sleep', 100, true, { frac: 0.9, measured: true }), H('leetcode-coding', 'code', 100, true), H('gym', 'fitness', 100, true), H('arbor-morning', 'arbor', 100, true),
    ...Array.from({ length: 8 }, (_, k) => H(`chore-${k}`, 'routine', 1, true)),
  ],
  body: { sleepScore: 90, steps: 5000 },
  marks: { workouts: 1, records: 0, clean: 0, owned: 0, gear: [] },
  live: ['sleep', 'code', 'fitness', 'arbor', 'routine'],
})
const run = (n: number): DayFacts[] => Array.from({ length: n }, (_, i) => max(i))

test('feats are milestones: the runs go, the week that pays the Key Stone stays, and no feat pays a shard', () => {
  const live = FEATS_LIVE(START)
  assert.ok(live.length < FEATS.length)
  assert.deepEqual(live.filter((f) => f.group === 'run').map((f) => f.id), ['work7'])
  for (const f of live) assert.ok(!Object.keys(featReward(f, START).items ?? {}).some((id) => id.endsWith('-shard')), f.id)
  const g = foldGame(run(9))
  assert.ok(g.feats.some((f) => f.id === 'work7'), 'a week running: the Key Stone')
  assert.ok(!g.feats.some((f) => f.id.startsWith('run7-') || f.id === 'work14'), 'no run feats')
  assert.ok(g.held.some((h) => h.key === 'feat:work7'), 'the Key Stone waits in Collect')
  assert.equal(foldGame(run(9), { instant: true }).inv['key-stone'], 1, 'and is in the Bag once collected')
})

test('every reward waits in Collect until it is tapped (12 Nov 2026: the owner reversed "paid at once"); no weekly quests, no season ladder', () => {
  const g = foldGame(run(2))
  const pay = g.held.find((h) => h.key === `pay:${START}`)
  assert.ok(pay && !pay.choice && pay.coins > 0, 'the day\'s pay waits in Collect, plain')
  assert.equal(g.wallet.coins, foldGame(run(2), { instant: true }).wallet.coins - g.held.reduce((n, h) => n + h.coins, 0), 'what waits is not in the wallet yet')
  assert.ok(!g.moments.some((m) => m.kind === 'quest' || m.kind === 'season'))
  // a claim pays it
  const claimed = foldGame(run(2).map((f, i) => (i === 1 ? { ...f, uses: [{ day: f.day, item: '', uid: '', what: 'claim', to: pay.key }] } : f)))
  assert.ok(!claimed.held.some((h) => h.key === pay.key))
  assert.equal(claimed.wallet.coins, g.wallet.coins + pay.coins)
  // left alone it pays itself after CLAIM_AUTO days, so nothing is lost
  assert.ok(!foldGame(run(1 + CLAIM_AUTO)).held.some((h) => h.key === pay.key))
})

test('the Battle Frontier is the one streak system: the Pyramid counts Max days, and a Symbol pays gems, never Battle Points', () => {
  const g = foldGame(run(8))
  const pyramid = g.frontier.find((f) => f.id === 'pyramid')!
  assert.ok(pyramid.wins >= 5, `${pyramid.wins} Max days`)
  assert.ok(g.moments.some((m) => m.kind === 'symbol' && m.facility === 'pyramid' && m.tier === 'silver'))
  assert.equal(g.wallet.bp, 0)
  assert.ok(g.wallet.gems >= SILVER_GEMS)
})

test('every legend is one deed: a Gold Symbol or a Champion, and the Champions come round ten to a lap', () => {
  const symbols = Object.values(LEGEND_DEEDS).filter((d) => d.kind === 'symbol')
  assert.equal(symbols.length, FACILITIES.length)
  const first = LEAGUES.map((_, i) => championKey(0, i))
  assert.equal(new Set(first).size, LEAGUES.length, 'ten Champions, ten different keys')
  assert.equal(championKey(1, 0), REMATCH_KEYS[LEAGUES.length % REMATCH_KEYS.length])
  for (const k of first) assert.ok(k in LEGEND_KEYS && k in LEGEND_DEEDS, k)
  assert.deepEqual(LEGEND_DEEDS[first[3]], { kind: 'champion', league: 3, lap: 0 })
  // keys with no deed exist as items but are not offered
  assert.ok(Object.keys(LEGEND_KEYS).some((k) => !(k in LEGEND_DEEDS)))
})

test('the first Champion hands over a Legend key on the first lap, not only on the Rematch', () => {
  const g = foldGame(run(170))
  const champion = g.moments.find((m) => m.kind === 'gym' && m.league === 0 && m.slot === LEAGUES[0].gyms.length + 4)
  assert.ok(champion, `the Kanto Champion fell (${g.moments.filter((m) => m.kind === 'gym').length} leaders down)`)
  assert.ok((g.inv[championKey(0, 0)] ?? 0) >= 1, 'the key is in the Bag')
  assert.ok(!g.moments.some((m) => m.kind === 'feat' && m.id === 'rank2'), 'a first-lap Champion is not a Rematch')
  assert.equal(g.counters.rematch ?? 0, 0)
  assert.ok(!Object.keys(g.inv).some((id) => id.endsWith('-plate')), 'no Type Plates')
})
