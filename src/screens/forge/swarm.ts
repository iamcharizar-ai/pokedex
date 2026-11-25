// The shards you hold, floating round the altar: one object for every shard, each pushing the others away like magnets of the same pole.
// Take one out (place it in a socket) and the rest drift apart to fill its place; put one back and it comes out of its socket and the others make room.
// Pure (no screen): positions are fractions of the arena (0 to 1 across); `step` moves them, the screen only draws where they are.

export interface Orb { key: string; kind: string; x: number; y: number; vx: number; vy: number; /** floating (not in a socket) */ on: boolean; /** held by the pointer: it goes where the pointer goes, and still pushes the others away */ held?: boolean; phase: number }

/** The altar's picture is this share of the arena's width (CSS: .altar-box), and the altar itself fills its picture. */
export const ALTAR = 0.72

export class Swarm {
  orbs: Orb[] = []
  private n = 0
  private seed: number
  constructor(seed = 1) { this.seed = seed }
  private rnd = (): number => { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296 }

  /** A random place outside the altar, for a shard that has just arrived. */
  private spawn(): { x: number; y: number } {
    for (;;) {
      const x = 0.06 + this.rnd() * 0.88, y = 0.06 + this.rnd() * 0.88
      if (Math.hypot(x - 0.5, y - 0.5) > ALTAR / 2 + 0.03) return { x, y }
    }
  }

  /** Make the swarm match what is held: shards that are gone leave (one in a socket first, since that is the one that was spent), new ones arrive. True when it changed. */
  sync(held: Readonly<Record<string, number>>, kinds: readonly string[]): boolean {
    let changed = false
    for (const kind of kinds) {
      const want = Math.max(0, held[kind] ?? 0)
      const have = this.orbs.filter((o) => o.kind === kind)
      if (have.length > want) {
        const gone = [...have.filter((o) => !o.on), ...have.filter((o) => o.on).reverse()].slice(0, have.length - want)
        this.orbs = this.orbs.filter((o) => !gone.includes(o))
        changed = true
      }
      for (let i = have.length; i < want; i++) {
        const p = this.spawn()
        this.orbs.push({ key: `${kind}#${this.n++}`, kind, x: p.x, y: p.y, vx: 0, vy: 0, on: true, phase: this.rnd() * 6.28 })
        changed = true
      }
    }
    return changed
  }

  get(key: string): Orb | undefined { return this.orbs.find((o) => o.key === key) }
  /** The floating shards of a kind. */
  floating(kind: string): Orb[] { return this.orbs.filter((o) => o.kind === kind && o.on) }
  /** The floating shard of a kind nearest to a point (fractions of the arena). */
  nearest(kind: string, at: { x: number; y: number }): Orb | null {
    let best: Orb | null = null, bd = Infinity
    for (const o of this.floating(kind)) { const d = Math.hypot(o.x - at.x, o.y - at.y); if (d < bd) { bd = d; best = o } }
    return best
  }
  /** A shard goes into a socket: it stops floating, and the others spread into its place. */
  use(key: string): void { const o = this.get(key); if (o) { o.on = false; o.vx = 0; o.vy = 0 } }
  /** A shard comes back out of a socket (at `at`, the socket's place): it floats again, pushed out by the altar, and the others make room. */
  release(key: string, at?: { x: number; y: number }): void {
    const o = this.get(key)
    if (!o) return
    o.on = true
    if (at) { o.x = at.x; o.y = at.y }
    o.vx = 0; o.vy = 0
  }
  /** Every shard in a socket floats again (all but `keep`, the Key Stone resting in the centre). */
  /** The pointer takes hold of a shard. */
  grab(key: string): void { const o = this.get(key); if (o) { o.held = true; o.vx = 0; o.vy = 0 } }
  /** The held shard goes to (x, y), fractions of the arena. */
  move(key: string, x: number, y: number): void { const o = this.get(key); if (o?.held) { o.x = Math.min(1, Math.max(0, x)); o.y = Math.min(1, Math.max(0, y)) } }
  /** The pointer lets go: the shard floats on from where it is. */
  drop(key: string): void { const o = this.get(key); if (o) { o.held = false; o.vx = 0; o.vy = 0 } }
  releaseAll(keep?: string | null): void { for (const o of this.orbs) if (!o.on && o.key !== keep) o.on = true }

  /** Advance `dt` seconds. `W` is the arena's width in pixels and `d` a shard's size in pixels (the pushing is measured in pixels, so it looks the same at any size). */
  step(dt: number, W: number, d: number, t: number): void {
    dt = Math.min(dt, 0.033)
    const live = this.orbs.filter((o) => o.on)
    const lim = d * 0.5 + 2
    const edge = (ALTAR / 2) * W + d * 0.5 + 8        // a shard keeps clear of the altar's rim, with a little room to spare
    const home = Math.min(edge + 10, W / 2 - lim - 2) // the ring they settle toward when there is room
    const K = 90 * d * d                              // how hard like poles push (inverse square)
    const reach = d * 12
    const ax = new Float64Array(live.length), ay = new Float64Array(live.length)
    for (let i = 0; i < live.length; i++) {
      const a = live[i]
      if (a.held) continue
      const px = a.x * W, py = a.y * W
      let fx = 0, fy = 0
      for (let j = 0; j < live.length; j++) {
        if (i === j) continue
        const b = live[j]
        const dx = px - b.x * W, dy = py - b.y * W
        const r2 = dx * dx + dy * dy + 4, r = Math.sqrt(r2)
        if (r > reach) continue
        const f = K / r2
        fx += (f * dx) / r; fy += (f * dy) / r
      }
      // the altar's rim pushes out hard; a weak pull toward the home ring keeps a few shards together round it instead of in the corners
      const cx = px - W / 2, cy = py - W / 2, cr = Math.hypot(cx, cy) || 1
      if (cr < edge) { const k = (edge - cr) * 90; fx += (cx / cr) * k; fy += (cy / cr) * k }
      const pull = (home - cr) * 10
      fx += (cx / cr) * pull; fy += (cy / cr) * pull
      // the arena's walls
      if (px < lim) fx += (lim - px) * 90
      if (px > W - lim) fx -= (px - (W - lim)) * 90
      if (py < lim) fy += (lim - py) * 90
      if (py > W - lim) fy -= (py - (W - lim)) * 90
      // a slow drift, so they never quite stop
      fx += Math.sin(t * 0.7 + a.phase) * 5; fy += Math.cos(t * 0.6 + a.phase * 1.3) * 5
      ax[i] = fx; ay[i] = fy
    }
    const damp = Math.exp(-3 * dt)
    for (let i = 0; i < live.length; i++) {
      const a = live[i]
      if (a.held) continue
      a.vx = (a.vx + ax[i] * dt) * damp; a.vy = (a.vy + ay[i] * dt) * damp
      const sp = Math.hypot(a.vx, a.vy), max = W * 1.2
      if (sp > max) { a.vx *= max / sp; a.vy *= max / sp }
      a.x += (a.vx * dt) / W; a.y += (a.vy * dt) / W
    }
  }
}
