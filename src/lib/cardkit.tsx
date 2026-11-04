// Pieces the Team screen and the Professor's lab share: the menu that opens on a card, which look the
// cards have, cards gliding to their new places, and the sort buttons over a grid of them.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useBoxes } from '../Fit.tsx'
import type { Box, CardLook } from '../MonCard.tsx'
import { play } from './sfx.ts'

// ── a menu on a card ────────────────────────────────────────────────────────
export function CardMenu({ anchor, title, onClose, children }: { anchor: DOMRect; title: string; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const w = el.offsetWidth, h = el.offsetHeight
    const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - w / 2), window.innerWidth - w - 8)
    const below = anchor.bottom + 8
    setAt({ left, top: below + h > window.innerHeight - 8 ? Math.max(8, anchor.top - h - 8) : below })
  }, [anchor])
  useEffect(() => {
    root.current?.querySelector('button')?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', esc)
    window.addEventListener('pointerdown', out, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => { window.removeEventListener('keydown', esc); window.removeEventListener('pointerdown', out, true); window.removeEventListener('resize', onClose); window.removeEventListener('scroll', onClose, true) }
  }, [onClose])
  return createPortal(
    <div ref={root} className="mc-menu" role="menu" aria-label={title} style={at ? { left: at.left, top: at.top } : { left: 0, top: 0, visibility: 'hidden' }}>
      <p className="mc-menu-t">{title}</p>
      {children}
    </div>,
    document.body,
  )
}

// ── the card's look: the art filling the whole card (the default), or the classic framed one ──
const LOOK_KEY = 'pokedex.cardlook.v1'
const savedLook = (): CardLook => { try { return localStorage.getItem(LOOK_KEY) === 'classic' ? 'classic' : 'full' } catch { return 'full' } }

export function useLook(): { look: CardLook; setLook: (l: CardLook) => void; boxOf: (form: string) => Box | undefined } {
  const [look, set] = useState<CardLook>(savedLook)
  const boxes = useBoxes()
  return {
    look,
    setLook: (l) => { set(l); try { localStorage.setItem(LOOK_KEY, l) } catch { /* not remembered */ } play('click') },
    boxOf: (form) => boxes?.[form],
  }
}

export function LookToggle({ look, setLook }: { look: CardLook; setLook: (l: CardLook) => void }) {
  return (
    <>
      <span className="k-label">Cards</span>
      <div className="mc-sort" role="group" aria-label="How the cards look">
        {([['full', 'Full art'], ['classic', 'Classic']] as [CardLook, string][]).map(([id, name]) => <button key={id} type="button" aria-pressed={look === id} onClick={() => setLook(id)}><span>{name}</span></button>)}
      </div>
    </>
  )
}

// ── sort buttons ────────────────────────────────────────────────────────────
export function SortBar<T extends string>({ sorts, value, onChange }: { sorts: [T, string][]; value: T; onChange: (s: T) => void }) {
  return (
    <div className="mc-sort" role="group" aria-label="Sort the lab">
      {sorts.map(([id, name]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}><span>{name}</span></button>)}
    </div>
  )
}

// ── cards that change places glide there (FLIP) ─────────────────────────────
/** Every element marked data-flip="<id>" slides from where it was last render to where it is now. `held` is the one being dragged: it is left alone. */
export function useFlip(held: RefObject<string | null>, once?: RefObject<boolean>): void {
  const rects = useRef(new Map<string, { x: number; y: number }>())
  useLayoutEffect(() => {
    const next = new Map<string, { x: number; y: number }>()
    // with `once`, things only glide on a render that follows a move (it is set by the move, and used up here), never when a pocket is switched
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || (once !== undefined && !once.current)
    if (once) once.current = false
    document.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const id = el.dataset.flip as string
      // measured from the screen the card is on (not the window), so a tab sliding in, the page scrolling or a sheet opening never looks like a card moving
      const r = el.getBoundingClientRect()
      const root = (el.closest('.pane') ?? document.body).getBoundingClientRect()
      const at = { x: r.left - root.left, y: r.top - root.top }
      next.set(id, at)
      const was = rects.current.get(id)
      if (!was || calm || id === held.current) return
      const dx = was.x - at.x, dy = was.y - at.y
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 230, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.12)' })
    })
    rects.current = next
  })
}
