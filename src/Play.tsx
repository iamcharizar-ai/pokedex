// What you do with what the work earned: the Mart and the five domain shops,
// throwing a ball, feeding a berry, holding an item, TMs, lures, the Smithy, the
// team, the Professor, quests. Every one is written to the ledger as one small
// event (store.useItem), so the game is still recomputed from the ledger alone.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { nameOf, spritePath, type Game, type Mon, type Quest } from '../core/fold.ts'
import {
  BALLS, DOMAIN_SHOPS, GEAR_ITEMS, HELD, ITEMS, LURES, MARKS, MARK_TAGS, MASTERY_MAX, MASTERY_STEP, ONCE, masteryCost, RARE_SHELF, SELL, TM_SLOTS, itemName, throwHp, tmType,
  type MarkTag, type Offer, type ShopId,
} from '../core/economy.ts'
import { KIT_SHARD_EVERY } from '../core/rules.ts'
import { BALL_NAME, DAILY_PAY, REPEL_DAYS, TEAM_BONUS, TEAM_NATURE, TEAM_OPEN_FROM, TEAM_SIZE, levelOf } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { TAG_NAME, Win, plural } from './App.tsx'
import { Ball, BallItem } from './Ball.tsx'
import { Forge } from './screens/Forge.tsx'
import { Sheet } from './screens/Sheet.tsx'
import { Nursery } from './screens/Nursery.tsx'
import { Coin, EggIcon, Gem, ItemIcon, MarkIcon } from './Item.tsx'
import { KBar, KButton } from './Kit.tsx'
import { aBall, fmtDay, still } from './lib/art.ts'
import { buyPop } from './lib/fx.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

export { Coin, EggIcon, Gem }

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
/** A copy of the ball leaves its socket and arcs onto the wild Pokemon in the scene, wherever the two are on the page. */
function flyBall(img: Element | null | undefined, ms: number): void {
  const to = document.querySelector('.foe-pad img.sprite')
  if (!img || !to || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const a = img.getBoundingClientRect(), b = to.getBoundingClientRect()
  const el = img.cloneNode() as HTMLImageElement
  el.className = 'flyball'
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = `left:${a.left + a.width / 2 - 22}px;top:${a.top + a.height / 2 - 22}px`
  document.body.appendChild(el)
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const peak = Math.min(dy, 0) - 140
  el.animate([
    { transform: 'translate(0, 0) rotate(0deg) scale(0.8)' },
    { transform: `translate(${dx * 0.45}px, ${peak}px) rotate(540deg) scale(1.15)`, offset: 0.55, easing: 'cubic-bezier(0.3, 0, 0.7, 1)' },
    { transform: `translate(${dx}px, ${dy}px) rotate(900deg) scale(0.7)`, opacity: 0.9 },
  ], { duration: ms, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' }).finished.finally(() => el.remove())
}

/** Throw a ball at the wild Pokemon, or feed the partner. A thrown ball flies first, then lands. */
export function Actions({ game, onShop }: { game: Game; onShop: () => void }) {
  const [flying, setFlying] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const wild = game.wild && !game.wild.caught
  const throwIt = (item: string, from?: Element) => {
    if (flying) return
    setFlying(item)
    flyBall(from?.querySelector('img'), 650)
    play('throw')
    // the outcome is read from the game as it is now; the ball is seen to fly, then the ledger is told and the HP falls
    const sound = hitOf(game, item) >= (game.wild?.hp ?? 1) ? 'catch' : 'hit'
    timer.current = setTimeout(() => { useItem(item, '', 'throw'); setFlying(null); play(sound) }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650)
  }
  const balls = Object.keys(BALLS).filter((b) => (game.inv[b] ?? 0) > 0).sort((a, b) => hitOf(game, b) - hitOf(game, a))
  const berries = ['oran-berry', 'sitrus-berry'].filter((b) => (game.inv[b] ?? 0) > 0)
  const hearts = (game.partner.together ?? 0) + (game.partner.fed ?? 0)
  const socket = (key: string, icon: ReactNode, name: string, sub: string, o: { tone?: 'feed' | 'guard' | 'shop'; n?: number; disabled?: boolean; ready?: boolean; title?: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) => (
    <button key={key} type="button" className={`socket ${o.tone ?? ''} ${o.ready ? 'ready' : ''}`} disabled={o.disabled} onClick={o.onClick} title={o.title} aria-label={`${name}: ${sub}`}>
      <span className="socket-well">{icon}{o.n !== undefined && <i className="socket-n">{o.n}</i>}</span>
      <b>{name}</b>
      <small>{sub}</small>
    </button>
  )
  return (
    <div className="belt" role="group" aria-label="Throw, feed and guard">
      {balls.map((b) => {
        const hp = hitOf(game, b)
        const double = BALLS[b].vs && hp > 0 && hp >= (BALLS[b].hp * 2)
        return socket(b, <BallItem id={b} size={40} />, itemName(b), BALLS[b].hp >= 1_000_000 ? 'catches it' : `−${hp} HP${double ? ' ×2' : ''}`, { n: game.inv[b], disabled: !wild || Boolean(flying), ready: Boolean(wild), title: ITEMS[b]?.text, onClick: (e) => throwIt(b, e.currentTarget) })
      })}
      {balls.length === 0 && socket('shop', <ItemIcon id="great-ball" size={36} />, 'Get balls', 'at the Mart', { tone: 'shop', onClick: onShop })}
      {berries.length > 0
        ? berries.map((b) => socket(b, <ItemIcon id={b} size={36} />, 'Feed', `${hearts} ♥`, { tone: 'feed', n: game.inv[b], title: ITEMS[b]?.text, onClick: () => { useItem(b, '', 'feed'); play('feed') } }))
        : socket('feed', <ItemIcon id="oran-berry" size={36} />, 'Feed', 'no berries', { tone: 'feed', disabled: true, title: 'Berries are at the Mart and in the Garden shop', onClick: () => undefined })}
      {(game.inv['max-repel'] ?? 0) > 0 && wild && !game.wild?.repel && socket('repel', <ItemIcon id="max-repel" size={36} />, 'Max Repel', `+${REPEL_DAYS} days`, { tone: 'guard', n: game.inv['max-repel'], title: ITEMS['max-repel'].text, onClick: () => { useItem('max-repel', '', 'repel'); play('tap') } })}
      {(game.inv['revive'] ?? 0) > 0 && game.league.slipped > 0 && socket('revive', <ItemIcon id="revive" size={36} />, 'Revive', `−${game.league.slipped} HP`, { tone: 'guard', n: game.inv['revive'], title: ITEMS['revive'].text, onClick: () => { useItem('revive', '', 'revive'); play('tap') } })}
      {((wild && game.wild?.leavesIn !== undefined && game.wild.leavesIn <= 3 && (game.inv['max-repel'] ?? 0) === 0) || (game.league.slipped > 0 && (game.inv['revive'] ?? 0) === 0)) && socket('guards', <ItemIcon id="max-repel" size={36} />, 'Guards', 'at the Mart', { tone: 'shop', onClick: onShop })}
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
  const t = game.today
  const done = game.quests.weekly.filter((q) => q.done).length
  return (
    <Win title="Pay and quests" tone="green" aside={t.pay > 0 ? <><Coin size={20} /> +{t.pay} today</> : `${done} / ${game.quests.weekly.length} this week`}>
      <div className="questcols">
        <div>
          <span className="k-label">Today's pay: the share of your habits ticked</span>
          <div className="paytiers">
            {DAILY_PAY.map((p) => <span key={p.share} className={`paytier ${t.ticked >= p.share ? 'on' : ''}`}><b>{Math.round(p.share * 100)}%</b><Price coins={p.coins} /></span>)}
          </div>
          <KBar value={t.done} max={Math.max(1, t.total)} label={`${t.done} / ${t.total} habits ticked`} />
        </div>
        <div><span className="k-label">This week</span><ul className="quests">{game.quests.weekly.map((q) => <QuestRow key={q.id} q={q} />)}</ul></div>
      </div>
    </Win>
  )
}

// ── incense: one mechanic, three Pokemon to pick from ───────────────────────
const INCENSE = ['full-incense', ...Object.keys(LURES)]
/** Every incense shows three candidates and the one you tap is the next wild Pokemon. Full Incense offers any type; the others offer one domain's types. */
export function IncenseWin({ game }: { game: Game }) {
  const [open, setOpen] = useState<string | null>(null)
  const owned = INCENSE.filter((id) => (game.inv[id] ?? 0) > 0)
  if (!owned.length && !game.wish.chosen) return null
  const sel = open && owned.includes(open) ? open : owned[0]
  return (
    <Win title="Incense" tone="green" aside={game.wish.chosen ? 'Chosen' : owned.length ? 'Pick one' : ''}>
      {game.wish.chosen && <p className="muted"><b>{nameOf(game.wish.chosen)}</b> is the next wild Pokemon.</p>}
      {owned.length > 0 && (
        <div className="baggrid">
          {owned.map((id) => (
            <button key={id} type="button" className={`bagtile ${id === sel ? 'on' : ''}`} onClick={() => setOpen(id)} title={ITEMS[id].text}>
              <ItemIcon id={id} size={40} /><b>{itemName(id)}</b><small>×{game.inv[id]} · {id === 'full-incense' ? 'any type' : `${TAG_NAME[LURES[id]]} types`}</small>
            </button>
          ))}
        </div>
      )}
      {sel && !game.wish.chosen && (
        <>
          <div className="queue pick">
            {(game.wish.options[sel] ?? []).map((f, i) => (
              <button key={`${f}${i}`} type="button" onClick={() => { useItem(sel, '', 'wish', f); play('tap') }} title={nameOf(f)}>
                <img src={still(f)} alt={nameOf(f)} width={72} height={72} className={`sprite ${game.dex[f]?.own ? '' : 'unseen'}`} />
              </button>
            ))}
          </div>
          <p className="muted">The one you tap appears next, and the incense is used up.</p>
        </>
      )}
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

/** Why something cannot be bought right now, or nothing when it can. */
function whyNot(game: Game, o: Offer, shop: ShopId): string | null {
  const def = ITEMS[o.item]
  const once = def?.kind === 'tm' || def?.kind === 'theme' || ONCE.has(o.item)
  if (once && (game.inv[o.item] || game.partner.held === o.item)) return 'Yours already'
  if (shop === 'mart' && game.mart.bought.includes(o.item)) return 'Sold today: back tomorrow'
  if (canBuy(game, o, shop)) return null
  return o.coins ? 'Not enough coins yet' : o.gems ? 'Not enough gems yet' : 'Not enough marks yet'
}

/** A shelf of goods: each one standing on a plank with its price tag hanging under it. Tap one to see what it does and buy it.
    `shop` is told to the game so a price is taken from the right purse. */
function Shelf({ game, offers, shop }: { game: Game; offers: Offer[]; shop: ShopId }) {
  const [open, setOpen] = useState<string | null>(null)
  const [bump, setBump] = useState<string | null>(null)
  const tag = MARK_TAGS.includes(shop as MarkTag) ? (shop as MarkTag) : undefined
  const buy = (item: string) => {
    useItem(item, '', 'buy', shop); play('buy')
    buyPop(document.querySelector(`[data-ware="${shop}:${item}"] .ware-art`))
    setBump(item); setTimeout(() => setBump(null), 350)
  }
  const o = offers.find((x) => x.item === open)
  return (
    <>
      <div className="shelf2">
        {offers.map((o) => {
          const have = game.inv[o.item] ?? 0
          const def = ITEMS[o.item]
          const once = def?.kind === 'tm' || def?.kind === 'theme'
          const sold = shop === 'mart' && game.mart.bought.includes(o.item)
          const owned = once && have > 0
          const worn = game.theme === o.item
          const afford = canBuy(game, o, shop)
          return (
            <button key={o.item} type="button" data-ware={`${shop}:${o.item}`} className={`ware ${bump === o.item ? 'bump' : ''} ${sold ? 'sold' : ''} ${owned ? 'owned' : ''} ${afford ? 'can' : ''}`} onClick={() => { setOpen(o.item); play('tap') }} aria-label={`${itemName(o.item)}: ${sold ? 'sold today' : owned ? 'owned' : 'see it and buy it'}`}>
              <span className="ware-art"><ItemIcon id={o.item} size={56} />{have > 0 && !once && <i className="ware-have">×{have}</i>}</span>
              <b>{itemName(o.item)}</b>
              <span className="ware-tag">{owned ? (def.kind === 'theme' ? (worn ? 'Worn' : 'Owned') : 'Owned') : sold ? 'Sold' : <Price coins={o.coins} gems={o.gems} marks={o.marks} tag={tag} />}</span>
            </button>
          )
        })}
      </div>
      {o && (
        <Sheet title={itemName(o.item)} onClose={() => setOpen(null)}>
          <div className="ware-sheet">
            <span className="ware-sheet-art"><ItemIcon id={o.item} size={96} /></span>
            <h2 className="k-type">{itemName(o.item)}</h2>
            <p>{ITEMS[o.item]?.text}</p>
            {(game.inv[o.item] ?? 0) > 0 && ITEMS[o.item]?.kind !== 'tm' && ITEMS[o.item]?.kind !== 'theme' && <small className="ware-sheet-have">You have {game.inv[o.item]}</small>}
            {ITEMS[o.item]?.kind === 'theme' && (game.inv[o.item] ?? 0) > 0
              ? <KButton tone={game.theme === o.item ? 'neutral' : 'main'} big onClick={() => useItem('', '', 'theme', game.theme === o.item ? undefined : o.item)}>{game.theme === o.item ? 'Take it off' : 'Use this scene'}</KButton>
              : (
                <>
                  <button type="button" className="k-btn ok big" disabled={!canBuy(game, o, shop)} onClick={() => buy(o.item)}>Buy <Price coins={o.coins} gems={o.gems} marks={o.marks} tag={tag} /></button>
                  {whyNot(game, o, shop) && <small className="ware-sheet-why">{whyNot(game, o, shop)}</small>}
                </>
              )}
          </div>
        </Sheet>
      )}
    </>
  )
}

/** Strong's seven pieces of gear, and how close the next full set (and the next Red Shard) is. */
function TrainingKit({ game }: { game: Game }) {
  const have = GEAR_ITEMS.filter((g) => (game.inv[g] ?? 0) > 0).length
  const sets = game.counters.sets ?? 0
  return (
    <div className="kit">
      <span className="k-label">Strong's training kit: {have} of {GEAR_ITEMS.length}</span>
      <div className="kitrow">
        {GEAR_ITEMS.map((g) => {
          const n = game.inv[g] ?? 0
          return (
            <span key={g} className={`gear ${n > 0 ? 'on' : ''}`} title={`${itemName(g)}: ${ITEMS[g].text}`}>
              <ItemIcon id={g} size={34} />{n > 1 && <i>×{n}</i>}<small>{itemName(g)}</small>
            </span>
          )
        })}
      </div>
      <p className="muted">Each workout in Strong's split drops its own piece. A full set of seven pays gems and Iron, and every {KIT_SHARD_EVERY}rd set a Red Shard too{sets > 0 ? `. ${sets} so far, ${KIT_SHARD_EVERY - (sets % KIT_SHARD_EVERY)} to the next shard.` : '.'}</p>
    </div>
  )
}

/** One domain's shop: its mastery, what its marks buy, and its TMs. */
export function DomainShop({ game, tag }: { game: Game; tag: MarkTag }) {
  const shop = DOMAIN_SHOPS[tag]
  const goods = shop.stock.filter((o) => ITEMS[o.item]?.kind !== 'tm')
  const tms = shop.stock.filter((o) => ITEMS[o.item]?.kind === 'tm')
  const lv = game.mastery[tag]
  return (
    <Win title={shop.name} tone={tag === 'sleep' ? 'purple' : tag === 'code' ? 'blue' : tag === 'fitness' ? 'red' : tag === 'guitar' ? 'gold' : 'green'} aside={<><MarkIcon tag={tag} size={22} /> {game.wallet.marks[tag]} {MARKS[tag].name}</>}>
      <p className="muted">{TAG_NAME[tag]} days pay {MARKS[tag].name}, and only this shop takes them.{tag === 'sleep' && !game.sleep.band ? ' Bells come only from nights your band measures, so this house stays quiet until the first one.' : ''}</p>
      <div className="mastery">
        <span className="mastery-mark"><MarkIcon tag={tag} size={34} /></span>
        <span className="mastery-txt">
          <b>{TAG_NAME[tag]} mastery {lv} <small>of {MASTERY_MAX}</small></b>
          <span className="mastery-pips" aria-hidden>{Array.from({ length: MASTERY_MAX }, (_, i) => <i key={i} className={i < lv ? 'on' : ''} />)}</span>
          <small>Each level: {TAG_NAME[tag].toLowerCase()} strikes leaders {Math.round(MASTERY_STEP * 100)}% harder{lv > 0 ? ` (now +${Math.round(MASTERY_STEP * 100 * lv)}%)` : ''}</small>
        </span>
        <button type="button" className="k-btn main" disabled={lv >= MASTERY_MAX || game.wallet.marks[tag] < masteryCost(lv)} onClick={() => { useItem('', '', 'train', tag); play('buy') }}>
          {lv >= MASTERY_MAX ? 'Full' : <>Train <MarkIcon tag={tag} size={18} />{masteryCost(lv)}</>}
        </button>
      </div>
      {tag === 'fitness' && <TrainingKit game={game} />}
      <Shelf game={game} offers={goods} shop={tag} />
      {tms.length > 0 && (
        <>
          <span className="k-label shelf-label">TMs · each is yours for good, and {nameOf(game.partner.form)} carries {TM_SLOTS}</span>
          <Shelf game={game} offers={tms} shop={tag} />
        </>
      )}
    </Win>
  )
}

export function ShopTab({ game, only }: { game: Game; only?: ShopId }) {
  const [which, setWhich] = useState<ShopId>('mart')
  const show = (s: ShopId) => (only ?? which) === s
  const chips: [ShopId, string, ReactNode][] = [['mart', 'Mart', <Coin key="m" size={18} />], ['rare', 'Rare', <Gem key="r" size={18} />], ...MARK_TAGS.map((t): [ShopId, string, ReactNode] => [t, DOMAIN_SHOPS[t].name, <MarkIcon key={t} tag={t} size={18} />])]
  return (
    <>
      {!only && (
        <div className="shopchips" role="tablist" aria-label="Shops">
          {chips.map(([id, name, icon]) => <button key={id} type="button" role="tab" aria-selected={which === id} className={`k-btn ${which === id ? 'main' : ''}`} onClick={() => { setWhich(id); play('tap') }}>{icon}{name}</button>)}
        </div>
      )}
      {show('mart') && (
        <Win title="The Mart" tone="gold" aside={<><Coin size={22} /> <Count value={game.wallet.coins} /></>}>
          <span className="k-label shelf-label">Today's deals · one of each, new every morning</span>
          <Shelf game={game} offers={game.mart.deals} shop="mart" />
          {game.mart.standing.length > 0 && (
            <>
              <span className="k-label shelf-label">Always in stock</span>
              <Shelf game={game} offers={game.mart.standing} shop="mart" />
            </>
          )}
        </Win>
      )}
      {show('rare') && (
        <Win title="Rare things" tone="blue" aside={<><Gem size={22} /> <Count value={game.wallet.gems} /></>}>
          <Shelf game={game} offers={RARE_SHELF} shop="rare" />
          {game.egg && <div className="eggrow"><span className="warm"><EggIcon size={44} /></span><div style={{ flex: 1 }}><span className="k-label">An egg is being kept warm</span><KBar value={game.egg.have} max={game.egg.need} kind="gold" label={`${game.egg.have.toLocaleString()} / ${game.egg.need.toLocaleString()} steps`} /></div></div>}
        </Win>
      )}
      {show('rare') && <IncenseWin game={game} />}
      {MARK_TAGS.filter((t) => show(t)).map((t) => <DomainShop key={t} game={game} tag={t} />)}
      {!only && (
        <Win title="Where it all comes from" tone="dark" fold>
          <ul className="earn">
            <li><Coin size={22} /> daily and weekly quests, the season, chests, and selling a Pokemon from My Pokemon to the Professor</li>
            <li><Gem size={22} /> feats, a catch, an evolution, a badge, weekly quests</li>
            <li>{MARK_TAGS.map((t) => <MarkIcon key={t} tag={t} size={22} />)} one a day for each kind of work done: coding, gym, guitar, Arbor, sleep</li>
            <li><ItemIcon id="red-shard" size={22} /><ItemIcon id="blue-shard" size={22} /><ItemIcon id="yellow-shard" size={22} /><ItemIcon id="green-shard" size={22} /> shards come from feats (a month running, a hundred days), every third set of Strong gear and a boss</li>
            <li><ItemIcon id="comet-shard" size={22} /> a Comet Shard for every month-end review done in Life OS; it fits any Mega</li>
          </ul>
        </Win>
      )}
    </>
  )
}

// ── the bag: what is held, carried and burning ──────────────────────────────
/** Where each kind of thing is used, in a line: shown on its card. */
const USED: Record<string, string> = {
  ball: 'Thrown at the wild Pokemon, or at the weekly boss once it is weak, from Today.',
  berry: 'Fed to your partner for a bond heart, from Today or here.',
  held: 'Held by your partner, one at a time: it adds to its kind of work.',
  tm: 'Carried by your partner: each counts as one of its types against a leader.',
  shard: 'Three of one colour forge a Mega Stone in the Forge on this tab.',
  key: 'Needed before the Forge can make a Mega Stone.',
  unique: 'Kept for good: no shop sells it.',
  gear: "A piece of Strong's training kit: a full set of seven pays gems and Iron.",
  guard: 'Used on Today, when the wild Pokemon is about to flee or a leader has won HP back.',
  lure: 'Shows three Pokemon of its kind of work: the one you tap is the next wild Pokemon.',
  incense: 'Shows three Pokemon of any type: the one you tap is the next wild Pokemon.',
  egg: 'Warmed by the steps your band counts, in the Nursery.',
  chest: 'Opens the moment it is bought.',
  theme: 'Changes the scene on Today.',
}
const GROUPS: [string, (id: string) => boolean][] = [
  ['Balls', (id) => ITEMS[id]?.kind === 'ball'],
  ['Berries', (id) => ITEMS[id]?.kind === 'berry'],
  ['Held items', (id) => id in HELD],
  ['TMs', (id) => ITEMS[id]?.kind === 'tm'],
  ['Keepsakes', (id) => ['shard', 'key', 'unique'].includes(ITEMS[id]?.kind)],
]

export function Bag({ game }: { game: Game }) {
  const [open, setOpen] = useState<string | null>(null)
  const have = (id: string) => game.inv[id] ?? 0
  const equipped = game.partner.moves ?? []
  const owned = Object.keys(game.inv).filter((id) => have(id) > 0 && ITEMS[id])
  // an item held by the partner is not in the count of what is loose, but it is still in the bag
  if (game.partner.held && !owned.includes(game.partner.held) && ITEMS[game.partner.held]) owned.push(game.partner.held)
  const used = new Set<string>()
  const groups = GROUPS.map(([name, test]) => {
    const ids = owned.filter((id) => !used.has(id) && test(id))
    ids.forEach((id) => used.add(id))
    return [name, ids] as const
  }).filter(([, ids]) => ids.length > 0)
  // everything that is not one of the groups above: gear, guards, incense, an egg, a chest, a scene
  const rest = owned.filter((id) => !used.has(id))
  const balls = owned.filter((id) => ITEMS[id].kind === 'ball').reduce((n, id) => n + have(id), 0)
  const berries = owned.filter((id) => ITEMS[id].kind === 'berry').reduce((n, id) => n + have(id), 0)
  const toggleTm = (id: string) => {
    const next = equipped.includes(id) ? equipped.filter((x) => x !== id) : [...equipped, id].slice(-TM_SLOTS)
    useItem('', '', 'move', next.join(','))
    play('tap')
  }
  const tile = (id: string) => {
    const on = game.partner.held === id || equipped.includes(id) || game.theme === id
    return (
      <button key={id} type="button" className={`bagtile ${on ? 'on' : ''}`} onClick={() => { setOpen(id); play('tap') }} title={ITEMS[id].text} aria-label={`${itemName(id)}, ${have(id) || 'held'}. Open`}>
        <ItemIcon id={id} size={40} />
        <b>{itemName(id)}</b>
        <small>{on ? (game.theme === id ? 'In use' : 'Equipped') : have(id) > 0 ? `×${have(id)}` : 'Held'}</small>
      </button>
    )
  }
  const card = open && ITEMS[open] ? open : null
  const kind = card ? ITEMS[card].kind : null
  return (
    <Win title="Bag" tone="purple" fold aside={balls || berries ? <>{balls > 0 && `${balls} ${balls === 1 ? 'ball' : 'balls'}`}{balls > 0 && berries > 0 && ' · '}{berries > 0 && `${berries} ${berries === 1 ? 'berry' : 'berries'}`}</> : game.keyStone ? <><ItemIcon id="key-stone" size={22} /> Key Stone</> : undefined}>
      <span className="k-label">Money and marks</span>
      <div className="baggrid wallet">
        <div className="bagtile" title="Coins: for showing up, quests, the season, chests and the Professor"><Coin size={40} /><b>Coins</b><small>{game.wallet.coins.toLocaleString('en-IN')}{game.wallet.coinsToday > 0 ? ` · +${game.wallet.coinsToday} today` : ''}</small></div>
        <div className="bagtile" title="Gems: catches, evolutions, badges and feats"><Gem size={40} /><b>Gems</b><small>{game.wallet.gems.toLocaleString('en-IN')}{game.wallet.gemsToday > 0 ? ` · +${game.wallet.gemsToday} today` : ''}</small></div>
        {MARK_TAGS.map((t) => (
          <div key={t} className="bagtile" title={`${MARKS[t].name}: a ${TAG_NAME[t].toLowerCase()} day pays one. Spent in ${DOMAIN_SHOPS[t].name}`}>
            <MarkIcon tag={t} size={40} /><b>{MARKS[t].name}</b><small>{game.wallet.marks[t]}{game.wallet.marksToday[t] > 0 ? ` · +${game.wallet.marksToday[t]} today` : ''}</small>
          </div>
        ))}
      </div>
      {owned.length === 0 && <p className="muted">No items yet. The Mart opens each morning, and feats hand out the rest.</p>}
      {groups.map(([name, ids]) => (
        <section key={name} className="bag-group">
          <span className="k-label">{name === 'TMs' ? `TMs · ${equipped.length} of ${TM_SLOTS} on ${nameOf(game.partner.form)}` : name === 'Held items' ? `Held items · ${nameOf(game.partner.form)} holds one` : name}</span>
          <div className="baggrid">{ids.map(tile)}</div>
        </section>
      ))}
      {rest.length > 0 && (
        <section className="bag-group">
          <span className="k-label">Everything else</span>
          <div className="baggrid">{rest.map(tile)}</div>
        </section>
      )}
      {card && kind && (
        <Sheet title={itemName(card)} onClose={() => setOpen(null)}>
          <div className="ware-sheet">
            <span className="ware-sheet-art"><ItemIcon id={card} size={96} /></span>
            <h2 className="k-type">{itemName(card)}</h2>
            <p>{ITEMS[card].text}</p>
            <small className="ware-sheet-have">{have(card) > 0 ? `You have ${have(card)}` : 'Held by your partner'}</small>
            <p className="muted">{USED[kind]}</p>
            {kind === 'berry' && <button type="button" className="k-btn ok big" onClick={() => { useItem(card, '', 'feed'); play('feed'); if (have(card) <= 1) setOpen(null) }}>Feed it now</button>}
            {kind === 'held' && (() => {
              const on = game.partner.held === card
              return <KButton tone={on ? 'neutral' : 'main'} big onClick={() => { useItem(on ? '' : card, '', 'hold', on ? '' : card); play('tap'); setOpen(null) }}>{on ? 'Take it off' : `Give it to ${nameOf(game.partner.form)}`}</KButton>
            })()}
            {kind === 'tm' && <KButton tone={equipped.includes(card) ? 'neutral' : 'main'} big onClick={() => { toggleTm(card); setOpen(null) }}>{equipped.includes(card) ? 'Take it off' : `Equip on ${nameOf(game.partner.form)}`}</KButton>}
            {kind === 'theme' && <KButton tone={game.theme === card ? 'neutral' : 'main'} big onClick={() => { useItem('', '', 'theme', game.theme === card ? undefined : card); setOpen(null) }}>{game.theme === card ? 'Take it off' : 'Use this scene'}</KButton>}
            {card === 'max-repel' && <button type="button" className="k-btn main big" disabled={!(game.wild && !game.wild.caught && !game.wild.repel)} onClick={() => { useItem('max-repel', '', 'repel'); play('tap'); setOpen(null) }}>Use on the wild Pokemon</button>}
            {card === 'revive' && <button type="button" className="k-btn main big" disabled={game.league.slipped <= 0} onClick={() => { useItem('revive', '', 'revive'); play('tap'); setOpen(null) }}>Use on the leader</button>}
          </div>
        </Sheet>
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
  const v5 = true
  const open = game.today.day >= TEAM_OPEN_FROM
  const canTeam = !isPartner && (trained || (open && inBox))
  const setTeam = () => putOnTeam(game, m.uid, !inTeam)
  const act = (what: string) => { useItem('', m.uid, what); play('tap'); onClose() }
  const megas = rec.m ?? []
  const sell = SELL[rec.r ?? 'C'] ?? SELL.C
  // drawn on the page itself, not inside the tab: the tab slides in and would carry the window off with it
  return (
    <Sheet title={nameOf(m.form)} onClose={onClose}>
      <div className="monpage">
        <div className={`mp-art ${m.megas?.length ? 'mega' : ''}`}><img src={spritePath(m.megas?.length && m.show !== 'base' ? (m.show && m.megas.includes(m.show) ? m.show : m.megas[0]) : m.form, m.shiny)} alt="" className="sprite" /></div>
        <div className="mp-body">
          <h2 className="k-type">{nameOf(m.form)}{m.shiny && <span className="chip">shiny</span>}</h2>
          <div className="mp-types">
            {[rec.t, rec.t2].filter(Boolean).map((t) => <span key={t} className="chip type"><img src={`/sprites/types/${t}.png`} alt="" width={14} height={14} onError={(e) => { e.currentTarget.style.display = 'none' }} />{t}</span>)}
            {(m.moves ?? []).map((id) => <span key={id} className="chip type tmchip"><ItemIcon id={id} size={16} />{tmType(id)}</span>)}
            <span className="chip where">{isPartner ? 'Your partner' : inTeam ? 'In the party' : trained ? 'Fully trained' : 'In My Pokemon'}</span>
          </div>
          <div className="mp-tiles">
            <div className="k-tile"><span className="k-label">Level</span><b>{levelOf(m.xp)}</b></div>
            <div className="k-tile"><span className="k-label">Hearts</span><b>{hearts} ♥</b></div>
            {m.nature && <div className="k-tile"><span className="k-label">Nature</span><b>{m.nature.name}</b></div>}
            <div className="k-tile"><span className="k-label">{m.origin === 'egg' ? 'Hatched' : m.origin === 'starter' ? 'Starter' : 'Caught'}</span><b>{fmtDay(m.from)}</b></div>
            {m.held && <div className="k-tile"><span className="k-label">Holding</span><b className="holdline"><ItemIcon id={m.held} size={22} />{itemName(m.held)}</b></div>}
          </div>
          {m.nature?.up && m.nature.down && <p className="muted">Raised most on {TAG_NAME[m.nature.up]}, least on {TAG_NAME[m.nature.down]}.</p>}
          {m.nature?.up && trained && <p className="muted">On the team it adds {Math.round(TEAM_BONUS * 100)}% to every strike and {Math.round(TEAM_NATURE * 100)}% more to {TAG_NAME[m.nature.up]} work.</p>}
          {m.ball && <p className="muted ballname">{m.thrown ? <BallItem id={m.thrown} size={20} /> : <Ball ball={m.ball} size={18} />}Caught in {m.thrown ? `a ${itemName(m.thrown)}` : aBall(m.ball)}.</p>}
          <div className="mp-line">
            {m.path.map((f, i) => <span key={f} className="path-step">{i > 0 && <span className="arrow">▸</span>}<img src={still(f, m.shiny)} alt={nameOf(f)} title={nameOf(f)} width={48} height={48} className="sprite" /></span>)}
            {(rec.e ?? []).length > 0 && <span className="path-step"><span className="arrow">▸</span>{rec.e!.slice(0, 3).map((f) => <img key={f} src={still(f)} alt="" width={48} height={48} className={`sprite ${game.dex[f] ? '' : 'unseen'}`} />)}</span>}
            {(m.megas ?? []).map((f) => <span key={f} className="path-step"><span className="arrow">★</span><img src={still(f, m.shiny)} alt={nameOf(f)} title={`${nameOf(f)}, for good`} width={48} height={48} className="sprite" /></span>)}
          </div>
          {megas.length > 0 && <p className="muted">{(m.megas ?? []).length ? 'Its Mega is forged and kept for good.' : 'It has a Mega form. Stones are forged in the Forge, on the Party tab.'}</p>}
          <div className="kit-row">
            {inBox && <KButton tone="main" disabled={m.uid === game.nextUp} onClick={() => act('next')}>{m.uid === game.nextUp ? 'Next up' : 'Make next'}</KButton>}
            {inBox && <KButton onClick={() => act('lead')}>Partner now</KButton>}
            {inBox && v5 && <button type="button" className="k-btn ok" onClick={() => act('transfer')}>To the Professor <Price coins={sell} /></button>}
            {canTeam && <KButton tone={inTeam ? 'neutral' : 'main'} onClick={() => { setTeam(); play('tap'); onClose() }}>{inTeam ? 'Take out of the party' : 'Add to the party'}</KButton>}
          </div>
        </div>
      </div>
    </Sheet>
  )
}

// ── team ────────────────────────────────────────────────────────────────────
/** Put someone in the party (first in line: the newest choice pushes the last one out when it is full) or take them out. One `team` event holds the whole choice. */
function putOnTeam(game: Game, uid: string, on: boolean): void {
  const rest = game.team.map((x) => x.uid).filter((id) => id !== uid)
  useItem('', '', 'team', (on ? [uid, ...rest].slice(0, TEAM_SIZE) : rest).join(','))
}

/** Everyone who can join the party and is not in it: from the day the team opened, My Pokemon as well as the fully trained. */
function Joiners({ game, onPick, onClose }: { game: Game; onPick: (uid: string) => void; onClose: () => void }) {
  const open = game.today.day >= TEAM_OPEN_FROM
  const inTeam = new Set(game.team.map((m) => m.uid))
  const trained = game.graduates.filter((m) => !inTeam.has(m.uid))
  const waiting = open ? game.queue.filter((m) => !inTeam.has(m.uid)) : []
  return (
    <Sheet title="Add to the party" onClose={onClose}>
      <div className="joiners">
        <h2 className="k-type">Add to the party</h2>
        <p className="muted">{game.team.length >= TEAM_SIZE ? 'The party is full: the one you add comes first and the last place is given up.' : `${TEAM_SIZE - game.team.length} ${TEAM_SIZE - game.team.length === 1 ? 'place is' : 'places are'} open.`} Each one adds {Math.round(TEAM_BONUS * 100)}% to every strike.</p>
        {trained.length > 0 && (
          <>
            <span className="k-label">Fully trained</span>
            <div className="boxgrid">{trained.map((m) => <Standee key={m.uid} m={m} size={52} onClick={() => { onPick(m.uid); onClose() }} />)}</div>
          </>
        )}
        {waiting.length > 0 && (
          <>
            <span className="k-label">In My Pokemon</span>
            <div className="boxgrid">{waiting.map((m) => <Standee key={m.uid} m={m} size={52} onClick={() => { onPick(m.uid); onClose() }} />)}</div>
          </>
        )}
        {trained.length === 0 && waiting.length === 0 && <p className="muted">Nobody else is free to join. Catch more Pokemon, or finish training one.</p>}
        {!open && <p className="muted">Pokemon still being raised can join the party from {fmtDay(TEAM_OPEN_FROM)}.</p>}
      </div>
    </Sheet>
  )
}

/** One Pokemon as it stands on the Party tab: the sprite on its shadow, its name and level under it. No frame. */
function Standee({ m, size = 64, note, onClick, title }: { m: Mon; size?: number; note?: ReactNode; onClick: () => void; title?: string }) {
  return (
    <button type="button" className={`standee ${m.megas?.length ? 'mega' : ''}`} onClick={onClick} title={title ?? nameOf(m.form)}>
      <span className="standee-art" style={{ width: size + 12, height: size + 8 }}>
        <img src={still(m.form, m.shiny)} alt="" width={size} height={size} className="sprite" loading="lazy" decoding="async" />
        {m.ball && <Ball ball={m.ball} size={16} className="standee-ball" />}
        {m.nature?.up && <i className="standee-gem" data-tag={m.nature.up} title={`${m.nature.name}: raised most on ${TAG_NAME[m.nature.up]}`} />}
      </span>
      <b>{nameOf(m.form)}</b>
      <small>{note ?? `Lv ${levelOf(m.xp)}`}</small>
    </button>
  )
}

/** Party: what you have, and what you can do with it. The partner, the six who stand together, My Pokemon, the Forge, and the rest of what you own under its own heading. */
export function TeamTab({ game, partnerCard, choices, onShop }: { game: Game; partnerCard: (open: () => void) => ReactNode; choices: ReactNode; onShop: () => void }) {
  const [page, setPage] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const inTeam = new Set(game.team.map((m) => m.uid))
  const shown = [game.partner, ...game.queue, ...game.graduates].find((m) => m.uid === page)
  const cap = TEAM_SIZE
  const open = game.today.day >= TEAM_OPEN_FROM
  // who could still join: the fully trained, and from the day the team opened, everyone in My Pokemon
  const free = game.graduates.filter((m) => !inTeam.has(m.uid)).length + (open ? game.queue.filter((m) => !inTeam.has(m.uid)).length : 0)
  const bench = game.graduates.filter((m) => !inTeam.has(m.uid))
  return (
    <div className="partypage">
      <div className="party-main">
        {partnerCard(() => setPage(game.partner.uid))}
        <Win title="Your party" tone="gold" aside={game.team.length ? `+${Math.round(game.power.team * 100)}% to every strike` : `${1 + game.team.length} of ${cap + 1}`}>
          <div className="party6">
            <div className="plat lead"><Standee m={game.partner} note="Partner" onClick={() => setPage(game.partner.uid)} /></div>
            {Array.from({ length: cap }, (_, i) => {
              const m = game.team[i]
              return m
                ? <div key={m.uid} className="plat"><Standee m={m} note={m.graduated ? `Lv ${levelOf(m.xp)}` : `Lv ${levelOf(m.xp)} · raising`} onClick={() => setPage(m.uid)} title={`${nameOf(m.form)}${m.nature ? ` · ${m.nature.name}` : ''}`} /></div>
                : <button key={i} type="button" className="plat empty" disabled={free === 0} onClick={() => setJoining(true)} aria-label={free ? 'Add someone to the party' : 'Empty place in the party'}><span className="plat-ball" aria-hidden /><small>{free ? 'Add' : 'Open'}</small></button>
            })}
          </div>
          <div className="party-actions">
            <button type="button" className="k-btn main" disabled={free === 0} onClick={() => { setJoining(true); play('tap') }}>Add to the party</button>
            <small>{free === 0 ? 'Nobody else is free to join yet.' : `${free} could join. A place nobody chose fills itself with the oldest in My Pokemon.`}</small>
          </div>
          {bench.length > 0 && (
            <div className="bench">
              <span className="k-label">Fully trained, off the party · {bench.length}</span>
              <div className="bench-row" data-noswipe>
                {bench.map((m) => <Standee key={m.uid} m={m} size={48} onClick={() => setPage(m.uid)} title={`${nameOf(m.form)} · ${SPECIES[m.form].t}${SPECIES[m.form].t2 ? ` / ${SPECIES[m.form].t2}` : ''}${m.nature ? ` · ${m.nature.name}` : ''}`} />)}
              </div>
            </div>
          )}
        </Win>
        <MyPokemon game={game} onOpen={setPage} />
      </div>
      <div className="party-side">
        <Forge game={game} />
      </div>
      <div className="party-stores">
        <h2 className="extras-h">Items and extras</h2>
        <Nursery game={game} onShop={onShop} />
        <Bag game={game} />
        <IncenseWin game={game} />
        {choices}
      </div>
      {shown && <MonPage m={shown} game={game} onClose={() => setPage(null)} />}
      {joining && <Joiners game={game} onPick={(uid) => putOnTeam(game, uid, true)} onClose={() => setJoining(false)} />}
    </div>
  )
}

/** Everything caught and not yet raised, oldest first. Open when there are few, folded when it grows. */
function MyPokemon({ game, onOpen }: { game: Game; onOpen: (uid: string) => void }) {
  const inTeam = new Set(game.team.map((m) => m.uid))
  const body = game.queue.length === 0
    ? <p className="muted">Empty. Catch the wild Pokemon and it comes here.</p>
    : (
      <div className="boxgrid">
        {game.queue.map((m) => (
          <Standee key={m.uid} m={m} size={52} note={m.uid === game.nextUp ? <em className="nextup">Next up</em> : inTeam.has(m.uid) ? <em className="nextup">In the party</em> : undefined} onClick={() => onOpen(m.uid)} title={`${nameOf(m.form)}${m.ball ? ` · ${m.thrown ? itemName(m.thrown) : BALL_NAME[m.ball]}` : ''}`} />
        ))}
      </div>
    )
  return <MyPokemonWin n={game.queue.length}>{body}</MyPokemonWin>
}
function MyPokemonWin({ n, children }: { n: number; children: ReactNode }) {
  // open by default while it holds eight or fewer; the details element keeps the choice the reader makes
  return n <= 8
    ? <Win title="My Pokemon" tone="dark" aside={plural(n, 'Pokemon', 'Pokemon')}>{children}</Win>
    : <Win title="My Pokemon" tone="dark" fold aside={plural(n, 'Pokemon', 'Pokemon')}>{children}</Win>
}

/** A number that pops up and floats away: what today did to something. */
export function Pop({ value, className = '', style }: { value: number; className?: string; style?: CSSProperties }) {
  if (value <= 0) return null
  return <span key={value} className={`pop ${className}`} style={style} aria-hidden>−{value}</span>
}
