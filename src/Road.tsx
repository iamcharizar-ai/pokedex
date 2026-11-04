// Roads: the study's trophy road, made ours. A vertical track of numbered
// nodes; the ones behind you are ticked, the one you are on shows how far, and
// the next ones are dark. The node you are on breathes, so the eye lands on it.
//
//   SeasonRoad   each XP step of the month, and what it hands over
//
// Both only show what the game already knows.
import { useEffect, useState, type ReactNode } from 'react'
import { seasonReward, itemName, type SeasonReward } from '../core/economy.ts'
import type { Game } from '../core/fold.ts'
import { Win } from './App.tsx'
import { Coin, Gem, ItemIcon } from './Item.tsx'
import { KMedal } from './Kit.tsx'
import { Meter } from './Meter.tsx'

const AHEAD = 3

function Prize({ r, size = 30 }: { r: SeasonReward; size?: number }): ReactNode {
  return r.coins ? <Coin size={size} /> : r.gems ? <Gem size={size} /> : r.item ? <ItemIcon id={r.item} size={size} /> : null
}
const prizeText = (r: SeasonReward): string => (r.coins ? `${r.coins} coins` : r.gems ? `${r.gems} gems` : r.item ? itemName(r.item) : '')

const SEEN_KEY = 'pokedex:season-seen'
/** The step last shown on this device ("2026-11:4"), so a step collected since then lands with a stamp. */
function useNewSteps(month: string, step: number): boolean {
  const [fresh] = useState(() => {
    try {
      const [m, n] = (localStorage.getItem(SEEN_KEY) ?? '').split(':')
      return m === month ? step > Number(n) : step > 0 && m !== ''
    } catch { return false }
  })
  useEffect(() => { try { localStorage.setItem(SEEN_KEY, `${month}:${step}`) } catch { /* only forgotten */ } }, [month, step])
  return fresh
}

/** This month's season (UI-AUDIT-2026-11-04 phase 8): the steps behind you collected and folded into one node, the
 *  step you are on lit with its meter, the next few locked. A step collected since you last looked lands with a stamp. */
export function SeasonRoad({ game }: { game: Game }) {
  const { step, into, need } = game.season
  const fresh = useNewSteps(game.today.day.slice(0, 7), step)
  const rule = `Every ${need.toLocaleString('en-IN')} XP of the month's work is a step. The month starts again on the 1st.`
  const rows: ReactNode[] = []
  for (let n = step + 1; n <= step + AHEAD; n++) {
    const r = seasonReward(n)
    const now = n === step + 1
    rows.push(
      <div key={n} className={`k-step ${now ? 'now ready' : 'ahead locked'}`} data-n={n}>
        <KMedal on={now} color="#f5b800"><Prize r={r} /></KMedal>
        <div>
          <span className="name">{prizeText(r)}</span>
          {now ? <div className="road-meter"><Meter value={Math.round(into)} max={need} kind="gold" size="lg" className="pre-sweep" name="This season step" label={`${Math.round(into).toLocaleString('en-IN')} / ${need.toLocaleString('en-IN')} XP`} /></div> : <small>{(n * need).toLocaleString('en-IN')} XP this month</small>}
        </div>
      </div>,
    )
  }
  return (
    <Win title="The season" tone="gold" aside={<span title={rule}>step {step}<span className="sr-only">. {rule}</span></span>}>
      <div className="k-road" title={rule}>
        {step > 0 && (
          <div className="k-step done collected" data-n="✓">
            <span className={`road-stamp ${fresh ? 'pre-stamp' : ''}`} aria-hidden>✓</span>
            <div><span className="name">{step} {step === 1 ? 'step' : 'steps'} collected</span><small>Everything behind you is paid</small></div>
          </div>
        )}
        {rows}
      </div>
    </Win>
  )
}
