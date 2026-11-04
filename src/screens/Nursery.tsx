// The Nursery (Today tab): the egg's own space. An egg is warmed by the steps the
// band counts (from rules version 12; before that, days with two pillars, and from
// version 19 with no cut at so many a day); here it is drawn large, cracking a little
// more as it warms, with how far it has to go. With no egg it says where one comes
// from, and with two kinds waiting it asks which goes in first. Version 19 also
// has the Trail Egg, found by walking: how far the next one is shows here.
import { type CSSProperties } from 'react'
import { Win } from '../App.tsx'
import { Gem, ItemIcon } from '../Item.tsx'
import { EGG_IDS, EGG_KINDS, MARKS, itemName } from '../../core/economy.ts'
import type { Game } from '../../core/fold.ts'
import { STEPS_GOAL, V19_START } from '../../core/rules.ts'
import { addDays } from '../../core/facts.ts'
import { fmtDay } from '../lib/art.ts'
import { play } from '../lib/sfx.ts'
import { useItem } from '../lib/store.ts'

/** What an egg of this kind hatches, in a few words. */
export const hatchesInto = (kind: string): string => {
  const k = EGG_KINDS[kind]
  if (!k) return 'a rare Pokemon'
  if (k.work) return `an uncommon Pokemon of ${MARKS[k.work].name.toLowerCase()} work (a rare one in three or four)`
  return k.hearts ? `an uncommon Pokemon, fond of you from the start (${k.hearts} hearts)` : 'a rare Pokemon'
}

/** How far the next Trail Egg is: the steps walked since version 19 began, in laps of one egg. */
function TrailLine({ game }: { game: Game }) {
  if (game.today.day < V19_START) return null
  const { walked, every } = game.trail
  const into = walked % every
  return (
    <span className="nest-chips">
      <span className="nest-chip"><ItemIcon id="trail-egg" size={16} /> <b>{(every - into).toLocaleString()}</b> steps to the next Trail Egg</span>
    </span>
  )
}

export function Nursery({ game, onShop }: { game: Game; onShop: () => void }) {
  const egg = game.egg
  if (!egg) {
    const waiting = EGG_IDS.filter((id) => (game.inv[id] ?? 0) > 0)
    if (waiting.length > 1) {
      return (
        <Win title="Nursery" tone="green" aside={`${waiting.length} kinds waiting`}>
          <div className="nursery empty">
            <span className="nest empty"><span className="nursery-egg dim"><ItemIcon id={waiting[0]} size={48} /></span></span>
            <span className="nursery-txt">
              <b>Which egg goes in first?</b>
              <small>One egg is warmed at a time. Its steps count from tomorrow, and the others wait in your Bag.</small>
              <span className="nest-chips">
                {waiting.map((id) => (
                  <button key={id} type="button" className="pill-btn" onClick={() => { useItem(id, '', 'warm'); play('tap') }} title={`${itemName(id)}: ${EGG_KINDS[id].steps.toLocaleString()} steps, hatches ${hatchesInto(id)}`}>
                    <ItemIcon id={id} size={24} />{itemName(id)}{(game.inv[id] ?? 0) > 1 ? ` ×${game.inv[id]}` : ''}
                  </button>
                ))}
              </span>
              <TrailLine game={game} />
            </span>
          </div>
        </Win>
      )
    }
    const held = waiting.length
    return (
      <Win title="Nursery" tone="green" aside="Empty">
        <div className="nursery empty">
          <span className="nest empty"><span className="nursery-egg dim"><ItemIcon id={waiting[0] ?? 'rare-egg'} size={48} /></span></span>
          <span className="nursery-txt">
            <b>{held > 0 ? 'An egg is in your Bag' : 'No egg is warming'}</b>
            <small>{held > 0 ? 'It is set to incubate: warming begins tomorrow, and its steps count from the next day.' : game.today.day >= V19_START ? 'Walking finds Trail Eggs. A boss, a research rank or the Rare shop gives a Mystery Egg, and each kind of work\'s shop sells its own for marks.' : 'A boss you beat can drop one, or it is 150 gems in the Rare shop. Walking hatches it, into a rare Pokemon.'}</small>
            <TrailLine game={game} />
            {held === 0 && <button type="button" className="pill-btn" onClick={onShop}><Gem size={20} />Shop</button>}
          </span>
        </div>
      </Win>
    )
  }
  const kind = EGG_KINDS[egg.kind]
  const left = Math.max(0, egg.need - egg.have)
  const warm = egg.need > 0 ? egg.have / egg.need : 0
  // your pace: the band's average day lately, every step of it, and when that brings the egg out
  const pace = egg.pace
  const near = left <= (pace > 0 ? pace : STEPS_GOAL)
  const counted = `${egg.have.toLocaleString()} / ${egg.need.toLocaleString()} steps`
  const days = pace > 0 ? Math.max(1, Math.ceil(left / pace)) : null
  const hatch = days !== null ? fmtDay(addDays(game.today.day, days)) : null
  return (
    <Win title="Nursery" tone="green">
      <div className={`nursery ${near ? 'tomorrow' : ''}`} style={{ ['--warm' as string]: warm } as CSSProperties}>
        <span className="nest" role="progressbar" aria-valuemin={0} aria-valuemax={egg.need} aria-valuenow={egg.have} aria-label="How warm the egg is">
          <span className="nursery-egg">
            <ItemIcon id={egg.kind} size={72} />
            <i className="crack c1" /><i className="crack c2" /><i className="crack c3" />
          </span>
        </span>
        <span className="nursery-txt">
          <b>{near ? `${kind?.name ?? 'The egg'} is about to hatch` : `${kind?.name ?? 'An egg'} is warming`}</b>
          {egg.since === game.today.day && <small className="nest-note"><b>Incubation begins tomorrow.</b> The egg is set up today, so today's steps do not count; they start from the next day.</small>}
          {/* the ring is how warm it is; the number is said once, here (UI-AUDIT T5) */}
          <small title="Every step the band counts goes in, with no limit a day.">Hatches into {hatchesInto(egg.kind)}.</small>
          <span className="nest-count">{counted}</span>
          <span className="nest-chips">
            {egg.since !== game.today.day && egg.today > 0 && <span className="nest-chip"><b>+{egg.today.toLocaleString()}</b> today</span>}
            {pace > 0 && <span className="nest-chip"><b>~{pace.toLocaleString()}</b> a day</span>}
            {hatch && <span className="nest-chip hatch"><b>{days === 1 ? 'Tomorrow' : hatch}</b> {days === 1 ? '' : 'at this pace'}</span>}
          </span>
          <TrailLine game={game} />
        </span>
      </div>
    </Win>
  )
}
