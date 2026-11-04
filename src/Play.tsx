// What you do with what the work earned: the Mart and the five domain shops,
// throwing a ball, feeding a berry, holding an item, TMs, lures, the Smithy, the
// team, the Professor, quests. Every one is written to the ledger as one small
// event (store.useItem), so the game is still recomputed from the ledger alone.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { isShelved, nameOf, type Game, type Mon, type Quest } from '../core/fold.ts'
import {
  BALLS, battleShelf, BERRY_HEARTS, treasurePrice, BOOST, BP_SHELF, DOMAIN_SHOPS, DOMAIN_V13, EVO_ITEMS, FOSSILS, GEAR_ITEMS, HELD, ITEMS, LEGEND_KEYS, LURES, MARKS, MARK_TAGS, MASTERY_MAX, MASTERY_STEP, ONCE, masteryCost, RARE_SHELF, RARE_SHELF_V13, REVIVE_COST, SELL, TM_SLOTS, TREASURE, itemName, throwHp, tmType,
  type MarkTag, type Offer, type ShopId,
} from '../core/economy.ts'
import { DAILY_PAY, MAX_LEVEL, REPEL_DAYS, RESEARCH_SLOTS, TEAM_BONUS, TEAM_NATURE, TEAM_SIZE, levelOf, studyPoints, type Rarity } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { GymBadge, TAG_NAME, Win, badgesWon, plural } from './App.tsx'
import { Ball, BallItem, MegaStone, megaStoneName } from './Ball.tsx'
import { Forge } from './screens/Forge.tsx'
import { Sheet } from './screens/Sheet.tsx'
import { tabTodo } from './screens/Today.tsx'
import { Deck, SigLine } from './Bond.tsx'
import { ResearchTab } from './Research.tsx'
import { Coin, EggIcon, Gem, ItemIcon, MarkIcon } from './Item.tsx'
import { KBar, KButton } from './Kit.tsx'
import { Slot } from './Slot.tsx'
import { ObjCard } from './ObjCard.tsx'
import { catColor } from './lib/itemcat.ts'
import { aBall, badgeArt, badgeName, badgeWon, fmtDay, still } from './lib/art.ts'
import { LEAGUES } from '../core/gyms.ts'
import { useFlip } from './lib/cardkit.tsx'
import { startPress, type DragHooks } from './lib/dragcards.ts'
import { loadLayout, moveTo, reconcile, slotCount, storeLayout, tidy, type Layout } from './lib/baglayout.ts'
import { buyPop } from './lib/fx.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'
import { aim } from './lib/aim.ts'
import { BondPerks, BpIcon, CollectorWin, LabWin, MonExtras, evolutionsFor } from './Champion.tsx'
import { FeedSheet, treatsIn } from './Feed.tsx'
import { FeedBlock, RoleControl, TeamScreen, monCardOf } from './Team.tsx'
import { MonCard } from './MonCard.tsx'
import { useBoxes } from './Fit.tsx'

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

export const Price = ({ coins, gems, marks, tag, bp }: { coins?: number; gems?: number; marks?: number; tag?: MarkTag; bp?: boolean }) => (
  <span className="price">
    {coins ? <><Coin size={20} />{coins.toLocaleString('en-IN')}</> : gems ? <><Gem size={20} />{gems}</> : marks && bp ? <><BpIcon size={20} />{marks}</> : marks && tag ? <><MarkIcon tag={tag} size={20} />{marks}</> : null}
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
  const [feeding, setFeeding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => { clearTimeout(timer.current); aim(0) }, [])
  const wild = game.wild && !game.wild.caught
  const throwIt = (item: string, from?: Element) => {
    if (flying) return
    setFlying(item)
    flyBall(from?.querySelector('img'), 650)
    play('throw')
    // the outcome is read from the game as it is now; the ball is seen to fly, then the ledger is told and the HP falls
    const sound = hitOf(game, item) >= (game.wild?.hp ?? 1) ? 'catch' : 'hit'
    timer.current = setTimeout(() => { useItem(item, '', 'throw'); setFlying(null); play(sound); aim(0) }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650)
  }
  const balls = Object.keys(BALLS).filter((b) => (game.inv[b] ?? 0) > 0).sort((a, b) => hitOf(game, b) - hitOf(game, a))
  const berries = Object.keys(BERRY_HEARTS).filter((b) => (game.inv[b] ?? 0) > 0)
  const hearts = (game.partner.together ?? 0) + (game.partner.fed ?? 0)
  // a ball held over the wild Pokemon ghosts its throw on the scene's HP bar (lib/aim.ts)
  const hold = (hp?: number) => (hp ? { onPointerEnter: () => aim(hp), onPointerDown: () => aim(hp), onFocus: () => aim(hp), onPointerLeave: () => aim(0), onBlur: () => aim(0) } : {})
  const socket = (key: string, icon: ReactNode, name: string, sub: string, o: { tone?: 'feed' | 'guard' | 'shop'; n?: number; disabled?: boolean; ready?: boolean; title?: string; aim?: number; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) => (
    <button key={key} type="button" className={`socket ${o.tone ?? ''} ${o.ready ? 'ready' : ''}`} disabled={o.disabled} onClick={o.onClick} title={o.title} aria-label={`${name}: ${sub}`} {...hold(o.disabled ? 0 : o.aim)}>
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
        return socket(b, <BallItem id={b} size={48} />, itemName(b), BALLS[b].hp >= 1_000_000 ? 'catches it' : `−${hp} HP${double ? ' ×2' : ''}`, { n: game.inv[b], disabled: !wild || Boolean(flying), ready: Boolean(wild), title: ITEMS[b]?.text, aim: Math.min(hp, game.wild?.hp ?? 0), onClick: (e) => throwIt(b, e.currentTarget) })
      })}
      {balls.length === 0 && socket('shop', <ItemIcon id="great-ball" size={48} />, 'Get balls', 'at the Mart', { tone: 'shop', onClick: onShop })}
      {game.v14
        ? socket('feed', <ItemIcon id={treatsIn(game)[0] ?? 'oran-berry'} size={48} />, 'Feed', berries.length ? `${berries.reduce((n, b) => n + (game.inv[b] ?? 0), 0)} to give` : 'no berries', { tone: 'feed', disabled: berries.length === 0, title: 'Feed any of your Pokemon: berries and treats', onClick: () => setFeeding(true) })
        : berries.length > 0
        ? berries.map((b) => socket(b, <ItemIcon id={b} size={48} />, itemName(b).replace(' Berry', ''), `+${BERRY_HEARTS[b]} ♥ · ${hearts}`, { tone: 'feed', n: game.inv[b], title: ITEMS[b]?.text, onClick: () => { useItem(b, '', 'feed'); play('feed') } }))
        : socket('feed', <ItemIcon id="oran-berry" size={48} />, 'Feed', 'no berries', { tone: 'feed', disabled: true, title: 'Berries are at the Mart and in the Garden shop', onClick: () => undefined })}
      {(game.inv['max-repel'] ?? 0) > 0 && wild && !game.wild?.repel && socket('repel', <ItemIcon id="max-repel" size={48} />, 'Max Repel', `+${REPEL_DAYS} days`, { tone: 'guard', n: game.inv['max-repel'], title: ITEMS['max-repel'].text, onClick: () => { useItem('max-repel', '', 'repel'); play('tap') } })}
      {(game.inv['revive'] ?? 0) > 0 && game.league.slipped > 0 && socket('revive', <ItemIcon id="revive" size={48} />, 'Revive', `−${game.league.slipped} HP`, { tone: 'guard', n: game.inv['revive'], title: ITEMS['revive'].text, onClick: () => { useItem('revive', '', 'revive'); play('tap') } })}
      {feeding && <FeedSheet game={game} onClose={() => setFeeding(false)} />}
      {((wild && game.wild?.leavesIn !== undefined && game.wild.leavesIn <= 3 && (game.inv['max-repel'] ?? 0) === 0) || (game.league.slipped > 0 && (game.inv['revive'] ?? 0) === 0)) && socket('guards', <ItemIcon id="max-repel" size={48} />, 'Guards', 'at the Mart', { tone: 'shop', onClick: onShop })}
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
  const marks = MARK_TAGS.includes(shop as MarkTag) ? game.wallet.marks[shop as MarkTag] : shop === 'bp' ? game.wallet.bp : 0
  return (o.coins ?? 0) <= game.wallet.coins && (o.gems ?? 0) <= game.wallet.gems && (o.marks ?? 0) <= marks
}

/** Why something cannot be bought right now, or nothing when it can. */
function whyNot(game: Game, o: Offer, shop: ShopId): string | null {
  const def = ITEMS[o.item]
  const once = def?.kind === 'tm' || def?.kind === 'theme' || ONCE.has(o.item)
  if (once && (game.inv[o.item] || game.partner.held === o.item)) return 'Yours already'
  if (shop === 'mart' && game.mart.bought.includes(o.item)) return 'Sold today: back tomorrow'
  if (canBuy(game, o, shop)) return null
  return o.coins ? 'Not enough coins yet' : o.gems ? 'Not enough gems yet' : shop === 'bp' ? 'Not enough Battle Points yet' : 'Not enough marks yet'
}

/** A shelf of goods: each one standing on a plank with its price tag hanging under it. Tap one to see what it does and buy it.
    `shop` is told to the game so a price is taken from the right purse. */
/** `fold`: a long shelf shows this many until it is opened, so one shelf does not bury the ones under it. */
function Shelf({ game, offers: all, shop, fold, what = 'items' }: { game: Game; offers: Offer[]; shop: ShopId; fold?: number; what?: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const offers = fold && !more ? all.slice(0, fold) : all
  const [bump, setBump] = useState<string | null>(null)
  const tag = MARK_TAGS.includes(shop as MarkTag) ? (shop as MarkTag) : undefined
  const buy = (item: string) => {
    useItem(item, '', 'buy', shop); play('buy')
    buyPop(document.querySelector(`[data-ware="${shop}:${item}"] .ware-art`))
    setBump(item); setTimeout(() => setBump(null), 350)
  }
  const o = all.find((x) => x.item === open)
  return (
    <>
      <div className="shelf2">
        {offers.map((o) => {
          const have = game.inv[o.item] ?? 0
          const def = ITEMS[o.item]
          const once = def?.kind === 'tm' || def?.kind === 'theme' || ONCE.has(o.item)
          const sold = shop === 'mart' && game.mart.bought.includes(o.item)
          const owned = once && have > 0
          const worn = game.theme === o.item
          const afford = canBuy(game, o, shop)
          return (
            <button key={o.item} type="button" data-ware={`${shop}:${o.item}`} className={`ware ${bump === o.item ? 'bump' : ''} ${sold ? 'sold' : ''} ${owned ? 'owned' : ''} ${afford ? 'can' : ''}`} onClick={() => { setOpen(o.item); play('tap') }} aria-label={`${itemName(o.item)}: ${sold ? 'sold today' : owned ? 'owned' : 'see it and buy it'}`}>
              <span className="ware-art"><ItemIcon id={o.item} size={56} />{have > 0 && !once && <i className="ware-have">×{have}</i>}</span>
              <b>{itemName(o.item)}</b>
              <span className="ware-tag">{owned ? (def.kind === 'theme' ? (worn ? 'Worn' : 'Owned') : 'Owned') : sold ? 'Sold' : <Price coins={o.coins} gems={o.gems} marks={o.marks} tag={tag} bp={shop === 'bp'} />}</span>
            </button>
          )
        })}
      </div>
      {fold !== undefined && all.length > fold && <button type="button" className="k-btn shelf-more" aria-expanded={more} onClick={() => { setMore(!more); play('tap') }}>{more ? 'Fewer' : `All ${all.length} ${what}`}</button>}
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
                  <button type="button" className="k-btn ok big" disabled={!canBuy(game, o, shop)} onClick={() => buy(o.item)}>Buy <Price coins={o.coins} gems={o.gems} marks={o.marks} tag={tag} bp={shop === 'bp'} /></button>
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
    </div>
  )
}

/** One domain's shop: its mastery, what its marks buy, and its TMs. */
export function DomainShop({ game, tag, open }: { game: Game; tag: MarkTag; /** shown on its own (a tab of its own), so it does not fold */ open?: boolean }) {
  const shop = DOMAIN_SHOPS[tag]
  const goods = [...shop.stock.filter((o) => ITEMS[o.item]?.kind !== 'tm'), ...(game.v13 ? DOMAIN_V13[tag] : [])]
  const tms = shop.stock.filter((o) => ITEMS[o.item]?.kind === 'tm')
  const lv = game.mastery[tag]
  return (
    <Win title={shop.name} tone={tag === 'sleep' ? 'purple' : tag === 'code' ? 'blue' : tag === 'fitness' ? 'red' : tag === 'guitar' ? 'gold' : 'green'} fold={!open} aside={<><MarkIcon tag={tag} size={22} /> {game.wallet.marks[tag]} {MARKS[tag].name}</>}>
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

/**
 * The five shops paid in marks, one at a time: a strip like the tab bar to move between them (its own mark and
 * how many you hold on each), and the shop chosen under it, open. It opens on the one whose marks you hold most of.
 */
function MarkShops({ game }: { game: Game }) {
  // version 18: a shop whose kind of work has no habit on the Life OS list is shelved (hidden, not gone: its marks are kept)
  const live = openMarks(game)
  const off = MARK_TAGS.filter((t) => !live.includes(t))
  const richest = [...live].sort((a, b) => game.wallet.marks[b] - game.wallet.marks[a])[0]
  const [chosen, setTag] = useState<MarkTag>(richest)
  const tag = live.includes(chosen) ? chosen : richest
  return (
    <>
      <nav className="substrip" style={{ ['--n' as string]: live.length } as CSSProperties} role="tablist" aria-label="Shops paid in marks" data-noswipe>
        {live.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tag === t} className={tag === t ? 'on' : ''} data-tag={t} onClick={() => { setTag(t); play('tap') }}>
            <span className="substrip-ico"><MarkIcon tag={t} size={30} /><i>{game.wallet.marks[t]}</i></span>
            <b>{DOMAIN_SHOPS[t].name.replace(/^The /, '')}</b>
          </button>
        ))}
      </nav>
      <DomainShop key={tag} game={game} tag={tag} open />
      {off.length > 0 && (
        <p className="muted shelved-note">
          {off.map((t) => TAG_NAME[t]).join(' and ')} {off.length > 1 ? 'are' : 'is'} off your Life OS list, so {off.length > 1 ? 'their shops are' : 'its shop is'} shelved ({off.map((t) => `${game.wallet.marks[t]} ${MARKS[t].name}`).join(', ')} kept). Put the habit back in Life OS and {off.length > 1 ? 'they open' : 'it opens'} again.
        </p>
      )}
    </>
  )
}

/** The marks shops that are open: every one, except the kinds of work shelved in Life OS (never an empty list). */
function openMarks(game: Game): MarkTag[] {
  const live = MARK_TAGS.filter((t) => !isShelved(game, t))
  return live.length ? live : MARK_TAGS
}

type Place = ShopId | 'collector' | 'lab'
/** The Shop is three counters, by what you pay with: coins (the Mart, and the Collector who pays coins), gems and BP (rare things, the BP Exchange, the fossil Lab), and marks (each kind of work's own shop). */
type Counter = 'coins' | 'gems' | 'marks'
const COUNTER: Record<Counter, Place[]> = { coins: ['mart', 'collector'], gems: ['rare', 'bp', 'lab'], marks: [...MARK_TAGS] }
export function ShopTab({ game }: { game: Game }) {
  const [which, setWhich] = useState<Counter>('coins')
  const show = (s: Place) => COUNTER[which].includes(s) && (game.v13 || !['bp', 'collector', 'lab'].includes(s))
  // a dot on the counter where something is waiting (screens/Today.tsx)
  const { shop: waiting, shopAt } = tabTodo(game)
  const dot: Record<Counter, string | null> = { coins: shopAt === 'coins' ? waiting : null, gems: shopAt === 'gems' ? waiting : null, marks: null }
  const chips: [Counter, string, ReactNode][] = [
    ['coins', 'Coins', <Coin key="m" size={30} />],
    ['gems', game.v13 ? 'Gems & BP' : 'Gems', <Gem key="r" size={30} />],
    ['marks', 'Marks', <MarkIcon key="k" tag="fitness" size={30} />],
  ]
  return (
    <>
      {(
        <nav className="pmenu" style={{ ['--n' as string]: chips.length } as CSSProperties} role="tablist" aria-label="Shops" data-noswipe>
          {chips.map(([id, name, icon]) => (
            <button key={id} type="button" role="tab" aria-selected={which === id} title={dot[id] ?? undefined} className={`pmenu-btn ${which === id ? 'on' : ''} ${dot[id] && which !== id ? 'todo' : ''}`} onClick={() => { setWhich(id); play('tap') }}>
              <span className="pmenu-icon">{icon}</span>
              <b>{name}</b>
            </button>
          ))}
        </nav>
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
          {game.v13 && (
            <>
              <span className="k-label shelf-label">Battle items · X items boost one kind of work for a day; Dire Hit, Guard Spec, Honey</span>
              <Shelf game={game} offers={battleShelf(game.today.day).filter((o) => !isShelved(game, BOOST[o.item]?.tag ?? ''))} shop="mart" fold={game.v16 ? 6 : 3} what="battle items" />
            </>
          )}
        </Win>
      )}
      {show('rare') && (
        <Win title="Rare things" tone="blue" aside={<><Gem size={22} /> <Count value={game.wallet.gems} /></>}>
          <Shelf game={game} offers={game.v13 ? [...RARE_SHELF, ...RARE_SHELF_V13] : RARE_SHELF} shop="rare" />
        </Win>
      )}
      {show('rare') && <IncenseWin game={game} />}
      {show('bp') && (
        <Win title="BP Exchange" tone="purple" aside={<><BpIcon size={22} /> {game.wallet.bp.toLocaleString('en-IN')} BP</>}>
          <span className="k-label shelf-label">Held items · each one does something of its own</span>
          <Shelf game={game} offers={BP_SHELF.filter((o) => ITEMS[o.item]?.kind === 'held')} shop="bp" />
          <span className="k-label shelf-label">Battle items, evolution items and a Rare Candy</span>
          <Shelf game={game} offers={BP_SHELF.filter((o) => ['battle', 'evo', 'candy'].includes(ITEMS[o.item]?.kind))} shop="bp" fold={6} what="of them" />
          <span className="k-label shelf-label">Fossils · the Lab brings them back</span>
          <Shelf game={game} offers={BP_SHELF.filter((o) => ITEMS[o.item]?.kind === 'fossil')} shop="bp" />
          <span className="k-label shelf-label">Legend keys · each calls a legend as the next wild Pokemon</span>
          <Shelf game={game} offers={BP_SHELF.filter((o) => ITEMS[o.item]?.kind === 'legend' || o.item === 'master-ball')} shop="bp" fold={6} what="legend keys" />
        </Win>
      )}
      {show('collector') && <CollectorWin game={game} />}
      {show('lab') && <LabWin game={game} />}
      {which === 'marks' && <MarkShops game={game} />}
    </>
  )
}

// ── the bag: what is held, carried and burning ──────────────────────────────
/** Where each kind of thing is used, in a line: shown on its card. */
const USED: Record<string, string> = {
  ball: 'Thrown at the wild Pokemon, or at the weekly boss once it is weak, from Today.',
  berry: 'Fed to any of your Pokemon for hearts.',
  held: 'Held by your partner, one at a time: it adds to its kind of work.',
  tm: 'Carried by your partner: each counts as one of its types against a leader.',
  shard: 'Three of one colour forge a Mega Stone in the Forge on this tab.',
  key: 'Needed before the Forge can make a Mega Stone.',
  unique: 'Kept for good: no shop sells it.',
  gear: "A piece of Strong's training kit: a full set of seven pays gems and Iron.",
  guard: 'Used on Today, when the wild Pokemon is about to flee or a leader has won HP back.',
  lure: 'Shows three Pokemon of its kind of work: the one you tap is the next wild Pokemon.',
  incense: 'Shows three Pokemon of any type: the one you tap is the next wild Pokemon.',
  egg: 'Warmed by the steps your band counts, in the Nursery on Today. With two kinds waiting, you choose which goes in.',
  chest: 'Opens the moment it is bought.',
  theme: 'Changes the scene on Today.',
  treasure: 'Sold to the Collector in the Shop.',
  fossil: `Brought back to life at the Lab in the Shop, for ${REVIVE_COST} coins.`,
  evo: 'Used on a Pokemon in My Pokemon, from its page: one stage, if the type fits.',
  vitamin: 'Given to a Pokemon from its page (or here, to your partner): for good.',
  battle: 'Used on Today, under Battle prep: it counts for the whole day.',
  field: 'Used here or on Today: the next wild Pokemon is a rare one.',
  candy: 'Given to a Pokemon in My Pokemon, from its page.',
  legend: 'Used here or under Legend quests on the Journey tab.',
}
const GROUPS: [string, (id: string) => boolean][] = [
  ['Balls', (id) => ITEMS[id]?.kind === 'ball'],
  ['Berries', (id) => ITEMS[id]?.kind === 'berry'],
  ['Held items', (id) => id in HELD],
  ['TMs', (id) => ITEMS[id]?.kind === 'tm'],
  ['Battle items', (id) => ['battle', 'field'].includes(ITEMS[id]?.kind)],
  ['Vitamins and candy', (id) => ['vitamin', 'candy'].includes(ITEMS[id]?.kind)],
  ['Evolution items', (id) => ITEMS[id]?.kind === 'evo'],
  ['Legend keys', (id) => ITEMS[id]?.kind === 'legend'],
  ['Fossils', (id) => ITEMS[id]?.kind === 'fossil'],
  ['Treasures', (id) => ITEMS[id]?.kind === 'treasure'],
  ['Keepsakes', (id) => ['shard', 'key', 'unique'].includes(ITEMS[id]?.kind)],
]

/** A count as a slot shows it: 1.2k, 16k. */
const short = (n: number): string => (n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.floor(n / 1000)}k`)

export function Bag({ game }: { game: Game }) {
  const [open, setOpen] = useState<string | null>(null)
  const [tab, setTab] = useState('Everything')
  const [feedCard, setFeedCard] = useState<string | null>(null)
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
  const badges = badgesWon(game)
  // each badge won lies in the Bag as a thing of its own: in the Badges pocket and among everything
  const badgeIds = LEAGUES.flatMap((l, index) => l.gyms.flatMap((_, i) => (badgeWon(game.league, index, i) ? [`badge:${index}:${i}`] : [])))
  const ordered = [...groups.flatMap(([, ids]) => ids), ...rest, ...badgeIds]
  // where each thing lies (kept on this device): what was left, made to fit what is owned now
  const [saved, setSaved] = useState<Layout>(loadLayout)
  const orderKey = ordered.join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => reconcile(saved, ordered), [saved, orderKey])
  const saveNow = (l: Layout) => { setSaved(l); storeLayout(l) }
  useEffect(() => { if (JSON.stringify(layout) !== JSON.stringify(saved)) saveNow(layout) }, [layout, saved])
  const tabs: [string, string[]][] = [['Everything', ordered], ...groups.map(([n, ids]) => [n, ids] as [string, string[]]), ...(rest.length ? [['Everything else', rest] as [string, string[]]] : []), ...(badgeIds.length ? [['Badges', badgeIds] as [string, string[]]] : [])]
  const at = tabs.find(([n]) => n === tab) ?? tabs[0]
  const all = at[0] === 'Everything'
  // what a pocket draws: every slot of the layout (Everything), or its things in the order they lie, then empty slots
  const cells: (string | null)[] = all
    ? Array.from({ length: slotCount(layout) }, (_, i) => layout[i] ?? null)
    : (() => { const c: (string | null)[] = [...at[1]].sort((x, y) => layout.indexOf(x) - layout.indexOf(y)); while (c.length < Math.max(18, Math.ceil(c.length / 9) * 9)) c.push(null); return c })()
  const nameOfThing = (id: string): string => {
    if (!id.startsWith('badge:')) return itemName(id)
    const [li, gi] = id.split(':').slice(1).map(Number)
    return badgeName(LEAGUES[li].gyms[gi])
  }
  // arranging: drag a thing (mouse, or a held touch) or, in Arrange mode, tap it and then tap where it goes
  const [arrange, setArrange] = useState(false)
  const [carry, setCarry] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; over: number | null } | null>(null)
  /** Put `id` on a cell: an empty cell only in Everything (elsewhere the cells are not places), another thing's cell swaps with it. */
  const dropOn = (id: string, cell: number): boolean => {
    const there = cells[cell] ?? null
    const target = there !== null ? layout.indexOf(there) : all ? cell : -1
    if (target < 0 || there === id) return false
    glide.current = true
    saveNow(moveTo(layout, id, target))
    play('tap')
    return true
  }
  const live = useRef(dropOn)
  live.current = dropOn
  const held = useRef<string | null>(null)
  const hooks = useMemo<DragHooks>(() => ({
    begin: (id) => { held.current = id; setCarry(null); setDrag({ id, over: null }) },
    hover: (t) => setDrag((d) => (d ? { ...d, over: t && t !== 'lab' ? t.slot : null } : d)),
    drop: (id, t) => (t && t !== 'lab' ? live.current(id, t.slot) : false),
    end: () => { held.current = null; setDrag(null) },
  }), [])
  const glide = useRef(false)
  useFlip(held, glide)
  const press = (id: string) => (e: ReactPointerEvent<HTMLElement>) => startPress({ x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, button: e.button }, id, e.currentTarget, hooks)
  const tap = (id: string, i: number) => {
    if (!arrange) { setOpen(id); play('tap'); return }
    if (carry === null) { setCarry(id); play('click'); return }
    if (carry === id) { setCarry(null); return }
    if (dropOn(carry, i)) setCarry(null)
  }
  const cell = (id: string | null, i: number) => {
    const cls = `${drag && drag.over === i && drag.id !== id ? 'over' : ''} ${drag?.id === id ? 'held' : ''} ${carry === id && id !== null ? 'carried' : ''}`
    if (id === null) return <Slot as="span" key={`b${i}`} className={`blank ${cls} ${drag || carry ? 'drop' : ''}`} data-place={i} onClick={carry ? () => { if (dropOn(carry, i)) setCarry(null) } : undefined} aria-hidden />
    if (id.startsWith('badge:')) {
      const [li, gi] = id.split(':').slice(1).map(Number)
      const l = LEAGUES[li], t = l.gyms[gi]
      return (
        <Slot key={id} className={`medal ${cls}`} data-place={i} data-flip={id} onPointerDown={press(id)} onClick={() => tap(id, i)} aria-label={`${badgeName(t)}, ${l.name}. Open`}
          icon={<GymBadge art={badgeArt(li, gi)} on n={gi + 1} size={32} title="" />} tip={{ title: badgeName(t), note: <>{l.name} · won from {t.name}</> }} />
      )
    }
    const on = game.partner.held === id || equipped.includes(id) || game.theme === id
    const n = have(id)
    return (
      <Slot key={id} className={cls} on={on} data-place={i} data-flip={id} onPointerDown={press(id)} onClick={() => tap(id, i)} aria-label={`${itemName(id)}, ${n || 'held'}${on ? ', in use' : ''}. Open`}
        icon={<ItemIcon id={id} size={32} />} n={n > 1 ? short(n) : null} tip={{ title: itemName(id), note: <>{on ? (game.theme === id ? 'In use' : 'Equipped') : `×${n}`} · {ITEMS[id].text}</> }} />
    )
  }
  useEffect(() => {
    if (!carry) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCarry(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [carry])
  const card = open && ITEMS[open] ? open : null
  const badgeOpen = open?.startsWith('badge:') ? open : null
  const kind = card ? ITEMS[card].kind : null
  const fill = (n: number, min: number) => Array.from({ length: Math.max(min, Math.ceil(n / 9) * 9) - n }, (_, i) => <Slot as="span" key={`f${i}`} className="blank" aria-hidden />)
  const purse: [ReactNode, string, number, number][] = [
    [<Coin size={30} />, 'Coins', game.wallet.coins, game.wallet.coinsToday],
    [<Gem size={30} />, 'Gems', game.wallet.gems, game.wallet.gemsToday],
    // every mark you hold stays in the Bag, shelved or not: only the shop is out of sight (version 18)
    ...MARK_TAGS.map((t) => [<MarkIcon tag={t} size={30} />, `${MARKS[t].name} · spent in ${DOMAIN_SHOPS[t].name}${isShelved(game, t) ? ' (shelved)' : ''}`, game.wallet.marks[t], game.wallet.marksToday[t]] as [ReactNode, string, number, number]),
    // Battle Points are money too: the Frontier pays them, the BP Exchange takes them. Held ones show even if the league is not open yet.
    ...(game.v13 || game.wallet.bp > 0 ? [[<BpIcon size={30} />, 'Battle Points · spent at the BP Exchange', game.wallet.bp, game.wallet.bpToday] as [ReactNode, string, number, number]] : []),
  ]
  return (
    <Win title="Bag" tone="purple" aside={balls || berries ? <>{balls > 0 && `${balls} ${balls === 1 ? 'ball' : 'balls'}`}{balls > 0 && berries > 0 && ' · '}{berries > 0 && `${berries} ${berries === 1 ? 'berry' : 'berries'}`}</> : game.keyStone ? <><ItemIcon id="key-stone" size={22} /> Key Stone</> : undefined}>
      <div className="inv">
        {(owned.length > 0 || badges > 0) && (
          <div className="inv-tabs" role="tablist" aria-label="Bag pockets" data-noswipe>
            {tabs.map(([name, ids]) => (
              <button key={name} type="button" role="tab" aria-selected={at[0] === name} className={`inv-tab ${at[0] === name ? 'on' : ''}`} onClick={() => { setTab(name); play('click') }} title={`${name} · ${ids.length}`}>
                {name === 'Badges' ? <ItemIcon id="town-map" size={26} /> : <ItemIcon id={name === 'Everything' ? 'seal-bag' : ids[0]} size={26} />}
              </button>
            ))}
          </div>
        )}
        <div className="inv-panel">
          <div className="inv-bar">
            <span className="inv-title">{carry ? `Carrying ${nameOfThing(carry)}: tap a slot` : at[0] === 'Badges' ? `Badges · ${badges}` : owned.length ? (at[0] === 'TMs' ? `TMs · ${equipped.length} of ${TM_SLOTS} on ${nameOf(game.partner.form)}` : at[0] === 'Held items' ? `Held items · ${nameOf(game.partner.form)} holds one` : at[0]) : 'Inventory'}</span>
            <span className="inv-btns">
              <button type="button" className={`inv-btn ${arrange ? 'on' : ''}`} aria-pressed={arrange} onClick={() => { setArrange(!arrange); setCarry(null); play('click') }} title="Tap a thing to pick it up, tap a slot to put it down. You can also drag a thing (hold it on a touch screen).">Arrange</button>
              <button type="button" className="inv-btn" onClick={() => { glide.current = true; saveNow(tidy(ordered)); setCarry(null); play('click') }} title="Lay everything down again in order, with no gaps">Tidy</button>
            </span>
          </div>
          {owned.length === 0 && badges === 0 && <p className="inv-empty">No items yet. The Mart opens each morning, and feats hand out the rest.</p>}
          <div className={`inv-grid ${arrange ? 'arranging' : ''}`}>{cells.map(cell)}</div>
          <span className="inv-title">Money and marks</span>
          <div className="inv-grid inv-hotbar">
            {purse.map(([icon, name, n, today], i) => (
              <Slot as="span" key={i} tabIndex={0} aria-label={`${name}: ${n.toLocaleString('en-IN')}${today > 0 ? `, +${today} today` : ''}`}
                icon={icon} n={short(n)} tip={{ title: name, note: <>{n.toLocaleString('en-IN')}{today > 0 ? ` · +${today} today` : ''}</> }} />
            ))}
            {fill(purse.length, 9)}
          </div>
        </div>
      </div>
      {badgeOpen && (() => {
        const [li, gi] = badgeOpen.split(':').slice(1).map(Number)
        const l = LEAGUES[li], t = l.gyms[gi]
        return (
          <Sheet title={badgeName(t)} onClose={() => setOpen(null)}>
            <div className="ware-sheet">
              <span className="ware-sheet-art"><GymBadge art={badgeArt(li, gi)} on n={gi + 1} size={96} title={badgeName(t)} /></span>
              <h2 className="k-type">{badgeName(t)}</h2>
              <p>Won from {t.name}, {l.name}.</p>
              <p className="muted">Badges lie in the Bag with everything else. Drag one, or use Arrange, to put it where you like.</p>
            </div>
          </Sheet>
        )
      })()}
      {card && kind && (
        <Sheet title={itemName(card)} onClose={() => setOpen(null)}>
          <div className="ware-sheet">
            {/* the thing itself as a card: its kind is the field's colour, how many you hold the banner, in use the gold frame */}
            <div className="item-hero">
              <ObjCard className="item-card" look="full" tc={catColor(kind)} metal={game.partner.held === card || equipped.includes(card) || game.theme === card ? 'gold' : 'silver'}
                art={<ItemIcon id={card} size={72} className="mc-item" />} banner={have(card) > 0 ? `×${have(card)}` : 'Held'} disabled tabIndex={-1} aria-hidden />
              <div className="item-hero-txt">
                <h2 className="k-type">{itemName(card)}</h2>
                <p>{ITEMS[card].text}</p>
                <small className="sr-only">{have(card) > 0 ? `You have ${have(card)}` : 'Held by your partner'}</small>
                <p className="muted">{USED[kind]}</p>
              </div>
            </div>
            {kind === 'berry' && (game.v14
              ? <button type="button" className="k-btn ok big" onClick={() => { setFeedCard(card); setOpen(null) }}>Feed it to…</button>
              : <button type="button" className="k-btn ok big" onClick={() => { useItem(card, '', 'feed'); play('feed'); if (have(card) <= 1) setOpen(null) }}>Feed it now</button>)}
            {kind === 'held' && (() => {
              const on = game.partner.held === card
              return <KButton tone={on ? 'neutral' : 'main'} big onClick={() => { useItem(on ? '' : card, '', 'hold', on ? '' : card); play('tap'); setOpen(null) }}>{on ? 'Take it off' : `Give it to ${nameOf(game.partner.form)}`}</KButton>
            })()}
            {kind === 'tm' && <KButton tone={equipped.includes(card) ? 'neutral' : 'main'} big onClick={() => { toggleTm(card); setOpen(null) }}>{equipped.includes(card) ? 'Take it off' : `Equip on ${nameOf(game.partner.form)}`}</KButton>}
            {kind === 'theme' && <KButton tone={game.theme === card ? 'neutral' : 'main'} big onClick={() => { useItem('', '', 'theme', game.theme === card ? undefined : card); setOpen(null) }}>{game.theme === card ? 'Take it off' : 'Use this scene'}</KButton>}
            {card === 'max-repel' && <button type="button" className="k-btn main big" disabled={!(game.wild && !game.wild.caught && !game.wild.repel)} onClick={() => { useItem('max-repel', '', 'repel'); play('tap'); setOpen(null) }}>Use on the wild Pokemon</button>}
            {kind === 'treasure' && <button type="button" className="k-btn ok big" onClick={() => { useItem(card, '', 'sell', String(have(card))); play('buy'); setOpen(null) }}>Sell {have(card) > 1 ? `all ${have(card)} ` : ''}for <Coin size={18} />{(treasurePrice(card, game.today.day) * have(card)).toLocaleString('en-IN')}{treasurePrice(card, game.today.day) > TREASURE[card][1] ? ' (wanted today: ×2)' : ''}</button>}
            {kind === 'fossil' && <button type="button" className="k-btn main big" disabled={game.wallet.coins < REVIVE_COST} onClick={() => { useItem(card, '', 'fossil'); play('catch'); setOpen(null) }}>Revive it: {nameOf(FOSSILS[card].species)} (<Coin size={16} />{REVIVE_COST})</button>}
            {kind === 'vitamin' && <button type="button" className="k-btn main big" onClick={() => { useItem(card, game.partner.uid, 'vitamin'); play('feed') }}>Give it to {nameOf(game.partner.form)}</button>}
            {kind === 'vitamin' && game.v14 && <p className="muted">Or give it to a party member from its page in Party: a third as strong there, and it stays when the partner moves on.</p>}
            {kind === 'battle' && <button type="button" className="k-btn main big" disabled={card === 'guard-spec' ? game.guard : Boolean(BOOST[card] && (game.today.boost?.[BOOST[card].tag] ?? 0) >= BOOST[card].add)} onClick={() => { useItem(card, '', card === 'guard-spec' ? 'guard' : 'boost'); play('tap'); setOpen(null) }}>{card === 'guard-spec' ? (game.guard ? 'Already on guard' : 'Stand guard') : 'Use it today'}</button>}
            {kind === 'field' && <button type="button" className="k-btn main big" disabled={Boolean(game.wish.chosen)} onClick={() => { useItem(card, '', 'honey'); play('tap'); setOpen(null) }}>{game.wish.chosen ? `${nameOf(game.wish.chosen)} is coming next` : 'Spread it'}</button>}
            {kind === 'legend' && <button type="button" className="k-btn main big" disabled={Boolean(game.wish.chosen)} onClick={() => { useItem(card, '', 'summon'); play('catch'); setOpen(null) }}>{game.wish.chosen ? `${nameOf(game.wish.chosen)} is coming next` : `Call ${LEGEND_KEYS[card].forms.length > 1 ? 'a legend' : nameOf(LEGEND_KEYS[card].forms[0])}`}</button>}
            {(kind === 'evo' || kind === 'candy') && (() => {
              const fits = game.queue.filter((m) => (kind === 'candy' ? true : evolutionsFor(game, m).some((e) => e.item === card)))
              return fits.length ? (
                <div className="kit-row">{fits.slice(0, 8).map((m) => {
                  const into = kind === 'evo' ? evolutionsFor(game, m).find((e) => e.item === card)?.form : undefined
                  return <button key={m.uid} type="button" className="k-btn" onClick={() => { useItem(card, m.uid, kind === 'evo' ? 'evolve' : 'candy', into); play(kind === 'evo' ? 'catch' : 'feed'); if (kind === 'evo') setOpen(null) }}><img src={still(m.form, m.shiny)} alt="" width={28} height={28} className="sprite" />{nameOf(m.form)}{into ? ` → ${nameOf(into)}` : ` Lv ${levelOf(m.xp)}`}</button>
                })}</div>
              ) : <small className="muted">{kind === 'evo' ? `Nobody in My Pokemon would evolve with it: the form it becomes must be ${EVO_ITEMS[card].types.join(' or ')}.` : 'Nobody in My Pokemon to give it to.'}</small>
            })()}
            {card === 'revive' && <button type="button" className="k-btn main big" disabled={game.league.slipped <= 0} onClick={() => { useItem('revive', '', 'revive'); play('tap'); setOpen(null) }}>Use on the leader</button>}
          </div>
        </Sheet>
      )}
      {feedCard && <FeedSheet game={game} only={feedCard} onClose={() => { setFeedCard(null); setOpen(null) }} />}
    </Win>
  )
}

// ── one Pokemon's own page ──────────────────────────────────────────────────
/** Everything about one of yours, and what can be done with it from where it stands. */
export function MonPage({ m, game, onClose }: { m: Mon; game: Game; onClose: () => void }) {
  const rec = SPECIES[m.form]
  const boxes = useBoxes()
  const inBox = game.queue.some((x) => x.uid === m.uid)
  const trained = Boolean(m.graduated)
  const isPartner = game.partner.uid === m.uid
  const inTeam = game.team.some((x) => x.uid === m.uid)
  const hearts = (m.together ?? 0) + (m.fed ?? 0)
  const v5 = true
  const act = (what: string) => { useItem('', m.uid, what); play('tap'); onClose() }
  const megas = rec.m ?? []
  const sell = SELL[rec.r ?? 'C'] ?? SELL.C
  const onDesk = game.research.desk.some((x) => x.uid === m.uid)
  // drawn on the page itself, not inside the tab: the tab slides in and would carry the window off with it
  return (
    <Sheet title={nameOf(m.form)} onClose={onClose}>
      <div className="monpage">
        {/* the page opens on the Pokemon's own card, a size up: level, bond, type and signature are on it already */}
        <div className="mp-hero">
          <MonCard mon={monCardOf(m, game)} look="full" size="hero" box={boxes?.[m.form]} role={isPartner ? 'partner' : inTeam ? 'party' : 'lab'} ribbon={isPartner ? 'Partner' : undefined} disabled tabIndex={-1} aria-hidden />
          <div className="mp-facts">
            <h2 className="k-type">{nameOf(m.form)}{m.shiny && <span className="chip">shiny</span>}</h2>
            <div className="mp-types">
              {[rec.t, rec.t2].filter(Boolean).map((t) => <span key={t} className="chip type"><img src={`/sprites/types/${t}.png`} alt="" width={14} height={14} onError={(e) => { e.currentTarget.style.display = 'none' }} />{t}</span>)}
              {(m.moves ?? []).map((id) => <span key={id} className="chip type tmchip"><ItemIcon id={id} size={16} />{tmType(id)}</span>)}
            </div>
            <ul className="mp-chips" aria-label="About it">
              <li className="where">{isPartner ? 'Your partner' : inTeam ? 'In the party' : game.v14 && game.research.desk.some((x) => x.uid === m.uid) ? 'On the research desk' : game.v14 ? 'With the Professor' : trained ? 'Fully trained' : 'In My Pokemon'}</li>
              <li className="sr-only">Level {levelOf(m.xp)}, {hearts} hearts</li>{/* drawn on the card already; said here for a screen reader, which skips the card */}
              {m.nature && <li>{m.nature.name}</li>}
              <li>{m.origin === 'egg' ? 'Hatched' : m.origin === 'starter' ? 'Starter' : m.origin === 'fossil' ? 'Revived' : 'Caught'} {fmtDay(m.from)}</li>
              {m.held && <li className="holdline"><ItemIcon id={m.held} size={24} />{itemName(m.held)}</li>}
            </ul>
          </div>
        </div>
        <div className="mp-body">
          {(game.v14 || isPartner) && <FeedBlock game={game} m={m} />}
          <RoleControl game={game} m={m} onDone={onClose} />
          {game.v16 && <SigLine m={m} game={game} />}
          {m.nature?.up && m.nature.down && <p className="muted">Raised most on {TAG_NAME[m.nature.up]}, least on {TAG_NAME[m.nature.down]}.</p>}
          {m.nature?.up && trained && <p className="muted">On the team it adds {Math.round(TEAM_BONUS * 100)}% to every strike and {Math.round(TEAM_NATURE * 100)}% more to {TAG_NAME[m.nature.up]} work.</p>}
          {m.ball && <p className="muted ballname">{m.thrown ? <BallItem id={m.thrown} size={20} /> : <Ball ball={m.ball} size={18} />}Caught in {m.thrown ? `a ${itemName(m.thrown)}` : aBall(m.ball)}.</p>}
          <div className="mp-line">
            {m.path.map((f, i) => <span key={f} className="path-step">{i > 0 && <span className="arrow">▸</span>}<img src={still(f, m.shiny)} alt={nameOf(f)} title={nameOf(f)} width={48} height={48} className="sprite" /></span>)}
            {(rec.e ?? []).length > 0 && <span className="path-step"><span className="arrow">▸</span>{rec.e!.slice(0, 3).map((f) => <img key={f} src={still(f)} alt="" width={48} height={48} className={`sprite ${game.dex[f] ? '' : 'unseen'}`} />)}</span>}
            {(m.megas ?? []).map((f) => <span key={f} className="path-step"><span className="arrow">★</span><img src={still(f, m.shiny)} alt={nameOf(f)} title={`${nameOf(f)}, for good`} width={48} height={48} className="sprite" /><MegaStone mega={f} size={22} /></span>)}
          </div>
          {megas.length > 0 && <p className="muted megaline">{(m.megas ?? []).length ? <>It holds {(m.megas ?? []).map((f) => <span key={f} className="megachip"><MegaStone mega={f} size={18} />{megaStoneName(f)}</span>)}, forged and kept for good.</> : <>It can hold {megas.map((f) => <span key={f} className="megachip"><MegaStone mega={f} size={18} />{megaStoneName(f)}</span>)}. Mega Stones are forged in the Forge on the Party tab, once the Key Stone is yours.</>}</p>}
          <MonExtras game={game} m={m} onDone={onClose} />
          {game.v14 && trained && !isPartner && <p className="muted">{levelOf(m.xp) >= MAX_LEVEL ? 'Level 100: it has nothing left to learn as a partner.' : `Fully trained. It can lead again to go on to level ${MAX_LEVEL}, or grow with the party's Exp. Share.`}</p>}
          <div className="kit-row">
            {inBox && !game.v14 && v5 && <button type="button" className="k-btn ok" onClick={() => act('transfer')}>To the Professor <Price coins={sell} /></button>}
            {game.v14 && !isPartner && !inTeam && <KButton tone={onDesk ? 'neutral' : 'main'} onClick={() => { putOnDesk(game, m.uid, !onDesk); play('tap'); onClose() }}>{onDesk ? 'Off the research desk' : `On the research desk (+${studyValue(m)}/day)`}</KButton>}
          </div>
        </div>
      </div>
    </Sheet>
  )
}

// ── the Professor's research desk (version 14) ─────────────────────────────
/** What one Pokemon adds to the day's research on the desk (studyPoints in rules.ts). */
export const studyValue = (m: Mon): number => studyPoints(levelOf(m.xp), (SPECIES[m.form]?.r ?? 'C') as Rarity, m.shiny)
/** Put someone on the desk (the newest choice first: a full desk gives up its last place) or take them off. One `study` event holds the whole desk. */
function putOnDesk(game: Game, uid: string, on: boolean): void {
  const rest = game.research.desk.map((x) => x.uid).filter((id) => id !== uid)
  useItem('', '', 'study', (on ? [uid, ...rest].slice(0, RESEARCH_SLOTS) : rest).join(','))
}

/** The ball a Pokemon came in: what the box shows until it is opened. */
const BallOf = ({ m, size }: { m: Mon; size: number }) => (m.thrown ? <BallItem id={m.thrown} size={size} className="bbox-ball" /> : <Ball ball={m.ball ?? 'poke'} size={size} className="bbox-ball" />)

const PER_BOX = 30

/**
 * A storage box of Poke Balls: each Pokemon sits in the ball it was caught in. Tap a ball and it opens (the Pokemon pops out and
 * the panel under the box says who it is and what can be done); tap it again for its page. Thirty to a box, paged with the arrows.
 */
function BallBox({ mons, onOpen, note, actions, empty }: { mons: Mon[]; onOpen: (uid: string) => void; note?: (m: Mon) => ReactNode; actions?: (m: Mon) => ReactNode; empty: ReactNode }) {
  const boxes = Math.max(1, Math.ceil(mons.length / PER_BOX))
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  const at = Math.min(page, boxes - 1)
  const shown = mons.slice(at * PER_BOX, (at + 1) * PER_BOX)
  const picked = mons.find((m) => m.uid === sel) ?? null
  const turn = (d: number) => { setPage((at + d + boxes) % boxes); setSel(null); play('click') }
  if (mons.length === 0) return <p className="muted">{empty}</p>
  const said = picked && note ? note(picked) : null
  return (
    <div className="bbox">
      {boxes > 1 && (
        <div className="bbox-head">
          <button type="button" className="bbox-arrow" onClick={() => turn(-1)} aria-label="Previous box">‹</button>
          <span>Box {at + 1} of {boxes}</span>
          <button type="button" className="bbox-arrow" onClick={() => turn(1)} aria-label="Next box">›</button>
        </div>
      )}
      <div className="bbox-grid" key={at} data-noswipe>
        {shown.map((m) => {
          const open = m.uid === sel
          return (
            <button key={m.uid} type="button" className={`bbox-cell ${open ? 'open' : ''}`} aria-pressed={open} onClick={() => { if (open) onOpen(m.uid); else { setSel(m.uid); play('click') } }} title={open ? `${nameOf(m.form)}: open its page` : 'Tap to see who is inside'} aria-label={open ? `${nameOf(m.form)}, Lv ${levelOf(m.xp)}. Open its page` : `A ball: ${nameOf(m.form)}, Lv ${levelOf(m.xp)}`}>
              <BallOf m={m} size={34} />
              {open && <img src={still(m.form, m.shiny)} alt="" width={56} height={56} className="sprite bbox-mon" />}
            </button>
          )
        })}
      </div>
      <div className={`bbox-panel ${picked ? '' : 'idle'}`} aria-live="polite">
        {picked ? (
          <>
            <button type="button" className="bbox-panel-art" onClick={() => onOpen(picked.uid)} aria-label={`Open the page of ${nameOf(picked.form)}`}><img src={still(picked.form, picked.shiny)} alt="" width={72} height={72} className="sprite" /></button>
            <span className="bbox-panel-info">
              <b>{nameOf(picked.form)}{picked.shiny && <i className="pslot-shiny">★</i>}</b>
              <small>Lv {levelOf(picked.xp)} · {[SPECIES[picked.form].t, SPECIES[picked.form].t2].filter(Boolean).join(' / ')}{said ? <> · {said}</> : null}</small>
              <span className="bbox-panel-acts">
                <button type="button" className="k-btn" onClick={() => onOpen(picked.uid)}>Its page</button>
                {actions?.(picked)}
              </span>
            </span>
          </>
        ) : <small>Tap a ball to see who is inside.</small>}
      </div>
    </div>
  )
}

type PartyView = 'team' | 'lab' | 'items'

/** Party: three screens: the team (and the partner), the lab (or the box), and items (the Bag, the Forge, incense and choices). */
/** `under`: what stands under the six places (App's PartyNotes: the Feed button and the partner's state). */
export function TeamTab({ game, under, choices }: { game: Game; under: ReactNode; choices: ReactNode }) {
  const [page, setPage] = useState<string | null>(null)
  const [view, setView] = useState<PartyView>('team')
  const inTeam = new Set(game.team.map((m) => m.uid))
  const shown = [game.partner, ...game.queue, ...game.graduates].find((m) => m.uid === page)
  const cap = TEAM_SIZE
  const bench = game.graduates.filter((m) => !inTeam.has(m.uid))
  const items = Object.keys(game.inv).filter((id) => (game.inv[id] ?? 0) > 0 && ITEMS[id]).length
  const todo = tabTodo(game).team
  const menu: [PartyView, string, string, ReactNode][] = [
    ['team', 'Team', 'poke-ball', `${1 + game.team.length}/${cap + 1}`],
    ['lab', game.v14 ? 'Lab' : 'Box', game.v14 ? 'journal' : 'poke-ball', game.v14 ? `R${game.research.rank}` : game.queue.length || null],
    ['items', 'Items', 'seal-bag', items || null],
  ]
  return (
    <div className="partypage">
      <nav className="pmenu" style={{ ['--n' as string]: menu.length } as CSSProperties} role="tablist" aria-label="Party" data-noswipe>
        {menu.map(([id, name, icon, badge]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} title={id === 'items' && todo ? todo : undefined} className={`pmenu-btn ${view === id ? 'on' : ''} ${id === 'items' && todo && view !== id ? 'todo' : ''}`} onClick={() => { setView(id); play('tap') }}>
            <span className="pmenu-icon"><ItemIcon id={icon} size={30} />{badge !== null && <i className="pmenu-badge">{badge}</i>}</span>
            <b>{name}</b>
          </button>
        ))}
      </nav>
      <div className="pview" key={view}>
        {view === 'team' && (
          <>
            <TeamScreen game={game} onInfo={setPage} under={under} between={<><Deck game={game} />{game.v13 && <BondPerks game={game} />}</>} />
            {!game.v14 && bench.length > 0 && (
              <Win title="Fully trained, off the party" tone="dark" aside={String(bench.length)}>
                <BallBox mons={bench} onOpen={setPage} empty="" />
              </Win>
            )}
          </>
        )}
        {view === 'lab' && (game.v14 ? <ProfessorLab game={game} onOpen={setPage} /> : <MyPokemon game={game} onOpen={setPage} />)}
        {view === 'items' && <><Bag game={game} /><Forge game={game} /><IncenseWin game={game} />{choices}</>}
      </div>
      {shown && <MonPage m={shown} game={game} onClose={() => setPage(null)} />}
    </div>
  )
}

/**
 * Version 14: everyone not in the party lives with the Professor. Up to three sit on his research desk: on each day with a pillar he
 * studies them, by level and rarity, and each research rank takes HP off every wild Pokemon to come and sends a gift. So a strong
 * Pokemon is either fighting in the party (leaders and the boss) or helping you catch (the desk). Nobody is sold.
 */
function ProfessorLab({ game, onOpen }: { game: Game; onOpen: (uid: string) => void }) {
  return <ResearchTab game={game} onOpen={onOpen} studyValue={studyValue} />
}

/** Everything caught and not yet raised, oldest first, as balls in a box. */
function MyPokemon({ game, onOpen }: { game: Game; onOpen: (uid: string) => void }) {
  // whoever stands in the party is shown there, not here as well
  const inTeam = new Set(game.team.map((m) => m.uid))
  const waiting = game.queue.filter((m) => !inTeam.has(m.uid))
  return (
    <Win title="My Pokemon" tone="dark" aside={plural(waiting.length, 'Pokemon', 'Pokemon')}>
      <BallBox mons={waiting} onOpen={onOpen}
        empty={game.queue.length ? 'Everyone you have caught is in your party.' : 'Empty. Catch the wild Pokemon and it comes here.'} />
    </Win>
  )
}

/** A number that pops up and floats away: what today did to something. */
export function Pop({ value, className = '', style }: { value: number; className?: string; style?: CSSProperties }) {
  if (value <= 0) return null
  return <span key={value} className={`pop ${className}`} style={style} aria-hidden>−{value}</span>
}
