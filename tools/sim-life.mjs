// Plays the Life OS habit list forward through the real game core and prints what a player would get:
// currencies and eggs a month, the Box, hearts a day, the boss, the partner's road. Run it again after any change to core/ and compare.
//
//   node tools/sim-life.mjs --pace normal          (or real, or strong)   [--days 182] [--seed 1]
//   node tools/sim-life.mjs --pace normal --rules v21                  plays from V21_START, so version 21's rules apply
//   tuning (version 21):  --bounty 2,3   the neglect bounty at 2 idle days, at 3 and more (core/rules.ts BOUNTY)
//                         --first 1,40,2 the first pillar's hearts, research, gems (FIRST_PILLAR); --first 0 for none
//                         --skip week|2days|3days [--pillar code]  skip one pillar a whole week every other week, or Tuesday and Wednesday (to Thursday) every week
//                         --xp 1,1,1.1,1.25,1.5  the XP multiplier by tier (DAY_XP_MULT)
//                         --json          one line of totals, for comparing runs
//
// The paces are ASSUMPTIONS, not data:
//   normal  all three effortful pillars (Arbor, Code, Gym) on about 85% of Mondays to Saturdays, Sunday off, 80% of chores,
//           about 10,000 steps, sleep around 85. The pace GAME_AUDIT.md calls "normal".
//   real    what the ledger showed from 3 Oct to 5 Nov 2026: about 1.3 effortful pillars on 60% of days, chores about half,
//           8,500 steps, sleep around 78. The floor test: a bad stretch.
//   strong  every pillar Monday to Saturday, 92% of chores.
// The list is the one Life OS had on 5 Nov 2026: Sleep and 3 effortful pillars, 6 standard habits (3 XP) and 19 basic ones (1 XP); Guitar shelved.
// The player is plain and engaged: claims everything, throws every ball while the wild Pokemon stands, feeds every berry to the
// partner, sells treasures, revives fossils, warms an egg when two wait. Today's rules: an egg with marks when the Nursery is empty,
// else mastery; a Mystery Egg with gems; a Mega for the partner when it can. Version 21: each pillar's marks at 20 buy its shard until
// one of each colour is held, then its egg (while fewer than 3 wait); gems buy a Lab pick (Full Incense) for each wild Pokemon and a
// Mystery Egg; a Mega is forged for the partner, else for the first Pokemon that has one. The weekly boss card is the real V21 rule
// (core/boss.ts tasksV21); before V21 a stand-in for src/lib/boss.ts (four tasks of four days each).
import { foldGame, nameOf, leaderOf } from '../core/fold.ts'
import { addDays } from '../core/facts.ts'
import { bossLevel, tasksV21 } from '../core/boss.ts'
import { BOUNTY, DAY_GEMS, DAY_XP_MULT, FIRST_PILLAR, LEADER_GEMS_V21, V21_START, levelOf } from '../core/rules.ts'
import { isGym } from '../core/fold.ts'
import { SILVER_GEMS, GOLD_GEMS } from '../core/frontier.ts'
import { SPECIES } from '../core/species.ts'
import { BALLS, BERRY_HEARTS, COUNTER_V21, EGG_IDS, EGG_WAIT_MAX, FOSSILS, MARKS, MARK_TAGS, MASTERY_MAX, TREASURE, forgeFair, masteryCost, workEgg } from '../core/economy.ts'

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt }
const PACE = arg('pace', 'normal')
if (!['normal', 'real', 'strong'].includes(PACE)) { console.error('--pace normal | real | strong'); process.exit(1) }
const V21 = arg('rules', '') === 'v21'
const DAYS = Number(arg('days', 182))
/** a Monday: the one after every rules version so far, or the first on or after V21_START */
const mondayFrom = (d) => { let x = d; while (new Date(x + 'T12:00:00').getDay() !== 1) x = addDays(x, 1); return x }
const START = arg('start', V21 ? mondayFrom(V21_START) : '2026-11-09')
const SKIP = arg('skip', ''), SKIP_PILLAR = arg('pillar', 'code'), JSON_OUT = process.argv.includes('--json')
if (arg('bounty', '')) { const [a, b] = arg('bounty').split(',').map(Number); BOUNTY.two = a; BOUNTY.three = b ?? a }
if (arg('xp', '')) arg('xp').split(',').map(Number).forEach((x, i) => { DAY_XP_MULT[i] = x })
if (arg('first', '')) { const [h, r = 0, g = 0] = arg('first').split(',').map(Number); Object.assign(FIRST_PILLAR, { hearts: h, research: r, gems: g }) }
let seed = Number(arg('seed', 1)) * 7919 + PACE.length * 99
const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const gauss = (m, s) => m + s * Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())

const CHORES = [...Array.from({ length: 6 }, (_, i) => [`std${i}`, 3]), ...Array.from({ length: 19 }, (_, i) => [`basic${i}`, 1])]
const ROUTINES = ['d1-chest-delts', 'd2-lats-biceps', 'd3-legs', 'd4-delts-triceps', 'd5-back-biceps', 'd6-chest-flys', 'd7-arms-delts']
let workoutN = 0

/** One day of the pace: which pillars, how many chores, the band's night and steps, and a Strong workout on gym days. The same draws with or without --skip. */
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
  const did = { code: p.code || p.all, fitness: p.fitness || p.all, arbor: p.arbor || p.all }
  const dow = i % 7, off = SKIP === 'week' ? Math.floor(i / 7) % 2 === 1 : SKIP === '2days' ? dow === 1 || dow === 2 : SKIP === '3days' ? dow >= 1 && dow <= 3 : false
  if (off) did[SKIP_PILLAR] = false
  const habits = [
    { id: 'sleep-before-10', tag: 'sleep', worth: 100, pillar: true, frac: score / 100, done: score >= 80, measured: true },
    pillar('leetcode-coding', 'code', did.code), pillar('gym', 'fitness', did.fitness), pillar('arbor-morning', 'arbor', did.arbor),
    ...CHORES.map(([id, worth]) => { const done = p.all || r() < p.chores; return { id, tag: 'routine', worth, pillar: false, frac: done ? 1 : 0, done } }),
  ]
  const records = r() < 0.15 ? 1 : 0
  const marks = did.fitness ? { workouts: 1, records, gear: [ROUTINES[workoutN++ % ROUTINES.length]] } : undefined
  const steps = Math.round(Math.max(1500, gauss(PACE === 'real' ? 8500 : 10000, 3500)))
  return { day, habits, body: { sleepScore: score, steps, deepMin: Math.round(gauss(80, 18)) }, ...(marks ? { marks } : {}), live: ['sleep', 'arbor', 'code', 'fitness', 'routine'] }
}

/** What a sim day did, as the V21 card reads it. */
const seen = (f) => {
  const did = { code: f.habits[1].done, gym: f.habits[2].done, arbor: f.habits[3].done }
  const work = did.code || did.gym || did.arbor
  const mine = f.habits.filter((h) => !h.measured)
  return { did, night: work && f.habits[0].done, steady: mine.filter((h) => h.done).length / mine.length >= 0.75 }
}
const OLD_SHARE = { gym: 0.375, arbor: 0.3125, sleep: 0.1875, life: 0.125 } // before V21: the old planner's shares with Guitar shelved

const facts = [], months = [], snaps = []
const tiers = [0, 0, 0, 0, 0], choreDays = [], moms = { 1: 0, 1.2: 0, 1.35: 0, 1.5: 0 }
let researchPts = 0, tierGems = 0, tier1 = { days: 0, research: 0 }
let card = null, megaDay = null
for (let i = 0; i < DAYS; i++) {
  const f = dayOf(i)
  facts.push(f)
  // the weekly boss: a card each Monday
  if (new Date(f.day + 'T12:00:00').getDay() === 1) {
    const g = foldGame(facts)
    const level = bossLevel([g.partner, ...g.team].reduce((n, m) => n + levelOf(m.xp), 0))
    if (V21) {
      const back = facts.slice(Math.max(0, i - 21), i).map(seen)
      const h = { done: { code: back.filter((x) => x.did.code).length, gym: back.filter((x) => x.did.gym).length, arbor: back.filter((x) => x.did.arbor).length }, nights: back.filter((x) => x.night).length, steady: back.filter((x) => x.steady).length, days: back.length || 1 }
      if (!back.length) h.done = { code: 3, gym: 3, arbor: 3 }, h.nights = 3, h.steady = 3 // the first week: a middling card
      const tasks = tasksV21(h, (k) => k !== 'shed')
      card = tasks ? { week: f.day, rev: 2, species: 'dratini', form: 'dragonite', rarity: 'R', mega: false, level, tasks } : null
    } else {
      card = 1 + g.team.length >= 3 ? { week: f.day, rev: 2, species: 'dratini', form: 'dragonite', rarity: 'R', mega: false, level, tasks: Object.entries(OLD_SHARE).map(([kind, share]) => ({ kind, template: 'sim', target: 4, share, text: kind })) } : null
    }
  }
  if (card) {
    const wk = facts.slice(facts.findIndex((x) => x.day === card.week)).map(seen)
    const count = { code: wk.filter((x) => x.did.code).length, gym: wk.filter((x) => x.did.gym).length, arbor: wk.filter((x) => x.did.arbor).length, sleep: V21 ? wk.filter((x) => x.night).length : facts.slice(-wk.length).filter((x) => x.habits[0].done).length, life: wk.filter((x) => x.steady).length }
    f.boss = { card, p: card.tasks.map((t) => Math.min(1, count[t.kind] / t.target)) }
  }
  // the player
  const g = foldGame(facts), uses = []
  const use = (what, item = '', uid = '', to) => uses.push({ day: f.day, item, uid, what, ...(to !== undefined ? { to } : {}) })
  const inv = { ...g.inv }, wallet = { coins: g.wallet.coins, gems: g.wallet.gems, marks: { ...g.wallet.marks } }
  for (const h of g.held) use('claim', h.choice ? '0' : '', '', h.key)
  let hp = g.wild && !g.wild.caught ? g.wild.hp : 0
  for (const o of g.mart.deals) if ((o.item === 'great-ball' || o.item === 'ultra-ball') && hp > 0 && wallet.coins >= o.coins + 150) { use('buy', o.item, '', 'mart'); wallet.coins -= o.coins; inv[o.item] = (inv[o.item] ?? 0) + 1 }
  if (!V21 && g.boss?.canThrow) for (const b of ['ultra-ball', 'great-ball']) for (let k = 0; k < Math.min(3, inv[b] ?? 0); k++) use('boss-throw', b)
  else for (const b of ['ultra-ball', 'great-ball', 'premier-ball', 'luxury-ball', 'poke-ball']) while ((inv[b] ?? 0) > 0 && hp > 0) { use('throw', b); inv[b]--; hp -= BALLS[b].hp }
  for (const b of Object.keys(BERRY_HEARTS)) for (let k = 0; k < (inv[b] ?? 0); k++) use('feed', b, g.partner.uid)
  for (const t of Object.keys(TREASURE)) if (inv[t]) use('sell', t, '', String(inv[t]))
  for (const fo of Object.keys(FOSSILS)) if (inv[fo] && wallet.coins >= 150) { use('fossil', fo); wallet.coins -= 150 }
  const waiting = EGG_IDS.filter((k) => (inv[k] ?? 0) > 0)
  if (!g.egg && waiting.length > 1) use('warm', waiting[0])
  let eggs = EGG_IDS.reduce((n, k) => n + (inv[k] ?? 0), 0)
  const owned = [g.partner, ...g.queue, ...g.graduates]
  const anyMega = owned.some((m) => m.megas?.length)
  if (V21) {
    for (const t of MARK_TAGS) {
      if (wallet.marks[t] < COUNTER_V21) continue
      const shard = MARKS[t].shard
      if (shard && !anyMega && !(inv[shard] > 0)) { use('buy', shard, '', t); inv[shard] = 1; wallet.marks[t] -= COUNTER_V21 }
      else if (eggs < EGG_WAIT_MAX) { use('buy', workEgg(t), '', t); eggs++; wallet.marks[t] -= COUNTER_V21 }
    }
    if (!g.wish.chosen && !(inv['full-incense'] > 0) && wallet.gems >= 40) { use('buy', 'full-incense', '', 'rare'); wallet.gems -= 40; inv['full-incense'] = 1 }
    if (!g.wish.chosen && inv['full-incense'] > 0) use('wish', 'full-incense', '', g.wish.options['full-incense'][0])
    if (eggs < EGG_WAIT_MAX && wallet.gems >= 190) { use('buy', 'rare-egg', '', 'rare'); wallet.gems -= 150 }
    const who = (SPECIES[g.partner.form]?.m?.length ? g.partner : owned.find((m) => SPECIES[m.form]?.m?.length && !m.megas?.length))
    if (g.keyStone && who && !who.megas?.length && forgeFair(inv)) use('forge', '', who.uid, SPECIES[who.form].m[0])
  } else {
    let egg = Boolean(g.egg) || waiting.length > 0
    for (const t of MARK_TAGS) {
      if (!egg && wallet.marks[t] >= 10) { use('buy', workEgg(t), '', t); wallet.marks[t] -= 10; egg = true; continue }
      if (g.mastery[t] < MASTERY_MAX && wallet.marks[t] >= masteryCost(g.mastery[t])) use('train', '', '', t)
    }
    if (!egg && wallet.gems >= 150) use('buy', 'rare-egg', '', 'rare')
    const megas = SPECIES[g.partner.form]?.m ?? []
    if (g.keyStone && megas.length && !g.partner.megas?.length) use('forge', '', g.partner.uid, megas[0])
  }
  if (uses.length) f.uses = uses
  // the day as it ended
  const a = foldGame(facts)
  const m = (months[Math.floor(i / 30)] ??= { xp: 0, coins: 0, gems: 0, bp: 0, marks: Object.fromEntries(MARK_TAGS.map((t) => [t, 0])), pillarDays: 0, perfect: 0, hearts: 0 })
  m.xp += a.today.xp; m.coins += a.wallet.coinsToday; m.gems += a.wallet.gemsToday; m.bp += a.wallet.bpToday
  for (const t of MARK_TAGS) m.marks[t] += a.wallet.marksToday[t]
  if (a.today.pillars > 0) m.pillarDays++
  if (a.today.perfect) m.perfect++
  m.hearts = a.trainer.hearts
  researchPts += a.research.today
  if (a.tier.v21 && a.tier.tier === 1) { tier1.days++; tier1.research += a.research.today }
  if (a.tier.v21 && a.tier.tier > 0) tierGems += DAY_GEMS[a.tier.tier] + FIRST_PILLAR.gems
  if (a.tier.v21) {
    tiers[a.tier.tier]++
    if (a.tier.tier === 0) choreDays.push({ xp: a.today.xp, coins: a.today.pay, wild: a.today.hit, leader: a.today.strike, research: a.research.today })
  }
  moms[a.momentum.mult] = (moms[a.momentum.mult] ?? 0) + 1
  if (megaDay === null && a.moments.some((x) => x.kind === 'mega')) megaDay = i + 1
  if ([6, 29, 89, 181].includes(i) || i === DAYS - 1) snaps.push({ day: i + 1, g: a })
}

const g = foldGame(facts)
const n = (k, what) => g.moments.filter((x) => x.kind === k && (!what || x.what === what)).length
const monthOf = (day) => Math.floor((Date.parse(day) - Date.parse(START)) / 86400000 / 30)
const per = (k) => { const out = months.map(() => 0); for (const x of g.moments) if (x.kind === k) out[monthOf(x.day)]++; return out }
const weeks = g.bossLog.length + (g.boss ? 1 : 0), kills = n('boss', 'kill')
const full = months.slice(0, Math.floor(DAYS / 30))
const avg = (f) => Math.round(full.reduce((s, x) => s + f(x), 0) / Math.max(1, full.length))
const chores = choreDays.length ? Object.fromEntries(Object.keys(choreDays[0]).map((k) => [k, Math.round(choreDays.reduce((s, d) => s + d[k], 0) / choreDays.length)])) : null
const totals = {
  pace: PACE, rules: V21 ? 'v21' : 'today', skip: SKIP || 'steady', pillar: SKIP ? SKIP_PILLAR : undefined, bounty: V21 ? `${BOUNTY.two},${BOUNTY.three}` : undefined, first: V21 ? `${FIRST_PILLAR.hearts},${FIRST_PILLAR.research},${FIRST_PILLAR.gems}` : undefined,
  xpWeek: Math.round(months.reduce((s, x) => s + x.xp, 0) / (DAYS / 7)), gemsMonth: avg((x) => x.gems), coinsMonth: avg((x) => x.coins),
  marks: Object.fromEntries(MARK_TAGS.map((t) => [t, months.reduce((s, x) => s + x.marks[t], 0)])),
  hatchedMonth: +(n('hatch') / (DAYS / 30)).toFixed(1), caughtMonth: +(n('catch') / (DAYS / 30)).toFixed(1), dupes: g.moments.filter((x) => (x.kind === 'catch' || x.kind === 'hatch') && x.dupe).length,
  box: g.queue.length, trained: g.graduates.length, heartsDay: +(g.trainer.hearts / DAYS).toFixed(1), research: g.research.rank, researchPts, tier1Research: tier1.days ? Math.round(tier1.research / tier1.days) : null,
  bossWin: weeks ? `${kills}/${weeks} (${Math.round((kills / weeks) * 100)}%)` : '-', megaDay, leaders: n('gym'), tiers: V21 ? tiers : undefined, momentum: moms,
}
// gems by source over the run (what can be told apart from the moments; "other" is evolutions, graduations, catches, perfect days, kit sets, level milestones taken as gems)
const gemsAll = months.reduce((s, x) => s + x.gems, 0)
const sumOf = (k) => g.moments.filter((x) => x.kind === k).reduce((s, x) => s + (x.gems ?? 0), 0)
const leaderGems = g.moments.filter((x) => x.kind === 'gym').reduce((s, x) => s + (V21 ? (isGym(x.league, x.slot) ? LEADER_GEMS_V21.gym : LEADER_GEMS_V21.elite) : isGym(x.league, x.slot) ? 20 : 30), 0) + n('league') * (V21 ? LEADER_GEMS_V21.league : 50)
const src = { tiers: tierGems, feats: sumOf('feat'), quests: sumOf('quest'), season: sumOf('season'), frontier: g.moments.filter((x) => x.kind === 'symbol').reduce((s, x) => s + (x.tier === 'gold' ? GOLD_GEMS : SILVER_GEMS), 0), leaders: leaderGems }
src.other = gemsAll - Object.values(src).reduce((s, x) => s + x, 0)
totals.gemsBySource = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, Math.round(v / (DAYS / 30))]))
// the floor test: weeks with at least one visible win (a catch, a hatch, a Lab rank, a leader, an evolution, a fully trained partner, a Mega, a level milestone, the boss at 25% or more)
const wk = (day) => Math.floor((Date.parse(day) - Date.parse(START)) / 86400000 / 7)
const winWeeks = new Set()
for (const x of g.moments) if (['catch', 'hatch', 'research', 'gym', 'evolve', 'graduate', 'mega'].includes(x.kind) || (x.kind === 'level' && x.level % 5 === 0)) winWeeks.add(wk(x.day))
for (const b of [...g.bossLog, ...(g.boss ? [{ week: g.boss.week, taken: g.boss.taken }] : [])]) if (b.taken >= 0.25) winWeeks.add(wk(b.week))
const allWeeks = Math.floor(DAYS / 7)
totals.floor = `${[...winWeeks].filter((w) => w < allWeeks).length}/${allWeeks}`
if (JSON_OUT) { console.log(JSON.stringify(totals)); process.exit(0) }

console.log(`# ${PACE} pace, ${DAYS} days from ${START}, ${V21 ? 'version 21 rules' : "today's rules"}${SKIP ? `, skipping ${SKIP_PILLAR} (${SKIP})` : ''}\n`)
console.log('month  XP      coins   gems  BP    marks code/gym/arbor/sleep  pillar-days perfect  catches eggs  Trainer hearts')
const catches = per('catch'), hatches = per('hatch')
months.forEach((m, k) => {
  if (k * 30 >= DAYS) return
  console.log(`${String(k + 1).padStart(5)}  ${String(m.xp).padEnd(7)} ${String(m.coins).padEnd(7)} ${String(m.gems).padEnd(5)} ${String(m.bp).padEnd(5)} ${[m.marks.code, m.marks.fitness, m.marks.arbor, m.marks.sleep].join('/').padEnd(27)} ${String(m.pillarDays).padEnd(11)} ${String(m.perfect).padEnd(8)} ${String(catches[k]).padEnd(8)} ${String(hatches[k]).padEnd(5)} ${m.hearts}`)
})
console.log('\nday  partner              fully trained  Box  leaders  regions  Lab           boss kills  wallet')
for (const { day, g: a } of snaps) {
  const k = a.moments.filter((x) => x.kind === 'boss' && x.what === 'kill').length
  console.log(`${String(day).padEnd(4)} ${`${nameOf(a.partner.form)} Lv ${a.level}`.padEnd(20)} ${String(a.graduates.length).padEnd(14)} ${String(a.queue.length).padEnd(4)} ${String(a.moments.filter((x) => x.kind === 'gym').length).padEnd(8)} ${String(a.regions).padEnd(8)} ${`rank ${a.research.rank} ${a.research.points}/${a.research.need}`.padEnd(13)} ${String(k).padEnd(11)} ${a.wallet.coins} coins, ${a.wallet.gems} gems, ${a.wallet.bp} BP`)
}
console.log(`\nboss: ${weeks} weeks with a card, ${kills} beaten (${totals.bossWin}), best ${Math.round(Math.max(0, ...g.bossLog.map((b) => b.taken)) * 100)}% of its HP`)
console.log(`hearts a day: ${totals.heartsDay} (Trainer hearts ${g.trainer.hearts}, level ${g.trainer.level})`)
console.log(`Pokemon: ${n('catch')} caught, ${n('hatch')} hatched, ${totals.dupes} of them seconds turned into hearts; Box ${g.queue.length}, fully trained ${g.graduates.length}; first Mega ${megaDay ? `day ${megaDay}` : 'none'}; Max/Dynamax days ${g.counters.dynamax ?? 0}`)
if (V21) console.log(`tiers (chores only / 1 / 2 / 3 / Max): ${tiers.join(' / ')}; momentum days by multiplier ${JSON.stringify(moms)}`)
console.log(`gems a month by source: ${JSON.stringify(totals.gemsBySource)}; weeks with a visible win ${totals.floor}`)
if (chores) console.log(`a chores-only day (${choreDays.length} of them): ${chores.xp} XP, ${chores.coins} coins, ${chores.wild} HP off the wild Pokemon, ${chores.leader} off the leader, ${chores.research} research`)
console.log(`partners: ${g.moments.filter((x) => x.kind === 'evolve' || x.kind === 'graduate' || x.kind === 'partner').map((x) => `${x.day.slice(5)} ${x.kind} ${nameOf(x.form)}`).join(', ')}`)
const lead = leaderOf(g.league.index, g.league.slot)
console.log(`now: ${lead ? `${lead.name} ${g.league.hp}/${g.league.max}` : 'no leader'}; wild ${g.wild ? nameOf(g.wild.form) : '-'}; momentum x${g.momentum.mult}`)
