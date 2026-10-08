// The world: the Sunnyside scene, with the shops as its buildings, the ten
// leagues as places on it, cloud over the ones not open yet, and your trainer
// walking between them. Everything on it is a way into something that already
// exists elsewhere in the game; the map itself changes no rule.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { HAIRS, MARKS, hairId, type MarkTag, type ShopId } from '../core/economy.ts'
import { leaderOf, nameOf, type Game } from '../core/fold.ts'
import { LEAGUES, lineup } from '../core/gyms.ts'
import { GRADUATES_PER_REGION } from '../core/rules.ts'
import { Road, Win } from './App.tsx'
import { useItem } from './lib/store.ts'
import { ItemIcon, MarkIcon } from './Item.tsx'
import { KBar, KClose } from './Kit.tsx'
import { leagueName, still } from './lib/art.ts'
import { ShopTab } from './Play.tsx'

const W = 4434, H = 2470

/** Where each place is, as a percentage of the picture. */
interface Place { id: string; name: string; x: number; y: number; icon: string; mark?: MarkTag; shop?: ShopId; go?: 'team' | 'dex' | 'trainer' }
const PLACES: Place[] = [
  { id: 'mart', name: 'The Mart', x: 52, y: 47, icon: 'great-ball', shop: 'mart' },
  { id: 'code', name: 'Silph Co.', x: 37, y: 15, icon: MARKS.code.icon, mark: 'code', shop: 'code' },
  { id: 'fitness', name: 'The Dojo', x: 8, y: 92, icon: MARKS.fitness.icon, mark: 'fitness', shop: 'fitness' },
  { id: 'guitar', name: 'Music Hall', x: 18.5, y: 59, icon: MARKS.guitar.icon, mark: 'guitar', shop: 'guitar' },
  { id: 'arbor', name: 'The Farm', x: 16.5, y: 22, icon: MARKS.arbor.icon, mark: 'arbor', shop: 'arbor' },
  { id: 'routine', name: 'The Home', x: 30, y: 76, icon: MARKS.routine.icon, mark: 'routine', shop: 'routine' },
  { id: 'sleep', name: 'Dream House', x: 96, y: 41, icon: MARKS.sleep.icon, mark: 'sleep', shop: 'sleep' },
  { id: 'harbor', name: 'The Harbor', x: 84, y: 66, icon: 'rare-egg', shop: 'rare' },
  { id: 'lab', name: 'The Lab', x: 40.5, y: 43, icon: 'poke-ball', go: 'team' },
  { id: 'smithy', name: 'The Smithy', x: 66.5, y: 53, icon: 'key-stone', go: 'team' },
  { id: 'hall', name: 'Hall of Fame', x: 86, y: 12, icon: 'master-ball', go: 'trainer' },
  { id: 'library', name: 'The Library', x: 65, y: 5, icon: 'town-map', go: 'dex' },
]
/** The ten leagues, one place each. */
const LEAGUE_AT: { x: number; y: number }[] = [
  { x: 50, y: 66 }, { x: 5.5, y: 8 }, { x: 9, y: 45 }, { x: 29, y: 86 }, { x: 79, y: 31 },
  { x: 73, y: 49 }, { x: 27, y: 8 }, { x: 90, y: 80 }, { x: 60, y: 90 }, { x: 66, y: 22 },
]

const SCALES = [0.28, 0.4, 0.55, 0.75]

/** Cloud over a place that is not open: a few white puffs, so it reads as weather and not a box. */
function Fog({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <div className="fog" style={{ left: `${x}%`, top: `${y}%` }} role="img" aria-label={label}>
      <i /><i /><i /><i /><i />
      <span>{label}</span>
    </div>
  )
}

export function World({ game, go }: { game: Game; go: (t: 'partner' | 'team' | 'dex' | 'trainer') => void }) {
  const [scale, setScale] = useState(1)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)
  const [open, setOpen] = useState<Place | null>(null)
  const [leagueOpen, setLeagueOpen] = useState(false)
  const lg = Math.min(game.league.index, LEAGUES.length - 1)
  // the trainer stands just below its league's pin, not behind it
  const stand = (p: { x: number; y: number }) => ({ x: p.x + 2.4, y: p.y + 3.2 })
  // the journey: the trainer is on the road from this league's start to the next one's, as far along as the leaders beaten and the damage done to the one who is up
  const frac = (() => {
    const l = LEAGUES[lg]
    if (!l || game.league.index >= LEAGUES.length) return 1
    return Math.min(1, (game.league.slot + (game.league.max ? 1 - game.league.hp / game.league.max : 0)) / lineup(l).length)
  })()
  const from = LEAGUE_AT[lg], to = LEAGUE_AT[Math.min(lg + 1, LEAGUE_AT.length - 1)]
  const now = { x: from.x + (to.x - from.x) * frac, y: from.y + (to.y - from.y) * frac }
  const home = stand(now)
  const [at, setAt] = useState(home)
  useEffect(() => { setAt(home) }, [home.x, home.y]) // eslint-disable-line react-hooks/exhaustive-deps
  const [walking, setWalking] = useState<'l' | 'r' | null>(null)
  const w = Math.round(W * SCALES[scale]), h = Math.round(H * SCALES[scale])
  const v6 = game.version >= 6

  // centre on where the trainer stands, once
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.scrollLeft = (at.x / 100) * w - el.clientWidth / 2
    el.scrollTop = (at.y / 100) * h - el.clientHeight / 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale])

  const onDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || !box.current) return
    drag.current = { x: e.clientX, y: e.clientY, sl: box.current.scrollLeft, st: box.current.scrollTop }
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!drag.current || !box.current) return
    box.current.scrollLeft = drag.current.sl - (e.clientX - drag.current.x)
    box.current.scrollTop = drag.current.st - (e.clientY - drag.current.y)
  }
  const onUp = () => { drag.current = null }

  /** Walk to a place, then do what it does. */
  const visit = (p: { x: number; y: number }, then: () => void) => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    setWalking(p.x < at.x ? 'l' : 'r')
    setAt(p)
    const done = () => { setWalking(null); then(); setTimeout(() => setAt(home), 1500) }
    if (calm) done()
    else setTimeout(done, 450)
  }

  const league = LEAGUES[lg]
  const pace = game.days.slice(-7).reduce((n, d) => n + d.strike, 0) / 7
  const leader = leaderOf(game.league.index, game.league.slot)
  const isOpen = (i: number): boolean => {
    const l = LEAGUES[i]
    return l.region === null ? i <= game.league.index : l.region <= game.regions
  }
  const need = (i: number): string => {
    const r = LEAGUES[i].region
    if (r === null) return 'the league before it'
    return `${r - 1 > 0 ? `${GRADUATES_PER_REGION * (r - 1)} trained Pokemon and ` : ''}the ${LEAGUES.filter((l) => l.region !== null)[r - 2]?.name ?? 'last'} league`
  }
  const ripe = game.plots.filter((p) => p?.ripe).length
  const wild = game.wild && !game.wild.caught ? game.wild : null
  const buyable = (p: Place): boolean => {
    if (!v6) return false
    if (p.id === 'arbor' && ripe > 0) return true
    if (p.id === 'mart') return game.mart.deals.some((o) => !game.mart.bought.includes(o.item) && (o.coins ?? 0) <= game.wallet.coins)
    if (p.mark) return game.wallet.marks[p.mark] >= 6
    if (p.id === 'harbor') return game.wallet.gems >= 30
    return false
  }

  const tap = (p: Place) => visit(stand(p), () => (p.shop ? setOpen(p) : go(p.go!)))
  const hp = game.league.max > 0 ? game.league.hp / game.league.max : 0

  return (
    <>
      <Win title="The journey" tone="gold" aside={`${Math.min(game.league.slot, league.gyms.length)} / ${league.gyms.length} badges`}>
        <div className="journey">
          {leader?.sprite && <img src={`/sprites/trainers/${leader.sprite}.png`} alt="" width={56} height={56} className="sprite" />}
          <div>
            <b>{game.league.index >= LEAGUES.length ? 'Every league is yours' : `Next stop: ${leader?.name ?? 'the next leader'}`}</b>
            <small>{leagueName(lg)} league · stop {Math.min(game.league.slot + 1, lineup(league).length)} of {lineup(league).length}{game.league.waiting ? ' · waiting for the region to open' : ''}</small>
            <KBar value={Math.round((lg + frac) * 100)} max={LEAGUES.length * 100} label={`League ${Math.min(lg + 1, LEAGUES.length)} of ${LEAGUES.length}`} />
            <small>{pace > 0 && game.league.index < LEAGUES.length ? `About ${Math.ceil(game.league.hp / pace)} days to ${leader?.name ?? 'the next stop'} at this week's pace.` : 'The trainer walks as the work lands on the leader.'}</small>
          </div>
        </div>
      </Win>
      <Win title="The world" tone="blue" aside={
        <span className="zoom">
          <button type="button" className="k-btn" aria-label="Zoom out" disabled={scale === 0} onClick={() => setScale((s) => Math.max(0, s - 1))}>−</button>
          <button type="button" className="k-btn" aria-label="Zoom in" disabled={scale === SCALES.length - 1} onClick={() => setScale((s) => Math.min(SCALES.length - 1, s + 1))}>+</button>
        </span>
      }>
        <div ref={box} className="worldview" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} role="region" aria-label="Map of the world. Places are listed below it too.">
          <div className="worldmap" style={{ width: w, height: h }}>
            <img src="/world/scene.png" alt="" width={w} height={h} draggable={false} className="worldimg" />
            <svg className="route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <polyline className="all" points={LEAGUE_AT.map((p) => `${p.x},${p.y}`).join(' ')} vectorEffect="non-scaling-stroke" />
              <polyline className="walked" points={[...LEAGUE_AT.slice(0, lg + 1), now].map((p) => `${p.x},${p.y}`).join(' ')} vectorEffect="non-scaling-stroke" />
            </svg>
            {LEAGUES.map((l, i) => !isOpen(i) && <Fog key={l.name} x={LEAGUE_AT[i].x} y={LEAGUE_AT[i].y} label={`${l.name}: needs ${need(i)}`} />)}
            {PLACES.map((p) => (
              <button key={p.id} type="button" className={`place ${buyable(p) ? 'news' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => tap(p)} aria-label={p.name}>
                <ItemIcon id={p.icon} size={28} />
                <span>{p.name}</span>
                {p.id === 'arbor' && ripe > 0 && <em className="ripe">{ripe} ripe</em>}
              </button>
            ))}
            {wild && (
              <button type="button" className={`wildspot ${wild.leavesIn !== undefined && wild.leavesIn <= 3 ? 'leaving' : ''}`} style={{ left: '34%', top: '62%' }} onClick={() => visit(stand({ x: 34, y: 62 }), () => go('partner'))} aria-label={`Wild ${nameOf(wild.form)}`}>
                <img src={still(wild.form, wild.shiny)} alt="" width={44} height={44} className="sprite" />
                <b>Wild {nameOf(wild.form)}</b>
                <i className="pinhp"><KBar value={wild.hp} max={wild.max} kind={wild.hp / wild.max <= 0.2 ? 'hp low' : wild.hp / wild.max <= 0.5 ? 'hp mid' : 'hp'} /></i>
                {wild.leavesIn !== undefined && wild.leavesIn <= 3 && <small>{wild.leavesIn === 0 ? 'leaves tomorrow' : `leaves in ${wild.leavesIn + 1} days`}</small>}
              </button>
            )}
            {LEAGUES.map((l, i) => isOpen(i) && (
              <button key={l.name} type="button" className={`pin ${i < game.league.index ? 'done' : i === game.league.index ? 'now' : ''}`} style={{ left: `${LEAGUE_AT[i].x}%`, top: `${LEAGUE_AT[i].y}%` }} onClick={() => visit(stand(LEAGUE_AT[i]), () => { if (i === game.league.index) setLeagueOpen(true) })} aria-label={`${leagueName(i)} league`}>
                {i === game.league.index && leader?.sprite ? <img src={`/sprites/trainers/${leader.sprite}.png`} alt="" width={44} height={44} className="sprite" /> : <ItemIcon id={i < game.league.index ? 'master-ball' : 'poke-ball'} size={26} />}
                <b>{leagueName(i)}</b>
                {i === game.league.index && leader && <i className="pinhp"><KBar value={game.league.hp} max={game.league.max} kind={hp <= 0.2 ? 'hp low' : hp <= 0.5 ? 'hp mid' : 'hp'} /></i>}
              </button>
            ))}
            <div className={`trainer ${walking ? `walk ${walking}` : ''}`} style={{ left: `${at.x}%`, top: `${at.y}%`, ...(game.outfit ? { '--hi': `url(/world/char/${game.outfit}hair_idle_strip9.png)`, '--hw': `url(/world/char/${game.outfit}hair_walk_strip8.png)` } : {}) } as CSSProperties} aria-hidden>
              <span className="body" /><span className="hair" />
              <img src={still(game.display, game.partner.shiny)} alt="" width={40} height={40} className="buddy sprite" />
            </div>
          </div>
        </div>
        <p className="muted">Drag to look around. Tap a place to walk there. Cloud covers what is not open yet.</p>
      </Win>

      {(game.inv ? HAIRS.some((hh) => game.inv[hairId(hh)]) : false) && (
        <Win title="Your look" tone="dark">
          <div className="shopchips">
            {['', ...HAIRS.filter((hh) => game.inv[hairId(hh)])].map((hh) => <button key={hh || 'short'} type="button" className={`k-btn ${game.outfit === hh ? 'main' : ''}`} onClick={() => useItem('', '', 'outfit', hh)}>{hh ? `${hh[0].toUpperCase()}${hh.slice(1)} hair` : 'Short hair'}</button>)}
          </div>
        </Win>
      )}
      <Win title="Places" tone="dark">
        <ul className="placelist">
          {PLACES.map((p) => (
            <li key={p.id}>
              <button type="button" className={`k-btn ${buyable(p) ? 'ok' : ''}`} onClick={() => tap(p)}>
                <ItemIcon id={p.icon} size={26} />
                <span><b>{p.name}</b><small>{p.mark ? `${MARKS[p.mark].name}: ${game.wallet.marks[p.mark]}` : p.shop === 'mart' ? `${game.mart.deals.length - game.mart.bought.length} deals left today` : p.shop === 'rare' ? 'Mystery Egg, Full Incense, chests, themes' : p.id === 'arbor' && ripe > 0 ? `${ripe} ripe: ready to harvest` : p.id === 'lab' ? 'Your Box and the Professor' : p.id === 'smithy' ? 'Forge Mega Stones from shards' : p.id === 'hall' ? 'Leagues you have won' : 'Every Pokemon you have seen'}</small></span>
                {p.mark && <MarkIcon tag={p.mark} size={22} />}
              </button>
            </li>
          ))}
        </ul>
      </Win>

      {open && createPortal(
        <div className="recap" role="dialog" aria-modal="true" aria-label={open.name} onClick={() => setOpen(null)}>
          <div className="shopwin" onClick={(e) => e.stopPropagation()}>
            <KClose onClick={() => setOpen(null)} />
            <ShopTab game={game} only={open.shop} />
          </div>
        </div>,
        document.body,
      )}
      {leagueOpen && createPortal(
        <div className="recap" role="dialog" aria-modal="true" aria-label={`${league.name} league`} onClick={() => setLeagueOpen(false)}>
          <div className="shopwin" onClick={(e) => e.stopPropagation()}>
            <KClose onClick={() => setLeagueOpen(false)} />
            <Road game={game} />
            <p className="muted">{nameOf(game.partner.form)} and the team behind it hit {leader?.name ?? 'the leader'} with the day's work.</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
