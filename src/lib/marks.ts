// Each domain in its own unit, read from what Strong and Woodshed already
// record: workouts and the lifts that beat every earlier session, guitar items
// played clean and song parts owned. These feed the field notes on the trainer
// card. Nothing in the game depends on them yet.
import type { DayMarks } from '../../core/facts.ts'
import type { LedgerEvent } from '../linked/arbor-model.ts'
import { ITEMS } from '../linked/woodshed/course.ts'
import { statsOf, type ShedState } from '../linked/woodshed/model.ts'

interface DoneSet { kg: number | null; reps: number }
interface Workout { id: string; finishedAt: string; exercises: { exerciseId: string; sets: DoneSet[] }[] }
type ExType = 'weight' | 'bodyweight' | 'weighted' | 'assisted' | 'duration'

const parse = <T>(raw: unknown): T | null => {
  try {
    return JSON.parse(String(raw)) as T
  } catch {
    return null
  }
}

// the same reading of a set as Strong's own records (strong/src/lib/stats.ts)
const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30))
const loaded = (t: ExType) => t === 'weight' || t === 'weighted'
function best(type: ExType, sets: DoneSet[]): number[] {
  let heaviest = -Infinity, rm = -Infinity, volume = -Infinity, reps = -Infinity, longest = -Infinity
  for (const s of sets) {
    if (type === 'duration') { longest = Math.max(longest, s.reps); continue }
    if (!loaded(type)) reps = Math.max(reps, s.reps)
    else if (s.kg != null) {
      heaviest = Math.max(heaviest, s.kg)
      rm = Math.max(rm, e1rm(s.kg, s.reps))
      volume = Math.max(volume, s.kg * s.reps)
    }
  }
  return [heaviest, rm, volume, reps, longest]
}

/** Pass events oldest first, and the folded Woodshed state. */
export function marksOf(events: LedgerEvent[], shed: ShedState): Record<string, DayMarks> {
  const out: Record<string, DayMarks> = {}
  const add = (day: string, k: keyof DayMarks, n = 1) => { (out[day] ??= {})[k] = (out[day][k] ?? 0) + n }

  // ── Strong: a deleted workout is gone, and the same workout sent twice counts once ──
  const gone = new Set(events.filter((e) => e.type === 'workout_delete').map((e) => String(e.payload?.id)))
  const types: Record<string, ExType> = {}
  const workouts = new Map<string, { day: string; w: Workout }>()
  for (const ev of events) {
    if (ev.type !== 'workout') continue
    const w = parse<Workout>(ev.payload?.gear)
    if (!w?.id || !Array.isArray(w.exercises) || gone.has(w.id)) continue
    for (const [id, x] of Object.entries(parse<Record<string, { type?: ExType }>>(ev.payload?.lib) ?? {})) if (x?.type) types[id] = x.type
    workouts.set(w.id, { day: ev.day, w })
  }
  const before: Record<string, DoneSet[]> = {}
  for (const { day, w } of [...workouts.values()].sort((a, b) => (a.w.finishedAt < b.w.finishedAt ? -1 : 1))) {
    add(day, 'workouts')
    for (const e of w.exercises) {
      const type = types[e.exerciseId] ?? 'weight'
      const old = before[e.exerciseId]
      // a first session sets the mark; it does not beat one
      if (old?.length) {
        const was = best(type, old), now = best(type, e.sets)
        if (now.some((v, i) => v > was[i] + 1e-9)) add(day, 'records')
      }
      ;(before[e.exerciseId] ??= []).push(...e.sets)
    }
  }

  // ── Woodshed: a clean day is a log that felt clean at the target tempo; a song part is owned on the day its last clean day fell ──
  for (const item of ITEMS) {
    const st = statsOf(item, shed)
    let last: number | undefined
    for (const [day, log] of Object.entries(shed.logs[item.id] ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (!log.done) continue
      if (typeof log.bpm === 'number') last = log.bpm
      if (log.feel === 2 && (!item.target || (log.bpm ?? last ?? 0) >= item.target)) add(day, 'clean')
    }
    if (item.kind === 'song' && st.ownedOn) add(st.ownedOn, 'owned')
  }
  return out
}
