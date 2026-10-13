// The logic behind the Journey calendar and the first-run tour.
//   node --test tools/screens.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarOf, levelOf } from '../src/screens/calendar.ts'
import { shouldTour } from '../src/screens/tour.ts'
import { hpTone } from '../src/screens/hp.ts'

const day = (d, o = {}) => ({ day: d, base: 0, mult: 1, xp: 0, pillars: 0, pillarTotal: 4, done: 0, total: 10, counts: false, perfect: false, share: 0, ticked: 0, ball: 'poke', hit: 0, strike: 0, pay: 0, ...o })

test('a day is shaded by what it held', () => {
  assert.equal(levelOf(day('x')), 0)
  assert.equal(levelOf(day('x', { ticked: 0.3 })), 1)
  assert.equal(levelOf(day('x', { pillars: 1 })), 2)
  assert.equal(levelOf(day('x', { pillars: 2 })), 3)
  assert.equal(levelOf(day('x', { pillars: 4 })), 4)
})

test('twelve weeks of seven, Monday first, the newest week ending with today', () => {
  // 2026-10-14 is a Wednesday; its Monday is the 12th
  const days = ['2026-10-12', '2026-10-13', '2026-10-14'].map((d, i) => day(d, { pillars: i + 1, xp: 100, counts: i > 0, perfect: i === 2, ticked: 1 }))
  const cal = calendarOf(days, '2026-10-14', new Set(['2026-10-12']))
  assert.equal(cal.weeks.length, 12)
  assert.ok(cal.weeks.every((w) => w.cells.length === 7))
  const last = cal.weeks[11]
  assert.equal(last.monday, '2026-10-12')
  assert.equal(last.boss, true)
  assert.equal(cal.weeks[10].boss, false)
  assert.deepEqual(last.cells.slice(0, 3).map((c) => c.level), [2, 3, 4])
  assert.equal(last.cells[3].level, null, 'tomorrow is not part of it')
  assert.ok(last.cells[2].today && last.cells[2].perfect)
  assert.deepEqual([cal.counting, cal.perfect, cal.xp], [2, 1, 300])
  assert.equal(cal.weeks[0].cells[0].level, null, 'before the game began')
  assert.match(last.cells[1].label, /2 of 4 pillars.*counting day/)
  assert.match(last.cells[3].label, /to come/)
})

test('an empty game is twelve weeks of nothing, not a crash', () => {
  const cal = calendarOf([], '2026-10-14', new Set())
  assert.equal(cal.weeks.length, 12)
  assert.deepEqual([cal.counting, cal.perfect, cal.xp], [0, 0, 0])
})

test('the tour is for a game that has not started, once, unless asked for', () => {
  assert.equal(shouldTour(null, false, true), true)
  assert.equal(shouldTour(null, true, true), false, 'seen once, not again')
  assert.equal(shouldTour(null, false, false), false, 'a game with history is not welcomed')
  assert.equal(shouldTour('1', true, false), true, '?tour=1 forces it')
  assert.equal(shouldTour('0', false, true), false, '?tour=0 forbids it')
})

test('one place decides where an HP bar turns amber and red', () => {
  assert.equal(hpTone(1), '')
  assert.equal(hpTone(0.51), '')
  assert.equal(hpTone(0.5), 'mid')
  assert.equal(hpTone(0.21), 'mid')
  assert.equal(hpTone(0.2), 'low')
  assert.equal(hpTone(0), 'low')
})

test('Life OS runs the same motion kit as the Pokedex', async () => {
  const fs = await import('node:fs')
  const life = new URL('../../lifeos/src/ui-kit/', import.meta.url)
  if (!fs.existsSync(life)) return
  const read = (u) => fs.readFileSync(u, 'utf8').replace(/\r\n/g, '\n')
  for (const [mine, theirs] of [['../src/lib/motion.js', 'motion.js'], ['../src/lib/motion.d.ts', 'motion.d.ts']])
    assert.equal(read(new URL(mine, import.meta.url)), read(new URL(theirs, life)), `${theirs} differs: run npm run kit`)
  const css = read(new URL('motion-tokens.css', life))
  for (const t of ['--t-fade', '--t-slide', '--t-pop', '--t-breathe', '--ease-out', '--ease-in', '--ease-in-out']) assert.ok(css.includes(t + ':'), `${t} is not in Life OS's motion-tokens.css: run npm run kit`)
})
