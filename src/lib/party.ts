// Moving someone in the party: the one place that decides what a move means.
//
// The party is six places. Place 0 is the partner; places 1 to 5 are the team, in the order the
// `team` event holds them, and any of them can be left open (TEAM_HOLE). Everyone else owned is the
// lab. Every way of moving (a card's menu, the role buttons on a Pokemon's page, dragging) asks
// planMove for a plan and hands it to applyPlan in Team.tsx, so they cannot disagree. A plan is the
// same two events the game already folds:
//   lead  {uid}        : this one becomes the partner, and the partner goes to the lab
//   team  {to: a,-,c}  : who stands in places 1 to 5, in order, "-" for an open place
// An open place stays open until the app fills it (planFill, after an hour nobody put anyone there):
// the fold does not fill a list that has a hole in it.
import { nameOf, type Game, type Mon } from '../../core/fold.ts'
import { MAX_LEVEL, RESEARCH_SLOTS, TEAM_HOLE, TEAM_SIZE, levelOf } from '../../core/rules.ts'

export const PLACES = TEAM_SIZE + 1
/** How long a place may stay open before the app fills it from the lab. */
export const FILL_AFTER_MS = 60 * 60 * 1000

/** The part of the game a move reads. */
export type PartyState = Pick<Game, 'partner' | 'teamSlots' | 'queue' | 'graduates' | 'v14'>
export type Target = { slot: number } | 'lab'
export interface Op { what: 'lead' | 'team' | 'study'; uid: string; to?: string }
export type Plan = { ok: true; ops: Op[]; note?: string } | { ok: false; why: string }

const ok = (ops: Op[], note?: string): Plan => ({ ok: true, ops, note })
const no = (why: string): Plan => ({ ok: false, why })

/** The six places in order: the partner, then the team, null for an open place. */
export const placesOf = (g: PartyState): (Mon | null)[] => [g.partner, ...g.teamSlots]

/** Who is in the party, the partner included. */
const inParty = (g: PartyState): Mon[] => placesOf(g).filter((m): m is Mon => m !== null)

/** Everyone owned who is not in the party, the oldest first (My Pokemon in the order the fold fills from, then the fully trained). */
export function labOf(g: PartyState): Mon[] {
  const taken = new Set(inParty(g).map((m) => m.uid))
  return [...g.queue, ...g.graduates].filter((m) => !taken.has(m.uid))
}

/** Can this one lead? Anyone in My Pokemon; a fully trained one only below the last level (version 14). */
export function canLead(g: PartyState, m: Mon): string | null {
  if (m.uid === g.partner.uid) return null
  if (g.queue.some((x) => x.uid === m.uid)) return null
  if (g.v14 && g.graduates.some((x) => x.uid === m.uid)) return levelOf(m.xp) >= MAX_LEVEL ? 'Level 100: it has nothing left to learn as a partner' : null
  return 'Only someone still being raised can lead'
}

/** Is any team place open? */
export const hasOpen = (g: PartyState): boolean => g.teamSlots.some((m) => m === null)

/** Where "put it in the party" goes with no place chosen: the first open place, else the last. */
export const nextPlace = (g: PartyState): number => {
  const i = g.teamSlots.findIndex((m) => m === null)
  return i >= 0 ? i + 1 : PLACES - 1
}

const teamOp = (slots: (string | null)[]): Op => ({ what: 'team', uid: '', to: slots.map((id) => id ?? TEAM_HOLE).join(',') })

export function planMove(g: PartyState, uid: string, to: Target): Plan {
  const places = placesOf(g)
  const from = places.findIndex((m) => m?.uid === uid)
  const mon = from >= 0 ? places[from] : labOf(g).find((m) => m.uid === uid)
  if (!mon) return no('That Pokemon is not here any more')
  const slots = g.teamSlots.map((m) => m?.uid ?? null)

  if (to === 'lab') {
    if (from < 0) return ok([])
    if (from === 0) return no('The partner stays. Put someone else on the Partner place to take over.')
    slots[from - 1] = null
    return ok([teamOp(slots)], `${nameOf(mon.form)} is back in the lab. The place stays open.`)
  }

  const s = to.slot
  if (!Number.isInteger(s) || s < 0 || s >= PLACES) return no('There is no such place')
  if (s === from) return ok([])

  if (s === 0) {
    const why = canLead(g, mon)
    if (why) return no(why)
    // the new partner leaves its place (or the lab); the old partner stands where it stood, or goes to the lab
    if (from > 0) slots[from - 1] = g.partner.uid
    return ok([{ what: 'lead', uid }, teamOp(slots)])
  }

  if (from === 0) {
    // the partner onto a team place swaps with whoever stands there: that one leads instead
    const there = g.teamSlots[s - 1]
    if (!there) return no('The partner needs someone to take over: put a card on the Partner place instead.')
    return planMove(g, there.uid, { slot: 0 })
  }

  // lab to a place, or a place to a place: whoever is there swaps; an open place just takes it and leaves its own open
  const there = slots[s - 1]
  slots[s - 1] = uid
  if (from > 0) slots[from - 1] = there
  return ok([teamOp(slots)])
}

/** The plan that fills every open place from the lab, the oldest first, or null when there is nothing to fill or nobody to fill with. */
export function planFill(g: PartyState): Plan | null {
  const pool = labOf(g)
  if (!hasOpen(g) || pool.length === 0) return null
  const slots = g.teamSlots.map((m) => m?.uid ?? null)
  let next = 0
  const filled: string[] = []
  for (let i = 0; i < slots.length && next < pool.length; i++) {
    if (slots[i] === null) { slots[i] = pool[next].uid; filled.push(nameOf(pool[next].form)); next += 1 }
  }
  return ok([teamOp(slots)], `${filled.join(' and ')} filled the empty ${filled.length > 1 ? 'places' : 'place'} on its own`)
}

// ── the Professor's desk: the same idea for research ────────────────────────
// Up to RESEARCH_SLOTS stand on the desk (the order does not matter); everyone else not in the party is
// in the box. A move writes one `study` event holding the whole desk.
export type DeskState = PartyState & { research: { desk: Mon[] } }

/** Everyone not in the party and not on the desk. */
export function boxOf(g: DeskState): Mon[] {
  const on = new Set(g.research.desk.map((m) => m.uid))
  return labOf(g).filter((m) => !on.has(m.uid))
}

export function planDesk(g: DeskState, uid: string, to: Target): Plan {
  const ids = g.research.desk.map((m) => m.uid)
  const from = ids.indexOf(uid)
  if (from < 0 && !boxOf(g).some((m) => m.uid === uid)) return no('That Pokemon cannot go on the desk: the party is not studied, only the lab')
  const study = (next: string[]): Plan => ok([{ what: 'study', uid: '', to: next.join(',') }])
  if (to === 'lab') return from < 0 ? ok([]) : study(ids.filter((id) => id !== uid))
  const s = to.slot
  if (!Number.isInteger(s) || s < 0 || s >= RESEARCH_SLOTS) return no('There is no such place on the desk')
  if (s === from) return ok([])
  const next = [...ids]
  if (from >= 0) {
    if (s < next.length) [next[from], next[s]] = [next[s], next[from]]
    else { next.splice(from, 1); next.push(uid) }
  } else if (s < next.length) next[s] = uid
  else next.push(uid)
  return study(next)
}
