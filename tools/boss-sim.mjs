// How hard is the weekly boss? Plays many weeks for each kind of party against
// each kind of boss, at different shares of the card done, and reports how
// often the boss is killed, comes into throwing range, and is caught.
//
//   node tools/boss-sim.mjs            (2,000 weeks per row)
//   node tools/boss-sim.mjs 10000
//
// It uses the core's own arithmetic (core/boss.ts), so it cannot drift from the
// game. The weeks are invented: a task finishes on a random day, and "80% of the
// card" means each task ends the week at about that. For what YOUR weeks would
// have done, replay the real ledger instead (tools/replay.mjs).
import {
  BOSS_HEAL, BOSS_SHARE, KILL_CAP, THROWS, THROW_AT, bossLevel, catchChance, strikeOf,
} from '../core/boss.ts'

const N = Number(process.argv[2]) || 2000
const m = (level, rarity, mega = false) => ({ level, rarity, mega })
const PARTIES = [
  ['Six commons, partner Lv 10', [m(10, 'C'), ...Array.from({ length: 5 }, () => m(30, 'C'))], 0.12],
  ['Mixed uncommon/rare, no Mega', [m(30, 'U'), m(50, 'U'), m(50, 'R'), m(50, 'U'), m(30, 'C'), m(50, 'R')], 0.22],
  ['Rares, two Megas', [m(40, 'R'), m(50, 'R'), m(50, 'R', true), m(50, 'R'), m(50, 'R', true), m(50, 'R')], 0.34],
  ['Legendaries and Megas', [m(50, 'L'), m(50, 'L', true), m(50, 'L', true), m(50, 'R', true), m(50, 'L'), m(50, 'R', true)], 0.45],
]
const BOSSES = [['rare', { rarity: 'R', mega: false }], ['legendary', { rarity: 'L', mega: false }], ['Mega legendary', { rarity: 'L', mega: true }]]
const SHARES = Object.values(BOSS_SHARE)

// a small seeded generator, so a run can be repeated
let seed = 12345
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }

/** One week: each task climbs to about `done` of itself by a random day. Returns [killed, couldThrow, caught]. */
function week(party, common, boss, done, ball) {
  const strike = strikeOf(party, boss)
  // where each task ends, and the day it gets there
  const ends = SHARES.map(() => Math.max(0, Math.min(1, done >= 1 ? 1 : done + (rand() - 0.5) * 0.3)))
  const by = SHARES.map(() => 1 + Math.floor(rand() * 6))
  let taken = 0, dealt = 0, work = 0
  for (let d = 0; d < 7; d++) {
    const p = ends.map((e, i) => (d >= by[i] ? e : e * ((d + 1) / (by[i] + 1))))
    const now = SHARES.reduce((s, sh, i) => s + sh * p[i], 0)
    const moved = now - work
    if (moved > 1e-9) dealt += strike * (1 + common) * moved
    else if (d > 0) dealt -= BOSS_HEAL
    dealt = Math.max(0, dealt)
    taken = Math.min(p.every((x) => x >= 1) ? 1 : KILL_CAP, dealt)
    work = now
  }
  const hpLeft = 1 - taken
  const killed = taken >= 1 - 1e-9
  const canThrow = hpLeft <= THROW_AT + 1e-9
  let caught = false
  if (canThrow) {
    const chance = catchChance(ball, party.length - 1, ends.every((e) => e >= 1), hpLeft, strike)
    for (let t = 0; t < THROWS && !caught; t++) caught = rand() < chance
  }
  return [killed, canThrow, caught]
}

const pct = (x) => `${Math.round((x / N) * 100)}%`.padStart(4)
console.log(`${N} weeks per row, three Ultra Balls a week. Columns: killed / in throwing range / caught.\n`)
for (const [name, party, common] of PARTIES) {
  const level = bossLevel(party.reduce((s, x) => s + x.level, 0))
  console.log(`${name}  (boss Lv ${level})`)
  for (const [bname, b] of BOSSES) {
    const boss = { level, ...b }
    const cells = [0.6, 0.8, 0.9, 1].map((done) => {
      let k = 0, t = 0, c = 0
      for (let i = 0; i < N; i++) { const [a, bb, cc] = week(party, common, boss, done, 'ultra-ball'); k += a; t += bb; c += cc }
      return `${Math.round(done * 100)}% of card: ${pct(k)} /${pct(t)} /${pct(c)}`
    })
    console.log(`  ${bname.padEnd(15)} strike ${strikeOf(party, boss).toFixed(2)}   ${cells.join('   ')}`)
  }
  console.log()
}
