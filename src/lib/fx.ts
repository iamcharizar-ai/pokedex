// The game's own effects, built on the motion kit (motion.js: timings measured
// in the animation study, art and sound all ours). Everything here is a short,
// self-cleaning flourish on an element that already exists: nothing here owns
// state, and with reduced motion each one does nothing.
import { EASE, K, config, confetti, flash, motion, run, setUnit } from './motion.js'

// one card in the study is 250 units wide; ours are about half that in pixels
setUnit(0.5)

const reduced = (): boolean => config.reduced

/**
 * Run a kit motion, then let go of the element. The kit fills forwards, which
 * would pin the element's transform and switch off any CSS animation it has
 * (a bobbing sprite, a breathing button), so what we started is cancelled once done.
 */
export async function transient(el: Element | null | undefined, fn: (el: Element) => Promise<unknown>): Promise<void> {
  if (!el || reduced()) return
  const before = new Set(el.getAnimations())
  await fn(el)
  for (const a of el.getAnimations()) if (!before.has(a)) a.cancel()
}

/** Something took a hit: a 4-unit knock and an 11% stretch for 83 ms, with a white flash on the sprite itself. */
export function hit(el: Element | null | undefined, dir: 'left' | 'right' = 'right'): void {
  if (!el || reduced()) return
  void transient(el, (e) => Promise.all([
    motion.recoil(e, { dir }),
    run(e, [{ filter: 'brightness(2.6)' }, { filter: 'brightness(1)' }], { dur: 183, ease: EASE.in, fill: 'none' }),
  ]))
}

/** Sent out: falls tall and narrow, lands flattened, rebounds, settles by 567 ms. */
export function dropIn(el: Element | null | undefined, big = false): void {
  if (!el || reduced()) return
  void transient(el, (e) => motion.deployDrop(e, { legendary: big, height: 60 }))
}

/** A tab or button answering a tap: 0.54 → 1.25 → 0.75 → 1, 100 ms each. */
export function tapPop(el: Element | null | undefined): void {
  void transient(el, (e) => run(e, K(300, [
    [0, { t: { s: 0.54 } }, EASE.out], [100, { t: { s: 1.25 } }, EASE.inOut], [200, { t: { s: 0.75 } }, EASE.out], [300, { t: { s: 1 } }],
  ]), { dur: 300 }))
}

/** Bought, fed, equipped: 1 → 1.2 → 0.94 → 1 with a white flash. */
export function buyPop(el: Element | null | undefined): void {
  if (!el || reduced()) return
  void flash(el, '#fff', { dur: 133, peak: 0.7 })
  void transient(el, (e) => run(e, K(254, [
    [0, { t: { s: 1 } }, EASE.linear], [67, { t: { s: 1.2 } }, EASE.linear], [134, { t: { s: 0.94 } }, EASE.out], [254, { t: { s: 1 } }],
  ]), { dur: 254 }))
}

/** A bar or frame pulsing once: 1 → 1.24 → 1 (133 ms each way) with a glow. */
export function pulse(el: Element | null | undefined, glow = 'drop-shadow(0 0 12px #ffd800)', to = 1.12): void {
  void transient(el, (e) => motion.pulse(e, { to, glow }))
}

export type StampTone = 'gold' | 'red' | 'green' | 'purple'
/**
 * A word stamped over something ("GOTCHA!", "PERFECT DAY"): arrives big and lands
 * at 0.9 in 167 ms with a white flash, holds, and fades in 100 ms. Removes itself.
 */
export function stamp(host: Element | null | undefined, text: string, tone: StampTone = 'gold', hold = 1100): void {
  if (!host) return
  const el = document.createElement('div')
  el.className = `fx-stamp ${tone}`
  el.textContent = text
  el.setAttribute('aria-hidden', 'true')
  host.appendChild(el)
  if (reduced()) { window.setTimeout(() => el.remove(), hold + 400); return }
  void motion.stampIn(el).then(() => new Promise((r) => window.setTimeout(r, hold)))
    .then(() => run(el, [{ opacity: 1 }, { opacity: 0 }], { dur: 100 }))
    .then(() => el.remove())
}

/** A shock ring from the middle of something (a catch, a kill, a forge). */
export function ring(host: Element | null | undefined, color = '#ffd9a8', size = 44): void {
  if (!host || reduced()) return
  void motion.ringShock(host, { color, size, dur: 500, to: 4.2 })
}

/** Confetti from a host, for the things that deserve it (a badge, a boss, a shiny). */
export function party(host: Element | null | undefined, count = 46): void {
  if (!host || reduced()) return
  void confetti(host, { count })
}

/** A number that floats up from something and fades: rises 62 units over about a second. */
export function floatNote(host: Element | null | undefined, text: string, tone: StampTone = 'gold'): void {
  if (!host || reduced()) return
  const el = document.createElement('span')
  el.className = `fx-float ${tone}`
  el.textContent = text
  el.setAttribute('aria-hidden', 'true')
  host.appendChild(el)
  void motion.floatText(el, { rise: 90 }).then(() => el.remove())
}

export { motion, run, K, EASE, flash, config as motionConfig }

/**
 * Forging: three shards slam into the stone one after another (each 4× → 1× in 400 ms
 * with a magenta flash), then the stone pulses and throws a ring. `done` runs at the pulse.
 */
export async function forgeSlam(line: Element | null | undefined, shardSrc: string, done: () => void, n = 3): Promise<void> {
  const stone = line?.querySelector('img, .keystone') as HTMLElement | null
  if (!line || !stone || reduced()) { done(); return }
  const host = line as HTMLElement
  const prev = host.style.position
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
  const a = stone.getBoundingClientRect(), b = host.getBoundingClientRect()
  const shards = Array.from({ length: n }, (_, i) => {
    const s = document.createElement('span')
    s.className = 'fx-shard'
    s.style.cssText = `left:${a.left - b.left + a.width / 2 - 14 + (i - (n - 1) / 2) * 6}px;top:${a.top - b.top + a.height / 2 - 14}px;background-image:url(${shardSrc})`
    host.appendChild(s)
    return s
  })
  await Promise.all(shards.map((s, i) => motion.slam(s, { delay: i * 120 })))
  shards.forEach((s) => s.remove())
  done()
  void motion.ringShock(host, { color: '#e0a0ff', size: 30, dur: 500, to: 5, x: a.left - b.left + a.width / 2 - b.width / 2, y: a.top - b.top + a.height / 2 - b.height / 2 })
  await transient(stone, (e) => motion.pulse(e, { to: 1.24 }))
  host.style.position = prev
}
