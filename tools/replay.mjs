// Replays an exported copy of the ledger through the game: each day, then the
// numbers a retune should be decided on. Nothing here is invented behaviour:
// it is your real days, so it is what tools/simulate.mjs cannot be.
//
//   node tools/export-ledger.mjs            (saves tools/.cache/ledger)
//   node tools/replay.mjs [folder] [--days]
//
// The folder holds ev-*.json pages and config.json. --days prints every day.
import fs from 'node:fs'
import path from 'node:path'
import { buildFacts } from '../core/facts.ts'
import { foldGame, leaderOf, nameOf } from '../core/fold.ts'
import { rulesOn } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { ingest } from '../src/lib/ingest.ts'

const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('--')) ?? path.resolve(import.meta.dirname, '.cache/ledger')
const events = fs.readdirSync(dir).filter((f) => /^ev-\d+\.json$/.test(f)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'))[0]
const d = new Date(), p = (n) => String(n).padStart(2, '0')
const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
const facts = buildFacts(ingest(events, config, today))
const g = foldGame(facts)

if (args.includes('--days'))
  for (const day of g.days) console.log(day.day, `v${rulesOn(day.day)}`, `xp ${day.xp}`, `x${day.mult}`, `pillars ${day.pillars}/${day.pillarTotal}`, `habits ${day.done}/${day.total}`, `share ${(day.share * 100).toFixed(0)}%`, `${day.ball}`, `hit ${day.hit}`, `strike ${day.strike}`, day.perfect ? 'PERFECT' : '')

// ── the report ──
const days = g.days, n = days.length
const active = days.filter((x) => x.pillars > 0)
const sorted = (xs) => [...xs].sort((a, b) => a - b)
const q = (xs, f) => (xs.length ? sorted(xs)[Math.min(xs.length - 1, Math.floor(xs.length * f))] : '-')
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : '-')
const of = (k) => g.moments.filter((m) => m.kind === k)
const idx = (day) => days.findIndex((x) => x.day === day)
/** days with at least one pillar from one day to another, both counted */
const activeBetween = (a, b) => days.slice(idx(a), idx(b) + 1).filter((x) => x.pillars > 0).length

console.log(`\n${n} days (${days[0]?.day} to ${days[n - 1]?.day}) · ${active.length} with a pillar · ${events.length} events`)
console.log(`partner ${nameOf(g.partner.form)} Lv ${g.level} · Box ${g.queue.length} · fully trained ${g.graduates.length} · rules today v${g.version}`)
console.log('\nXP')
console.log(`  a day: mean ${mean(days.map((x) => x.xp))}, median ${q(days.map((x) => x.xp), 0.5)}, best ${Math.max(0, ...days.map((x) => x.xp))} · on days with a pillar: mean ${mean(active.map((x) => x.xp))}`)
console.log(`  share of the day done: median ${(q(days.map((x) => x.share), 0.5) * 100 || 0).toFixed(0)}%, 90th ${(q(days.map((x) => x.share), 0.9) * 100 || 0).toFixed(0)}% · perfect days ${g.perfectDays} (${n ? ((g.perfectDays / n) * 100).toFixed(0) : 0}%)`)
console.log(`  momentum: ${days.filter((x) => x.mult >= 1.5).length} days at x1.5, ${days.filter((x) => x.mult > 1 && x.mult < 1.5).length} above x1, ${days.filter((x) => x.mult === 1).length} at x1`)
console.log(`  balls poke/great/ultra: ${['poke', 'great', 'ultra'].map((b) => days.filter((x) => x.ball === b).length).join('/')}`)

console.log('\nCatching (days with a pillar from appearing to caught)')
const appears = of('appear'), catches = of('catch')
for (const r of ['C', 'U', 'R', 'L']) {
  const waits = catches.flatMap((c) => {
    const a = [...appears].reverse().find((x) => x.form === c.form && x.day <= c.day)
    return a && (SPECIES[c.form].r ?? 'C') === r ? [activeBetween(a.day, c.day)] : []
  })
  if (waits.length) console.log(`  ${r}: ${waits.length} caught · median ${q(waits, 0.5)}, 90th ${q(waits, 0.9)}`)
}
console.log(`  ${catches.length} caught in all (${catches.filter((c) => c.how === 'perfect').length} by a perfect day, ${catches.filter((c) => c.shiny).length} shiny) · ${(catches.length / Math.max(1, g.graduates.length)).toFixed(1)} caught for each one trained`)
if (g.wild && !g.wild.caught) console.log(`  in front of you: ${nameOf(g.wild.form)} (${g.wild.rarity}) ${g.wild.hp}/${g.wild.max} HP since ${g.wild.from}`)

console.log('\nRaising')
for (const m of g.graduates) console.log(`  ${nameOf(m.form)}: ${m.started} to ${m.graduated}, ${m.together ?? 0} days together${m.nature ? `, ${m.nature.name}` : ''}`)
if (!g.graduates.length) console.log(`  none trained yet · ${nameOf(g.partner.form)} is ${g.partner.together ?? 0} days in, next ${g.next.what} at level ${g.next.level}`)

console.log('\nLeague (days with a pillar for each leader)')
let from = days[0]?.day
for (const m of of('gym')) {
  console.log(`  ${leaderOf(m.league, m.slot)?.name}: ${activeBetween(from, m.day)} (fell ${m.day})`)
  from = m.day
}
const up = leaderOf(g.league.index, g.league.slot)
if (up) console.log(`  up now: ${up.name} ${g.league.hp}/${g.league.max} HP · mean strike on a day with a pillar ${mean(active.map((x) => x.strike))}`)
console.log(`  Key Stone: ${g.keyStone ?? 'not yet'} · Mega forms kept: ${of('mega').length}`)

console.log('\nField notes (what each domain\'s own rewards will be priced from)')
const N = g.notes, per = (x) => (n ? (x / (n / 7)).toFixed(1) : '0')
console.log(`  code days ${N.codeDays} (${per(N.codeDays)} a week) · workouts ${N.workouts} (${per(N.workouts)}), records ${N.records} (${per(N.records)})`)
console.log(`  guitar full sessions ${N.guitarDays} (${per(N.guitarDays)}), clean plays ${N.clean} (${per(N.clean)}), parts owned ${N.owned} · Arbor full mornings ${N.arborDays} (${per(N.arborDays)})`)
console.log(`  steps: ${N.stepDays ? `${N.steps} counted over ${N.stepDays} measured days (mean ${Math.round(N.steps / N.stepDays)} a day, capped)` : 'no readings yet'} · days with any body reading ${facts.filter((f) => f.body).length}`)

console.log('\nThe list')
console.log(`  pillars today: ${facts.at(-1).habits.filter((h) => h.pillar).map((h) => `${h.id} (${h.tag})`).join(', ') || 'none yet (Life OS lifts them on first open)'}`)
console.log(`  days with their own frozen list: ${facts.filter((f) => events.some((e) => e.type === 'day_list' && e.day === f.day)).length} of ${n}`)
for (const w of g.warnings) console.log(`  WARNING ${w}`)
