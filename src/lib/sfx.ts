// Small sounds, made here from plain tones (no sound files). Off until turned
// on in the "?" window, and remembered on this device.
const KEY = 'pokedex.sound.v1'
let ctx: AudioContext | null = null

export const soundOn = (): boolean => {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
export const setSoundOn = (on: boolean): void => {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* no storage: it stays off */ }
}

type Sound = 'tap' | 'buy' | 'throw' | 'hit' | 'catch' | 'feed'
/** each sound is a short run of notes: [frequency, seconds, wave] */
const NOTES: Record<Sound, [number, number, OscillatorType][]> = {
  tap: [[520, 0.05, 'square']],
  buy: [[660, 0.07, 'triangle'], [990, 0.12, 'triangle']],
  throw: [[300, 0.06, 'sawtooth'], [520, 0.06, 'sawtooth'], [780, 0.08, 'sawtooth']],
  hit: [[180, 0.09, 'square'], [120, 0.12, 'square']],
  catch: [[523, 0.1, 'triangle'], [659, 0.1, 'triangle'], [784, 0.1, 'triangle'], [1047, 0.22, 'triangle']],
  feed: [[440, 0.08, 'sine'], [587, 0.14, 'sine']],
}

export function play(sound: Sound): void {
  if (!soundOn()) return
  try {
    ctx ??= new AudioContext()
    let t = ctx.currentTime
    for (const [freq, len, wave] of NOTES[sound]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.type = wave
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.08, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + len)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + len)
      t += len * 0.9
    }
  } catch {
    /* no audio here: carry on silently */
  }
}
