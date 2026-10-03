// Ledger events → what the game core needs (habits, ticks, the two linked
// blocks). Mirrors how Life OS folds the same events, so both apps hand the
// core the same days.
import type { FactsInput, HabitLite, TickMap } from '../../core/facts.ts'
import { emptyArbor, foldArbor, type LedgerEvent } from '../linked/arbor-model.ts'
import { emptyShed, foldShed } from '../linked/shed-model.ts'

const GYM = 'gym'
const EPOCH = '1970-01-01'

export const TYPES = ['tick', 'untick', 'workout', 'workout_clear', 'skill', 'plan', 'guitar', 'guitar_plan']

/** The habit library from the newest `config` event. */
export function habitsFrom(config: LedgerEvent | undefined): HabitLite[] {
  if (!config) return []
  try {
    const habits = JSON.parse(String(config.payload.habits)) as HabitLite[]
    const gone = new Set(config.payload.deleted ? (JSON.parse(String(config.payload.deleted)) as string[]) : [])
    return habits
      .filter((h) => h && h.id && !gone.has(h.id))
      .map((h) => ({ id: h.id, tier: h.tier, spans: Array.isArray(h.spans) && h.spans.length ? h.spans : [{ from: EPOCH, to: null }] }))
  } catch {
    return []
  }
}

export function ingest(events: LedgerEvent[], config: LedgerEvent | undefined, today: string): FactsInput {
  const sorted = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  const ticks: TickMap = {}
  for (const ev of sorted) {
    const p = ev.payload ?? {}
    const day = (ticks[ev.day] ??= {})
    if (ev.type === 'tick') day[String(p.habitId)] = String(p.at ?? ev.at)
    else if (ev.type === 'untick') delete day[String(p.habitId)]
    // a finished Strong workout is what ticks Gym
    else if (ev.type === 'workout') day[GYM] ??= String(p.at ?? ev.at)
    else if (ev.type === 'workout_clear') delete day[GYM]
  }
  return {
    habits: habitsFrom(config),
    ticks,
    arbor: foldArbor(emptyArbor(), sorted.filter((e) => e.type === 'skill' || e.type === 'plan')),
    shed: foldShed(emptyShed(), sorted.filter((e) => e.type === 'guitar' || e.type === 'guitar_plan')),
    today,
  }
}
