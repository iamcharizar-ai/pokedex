import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { leaderOf, nameOf, spritePath, type Game, type Mon, type Moment, type Stats } from '../core/fold.ts'
import type { DayFacts, HabitFact } from '../core/facts.ts'
import { LEAGUES, type Leader } from '../core/gyms.ts'
import {
  BADGES_PER_REGION, BADGE_DAYS, GAME_START, GRADUATES_PER_REGION, ITEM_NAME, LEAGUE_STEPS, LEGENDARY_EVERY, MEGA_DAYS, MOMENTUM_WINDOW,
  PILLARS_FOR_A_DAY, RARE_EVERY, REGIONS, SHINY_EVERY, SLEEP_DONE, STAT_DAYS, STEPS_GOAL, TIER_XP, V2_START, type StoneUse,
  evolveAt, graduateAt, levelOf, momentumMult, xpForLevel,
} from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { LIFEOS_URL, VITALS_URL, start, useItem, useView, type BodyDay } from './lib/store.ts'

type Tab = 'partner' | 'bag' | 'dex' | 'trainer' | 'rules'
const TABS: [Tab, string][] = [['partner', 'Partner'], ['bag', 'Bag'], ['dex', 'Pokedex'], ['trainer', 'Trainer'], ['rules', 'Rules']]
const TAG_NAME: Record<string, string> = { code: 'Code', fitness: 'Gym', guitar: 'Guitar', arbor: 'Arbor', sleep: 'Sleep', routine: 'Routine', balanced: 'Balance', health: 'Health tracker' }
const still = (form: string, shiny = false) => `/sprites/static${shiny ? '-shiny' : ''}/${form}.png`
const fmtDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const weekday = (day: string, len: 1 | 3 = 1) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: len === 1 ? 'narrow' : 'short' })
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`
const dexNo = (n: number) => String(n).padStart(3, '0')
const itemName = (item: string): string => ITEM_NAME[item] ?? item
const itemIcon = (item: string): string => `/sprites/items/${item}.png`

function Sprite({ form, shiny, size, className = '' }: { form: string; shiny?: boolean; size: number; className?: string }) {
  return <img src={spritePath(form, shiny)} alt="" width={size} height={size} className={`sprite ${className}`} style={{ width: size, height: size }} />
}

/** A game window: coloured title strip over a cream body. */
function Win({ title, aside, tone = '', children }: { title: string; aside?: ReactNode; tone?: '' | 'blue' | 'green' | 'gold' | 'dark'; children: ReactNode }) {
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
  const left = today.total - today.done
  const hp = today.total ? left / today.total : 0
  const known = wild ? wild.caught || Boolean(game.dex[wild.form]) : false
  return (
    <section className={`scene tod-${timeOfDay()} ${game.aura ? `aura-${game.aura}` : ''}`} aria-label="Today, as a battle">
      {wild && (
        <>
          <div className="hpbox foe-box">
            <div className="hp-top">
              <span className="hp-name">{wild.caught ? nameOf(wild.form) : known ? `Wild ${nameOf(wild.form)}` : 'Wild ???'}{wild.shiny && <span className="chip">shiny</span>}</span>
              <span className="hp-lv">{wild.caught ? 'Caught' : 'Today'}</span>
            </div>
            <div className="hp-row">
              <b>HP</b>
              <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={today.total} aria-valuenow={left} aria-label="Habits left before it can be caught">
                <i className={`hp ${hp <= 0.2 ? 'low' : hp <= 0.5 ? 'mid' : ''}`} style={{ width: `${hp * 100}%` }} />
              </div>
            </div>
            <div className="hp-sub"><span>{wild.caught ? 'In your queue' : 'Habits left'}</span><b>{left} / {today.total}</b></div>
          </div>
          <div className="pad foe-pad"><img src={still(wild.form, wild.shiny)} alt="" width={104} height={104} className={`sprite ${known ? '' : 'unseen'}`} /></div>
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
  let say: ReactNode, sub: ReactNode
  if (wild?.caught) {
    say = <>Gotcha! {nameOf(wild.form)} was caught!</>
    sub = <>Every habit was ticked today. It waits in the queue until {me} is fully trained.</>
  } else if (game.asleep) {
    say = <>{me} is fast asleep.</>
    sub = <>Two days went by without a pillar. Finish one to wake it.</>
  } else if (today.xp > 0) {
    say = <>{me} gained {today.xp} XP today!</>
    sub = <>{plural(left, 'habit')} left to catch the wild Pokemon. {Math.max(0, Math.round(game.need - game.into))} XP to level {game.level + 1}.</>
  } else {
    say = <>What will {me} do today?</>
    sub = <>Each pillar is a move worth {TIER_XP.pillar} XP. Tick all {today.total} habits and the wild Pokemon is yours.</>
  }
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

function HabitRow({ h }: { h: HabitFact }) {
  const st = stateOf(h)
  return (
    <li className={st}>
      <span className="box" aria-hidden />
      <span>{label(h)}<span className="sr"> {st === 'done' ? 'done' : st === 'part' ? 'in progress' : 'not done'}</span></span>
      <span className="meter" aria-hidden><i style={{ width: `${h.frac * 100}%` }} /></span>
      <span className="pts">{Math.round(h.worth * h.frac)}/{h.worth}</span>
    </li>
  )
}

function Support({ rest }: { rest: HabitFact[] }) {
  const core = rest.filter((h) => h.worth >= TIER_XP.core)
  const small = rest.filter((h) => h.worth < TIER_XP.core)
  const got = small.reduce((s, h) => s + h.worth * h.frac, 0)
  const max = small.reduce((s, h) => s + h.worth, 0)
  const all = rest.reduce((s, h) => s + h.worth * h.frac, 0)
  return (
    <Win title="Support habits" tone="green" aside={`+${Math.round(all)} XP`}>
      {rest.length === 0 && <p className="muted">Nothing else on today's list.</p>}
      <ul className="list">{core.map((h) => <HabitRow key={h.id} h={h} />)}</ul>
      {small.length > 0 && (
        <details className="fold">
          <summary className={max > 0 && got >= max ? 'done' : ''}>
            <span className="caret" aria-hidden>▸</span>
            <span>Everyday habits <span className="muted">({small.filter((h) => h.done).length} of {small.length})</span></span>
            <span className="meter" aria-hidden><i style={{ width: `${max ? (got / max) * 100 : 0}%` }} /></span>
            <span className="pts">{Math.round(got)}/{max}</span>
          </summary>
          <ul className="list">{small.map((h) => <HabitRow key={h.id} h={h} />)}</ul>
        </details>
      )}
    </Win>
  )
}

function Momentum({ game }: { game: Game }) {
  const { momentum } = game
  const prev = game.days.slice(-(MOMENTUM_WINDOW + 1), -1)
  const missing = MOMENTUM_WINDOW - prev.length
  const steps = [0, 3, 5, 7]
  const next = steps.find((s) => s > momentum.days)
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
      <p className="muted">
        {momentum.days} of the last 7 days had {PILLARS_FOR_A_DAY} or more pillars.
        {next !== undefined ? ` ${plural(next - momentum.days, 'more day')} reaches ×${momentumMult(next)}.` : ' Full momentum: Mega form while it lasts.'}
      </p>
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
      <dl className="facts">
        <dt>Met</dt><dd>{partner.origin === 'starter' ? 'Starter' : partner.origin === 'egg' ? 'Hatched from an egg' : 'Caught on a perfect day'}, {fmtDay(partner.from)}</dd>
        <dt>Type</dt><dd>{rec.t}</dd>
        <dt>Next</dt><dd>{game.next.what === 'evolve' ? 'Evolves' : 'Fully trained'} at level {game.next.level} <span className="muted">({toGo.toLocaleString('en-IN')} XP to go)</span></dd>
      </dl>
      {game.asleep && <p className="notice warn">Asleep after two days without a pillar. Finish one pillar to wake it.</p>}
      {game.aura === 'mega' && <p className="notice good">Momentum is full: Mega form while it lasts.</p>}
      {game.aura === 'gmax' && <p className="notice gmax">Perfect day: Gigantamax for today.</p>}
    </Win>
  )
}

function DayCare({ game, body }: { game: Game; body: BodyDay | null }) {
  const grad = graduateAt(SPECIES[game.partner.base].x ?? 1)
  return (
    <Win title="Day care" tone="dark" aside={game.queue.length ? `${game.queue.length} waiting` : 'Egg'}>
      {game.queue.length === 0 ? (
        <div className="care">
          <Egg />
          <p>
            An egg is waiting. It hatches into your next partner when {nameOf(game.partner.form)} is fully trained at level {grad}.
            <span className="muted" style={{ display: 'block' }}>Catch something on a perfect day and it goes first instead.</span>
          </p>
        </div>
      ) : (
        <>
          <div className="queue">{game.queue.map((m) => <img key={m.uid} src={still(m.form, m.shiny)} alt={nameOf(m.form)} title={`${nameOf(m.form)} · caught ${fmtDay(m.from)}`} width={64} height={64} className="sprite" />)}</div>
          <p className="muted">{nameOf(game.queue[0].form)} becomes your partner when {nameOf(game.partner.form)} is fully trained at level {grad}.</p>
        </>
      )}
      {body && (
        <a className="bodyline" href={VITALS_URL} target="_blank" rel="noreferrer">
          <b>Body · {fmtDay(body.day)}</b>
          {[body.sleepMin !== undefined && `slept ${Math.floor(body.sleepMin / 60)}h ${String(body.sleepMin % 60).padStart(2, '0')}m`, body.steps !== undefined && `${body.steps.toLocaleString('en-IN')} steps`, body.weightKg !== undefined && `${body.weightKg} kg`].filter(Boolean).join(' · ') || 'readings recorded'}
          {' · open Vitals ↗'}
        </a>
      )}
    </Win>
  )
}

function PartnerTab({ game, facts, body }: { game: Game; facts: DayFacts[]; body: BodyDay | null }) {
  const habits = facts[facts.length - 1]?.habits ?? []
  return (
    <>
      <Scene game={game} />
      <Talk game={game} pillars={habits.filter((h) => h.pillar)} />
      <div className="cols">
        <Support rest={habits.filter((h) => !h.pillar)} />
        <Momentum game={game} />
      </div>
      <div className="cols">
        <Summary game={game} />
        <DayCare game={game} body={body} />
      </div>
    </>
  )
}

// ── Bag ─────────────────────────────────────────────────────────────────────
// Stones are an extra. Nothing evolves because of one and nothing waits for
// one: this tab can be ignored for good and the game plays the same.
const USES: [StoneUse, string, string][] = [
  ['mega', 'Mega Evolve', `Your partner takes its Mega form for ${MEGA_DAYS} days, whatever momentum is doing.`],
  ['branch', 'Choose a branch', 'Decide which way a branching Pokemon evolves. It still evolves on its own, at its level.'],
  ['lead', 'Change partner', 'Bring a Pokemon from the queue forward. Your partner waits at the front of the queue and keeps its XP.'],
]

function BagTab({ game }: { game: Game }) {
  const [what, setWhat] = useState<StoneUse | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const stones = Object.entries(game.bag).filter(([, n]) => n > 0).sort((a, b) => itemName(a[0]).localeCompare(itemName(b[0])))
  const total = stones.reduce((s, [, n]) => s + n, 0)
  const megas = SPECIES[game.partner.form].m ?? []
  const branching = [game.partner, ...game.queue].filter((m) => (SPECIES[m.form].e?.length ?? 0) > 1)
  // who each use can be spent on right now
  const can: Record<StoneUse, Mon[]> = { mega: megas.length ? [game.partner] : [], branch: branching, lead: game.queue }
  const why: Record<StoneUse, string> = {
    mega: `${nameOf(game.partner.form)} has no Mega form.`,
    branch: 'None of your Pokemon has a branching evolution right now.',
    lead: 'Nothing is waiting in the queue.',
  }
  const mon = what ? (can[what].find((m) => m.uid === uid) ?? (what === 'mega' ? game.partner : null)) : null
  const choices = !what || !mon ? [] : what === 'mega' ? megas : what === 'branch' ? (SPECIES[mon.form].e ?? []) : []
  const chosen = choices.length === 1 ? choices[0] : choices.includes(to ?? '') ? to : null
  const ready = Boolean(what && mon && total > 0 && (what === 'lead' || chosen))
  const pick = (w: StoneUse) => { setWhat(what === w ? null : w); setUid(null); setTo(null) }
  const spend = () => {
    if (!what || !mon || !ready) return
    useItem(stones[0][0], mon.uid, what, chosen ?? undefined)
    setWhat(null); setUid(null); setTo(null)
  }
  const sentence = !what || !mon ? '' : what === 'mega' ? `${nameOf(mon.form)} becomes ${nameOf(chosen ?? '')} for ${MEGA_DAYS} days.`
    : what === 'branch' ? `${nameOf(mon.form)} will evolve into ${nameOf(chosen ?? '')} when its level comes.`
    : `${nameOf(mon.form)} becomes your partner. ${nameOf(game.partner.form)} waits at the front of the queue.`
  return (
    <>
      <Win title="Stones" tone="green" aside={total ? plural(total, 'stone') : 'None yet'}>
        {total === 0 ? (
          <p className="muted">No stones yet. Beating a gym leader comes with one, and so does every {RARE_EVERY}th perfect day. They are rare on purpose, and nothing needs them: your partner levels up and evolves on its own.</p>
        ) : (
          <>
            <div className="items">
              {stones.map(([id, n]) => (
                <div key={id} className="item">
                  <img src={itemIcon(id)} alt="" width={48} height={48} className="sprite" />
                  <span className="it-name">{itemName(id)}</span>
                  {n > 1 && <span className="it-n">×{n}</span>}
                </div>
              ))}
            </div>
            <p className="muted">Any stone does any of the three things below. Which one you got is only its look.</p>
          </>
        )}
      </Win>
      <Win title="Spend a stone" tone="blue" aside={total ? 'Costs 1' : 'Needs a stone'}>
        <div className="uses">
          {USES.map(([id, name, text]) => (
            <button key={id} className={`use ${what === id ? 'on' : ''}`} aria-pressed={what === id} disabled={total === 0 || can[id].length === 0} onClick={() => pick(id)}>
              <b>{name}</b>
              <span>{can[id].length === 0 && total > 0 ? why[id] : text}</span>
            </button>
          ))}
        </div>
        {what && (
          <div className="usebox">
            {what !== 'mega' && (
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
                <p className="muted">{what === 'mega' ? 'Which Mega?' : 'Into which?'}</p>
                <div className="queue pick">
                  {choices.map((f) => (
                    <button key={f} aria-pressed={chosen === f} className={chosen === f ? 'on' : ''} onClick={() => setTo(f)} title={nameOf(f)}>
                      <img src={still(f, mon.shiny)} alt={nameOf(f)} width={64} height={64} className={`sprite ${what === 'branch' && !game.dex[f] ? 'unseen' : ''}`} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {ready && (
              <div className="confirm">
                <p>{sentence} This uses one stone and cannot be undone.</p>
                <button className="go" onClick={spend}>Spend a stone</button>
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
    const out = REGIONS.map(() => ({ seen: 0, total: 0 }))
    for (const [id] of all) {
      const g = regionOf(id) - 1
      if (!out[g]) continue
      out[g].total++
      if (game.dex[id]) out[g].seen++
    }
    return out
  }, [all, game.dex])
  const entries = useMemo(() => all.filter(([id]) => regionOf(id) === region).sort((a, b) => a[1].d - b[1].d), [all, region])
  const shown = entries.filter(([id]) => (show === 'all' ? true : show === 'seen' ? game.dex[id] : !game.dex[id]))
  const locked = region > game.regions
  const sel = open ? SPECIES[open] : null
  const forms = sel ? [...(sel.m ?? []), ...(sel.gm ? [sel.gm] : [])] : []
  const seenTotal = Object.keys(game.dex).filter((id) => !SPECIES[id]?.f).length
  return (
    <>
      <div className="regions" role="tablist" aria-label="Region">
        {REGIONS.map((name, i) => (
          <button key={name} role="tab" aria-selected={region === i + 1} className={`${region === i + 1 ? 'on' : ''} ${i + 1 > game.regions ? 'lock' : ''}`} onClick={() => { setRegion(i + 1); setOpen(null) }}>
            <span className="n">{name}</span>
            <span className="c">{i + 1 > game.regions ? 'locked' : `${perRegion[i].seen} / ${perRegion[i].total}`}</span>
            <span className="meter"><i style={{ width: `${perRegion[i].total ? (perRegion[i].seen / perRegion[i].total) * 100 : 0}%` }} /></span>
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
              ? `Locked until the ${REGIONS[region - 2]} league is beaten and ${(region - 1) * GRADUATES_PER_REGION} Pokemon are fully trained (you have ${game.graduates.length}, and ${plural(game.league.beaten, 'league')}).`
              : `${perRegion[region - 1].seen} of ${entries.length} seen here.`}
          </span>
        </div>
        <div className="dexwrap">
          <div className={`dex ${locked ? 'locked' : ''}`}>
            {shown.map(([id, r]) => {
              const e = game.dex[id]
              const mon = owned.get(id)
              return (
                <button key={id} className={`cell ${e ? 'seen' : ''} ${open === id ? 'sel' : ''}`} onClick={() => setOpen(open === id ? null : id)} title={e ? r.n : `#${r.d}`} aria-pressed={open === id} aria-label={e ? `${r.n}, number ${r.d}` : `Not seen, number ${r.d}`}>
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
                  {game.dex[open] ? `First seen ${fmtDay(game.dex[open].first)}.` : 'Not seen yet. Catch it on a perfect day or hatch it from an egg.'}
                  {owned.get(open)?.graduated ? ` Fully trained ${fmtDay(owned.get(open)!.graduated!)}${owned.get(open)!.bond ? ', Bond ribbon' : ''}.` : ''}
                </p>
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
const KIND: Record<Moment['kind'], string> = { level: 'Level', evolve: 'Evolved', graduate: 'Trained', partner: 'Partner', catch: 'Caught', form: 'Form', badge: 'Badge', region: 'Region', gym: 'Gym', league: 'League', item: 'Stone', use: 'Stone' }
const ITEM_WHY = { gym: 'with the badge', perfect: 'for a perfect-day milestone', league: 'from the league' } as const
function line(m: Moment): string {
  switch (m.kind) {
    case 'level': return `${nameOf(m.form)} reached level ${m.level}`
    case 'evolve': return `${nameOf(m.from)} evolved into ${nameOf(m.form)}${m.picked ? ' (your choice)' : m.tag ? ` (${TAG_NAME[m.tag] ?? m.tag} led)` : ''}`
    case 'graduate': return `${nameOf(m.form)} was fully trained${m.bond ? ' with a Bond ribbon' : ''}`
    case 'partner': return `${nameOf(m.form)} became the partner${m.origin === 'egg' ? ' (hatched from an egg)' : ''}`
    case 'catch': return `Perfect day #${m.n}: ${m.shiny ? 'shiny ' : ''}${nameOf(m.form)} joined the queue`
    case 'form': return `${nameOf(m.form)} registered (${m.what === 'mega' ? 'Mega' : 'Gigantamax'})`
    case 'badge': return `Badge #${m.n} earned`
    case 'region': return `${REGIONS[m.n - 1]} opened`
    case 'gym': {
      const l = leaderOf(m.region, m.slot)
      return m.slot < BADGES_PER_REGION ? `Beat ${l?.name} of ${REGIONS[m.region - 1]}: ${l?.badge}${/ Z$/.test(l?.badge ?? '') ? '' : ' Badge'}`
        : m.slot < BADGES_PER_REGION + 4 ? `Beat ${l?.name} of the ${REGIONS[m.region - 1]} Elite Four` : `Beat Champion ${l?.name}`
    }
    case 'league': return `The ${REGIONS[m.region - 1]} league is yours`
    case 'item': return `${itemName(m.item)} added to the Bag ${ITEM_WHY[m.why]}`
    case 'use': return m.what === 'mega' ? `Spent a ${itemName(m.item)}: ${nameOf(m.form)} Mega Evolves for ${MEGA_DAYS} days`
      : m.what === 'branch' ? `Spent a ${itemName(m.item)}: chose ${nameOf(m.to ?? '')}`
      : `Spent a ${itemName(m.item)}: ${nameOf(m.form)} came forward as the partner`
  }
}
function Trainer({ t, state, label, badge }: { t: Leader; state: 'beaten' | 'next' | 'ahead'; label: string; badge?: string }) {
  return (
    <div className={`leader ${state}`} title={`${t.name} · ${t.type}${t.badge ? ` · ${t.badge}` : ''}`}>
      <img src={`/sprites/trainers/${t.sprite}.png`} alt="" width={64} height={64} className="sprite" loading="lazy" />
      <span className="ld-name">{t.name}</span>
      <span className="ld-sub">{badge ? <img src={badge} alt="" width={16} height={16} className="sprite" /> : <img src={`/sprites/types/${t.type}.png`} alt={t.type} width={16} height={16} />}{label}</span>
    </div>
  )
}

function Gyms({ game }: { game: Game }) {
  const { league } = game
  const done = league.region > LEAGUES.length
  const shown = Math.min(league.region, LEAGUES.length)
  const l = LEAGUES[shown - 1]
  const name = REGIONS[Math.min(league.region, LEAGUES.length) - 1]
  const closed = !done && league.region > game.regions
  const at = done ? 99 : league.badges // index of the next one to beat
  const inLeague = !done && league.badges >= BADGES_PER_REGION
  return (
    <Win title={`${name} gyms`} tone="gold" aside={done ? 'All beaten' : `${league.badges} / ${BADGES_PER_REGION} badges`}>
      <div className="gyms">
        {l.gyms.map((t, i) => <Trainer key={t.name} t={t} state={i < at ? 'beaten' : i === at && !closed ? 'next' : 'ahead'} label={t.badge} badge={shown <= BADGE_ART_REGIONS ? `/sprites/badges/${shown}-${i + 1}.png` : undefined} />)}
      </div>
      <div className="gyms four">
        {l.four.map((t, i) => <Trainer key={`${t.name}${i}`} t={t} state={done || (inLeague && i < league.run) ? 'beaten' : inLeague && i === league.run ? 'next' : 'ahead'} label="Elite Four" />)}
        <Trainer t={l.champion} state={done ? 'beaten' : inLeague && league.run === 4 ? 'next' : 'ahead'} label="Champion" />
      </div>
      <p className="muted">
        {done ? 'Every league is beaten.'
          : closed ? `${name} is not open yet: it needs ${(league.region - 1) * GRADUATES_PER_REGION} fully trained Pokemon (you have ${game.graduates.length}). Badge weeks still hand over stones meanwhile.`
          : inLeague ? `The league: each badge week beats the next of the Elite Four, then the Champion. ${league.run} of ${LEAGUE_STEPS} done. A week off costs nothing.`
          : `A week (Monday to Sunday) with ${BADGE_DAYS} days of ${PILLARS_FOR_A_DAY} or more pillars beats ${l.gyms[league.badges].name}.`}
        {' '}{plural(league.beaten, 'league')} beaten.
      </p>
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
    <Win title="Trainer stats" tone="blue" aside={`last ${STAT_DAYS} days`}>
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
      <p className="muted">Your own numbers, not the partner's: the share of each thing you did over the last {STAT_DAYS} days. Speed is steps against {STEPS_GOAL.toLocaleString('en-IN')} a day, and Defense becomes measured recovery once the band reports it.</p>
    </Win>
  )
}

/** Regions whose badges have artwork (Kanto to Kalos); see tools/build-badges.py. */
const BADGE_ART_REGIONS = 6
const DAYS_SHOWN = 30
function TrainerTab({ game }: { game: Game }) {
  const days = game.days.slice(-DAYS_SHOWN)
  const max = Math.max(100, ...days.map((d) => d.xp))
  const total = game.days.reduce((s, d) => s + d.xp, 0)
  const best = game.days.reduce((b, d) => (d.xp > b.xp ? d : b), game.days[0] ?? { day: '', xp: 0 })
  const seen = Object.keys(game.dex).filter((id) => !SPECIES[id]?.f).length
  const events = [...game.moments].reverse().filter((m, i, all) => m.kind !== 'level' || all.findIndex((x) => x.kind === 'level' && x.day === m.day) === i).slice(0, 80)
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
            <dt>Badge weeks</dt><dd>{game.badges.length} · {plural(game.league.beaten, 'league')}</dd>
          </dl>
        </div>
        <div className="who"><Sprite form={game.partner.form} shiny={game.partner.shiny} size={96} /></div>
        <div className="badges" title="The badges of the region you are challenging">
          {Array.from({ length: BADGES_PER_REGION }, (_, i) => {
            const region = Math.min(game.league.region, LEAGUES.length)
            const t = LEAGUES[region - 1].gyms[i]
            const on = game.league.region > LEAGUES.length || i < game.league.badges
            const title = `${t.badge}${/ Z$/.test(t.badge) ? '' : ' Badge'}: ${on ? 'earned' : `beat ${t.name}`}`
            // the real badge where there is a picture of it; a plain shape for the regions without one
            return region <= BADGE_ART_REGIONS
              ? <img key={i} src={`/sprites/badges/${region}-${i + 1}.png`} alt={title} title={title} width={44} height={44} className={`sprite badge-art ${on ? 'on' : ''}`} />
              : <span key={i} className={`badge b${i} ${on ? 'on' : ''}`} title={title} />
          })}
        </div>
      </section>

      <div className="cols">
        <Gyms game={game} />
        <StatsRadar stats={game.stats} />
      </div>

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

// ── Rules ───────────────────────────────────────────────────────────────────
function RulesTab() {
  return (
    <>
      <p className="lead">Nothing is earned here. Everything comes from ticking your day in Life OS; this app only shows what that built.</p>
      <div className="cols">
        <Win title="XP per habit" tone="gold">
          <div className="tiers">
            <div><b>{TIER_XP.pillar}</b>pillar</div><div><b>{TIER_XP.core}</b>core</div><div><b>{TIER_XP.standard}</b>standard</div><div><b>{TIER_XP.basic}</b>basic</div>
          </div>
          <p>Pillars are the day's real work: whichever habits you mark as pillars in Life OS. Arbor and Woodshed pay for the share of the block you finished. A tick counts if it is made by the end of the next day, and un-ticking takes the XP straight back.</p>
        </Win>
        <Win title="Momentum" tone="gold">
          <p>A day with {PILLARS_FOR_A_DAY} or more pillars counts. Three of the last seven days give ×1.2, five give ×1.35 and seven give ×1.5. One missed day slides the number down a step; it never resets.</p>
        </Win>
      </div>
      <div className="cols">
        <Win title="One partner" tone="blue">
          <p>All XP goes to one partner. Level L needs {xpForLevel(1)}×L² XP in total. Three-stage lines evolve at levels {evolveAt(3, 1)} and {evolveAt(3, 2)}, two-stage lines at {evolveAt(2, 1)}. At level {graduateAt(3)} ({graduateAt(1)} for a single-stage one) it is fully trained and the oldest catch in the queue takes over. If the queue is empty, the egg hatches.</p>
          <p className="muted">Level {levelOf(1536)} takes 1,536 XP: about four full days, or eight ordinary ones.</p>
        </Win>
        <Win title="Catching">
          <p>Every day has one wild Pokemon. Its HP is the habits you have left: tick them all (a perfect day) and it is caught. Every {RARE_EVERY}th perfect day is a rare, every {SHINY_EVERY}th a shiny and every {LEGENDARY_EVERY}th a legendary. The next region opens only when both are true: its league before it is beaten, and {GRADUATES_PER_REGION} more partners are fully trained.</p>
        </Win>
      </div>
      <div className="cols">
        <Win title="Forms" tone="dark">
          <p>Every evolution happens by level, on its own. Branching evolutions follow what you did most while raising it. Mega forms show while momentum is full (X when the gym led the week, Y when code or guitar did). Gigantamax shows on a perfect day. A partner that never had two empty days in a row keeps its Bond ribbon.</p>
        </Win>
        <Win title="Gyms and the league" tone="green">
          <p>A week (Monday to Sunday) with {BADGE_DAYS} days of {PILLARS_FOR_A_DAY} or more pillars is a badge week: it beats the next gym leader of the region you are in. After the eighth badge, the next four beat the Elite Four and the fifth the Champion. A week off never undoes anything.</p>
        </Win>
      </div>
      <div className="cols">
        <Win title="Stones" tone="green">
          <p>A rare extra, earned and never bought: one with each gym badge, each league win and every {RARE_EVERY}th perfect day. Nothing needs one. You can spend a stone, by hand, on one of three things: a {MEGA_DAYS}-day Mega Evolution without full momentum, choosing the branch of a branching evolution, or bringing a queued Pokemon forward as your partner. None of them gives XP.</p>
        </Win>
        <Win title="Sleep" tone="blue">
          <p>Once the band reports a sleep score, Sleep becomes a pillar that only the band can fill: it pays the score as a share of {TIER_XP.pillar} XP and counts as done at {SLEEP_DONE} or more. The score is how long you slept, how much of it was deep or REM, and how unbroken it was. A poor night costs XP but never a perfect day: that is judged on what you can still do today. Until the band is in use the sleep habit is ticked by hand as before.</p>
          <p className="muted">These rules are version 2, in force from {fmtDay(V2_START)}. Earlier days keep the first rules.</p>
        </Win>
      </div>
    </>
  )
}

export default function App() {
  const view = useView()
  const [tab, setTab] = useState<Tab>('partner')
  useEffect(() => start(), [])
  const { game } = view
  // the first read has not landed yet: do not draw an empty day as if it were real
  const loading = view.status === 'connecting'
  const status = view.status === 'live' ? ['live', 'Synced'] : view.status === 'connecting' ? ['connecting', 'Loading'] : view.status === 'error' ? ['error', 'Offline'] : ['off', 'Local only']
  return (
    <div className="shell">
      <header className="device">
        <span className="lens" aria-hidden />
        <span className="lights" aria-hidden><i /><i /><i /></span>
        <div className="brand">POKEDEX<small>powered by your Life OS habits</small></div>
        <div className={`pill s-${status[0]}`} role="status">{status[1]}</div>
      </header>
      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(([id, text]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); window.scrollTo({ top: 0 }) }}>{text}</button>)}
      </nav>
      <main>
        {loading && tab !== 'rules' && (
          <Win title="Loading" tone="dark">
            <div className="care"><Egg /><p>Reading your Life OS ledger...<span className="muted" style={{ display: 'block' }}>Your partner appears as soon as it arrives.</span></p></div>
          </Win>
        )}
        {!loading && tab === 'partner' && <PartnerTab game={game} facts={view.facts} body={view.body} />}
        {!loading && tab === 'bag' && <BagTab game={game} />}
        {!loading && tab === 'dex' && <DexTab game={game} />}
        {!loading && tab === 'trainer' && <TrainerTab game={game} />}
        {tab === 'rules' && <RulesTab />}
      </main>
    </div>
  )
}
