// What you do with what the work earned: the Mart and the five domain shops,
// throwing a ball, feeding a berry, holding an item, TMs, lures, the Smithy, the
// team, the Professor, quests. Every one is written to the ledger as one small
// event (store.useItem), so the game is still recomputed from the ledger alone.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { nameOf, spritePath, type Game, type Mon, type Quest } from '../core/fold.ts'
import {
  BALLS, CROPS, CROP_IDS, DOMAIN_SHOPS, FORGE_COST, HELD, ITEMS, LURES, MARKS, MARK_TAGS, ONCE, RARE_SHELF, SELL, TM_SLOTS, YIELD, cropId, forgeShard, itemName, seedId, throwHp, tmType,
  type MarkTag, type Offer, type ShopId,
} from '../core/economy.ts'
import { BALL_NAME, GEMS, HEART_LEVELS, TEAM_BONUS, bondLevel, levelOf } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { MonCard, TAG_NAME, Win, plural } from './App.tsx'
import { Ball, BallItem } from './Ball.tsx'
import { Coin, EggIcon, Gem, ItemIcon, MarkIcon } from './Item.tsx'
import { KBar, KButton, KClose, KReveal } from './Kit.tsx'
import { aBall, fmtDay, still } from './lib/art.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

export { Coin, EggIcon, Gem }
const Heart = ({ on }: { on: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M12 21s-8-5.200-8-11a4.600 4.600 0 0 1 8-3 4.600 4.600 0 0 1 8 3c0 5.800-8 11-8 11z" fill={on ? '#ff6b78' : '#39405f'} stroke="#141a33" strokeWidth="2" strokeLinejoin="round" /></svg>
)

const isBall = (id: string): boolean => id in BALLS
/** What a thrown ball would take off the wild Pokemon in front of you today. */
const hitOf = (game: Game, id: string): number => {
  const w = game.wild
  if (!w || w.caught) return 0
  const r = SPECIES[w.form]
  return Math.min(w.hp, throwHp(id, { types: [r.t, r.t2], from: w.from, owned: Boolean(game.dex[w.form]?.own) }, game.today.day))
}

/** A number that counts to its new value instead of jumping. */
export function Count({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current, t0 = performance.now()
    if (start === value || matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); from.current = value; return }
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 600)
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3)))
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    // a hidden tab draws no frames: land on the number anyway
    const land = setTimeout(() => { setShown(value); from.current = value }, 800)
    return () => { cancelAnimationFrame(raf); clearTimeout(land); from.current = value }
  }, [value])
  return <>{shown.toLocaleString('en-IN')}</>
}

export const Price = ({ coins, gems, marks, tag }: { coins?: number; gems?: number; marks?: number; tag?: MarkTag }) => (
  <span className="price">
    {coins ? <><Coin size={20} />{coins.toLocaleString('en-IN')}</> : gems ? <><Gem size={20} />{gems}</> : marks && tag ? <><MarkIcon tag={tag} size={20} />{marks}</> : null}
  </span>
)

// ── home: what you can do right now ─────────────────────────────────────────
/** Throw a ball at the wild Pokemon, or feed the partner. A thrown ball flies first, then lands. */
export function Actions({ game, onShop }: { game: Game; onShop: () => void }) {
  const [flying, setFlying] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const wild = game.wild && !game.wild.caught
  const throwIt = (item: string) => {
    if (flying) return
    setFlying(item)
    play('throw')
    // the outcome is read from the game as it is now; the ball is seen to fly, then the ledger is told and the HP falls
    const sound = hitOf(game, item) >= (game.wild?.hp ?? 1) ? 'catch' : 'hit'
    timer.current = setTimeout(() => { useItem(item, '', 'throw'); setFlying(null); play(sound) }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650)
  }
  const balls = Object.keys(BALLS).filter((b) => (game.inv[b] ?? 0) > 0).sort((a, b) => hitOf(game, b) - hitOf(game, a))
  const berries = ['oran-berry', 'sitrus-berry'].filter((b) => (game.inv[b] ?? 0) > 0)
  const hearts = (game.partner.together ?? 0) + (game.partner.fed ?? 0)
  return (
    <div className="actions">
      {flying && <span className="thrown" aria-hidden><BallItem id={flying} size={44} /></span>}
      {balls.map((b) => {
        const hp = hitOf(game, b)
        const double = BALLS[b].vs && hp > 0 && hp >= (BALLS[b].hp * 2)
        return (
          <button key={b} type="button" className="k-btn main act" disabled={!wild || Boolean(flying)} onClick={() => throwIt(b)} title={ITEMS[b]?.text}>
            <BallItem id={b} size={30} />
            <span>{itemName(b)}<small>Throw: {BALLS[b].hp >= 1_000_000 ? 'catches it' : `−${hp} HP${double ? ' ×2' : ''}`} · {game.inv[b]} left</small></span>
          </button>
        )
      })}
      {balls.length === 0 && (
        <button type="button" className="k-btn act" onClick={onShop}>
          <ItemIcon id="great-ball" size={30} />
          <span>Get balls<small>the Mart has three deals today</small></span>
        </button>
      )}
      {berries.length > 0
        ? berries.map((b) => (
          <button key={b} type="button" className="k-btn ok act" onClick={() => { useItem(b, '', 'feed'); play('feed') }} title={ITEMS[b]?.text}>
            <ItemIcon id={b} size={30} />
            <span>Feed<small>{game.inv[b]} left · {hearts} ♥</small></span>
          </button>
        ))
        : (
          <button type="button" className="k-btn ok act" disabled title="Berries are at the Mart and the Farm">
            <ItemIcon id="oran-berry" size={30} />
            <span>Feed<small>no berries · {hearts} ♥</small></span>
          </button>
        )}
      {game.lure && <span className="lurenote"><ItemIcon id={Object.keys(LURES).find((k) => LURES[k] === game.lure)!} size={22} />A lure burns: the next wild Pokemon is a {TAG_NAME[game.lure]} type</span>}
    </div>
  )
}

function QuestRow({ q }: { q: Quest }) {
  return (
    <li className={`quest ${q.done ? 'done' : ''}`}>
      <span className="q-name">{q.name}</span>
      <KBar value={q.have} max={q.need} ready={q.done} label={q.done ? 'Done' : `${q.have.toLocaleString('en-IN')} / ${q.need.toLocaleString('en-IN')}`} />
      <span className="q-pay">{q.coins > 0 && <Price coins={q.coins} />}{q.gems > 0 && <Price gems={q.gems} />}</span>
    </li>
  )
}
export function Quests({ game }: { game: Game }) {
  if (!game.quests.daily.length) return null
  const done = [...game.quests.daily, ...game.quests.weekly].filter((q) => q.done).length
  return (
    <Win title="Quests" tone="green" aside={`${done} / ${game.quests.daily.length + game.quests.weekly.length}`}>
      <div className="questcols">
        <div><span className="k-label">Today</span><ul className="quests">{game.quests.daily.map((q) => <QuestRow key={q.id} q={q} />)}</ul></div>
        <div><span className="k-label">This week</span><ul className="quests">{game.quests.weekly.map((q) => <QuestRow key={q.id} q={q} />)}</ul></div>
      </div>
    </Win>
  )
}

// ── shops ───────────────────────────────────────────────────────────────────
/** Can this be bought now, and with what is it paid. */
function canBuy(game: Game, o: Offer, shop: ShopId): boolean {
  const once = ITEMS[o.item]?.kind === 'tm' || ITEMS[o.item]?.kind === 'theme' || ONCE.has(o.item)
  const owned = once && (Boolean(game.inv[o.item]) || game.partner.held === o.item)
  if (owned) return false
  if (shop === 'mart' && game.mart.bought.includes(o.item)) return false
  const marks = MARK_TAGS.includes(shop as MarkTag) ? game.wallet.marks[shop as MarkTag] : 0
  return (o.coins ?? 0) <= game.wallet.coins && (o.gems ?? 0) <= game.wallet.gems && (o.marks ?? 0) <= marks
}

/** A shelf of goods. `shop` is told to the game so a price is taken from the right purse. */
function Shelf({ game, offers, shop }: { game: Game; offers: Offer[]; shop: ShopId }) {
  const [bump, setBump] = useState<string | null>(null)
  const buy = (item: string) => { useItem(item, '', 'buy', shop); play('buy'); setBump(item); setTimeout(() => setBump(null), 350) }
  const tag = MARK_TAGS.includes(shop as MarkTag) ? (shop as MarkTag) : undefined
  return (
    <div className="shelf">
      {offers.map((o) => {
        const have = game.inv[o.item] ?? 0
        const def = ITEMS[o.item]
        const once = def?.kind === 'tm' || def?.kind === 'theme'
        const sold = shop === 'mart' && game.mart.bought.includes(o.item)
        const worn = game.theme === o.item
        return (
          <div key={o.item} className={`good ${bump === o.item ? 'bump' : ''} ${sold ? 'sold' : ''}`}>
            {have > 0 && !once && <span className="held">×{have}</span>}
            <ItemIcon id={o.item} size={56} />
            <b>{itemName(o.item)}</b>
            <small>{def?.text}</small>
            {once && have > 0
              ? def.kind === 'theme'
                ? <KButton tone={worn ? 'neutral' : 'main'} onClick={() => useItem('', '', 'theme', worn ? undefined : o.item)}>{worn ? 'Take off' : 'Use'}</KButton>
                : <span className="owned">Owned</span>
              : sold
                ? <span className="owned">Sold today</span>
                : <button type="button" className="k-btn ok" disabled={!canBuy(game, o, shop)} onClick={() => buy(o.item)}><Price coins={o.coins} gems={o.gems} marks={o.marks} tag={tag} /></button>}
          </div>
        )
      })}
    </div>
  )
}

// ── the Farm ────────────────────────────────────────────────────────────────
/** Which of the crop's pictures a plot shows: young, growing, nearly there, ripe. */
const stageOf = (p: { grown: number; days: number; ripe: boolean }): number => (p.ripe ? 4 : p.grown / p.days < 1 / 3 ? 1 : p.grown / p.days < 2 / 3 ? 2 : 3)

/** Arbor's plots: plant a seed, a full Arbor morning waters, harvest when ripe, then sell or feed. */
export function FarmWin({ game }: { game: Game }) {
  const [picking, setPicking] = useState<number | null>(null)
  const seeds = CROP_IDS.filter((c) => (game.inv[seedId(c)] ?? 0) > 0)
  const crops = CROP_IDS.filter((c) => (game.inv[cropId(c)] ?? 0) > 0)
  const planted = game.plots.filter(Boolean).length
  return (
    <Win title="The plots" tone="green" aside={`${planted} / ${game.plots.length} planted`}>
      <div className="plots">
        {game.plots.map((p, i) => p
          ? (
            <div key={i} className={`plot ${p.ripe ? 'ripe' : ''}`}>
              <img src={`/world/${p.crop}_0${stageOf(p)}.png`} alt={CROPS[p.crop].name} width={64} height={64} className="pix cropimg" />
              <b>{CROPS[p.crop].name}</b>
              {p.ripe
                ? <button type="button" className="k-btn main" onClick={() => { useItem('', '', 'harvest', String(i)); play('catch') }}>Harvest</button>
                : <small>{p.grown} / {p.days} mornings</small>}
            </div>
          )
          : (
            <button key={i} type="button" className={`plot empty ${picking === i ? 'on' : ''}`} onClick={() => setPicking(picking === i ? null : i)} aria-expanded={picking === i}>
              <span>+</span><small>Plant</small>
            </button>
          ))}
      </div>
      {picking !== null && (
        seeds.length > 0
          ? (
            <div className="seedpick">
              {seeds.map((c) => (
                <button key={c} type="button" className="k-btn main" onClick={() => { useItem(seedId(c), '', 'plant', String(picking)); play('tap'); setPicking(null) }}>
                  <ItemIcon id={seedId(c)} size={26} />{CROPS[c].name} <small>×{game.inv[seedId(c)]} · {CROPS[c].days} mornings</small>
                </button>
              ))}
            </div>
          )
          : <p className="muted">No seeds. Buy some below with Seeds, one for each crop.</p>
      )}
      {crops.length > 0 && (
        <>
          <span className="k-label">Harvested</span>
          <div className="baggrid">
            {crops.map((c) => {
              const n = game.inv[cropId(c)]
              return (
                <div key={c} className="bagtile">
                  <ItemIcon id={cropId(c)} size={40} />
                  <b>{CROPS[c].name} ×{n}</b>
                  <button type="button" className="k-btn ok" onClick={() => { useItem(cropId(c), '', 'sell', 'all'); play('buy') }}>Sell <Price coins={n * CROPS[c].sell} /></button>
                  <button type="button" className="k-btn" onClick={() => { useItem(cropId(c), '', 'feed'); play('feed') }}>Feed +{CROPS[c].hearts} ♥</button>
                </div>
              )
            })}
          </div>
        </>
      )}
      <p className="muted">A full Arbor morning waters every crop one day. A day without it adds nothing and takes nothing: nothing wilts. A ripe plot gives {YIELD}.</p>
    </Win>
  )
}

/** One domain's shop: what its marks buy. */
export function DomainShop({ game, tag }: { game: Game; tag: MarkTag }) {
  const shop = DOMAIN_SHOPS[tag]
  const goods = shop.stock.filter((o) => ITEMS[o.item]?.kind !== 'tm' && ITEMS[o.item]?.kind !== 'seed')
  const seedStock = shop.stock.filter((o) => ITEMS[o.item]?.kind === 'seed')
  const tms = shop.stock.filter((o) => ITEMS[o.item]?.kind === 'tm')
  const [bump, setBump] = useState<string | null>(null)
  return (
    <>
    {tag === 'arbor' && game.version >= 6 && <FarmWin game={game} />}
    <Win title={shop.name} tone={tag === 'sleep' ? 'dark' : tag === 'code' ? 'blue' : tag === 'fitness' ? 'red' : tag === 'guitar' ? 'purple' : 'green'} aside={<><MarkIcon tag={tag} size={22} /> {game.wallet.marks[tag]} {MARKS[tag].name}</>}>
      <p className="muted">{TAG_NAME[tag]} days pay {MARKS[tag].name}. Nothing here can be bought with coins.{tag === 'sleep' && !game.sleep.band ? ' Bells come only from nights your band measures, so this house stays quiet until the first one.' : ''}</p>
      <Shelf game={game} offers={goods} shop={tag} />
      {seedStock.length > 0 && (
        <>
          <span className="k-label" style={{ marginTop: 14, display: 'block' }}>Seeds: plant them in the plots above</span>
          <div className="tmgrid">
            {seedStock.map((o) => (
              <button key={o.item} type="button" className={`tm ${bump === o.item ? 'bump' : ''}`} disabled={!canBuy(game, o, tag)} onClick={() => { useItem(o.item, '', 'buy', tag); play('buy'); setBump(o.item); setTimeout(() => setBump(null), 350) }} title={ITEMS[o.item].text}>
                <ItemIcon id={o.item} size={36} />
                <small>{CROPS[o.item.slice(5)]?.name}</small>
                <Price marks={o.marks} tag={tag} />
                {(game.inv[o.item] ?? 0) > 0 && <i>×{game.inv[o.item]}</i>}
              </button>
            ))}
          </div>
        </>
      )}
      {tms.length > 0 && (
        <>
          <span className="k-label" style={{ marginTop: 14, display: 'block' }}>TMs: each is yours for good, and you can carry {TM_SLOTS}</span>
          <div className="tmgrid">
            {tms.map((o) => {
              const own = Boolean(game.inv[o.item])
              return (
                <button key={o.item} type="button" className={`tm ${own ? 'own' : ''} ${bump === o.item ? 'bump' : ''}`} disabled={own || !canBuy(game, o, tag)} onClick={() => { useItem(o.item, '', 'buy', tag); play('buy'); setBump(o.item); setTimeout(() => setBump(null), 350) }} title={ITEMS[o.item].text}>
                  <ItemIcon id={o.item} size={36} />
                  <small>{tmType(o.item)}</small>
                  {own ? <i>Owned</i> : <Price marks={o.marks} tag={tag} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </Win>
    </>
  )
}

export function ShopTab({ game, only }: { game: Game; only?: ShopId }) {
  // a chest opens the moment it is bought: show what was in the newest one, once
  const opened = game.moments.flatMap((m) => (m.kind === 'chest' ? [m] : []))
  const told = useRef(opened.length)
  const [loot, setLoot] = useState<(typeof opened)[number] | null>(null)
  useEffect(() => {
    if (opened.length > told.current) { setLoot(opened[opened.length - 1]); play('catch') }
    told.current = opened.length
  }, [opened.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (game.version < 6) return <Win title="Shop" tone="gold"><p className="muted">The shops open with rules version 6.</p></Win>
  const show = (s: ShopId) => !only || only === s
  return (
    <>
      {show('mart') && (
        <Win title="The Mart" tone="gold" aside={<><Coin size={22} /> <Count value={game.wallet.coins} /></>}>
          <p className="muted">Three deals a day, one of each. Coins come from quests, the season, chests and the Professor.</p>
          <Shelf game={game} offers={game.mart.deals} shop="mart" />
        </Win>
      )}
      {show('rare') && (
        <Win title="Rare things" tone="blue" aside={<><Gem size={22} /> <Count value={game.wallet.gems} /></>}>
          <Shelf game={game} offers={RARE_SHELF} shop="rare" />
          {game.egg && <div className="eggrow"><span className="warm"><EggIcon size={44} /></span><div style={{ flex: 1 }}><span className="k-label">An egg is being kept warm</span><KBar value={game.egg.have} max={game.egg.need} kind="gold" label={`${game.egg.have} / ${game.egg.need} days with two pillars`} /></div></div>}
        </Win>
      )}
      {show('rare') && (game.inv['full-incense'] ?? 0) > 0 && (
        <Win title="Full Incense" tone="green" aside={game.wish.chosen ? 'Chosen' : 'Pick one'}>
          <div className="queue pick">
            {game.wish.options.map((f, i) => (
              <button key={`${f}${i}`} type="button" aria-pressed={game.wish.chosen === f} className={game.wish.chosen === f ? 'on' : ''} disabled={Boolean(game.wish.chosen)} onClick={() => useItem('full-incense', '', 'wish', f)} title={nameOf(f)}>
                <img src={still(f)} alt={nameOf(f)} width={72} height={72} className={`sprite ${game.dex[f] ? '' : 'unseen'}`} />
              </button>
            ))}
          </div>
          <p className="muted">{game.wish.chosen ? `${nameOf(game.wish.chosen)} is the next wild Pokemon.` : 'The one you tap appears next.'}</p>
        </Win>
      )}
      {MARK_TAGS.filter((t) => show(t)).map((t) => <DomainShop key={t} game={game} tag={t} />)}
      {loot && createPortal(
        <div className="recap" role="dialog" aria-modal="true" aria-label="What was in the chest" onClick={() => setLoot(null)}>
          <div className="rc-win"><div className="rc-body">
            <div className="rc-eyebrow">Chest {loot.n}</div>
            <KReveal tier={loot.item === 'full-incense' ? 'rare' : loot.item === 'ultra-ball' ? 'big' : 'ordinary'} title={loot.coins ? `${loot.coins} coins` : `${itemName(loot.item)}${loot.count > 1 ? ` ×${loot.count}` : ''}`} replay={loot.n}>
              {loot.coins ? <Coin size={96} /> : <ItemIcon id={loot.item} size={96} />}
            </KReveal>
            <button type="button" className="go" autoFocus>Continue</button>
          </div></div>
        </div>,
        document.body,
      )}
      {!only && (
        <Win title="How you earn" tone="dark">
          <ul className="earn">
            <li><Coin size={22} /> daily and weekly quests, the season, chests, and selling a Box Pokemon to the Professor</li>
            <li><Gem size={22} /> feats, a catch, an evolution, a badge, weekly quests</li>
            <li>{MARK_TAGS.map((t) => <MarkIcon key={t} tag={t} size={22} />)} one a day for each kind of work done: coding, gym, guitar, Arbor, sleep</li>
            <li><ItemIcon id="red-shard" size={22} /><ItemIcon id="blue-shard" size={22} /><ItemIcon id="yellow-shard" size={22} /><ItemIcon id="green-shard" size={22} /> shards come from feats: streaks and lifetime totals</li>
          </ul>
        </Win>
      )}
    </>
  )
}

// ── the bag: what is held, carried and burning ──────────────────────────────
export function Bag({ game }: { game: Game }) {
  if (game.version < 6) return null
  const have = (id: string) => game.inv[id] ?? 0
  const held = Object.keys(HELD).filter((id) => have(id) > 0 || game.partner.held === id)
  const tms = Object.keys(ITEMS).filter((id) => ITEMS[id].kind === 'tm' && have(id) > 0)
  const lures = Object.keys(LURES).filter((id) => have(id) > 0)
  const equipped = game.partner.moves ?? []
  const toggleTm = (id: string) => {
    const next = equipped.includes(id) ? equipped.filter((x) => x !== id) : [...equipped, id].slice(-TM_SLOTS)
    useItem('', '', 'move', next.join(','))
    play('tap')
  }
  const rest = Object.keys(game.inv).filter((id) => have(id) > 0 && ['shard', 'key', 'unique'].includes(ITEMS[id]?.kind) && !HELD[id])
  const stuff = Object.keys(game.inv).filter((id) => have(id) > 0 && ['ball', 'berry'].includes(ITEMS[id]?.kind))
  const empty = !held.length && !tms.length && !lures.length && !rest.length && !stuff.length
  return (
    <Win title="Bag" tone="purple" aside={game.keyStone ? <><ItemIcon id="key-stone" size={22} /> Key Stone</> : undefined}>
      {empty && <p className="muted">Nothing yet. The Mart opens each morning, and feats hand out the rest.</p>}
      {stuff.length > 0 && (
        <div className="baggrid">
          {stuff.map((id) => <div key={id} className="bagtile" title={ITEMS[id].text}><ItemIcon id={id} size={40} /><b>{itemName(id)}</b><small>×{have(id)} · {isBall(id) ? 'thrown from Home' : 'fed from Home'}</small></div>)}
        </div>
      )}
      {held.length > 0 && (
        <>
          <span className="k-label">Held by {nameOf(game.partner.form)}: one at a time</span>
          <div className="baggrid">
            {held.map((id) => {
              const on = game.partner.held === id
              return (
                <div key={id} className={`bagtile ${on ? 'on' : ''}`} title={ITEMS[id].text}>
                  <ItemIcon id={id} size={40} />
                  <b>{itemName(id)}</b>
                  <small>{HELD[id].tag ? `${TAG_NAME[HELD[id].tag!]} ×${HELD[id].mult}` : `everything ×${HELD[id].mult}`}</small>
                  <button type="button" className={`k-btn ${on ? '' : 'main'}`} onClick={() => { useItem(on ? '' : id, '', 'hold', on ? '' : id); play('tap') }}>{on ? 'Take off' : 'Hold'}</button>
                </div>
              )
            })}
          </div>
        </>
      )}
      {tms.length > 0 && (
        <>
          <span className="k-label">TMs on {nameOf(game.partner.form)}: {equipped.length} of {TM_SLOTS}. Each counts as one of its types against a leader</span>
          <div className="tmgrid">
            {tms.map((id) => (
              <button key={id} type="button" className={`tm ${equipped.includes(id) ? 'on' : ''}`} aria-pressed={equipped.includes(id)} onClick={() => toggleTm(id)}>
                <ItemIcon id={id} size={36} /><small>{tmType(id)}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {lures.length > 0 && (
        <>
          <span className="k-label">Lures: burn one and the next wild Pokemon is of its kind{game.lure ? ' (one is burning)' : ''}</span>
          <div className="baggrid">
            {lures.map((id) => (
              <div key={id} className="bagtile" title={ITEMS[id].text}>
                <ItemIcon id={id} size={40} /><b>{itemName(id)}</b><small>×{have(id)} · {TAG_NAME[LURES[id]]} types</small>
                <button type="button" className="k-btn main" disabled={Boolean(game.lure)} onClick={() => { useItem(id, '', 'lure'); play('tap') }}>Burn</button>
              </div>
            ))}
          </div>
        </>
      )}
      {rest.length > 0 && (
        <>
          <span className="k-label">Kept</span>
          <div className="baggrid">
            {rest.map((id) => <div key={id} className="bagtile" title={ITEMS[id].text}><ItemIcon id={id} size={40} /><b>{itemName(id)}</b><small>{ITEMS[id].kind === 'shard' ? `×${have(id)} · ${FORGE_COST} forge a Mega Stone` : ITEMS[id].text}</small></div>)}
          </div>
        </>
      )}
    </Win>
  )
}

// ── one Pokemon's own page ──────────────────────────────────────────────────
/** Everything about one of yours, and what can be done with it from where it stands. */
export function MonPage({ m, game, onClose }: { m: Mon; game: Game; onClose: () => void }) {
  const rec = SPECIES[m.form]
  const inBox = game.queue.some((x) => x.uid === m.uid)
  const trained = Boolean(m.graduated)
  const isPartner = game.partner.uid === m.uid
  const inTeam = game.team.some((x) => x.uid === m.uid)
  const hearts = (m.together ?? 0) + (m.fed ?? 0)
  const v5 = game.version >= 5
  const v6 = game.version >= 6
  const cap = 3 + (game.inv['exp-share'] ? 1 : 0)
  const setTeam = () => {
    const ids = inTeam ? game.team.filter((x) => x.uid !== m.uid).map((x) => x.uid) : [...game.team.map((x) => x.uid), m.uid].slice(-cap)
    useItem('', '', 'team', ids.join(','))
  }
  const act = (what: string) => { useItem('', m.uid, what); play('tap'); onClose() }
  const megas = rec.m ?? []
  const sell = SELL[rec.r ?? 'C'] ?? SELL.C
  // drawn on the page itself, not inside the tab: the tab slides in and would carry the window off with it
  return createPortal(
    <div className="recap" role="dialog" aria-modal="true" aria-label={nameOf(m.form)} onClick={onClose}>
      <div className="monpage" onClick={(e) => e.stopPropagation()}>
        <KClose onClick={onClose} />
        <div className={`mp-art ${m.megas?.length ? 'mega' : ''}`}><img src={spritePath(m.megas?.length && m.show !== 'base' ? (m.show && m.megas.includes(m.show) ? m.show : m.megas[0]) : m.form, m.shiny)} alt="" className="sprite" /></div>
        <div className="mp-body">
          <h2 className="k-type">{nameOf(m.form)}{m.shiny && <span className="chip">shiny</span>}</h2>
          <div className="mp-types">
            {[rec.t, rec.t2].filter(Boolean).map((t) => <span key={t} className="chip type"><img src={`/sprites/types/${t}.png`} alt="" width={14} height={14} onError={(e) => { e.currentTarget.style.display = 'none' }} />{t}</span>)}
            {(m.moves ?? []).map((id) => <span key={id} className="chip type tmchip"><ItemIcon id={id} size={16} />{tmType(id)}</span>)}
            <span className="chip where">{isPartner ? 'Your partner' : trained ? (inTeam ? 'On the team' : 'Fully trained') : 'In the Box'}</span>
          </div>
          <div className="mp-tiles">
            <div className="k-tile"><span className="k-label">Level</span><b>{levelOf(m.xp)}</b></div>
            <div className="k-tile"><span className="k-label">Hearts</span><b>{hearts} ♥</b></div>
            {m.nature && <div className="k-tile"><span className="k-label">Nature</span><b>{m.nature.name}</b></div>}
            <div className="k-tile"><span className="k-label">{m.origin === 'egg' ? 'Hatched' : m.origin === 'starter' ? 'Starter' : 'Caught'}</span><b>{fmtDay(m.from)}</b></div>
            {m.held && <div className="k-tile"><span className="k-label">Holding</span><b className="holdline"><ItemIcon id={m.held} size={22} />{itemName(m.held)}</b></div>}
          </div>
          {m.nature?.up && m.nature.down && <p className="muted">Raised most on {TAG_NAME[m.nature.up]}, least on {TAG_NAME[m.nature.down]}.</p>}
          {m.ball && <p className="muted ballname">{m.thrown ? <BallItem id={m.thrown} size={20} /> : <Ball ball={m.ball} size={18} />}Caught in {m.thrown ? `a ${itemName(m.thrown)}` : aBall(m.ball)}.</p>}
          <div className="mp-line">
            {m.path.map((f, i) => <span key={f} className="path-step">{i > 0 && <span className="arrow">▸</span>}<img src={still(f, m.shiny)} alt={nameOf(f)} title={nameOf(f)} width={48} height={48} className="sprite" /></span>)}
            {(rec.e ?? []).length > 0 && <span className="path-step"><span className="arrow">▸</span>{rec.e!.slice(0, 3).map((f) => <img key={f} src={still(f)} alt="" width={48} height={48} className={`sprite ${game.dex[f] ? '' : 'unseen'}`} />)}</span>}
            {(m.megas ?? []).map((f) => <span key={f} className="path-step"><span className="arrow">★</span><img src={still(f, m.shiny)} alt={nameOf(f)} title={`${nameOf(f)}, for good`} width={48} height={48} className="sprite" /></span>)}
          </div>
          {v6 && megas.length > 0 && (
            <div className="forge">
              <span className="k-label">Mega Stones</span>
              {megas.map((f, i) => {
                const done = m.megas?.includes(f)
                const shard = forgeShard(megas.length, i, m.nature?.up, game.inv)
                return (
                  <div key={f} className="forgeline">
                    <ItemIcon id="key-stone" size={30} className={done ? '' : 'unheld'} />
                    <span><b>{nameOf(f)}</b><small>{done ? 'Forged: this Pokemon keeps it for good' : !game.keyStone ? 'Needs the Key Stone (a week of running on any one kind of work)' : shard ? `${FORGE_COST} ${itemName(shard)}` : `needs ${FORGE_COST} ${megas.length > 1 ? (i === 0 ? 'Red' : 'Blue or Yellow') : 'matching'} Shards`}</small></span>
                    {!done && <button type="button" className="k-btn main" disabled={!game.keyStone || !shard} onClick={() => { useItem('', m.uid, 'forge', f); play('catch') }}>Forge</button>}
                  </div>
                )
              })}
            </div>
          )}
          <div className="kit-row">
            {inBox && <KButton tone="main" disabled={m.uid === game.nextUp} onClick={() => act('next')}>{m.uid === game.nextUp ? 'Next up' : 'Make next'}</KButton>}
            {inBox && game.version >= 4 && <KButton onClick={() => act('lead')}>Partner now</KButton>}
            {inBox && v5 && <button type="button" className="k-btn ok" onClick={() => act('transfer')}>To the Professor {v6 ? <Price coins={sell} /> : <Price gems={GEMS.transfer} />}</button>}
            {trained && v5 && <KButton tone={inTeam ? 'neutral' : 'main'} onClick={() => { setTeam(); play('tap') }}>{inTeam ? 'Take off the team' : 'Put on the team'}</KButton>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── team ────────────────────────────────────────────────────────────────────
/** The partner's hearts, the team behind it, the bag, and the Box with what can be done to each one in it. */
export function TeamTab({ game, partnerCard, choices }: { game: Game; partnerCard: ReactNode; choices: ReactNode }) {
  const [page, setPage] = useState<string | null>(null)
  const hearts = (game.partner.together ?? 0) + (game.partner.fed ?? 0)
  const level = bondLevel(hearts)
  const nextAt = HEART_LEVELS[level]
  const inTeam = new Set(game.team.map((m) => m.uid))
  const shown = [game.partner, ...game.queue, ...game.graduates].find((m) => m.uid === page)
  const v5 = game.version >= 5
  const cap = 3 + (game.inv['exp-share'] ? 1 : 0)
  const berry = ['oran-berry', 'sitrus-berry'].find((b) => (game.inv[b] ?? 0) > 0)
  return (
    <>
      <div className="tappable" onClick={() => setPage(game.partner.uid)} title="Open its page">{partnerCard}</div>
      <Win title="Bond" tone="green" aside={`${hearts} ♥`}>
        <div className="hearts">
          <span className="heartrow" aria-label={`Bond level ${level} of ${HEART_LEVELS.length}`}>{HEART_LEVELS.map((_, i) => <Heart key={i} on={i < level} />)}</span>
          <div style={{ flex: 1, minWidth: 140 }}><KBar value={nextAt ? hearts : 1} max={nextAt ?? 1} kind="gold" label={nextAt ? `${hearts} / ${nextAt}` : 'Full'} /></div>
          {v5 && <button type="button" className="k-btn ok" disabled={!berry} onClick={() => { useItem(berry!, '', 'feed'); play('feed') }}><ItemIcon id={berry ?? 'oran-berry'} size={26} />Feed{berry ? ` ×${game.inv[berry]}` : ''}</button>}
        </div>
      </Win>
      {v5 && (
        <Win title="Team" tone="gold" aside={game.teamEdge ? `+${Math.round(game.teamEdge * TEAM_BONUS * 100)}% on this leader` : `${game.team.length} / ${cap}`}>
          <div className="teamrow">
            {Array.from({ length: cap }, (_, i) => {
              const m = game.team[i]
              return m
                ? <button key={m.uid} type="button" className="slot" onClick={() => setPage(m.uid)} title={nameOf(m.form)}><MonCard m={m} size={64} /></button>
                : <span key={i} className="slot empty" aria-label="Empty team place"><img src="/sprites/ui/party-empty.png" alt="" width={32} height={32} className="pix" /></span>
            })}
          </div>
          {game.graduates.length > 0
            ? (
              <div className="queue pick" style={{ marginTop: 12 }}>
                {game.graduates.map((m) => (
                  <button key={m.uid} type="button" aria-pressed={inTeam.has(m.uid)} className={inTeam.has(m.uid) ? 'on' : ''} onClick={() => setPage(m.uid)} title={`${nameOf(m.form)} · ${SPECIES[m.form].t}${SPECIES[m.form].t2 ? ` / ${SPECIES[m.form].t2}` : ''}${m.nature ? ` · ${m.nature.name}` : ''}`}>
                    <MonCard m={m} size={56} />
                  </button>
                ))}
              </div>
            )
            : <p className="muted">Fully trained Pokemon stand here. Each one whose type beats the leader's adds {Math.round(TEAM_BONUS * 100)}% to every strike.</p>}
        </Win>
      )}
      <Bag game={game} />
      <Win title="Box" tone="dark" aside={plural(game.queue.length, 'Pokemon', 'Pokemon')}>
        {game.queue.length === 0 ? <p className="muted">Empty. Catch the wild Pokemon and it comes here.</p> : (
          <>
            <div className="queue pick">
              {game.queue.map((m) => (
                <button key={m.uid} type="button" onClick={() => setPage(m.uid)} title={`${nameOf(m.form)}${m.ball ? ` · ${m.thrown ? itemName(m.thrown) : BALL_NAME[m.ball]}` : ''}`}>
                  <MonCard m={m} size={64} />
                  {m.uid === game.nextUp && <span className="nexttag">Next</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </Win>
      {choices}
      {shown && <MonPage m={shown} game={game} onClose={() => setPage(null)} />}
    </>
  )
}

/** A number that pops up and floats away: what today did to something. */
export function Pop({ value, className = '', style }: { value: number; className?: string; style?: CSSProperties }) {
  if (value <= 0) return null
  return <span key={value} className={`pop ${className}`} style={style} aria-hidden>−{value}</span>
}
