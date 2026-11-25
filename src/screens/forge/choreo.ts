// What the altar's glow is doing at each moment of the forging sequence (FORGE-EXPERIENCE.md section 5). Pure: a time in, the glow's state out; the screen
// feeds it to glow.ts every frame. Keeping it here means the order of events is tested, not hoped for.
//
//   commit, destabilise   the sockets gain light, slowly and then faster, until each is completely full of it (its colour turning to white); the crevices keep their colour
//   drain                 each socket empties into its crevices: the light leaves the socket fast at first, and a wave of white runs out along the crevices from it,
//                         the near ones first and the far ones slower, until every crevice is lit white and every socket is empty
//   pour                  the crevices empty into the centre; the centre gains white as they do (slow, then faster), and has the most when they are empty
//   absorb, hold, bang    the crevices and sockets are empty; the centre is at its whitest
//   clear                 the white fades away
//
// Nothing here moves in a straight line. A thing that charges uses `rise` (a slow start that gathers speed, like a charge building); a thing that spreads or empties
// uses `settle` (a fast start that slows, like water finding its level). Both are exponentials, scaled so they run exactly from 0 to 1.
import { CALM, type GlowState, type RGB } from './glow.ts'
import { beatAt } from './machine.ts'

export interface Inputs {
  /** the colour of the shard in each socket, and whether it is a Comet (rainbow) */
  colour: [RGB, RGB, RGB]
  prism: [boolean, boolean, boolean]
}

/** Exponential rise: 0 at 0, 1 at 1; slow at first, then faster and faster. `k` is how steep (higher = a longer wait, a harder finish). */
export const rise = (p: number, k = 5): number => (Math.pow(2, k * Math.min(1, Math.max(0, p))) - 1) / (Math.pow(2, k) - 1)
/** Exponential settle: 0 at 0, 1 at 1; fast at first, then slower and slower. */
export const settle = (p: number, k = 5): number => 1 - (Math.pow(2, k * (1 - Math.min(1, Math.max(0, p)))) - 1) / (Math.pow(2, k) - 1)

/** How lit a socket rests before it begins to gain light (the shard's own glow once it is placed). */
export const RESTING = 0.3
/** Seconds into the sequence (unscaled) when the sockets are full of light: the end of the destabilise beat. */
const FULL_AT = 2.0

/** The glow `t` seconds after the commit (`gentle`: the shortened version for reduced motion); null once the sequence is over. */
export function glowAt(t: number, input: Inputs, gentle = false): GlowState | null {
  const at = beatAt(t, gentle)
  if (!at) return null
  const { beat, progress: p } = at
  const u = beat.from + p * (beat.to - beat.from)   // the time in the unsqueezed sequence
  const base: GlowState = { ...CALM, fill: [1, 1, 1], colour: input.colour, prism: input.prism, time: t }
  switch (beat.id) {
    case 'commit':
    case 'destabilise': {
      // the sockets fill with light (the crevices are not touched yet); the colour goes to white as they near full
      const lit = RESTING + (1 - RESTING) * rise(u / FULL_AT)
      return { ...base, wells: [lit, lit, lit, 0], wellWhite: beat.id === 'commit' ? 0 : rise(p) }
    }
    case 'drain': {
      // the socket's light goes into the crevices: as the wave of white runs out along them, the socket empties by the same amount
      const wave = settle(p)
      return { ...base, wells: [1 - wave, 1 - wave, 1 - wave, 0], wellWhite: 1, bleach: wave }
    }
    case 'pour': {
      // every crevice is lit; they empty into the centre, which gains white in step with it
      const emptied = rise(p, 4)
      return { ...base, bleach: 1, wells: [0, 0, 0, emptied], wellWhite: 1, pour: emptied }
    }
    case 'absorb':
    case 'hold':
    case 'bang':
      return { ...base, fill: [0, 0, 0], bleach: 1, wells: [0, 0, 0, 1], wellWhite: 1 }
    case 'clear':
      return { ...base, fill: [0, 0, 0], bleach: 1, wells: [0, 0, 0, 1 - settle(p)], wellWhite: 1 }
  }
}
