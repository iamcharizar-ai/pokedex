// One HP bar for the wild Pokemon's leader, the boss and the league road: the classic battle bar the owner chose for the
// scene's plates (Meter look="game": green, amber at half, red at a fifth, the number inside). The boss's task edges are marks.
import { Meter } from '../Meter.tsx'

export function HpBar({ value, max, label, name, segments }: {
  value: number
  max: number
  /** what is written in the bar, e.g. "958 HP" */
  label?: string
  /** whose HP it is, for the screen reader */
  name?: string
  /** kept for the old callers; every HP bar is the game bar now */
  variant?: 'game' | 'kit'
  /** where the task edges fall (0 to 1), drawn as marks across the bar (the boss's card) */
  segments?: number[]
}) {
  return <Meter look="game" kind="hp" value={value} max={max} name={name ? `${name}'s HP` : 'HP'} label={label ?? `${Math.round(value).toLocaleString('en-IN')} HP`} marks={segments} size="lg" />
}
