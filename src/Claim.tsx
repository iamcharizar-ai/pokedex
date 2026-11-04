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
//
// From version 15 a level milestone is a choice of two: it is drawn as a card
// with a button for each side, and "Collect all" leaves it for you to choose.
import { useEffect, useRef, useState } from 'react'
import { itemName, type Option } from '../core/economy.ts'
import { CLAIM_AUTO } from '../core/rules.ts'
import type { Game, Held } from '../core/fold.ts'
import { Coin, Gem, ItemIcon } from './Item.tsx'
import { flyReward, type Pocket } from './lib/fly.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'
import { Sheet } from './screens/Sheet.tsx'
import { Slot } from './Slot.tsx'

/** 1,234 · 12.3k: a count short enough for a slot's corner. */
const short = (n: number): string => (n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.floor(n / 1000)}k`)

interface Part { pocket: Pocket; n: number; item?: string }
const partsOf = (h: Held | Option): Part[] => [
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

  const plain = held.filter((h) => !h.choice)
  /** One side of a choice: the button names it, and its pay flies from the button pressed. */
  const choose = (h: Held, i: 0 | 1, el: HTMLElement) => {
    const parts = partsOf(h.choice![i])
    parts.forEach((p, j) => flyReward(el, p.item ? `+${p.n} ${itemName(p.item)}` : `+${p.n}`, p.pocket, j * 90))
    play('collect')
    setSaid(`Chose ${h.choice![i].name}`)
    useItem(String(i), '', 'claim', h.key)
  }
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

  // identical rewards (same title, same pay) are one slot
  const groups: Held[][] = []
  for (const h of plain) {
    const sig = `${h.title}|${JSON.stringify(partsOf(h))}`
    const g = groups.find((x) => `${x[0].title}|${JSON.stringify(partsOf(x[0]))}` === sig)
    if (g) g.push(h); else groups.push([h])
  }
  const sum = plain.reduce((t, h) => { for (const q of partsOf(h)) { if (q.pocket === 'coins') t.coins += q.n; else if (q.pocket === 'gems') t.gems += q.n; else t.items += q.n } return t }, { coins: 0, gems: 0, items: 0 })

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
        <ItemIcon id="loot-sack" size={24} />
        {held.length > 0 && <i className="tb-count">{held.length}</i>}
      </button>
      {open && (
        <Sheet title="Collect" onClose={() => setOpen(false)}>
          <div className="collect">
            <div className="collect-head">
              <h2 className="k-type">Collect</h2>
              {plain.length > 1 && <button type="button" className="k-btn main" onClick={() => claim(plain)}>Collect all {plain.length}</button>}
            </div>
            {plain.length > 1 && (
              <p className="collect-sum" aria-label={`In all: ${sum.coins} coins, ${sum.gems} gems, ${sum.items} things`}>
                {sum.coins > 0 && <span><Coin size={24} />{sum.coins.toLocaleString('en-IN')}</span>}
                {sum.gems > 0 && <span><Gem size={24} />{sum.gems.toLocaleString('en-IN')}</span>}
                {sum.items > 0 && <span><ItemIcon id="seal-bag" size={24} />{sum.items}</span>}
              </p>
            )}
            {held.length === 0 && <p className="muted">Nothing is waiting. Pay, quests, season steps, feats and boss prizes arrive here.</p>}
            <div className="collect-list">
              {held.filter((h) => h.choice).map((h) => (
                <div key={h.key} className="claim-choice">
                  <b>{h.title}</b>
                  <small>Choose one{daysLeft(h, today) <= 1 ? ` · left alone, ${h.choice![0].name} pays itself soon` : ''}</small>
                  <div className="claim-sides collect-slots">
                    {h.choice!.map((o, i) => (
                      <div key={i} className="collect-cell">
                        {/* each side of the choice is a slot too: its picture and its amount; the name under it */}
                        <Slot material="glass" icon={(() => { const p = partsOf(o)[0]; return !p ? <ItemIcon id="loot-sack" size={48} /> : p.pocket === 'coins' ? <ItemIcon id={p.n >= 250 ? 'loot-sack' : p.n >= 100 ? 'big-nugget' : 'coin'} size={48} /> : p.pocket === 'gems' ? <Gem size={48} /> : <ItemIcon id={p.item ?? ''} size={48} /> })()}
                          n={(() => { const p = partsOf(o)[0]; return p && (p.pocket !== 'bag' || p.n > 1) ? short(p.n) : null })()} onClick={(e) => choose(h, i as 0 | 1, e.currentTarget)} aria-label={`Choose ${o.name}`} tip={{ title: o.name }} />
                        <small>{o.name}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {/* everything plain as slots: identical rewards merge into one, and the picture grows with the amount (UI-AUDIT T14) */}
              {groups.length > 0 && (
                <div className="collect-slots">
                  {groups.map(([first, ...more]) => {
                    const all = [first, ...more]
                    const parts = partsOf(first)
                    const p = parts[0]
                    const total = p ? p.n * all.length : 0
                    const soon = all.some((h) => daysLeft(h, today) <= 1)
                    const what = parts.map((q) => (q.item ? `${q.n > 1 ? `${q.n} × ` : ''}${itemName(q.item)}` : `+${q.n} ${q.pocket}`)).join(' · ')
                    const icon = !p ? <ItemIcon id="loot-sack" size={48} /> : p.pocket === 'coins' ? <ItemIcon id={p.n >= 250 ? 'loot-sack' : p.n >= 100 ? 'big-nugget' : 'coin'} size={48} /> : p.pocket === 'gems' ? <Gem size={48} /> : <ItemIcon id={p.item ?? ''} size={48} />
                    return (
                      <div key={first.key} className={`collect-cell ${soon ? 'soon' : ''}`}>
                        <Slot material="glass" className="breathe" icon={icon} n={p?.pocket === 'bag' ? (total > 1 ? total : null) : short(total)} stamp={all.length > 1 ? `×${all.length}` : undefined}
                          ref={(el: HTMLElement | null) => { for (const h of all) { if (el) refs.current.set(h.key, el as HTMLButtonElement); else refs.current.delete(h.key) } }}
                          onClick={() => claim(all)} aria-label={`Collect ${first.title}${all.length > 1 ? `, ${all.length} of them` : ''}: ${what}${soon ? ', pays itself soon' : ''}`}
                          tip={{ title: first.title, note: <>{what}{soon ? ' · pays itself soon' : ''}</> }} />
                        <small>{first.title}</small>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}
