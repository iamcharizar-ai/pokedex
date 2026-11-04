// The clock the Today scene is drawn for, and the night's sleep it reads. The scene itself is drawn by
// stage.ts (the place) and Stage.tsx (its canvases); the sky's colours, arc and weather are sky.ts.
import { useEffect, useState } from 'react'
import { FIXTURE } from '../lib/fixture-boot.ts'

const minutesNow = (): number => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }
const q = (k: string): string | null => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get(k))

/** The minute of the day the sky is drawn for. A fixture holds still at 10:30 so a picture of it is always the same; `?clock=22:15` shows another time. */
export function useClock(): number {
  const [now, setNow] = useState(minutesNow)
  useEffect(() => {
    if (FIXTURE) return
    const tick = () => setNow(minutesNow())
    const id = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])
  if (!FIXTURE) return now
  const c = q('clock')?.match(/^(\d{1,2}):(\d{2})$/)
  return c ? Number(c[1]) * 60 + Number(c[2]) : 630
}

/** A fixture can be given a night's sleep with `?sleep=35`, to see the weather it makes. */
export function sleepFor(score: number | null): number | null {
  if (!FIXTURE) return score
  const s = q('sleep')
  return s !== null && /^\d+$/.test(s) ? Number(s) : score
}
