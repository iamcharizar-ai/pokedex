// The object card: the benchmark's anatomy (UI-AUDIT-2026-11-04 §1) without the Pokemon in it.
//
//   a frame whose metal is the state · an art field in the thing's colour (--tc) · up to three corner badges
//   a banner over the bottom of the art · a pill under the card · a ribbon across the top edge
//
// MonCard is this with a Pokemon's numbers in it. From later phases a ware, a reward, a legend's key, an Incense
// pick, a Pokedex entry and a piece of news are this too, so the app has one shape for "a thing" and converges on it.
// The look is screens/moncard.css (the .mc classes) and, for the metals any card can ask for, screens/parts.css.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from 'react'
import { IcPlus } from './lib/icons.tsx'

/** 'classic': art in a frame with the name under it. 'full': the art covers the face, the name hidden, the pill under the card. */
export type CardLook = 'classic' | 'full'
/** What the frame says: silver (ordinary), gold (the one that matters: a partner, the thing to buy), elite (maxed), mega,
 *  locked (not yet), blue and pink (uncommon and rare). A Pokemon's card also sets its own classes (MonCard). */
export type Metal = 'silver' | 'gold' | 'elite' | 'mega' | 'locked' | 'blue' | 'pink'

export interface ObjCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'name'> {
  look?: CardLook
  metal?: Metal
  /** the colour of the art field (a type, a kind of item) */
  tc?: string
  /** what stands on the art field */
  art?: ReactNode
  /** corner badges: top left, top right (with its tip), top centre */
  corners?: { tl?: ReactNode; tr?: ReactNode; trTitle?: string; top?: ReactNode }
  /** the name over the bottom of the art (hidden in the full look) */
  name?: ReactNode
  /** what the banner says, its fill (0 to 1, the --into the banner draws) and whether it is the gold banner */
  banner?: ReactNode
  fill?: number
  gold?: boolean
  /** the pill under the card (a Pokemon's hearts) */
  pill?: ReactNode
  /** across the top edge ("Partner") */
  ribbon?: string
  /** an open place: a dashed card with a plus, the banner saying `emptyText` */
  empty?: boolean
  emptyText?: string
  /** more custom properties for the card (a Pokemon's bob) */
  vars?: Record<string, string>
  ref?: Ref<HTMLButtonElement>
}

export function ObjCard({ look = 'classic', metal, tc, art, corners, name, banner, fill, gold, pill, ribbon, empty, emptyText = 'Open', vars, className = '', style, ref, ...rest }: ObjCardProps) {
  if (empty) {
    return (
      <button type="button" ref={ref} className={`mc ${look} empty ${className}`} style={style} {...rest}>
        <span className="mc-f">
          <span className="mc-art"><span className="mc-plus"><IcPlus size={30} /></span></span>
          <span className="mc-lv"><b>{emptyText}</b></span>
        </span>
        {ribbon && <span className="mc-ribbon">{ribbon}</span>}
      </button>
    )
  }
  const css = { ...(tc ? { ['--tc' as string]: tc } : {}), ...vars, ...(fill !== undefined ? { ['--into' as string]: `${Math.max(0, Math.min(1, fill)) * 100}%` } : {}), ...style } as CSSProperties
  return (
    <button type="button" ref={ref} className={`mc ${look} ${metal ? `m-${metal}` : ''} ${className}`} style={css} {...rest}>
      <span className="mc-f">
        <span className="mc-art">
          {art}
          {corners?.tl !== undefined && <span className="mc-type" aria-hidden>{corners.tl}</span>}
          {corners?.tr !== undefined && <span className="mc-sig" aria-hidden title={corners.trTitle}>{corners.tr}</span>}
          {corners?.top !== undefined && <span className="mc-shiny" aria-hidden>{corners.top}</span>}
          {name !== undefined && <span className="mc-name">{name}</span>}
        </span>
        {banner !== undefined && <span className={`mc-lv ${gold ? 'trained' : ''}`}><b>{banner}</b></span>}
        {look === 'classic' && pill}
      </span>
      {look === 'full' && pill}
      {ribbon && <span className="mc-ribbon">{ribbon}</span>}
    </button>
  )
}
