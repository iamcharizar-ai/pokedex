// Dragging a Pokemon card between the party's places and the lab, with Pointer Events and our own
// drag layer (the browser's drag and drop cannot be styled and does not work on touch).
//
//   mouse: the drag starts after 4px of movement.
//   touch: only after a press held still for HOLD_MS (so a brush or a misclick never picks a card up).
//          Move before that and it is a scroll or a swipe between tabs, which the page keeps. A quick tap
//          stays a click. Once the card is up, the page does not scroll or swipe (body.dragging; App.tsx).
//
// While it runs, a copy of the card follows the pointer (lifted, tilted by how fast it moves) and the
// page scrolls near its top and bottom edges. What is under the pointer is told to `hooks.hover`;
// on release `hooks.drop` decides (and does the move). A dropped card glides to where it landed; one
// that is not accepted springs back. All of it moves by transform only, so it stays smooth.
import type { Target } from './party.ts'

export interface DragHooks {
  /** the drag began for this card: show its place as an outline */
  begin(uid: string): void
  /** what is under the pointer now: a place, the lab, or nothing */
  hover(target: Target | null): void
  /** let go over `target` (null: over nothing): did the move happen? */
  drop(uid: string, target: Target | null): boolean
  /** all over, the copy has landed or sprung back */
  end(): void
}

/** How long a finger must stay down on a card before it lifts. */
export const HOLD_MS = 1200
/** The card starts to show it is being held after this long, so the wait is not a mystery. */
const CUE_MS = 250
const MOUSE_PX = 4
const TOUCH_SLOP = 8
let busy = false

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))
/** Wait n frames, or n x 50ms if the page is not drawing frames (a hidden tab), so a drop can never be left half-done. */
const frames = (n: number): Promise<void> => new Promise((res) => { const t = window.setTimeout(res, n * 50); const f = (k: number) => (k <= 0 ? (clearTimeout(t), res()) : requestAnimationFrame(() => f(k - 1))); f(n) })
const calm = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

/** The place or the lab under a point, from the data-place and data-lab marks on the screen. */
export function targetAt(x: number, y: number): Target | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-place],[data-lab]')
  if (!el) return null
  return el.dataset.place !== undefined ? { slot: Number(el.dataset.place) } : 'lab'
}

/** Where a card sits now: its wrapper (marked data-flip with the card's uid). */
const rectOf = (uid: string): DOMRect | null => document.querySelector<HTMLElement>(`[data-flip="${CSS.escape(uid)}"]`)?.getBoundingClientRect() ?? null

/** Move the copy to a spot (its top-left) and settle there; resolves when it has. */
function glide(g: HTMLElement, left: number, top: number): Promise<void> {
  if (calm()) return Promise.resolve()
  g.style.transition = 'transform 260ms cubic-bezier(0.3, 1.45, 0.5, 1)'
  g.style.transform = `translate3d(${left}px, ${top}px, 0) rotate(0deg) scale(1)`
  return new Promise((res) => { const t = window.setTimeout(res, 330); g.addEventListener('transitionend', () => { clearTimeout(t); res() }, { once: true }) })
}

/** A press on a card. Call from its pointerdown. Does nothing visible until the press turns into a drag. */
export function startPress(init: { x: number; y: number; id: number; type: string; button: number }, uid: string, card: HTMLElement, hooks: DragHooks): void {
  if (busy || (init.type === 'mouse' && init.button !== 0)) return
  const touch = init.type !== 'mouse'
  const rect = card.getBoundingClientRect()
  const ox = init.x - rect.left, oy = init.y - rect.top
  let x = init.x, y = init.y, lastX = init.x, tilt = 0
  let active = false, ghost: HTMLElement | null = null, raf = 0, timer = 0, cue = 0, hover = '', over: Target | null = null

  const place = () => { if (ghost) ghost.style.transform = `translate3d(${x - ox}px, ${y - oy}px, 0) rotate(${tilt}deg) scale(${calm() ? 1 : 1.08})` }

  const frame = () => {
    raf = requestAnimationFrame(frame)
    tilt += (calm() ? 0 - tilt : clamp((x - lastX) * 1.4, -14, 14) - tilt) * 0.25
    lastX = x
    place()
    const top = 80, bottom = innerHeight - 150
    if (y < top) scrollBy(0, -Math.ceil(((top - y) / top) * 16))
    else if (y > bottom) scrollBy(0, Math.ceil(((y - bottom) / (innerHeight - bottom)) * 16))
    const t = targetAt(x, y)
    const k = t === null ? '' : t === 'lab' ? 'lab' : `p${t.slot}`
    if (k !== hover) { hover = k; over = t; hooks.hover(t) }
  }

  const begin = () => {
    if (active) return
    active = true
    busy = true
    clearTimeout(timer)
    clearTimeout(cue)
    card.classList.remove('pressing')
    ghost = card.cloneNode(true) as HTMLElement
    ghost.classList.add('mc-ghost')
    ghost.removeAttribute('aria-haspopup')
    ghost.style.width = `${rect.width}px`
    ghost.style.height = `${rect.height}px`
    document.body.appendChild(ghost)
    document.body.classList.add('dragging')
    navigator.vibrate?.(10)
    hooks.begin(uid)
    place()
    raf = requestAnimationFrame(frame)
  }

  const off = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    window.removeEventListener('touchmove', stopScroll)
    window.removeEventListener('contextmenu', noMenu)
    clearTimeout(timer)
    clearTimeout(cue)
    card.classList.remove('pressing')
    cancelAnimationFrame(raf)
  }

  const move = (e: PointerEvent) => {
    if (e.pointerId !== init.id) return
    x = e.clientX; y = e.clientY
    if (active) return
    const dx = x - init.x, dy = y - init.y, d = Math.hypot(dx, dy)
    if (!touch) { if (d >= MOUSE_PX) begin(); return }
    // a touch that moved before the press was held is the page being scrolled or swiped: let it go
    if (d > TOUCH_SLOP) off()
  }

  const up = async (e: PointerEvent) => {
    if (e.pointerId !== init.id) return
    off()
    if (!active || !ghost) return
    // the click that follows a drag is not a tap
    const swallow = (c: Event) => { c.stopPropagation(); c.preventDefault() }
    window.addEventListener('click', swallow, true)
    window.setTimeout(() => window.removeEventListener('click', swallow, true), 80)
    const g = ghost
    // a quick flick can let go before a frame has looked: ask where it let go
    if (e.type === 'pointerup') { x = e.clientX; y = e.clientY; over = targetAt(x, y) }
    const landed = e.type !== 'pointercancel' && over !== null && hooks.drop(uid, over)
    document.body.classList.remove('dragging')
    hooks.hover(null)
    await frames(2)
    const to = rectOf(uid)
    if (to && to.bottom > 0 && to.top < innerHeight) await glide(g, to.left, to.top)
    if (landed) navigator.vibrate?.(10)
    g.remove()
    hooks.end()
    busy = false
  }

  // once a drag is on, a touch must not also scroll the page
  const stopScroll = (e: TouchEvent) => { if (active && e.cancelable) e.preventDefault() }
  const noMenu = (e: Event) => { if (touch) e.preventDefault() }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
  window.addEventListener('touchmove', stopScroll, { passive: false })
  window.addEventListener('contextmenu', noMenu)
  if (touch) {
    timer = window.setTimeout(begin, HOLD_MS)
    cue = window.setTimeout(() => card.classList.add('pressing'), CUE_MS)
  }
}
