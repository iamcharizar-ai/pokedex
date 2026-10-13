// What a sync writes. The Google Health CLI gives raw readings; the game reads
// the numbers made from them (a night's sleep score, a morning's recovery), so
// they are worked out here, once, with the weeks already in the ledger for
// company (steadiness and recovery compare a night against the ones before it).
// A day whose numbers are the same as the ledger's writes nothing, so running
// it every morning, or twice, costs nothing.
import { rowsToWrite, toVitals, type SimpleSet } from './map.ts'
import { emptyVitals, foldVitals, type LedgerEvent } from './model.ts'

/** Recovery and steadiness look at the weeks before a day, so a sync reads this many days of the ledger from before its first day. */
export const LOOK_BACK = 35
export const DEVICE = 'health-sync'

/** The `vitals` events to write, oldest day first. `known` is the ledger's own `vitals` events from LOOK_BACK days before the first day read. */
export function planWrites(read: SimpleSet, known: LedgerEvent[], at: string): LedgerEvent[] {
  const fresh = toVitals(read)
  const state = foldVitals(emptyVitals(), known)
  const scores: Record<string, { sleepScore?: number; recovery?: number }> = {}
  for (const r of known) for (const k of ['sleepScore', 'recovery'] as const) if (typeof r.payload?.[k] === 'number') (scores[r.day] ??= {})[k] = r.payload[k] as number
  const out = rowsToWrite(fresh, state, scores)
  return Object.entries(out)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, payload]) => ({ device: DEVICE, at, day, type: 'vitals', payload: payload as LedgerEvent['payload'] }))
}
