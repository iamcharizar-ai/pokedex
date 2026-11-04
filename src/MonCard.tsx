// One Pokemon as a portrait card, built once and used everywhere on the Team screen: the party, the lab,
// the pickers, the gallery in ?kit. Slot position carries the role, so the card itself only has a look:
// art on its type's colour, "Lv N" on a banner under the art (never beside it), bond hearts under that.
// It reads nothing from the game: Team.tsx turns a Mon into these props (monCardOf), the gallery makes them by hand.
// The card's shape is ObjCard (the same anatomy for any thing); this file only fills it with a Pokemon.
import { useEffect, useState, type ButtonHTMLAttributes, type Ref } from 'react'
import { ItemIcon } from './Item.tsx'
import { ObjCard, type CardLook } from './ObjCard.tsx'
import { IcArrowUp, IcHeart, IcStar } from './lib/icons.tsx'
import { still } from './lib/art.ts'
import { fullFit, type Box } from './lib/fit.ts'
import { useBig } from './lib/pixel.tsx'
import { typeColor } from './screens/types.ts'

export type { Box } from './lib/fit.ts'
export type { CardLook } from './ObjCard.tsx'

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
  /** hearts a feeding would add, drawn as a striped ghost on the hearts pill (the feed sheet) */
  ghost?: number
  mega?: boolean
  /** fully trained (the banner turns gold) */
  trained?: boolean
}

export type CardState = 'card' | 'empty' | 'locked'
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
  /** 'hero': the large card a Pokemon's page opens on */
  size?: 'hero'
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

/** Full look: the sprite enlarged to fill the art field (lib/fit.ts fullFit); the field is 100px wide on a phone, 132 wider, 170 tall. */
function cardFit(box: Box | undefined, narrow: boolean, hero = false): { style: { transform: string } | undefined; smooth: boolean } {
  if (!box) return { style: undefined, smooth: false }
  const f = hero ? fullFit(box, 150, 232) : fullFit(box, narrow ? 100 : 132, 170)
  return { style: { transform: `translate(${f.x}px, ${f.y}px) scale(${f.k.toFixed(3)})` }, smooth: f.smooth }
}

export function MonCard({ mon, state = 'card', role = 'lab', ribbon, look = 'classic', box, dimmed, held, selected, emptyText = 'Open', size, className = '', ref, ...rest }: Props) {
  // hooks first: a card and an open place share this component
  const narrow = useNarrow()
  const fit = look === 'full' && mon ? cardFit(box, narrow, size === 'hero') : null
  const big = useBig(mon ? still(mon.form, mon.shiny) : '', Boolean(fit?.smooth))
  const marks = `${dimmed ? 'dim' : ''} ${held ? 'held' : ''} ${selected ? 'sel' : ''} ${size === 'hero' ? 'hero' : ''}`
  if (state === 'empty' || !mon) return <ObjCard ref={ref} look={look} empty emptyText={emptyText} ribbon={ribbon} className={`${marks} ${className}`} {...rest} />
  const locked = state === 'locked'
  const elite = mon.need === null
  const into = Math.max(0, Math.min(1, mon.into ?? 0))
  const pct = mon.need ? Math.max(0, Math.min(1, mon.hearts / mon.need)) : 1
  const hearts = elite
    ? <span className="mc-hearts elite" aria-hidden><IcStar size={12} />Elite</span>
    : (
      <span className={`mc-hearts ${mon.canFeed ? 'ready' : ''}`} aria-hidden>
        <i style={{ width: `${pct * 100}%` }} />
        {mon.ghost && mon.need ? <i className="ghost" style={{ left: `${pct * 100}%`, width: `${Math.min(1 - pct, mon.ghost / mon.need) * 100}%` }} /> : null}
        <span className="mc-hearts-t">{mon.canFeed && <IcArrowUp size={12} />}<IcHeart size={11} />{mon.hearts}/{mon.need}</span>
      </span>
    )
  const art = look === 'full'
    ? <span className="mc-fit" style={fit?.style}><img src={big ?? still(mon.form, mon.shiny)} alt="" width={96} height={96} className={`sprite mc-sprite ${big ? 'smooth' : ''}`} draggable={false} loading="lazy" decoding="async" /></span>
    : <img src={still(mon.form, mon.shiny)} alt="" width={96} height={96} className="sprite mc-sprite" draggable={false} loading="lazy" decoding="async" />
  return (
    <ObjCard
      ref={ref}
      look={look}
      className={`r-${role} ${elite && !locked ? 'elite' : ''} ${locked ? 'locked' : ''} ${mon.mega ? 'mega' : ''} ${marks} ${className}`}
      tc={typeColor(mon.type)}
      vars={{ '--bob': beat(mon.form) }}
      fill={mon.trained ? 1 : into}
      aria-label={locked ? 'Not found yet' : `${mon.name}, level ${mon.level}${role === 'partner' ? ', partner' : ''}, ${mon.need === null ? 'every bond level reached' : `${mon.hearts} of ${mon.need} hearts`}${mon.canFeed ? ', can be fed to the next bond level' : ''}`}
      art={art}
      corners={locked ? undefined : {
        tl: <img src={`/sprites/types/${mon.type}.png`} alt="" width={16} height={16} onError={(e) => { e.currentTarget.style.display = 'none' }} />,
        tr: mon.sig ? <ItemIcon id={mon.sig.icon} size={16} /> : undefined,
        trTitle: mon.sig?.name,
        top: mon.shiny ? <IcStar size={12} /> : undefined,
      }}
      name={locked ? '???' : mon.name}
      banner={locked ? undefined : <>Lv {mon.level}</>}
      gold={mon.trained}
      pill={locked ? undefined : hearts}
      ribbon={ribbon}
      {...rest}
    />
  )
}
