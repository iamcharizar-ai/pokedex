// The Nursery (Party tab): the egg's own space. A Mystery Egg is warmed by the
// steps the band counts (from rules version 12; before that, days with two
// pillars); here it is drawn large, cracking a little more as it warms, with
// how far it has to go. With no egg, it says where one comes from.
import { type CSSProperties } from 'react'
import { Win } from '../App.tsx'
import { Gem, ItemIcon } from '../Item.tsx'
import type { Game } from '../../core/fold.ts'
import { STEPS_GOAL } from '../../core/rules.ts'

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
            <small>{held > 0 ? 'It starts warming at the next day it can.' : 'A boss you beat can drop one, or it is 150 gems in the Rare shop. Walking hatches it, into a rare Pokemon.'}</small>
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
          <small>Walk to warm it: every step the band counts (up to {STEPS_GOAL.toLocaleString()} a day) goes in. {left.toLocaleString()} to go.</small>
          <span className="nest-count">{counted}</span>
        </span>
      </div>
    </Win>
  )
}
