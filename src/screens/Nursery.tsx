// The Nursery (Party tab): the egg's own space. A Mystery Egg is warmed by the
// steps the band counts (from rules version 12; before that, days with two
// pillars); here it is drawn large, cracking a little more as it warms, with
// how far it has to go. With no egg, it says where one comes from.
import { type CSSProperties } from 'react'
import { Win } from '../App.tsx'
import { Gem, ItemIcon } from '../Item.tsx'
import type { Game } from '../../core/fold.ts'
import { STEPS_GOAL } from '../../core/rules.ts'
import { addDays } from '../../core/facts.ts'
import { fmtDay } from '../lib/art.ts'

export function Nursery({ game, onShop }: { game: Game; onShop: () => void }) {
  const egg = game.egg
  if (!egg) {
    const held = game.inv['rare-egg'] ?? 0
    return (
      <Win title="Nursery" tone="green" aside="Empty">
        <div className="nursery empty">
          <span className="nest empty"><span className="nursery-egg dim"><ItemIcon id="rare-egg" size={56} /></span></span>
          <span className="nursery-txt">
            <b>{held > 0 ? 'An egg is in your Bag' : 'No egg is warming'}</b>
            <small>{held > 0 ? 'It is set to incubate: warming begins tomorrow, and its steps count from the next day.' : 'A boss you beat can drop one, or it is 150 gems in the Rare shop. Walking hatches it, into a rare Pokemon.'}</small>
            {held === 0 && <button type="button" className="k-btn" onClick={onShop}><Gem size={20} />Rare shop</button>}
          </span>
        </div>
      </Win>
    )
  }
  const left = Math.max(0, egg.need - egg.have)
  const warm = egg.need > 0 ? egg.have / egg.need : 0
  const near = left <= STEPS_GOAL
  const counted = `${egg.have.toLocaleString()} / ${egg.need.toLocaleString()} steps`
  // your pace: the band's average day, as the egg counts it (at most STEPS_GOAL), and when that brings it out
  const pace = game.notes.stepDays > 0 ? Math.min(STEPS_GOAL, Math.round(game.notes.steps / game.notes.stepDays)) : 0
  const days = pace > 0 ? Math.max(1, Math.ceil(left / pace)) : null
  const hatch = days !== null ? fmtDay(addDays(game.today.day, days)) : null
  return (
    <Win title="Nursery" tone="green" aside={`${Math.round(warm * 100)}% warm`}>
      <div className={`nursery ${near ? 'tomorrow' : ''}`} style={{ ['--warm' as string]: warm } as CSSProperties}>
        <span className="nest" role="progressbar" aria-valuemin={0} aria-valuemax={egg.need} aria-valuenow={egg.have} aria-label="How warm the egg is">
          <span className="nursery-egg">
            <ItemIcon id="rare-egg" size={84} />
            <i className="crack c1" /><i className="crack c2" /><i className="crack c3" />
          </span>
        </span>
        <span className="nursery-txt">
          <b>{near ? 'It is about to hatch' : 'An egg is warming'}</b>
          {egg.since === game.today.day && <small className="nest-note"><b>Incubation begins tomorrow.</b> The egg is set up today, so today's steps do not count; they start from the next day.</small>}
          <small>Walk to warm it: every step the band counts (up to {STEPS_GOAL.toLocaleString()} a day) goes in. {left.toLocaleString()} to go.</small>
          <span className="nest-count">{counted}</span>
          <span className="nest-chips">
            {egg.since !== game.today.day && egg.today > 0 && <span className="nest-chip"><b>+{egg.today.toLocaleString()}</b> today</span>}
            {pace > 0 && <span className="nest-chip"><b>~{pace.toLocaleString()}</b> a day</span>}
            {hatch && <span className="nest-chip hatch"><b>{days === 1 ? 'Tomorrow' : hatch}</b> {days === 1 ? '' : 'at this pace'}</span>}
          </span>
        </span>
      </div>
    </Win>
  )
}
