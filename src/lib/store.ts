// The Pokedex reads the shared ledger and recomputes the game from it.
// Everything you see is earned in Life OS; the one thing written here is an
// item being used from the Bag.
import { useSyncExternalStore } from 'react'
import { BOSS_CARD_REV, BOSS_CARD_REV_V21, BOSS_DAY_EVENT, CARD_EVENT, bossDayChanged } from '../../core/boss.ts'
import { addDays, buildFacts, mondayOf, type DayFacts, type FactsInput } from '../../core/facts.ts'
import { USE_EVENT, sleepOf, type SleepNight } from '../../core/events.ts'
import { settled } from '../../core/order.ts'
import { foldGame, type Game } from '../../core/fold.ts'
import { V18_START, V21_START } from '../../core/rules.ts'
import type { LedgerEvent } from '../linked/arbor-model.ts'
import { DAY_START_EVENT, dayStartsAt, localDate, wakingDay } from '../../core/day.ts'
import { createLedger, type LedgerStatus } from './ledger.ts'
import { measure, planCard } from './boss.ts'
import { FIXTURE } from './fixture-boot.ts'
import { TYPES, ingest } from './ingest.ts'
import { keyOf } from './eventkey.ts'
import { note } from './toast.ts'

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
const seen = new Set<string>()
/**
 * The habit library, kept on this device so a reload has it at once. It is read apart from the ledger (pullConfig), and a game
 * folded without it is a different game: on 5 Nov 2026 it moved two badges a day and beat Erika, and that game was told as news.
 */
const CONFIG_KEY = 'pokedex.config.v1'
const keptConfig = (): LedgerEvent | undefined => {
  try { const v = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null'); return v && typeof v.at === 'string' && v.payload ? v as LedgerEvent : undefined } catch { return undefined }
}
let config: LedgerEvent | undefined = FIXTURE ? FIXTURE.config : OFF ? undefined : keptConfig()
/** The server has answered for the habit library at least once this visit (or failed to: offline, the kept copy stands). */
let configAsked = OFF || !URL_ || !KEY
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
  // until the habit library has been asked for, the game is still loading: nothing is drawn, told or auto-filled from a game without it
  return { nights: sleepOf(settled(events)), body, game: foldGame(facts), facts, status: status === 'live' && !configAsked ? 'connecting' : status, today }
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
  if (FIXTURE || bossBusy || status === 'connecting' || status === 'error' || !configAsked || !input) return
  const today = view.today, week = mondayOf(today)
  const wrote: LedgerEvent[] = []
  const mem = (bossMemory ??= bossWrote())
  const hourAgo = Date.now() - 3_600_000
  mem.at = mem.at.filter((t) => t > hourAgo)
  // what was written for other weeks is forgotten, so this does not grow
  for (const k of Object.keys(mem.sent)) if (k.slice(k.indexOf(':') + 1, k.indexOf(':') + 11) < week) delete mem.sent[k]
  const may = (key: string, payload: string): boolean => mem.sent[key] !== payload && mem.at.length + wrote.length < BOSS_WRITES_PER_HOUR
  let card = input.boss?.cards[week]
  // the week version 18 began had its card drawn by the old planner, which had one rare line to pick from and so brought the same boss again:
  // drawn once more by the new one, whatever is done on it (the work is measured from the raw events, so it carries over to the new card)
  // and version 21's weeks are drawn by its planner (core/boss.ts tasksV21): a card an older app drew for one of them (opened before the deploy) is drawn again
  const stale = Boolean(card) && ((week === V18_START && (card?.rev ?? 1) < BOSS_CARD_REV) || (week >= V21_START && (card?.rev ?? 1) < BOSS_CARD_REV_V21))
  if (!card || stale) {
    const before = Object.keys(input.boss?.cards ?? {}).filter((w) => w < week).length
    const drawn = planCard(week, today, view.game, input, events, before, FORCE_BOSS)
    if (drawn) {
      card = drawn
      const body = JSON.stringify(drawn)
      if (may(`card:${week}`, body)) { mem.sent[`card:${week}`] = body; wrote.push(ledger.emit(CARD_EVENT, { card: body }, week)) }
    } else if (!card) return
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
      try { localStorage.setItem(CONFIG_KEY, JSON.stringify(row)) } catch { /* no storage: it is read again next visit */ }
      configAsked = true
      refresh()
    }
  } catch {
    /* offline: keep what we have */
  } finally {
    if (!configAsked) { configAsked = true; refresh() }
  }
}

const ledger = createLedger({
  url: URL_,
  key: KEY,
  app: 'pokedex',
  types: TYPES,
  // the game is a fold over the whole history: keep it on the device and read only what is new
  cache: true,
  // new rows (the band's night, a tick in Life OS) arrive by push; the poll is only a safety net while the socket is up
  realtime: true,
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
/**
 * Asked first: would the game be any different? The rules ignore whatever does not apply (core/fold.ts `spend`), and until 10 Nov 2026
 * the screen was never told: a Rare Candy tapped seven times on a Pokemon that could not take one made the sound and did nothing.
 * So the action is folded here before it is written. One that would change nothing is not written at all, and the reason is said.
 * Returns whether it was done.
 */
export function useItem(item: string, uid: string, what: string, to?: string): boolean {
  const payload = { ...(item ? { item } : {}), uid, what, ...(to ? { to } : {}), n: Math.random().toString(36).slice(2, 10) }
  const trial: LedgerEvent = { device: 'trial', at: new Date().toISOString(), day: view.today, type: USE_EVENT, payload }
  const would = foldGame(buildFacts(ingest([...events, trial], config, view.today)))
  if (digest(would) === digest(view.game)) {
    // arranging the same way again is not worth a word; anything else is
    if (!QUIET.has(what)) note(REFUSED[what] ?? 'Nothing happened: that cannot be done right now.', true)
    return false
  }
  const ev = ledger.emit(USE_EVENT, payload, view.today)
  seen.add(keyOf(ev))
  events.push(ev)
  refresh()
  return true
}
/** What an action can change, as one string: every day but the last is history, which no action today rewrites. */
const digest = (g: Game): string => JSON.stringify({ ...g, days: g.days.length })
/** Actions that only arrange or choose: one that leaves things as they are is dropped without a word. */
const QUIET = new Set(['team', 'study', 'aim', 'theme', 'show', 'next', 'move', 'hold'])
/** Why the rules ignored it, in the player's words. */
const REFUSED: Record<string, string> = {
  candy: 'That Pokemon cannot take a Rare Candy: it has no level left to gain.',
  feed: 'Nothing happened: it has all the hearts it can hold, or the berry is gone.',
  throw: 'Nothing to throw at: there is no wild Pokemon in front of you, or the ball is gone.',
  buy: 'Not bought: you cannot afford it, it is sold out today, or it is yours already.',
  vitamin: 'That Pokemon has had all it can take of that vitamin.',
  evolve: 'That item does not evolve this Pokemon.',
  fossil: 'Not revived: the fossil is gone, or the Lab asks for more coins than you have.',
  forge: 'Not forged: it takes the Key Stone and three shards of three different colours.',
  train: 'Not trained: not enough marks, or that mastery is full.',
  lead: 'That Pokemon cannot lead right now.',
  claim: 'That reward has been collected already.',
  wish: 'Another Pokemon is already on its way: the incense is kept.',
  honey: 'Another Pokemon is already on its way: the Honey is kept.',
  summon: 'Another Pokemon is already on its way: the key is kept.',
  repel: 'A Max Repel is already on this Pokemon, or there is none in front of you.',
  revive: 'The leader has won nothing back: the Revive is kept.',
  guard: 'A Guard Spec is already standing guard.',
  boost: 'That boost is already on today.',
  warm: 'The Nursery already has an egg.',
  sell: 'Nothing to sell.',
}

export const useView = (): View =>
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => view)

/** Sprites are served by this site, next to the app. */
export { spritePath } from '../../core/fold.ts'
