// What of a game is compared against core/fixtures/golden.json: everything the
// old rules decided, and nothing a later version added on top.
import type { Game, Mon } from './fold.ts'

const mon = (m: Mon) => ({ uid: m.uid, base: m.base, form: m.form, xp: m.xp, shiny: m.shiny, origin: m.origin, from: m.from, started: m.started, graduated: m.graduated, bond: m.bond, path: m.path, mega: m.mega, pick: m.pick })

export function golden(g: Game): unknown {
  return JSON.parse(JSON.stringify({
    partner: mon(g.partner), level: g.level, into: g.into, need: g.need, next: g.next, lean: g.lean, display: g.display, aura: g.aura, asleep: g.asleep,
    queue: g.queue.map(mon), nextUp: g.nextUp, graduates: g.graduates.map(mon), dex: g.dex, days: g.days, momentum: g.momentum, perfectDays: g.perfectDays,
    badges: g.badges, regions: g.regions, league: { ...g.league, rust: undefined }, hall: g.hall, bag: g.bag, stats: g.stats, moments: g.moments, wild: g.wild,
  }))
}
