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
/** `up`: one whole step bigger than the box would give (a Dynamax), as long as it stays within `upMax` pixels wide. */
export function PixelSprite({ src, box, up = false, upMax = Infinity, className = '', style }: { src: string; box: number; up?: boolean; upMax?: number; className?: string; style?: CSSProperties }) {
  const { px, onLoad } = useNatural(src)
  const k0 = px ? wholeScale(px[0], px[1], box) : 1
  const k = px && up && px[0] * (k0 + 1) <= upMax ? k0 + 1 : k0
  return <img src={src} alt="" className={`sprite ${className}`} style={px ? { ...style, width: px[0] * k, height: px[1] * k } : { ...style, visibility: 'hidden' }} onLoad={onLoad} draggable={false} />
}

const lattices = new Map<string, string>()
/**
 * A picture redrawn on a smaller grid of `lw` x `lh` pixels, hard-edged (a picture's `region` [x, y, w, h], or the part of
 * it that fits). Ready after it has been made once (null until then). A grid that is the picture's own size is a plain
 * copy; a smaller one is averaged down, then every pixel is made fully solid or fully clear so no soft fringe is left.
 */
function useLattice(src: string, region: [number, number, number, number], lw: number, lh: number, on: boolean): string | null {
  const key = `${src}|${region.join(',')}|${lw}x${lh}`
  const [made, set] = useState<{ key: string; url: string } | null>(null)
  useEffect(() => {
    if (!on || lattices.has(key)) return
    let live = true
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = lw; c.height = lh
        const g = c.getContext('2d', { willReadFrequently: true })
        if (!g) return
        const [x, y, w, h] = region
        const shrunk = lw < w || lh < h
        g.imageSmoothingEnabled = shrunk
        g.imageSmoothingQuality = 'high'
        g.drawImage(img, x, y, w, h, 0, 0, lw, lh)
        if (shrunk) {
          const d = g.getImageData(0, 0, lw, lh)
          for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] >= 128 ? 255 : 0
          g.putImageData(d, 0, 0)
        }
        const url = c.toDataURL('image/png')
        lattices.set(key, url)
        if (live) set({ key, url })
      } catch { /* a picture that cannot be read is left hidden */ }
    }
    img.src = src
    return () => { live = false }
  }, [key, on])
  return on ? lattices.get(key) ?? (made?.key === key ? made.url : null) : null
}

/**
 * A sprite on a screen's own pixel grid: every one of its pixels is exactly `k` x `k` screen pixels, the same as the
 * background it stands on, whatever its file. It is drawn at its own pixel size (a Charmander is smaller than an Onix),
 * and only one too big for `maxW` x `maxH` screen pixels is redrawn on a coarser grid, never stretched by a fraction.
 * `animated`: keep an animation going while it is drawn at its own pixel size (otherwise its first picture is drawn).
 * `crop`: only this part of the file (a 96px still's drawn box, sprites/bbox.json). `hold`: draw nothing yet (waiting for that box).
 */
export function GridSprite({ src, k, maxW, maxH, crop, animated = false, hold = false, className = '', style }: { src: string; k: number; maxW: number; maxH: number; crop?: [number, number, number, number]; animated?: boolean; hold?: boolean; className?: string; style?: CSSProperties }) {
  const { px, onLoad } = useNatural(src)
  const [x, y, w, h] = crop ? [crop[0], crop[1], crop[2] - crop[0], crop[3] - crop[1]] : px ? [0, 0, px[0], px[1]] : [0, 0, 0, 0]
  const room = px && w > 0 && h > 0 ? Math.min(1, maxW / (w * k), maxH / (h * k)) : 1
  const lw = Math.max(1, room >= 1 ? w : Math.floor(w * room)), lh = Math.max(1, room >= 1 ? h : Math.floor(h * room))
  const asIs = animated && room >= 1 && !crop
  const url = useLattice(src, [x, y, w, h], lw, lh, Boolean(px) && !hold && !asIs)
  const ready = px && !hold && (asIs || url)
  return (
    <img
      src={asIs || !url ? src : url} alt="" className={`sprite ${className}`} draggable={false}
      style={{ ...style, imageRendering: 'pixelated', ...(ready ? { width: lw * k, height: lh * k } : { width: Math.max(1, lw * k), height: Math.max(1, lh * k), visibility: 'hidden' }) }}
      onLoad={(e) => { if (!e.currentTarget.src.startsWith('data:')) onLoad(e) }}
    />
  )
}

/** Only the drawn part of a 96px still (its box in sprites/bbox.json), at 1x: a small Pokemon without shrinking anyone. */
export function CropSprite({ src, box, alt = '', title, className = '', lazy }: { src: string; box?: [number, number, number, number]; alt?: string; title?: string; className?: string; /** load it only near the screen (a long grid) */ lazy?: boolean }) {
  const [l, t, r, b] = box ?? [0, 0, 96, 96]
  return (
    <span className={`crop ${className}`} style={{ position: 'relative', display: 'inline-block', width: r - l, height: b - t, overflow: 'hidden' }} title={title}>
      <img src={src} alt={alt} width={96} height={96} draggable={false} loading={lazy ? 'lazy' : undefined} decoding={lazy ? 'async' : undefined} style={{ position: 'absolute', left: -l, top: -t, width: 96, height: 96, maxWidth: 'none', imageRendering: 'pixelated' }} />
    </span>
  )
}
