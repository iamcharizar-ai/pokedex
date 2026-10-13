// Where pictures live and how a few things are named. Shared by the screens
// and the recap so they cannot name the same badge two ways.
import { LEAGUES, type Leader } from '../../core/gyms.ts'
import { BALL_NAME, type Ball } from '../../core/rules.ts'

export const still = (form: string, shiny = false) => `/sprites/static${shiny ? '-shiny' : ''}/${form}.png`
export const fmtDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

/** Badge pictures exist for Kanto to Kalos and the Orange Islands; the rest get a plain shape. */
export const badgeArt = (league: number, slot: number): string | null => {
  const l = LEAGUES[league]
  if (!l || slot >= l.gyms.length) return null
  if (l.region === null) return `/sprites/badges/orange-${slot + 1}.png`
  return l.region <= 6 ? `/sprites/badges/${l.region}-${slot + 1}.png` : null
}
export const badgeName = (t: Leader): string => `${t.badge}${/ Z$/.test(t.badge) ? '' : ' Badge'}`
export const leagueName = (i: number): string => LEAGUES[i]?.name ?? ''
/** 'a Poke Ball', 'an Ultra Ball'. */
export const aBall = (b: Ball): string => `${/^[aeiou]/i.test(BALL_NAME[b]) ? 'an' : 'a'} ${BALL_NAME[b]}`
