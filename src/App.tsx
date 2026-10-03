import { useEffect, useMemo, useState } from 'react'
import { nameOf, spritePath, type Game, type Mon, type Moment } from '../core/fold.ts'
import type { DayFacts, HabitFact } from '../core/facts.ts'
import {
  BADGES_PER_REGION, BADGE_DAYS, GRADUATES_PER_REGION, LEGENDARY_EVERY, MOMENTUM_WINDOW, RARE_EVERY, REGIONS, SHINY_EVERY,
  TIER_XP, evolveAt, graduateAt, levelOf, momentumMult, xpForLevel,
} from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { VITALS_URL, start, useView, type BodyDay } from './lib/store.ts'

type Tab = 'partner' | 'dex' | 'journal' | 'rules'
const TABS: [Tab, string][] = [['partner', 'Partner'], ['dex', 'Pokedex'], ['journal', 'Journal'], ['rules', 'Rules']]
const TAG_NAME: Record<string, string> = { code: 'Code', fitness: 'Gym', guitar: 'Guitar', arbor: 'Arbor', sleep: 'Sleep', routine: 'Routine', balanced: 'Balance', health: 'Health tracker' }
const still = (form: string, shiny = false) => `/sprites/static${shiny ? '-shiny' : ''}/${form}.png`
const fmtDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const weekday = (day: string, len: 1 | 3 = 1) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: len === 1 ? 'narrow' : 'short' })
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

function Sprite({ form, shiny, size, className = '' }: { form: string; shiny?: boolean; size: number; className?: string }) {
  return <img src={spritePath(form, shiny)} alt="" width={size} height={size} className={`sprite ${className}`} style={{ width: size, height: size }} />
}

/** The level bar: green is what was banked before today, striped gold is what today added. */
function XpBar({ game }: { game: Game }) {
  const pct = clamp01(game.into / game.need)
  const before = Math.min(pct, clamp01(game.intoBeforeToday / game.need))
  const left = Math.max(0, Math.round(game.need - game.into))
  return (
    <div>
      <div
        className="xp-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={game.need}
        aria-valuenow={Math.round(game.into)}
        aria-valuetext={`${Math.round(game.into)} of ${game.need} XP, ${Math.round(game.into - game.intoBeforeToday)} of it earned today`}
        aria-label="Progress to the next level"
      >
        <i className="base" style={{ width: `${before * 100}%` }} />
        <i className="today" style={{ width: `${(pct - before) * 100}%` }} />
      </div>
      <div className="xp-legend">
        <span><span className="sw base" />Banked <b>{Math.round(game.intoBeforeToday)}</b></span>
        <span><span className="sw today" />Today <b>+{game.today.xp}</b></span>
        <span className="left"><b>{left}</b> XP to level {game.level + 1}</span>
      </div>
    </div>
  )
}

// ── Partner ─────────────────────────────────────────────────────────────────
const stateOf = (h: HabitFact): 'done' | 'part' | 'none' => (h.frac >= 1 ? 'done' : h.frac > 0 ? 'part' : 'none')
const label = (h: HabitFact): string => h.name?.trim() || TAG_NAME[h.tag] || h.id

function PillarCard({ h }: { h: HabitFact }) {
  const st = stateOf(h)
  return (
    <div className={`pcard ${st}`} data-tag={h.tag}>
      <div className="row">
        <span className="tag">{TAG_NAME[h.tag] ?? h.tag}</span>
        <span className="state">{st === 'done' ? 'Done' : st === 'part' ? `${Math.round(h.frac * 100)}% done` : 'Not yet'}</span>
      </div>
      <div className="name">{label(h)}</div>
      <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(h.frac * 100)} aria-label={`${label(h)} progress`}>
        <i style={{ width: `${h.frac * 100}%` }} />
      </div>
      <div className="row">
        <span className="muted">XP earned</span>
        <span className="pts">{Math.round(h.worth * h.frac)}<small> / {h.worth}</small></span>
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

function TodayBoard({ game, facts }: { game: Game; facts: DayFacts[] }) {
  const { today, momentum } = game
  const habits = facts[facts.length - 1]?.habits ?? []
  const pillars = habits.filter((h) => h.pillar)
  const core = habits.filter((h) => !h.pillar && h.worth >= TIER_XP.core)
  const small = habits.filter((h) => !h.pillar && h.worth < TIER_XP.core)
  const smallGot = small.reduce((s, h) => s + h.worth * h.frac, 0)
  const smallMax = small.reduce((s, h) => s + h.worth, 0)
  const smallDone = small.filter((h) => h.done).length
  const left = today.total - today.done
  return (
    <section className="panel" aria-labelledby="today-h">
      <div className="panel-head">
        <h2 id="today-h">Today</h2>
        <span className="big">+{today.xp} XP</span>
      </div>
      {momentum.mult > 1 && <p className="muted" style={{ marginTop: -6 }}>Includes ×{momentum.mult} momentum on {today.base} base XP.</p>}
      {pillars.length > 0 && (
        <div className="pillars">{pillars.map((h) => <PillarCard key={h.id} h={h} />)}</div>
      )}
      {(core.length > 0 || small.length > 0) && (
        <>
          <div className="sub-h"><h3>Support and routine</h3><span className="muted">smaller XP, but all of it counts toward a perfect day</span></div>
          <ul className="list">{core.map((h) => <HabitRow key={h.id} h={h} />)}</ul>
          {small.length > 0 && (
            <details className="fold">
              <summary>
                <span className="caret" aria-hidden>▸</span>
                <span>Everyday habits <span className="muted">({smallDone} of {small.length} done)</span></span>
                <span className="meter" aria-hidden><i style={{ width: `${smallMax ? (smallGot / smallMax) * 100 : 0}%` }} /></span>
                <span className="pts num muted" style={{ textAlign: 'right' }}>{Math.round(smallGot)}/{smallMax}</span>
              </summary>
              <ul className="list">{small.map((h) => <HabitRow key={h.id} h={h} />)}</ul>
            </details>
          )}
        </>
      )}
      <div className={`perfect-day ${today.perfect ? 'on' : ''}`}>
        <span>
          {today.perfect
            ? 'Perfect day. A new Pokemon joined the queue.'
            : `${left} of ${today.total} habits left for a perfect day, the only way to catch a new one.`}
        </span>
        <span className="meter done" aria-hidden><i style={{ width: `${today.total ? (today.done / today.total) * 100 : 0}%` }} /></span>
        <span className="num">{today.done}/{today.total}</span>
      </div>
    </section>
  )
}

function MomentumPanel({ game }: { game: Game }) {
  const { momentum } = game
  const prev = game.days.slice(-(MOMENTUM_WINDOW + 1), -1)
  const missing = MOMENTUM_WINDOW - prev.length
  const steps = [0, 3, 5, 7]
  const next = steps.find((s) => s > momentum.days)
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Momentum</h2>
        <span className="big">×{momentum.mult}</span>
      </div>
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
        {momentum.days} of the last 7 days had two or more pillars.
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
    </div>
  )
}

function PartnerTab({ game, facts, body }: { game: Game; facts: DayFacts[]; body: BodyDay | null }) {
  const { partner } = game
  const rec = SPECIES[partner.form]
  const toGo = Math.max(0, xpForLevel(game.next.level) - Math.round(partner.xp))
  return (
    <>
      <section className={`stage ${game.aura ? `aura-${game.aura}` : ''}`}>
        <div className="stage-floor">
          <Sprite form={game.display} shiny={partner.shiny} size={192} className={game.asleep ? 'asleep' : ''} />
        </div>
        <div>
          <div className="eyebrow">#{String(rec.d).padStart(3, '0')} · {partner.origin === 'starter' ? 'starter' : partner.origin === 'egg' ? 'hatched' : 'caught'} {fmtDay(partner.from)}</div>
          <h1>{nameOf(game.display)}{partner.shiny && <span className="chip">shiny</span>}</h1>
          <div className="lv">Level {game.level}<small>{Math.round(game.into)} / {game.need} XP in this level</small></div>
          <XpBar game={game} />
          <p className="next">
            {game.next.what === 'evolve' ? 'Evolves' : 'Fully trained'} at level {game.next.level}
            {' '}<span>· {toGo.toLocaleString('en-IN')} XP to go</span>
          </p>
          {game.asleep && <p className="notice warn">Asleep after two days without a pillar. Finish one pillar to wake it.</p>}
          {game.aura === 'mega' && <p className="notice good">Momentum is full: Mega form while it lasts.</p>}
          {game.aura === 'gmax' && <p className="notice gmax">Perfect day: Gigantamax for today.</p>}
          <div className="path">
            {partner.path.map((f, i) => (
              <span key={f} className="path-step">{i > 0 && <span className="arrow">→</span>}<img src={still(f, partner.shiny)} alt={nameOf(f)} title={nameOf(f)} width={40} height={40} className="sprite" /></span>
            ))}
            <span className={`ribbon ${partner.bond ? 'on' : ''}`} title="Never two empty days in a row while it is your partner">Bond {partner.bond ? 'intact' : 'broken'}</span>
          </div>
        </div>
      </section>

      <TodayBoard game={game} facts={facts} />

      <section className="grid2">
        <MomentumPanel game={game} />
        <div className="panel">
          <div className="panel-head">
            <h2>Up next</h2>
            <span className="big">{game.queue.length}</span>
          </div>
          {game.queue.length === 0 ? (
            <p className="muted">Nobody is waiting. A perfect day catches a new Pokemon; if the queue is empty when this partner is fully trained, an egg hatches.</p>
          ) : (
            <div className="queue">{game.queue.map((m) => <img key={m.uid} src={still(m.form, m.shiny)} alt={nameOf(m.form)} title={`${nameOf(m.form)} · caught ${fmtDay(m.from)}`} width={64} height={64} className="sprite" />)}</div>
          )}
          {body && (
            <a className="panel bodyline" href={VITALS_URL} target="_blank" rel="noreferrer" style={{ background: 'var(--panel-2)', marginBottom: 0 }}>
              <div className="panel-head"><h2>Body</h2><span className="sub">{fmtDay(body.day)}</span></div>
              <p className="muted" style={{ margin: 0 }}>
                {[body.sleepMin !== undefined && `slept ${Math.floor(body.sleepMin / 60)}h ${String(body.sleepMin % 60).padStart(2, '0')}m`, body.steps !== undefined && `${body.steps.toLocaleString('en-IN')} steps`, body.weightKg !== undefined && `${body.weightKg} kg`].filter(Boolean).join(' · ') || 'Readings recorded'}
                {' · open Vitals ↗'}
              </p>
            </a>
          )}
        </div>
      </section>
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
      <div className="stats">
        <div className="stat"><b>{seenTotal}</b><span>of {all.length} seen</span></div>
        <div className="stat"><b>{game.graduates.length}</b><span>fully trained</span></div>
        <div className="stat"><b>{game.perfectDays}</b><span>perfect days</span></div>
        <div className="stat"><b>{game.badges.length}</b><span>weekly badges</span></div>
      </div>

      <div className="regions" role="tablist" aria-label="Region">
        {REGIONS.map((name, i) => (
          <button key={name} role="tab" aria-selected={region === i + 1} className={`${region === i + 1 ? 'on' : ''} ${i + 1 > game.regions ? 'lock' : ''}`} onClick={() => { setRegion(i + 1); setOpen(null) }}>
            <span className="n">{name}{i + 1 > game.regions ? ' · locked' : ''}</span>
            <span className="c">{perRegion[i].seen} / {perRegion[i].total}</span>
            <span className="meter"><i style={{ width: `${perRegion[i].total ? (perRegion[i].seen / perRegion[i].total) * 100 : 0}%` }} /></span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Filter">
          {([['all', 'All'], ['seen', 'Seen'], ['unseen', 'Not seen']] as [Show, string][]).map(([id, text]) => (
            <button key={id} aria-pressed={show === id} className={show === id ? 'on' : ''} onClick={() => setShow(id)}>{text}</button>
          ))}
        </div>
        <span className="muted">
          {locked
            ? `Locked until ${(region - 1) * GRADUATES_PER_REGION} Pokemon are fully trained (you have ${game.graduates.length}).`
            : `${perRegion[region - 1].seen} of ${entries.length} seen in ${REGIONS[region - 1]}.`}
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
                <span className="no">{String(r.d).padStart(3, '0')}</span>
                {mon?.graduated && <span className="star" title="Fully trained">★</span>}
                {e?.shiny && <span className="shine" title="Shiny">✦</span>}
              </button>
            )
          })}
          {shown.length === 0 && <p className="muted">Nothing here with this filter.</p>}
        </div>

        {sel && open ? (
          <aside className="panel detail" aria-live="polite">
            <div className="art">
              {game.dex[open] ? <Sprite form={open} shiny={game.dex[open].shiny} size={120} /> : <img src={still(open)} alt="" width={96} height={96} className="sprite unseen" />}
            </div>
            <div>
              <div className="eyebrow">#{String(sel.d).padStart(3, '0')} · {sel.t}</div>
              <h2>{game.dex[open] ? sel.n : '???'}</h2>
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
          <aside className="panel detail empty">
            <div className="art"><img src={still(entries[0]?.[0] ?? 'bulbasaur')} alt="" width={96} height={96} className="sprite unseen" /></div>
            Select a Pokemon to see when you first met it, how it evolves and its Mega or Gigantamax forms.
          </aside>
        )}
      </div>

      <h2 className="mt" style={{ marginBottom: 10 }}>Weekly badges</h2>
      <div className="badges">
        {Array.from({ length: Math.max(BADGES_PER_REGION, Math.ceil((game.badges.length + 1) / BADGES_PER_REGION) * BADGES_PER_REGION) }, (_, i) => (
          <span key={i} className={`badge b${i % BADGES_PER_REGION} ${game.badges[i] ? 'on' : ''}`} title={game.badges[i] ? `Week of ${fmtDay(game.badges[i])}` : `A week with ${BADGE_DAYS} solid days earns this`} />
        ))}
      </div>
    </>
  )
}

// ── Journal ─────────────────────────────────────────────────────────────────
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
function JournalTab({ game }: { game: Game }) {
  const days = game.days.slice(-DAYS_SHOWN)
  const max = Math.max(100, ...days.map((d) => d.xp))
  const total = days.reduce((s, d) => s + d.xp, 0)
  const best = days.reduce((b, d) => (d.xp > b.xp ? d : b), days[0] ?? { day: '', xp: 0 })
  const events = [...game.moments].reverse().filter((m, i, all) => m.kind !== 'level' || all.findIndex((x) => x.kind === 'level' && x.day === m.day) === i).slice(0, 80)
  const grouped = events.reduce<[string, Moment[]][]>((acc, m) => {
    const last = acc[acc.length - 1]
    if (last && last[0] === m.day) last[1].push(m)
    else acc.push([m.day, [m]])
    return acc
  }, [])
  return (
    <>
      <div className="stats">
        <div className="stat"><b>{total.toLocaleString('en-IN')}</b><span>XP in {days.length} {days.length === 1 ? 'day' : 'days'}</span></div>
        <div className="stat"><b>{best?.xp ?? 0}</b><span>best day{best?.day ? `, ${fmtDay(best.day)}` : ''}</span></div>
        <div className="stat"><b>{days.filter((d) => d.counts).length}</b><span>days with 2+ pillars</span></div>
        <div className="stat"><b>{game.perfectDays}</b><span>perfect days</span></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>XP per day</h2><span className="sub">last {days.length} {days.length === 1 ? 'day' : 'days'}</span></div>
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
          <div className="x" aria-hidden><span>{days.length < DAYS_SHOWN && days[0] ? `Game began ${fmtDay(days[0].day)}` : `${DAYS_SHOWN} days ago`}</span><span>Today</span></div>
        </div>
        <div className="legend">
          <span><i className="k today" />today</span><span><i className="k perfect" />perfect day</span><span><i className="k counts" />two or more pillars</span><span><i className="k" />other</span>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>What happened</h2></div>
        {grouped.length === 0 ? <p className="muted">Nothing yet. Tick a pillar in Life OS and it shows up here.</p> : (
          <ul className="log">
            {grouped.flatMap(([day, ms]) => [
              <li key={day} className="dayhead">{fmtDay(day)} · {weekday(day, 3)}</li>,
              ...ms.map((m, i) => <li className="ev" key={`${day}-${i}`}><span className={`kind k-${m.kind}`}>{KIND[m.kind]}</span><span>{line(m)}</span></li>),
            ])}
          </ul>
        )}
      </div>
    </>
  )
}

// ── Rules ───────────────────────────────────────────────────────────────────
function RulesTab() {
  return (
    <>
      <p className="muted" style={{ marginBottom: 14 }}>Nothing is earned here. Everything comes from ticking your day in Life OS; this site only shows what that built.</p>
      <div className="rules">
        <div className="panel">
          <h3>XP per habit</h3>
          <div className="tiers">
            <div><b>{TIER_XP.pillar}</b>pillar</div><div><b>{TIER_XP.core}</b>core</div><div><b>{TIER_XP.standard}</b>standard</div><div><b>{TIER_XP.basic}</b>basic</div>
          </div>
          <p>Pillars are LeetCode, Gym and Woodshed. Arbor and Woodshed pay for the share of the block you finished. A tick counts if it is made by the end of the next day, and un-ticking takes the XP straight back.</p>
        </div>
        <div className="panel">
          <h3>Momentum</h3>
          <p>A day with two or more pillars counts. Three of the last seven days give ×1.2, five give ×1.35 and seven give ×1.5. One missed day slides the number down a step; it never resets.</p>
        </div>
        <div className="panel">
          <h3>One partner</h3>
          <p>All XP goes to one partner. Level L needs {xpForLevel(1)}×L² XP in total. Three-stage lines evolve at levels {evolveAt(3, 1)} and {evolveAt(3, 2)}, two-stage lines at {evolveAt(2, 1)}. At level {graduateAt(3)} ({graduateAt(1)} for a single-stage one) it is fully trained and the oldest catch in the queue takes over. If the queue is empty, an egg hatches.</p>
          <p className="muted">Level {levelOf(1536)} takes 1,536 XP: about four full days, or eight ordinary ones.</p>
        </div>
        <div className="panel">
          <h3>Catching</h3>
          <p>Only a perfect day (every habit on that day's list ticked) catches. Every {RARE_EVERY}th perfect day is a rare, every {SHINY_EVERY}th a shiny and every {LEGENDARY_EVERY}th a legendary. Each {GRADUATES_PER_REGION} fully trained partners open the next region.</p>
        </div>
        <div className="panel">
          <h3>Forms</h3>
          <p>Branching evolutions follow what you did most while raising it. Mega forms show while momentum is full (X when the gym led the week, Y when code or guitar did). Gigantamax shows on a perfect day. A partner that never had two empty days in a row gets a Bond ribbon.</p>
        </div>
        <div className="panel">
          <h3>Badges</h3>
          <p>A week (Monday to Sunday) with {BADGE_DAYS} days of two or more pillars earns a badge. Each region has {BADGES_PER_REGION} badge slots on the Pokedex page.</p>
        </div>
      </div>
    </>
  )
}

export default function App() {
  const view = useView()
  const [tab, setTab] = useState<Tab>('partner')
  useEffect(() => start(), [])
  const { game } = view
  const status = view.status === 'live' ? ['live', 'Synced'] : view.status === 'connecting' ? ['connecting', 'Loading'] : view.status === 'error' ? ['error', 'Offline'] : ['off', 'Local only']
  return (
    <div className="shell">
      <header>
        <div className="brand">POKEDEX<span>// life os</span></div>
        <div className={`pill s-${status[0]}`} role="status">{status[1]}</div>
      </header>
      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(([id, text]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); window.scrollTo({ top: 0 }) }}>{text}</button>)}
      </nav>
      <main>
        {tab === 'partner' && <PartnerTab game={game} facts={view.facts} body={view.body} />}
        {tab === 'dex' && <DexTab game={game} />}
        {tab === 'journal' && <JournalTab game={game} />}
        {tab === 'rules' && <RulesTab />}
      </main>
    </div>
  )
}
