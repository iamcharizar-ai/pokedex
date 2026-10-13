// A bottom sheet: the full view of something a tile on Today only summarises
// (the boss, the leader). It rises from the bottom, where a thumb reaches, and
// closes on the backdrop, the close button or Escape. Dragging it down to close
// comes with the rest of the touch work (UI-OVERHAUL.md, phase 3).
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { KClose } from '../Kit.tsx'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const was = document.activeElement as HTMLElement | null
    root.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', esc); was?.focus?.() }
  }, [onClose])
  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div ref={root} className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grip" aria-hidden />
        <KClose onClick={onClose} />
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
