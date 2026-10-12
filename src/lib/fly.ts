// A reward that leaves the chip it was claimed from and is pulled into the place
// it is kept: pushed out a little, away from the target, then drawn in fast like
// a magnet, and the target pulses when it lands. Plain DOM + Web Animations.
// (Same motion as Life OS's habit rows, so both apps feel the same.)

const reduced = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export type Pocket = 'coins' | 'gems' | 'bag'
const targetOf = (p: Pocket): Element | null => document.querySelector(`[data-reward-target="${p}"]`)

export function flyReward(from: Element, label: string, pocket: Pocket, delay = 0): void {
  const target = targetOf(pocket)
  if (!target || reduced()) return
  const a = from.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  const sx = a.left + a.width / 2
  const sy = a.top + a.height / 2
  const tx = b.left + b.width / 2
  const ty = b.top + b.height / 2
  const len = Math.hypot(tx - sx, ty - sy) || 1
  const px = sx - ((tx - sx) / len) * 26
  const py = sy - ((ty - sy) / len) * 26
  const el = document.createElement('div')
  el.className = 'fly-reward'
  el.textContent = label
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)
  const at = (x: number, y: number, s: number, o = 1): Keyframe => ({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`, opacity: o })
  const anim = el.animate(
    [
      { ...at(sx, sy, 0.6, 0), offset: 0 },
      { ...at(px, py, 1.25), offset: 0.3, easing: 'cubic-bezier(.7,0,.95,.5)' },
      { ...at(tx, ty, 0.55), offset: 0.92 },
      { ...at(tx, ty, 0.3, 0), offset: 1 },
    ],
    { duration: 760, delay, fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)' },
  )
  anim.onfinish = () => {
    el.remove()
    target.classList.remove('reward-pulse')
    void (target as HTMLElement).offsetWidth
    target.classList.add('reward-pulse')
    window.setTimeout(() => target.classList.remove('reward-pulse'), 400)
  }
  anim.oncancel = () => el.remove()
}
