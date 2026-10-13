// Rewards waiting to be collected: showing-up pay, weekly quests, season steps,
// feats, a month reviewed and the boss's prizes. Each one is held by the game
// (game.held) and reaches the wallet or the Bag only when it is claimed here, or
// on its own CLAIM_AUTO days after it was earned, so nothing is lost by not
// opening the app.
//
// It lives in the top bar as a badge with a count, so it is one tap from any tab,
// and opens as a sheet. A claim is one `claim` event in the ledger, so it is the
// same on every device. Tapping sends the coins, gems and items flying into the
// pill or tab they are kept in.
import { useEffect, useRef, useState } from 'react'
import { itemName } from '../core/economy.ts'
import { CLAIM_AUTO } from '../core/rules.ts'
import type { Game, Held } from '../core/fold.ts'
import { Coin, Gem, ItemIcon } from './Item.tsx'
import { flyReward, type Pocket } from './lib/fly.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'
import { Sheet } from './screens/Sheet.tsx'

interface Part { pocket: Pocket; n: number; item?: string }
const partsOf = (h: Held): Part[] => [
  ...(h.coins > 0 ? [{ pocket: 'coins' as const, n: h.coins }] : []),
  ...(h.gems > 0 ? [{ pocket: 'gems' as const, n: h.gems }] : []),
  ...h.items.map(([item, n]) => ({ pocket: 'bag' as const, n, item })),
]

const daysLeft = (h: Held, today: string): number =>
  Math.max(0, CLAIM_AUTO - Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(h.day + 'T12:00:00Z')) / 86400000))

/** The badge in the top bar, and the sheet it opens. */
export function CollectButton({ game, today }: { game: Game; today: string }) {
  const [open, setOpen] = useState(false)
  const [said, setSaid] = useState('')
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const held = game.held

  // once the last one is collected, let the last flight land, then put the sheet away
  useEffect(() => {
    if (!open || held.length > 0) return
    const t = window.setTimeout(() => setOpen(false), 900)
    return () => window.clearTimeout(t)
  }, [open, held.length])

  const claim = (list: Held[]) => {
    // the chips leave as soon as the game updates, so read where they are first
    list.forEach((h, i) => {
      const el = refs.current.get(h.key)
      const parts = partsOf(h)
      if (el) parts.forEach((p, j) => flyReward(el, p.item ? `+${p.n} ${itemName(p.item)}` : `+${p.n}`, p.pocket, (i * parts.length + j) * 90))
    })
    // a chain climbs: each chip a step higher than the last
    list.forEach((_, i) => window.setTimeout(() => play('collect', i * 2), i * 110))
    setSaid(`Collected ${list.map((h) => h.title).join(', ')}`)
    for (const h of list) useItem('', '', 'claim', h.key)
  }

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">{said}</span>
      <button
        type="button"
        className={`tb-collect ${held.length ? 'has breathe' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={held.length ? `Collect: ${held.length} ${held.length === 1 ? 'reward' : 'rewards'} waiting` : 'Collect: nothing waiting'}
        title={held.length ? 'Rewards waiting' : 'Nothing to collect'}
      >
        <ItemIcon id="loot-sack" size={30} />
        {held.length > 0 && <i className="tb-count">{held.length}</i>}
      </button>
      {open && (
        <Sheet title="Collect" onClose={() => setOpen(false)}>
          <div className="collect">
            <div className="collect-head">
              <h2 className="k-type">Collect</h2>
              {held.length > 1 && <button type="button" className="k-btn main" onClick={() => claim(held)}>Collect all {held.length}</button>}
            </div>
            {held.length === 0 && <p className="muted">Nothing is waiting. Pay, quests, season steps, feats and boss prizes arrive here.</p>}
            <div className="collect-list">
              {held.map((h) => {
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
          </div>
        </Sheet>
      )}
    </>
  )
}
