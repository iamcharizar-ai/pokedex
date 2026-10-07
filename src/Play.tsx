// Version 5: the things you do. The wallet, the shop, throwing a ball, feeding
// a berry, the team, the Professor, incense, quests. Every one of them spends
// what the day's work earned, and is written to the ledger as one small event
// (store.useItem), so the game is still recomputed from the ledger alone.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { nameOf, spritePath, type Game, type Mon, type Quest } from '../core/fold.ts'
import { BALL_NAME, GEMS, HEART_LEVELS, SHOP, TEAM_BONUS, TEAM_SIZE, THEMES, THROW_HP, bondLevel, levelOf, type ShopItem } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { MonCard, TAG_NAME, Win, plural } from './App.tsx'
import { Ball } from './Ball.tsx'
import { KBar, KButton, KClose, KReveal } from './Kit.tsx'
import { aBall, fmtDay, still } from './lib/art.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

// ── icons, drawn here ───────────────────────────────────────────────────────
export const Coin = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="10" fill="#f5b800" stroke="#141a33" strokeWidth="2" /><circle cx="12" cy="12" r="6.5" fill="#ffd84a" stroke="#b8860b" strokeWidth="1.5" /><path d="M12 8.2v7.6M9.6 10h3.6a1.4 1.4 0 0 1 0 2.800H9.600" fill="none" stroke="#b8860b" strokeWidth="1.800" strokeLinecap="round" /></svg>
)
export const Gem = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M7 3h10l5 6-10 12L2 9z" fill="#3fd07a" stroke="#141a33" strokeWidth="2" strokeLinejoin="round" /><path d="M7 3l5 6 5-6M2 9h20M12 9v12" fill="none" stroke="#c9ffd9" strokeWidth="1.200" opacity="0.8" /></svg>
)
const Berry = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M12 6c5 0 8 3.500 8 8s-3.500 7-8 7-8-2.500-8-7 3-8 8-8z" fill="#e0559a" stroke="#141a33" strokeWidth="2" /><path d="M12 6c-1-2 .5-3.500 3-4M12 6c-2.500-.5-4-2-4-3.500" fill="none" stroke="#2fae66" strokeWidth="2.200" strokeLinecap="round" /><circle cx="9" cy="12" r="1.200" fill="#fff" opacity="0.7" /></svg>
)
const Incense = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M12 10c-3-2 2-3.500-1-6M15 9c-2-1.500 1-2.500-.5-4.500" fill="none" stroke="#c9d2f2" strokeWidth="1.800" strokeLinecap="round" /><path d="M5 13h14l-2 8H7z" fill="#7b5cf0" stroke="#141a33" strokeWidth="2" strokeLinejoin="round" /><rect x="4" y="11" width="16" height="3.500" rx="1.500" fill="#b9a6ff" stroke="#141a33" strokeWidth="2" /></svg>
)
const Heart = ({ on }: { on: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M12 21s-8-5.200-8-11a4.600 4.600 0 0 1 8-3 4.600 4.600 0 0 1 8 3c0 5.800-8 11-8 11z" fill={on ? '#ff6b78' : '#39405f'} stroke="#141a33" strokeWidth="2" strokeLinejoin="round" /></svg>
)
export const EggIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M12 2.500c4 0 7.500 6 7.500 11.500a7.500 7.500 0 0 1-15 0C4.500 8.500 8 2.500 12 2.500z" fill="#fbf6e3" stroke="#141a33" strokeWidth="2" /><path d="M8 9l2 2 2-2 2 2 2-2" fill="none" stroke="#7b5cf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9.500" cy="15" r="1.500" fill="#e0559a" /><circle cx="14.500" cy="17" r="1.200" fill="#63c6ff" /></svg>
)
const ChestIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v2H3z" fill="#c47a3c" stroke="#141a33" strokeWidth="2" strokeLinejoin="round" /><rect x="3" y="11" width="18" height="9" rx="1.5" fill="#e6a366" stroke="#141a33" strokeWidth="2" /><rect x="10" y="9.5" width="4" height="5" rx="1" fill="#f5b800" stroke="#141a33" strokeWidth="1.6" /><path d="M7 5.500v14M17 5.500v14" stroke="#141a33" strokeWidth="1.400" opacity="0.5" /></svg>
)
const THEME_SWATCH: Record<string, [string, string]> = { 'theme-beach': ['#58c8e8', '#f1dc9a'], 'theme-cave': ['#4a4466', '#8a7a6a'], 'theme-night': ['#121a3d', '#3d7a5c'] }
function ItemIcon({ item, size = 44 }: { item: string; size?: number }) {
  if (item === 'great-ball') return <Ball ball="great" size={size} />
  if (item === 'ultra-ball') return <Ball ball="ultra" size={size} />
  if (item === 'berry') return <Berry size={size} />
  if (item === 'incense') return <Incense size={size} />
  if (item === 'rare-egg') return <EggIcon size={size} />
  if (item === 'chest') return <ChestIcon size={size} />
  const [sky, ground] = THEME_SWATCH[item] ?? ['#7cc8ff', '#b6e08a']
  return <span className="swatch" style={{ width: size, height: size, background: `linear-gradient(${sky} 0 55%, ${ground} 55%)` }} />
}

/** What the wild Pokemon's HP will be once this ball lands. */
const wildHpAfter = (game: Game, item: ShopItem): number => (game.wild?.hp ?? 0) - (THROW_HP[item] ?? 0)

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

export const Price = ({ coins, gems }: { coins?: number; gems?: number }) => (
  <span className="price">{coins ? <><Coin size={20} />{coins.toLocaleString('en-IN')}</> : <><Gem size={20} />{gems}</>}</span>
)

// ── home: what you can do right now ─────────────────────────────────────────
/** Throw a ball at the wild Pokemon, or feed the partner. A thrown ball flies first, then lands. */
export function Actions({ game, onShop }: { game: Game; onShop: () => void }) {
  const [flying, setFlying] = useState<ShopItem | null>(null)
  const wild = game.wild && !game.wild.caught
  const throwIt = (item: ShopItem) => {
    if (flying) return
    setFlying(item)
    play('throw')
    // the ball is seen to fly, then the ledger is told and the HP falls
    setTimeout(() => { useItem(item, '', 'throw'); setFlying(null); play(wildHpAfter(game, item) <= 0 ? 'catch' : 'hit') }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650)
  }
  const balls = (['great-ball', 'ultra-ball'] as ShopItem[]).filter((b) => (game.inv[b] ?? 0) > 0)
  const hearts = (game.partner.together ?? 0) + (game.partner.fed ?? 0)
  return (
    <div className="actions">
      {flying && <span className="thrown" aria-hidden><Ball ball={flying === 'ultra-ball' ? 'ultra' : 'great'} size={44} /></span>}
      {balls.map((b) => (
        <button key={b} type="button" className="k-btn main act" disabled={!wild || Boolean(flying)} onClick={() => throwIt(b)}>
          <Ball ball={b === 'ultra-ball' ? 'ultra' : 'great'} size={30} />
          <span>Throw<small>−{THROW_HP[b]} HP · {game.inv[b]} left</small></span>
        </button>
      ))}
      {balls.length === 0 && (
        <button type="button" className="k-btn act" onClick={onShop}>
          <Ball ball="great" size={30} />
          <span>Get balls<small>from 150 coins</small></span>
        </button>
      )}
      <button type="button" className="k-btn ok act" disabled={!game.inv.berry} onClick={() => { useItem('berry', '', 'feed'); play('feed') }} title={game.inv.berry ? 'Feed your partner' : 'Berries are in the shop'}>
        <Berry size={30} />
        <span>Feed<small>{game.inv.berry ? `${game.inv.berry} left` : 'no berries'} · {hearts} ♥</small></span>
      </button>
    </div>
  )
}

function QuestRow({ q }: { q: Quest }) {
  return (
    <li className={`quest ${q.done ? 'done' : ''}`}>
      <span className="q-name">{q.name}</span>
      <KBar value={q.have} max={q.need} ready={q.done} label={q.done ? 'Done' : `${q.have.toLocaleString('en-IN')} / ${q.need.toLocaleString('en-IN')}`} />
      <Price coins={q.coins || undefined} gems={q.gems || undefined} />
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

// ── shop ────────────────────────────────────────────────────────────────────
export function ShopTab({ game }: { game: Game }) {
  const [bump, setBump] = useState<string | null>(null)
  // a chest opens the moment it is bought: show what was in the newest one, once
  const opened = game.moments.flatMap((m) => (m.kind === 'chest' ? [m] : []))
  const told = useRef(opened.length)
  const [loot, setLoot] = useState<(typeof opened)[number] | null>(null)
  useEffect(() => {
    if (opened.length > told.current) { setLoot(opened[opened.length - 1]); play('catch') }
    told.current = opened.length
  }, [opened.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (game.version < 5) return <Win title="Shop" tone="gold"><p className="muted">The shop opens with rules version 5.</p></Win>
  const buy = (item: ShopItem) => { useItem(item, '', 'buy'); play('buy'); setBump(item); setTimeout(() => setBump(null), 350) }
  const shelf = (items: ShopItem[]) => (
    <div className="shelf">
      {items.map((id) => {
        const e = SHOP[id], have = game.inv[id] ?? 0
        const owned = Boolean(e.once && have)
        const can = !owned && (e.coins ?? 0) <= game.wallet.coins && (e.gems ?? 0) <= game.wallet.gems
        const worn = game.theme === id
        return (
          <div key={id} className={`good ${bump === id ? 'bump' : ''}`}>
            {have > 0 && !e.once && <span className="held">×{have}</span>}
            <ItemIcon item={id} size={56} />
            <b>{e.name}</b>
            <small>{e.text}</small>
            {owned
              ? <KButton tone={worn ? 'neutral' : 'main'} onClick={() => useItem('', '', 'theme', worn ? undefined : id)}>{worn ? 'Take off' : 'Use'}</KButton>
              : <button type="button" className="k-btn ok" disabled={!can} onClick={() => buy(id)}><Price coins={e.coins} gems={e.gems} /></button>}
          </div>
        )
      })}
    </div>
  )
  return (
    <>
      <Win title="For catching" tone="gold" aside={<><Coin size={22} /> <Count value={game.wallet.coins} /></>}>{shelf(['great-ball', 'ultra-ball', 'berry'])}</Win>
      <Win title="Rare things" tone="blue" aside={<><Gem size={22} /> <Count value={game.wallet.gems} /></>}>
        {shelf(['chest', 'rare-egg', 'incense', ...THEMES])}
        {game.egg && <div className="eggrow"><span className="warm"><EggIcon size={44} /></span><div style={{ flex: 1 }}><span className="k-label">An egg is being kept warm</span><KBar value={game.egg.have} max={game.egg.need} kind="gold" label={`${game.egg.have} / ${game.egg.need} days with two pillars`} /></div></div>}
      </Win>
      {game.inv.incense > 0 && (
        <Win title="Incense" tone="green" aside={game.wish.chosen ? 'Chosen' : 'Pick one'}>
          <div className="queue pick">
            {game.wish.options.map((f, i) => (
              <button key={`${f}${i}`} type="button" aria-pressed={game.wish.chosen === f} className={game.wish.chosen === f ? 'on' : ''} disabled={Boolean(game.wish.chosen)} onClick={() => useItem('incense', '', 'wish', f)} title={nameOf(f)}>
                <img src={still(f)} alt={nameOf(f)} width={72} height={72} className={`sprite ${game.dex[f] ? '' : 'unseen'}`} />
              </button>
            ))}
          </div>
          <p className="muted">{game.wish.chosen ? `${nameOf(game.wish.chosen)} is the next wild Pokemon.` : 'The one you tap appears next.'}</p>
        </Win>
      )}
      {loot && createPortal(
        <div className="recap" role="dialog" aria-modal="true" aria-label="What was in the chest" onClick={() => setLoot(null)}>
          <div className="rc-win"><div className="rc-body">
            <div className="rc-eyebrow">Chest {loot.n}</div>
            <KReveal tier={loot.item === 'incense' ? 'rare' : loot.item === 'ultra-ball' ? 'big' : 'ordinary'} title={loot.coins ? `${loot.coins} coins` : `${SHOP[loot.item as ShopItem]?.name}${loot.count > 1 ? ` ×${loot.count}` : ''}`} replay={loot.n}>
              {loot.coins ? <Coin size={96} /> : <ItemIcon item={loot.item} size={96} />}
            </KReveal>
            <button type="button" className="go" autoFocus>Continue</button>
          </div></div>
        </div>,
        document.body,
      )}
      <Win title="How you earn" tone="dark">
        <ul className="earn">
          <li><Coin size={22} /><b>1</b> for each XP of the day's work</li>
          <li><Coin size={22} /><Gem size={22} /> daily and weekly quests</li>
          <li><Gem size={22} /><b>{GEMS.catch}</b> a catch · <b>{GEMS.evolve}</b> an evolution · <b>{GEMS.gym}</b> a badge</li>
          <li><Gem size={22} /><b>{GEMS.transfer}</b> for each Pokemon sent to the Professor</li>
        </ul>
      </Win>
    </>
  )
}

// ── one Pokemon's own page ──────────────────────────────────────────────────
/** Everything about one of yours, and what can be done with it from where it stands. */
function MonPage({ m, game, onClose }: { m: Mon; game: Game; onClose: () => void }) {
  const rec = SPECIES[m.form]
  const inBox = game.queue.some((x) => x.uid === m.uid)
  const trained = Boolean(m.graduated)
  const isPartner = game.partner.uid === m.uid
  const inTeam = game.team.some((x) => x.uid === m.uid)
  const hearts = (m.together ?? 0) + (m.fed ?? 0)
  const v5 = game.version >= 5
  const setTeam = () => {
    const ids = inTeam ? game.team.filter((x) => x.uid !== m.uid).map((x) => x.uid) : [...game.team.map((x) => x.uid), m.uid].slice(-TEAM_SIZE)
    useItem('', '', 'team', ids.join(','))
  }
  const act = (what: string) => { useItem('', m.uid, what); play('tap'); onClose() }
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
            <span className="chip where">{isPartner ? 'Your partner' : trained ? (inTeam ? 'On the team' : 'Fully trained') : 'In the Box'}</span>
          </div>
          <div className="mp-tiles">
            <div className="k-tile"><span className="k-label">Level</span><b>{levelOf(m.xp)}</b></div>
            <div className="k-tile"><span className="k-label">Hearts</span><b>{hearts} ♥</b></div>
            {m.nature && <div className="k-tile"><span className="k-label">Nature</span><b>{m.nature.name}</b></div>}
            <div className="k-tile"><span className="k-label">{m.origin === 'egg' ? 'Hatched' : m.origin === 'starter' ? 'Starter' : 'Caught'}</span><b>{fmtDay(m.from)}</b></div>
          </div>
          {m.nature?.up && m.nature.down && <p className="muted">Raised most on {TAG_NAME[m.nature.up]}, least on {TAG_NAME[m.nature.down]}.</p>}
          {m.ball && <p className="muted ballname"><Ball ball={m.ball} size={18} />Caught in {aBall(m.ball)}.</p>}
          <div className="mp-line">
            {m.path.map((f, i) => <span key={f} className="path-step">{i > 0 && <span className="arrow">▸</span>}<img src={still(f, m.shiny)} alt={nameOf(f)} title={nameOf(f)} width={48} height={48} className="sprite" /></span>)}
            {(rec.e ?? []).length > 0 && <span className="path-step"><span className="arrow">▸</span>{rec.e!.slice(0, 3).map((f) => <img key={f} src={still(f)} alt="" width={48} height={48} className={`sprite ${game.dex[f] ? '' : 'unseen'}`} />)}</span>}
            {(m.megas ?? []).map((f) => <span key={f} className="path-step"><span className="arrow">★</span><img src={still(f, m.shiny)} alt={nameOf(f)} title={`${nameOf(f)}, for good`} width={48} height={48} className="sprite" /></span>)}
          </div>
          <div className="kit-row">
            {inBox && <KButton tone="main" disabled={m.uid === game.nextUp} onClick={() => act('next')}>{m.uid === game.nextUp ? 'Next up' : 'Make next'}</KButton>}
            {inBox && game.version >= 4 && <KButton onClick={() => act('lead')}>Partner now</KButton>}
            {inBox && v5 && <button type="button" className="k-btn ok" onClick={() => act('transfer')}>To the Professor <Price gems={GEMS.transfer} /></button>}
            {trained && v5 && <KButton tone={inTeam ? 'neutral' : 'main'} onClick={() => { setTeam(); play('tap') }}>{inTeam ? 'Take off the team' : 'Put on the team'}</KButton>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── team ────────────────────────────────────────────────────────────────────
/** The partner's hearts, the three behind it, and the Box with what can be done to each one in it. */
export function TeamTab({ game, partnerCard, choices }: { game: Game; partnerCard: ReactNode; choices: ReactNode }) {
  const [page, setPage] = useState<string | null>(null)
  const hearts = (game.partner.together ?? 0) + (game.partner.fed ?? 0)
  const level = bondLevel(hearts)
  const nextAt = HEART_LEVELS[level]
  const inTeam = new Set(game.team.map((m) => m.uid))
  const shown = [game.partner, ...game.queue, ...game.graduates].find((m) => m.uid === page)
  const v5 = game.version >= 5
  return (
    <>
      <div className="tappable" onClick={() => setPage(game.partner.uid)} title="Open its page">{partnerCard}</div>
      <Win title="Bond" tone="green" aside={`${hearts} ♥`}>
        <div className="hearts">
          <span className="heartrow" aria-label={`Bond level ${level} of ${HEART_LEVELS.length}`}>{HEART_LEVELS.map((_, i) => <Heart key={i} on={i < level} />)}</span>
          <div style={{ flex: 1, minWidth: 140 }}><KBar value={nextAt ? hearts : 1} max={nextAt ?? 1} kind="gold" label={nextAt ? `${hearts} / ${nextAt}` : 'Full'} /></div>
          {v5 && <button type="button" className="k-btn ok" disabled={!game.inv.berry} onClick={() => { useItem('berry', '', 'feed'); play('feed') }}><Berry size={26} />Feed{game.inv.berry ? ` ×${game.inv.berry}` : ''}</button>}
        </div>
      </Win>
      {v5 && (
        <Win title="Team" tone="gold" aside={game.teamEdge ? `+${Math.round(game.teamEdge * TEAM_BONUS * 100)}% on this leader` : `${game.team.length} / ${TEAM_SIZE}`}>
          <div className="teamrow">
            {Array.from({ length: TEAM_SIZE }, (_, i) => {
              const m = game.team[i]
              return m
                ? <button key={m.uid} type="button" className="slot" onClick={() => setPage(m.uid)} title={nameOf(m.form)}><MonCard m={m} size={64} /></button>
                : <span key={i} className="slot empty" aria-label="Empty team place">+</span>
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
      <Win title="Box" tone="dark" aside={plural(game.queue.length, 'Pokemon', 'Pokemon')}>
        {game.queue.length === 0 ? <p className="muted">Empty. Catch the wild Pokemon and it comes here.</p> : (
          <>
            <div className="queue pick">
              {game.queue.map((m) => (
                <button key={m.uid} type="button" onClick={() => setPage(m.uid)} title={`${nameOf(m.form)}${m.ball ? ` · ${BALL_NAME[m.ball]}` : ''}`}>
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
