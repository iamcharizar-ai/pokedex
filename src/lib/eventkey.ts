import type { LedgerEvent } from '../linked/arbor-model.ts'

/**
 * An event's identity, so the copy that comes back from the ledger is taken once. Postgres hands `at` back as "+00:00" (not "Z") and a
 * jsonb payload with its keys reordered, so the raw text of an event and its echo never matched: every throw, buy and claim made here
 * counted twice on screen until a reload (two balls off for one tap, a catch that was not one, 5 Nov 2026). So the time is compared
 * as a number and the payload with its keys sorted. Item uses carry a random `n`, so two real taps never share a key.
 */
const canon = (v: unknown): string => (v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v) ?? '')
export const keyOf = (e: LedgerEvent): string => `${e.device}|${Date.parse(e.at)}|${e.type}|${canon(e.payload)}`
