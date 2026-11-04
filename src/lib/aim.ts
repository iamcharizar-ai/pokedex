// A ball held over the wild Pokemon (UI-AUDIT-2026-11-04 T1): while a ball's socket is pressed, hovered or focused,
// the scene's HP bar ghosts what the throw would take, so whether it catches is seen before it is thrown.
import { useSyncExternalStore } from 'react'

let hp = 0
const watchers = new Set<() => void>()

/** Hold a ball over the wild Pokemon (its HP off), or put it down (0). */
export function aim(next: number): void {
  if (next === hp) return
  hp = next
  watchers.forEach((w) => w())
}

/** The HP the ball being held would take: 0 when none is. */
export function useAim(): number {
  return useSyncExternalStore((w) => { watchers.add(w); return () => { watchers.delete(w) } }, () => hp)
}
