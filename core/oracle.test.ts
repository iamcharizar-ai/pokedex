// The oracle (GAME-SPEC-V22.md, section 12.1 as amended): core/fold.ts is the live engine, and with version 22 off it must fold every
// day exactly as the frozen rules in legacy/fold.ts do. A rule change that leaks into a day before V22_START fails here.
//   node --test core/oracle.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { FIXTURES, fixture } from '../src/lib/fixtures.ts'
import { ingest } from '../src/lib/ingest.ts'
import { buildFacts } from './facts.ts'
import { foldGame } from './fold.ts'
import { foldGame as foldLegacy } from './legacy/fold.ts'
import { V22_START, setV22Start } from './rules.ts'

const run = (name: string) => {
  const f = fixture(name)!
  const facts = buildFacts(ingest(f.events, f.config, f.today))
  // the engine's version 22 fields are the only difference: they are new, and empty before V22_START
  const live = JSON.parse(JSON.stringify(foldGame(facts)))
  delete live.v22; delete live.tracks; delete live.tier.pillars; delete live.lab; delete live.egg2; delete live.partyPower
  return { facts, live: JSON.stringify(live), old: JSON.stringify(foldLegacy(facts)) }
}

test('with version 22 off, the engine folds every fixture exactly as the frozen legacy rules do', () => {
  const was = V22_START
  try {
    setV22Start('2099-01-01')
    for (const name of FIXTURES) {
      const { live, old } = run(name)
      assert.ok(live === old, `${name}: the live engine differs from legacy/fold.ts`)
    }
  } finally { setV22Start(was) }
})

test('a version 22 start after the last day changes nothing either', () => {
  const was = V22_START
  try {
    for (const name of FIXTURES) {
      setV22Start('2098-01-01')
      const { live, old } = run(name)
      assert.ok(live === old, `${name}: a future V22_START changed the game`)
    }
  } finally { setV22Start(was) }
})
