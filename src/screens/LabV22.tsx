// Version 22's Lab (GAME-SPEC-V22.md 5.4): everyone who is not in the party researches. A dial toward the next rank, what a day with pillars adds, the next
// three ranks' gifts, and the Pokemon doing the work, strongest first. Tap one for its page. What it shows is game.lab as folded.
import { itemName } from '../../core/economy.ts'
import { labReward } from '../../core/economy.ts'
import type { Game, Mon } from '../../core/fold.ts'
import { LAB_BASE, levelOf } from '../../core/rules.ts'
import { SPECIES } from '../../core/species.ts'
import { labWorth } from '../../core/v22.ts'
import { Win } from '../App.tsx'
import { ItemIcon, Coin } from '../Item.tsx'
import { MonCard } from '../MonCard.tsx'
import { useLook } from '../lib/cardkit.tsx'
import { labOf } from '../lib/party.ts'
import { monCardOf } from '../Team.tsx'

const R = 84, C = 2 * Math.PI * R
const worthOf = (m: Mon): number => labWorth(levelOf(m.xp), (SPECIES[m.form]?.e?.length ?? 0) === 0, m.shiny)
/** The picture for one reward of the cycle: its first item, or coins. */
const giftIcon = (rank: number): string => labReward(rank).items[0]?.[0] ?? (labReward(rank).choice?.[0].items[0]?.[0] ?? 'coin')

export function LabV22({ game, onOpen }: { game: Game; onOpen: (uid: string) => void }) {
  const L = game.lab
  const into = L.need > 0 ? Math.min(1, L.points / L.need) : 0
  const { look, boxOf } = useLook()
  const members = labOf(game).sort((a, b) => worthOf(b) - worthOf(a))
  const perPillar = LAB_BASE + L.strength
  return (
    <Win title="The Professor's research" tone="dark" aside={`+${L.today} today`}>
      <div className="lab">
        <div className="lab-dial" role="img" aria-label={`Research rank ${L.rank}: ${L.points} of ${L.need} points to rank ${L.rank + 1}`}>
          <svg viewBox="0 0 200 200" aria-hidden>
            <defs><linearGradient id="labfill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7ef0d0" /><stop offset="1" stopColor="#ffd45c" /></linearGradient></defs>
            <circle cx="100" cy="100" r={R + 12} className="lab-tick" />
            <circle cx="100" cy="100" r={R} className="lab-track" />
            <circle cx="100" cy="100" r={R} className="lab-fill" strokeDasharray={`${C * into} ${C}`} transform="rotate(-90 100 100)" />
          </svg>
          <span className="lab-core"><ItemIcon id="scanner" size={24} /><b>{L.rank}</b><small>Rank</small></span>
          <span className="lab-pts">{L.points.toLocaleString('en-IN')} / {L.need.toLocaleString('en-IN')}</span>
        </div>
        <div className="lab-side">
          <p className="muted">Everyone who is not in your party researches. Each pillar you do adds <b>{perPillar}</b> ({LAB_BASE} and the Lab's strength, {L.strength}). A stronger Pokemon adds more, and so does one more Pokemon.</p>
          <span className="k-label">The next three ranks</span>
          <ol className="lab-next">
            {L.next.map((t, i) => (
              <li key={i}><span className="lab-gift">{giftIcon(L.rank + 1 + i) === 'coin' ? <Coin size={24} /> : <ItemIcon id={giftIcon(L.rank + 1 + i)} size={24} />}</span> Rank {L.rank + 1 + i}: {t}{labReward(L.rank + 1 + i).items.length > 1 ? ' and more' : ''}</li>
            ))}
          </ol>
        </div>
      </div>
      <span className="k-label">{members.length} researching · strongest first</span>
      {members.length === 0
        ? <p className="muted">Nobody yet. Everything you catch, hatch or revive comes here and starts researching at once.</p>
        : <div className="mon-grid">{members.map((m) => (
          <div key={m.uid} className="pl">
            <MonCard mon={monCardOf(m, game)} look={look} box={boxOf(m.form)} role="lab" onClick={() => onOpen(m.uid)} aria-label={`${itemName(m.form)} worth ${worthOf(m)} to the Lab`} />
            <small className="lab-pay">worth {Math.round(worthOf(m) * 10) / 10}</small>
          </div>
        ))}</div>}
    </Win>
  )
}
