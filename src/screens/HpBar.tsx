// One HP bar for the wild Pokemon, the leader and the boss. Before this, three
// places each decided for themselves where a bar turns amber and red.
//
//   'game'  the boxed look of the battle scene (a label, a bar)
//   'kit'   the kit's bar, for tiles, sheets and the road, with the card's segments for a boss
import { KBar } from '../Kit.tsx'
import { hpTone } from './hp.ts'


export function HpBar({ value, max, label, name, variant = 'kit', segments }: {
  value: number
  max: number
  /** what a reader of the number sees, e.g. "958 HP" (kit) */
  label?: string
  /** whose HP it is, for the screen reader */
  name?: string
  variant?: 'game' | 'kit'
  /** where the task edges fall (0 to 1), drawn as marks across the bar (the boss's card) */
  segments?: number[]
}) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const tone = hpTone(frac)
  if (variant === 'game') {
    return (
      <div className="hp-row">
        <b>HP</b>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={name ? `${name}'s HP` : 'HP'}>
          <i className={`hp ${tone}`} style={{ width: `${frac * 100}%` }} />
        </div>
      </div>
    )
  }
  return (
    <div className="hpbar-kit">
      <KBar value={Math.round(value)} max={max} kind={`hp${tone ? ` ${tone}` : ''}` as 'hp' | 'hp mid' | 'hp low'} label={label ?? `${Math.round(value).toLocaleString('en-IN')} HP`} />
      {segments && <span className="boss-segs" aria-hidden>{segments.map((e, i) => <i key={i} style={{ left: `${e * 100}%` }} />)}</span>}
    </div>
  )
}
