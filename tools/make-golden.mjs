// Writes core/fixtures/golden.json: a fixed run of days and what the game made
// of them under rules versions 1 and 3. fold.test.ts folds the same days and
// compares, so a later rules version cannot quietly change what earlier days were.
//
//   node tools/make-golden.mjs
//
// Run it ONLY to record history that is meant to stand (it was run once, on
// version 3, before version 4 was written). Running it again after a change to
// the old rules would bless that change.
import fs from 'node:fs'
import path from 'node:path'
import { addDays } from '../core/facts.ts'
import { foldGame } from '../core/fold.ts'
import { GAME_START } from '../core/rules.ts'
import { golden } from '../core/golden.ts'

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
  ['leetcode-coding', 'code', 100], ['gym', 'fitness', 100], ['woodshed-guitar', 'guitar', 100], ['arbor-morning', 'arbor', 100], ['sleep-before-10', 'sleep', 30],
  ...Array.from({ length: 4 }, (_, i) => ['std' + i, 'routine', 3]), ...Array.from({ length: 8 }, (_, i) => ['b' + i, 'routine', 1]),
]
const DAYS = 240
const r = rng(20261007)
const facts = []
for (let i = 0; i < DAYS; i++) {
  // good weeks, a week off now and then, and the odd perfect day
  const off = Math.floor(i / 7) % 9 === 6
  const perfect = !off && r() < 0.12
  const habits = LIST.map(([id, tag, worth]) => {
    const p = perfect ? 1 : off ? 0.1 : worth === 100 ? 0.8 : 0.7
    const done = r() < p
    // the two blocks are sometimes half done
    const frac = done ? 1 : (id === 'arbor-morning' || id === 'woodshed-guitar') && r() < 0.3 ? 0.5 : 0
    return { id, tag, worth, pillar: worth === 100, frac, done }
  })
  facts.push({ day: addDays(GAME_START, i), habits })
}
const OLD = { v4From: '9999-01-01' }
// spend what version 3 lets you spend: a free choice of who is next, a Mega, a change of partner
const first = foldGame(facts, OLD)
const at = (n) => facts[n].day
const stoneDay = facts.findIndex((f) => first.moments.some((m) => m.kind === 'item' && m.day <= f.day))
const uses = []
if (stoneDay >= 0) {
  const then = foldGame(facts.slice(0, stoneDay + 2), OLD)
  const stone = Object.keys(then.bag).find((k) => then.bag[k] > 0)
  if (then.queue[1]) uses.push({ n: stoneDay + 1, item: '', uid: then.queue[1].uid, what: 'next' })
  if (stone && then.queue[0]) uses.push({ n: stoneDay + 1, item: stone, uid: then.queue[0].uid, what: 'lead' })
}
const megaDay = facts.findIndex((f, i) => i > stoneDay + 5 && (() => { const g = foldGame(facts.slice(0, i + 1).map((x, k) => ({ ...x, uses: uses.filter((u) => u.n === k).map(({ n, ...u }) => ({ ...u, day: at(n) })) })), OLD); return Object.values(g.bag).some((v) => v > 0) && g.partner.form !== g.partner.base })())
for (const u of uses) (facts[u.n].uses ??= []).push({ day: at(u.n), item: u.item, uid: u.uid, what: u.what })
if (megaDay >= 0) {
  const g = foldGame(facts.slice(0, megaDay + 1), OLD)
  const stone = Object.keys(g.bag).find((k) => g.bag[k] > 0)
  ;(facts[megaDay].uses ??= []).push({ day: at(megaDay), item: stone, uid: g.partner.uid, what: 'mega' })
}

const out = { facts, expected: golden(foldGame(facts, OLD)) }
const file = path.resolve(import.meta.dirname, '../core/fixtures/golden.json')
fs.mkdirSync(path.dirname(file), { recursive: true })
fs.writeFileSync(file, JSON.stringify(out))
const g = foldGame(facts, OLD)
console.log(`${DAYS} days · ${g.moments.length} moments · ${g.graduates.length} trained · ${g.moments.filter((m) => m.kind === 'gym').length} leaders · ${g.moments.filter((m) => m.kind === 'use').length} stones spent · written to ${file}`)
