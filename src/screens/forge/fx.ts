// The forge's light show, drawn in code on one 2D canvas over the altar: lightning, sparks, rings, rays, cracks and motes. Nothing here needs a picture.
// The pure part (a bolt's shape from a seed) is tested; the Particles class only draws.
import { rng } from '../../../core/economy.ts'

export interface Pt { x: number; y: number }

/** A jagged bolt from `a` to `b` by midpoint displacement: the same seed gives the same bolt. `jag` is how far it strays, as a share of its length. */
export function bolt(a: Pt, b: Pt, seed: string, jag = 0.18, depth = 5): Pt[] {
  const r = rng(seed)
  let pts: Pt[] = [a, b]
  let amp = Math.hypot(b.x - a.x, b.y - a.y) * jag
  for (let d = 0; d < depth; d++) {
    const next: Pt[] = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i]
      const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1
      const off = (r() - 0.5) * 2 * amp
      next.push({ x: (p.x + q.x) / 2 - (dy / len) * off, y: (p.y + q.y) / 2 + (dx / len) * off }, q)
    }
    pts = next
    amp *= 0.55
  }
  return pts
}

interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; colour: string; drag: number; gravity: number }
interface Ring { x: number; y: number; life: number; max: number; from: number; to: number; colour: string; width: number }
interface Bolt { pts: Pt[]; life: number; max: number; colour: string; width: number }
interface Crack { pts: Pt[] }

/** Draws every effect in one pass. Coordinates are in the stage's own pixels (0 to size). */
export class Particles {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private sparks: Spark[] = []
  private rings: Ring[] = []
  private bolts: Bolt[] = []
  private cracks: Crack[] = []
  private rays = 0
  private raysAt: Pt = { x: 0, y: 0 }
  private n = 0
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; this.ctx = canvas.getContext('2d')! }

  private r = (): number => Math.random()

  get alive(): boolean { return this.sparks.length + this.rings.length + this.bolts.length > 0 || this.cracks.length > 0 || this.rays > 0 }

  spark(x: number, y: number, n: number, colour: string, speed = 90, life = 0.6, gravity = 0): void {
    for (let i = 0; i < n; i++) {
      const a = this.r() * Math.PI * 2, v = speed * (0.35 + this.r() * 0.65)
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: life * (0.6 + this.r() * 0.6), size: 1.5 + this.r() * 2.5, colour, drag: 2.2, gravity })
    }
  }
  /** Motes that drift slowly up from the altar, for the calm after the bang. */
  mote(x: number, y: number, colour: string): void {
    this.sparks.push({ x, y, vx: (this.r() - 0.5) * 14, vy: -8 - this.r() * 16, life: 0, max: 2 + this.r() * 1.8, size: 1.5 + this.r() * 2, colour, drag: 0.3, gravity: 0 })
  }
  ring(x: number, y: number, from: number, to: number, colour: string, life = 0.5, width = 3): void { this.rings.push({ x, y, life: 0, max: life, from, to, colour, width }) }
  bolt(a: Pt, b: Pt, colour = '#e8f0ff', life = 0.22, width = 2, jag = 0.18): void { this.bolts.push({ pts: bolt(a, b, `b${this.n++}${this.r()}`, jag), life: 0, max: life, colour, width }) }
  /** Hairline cracks of light over a ball at `at`, `n` of them, growing out to `len`. */
  cracksAt(at: Pt, n: number, len: number): void {
    this.cracks = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + (this.r() - 0.5) * 0.5
      return { pts: bolt(at, { x: at.x + Math.cos(a) * len, y: at.y + Math.sin(a) * len }, `crack${i}${this.r()}`, 0.25, 4) }
    })
  }
  rayBurst(at: Pt): void { this.rays = 1; this.raysAt = at }
  clearCracks(): void { this.cracks = [] }
  clear(): void {
    this.sparks = []; this.rings = []; this.bolts = []; this.cracks = []; this.rays = 0
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /** Advance by `dt` seconds and draw. `k` is canvas pixels per stage pixel; `crackShow` (0 to 1) is how far the cracks have spread. */
  draw(dt: number, k: number, crackShow = 1): void {
    const { ctx, canvas } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(k, k)
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    for (const b of this.bolts) {
      b.life += dt
      const f = 1 - b.life / b.max
      if (f <= 0) continue
      ctx.strokeStyle = b.colour; ctx.globalAlpha = Math.min(1, f * 1.4)
      ctx.shadowColor = b.colour; ctx.shadowBlur = 10
      ctx.lineWidth = b.width
      ctx.beginPath(); b.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke()
    }
    ctx.shadowBlur = 0
    for (const g of this.rings) {
      g.life += dt
      const f = g.life / g.max
      if (f >= 1) continue
      ctx.strokeStyle = g.colour; ctx.globalAlpha = (1 - f) * 0.9; ctx.lineWidth = g.width * (1 - f * 0.6)
      ctx.beginPath(); ctx.arc(g.x, g.y, g.from + (g.to - g.from) * (1 - Math.pow(1 - f, 3)), 0, Math.PI * 2); ctx.stroke()
    }
    for (const s of this.sparks) {
      s.life += dt
      const f = 1 - s.life / s.max
      if (f <= 0) continue
      const damp = Math.exp(-s.drag * dt)
      s.vx *= damp; s.vy = s.vy * damp + s.gravity * dt
      s.x += s.vx * dt; s.y += s.vy * dt
      ctx.fillStyle = s.colour; ctx.globalAlpha = Math.min(1, f * 1.5)
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size)
    }
    if (this.cracks.length) {
      ctx.strokeStyle = '#ffffff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.95
      for (const c of this.cracks) {
        const n = Math.max(2, Math.round(c.pts.length * Math.min(1, crackShow)))
        ctx.beginPath(); c.pts.slice(0, n).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke()
      }
      ctx.shadowBlur = 0
    }
    if (this.rays > 0) {
      this.rays = Math.max(0, this.rays - dt / 0.7)
      const f = 1 - this.rays, len = 40 + f * 520
      ctx.fillStyle = '#fff'; ctx.globalAlpha = this.rays * 0.8
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.2, w = 0.07 + (i % 3) * 0.02
        ctx.beginPath(); ctx.moveTo(this.raysAt.x, this.raysAt.y)
        ctx.lineTo(this.raysAt.x + Math.cos(a - w) * len, this.raysAt.y + Math.sin(a - w) * len)
        ctx.lineTo(this.raysAt.x + Math.cos(a + w) * len, this.raysAt.y + Math.sin(a + w) * len)
        ctx.closePath(); ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    this.sparks = this.sparks.filter((s) => s.life < s.max)
    this.rings = this.rings.filter((g) => g.life < g.max)
    this.bolts = this.bolts.filter((b) => b.life < b.max)
  }
}
