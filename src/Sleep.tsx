// Last night, as the band measured it, and what it paid. The score itself is
// worked out in Vitals and written to the ledger; here it is only shown, with
// what the game did with it (SLEEP-DESIGN.md).
import { addDays } from '../core/facts.ts'
import type { SleepNight } from '../core/events.ts'
import type { Game } from '../core/fold.ts'
import { SLEEP_DEEP, SLEEP_DONE, TIER_XP } from '../core/rules.ts'
import { Win } from './App.tsx'
import { MarkIcon } from './Item.tsx'

const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
const clock = (s?: string) => (s ? s.slice(11, 16) : '')
const weekday = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })

/** [the score it takes, the Bells it pays in all] */
const BELLS: [number, number][] = [[SLEEP_DONE, 1], [SLEEP_DEEP, 2]]
const STAGES: [keyof SleepNight, string, string][] = [['deepMin', 'Deep', '#6b5be0'], ['remMin', 'REM', '#63c6ff'], ['lightMin', 'Light', '#9aa6c2'], ['awakeMin', 'Awake', '#e0559a']]

export function SleepWin({ game, nights }: { game: Game; nights: Record<string, SleepNight> }) {
  const { sleep } = game
  const today = game.today.day
  const night = nights[today]
  const bells = game.wallet.marksToday.sleep
  const recent = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const stageTotal = night ? STAGES.reduce((a, [k]) => a + ((night[k] as number | undefined) ?? 0), 0) : 0
  return (
    <Win title="Last night" tone="blue" aside={sleep.state === 'measured' ? `${sleep.score} of 100` : sleep.state === 'self' ? 'Waiting' : 'No band'}>
      {sleep.state === 'measured' ? (
        <>
          <div className="sleephead">
            <div className={`sleepdial ${(sleep.score ?? 0) >= SLEEP_DEEP ? 'deepnight' : (sleep.score ?? 0) >= SLEEP_DONE ? 'goodnight' : ''}`} style={{ ['--p' as string]: (sleep.score ?? 0) / 100 }}><b>{sleep.score}</b><small>of 100</small></div>
            <div className="sleeptext">
              {night?.sleepMin !== undefined && <b className="k-type">{hm(night.sleepMin)}</b>}
              {night?.bed && night?.wake && <small>{clock(night.bed)} to {clock(night.wake)}</small>}
              <small>Paid <b>+{sleep.xp} XP</b>{(sleep.score ?? 0) >= SLEEP_DONE ? ' · the Sleep pillar is full' : ` · ${SLEEP_DONE} fills the pillar`}</small>
            </div>
          </div>
          {/* the bar that pays Bells: it fills to last night's score, and a Bell hangs at each mark it passed */}
          <div className="bellbar" role="img" aria-label={`Last night scored ${sleep.score}. ${bells} ${bells === 1 ? 'Bell' : 'Bells'} paid: one at ${SLEEP_DONE}, two at ${SLEEP_DEEP}.`}>
            <span className="bellbar-track"><i style={{ width: `${Math.max(0, Math.min(100, sleep.score ?? 0))}%` }} />{BELLS.map(([at]) => <b key={at} className="bellmark" style={{ left: `${at}%` }} />)}</span>
            <span className="bellchips">
              {BELLS.map(([at, n]) => {
                const got = (sleep.score ?? 0) >= at
                return (
                  <span key={at} className={`bell ${got ? 'got' : ''}`}>
                    <span className="bell-ico"><MarkIcon tag="sleep" size={26} /></span>
                    <span className="bell-txt"><b>{at}+</b><small>{n === 1 ? '1 Bell' : `${n} Bells in all`}</small></span>
                    {got && <i className="bell-n" aria-hidden>✓</i>}
                  </span>
                )
              })}
            </span>
          </div>
          <p className="bellnote">{bells > 0 ? <><b>+{bells} {bells === 1 ? 'Bell' : 'Bells'}</b> paid this morning. Spend them in the Dream House.</> : <>A night of {SLEEP_DONE} or more pays a Bell, {SLEEP_DEEP} or more two.</>}</p>
          {stageTotal > 0 && (
            <>
              <div className="stagebar" role="img" aria-label={STAGES.map(([k, n]) => `${n} ${hm((night?.[k] as number | undefined) ?? 0)}`).join(', ')}>
                {STAGES.map(([k, n, c]) => ((night?.[k] as number | undefined) ? <i key={n} style={{ flex: night![k] as number, background: c }} title={`${n} ${hm(night![k] as number)}`} /> : null))}
              </div>
              <div className="stagelegend">{STAGES.map(([k, n, c]) => (night?.[k] !== undefined ? <span key={n}><i style={{ background: c }} />{n} {hm(night[k] as number)}</span> : null))}</div>
            </>
          )}
        </>
      ) : sleep.state === 'self' ? (
        <p className="muted">Last night's reading has not arrived. The band syncs about 07:00. Until it does, the Sleep habit can be ticked by hand in Life OS for {TIER_XP.core} XP; the reading replaces the tick when it comes, and a night with no reading is never a zero.</p>
      ) : (
        <p className="muted">No band yet. Sleep is a habit you tick by hand, worth {TIER_XP.core} XP. From the first night your band reports, it becomes a pillar of 100 XP paid by the night's score.</p>
      )}
      {sleep.state === 'measured' && <p className="muted">The sky behind your partner follows it: clear after {SLEEP_DEEP} or more, fair from {SLEEP_DONE}, then cloudy, overcast and rain.</p>}
      {sleep.band && (
        <details className="nights fold-row">
          <summary>Last 14 nights</summary>
          <div className="nightbars" role="img" aria-label="Sleep score for each of the last 14 nights">
            {recent.map((d) => {
              const s = nights[d]?.score
              return (
                <span key={d} className={`nb ${typeof s !== 'number' ? 'none' : s >= SLEEP_DEEP ? 'deepnight' : s >= SLEEP_DONE ? 'goodnight' : ''}`} title={typeof s === 'number' ? `${d}: ${s}` : `${d}: not measured`}>
                  <i style={{ height: typeof s === 'number' ? `${Math.max(6, s)}%` : '6%' }} />
                  <small>{weekday(d)}</small>
                </span>
              )
            })}
          </div>
        </details>
      )}
    </Win>
  )
}
