// Rewards waiting to be collected: a chip per reward from today and yesterday
// (quests, the season, chests, feats, the Professor, a month reviewed, daily pay).
//
// Tapping a chip sends its coins, gems and items flying into the pill or tab
// they are kept in. The game has already counted them (they were earned the
// moment the day settled), so this is only the handing over: not claiming
// changes nothing, and what has been claimed is remembered on this device alone.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { itemName } from '../core/economy.ts'
import type { Game, Moment } from '../core/fold.ts'
import { Coin, Gem, ItemIcon } from './Item.tsx'
import { flyReward, type Pocket } from './lib/fly.ts'
import { play } from './lib/sfx.ts'

const KEY = 'pokedex.claimed.v1'

interface Part { pocket: Pocket; n: number; item?: string }
interface Chip { key: string; day: string; title: string; parts: Part[] }

const parts = (coins = 0, gems = 0, items: [string, number][] = []): Part[] => [
  ...(coins > 0 ? [{ pocket: 'coins' as const, n: coins }] : []),
  ...(gems > 0 ? [{ pocket: 'gems' as const, n: gems }] : []),
  ...items.filter(([id, n]) => id && n > 0).map(([item, n]) => ({ pocket: 'bag' as const, n, item })),
]

function chipOf(m: Moment): Chip | null {
  const base = { day: m.day, key: `${m.day}|${m.kind}|${'n' in m ? m.n : ''}|${'id' in m ? m.id : ''}|${'step' in m ? m.step : ''}|${'item' in m ? m.item : ''}` }
  switch (m.kind) {
    case 'quest': return { ...base, title: m.name, parts: parts(m.coins, m.gems) }
    case 'season': return { ...base, title: `Season step ${m.step}`, parts: parts(m.coins, m.gems, [[m.item, 1]]) }
    case 'chest': return { ...base, title: `Chest ${m.n}`, parts: parts(m.coins, 0, [[m.item, m.count]]) }
    case 'feat': return { ...base, title: m.name, parts: parts(m.coins, m.gems, m.items.map((id): [string, number] => [id, 1])) }
    case 'transfer': return { ...base, title: 'To the Professor', parts: parts(m.coins) }
    case 'review': return { ...base, title: 'Month reviewed', parts: parts(0, 0, [['comet-shard', 1]]) }
    case 'gear': return { ...base, title: 'Strong gear', parts: parts(0, 0, [[m.item, 1]]) }
    default: return null
  }
}

function load(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

export function Claims({ game, today }: { game: Game; today: string }) {
  const [claimed, setClaimed] = useState<Set<string>>(() => load() ?? new Set())
  const first = useRef(load() === null)
  const refs = useRef(new Map<string, HTMLButtonElement>())

  const chips = useMemo(() => {
    const y = new Date(today + 'T12:00:00')
    y.setDate(y.getDate() - 1)
    const floor = y.toISOString().slice(0, 10)
    const out: Chip[] = []
    for (const d of game.days) {
      if (d.day >= floor && d.pay > 0) out.push({ key: `pay|${d.day}`, day: d.day, title: 'Showing up', parts: parts(d.pay) })
    }
    for (const m of game.moments) {
      if (m.day < floor) continue
      const c = chipOf(m)
      if (c && c.parts.length) out.push(c)
    }
    return out.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
  }, [game, today])

  // history is not news: the first run on a device claims what is already there
  useEffect(() => {
    if (!first.current || !chips.length) return
    first.current = false
    const all = new Set(chips.map((c) => c.key))
    setClaimed(all)
    try { localStorage.setItem(KEY, JSON.stringify([...all])) } catch { /* no storage: it shows again */ }
  }, [chips])

  const save = useCallback((next: Set<string>) => {
    setClaimed(next)
    try { localStorage.setItem(KEY, JSON.stringify([...next])) } catch { /* the chips come back next visit, harmlessly */ }
  }, [])

  const claim = useCallback((list: Chip[]) => {
    list.forEach((c, i) => {
      const el = refs.current.get(c.key)
      if (el) c.parts.forEach((p, j) => flyReward(el, p.item ? `+${p.n} ${itemName(p.item)}` : `+${p.n}`, p.pocket, (i * c.parts.length + j) * 90))
    })
    play('catch')
    save(new Set([...claimed, ...list.map((c) => c.key)]))
  }, [claimed, save])

  const open = chips.filter((c) => !claimed.has(c.key))
  if (first.current || !open.length) return null
  return (
    <section className="claims" aria-label="Rewards to collect">
      <div className="claims-head">
        <b>Collect</b>
        {open.length > 1 && <button type="button" className="k-btn" onClick={() => claim(open)}>Collect all {open.length}</button>}
      </div>
      <div className="claims-row">
        {open.map((c) => (
          <button key={c.key} type="button" className="claim-chip" ref={(el) => { if (el) refs.current.set(c.key, el); else refs.current.delete(c.key) }} onClick={() => claim([c])}>
            <span className="claim-ico">
              {c.parts.map((p, i) => (p.pocket === 'coins' ? <Coin key={i} size={26} /> : p.pocket === 'gems' ? <Gem key={i} size={26} /> : <ItemIcon key={i} id={p.item ?? ''} size={26} />))}
            </span>
            <span className="claim-txt">
              <b>{c.title}</b>
              <small>{c.parts.map((p) => (p.item ? `${p.n > 1 ? `${p.n} × ` : ''}${itemName(p.item)}` : `+${p.n} ${p.pocket}`)).join(' · ')}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
