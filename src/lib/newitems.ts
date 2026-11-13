// What is new in the Bag: a gold dot on the Items tab, and the same dot on each thing that arrived since it was last opened.
//
// Nothing here is game progress, only what this device has looked at, so it is kept on this device alone (like the Bag's
// layout and the news already told) and never in the ledger. A thing is new when there is more of it than was last looked
// at: a first berry, or one more of a berry you have. Tapping it (opening its sheet) is looking.
import { useEffect, useState } from 'react'

const KEY = 'pokedex.bag.seen.v1'
/** How many of each thing there was when it was last looked at (or, the first time, when this device first saw the Bag). */
export type Seen = Record<string, number>

/** The things there is more of than was looked at. */
export const newIds = (counts: Seen, seen: Seen): string[] => Object.keys(counts).filter((id) => counts[id] > (seen[id] ?? 0))

/** The record with nothing standing above what is held now, so a thing used up and found again is new again. */
export function trimmed(seen: Seen, counts: Seen): Seen {
  const out: Seen = {}
  for (const id of Object.keys(seen)) out[id] = Math.min(seen[id], counts[id] ?? 0)
  return out
}

/** null: nothing remembered yet, which is a first run (everything held then is taken as looked at: history is not news). */
function load(): Seen | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const v: unknown = JSON.parse(raw)
    return v && typeof v === 'object' ? (v as Seen) : null
  } catch { return null }
}
function save(s: Seen): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* it would only show everything as new again */ }
}

export interface ItemNews {
  /** everything new, in no particular order */
  ids: string[]
  isNew: (id: string) => boolean
  /** this one has been looked at */
  see: (id: string) => void
}

/**
 * `counts`: what the Bag holds now, thing by thing. `ready`: the game has its days (a game still loading holds nothing,
 * and must neither be taken as a first run nor trim what was looked at).
 */
export function useItemNews(counts: Seen, ready: boolean): ItemNews {
  const [seen, setSeen] = useState<Seen | null>(load)
  const key = JSON.stringify(counts)
  useEffect(() => {
    if (!ready) return
    if (seen === null) { setSeen({ ...counts }); save(counts); return }
    const next = trimmed(seen, counts)
    if (JSON.stringify(next) !== JSON.stringify(seen)) { setSeen(next); save(next) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, seen === null])
  // before the first look nothing is new: the record is made on the first ready render
  const base = seen ?? counts
  const ids = ready ? newIds(counts, base) : []
  return {
    ids,
    isNew: (id) => ids.includes(id),
    see: (id) => {
      const next = { ...(seen ?? counts), [id]: counts[id] ?? 0 }
      setSeen(next)
      save(next)
    },
  }
}
