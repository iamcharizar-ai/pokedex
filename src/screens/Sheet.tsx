// A bottom sheet: the full view of something a tile only summarises (the boss,
// the leader, a Pokemon, the rewards to collect). It rises from the bottom,
// where a thumb reaches, and closes on the backdrop, the close button, Escape,
// or by dragging the handle down past about a hundred pixels.
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { KClose } from '../Kit.tsx'
import { useHold } from './overlay.ts'

const CLOSE_AT = 110

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useHold() // whatever is automatic waits until this is closed
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)

  useEffect(() => {
    const was = document.activeElement as HTMLElement | null
    root.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', esc); was?.focus?.() }
  }, [onClose])

  const down = (e: ReactPointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
    if (root.current) root.current.style.transition = 'none'
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || !root.current) return
    d.dy = Math.max(0, e.clientY - d.y)
    root.current.style.transform = `translateY(${d.dy}px)`
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    const el = root.current
    if (!d || !el) return
    el.style.transition = 'transform 0.2s var(--ease-out)'
    if (d.dy > CLOSE_AT) onClose()
    else el.style.transform = ''
  }

  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div ref={root} className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden>
          <span className="sheet-grip" />
        </div>
        <KClose onClick={onClose} />
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
