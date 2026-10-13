// Roads: the study's trophy road, made ours. A vertical track of numbered
// nodes; the ones behind you are ticked, the one you are on shows how far, and
// the next ones are dark. The node you are on breathes, so the eye lands on it.
//
//   SeasonRoad   each XP step of the month, and what it hands over
//
// Both only show what the game already knows.
import { type ReactNode } from 'react'
import { seasonReward, itemName, type SeasonReward } from '../core/economy.ts'
import type { Game } from '../core/fold.ts'
import { Win } from './App.tsx'
import { Coin, Gem, ItemIcon } from './Item.tsx'
import { KBar, KMedal } from './Kit.tsx'

const AHEAD = 3

function Prize({ r, size = 30 }: { r: SeasonReward; size?: number }): ReactNode {
  return r.coins ? <Coin size={size} /> : r.gems ? <Gem size={size} /> : r.item ? <ItemIcon id={r.item} size={size} /> : null
}
const prizeText = (r: SeasonReward): string => (r.coins ? `${r.coins} coins` : r.gems ? `${r.gems} gems` : r.item ? itemName(r.item) : '')

/** This month's season: every step so far folded into a count, the step in progress, and the next few. */
export function SeasonRoad({ game }: { game: Game }) {
  const { step, into, need } = game.season
  const rows: ReactNode[] = []
  for (let n = step + 1; n <= step + AHEAD; n++) {
    const r = seasonReward(n)
    const now = n === step + 1
    rows.push(
      <div key={n} className={`k-step ${now ? 'now' : 'ahead'}`} data-n={n}>
        <KMedal on={now} color="#f5b800"><Prize r={r} /></KMedal>
        <div>
          <span className="name">{prizeText(r)}</span>
          {now ? <div style={{ marginTop: 6 }}><KBar value={Math.round(into)} max={need} kind="gold" label={`${Math.round(into).toLocaleString('en-IN')} / ${need.toLocaleString('en-IN')} XP`} /></div> : <small>{(n * need).toLocaleString('en-IN')} XP this month</small>}
        </div>
      </div>,
    )
  }
  return (
    <Win title="The season" tone="gold" aside={`step ${step}`}>
      {step > 0 && (
        <div className="k-road-done" title="Everything behind you is paid and folded away">
          <span className="k-rung past">{step} {step === 1 ? 'step' : 'steps'} done this month</span>
        </div>
      )}
      <div className="k-road">{rows}</div>
      <p className="muted">Every {need.toLocaleString('en-IN')} XP of the month's work is a step. The month starts again on the 1st.</p>
    </Win>
  )
}
