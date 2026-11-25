// The Forge's state machine and its sequence (src/screens/forge/machine.ts): what can be placed where, when the shards float, when the forge is paid.
//   node --test tools/forge.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { BEATS, GENTLE_LENGTH, LENGTH, beatAt, firstEmpty, guidance, idle, placed, recipeText, reduce, trayFill, trayView, whyNotPlace } from '../src/screens/forge/machine.ts'

const RR_B = ['red-shard', 'red-shard', 'blue-shard']
const held = { 'red-shard': 2, 'blue-shard': 1, 'green-shard': 3, 'comet-shard': 1 }
const pick = { uid: 'char', form: 'charizard-megax' }
const go = (s, ...actions) => actions.reduce((st, a) => { const r = reduce(st, a); assert.ok(r.ok, `${JSON.stringify(a)} refused: ${r.why}`); return r.state }, s)
const place = (kind, socket) => ({ t: 'place', kind, socket, held })
const chosen = () => go(idle(), { t: 'choose', pick, recipe: RR_B })

test('nothing can be placed before a Mega is chosen', () => {
  const r = reduce(idle(), place('red-shard'))
  assert.equal(r.ok, false); assert.equal(r.why, 'no-pick')
})

test('choosing shows the recipe and three empty sockets', () => {
  const s = chosen()
  assert.equal(s.phase, 'chosen'); assert.deepEqual(s.recipe, RR_B); assert.deepEqual(s.sockets, [null, null, null])
  assert.equal(guidance(s, { keyStone: true, coins: 5000, fee: 1500 }), 'Place the shards of its recipe. A Comet fits any place.')
})

test('a shard of the recipe snaps into the first empty socket, clockwise from the top; dropping on a socket picks it', () => {
  let s = chosen()
  s = go(s, place('red-shard'))
  assert.deepEqual(s.sockets, ['red-shard', null, null])
  s = go(s, place('blue-shard', 2))
  assert.deepEqual(s.sockets, ['red-shard', null, 'blue-shard'])
  assert.equal(firstEmpty(s), 1)
  assert.equal(guidance(s, { keyStone: true, coins: 5000, fee: 1500 }), '2 of 3 placed.')
})

test('what is refused, and why', () => {
  let s = go(chosen(), place('red-shard', 0))
  assert.equal(whyNotPlace(s, 'green-shard', held), 'not-in-recipe')
  assert.equal(whyNotPlace(s, 'red-shard', held, 0), 'socket-taken')
  assert.equal(whyNotPlace(s, 'blue-shard', held, 5), 'bad-socket')
  assert.equal(whyNotPlace(s, 'yellow-shard', { ...held, 'yellow-shard': 1 }), 'not-in-recipe')
  assert.equal(whyNotPlace(s, 'yellow-shard', held), 'not-held', 'a shard that is not held is said to be missing first')
  s = go(s, place('blue-shard'))
  assert.equal(whyNotPlace(s, 'blue-shard', { ...held, 'blue-shard': 3 }), 'not-in-recipe', 'only one blue in the recipe, however many are held')
  assert.equal(whyNotPlace(s, 'blue-shard', held), 'not-held', 'and with one held, the one that is placed is all there is')
  // a shard the player does not hold (here the blue was placed, so none is left even if the recipe had room)
  assert.equal(whyNotPlace(go(chosen(), place('red-shard')), 'red-shard', { 'red-shard': 1 }), 'not-held', 'the only red is already placed')
  assert.equal(reduce(s, place('red-shard')).ok, true)
  // a refusal leaves the state as it was
  const r = reduce(s, place('green-shard'))
  assert.equal(r.ok, false); assert.deepEqual(r.state, s)
})

test('a Comet fits any place, and three Comets are a recipe', () => {
  let s = chosen()
  s = go(s, place('comet-shard'))
  assert.equal(whyNotPlace(s, 'comet-shard', held), 'not-held', 'only one Comet is held')
  assert.equal(whyNotPlace(s, 'comet-shard', { ...held, 'comet-shard': 3 }), null)
  s = go(s, { t: 'place', kind: 'comet-shard', held: { ...held, 'comet-shard': 3 } })
  assert.equal(placed(s).length, 2)
})

test('the tray fills as shards go in: a colour its own place, a Comet any place left', () => {
  assert.deepEqual(trayFill(RR_B, []), [false, false, false])
  assert.deepEqual(trayFill(RR_B, ['blue-shard']), [false, false, true])
  assert.deepEqual(trayFill(RR_B, ['red-shard', 'comet-shard']), [true, true, false])
  assert.deepEqual(trayFill(RR_B, ['comet-shard', 'comet-shard', 'comet-shard']), [true, true, true])
  assert.deepEqual(trayFill(RR_B, ['red-shard', 'red-shard', 'blue-shard']), [true, true, true])
})

test('the third shard arms the forge, and lifting one back disarms it, for free', () => {
  let s = go(chosen(), place('red-shard'), place('red-shard'), place('blue-shard'))
  assert.equal(s.phase, 'armed')
  assert.deepEqual(s.sockets, ['red-shard', 'red-shard', 'blue-shard'])
  assert.equal(reduce(s, place('red-shard')).why, 'wrong-step', 'it is full')
  s = go(s, { t: 'lift', socket: 1 })
  assert.equal(s.phase, 'chosen'); assert.deepEqual(s.sockets, ['red-shard', null, 'blue-shard'])
  assert.equal(reduce(s, { t: 'lift', socket: 1 }).why, 'bad-socket', 'nothing there to lift')
  s = go(s, place('red-shard'))
  assert.equal(s.phase, 'armed')
})

test('the Key Stone is the commit: it needs the Key Stone and the coins, and it hands the game the forge', () => {
  const armed = go(chosen(), place('red-shard'), place('blue-shard'), place('red-shard'))
  assert.equal(reduce(armed, { t: 'commit', keyStone: false, coins: 5000, fee: 1500 }).why, 'no-key-stone')
  assert.equal(reduce(armed, { t: 'commit', keyStone: true, coins: 1499, fee: 1500 }).why, 'no-coins')
  assert.equal(reduce(chosen(), { t: 'commit', keyStone: true, coins: 5000, fee: 1500 }).why, 'wrong-step', 'not before the third shard')
  const r = reduce(armed, { t: 'commit', keyStone: true, coins: 1500, fee: 1500 })
  assert.ok(r.ok); assert.equal(r.state.phase, 'committed')
  assert.deepEqual(r.forge, { uid: 'char', form: 'charizard-megax', kinds: ['red-shard', 'blue-shard', 'red-shard'] })
  assert.equal(guidance(armed, { keyStone: true, coins: 100, fee: 1500 }), 'The shards float. The Forge asks 1,500 coins; you have 100.')
  assert.equal(guidance(armed, { keyStone: false, coins: 5000, fee: 1500 }), 'The shards float, but the altar needs the Key Stone.')
})

test('once committed nothing can be lifted or changed; the sequence then reveals, the tap collects the stone, and the Key Stone rests until it is taken back', () => {
  let s = go(chosen(), place('red-shard'), place('red-shard'), place('blue-shard'))
  s = go(s, { t: 'commit', keyStone: true, coins: 1500, fee: 1500 })
  assert.equal(reduce(s, { t: 'lift', socket: 0 }).why, 'wrong-step')
  assert.equal(reduce(s, { t: 'choose', pick, recipe: RR_B }).why, 'wrong-step')
  assert.equal(reduce(s, { t: 'collect' }).why, 'wrong-step', 'not before the stone is there')
  s = go(s, { t: 'revealed' })
  assert.equal(s.phase, 'reveal')
  assert.equal(guidance(s, { keyStone: true, coins: 0, fee: 1500 }), 'Tap the stone to take it.')
  s = go(s, { t: 'collect' })
  assert.equal(s.phase, 'rest', 'the stone is taken, the Key Stone stays')
  assert.equal(guidance(s, { keyStone: true, coins: 0, fee: 1500 }), 'The Key Stone rests in the altar. Tap it to take it back.')
  assert.equal(reduce(s, { t: 'collect' }).why, 'wrong-step')
  assert.equal(reduce(s, { t: 'place', kind: 'red-shard', held: { 'red-shard': 3 } }).ok, false, 'nothing is placed while it rests')
  assert.deepEqual(go(s, { t: 'retrieve' }), idle(), 'only the player taking it back clears the altar')
  assert.equal(reduce(chosen(), { t: 'retrieve' }).why, 'wrong-step')
  // choosing another Mega while it rests is allowed (the Key Stone is then simply back in its dock)
  assert.equal(reduce(s, { t: 'choose', pick, recipe: RR_B }).ok, true)
})

test('choosing another Mega puts the shards back', () => {
  let s = go(chosen(), place('red-shard'), place('blue-shard'))
  s = go(s, { t: 'choose', pick: { uid: 'gengar', form: 'gengar-mega' }, recipe: ['green-shard', 'green-shard', 'green-shard'] })
  assert.deepEqual(s.sockets, [null, null, null]); assert.equal(s.pick.uid, 'gengar')
})

test('the sequence: eight beats, a little over six seconds, in order and without gaps; the gentle version squeezes them into two and a half', () => {
  assert.deepEqual(BEATS.map((b) => b.id), ['commit', 'destabilise', 'drain', 'pour', 'absorb', 'hold', 'bang', 'clear'])
  for (let i = 1; i < BEATS.length; i++) assert.equal(BEATS[i].from, BEATS[i - 1].to, `no gap before ${BEATS[i].id}`)
  assert.equal(BEATS[0].from, 0)
  assert.equal(LENGTH, 6.6)
  assert.equal(beatAt(0).beat.id, 'commit')
  assert.equal(beatAt(1).beat.id, 'destabilise')
  assert.equal(beatAt(2.3).beat.id, 'drain')
  assert.equal(beatAt(3.5).beat.id, 'pour')
  assert.equal(beatAt(4.5).beat.id, 'absorb')
  assert.equal(beatAt(5).beat.id, 'hold')
  assert.equal(beatAt(5.25).beat.id, 'bang')
  assert.equal(beatAt(6).beat.id, 'clear')
  assert.equal(beatAt(6.6), null)
  assert.ok(Math.abs(beatAt(0.25).progress - 0.5) < 1e-9)
  assert.equal(beatAt(GENTLE_LENGTH - 0.01, true).beat.id, 'clear')
  assert.equal(beatAt(GENTLE_LENGTH, true), null)
  const hold = BEATS.find((b) => b.id === 'hold')
  assert.ok(hold.to - hold.from >= 0.3, 'a real held breath')
})

// ── the light, moment by moment (src/screens/forge/choreo.ts) ──
import { glowAt, rise, settle } from '../src/screens/forge/choreo.ts'
const IN = { colour: [[1, 0.25, 0.25], [0.3, 0.55, 1], [0.25, 0.9, 0.45]], prism: [false, false, false] }
const sample = (from, to, n = 40) => Array.from({ length: n + 1 }, (_, i) => glowAt(from + ((to - from) * i) / n - (i === n ? 1e-6 : 0), IN))
const beat = (id) => BEATS.find((b) => b.id === id)

test('the speed is exponential, not a straight line: rise gathers speed, settle loses it, both run exactly 0 to 1', () => {
  for (const f of [rise, settle]) { assert.equal(f(0), 0); assert.ok(Math.abs(f(1) - 1) < 1e-12) }
  assert.ok(rise(0.5) < 0.25, 'a slow start')
  assert.ok(settle(0.5) > 0.75, 'a fast start')
  // each doubles/halves its step at a constant ratio: that is what makes it exponential
  const r = [0, 0.2, 0.4, 0.6].map((p) => rise(p + 0.2) - rise(p + 0.1) + 1e-12)
  assert.ok(r[1] / r[0] > 1 && Math.abs(r[2] / r[1] - r[1] / r[0]) < 1e-6)
})

test('the sockets fill with light first, all of it, and the crevices are not touched until they drain', () => {
  const fill = sample(0, beat('destabilise').to, 100)
  for (let i = 1; i < fill.length; i++) assert.ok(fill[i].wells[0] >= fill[i - 1].wells[0] - 1e-9, 'the light only grows')
  for (const g of fill) { assert.equal(g.bleach, 0); assert.equal(g.white, 0); assert.equal(g.wells[3], 0) }
  assert.ok(fill[0].wells[0] < 0.4 && fill[0].wells[0] > 0, 'it begins as the shard glow')
  assert.ok(fill[50].wells[0] < 0.7, 'slow to gather, not all at once')
  const full = glowAt(beat('destabilise').to - 1e-6, IN)
  assert.ok(full.wells.slice(0, 3).every((w) => w > 0.999) && full.wellWhite > 0.99, 'each socket completely full, and white')
})

test('on the drain the sockets empty into the crevices: a wave of white runs out from them, then every crevice is white and every socket empty', () => {
  const d = beat('drain')
  const run = sample(d.from, d.to)
  for (let i = 1; i < run.length; i++) {
    assert.ok(run[i].wells[0] <= run[i - 1].wells[0] + 1e-9, 'a socket only empties')
    assert.ok(run[i].bleach >= run[i - 1].bleach - 1e-9, 'the wave only advances')
    assert.ok(Math.abs(run[i].wells[0] - (1 - run[i].bleach)) < 1e-9, 'what leaves the socket is what the crevices gain')
    assert.ok(run[i].wells[3] === 0, 'the centre waits')
  }
  // the near crevices go first and the far ones slower: the wave starts quickly and slows
  const early = run[10].bleach - run[0].bleach, late = run[40].bleach - run[30].bleach
  assert.ok(early > late * 4, 'fast near the sockets, slow far from them')
  const end = run[run.length - 1]
  assert.ok(end.wells.slice(0, 3).every((w) => w < 0.001), 'sockets empty')
  assert.ok(end.bleach > 0.999, 'every crevice lit white')
})

test('the centre gains no white until every crevice is lit; then it gains it as they empty into it, slow then faster, and has the most when they are empty', () => {
  for (const g of sample(0, beat('drain').to, 120)) assert.equal(g.wells[3], 0, 'nothing in the centre before the pour')
  const pour = sample(beat('pour').from, beat('pour').to, 60)
  assert.equal(pour[0].wells[3], 0, 'it starts empty')
  assert.equal(pour[0].bleach, 1, 'with every crevice lit')
  for (let i = 1; i < pour.length; i++) {
    assert.ok(pour[i].wells[3] >= pour[i - 1].wells[3] - 1e-9, 'it only gains')
    assert.ok(pour[i].pour >= pour[i - 1].pour, 'as the white flows on')
    assert.ok(Math.abs(pour[i].wells[3] - pour[i].pour) < 1e-9, 'the centre has gained exactly what the crevices have lost')
    assert.ok(pour[i].wells.slice(0, 3).every((w) => w === 0), 'the sockets stay empty')
  }
  assert.ok(pour[30].wells[3] < 0.3, 'slow to begin')
  const last = pour[pour.length - 1]
  assert.ok(last.wells[3] > 0.999 && last.pour > 0.999, 'the most white, the crevices emptied')
  for (const id of ['absorb', 'hold', 'bang']) assert.equal(glowAt((beat(id).from + beat(id).to) / 2, IN).wells[3], 1)
})

test('the sequence ends clear, and the gentle version runs the same order', () => {
  assert.equal(glowAt(6.6, IN), null)
  assert.ok(glowAt(beat('clear').to - 1e-6, IN).wells[3] < 0.001, 'the white has faded')
  const g = Array.from({ length: 50 }, (_, i) => glowAt((i / 50) * GENTLE_LENGTH, IN, true))
  const stage = (x) => (x.fill[0] === 0 ? 4 : x.pour !== null ? 3 : x.bleach > 0 ? 2 : 1)
  for (let i = 1; i < g.length; i++) assert.ok(stage(g[i]) >= stage(g[i - 1]), 'sockets fill, then drain into the crevices, then pour')
  assert.ok(g.some((x) => stage(x) === 1) && g.some((x) => stage(x) === 2) && g.some((x) => stage(x) === 3))
  assert.equal(glowAt(GENTLE_LENGTH, IN, true), null)
})

test('the tray says which shard fills each place, and the recipe reads in words', () => {
  const R = ['red-shard', 'red-shard', 'blue-shard']
  assert.deepEqual(trayView(R, ['blue-shard', 'comet-shard']).map((p) => p.by), ['comet-shard', null, 'blue-shard'].map((x, i) => (i === 0 ? 'blue-shard' : x)).length ? ['comet-shard', null, 'blue-shard'] : [])
  assert.deepEqual(trayView(R, ['red-shard']).map((p) => p.by), ['red-shard', null, null])
  assert.deepEqual(trayView(R, ['comet-shard', 'comet-shard']).map((p) => p.by), ['comet-shard', 'comet-shard', null])
  assert.deepEqual(trayFill(R, ['red-shard', 'blue-shard']), [true, false, true])
  assert.equal(recipeText(['red-shard', 'red-shard', 'blue-shard']), 'Two Red and one Blue')
  assert.equal(recipeText(['green-shard', 'green-shard', 'green-shard']), 'Three Green')
  assert.equal(recipeText(['red-shard', 'blue-shard', 'yellow-shard']), 'One Red, one Blue and one Yellow')
})

// ── the effects (src/screens/forge/fx.ts, director.ts) ──
import { bolt } from '../src/screens/forge/fx.ts'
import { flashAt, shakeAt } from '../src/screens/forge/director.ts'

test('a bolt keeps its ends, is the same for the same seed, and differs for another', () => {
  const a = { x: 10, y: 10 }, b = { x: 200, y: 120 }
  const p = bolt(a, b, 'x'), q = bolt(a, b, 'x'), r = bolt(a, b, 'y')
  assert.deepEqual(p[0], a); assert.deepEqual(p[p.length - 1], b)
  assert.equal(p.length, 2 ** 5 + 1)
  assert.deepEqual(p, q)
  assert.notDeepEqual(p, r)
  // it strays from the straight line, but not wildly
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const off = Math.max(...p.map((t) => Math.abs((b.x - a.x) * (a.y - t.y) - (a.x - t.x) * (b.y - a.y)) / len))
  assert.ok(off > 1 && off < len * 0.3)
})

test('one flash only: nothing until the bang, up in 60 ms, held, then fading for over a second', () => {
  assert.equal(flashAt(0), 0); assert.equal(flashAt(5.19), 0)
  assert.ok(flashAt(5.23) > 0 && flashAt(5.23) < 1)
  assert.equal(flashAt(5.3), 1)
  const xs = Array.from({ length: 800 }, (_, i) => flashAt(i * 0.01))
  let peaks = 0
  for (let i = 1; i < xs.length - 1; i++) if (xs[i] > 0.5 && xs[i] >= xs[i - 1] && xs[i] > xs[i + 1]) peaks++
  assert.ok(peaks <= 1, 'a single peak: no strobing')
  assert.ok(flashAt(5.34 + 0.6) > 0.3 && flashAt(5.34 + 1.2) < 1e-9)
  // fully white for about a tenth of a second, no more
  assert.ok(xs.filter((x) => x > 0.99).length <= 12)
})

test('the shake is violent at first and dies away in under half a second', () => {
  assert.deepEqual(shakeAt(-0.1, 400), { x: 0, y: 0 }); assert.deepEqual(shakeAt(0.45, 400), { x: 0, y: 0 })
  const amp = (from, to) => Math.max(...Array.from({ length: 60 }, (_, i) => { const k = shakeAt(from + ((to - from) * i) / 60, 400); return Math.hypot(k.x, k.y) }))
  assert.ok(amp(0, 0.1) > 8, 'a hard throw')
  assert.ok(amp(0.3, 0.45) < amp(0, 0.1) / 4, 'dying away')
})

import { recipeReachable } from '../src/screens/forge/machine.ts'
test('a Mega is within reach when the shards held (Comets standing in) can fill its recipe', () => {
  const R = ['red-shard', 'red-shard', 'blue-shard']
  assert.equal(recipeReachable({ 'red-shard': 2, 'blue-shard': 1 }, R), true)
  assert.equal(recipeReachable({ 'red-shard': 1, 'blue-shard': 1 }, R), false)
  assert.equal(recipeReachable({ 'red-shard': 1, 'blue-shard': 1, 'comet-shard': 1 }, R), true)
  assert.equal(recipeReachable({ 'comet-shard': 3 }, R), true)
  assert.equal(recipeReachable({ 'comet-shard': 2, 'green-shard': 9 }, R), false)
})

// ── the floating shards (src/screens/forge/swarm.ts): one object each, pushing the others away like magnets of the same pole ──
import { ALTAR, Swarm } from '../src/screens/forge/swarm.ts'
const KINDS = ['red-shard', 'blue-shard', 'green-shard', 'yellow-shard', 'comet-shard', 'key-stone']
const W = 366
const run = (sw, d, secs) => { for (let i = 0; i < secs * 60; i++) sw.step(1 / 60, W, d, i / 60) }
const px = (o) => [o.x * W, o.y * W]
const minGap = (sw) => { const l = sw.orbs.filter((o) => o.on); let m = Infinity; for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) m = Math.min(m, Math.hypot(...px(l[i]).map((v, k) => v - px(l[j])[k]))); return m }
const outside = (sw, d) => sw.orbs.filter((o) => o.on).every((o) => { const [x, y] = px(o); return Math.hypot(x - W / 2, y - W / 2) > (ALTAR / 2) * W - 1 && x > 0 && x < W && y > 0 && y < W })

test('there is one object for every shard held, and the swarm follows what is held', () => {
  const sw = new Swarm(3)
  assert.equal(sw.sync({ 'red-shard': 3, 'blue-shard': 16, 'comet-shard': 2, 'key-stone': 1 }, KINDS), true)
  assert.equal(sw.orbs.length, 22)
  assert.equal(sw.orbs.filter((o) => o.kind === 'blue-shard').length, 16)
  assert.equal(new Set(sw.orbs.map((o) => o.key)).size, 22, 'every one is its own')
  assert.equal(sw.sync({ 'red-shard': 3, 'blue-shard': 16, 'comet-shard': 2, 'key-stone': 1 }, KINDS), false)
  // one in a socket is the one spent: when the count drops, it goes, not a floating one
  const placed = sw.floating('blue-shard')[5]
  sw.use(placed.key)
  sw.sync({ 'red-shard': 3, 'blue-shard': 15, 'comet-shard': 2, 'key-stone': 1 }, KINDS)
  assert.equal(sw.get(placed.key), undefined)
  assert.equal(sw.floating('blue-shard').length, 15)
})

test('thirty shards float outside the altar without piling on each other; a few spread right round it', () => {
  const many = new Swarm(5)
  many.sync({ 'red-shard': 1, 'blue-shard': 16, 'yellow-shard': 8, 'green-shard': 3, 'comet-shard': 2 }, KINDS)
  run(many, 30, 5)
  assert.equal(many.orbs.length, 30)
  assert.ok(outside(many, 30), 'none over the altar or out of the arena')
  assert.ok(minGap(many) > 16, `not piled up (closest ${minGap(many).toFixed(1)}px)`)
  const few = new Swarm(7)
  few.sync({ 'red-shard': 2, 'blue-shard': 2, 'comet-shard': 1 }, KINDS)
  run(few, 56, 5)
  assert.ok(outside(few, 56))
  assert.ok(minGap(few) > 110, `five shards keep well apart (closest ${minGap(few).toFixed(1)}px)`)
})

test('placing one makes the others drift apart to fill its place; taking it back makes room again', () => {
  const sw = new Swarm(11)
  sw.sync({ 'red-shard': 4, 'blue-shard': 4 }, KINDS)
  run(sw, 56, 5)
  const before = new Map(sw.orbs.map((o) => [o.key, px(o)]))
  const gone = sw.orbs[0]
  const gap0 = minGap(sw)
  sw.use(gone.key)
  assert.equal(gone.on, false)
  run(sw, 56, 1.5)
  const moved = sw.orbs.filter((o) => o.on).map((o) => Math.hypot(...px(o).map((v, k) => v - before.get(o.key)[k])))
  assert.ok(Math.max(...moved) > 8, 'the rest shift to adjust')
  assert.ok(minGap(sw) >= gap0 - 1, 'and are no closer than before')
  // back out of its socket: it appears at the socket and is pushed out past the altar's rim while the others make room
  sw.release(gone.key, { x: 0.5, y: 0.17 })
  assert.equal(gone.on, true)
  run(sw, 56, 3)
  assert.ok(outside(sw, 56))
  const o = sw.get(gone.key)
  assert.ok(Math.hypot(o.x * W - W / 2, o.y * W - W / 2) > (ALTAR / 2) * W)
})

test('the Key Stone rests in the centre while others float; releaseAll leaves it there', () => {
  const sw = new Swarm(2)
  sw.sync({ 'red-shard': 2, 'key-stone': 1 }, KINDS)
  const key = sw.floating('key-stone')[0]
  sw.use(key.key)
  sw.use(sw.floating('red-shard')[0].key)
  sw.releaseAll(key.key)
  assert.equal(key.on, false)
  assert.equal(sw.floating('red-shard').length, 2)
})

test('a shard held by the pointer goes where the pointer goes, and the others get out of its way', () => {
  const sw = new Swarm(21)
  sw.sync({ 'red-shard': 6, 'blue-shard': 6 }, KINDS)
  run(sw, 56, 4)
  const grabbed = sw.orbs[0]
  const near = sw.orbs.filter((o) => o !== grabbed).sort((a, b) => Math.hypot(a.x - grabbed.x, a.y - grabbed.y) - Math.hypot(b.x - grabbed.x, b.y - grabbed.y))[1]
  sw.grab(grabbed.key)
  // drag it right up against a neighbour
  const to = { x: near.x + 0.01, y: near.y + 0.01 }
  const before = px(near)
  sw.move(grabbed.key, to.x, to.y)
  run(sw, 56, 1)
  assert.deepEqual([grabbed.x, grabbed.y], [to.x, to.y], 'the held shard does not drift: it stays under the pointer')
  const away = Math.hypot(...px(near).map((v, k) => v - before[k]))
  assert.ok(away > 25, `the neighbour was pushed away (${away.toFixed(0)}px)`)
  sw.drop(grabbed.key)
  run(sw, 56, 2)
  assert.ok(minGap(sw) > 40, 'let go, it floats on and nobody is on top of anybody')
})
