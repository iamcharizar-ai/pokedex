// A sprite sized by what is drawn in it, not by its file. Every still is 96 x 96 with a different
// margin round the Pokemon, so at one size a Caterpie is a speck and an Onix fills its cell. This
// scales each to a common visual size and sits it on a common baseline (tools/build-sprite-bbox.mjs
// measures them; the table is fetched once, the first time a grid needs it, and cached).
import { useEffect, useState } from 'react'

type Box = [number, number, number, number]
let table: Record<string, Box> | null = null
let loading: Promise<void> | null = null
const waiting = new Set<() => void>()

function load(): void {
  if (table || loading) return
  loading = fetch('/sprites/bbox.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((t: Record<string, Box>) => { table = t })
    .catch(() => { table = {} })
    .finally(() => waiting.forEach((f) => f()))
}

/** The sprites' measurements, once they have arrived: null until then (a sprite is drawn plain). */
export function useBoxes(): Record<string, Box> | null {
  const [, tick] = useState(0)
  useEffect(() => {
    if (table) return
    const f = () => tick((n) => n + 1)
    waiting.add(f)
    load()
    return () => { waiting.delete(f) }
  }, [])
  return table
}

/**
 * How to draw a sprite that is laid out at `size` pixels so that the Pokemon in it looks `aim` pixels across, with its feet on the bottom edge and centred sideways.
 * Returns a transform about the picture's own centre, so the layout never changes: only what is seen.
 */
export function fitOf(box: Box | undefined, size: number, aim: number): string | undefined {
  if (!box) return undefined
  const [l, t, r, b] = box
  const per = size / 96
  const k = Math.max(0.8, Math.min(1.9, aim / Math.max(1, Math.max(r - l, b - t) * per)))
  const x = -((l + r) / 2 - 48) * per * k
  const y = size / 2 - (b - 48) * per * k
  void t
  return `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${k.toFixed(3)})`
}
