// Plays a year of synthetic days through the real game core and prints what
// happens: XP a day, catches, the Box, partners raised, leaders beaten, stones.
// Run it after any change to core/rules.ts, before shipping the change.
//
//   node tools/simulate.mjs
//
// The profiles are ASSUMPTIONS, not data: each habit is an independent yes/no
// draw with a daily "mood" that lifts or lowers them all a little. Replace
// them with the real ledger (tools/replay.mjs) once there are weeks of it.
// Habit list: 33 habits, a full day is 474 XP (4 pillars, sleep, 6 standard,
// 22 basic), close to the 470 the guide quotes.
import { foldGame } from '../core/fold.ts'
import { addDays } from '../core/facts.ts'
import { LEAGUES } from '../core/gyms.ts'
import { GAME_START } from '../core/rules.ts'

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const LIST = [
  ['leetcode-coding', 'code', 100, true], ['gym', 'fitness', 100, true], ['woodshed-guitar', 'guitar', 100, true], ['arbor-morning', 'arbor', 100, true], ['sleep-before-10', 'sleep', 30, false],
  ...Array.from({ length: 6 }, (_, i) => ['std' + i, 'routine', 3, false]), ...Array.from({ length: 22 }, (_, i) => ['b' + i, 'routine', 1, false]),
]
/** chance of doing a pillar / sleep / a chore, by week */
const PROFILES = {
  strong: () => ({ p: 0.92, s: 0.85, c: 0.88 }),
  ordinary: () => ({ p: 0.68, s: 0.6, c: 0.6 }),
  patchy: () => ({ p: 0.5, s: 0.45, c: 0.45 }),
  lapsing: (w) => (w % 6 < 3 ? { p: 0.85, s: 0.75, c: 0.8 } : { p: 0.15, s: 0.2, c: 0.2 }), // three good weeks, three off
}
const DAYS = 365

for (const name of Object.keys(PROFILES)) {
  const r = rng(name.length * 7919 + 1), facts = []
  for (let i = 0; i < DAYS; i++) {
    const q = PROFILES[name](Math.floor(i / 7)), mood = (r() - 0.5) * 0.3
    const habits = LIST.map(([id, tag, worth, pillar]) => {
      const p = Math.max(0, Math.min(1, (pillar ? q.p : tag === 'sleep' ? q.s : q.c) + mood))
      const done = r() < p
      return { id, tag, worth, pillar, frac: done ? 1 : 0, done }
    })
    facts.push({ day: addDays(GAME_START, i), habits })
  }
  const g = foldGame(facts, { v3From: GAME_START })
  const m = g.moments, of = (k) => m.filter((x) => x.kind === k)
  const dayNo = (x) => (x ? g.days.findIndex((d) => d.day === x.day) + 1 : '-')
  const avg = (f) => g.days.reduce((s, d) => s + f(d), 0) / DAYS
  const catches = of('catch'), gaps = catches.map((c, i) => dayNo(c) - (i ? dayNo(catches[i - 1]) : 0)).sort((a, b) => a - b)
  const leagues = of('league')
  console.log(`\n## ${name}`)
  console.log(`  day: ${Math.round(avg((d) => d.xp))} XP · ${(avg((d) => d.share) * 100).toFixed(0)}% of the day done · perfect days ${g.perfectDays} · balls poke/great/ultra ${['poke', 'great', 'ultra'].map((b) => g.days.filter((d) => d.ball === b).length).join('/')}`)
  console.log(`  catching: ${catches.length} a year (${(catches.length / 52).toFixed(2)} a week; ${catches.filter((c) => c.how === 'perfect').length} by a perfect day, ${catches.filter((c) => c.shiny).length} shiny) · typical wait ${gaps[Math.floor(gaps.length / 2)] ?? '-'} days · average hit ${Math.round(avg((d) => d.hit))}`)
  console.log(`  raising: ${g.graduates.length} fully trained (first on day ${dayNo(of('graduate')[0])}) · ${(catches.length / Math.max(1, g.graduates.length)).toFixed(1)} caught for each one raised · Box at year end ${g.queue.length} · eggs ${of('partner').filter((x) => x.origin === 'egg').length}`)
  console.log(`  league: ${of('gym').length} leaders beaten · average strike ${Math.round(avg((d) => d.strike))} · leagues beaten ${leagues.map((l) => `${LEAGUES[l.league].name} day ${dayNo(l)}`).join(', ') || 'none'} · regions open ${g.regions}${g.league.waiting ? ' (next league waiting for its region)' : ''}`)
  console.log(`  extras: ${of('item').length} stones · Mega on ${g.days.filter((_, i) => false).length || m.filter((x) => x.kind === 'form' && x.what === 'mega').length} first-time forms · days at full momentum ${g.days.filter((d) => d.mult >= 1.5).length}`)
}
