// The Today scene as a place (UI-AUDIT-2026-11-04 §5): a pixel diorama drawn at its own small resolution and
// enlarged by a whole number, so every pixel of the place is the same size as every pixel of the Pokemon.
//
// Pure: no browser in here. It draws through a tiny canvas-like interface and only ever with whole-pixel
// rectangles (tools/stage.test.mjs records every one and fails on a fraction). What the sky looks like
// still comes from sky.ts (the palette by the minute, the sun and moon on their arc, the weather from
// last night's sleep); this file decides how a place is drawn with it.
//
// Layers, back to front:  sky in bands · stars · sun or moon · clouds · far ridges · tree line · ground
//   · the two pads  (paintBack)  ·  then the Pokemon (the page draws them)  ·  then foreground grass · rain
//   · the place's small life  (paintFront)
import { THEME_CLOCK, bodyAt, darkAt, paletteAt, weatherOf, type Palette, type Sky } from './sky.ts'

// ── what draws ─────────────────────────────────────────────────────────────
/** The part of a canvas this needs. A recording stand-in satisfies it in the tests. */
export interface Ctx { fillStyle: unknown; globalAlpha: number; fillRect(x: number, y: number, w: number, h: number): void; clearRect(x: number, y: number, w: number, h: number): void }

// ── the places ─────────────────────────────────────────────────────────────
export type Biome = 'meadow' | 'shore' | 'marsh' | 'canyon' | 'volcano' | 'snow' | 'cliff' | 'pass' | 'plain' | 'ruins' | 'flowers' | 'steel' | 'cave'
const TYPE_BIOME: Record<string, Biome> = {
  Normal: 'meadow', Grass: 'meadow', Bug: 'meadow', Water: 'shore', Poison: 'marsh', Rock: 'canyon', Ground: 'canyon', Fighting: 'canyon',
  Fire: 'volcano', Ice: 'snow', Flying: 'cliff', Dragon: 'pass', Electric: 'plain', Ghost: 'ruins', Dark: 'ruins', Psychic: 'ruins', Fairy: 'flowers', Steel: 'steel',
}
/** Where a wild Pokemon is met: its first type's place, unless that type is Normal and it has a second (a Pidgey is met on a cliff). */
export function biomeOf(t: string, t2?: string | null): Biome {
  const a = TYPE_BIOME[t] ?? 'meadow'
  return a === 'meadow' && t === 'Normal' && t2 && TYPE_BIOME[t2] ? TYPE_BIOME[t2] : a
}
/** The places drawn so far. Any other is drawn as the meadow until it is built. */
export const BUILT: readonly Biome[] = ['meadow', 'cave']

// ── where things stand ─────────────────────────────────────────────────────
export interface Spot { x: number; y: number; rx: number; ry: number }
export interface Layout { w: number; h: number; horizon: number; foe: Spot; me: Spot }
/** Where the horizon and the two pads are on a stage of `w` x `h` pixels: the wild Pokemon far and right, the partner near and left. */
export function layoutFor(w: number, h: number): Layout {
  const horizon = Math.round(h * 0.5)
  const frx = Math.max(14, Math.round(w * 0.13)), mrx = Math.max(22, Math.round(w * 0.22)), mry = Math.max(6, Math.round(mrx * 0.28))
  return {
    w, h, horizon,
    foe: { x: Math.round(w * 0.7), y: Math.round(h * 0.6), rx: frx, ry: Math.max(4, Math.round(frx * 0.3)) },
    me: { x: Math.round(w * 0.27), y: Math.min(Math.round(h * 0.87), h - mry - 4), rx: mrx, ry: mry },
  }
}

// ── light on the Pokemon ───────────────────────────────────────────────────
/** How the Pokemon are lit at a minute of the day under a sky this gloomy: brightness and saturation (multipliers) and warmth (0 to 1, the low sun). */
export function lightAt(minutes: number, gloom = 0): { b: number; s: number; warm: number } {
  const dark = darkAt(minutes)
  const h = (((minutes % 1440) + 1440) % 1440) / 60
  const bump = (at: number) => Math.max(0, 1 - Math.abs(h - at) / 1.6)
  const warm = Math.min(1, bump(7) + bump(18.9)) * (1 - gloom)
  return { b: 1 - 0.42 * dark - 0.14 * gloom, s: 1 - 0.32 * dark - 0.3 * gloom, warm }
}
/** The CSS filter for that light (the page sets it on both Pokemon). */
export const litFilter = (l: { b: number; s: number; warm: number }): string =>
  `brightness(${l.b.toFixed(3)}) saturate(${l.s.toFixed(3)}) sepia(${(l.warm * 0.22).toFixed(3)})`

// ── colour ─────────────────────────────────────────────────────────────────
type RGB = [number, number, number]
const rgb = (c: string): RGB => {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim())
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as RGB
  const n = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c)
  return n ? [Number(n[1]), Number(n[2]), Number(n[3])] : [128, 128, 128]
}
const css = ([r, g, b]: RGB): string => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
export const mix = (a: string, b: string, t: number): string => { const x = rgb(a), y = rgb(b); return css([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB) }
const shade = (c: string, f: number): string => mix(c, f < 0 ? '#000000' : '#ffffff', Math.abs(f))

/** A small seeded random number source, so a place is the same every time it is drawn for the same Pokemon. */
export function rng(seed: string): () => number {
  let a = [...seed].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0, 2166136261)
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// ── shapes, in whole pixels ────────────────────────────────────────────────
const rect = (g: Ctx, x: number, y: number, w: number, h: number, c: string) => { if (w <= 0 || h <= 0) return; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)) }
const px = (g: Ctx, x: number, y: number, c: string) => rect(g, x, y, 1, 1, c)
/** A filled ellipse, row by row. */
function ellipse(g: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  cx = Math.round(cx); cy = Math.round(cy); rx = Math.max(0, Math.round(rx)); ry = Math.max(0, Math.round(ry))
  g.fillStyle = c
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5)))))
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1)
  }
}
/** The game's pixel cloud (the same shape Sky.tsx drew), rows of [from, to) on a 16 x 5 grid, enlarged by `s`. */
const CLOUD: [number, number][] = [[7, 10], [5, 12], [4, 14], [2, 15], [3, 14]]
function cloud(g: Ctx, x: number, y: number, s: number, c: string, under: string) {
  CLOUD.forEach(([a, b], row) => rect(g, x + a * s, y + row * s, (b - a) * s, s, row === CLOUD.length - 1 ? under : c))
}

// ── everything the stage needs to know ─────────────────────────────────────
export interface StageState {
  lay: Layout
  /** the minute of the day the sky is drawn for */
  minutes: number
  /** last night's sleep score, or null (a fair sky that says nothing) */
  score: number | null
  /** the scene the player bought ('theme-beach', 'theme-cave', 'theme-night'), or '' */
  theme: string
  biome: Biome
  /** the wild Pokemon's form: the place's flowers and stars are seeded by it */
  seed: string
  /** the partner's type colour: its pad is tinted with it */
  partnerTc?: string
  aura?: 'mega' | 'gmax' | null
  /** frames since the scene opened (8 a second); 0 with reduced motion */
  t: number
}

/** The palette and weather a state is drawn with: a bought scene pins the clock (sky.ts), a cave has its own. */
export function lookOf(s: StageState): { p: Palette; dark: number; wx: Sky; minutes: number; cave: boolean } {
  const cave = s.theme in THEME_CLOCK && THEME_CLOCK[s.theme] === null
  const minutes = s.theme in THEME_CLOCK && !cave ? (THEME_CLOCK[s.theme] as number) : s.minutes
  if (cave) return { p: CAVE, dark: 0.55, wx: { weather: 'fair', clouds: 0, gloom: 0, rain: false, label: 'A cave' }, minutes, cave }
  return { p: paletteAt(minutes), dark: darkAt(minutes), wx: weatherOf(s.score), minutes, cave }
}
const CAVE: Palette = { sky1: '#211d33', sky2: '#4a4466', far: '#5c5470', ground: '#8a7a6a', ground2: '#74675a', pad: '#9a8a78', pad2: '#6e6254' }

// ── the back: everything behind the Pokemon ────────────────────────────────
export function paintBack(g: Ctx, s: StageState) {
  const { lay, t } = s
  const { w, h, horizon: hy } = lay
  const { p, dark, wx, minutes, cave } = lookOf(s)
  const gmax = s.aura === 'gmax'
  const r = rng(s.seed)
  g.globalAlpha = 1
  g.clearRect(0, 0, w, h)

  // the sky in bands, darkest at the top, each seam dithered
  const N = 6
  const tint = (c: string) => (gmax ? mix(c, '#5a0d26', 0.55) : c)
  const bands = Array.from({ length: N }, (_, i) => tint(mix(p.sky1, p.sky2, i / (N - 1))))
  const bandOf = (y: number) => Math.min(N - 1, Math.floor(Math.pow(y / hy, 1.25) * N))
  for (let y = 0; y < hy; y++) {
    const b = bandOf(y)
    rect(g, 0, y, w, 1, bands[b])
    if (y + 1 < hy && bandOf(y + 1) !== b) for (let x = y % 2; x < w; x += 2) px(g, x, y, bands[b + 1])
  }

  if (cave) {
    // a cave: a rock ceiling with stalactites, and drips of light
    const rock = shade(p.sky1, -0.25)
    rect(g, 0, 0, w, 4, rock)
    for (let x = 0; x < w; x += 6 + Math.floor(r() * 6)) { const len = 3 + Math.floor(r() * 9); for (let i = 0; i < len; i++) rect(g, x + Math.floor(i / 3), 4 + i, Math.max(1, 4 - Math.floor(i / 2)), 1, rock) }
  } else {
    // stars as it darkens, each on its own beat
    if (dark > 0.15) {
      const rs = rng(`${s.seed}:stars`)
      for (let i = 0; i < Math.round(w * 0.22); i++) {
        const x = Math.floor(rs() * w), y = Math.floor(rs() * hy * 0.85), bright = rs() < 0.2, phase = Math.floor(rs() * 12)
        g.globalAlpha = dark * (t && (t + phase) % 14 < 2 ? 0.35 : 1)
        px(g, x, y, '#ffffff')
        if (bright) { g.globalAlpha *= 0.45; px(g, x - 1, y, '#cfe0ff'); px(g, x + 1, y, '#cfe0ff'); px(g, x, y - 1, '#cfe0ff'); px(g, x, y + 1, '#cfe0ff') }
      }
      g.globalAlpha = 1
    }
    // the sun or the moon, on the arc sky.ts gives, in the right third (the wild Pokemon's side)
    const body = bodyAt(minutes)
    const bx = Math.round(w * (0.66 + ((body.x - 8) / 84) * 0.28)), by = Math.min(hy - 6, Math.round(h * (0.1 + ((body.y - 16) / 70) * 0.42)))
    const dim = Math.min(0.75, wx.gloom * 0.7)
    if (body.kind === 'sun') {
      g.globalAlpha = 0.55 * (1 - dim)
      for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const d = Math.hypot(dx, dy); if (d > 5.5 && d <= 8 && (dx + dy) % 2 === 0) px(g, bx + dx, by + dy, '#fff1a8') }
      g.globalAlpha = 1 - dim * 0.85
      ellipse(g, bx, by, 5, 5, '#ffc63a')
      ellipse(g, bx, by, 4, 4, '#ffe680')
      ellipse(g, bx - 1, by - 1, 2, 2, '#fffbe6')
    } else {
      g.globalAlpha = 0.35 * dark * (1 - dim)
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const d = Math.hypot(dx, dy); if (d > 4.5 && d <= 7 && (dx + dy) % 2 === 0) px(g, bx + dx, by + dy, '#dfe6ff') }
      g.globalAlpha = (0.5 + dark * 0.5) * (1 - dim * 0.6)
      ellipse(g, bx, by, 4, 4, '#f2efd2')
      ellipse(g, bx + 2, by - 1, 3, 3, bands[bandOf(by)]) // the shadow side: a crescent
    }
    g.globalAlpha = 1

    // clouds: more and greyer after a poor night; they drift a pixel at a time
    const cc = mix(mix('#ffffff', '#6b7390', wx.gloom), '#2c3566', dark * 0.55)
    const cu = gmax ? '#3a0716' : shade(cc, -0.12)
    for (let i = 0; i < wx.clouds; i++) {
      const big = i % 2 === 0, sc = big ? 2 : 1, span = w + 40
      const x0 = Math.floor(((i * 53) % 97) / 97 * span), speed = big ? 0.25 : 0.12
      const x = ((x0 + Math.floor(t * speed)) % span) - 34
      cloud(g, x, Math.round(hy * (0.08 + ((i * 13) % 34) / 100)), sc, gmax ? '#7a1430' : cc, cu)
    }
  }

  // far ridges, paler with distance
  const ridge = (base: number, amp: number, f1: number, f2: number, ph: number, c: string) => {
    for (let x = 0; x < w; x++) { const top = Math.round(base - amp * (0.6 * Math.sin(x * f1 + ph) + 0.4 * Math.sin(x * f2 + ph * 1.7))); rect(g, x, top, 1, hy - top, c) }
  }
  ridge(hy - 12, 8, 0.035, 0.11, r() * 6, tint(mix(p.far, p.sky2, cave ? 0.2 : 0.5)))
  ridge(hy - 6, 4, 0.06, 0.19, r() * 6, tint(mix(p.far, p.sky2, cave ? 0.05 : 0.22)))

  // the tree line: round crowns lit on the side the sun or moon is on (a cave has rock spires)
  const trunkline = cave ? shade(p.far, -0.2) : mix(p.far, '#0b2a1c', 0.38)
  const lit = cave ? shade(p.far, 0.08) : mix(trunkline, p.sky2, 0.3)
  const side = bodyAt(minutes).x > 50 ? 1 : -1
  rect(g, 0, hy - 2, w, 2, trunkline)
  for (let x = -4; x < w + 4; x += 4 + Math.floor(r() * 5)) {
    if (cave) { const ht = 4 + Math.floor(r() * 8); for (let i = 0; i < ht; i++) rect(g, x - Math.floor((ht - i) / 4), hy - i - 1, 1 + Math.floor((ht - i) / 2), 1, trunkline); continue }
    if (r() < 0.22) {
      // a pine
      const ht = 7 + Math.floor(r() * 6)
      for (let i = 0; i < ht; i++) { const half = Math.floor((ht - i) / 2.4); rect(g, x - half, hy - 1 - i, half * 2 + 1, 1, trunkline); if (side > 0 && half > 0) px(g, x + half, hy - 1 - i, lit); else if (half > 0) px(g, x - half, hy - 1 - i, lit) }
      continue
    }
    const cr = 3 + Math.floor(r() * 3), cy = hy - cr - Math.floor(r() * 2)
    ellipse(g, x, cy, cr, cr, trunkline)
    for (let dy = -cr; dy <= -1; dy++) { const half = Math.floor(cr * Math.sqrt(1 - (dy * dy) / ((cr + 0.5) * (cr + 0.5)))); px(g, x + side * half, cy + dy, lit); if (dy === -cr + 1) px(g, x + side * (half - 1), cy + dy - 1, lit) }
  }

  // two big trees at the left edge, behind the partner: the place has a near side. Nearer than the hedge, so
  // darker and more saturated, each crown a cluster of rounds lit on the sun's side, with leaf speckle.
  if (!cave) {
    const big = rng(`${s.seed}:frame`)
    const crown = shade(mix(p.far, '#0d3a1e', 0.45), -0.12), crownLit = mix(crown, p.ground, 0.45), speck = mix(crown, p.ground, 0.22)
    for (let i = 0, x = Math.round(w * 0.04); i < 2; i++, x += Math.round(w * 0.1) + Math.floor(big() * 6)) {
      const cr = Math.round(h * (0.075 + big() * 0.03)), cy = hy - Math.round(cr * 1.6) + i * 3
      rect(g, x - 1, cy, 3, hy - cy + 2, shade(crown, -0.35)) // the trunk
      const blobs: [number, number, number][] = [[0, 0, cr], [-Math.round(cr * 0.7), Math.round(cr * 0.45), Math.round(cr * 0.75)], [Math.round(cr * 0.7), Math.round(cr * 0.4), Math.round(cr * 0.7)], [0, -Math.round(cr * 0.55), Math.round(cr * 0.7)]]
      for (const [dx, dy, br] of blobs) ellipse(g, x + dx, cy + dy, br, br, crown)
      for (const [dx, dy, br] of blobs) {
        for (let yy = -br; yy <= 0; yy++) { const half = Math.floor(br * Math.sqrt(1 - (yy * yy) / ((br + 0.5) * (br + 0.5)))); px(g, x + dx + side * half, cy + dy + yy, crownLit); if (half > 1) px(g, x + dx + side * (half - 1), cy + dy + yy, crownLit) }
        for (let n = 0; n < br * 2; n++) { const a = big() * Math.PI * 2, rr = big() * (br - 1); px(g, Math.round(x + dx + Math.cos(a) * rr), Math.round(cy + dy + Math.sin(a) * rr), speck) }
      }
    }
  }

  // the ground: paler and smaller-striped toward the horizon, like a mown field seen from a hill
  for (let y = hy; y < h; y++) {
    const d = (y - hy) / Math.max(1, h - hy)
    let c = mix(mix(p.ground2, p.far, 0.35), p.ground, Math.pow(d, 0.7))
    if (Math.floor(Math.log2(y - hy + 2) * 2.4) % 2) c = shade(c, -0.07)
    if (y - hy < 2) c = mix(c, p.sky2, 0.25)
    rect(g, 0, y, w, 1, tint(c))
  }
  // flowers (or pebbles in a cave): tiny far off, with a stem near
  const fl = rng(`${s.seed}:flowers`)
  const petals = cave ? ['#a39787', '#6f6458', '#b8ad9c'] : ['#ffffff', '#ffe066', '#ff9ec4', '#9cc8ff']
  for (let i = 0; i < Math.round(w * 0.55); i++) {
    const y = hy + 2 + Math.floor(Math.pow(fl(), 0.6) * (h - hy - 3)), x = Math.floor(fl() * w)
    const c = mix(petals[Math.floor(fl() * petals.length)], p.ground, 0.15 + dark * 0.45)
    if ((y - hy) / (h - hy) > 0.45) { rect(g, x, y, 2, 1, c); if (!cave) px(g, x, y + 1, shade(p.ground, -0.25)) } else px(g, x, y, c)
  }

  // a few bushes in the middle distance, smaller the farther they are, kept off the wild Pokemon's pad
  if (!cave) {
    const bu = rng(`${s.seed}:bush`)
    for (let i = 0; i < 4; i++) {
      const y = hy + 3 + Math.floor(bu() * (lay.foe.y - hy - 2)), d = (y - hy) / (h - hy)
      const x = Math.floor(bu() * w), br = 2 + Math.round(d * 5)
      if (Math.abs(x - lay.foe.x) < lay.foe.rx + br + 4) continue
      const bc = tint(mix(shade(p.ground, -0.32), p.far, 0.3 - d * 0.3))
      ellipse(g, x, y - br + 1, br + 1, br, bc)
      for (let dx = -br; dx <= br; dx += 2) px(g, x + dx + (side > 0 ? 1 : 0), y - br * 2 + 1 + Math.round(Math.abs(dx) / 2), tint(mix(bc, p.sky2, 0.22)))
    }
  }

  // the pads: turf discs with a lip and a rim, tufts on top, a shadow where the Pokemon stands
  const padColours = (tc?: string) => {
    // the partner's type tints its pad: a touch on the turf, more on the rim and side, so the grass stays grass
    const top = mix(p.pad, '#ffffff', 0.1), low = tc ? mix(p.pad2, tc, 0.4) : p.pad2
    return { top: tint(tc ? mix(top, tc, 0.14) : top), rim: tint(shade(low, -0.18)), lip: tint(shade(low, -0.4)), hl: tint(mix(top, '#ffffff', 0.16)), tuft: tint(shade(p.pad, -0.25)), ground: tint(shade(p.ground, -0.22)) }
  }
  pad(g, lay.foe, padColours(), rng(`${s.seed}:foe`), cave)
  pad(g, lay.me, padColours(s.partnerTc), rng(`${s.seed}:me`), cave)

  // a poor night's gloom over the whole place
  if (wx.gloom > 0) { g.globalAlpha = wx.gloom * 0.3; rect(g, 0, 0, w, h, '#283250'); g.globalAlpha = 1 }
}

function pad(g: Ctx, sp: Spot, c: { top: string; rim: string; lip: string; hl: string; tuft: string; ground: string }, r: () => number, cave: boolean) {
  const { x, y, rx, ry } = sp
  ellipse(g, x, y + ry + 2, rx + 1, Math.max(1, Math.round(ry / 3)), c.ground) // its shadow on the ground
  ellipse(g, x, y + 2, rx, ry, c.lip) // the side of the disc
  ellipse(g, x, y, rx, ry, c.rim)
  ellipse(g, x, y, rx - 1, ry - 1, c.top)
  ellipse(g, x - Math.round(rx * 0.22), y - Math.round(ry * 0.3), Math.round(rx * 0.45), Math.max(1, Math.round(ry * 0.32)), c.hl)
  if (!cave) {
    for (let i = 0; i < Math.round(rx * 0.9); i++) {
      const a = Math.PI * (1 + r()), tx = Math.round(x + Math.cos(a) * (rx - 1)), ty = Math.round(y + Math.sin(a) * (ry - 1))
      rect(g, tx, ty - 2, 1, 2, c.tuft)
      if (r() < 0.4) px(g, tx + 1, ty - 1, c.tuft)
    }
  }
  ellipse(g, x, y, Math.round(rx * 0.5), Math.max(1, Math.round(ry * 0.45)), shade(c.top, -0.3)) // where the Pokemon stands
}

// ── the front: what stands between you and the Pokemon ─────────────────────
export function paintFront(g: Ctx, s: StageState) {
  const { lay, t } = s
  const { w, h, horizon: hy } = lay
  const { p, dark, wx, cave } = lookOf(s)
  g.globalAlpha = 1
  g.clearRect(0, 0, w, h)

  // foreground grass: tall at the left edge, low across the middle, so the near pad sits in the field, not on it
  const blade = shade(p.ground, -0.3 - 0.2 * dark), tip = shade(p.ground, -0.06 - 0.2 * dark)
  if (!cave) {
    const gr = rng('foreground')
    for (let x = 0; x < w; x++) {
      const edge = x < w * 0.1 ? 1 - x / (w * 0.1) : 0
      const ht = Math.round(2 + gr() * 3 + edge * (6 + gr() * 8))
      if (gr() < 0.35 && edge === 0) continue
      const sway = t && ht > 6 ? Math.round(Math.sin(t * 0.18 + x * 0.7)) : 0
      rect(g, x, h - ht + 1, 1, ht - 1, blade)
      px(g, x + sway, h - ht, tip)
    }
  } else {
    // a cave: a rock lip along the bottom
    for (let x = 0; x < w; x++) { const ht = 2 + Math.round(2 * Math.sin(x * 0.3) + 1.5 * Math.sin(x * 0.11)); rect(g, x, h - ht, 1, ht, shade(p.ground, -0.45)) }
  }

  // rain after a very poor night: short slanted streaks falling a few pixels a frame
  if (wx.rain) {
    const rr = rng('rain')
    g.globalAlpha = 0.55
    for (let i = 0; i < Math.round(w * 0.5); i++) {
      const x0 = rr() * (w + 20), y0 = rr() * h
      const x = Math.round(((x0 - t * 2) % (w + 20) + (w + 20)) % (w + 20)) - 10, y = Math.round((y0 + t * 5) % (h - 2))
      px(g, x, y, '#c4d6ff'); px(g, x - 1, y + 1, '#c4d6ff'); px(g, x - 1, y + 2, '#c4d6ff')
    }
    g.globalAlpha = 1
  }

  // the place's small life: fireflies at night, butterflies by a dry day (the meadow's), dust in a cave
  const life = rng(`${s.seed}:life`)
  if (cave) {
    g.globalAlpha = 0.5
    for (let i = 0; i < 6; i++) { const x = Math.round(life() * w), y = Math.round((life() * h * 0.8 + t * 0.4 * (1 + i % 2)) % (h * 0.9)); px(g, x, y, '#d8cfe8') }
    g.globalAlpha = 1
  } else if (dark > 0.45 && !wx.rain) {
    for (let i = 0; i < 7; i++) {
      const x0 = life() * w, y0 = hy + life() * (h - hy) * 0.7
      const on = !t || (t + i * 5) % 24 < 16
      if (!on) continue
      const x = Math.round(x0 + 3 * Math.sin(t * 0.05 + i)), y = Math.round(y0 + 2 * Math.sin(t * 0.07 + i * 2))
      g.globalAlpha = 0.35; px(g, x - 1, y, '#e8ff7a'); px(g, x + 1, y, '#e8ff7a'); px(g, x, y - 1, '#e8ff7a'); px(g, x, y + 1, '#e8ff7a')
      g.globalAlpha = 1; px(g, x, y, '#f4ffb0')
    }
  } else if (dark < 0.3 && !wx.rain && wx.gloom < 0.5) {
    for (let i = 0; i < 2; i++) {
      const x0 = w * (0.15 + life() * 0.45), y0 = hy + (h - hy) * (0.15 + life() * 0.3)
      const x = Math.round(x0 + 10 * Math.sin(t * 0.03 + i * 2.1)), y = Math.round(y0 + 4 * Math.sin(t * 0.05 + i * 3))
      const c = i ? '#ffe066' : '#ffffff', open = !t || t % 4 < 2
      px(g, x, y, shade(c, -0.4))
      if (open) { px(g, x - 1, y - 1, c); px(g, x + 1, y - 1, c) } else { px(g, x - 1, y, c); px(g, x + 1, y, c) }
    }
  }
}
