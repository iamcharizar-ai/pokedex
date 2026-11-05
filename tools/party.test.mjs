// What a move in the party means (src/lib/party.ts): the same two events the game already folds.
//   node --test tools/party.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_LEVEL, xpForLevel } from '../core/rules.ts'
import { boxOf, hasOpen, labOf, nextPlace, planDesk, planFill, planMove } from '../src/lib/party.ts'

const mon = (uid, o = {}) => ({ uid, form: 'pikachu', xp: 0, shiny: false, ...o })
/** a party: the partner P, the team A..E, a lab X (oldest) and Y; and a trained Z in the lab. `slots` can leave places open with null */
const game = (slots = ['A', 'B', 'C', 'D', 'E'], o = {}) => ({
  v14: true,
  partner: mon('P'),
  teamSlots: slots.map((u) => (u ? mon(u) : null)),
  queue: ['A', 'B', 'C', 'D', 'E', 'X', 'Y'].map((u) => mon(u)),
  graduates: [mon('Z', { graduated: '2026-10-20' })],
  ...o,
})
const team = (plan) => plan.ops.find((op) => op.what === 'team')?.to.split(',')

test('the lab is everyone not in the party, My Pokemon first and the trained after', () => {
  assert.deepEqual(labOf(game()).map((m) => m.uid), ['X', 'Y', 'Z'])
  assert.deepEqual(labOf(game(['A', null, null, null, null])).map((m) => m.uid), ['B', 'C', 'D', 'E', 'X', 'Y', 'Z'])
})

test('a lab card onto a team place swaps: the one who stood there goes to the lab', () => {
  const plan = planMove(game(), 'X', { slot: 3 })
  assert.equal(plan.ok, true)
  assert.deepEqual(plan.ops.map((o) => o.what), ['team'])
  assert.deepEqual(team(plan), ['A', 'B', 'X', 'D', 'E'])
})

test('two team places swap', () => {
  assert.deepEqual(team(planMove(game(), 'B', { slot: 4 })), ['A', 'D', 'C', 'B', 'E'])
})

test('a lab card onto the Partner place leads, and the old partner goes to the lab; the team is named so nobody is bumped', () => {
  const plan = planMove(game(), 'X', { slot: 0 })
  assert.deepEqual(plan.ops.map((o) => o.what), ['lead', 'team'])
  assert.equal(plan.ops[0].uid, 'X')
  assert.deepEqual(team(plan), ['A', 'B', 'C', 'D', 'E'])
})

test('a team card onto the Partner place: the old partner takes its place', () => {
  const plan = planMove(game(), 'C', { slot: 0 })
  assert.deepEqual(plan.ops.map((o) => o.what), ['lead', 'team'])
  assert.deepEqual(team(plan), ['A', 'B', 'P', 'D', 'E'])
})

test('the partner onto a team place swaps with whoever stands there; onto an open place it cannot', () => {
  const plan = planMove(game(), 'P', { slot: 2 })
  assert.equal(plan.ops[0].uid, 'B')
  assert.deepEqual(team(plan), ['A', 'P', 'C', 'D', 'E'])
  assert.equal(planMove(game(['A', null, 'C', 'D', 'E']), 'P', { slot: 2 }).ok, false)
})

test('taking someone out leaves their place open, and nothing else moves', () => {
  const plan = planMove(game(), 'C', 'lab')
  assert.equal(plan.ok, true)
  assert.deepEqual(team(plan), ['A', 'B', '-', 'D', 'E'])
  assert.equal(planMove(game(), 'P', 'lab').ok, false, 'the partner stays')
  assert.deepEqual(planMove(game(), 'X', 'lab').ops, [], 'someone already in the lab is already there')
})

test('a card moved onto an open place takes it and leaves its own place open', () => {
  const g = game(['A', null, 'C', null, null])
  assert.deepEqual(team(planMove(g, 'X', { slot: 5 })), ['A', '-', 'C', '-', 'X'])
  assert.deepEqual(team(planMove(g, 'A', { slot: 4 })), ['-', '-', 'C', 'A', '-'])
})

test('a fully trained Pokemon can lead again below level 100, not at it', () => {
  assert.equal(planMove(game(), 'Z', { slot: 0 }).ok, true)
  const maxed = game(undefined, { graduates: [mon('Z', { graduated: '2026-10-20', xp: xpForLevel(MAX_LEVEL) })] })
  assert.equal(planMove(maxed, 'Z', { slot: 0 }).ok, false)
  assert.equal(planMove(game(undefined, { v14: false }), 'Z', { slot: 0 }).ok, false, 'before version 14 only My Pokemon can lead')
})

test('which place a "put it in the party" with no place chosen goes to', () => {
  assert.equal(nextPlace(game()), 5, 'the last when the party is full')
  assert.equal(nextPlace(game(['A', 'B', null, 'D', null])), 3, 'the first open one')
  assert.equal(hasOpen(game()), false)
  assert.equal(hasOpen(game(['A', 'B', null, 'D', 'E'])), true)
})

test('moving to where it already is changes nothing, and a made-up place is refused', () => {
  assert.deepEqual(planMove(game(), 'C', { slot: 3 }).ops, [])
  assert.equal(planMove(game(), 'C', { slot: 9 }).ok, false)
  assert.equal(planMove(game(), 'nobody', { slot: 1 }).ok, false)
})

test('filling the open places takes the oldest in the lab, in order, and does nothing with nothing to fill or nobody to fill with', () => {
  const plan = planFill(game(['A', null, 'C', null, 'E']))
  assert.deepEqual(team(plan), ['A', 'B', 'C', 'D', 'E'], 'B and D are the oldest in the lab')
  assert.deepEqual(team(planFill(game(['A', null, null, null, null]))), ['A', 'B', 'C', 'D', 'E'])
  assert.equal(planFill(game()), null, 'no open place')
  const bare = game(['A', null, null, null, null], { queue: [mon('A')], graduates: [] })
  assert.equal(planFill(bare), null, 'nobody in the lab')
})

test('filling an open place never takes a Pokemon off the desk (B2): it fills from the box, or waits', () => {
  // X is the oldest in the lab and on the desk: the fill skips it and takes Y
  const g = { ...game(['A', 'B', 'C', 'D', null]), queue: ['A', 'B', 'C', 'D', 'X', 'Y'].map((u) => mon(u)), graduates: [], research: { desk: [mon('X')] } }
  assert.deepEqual(team(planFill(g)), ['A', 'B', 'C', 'D', 'Y'])
  // everyone in the lab is on the desk: nothing to fill with, so the place stays open
  assert.equal(planFill({ ...g, research: { desk: [mon('X'), mon('Y')] } }), null)
})

test('the desk: the box is the lab less the desk; a box card onto the desk adds, onto a jar swaps; off the desk goes back to the box', () => {
  const g = { ...game(), research: { desk: [mon('X'), mon('Y')] } }
  assert.deepEqual(boxOf(g).map((m) => m.uid), ['Z'])
  const to = (plan) => plan.ops[0].to
  assert.equal(to(planDesk(g, 'Z', { slot: 2 })), 'X,Y,Z')
  assert.equal(to(planDesk(g, 'Z', { slot: 0 })), 'Z,Y')
  assert.equal(to(planDesk(g, 'X', { slot: 1 })), 'Y,X')
  assert.equal(to(planDesk(g, 'X', { slot: 2 })), 'Y,X', 'an empty jar closes the gap')
  assert.equal(to(planDesk(g, 'Y', 'lab')), 'X')
  assert.deepEqual(planDesk(g, 'Z', 'lab').ops, [])
  assert.equal(planDesk(g, 'A', { slot: 0 }).ok, false, 'someone in the party is not studied')
  assert.equal(planDesk(g, 'Z', { slot: 3 }).ok, false)
})
