// One thing in a slot: the Bag's language (UI-AUDIT-2026-11-04, "a thing is its icon and a number").
// The icon fills the slot, the count sits bottom-right, a gold E says it is in use, and the name and
// what it does wait in the tip (hover or focus) or in the sheet a tap opens. Nothing else is written.
//
//   material="stone"  the Bag's grey block-game slot (the Bag itself, unchanged)
//   material="glass"  the same slot on the night page (the Collector, Collect, battle prep, from later phases)
//
// The look is in screens/menu.css (.inv-slot, stone) and screens/parts.css (.inv-slot.glass); its colours
// are tokens (--slot-stone-*, --slot-glass-*).
import type { HTMLAttributes, ReactNode, Ref } from 'react'

export type SlotMaterial = 'stone' | 'glass'

interface Props extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** the picture; nothing for an empty slot */
  icon?: ReactNode
  /** the count, already short ("1.2k"); left out (or null) when it is one or none */
  n?: ReactNode
  /** in use (equipped, held, worn): the gold E */
  on?: boolean
  /** a stamp in the top-right corner, e.g. the Collector's ×2 */
  stamp?: ReactNode
  /** what the tip says: the name, then a line */
  tip?: { title: ReactNode; note?: ReactNode }
  material?: SlotMaterial
  /** a button (it can be tapped), or a span (an empty place, or something only read) */
  as?: 'button' | 'span'
  /** a button that cannot be pressed now (it is in use) */
  disabled?: boolean
  ref?: Ref<HTMLElement>
}

export function Slot({ icon, n, on, stamp, tip, material = 'stone', as = 'button', disabled, className = '', ref, ...rest }: Props) {
  const cls = `inv-slot ${material === 'glass' ? 'glass' : ''} ${on ? 'on' : ''} ${className}`
  const inner = (
    <>
      {icon}
      {n !== undefined && n !== null && n !== false && <b className="inv-n">{n}</b>}
      {on && <i className="inv-on" aria-hidden>E</i>}
      {stamp && <i className="inv-stamp" aria-hidden>{stamp}</i>}
      {tip && <span className="inv-tip" aria-hidden><b>{tip.title}</b>{tip.note !== undefined && <small>{tip.note}</small>}</span>}
    </>
  )
  return as === 'button'
    ? <button type="button" ref={ref as Ref<HTMLButtonElement>} className={cls} disabled={disabled} {...rest}>{inner}</button>
    : <span ref={ref as Ref<HTMLSpanElement>} className={cls} {...rest}>{inner}</span>
}
