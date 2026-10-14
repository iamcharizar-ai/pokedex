// Canned ledgers, so every screen can be seen without your real data.
//
//   ?fixture=empty   a new device: nothing ticked yet
//   ?fixture=week    eleven ordinary days: a wild Pokemon half worn down, rewards to collect
//   ?fixture=late    five months in: evolutions, trained Pokemon, feats, an egg, a chest
//   ?fixture=boss    a full party in a boss week, with the boss weak enough to throw at
//   add &band=<score> to give any of them a band: fourteen measured nights, the last one scoring that (0 to 100)
//   add &news to any of them to have everything recent told again (reveals, toasts, chests)
//
// A fixture is a list of ordinary ledger events (a habit library, ticks, things
// bought and used) and a date to treat as today. The game is folded from it
// exactly as it is from the real ledger, so a fixture cannot show a state the
// rules cannot reach. While one is loaded the ledger is switched off and this
// device's own memory is kept apart (lib/fixture-boot.ts): nothing is read from
// or written to your real game.
//
// Pure TypeScript with no browser in it, so tools/fixtures.test.mjs can fold
// every fixture and fail when a rules change leaves one showing nothing.
import { BOSS_DAY_EVENT, CARD_EVENT, type BossCard } from '../../core/boss.ts'
import { rng } from '../../core/economy.ts'
import { USE_EVENT } from '../../core/events.ts'
import { addDays, mondayOf } from '../../core/facts.ts'
import { GAME_START } from '../../core/rules.ts'
import type { LedgerEvent } from '../linked/arbor-model.ts'

export const FIXTURES = ['empty', 'week', 'late', 'boss'] as const
export type FixtureName = (typeof FIXTURES)[number]
export interface Fixture {
  name: FixtureName
  /** the day the app treats as today */
  today: string
  /** what it is for, in a line */
  note: string
  config: LedgerEvent
  events: LedgerEvent[]
}

const DEVICE = 'fixture'
const PILLARS = ['leetcode-coding', 'gym', 'woodshed-guitar', 'arbor-morning']
const SLEEP = 'sleep-before-10'
const CHORES = ['make-bed', 'drink-water', 'read-20', 'tidy-desk', 'floss', 'stretch', 'journal', 'vitamins', 'walk', 'plan-tomorrow']
const HABITS = [
  { id: 'leetcode-coding', name: 'LeetCode', emoji: '💻', tier: 'pillar' },
  { id: 'gym', name: 'Gym', emoji: '🏋️', tier: 'pillar' },
  { id: 'woodshed-guitar', name: 'Woodshed', emoji: '🎸', tier: 'pillar' },
  { id: 'arbor-morning', name: 'Arbor', emoji: '🌳', tier: 'pillar' },
  { id: SLEEP, name: 'Sleep by 10', emoji: '🌙', tier: 'core' },
  ...CHORES.map((id, i) => ({ id, name: id.replace(/-/g, ' '), emoji: '•', tier: i < 3 ? 'standard' : 'basic' })),
]

const at = (day: string, hour: number, min = 0): string => `${day}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`
const ev = (type: string, day: string, payload: LedgerEvent['payload'], hour = 12, min = 0): LedgerEvent => ({ device: DEVICE, at: at(day, hour, min), day, type, payload })
const config = (): LedgerEvent => ev('config', GAME_START, { habits: JSON.stringify(HABITS.map((h) => ({ ...h, spans: [{ from: '1970-01-01', to: null }] }))) }, 0)
const tick = (day: string, id: string, n: number): LedgerEvent => ev('tick', day, { habitId: id, at: at(day, 7 + (n % 14), (n * 7) % 60) }, 7 + (n % 14), (n * 7) % 60)
const use = (day: string, what: string, item: string, to?: string, hour = 20): LedgerEvent => ev(USE_EVENT, day, { ...(item ? { item } : {}), uid: '', what, ...(to ? { to } : {}), n: `${day}${what}${item}` }, hour)

/** One day's ticks: how many pillars (in order), whether sleep, and what share of the chores. */
function day(d: string, pillars: number, sleep: boolean, chores: number): LedgerEvent[] {
  const ids = [...PILLARS.slice(0, pillars), ...(sleep ? [SLEEP] : []), ...CHORES.slice(0, Math.round(CHORES.length * chores))]
  return ids.map((id, n) => tick(d, id, n))
}
/** `n` days from the start, each shaped by a seeded roll so a fixture is the same every time it is built. */
function days(n: number, seed: string, shape: (r: number, i: number) => [number, boolean, number]): LedgerEvent[] {
  const r = rng(seed)
  const out: LedgerEvent[] = []
  for (let i = 0; i < n; i++) out.push(...day(addDays(GAME_START, i), ...shape(r(), i)))
  return out
}

function week(): Fixture {
  const n = 10
  const today = addDays(GAME_START, n)
  const events = days(n, 'fixture:week', (r, i) => (i === 3 ? [0, false, 0.2] : r < 0.25 ? [1, false, 0.5] : r < 0.7 ? [2, true, 0.7] : [3, true, 0.9]))
  // today so far: two pillars and most of the chores, so the scene has something happening
  events.push(...day(today, 2, false, 0.6))
  return { name: 'week', today, note: 'Eleven ordinary days: a wild Pokemon half worn down, rewards waiting in Collect.', config: config(), events }
}

function late(): Fixture {
  const n = 150
  const today = addDays(GAME_START, n)
  const events = days(n, 'fixture:late', (r, i) => (i % 23 === 11 ? [0, false, 0] : r < 0.12 ? [1, true, 0.6] : r < 0.45 ? [2, true, 0.8] : r < 0.8 ? [3, true, 0.9] : [4, true, 1]))
  // things done by hand along the way: a chest and an egg from the Rare shop, a berry fed, rewards collected each week
  for (let i = 30; i < n; i += 20) events.push(use(addDays(GAME_START, i), 'buy', 'chest', 'rare'))
  events.push(use(addDays(GAME_START, n - 4), 'buy', 'rare-egg', 'rare'))
  events.push(use(addDays(GAME_START, n - 1), 'buy', 'chest', 'rare', 21))
  events.push(...day(today, 3, true, 0.8))
  return { name: 'late', today, note: 'Five months in: evolutions, trained Pokemon, feats, an egg warming, a chest just opened.', config: config(), events }
}

function boss(): Fixture {
  // long enough for a full party, then into the Wednesday of a boss week
  const monday = addDays(mondayOf(addDays(GAME_START, 420)), 7)
  const today = addDays(monday, 2)
  const n = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(GAME_START + 'T12:00:00Z')) / 86400000)
  const events = days(n, 'fixture:boss', (r, i) => (i % 31 === 17 ? [1, false, 0.4] : r < 0.25 ? [3, true, 0.9] : [4, true, 1]))
  events.push(...day(today, 3, true, 0.8))
  const card: BossCard = {
    week: monday, species: 'dratini', form: 'dragonite', rarity: 'R', mega: false, level: 62,
    tasks: [
      { kind: 'gym', template: 'volume', target: 42, share: 0.3, text: 'Log 42 sets in Strong this week' },
      { kind: 'arbor', template: 'spread', target: 4, share: 0.25, items: ['l-sit', 'crow-pose', 'wall-handstand'], text: 'Practise L sit, Crow pose and Wall handstand on four days each' },
      { kind: 'shed', template: 'clean', target: 3, share: 0.2, items: ['alt-picking-1', 'pentatonic-box-1'], text: 'Log Alternate picking and Pentatonic box 1 Clean on three days each' },
      { kind: 'sleep', template: 'score', target: 4, share: 0.15, text: 'Four nights at 80 or more' },
      { kind: 'life', template: 'steady', target: 4, share: 0.1, text: 'Four days with three-quarters of your habits ticked' },
    ],
  }
  events.push(ev(CARD_EVENT, monday, { card: JSON.stringify(card) }, 6))
  const progress = [[0.35, 0.33, 0.33, 0.25, 0.25], [0.7, 0.6, 0.67, 0.5, 0.5], [1, 0.83, 0.83, 0.75, 0.75]]
  progress.forEach((p, i) => events.push(ev(BOSS_DAY_EVENT, addDays(monday, i), { p: JSON.stringify(p) }, 22)))
  return { name: 'boss', today, note: 'A full party in a boss week: three days of work on the card, and the boss weak enough to throw at.', config: config(), events }
}

const empty = (): Fixture => ({ name: 'empty', today: addDays(GAME_START, 9), note: 'A new device: a habit library and nothing ticked.', config: config(), events: [] })

const BUILD: Record<FixtureName, () => Fixture> = { empty, week, late, boss }
export const isFixture = (x: string | null | undefined): x is FixtureName => typeof x === 'string' && (FIXTURES as readonly string[]).includes(x)
/** Fourteen nights a band measured, the last (this morning's) scoring `last`: Sleep becomes a pillar paid by the score, and the Last night section has something to show. */
function withBand(f: Fixture, last: number): Fixture {
  const events = [...f.events]
  for (let i = 0; i < 14; i++) {
    const day = addDays(f.today, i - 13)
    const score = i === 13 ? last : [84, 71, 92, 66, 88, 79, 95, 58, 83, 90, 74, 86, 81][i]
    const sleepMin = Math.round(300 + score * 2.4)
    const deepMin = Math.round(sleepMin * 0.17), remMin = Math.round(sleepMin * 0.22), awakeMin = 24 + (100 - score)
    events.push(ev('vitals', day, { sleepScore: score, sleepMin, deepMin, remMin, lightMin: sleepMin - deepMin - remMin, awakeMin, bed: `${addDays(day, -1)}T22:${String(10 + (i * 7) % 40)}`, wake: `${day}T0${5 + (i % 3)}:${String((i * 11) % 60).padStart(2, '0')}` }, 7))
  }
  return { ...f, events }
}
export const fixture = (name: string | null | undefined, band?: string | null): Fixture | null => {
  if (!isFixture(name)) return null
  const f = BUILD[name]()
  const score = band === null || band === undefined || band === '' ? NaN : Number(band)
  return Number.isFinite(score) ? withBand(f, Math.max(0, Math.min(100, Math.round(score)))) : f
}
