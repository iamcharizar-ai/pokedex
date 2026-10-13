// The Nursery (Party tab): the egg's own space. A Mystery Egg warms for a few
// days with two pillars; here it is drawn large, cracking a little more each
// day, with how many days are left. With no egg, it says where one comes from.
import { type CSSProperties } from 'react'
import { Win } from '../App.tsx'
import { Gem, ItemIcon } from '../Item.tsx'
import { KBar } from '../Kit.tsx'
import type { Game } from '../../core/fold.ts'

export function Nursery({ game, onShop }: { game: Game; onShop: () => void }) {
  const egg = game.egg
  if (!egg) {
    const held = game.inv['rare-egg'] ?? 0
    return (
      <Win title="Nursery" tone="green" aside="Empty">
        <div className="nursery empty">
          <span className="nursery-egg dim"><ItemIcon id="rare-egg" size={72} /></span>
          <span className="nursery-txt">
            <b>{held > 0 ? 'An egg is in your Bag' : 'No egg is warming'}</b>
            <small>{held > 0 ? 'It starts warming at the next day it can.' : 'Eggs are a reward, or 150 gems in the Rare shop. One hatches into a rare Pokemon.'}</small>
            {held === 0 && <button type="button" className="k-btn" onClick={onShop}><Gem size={20} />Rare shop</button>}
          </span>
        </div>
      </Win>
    )
  }
  const left = Math.max(0, egg.need - egg.have)
  const warm = egg.need > 0 ? egg.have / egg.need : 0
  return (
    <Win title="Nursery" tone="green" aside={`${egg.have} of ${egg.need} days`}>
      <div className={`nursery ${left === 1 ? 'tomorrow' : ''}`} style={{ ['--warm' as string]: warm } as CSSProperties}>
        <span className="nursery-egg">
          <ItemIcon id="rare-egg" size={96} />
          <i className="crack c1" /><i className="crack c2" /><i className="crack c3" />
        </span>
        <span className="nursery-txt">
          <b>{left <= 1 ? 'It is about to hatch' : 'An egg is warming'}</b>
          <small>Each day with two pillars is a day nearer.{left === 1 ? ' One more.' : ''}</small>
          <KBar value={egg.have} max={egg.need} kind="gold" label={`${egg.have} / ${egg.need} days`} />
        </span>
      </div>
    </Win>
  )
}
