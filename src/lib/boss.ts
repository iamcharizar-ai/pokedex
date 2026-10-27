// The weekly boss, outside the core: drawing the card and measuring the week.
//
// The core (core/boss.ts, core/fold.ts) only ever sees a card and each day's
// progress on it, both read from the ledger. This file is what writes them: it
// picks the boss, sizes five tasks to what you have really been doing, and
// reads the week's raw events (Strong's workouts, Arbor's practice, Woodshed's
// logs, the band's nights, the day's ticks) into a 0-to-1 number per task.
// Nothing here is random at run time: every draw is seeded by the week, so two
// devices opened at the same moment write the same card.
import {
  BOSS_KINDS, BOSS_SHARE, bossNeed, LEGENDARY_EVERY_BOSS, bossLevel,
  type BossCard, type BossKind, type BossTask,
} from '../../core/boss.ts'
import { rng } from '../../core/economy.ts'
import { addDays, factsFor, type FactsInput } from '../../core/facts.ts'
import type { Game } from '../../core/fold.ts'
import { SLEEP_DONE, SLEEP_HABIT, levelOf } from '../../core/rules.ts'
import { SPECIES } from '../../core/species.ts'
import type { LedgerEvent } from '../linked/arbor-model.ts'
import { ITEMS } from '../linked/woodshed/course.ts'

/** A card is only drawn in the first days of a week, so a party filled on a Friday does not get a two-day boss. */
const PLAN_BY = 2
/** How far back "what you have been doing" looks. */
const LOOK_BACK = 21

// ── Strong: sets and long sessions, per day ─────────────────────────────────
interface Workout { id: string; startedAt?: string; finishedAt: string; exercises: { sets: unknown[] }[] }
const parse = <T,>(raw: unknown): T | null => { try { return JSON.parse(String(raw)) as T } catch { return null } }
/** day → sets done and sessions of 40 minutes or more. A deleted workout is gone; one sent twice counts once. */
export function gymDays(events: LedgerEvent[]): Record<string, { sets: number; long: number }> {
  const gone = new Set(events.filter((e) => e.type === 'workout_delete').map((e) => String(e.payload?.id)))
  const seen = new Map<string, { day: string; w: Workout }>()
  for (const ev of events) {
    if (ev.type !== 'workout') continue
    const w = parse<Workout>(ev.payload?.gear)
    if (!w?.id || !Array.isArray(w.exercises) || gone.has(w.id)) continue
    seen.set(w.id, { day: ev.day, w })
  }
  const out: Record<string, { sets: number; long: number }> = {}
  for (const { day, w } of seen.values()) {
    const d = (out[day] ??= { sets: 0, long: 0 })
    d.sets += w.exercises.reduce((n, e) => n + (Array.isArray(e.sets) ? e.sets.length : 0), 0)
    const mins = w.startedAt ? (Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60000 : 0
    if (mins >= 40) d.long++
  }
  return out
}

const daysOf = (from: string, to: string): string[] => { const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out }
const nice = (id: string): string => id.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
const shedName = (id: string): string => ITEMS.find((i) => i.id === id)?.name ?? nice(id)
const list = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
/** Seeded pick of `n` from a list, in a stable order. */
function pick<T>(xs: T[], n: number, r: () => number): T[] {
  const pool = [...xs], out: T[] = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return out
}

// ── the card ────────────────────────────────────────────────────────────────
/** The last form of a line (a branch is chosen by the seed), and a Mega of it when one is asked for. */
function lastForm(base: string, r: () => number, mega: boolean): { form: string; mega: boolean } {
  let form = base
  for (let guard = 0; guard < 6 && SPECIES[form]?.e?.length; guard++) {
    const next = SPECIES[form].e!
    form = next[Math.floor(r() * next.length)]
  }
  const megas = mega ? (SPECIES[form]?.m ?? []) : []
  return megas.length ? { form: megas[Math.floor(r() * megas.length)], mega: true } : { form, mega: false }
}

/**
 * This week's card, or null when no boss should come: the party is not full, or
 * the week is already too far gone. `force` skips both (the dev preview).
 */
export function planCard(week: string, today: string, game: Game, input: FactsInput, events: LedgerEvent[], bossesSoFar: number, force = false): BossCard | null {
  if (!force && (game.bossParty < bossNeed(today) || today > addDays(week, PLAN_BY))) return null
  const r = rng(`boss:${week}`)
  // who it is: a rare line from an open region, and every eighth one a legendary
  const legendary = (bossesSoFar + 1) % LEGENDARY_EVERY_BOSS === 0
  const open = (rar: string) => Object.entries(SPECIES).filter(([, s]) => s.s === 1 && !s.f && s.r === rar && (s.g ?? 9) <= game.regions).map(([id]) => id).sort()
  let rarity: 'R' | 'L' = legendary ? 'L' : 'R'
  let pool = open(rarity)
  if (!pool.length) { rarity = 'R'; pool = open('R') }
  if (!pool.length) pool = Object.entries(SPECIES).filter(([, s]) => s.s === 1 && !s.f && s.r === 'R').map(([id]) => id).sort()
  if (!pool.length) return null
  const species = pool[Math.floor(r() * pool.length)]
  const shown = lastForm(species, r, rarity === 'L')
  const level = bossLevel([game.partner, ...game.team].reduce((sum, m) => sum + levelOf(m.xp), 0))

  const back = daysOf(addDays(week, -LOOK_BACK), addDays(week, -1))
  const tasks: Omit<BossTask, 'share'>[] = []

  // gym: sized to the sets you have been logging
  const gym = gymDays(events)
  const sets = back.reduce((n, d) => n + (gym[d]?.sets ?? 0), 0)
  const gymRoll = r()
  if (sets > 0 && gymRoll < 0.45) {
    const target = Math.max(24, Math.round((sets / 3) * 1.25))
    tasks.push({ kind: 'gym', template: 'volume', target, text: `Log ${target} sets in Strong this week` })
  } else if (sets > 0 && gymRoll < 0.75) {
    tasks.push({ kind: 'gym', template: 'record', target: 2, text: 'Beat two of your lifts, and log 16 sets' })
  } else {
    const target = sets > 0 ? 4 : 3
    tasks.push({ kind: 'gym', template: 'sessions', target, text: `${target} workouts of 40 minutes or more` })
  }

  // Arbor: three of the skills you have been practising
  const counts = new Map<string, number>()
  for (const d of back) for (const [id, p] of Object.entries(input.arbor?.practice[d] ?? {})) if (p.done) counts.set(id, (counts.get(id) ?? 0) + 1)
  const skills = pick([...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 6).map(([id]) => id), 3, r)
  if (skills.length) {
    if (r() < 0.6) tasks.push({ kind: 'arbor', template: 'spread', target: 4, items: skills, text: `Practise ${list(skills.map(nice))} on four days each` })
    else tasks.push({ kind: 'arbor', template: 'deep', target: 3, items: skills, text: `Three days with ${list(skills.map(nice))} all practised` })
  }

  // Woodshed: two pieces you have been on, the shakiest first
  const logs = input.shed?.logs ?? {}
  const played = Object.keys(logs)
    .map((id) => { const ds = back.filter((d) => (logs[id][d] as { done: boolean } | undefined)?.done); const last = ds[ds.length - 1]; return { id, n: ds.length, feel: last ? ((logs[id][last] as { feel?: number }).feel ?? 0) : 0 } })
    .filter((x) => x.n > 0)
    .sort((a, b) => a.feel - b.feel || b.n - a.n || (a.id < b.id ? -1 : 1))
  const pieces = pick(played.slice(0, 4).map((x) => x.id), 2, r)
  if (pieces.length) tasks.push({ kind: 'shed', template: 'clean', target: 3, items: pieces, text: `Log ${list(pieces.map(shedName))} Clean on three days each` })

  // sleep: the band's score if it is in use, the bedtime tick if not
  const band = back.some((d) => typeof input.body?.[d]?.sleepScore === 'number')
  if (band) tasks.push({ kind: 'sleep', template: 'score', target: 4, text: `Four nights at ${SLEEP_DONE} or more` })
  else tasks.push({ kind: 'sleep', template: 'bed', target: 5, text: 'Five nights in bed on time' })

  // life: steady days
  if (r() < 0.6) tasks.push({ kind: 'life', template: 'steady', target: 4, text: 'Four days with three-quarters of your habits ticked' })
  else tasks.push({ kind: 'life', template: 'perfect', target: 1, text: 'One perfect day, and two more at three-quarters' })

  // a kind with nothing to draw from is left out, and what it stood for goes to the Life task
  const have = new Set(tasks.map((t) => t.kind))
  const spare = BOSS_KINDS.filter((k) => !have.has(k)).reduce((n, k) => n + BOSS_SHARE[k], 0)
  return {
    week, species, form: shown.form, rarity, mega: shown.mega, level,
    tasks: tasks.map((t) => ({ ...t, share: Math.round((BOSS_SHARE[t.kind] + (t.kind === 'life' ? spare : 0)) * 1000) / 1000 })),
  }
}

// ── the week so far ─────────────────────────────────────────────────────────
const clamp = (x: number): number => Math.max(0, Math.min(1, x))
const round3 = (x: number): number => Math.round(clamp(x) * 1000) / 1000

/** Each task's progress from the card's Monday to `day`, 0 to 1, in the card's order. */
export function measure(card: BossCard, input: FactsInput, events: LedgerEvent[], day: string): number[] {
  const days = daysOf(card.week, day < card.week ? card.week : day > addDays(card.week, 6) ? addDays(card.week, 6) : day)
  const gym = gymDays(events)
  const share = (d: string): { ticked: number; perfect: boolean } => {
    const hs = factsFor(input, d).habits.filter((h) => !h.measured)
    const done = hs.filter((h) => h.done).length
    return { ticked: hs.length ? done / hs.length : 0, perfect: hs.length > 0 && done === hs.length }
  }
  const by: Record<BossKind, (t: BossTask) => number> = {
    gym: (t) => {
      const sets = days.reduce((n, d) => n + (gym[d]?.sets ?? 0), 0)
      if (t.template === 'volume') return sets / t.target
      if (t.template === 'sessions') return days.reduce((n, d) => n + (gym[d]?.long ?? 0), 0) / t.target
      const records = days.reduce((n, d) => n + (input.marks?.[d]?.records ?? 0), 0)
      return 0.5 * clamp(records / t.target) + 0.5 * clamp(sets / 16)
    },
    arbor: (t) => {
      const ids = t.items ?? []
      if (!ids.length) return 0
      const did = (d: string, id: string) => Boolean(input.arbor?.practice[d]?.[id]?.done)
      if (t.template === 'deep') return days.filter((d) => ids.every((id) => did(d, id))).length / t.target
      return ids.reduce((n, id) => n + Math.min(t.target, days.filter((d) => did(d, id)).length), 0) / (t.target * ids.length)
    },
    shed: (t) => {
      const ids = t.items ?? []
      if (!ids.length) return 0
      const clean = (id: string) => days.filter((d) => { const l = input.shed?.logs[id]?.[d] as { done: boolean; feel?: number } | undefined; return l?.done && l.feel === 2 }).length
      return ids.reduce((n, id) => n + Math.min(t.target, clean(id)), 0) / (t.target * ids.length)
    },
    sleep: (t) => (t.template === 'score'
      ? days.filter((d) => (input.body?.[d]?.sleepScore ?? 0) >= SLEEP_DONE).length
      : days.filter((d) => Boolean(input.ticks[d]?.[SLEEP_HABIT])).length) / t.target,
    life: (t) => {
      const s = days.map(share)
      const steady = s.filter((x) => x.ticked >= 0.75).length
      if (t.template === 'steady') return steady / t.target
      return 0.5 * (s.some((x) => x.perfect) ? 1 : 0) + 0.5 * clamp((steady - (s.some((x) => x.perfect) ? 1 : 0)) / 2)
    },
  }
  return card.tasks.map((t) => round3(by[t.kind](t)))
}
