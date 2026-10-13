// One thing in front of the game at a time.
//
// The news window, a chest opening, an egg hatching and a sheet the player
// opened can all want the screen at once (opening the app after a good day does
// exactly that). Each asks here for its turn and draws only when it is first in
// line; the rest wait their place and appear as the one in front is closed.
//
// A sheet the player opened by tapping takes the front at once (rank -1) and
// everything automatic waits behind it. Among the automatic ones, the lower
// rank goes first, and equal ranks go in the order they asked.
import { useEffect, useId, useSyncExternalStore } from 'react'

export const RANK = { sheet: -1, news: 0, chest: 1, hatch: 2 } as const

interface Entry { id: string; rank: number; n: number }
let line: Entry[] = []
let count = 0
const watchers = new Set<() => void>()
const front = (): string => line[0]?.id ?? ''
const set = (next: Entry[]): void => {
  line = next.sort((a, b) => a.rank - b.rank || a.n - b.n)
  watchers.forEach((w) => w())
}
const subscribe = (w: () => void): (() => void) => { watchers.add(w); return () => { watchers.delete(w) } }

/** Ask for the screen while `want` is true. Returns whether it is this one's turn to draw. */
export function useOverlay(want: boolean, rank: number): boolean {
  const id = useId()
  useEffect(() => {
    if (!want) return
    set([...line, { id, rank, n: count++ }])
    return () => set(line.filter((e) => e.id !== id))
  }, [want, id, rank])
  const first = useSyncExternalStore(subscribe, front)
  return want && first === id
}

/** For something the player opened: take the front and keep it until it is gone. */
export const useHold = (): void => { useOverlay(true, RANK.sheet) }
