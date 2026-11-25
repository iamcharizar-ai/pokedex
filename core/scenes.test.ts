// Scenes (core/places.ts, SCENES_START): the wild Pokemon turn up only in the places you own, the Meadow is free, a scene is bought once for gems,
// and locking a scene changes only the look.
//   node --test core/scenes.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { V21_FIX, setScenesStart, setV22Start } from './rules.ts'
import { RARE_V22, RARE_V24, ITEMS, offerFor } from './economy.ts'
import { BUYABLE_PLACES, CAVE_FOLK, PLACE_INFO, biomeOfForm, placeFolk, placeOfScene, sceneItem } from './places.ts'
import { SPECIES } from './species.ts'

const START = V21_FIX
setV22Start(START)
setScenesStart(START)

const H = (id: string, tag: HabitFact['tag'], worth: number, done: boolean, extra: Partial<HabitFact> = {}): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac: done ? 1 : 0, done, ...extra })
const max = (i: number, uses?: DayFacts['uses']): DayFacts => ({
  day: addDays(START, i),
  habits: [
    H('sleep-before-10', 'sleep', 100, true, { frac: 0.9, measured: true }), H('leetcode-coding', 'code', 100, true), H('gym', 'fitness', 100, true), H('arbor-morning', 'arbor', 100, true),
    ...Array.from({ length: 8 }, (_, k) => H(`chore-${k}`, 'routine', 1, true)),
  ],
  body: { sleepScore: 90, steps: 5000 },
  marks: { workouts: 1, records: 0, clean: 0, owned: 0, gear: [] },
  live: ['sleep', 'code', 'fitness', 'arbor', 'routine'],
  ...(uses ? { uses } : {}),
})
const run = (n: number, uses: Record<number, DayFacts['uses']> = {}): DayFacts[] => Array.from({ length: n }, (_, i) => max(i, uses[i]))
const u = (day: number, what: string, item = '', to = '') => ({ day: addDays(START, day), what, item, uid: '', ...(to ? { to } : {}) })
const appears = (g: ReturnType<typeof foldGame>) => g.moments.flatMap((m) => (m.kind === 'appear' ? [{ day: m.day, form: m.form, rarity: m.rarity as string }] : []))
const ordinary = (g: ReturnType<typeof foldGame>) => appears(g).filter((a) => a.rarity !== 'L')

test('the places: every wild Pokemon belongs to one, the cave-dwellers to the Cave, and the Meadow is the free one', () => {
  assert.equal(PLACE_INFO.meadow.gems, 0)
  assert.equal(BUYABLE_PLACES.length, 12)
  assert.ok(!BUYABLE_PLACES.includes('meadow'))
  for (const id of CAVE_FOLK) assert.equal(biomeOfForm(id), 'cave', id)
  assert.equal(biomeOfForm('magnemite'), 'plain')
  assert.equal(biomeOfForm('pidgey'), 'cliff')
  assert.equal(biomeOfForm('bulbasaur'), 'meadow')
  // every place has someone to meet in it, and nobody is met nowhere
  for (const b of Object.keys(PLACE_INFO) as (keyof typeof PLACE_INFO)[]) assert.ok(placeFolk(b).length >= 4, `${b} has ${placeFolk(b).length}`)
  assert.ok(placeFolk('cave').some((id) => (SPECIES[id].g ?? 9) === 1), 'the Cave has someone at the start')
})

test('the shop sells one scene for every place but the Meadow, and the old three are gone from it', () => {
  assert.ok(RARE_V22.some((o) => o.item === 'theme-night'), 'before the scenes, Starry night was for sale')
  assert.ok(!RARE_V24.some((o) => o.item.startsWith('theme-')))
  const scenes = RARE_V24.filter((o) => o.item.startsWith('scene-'))
  assert.deepEqual(scenes.map((o) => o.item), BUYABLE_PLACES.map(sceneItem))
  for (const o of scenes) assert.equal(ITEMS[o.item].kind, 'theme')
  assert.ok(!scenes.some((o) => o.item === 'scene-meadow'))
  assert.equal(offerFor('rare', 'scene-shore', START, 0)?.offer.gems, PLACE_INFO.shore.gems)
  assert.equal(offerFor('rare', 'theme-beach', START, 0), null, 'not for sale from the first day of scenes')
  assert.deepEqual(placeOfScene('scene-ruins'), 'ruins')
  assert.equal(placeOfScene('theme-beach'), null)
})

test('with no scene bought, only the Meadow turns up; a scene bought lets its Pokemon come', () => {
  const none = foldGame(run(160), { instant: true })
  const seen = ordinary(none)
  assert.ok(seen.length >= 5, `${seen.length} wild Pokemon appeared`)
  for (const a of seen) assert.equal(biomeOfForm(a.form), 'meadow', `${a.form} on ${a.day}`)

  // every place bought on the first day: Pokemon of other places turn up too
  const buys = BUYABLE_PLACES.map((b) => u(0, 'buy', sceneItem(b), 'rare'))
  const rich = foldGame(run(160, { 0: buys }), { instant: true })
  // the gems for all twelve are not there on day one: what was bought is what the purse could pay, in the shop's own order
  const bought = BUYABLE_PLACES.filter((b) => (rich.inv[sceneItem(b)] ?? 0) > 0)
  assert.equal(bought.length, 0, 'day one has no gems to spend, so nothing is bought and nothing opens')

  // gems for one scene: buy it on day 40 and the place opens for the spawns after it
  const g40 = foldGame(run(40), { instant: true })
  assert.ok(g40.wallet.gems >= PLACE_INFO.shore.gems, `${g40.wallet.gems} gems by day 40`)
  const shop = foldGame(run(160, { 40: [u(40, 'buy', 'scene-shore', 'rare')] }), { instant: true })
  assert.equal(shop.inv['scene-shore'], 1)
  // the day it is bought it costs its gems and nothing else (later days differ: other Pokemon bring other things)
  assert.equal(foldGame(run(41, { 40: [u(40, 'buy', 'scene-shore', 'rare')] }), { instant: true }).wallet.gems, foldGame(run(41), { instant: true }).wallet.gems - PLACE_INFO.shore.gems)
  const after = ordinary(shop).filter((a) => a.day > addDays(START, 40))
  assert.ok(after.some((a) => biomeOfForm(a.form) === 'shore'), 'a Water Pokemon turns up once the Beach is bought')
  for (const a of after) assert.ok(['meadow', 'shore'].includes(biomeOfForm(a.form)), `${a.form} on ${a.day}`)
  // and the days before the purchase are the days they were
  assert.deepEqual(ordinary(shop).filter((a) => a.day <= addDays(START, 40)), seen.filter((a) => a.day <= addDays(START, 40)))
})

test('before SCENES_START the wild Pokemon come from everywhere, as they always did', () => {
  setScenesStart(addDays(START, 80))
  const g = foldGame(run(160), { instant: true })
  setScenesStart(START)
  const early = ordinary(g).filter((a) => a.day < addDays(START, 80))
  assert.ok(early.some((a) => biomeOfForm(a.form) !== 'meadow'), 'the days before it are not gated')
  const late = ordinary(g).filter((a) => a.day >= addDays(START, 80))
  for (const a of late) assert.equal(biomeOfForm(a.form), 'meadow', `${a.form} on ${a.day}`)
})

test('locking a scene changes the look and nothing else: the Meadow is always yours, another only once bought', () => {
  const base = foldGame(run(45), { instant: true })
  assert.equal(base.scenes, true)
  assert.equal(base.theme, '')
  // the Meadow can be locked at once; a place not bought cannot
  assert.equal(foldGame(run(45, { 44: [u(44, 'theme', '', '')] }), { instant: true }).theme, '')
  assert.equal(foldGame(run(45, { 44: [{ ...u(44, 'theme'), to: 'scene-meadow' }] }), { instant: true }).theme, 'scene-meadow')
  assert.equal(foldGame(run(45, { 44: [{ ...u(44, 'theme'), to: 'scene-shore' }] }), { instant: true }).theme, '', 'not bought, not locked')
  const bought = foldGame(run(45, { 41: [u(41, 'buy', 'scene-shore', 'rare')], 42: [{ ...u(42, 'theme'), to: 'scene-shore' }] }), { instant: true })
  assert.equal(bought.theme, 'scene-shore')
  // who turns up does not depend on what is locked
  const locked = foldGame(run(160, { 41: [u(41, 'buy', 'scene-shore', 'rare')], 42: [{ ...u(42, 'theme'), to: 'scene-shore' }] }), { instant: true })
  const unlocked = foldGame(run(160, { 41: [u(41, 'buy', 'scene-shore', 'rare')] }), { instant: true })
  assert.deepEqual(appears(locked), appears(unlocked))
  // letting it rotate again
  const back = foldGame(run(45, { 41: [u(41, 'buy', 'scene-shore', 'rare')], 42: [{ ...u(42, 'theme'), to: 'scene-shore' }], 43: [u(43, 'theme')] }), { instant: true })
  assert.equal(back.theme, '')
})
