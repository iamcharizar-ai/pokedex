// Every fixture still shows what it is for. A rules change that leaves one empty
// (no boss in `boss`, nothing to collect in `week`) fails here, not on a screen.
//   node --test tools/fixtures.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { FIXTURES, fixture } from '../src/lib/fixtures.ts'
import { ingest } from '../src/lib/ingest.ts'
import { buildFacts } from '../core/facts.ts'
import { foldGame } from '../core/fold.ts'
import { BOSS_PARTY, THROW_AT } from '../core/boss.ts'

const play = (name) => { const f = fixture(name); return { f, g: foldGame(buildFacts(ingest(f.events, f.config, f.today))) } }

test('every fixture builds, and the same way twice', () => {
  for (const name of FIXTURES) {
    const a = fixture(name), b = fixture(name)
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${name} is not the same every time`)
    assert.ok(a.config && a.today, name)
  }
  assert.equal(fixture('nope'), null)
  assert.equal(fixture(null), null)
})

test('empty: a library and nothing done', () => {
  const { g } = play('empty')
  assert.equal(g.level, 1)
  assert.equal(g.days.every((d) => d.xp === 0), true)
  assert.equal(g.held.length, 0)
})

test('week: a partner that has grown, a wild Pokemon partly worn down, rewards to collect', () => {
  const { g } = play('week')
  assert.ok(g.level > 5)
  assert.ok(g.wild && g.wild.hp < g.wild.max && g.wild.hp > 0)
  assert.ok(g.held.length > 0, 'something waits in Collect')
  assert.ok(g.today.xp > 0, 'today has started')
})

test('late: trained Pokemon, feats, a full Box, an egg warming and chests opened', () => {
  const { g } = play('late')
  assert.ok(g.graduates.length >= 3)
  assert.ok(g.feats.length >= 10)
  assert.ok(g.queue.length > 0)
  assert.ok(g.egg, 'an egg is being kept warm')
  assert.ok(g.moments.some((m) => m.kind === 'chest'))
  assert.ok(g.moments.some((m) => m.kind === 'evolve'))
  assert.ok(g.keyStone)
})

test('boss: a full party, a boss in its week, weak enough to throw at, and balls to throw', () => {
  const { g } = play('boss')
  assert.equal(g.bossParty, BOSS_PARTY)
  assert.ok(g.boss, 'there is a boss this week')
  assert.ok(g.boss.hpLeft <= THROW_AT && g.boss.hpLeft > 0, 'it is wounded but standing')
  assert.ok(g.boss.canThrow)
  assert.ok(Object.entries(g.inv).some(([id, n]) => id.endsWith('-ball') && n > 0))
  assert.ok(g.boss.tasks.some((t) => t.p >= 1) && g.boss.tasks.some((t) => t.p < 1), 'some tasks done, some not')
})

test('a band turns Sleep into a measured pillar and gives the Last night section a night to show', () => {
  const plain = play('week').g
  assert.notEqual(plain.sleep.state, 'measured', 'a fixture has no band unless asked')
  for (const [score, bells] of [[84, 1], [93, 2], [60, 0]]) {
    const f = fixture('week', String(score))
    const g = foldGame(buildFacts(ingest(f.events, f.config, f.today)))
    assert.equal(g.sleep.state, 'measured')
    assert.equal(g.sleep.score, score)
    assert.equal(g.wallet.marksToday.sleep, bells, `${score} pays ${bells} Bell(s)`)
  }
})
