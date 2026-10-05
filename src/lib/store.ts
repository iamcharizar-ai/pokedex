// The Pokedex reads the shared ledger and recomputes the game from it.
// Everything you see is earned in Life OS; the one thing written here is an
// item being used from the Bag.
import { useSyncExternalStore } from 'react'
import { buildFacts, type DayFacts } from '../../core/facts.ts'
import { USE_EVENT } from '../../core/events.ts'
import { foldGame, type Game } from '../../core/fold.ts'
import { dayISO, type LedgerEvent } from '../linked/arbor-model.ts'
import { createLedger, type LedgerStatus } from './ledger.ts'
import { TYPES, ingest } from './ingest.ts'

const env = import.meta.env
const OFF = env.VITE_SUPABASE_DISABLE === '1'
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
export const VITALS_URL: string = (env.VITE_VITALS_URL as string | undefined) ?? 'https://vitals-theta-pied.vercel.app'

export interface View {
  body: BodyDay | null
  game: Game
  facts: DayFacts[]
  status: LedgerStatus
  today: string
}

const events: LedgerEvent[] = []
let config: LedgerEvent | undefined
let status: LedgerStatus = URL_ && KEY ? 'connecting' : 'off'
let view: View = compute()
const listeners = new Set<() => void>()

function compute(): View {
  const today = dayISO()
  const facts = buildFacts(ingest(events, config, today))
  const vit = events.filter((e) => e.type === 'vitals').sort((a, b) => (a.at < b.at ? -1 : 1))
  const last = vit.map((e) => e.day).sort().pop()
  let body: BodyDay | null = null
  if (last) {
    body = { day: last }
    for (const e of vit) if (e.day === last) for (const k of ['sleepMin', 'steps', 'weightKg'] as const) if (typeof e.payload[k] === 'number') body[k] = e.payload[k] as number
  }
  return { body, game: foldGame(facts), facts, status, today }
}
function refresh(): void {
  view = compute()
  listeners.forEach((l) => l())
}

/** Only the newest habit library matters, and each one is a full copy: fetch just that row. */
async function pullConfig(): Promise<void> {
  if (!URL_ || !KEY) return
  try {
    const q = new URLSearchParams({ select: 'device,at,day,type,payload', type: 'eq.config', order: 'at.desc', limit: '1' })
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
  onEvents: (fresh) => {
    events.push(...fresh)
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
  // the day rolls over while the tab is open
  setInterval(() => {
    if (dayISO() !== view.today) refresh()
    else void pullConfig()
  }, 60_000)
}

/** Spend a stone from the Bag on one Pokemon. Final, like the games: there is no taking it back. */
export function useItem(item: string, uid: string, what: string, to?: string): void {
  events.push(ledger.emit(USE_EVENT, { item, uid, what, ...(to ? { to } : {}) }))
  refresh()
}

export const useView = (): View =>
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => view)

/** Sprites are served by this site, next to the app. */
export { spritePath } from '../../core/fold.ts'
