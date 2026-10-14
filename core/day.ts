// GAME CORE: which day it is (rules version 13, RULES-V13.md section 9).
//
// A day does not end at midnight. It ends when you wake up: the band's reading
// of the night (a `vitals` row with a sleep score, filed under the morning it
// ended) is the moment the new day starts, with its Sleep pillar already
// filled. Until then, after midnight, the apps stay on yesterday, so habits do
// not reset under you while the evening is still going.
//
// Two ways out if no reading comes (the band was not worn, or did not sync):
// a `day_start` event for the date (the "Start my day" button), or the clock
// reaching ROLLOVER_HOUR. Before midnight it is always the calendar date.
//
// Pure: the apps pass in the clock and what they know about each date.

/** Written by Life OS (or the Pokedex) when the day is started by hand: `{}` on the date that begins. */
export const DAY_START_EVENT = 'day_start'
/** With no reading and no start by hand, the new day begins at this hour (local time). */
export const ROLLOVER_HOUR = 14

/** A date as YYYY-MM-DD in local time. */
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * The day it is for the habits, given the clock and whether a calendar date has begun (a sleep reading filed under it, or a
 * `day_start` for it). After midnight it stays the day before until one of those, or until ROLLOVER_HOUR.
 */
export function wakingDay(now: Date, begun: (date: string) => boolean): string {
  const calendar = localDate(now)
  if (now.getHours() >= ROLLOVER_HOUR || begun(calendar)) return calendar
  const before = new Date(now)
  before.setDate(before.getDate() - 1)
  return localDate(before)
}
