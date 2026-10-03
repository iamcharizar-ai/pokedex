import { useEffect, useMemo, useState } from 'react'
import { nameOf, spritePath, type Game, type Mon, type Moment } from '../core/fold.ts'
import type { DayFacts } from '../core/facts.ts'
import {
  BADGES_PER_REGION, BADGE_DAYS, GRADUATES_PER_REGION, LEGENDARY_EVERY, RARE_EVERY, REGIONS, SHINY_EVERY,
  TIER_XP, evolveAt, graduateAt, levelOf, xpForLevel,
} from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { VITALS_URL, start, useView, type BodyDay } from './lib/store.ts'

type Tab = 'partner' | 'dex' | 'journal' | 'rules'
const TABS: [Tab, string][] = [['partner', 'Partner'], ['dex', 'Pokedex'], ['journal', 'Journal'], ['rules', 'How it works']]
const TAG_NAME: Record<string, string> = { code: 'Code', fitness: 'Gym', guitar: 'Guitar', arbor: 'Arbor', sleep: 'Sleep', routine: 'Routine', balanced: 'Balance', health: 'Health tracker' }
const still = (form: string, shiny = false) => `/sprites/static${shiny ? '-shiny' : ''}/${form}.png`
const fmtDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

function Sprite({ form, shiny, size, className = '' }: { form: string; shiny?: boolean; size: number; className?: string }) {
  return <img src={spritePath(form, shiny)} alt="" width={size} height={size} className={`sprite ${className}`} style={{ width: size, height: size }} />
}

// ── Partner ─────────────────────────────────────────────────────────────────
function PartnerTab({ game, facts, body }: { game: Game; facts: DayFacts[]; body: BodyDay | null }) {
  const { partner, today, momentum } = game
  const last7 = game.days.slice(-8, -1)
  const todayFacts = facts[facts.length - 1]?.habits ?? []
  const big = todayFacts.filter((h) => h.worth >= 30)
  const small = todayFacts.filter((h) => h.worth < 30)
  const smallGot = small.reduce((s, h) => s + h.worth * h.frac, 0)
  const smallMax = small.reduce((s, h) => s + h.worth, 0)
  const rec = SPECIES[partner.form]
  return (
    <>
      <section className={`stage ${game.aura ? `aura-${game.aura}` : ''}`}>
        <div className="stage-floor">
          <Sprite form={game.display} shiny={partner.shiny} size={192} className={game.asleep ? 'asleep' : ''} />
        </div>
        <div className="stage-info">
          <div className="eyebrow">#{String(rec.d).padStart(3, '0')} · {partner.origin === 'starter' ? 'starter' : partner.origin === 'egg' ? 'hatched' : 'caught'} {fmtDay(partner.from)}</div>
          <h1>{nameOf(game.display)}{partner.shiny && <span className="chip">shiny</span>}</h1>
          <div className="lv">Level {game.level}</div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={game.need} aria-valuenow={game.into} aria-label="Progress to the next level">
            <i style={{ width: `${Math.min(100, (game.into / game.need) * 100)}%` }} />
          </div>
          <div className="muted">{Math.round(game.into)} / {game.need} XP to level {game.level + 1}</div>
          <p className="next">
            {game.next.what === 'evolve' ? 'Evolves' : 'Fully trained'} at level {game.next.level}
            {' '}({Math.max(0, xpForLevel(game.next.level) - Math.round(partner.xp)).toLocaleString('en-IN')} XP to go)
          </p>
          {game.asleep && <p className="warn">Asleep after two days without a pillar. One pillar wakes it.</p>}
          {game.aura === 'mega' && <p className="good">Momentum is full: Mega form while it lasts.</p>}
          {game.aura === 'gmax' && <p className="good">Perfect day: Gigantamax for today.</p>}
          <div className="path">
            {partner.path.map((f, i) => (
              <span key={f} className="path-step">{i > 0 && <span className="arrow">→</span>}<img src={still(f, partner.shiny)} alt={nameOf(f)} title={nameOf(f)} width={40} height={40} className="sprite" /></span>
            ))}
            <span className={`ribbon ${partner.bond ? 'on' : ''}`} title="Never two empty days in a row while it is your partner">Bond {partner.bond ? 'intact' : 'broken'}</span>
          </div>
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <h2>Today <span className="num">+{today.xp} XP</span></h2>
          <ul className="rows">
            {big.map((h) => (
              <li key={h.id} className={h.frac >= 1 ? 'done' : ''}>
                <span>{TAG_NAME[h.tag] ?? h.tag}{h.pillar ? '' : ' (support)'}</span>
                <span className="meter"><i style={{ width: `${h.frac * 100}%` }} /></span>
                <span className="num">{Math.round(h.worth * h.frac)}/{h.worth}</span>
              </li>
            ))}
            <li className={smallMax > 0 && smallGot >= smallMax ? 'done' : ''}>
              <span>Routine ({small.filter((h) => h.done).length}/{small.length})</span>
              <span className="meter"><i style={{ width: `${smallMax ? (smallGot / smallMax) * 100 : 0}%` }} /></span>
              <span className="num">{Math.round(smallGot)}/{smallMax}</span>
            </li>
          </ul>
          <p className="muted">
            {today.perfect ? 'Perfect day: a new one joined the queue.' : `${today.total - today.done} of ${today.total} left for a perfect day (the only way to catch).`}
          </p>
        </div>
        <div className="panel">
          <h2>Momentum <span className="num">×{momentum.mult}</span></h2>
          <div className="dots" aria-label={`${momentum.days} of the last 7 days counted`}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = last7[i - (7 - last7.length)]
              return <span key={i} className={`dot ${d?.counts ? 'on' : d ? 'off' : 'none'}`} title={d ? `${fmtDay(d.day)}: ${d.pillars} pillars` : 'before the game began'} />
            })}
          </div>
          <p className="muted">{momentum.days} of the last 7 days had two or more pillars. 3 days ×1.2 · 5 days ×1.35 · 7 days ×1.5 and the Mega form.</p>
          <h2 className="mt">Up next <span className="num">{game.queue.length}</span></h2>
          {game.queue.length === 0 ? (
            <p className="muted">Nothing waiting. A perfect day adds one; if the queue is empty when this partner is fully trained, an egg hatches.</p>
          ) : (
            <div className="queue">{game.queue.map((m) => <img key={m.uid} src={still(m.form, m.shiny)} alt={nameOf(m.form)} title={`${nameOf(m.form)} · caught ${fmtDay(m.from)}`} width={56} height={56} className="sprite" />)}</div>
          )}
        </div>
      </section>
      {body && (
        <a className="panel bodyline" href={VITALS_URL} target="_blank" rel="noreferrer">
          <h2>Body <span className="num">{fmtDay(body.day)}</span></h2>
          <p className="muted">
            {[body.sleepMin !== undefined && `slept ${Math.floor(body.sleepMin / 60)}h ${String(body.sleepMin % 60).padStart(2, '0')}m`, body.steps !== undefined && `${body.steps.toLocaleString('en-IN')} steps`, body.weightKg !== undefined && `${body.weightKg} kg`].filter(Boolean).join(' · ') || 'readings recorded'}
            {' · open Vitals'}
          </p>
        </a>
      )}
    </>
  )
}

// ── Pokedex ─────────────────────────────────────────────────────────────────
function DexTab({ game }: { game: Game }) {
  const [region, setRegion] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const owned = useMemo(() => {
    const m = new Map<string, Mon>()
    for (const x of [...game.graduates, game.partner, ...game.queue]) for (const f of x.path) m.set(f, x)
    return m
  }, [game])
  const entries = useMemo(
    () => Object.entries(SPECIES).filter(([, r]) => !r.f && (SPECIES[r.b ?? '']?.g ?? r.g) === region).sort((a, b) => a[1].d - b[1].d),
    [region],
  )
  const seen = entries.filter(([id]) => game.dex[id]).length
  const locked = region > game.regions
  const total = Object.values(SPECIES).filter((r) => !r.f).length
  const sel = open ? SPECIES[open] : null
  const forms = sel ? [...(sel.m ?? []), ...(sel.gm ? [sel.gm] : [])] : []
  return (
    <>
      <div className="summary">
        <div><b>{Object.keys(game.dex).filter((id) => !SPECIES[id]?.f).length}</b><span>of {total} seen</span></div>
        <div><b>{game.graduates.length}</b><span>fully trained</span></div>
        <div><b>{game.perfectDays}</b><span>perfect days</span></div>
        <div><b>{game.badges.length}</b><span>badges</span></div>
      </div>
      <div className="seg" role="tablist">
        {REGIONS.map((name, i) => (
          <button key={name} role="tab" aria-selected={region === i + 1} className={region === i + 1 ? 'on' : ''} onClick={() => { setRegion(i + 1); setOpen(null) }}>
            {name}{i + 1 > game.regions ? ' ·' : ''}
          </button>
        ))}
      </div>
      <p className="muted">
        {locked
          ? `Locked. Opens after ${(region - 1) * GRADUATES_PER_REGION} fully trained partners (you have ${game.graduates.length}).`
          : `${seen} of ${entries.length} seen in ${REGIONS[region - 1]}.`}
      </p>
      {sel && open && (
        <div className="panel detail">
          {game.dex[open] ? <Sprite form={open} shiny={game.dex[open].shiny} size={120} /> : <img src={still(open)} alt="" width={96} height={96} className="sprite unseen" />}
          <div>
            <div className="eyebrow">#{String(sel.d).padStart(3, '0')} · {sel.t}</div>
            <h2>{game.dex[open] ? sel.n : '???'}</h2>
            <p className="muted">
              {game.dex[open] ? `First seen ${fmtDay(game.dex[open].first)}.` : 'Not seen yet.'}
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
          <button className="close" onClick={() => setOpen(null)} aria-label="Close">✕</button>
        </div>
      )}
      <div className={`dex ${locked ? 'locked' : ''}`}>
        {entries.map(([id, r]) => {
          const e = game.dex[id]
          const mon = owned.get(id)
          return (
            <button key={id} className={`cell ${e ? 'seen' : ''} ${open === id ? 'sel' : ''}`} onClick={() => setOpen(open === id ? null : id)} title={e ? r.n : `#${r.d}`}>
              <img src={still(id, e?.shiny)} alt="" loading="lazy" width={64} height={64} className={`sprite ${e ? '' : 'unseen'}`} />
              <span className="no">{String(r.d).padStart(3, '0')}</span>
              {mon?.graduated && <span className="star" title="Fully trained">★</span>}
              {e?.shiny && <span className="shine" title="Shiny">✦</span>}
            </button>
          )
        })}
      </div>
      <h2 className="mt">Badges</h2>
      <div className="badges">
        {Array.from({ length: Math.max(BADGES_PER_REGION, Math.ceil((game.badges.length + 1) / BADGES_PER_REGION) * BADGES_PER_REGION) }, (_, i) => (
          <span key={i} className={`badge b${i % BADGES_PER_REGION} ${game.badges[i] ? 'on' : ''}`} title={game.badges[i] ? `Week of ${fmtDay(game.badges[i])}` : 'A week with five solid days'} />
        ))}
      </div>
    </>
  )
}

// ── Journal ─────────────────────────────────────────────────────────────────
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
function JournalTab({ game }: { game: Game }) {
  const days = game.days.slice(-30)
  const max = Math.max(100, ...days.map((d) => d.xp))
  const events = [...game.moments].reverse().filter((m, i, all) => m.kind !== 'level' || all.findIndex((x) => x.kind === 'level' && x.day === m.day) === i)
  return (
    <>
      <div className="panel">
        <h2>XP per day <span className="num">last {days.length}</span></h2>
        <div className="chart" role="img" aria-label="XP earned on each of the last days">
          {days.map((d) => (
            <span key={d.day} className={`col ${d.perfect ? 'perfect' : d.counts ? 'counts' : ''}`} title={`${fmtDay(d.day)}: ${d.xp} XP · ${d.pillars}/${d.pillarTotal} pillars · ${d.done}/${d.total} habits${d.mult > 1 ? ` · ×${d.mult}` : ''}`}>
              <i style={{ height: `${(d.xp / max) * 100}%` }} />
            </span>
          ))}
        </div>
        <div className="legend"><span className="k perfect" />perfect day<span className="k counts" />two or more pillars<span className="k" />other</div>
      </div>
      <div className="panel">
        <h2>What happened</h2>
        {events.length === 0 ? <p className="muted">Nothing yet. Tick a pillar in Life OS.</p> : (
          <ul className="log">{events.slice(0, 80).map((m, i) => <li key={i}><time>{fmtDay(m.day)}</time><span className={`k-${m.kind}`}>{line(m)}</span></li>)}</ul>
        )}
      </div>
    </>
  )
}

// ── Rules ───────────────────────────────────────────────────────────────────
function RulesTab() {
  return (
    <div className="panel prose">
      <h2>How it works</h2>
      <p>Nothing is earned here. Everything comes from ticking your day in Life OS; this site only shows what that built.</p>
      <h3>XP</h3>
      <p>Pillar habits (LeetCode, Gym, Woodshed) pay {TIER_XP.pillar} each. Core habits pay {TIER_XP.core}, standard {TIER_XP.standard}, basic {TIER_XP.basic}. Arbor and Woodshed pay for the share of the block you finished. A tick counts if it is made by the end of the next day.</p>
      <h3>Momentum</h3>
      <p>Days with two or more pillars count. Three of the last seven give ×1.2, five ×1.35, seven ×1.5. One missed day slides the number down a step; it never resets.</p>
      <h3>One partner</h3>
      <p>All XP goes to one partner. Level L needs {xpForLevel(1)}×L² XP in total. Three-stage lines evolve at {evolveAt(3, 1)} and {evolveAt(3, 2)}, two-stage lines at {evolveAt(2, 1)}. At level {graduateAt(3)} ({graduateAt(1)} for a single-stage one) it is fully trained and the oldest catch in the queue takes over. If the queue is empty, an egg hatches.</p>
      <h3>Catching</h3>
      <p>Only a perfect day (every habit on that day's list ticked) catches. Every {RARE_EVERY}th perfect day is a rare, every {SHINY_EVERY}th a shiny, every {LEGENDARY_EVERY}th a legendary. Each {GRADUATES_PER_REGION} fully trained partners open the next region.</p>
      <h3>Forms</h3>
      <p>Branching evolutions follow what you did most while raising it. Mega forms show while momentum is full (X when the gym led the week, Y when code or guitar did). Gigantamax shows on a perfect day. A partner that never had two empty days in a row gets a Bond ribbon.</p>
      <h3>Badges</h3>
      <p>A week (Monday to Sunday) with {BADGE_DAYS} days of two or more pillars earns a badge.</p>
      <p className="muted">Level {levelOf(1536)} takes 1,536 XP: about four full days, or eight ordinary ones.</p>
    </div>
  )
}

export default function App() {
  const view = useView()
  const [tab, setTab] = useState<Tab>('partner')
  useEffect(() => start(), [])
  const { game } = view
  return (
    <div className="shell">
      <header>
        <div className="brand">POKEDEX<span>// life os</span></div>
        <div className={`sync s-${view.status}`}>{view.status === 'live' ? 'synced' : view.status === 'connecting' ? 'loading' : view.status === 'error' ? 'offline' : 'local only'}</div>
      </header>
      <nav className="tabs" role="tablist">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
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
