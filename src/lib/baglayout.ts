// Where each thing lies in the Bag: a row of slots, nine to a row, like a block-game inventory. The layout is
// only how the player has arranged their things (no game rule reads it), so it is kept on this device.
// `reconcile` makes a saved layout fit what is owned now: things used up leave their slot empty, new things
// take the first empty slot, in the default order.
export type Layout = (string | null)[]

export const ROW = 9
export const MIN_SLOTS = 27

/** The saved layout made to fit `wanted` (everything in the Bag now, in the order new things are laid down). Trailing empty slots are dropped. */
export function reconcile(saved: Layout, wanted: string[]): Layout {
  const want = new Set(wanted)
  const seen = new Set<string>()
  // a thing goes where it was left; a duplicate or a thing that is gone leaves an empty slot
  const out: Layout = saved.map((id) => (id !== null && want.has(id) && !seen.has(id) ? (seen.add(id), id) : null))
  for (const id of wanted) {
    if (seen.has(id)) continue
    const at = out.indexOf(null)
    if (at >= 0) out[at] = id
    else out.push(id)
    seen.add(id)
  }
  while (out.length && out[out.length - 1] === null) out.pop()
  return out
}

/** How many slots to draw: three rows at least, rows enough for the last thing, and always an empty one to drop into. */
export function slotCount(layout: Layout): number {
  const last = layout.length
  let n = Math.max(MIN_SLOTS, Math.ceil(last / ROW) * ROW)
  if (layout.length >= n && layout.every((id) => id !== null)) n += ROW
  return n
}

/** Move a thing to a slot; whatever is there goes to the slot it left (an empty slot just takes it). */
export function moveTo(layout: Layout, id: string, target: number): Layout {
  const from = layout.indexOf(id)
  if (from < 0 || target === from || target < 0) return layout
  const out = [...layout]
  while (out.length <= target) out.push(null)
  const other = out[target]
  out[target] = id
  out[from] = other
  while (out.length && out[out.length - 1] === null) out.pop()
  return out
}

/** Everything laid down again in the default order, no gaps. */
export const tidy = (wanted: string[]): Layout => [...wanted]

const KEY = 'pokedex.baglayout.v1'
/** The layout left on this device (empty when there is none). */
export function loadLayout(): Layout {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : null)) : []
  } catch { return [] }
}
export function storeLayout(l: Layout): void {
  try { localStorage.setItem(KEY, JSON.stringify(l)) } catch { /* the arrangement is just not remembered */ }
}
