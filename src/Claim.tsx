// Rewards waiting to be collected: showing-up pay, weekly quests, season steps,
// feats and a month reviewed. Each one is held by the game (game.held) and
// reaches the wallet or the Bag only when it is claimed here, or on its own
// CLAIM_AUTO days after it was earned, so nothing is lost by not opening the app.
//
// A claim is one `claim` event in the ledger, so it is the same on every device.
// Tapping sends the coins, gems and items flying into the pill or tab they are
// kept in.
import { useRef, useState } from 'react'
import { itemName } from '../core/economy.ts'
import { CLAIM_AUTO } from '../core/rules.ts'
import type { Game, Held } from '../core/fold.ts'
import { Coin, Gem, ItemIcon } from './Item.tsx'
import { flyReward, type Pocket } from './lib/fly.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

interface Part { pocket: Pocket; n: number; item?: string }
const partsOf = (h: Held): Part[] => [
  ...(h.coins > 0 ? [{ pocket: 'coins' as const, n: h.coins }] : []),
  ...(h.gems > 0 ? [{ pocket: 'gems' as const, n: h.gems }] : []),
  ...h.items.map(([item, n]) => ({ pocket: 'bag' as const, n, item })),
]

const daysLeft = (h: Held, today: string): number =>
  Math.max(0, CLAIM_AUTO - Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(h.day + 'T12:00:00Z')) / 86400000))

export function Claims({ game, today }: { game: Game; today: string }) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const open = game.held
  const [said, setSaid] = useState('')

  const claim = (list: Held[]) => {
    // the chips leave as soon as the game updates, so read where they are first
    list.forEach((h, i) => {
      const el = refs.current.get(h.key)
      const parts = partsOf(h)
      if (el) parts.forEach((p, j) => flyReward(el, p.item ? `+${p.n} ${itemName(p.item)}` : `+${p.n}`, p.pocket, (i * parts.length + j) * 90))
    })
    play('collect')
    setSaid(`Collected ${list.map((h) => h.title).join(', ')}`)
    for (const h of list) useItem('', '', 'claim', h.key)
  }

  return (
    <>
    <div className="sr-only" role="status" aria-live="polite">{said}</div>
    {open.length > 0 && <section className="claims" aria-label="Rewards to collect">
      <div className="claims-head">
        <b>Collect</b>
        {open.length > 1 && <button type="button" className="k-btn" onClick={() => claim(open)}>Collect all {open.length}</button>}
      </div>
      <div className="claims-row">
        {open.map((h) => {
          const parts = partsOf(h)
          const left = daysLeft(h, today)
          return (
            <button key={h.key} type="button" className="claim-chip breathe" data-pocket={parts[0]?.pocket} ref={(el) => { if (el) refs.current.set(h.key, el); else refs.current.delete(h.key) }} onClick={() => claim([h])}>
              <span className="claim-ico">
                {parts.map((p, i) => (p.pocket === 'coins' ? (p.n >= 250 ? <ItemIcon key={i} id="loot-sack" size={30} /> : p.n >= 100 ? <ItemIcon key={i} id="big-nugget" size={28} /> : <Coin key={i} size={26} />) : p.pocket === 'gems' ? <Gem key={i} size={26} /> : <ItemIcon key={i} id={p.item ?? ''} size={26} />))}
              </span>
              <span className="claim-txt">
                <b>{h.title}</b>
                <small>
                  {parts.map((p) => (p.item ? `${p.n > 1 ? `${p.n} × ` : ''}${itemName(p.item)}` : `+${p.n} ${p.pocket}`)).join(' · ')}
                  {left <= 1 ? ' · pays itself soon' : ''}
                </small>
              </span>
            </button>
          )
        })}
      </div>
    </section>}
    </>
  )
}
