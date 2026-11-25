// The forge's director: one animation loop that runs the glow, the effects, the sounds and the movement of the floating things, for placing shards
// and for the sequence (FORGE-EXPERIENCE.md section 5). The screen (Stage.tsx) owns the state and the elements; this owns time.
//
// While the forge rests nothing runs. It runs while a fill is tweening, a sequence plays, or sparks are alive; with shards in the sockets it ticks at a low rate
// so the water shimmers.
import { AltarGlow, CALM, type GlowState } from './glow.ts'
import { Particles, type Pt } from './fx.ts'
import { GENTLE_LENGTH, LENGTH } from './machine.ts'
import { RESTING, glowAt, settle } from './choreo.ts'
import { forgeSound, hush } from './sound.ts'
import { isComet, shardHex, shardRgb } from './look.ts'

/** Where things are, in pixels from the stage's top left. */
export interface Geom { S: number; wells: Pt[]; centre: Pt; /** how many times larger a floating shard is drawn than one resting in its socket (a whole number: the art stays square) */ fs: number }
export interface Els {
  shards: (HTMLElement | null)[]
  key: HTMLElement | null
  ball: HTMLElement | null
  mega: HTMLElement | null
  /** the full-screen flash (one only) */
  flash: HTMLElement | null
  /** a soft light over the altar only: the reduced-motion flash, and the afterglow */
  wash: HTMLElement | null
  /** the screen's edges darkening before the bang */
  dark: HTMLElement | null
  /** what shakes: the whole screen */
  shake: HTMLElement | null
}
export interface Deps {
  glow: AltarGlow | null
  fx: Particles
  fxCanvas: HTMLCanvasElement
  geom: () => Geom
  els: () => Els
  reduced: () => boolean
  /** a well's light, for the fallback when WebGL is missing: (socket index or 3 for the centre, 0 to 1, colour) */
  onWell?: (i: number, level: number, hex: string) => void
  onDone: () => void
}

const clamp = (x: number, a = 0, b = 1): number => Math.min(b, Math.max(a, x))
const easeOut = (p: number): number => 1 - Math.pow(1 - clamp(p), 3)
/** The shake: how far it throws at `x` seconds after the bang (a violent start that dies away in 0.45 s). */
export const shakeAt = (x: number, S: number): { x: number; y: number } => {
  if (x < 0 || x >= 0.45) return { x: 0, y: 0 }
  const amp = S * 0.05 * Math.pow(1 - x / 0.45, 2)
  return { x: Math.sin(x * 130) * amp, y: Math.cos(x * 97) * amp * 0.8 }
}
/** How much of the full-screen flash shows `u` seconds into the sequence: nothing, up in 60 ms, held 80 ms, then 1.2 s to fade. One flash only. */
export const flashAt = (u: number): number => (u < 5.2 ? 0 : u < 5.26 ? (u - 5.2) / 0.06 : u < 5.34 ? 1 : clamp(1 - (u - 5.34) / 1.2))

interface Seq { t0: number; gentle: boolean; kinds: (string | null)[]; fired: Set<string>; lastBolt: number; lastSpark: number; lastMote: number; coins: boolean }

export class Director {
  private d: Deps
  private raf = 0
  private prev = 0
  private lastGlow = 0
  private seq: Seq | null = null
  // placing: each socket's water level, tweening toward its target
  private fill = [0, 0, 0]
  private from = [0, 0, 0]
  private to = [0, 0, 0]
  private at = [0, 0, 0]
  private lit = [0, 0, 0]
  private colour: (string | null)[] = [null, null, null]
  /** something changed since the glow was last drawn (the last frame of a tween must be drawn, or the light stays where it stopped) */
  private dirty = false

  constructor(deps: Deps) { this.d = deps }

  get running(): boolean { return this.seq !== null }
  /** Swap in the glow once it has loaded (or null when WebGL is missing). */
  setGlow(g: AltarGlow | null): void { this.d.glow = g; this.kick() }

  /** A shard has snapped into socket `i`: its colour begins to run along the crevices. */
  snap(i: number, kind: string, now = performance.now()): void {
    const { geom, fx, reduced } = this.d
    this.colour[i] = kind
    this.from[i] = this.fill[i]; this.to[i] = 1; this.at[i] = now; this.dirty = true
    const g = geom(), w = g.wells[i], hex = shardHex(kind)
    if (!reduced()) { fx.spark(w.x, w.y, 16, hex, g.S * 0.28, 0.55); fx.ring(w.x, w.y, g.S * 0.03, g.S * 0.1, hex, 0.45, 3) }
    this.kick()
  }
  /** A shard lifted back out: the crevices drain back to dark. */
  lift(i: number, now = performance.now()): void {
    this.from[i] = this.fill[i]; this.to[i] = 0; this.at[i] = now; this.dirty = true
    this.kick()
  }
  /** Back to a dark, resting altar. */
  reset(): void {
    this.fill = [0, 0, 0]; this.from = [0, 0, 0]; this.to = [0, 0, 0]; this.lit = [0, 0, 0]; this.colour = [null, null, null]
    this.seq = null
    this.d.glow?.set({ ...CALM })
    this.d.fx.clear()
    this.wells(this.lit, [0, 0, 0, 0], 0)
    this.cleanup()
  }

  /** The sequence: from the commit. `kinds` are the three shards in the sockets; `coins`: the fee was paid. */
  start(kinds: (string | null)[], coins: boolean, now = performance.now()): void {
    this.seq = { t0: now, gentle: this.d.reduced(), kinds: [...kinds], fired: new Set(), lastBolt: -1, lastSpark: -1, lastMote: -1, coins }
    this.kick()
  }
  destroy(): void { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.cleanup(); hush() }

  kick(): void { if (!this.raf && typeof requestAnimationFrame === 'function') { this.prev = 0; this.raf = requestAnimationFrame(this.frame) } }

  private frame = (now: number): void => {
    this.raf = 0
    const dt = clamp((now - (this.prev || now)) / 1000, 0, 0.05)
    this.prev = now
    let again = this.seq ? this.runSeq(now, dt) : this.runPlacing(now)
    const g = this.d.geom()
    this.d.fx.draw(dt, g.S > 0 ? this.d.fxCanvas.width / g.S : 1, this.seq ? clamp((this.uOf(now) - 4.5) / 0.7) : 1)
    if (this.d.fx.alive) again = true
    if (again && !document.hidden) this.raf = requestAnimationFrame(this.frame)
  }
  // never before the start: a frame's timestamp can be a hair older than the click that began the sequence, and a negative time would read as 'over'
  private uOf(now: number): number { const s = this.seq; return s ? (Math.max(0, now - s.t0) / 1000) * (s.gentle ? LENGTH / GENTLE_LENGTH : 1) : 0 }

  private wells(lit: number[], extra: number[], white: number): void {
    const { onWell } = this.d
    if (!onWell) return
    for (let i = 0; i < 3; i++) onWell(i, lit[i], white > 0.5 ? '#fffaf0' : shardHex(this.colour[i]))
    onWell(3, extra[3] ?? 0, '#fffaf0')
  }

  /** Shards in the sockets: the water tweens toward each socket's target; settled, the shimmer ticks at about 20 a second. */
  private runPlacing(now: number): boolean {
    let tweening = false
    for (let i = 0; i < 3; i++) {
      const dur = this.to[i] > this.from[i] ? 1400 : 450
      const p = clamp((now - this.at[i]) / dur)
      if (p < 1) tweening = true
      const e = this.to[i] > this.from[i] ? settle(p, 3) : p * p * (3 - 2 * p)
      this.fill[i] = this.from[i] + (this.to[i] - this.from[i]) * e
      this.lit[i] = this.to[i] > 0 ? RESTING * clamp((now - this.at[i]) / 250) : RESTING * (1 - clamp((now - this.at[i]) / 300))
    }
    const any = this.fill.some((f) => f > 0.001)
    if (tweening || this.dirty || (any && now - this.lastGlow > 50)) {
      this.lastGlow = now
      this.dirty = tweening
      const colours = this.colour
      const s: GlowState = {
        ...CALM,
        fill: [this.fill[0], this.fill[1], this.fill[2]],
        colour: [shardRgb(colours[0]), shardRgb(colours[1]), shardRgb(colours[2])],
        prism: [isComet(colours[0]), isComet(colours[1]), isComet(colours[2])],
        wells: [this.lit[0], this.lit[1], this.lit[2], 0],
        time: now / 1000,
      }
      this.d.glow?.set(s)
      this.wells(this.lit, [0, 0, 0, 0], 0)
    }
    return tweening || (any && !this.d.reduced())
  }

  private fire(key: string): boolean {
    const s = this.seq!
    if (s.fired.has(key)) return false
    s.fired.add(key)
    return true
  }

  private runSeq(now: number, dt: number): boolean {
    const s = this.seq!
    const { fx, reduced } = this.d
    const gentle = s.gentle
    const t = Math.max(0, now - s.t0) / 1000
    const u = this.uOf(now)
    const g = this.d.geom(), els = this.d.els()
    const gs = glowAt(t, { colour: [shardRgb(s.kinds[0]), shardRgb(s.kinds[1]), shardRgb(s.kinds[2])], prism: [isComet(s.kinds[0]), isComet(s.kinds[1]), isComet(s.kinds[2])] }, gentle)
    if (!gs) { this.finish(); return false }
    this.d.glow?.set(gs)
    this.wells(gs.wells, gs.wells, gs.wellWhite)
    const C = g.centre, big = !gentle && !reduced()
        const centreWhite = gs.wells[3]

    // ── the Key Stone goes home, and the commit's first light ──
    if (this.fire('commit')) {
      forgeSound.key(s.coins)
      fx.ring(C.x, C.y, g.S * 0.03, g.S * 0.22, '#ffffff', 0.5, 3)
      if (big) { fx.spark(C.x, C.y, 18, '#ffffff', g.S * 0.3, 0.5); if (s.coins) fx.spark(C.x, C.y, 12, '#ffd940', g.S * 0.35, 0.7) }
    }
    if (u >= 0.5 && this.fire('hum')) forgeSound.hum(gentle ? 0.6 : 1.5)
    if (u >= 2.0 && this.fire('drain')) forgeSound.drain(gentle ? 0.5 : 1.2)
    for (let i = 0; i < 3; i++) if (u >= 3.25 + i * 0.35 && this.fire(`pulse${i}`)) { forgeSound.pulse(i); if (big) fx.ring(C.x, C.y, g.S * 0.08, g.S * 0.2, '#ffffff', 0.4, 2) }
    if (u >= 4.2 && this.fire('whine')) forgeSound.whine(gentle ? 0.25 : 0.6)
    if (u >= 4.5 && this.fire('cracks')) fx.cracksAt(C, 7, g.S * 0.09)
    if (u >= 4.8 && this.fire('hush')) hush()
    if (u >= 5.2 && this.fire('bang')) {
      forgeSound.boom()
      if (big) { fx.rayBurst(C); fx.ring(C.x, C.y, g.S * 0.05, g.S * 0.9, '#ffffff', 0.8, 6); fx.spark(C.x, C.y, 60, '#ffffff', g.S * 0.9, 0.9) }
    }
    if (u >= 5.3 && this.fire('clear')) { fx.clearCracks(); if (big) fx.spark(C.x, C.y, 28, '#e8f0ff', g.S * 0.25, 1.4, g.S * 0.5) }
    if (u >= 5.45 && this.fire('chime')) forgeSound.chime()

    // ── lightning and shed sparks while the forge destabilises ──
    if (big && u >= 0.55 && u < 2.4) {
      if (u - s.lastBolt > 0.1) {
        s.lastBolt = u
        const i = Math.floor(Math.random() * 3), j = (i + 1 + Math.floor(Math.random() * 2)) % 3
        fx.bolt(g.wells[i], C, '#dfe8ff', 0.22, 2, 0.2)
        fx.bolt(g.wells[i], g.wells[j], '#bcd0ff', 0.18, 1.5, 0.16)
        if (u - (s.lastBolt - 0.1) > 0 && Math.random() < 0.4) forgeSound.crackle()
      }
      if (u - s.lastSpark > 0.06) {
        s.lastSpark = u
        for (let i = 0; i < 3; i++) fx.spark(g.wells[i].x, g.wells[i].y, 2, shardHex(s.kinds[i]), g.S * 0.25, 0.45)
      }
    }
    // motes drifting up from the altar in the calm after the bang
    if (big && u >= 5.5 && u - s.lastMote > 0.12) { s.lastMote = u; fx.mote(C.x + (Math.random() - 0.5) * g.S * 0.12, C.y, Math.random() < 0.5 ? '#fff6d8' : '#cfe0ff') }

    // ── the shards in the sockets: they bob and spin as the forge destabilises, and sink into the white as the sockets fill with it, so none is left when the light drains out ──
    const destab = u >= 0.5 && u < 2.0 ? (u - 0.5) / 1.5 : u >= 2.0 ? 1 : 0
    const sink = clamp((u - 0.9) / 1.1)
    for (let i = 0; i < 3; i++) {
      const el = els.shards[i]
      if (!el) continue
      const bob = Math.sin(u * (5 + 9 * destab) + i * 2.1) * g.S * 0.004
      el.style.animation = 'none'
      el.style.translate = `0px ${bob}px`
      el.style.scale = String(g.fs * (1 + 0.3 * sink))
      el.style.rotate = big ? `${Math.sin(u * (7 + 14 * destab) + i) * (4 + 10 * destab)}deg` : '0deg'
      el.style.opacity = String(1 - sink)
      el.style.filter = `brightness(${1 + 3 * sink}) saturate(${1 - sink}) drop-shadow(0 0 ${8 + 16 * sink}px #fff)`
    }
    // the energy of each shard pours into the Key Stone one after another, as the whine rises
    for (let i = 0; i < 3; i++) {
      if (u >= 4.48 + i * 0.12 && this.fire(`pull${i}`)) { forgeSound.pull(i); if (big) { fx.ring(C.x, C.y, g.S * 0.03, g.S * 0.12, shardHex(s.kinds[i]), 0.35, 2); fx.spark(C.x, C.y, 8, shardHex(s.kinds[i]), g.S * 0.2, 0.4) } }
    }

    // ── the Key Stone: in with a clunk, shuddering, white-hot, swelling ──
    const key = els.key
    if (key) {
      const drop = clamp(u / 0.18)
      const swell = u < 4.2 ? 0 : u < 5.3 ? clamp((u - 4.2) / 0.6) * 0.5 : 0.5 * (1 - clamp((u - 5.3) / 0.6))
      const shud = big && u >= 0.5 && u < 4.2 ? (0.4 + 1.6 * clamp((u - 0.5) / 3.7)) * (g.S / 360) : big && u >= 4.8 && u < 5.2 ? 0.8 * (g.S / 360) : 0
      key.style.opacity = String(clamp(drop * 2))
      key.style.scale = String((1.8 - 0.8 * easeOut(drop)) * (1 + swell))
      key.style.translate = shud ? `${(Math.random() - 0.5) * 2 * shud}px ${(Math.random() - 0.5) * 2 * shud}px` : ''
      const w = clamp(centreWhite)
      key.style.filter = `brightness(${1 + w * 1.6}) drop-shadow(0 0 ${6 + w * 20}px rgba(255,255,255,${0.2 + w * 0.8}))`
    }
    // the ball of energy that gathers round it and cracks
    const ball = els.ball
    if (ball) {
      let op = 0, sc = 0.5
      if (u >= 3.2 && u < 4.2) { op = centreWhite * 0.45; sc = 0.5 + 0.3 * centreWhite } else if (u >= 4.2 && u < 4.8) { const p = (u - 4.2) / 0.6; op = 0.45 + 0.5 * p; sc = 0.8 + 0.5 * p } else if (u >= 4.8 && u < 5.3) { op = 1; sc = 1.3 + (big ? Math.sin(u * 90) * 0.02 : 0) } else if (u >= 5.3) { const p = clamp((u - 5.3) / 0.9); op = 1 - p; sc = 1.3 + 2 * p }
      ball.style.opacity = String(clamp(op)); ball.style.scale = String(sc)
    }
    // the Mega Stone appears above the Key Stone as the white clears
    const mega = els.mega
    if (mega) {
      const p = clamp((u - 5.3) / 1.1)
      mega.style.opacity = String(p)
      mega.style.translate = `0 ${(1 - easeOut(p)) * g.S * 0.04}px`
      mega.style.scale = String(0.8 + 0.2 * easeOut(p))
    }
    // the edges darken before the bang
    if (els.dark) els.dark.style.opacity = String(big ? (u >= 4.2 && u < 5.2 ? Math.min(0.55, (u - 4.2) / 0.6 * 0.55) : 0) : 0)
    // the flash: one only, over the whole screen; the gentle version is a soft light over the altar
    if (big) {
      if (els.flash) els.flash.style.opacity = String(flashAt(u))
      if (els.wash) els.wash.style.opacity = String(u >= 5.34 ? 0.4 * clamp(1 - (u - 5.34) / 1.1) : 0)
      if (els.shake) { const k = shakeAt(u - 5.2, g.S); els.shake.style.translate = k.x || k.y ? `${k.x}px ${k.y}px` : '' }
    } else if (els.wash) {
      els.wash.style.opacity = String(u >= 5.2 ? 0.75 * clamp(1 - (u - 5.2) / 1.2) : 0)
    }
    void dt
    return true
  }

  /** The sequence ran its course. */
  private finish(): void {
    this.seq = null
    // the sockets are empty now: the water the shards poured must not come back when the loop next looks at the placing state
    this.fill = [0, 0, 0]; this.from = [0, 0, 0]; this.to = [0, 0, 0]; this.lit = [0, 0, 0]; this.colour = [null, null, null]
    this.d.glow?.set({ ...CALM })
    this.wells([0, 0, 0], [0, 0, 0, 0], 0)
    this.d.onDone()
    this.cleanup()
  }

  /** Take every inline style the sequence set off the elements, so the stylesheet is in charge again. */
  private cleanup(): void {
    const els = this.d.els()
    for (const el of els.shards) if (el) { el.style.animation = ''; el.style.translate = ''; el.style.scale = ''; el.style.rotate = ''; el.style.opacity = ''; el.style.filter = '' }
    for (const el of [els.key, els.ball, els.mega, els.dark, els.wash]) if (el) { el.style.opacity = ''; el.style.scale = ''; el.style.translate = ''; el.style.filter = '' }
    if (els.flash) els.flash.style.opacity = ''
    if (els.shake) els.shake.style.translate = ''
  }
}
