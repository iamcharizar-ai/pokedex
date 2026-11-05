// Plays the Life OS habit list forward through the real game core and prints what a player would get:
// currencies and eggs a month, the Box, hearts a day, the boss, the partner's road. It runs today's rules, so
// run it again after any change to core/ and compare.
//
//   node tools/sim-life.mjs --pace normal          (or real, or strong)   [--days 182] [--seed 1]
//
// The paces are ASSUMPTIONS, not data:
//   normal  all four pillars (Sleep, Arbor, LeetCode, Gym) on about 85% of Mondays to Saturdays, Sunday off, 80% of chores,
//           about 10,000 steps, sleep around 85. The pace GAME_AUDIT.md calls "normal".
//   real    what the ledger showed from 3 Oct to 5 Nov 2026: about 1.3 effortful pillars on 60% of days, chores about half,
//           8,500 steps, sleep around 78. The floor test: a bad stretch.
//   strong  every pillar Monday to Saturday, 92% of chores.
// The list is the one Life OS had on 5 Nov 2026: 4 pillars, 6 standard habits (3 XP) and 19 basic ones (1 XP); Guitar shelved.
// The player is plain and engaged: claims everything, throws every ball while the wild Pokemon stands, feeds every berry to
// the partner, sells treasures, revives fossils, buys an egg with marks when the Nursery is empty (else mastery), a Mystery
// Egg with gems, and forges a Mega for the partner when it can. The weekly boss card is a stand-in for the planner in
// src/lib/boss.ts: four tasks of four days each (gym, Arbor, nights of 80+, days with three-quarters ticked).
import { foldGame, nameOf, leaderOf } from '../core/fold.ts'
import { addDays } from '../core/facts.ts'
import { bossLevel } from '../core/boss.ts'
import { levelOf } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { BALLS, BERRY_HEARTS, EGG_IDS, FOSSILS, MARK_TAGS, MASTERY_MAX, TREASURE, masteryCost, workEgg } from '../core/economy.ts'

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt }
const PACE = arg('pace', 'normal')
if (!['normal', 'real', 'strong'].includes(PACE)) { console.error('--pace normal | real | strong'); process.exit(1) }
const DAYS = Number(arg('days', 182))
const START = arg('start', '2026-11-09') // a Monday, after every rules version so far
let seed = Number(arg('seed', 1)) * 7919 + PACE.length * 99
const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const gauss = (m, s) => m + s * Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())

const CHORES = [...Array.from({ length: 6 }, (_, i) => [`std${i}`, 3]), ...Array.from({ length: 19 }, (_, i) => [`basic${i}`, 1])]
const ROUTINES = ['d1-chest-delts', 'd2-lats-biceps', 'd3-legs', 'd4-delts-triceps', 'd5-back-biceps', 'd6-chest-flys', 'd7-arms-delts']
let workoutN = 0

/** One day of the pace: which pillars, how many chores, the band's night and steps, and a Strong workout on gym days. */
function dayOf(i) {
  const day = addDays(START, i), sunday = new Date(day + 'T12:00:00').getDay() === 0
  let p
  if (PACE === 'normal') {
    const work = !sunday && r() < 0.85
    p = { code: work && r() < 0.95, fitness: work && r() < 0.9, arbor: work && r() < 0.95, chores: work ? 0.8 : 0.5, all: work && r() < 0.12 }
  } else if (PACE === 'strong') {
    p = { code: !sunday, fitness: !sunday, arbor: !sunday, chores: sunday ? 0.6 : 0.92, all: !sunday && r() < 0.3 }
  } else {
    const on = r() < 0.6
    p = { code: on && r() < 0.35, fitness: on && r() < 0.15, arbor: on && r() < 0.3, chores: on ? 0.65 : 0.2, all: on && r() < 0.05 }
    if (on && !p.code && !p.fitness && !p.arbor) p[['code', 'arbor', 'fitness'][Math.floor(r() * 3)]] = true
  }
  const score = Math.round(Math.max(40, Math.min(100, gauss(PACE === 'real' ? 78 : 85, 8))))
  const pillar = (id, tag, done) => ({ id, tag, worth: 100, pillar: true, frac: done ? 1 : 0, done })
  const habits = [
    { id: 'sleep-before-10', tag: 'sleep', worth: 100, pillar: true, frac: score / 100, done: score >= 80, measured: true },
    pillar('leetcode-coding', 'code', p.code || p.all), pillar('gym', 'fitness', p.fitness || p.all), pillar('arbor-morning', 'arbor', p.arbor || p.all),
    ...CHORES.map(([id, worth]) => { const done = p.all || r() < p.chores; return { id, tag: 'routine', worth, pillar: false, frac: done ? 1 : 0, done } }),
  ]
  const marks = habits[2].done ? { workouts: 1, records: r() < 0.15 ? 1 : 0, gear: [ROUTINES[workoutN++ % ROUTINES.length]] } : undefined
  const steps = Math.round(Math.max(1500, gauss(PACE === 'real' ? 8500 : 10000, 3500)))
  return { day, habits, body: { sleepScore: score, steps, deepMin: Math.round(gauss(80, 18)) }, ...(marks ? { marks } : {}), live: ['sleep', 'arbor', 'code', 'fitness', 'routine'] }
}

const SHARE = { gym: 0.375, arbor: 0.3125, sleep: 0.1875, life: 0.125 } // Guitar shelved: the planner's shares, scaled back to a whole
const facts = [], months = [], marks = []
let card = null, count = {}
for (let i = 0; i < DAYS; i++) {
  const f = dayOf(i)
  facts.push(f)
  // the boss: a card each Monday once the party is three
  if (new Date(f.day + 'T12:00:00').getDay() === 1) {
    const g = foldGame(facts)
    card = 1 + g.team.length >= 3
      ? { week: f.day, rev: 2, species: 'dratini', form: 'dragonite', rarity: 'R', mega: false, level: bossLevel([g.partner, ...g.team].reduce((n, m) => n + levelOf(m.xp), 0)), tasks: Object.entries(SHARE).map(([kind, share]) => ({ kind, template: 'sim', target: 4, share, text: kind })) }
      : null
    count = { gym: 0, arbor: 0, sleep: 0, life: 0 }
  }
  if (card) {
    const h = f.habits, mine = h.filter((x) => !x.measured)
    count.gym += h[2].done ? 1 : 0; count.arbor += h[3].done ? 1 : 0; count.sleep += h[0].done ? 1 : 0
    count.life += mine.filter((x) => x.done).length / mine.length >= 0.75 ? 1 : 0
    f.boss = { card, p: Object.keys(SHARE).map((k) => Math.min(1, count[k] / 4)) }
  }
  // the player
  const g = foldGame(facts), uses = []
  const use = (what, item = '', uid = '', to) => uses.push({ day: f.day, item, uid, what, ...(to !== undefined ? { to } : {}) })
  const inv = { ...g.inv }, wallet = { coins: g.wallet.coins, gems: g.wallet.gems, marks: { ...g.wallet.marks } }
  for (const h of g.held) use('claim', h.choice ? '0' : '', '', h.key)
  let hp = g.wild && !g.wild.caught ? g.wild.hp : 0
  for (const o of g.mart.deals) if ((o.item === 'great-ball' || o.item === 'ultra-ball') && hp > 0 && wallet.coins >= o.coins + 150) { use('buy', o.item, '', 'mart'); wallet.coins -= o.coins; inv[o.item] = (inv[o.item] ?? 0) + 1 }
  if (g.boss?.canThrow) for (const b of ['ultra-ball', 'great-ball']) for (let k = 0; k < Math.min(3, inv[b] ?? 0); k++) use('boss-throw', b)
  else for (const b of ['ultra-ball', 'great-ball', 'premier-ball', 'luxury-ball', 'poke-ball']) while ((inv[b] ?? 0) > 0 && hp > 0) { use('throw', b); inv[b]--; hp -= BALLS[b].hp }
  for (const b of Object.keys(BERRY_HEARTS)) for (let k = 0; k < (inv[b] ?? 0); k++) use('feed', b, g.partner.uid)
  for (const t of Object.keys(TREASURE)) if (inv[t]) use('sell', t, '', String(inv[t]))
  for (const fo of Object.keys(FOSSILS)) if (inv[fo] && wallet.coins >= 150) { use('fossil', fo); wallet.coins -= 150 }
  const waiting = EGG_IDS.filter((k) => (inv[k] ?? 0) > 0)
  if (!g.egg && waiting.length > 1) use('warm', waiting[0])
  let egg = Boolean(g.egg) || waiting.length > 0
  for (const t of MARK_TAGS) {
    if (!egg && wallet.marks[t] >= 10) { use('buy', workEgg(t), '', t); wallet.marks[t] -= 10; egg = true; continue }
    if (g.mastery[t] < MASTERY_MAX && wallet.marks[t] >= masteryCost(g.mastery[t])) use('train', '', '', t)
  }
  if (!egg && wallet.gems >= 150) use('buy', 'rare-egg', '', 'rare')
  const megas = SPECIES[g.partner.form]?.m ?? []
  if (g.keyStone && megas.length && !g.partner.megas?.length) use('forge', '', g.partner.uid, megas[0])
  if (uses.length) f.uses = uses
  // the day as it ended
  const a = foldGame(facts), m = (months[Math.floor(i / 30)] ??= { xp: 0, coins: 0, gems: 0, bp: 0, marks: Object.fromEntries(MARK_TAGS.map((t) => [t, 0])), pillarDays: 0, perfect: 0, hearts: 0 })
  const hearts = (g2) => g2.trainer.hearts
  m.xp += a.today.xp; m.coins += a.wallet.coinsToday; m.gems += a.wallet.gemsToday; m.bp += a.wallet.bpToday
  for (const t of MARK_TAGS) m.marks[t] += a.wallet.marksToday[t]
  if (a.today.pillars > 0) m.pillarDays++
  if (a.today.perfect) m.perfect++
  m.hearts = hearts(a)
  if ([6, 29, 89, 181].includes(i) || i === DAYS - 1) marks.push({ day: i + 1, g: a })
}

const g = foldGame(facts)
const n = (k, what) => g.moments.filter((x) => x.kind === k && (!what || x.what === what)).length
const monthOf = (day) => Math.floor((Date.parse(day) - Date.parse(START)) / 86400000 / 30)
const per = (k) => { const out = months.map(() => 0); for (const x of g.moments) if (x.kind === k) out[monthOf(x.day)]++; return out }
console.log(`# ${PACE} pace, ${DAYS} days from ${START}, under today's rules\n`)
console.log('month  XP      coins   gems  BP    marks code/gym/arbor/sleep  pillar-days perfect  catches eggs  Trainer hearts')
const catches = per('catch'), hatches = per('hatch')
months.forEach((m, k) => {
  if (k * 30 >= DAYS) return
  console.log(`${String(k + 1).padStart(5)}  ${String(m.xp).padEnd(7)} ${String(m.coins).padEnd(7)} ${String(m.gems).padEnd(5)} ${String(m.bp).padEnd(5)} ${[m.marks.code, m.marks.fitness, m.marks.arbor, m.marks.sleep].join('/').padEnd(27)} ${String(m.pillarDays).padEnd(11)} ${String(m.perfect).padEnd(8)} ${String(catches[k]).padEnd(8)} ${String(hatches[k]).padEnd(5)} ${m.hearts}`)
})
console.log('\nday  partner              fully trained  Box  leaders  regions  Lab           boss kills  wallet')
for (const { day, g: a } of marks) {
  const kills = a.moments.filter((x) => x.kind === 'boss' && x.what === 'kill').length
  console.log(`${String(day).padEnd(4)} ${`${nameOf(a.partner.form)} Lv ${a.level}`.padEnd(20)} ${String(a.graduates.length).padEnd(14)} ${String(a.queue.length).padEnd(4)} ${String(a.moments.filter((x) => x.kind === 'gym').length).padEnd(8)} ${String(a.regions).padEnd(8)} ${`rank ${a.research.rank} ${a.research.points}/${a.research.need}`.padEnd(13)} ${String(kills).padEnd(11)} ${a.wallet.coins} coins, ${a.wallet.gems} gems, ${a.wallet.bp} BP`)
}
const weeks = g.bossLog.length + (g.boss ? 1 : 0)
console.log(`\nboss: ${weeks} weeks with a card, ${n('boss', 'kill')} beaten, ${n('boss', 'catch')} caught, best ${Math.round(Math.max(0, ...g.bossLog.map((b) => b.taken)) * 100)}% of its HP`)
console.log(`hearts a day: ${(g.trainer.hearts / DAYS).toFixed(1)} (Trainer hearts ${g.trainer.hearts}, level ${g.trainer.level}, ${g.trainer.stars} stars)`)
console.log(`Pokemon: ${n('catch')} caught, ${n('hatch')} hatched, ${n('fossil')} fossils; Box ${g.queue.length}, fully trained ${g.graduates.length}; Mega forged ${n('mega')}; Dynamax days ${g.counters.dynamax ?? 0}`)
console.log(`partners: ${g.moments.filter((x) => x.kind === 'evolve' || x.kind === 'graduate' || x.kind === 'partner').map((x) => `${x.day.slice(5)} ${x.kind} ${nameOf(x.form)}`).join(', ')}`)
const lead = leaderOf(g.league.index, g.league.slot)
console.log(`now: ${lead ? `${lead.name} ${g.league.hp}/${g.league.max}` : 'no leader'}; wild ${g.wild ? nameOf(g.wild.form) : '-'}; momentum x${g.momentum.mult}`)
