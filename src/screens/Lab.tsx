// The Professor's research (Party › Lab), drawn as an instrument the way the
// Forge is an altar: a dial that fills toward the next rank with the rank in its
// middle, the desk as three specimen jars, a ledger of where each day's study
// comes from, the HP every rank takes off wild Pokemon as a row of pips, and the
// next rank's gift on a pedestal. What it shows is game.research as folded.
import type { CSSProperties } from 'react'
import { researchReward, itemName } from '../../core/economy.ts'
import { nameOf, type Game, type Mon } from '../../core/fold.ts'
import { RESEARCH_SLOTS, RESEARCH_WILD, RESEARCH_WILD_MAX } from '../../core/rules.ts'
import { Win } from '../App.tsx'
import { Coin, Gem, ItemIcon } from '../Item.tsx'
import { still } from '../lib/art.ts'
import { play } from '../lib/sfx.ts'
import { useItem } from '../lib/store.ts'

const R = 84, C = 2 * Math.PI * R

export function ResearchLab({ game, onOpen, studyValue }: { game: Game; onOpen: (uid: string) => void; studyValue: (m: Mon) => number }) {
  const r = game.research
  const into = r.need > 0 ? Math.min(1, r.points / r.need) : 0
  const gift = researchReward(r.rank + 1)
  const pips = Math.round(RESEARCH_WILD_MAX / RESEARCH_WILD)
  const total = r.parts.desk + r.parts.party
  const days = total > 0 ? Math.ceil((r.need - r.points) / total) : null
  return (
    <Win title="The Professor's research" tone="dark" aside={`+${total}/day${r.parts.insight ? ` · +${r.parts.insight} on a code day` : ''}`}>
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
            <ItemIcon id="scanner" size={30} />
            <b>{r.rank}</b>
            <small>Rank</small>
          </span>
          <span className="lab-pts">{r.points.toLocaleString('en-IN')} / {r.need.toLocaleString('en-IN')}</span>
        </div>
        <p className="lab-say">{days === null ? 'Nothing is being studied. Put a Pokemon on the desk.' : days <= 1 ? `Rank ${r.rank + 1} comes with the next day of work.` : `About ${days} days of work to rank ${r.rank + 1}.`}</p>

        {/* the desk: three jars */}
        <div className="lab-desk">
          {Array.from({ length: RESEARCH_SLOTS }, (_, i) => {
            const m = r.desk[i]
            return m ? (
              <button key={m.uid} type="button" className="jar full" onClick={() => { onOpen(m.uid); play('tap') }} aria-label={`${nameOf(m.form)} on the desk, ${studyValue(m)} points a day. Open its page`} style={{ ['--i' as string]: i } as CSSProperties}>
                <span className="jar-glass"><img src={still(m.form, m.shiny)} alt="" width={56} height={56} className="sprite" /></span>
                <b>{nameOf(m.form)}</b><small>+{studyValue(m)} a day</small>
              </button>
            ) : (
              <span key={i} className="jar">
                <span className="jar-glass" aria-hidden><i>?</i></span>
                <b>Empty jar</b><small>from the box below</small>
              </span>
            )
          })}
        </div>
        {r.chosen && <button type="button" className="k-btn lab-auto" onClick={() => { useItem('', '', 'study', 'auto'); play('tap') }}>Let the Professor choose the strongest</button>}

        {/* where a day's study comes from */}
        <dl className="lab-ledger">
          <div><dt>The desk</dt><dd>+{r.parts.desk}</dd></div>
          <div><dt>Your party, at half</dt><dd>+{r.parts.party}</dd></div>
          {game.v16 && <div className={r.parts.insight ? '' : 'off'}><dt>Insight, on a code day</dt><dd>{r.parts.insight ? `+${r.parts.insight}` : 'none in the party'}</dd></div>}
          <div className="sum"><dt>A day with a pillar</dt><dd>+{total}{r.parts.insight ? ` (+${total + r.parts.insight} coding)` : ''}</dd></div>
        </dl>

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
            {gift.items[0] ? <ItemIcon id={gift.items[0][0]} size={40} /> : gift.gems ? <Gem size={36} /> : <Coin size={36} />}
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
