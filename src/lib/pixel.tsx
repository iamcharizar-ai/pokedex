// Pixel art in the browser: the pieces that need React. The numbers are in lib/fit.ts.
//
//   useBig       a sprite enlarged 4x with hard edges, to shrink from when a scale cannot be whole
//   useNatural   a picture's own size once it has loaded (an animated sprite's file says nothing until then)
//   PixelSprite  an <img> drawn at a whole-number scale of its own size, about filling a box
import { useEffect, useState, type CSSProperties } from 'react'
import { wholeScale } from './fit.ts'

const bigs = new Map<string, string>()
/** A sprite enlarged four times, hard-edged, as a picture to shrink from: ready after it has been made once (null until then). */
export function useBig(src: string, on: boolean): string | null {
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

/** The size a picture is drawn at in its own file, once it has loaded; null before. Give the returned `onLoad` to the <img>. */
export function useNatural(src: string): { px: [number, number] | null; onLoad: (e: { currentTarget: HTMLImageElement }) => void } {
  const [px, setPx] = useState<[number, number] | null>(null)
  useEffect(() => setPx(null), [src])
  return { px, onLoad: (e) => setPx([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight]) }
}

/** An <img> at a whole-number scale of its own size, about filling `box` pixels (hidden for the moment before it has loaded). */
export function PixelSprite({ src, box, className = '', style }: { src: string; box: number; className?: string; style?: CSSProperties }) {
  const { px, onLoad } = useNatural(src)
  const k = px ? wholeScale(px[0], px[1], box) : 1
  return <img src={src} alt="" className={`sprite ${className}`} style={px ? { ...style, width: px[0] * k, height: px[1] * k } : { ...style, visibility: 'hidden' }} onLoad={onLoad} draggable={false} />
}

/** Only the drawn part of a 96px still (its box in sprites/bbox.json), at 1x: a small Pokemon without shrinking anyone. */
export function CropSprite({ src, box, alt = '', title, className = '' }: { src: string; box?: [number, number, number, number]; alt?: string; title?: string; className?: string }) {
  const [l, t, r, b] = box ?? [0, 0, 96, 96]
  return (
    <span className={`crop ${className}`} style={{ position: 'relative', display: 'inline-block', width: r - l, height: b - t, overflow: 'hidden' }} title={title}>
      <img src={src} alt={alt} width={96} height={96} draggable={false} style={{ position: 'absolute', left: -l, top: -t, width: 96, height: 96, maxWidth: 'none', imageRendering: 'pixelated' }} />
    </span>
  )
}
