// Saves a copy of the ledger for tools/replay.mjs. It only reads.
//
//   node tools/export-ledger.mjs [folder]        (default: tools/.cache/ledger)
//
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, from the environment or
// from .env.local / .env here. The folder holds your real days (and, once the
// band is in use, body readings): it sits under tools/.cache, which git ignores.
import fs from 'node:fs'
import path from 'node:path'
import { TYPES } from '../src/lib/ingest.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const env = { ...process.env }
for (const f of ['.env', '.env.local']) {
  const file = path.join(ROOT, f)
  if (!fs.existsSync(file)) continue
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const url = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''), key = env.VITE_SUPABASE_ANON_KEY ?? ''
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (in .env.local, or in the environment).')
  process.exit(1)
}
const dir = path.resolve(process.argv[2] ?? path.join(ROOT, 'tools/.cache/ledger'))
fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(dir, { recursive: true })

const get = async (q) => {
  const res = await fetch(`${url}/rest/v1/events?${new URLSearchParams(q)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}
const PAGE = 1000
let n = 0, total = 0
for (;;) {
  const rows = await get({ select: 'device,at,day,type,payload,inserted_at', type: `in.(${TYPES.join(',')})`, order: 'inserted_at.asc,at.asc', limit: PAGE, offset: n * PAGE })
  if (!rows.length) break
  fs.writeFileSync(path.join(dir, `ev-${n}.json`), JSON.stringify(rows))
  total += rows.length
  n++
  if (rows.length < PAGE) break
}
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(await get({ select: 'device,at,day,type,payload', type: 'eq.config', order: 'at.desc', limit: 1 })))
console.log(`${total} events in ${n} page${n === 1 ? '' : 's'}, and the habit library, saved to ${dir}`)
console.log(`now:  node tools/replay.mjs "${dir}"`)
