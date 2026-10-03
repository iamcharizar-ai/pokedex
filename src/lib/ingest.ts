// Ledger events → what the game core needs (habits, ticks, the two linked
// blocks). Mirrors how Life OS folds the same events, so both apps hand the
// core the same days.
import type { FactsInput, HabitLite, TickMap } from '../../core/facts.ts'
import { settled } from '../../core/order.ts'
import { emptyArbor, foldArbor, type LedgerEvent } from '../linked/arbor-model.ts'
import { emptyShed, foldShed } from '../linked/shed-model.ts'

const GYM = 'gym'
const SLEEP = 'sleep-before-10'
/** A measured bedtime ticks the sleep habit when it was this early. Never un-ticks, never locks: hand ticks still count. */
const BED_BY = '22:30'
const EPOCH = '1970-01-01'

export const TYPES = ['tick', 'untick', 'workout', 'workout_clear', 'skill', 'plan', 'guitar', 'guitar_plan', 'vitals']

/** The habit library from the newest `config` event. */
export function habitsFrom(config: LedgerEvent | undefined): HabitLite[] {
  if (!config) return []
  try {
    const habits = JSON.parse(String(config.payload.habits)) as HabitLite[]
    const gone = new Set(config.payload.deleted ? (JSON.parse(String(config.payload.deleted)) as string[]) : [])
    return habits
      .filter((h) => h && h.id && !gone.has(h.id))
      .map((h) => ({ id: h.id, tier: h.tier, name: h.name, emoji: h.emoji, spans: Array.isArray(h.spans) && h.spans.length ? h.spans : [{ from: EPOCH, to: null }] }))
  } catch {
    return []
  }
}

export function ingest(events: LedgerEvent[], config: LedgerEvent | undefined, today: string): FactsInput {
  // in the order things happened, by the server's clock where the device's own cannot be trusted
  const sorted = settled(events)
  const ticks: TickMap = {}
  for (const ev of sorted) {
    const p = ev.payload ?? {}
    const day = (ticks[ev.day] ??= {})
    if (ev.type === 'tick') day[String(p.habitId)] = String(p.at ?? ev.at)
    else if (ev.type === 'untick') delete day[String(p.habitId)]
    // a finished Strong workout is what ticks Gym
    else if (ev.type === 'workout') day[GYM] ??= String(p.at ?? ev.at)
    else if (ev.type === 'workout_clear') delete day[GYM]
    // Vitals: a night that began on time ticks that evening's sleep habit (same rule Life OS applies)
    else if (ev.type === 'vitals' && typeof p.bed === 'string') {
      const date = p.bed.slice(0, 10), time = p.bed.slice(11, 16)
      if (time >= '18:00' && time <= BED_BY) (ticks[date] ??= {})[SLEEP] ??= ev.at
    }
  }
  return {
    habits: habitsFrom(config),
    ticks,
    arbor: foldArbor(emptyArbor(), sorted.filter((e) => e.type === 'skill' || e.type === 'plan')),
    shed: foldShed(emptyShed(), sorted.filter((e) => e.type === 'guitar' || e.type === 'guitar_plan')),
    today,
  }
}
