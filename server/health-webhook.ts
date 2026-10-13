// POST /api/health-webhook: where Google Health tells us something changed.
// It answers at once and then reads the days that changed from the Google
// Health API and writes what is new to the shared ledger, exactly as
// `npm run health` does from the PC (bridge/plan.ts decides what to write).
//
// Settings (Vercel project -> Environment Variables; names only, never commit values):
//   WEBHOOK_SECRET        the secret Google sends in `Authorization`; also given to `ghealth webhooks subscribers create`
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//                         the Desktop OAuth client and the owner's sign-in (read-only health scopes)
//   SUPABASE_URL, SUPABASE_ANON_KEY   the ledger
//   HEALTH_TZ             the owner's time zone, default Asia/Kolkata
import { waitUntil } from '@vercel/functions'
import { DEVICE, LOOK_BACK, planWrites } from '../bridge/plan.ts'
import { readHealth, addDays } from '../bridge/health.ts'
import { receive } from '../bridge/receiver.ts'
import type { Keyset } from '../bridge/webhook.ts'
import type { LedgerEvent } from '../bridge/model.ts'

const E = process.env
const cfg = {
  secret: E.WEBHOOK_SECRET ?? '',
  clientId: E.GOOGLE_CLIENT_ID ?? '',
  clientSecret: E.GOOGLE_CLIENT_SECRET ?? '',
  refresh: E.GOOGLE_REFRESH_TOKEN ?? '',
  supabaseUrl: (E.SUPABASE_URL ?? E.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabaseKey: E.SUPABASE_ANON_KEY ?? E.VITE_SUPABASE_ANON_KEY ?? '',
  tz: E.HEALTH_TZ ?? 'Asia/Kolkata',
}
const KEYSET_URL = 'https://www.gstatic.com/googlehealthapi/webhooks/webhooks_public_keyset.json'

const today = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: cfg.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).slice(0, 10)

// Google rotates its signing keys every 30 days: keep them for an hour, and refetch once if a key is not in the copy we hold
let keys: { at: number; set: Keyset } | null = null
async function keyset(): Promise<Keyset | null> {
  if (keys && Date.now() - keys.at < 3_600_000) return keys.set
  try {
    const res = await fetch(KEYSET_URL, { signal: AbortSignal.timeout(5000) })
    if (res.ok) keys = { at: Date.now(), set: (await res.json()) as Keyset }
  } catch {
    /* fall through to whatever we already hold */
  }
  return keys?.set ?? null
}

let access: { token: string; until: number } | null = null
async function accessToken(): Promise<string> {
  if (access && Date.now() < access.until) return access.token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refresh, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(10_000),
  })
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string }
  if (!j.access_token) throw new Error(`Google refused the sign-in (${j.error ?? res.status}); run ghealth auth login and update GOOGLE_REFRESH_TOKEN`)
  access = { token: j.access_token, until: Date.now() + ((j.expires_in ?? 3600) - 120) * 1000 }
  return access.token
}

const sb = (path: string, init: RequestInit = {}): Promise<Response> =>
  fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: cfg.supabaseKey, Authorization: `Bearer ${cfg.supabaseKey}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(15_000),
  })

async function sync(win: { from: string; to: string }): Promise<string> {
  const token = await accessToken()
  const read = await readHealth(token, win.from, win.to, (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }))
  const since = addDays(win.from, -LOOK_BACK)
  const known: LedgerEvent[] = []
  for (let offset = 0; ; offset += 1000) {
    const res = await sb(`events?select=device,at,day,type,payload&type=eq.vitals&day=gte.${since}&order=at.asc&offset=${offset}&limit=1000`)
    if (!res.ok) throw new Error(`ledger read ${res.status}`)
    const page = (await res.json()) as LedgerEvent[]
    known.push(...page)
    if (page.length < 1000) break
  }
  const events = planWrites(read.data, known, new Date().toISOString())
  if (events.length) {
    const res = await sb('events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(events) })
    if (!res.ok) throw new Error(`ledger write ${res.status}`)
  }
  const failed = Object.keys(read.failed)
  console.log(`sync ${win.from}..${win.to}: wrote ${events.length} day(s) as ${DEVICE}${failed.length ? `; could not read ${failed.join(', ')}` : ''}`)
  return `${events.length}`
}

const handle = (req: Request): Promise<Response> =>
  receive(req, { secret: cfg.secret, keyset, sync, after: waitUntil, today, log: (l) => console.log(l) })

export const POST = handle
export const GET = handle
