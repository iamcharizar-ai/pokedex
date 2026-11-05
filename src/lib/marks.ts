// Each domain in its own unit, read from what Strong and Woodshed already record: workouts and the lifts that beat every earlier
// session (core/strong.ts, shared with Life OS since version 21 makes a Gym day a logged workout), guitar items played clean and song
// parts owned. These feed the field notes, the Iron and Tones extras, and from version 21 the Gym pillar itself.
import type { DayMarks } from '../../core/facts.ts'
import { strongMarks } from '../../core/strong.ts'
import type { LedgerEvent } from '../linked/arbor-model.ts'
import { ITEMS } from '../linked/woodshed/course.ts'
import { statsOf, type ShedState } from '../linked/woodshed/model.ts'

/** Pass events oldest first, and the folded Woodshed state. */
export function marksOf(events: LedgerEvent[], shed: ShedState): Record<string, DayMarks> {
  const out: Record<string, DayMarks> = strongMarks(events)
  const add = (day: string, k: 'clean' | 'owned', n = 1) => { (out[day] ??= {})[k] = (out[day][k] ?? 0) + n }

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
