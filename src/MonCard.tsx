// One Pokemon as a portrait card, built once and used everywhere on the Team screen: the party, the lab,
// the pickers, the gallery in ?kit. Slot position carries the role, so the card itself only has a look:
// art on its type's colour, "Lv N" on a banner under the art (never beside it), bond hearts under that.
// It reads nothing from the game: Team.tsx turns a Mon into these props (monCardOf), the gallery makes them by hand.
import { useEffect, useState, type ButtonHTMLAttributes, type CSSProperties, type Ref } from 'react'
import { ItemIcon } from './Item.tsx'
import { IcArrowUp, IcHeart, IcPlus, IcStar } from './lib/icons.tsx'
import { still } from './lib/art.ts'
import { typeColor } from './screens/types.ts'

export interface MonCardData {
  form: string
  name: string
  shiny?: boolean
  level: number
  /** how far into the current level, 0 to 1: it fills the banner */
  into?: number
  /** bond hearts now, and what the next bond level takes (null: every level reached, the Elite frame) */
  hearts: number
  need: number | null
  type: string
  /** the signature it brings: its picture (an item) and name */
  sig?: { icon: string; name: string }
  /** a berry in the bag would take it to its next bond level: the green arrow */
  canFeed?: boolean
  mega?: boolean
  /** fully trained (the banner turns gold) */
  trained?: boolean
}

export type CardState = 'card' | 'empty' | 'locked'
/** 'classic': art in a frame with the name under it. 'full': the art covers the whole card face, no name, the hearts bar under the card (the Clash Royale way). */
export type CardLook = 'classic' | 'full'
/** The drawn part of a sprite: left, top, right, bottom (sprites/bbox.json) */
export type Box = [number, number, number, number]
export type CardRole = 'partner' | 'party' | 'lab'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role'> {
  mon?: MonCardData
  state?: CardState
  role?: CardRole
  /** a pill straddling the top edge ("Partner") */
  ribbon?: string
  look?: CardLook
  /** with the full look: what is drawn in the sprite, so it can be enlarged by a whole number to fill the card */
  box?: Box
  /** it is in the party already (a dimmed copy in a picker) or being held (the slot it left) */
  dimmed?: boolean
  /** the card is being dragged (or has just landed): its place shows only an outline */
  held?: boolean
  selected?: boolean
  /** text on an empty slot */
  emptyText?: string
  ref?: Ref<HTMLButtonElement>
}

/** Each card idles on its own beat: a hash of the form, so a row does not bob in step. */
const beat = (form: string): string => `${-(([...form].reduce((n, c) => n + c.charCodeAt(0), 0) % 24) / 10)}s`

/** Is the screen narrow enough that cards are about 105px wide (three to a row on a phone)? */
function useNarrow(): boolean {
  const q = '(max-width: 459px)'
  const [n, set] = useState(() => matchMedia(q).matches)
  useEffect(() => { const m = matchMedia(q); const f = () => set(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return n
}

/**
 * Full look: enlarge the Pokemon so what is drawn fills about the same share of the card whatever its size (a Goldeen is small in its
 * file, an Onix is not), and stand its feet near the banner. A scale that is a whole number (or within a hair of one) is drawn as it is,
 * crisp. Any other is drawn from a copy enlarged four times with hard edges and then shrunk smoothly (see `big`), which keeps the edges
 * clean where the browser's own fractional scaling would make some pixels wider than others.
 */
function fullFit(box: Box | undefined, narrow: boolean): { style: CSSProperties | undefined; smooth: boolean } {
  if (!box) return { style: undefined, smooth: false }
  const W = narrow ? 100 : 132, H = 170
  const [l, t, r, b] = box
  let k = Math.max(1, Math.min(3.6, Math.min((W * 0.82) / Math.max(1, r - l), (H * 0.64) / Math.max(1, b - t))))
  const whole = Math.abs(k - Math.round(k)) < 0.1
  if (whole) k = Math.round(k)
  const x = Math.round(-((l + r) / 2 - 48) * k)
  const y = Math.round(H * 0.8 - (H / 2 + (b - 48) * k))
  return { style: { transform: `translate(${x}px, ${y}px) scale(${k.toFixed(3)})` }, smooth: !whole }
}

const bigs = new Map<string, string>()
/** A sprite enlarged four times, hard-edged, as a picture to shrink from: ready after it has been made once (null until then). */
function useBig(src: string, on: boolean): string | null {
  const [url, set] = useState<string | null>(() => bigs.get(src) ?? null)
  useEffect(() => {
    if (!on) return
    const have = bigs.get(src)
    if (have) { set(have); return }
    let live = true
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth * 4; c.height = img.naturalHeight * 4
        const g = c.getContext('2d')
        if (!g) return
        g.imageSmoothingEnabled = false
        g.drawImage(img, 0, 0, c.width, c.height)
        const u = c.toDataURL('image/png')
        bigs.set(src, u)
        if (live) set(u)
      } catch { /* a picture that cannot be read is drawn plain */ }
    }
    img.src = src
    return () => { live = false }
  }, [src, on])
  return on ? url : null
}

export function MonCard({ mon, state = 'card', role = 'lab', ribbon, look = 'classic', box, dimmed, held, selected, emptyText = 'Open', className = '', ref, ...rest }: Props) {
  // hooks first: a card and an open place share this component
  const narrow = useNarrow()
  const fit = look === 'full' && mon ? fullFit(box, narrow) : null
  const big = useBig(mon ? still(mon.form, mon.shiny) : '', Boolean(fit?.smooth))
  if (state === 'empty' || !mon) {
    return (
      <button type="button" ref={ref} className={`mc ${look} empty ${dimmed ? 'dim' : ''} ${held ? 'held' : ''} ${selected ? 'sel' : ''} ${className}`} {...rest}>
        <span className="mc-f">
          <span className="mc-art"><span className="mc-plus"><IcPlus size={30} /></span></span>
          <span className="mc-lv"><b>{emptyText}</b></span>
        </span>
        {ribbon && <span className="mc-ribbon">{ribbon}</span>}
      </button>
    )
  }
  const locked = state === 'locked'
  const elite = mon.need === null
  const into = Math.max(0, Math.min(1, mon.into ?? 0))
  const style = { ['--tc' as string]: typeColor(mon.type), ['--bob' as string]: beat(mon.form), ['--into' as string]: `${(mon.trained ? 1 : into) * 100}%` } as CSSProperties
  const pct = mon.need ? Math.max(0, Math.min(1, mon.hearts / mon.need)) : 1
  const hearts = elite
    ? <span className="mc-hearts elite" aria-hidden><IcStar size={12} />Elite</span>
    : (
      <span className={`mc-hearts ${mon.canFeed ? 'ready' : ''}`} aria-hidden>
        <i style={{ width: `${pct * 100}%` }} />
        <span className="mc-hearts-t">{mon.canFeed && <IcArrowUp size={12} />}<IcHeart size={11} />{mon.hearts}/{mon.need}</span>
      </span>
    )
  return (
    <button
      type="button"
      ref={ref}
      className={`mc ${look} r-${role} ${elite && !locked ? 'elite' : ''} ${locked ? 'locked' : ''} ${mon.mega ? 'mega' : ''} ${dimmed ? 'dim' : ''} ${held ? 'held' : ''} ${selected ? 'sel' : ''} ${className}`}
      style={style}
      aria-label={locked ? 'Not found yet' : `${mon.name}, level ${mon.level}${role === 'partner' ? ', partner' : ''}, ${mon.need === null ? 'every bond level reached' : `${mon.hearts} of ${mon.need} hearts`}${mon.canFeed ? ', can be fed to the next bond level' : ''}`}
      {...rest}
    >
      <span className="mc-f">
        <span className="mc-art">
          {look === 'full'
            ? <span className="mc-fit" style={fit?.style}><img src={big ?? still(mon.form, mon.shiny)} alt="" width={96} height={96} className={`sprite mc-sprite ${big ? 'smooth' : ''}`} draggable={false} decoding="async" /></span>
            : <img src={still(mon.form, mon.shiny)} alt="" width={96} height={96} className="sprite mc-sprite" draggable={false} loading="lazy" decoding="async" />}
          {!locked && <span className="mc-type" aria-hidden><img src={`/sprites/types/${mon.type}.png`} alt="" width={16} height={16} onError={(e) => { e.currentTarget.style.display = 'none' }} /></span>}
          {!locked && mon.sig && <span className="mc-sig" aria-hidden title={mon.sig.name}><ItemIcon id={mon.sig.icon} size={18} /></span>}
          {!locked && mon.shiny && <span className="mc-shiny" aria-hidden><IcStar size={12} /></span>}
          <span className="mc-name">{locked ? '???' : mon.name}</span>
        </span>
        {!locked && <span className={`mc-lv ${mon.trained ? 'trained' : ''}`}><b>Lv {mon.level}</b></span>}
        {!locked && look === 'classic' && hearts}
      </span>
      {!locked && look === 'full' && hearts}
      {ribbon && <span className="mc-ribbon">{ribbon}</span>}
    </button>
  )
}
