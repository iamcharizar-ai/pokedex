// The last twelve weeks as a calendar: one cell a day, shaded by how much work
// it held. Pure data in, pure data out, so tools/calendar.test.mjs can check it.
import { addDays, mondayOf } from '../../core/facts.ts'
import type { DayResult } from '../../core/fold.ts'

/** 0 nothing ticked, 1 something ticked, 2 one pillar, 3 two pillars (a counting day), 4 three or more. null: not part of the game (before it began, or still to come). */
export type Level = 0 | 1 | 2 | 3 | 4

export interface Cell {
  day: string
  level: Level | null
  perfect: boolean
  pillars: number
  pillarTotal: number
  xp: number
  today: boolean
  /** what a screen reader and a hover say */
  label: string
}
export interface Week { monday: string; boss: boolean; cells: Cell[] }
export interface Calendar { weeks: Week[]; counting: number; perfect: number; xp: number }

const fmt = (day: string): string => new Date(day + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

export function levelOf(d: Pick<DayResult, 'pillars' | 'ticked' | 'xp'>): Level {
  if (d.pillars >= 3) return 4
  if (d.pillars === 2) return 3
  if (d.pillars === 1) return 2
  return d.ticked > 0 || d.xp > 0 ? 1 : 0
}

/** `bossWeeks` holds the Monday of every week a boss came. The newest `weeks` weeks end with the one `today` is in. */
export function calendarOf(days: DayResult[], today: string, bossWeeks: ReadonlySet<string>, weeks = 12): Calendar {
  const by = new Map(days.map((d) => [d.day, d]))
  const first = days[0]?.day ?? today
  const start = addDays(mondayOf(today), -7 * (weeks - 1))
  const out: Week[] = []
  let counting = 0, perfect = 0, xp = 0
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(start, 7 * w)
    const cells: Cell[] = []
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i)
      const d = by.get(day)
      const live = Boolean(d) && day <= today && day >= first
      if (!live || !d) {
        cells.push({ day, level: null, perfect: false, pillars: 0, pillarTotal: 0, xp: 0, today: day === today, label: `${fmt(day)}: ${day > today ? 'to come' : 'before the game began'}` })
        continue
      }
      const level = levelOf(d)
      if (d.counts) counting++
      if (d.perfect) perfect++
      xp += d.xp
      cells.push({
        day, level, perfect: d.perfect, pillars: d.pillars, pillarTotal: d.pillarTotal, xp: d.xp, today: day === today,
        label: `${fmt(day)}: ${d.pillarTotal ? `${d.pillars} of ${d.pillarTotal} pillars` : 'no pillars'}, ${d.xp} XP${d.perfect ? ', a perfect day' : d.counts ? ', a counting day' : ''}`,
      })
    }
    out.push({ monday, boss: bossWeeks.has(monday), cells })
  }
  return { weeks: out, counting, perfect, xp }
}
