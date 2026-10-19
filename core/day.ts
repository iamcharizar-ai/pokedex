// GAME CORE: which day it is (RULES-V14.md section 1).
//
// A day does not end at midnight. After midnight the apps stay on yesterday, so
// habits do not reset under you while the evening is still going, until the
// first of:
//   - the band's reading of the night (a `vitals` row with a sleep score, filed
//     under the morning it ended),
//   - a `day_start` event for the date (the "Start my day" button),
//   - the day's start time: two hours before you usually wake (the median wake
//     of your last seven measured nights), never before 04:00 or after 07:00,
//     and 05:00 until there are three nights to go on.
// Before midnight it is always the calendar date.
//
// Until version 14 the fallback was 14:00, so a reading that Google was slow to
// pass on kept the whole morning on yesterday. Now the day has started by the
// time you wake, and the Sleep pillar fills itself whenever the reading lands:
// the game is folded again from the ledger, so a late reading changes nothing
// but when you see it.
//
// Pure: the apps pass in the clock and what they know about each date.

/** Written by Life OS (or the Pokedex) when the day is started by hand: `{}` on the date that begins. */
export const DAY_START_EVENT = 'day_start'
/** The day's start time (minutes after midnight) before there are enough nights to know when you wake. */
export const DAY_STARTS_DEFAULT = 5 * 60
/** The day's start time is never earlier or later than these (minutes after midnight). */
export const DAY_STARTS_EARLIEST = 4 * 60
export const DAY_STARTS_LATEST = 7 * 60
/** How long before your usual wake the day starts (minutes). */
export const WAKE_LEAD = 120
/** The usual wake is the median of this many recent measured nights, once there are at least WAKE_MIN_NIGHTS. */
export const WAKE_NIGHTS = 7
export const WAKE_MIN_NIGHTS = 3

/** A date as YYYY-MM-DD in local time. */
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Minutes after midnight of a "YYYY-MM-DDTHH:MM" wake time; null when it has no usable time or is past noon (a nap, not a night). */
const wakeMinutes = (wake: string | undefined): number | null => {
  const m = /T(\d{2}):(\d{2})/.exec(wake ?? '')
  if (!m) return null
  const min = Number(m[1]) * 60 + Number(m[2])
  return min < 12 * 60 ? min : null
}

/**
 * When the day starts, in minutes after midnight: two hours before the median wake of the last WAKE_NIGHTS nights filed before `before`,
 * kept between DAY_STARTS_EARLIEST and DAY_STARTS_LATEST. `nights` is day → the night that ended on it (sleepOf in events.ts fits).
 */
export function dayStartsAt(nights: Record<string, { wake?: string }>, before: string): number {
  const wakes = Object.keys(nights)
    .filter((d) => d < before)
    .sort()
    .slice(-WAKE_NIGHTS)
    .map((d) => wakeMinutes(nights[d].wake))
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b)
  if (wakes.length < WAKE_MIN_NIGHTS) return DAY_STARTS_DEFAULT
  const mid = wakes.length % 2 ? wakes[(wakes.length - 1) / 2] : (wakes[wakes.length / 2 - 1] + wakes[wakes.length / 2]) / 2
  return Math.max(DAY_STARTS_EARLIEST, Math.min(DAY_STARTS_LATEST, Math.round(mid - WAKE_LEAD)))
}

/** "HH:MM" for a time in minutes after midnight. */
export const clockOf = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/**
 * The day it is for the habits, given the clock and whether a calendar date has begun (a sleep reading filed under it, or a `day_start`
 * for it). After midnight it stays the day before until one of those, or until `startsAt` (minutes after midnight, see dayStartsAt).
 */
export function wakingDay(now: Date, begun: (date: string) => boolean, startsAt: number = DAY_STARTS_DEFAULT): string {
  const calendar = localDate(now)
  if (now.getHours() * 60 + now.getMinutes() >= startsAt || begun(calendar)) return calendar
  const before = new Date(now)
  before.setDate(before.getDate() - 1)
  return localDate(before)
}
