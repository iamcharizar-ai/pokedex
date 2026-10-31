// The Pokedex reads the shared ledger and recomputes the game from it.
// Everything you see is earned in Life OS; the one thing written here is an
// item being used from the Bag.
import { useSyncExternalStore } from 'react'
import { BOSS_DAY_EVENT, CARD_EVENT, bossDayChanged } from '../../core/boss.ts'
import { addDays, buildFacts, mondayOf, type DayFacts, type FactsInput } from '../../core/facts.ts'
import { USE_EVENT, sleepOf, type SleepNight } from '../../core/events.ts'
import { settled } from '../../core/order.ts'
import { foldGame, type Game } from '../../core/fold.ts'
import type { LedgerEvent } from '../linked/arbor-model.ts'
import { DAY_START_EVENT, dayStartsAt, localDate, wakingDay } from '../../core/day.ts'
import { createLedger, type LedgerStatus } from './ledger.ts'
import { measure, planCard } from './boss.ts'
import { FIXTURE } from './fixture-boot.ts'
import { TYPES, ingest } from './ingest.ts'

const env = import.meta.env
// a fixture is a canned ledger: the real one is never read or written while it is loaded
const OFF = env.VITE_SUPABASE_DISABLE === '1' || FIXTURE !== null
const URL_ = OFF ? '' : ((env.VITE_SUPABASE_URL as string | undefined) ?? '')
const KEY = OFF ? '' : ((env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '')

/** The newest day Vitals has readings for. Absent until Vitals writes something: nothing here depends on it. */
export interface BodyDay {
  day: string
  sleepMin?: number
  steps?: number
  weightKg?: number
}
/** Where the habits are ticked. */
export const LIFEOS_URL: string = (env.VITE_LIFEOS_URL as string | undefined) ?? 'https://redesign-life-os-ui.vercel.app'

export interface View {
  /** day → the night that ended on it, as the band reported it */
  nights: Record<string, SleepNight>
  body: BodyDay | null
  game: Game
  facts: DayFacts[]
  status: LedgerStatus
  today: string
}

const events: LedgerEvent[] = FIXTURE ? [...FIXTURE.events] : []
/** what the last compute read from the ledger: the boss is planned and measured from it (declared before the first compute below) */
let input: FactsInput | null = null
const keyOf = (e: LedgerEvent): string => `${e.device}|${e.at}|${e.type}|${JSON.stringify(e.payload)}`
const seen = new Set<string>()
let config: LedgerEvent | undefined = FIXTURE?.config
/**
 * A fixture carries its own date; the real game uses the waking day (core/day.ts): after midnight it stays yesterday until the band
 * reads the night (a sleep score filed under the date), the day is started in Life OS, or the day's start time (two hours before you
 * usually wake). Life OS reads it the same way.
 */
const begun = (date: string): boolean => events.some((e) => e.day === date && (e.type === DAY_START_EVENT || (e.type === 'vitals' && typeof e.payload?.sleepScore === 'number')))
const todayISO = (): string => {
  if (FIXTURE) return FIXTURE.today
  const now = new Date()
  return wakingDay(now, begun, dayStartsAt(sleepOf(settled(events.filter((e) => e.type === 'vitals'))), localDate(now)))
}
let status: LedgerStatus = URL_ && KEY ? 'connecting' : 'off'
let view: View = compute()
const listeners = new Set<() => void>()

function compute(): View {
  const today = todayISO()
  input = ingest(events, config, today)
  const facts = buildFacts(input)
  const vit = events.filter((e) => e.type === 'vitals').sort((a, b) => (a.at < b.at ? -1 : 1))
  const last = vit.map((e) => e.day).sort().pop()
  let body: BodyDay | null = null
  if (last) {
    body = { day: last }
    for (const e of vit) if (e.day === last) for (const k of ['sleepMin', 'steps', 'weightKg'] as const) if (typeof e.payload[k] === 'number') body[k] = e.payload[k] as number
  }
  return { nights: sleepOf(settled(events)), body, game: foldGame(facts), facts, status, today }
}
function refresh(): void {
  view = compute()
  syncBoss()
  listeners.forEach((l) => l())
}

/** In the dev preview, `?boss` brings a boss whatever the party is, so the screens can be seen. */
const FORCE_BOSS = env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('boss')
let bossBusy = false
/**
 * What this device has already written for the boss, and when. The ledger's rule is "the last one written for a day stands", and what
 * is last is decided by the order of the rows, not by who wrote it: two devices that measured a day differently each saw the other's
 * number standing, wrote its own, and never won, round and round (about nine thousand rows in two hours, 27 Oct 2026). So a device
 * never writes the same thing twice, and never more than BOSS_WRITES_PER_HOUR rows an hour, whatever the ledger says.
 */
const BOSS_WROTE_KEY = 'pokedex.bosswrote.v1', BOSS_WRITES_PER_HOUR = 12
function bossWrote(): { sent: Record<string, string>; at: number[] } {
  try { const v = JSON.parse(localStorage.getItem(BOSS_WROTE_KEY) ?? '{}'); return { sent: v.sent ?? {}, at: Array.isArray(v.at) ? v.at : [] } } catch { return { sent: {}, at: [] } }
}
function bossRemember(w: { sent: Record<string, string>; at: number[] }): void {
  try { localStorage.setItem(BOSS_WROTE_KEY, JSON.stringify(w)) } catch { /* private mode: the in-page copy still holds for this visit */ }
}
let bossMemory: { sent: Record<string, string>; at: number[] } | null = null
/**
 * The boss lives in the ledger: this week's card is written once (by whoever
 * opens the Pokedex first: the draw is seeded, so two devices write the same
 * one and the earlier stands), and each day's progress whenever it has changed.
 * Nothing is written until the ledger has been read, or a card could be drawn
 * for a week that already has one.
 */
function syncBoss(): void {
  // a fixture is frozen: its card and its days are part of it
  if (FIXTURE || bossBusy || status === 'connecting' || status === 'error' || !input) return
  const today = view.today, week = mondayOf(today)
  const wrote: LedgerEvent[] = []
  const mem = (bossMemory ??= bossWrote())
  const hourAgo = Date.now() - 3_600_000
  mem.at = mem.at.filter((t) => t > hourAgo)
  // what was written for other weeks is forgotten, so this does not grow
  for (const k of Object.keys(mem.sent)) if (k.slice(k.indexOf(':') + 1, k.indexOf(':') + 11) < week) delete mem.sent[k]
  const may = (key: string, payload: string): boolean => mem.sent[key] !== payload && mem.at.length + wrote.length < BOSS_WRITES_PER_HOUR
  let card = input.boss?.cards[week]
  if (!card) {
    const drawn = planCard(week, today, view.game, input, events, Object.keys(input.boss?.cards ?? {}).length, FORCE_BOSS)
    if (!drawn) return
    card = drawn
    const body = JSON.stringify(drawn)
    if (may(`card:${week}`, body)) { mem.sent[`card:${week}`] = body; wrote.push(ledger.emit(CARD_EVENT, { card: body }, week)) }
  }
  for (let d = week; d <= today; d = addDays(d, 1)) {
    const p = measure(card, input, events, d)
    const body = JSON.stringify(p)
    if (bossDayChanged(input.boss?.days[d], p) && may(`day:${d}`, body)) { mem.sent[`day:${d}`] = body; wrote.push(ledger.emit(BOSS_DAY_EVENT, { p: body }, d)) }
  }
  if (wrote.length) { mem.at.push(...wrote.map(() => Date.now())); bossRemember(mem) }
  if (!wrote.length) return
  bossBusy = true
  for (const ev of wrote) { seen.add(keyOf(ev)); events.push(ev) }
  view = compute()
  bossBusy = false
}

/** Only the newest habit library matters, and each one is a full copy: fetch just that row. */
async function pullConfig(): Promise<void> {
  if (!URL_ || !KEY) return
  try {
    // only a row newer than the one held: an unchanged library answers with an empty list, not the ~10 KB copy again
    const q = new URLSearchParams({ select: 'device,at,day,type,payload', type: 'eq.config', order: 'at.desc', limit: '1' })
    if (config?.at) q.set('at', `gt.${config.at}`)
    const res = await fetch(`${URL_.replace(/\/$/, '')}/rest/v1/events?${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
    if (!res.ok) return
    const [row] = (await res.json()) as LedgerEvent[]
    if (row && row.at !== config?.at) {
      config = row
      refresh()
    }
  } catch {
    /* offline: keep what we have */
  }
}

const ledger = createLedger({
  url: URL_,
  key: KEY,
  app: 'pokedex',
  types: TYPES,
  // the game is a fold over the whole history: keep it on the device and read only what is new
  cache: true,
  onEvents: (fresh) => {
    // something done here is added at once, then comes back from the ledger: take it once
    for (const e of fresh) if (!seen.has(keyOf(e))) { seen.add(keyOf(e)); events.push(e) }
    refresh()
    void pullConfig()
  },
  onStatus: (s) => {
    status = s
    refresh()
  },
})

let started = false
export function start(): void {
  if (started) return
  started = true
  void pullConfig()
  ledger.start()
  // with no ledger to wait for, the boss is planned and measured straight away
  refresh()
  // the day rolls over while the tab is open
  setInterval(() => {
    if (document.hidden) return // nobody is looking: the next visible minute catches up
    if (todayISO() !== view.today) refresh()
    else void pullConfig()
  }, 60_000)
}

/** Something chosen by hand: who is next, a branch, who leads, which form shows. None of it costs anything from version 4; `item` is only sent for a stone spent under version 3. */
export function useItem(item: string, uid: string, what: string, to?: string): void {
  const ev = ledger.emit(USE_EVENT, { ...(item ? { item } : {}), uid, what, ...(to ? { to } : {}), n: Math.random().toString(36).slice(2, 10) }, view.today)
  seen.add(keyOf(ev))
  events.push(ev)
  refresh()
}

export const useView = (): View =>
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => view)

/** Sprites are served by this site, next to the app. */
export { spritePath } from '../../core/fold.ts'
