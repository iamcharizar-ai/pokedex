// Version 23 (MEGA-OVERHAUL-PLAN.md): Momentum is a ladder, the streak puts Mega Stones on the days of the row, and the streak road goes past the Battle Tower.
//   node --test core/v23.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, type DayFacts, type HabitFact } from './facts.ts'
import { foldGame } from './fold.ts'
import { MOMENTUM_LADDER, MOMENTUM_WINDOW_STEPS, STONE_STREAK, V21_FIX, momentumLadder, setV22Start, setV23Start, v23On } from './rules.ts'
import { BERRY_HEARTS, FEATS, FEATS_LIVE, FORGE_COINS, SHARDS, STREAK_FEATS, featReward } from './economy.ts'
import { SPECIES } from './species.ts'
import { fillOwed, fitsRecipe, forgeRecipe, goodRun, nextStone, recipeMet, recipeOf, type RowStone } from './v23.ts'

const START = V21_FIX
setV22Start(START)

const H = (id: string, tag: HabitFact['tag'], worth: number, done: boolean, extra: Partial<HabitFact> = {}): HabitFact => ({ id, tag, worth, pillar: worth === 100, frac: done ? 1 : 0, done, ...extra })
/** A day with all four pillars and the chores done (a Max day, so certainly a good one). */
const great = (i: number): DayFacts => ({
  day: addDays(START, i),
  habits: [
    H('sleep-before-10', 'sleep', 100, true, { frac: 0.9, measured: true }), H('leetcode-coding', 'code', 100, true), H('gym', 'fitness', 100, true), H('arbor-morning', 'arbor', 100, true),
    ...Array.from({ length: 8 }, (_, k) => H(`chore-${k}`, 'routine', 1, true)),
  ],
  body: { sleepScore: 90, steps: 5000 },
  marks: { workouts: 1, records: 0, clean: 0, owned: 0, gear: [] },
  live: ['sleep', 'code', 'fitness', 'arbor', 'routine'],
})
/** A day with nothing done. */
const idle = (i: number): DayFacts => ({
  day: addDays(START, i),
  habits: [H('leetcode-coding', 'code', 100, false), H('gym', 'fitness', 100, false), H('arbor-morning', 'arbor', 100, false), ...Array.from({ length: 8 }, (_, k) => H(`chore-${k}`, 'routine', 1, false))],
  body: {},
  marks: { workouts: 0, records: 0, clean: 0, owned: 0, gear: [] },
  live: ['code', 'fitness', 'arbor', 'routine'],
})
const week = (pattern: string): DayFacts[] => [...pattern].map((c, i) => (c === '#' ? great(i) : idle(i)))

// ── the ladder ──────────────────────────────────────────────────────────────
test('the ladder: every good day adds a little, the seventh is the leap, and the top of the old steps is unchanged', () => {
  assert.deepEqual([...MOMENTUM_LADDER], [1, 1.02, 1.05, 1.12, 1.21, 1.33, 1.5, 2])
  for (let k = 1; k < MOMENTUM_LADDER.length; k++) assert.ok(MOMENTUM_LADDER[k] > MOMENTUM_LADDER[k - 1], `day ${k} adds something`)
  assert.equal(momentumLadder(0), 1)
  assert.equal(momentumLadder(6), 1.5, 'six good days is what the old top step paid')
  assert.equal(momentumLadder(7), 2)
  assert.equal(momentumLadder(99), 2, 'never past the top')
  assert.equal(momentumLadder(-3), 1)
  // on the owner's real mornings (the count of good days in the seven before: 0 to 6 on 4, 14, 12, 9, 2, 2 and 4 of 47) the mean stays where today's steps keep it
  const hist: Record<number, number> = { 0: 4, 1: 14, 2: 12, 3: 9, 4: 2, 5: 2, 6: 4 }
  const mean = (m: (k: number) => number): number => Object.entries(hist).reduce((n, [k, c]) => n + m(Number(k)) * c, 0) / 47
  const today = (k: number): number => [...MOMENTUM_WINDOW_STEPS].reverse().find(([d]) => k >= d)?.[1] ?? 1
  assert.ok(Math.abs(mean(momentumLadder) - mean(today)) < 0.01, `${mean(momentumLadder)} against ${mean(today)}`)
})

test('before version 23 Momentum is the old steps; from it, the ladder, with one more good day each morning', () => {
  setV23Start('2099-01-01')
  const old = foldGame(Array.from({ length: 10 }, (_, i) => great(i)))
  assert.equal(old.v23, false)
  assert.equal(old.momentum.ladder, undefined)
  assert.deepEqual(old.days.map((d) => d.mult), [1, 1, 1, 1.2, 1.2, 1.35, 1.5, 1.5, 1.5, 1.5], 'the old steps')
  setV23Start(START)
  const g = foldGame(Array.from({ length: 10 }, (_, i) => great(i)))
  assert.equal(g.v23, true)
  assert.deepEqual(g.days.map((d) => d.mult), [1, 1.02, 1.05, 1.12, 1.21, 1.33, 1.5, 2, 2, 2], 'a good day each morning, then the top')
  assert.deepEqual([...(g.momentum.ladder ?? [])], [...MOMENTUM_LADDER])
  // a miss slides it back a day at a time
  const slid = foldGame([...Array.from({ length: 7 }, (_, i) => great(i)), idle(7), idle(8)])
  assert.deepEqual(slid.days.slice(7).map((d) => d.mult), [2, 1.5], 'the seventh good day leaves the window')
  setV23Start('2099-01-01')
})

// ── the row, with no stones (a player with none sees the old row) ───────────
test('the row is the seven days before today, oldest first, with today\'s ring, and nothing on it without stones', () => {
  setV23Start(START)
  const g = foldGame(week('#.##...#.'))
  assert.equal(g.row.length, 7)
  assert.deepEqual(g.row.map((d) => d.day), Array.from({ length: 7 }, (_, n) => addDays(START, n + 1)), 'the seven days before the last one')
  assert.deepEqual(g.row.map((d) => d.counts), [false, true, true, false, false, false, true])
  assert.ok(g.row.every((d) => d.stone === null))
  assert.deepEqual(g.ring, { counts: false, stone: null, next: null })
  assert.deepEqual(g.megas, [])
  // early in the game the days before it began are blank, not missing
  const young = foldGame(week('##'))
  assert.equal(young.row.length, 7)
  assert.deepEqual(young.row.slice(0, 6).map((d) => d.day), ['', '', '', '', '', ''])
  assert.equal(young.row[6].day, addDays(START, 0))
  setV23Start('2099-01-01')
})

// ── the stones on the row (the pure part) ───────────────────────────────────
/** Run the row by hand the way the fold does: at the end of each day a good day that made the streak is owed a stone, and owed days take the next free one. Returns the Megas on each morning. */
function play(pattern: string, owned: RowStone[], seed = (d: number) => `w${Math.floor(d / 7)}`) {
  const good = (k: number): boolean => pattern[k] === '#'
  const rowStone = new Map<number, RowStone>()
  const owed = new Set<number>()
  const mornings: string[][] = []
  for (let i = 0; i < pattern.length; i++) {
    const lit = new Set<string>()
    for (let k = Math.max(0, i - 7); k < i; k++) { const st = rowStone.get(k); if (st) lit.add(st.uid) }
    mornings.push([...lit].sort())
    if (good(i) && goodRun(good, i) >= STONE_STREAK) owed.add(i)
    fillOwed(owed, rowStone, owned, i - 6, i, seed(i))
  }
  return { mornings, rowStone, owed }
}
const stones = (n: number): RowStone[] => Array.from({ length: n }, (_, k) => ({ uid: `mon${k}`, form: `form${k}-mega` }))

test('a cold start: the first three good days are plain, then each good day carries a stone: four Megas on the seventh day, seven on the tenth', () => {
  const { mornings, rowStone } = play('###########', stones(10))
  assert.deepEqual(mornings.map((m) => m.length), [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7])
  assert.equal(rowStone.get(0), undefined)
  assert.equal(rowStone.get(2), undefined)
  assert.ok(rowStone.get(3), 'the fourth good day is the first with a stone')
  assert.equal(STONE_STREAK, 4)
})

test('holding the streak with exactly seven stones: seven stay Megas, the stone leaving the row goes straight to today\'s dot', () => {
  const { mornings } = play('#'.repeat(16), stones(7))
  assert.deepEqual(mornings.slice(10).map((m) => m.length), [7, 7, 7, 7, 7, 7], 'no dip at the top')
  assert.equal(new Set(mornings.slice(10).map((m) => m.join())).size, 1, 'the same seven every day: only the row moves')
})

test('with more than seven stones a different Pokemon takes its turn as the days pass', () => {
  const { mornings } = play('#'.repeat(30), stones(10))
  assert.ok(mornings.slice(10).every((m) => m.length === 7))
  assert.ok(new Set(mornings.slice(10).map((m) => m.join())).size > 1, 'the seven change')
})

test('a break: stones already lit stay until their day leaves the row, and new good days are plain until the count is back to four', () => {
  const { mornings, rowStone } = play('#######.........###', stones(10))
  // days 3 to 6 carry stones; they fade one a day as days 3, 4, 5, 6 leave the row (mornings 10 to 13)
  assert.deepEqual(mornings.slice(7, 15).map((m) => m.length), [4, 4, 4, 4, 3, 2, 1, 0])
  // after the gap three good days (16, 17, 18) never reach four in a window, so they are plain
  assert.ok(![16, 17, 18].some((k) => rowStone.has(k)))
})

test('fewer stones than good days: the extra good days stay plain, and a stone made later takes the newest of them (it stays on the row longest)', () => {
  const two = stones(2)
  const { mornings, owed } = play('#######', two)
  assert.equal(mornings[6].length, 2, 'both stones are lit')
  assert.deepEqual([...owed].sort(), [5, 6], 'the two good days that found no stone are owed one')
  // the same days with a third stone available from the start: the third goes on the oldest owed day
  const rowStone = new Map<number, RowStone>(), owed2 = new Set<number>([4, 5, 6])
  rowStone.set(3, two[0])
  fillOwed(owed2, rowStone, two, 0, 6, 'w0')
  assert.deepEqual([...owed2].sort(), [4, 5], 'one stone was free, so the newest owed day (6) took it')
  assert.ok(rowStone.has(6) && !rowStone.has(4) && !rowStone.has(5))
})

test('a stone forged late sits on the newest good day, so its Pokemon stays a Mega for a full week, not a day', () => {
  const good = (k: number): boolean => k <= 9
  const rowStone = new Map<number, RowStone>()
  const owed = new Set<number>([3, 4, 5, 6, 7, 8, 9])   // good days that made the streak while no stone existed
  const one = stones(1)
  fillOwed(owed, rowStone, one, 9 - 6, 9, 'w1')
  assert.deepEqual([...rowStone.keys()], [9], 'the stone is on today\'s dot')
  // it stays lit on the next seven mornings (days 10 to 16 see day 9 on the row), then moves to the next owed day that is still on the row
  const lit = (morning: number): boolean => rowStone.has(morning - 1) || [...rowStone.keys()].some((k) => k >= morning - 7 && k < morning)
  assert.ok([10, 11, 12, 13, 14, 15, 16].every(lit))
  assert.equal(goodRun(good, 9), 7)
})

test('a Pokemon with two stones is a Mega once at a time', () => {
  const pair: RowStone[] = [{ uid: 'char', form: 'charizard-megax' }, { uid: 'char', form: 'charizard-megay' }, { uid: 'gengar', form: 'gengar-mega' }]
  const { mornings } = play('######', pair)
  assert.ok(mornings.every((m) => new Set(m).size === m.length), 'no Pokemon twice')
  assert.deepEqual(mornings[5].sort(), ['char', 'gengar'], 'one of the pair, then Gengar: the second Charizard stone had to wait')
})

test('the order is the week\'s: the same on every replay, and it changes with the week', () => {
  const owned = stones(8)
  const a = nextStone(owned, new Map(), 0, 6, 'megas:2026-W47'), b = nextStone(owned, new Map(), 0, 6, 'megas:2026-W47')
  assert.deepEqual(a, b)
  const firsts = new Set(Array.from({ length: 12 }, (_, w) => nextStone(owned, new Map(), 0, 6, `megas:2026-W${w}`)!.uid))
  assert.ok(firsts.size > 3, 'different weeks start with different stones')
  assert.equal(nextStone([], new Map(), 0, 6, 'x'), null)
  // every stone is lit: nobody is next
  const row = new Map(owned.map((st, k) => [k, st] as [number, RowStone]))
  assert.equal(nextStone(owned, row, 0, 7, 'x'), null)
})

// ── the road past the Tower ─────────────────────────────────────────────────
test('the streak road: three milestones past the Tower, live only from version 23, paying coins, gems and a keepsake, never a shard', () => {
  assert.deepEqual(STREAK_FEATS.map((f) => f.n), [60, 100, 200])
  assert.ok(FEATS.length >= STREAK_FEATS.length)
  setV23Start('2099-01-01')
  assert.ok(!FEATS_LIVE(START).some((f) => f.id.startsWith('streak')), 'not live before version 23')
  setV23Start(START)
  assert.deepEqual(FEATS_LIVE(START).filter((f) => f.id.startsWith('streak')).map((f) => f.id), ['streak60', 'streak100', 'streak200'])
  for (const f of STREAK_FEATS) {
    const r = featReward(f, START)
    assert.ok((r.coins ?? 0) > 0 && (r.gems ?? 0) > 0, f.id)
    assert.ok(!Object.keys(r.items ?? {}).some((id) => id.endsWith('-shard')), f.id)
  }
  assert.ok(STREAK_FEATS.every((f, k) => k === 0 || (f.reward.coins ?? 0) > (STREAK_FEATS[k - 1].reward.coins ?? 0)), 'each pays more')
  // the Tower pays at 14 and 35 on the same count, so these start beyond it
  assert.ok(Math.min(...STREAK_FEATS.map((f) => f.n)) > 35)
  assert.ok(v23On(START))
  setV23Start('2099-01-01')
})

test('sixty good days in a row pays the first milestone, once, into Collect', () => {
  setV23Start(START)
  const g = foldGame(Array.from({ length: 62 }, (_, i) => great(i)))
  assert.ok(g.feats.some((f) => f.id === 'streak60'), 'two months')
  assert.ok(!g.feats.some((f) => f.id === 'streak100'))
  assert.equal(g.feats.filter((f) => f.id === 'streak60').length, 1, 'once')
  const h = g.held.find((x) => x.key === 'feat:streak60')
  assert.ok(h, 'it waits in Collect')
  assert.equal(h!.coins, 2000)
  setV23Start('2099-01-01')
})

// ── the whole thing through the fold: a forged Mega, on the row, doing its job ──
test('a forged Mega is a Mega only while its stone is on the row: the row shows it, the Lab counts it twice, and it goes back when the streak ends', () => {
  setV23Start(START)
  const N = 320
  const base = Array.from({ length: N }, (_, i) => great(i))
  const g0 = foldGame(base, { instant: true })
  const ch = g0.graduates.find((m) => m.form === 'charizard')!
  assert.ok(ch && ch.graduated && !g0.team.some((m) => m.uid === ch.uid), 'a fully trained Charizard, in the Lab')
  // feed it to a Best Friend (150 hearts) with the berries the days dropped, then forge the stone
  const feeds: { item: string; uid: string; what: string; to?: string }[] = []
  let need = 150 - ((ch.together ?? 0) + (ch.fed ?? 0))
  for (const [item, n] of Object.entries(g0.inv)) if (item in BERRY_HEARTS) for (let k = 0; k < n && need > 0; k++) { feeds.push({ item, uid: ch.uid, what: 'feed' }); need -= 2 }
  const play = (uses: typeof feeds, more: number, tail: (i: number) => DayFacts = great) => foldGame([...base.slice(0, N - 1), { ...base[N - 1], uses }, ...Array.from({ length: more }, (_, i) => tail(N + i))], { instant: true })
  // version 23 forges from the stone's recipe, so the shards are named (three Comets fit any recipe)
  const forge = { item: 'comet-shard,comet-shard,comet-shard', uid: ch.uid, what: 'forge', to: 'charizard-megax' }
  const fed = play(feeds, 3)
  const made = play([...feeds, forge], 3)
  assert.deepEqual(made.graduates.find((m) => m.uid === ch.uid)!.megas, ['charizard-megax'], 'forged')
  // the stone sits on the newest good day, which keeps it on the row longest; nothing is lit before there is a stone
  assert.ok(fed.megas.length === 0 && fed.row.every((d) => d.stone === null), 'no stone, no Mega')
  assert.deepEqual(made.megas, [{ uid: ch.uid, form: 'charizard-megax' }], 'a Mega today')
  assert.equal(made.row.filter((d) => d.stone).length, 1, 'one stone, on one dot')
  assert.equal(made.row.find((d) => d.stone)?.day, base[N - 1].day, 'on the day it was forged (then the newest good day), which keeps it on the row longest')
  // a Lab Mega is worth twice to the Lab (a Charizard at level 50: 50 and 10 for its last form)
  assert.equal(made.lab.strength - fed.lab.strength, 60, 'its worth, once more')
  // the streak holding keeps it a Mega day after day
  const later = play([...feeds, forge], 12)
  assert.deepEqual(later.megas.map((m) => m.uid), [ch.uid], 'still a Mega twelve days on')
  // the streak ending takes it away one day at a time, and nothing is lost: the stone is still its
  const quiet = play([...feeds, forge], 14, (i) => (i < N + 3 ? great(i) : idle(i)))
  assert.deepEqual(quiet.megas, [], 'back to normal once the stone\'s day has left the row')
  assert.deepEqual(quiet.graduates.find((m) => m.uid === ch.uid)!.megas, ['charizard-megax'], 'the stone is kept')
  assert.equal(quiet.lab.strength, fed.lab.strength, 'and the Lab is back to its ordinary strength')
  setV23Start('2099-01-01')
})

// ── the recipes ─────────────────────────────────────────────────────────────
test('every Mega has one recipe of three shards, fixed for good: the same every time, and all three kinds of recipe occur', () => {
  const forms = Object.values(SPECIES).flatMap((s) => s.m ?? [])
  const shape = (r: string[]): 'triple' | 'double' | 'trio' => (new Set(r).size === 1 ? 'triple' : new Set(r).size === 2 ? 'double' : 'trio')
  const count = { triple: 0, double: 0, trio: 0 }
  for (const f of forms) {
    const r = recipeOf(f)
    assert.equal(r.length, 3, f)
    assert.ok(r.every((k) => (SHARDS as readonly string[]).includes(k)), `${f}: colours only, never a Comet`)
    assert.deepEqual(recipeOf(f), r, `${f} is not the same twice`)
    count[shape(r)]++
  }
  assert.equal(forms.length, 70)
  assert.ok(count.triple >= 4 && count.double >= 20 && count.trio >= 10, JSON.stringify(count))
  assert.equal(recipeOf('charizard-megax').join(), recipeOf('charizard-megax').join())
  assert.ok(new Set(forms.map((f) => recipeOf(f).join())).size > 8, 'the recipes differ from stone to stone')
})

test('what fits a recipe: a Comet fits any place, a colour only as often as the recipe has it, never more than three', () => {
  const rb = ['red-shard', 'red-shard', 'blue-shard']
  assert.ok(fitsRecipe([], rb))
  assert.ok(fitsRecipe(['red-shard'], rb) && fitsRecipe(['red-shard', 'red-shard'], rb) && fitsRecipe(['blue-shard', 'red-shard'], rb))
  assert.ok(!fitsRecipe(['blue-shard', 'blue-shard'], rb), 'only one blue')
  assert.ok(!fitsRecipe(['red-shard', 'red-shard', 'red-shard'], rb), 'only two red')
  assert.ok(!fitsRecipe(['green-shard'], rb), 'green is not in it')
  assert.ok(fitsRecipe(['comet-shard', 'comet-shard', 'comet-shard'], rb), 'three Comets are fine')
  assert.ok(fitsRecipe(['comet-shard', 'blue-shard', 'red-shard'], rb) && recipeMet(['comet-shard', 'blue-shard', 'red-shard'], rb))
  assert.ok(!fitsRecipe(['comet-shard', 'blue-shard', 'red-shard', 'red-shard'], rb), 'not four')
  assert.ok(!recipeMet(['red-shard', 'red-shard'], rb), 'two of three is not met')
  assert.ok(recipeMet(['red-shard', 'comet-shard', 'red-shard'], rb))
  const inv = { 'red-shard': 2, 'blue-shard': 1, 'comet-shard': 1 }
  assert.deepEqual(forgeRecipe(inv, 'red-shard,red-shard,blue-shard', rb), ['red-shard', 'red-shard', 'blue-shard'])
  assert.equal(forgeRecipe(inv, 'red-shard,red-shard,red-shard', rb), null, 'not the recipe')
  assert.equal(forgeRecipe({ 'red-shard': 1, 'blue-shard': 1 }, 'red-shard,red-shard,blue-shard', rb), null, 'a shard that is not held')
  assert.equal(forgeRecipe(inv, undefined, rb), null, 'it must say which shards')
  assert.deepEqual(forgeRecipe(inv, 'comet-shard,red-shard,blue-shard', rb), ['comet-shard', 'red-shard', 'blue-shard'])
})

test('forging under the recipe rule: only the stone\'s own shards are accepted, exactly those are spent (a Comet standing in for any), and the coins go', () => {
  setV23Start(START)
  const N = 320
  const base = Array.from({ length: N }, (_, i) => great(i))
  const g0 = foldGame(base, { instant: true })
  const ch = g0.graduates.find((m) => m.form === 'charizard')!
  const feeds: { item: string; uid: string; what: string; to?: string }[] = []
  let need = 150 - ((ch.together ?? 0) + (ch.fed ?? 0))
  for (const [item, n] of Object.entries(g0.inv)) if (item in BERRY_HEARTS) for (let k = 0; k < n && need > 0; k++) { feeds.push({ item, uid: ch.uid, what: 'feed' }); need -= 2 }
  const at = (uses: typeof feeds) => foldGame([...base.slice(0, N - 1), { ...base[N - 1], uses }, great(N)], { instant: true })
  const before = at(feeds)
  const recipe = recipeOf('charizard-megax')
  // the recipe as a player with these shards would place it: a colour they hold, otherwise a Comet
  const left: Record<string, number> = { ...before.inv }
  const kinds = recipe.map((c) => { if ((left[c] ?? 0) > 0) { left[c]--; return c } left['comet-shard']--; return 'comet-shard' })
  const forge = (item: string) => ({ item, uid: ch.uid, what: 'forge', to: 'charizard-megax' })
  const made = at([...feeds, forge(kinds.join(','))])
  assert.deepEqual(made.graduates.find((m) => m.uid === ch.uid)!.megas, ['charizard-megax'], 'forged')
  for (const k of new Set(kinds)) assert.equal((before.inv[k] ?? 0) - (made.inv[k] ?? 0), kinds.filter((x) => x === k).length, `${k} spent`)
  assert.equal(before.wallet.coins - made.wallet.coins, FORGE_COINS, 'and the fee')
  // a Comet in every place is also a recipe
  const three = at([...feeds, forge('comet-shard,comet-shard,comet-shard')])
  assert.deepEqual(three.graduates.find((m) => m.uid === ch.uid)!.megas, ['charizard-megax'], 'three Comets')
  assert.equal((before.inv['comet-shard'] ?? 0) - (three.inv['comet-shard'] ?? 0), 3)
  // shards that are not the recipe are refused, and nothing is spent
  const other = (SHARDS as readonly string[]).find((c) => !recipe.includes(c))
  if (other) {
    const wrong = at([...feeds, forge(`${other},${other},${other}`)])
    assert.equal(wrong.graduates.find((m) => m.uid === ch.uid)!.megas, undefined, 'refused')
    assert.equal(wrong.wallet.coins, before.wallet.coins, 'no coins taken')
  }
  const noKinds = at([...feeds, forge('')])
  assert.equal(noKinds.graduates.find((m) => m.uid === ch.uid)!.megas, undefined, 'it must say which shards')
  setV23Start('2099-01-01')
})
