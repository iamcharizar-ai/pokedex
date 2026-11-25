// The Forge as a state machine (FORGE-EXPERIENCE.md section 4). Pure: no screen, no game state; the screen gives it what the player holds and draws what it says.
//
//   idle  -> chosen   a Mega is picked: its recipe is on the tray, the three sockets wait
//   chosen -> armed   the third shard is placed: the shards float, the Key Stone may go in
//   armed -> committed  the Key Stone is placed: the forge is paid and written (the sequence is only the show)
//   committed -> reveal  the sequence ends: the Mega Stone floats, waiting to be tapped
//   reveal -> rest    the stone is collected; the Key Stone stays where it is, resting in the centre
//   rest -> idle      the player takes the Key Stone back, themselves
//
// Placing and lifting shards back is free until the commit. Sockets run clockwise from the top: 0 top, 1 bottom right, 2 bottom left (as in sprites/forge/altar.json).
import { fitsRecipe } from '../../../core/v23.ts'

export const COMET = 'comet-shard'
export const SOCKETS = 3

export type Phase = 'idle' | 'chosen' | 'armed' | 'committed' | 'reveal' | 'rest'
export interface Pick { uid: string; form: string }
export interface ForgeState {
  phase: Phase
  pick: Pick | null
  /** the three shard colours the stone needs */
  recipe: string[]
  /** the shard kind placed in each socket, or null */
  sockets: (string | null)[]
}
export const idle = (): ForgeState => ({ phase: 'idle', pick: null, recipe: [], sockets: [null, null, null] })

export type Refusal = 'wrong-step' | 'no-pick' | 'bad-socket' | 'socket-taken' | 'full' | 'not-in-recipe' | 'not-held' | 'no-key-stone' | 'no-coins'
export type Action =
  | { t: 'choose'; pick: Pick; recipe: readonly string[] }
  | { t: 'place'; kind: string; /** left out: the first empty socket */ socket?: number; /** how many of each shard the player holds */ held: Readonly<Record<string, number>> }
  | { t: 'lift'; socket: number }
  | { t: 'commit'; keyStone: boolean; coins: number; fee: number }
  | { t: 'revealed' }
  | { t: 'collect' }
  | { t: 'retrieve' }
/** What a commit asks the game to do: the forge event's shards. */
export interface Forge { uid: string; form: string; kinds: string[] }
export type Result = { ok: true; state: ForgeState; forge?: Forge } | { ok: false; state: ForgeState; why: Refusal }

export const placed = (s: ForgeState): string[] => s.sockets.filter((k): k is string => k !== null)
export const firstEmpty = (s: ForgeState): number => s.sockets.findIndex((k) => k === null)

/** For each place of the recipe (in order): which placed shard fills it, or null. A placed colour fills a place of its own colour; a Comet fills any place left. */
export interface TrayPlace { kind: string; by: string | null }
export function trayView(recipe: readonly string[], shards: readonly string[]): TrayPlace[] {
  const by: (string | null)[] = recipe.map(() => null)
  for (const k of shards) {
    if (k === COMET) continue
    const i = recipe.findIndex((r, j) => r === k && by[j] === null)
    if (i >= 0) by[i] = k
  }
  let comets = shards.filter((k) => k === COMET).length
  for (let i = 0; i < by.length && comets > 0; i++) if (by[i] === null) { by[i] = COMET; comets-- }
  return recipe.map((kind, i) => ({ kind, by: by[i] }))
}
/** For each place of the recipe (in order): is it filled yet? */
export const trayFill = (recipe: readonly string[], shards: readonly string[]): boolean[] => trayView(recipe, shards).map((p) => p.by !== null)

const WORD: Record<string, string> = { 'red-shard': 'Red', 'blue-shard': 'Blue', 'green-shard': 'Green', 'yellow-shard': 'Yellow' }
const COUNT = ['No', 'One', 'Two', 'Three']
/** The recipe in words: "Two Red and one Blue", "Three Red", "One Red, one Blue and one Green". */
export function recipeText(recipe: readonly string[]): string {
  const order: string[] = []
  for (const k of recipe) if (!order.includes(k)) order.push(k)
  const parts = order.map((k, i) => {
    const n = COUNT[recipe.filter((x) => x === k).length] ?? String(recipe.length)
    return `${i === 0 ? n : n.toLowerCase()} ${WORD[k] ?? k}`
  })
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** Could the shards held fill the recipe (a Comet standing in for any colour)? */
export function recipeReachable(held: Readonly<Record<string, number>>, recipe: readonly string[]): boolean {
  const need = new Map<string, number>()
  for (const k of recipe) need.set(k, (need.get(k) ?? 0) + 1)
  let short = 0
  for (const [k, n] of need) short += Math.max(0, n - (held[k] ?? 0))
  return short <= (held[COMET] ?? 0)
}

/** How many of a shard are still free to place: what is held, less what sits in the sockets. */
export const freeOf = (s: ForgeState, held: Readonly<Record<string, number>>, kind: string): number => (held[kind] ?? 0) - placed(s).filter((k) => k === kind).length

/** The reason `kind` cannot be placed now (in `socket`, or the first empty one), or null when it can. */
export function whyNotPlace(s: ForgeState, kind: string, held: Readonly<Record<string, number>>, socket?: number): Refusal | null {
  if (s.phase !== 'chosen') return s.phase === 'idle' ? 'no-pick' : 'wrong-step'
  const at = socket ?? firstEmpty(s)
  if (at < 0) return 'full'
  if (!Number.isInteger(at) || at < 0 || at >= SOCKETS) return 'bad-socket'
  if (s.sockets[at] !== null) return 'socket-taken'
  if (freeOf(s, held, kind) < 1) return 'not-held'
  if (!fitsRecipe([...placed(s), kind], s.recipe)) return 'not-in-recipe'
  return null
}

const no = (state: ForgeState, why: Refusal): Result => ({ ok: false, state, why })

export function reduce(s: ForgeState, a: Action): Result {
  switch (a.t) {
    case 'choose':
      // picking another Mega puts the shards back (nothing was spent); not while the forge is running
      if (s.phase === 'committed' || s.phase === 'reveal') return no(s, 'wrong-step')
      return { ok: true, state: { phase: 'chosen', pick: a.pick, recipe: [...a.recipe], sockets: [null, null, null] } }
    case 'place': {
      const why = whyNotPlace(s, a.kind, a.held, a.socket)
      if (why) return no(s, why)
      const at = a.socket ?? firstEmpty(s)
      const sockets = s.sockets.map((k, i) => (i === at ? a.kind : k))
      return { ok: true, state: { ...s, sockets, phase: sockets.every((k) => k !== null) ? 'armed' : 'chosen' } }
    }
    case 'lift': {
      if (s.phase !== 'chosen' && s.phase !== 'armed') return no(s, 'wrong-step')
      if (!Number.isInteger(a.socket) || a.socket < 0 || a.socket >= SOCKETS || s.sockets[a.socket] === null) return no(s, 'bad-socket')
      return { ok: true, state: { ...s, phase: 'chosen', sockets: s.sockets.map((k, i) => (i === a.socket ? null : k)) } }
    }
    case 'commit': {
      if (s.phase !== 'armed' || !s.pick) return no(s, 'wrong-step')
      if (!a.keyStone) return no(s, 'no-key-stone')
      if (a.coins < a.fee) return no(s, 'no-coins')
      return { ok: true, state: { ...s, phase: 'committed' }, forge: { uid: s.pick.uid, form: s.pick.form, kinds: placed(s) } }
    }
    case 'revealed':
      return s.phase === 'committed' ? { ok: true, state: { ...s, phase: 'reveal' } } : no(s, 'wrong-step')
    case 'collect':
      return s.phase === 'reveal' ? { ok: true, state: { ...idle(), phase: 'rest' } } : no(s, 'wrong-step')
    case 'retrieve':
      return s.phase === 'rest' ? { ok: true, state: idle() } : no(s, 'wrong-step')
  }
}

/** The line of guidance for the step (FORGE-EXPERIENCE.md section 3, point 6). */
export function guidance(s: ForgeState, o: { keyStone: boolean; coins: number; fee: number }): string {
  const n = placed(s).length
  switch (s.phase) {
    case 'idle': return 'Choose a Mega to forge.'
    case 'chosen': return n === 0 ? 'Place the shards of its recipe. A Comet fits any place.' : `${n} of ${SOCKETS} placed.`
    case 'armed': return !o.keyStone ? 'The shards float, but the altar needs the Key Stone.' : o.coins < o.fee ? `The shards float. The Forge asks ${o.fee.toLocaleString('en-IN')} coins; you have ${o.coins.toLocaleString('en-IN')}.` : 'Place the Key Stone in the centre.'
    case 'committed': return 'The Forge wakes...'
    case 'reveal': return 'Tap the stone to take it.'
    case 'rest': return 'The Key Stone rests in the altar. Tap it to take it back.'
  }
}

// ── the sequence (FORGE-EXPERIENCE.md section 5): when each beat starts and ends, in seconds from the commit ──
export type BeatId = 'commit' | 'destabilise' | 'drain' | 'pour' | 'absorb' | 'hold' | 'bang' | 'clear'
export interface Beat { id: BeatId; from: number; to: number }
export const BEATS: readonly Beat[] = [
  { id: 'commit', from: 0.0, to: 0.5 },
  { id: 'destabilise', from: 0.5, to: 2.0 },   // lightning; the sockets light to white
  { id: 'drain', from: 2.0, to: 3.2 },         // the sockets fade out while the crevices turn whiter, until they are completely white
  { id: 'pour', from: 3.2, to: 4.2 },          // the white water flows along the crevices into the Key Stone, emptying behind it
  { id: 'absorb', from: 4.2, to: 4.8 },        // the floating shards are pulled in; the Key Stone swells and cracks
  { id: 'hold', from: 4.8, to: 5.2 },          // silence
  { id: 'bang', from: 5.2, to: 5.3 },          // the white flash and the shake
  { id: 'clear', from: 5.3, to: 6.6 },         // the white fades; the Mega Stone floats
]
/** The reduced-motion version: the same beats, about 2.5 seconds, with no shake, lightning or full-screen flash (the screen decides what each beat shows). */
export const GENTLE_LENGTH = 2.5
export const LENGTH = BEATS[BEATS.length - 1].to
/** The beat at `t` seconds and how far through it (0 to 1); null once the sequence is over. `gentle` squeezes the beats into GENTLE_LENGTH. */
export function beatAt(t: number, gentle = false): { beat: Beat; progress: number } | null {
  const k = gentle ? LENGTH / GENTLE_LENGTH : 1
  const u = t * k
  if (u < 0 || u >= LENGTH) return null
  const beat = BEATS.find((b) => u >= b.from && u < b.to)!
  return { beat, progress: (u - beat.from) / (beat.to - beat.from) }
}
