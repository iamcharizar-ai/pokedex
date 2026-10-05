import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { nameOf, spritePath, type Game, type Mon, type Moment } from '../core/fold.ts'
import type { DayFacts, HabitFact } from '../core/facts.ts'
import {
  BADGES_PER_REGION, BADGE_DAYS, GAME_START, GRADUATES_PER_REGION, LEGENDARY_EVERY, MOMENTUM_WINDOW, PILLARS_FOR_A_DAY, RARE_EVERY, REGIONS, SHINY_EVERY,
  TIER_XP, evolveAt, graduateAt, levelOf, momentumMult, xpForLevel,
} from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { LIFEOS_URL, VITALS_URL, start, useView, type BodyDay } from './lib/store.ts'

type Tab = 'partner' | 'dex' | 'trainer' | 'rules'
const TABS: [Tab, string][] = [['partner', 'Partner'], ['dex', 'Pokedex'], ['trainer', 'Trainer'], ['rules', 'Rules']]
const TAG_NAME: Record<string, string> = { code: 'Code', fitness: 'Gym', guitar: 'Guitar', arbor: 'Arbor', sleep: 'Sleep', routine: 'Routine', balanced: 'Balance', health: 'Health tracker' }
const still = (form: string, shiny = false) => `/sprites/static${shiny ? '-shiny' : ''}/${form}.png`
const fmtDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const weekday = (day: string, len: 1 | 3 = 1) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: len === 1 ? 'narrow' : 'short' })
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`
const dexNo = (n: number) => String(n).padStart(3, '0')

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

function Bag({ rest }: { rest: HabitFact[] }) {
  const core = rest.filter((h) => h.worth >= TIER_XP.core)
  const small = rest.filter((h) => h.worth < TIER_XP.core)
  const got = small.reduce((s, h) => s + h.worth * h.frac, 0)
  const max = small.reduce((s, h) => s + h.worth, 0)
  const all = rest.reduce((s, h) => s + h.worth * h.frac, 0)
  return (
    <Win title="Bag: support habits" tone="green" aside={`+${Math.round(all)} XP`}>
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
        <dt>Line</dt>
        <dd className="path">
          {partner.path.map((f, i) => (
            <span key={f} className="path-step">{i > 0 && <span className="arrow">▸</span>}<img src={still(f, partner.shiny)} alt={nameOf(f)} title={nameOf(f)} width={44} height={44} className="sprite" /></span>
          ))}
        </dd>
        <dt>Bond</dt><dd><span className={`ribbon ${partner.bond ? 'on' : ''}`} title="Never two empty days in a row while it is your partner">{partner.bond ? 'Ribbon intact' : 'Ribbon lost'}</span></dd>
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
        <Bag rest={habits.filter((h) => !h.pillar)} />
        <Momentum game={game} />
      </div>
      <div className="cols">
        <Summary game={game} />
        <DayCare game={game} body={body} />
      </div>
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
              ? `Locked until ${(region - 1) * GRADUATES_PER_REGION} Pokemon are fully trained (you have ${game.graduates.length}).`
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
const KIND: Record<Moment['kind'], string> = { level: 'Level', evolve: 'Evolved', graduate: 'Trained', partner: 'Partner', catch: 'Caught', form: 'Form', badge: 'Badge', region: 'Region' }
function line(m: Moment): string {
  switch (m.kind) {
    case 'level': return `${nameOf(m.form)} reached level ${m.level}`
    case 'evolve': return `${nameOf(m.from)} evolved into ${nameOf(m.form)}${m.tag ? ` (${TAG_NAME[m.tag] ?? m.tag} led)` : ''}`
    case 'graduate': return `${nameOf(m.form)} was fully trained${m.bond ? ' with a Bond ribbon' : ''}`
    case 'partner': return `${nameOf(m.form)} became the partner${m.origin === 'egg' ? ' (hatched from an egg)' : ''}`
    case 'catch': return `Perfect day #${m.n}: ${m.shiny ? 'shiny ' : ''}${nameOf(m.form)} joined the queue`
    case 'form': return `${nameOf(m.form)} registered (${m.what === 'mega' ? 'Mega' : 'Gigantamax'})`
    case 'badge': return `Badge #${m.n} earned`
    case 'region': return `${REGIONS[m.n - 1]} opened`
  }
}
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
  const slots = Math.max(BADGES_PER_REGION, Math.ceil((game.badges.length + 1) / BADGES_PER_REGION) * BADGES_PER_REGION)
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
          </dl>
        </div>
        <div className="who"><Sprite form={game.partner.form} shiny={game.partner.shiny} size={96} /></div>
        <div className="badges" title={`A week with ${BADGE_DAYS} solid days earns a badge`}>
          {Array.from({ length: slots }, (_, i) => (
            <span key={i} className={`badge b${i % BADGES_PER_REGION} ${game.badges[i] ? 'on' : ''}`} title={game.badges[i] ? `Week of ${fmtDay(game.badges[i])}` : `A week with ${BADGE_DAYS} solid days earns this`} />
          ))}
        </div>
      </section>

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
          <p>Every day has one wild Pokemon. Its HP is the habits you have left: tick them all (a perfect day) and it is caught. Every {RARE_EVERY}th perfect day is a rare, every {SHINY_EVERY}th a shiny and every {LEGENDARY_EVERY}th a legendary. Each {GRADUATES_PER_REGION} fully trained partners open the next region.</p>
        </Win>
      </div>
      <div className="cols">
        <Win title="Forms" tone="dark">
          <p>Branching evolutions follow what you did most while raising it. Mega forms show while momentum is full (X when the gym led the week, Y when code or guitar did). Gigantamax shows on a perfect day. A partner that never had two empty days in a row keeps its Bond ribbon.</p>
        </Win>
        <Win title="Badges" tone="green">
          <p>A week (Monday to Sunday) with {BADGE_DAYS} days of {PILLARS_FOR_A_DAY} or more pillars earns a badge. They are pinned to your trainer card, {BADGES_PER_REGION} to a row.</p>
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
        {!loading && tab === 'dex' && <DexTab game={game} />}
        {!loading && tab === 'trainer' && <TrainerTab game={game} />}
        {tab === 'rules' && <RulesTab />}
      </main>
    </div>
  )
}
