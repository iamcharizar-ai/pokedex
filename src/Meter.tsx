// One meter for everything that fills: HP, XP, hearts, a season step, a star (UI-AUDIT-2026-11-04 §4.4).
// Before it there were seven bars, each with its own colours and none able to show what an action would do.
//
//   today   how much of `value` came today: drawn brighter at the end of the fill
//   ghost   what an action would add (+) or take (−): a striped, pulsing stretch, the berry's ghost hearts made general
//   links   draw it as a chain of this many links (hearts to the next bond level) instead of one bar
//   lost    what was taken recently (today's damage): a pale stretch after the fill, so the hit is seen, not read
//   marks   where segments end, as fractions (a boss's tasks)
//
// It only draws: the numbers come from the game. The look is screens/parts.css (.meter), the pulse is
// screens/presets.css (ghost-pulse), the colours are tokens (--meter-*).
import type { CSSProperties, ReactNode } from 'react'
import { hpTone } from './screens/hp.ts'

export type MeterKind = 'hp' | 'xp' | 'hearts' | 'gold'

const clamp = (x: number): number => Math.max(0, Math.min(1, x))

export function Meter({ value, max, kind = 'xp', today = 0, ghost = 0, lost = 0, links, marks, label, name, ghostText, size = 'md', className = '' }: {
  value: number
  max: number
  kind?: MeterKind
  today?: number
  ghost?: number
  lost?: number
  links?: number
  marks?: number[]
  /** written inside the bar (short: "219 / 1,100") */
  label?: ReactNode
  /** whose meter it is, for a screen reader ("The wild Pokemon's HP") */
  name: string
  /** what the ghost means, read after the value ("110 off if you throw an Ultra Ball") */
  ghostText?: string
  size?: 'sm' | 'md' | 'lg'
  /** a preset from screens/presets.css, e.g. 'pre-sweep' (the fill sweeps in as it first draws) */
  className?: string
}) {
  const v = clamp(max > 0 ? value / max : 0)
  const t = Math.min(v, clamp(max > 0 ? today / max : 0))
  const g = max > 0 ? ghost / max : 0
  // a gain sits after the fill, a loss over its end
  const gFrom = g >= 0 ? v : clamp(v + g)
  const gTo = g >= 0 ? clamp(v + g) : v
  const tone = kind === 'hp' ? hpTone(v) : ''
  const aria = {
    role: 'progressbar' as const, 'aria-label': name, 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': Math.round(value),
    'aria-valuetext': `${Math.round(value).toLocaleString('en-IN')} of ${max.toLocaleString('en-IN')}${lost > 0 ? `, ${Math.round(lost).toLocaleString('en-IN')} taken today` : ''}${today > 0 ? `, ${Math.round(today).toLocaleString('en-IN')} of it today` : ''}${ghost !== 0 && ghostText ? `; ${ghostText}` : ''}`,
  }
  if (links) {
    const on = Math.round(v * links), fromToday = Math.round((v - t) * links)
    const gl = Math.round(gFrom * links), gr = Math.round(gTo * links)
    const cols = links <= 20 ? links : Math.ceil(links / 2)
    return (
      <div className={`meter-chain k-${kind} s-${size} ${className}`} style={{ ['--cols' as string]: cols } as CSSProperties} {...aria}>
        {Array.from({ length: links }, (_, i) => {
          const ghostHere = ghost !== 0 && i >= gl && i < gr
          const cls = ghostHere ? (ghost < 0 ? 'on ghost loss' : 'ghost gain') : i < on ? (i >= fromToday ? 'on today' : 'on') : ''
          return <i key={i} className={`ml ${cls} ${i % cols === cols - 1 ? 'end' : ''}`} />
        })}
      </div>
    )
  }
  return (
    <div className={`meter k-${kind} ${tone} s-${size} ${className}`} {...aria}>
      <i className="meter-fill" style={{ width: `${(v - t) * 100}%` }} />
      {lost > 0 && v < 1 && <i className="meter-lost" style={{ left: `${v * 100}%`, width: `${(clamp(v + lost / max) - v) * 100}%` }} />}
      {t > 0 && <i className="meter-today" style={{ left: `${(v - t) * 100}%`, width: `${t * 100}%` }} />}
      {ghost !== 0 && gTo > gFrom && <i className={`meter-ghost ${ghost < 0 ? 'loss' : 'gain'}`} style={{ left: `${gFrom * 100}%`, width: `${(gTo - gFrom) * 100}%` }} />}
      {marks?.map((m, i) => <i key={i} className="meter-mark" style={{ left: `${clamp(m) * 100}%` }} />)}
      {label !== undefined && <span className="meter-label">{label}</span>}
    </div>
  )
}
