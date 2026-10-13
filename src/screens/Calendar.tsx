// The last twelve weeks, one cell a day (Journey). Brighter is more work: gold
// ring for a perfect day, a dot beside a week a boss came. It replaces the old
// bar chart of XP per day, which showed the same thing less readably.
import { useMemo } from 'react'
import type { Game } from '../../core/fold.ts'
import { Win } from '../App.tsx'
import { fmtDay } from '../lib/art.ts'
import { calendarOf } from './calendar.ts'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const NAMES = ['nothing', 'something ticked', 'one pillar', 'two pillars', 'three or more']

export function Calendar({ game }: { game: Game }) {
  const bossWeeks = useMemo(() => new Set([...game.bossLog.map((b) => b.week), ...(game.boss ? [game.boss.week] : [])]), [game.bossLog, game.boss])
  const cal = useMemo(() => calendarOf(game.days, game.today.day, bossWeeks), [game.days, game.today.day, bossWeeks])
  return (
    <Win title="The last 12 weeks" tone="blue" aside={`${cal.counting} counting · ${cal.perfect} perfect`}>
      <div className="cal" role="group" aria-label={`The last twelve weeks: ${cal.counting} days with two pillars, ${cal.perfect} perfect days`}>
        <div className="cal-head" aria-hidden>
          <span />
          {DOW.map((d, i) => <b key={i}>{d}</b>)}
          <span />
        </div>
        {cal.weeks.map((w) => (
          <div key={w.monday} className={`cal-week ${w.boss ? 'boss' : ''}`}>
            <span className="cal-when" aria-hidden>{fmtDay(w.monday)}</span>
            {w.cells.map((c) => (
              <span key={c.day} role="img" aria-label={c.label} title={c.label} className={`cal-cell ${c.level === null ? 'off' : `l${c.level}`} ${c.perfect ? 'perfect' : ''} ${c.today ? 'today' : ''}`} />
            ))}
            <span className="cal-boss" title={w.boss ? 'A boss came this week' : undefined} aria-hidden>{w.boss ? '●' : ''}</span>
          </div>
        ))}
        <div className="cal-key" aria-hidden>
          {[0, 1, 2, 3, 4].map((l) => <span key={l}><i className={`cal-cell l${l}`} />{NAMES[l]}</span>)}
          <span><i className="cal-cell l3 perfect" />perfect day</span>
          <span><b className="cal-boss">●</b>boss week</span>
        </div>
      </div>
    </Win>
  )
}
