// The one icon set for the Team screen and its cards: 24x24, 2px round strokes, currentColor.
// Pieces of the game (items, balls, types) keep their own pictures; these are the small controls.
import type { CSSProperties, ReactNode } from 'react'

function Svg({ size = 18, fill, children, style }: { size?: number; fill?: boolean; children: ReactNode; style?: CSSProperties }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={fill ? 0 : 2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={style}>
      {children}
    </svg>
  )
}
type P = { size?: number; style?: CSSProperties }

export const IcHeart = (p: P) => <Svg {...p} fill><path d="M12 21s-8-4.8-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 6.2-8 11-8 11z" /></Svg>
export const IcArrowUp = (p: P) => <Svg {...p} fill><path d="M12 3l8 9h-5v9H9v-9H4z" /></Svg>
export const IcPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const IcStar = (p: P) => <Svg {...p} fill><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" /></Svg>
export const IcLab = (p: P) => <Svg {...p}><path d="M9 3h6M10 3v6l-5.5 9.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3M7.5 15h9" /></Svg>
export const IcSwap = (p: P) => <Svg {...p}><path d="M4 8h14l-4-4M20 16H6l4 4" /></Svg>
export const IcInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.1" /></Svg>
export const IcSort = (p: P) => <Svg {...p}><path d="M4 7h12M4 12h8M4 17h4M18 8v9m0 0l-3-3m3 3l3-3" /></Svg>
