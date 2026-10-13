// When the first-run tour is shown. Pure, so tools/tour.test.mjs can check it.
//
// It is for a game that has not started: no day has earned any XP. A game with
// history never sees it unasked (the help window can open it any time), and
// closing it, by finishing or skipping, is remembered on this device.

/**
 * `param` is the page's `?tour=`: `1` forces it, `0` forbids it (the screenshot and
 * audit tools use that), anything else leaves it to `done` and `fresh`.
 */
export function shouldTour(param: string | null, done: boolean, fresh: boolean): boolean {
  if (param === '1') return true
  if (param === '0') return false
  return fresh && !done
}

export const TOUR_KEY = 'pokedex.tour.v1'
