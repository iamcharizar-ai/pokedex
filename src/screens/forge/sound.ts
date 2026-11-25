// The forge's sounds, made from plain oscillators and noise (no audio files), in step with the game's own sound switch (src/lib/sfx.ts: off until turned on,
// remembered on the device). Each call does nothing with sound off. Haptics follow the same switch.
import { soundOn } from '../../lib/sfx.ts'

let ctx: AudioContext | null = null
let live: { stop: () => void }[] = []

function audio(): AudioContext | null {
  if (!soundOn()) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

/** One tone: `from` Hz gliding to `to` Hz over `len` seconds, starting `at` seconds from now. Returns a handle that cuts it short. */
function tone(c: AudioContext, type: OscillatorType, from: number, to: number, len: number, vol: number, at = 0, attack = 0.01): { stop: () => void } {
  const t = c.currentTime + at
  const o = c.createOscillator(), g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(from, t)
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + len)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  o.connect(g).connect(c.destination)
  o.start(t); o.stop(t + len + 0.05)
  const h = { stop: () => { try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0.0001, c.currentTime, 0.02); o.stop(c.currentTime + 0.1) } catch { /* already over */ } } }
  live.push(h)
  return h
}

/** A burst of filtered noise. */
function noise(c: AudioContext, len: number, freq: number, vol: number, at = 0, q = 1, type: BiquadFilterType = 'bandpass'): void {
  const t = c.currentTime + at
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * len)), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
  s.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  s.connect(f).connect(g).connect(c.destination)
  s.start(t)
}

/** The phone's vibration, when it has one and sound is on. */
export function buzz(pattern: number | number[]): void {
  if (!soundOn()) return
  try { navigator.vibrate?.(pattern) } catch { /* no vibration here */ }
}

/** Cut every tone still playing (the held silence before the bang). */
export function hush(): void {
  for (const h of live) h.stop()
  live = []
}

export const forgeSound = {
  /** a shard snaps into its socket: a click and a bright ping; `n` is how many are in, so the ping climbs */
  snap(n: number): void { const c = audio(); if (!c) return; noise(c, 0.04, 3000, 0.12); tone(c, 'triangle', 660 * Math.pow(2, n / 6), 990 * Math.pow(2, n / 6), 0.18, 0.07, 0.01); buzz(14) },
  /** the water running along the crevices */
  trickle(): void { const c = audio(); if (!c) return; noise(c, 0.7, 1800, 0.05, 0, 4); noise(c, 0.7, 2600, 0.03, 0.05, 6) },
  /** a shard taken back out */
  lift(): void { const c = audio(); if (!c) return; tone(c, 'sine', 500, 300, 0.1, 0.05); buzz(6) },
  /** refused */
  nope(): void { const c = audio(); if (!c) return; tone(c, 'square', 180, 120, 0.12, 0.05); buzz([10, 30, 10]) },
  /** the three shards lift off and float */
  float(): void { const c = audio(); if (!c) return; [523, 659, 784, 1047].forEach((f, i) => tone(c, 'sine', f, f, 0.5, 0.05, i * 0.07)); buzz([12, 40, 12]) },
  /** the Key Stone goes home: a heavy click and a thud, and a rush of coins when the fee is paid */
  key(coins: boolean): void {
    const c = audio(); if (!c) return
    noise(c, 0.06, 900, 0.2); tone(c, 'sine', 130, 55, 0.35, 0.22); tone(c, 'square', 1400, 900, 0.05, 0.05)
    if (coins) for (let i = 0; i < 7; i++) tone(c, 'triangle', 1500 + (i % 3) * 200, 1900 + (i % 3) * 200, 0.08, 0.04, 0.12 + i * 0.05)
    buzz([30, 30, 50])
  },
  /** the forge destabilising: a hum that rises */
  hum(len: number): void { const c = audio(); if (!c) return; tone(c, 'sawtooth', 70, 220, len, 0.05, 0, 0.4); tone(c, 'sine', 140, 440, len, 0.06, 0, 0.4); buzz([20, 20, 20, 20, 20, 20, 30]) },
  crackle(): void { const c = audio(); if (!c) return; noise(c, 0.09, 4200, 0.09, 0, 0.8); noise(c, 0.05, 6000, 0.07, 0.07, 0.8) },
  /** the sockets draining: a descending rush */
  drain(len: number): void { const c = audio(); if (!c) return; tone(c, 'sine', 1200, 160, len, 0.07); noise(c, len, 1400, 0.05, 0, 0.7) },
  /** the pour: a rising pulse */
  pulse(i: number): void { const c = audio(); if (!c) return; tone(c, 'sine', 220 * Math.pow(1.5, i), 220 * Math.pow(1.5, i) * 1.04, 0.28, 0.1); buzz(18) },
  /** a shard pulled into the Key Stone */
  pull(i: number): void { const c = audio(); if (!c) return; tone(c, 'triangle', 880 * Math.pow(1.26, i), 1760 * Math.pow(1.26, i), 0.2, 0.07); buzz(16) },
  /** the whine before the bang */
  whine(len: number): void { const c = audio(); if (!c) return; tone(c, 'sine', 300, 2400, len, 0.07, 0, 0.1) },
  /** the bang: a boom with a deep thump */
  boom(): void {
    const c = audio(); if (!c) return
    noise(c, 0.9, 260, 0.5, 0, 0.4, 'lowpass'); tone(c, 'sine', 120, 28, 0.9, 0.55); tone(c, 'sawtooth', 90, 30, 0.5, 0.15)
    buzz([90, 25, 70, 25, 50, 25, 30])
  },
  /** the stone appears: a bright chime that fades */
  chime(): void { const c = audio(); if (!c) return; [1047, 1319, 1568, 2093].forEach((f, i) => tone(c, 'sine', f, f, 1.4 - i * 0.15, 0.05, 0.05 + i * 0.09)); buzz(20) },
  /** the stone taken */
  take(): void { const c = audio(); if (!c) return; [620, 780, 980].forEach((f, i) => tone(c, 'triangle', f, f, 0.12, 0.06, i * 0.05)); buzz(14) },
}
