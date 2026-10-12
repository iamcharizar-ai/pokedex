// Ledger events → what the game core needs (habits, ticks, the two linked
// blocks). Mirrors how Life OS folds the same events, so both apps hand the
// core the same days.
import type { FactsInput, HabitLite, TickMap } from '../../core/facts.ts'
import { BODY_EVENT, LIST_EVENT, USE_EVENT, bodyOf, listsOf, usesOf } from '../../core/events.ts'
import { BOSS_DAY_EVENT, CARD_EVENT, bossOf } from '../../core/boss.ts'
import { settled } from '../../core/order.ts'
import { emptyArbor, foldArbor, type LedgerEvent } from '../linked/arbor-model.ts'
import { emptyShed, foldShed } from '../linked/woodshed/model.ts'
import { marksOf } from './marks.ts'

const GYM = 'gym'
const SLEEP = 'sleep-before-10'
/** A hand-entered bedtime ticks the sleep habit when it was this early. A row from the band carries a sleep score instead, and Sleep is judged on that. */
const BED_BY = '22:30'
const EPOCH = '1970-01-01'

export const TYPES = ['tick', 'untick', 'workout', 'workout_clear', 'workout_delete', 'skill', 'plan', 'guitar', 'guitar_plan', BODY_EVENT, USE_EVENT, LIST_EVENT, CARD_EVENT, BOSS_DAY_EVENT]

/** The habit library from the newest `config` event. */
export function habitsFrom(config: LedgerEvent | undefined): HabitLite[] {
  if (!config) return []
  try {
    const habits = JSON.parse(String(config.payload.habits)) as HabitLite[]
    const gone = new Set(config.payload.deleted ? (JSON.parse(String(config.payload.deleted)) as string[]) : [])
    return habits
      .filter((h) => h && h.id && !gone.has(h.id))
      .map((h) => ({ id: h.id, tier: h.tier, name: h.name, emoji: h.emoji, domain: h.domain, spans: Array.isArray(h.spans) && h.spans.length ? h.spans : [{ from: EPOCH, to: null }] }))
  } catch {
    return []
  }
}

export function ingest(events: LedgerEvent[], config: LedgerEvent | undefined, today: string): FactsInput {
  // in the order things happened, by the server's clock where the device's own cannot be trusted
  const sorted = settled(events)
  const ticks: TickMap = {}
  // a deleted workout never ticked Gym; another workout the same day still does
  const gone = new Set(sorted.filter((e) => e.type === 'workout_delete').map((e) => String(e.payload?.id)))
  const workoutId = (p: LedgerEvent['payload']): string | undefined => {
    try { return (JSON.parse(String(p.gear)) as { id?: string }).id } catch { return undefined }
  }
  for (const ev of sorted) {
    const p = ev.payload ?? {}
    const day = (ticks[ev.day] ??= {})
    if (ev.type === 'tick') day[String(p.habitId)] = String(p.at ?? ev.at)
    else if (ev.type === 'untick') delete day[String(p.habitId)]
    // a finished Strong workout is what ticks Gym
    else if (ev.type === 'workout') { const id = workoutId(p); if (!id || !gone.has(id)) day[GYM] ??= String(p.at ?? ev.at) }
    else if (ev.type === 'workout_clear') delete day[GYM]
    // Vitals: a night that began on time ticks that evening's sleep habit (same rule Life OS applies)
    else if (ev.type === 'vitals' && typeof p.bed === 'string' && typeof p.sleepScore !== 'number') {
      const date = p.bed.slice(0, 10), time = p.bed.slice(11, 16)
      if (time >= '18:00' && time <= BED_BY) (ticks[date] ??= {})[SLEEP] ??= ev.at
    }
  }
  const shed = foldShed(emptyShed(), sorted.filter((e) => e.type === 'guitar' || e.type === 'guitar_plan'))
  return {
    habits: habitsFrom(config),
    ticks,
    arbor: foldArbor(emptyArbor(), sorted.filter((e) => e.type === 'skill' || e.type === 'plan')),
    shed,
    marks: marksOf(sorted, shed),
    lists: listsOf(sorted),
    body: bodyOf(sorted),
    uses: usesOf(sorted),
    boss: bossOf(sorted),
    today,
  }
}
