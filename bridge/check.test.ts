import test from 'node:test'
import assert from 'node:assert/strict'
import { CHECK_EVERY_MS, check } from './check.ts'

const deps = (o: { score?: number | null; after?: number | null; nights?: string[]; fail?: boolean; t?: number }) => {
  let reads = 0, syncs = 0
  return {
    d: {
      day: '2026-10-20',
      scoreIn: async () => (reads++ === 0 ? (o.score ?? null) : (o.after ?? o.score ?? null)),
      sync: async () => { syncs++; if (o.fail) throw new Error('no'); return { nights: o.nights ?? [] } },
      now: () => o.t ?? 1000,
    },
    syncs: () => syncs,
  }
}

test('a night already in the ledger is answered without reading Google', async () => {
  const x = deps({ score: 84 })
  const r = await check(x.d, null)
  assert.equal(r.answer.state, 'measured')
  assert.equal(r.answer.score, 84)
  assert.equal(x.syncs(), 0)
})

test('Google is read; a night it had is written and answered as measured', async () => {
  const x = deps({ score: null, after: 77, nights: ['2026-10-20'] })
  const r = await check(x.d, null)
  assert.equal(r.answer.state, 'measured')
  assert.equal(r.answer.score, 77)
  assert.equal(x.syncs(), 1)
})

test('Google has the night but it is not scored yet: scoring', async () => {
  const r = await check(deps({ nights: ['2026-10-20'] }).d, null)
  assert.equal(r.answer.state, 'scoring')
})

test('no night at Google: the phone has not synced it', async () => {
  const r = await check(deps({ nights: ['2026-10-19'] }).d, null)
  assert.equal(r.answer.state, 'not-synced')
})

test('Google is read at most once a minute, whoever asks', async () => {
  const first = await check(deps({ nights: [] }).d, null)
  const x = deps({ nights: [], t: 1000 + CHECK_EVERY_MS - 1 })
  const again = await check(x.d, first.memo)
  assert.equal(x.syncs(), 0)
  assert.equal(again.answer.state, 'not-synced')
  const y = deps({ nights: [], t: 1000 + CHECK_EVERY_MS })
  await check(y.d, first.memo)
  assert.equal(y.syncs(), 1)
})

test('Google failing is said plainly', async () => {
  const r = await check(deps({ fail: true }).d, null)
  assert.equal(r.answer.state, 'error')
})
