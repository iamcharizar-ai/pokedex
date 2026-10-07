import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { isGym, leaderOf, nameOf, spritePath, type Game, type Mon, type Moment, type Stats } from '../core/fold.ts'
import type { DayFacts, HabitFact } from '../core/facts.ts'
import { LEAGUES, lineup } from '../core/gyms.ts'
import {
  ADVANTAGE_MULT, GEMS, SEASON_STEP, V5_START, BALL_MULT, BALL_NAME, GAME_START, GRADUATES_PER_REGION, ITEM_NAME, KEY_STONE_BADGES, LEADER_HP, MEGA_DAYS, MOMENTUM_WINDOW,
  PILLARS_FOR_A_DAY, REGIONS, STAT_DAYS, TIER_XP, V4_START, WEAK_MULT,   SHOP, evolveAt, graduateAt, momentumMult, xpForLevel, type ShopItem,
} from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { beats } from '../core/types.ts'
import { Ball, KeyStone } from './Ball.tsx'
import { KBar, KMedal, KPill, KRibbon } from './Kit.tsx'
import { Actions, Coin, Count, Gem, Pop, Quests, ShopTab, TeamTab } from './Play.tsx'
import { Recap } from './Recap.tsx'
import { aBall, badgeArt, badgeName, fmtDay, leagueName, still } from './lib/art.ts'
import { play, setSoundOn, soundOn } from './lib/sfx.ts'
import { LIFEOS_URL, start, useItem, useView } from './lib/store.ts'
import './skin.css'

type Tab = 'partner' | 'team' | 'shop' | 'dex' | 'trainer'
const TABS: [Tab, string][] = [['partner', 'Home'], ['team', 'Team'], ['shop', 'Shop'], ['dex', 'Pokedex'], ['trainer', 'Trainer']]
export const TAG_NAME: Record<string, string> = { code: 'Code', fitness: 'Gym', guitar: 'Guitar', arbor: 'Arbor', sleep: 'Sleep', routine: 'Routine', balanced: 'Balance', health: 'Health tracker' }
const weekday = (day: string, len: 1 | 3 = 1) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: len === 1 ? 'narrow' : 'short' })
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
export const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`
const dexNo = (n: number) => String(n).padStart(3, '0')
const itemName = (item: string): string => ITEM_NAME[item] ?? item
const RARITY: Record<string, string> = { C: 'Common', U: 'Uncommon', R: 'Rare', L: 'Legendary' }
/** How far along its line a form is, as the card frame shows it: 1 bronze, 2 silver, 3 gold (it evolves no further). */
const frameOf = (form: string): 1 | 2 | 3 => (SPECIES[form]?.e?.length ? (SPECIES[form].s >= 2 ? 2 : 1) : 3)
export function MonCard({ m, form = m.form, size, level, bar, note }: { m: Mon; form?: string; size: number; level?: number; bar?: ReactNode; note?: string }) {
  const stage = frameOf(m.form)
  return (
    <span className={`mon ${m.megas?.length ? 'mega' : ''}`} style={{ width: size + 16 }}>
      <span className="mon-art" style={{ height: size + 6 }}>
        <img src={still(form, m.shiny)} alt={nameOf(form)} width={size} height={size} className="sprite" />
        {m.ball && <Ball ball={m.ball} size={Math.max(14, Math.round(size / 4.5))} className="mon-ball" />}
        {m.nature?.up && <span className="mon-gem" data-tag={m.nature.up} title={`${m.nature.name}: raised most on ${TAG_NAME[m.nature.up]}`} />}
      </span>
      <span className="mon-pips" title={stage === 3 ? 'Fully evolved' : `Stage ${stage}`} aria-hidden>{[1, 2, 3].map((n) => <i key={n} className={n <= stage ? 'on' : ''} />)}</span>
      {level !== undefined && <b className="mon-lv">Lv {level}</b>}
      {bar}
      {note && <small className="mon-note">{note}</small>}
    </span>
  )
}

/** Badges won so far, across every league. */
const badgesWon = (game: Game): number =>
  LEAGUES.reduce((n, l, i) => n + (i < game.league.index ? l.gyms.length : i === game.league.index ? Math.min(game.league.slot, l.gyms.length) : 0), 0)

function Sprite({ form, shiny, size, className = '' }: { form: string; shiny?: boolean; size: number; className?: string }) {
  return <img src={spritePath(form, shiny)} alt="" width={size} height={size} className={`sprite ${className}`} style={{ width: size, height: size }} />
}

/** A game window: coloured title strip over a cream body. */
export function Win({ title, aside, tone = '', children }: { title: string; aside?: ReactNode; tone?: '' | 'blue' | 'green' | 'gold' | 'dark'; children: ReactNode }) {
  return (
    <section className={`win ${tone ? `t-${tone}` : ''}`}>
      <header className="win-h"><h2>{title}</h2>{aside !== undefined && <span className="aside">{aside}</span>}</header>
      <div className="win-b">{children}</div>
    </section>
  )
}

/** An egg, drawn here pixel by pixel (no artwork is borrowed for it). */
const EGG = [
  '....oooo....', '...owwwwo...', '..owwggwwo..', '..owwggwwo..', '.owwwwwwwwo.', '.owgwwwwwgo.', 'owggwwwwwwwo',
  'owwwwwwggwwo', 'owwwwwwggwso', 'owwgwwwwwsso', '.owwwwwwsso.', '.oswwwwssso.', '..osssssso..', '...oooooo...',
]
const EGG_FILL: Record<string, string> = { o: '#23283a', w: '#fbf6e3', g: '#5fbf7a', s: '#ddd3b4' }
function Egg() {
  return (
    <svg className="egg" viewBox="0 0 12 14" shapeRendering="crispEdges" role="img" aria-label="An egg">
      {EGG.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={EGG_FILL[c]} />)))}
    </svg>
  )
}

// ── Partner: the battle screen ──────────────────────────────────────────────
const stateOf = (h: HabitFact): 'done' | 'part' | 'none' => (h.frac >= 1 ? 'done' : h.frac > 0 ? 'part' : 'none')
const label = (h: HabitFact): string => h.name?.trim() || TAG_NAME[h.tag] || h.id
function timeOfDay(): 'morning' | 'day' | 'dusk' | 'night' {
  const h = new Date().getHours()
  return h < 5 ? 'night' : h < 10 ? 'morning' : h < 17 ? 'day' : h < 20 ? 'dusk' : 'night'
}

function Scene({ game }: { game: Game }) {
  const { partner, today, wild } = game
  const pct = clamp01(game.into / game.need)
  const before = Math.min(pct, clamp01(game.intoBeforeToday / game.need))
  const hp = wild && wild.max ? wild.hp / wild.max : 0
  return (
    <section className={`scene ${game.theme || `tod-${timeOfDay()}`} ${game.aura ? `aura-${game.aura}` : ''}`} aria-label="Today, as a battle">
      {wild && (
        <>
          <div className="hpbox foe-box">
            <div className="hp-top">
              <span className="hp-name">{wild.caught ? nameOf(wild.form) : `Wild ${nameOf(wild.form)}`}{wild.shiny && <span className="chip">shiny</span>}{wild.rarity !== 'C' && <span className={`chip r-${wild.rarity}`}>{RARITY[wild.rarity]}</span>}</span>
              <span className="hp-lv ballname"><Ball ball={today.ball} size={18} />{wild.caught ? 'Caught' : BALL_NAME[today.ball]}</span>
            </div>
            <div className="hp-row">
              <b>HP</b>
              <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={wild.max} aria-valuenow={wild.hp} aria-label="The wild Pokemon's HP">
                <i className={`hp ${hp <= 0.2 ? 'low' : hp <= 0.5 ? 'mid' : ''}`} style={{ width: `${hp * 100}%` }} />
              </div>
            </div>
            <div className="hp-sub"><span>{wild.caught ? 'In your Box' : today.hit > 0 ? `Today −${today.hit}` : ''}</span><b>{wild.hp} / {wild.max}</b></div>
          </div>
          <div className="pad foe-pad">
            <img src={still(wild.form, wild.shiny)} alt="" width={104} height={104} className={`sprite ${wild.caught ? 'got' : ''}`} />
            {wild.caught && <Ball ball={today.ball} size={34} className="caughtball" />}
            {!wild.caught && <Pop value={today.hit} />}
          </div>
        </>
      )}
      <div className="pad me-pad">
        <Sprite form={game.display} shiny={partner.shiny} size={184} className={game.asleep ? 'asleep' : ''} />
        {game.asleep && <span className="zzz" aria-hidden>Zzz</span>}
      </div>
      <div className="hpbox me-box">
        <div className="hp-top">
          <span className="hp-name">
            {nameOf(game.display)}
            {partner.shiny && <span className="chip">shiny</span>}
            {game.aura === 'mega' && <span className="chip mega">mega</span>}
            {game.aura === 'gmax' && <span className="chip gmax">g-max</span>}
          </span>
          <span className="hp-lv">Lv{game.level}</span>
        </div>
        <div className="hp-row">
          <b>EXP</b>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={game.need} aria-valuenow={Math.round(game.into)} aria-valuetext={`${Math.round(game.into)} of ${game.need} XP, ${Math.round(game.into - game.intoBeforeToday)} of it earned today`} aria-label="Progress to the next level">
            <i className="base" style={{ width: `${before * 100}%` }} />
            <i className="today" style={{ width: `${(pct - before) * 100}%` }} />
          </div>
        </div>
        <div className="hp-sub">
          <span><span className="key" />banked <span className="key today" style={{ marginLeft: 8 }} />today <b>+{today.xp}</b></span>
          <b>{Math.round(game.into)} / {game.need}</b>
        </div>
      </div>
    </section>
  )
}

function Talk({ game, pillars }: { game: Game; pillars: HabitFact[] }) {
  const { today, wild } = game
  const me = nameOf(game.display)
  const left = today.total - today.done
  const say: ReactNode = wild?.caught ? <>Gotcha! {nameOf(wild.form)} was caught!</>
    : game.asleep ? <>{me} is fast asleep.</>
    : today.xp > 0 ? <>{me} gained {today.xp} XP today!</>
    : <>What will {me} do today?</>
  // the habits still open, as pips: all of them filled is a perfect day
  const sub: ReactNode = today.total > 0 && (
    <span className="pips" title={left ? `${left} left for a perfect day, which catches the wild Pokemon on the spot` : 'A perfect day'}>
      {Array.from({ length: Math.min(today.total, 40) }, (_, i) => <i key={i} className={i < Math.round((today.done / today.total) * Math.min(today.total, 40)) ? 'on' : ''} />)}
      <b>{left ? `${left} to a perfect day` : 'Perfect day!'}</b>
    </span>
  )
  return (
    <div className="talk">
      <div className="say" aria-live="polite"><span>{say}</span><small>{sub}</small></div>
      <div className="moves">
        {pillars.map((h) => {
          const st = stateOf(h)
          return (
            <div key={h.id} className={`move ${st}`} data-tag={h.tag}>
              <span className="mv-name">{label(h)}</span>
              <span className="mv-meta"><span>{st === 'done' ? 'Done' : st === 'part' ? `${Math.round(h.frac * 100)}% done` : (TAG_NAME[h.tag] ?? 'Pillar')}</span><b>{Math.round(h.worth * h.frac)}/{h.worth}</b></span>
              <i className="mv-bar" style={{ width: `${h.frac * 100}%` }} />
            </div>
          )
        })}
        {pillars.length === 0 && <p className="muted" style={{ gridColumn: '1 / -1' }}>No pillar habits are on today's list.</p>}
        <a className="go" href={LIFEOS_URL} target="_blank" rel="noreferrer">Tick habits in Life OS ↗</a>
      </div>
    </div>
  )
}

function Momentum({ game }: { game: Game }) {
  const { momentum } = game
  const prev = game.days.slice(-(MOMENTUM_WINDOW + 1), -1)
  const missing = MOMENTUM_WINDOW - prev.length
  const steps = [0, 3, 5, 7]
  return (
    <Win title="Momentum" tone="gold" aside={`×${momentum.mult}`}>
      <div className="week" aria-label={`${momentum.days} of the last 7 days counted`}>
        {Array.from({ length: MOMENTUM_WINDOW }, (_, i) => {
          const d = prev[i - missing]
          return (
            <span key={i} className="d" title={d ? `${fmtDay(d.day)}: ${d.pillars} of ${d.pillarTotal} pillars` : 'before the game began'}>
              <span className={`dot ${d?.counts ? 'on' : d ? 'off' : 'none'}`} />
              {d ? weekday(d.day) : '·'}
            </span>
          )
        })}
        <span className="gap" aria-hidden />
        <span className="d today" title="Today">
          <span className={`dot ${game.today.counts ? 'on' : ''}`} />
          Today
        </span>
      </div>
      <div className="ladder">
        {steps.map((s) => (
          <div key={s} className={momentumMult(momentum.days) === momentumMult(s) ? 'on' : ''}>
            <b>×{momentumMult(s)}</b>
            {s === 0 ? 'start' : `${s}+ days`}
          </div>
        ))}
      </div>
    </Win>
  )
}

function Summary({ game }: { game: Game }) {
  const { partner } = game
  const rec = SPECIES[partner.form]
  const toGo = Math.max(0, xpForLevel(game.next.level) - Math.round(partner.xp))
  return (
    <Win title="Summary" tone="blue" aside={`No. ${dexNo(rec.d)}`}>
      <div className="sumrow">
      <MonCard m={partner} form={game.display} size={120} level={game.level} bar={<KBar value={Math.round(game.into)} max={game.need} ready={toGo === 0} />} />
      <dl className="facts">
        <dt>Met</dt><dd>{partner.origin === 'starter' ? 'Starter' : partner.origin === 'egg' ? 'Hatched from an egg' : 'Caught'}, {fmtDay(partner.from)}</dd>
        <dt>Type</dt><dd>{rec.t}{rec.t2 ? ` / ${rec.t2}` : ''}</dd>
        <dt>Next</dt><dd>{game.next.what === 'evolve' ? 'Evolves' : 'Fully trained'} at level {game.next.level} <span className="muted">({toGo.toLocaleString('en-IN')} XP to go)</span></dd>
        {game.lean.length > 0 && (
          <>
            <dt>Leaning</dt>
            <dd className="lean">
              {game.lean.slice(0, 4).map((x) => (
                <span key={x.form} title={`${TAG_NAME[x.tag] ?? x.tag}: what you have done most while raising it`}>
                  <img src={still(x.form, partner.shiny)} alt="" width={36} height={36} className={`sprite ${game.dex[x.form] ? '' : 'unseen'}`} />
                  <b>{x.pct}%</b><small>{TAG_NAME[x.tag] ?? x.tag}</small>
                </span>
              ))}
            </dd>
          </>
        )}
        <dt>Line</dt>
        <dd className="path">
          {partner.path.map((f, i) => (
            <span key={f} className="path-step">{i > 0 && <span className="arrow">▸</span>}<img src={still(f, partner.shiny)} alt={nameOf(f)} title={nameOf(f)} width={44} height={44} className="sprite" /></span>
          ))}
        </dd>
        <dt>Bond</dt><dd><span className={`ribbon ${partner.together ? 'on' : ''}`} title="Days it has been your partner on which you did at least one pillar. It only ever counts up.">{plural(partner.together ?? 0, 'day')} together</span></dd>
      </dl>
      </div>
      {game.lean.length > 0 && <p className="muted">It evolves by itself at level {game.next.level}, into whichever your habits lean to most by then.</p>}
      {game.asleep && <p className="notice warn">Asleep after two days without a pillar. Finish one pillar to wake it. Nothing is lost.</p>}
      {game.aura === 'mega' && <p className="notice good">{partner.megas?.length ? 'Mega form: registered for good. Choose which form shows in the Bag.' : 'Mega form: full momentum and every pillar done today.'}</p>}
      {game.aura === 'gmax' && <p className="notice gmax">Perfect day: Gigantamax for today.</p>}
    </Win>
  )
}

/** Who is up in the league, with their HP: worn down by the kind of work you do. */
function LeaderCard({ game }: { game: Game }) {
  const { league, today } = game
  const t = leaderOf(league.index, league.slot)
  if (!t) return <Win title="League" tone="gold" aside="All beaten"><p className="muted">Every league is beaten.</p></Win>
  const l = LEAGUES[league.index]
  const role = isGym(league.index, league.slot) ? `Gym ${league.slot + 1} of ${l.gyms.length}` : league.slot === lineup(l).length - 1 ? 'Champion' : 'Elite Four'
  const hp = league.hp / league.max
  return (
    <Win title={`${l.name}: ${t.name}`} tone="gold" aside={role}>
      <div className="leadrow">
        <span className={`foe ${hp <= 0.2 ? 'crit' : hp <= 0.5 ? 'hurt' : ''}`}>{t.sprite ? <img src={`/sprites/trainers/${t.sprite}.png`} alt="" width={72} height={72} className="sprite" /> : <span className="nopic" aria-hidden>?</span>}<Pop value={league.waiting ? 0 : today.strike} /></span>
        <div className="leadinfo">
          <div className="hp-row">
            <b>HP</b>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={league.max} aria-valuenow={league.hp} aria-label={`${t.name}'s HP`}>
              <i className={`hp ${hp <= 0.2 ? 'low' : hp <= 0.5 ? 'mid' : ''}`} style={{ width: `${hp * 100}%` }} />
            </div>
          </div>
          <div className="hp-sub"><span>{league.waiting ? 'Waiting' : today.strike > 0 ? <>Today <b className="dmg">−{today.strike}</b></> : ''}</span><b>{league.hp.toLocaleString('en-IN')} / {league.max.toLocaleString('en-IN')}</b></div>
          <div className="weak">
            <img src={`/sprites/types/${t.type}.png`} alt="" width={16} height={16} /><span>{t.type}</span>
            {league.weak.map((w) => <span key={w} className="chip weakchip" data-tag={w}>{TAG_NAME[w] ?? w} ×{WEAK_MULT}</span>)}
            {league.edge && <span className="chip mega">type edge ×{ADVANTAGE_MULT}</span>}
          </div>
        </div>
      </div>
      {league.waiting && <p className="muted">{l.name} opens with {((l.region ?? 1) - 1) * GRADUATES_PER_REGION} fully trained Pokemon (you have {game.graduates.length}).</p>}
      {game.team.length > 0 && (
        <div className="backing" title={`Your team. Each one whose type beats ${t.type} adds 10% to every strike.`}>
          {game.team.map((m) => <img key={m.uid} src={still(m.form, m.shiny)} alt={nameOf(m.form)} width={40} height={40} className={`sprite ${beats([SPECIES[m.form].t, SPECIES[m.form].t2], t.type) ? 'edge' : ''}`} />)}
          {game.teamEdge > 0 && <span className="chip mega">team +{game.teamEdge * 10}%</span>}
        </div>
      )}
    </Win>
  )
}

function PartnerTab({ game, facts, onShop }: { game: Game; facts: DayFacts[]; onShop: () => void }) {
  const habits = facts[facts.length - 1]?.habits ?? []
  return (
    <div className="home">
      <Scene game={game} />
      <Talk game={game} pillars={habits.filter((h) => h.pillar)} />
      {game.version >= 5 && <Actions game={game} onShop={onShop} />}
      <div className="cols">
        <LeaderCard game={game} />
        <Momentum game={game} />
      </div>
      <Quests game={game} />
    </div>
  )
}

// ── Bag ─────────────────────────────────────────────────────────────────────
// Nothing in here is needed for anything: this tab can be ignored for good and
// the game plays the same. From version 4 nothing in it costs anything either.
type Choice = 'mega' | 'show' | 'branch' | 'lead'

function Choices({ game }: { game: Game }) {
  const [what, setWhat] = useState<Choice | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const free = game.version >= 4
  const stones = Object.entries(game.bag).filter(([, n]) => n > 0).sort((a, b) => itemName(a[0]).localeCompare(itemName(b[0])))
  const total = stones.reduce((s, [, n]) => s + n, 0)
  const megas = SPECIES[game.partner.form].m ?? []
  const kept = game.partner.megas ?? []
  const branching = [game.partner, ...game.queue].filter((m) => (SPECIES[m.form].e?.length ?? 0) > 1)
  // version 3 sold a week of Mega for a stone; version 4 lets you choose which registered form shows
  const uses: [Choice, string, string][] = [
    free
      ? ['show', 'Which form shows', 'Your partner has a Mega form registered for good. Choose whether it is drawn as that or as its ordinary self.']
      : ['mega', 'Mega Evolve', `Your partner takes its Mega form for ${MEGA_DAYS} days, whatever momentum is doing.`],
    ['branch', 'Choose a branch', 'Decide which way a branching Pokemon evolves. It still evolves on its own, at its level.'],
  ]
  // who each one can be used on right now
  const can: Record<Choice, Mon[]> = { mega: megas.length ? [game.partner] : [], show: kept.length ? [game.partner] : [], branch: branching, lead: [] }
  const why: Record<Choice, string> = {
    mega: `${nameOf(game.partner.form)} has no Mega form.`,
    show: game.keyStone ? `${nameOf(game.partner.form)} has no Mega form registered yet.` : 'Needs the Key Stone and a registered Mega form.',
    branch: 'None of your Pokemon has a branching evolution right now.',
    lead: 'The Box is empty.',
  }
  const solo = what === 'mega' || what === 'show'
  const mon = what ? (can[what].find((m) => m.uid === uid) ?? (solo ? game.partner : null)) : null
  const choices = !what || !mon ? [] : what === 'mega' ? megas : what === 'show' ? ['base', ...kept] : what === 'branch' ? (SPECIES[mon.form].e ?? []) : []
  const chosen = choices.length === 1 ? choices[0] : choices.includes(to ?? '') ? to : null
  const ready = Boolean(what && mon && (free || total > 0) && (what === 'lead' || chosen))
  const pick = (w: Choice) => { setWhat(what === w ? null : w); setUid(null); setTo(null) }
  const formOf = (f: string) => (f === 'base' && mon ? mon.form : f)
  const confirm = () => {
    if (!what || !mon || !ready) return
    useItem(free ? '' : stones[0][0], mon.uid, what, chosen ?? undefined)
    setWhat(null); setUid(null); setTo(null)
  }
  const sentence = !what || !mon ? '' : what === 'mega' ? `${nameOf(mon.form)} becomes ${nameOf(chosen ?? '')} for ${MEGA_DAYS} days.`
    : what === 'show' ? `${nameOf(mon.form)} is drawn as ${nameOf(formOf(chosen ?? ''))} from today.`
    : what === 'branch' ? `${nameOf(mon.form)} will evolve into ${nameOf(chosen ?? '')} when its level comes.`
    : `${nameOf(mon.form)} becomes your partner now. ${nameOf(game.partner.form)} goes back to the Box.`
  return (
    <>
      <Win title={free ? 'Choices' : 'Spend a stone'} tone="blue" aside={free ? 'Free' : total ? 'Costs 1' : 'Needs a stone'}>
        <div className="uses">
          {uses.map(([id, name, text]) => (
            <button key={id} className={`use ${what === id ? 'on' : ''}`} aria-pressed={what === id} disabled={(!free && total === 0) || can[id].length === 0} onClick={() => pick(id)}>
              <b>{name}</b>
              <span>{can[id].length === 0 && (free || total > 0) ? why[id] : text}</span>
            </button>
          ))}
        </div>
        {what && (
          <div className="usebox">
            {!solo && (
              <>
                <p className="muted">{what === 'branch' ? 'Which Pokemon?' : 'Who comes forward?'}</p>
                <div className="queue pick">
                  {can[what].map((m) => (
                    <button key={m.uid} aria-pressed={mon?.uid === m.uid} className={mon?.uid === m.uid ? 'on' : ''} onClick={() => { setUid(m.uid); setTo(null) }} title={nameOf(m.form)}>
                      <img src={still(m.form, m.shiny)} alt={nameOf(m.form)} width={64} height={64} className="sprite" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {mon && choices.length > 1 && (
              <>
                <p className="muted">{what === 'branch' ? 'Into which?' : 'Which form?'}</p>
                <div className="queue pick">
                  {choices.map((f) => (
                    <button key={f} aria-pressed={chosen === f} className={chosen === f ? 'on' : ''} onClick={() => setTo(f)} title={nameOf(formOf(f))}>
                      <img src={still(formOf(f), mon.shiny)} alt={nameOf(formOf(f))} width={64} height={64} className={`sprite ${what === 'branch' && !game.dex[f] ? 'unseen' : ''}`} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {ready && (
              <div className="confirm">
                <p>{sentence} {free ? (what === 'lead' ? 'It costs nothing, and you can swap back the same way.' : 'It costs nothing and can be changed again.') : 'This uses one stone and cannot be undone.'}</p>
                <button className="go" onClick={confirm}>{free ? 'Confirm' : 'Spend a stone'}</button>
                <button className="plain" onClick={() => setWhat(null)}>Cancel</button>
              </div>
            )}
          </div>
        )}
      </Win>
    </>
  )
}

// ── Pokedex ─────────────────────────────────────────────────────────────────
type Show = 'all' | 'seen' | 'unseen'
const regionOf = (id: string): number => SPECIES[SPECIES[id].b ?? '']?.g ?? SPECIES[id].g ?? 0

/** What it was raised on, as its nature says it. */
const natureLine = (m: Mon): string =>
  !m.nature ? '' : m.nature.up && m.nature.down
    ? `${m.nature.name} nature: raised most on ${TAG_NAME[m.nature.up]}, least on ${TAG_NAME[m.nature.down]}.`
    : `${m.nature.name} nature: raised evenly.`

function DexTab({ game }: { game: Game }) {
  const [region, setRegion] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const [show, setShow] = useState<Show>('all')
  const owned = useMemo(() => {
    const m = new Map<string, Mon>()
    for (const x of [...game.graduates, game.partner, ...game.queue]) for (const f of x.path) m.set(f, x)
    return m
  }, [game])
  const all = useMemo(() => Object.entries(SPECIES).filter(([, r]) => !r.f), [])
  const perRegion = useMemo(() => {
    const out = REGIONS.map(() => ({ seen: 0, own: 0, total: 0 }))
    for (const [id] of all) {
      const g = regionOf(id) - 1
      if (!out[g]) continue
      out[g].total++
      if (game.dex[id]) out[g].seen++
      if (game.dex[id]?.own) out[g].own++
    }
    return out
  }, [all, game.dex])
  const entries = useMemo(() => all.filter(([id]) => regionOf(id) === region).sort((a, b) => a[1].d - b[1].d), [all, region])
  const shown = entries.filter(([id]) => (show === 'all' ? true : show === 'seen' ? game.dex[id] : !game.dex[id]))
  const locked = region > game.regions
  const raisedIn = entries.filter(([id]) => owned.get(id)?.graduated).length
  const sel = open ? SPECIES[open] : null
  const forms = sel ? [...(sel.m ?? []), ...(sel.gm ? [sel.gm] : [])] : []
  const seenTotal = Object.keys(game.dex).filter((id) => !SPECIES[id]?.f).length
  return (
    <>
      <div className="regions" role="tablist" aria-label="Region">
        {REGIONS.map((name, i) => (
          <button key={name} role="tab" aria-selected={region === i + 1} className={`${region === i + 1 ? 'on' : ''} ${i + 1 > game.regions ? 'lock' : ''}`} onClick={() => { setRegion(i + 1); setOpen(null) }}>
            <span className="n">{name}</span>
            <span className="c">{i + 1 > game.regions ? 'locked' : `${perRegion[i].own} / ${perRegion[i].total}`}</span>
            <span className="meter"><i style={{ width: `${perRegion[i].total ? (perRegion[i].own / perRegion[i].total) * 100 : 0}%` }} /></span>
          </button>
        ))}
      </div>
      <Win title={REGIONS[region - 1]} aside={`${seenTotal} of ${all.length} seen in all`}>
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Filter">
            {([['all', 'All'], ['seen', 'Seen'], ['unseen', 'Not seen']] as [Show, string][]).map(([id, text]) => (
              <button key={id} aria-pressed={show === id} className={show === id ? 'on' : ''} onClick={() => setShow(id)}>{text}</button>
            ))}
          </div>
          <span className="muted">
            {locked
              ? `Locked until the ${REGIONS[region - 2]} league is beaten and ${(region - 1) * GRADUATES_PER_REGION} Pokemon are fully trained (you have ${game.graduates.length}, and ${plural(game.league.beaten, 'regional league')}).`
              : `${perRegion[region - 1].seen} seen · ${raisedIn} raised.`}
          </span>
          {!locked && <span className="found">Found: {perRegion[region - 1].own}/{entries.length}</span>}
        </div>
        <div className="dexwrap">
          <div className={`dex ${locked ? 'locked' : ''}`}>
            {shown.map(([id, r]) => {
              const e = game.dex[id]
              const mon = owned.get(id)
              return (
                <button key={id} className={`cell ${e ? 'seen' : ''} ${e && !e.own ? 'met' : ''} ${e?.own ? 'own' : ''} ${(r.m ?? []).some((f) => game.dex[f]?.own) ? 'mg' : ''} ${open === id ? 'sel' : ''}`} onClick={() => setOpen(open === id ? null : id)} title={e ? r.n : `#${r.d}`} aria-pressed={open === id} aria-label={e ? `${r.n}, number ${r.d}` : `Not seen, number ${r.d}`}>
                  <img src={still(id, e?.shiny)} alt="" loading="lazy" width={64} height={64} className={`sprite ${e ? '' : 'unseen'}`} />
                  <span className="no">{dexNo(r.d)}</span>
                  {mon?.graduated && <span className="star" title="Fully trained">★</span>}
                  {e?.shiny && <span className="shine" title="Shiny">✦</span>}
                </button>
              )
            })}
            {shown.length === 0 && <p className="muted">Nothing here with this filter.</p>}
          </div>

          {sel && open ? (
            <aside className="detail" aria-live="polite">
              <div className="art">
                {game.dex[open] ? <Sprite form={open} shiny={game.dex[open].shiny} size={120} /> : <img src={still(open)} alt="" width={96} height={96} className="sprite unseen" />}
              </div>
              <div>
                <div className="eyebrow">No. {dexNo(sel.d)} · {sel.t}</div>
                <h3>{game.dex[open] ? sel.n : '???'}</h3>
                <p className="muted">
                  {game.dex[open] ? `First seen ${fmtDay(game.dex[open].first)}.${game.dex[open].own ? ` Yours since ${fmtDay(game.dex[open].own!)}.` : ' Seen, not caught.'}` : 'Not seen yet.'}
                  {owned.get(open)?.graduated ? ` Fully trained ${fmtDay(owned.get(open)!.graduated!)}, after ${plural(owned.get(open)!.together ?? 0, 'day')} together.` : ''}
                </p>
                {owned.get(open)?.nature && <p className="muted">{natureLine(owned.get(open)!)}</p>}
                {owned.get(open)?.ball && <p className="muted ballname"><Ball ball={owned.get(open)!.ball!} size={16} />Caught in {aBall(owned.get(open)!.ball!)}.</p>}
                {sel.e && sel.e.length > 1 && (
                  <p className="muted">Branches by what you do most while raising it: {sel.e.map((e, i) => `${game.dex[e] ? SPECIES[e].n : '???'} (${TAG_NAME[sel.bt?.[i] ?? ''] ?? '?'})`).join(', ')}.</p>
                )}
                {forms.length > 0 && (
                  <div className="forms">
                    {forms.map((f) => (
                      <span key={f} title={game.dex[f] ? SPECIES[f].n : 'Not registered yet'}>
                        <img src={game.dex[f] ? spritePath(f) : still(f)} alt="" width={64} height={64} className={`sprite ${game.dex[f] ? '' : 'unseen'}`} />
                        <small>{SPECIES[f].n.includes('Mega') ? 'Mega' : 'Gigantamax'}</small>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button className="close" onClick={() => setOpen(null)} aria-label="Close details">✕</button>
            </aside>
          ) : (
            <aside className="detail empty">
              <div className="art"><img src={still(entries[0]?.[0] ?? 'bulbasaur')} alt="" width={96} height={96} className="sprite unseen" /></div>
              <p className="muted">Select a Pokemon to see when you first met it, how it evolves and its Mega or Gigantamax forms.</p>
            </aside>
          )}
        </div>
      </Win>
    </>
  )
}

// ── Trainer card ────────────────────────────────────────────────────────────
const KIND: Record<Moment['kind'], string> = { level: 'Level', evolve: 'Evolved', graduate: 'Trained', partner: 'Partner', catch: 'Caught', appear: 'Wild', form: 'Form', badge: 'Badge', region: 'Region', gym: 'Gym', league: 'League', item: 'Stone', use: 'Choice', key: 'Key Stone', mega: 'Mega', transfer: 'Professor', quest: 'Quest', season: 'Season', hatch: 'Hatched', chest: 'Chest' }
const ITEM_WHY = { gym: 'with the badge', perfect: 'for a perfect-day milestone', league: 'from the league' } as const
function line(m: Moment): string {
  switch (m.kind) {
    case 'level': return `${nameOf(m.form)} reached level ${m.level}`
    case 'evolve': return `${nameOf(m.from)} evolved into ${nameOf(m.form)}${m.picked ? ' (your choice)' : m.tag ? ` (${TAG_NAME[m.tag] ?? m.tag} led)` : ''}`
    case 'graduate': return `${nameOf(m.form)} was fully trained`
    case 'partner': return `${nameOf(m.form)} became the partner${m.origin === 'egg' ? ' (hatched from an egg)' : ''}`
    case 'catch': return `${m.shiny ? 'Shiny ' : ''}${nameOf(m.form)} was caught${m.how === 'perfect' ? ' on the spot, by a perfect day' : m.how === 'ball' ? ' with a thrown ball' : ''} (#${m.n})`
    case 'appear': return `A wild ${nameOf(m.form)} appeared${m.rarity === 'C' ? '' : ` (${RARITY[m.rarity].toLowerCase()})`}`
    case 'form': return `${nameOf(m.form)} registered (${m.what === 'mega' ? 'Mega' : 'Gigantamax'})`
    case 'badge': return `Badge #${m.n} earned`
    case 'region': return `${REGIONS[m.n - 1]} opened`
    case 'gym': {
      const t = leaderOf(m.league, m.slot), l = LEAGUES[m.league]
      if (!t || !l) return 'A leader was beaten'
      return isGym(m.league, m.slot) ? `Beat ${t.name} of ${l.name}: ${badgeName(t)}` : m.slot === lineup(l).length - 1 ? `Beat ${t.name}, ${l.name}'s Champion` : `Beat ${t.name} of the ${l.name} Elite Four`
    }
    case 'league': return `The ${leagueName(m.league)} league is yours: entered in the Hall of Fame`
    case 'item': return `${itemName(m.item)} added to the Bag ${ITEM_WHY[m.why]}`
    case 'use': {
      const cost = m.item ? `Spent a ${itemName(m.item)}: ` : ''
      return m.what === 'mega' ? `${cost}${nameOf(m.form)} Mega Evolves for ${MEGA_DAYS} days`
        : m.what === 'branch' ? `${cost}${m.item ? 'chose' : 'Chose'} ${nameOf(m.to ?? '')} as the branch`
        : `${cost}${nameOf(m.form)} came forward as the partner`
    }
    case 'key': return 'The Key Stone is yours: Mega forms can now be kept for good'
    case 'mega': return `${nameOf(m.form)} registered for good`
    case 'transfer': return `${nameOf(m.form)} went to the Professor (+${m.gems} gems)`
    case 'quest': return `${m.name}: ${m.coins ? `+${m.coins} coins` : `+${m.gems} gems`}`
    case 'season': return `Season step ${m.step}: ${m.coins ? `+${m.coins} coins` : m.gems ? `+${m.gems} gems` : (SHOP[m.item as ShopItem]?.name ?? m.item)}`
    case 'hatch': return `A Rare Egg hatched into ${nameOf(m.form)}`
    case 'chest': return `Chest ${m.n}: ${m.coins ? `${m.coins} coins` : `${SHOP[m.item as ShopItem]?.name ?? m.item}${m.count > 1 ? ` ×${m.count}` : ''}`}`
  }
}
/** The league being challenged, as a road: one step per leader, a tick on those behind you, a marker where you stand. */
function Road({ game }: { game: Game }) {
  const { league } = game
  const done = league.index >= LEAGUES.length
  const index = Math.min(league.index, LEAGUES.length - 1)
  const l = LEAGUES[index]
  const all = lineup(l)
  const at = done ? all.length : league.slot
  const hp = league.hp / league.max
  return (
    <Win title={`${l.name} league`} tone="gold" aside={done ? 'All beaten' : `${Math.min(at, l.gyms.length)} / ${l.gyms.length} badges`}>
      <div className="road-win">
        <div className="k-road">
          {all.flatMap((t, i) => {
            const state = i < at ? 'done' : i === at && !league.waiting ? 'now' : 'ahead'
            const gym = i < l.gyms.length
            const art = gym ? badgeArt(index, i) : null
            const step = (
              <div key={`${t.name}${i}`} className={`k-step ${state}`} data-n={i + 1}>
                {t.sprite ? <img src={`/sprites/trainers/${t.sprite}.png`} alt="" width={52} height={52} className="sprite" loading="lazy" /> : <span className="nopic" aria-hidden>?</span>}
                <div>
                  <span className="name">{t.name}</span>
                  <small>{gym ? badgeName(t) : i === all.length - 1 ? 'Champion' : 'Elite Four'} · {t.type}</small>
                  {state === 'now' && <div style={{ marginTop: 6 }}><KBar value={league.hp} max={league.max} kind={hp <= 0.2 ? 'hp low' : hp <= 0.5 ? 'hp mid' : 'hp'} label={`${league.hp.toLocaleString('en-IN')} HP left`} /></div>}
                </div>
                {gym && <KMedal on={state === 'done'} title={`${badgeName(t)}: ${state === 'done' ? 'won' : 'not yet'}`}>{art ? <img src={art} alt="" className="sprite" /> : <span className={`badge b${i} on`} />}</KMedal>}
              </div>
            )
            // the big step after the eighth badge of the first league
            return index === 0 && i === KEY_STONE_BADGES - 1
              ? [step, <div key="key" className={`k-step key ${game.keyStone ? 'done' : 'ahead'}`} data-n="★"><KeyStone size={52} held /><div><span className="name">Key Stone</span><small>{game.keyStone ? `Yours since ${fmtDay(game.keyStone)}: Mega forms are kept for good` : 'Comes with this badge. With it, Mega forms are kept for good'}</small></div></div>]
              : [step]
          })}
        </div>
      </div>
      {league.waiting && <p className="muted">{l.name} is not open yet.</p>}
    </Win>
  )
}

function HallOfFame({ game }: { game: Game }) {
  if (game.hall.length === 0) return null
  return (
    <Win title="Hall of Fame" tone="gold" aside={plural(game.hall.length, 'league')}>
      <ul className="hall">
        {game.hall.map((h) => (
          <li key={h.league}>
            <div><b>{leagueName(h.league)}</b><small>{fmtDay(h.day)} · beat {LEAGUES[h.league].champion.name}</small></div>
            <div className="team">
              <img src={still(h.partner.form, h.partner.shiny)} alt={nameOf(h.partner.form)} title={`${nameOf(h.partner.form)}, the partner`} width={56} height={56} className="sprite lead" />
              {h.team.map((m, i) => <img key={i} src={still(m.form, m.shiny)} alt={nameOf(m.form)} title={nameOf(m.form)} width={44} height={44} className="sprite" />)}
            </div>
          </li>
        ))}
      </ul>
    </Win>
  )
}

const STAT_ROWS: [keyof Stats, string, string][] = [
  ['hp', 'HP', 'Sleep'], ['atk', 'Attack', 'Gym'], ['def', 'Defense', 'Recovery'], ['spe', 'Speed', 'Steps'], ['spd', 'Sp. Def', 'Guitar'], ['spa', 'Sp. Atk', 'Code'],
]
function StatsRadar({ stats }: { stats: Stats }) {
  const R = 84, C = 120
  const at = (i: number, v: number): [number, number] => {
    const a = (Math.PI * 2 * i) / STAT_ROWS.length - Math.PI / 2
    return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v]
  }
  const ring = (v: number) => STAT_ROWS.map((_, i) => at(i, v).map((n) => n.toFixed(1)).join(',')).join(' ')
  const shape = STAT_ROWS.map(([k], i) => at(i, Math.max(0.04, (stats[k] ?? 0) / 100)).map((n) => n.toFixed(1)).join(',')).join(' ')
  return (
    <Win title="Trainer profile" tone="blue" aside={`last ${STAT_DAYS} days`}>
      <div className="statwrap">
        <svg className="radar" viewBox="0 0 240 240" role="img" aria-label={STAT_ROWS.map(([k, n]) => `${n} ${stats[k] ?? 'not measured'}`).join(', ')}>
          {[0.25, 0.5, 0.75, 1].map((v) => <polygon key={v} points={ring(v)} className="ring" />)}
          {STAT_ROWS.map((_, i) => { const [x, y] = at(i, 1); return <line key={i} x1={C} y1={C} x2={x} y2={y} className="ring" /> })}
          <polygon points={shape} className="shape" />
          {STAT_ROWS.map(([k, n], i) => { const [x, y] = at(i, 1.24); return <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className={stats[k] === null ? 'off' : ''}>{n}</text> })}
        </svg>
        <dl className="facts stats">
          {STAT_ROWS.map(([k, n, from]) => (
            <div key={k} className="statrow"><dt>{n}</dt><dd>{stats[k] === null ? <span className="muted">needs the band</span> : <><b className="num">{stats[k]}</b><span className="muted"> {k === 'def' && stats.spe === null ? 'Arbor' : from}</span></>}</dd></div>
          ))}
        </dl>
      </div>
      <p className="muted">You over the last {STAT_DAYS} days, not the partner.</p>
    </Win>
  )
}

/** Every badge won, league by league, with the open league's empty places. */
function BadgeCase({ game }: { game: Game }) {
  const upTo = Math.min(game.league.index, LEAGUES.length - 1)
  return (
    <Win title="Badge case" tone="dark" aside={plural(badgesWon(game), 'badge')}>
      {LEAGUES.slice(0, upTo).map((l, index) => (
        <div key={l.name} className="caserow">
          <KRibbon metal={index < game.league.index ? 'gold' : 'silver'}>{l.name}</KRibbon>
          <div className="casemedals">
            {l.gyms.map((t, i) => {
              const on = index < game.league.index || i < game.league.slot
              const title = `${badgeName(t)}: ${on ? `won from ${t.name}` : `beat ${t.name}`}`
              const art = badgeArt(index, i)
              // the real badge where there is a picture of it; a plain shape for the regions without one
              return <KMedal key={i} on={on} title={title} color={index < game.league.index ? undefined : '#63c6ff'}>{art ? <img src={art} alt={title} className="sprite" /> : <span className={`badge b${i} on`} />}</KMedal>
            })}
          </div>
        </div>
      ))}
      <div className="keyrow">
        <KeyStone size={32} held={Boolean(game.keyStone)} />
        <p className="muted">
          {game.keyStone ? `Key Stone, held since ${fmtDay(game.keyStone)}. A fully evolved partner keeps its Mega form the first time a leader falls to it, or when it finishes training.`
            : game.version >= 4 ? `The Key Stone comes with the ${KEY_STONE_BADGES}th Kanto badge. With it, Mega forms are kept for good.`
            : `From ${fmtDay(V4_START)} the ${KEY_STONE_BADGES}th Kanto badge brings the Key Stone.`}
        </p>
      </div>
    </Win>
  )
}

/** Each domain counted in its own unit. Nothing is earned from these yet. */
function FieldNotes({ game }: { game: Game }) {
  const n = game.notes
  const rows: [string, string, string][] = [
    ['code', 'Code', plural(n.codeDays, 'coding day')],
    ['fitness', 'Strength', `${plural(n.workouts, 'workout')} · ${plural(n.records, 'record')} beaten`],
    ['guitar', 'Guitar', `${plural(n.guitarDays, 'full session')} · ${plural(n.clean, 'clean play')} · ${plural(n.owned, 'part')} owned`],
    ['arbor', 'Arbor', plural(n.arborDays, 'full morning')],
    ['routine', 'Steps', n.stepDays ? `${n.steps.toLocaleString('en-IN')} steps over ${plural(n.stepDays, 'measured day')}` : 'not measured yet'],
  ]
  return (
    <Win title="Field notes" tone="green" aside="for life">
      <dl className="facts notes">
        {rows.map(([tag, name, text]) => <div key={name} className="noterow" data-tag={tag}><dt>{name}</dt><dd>{text}</dd></div>)}
      </dl>
      <p className="muted">Counted for life. Nothing is earned from these yet.</p>
    </Win>
  )
}

const DAYS_SHOWN = 30
function TrainerTab({ game }: { game: Game }) {
  const days = game.days.slice(-DAYS_SHOWN)
  const max = Math.max(100, ...days.map((d) => d.xp))
  const total = game.days.reduce((s, d) => s + d.xp, 0)
  const best = game.days.reduce((b, d) => (d.xp > b.xp ? d : b), game.days[0] ?? { day: '', xp: 0 })
  const seen = Object.keys(game.dex).filter((id) => !SPECIES[id]?.f).length
  const events = [...game.moments].reverse().filter((m) => m.kind !== 'quest').filter((m, i, all) => m.kind !== 'level' || all.findIndex((x) => x.kind === 'level' && x.day === m.day) === i).slice(0, 80)
  const grouped = events.reduce<[string, Moment[]][]>((acc, m) => {
    const last = acc[acc.length - 1]
    if (last && last[0] === m.day) last[1].push(m)
    else acc.push([m.day, [m]])
    return acc
  }, [])
  return (
    <>
      <section className="card" aria-label="Trainer card">
        <div>
          <h2>Trainer card</h2>
          <dl className="facts">
            <dt>Started</dt><dd>{fmtDay(GAME_START)} · day {game.days.length}</dd>
            <dt>Total XP</dt><dd>{total.toLocaleString('en-IN')}</dd>
            <dt>Pokedex</dt><dd>{seen} seen · {game.graduates.length} fully trained</dd>
            <dt>Perfect days</dt><dd>{game.perfectDays}</dd>
            <dt>Best day</dt><dd>{best?.xp ? `${best.xp} XP, ${fmtDay(best.day)}` : 'none yet'}</dd>
            <dt>Region</dt><dd>{REGIONS[game.regions - 1]}</dd>
            <dt>League</dt><dd>{game.league.index < LEAGUES.length ? leagueName(game.league.index) : 'All beaten'} · {plural(game.hall.length, 'league')} won</dd>
            <dt>Caught</dt><dd>{game.moments.filter((m) => m.kind === 'catch').length} · {game.queue.length} in the Box</dd>
            <dt>Badges</dt><dd>{badgesWon(game)}{game.keyStone ? ' · Key Stone' : ''}</dd>
          </dl>
        </div>
        <div className="who"><Sprite form={game.partner.form} shiny={game.partner.shiny} size={96} /></div>
      </section>

      {game.warnings.map((w) => <p key={w} className="notice warn">{w}</p>)}
      <div className="cols">
        <Road game={game} />
        <StatsRadar stats={game.stats} />
      </div>
      <div className="cols">
        <FieldNotes game={game} />
        {game.league.index > 0 && <BadgeCase game={game} />}
      </div>
      <HallOfFame game={game} />

      <Win title="XP per day" tone="blue" aside={`last ${plural(days.length, 'day')}`}>
        <div className="chart" role="img" aria-label={`XP earned on each of the last ${days.length} days; best was ${best?.xp ?? 0}`}>
          <div className="y" aria-hidden><span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span></div>
          <div className="bars">
            {Array.from({ length: Math.max(0, DAYS_SHOWN - days.length) }, (_, i) => <span key={`pad${i}`} className="col empty" />)}
            {days.map((d, i) => (
              <span key={d.day} className={`col ${i === days.length - 1 ? 'today' : d.perfect ? 'perfect' : d.counts ? 'counts' : ''}`} title={`${fmtDay(d.day)}: ${d.xp} XP · ${d.pillars}/${d.pillarTotal} pillars · ${d.done}/${d.total} habits${d.mult > 1 ? ` · ×${d.mult}` : ''}`}>
                <i style={{ height: `${(d.xp / max) * 100}%` }} />
              </span>
            ))}
          </div>
          <div className="x" aria-hidden><span>{days.length < DAYS_SHOWN ? `Game began ${fmtDay(GAME_START)}` : `${DAYS_SHOWN} days ago`}</span><span>Today</span></div>
        </div>
        <div className="legend">
          <span><i className="k today" />today</span><span><i className="k perfect" />perfect day</span><span><i className="k counts" />{PILLARS_FOR_A_DAY} or more pillars</span><span><i className="k" />other</span>
        </div>
      </Win>

      <Win title="Adventure log" tone="dark">
        {grouped.length === 0 ? <p className="muted">Nothing yet. Tick a pillar in Life OS and it shows up here.</p> : (
          <ul className="log">
            {grouped.flatMap(([day, ms]) => [
              <li key={day} className="dayhead">{fmtDay(day)} · {weekday(day, 3)}</li>,
              ...ms.map((m, i) => <li className="ev" key={`${day}-${i}`}><span className={`kind k-${m.kind}`}>{KIND[m.kind]}</span><span>{line(m)}</span></li>),
            ])}
          </ul>
        )}
      </Win>
    </>
  )
}

// ── Rules: a picture and one line each ──────────────────────────────────────
function Rule({ title, tone, pic, children }: { title: string; tone: string; pic: ReactNode; children: ReactNode }) {
  return (
    <div className="rule" data-tone={tone}>
      <div className="rule-pic">{pic}</div>
      <b>{title}</b>
      <p>{children}</p>
    </div>
  )
}
const Arrow = () => <span className="rule-arrow" aria-hidden>▸</span>
function RulesTab() {
  const [sound, setSound] = useState(soundOn())
  return (
    <section className="k-panel">
      <div className="k-panel-b">
        <h2 className="k-type" style={{ fontSize: 26, marginBottom: 12 }}>How it works</h2>
        <div className="rules">
          <Rule title="Do the day" tone="gold" pic={<><span className="rule-chip">{TIER_XP.pillar}</span><span className="rule-chip sm">{TIER_XP.core}</span><span className="rule-chip xs">{TIER_XP.standard}</span></>}>
            Every habit is XP for your partner. Pillars are {TIER_XP.pillar}; chores are small.
          </Rule>
          <Rule title="One day, three hits" tone="blue" pic={<><span className="rule-dot" style={{ background: 'var(--k-blue)' }} /><span className="rule-dot" style={{ background: 'var(--hp-ok)' }} /><span className="rule-dot" style={{ background: 'var(--k-gold)' }} /></>}>
            How much grows the partner. How whole the day was hurts the wild Pokemon. What kind of work hurts the leader.
          </Rule>
          <Rule title="Evolves by itself" tone="green" pic={<><span className="rule-chip sm">{evolveAt(3, 1)}</span><Arrow /><span className="rule-chip sm">{evolveAt(3, 2)}</span><Arrow /><span className="rule-chip">{graduateAt(3)}</span></>}>
            At these levels. At {graduateAt(3)} it is fully trained and the next one steps up.
          </Rule>
          <Rule title="Chores pick the ball" tone="red" pic={<><Ball ball="poke" size={30} /><Arrow /><Ball ball="great" size={34} /><Arrow /><Ball ball="ultra" size={38} /></>}>
            Half the chores: ×{BALL_MULT.great}. Four-fifths: ×{BALL_MULT.ultra}. Every habit done catches it on the spot.
          </Rule>
          <Rule title="Throw to finish" tone="gold" pic={<><Coin size={30} /><Arrow /><Ball ball="ultra" size={36} /><span className="rule-chip sm">−200</span></>}>
            A coin for each XP of work. Buy a ball, throw it, and the HP drops at once.
          </Rule>
          <Rule title="Leaders and badges" tone="purple" pic={<><span className="rule-chip">{(LEADER_HP / 1000).toFixed(0)}k</span><Arrow /><KMedal><span className="badge b3 on" style={{ width: 30 }} /></KMedal></>}>
            Each leader has {LEADER_HP.toLocaleString('en-IN')} HP and is weak to two kinds of work (×{WEAK_MULT}). Beat one, keep the badge.
          </Rule>
          <Rule title="Your team" tone="blue" pic={<><span className="rule-dot" /><span className="rule-dot" /><span className="rule-dot" /><span className="rule-chip sm">+10%</span></>}>
            Three trained Pokemon stand behind you. Each one whose type beats the leader's adds 10%.
          </Rule>
          <Rule title="Mega, for good" tone="purple" pic={<><KeyStone size={38} /></>}>
            The Key Stone comes with badge {KEY_STONE_BADGES}. After it, a fully evolved partner keeps its Mega.
          </Rule>
          <Rule title="Gems" tone="green" pic={<><Gem size={34} /><span className="rule-chip sm">{GEMS.catch}</span><span className="rule-chip sm">{GEMS.evolve}</span><span className="rule-chip sm">{GEMS.gym}</span></>}>
            A catch, an evolution, a badge. Or send a Box Pokemon to the Professor for {GEMS.transfer}.
          </Rule>
          <Rule title="The season" tone="gold" pic={<><span className="rule-chip sm">1</span><Arrow /><span className="rule-chip sm">2</span><Arrow /><span className="rule-chip sm">3</span></>}>
            Every {SEASON_STEP.toLocaleString('en-IN')} XP of the month's work is a step, and each step hands something over.
          </Rule>
          <Rule title="Nothing is lost" tone="green" pic={<span className="rule-chip">∞</span>}>
            A day off adds nothing and takes nothing. Hearts, badges and Pokemon are yours for good.
          </Rule>
          <Rule title="A day's list" tone="red" pic={<><span className="rule-dot" /><span className="rule-dot" /><span className="rule-dot" style={{ opacity: 0.3 }} /></>}>
            Fixed when the day starts. You can add a habit today; taking one off starts tomorrow.
          </Rule>
        </div>
        <div className="kit-row" style={{ marginTop: 14 }}>
          <button type="button" className={`k-btn ${sound ? 'ok' : ''}`} aria-pressed={sound} onClick={() => { setSoundOn(!sound); setSound(!sound); if (!sound) play('buy') }}>Sound: {sound ? 'on' : 'off'}</button>
          <span className="muted">Rules version 5, from {fmtDay(V5_START)}. The game began {fmtDay(GAME_START)}.</span>
        </div>
      </div>
    </section>
  )
}

// ── the frame every tab shares ──────────────────────────────────────────────
/** Tab icons, drawn here as plain shapes. */
const ICON: Record<Tab, ReactNode> = {
  partner: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z" fill="#ff6b78" stroke="#141a33" strokeWidth="2" strokeLinejoin="round" /></svg>,
  shop: <svg viewBox="0 0 24 24" aria-hidden><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="#141a33" strokeWidth="2.4" /><rect x="3.5" y="8" width="17" height="13" rx="3" fill="#e9a23b" stroke="#141a33" strokeWidth="2" /><rect x="9.5" y="12" width="5" height="4" rx="1" fill="#fff3a8" stroke="#141a33" strokeWidth="1.6" /></svg>,
  dex: <svg viewBox="0 0 24 24" aria-hidden><rect x="4" y="3" width="16" height="18" rx="3" fill="#dc3b45" stroke="#141a33" strokeWidth="2" /><circle cx="9" cy="8" r="2.6" fill="#63c6ff" stroke="#141a33" strokeWidth="1.6" /><rect x="7" y="13" width="10" height="5" rx="1" fill="#f8f5ea" stroke="#141a33" strokeWidth="1.6" /></svg>,
  trainer: <svg viewBox="0 0 24 24" aria-hidden><path d="M8 13l-2 9 6-3 6 3-2-9" fill="#7b5cf0" stroke="#141a33" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="9" r="7" fill="#f5b800" stroke="#141a33" strokeWidth="2" /><path d="M12 5l1.3 2.700 2.900.3-2.2 2 .7 2.900L12 11.5 9.300 12.900l.7-2.900-2.2-2 2.900-.3z" fill="#fff3a8" stroke="#141a33" strokeWidth="1.2" strokeLinejoin="round" /></svg>,
  team: <svg viewBox="0 0 24 24" aria-hidden><circle cx="7" cy="9" r="4" fill="#63c6ff" stroke="#141a33" strokeWidth="2" /><circle cx="17" cy="9" r="4" fill="#f5b800" stroke="#141a33" strokeWidth="2" /><circle cx="12" cy="15" r="5" fill="#3fd07a" stroke="#141a33" strokeWidth="2" /></svg>,
}

/** Always in view: the partner's level and bar, badges won, Pokemon seen, and the Key Stone once it is held. */
function TopBar({ game, status, loading, onHelp }: { game: Game; status: string[]; loading: boolean; onHelp: () => void }) {
  const seen = Object.keys(game.dex).filter((id) => !SPECIES[id]?.f).length
  const v5 = game.version >= 5 && !loading
  const nx = game.season.next
  return (
    <header className="topbar">
      <div className="lv" title={v5 ? `Season step ${game.season.step}. Every ${game.season.need.toLocaleString('en-IN')} XP of the month's work is a step.` : undefined}>
        <span className="k-type">{v5 ? `Season ${game.season.step}` : 'Pokedex'}</span>
        {v5 && (
          <div className="k-bar gold" role="progressbar" aria-valuemin={0} aria-valuemax={game.season.need} aria-valuenow={game.season.into} aria-label="Progress to the next season step">
            <i style={{ width: `${clamp01(game.season.into / game.season.need) * 100}%` }} />
            <span className="nextprize">{game.season.into.toLocaleString('en-IN')} / {game.season.need.toLocaleString('en-IN')} · next {nx.coins ? <><Coin size={16} />{nx.coins}</> : nx.gems ? <><Gem size={16} />{nx.gems}</> : (SHOP[nx.item as ShopItem]?.name ?? '')}</span>
          </div>
        )}
      </div>
      {v5
        ? <><KPill icon={<Coin size={28} />}><span title="Coins: one for each XP of the day's work"><Count value={game.wallet.coins} /></span></KPill><KPill icon={<Gem size={28} />}><span title="Gems: from milestones and weekly quests"><Count value={game.wallet.gems} /></span></KPill></>
        : <KPill icon={<Ball ball="poke" size={28} />}><span title="Pokemon seen">{seen}</span></KPill>}
      <button type="button" className="k-btn help" aria-label="How it works" onClick={onHelp}>?</button>
      <span className={`sync s-${status[0]}`} role="status" aria-label={status[1]} title={status[1]} />
    </header>
  )
}

export default function App() {
  const view = useView()
  const [tab, setTab] = useState<Tab>('partner')
  const [help, setHelp] = useState(false)
  useEffect(() => start(), [])
  const { game } = view
  // the first read has not landed yet: do not draw an empty day as if it were real
  const loading = view.status === 'connecting'
  const status = view.status === 'live' ? ['live', 'Synced'] : view.status === 'connecting' ? ['connecting', 'Loading'] : view.status === 'error' ? ['error', 'Offline'] : ['off', 'Local only']
  return (
    <div className="shell">
      <TopBar game={game} status={status} loading={loading} onHelp={() => setHelp(true)} />
      <main key={tab} className="tabin">
        {loading && (
          <Win title="Loading" tone="dark">
            <div className="care"><Egg /><p>Reading your Life OS ledger...<span className="muted" style={{ display: 'block' }}>Your partner appears as soon as it arrives.</span></p></div>
          </Win>
        )}
        {!loading && tab === 'partner' && <PartnerTab game={game} facts={view.facts} onShop={() => setTab('shop')} />}
        {!loading && tab === 'team' && <TeamTab game={game} partnerCard={<Summary game={game} />} choices={<Choices game={game} />} />}
        {!loading && tab === 'shop' && <ShopTab game={game} />}
        {!loading && tab === 'dex' && <DexTab game={game} />}
        {!loading && tab === 'trainer' && <TrainerTab game={game} />}
      </main>
      {help && (
        <div className="recap helpwin" role="dialog" aria-modal="true" aria-label="How it works" onClick={() => setHelp(false)}>
          <div className="helpbody" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="k-btn k-close" aria-label="Close" onClick={() => setHelp(false)}>✕</button>
            <RulesTab />
          </div>
        </div>
      )}
      <nav className="navbar" role="tablist" aria-label="Sections">
        {TABS.map(([id, text]) => <button key={id} role="tab" aria-selected={tab === id} aria-label={text} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); play('tap'); window.scrollTo({ top: 0 }) }}>{ICON[id]}{text}</button>)}
      </nav>
      {!loading && <Recap game={game} today={view.today} />}
    </div>
  )
}
