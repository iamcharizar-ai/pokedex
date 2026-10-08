// Plays a year of synthetic days through the real game core and prints what
// happens: XP a day, catches, the Box, partners raised, leaders beaten, Mega.
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
import { SPECIES } from '../core/species.ts'

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
  interrupted: (w) => (w >= 8 && w < 11 ? { p: 0, s: 0, c: 0 } : { p: 0.8, s: 0.7, c: 0.75 }), // good, then three weeks of nothing at all (ill, away), then good again
  oneDomain: () => ({ p: 0.9, s: 0.6, c: 0.5, only: 'code' }), // a push on one thing: the other pillars mostly dropped
}
const DAYS = 365

for (const name of Object.keys(PROFILES)) {
  const r = rng(name.length * 7919 + 1), facts = []
  for (let i = 0; i < DAYS; i++) {
    const q = PROFILES[name](Math.floor(i / 7)), mood = (r() - 0.5) * 0.3
    const habits = LIST.map(([id, tag, worth, pillar]) => {
      const base = pillar ? (q.only && tag !== q.only ? 0.15 : q.p) : tag === 'sleep' ? q.s : q.c
      const p = base === 0 ? 0 : Math.max(0, Math.min(1, base + mood))
      const done = r() < p
      return { id, tag, worth, pillar, frac: done ? 1 : 0, done }
    })
    facts.push({ day: addDays(GAME_START, i), habits })
  }
  // the rules in force now, from the first day
  const opts = { v3From: GAME_START, v4From: GAME_START, v5From: GAME_START, v6From: GAME_START }
  // a plain way of spending: every ball the Mart offers today and one ball from each domain shop that can be paid for,
  // thrown while the wild Pokemon is still standing; every Pokemon beyond three in the Box goes to the Professor;
  // a Mega is forged whenever shards allow. Found by folding day by day.
  const BALLS = new Set(['poke-ball', 'great-ball', 'ultra-ball', 'repeat-ball'])
  const HITS = { 'poke-ball': 20, 'great-ball': 50, 'ultra-ball': 110, 'repeat-ball': 30 }
  const DOMAIN_BALL = { code: ['quick-ball', 6], fitness: ['heavy-ball', 6], guitar: ['moon-ball', 6], arbor: ['net-ball', 6], sleep: ['dusk-ball', 6] }
  for (let i = 0; i < DAYS; i++) {
    const now = foldGame(facts.slice(0, i + 1), opts)
    const uses = [], day = facts[i].day
    let coins = now.wallet.coins, hp = now.wild && !now.wild.caught ? now.wild.hp : 0
    for (const o of now.mart.deals) {
      if (!BALLS.has(o.item) || now.mart.bought.includes(o.item) || coins < o.coins || hp <= 0) continue
      uses.push({ day, item: o.item, uid: '', what: 'buy', to: 'mart' }, { day, item: o.item, uid: '', what: 'throw' }); coins -= o.coins; hp -= HITS[o.item]
    }
    for (const [tag, [item, price]] of Object.entries(DOMAIN_BALL))
      if (now.wallet.marks[tag] >= price && hp > 0) { uses.push({ day, item, uid: '', what: 'buy', to: tag }, { day, item, uid: '', what: 'throw' }); hp -= 40 }
    for (const m of now.queue.slice(3)) uses.push({ day, item: '', uid: m.uid, what: 'transfer' })
    for (const m of now.graduates) for (const to of SPECIES[m.form]?.m ?? []) if (!m.megas?.includes(to)) uses.push({ day, item: '', uid: m.uid, what: 'forge', to })
    if (uses.length) facts[i].uses = uses
  }
  const g = foldGame(facts, opts)
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
  const natures = g.graduates.map((x) => x.nature?.name).filter(Boolean)
  console.log(`  mega: Key Stone day ${dayNo(of('key')[0])} · ${of('mega').length} forged · ${m.filter((x) => x.kind === 'form' && x.what === 'mega').length} first seen on a full-momentum day · days at full momentum ${g.days.filter((d) => d.mult >= 1.5).length}`)
  const feats = of('feat')
  console.log(`  feats: ${feats.length} reached (first on day ${dayNo(feats[0])}, tenth on day ${dayNo(feats[9])}) · runs best ${Object.entries(g.runs).map(([k, r]) => k + ' ' + r.best).join(', ')}`)
  console.log(`  money: ${(g.wallet.coins + facts.length * 0).toLocaleString()} coins unspent · coins earned ${Math.round(of('quest').reduce((n, q) => n + q.coins, 0) + of('transfer').reduce((n, q) => n + (q.coins ?? 0), 0))} from quests and the Professor, about ${Math.round((of('quest').reduce((n, q) => n + q.coins, 0) + of('transfer').reduce((n, q) => n + (q.coins ?? 0), 0)) / DAYS)} a day · gems ${g.wallet.gems} · marks left ${Object.entries(g.wallet.marks).map(([k, v]) => k + ' ' + v).join(', ')}`)
  console.log(`  balls thrown ${facts.reduce((n, f) => n + (f.uses ?? []).filter((u) => u.what === 'throw').length, 0)} of which ${catches.filter((c) => c.how === 'ball').length} finished a wild Pokemon · sent to the Professor ${of('transfer').length} · quests paid ${of('quest').length}`)
  console.log(`  kept: bond lost ${g.graduates.filter((x) => !x.bond).length} (must be 0) · stones ${of('item').length} (must be 0) · natures ${[...new Set(natures)].join(', ') || 'none yet'}`)
}
