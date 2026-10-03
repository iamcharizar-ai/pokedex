// Replays an exported copy of the ledger through the game and prints each day.
//   node tools/replay.mjs <folder with ev-*.json pages and config.json>
import fs from 'node:fs'
import path from 'node:path'
import { buildFacts } from '../core/facts.ts'
import { foldGame, nameOf } from '../core/fold.ts'
import { ingest } from '../src/lib/ingest.ts'

const dir = process.argv[2]
const events = fs.readdirSync(dir).filter((f) => /^ev-\d+\.json$/.test(f)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'))[0]
const d = new Date(), p = (n) => String(n).padStart(2, '0')
const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
const facts = buildFacts(ingest(events, config, today))
const g = foldGame(facts)
for (const day of g.days) console.log(day.day, `xp ${day.xp}`, `x${day.mult}`, `pillars ${day.pillars}/${day.pillarTotal}`, `habits ${day.done}/${day.total}`, day.perfect ? 'PERFECT' : '')
console.log(`partner ${nameOf(g.partner.form)} Lv ${g.level} · queue ${g.queue.length} · graduates ${g.graduates.length}`)
console.log('pillar habits in config:', facts.at(-1).habits.filter((h) => h.pillar).map((h) => h.id).join(', ') || 'none yet (Life OS lifts them on first open)')
