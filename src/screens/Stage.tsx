// The two canvases of the Today scene (stage.ts paints them): the place behind the Pokemon, and what stands
// in front of them. Each is drawn at the stage's own small size and enlarged by a whole number with hard edges.
// The small life of the place moves eight frames a second, a whole pixel at a time; never with reduced motion,
// and not while the scene is off the screen or the tab is hidden. Nothing here re-renders React.
import { useEffect, useRef } from 'react'
import { layoutFor, paintBack, paintFront, type StageState } from './stage.ts'

const FRAME_MS = 125

/** A bought scene as a still miniature (a theme ware in the Shop): the same painter at its own small size, drawn
 *  once and enlarged by a whole number. The meadow is the place; the theme pins the light. */
export function MiniScene({ theme, w = 50, h = 52, k = 2 }: { theme: string; w?: number; h?: number; k?: number }) {
  const back = useRef<HTMLCanvasElement>(null)
  const front = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const b = back.current?.getContext('2d'), f = front.current?.getContext('2d')
    if (!b || !f) return
    const s = { lay: layoutFor(w, h), minutes: 720, score: null, theme, biome: 'meadow' as const, seed: 'pikachu', t: 0 }
    paintBack(b, s)
    paintFront(f, s)
  }, [theme, w, h])
  const size = { width: w * k, height: h * k }
  return (
    <span className="mini-scene" aria-hidden style={size}>
      <canvas ref={back} width={w} height={h} style={size} />
      <canvas ref={front} width={w} height={h} style={size} />
    </span>
  )
}

export function Stage({ k, s, label }: { k: number; s: Omit<StageState, 't'>; label: string }) {
  const back = useRef<HTMLCanvasElement>(null)
  const front = useRef<HTMLCanvasElement>(null)
  const st = useRef(s)
  st.current = s
  const t = useRef(0)
  const draw = useRef(() => {})
  draw.current = () => {
    const b = back.current?.getContext('2d'), f = front.current?.getContext('2d')
    if (!b || !f) return
    const state = { ...st.current, t: t.current }
    paintBack(b, state)
    paintFront(f, state)
  }
  // anything the place depends on changed (the size included, which clears a canvas): draw it now
  const key = JSON.stringify(s)
  useEffect(() => draw.current(), [key])
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let id = 0, last = 0, seen = true
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting })
    if (front.current) io.observe(front.current)
    const tick = (now: number) => {
      id = requestAnimationFrame(tick)
      if (!seen || document.hidden || now - last < FRAME_MS) return
      last = now
      t.current++
      draw.current()
    }
    id = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(id); io.disconnect() }
  }, [])
  const { w, h } = s.lay
  const size = { width: w * k, height: h * k }
  return (
    <div className="stage" role="img" aria-label={label}>
      <canvas ref={back} className="stage-back" width={w} height={h} style={size} />
      <canvas ref={front} className="stage-front" width={w} height={h} style={size} />
    </div>
  )
}
