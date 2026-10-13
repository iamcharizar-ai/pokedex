import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, baseline, emptyVitals, foldVitals, recovery, sleepParts, sleepScore, sleepScoreOn, sleptEnough, sleptOnTime, steadiness, type LedgerEvent } from './model.ts'

const ev = (day: string, payload: LedgerEvent['payload'], at = `${day}T09:00:00.000Z`, device = 'sync'): LedgerEvent =>
  ({ device, at, day, type: 'vitals', payload })

test('fields merge per day; the newest write of each field wins; replay changes nothing', () => {
  const a = ev('2026-10-03', { steps: 4000, sleepMin: 360 }, '2026-10-03T09:00:00.000Z')
  const b = ev('2026-10-03', { steps: 9000 }, '2026-10-03T21:00:00.000Z')
  const c = ev('2026-10-03', { weightKg: 71.4 }, '2026-10-03T07:00:00.000Z', 'manual')
  const s = foldVitals(emptyVitals(), [b, a, c])
  assert.deepEqual(s.days['2026-10-03'], { steps: 9000, sleepMin: 360, weightKg: 71.4 })
  assert.equal(foldVitals(s, [a, b, c]), s)
})

test('absent is not zero, a real zero is kept, null takes a reading back', () => {
  let s = foldVitals(emptyVitals(), [ev('2026-10-03', { steps: 0 })])
  assert.equal(s.days['2026-10-03'].steps, 0)
  assert.equal(s.days['2026-10-03'].sleepMin, undefined)
  assert.equal(s.days['2026-10-02'], undefined)
  s = foldVitals(s, [ev('2026-10-03', { steps: null }, '2026-10-03T22:00:00.000Z')])
  assert.equal('steps' in s.days['2026-10-03'], false)
})

test('junk is ignored: wrong type, unknown field, other event types', () => {
  const s = foldVitals(emptyVitals(), [
    ev('2026-10-03', { steps: 'many', mood: 5, bed: 12 }),
    { ...ev('2026-10-03', { steps: 5 }), type: 'tick' },
  ])
  assert.deepEqual(s.days, {})
})

test('a night belongs to the evening it started on', () => {
  const s = foldVitals(emptyVitals(), [
    ev('2026-10-04', { bed: '2026-10-03T22:10', wake: '2026-10-04T06:00', sleepMin: 455 }),
    ev('2026-10-05', { bed: '2026-10-05T02:10', wake: '2026-10-05T08:10', sleepMin: 360 }),
  ])
  assert.equal(sleptOnTime(s, '2026-10-03'), true)
  assert.equal(sleptEnough(s, '2026-10-03'), true)
  assert.equal(sleptOnTime(s, '2026-10-04'), false) // asleep at 2 am: after midnight
  assert.equal(sleptEnough(s, '2026-10-04'), false)
  assert.equal(sleptOnTime(s, '2026-10-05'), null) // nothing measured is not a miss
  assert.equal(sleptOnTime(s, '2026-10-03', { bedBy: '22:00', minutes: 450 }), false)
})

test('sleep score: length, depth, continuity; null without data', () => {
  assert.equal(sleepScore(undefined), null)
  assert.equal(sleepScore({ steps: 100 }), null)
  assert.equal(sleepScore({ sleepMin: 450, awakeMin: 30, deepMin: 90, remMin: 100 }), 100)
  const short = sleepScore({ sleepMin: 360, awakeMin: 30, deepMin: 60, remMin: 70 }) as number
  assert.ok(short > 60 && short < 90, String(short))
  assert.equal(sleepScore({ sleepMin: 225 }), 50) // duration only: every part scales with length
})

test('baseline needs a week; recovery compares against it', () => {
  const evs: LedgerEvent[] = []
  for (let i = 1; i <= 6; i++) evs.push(ev(addDays('2026-10-20', -i), { hrv: 50, restingHr: 60 }))
  let s = foldVitals(emptyVitals(), evs)
  assert.equal(baseline(s, 'hrv', '2026-10-20'), null)
  assert.equal(recovery(s, '2026-10-20'), null)
  s = foldVitals(s, [ev(addDays('2026-10-20', -7), { hrv: 50, restingHr: 60 })])
  assert.equal(baseline(s, 'hrv', '2026-10-20'), 50)
  const normal = foldVitals(s, [ev('2026-10-20', { hrv: 50, restingHr: 60, sleepMin: 450, awakeMin: 30, deepMin: 90, remMin: 100 })])
  const good = foldVitals(s, [ev('2026-10-20', { hrv: 60, restingHr: 54, sleepMin: 450, awakeMin: 30, deepMin: 90, remMin: 100 })])
  const bad = foldVitals(s, [ev('2026-10-20', { hrv: 40, restingHr: 66, sleepMin: 300 })])
  const [n, g, b] = [normal, good, bad].map((x) => recovery(x, '2026-10-20') as number)
  assert.ok(g === 100 && n > b && n < g, `${b} ${n} ${g}`)
})

test('steadiness: against your own usual bedtime, across midnight, and only once there is a usual', () => {
  const night = (d: string, bed: string, over: Record<string, number> = {}) => ev(d, { bed, sleepMin: 450, awakeMin: 30, deepMin: 90, remMin: 100, ...over })
  const usual = ['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => night(d, `${addDays(d, -1)}T23:50`))
  const at = (bed: string) => foldVitals(emptyVitals(), [...usual, night('2026-10-04', bed)])
  // two earlier nights are not yet a usual
  assert.equal(steadiness(foldVitals(emptyVitals(), [...usual.slice(0, 2), night('2026-10-04', '2026-10-03T23:50')]), '2026-10-04'), null)
  assert.equal(steadiness(at('2026-10-03T23:50'), '2026-10-04'), 1)
  assert.equal(steadiness(at('2026-10-04T00:10'), '2026-10-04'), 1) // 20 minutes later, across midnight
  assert.equal(steadiness(at('2026-10-04T00:35'), '2026-10-04'), 1) // 45 minutes: still full
  assert.equal(Math.round((steadiness(at('2026-10-04T01:05'), '2026-10-04') as number) * 100), 60) // 75 minutes off
  assert.equal(steadiness(at('2026-10-04T02:30'), '2026-10-04'), 0) // 160 minutes off
  // the clock itself is not judged: a usual of 02:00 and a night at 02:00 are the same night
  const late = ['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => night(d, `${d}T02:00`))
  assert.equal(steadiness(foldVitals(emptyVitals(), [...late, night('2026-10-04', '2026-10-04T02:00')]), '2026-10-04'), 1)
  // it is a fifth of the score: everything else perfect, a night far off its usual scores 80
  assert.equal(sleepScoreOn(at('2026-10-04T02:30'), '2026-10-04'), 80)
  assert.equal(sleepScoreOn(at('2026-10-03T23:50'), '2026-10-04'), 100)
  // no usual yet: it takes the share of the time asleep, so the score is as before
  assert.equal(sleepScore({ sleepMin: 450, awakeMin: 30, deepMin: 90, remMin: 100 }), 100)
  assert.deepEqual(sleepParts({ sleepMin: 225 }), { length: 0.5, depth: null, unbroken: null, steady: null })
})
