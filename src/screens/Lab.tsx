// The Professor's research (Party › Lab), drawn as an instrument the way the
// Forge is an altar: a dial that fills toward the next rank with the rank in its
// middle, the desk as three specimen jars, a ledger of where each day's study
// comes from, the HP every rank takes off wild Pokemon as a row of pips, and the
// next rank's gift on a pedestal. What it shows is game.research as folded.
import type { ReactNode } from 'react'
import { researchReward, itemName } from '../../core/economy.ts'
import { isShelved, type Game } from '../../core/fold.ts'
import { DAY_RESEARCH, DESK_BONUS, FIRST_PILLAR, RESEARCH_WILD, RESEARCH_WILD_MAX, SLEEP_BONUS, type Rarity } from '../../core/rules.ts'
import { SPECIES } from '../../core/species.ts'
import { Win } from '../App.tsx'
import { Coin, Gem, ItemIcon } from '../Item.tsx'
import { play } from '../lib/sfx.ts'
import { useItem } from '../lib/store.ts'

const R = 84, C = 2 * Math.PI * R

/** The kinds of work that make a day count for the Professor (Sleep alone does not), as the Life OS list has them today. */
const WORK_NAME: [string, string][] = [['code', 'Code'], ['fitness', 'Gym'], ['arbor', 'Arbor'], ['guitar', 'Guitar']]
const orWords = (xs: string[]): string => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}` : xs[0] ?? 'a pillar')

/** Whether today studies, and why not when it does not: the fold's `research.counts` in words. */
export function todayLine(game: Game): string {
  const r = game.research
  if (r.counts === 'pillar') return r.today > 0 ? `Today counts: +${r.today} research.` : 'Today counts, but nobody is studying: put a Pokemon on the desk.'
  const work = orWords(WORK_NAME.filter(([t]) => !isShelved(game, t)).map(([, n]) => n))
  return r.counts === 'sleep'
    ? `Today doesn't count yet: Sleep alone isn't a day of work. Do ${work} and the Professor studies.`
    : `Today doesn't count yet: do ${work} and the Professor studies.`
}

export function ResearchLab({ game, desk }: { game: Game; desk: ReactNode }) {
  const r = game.research
  const into = r.need > 0 ? Math.min(1, r.points / r.need) : 0
  const gift = researchReward(r.rank + 1)
  const pips = Math.round(RESEARCH_WILD_MAX / RESEARCH_WILD)
  const v21 = game.tier.v21
  // version 21: a day's research is its tier's, the first pillar's, and the desk's share on top (core/rules.ts)
  const deskShare = r.desk.reduce((n, m) => n + DESK_BONUS[(SPECIES[m.form]?.r ?? 'C') as Rarity] * (m.shiny ? 1.5 : 1), 0)
  const byTier = [1, 2, 3, 4].map((t) => Math.round((DAY_RESEARCH[t] + FIRST_PILLAR.research) * (1 + deskShare)))
  const total = v21 ? byTier[1] : r.parts.desk + r.parts.party
  const days = total > 0 ? Math.ceil((r.need - r.points) / total) : null
  return (
    <Win title="The Professor's research" tone="dark" aside={v21 ? `+${r.today} today` : `+${total}/day${r.parts.insight ? ` · +${r.parts.insight} on a code day` : ''}`}>
      <div className="lab">
        {/* the dial: points toward the next rank */}
        <div className="lab-dial" role="img" aria-label={`Research rank ${r.rank}: ${r.points} of ${r.need} points to rank ${r.rank + 1}`}>
          <svg viewBox="0 0 200 200" aria-hidden>
            <defs><linearGradient id="labfill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7ef0d0" /><stop offset="1" stopColor="#ffd45c" /></linearGradient></defs>
            <circle cx="100" cy="100" r={R + 12} className="lab-tick" />
            <circle cx="100" cy="100" r={R} className="lab-track" />
            <circle cx="100" cy="100" r={R} className="lab-fill" strokeDasharray={`${C * into} ${C}`} transform="rotate(-90 100 100)" />
          </svg>
          <span className="lab-core">
            <ItemIcon id="scanner" size={24} />
            <b>{r.rank}</b>
            <small>Rank</small>
          </span>
          <span className="lab-pts">{r.points.toLocaleString('en-IN')} / {r.need.toLocaleString('en-IN')}</span>
        </div>
        <p className="lab-say">{v21 ? (days !== null && days <= 1 ? `Rank ${r.rank + 1} comes with the next day of work.` : `About ${days} days of two pillars to rank ${r.rank + 1}.`) : days === null ? 'Nothing is being studied. Put a Pokemon on the desk.' : days <= 1 ? `Rank ${r.rank + 1} comes with the next day of work.` : `About ${days} days of work to rank ${r.rank + 1}.`}</p>
        <p className={`lab-today ${r.counts === 'pillar' ? 'on' : 'off'}`}>{todayLine(game)}</p>

        {/* the desk: three places, drawn by the Research tab (src/Research.tsx) */}
        {desk}
        {r.chosen && <button type="button" className="pill-btn lab-auto" onClick={() => { useItem('', '', 'study', 'auto'); play('tap') }}>Let the Professor choose the strongest</button>}

        {/* version 21: what a day of work brings, by how many pillars: a bar of the rank for each */}
        {v21 && (
          <div className="lab-tiers" role="list" aria-label="Research a day brings, by pillars done">
            {byTier.map((n, k) => (
              <div key={k} role="listitem" className={`lab-tier ${game.tier.tier === k + 1 ? 'today' : ''}`} aria-label={`${k === 3 ? 'A Max day' : `${k + 1} pillar${k ? 's' : ''}`}: +${n}`}>
                <span className="lab-tier-k" aria-hidden>{k === 3 ? <i className="max">✦</i> : [0, 1, 2].map((j) => <i key={j} className={j <= k ? 'on' : ''} />)}</span>
                <span className="lab-tier-bar" aria-hidden><i style={{ width: `${Math.min(100, (n / r.need) * 100)}%` }} /></span>
                <b>+{n}</b>
              </div>
            ))}
            <span className="lab-tier-chips">
              <span className="lab-chip">Desk +{Math.round(deskShare * 100)}%</span>
              <span className="lab-chip">A night of 80+ +{Math.round(SLEEP_BONUS.research * 100)}%</span>
            </span>
          </div>
        )}

        {/* where a day's study comes from (before version 21) */}
        {!v21 && <dl className="lab-ledger">
          <div><dt>The desk</dt><dd>+{r.parts.desk}</dd></div>
          <div><dt>Your party, at half</dt><dd>+{r.parts.party}</dd></div>
          {game.v16 && <div className={r.parts.insight ? '' : 'off'}><dt>Insight, on a code day</dt><dd>{r.parts.insight ? `+${r.parts.insight}` : 'none in the party'}</dd></div>}
          <div className="sum"><dt>A day with a pillar</dt><dd>+{total}{r.parts.insight ? ` (+${total + r.parts.insight} coding)` : ''}</dd></div>
        </dl>}

        {/* what the ranks do to wild Pokemon */}
        <div className="lab-cut">
          <span className="k-label">Wild Pokemon arrive weaker · −{Math.round(r.cut * 100)}% HP now</span>
          <span className="lab-pips" aria-label={`${r.rank} of ${pips} ranks: each takes ${Math.round(RESEARCH_WILD * 100)}% off`}>
            {Array.from({ length: pips }, (_, i) => <i key={i} className={i < r.rank ? 'on' : i === r.rank ? 'next' : ''} />)}
          </span>
        </div>

        {/* the next gift, on a pedestal */}
        <div className="lab-gift">
          <span className="lab-pedestal">
            {gift.items[0] ? <ItemIcon id={gift.items[0][0]} size={48} /> : gift.gems ? <Gem size={36} /> : <Coin size={36} />}
          </span>
          <span className="lab-gift-txt">
            <span className="k-label">Gift at rank {r.rank + 1}</span>
            <b>{[...gift.items.map(([id, n]) => `${itemName(id)}${n > 1 ? ` ×${n}` : ''}`), ...(gift.gems ? [`${gift.gems} gems`] : []), ...(gift.coins ? [`${gift.coins} coins`] : [])].join(' · ')}</b>
          </span>
        </div>
      </div>
    </Win>
  )
}
