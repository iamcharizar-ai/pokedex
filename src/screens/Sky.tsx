// The layers behind the two Pokemon: a sky that follows the clock, a sun or
// moon on its arc, stars as it darkens, clouds that drift (more of them, and
// greyer, after a bad night, and rain after a very bad one), hills and a tree
// line that sway at different speeds, and grass in front.
//
// Everything here is drawn, never loaded, and nothing in it is a game state:
// it is a function of the minute of the day and of last night's sleep score.
// With reduced motion it holds still.
import { useEffect, useState, type CSSProperties } from 'react'
import { FIXTURE } from '../lib/fixture-boot.ts'
import { THEME_CLOCK, bodyAt, darkAt, paletteAt, weatherOf, type Sky as SkyState } from './sky.ts'

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

/** The variables the scene's own stylesheet already reads, for this minute. A bought scene pins them (or, for the cave, leaves its own). */
export function skyVars(minutes: number, theme: string): CSSProperties | undefined {
  if (theme in THEME_CLOCK && THEME_CLOCK[theme] === null) return undefined
  const m = theme in THEME_CLOCK ? (THEME_CLOCK[theme] as number) : minutes
  const p = paletteAt(m)
  return { '--sky-1': p.sky1, '--sky-2': p.sky2, '--far': p.far, '--ground': p.ground, '--ground-2': p.ground2, '--pad': p.pad, '--pad-2': p.pad2 } as CSSProperties
}

// a pixel cloud, 16 by 6 units
const CLOUD = 'M3 6h11V5h1V4h-1V3h-2V2h-2V1H7v1H5v1H4v1H2v1h1z'

export function Sky({ minutes, theme, score }: { minutes: number; theme: string; score: number | null }) {
  const cave = THEME_CLOCK[theme] === null
  const m = theme in THEME_CLOCK && !cave ? (THEME_CLOCK[theme] as number) : minutes
  if (cave) return <div className="sky cave" aria-hidden><span className="cave-drip" /></div>
  const body = bodyAt(m)
  const dark = darkAt(m)
  const wx: SkyState = weatherOf(score)
  // a cloud hides the sun a little less if it is high; rain and heavy cloud dim it
  const dim = Math.min(0.75, wx.gloom * 0.7)
  const label = theme ? 'The scene' : wx.label
  return (
    <div className={`sky wx-${wx.weather}`} role="img" aria-label={label} title={theme ? undefined : `${wx.label}. The sky follows last night's sleep.`} style={{ '--dark': dark, '--dim': dim, '--gloom': wx.gloom } as CSSProperties}>
      <span className="stars" />
      <span className={`body ${body.kind}`} style={{ left: `${66 + ((body.x - 8) / 84) * 28}%`, top: `${10 + ((body.y - 16) / 70) * 42}%` }} />
      <div className="clouds">
        {Array.from({ length: wx.clouds }, (_, i) => (
          <svg key={i} className="cloud" viewBox="0 0 16 6" shapeRendering="crispEdges" style={{ top: `${6 + ((i * 13) % 34)}%`, width: `${52 + ((i * 7) % 5) * 12}px`, animationDuration: `${70 + i * 19}s`, animationDelay: `-${(i * 31) % 90}s`, opacity: 0.95 - ((i * 5) % 3) * 0.1 }}>
            <path d={CLOUD} />
          </svg>
        ))}
      </div>
      <span className="hills far" />
      <span className="hills near" />
      <span className="trees" />
      {wx.rain && <span className="rain" />}
      <span className="grass" />
    </div>
  )
}
