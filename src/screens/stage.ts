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
export const BUILT: readonly Biome[] = ['meadow', 'flowers', 'shore', 'marsh', 'canyon', 'volcano', 'snow', 'cliff', 'pass', 'plain', 'ruins', 'steel', 'cave']

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
/** The top half of an ellipse, standing on y (a rock on the stage's bottom edge draws nothing below it). */
function dome(g: Ctx, cx: number, y: number, rx: number, ry: number, c: string) {
  cx = Math.round(cx); y = Math.round(y); rx = Math.max(0, Math.round(rx)); ry = Math.max(0, Math.round(ry))
  g.fillStyle = c
  for (let dy = -ry; dy <= 0; dy++) { const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))))); g.fillRect(cx - half, y + dy, half * 2 + 1, 1) }
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

// ── each place ─────────────────────────────────────────────────────────────
// A place is a set of choices over the same layers. Its colours are day colours: they are moved toward the
// sky's own light and darkened with the night (tod), so dawn, dusk and night work in every place as they do in
// the meadow, whose colours are sky.ts's palette itself.
type Ridge = 'hills' | 'peaks' | 'mesas' | 'volcano' | 'skyline' | 'none'
type Line = 'trees' | 'blossoms' | 'pines' | 'snowpines' | 'reeds' | 'rocks' | 'columns' | 'pylons' | 'girders' | 'none'
type Frame = 'trees' | 'blossom' | 'palm' | 'deadtree' | 'boulder' | 'snowpine' | 'pillar' | 'pylon' | 'tank' | 'crag' | 'none'
type Floor = 'stripes' | 'ripples' | 'cracks' | 'lava' | 'snow' | 'puddles' | 'tiles' | 'plates' | 'cloudsea' | 'scree'
type PadKind = 'turf' | 'sand' | 'rock' | 'snow' | 'stone' | 'metal' | 'pillar'
type Fore = 'grass' | 'reeds' | 'rocks' | 'drift' | 'dune' | 'pipe' | 'none'
type Life = 'meadow' | 'petals' | 'gulls' | 'marsh' | 'dust' | 'embers' | 'snow' | 'wind' | 'sparks' | 'wisps' | 'steam'
interface Place {
  /** day colours; none for the meadow, which is the sky's palette */
  colours?: { far: string; ground: string; ground2: string; pad: string; pad2: string }
  /** a haze over the sky: its colour and how much */
  haze?: [string, number]
  ridge: Ridge; sea?: boolean; line: Line; frame: Frame; floor: Floor
  /** small things on the ground (flowers, shells, pebbles), how many for each pixel of width, and whether they have stems */
  dots: string[]; dotRate: number; stems?: boolean
  bushes?: boolean; pad: PadKind; fore: Fore; life: Life
}
const PLACES: Record<Exclude<Biome, 'cave'>, Place> = {
  meadow: { ridge: 'hills', line: 'trees', frame: 'trees', floor: 'stripes', dots: ['#ffffff', '#ffe066', '#ff9ec4', '#9cc8ff'], dotRate: 0.55, stems: true, bushes: true, pad: 'turf', fore: 'grass', life: 'meadow' },
  flowers: { colours: { far: '#7fae78', ground: '#a6d884', ground2: '#93c674', pad: '#b4e08e', pad2: '#7fb064' }, haze: ['#ffc8de', 0.12], ridge: 'hills', line: 'blossoms', frame: 'blossom', floor: 'stripes', dots: ['#ff9ec4', '#ffffff', '#ffd1e8', '#ffe066', '#c8a8ff', '#ff7aa8'], dotRate: 1.4, stems: true, bushes: true, pad: 'turf', fore: 'grass', life: 'petals' },
  shore: { colours: { far: '#4f9ccc', ground: '#ecdaa6', ground2: '#dcc58c', pad: '#f3e4b6', pad2: '#c9ab6e' }, ridge: 'none', sea: true, line: 'none', frame: 'palm', floor: 'ripples', dots: ['#ffffff', '#ffc9b0', '#f2e6c8'], dotRate: 0.18, pad: 'sand', fore: 'dune', life: 'gulls' },
  marsh: { colours: { far: '#4c6150', ground: '#6f8350', ground2: '#5a6d42', pad: '#829456', pad2: '#57683b' }, haze: ['#a7b89a', 0.15], ridge: 'hills', line: 'reeds', frame: 'deadtree', floor: 'puddles', dots: ['#c8b8e8', '#e8e0a0'], dotRate: 0.25, stems: true, bushes: true, pad: 'turf', fore: 'reeds', life: 'marsh' },
  canyon: { colours: { far: '#b86a4c', ground: '#d6a068', ground2: '#c48a56', pad: '#ddac78', pad2: '#a66a42' }, haze: ['#f0b080', 0.15], ridge: 'mesas', line: 'rocks', frame: 'boulder', floor: 'cracks', dots: ['#a8744a', '#e8c49a', '#8a5a3a'], dotRate: 0.4, pad: 'rock', fore: 'rocks', life: 'dust' },
  volcano: { colours: { far: '#5e3c3a', ground: '#544849', ground2: '#43393a', pad: '#6a5f5c', pad2: '#3c3234' }, haze: ['#c4663f', 0.3], ridge: 'volcano', line: 'rocks', frame: 'boulder', floor: 'lava', dots: ['#ff7a2a', '#ffb347', '#6e6260'], dotRate: 0.3, pad: 'rock', fore: 'rocks', life: 'embers' },
  snow: { colours: { far: '#a9b8d6', ground: '#eef3fb', ground2: '#dde6f4', pad: '#f8fbff', pad2: '#c4d1e8' }, haze: ['#dfe8ff', 0.15], ridge: 'peaks', line: 'snowpines', frame: 'snowpine', floor: 'snow', dots: ['#ffffff', '#cfe0ff'], dotRate: 0.5, pad: 'snow', fore: 'drift', life: 'snow' },
  cliff: { colours: { far: '#9fb6d8', ground: '#e8eef8', ground2: '#c9d6ea', pad: '#8fcf78', pad2: '#5f8f4a' }, ridge: 'none', line: 'none', frame: 'crag', floor: 'cloudsea', dots: [], dotRate: 0, pad: 'pillar', fore: 'none', life: 'wind' },
  pass: { colours: { far: '#6f7ea2', ground: '#8e937c', ground2: '#7a7f6a', pad: '#a09f88', pad2: '#6c6b5a' }, ridge: 'peaks', line: 'pines', frame: 'boulder', floor: 'scree', dots: ['#b8b4a0', '#6e6c60', '#d8d4c4'], dotRate: 0.5, pad: 'rock', fore: 'rocks', life: 'wind' },
  plain: { colours: { far: '#93a06c', ground: '#d4c46c', ground2: '#bcac5c', pad: '#dccc7c', pad2: '#a8984a' }, haze: ['#fff0b0', 0.1], ridge: 'hills', line: 'pylons', frame: 'pylon', floor: 'stripes', dots: ['#fff4a0', '#ffffff', '#f2d060'], dotRate: 0.4, stems: true, bushes: true, pad: 'turf', fore: 'grass', life: 'sparks' },
  ruins: { colours: { far: '#5e5a78', ground: '#918da4', ground2: '#7c7894', pad: '#aaa6bc', pad2: '#6e6a86' }, haze: ['#7a6aaa', 0.18], ridge: 'hills', line: 'columns', frame: 'pillar', floor: 'tiles', dots: ['#7f9a6a', '#a7b48a'], dotRate: 0.35, pad: 'stone', fore: 'rocks', life: 'wisps' },
  steel: { colours: { far: '#5d6678', ground: '#8c95a5', ground2: '#7a8393', pad: '#a6afbe', pad2: '#6b7484' }, haze: ['#9aa0ac', 0.22], ridge: 'skyline', line: 'girders', frame: 'tank', floor: 'plates', dots: ['#c8ced8', '#5a6272'], dotRate: 0.2, pad: 'metal', fore: 'pipe', life: 'steam' },
}
/** The place a state is drawn as: its own if built, the meadow if not. */
const placeOf = (b: Biome): Place => PLACES[(b === 'cave' || !BUILT.includes(b) ? 'meadow' : b) as Exclude<Biome, 'cave'>]

// ── the back: everything behind the Pokemon ────────────────────────────────
export function paintBack(g: Ctx, s: StageState) {
  const { lay, t } = s
  const { w, h, horizon: hy } = lay
  const look = lookOf(s)
  const { dark, wx, minutes, cave } = look
  const place = placeOf(s.biome)
  // the place's colours at this hour (the meadow's are the palette as it is)
  const tod = (c: string) => mix(mix(c, look.p.sky2, 0.1), '#121a3d', dark * 0.6)
  const p: Palette = cave || !place.colours ? look.p : { sky1: look.p.sky1, sky2: look.p.sky2, far: tod(place.colours.far), ground: tod(place.colours.ground), ground2: tod(place.colours.ground2), pad: tod(place.colours.pad), pad2: tod(place.colours.pad2) }
  const gmax = s.aura === 'gmax'
  const haze = !cave && place.haze ? place.haze : null
  const r = rng(s.seed)
  g.globalAlpha = 1
  g.clearRect(0, 0, w, h)

  // the sky in bands, darkest at the top, each seam dithered
  const N = 6
  const tint = (c: string) => (gmax ? mix(c, '#5a0d26', 0.55) : c)
  const bands = Array.from({ length: N }, (_, i) => tint(haze ? mix(mix(p.sky1, p.sky2, i / (N - 1)), haze[0], haze[1] * (1 - dark * 0.5)) : mix(p.sky1, p.sky2, i / (N - 1))))
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

  const side = bodyAt(minutes).x > 50 ? 1 : -1
  if (cave || place.ridge === 'hills') {
    // far ridges, paler with distance
    const ridge = (base: number, amp: number, f1: number, f2: number, ph: number, c: string) => {
      for (let x = 0; x < w; x++) { const top = Math.round(base - amp * (0.6 * Math.sin(x * f1 + ph) + 0.4 * Math.sin(x * f2 + ph * 1.7))); rect(g, x, top, 1, hy - top, c) }
    }
    ridge(hy - 12, 8, 0.035, 0.11, r() * 6, tint(mix(p.far, p.sky2, cave ? 0.2 : 0.5)))
    ridge(hy - 6, 4, 0.06, 0.19, r() * 6, tint(mix(p.far, p.sky2, cave ? 0.05 : 0.22)))
  } else drawRidge(g, place.ridge, lay, p, tint, r, t, dark, side)
  if (place.sea && !cave) sea(g, lay, p, t, dark)

  // the tree line: round crowns lit on the side the sun or moon is on (a cave has rock spires)
  const trunkline = cave ? shade(p.far, -0.2) : mix(p.far, '#0b2a1c', 0.38)
  const lit = cave ? shade(p.far, 0.08) : mix(trunkline, p.sky2, 0.3)
  if (cave || place.line === 'trees') {
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
  } else drawLine(g, place.line, lay, p, tint, r, side, dark)

  if (!cave && place.frame === 'trees') {
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
  } else if (!cave) drawFrame(g, place.frame, lay, p, tint, rng(`${s.seed}:frame`), side, dark, t)

  if (cave || place.floor === 'stripes') {
    // the ground: paler and smaller-striped toward the horizon, like a mown field seen from a hill
    for (let y = hy; y < h; y++) {
      const d = (y - hy) / Math.max(1, h - hy)
      let c = mix(mix(p.ground2, p.far, 0.35), p.ground, Math.pow(d, 0.7))
      if (Math.floor(Math.log2(y - hy + 2) * 2.4) % 2) c = shade(c, -0.07)
      if (y - hy < 2) c = mix(c, p.sky2, 0.25)
      rect(g, 0, y, w, 1, tint(c))
    }
  } else drawFloor(g, place.floor, lay, p, tint, rng(`${s.seed}:floor`), t, dark)

  // flowers (or pebbles in a cave, shells on a beach): tiny far off, with a stem near
  const fl = rng(`${s.seed}:flowers`)
  const petals = cave ? ['#a39787', '#6f6458', '#b8ad9c'] : place.dots
  const stems = !cave && place.stems
  for (let i = 0; i < Math.round(w * (cave ? 0.55 : place.dotRate)); i++) {
    const y = hy + 2 + Math.floor(Math.pow(fl(), 0.6) * (h - hy - 3)), x = Math.floor(fl() * w)
    const c = mix(petals[Math.floor(fl() * petals.length)], p.ground, 0.15 + dark * 0.45)
    if ((y - hy) / (h - hy) > 0.45) { rect(g, x, y, 2, 1, c); if (stems) px(g, x, y + 1, shade(p.ground, -0.25)) } else px(g, x, y, c)
  }

  if (!cave && place.bushes) {
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

  // the pads, each in the place's material; the partner's type tints its own
  const padColours = (tc?: string) => {
    // the partner's type tints its pad: a touch on the top, more on the rim and side, so the place stays the place
    const top = mix(p.pad, '#ffffff', 0.1), low = tc ? mix(p.pad2, tc, 0.4) : p.pad2
    return { top: tint(tc ? mix(top, tc, 0.14) : top), rim: tint(shade(low, -0.18)), lip: tint(shade(low, -0.4)), hl: tint(mix(top, '#ffffff', 0.16)), tuft: tint(shade(p.pad, -0.25)), ground: tint(shade(p.ground, -0.22)), rock: tint(mix(p.far, '#6a5a4c', 0.6)) }
  }
  const kind: PadKind | 'cave' = cave ? 'cave' : place.pad
  pad(g, lay.foe, padColours(), rng(`${s.seed}:foe`), kind, lay.h)
  pad(g, lay.me, padColours(s.partnerTc), rng(`${s.seed}:me`), kind, lay.h)

  // a poor night's gloom over the whole place
  if (wx.gloom > 0) { g.globalAlpha = wx.gloom * 0.3; rect(g, 0, 0, w, h, '#283250'); g.globalAlpha = 1 }
}

type PadColours = { top: string; rim: string; lip: string; hl: string; tuft: string; ground: string; rock: string }
function pad(g: Ctx, sp: Spot, c: PadColours, r: () => number, kind: PadKind | 'cave', h: number) {
  const { x, y, rx, ry } = sp
  if (kind === 'pillar') {
    // a rock pillar out of the clouds, the turf on its top
    const rock = c.rock, rockLit = mix(c.rock, '#ffffff', 0.18), rockDark = shade(c.rock, -0.32)
    const top = Math.round(rx * 0.85), bot = Math.round(rx * 0.55)
    for (let yy = y; yy < h; yy++) {
      const half = Math.round(top + (bot - top) * ((yy - y) / Math.max(1, h - y)))
      rect(g, x - half, yy, half * 2 + 1, 1, rock)
      px(g, x - half, yy, rockLit); px(g, x - half + 1, yy, rockLit)
      rect(g, x + half - 2, yy, 3, 1, rockDark)
      if ((yy * 7 + x) % 11 === 0) rect(g, x - half + 4 + (yy % 5), yy, 3, 1, rockDark)
    }
  } else {
    ellipse(g, x, y + ry + 2, rx + 1, Math.max(1, Math.round(ry / 3)), c.ground) // its shadow on the ground
  }
  ellipse(g, x, y + 2, rx, ry, c.lip) // the side of the disc
  ellipse(g, x, y, rx, ry, c.rim)
  ellipse(g, x, y, rx - 1, ry - 1, c.top)
  ellipse(g, x - Math.round(rx * 0.22), y - Math.round(ry * 0.3), Math.round(rx * 0.45), Math.max(1, Math.round(ry * 0.32)), c.hl)
  if (kind === 'turf' || kind === 'pillar') {
    for (let i = 0; i < Math.round(rx * 0.9); i++) {
      const a = Math.PI * (1 + r()), tx = Math.round(x + Math.cos(a) * (rx - 1)), ty = Math.round(y + Math.sin(a) * (ry - 1))
      rect(g, tx, ty - 2, 1, 2, c.tuft)
      if (r() < 0.4) px(g, tx + 1, ty - 1, c.tuft)
    }
  } else if (kind === 'rock' || kind === 'stone') {
    // cracks across a rock top; a stone slab's seam
    const cr = shade(c.top, -0.28)
    if (kind === 'stone') rect(g, x - rx + 3, y, rx * 2 - 5, 1, cr)
    else for (let i = 0; i < 3; i++) { let cx = Math.round(x - rx * 0.6 + r() * rx * 1.2), cy = Math.round(y - ry * 0.5 + r() * ry); for (let k = 0; k < 4; k++) { px(g, cx, cy, cr); cx += r() < 0.5 ? 1 : -1; cy += r() < 0.4 ? 1 : 0 } }
  } else if (kind === 'metal') {
    // rivets round the rim
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; px(g, Math.round(x + Math.cos(a) * (rx - 2)), Math.round(y + Math.sin(a) * (ry - 1)), shade(c.top, -0.35)) }
  } else if (kind === 'snow' || kind === 'sand') {
    for (let i = 0; i < 5; i++) px(g, Math.round(x - rx * 0.7 + r() * rx * 1.4), Math.round(y - ry * 0.6 + r() * ry * 1.2), kind === 'snow' ? '#ffffff' : shade(c.top, -0.2))
  }
  ellipse(g, x, y, Math.round(rx * 0.5), Math.max(1, Math.round(ry * 0.45)), shade(c.top, -0.3)) // where the Pokemon stands
}

type Tint = (c: string) => string

/** The far skyline of a place that is not hills. */
function drawRidge(g: Ctx, kind: Ridge, lay: Layout, p: Palette, tint: Tint, r: () => number, t: number, dark: number, side: number) {
  const { w, h, horizon: hy } = lay
  const far = tint(mix(p.far, p.sky2, 0.45)), near = tint(mix(p.far, p.sky2, 0.18))
  if (kind === 'peaks') {
    // two rows of mountains; snow on the tops, the sunny flank lighter
    for (const [c, base, hmax, n] of [[far, hy - 4, Math.round(h * 0.26), 4], [near, hy - 1, Math.round(h * 0.17), 6]] as [string, number, number, number][]) {
      const peaks = Array.from({ length: n }, () => ({ x: r() * w, ht: hmax * (0.55 + r() * 0.45) }))
      const flank = mix(c, p.sky2, 0.25), cap = mix('#ffffff', p.sky2, 0.15 + dark * 0.5)
      for (let x = 0; x < w; x++) {
        let top = base, at = peaks[0]
        for (const pk of peaks) { const y = base - pk.ht + Math.abs(x - pk.x) * 1.1; if (y < top) { top = y; at = pk } }
        top = Math.round(top)
        rect(g, x, top, 1, hy - top, (x - at.x) * side > 0 ? flank : c)
        if (base - top > at.ht * 0.7) rect(g, x, top, 1, Math.max(1, Math.round((base - top - at.ht * 0.7) * 0.8)), cap)
      }
    }
  } else if (kind === 'mesas') {
    // flat-topped buttes in layered rock
    for (const [c, base, hmax] of [[far, hy - 2, Math.round(h * 0.2)], [near, hy, Math.round(h * 0.12)]] as [string, number, number][]) {
      let x = Math.floor(-r() * 20)
      while (x < w) {
        const width = 14 + Math.floor(r() * 26), ht = Math.round(hmax * (0.5 + r() * 0.5)), gap = 6 + Math.floor(r() * 18)
        for (let i = 0; i < width; i++) {
          const edge = Math.min(i, width - 1 - i), top = base - ht + Math.max(0, 3 - edge) * 2
          rect(g, x + i, top, 1, hy - top, c)
          for (let yy = top + 3; yy < hy; yy += 4) px(g, x + i, yy, shade(c, -0.12))
        }
        x += width + gap
      }
    }
  } else if (kind === 'volcano') {
    // a low ridge, and the volcano: a cone with a glowing crater and smoke that rolls up
    for (let x = 0; x < w; x++) { const top = Math.round(hy - 3 - 2 * Math.sin(x * 0.08)); rect(g, x, top, 1, hy - top, near) }
    const cx = Math.round(w * 0.32), ht = Math.round(hy * 0.62), crater = 5
    const cone = tint(shade(p.far, -0.1)), coneLit = tint(mix(p.far, p.sky2, 0.15))
    for (let x = cx - Math.round(ht * 1.4); x <= cx + Math.round(ht * 1.4); x++) {
      const d = Math.max(0, Math.abs(x - cx) - crater), top = Math.round(hy - ht + d * 0.72 + (d > 0 ? 0 : 1))
      if (top < hy) rect(g, x, top, 1, hy - top, (x - cx) * side > 0 ? coneLit : cone)
    }
    const glow = 0.6 + 0.4 * Math.sin(t * 0.3)
    g.globalAlpha = 0.7 * glow
    rect(g, cx - crater, hy - ht, crater * 2 + 1, 1, '#ff8a3a')
    for (let x = cx - crater - 2; x <= cx + crater + 2; x += 2) px(g, x, hy - ht - 1, '#ffb05a')
    g.globalAlpha = 0.55
    for (let i = 0; i < 5; i++) { const py = hy - ht - 4 - i * 5 - (t % 5), pxx = cx + Math.round(Math.sin(i * 1.3 + t * 0.05) * (2 + i)); ellipse(g, pxx, py, 2 + i, 1 + Math.round(i / 2), mix('#3a2e30', p.sky2, 0.2 + i * 0.1)) }
    g.globalAlpha = 1
  } else if (kind === 'skyline') {
    // a works: blocks, chimneys, lit windows at night, steam that rises
    let x = Math.floor(-r() * 8)
    while (x < w) {
      const bw = 8 + Math.floor(r() * 16), bh = Math.round(h * (0.06 + r() * 0.14)), top = hy - bh
      rect(g, x, top, bw, bh, far)
      if (r() < 0.45) { const cxh = x + 2 + Math.floor(r() * (bw - 4)), ch = 6 + Math.floor(r() * 10); rect(g, cxh, top - ch, 2, ch, far); g.globalAlpha = 0.45; for (let i = 0; i < 3; i++) ellipse(g, cxh + 1 + i, top - ch - 2 - i * 3 - (t % 3), 1 + i, 1, mix('#d8dce4', p.sky2, 0.4)); g.globalAlpha = 1 }
      if (dark > 0.4) for (let wy = top + 2; wy < hy - 1; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 3) if (((wx * 13 + wy * 7) % 5) < 2) px(g, wx, wy, '#ffd86a')
      x += bw + 1 + Math.floor(r() * 4)
    }
    for (let xx = 0; xx < w; xx++) rect(g, xx, hy - 3, 1, 3, near)
  }
}

/** The sea behind a beach: a band below the horizon with glints that move. */
function sea(g: Ctx, lay: Layout, p: Palette, t: number, dark: number) {
  const { w, horizon: hy } = lay
  const deep = mix(p.far, '#163a66', 0.3), shallow = mix(p.far, '#ffffff', 0.18)
  for (let y = hy - 9; y < hy + 5; y++) rect(g, 0, y, w, 1, mix(deep, shallow, (y - (hy - 9)) / 14))
  const glint = mix('#ffffff', p.sky2, 0.2 + dark * 0.3)
  for (let i = 0; i < Math.round(w / 9); i++) { const y = hy - 8 + ((i * 5) % 12), x = ((i * 23 + Math.floor(t * (0.3 + (i % 3) * 0.2))) % (w + 6)) - 3; rect(g, x, y, 2 + (i % 3), 1, glint) }
  rect(g, 0, hy + 4, w, 1, mix('#ffffff', p.ground, 0.4)) // the wash line
}

/** The line where the place meets the sky, when it is not trees. */
function drawLine(g: Ctx, kind: Line, lay: Layout, p: Palette, tint: Tint, r: () => number, side: number, dark: number) {
  const { w, horizon: hy } = lay
  const base = tint(mix(p.far, '#0b2a1c', 0.3)), lit = tint(mix(base, p.sky2, 0.3))
  if (kind === 'blossoms') {
    rect(g, 0, hy - 2, w, 2, base)
    const pink = tint(mix('#e28ab0', '#2a1a40', dark * 0.6)), pinkLit = tint(mix(pink, '#ffffff', 0.25))
    for (let x = -4; x < w + 4; x += 5 + Math.floor(r() * 5)) { const cr = 3 + Math.floor(r() * 3), cy = hy - cr - 1; ellipse(g, x, cy, cr, cr, r() < 0.4 ? base : pink); px(g, x + side * (cr - 1), cy - cr + 1, pinkLit) }
  } else if (kind === 'pines' || kind === 'snowpines') {
    rect(g, 0, hy - 1, w, 1, base)
    const snow = mix('#ffffff', p.sky2, 0.2 + dark * 0.5)
    for (let x = -3; x < w + 3; x += 3 + Math.floor(r() * 4)) {
      const ht = 6 + Math.floor(r() * 8)
      for (let i = 0; i < ht; i++) { const half = Math.floor((ht - i) / 2.4); rect(g, x - half, hy - 1 - i, half * 2 + 1, 1, base); if (half > 0) px(g, x + side * half, hy - 1 - i, kind === 'snowpines' && i % 3 === 0 ? snow : lit) }
    }
  } else if (kind === 'reeds') {
    for (let x = 0; x < w; x++) { if (r() < 0.45) continue; const ht = 3 + Math.floor(r() * 7); rect(g, x, hy - ht, 1, ht, base); if (r() < 0.25) rect(g, x, hy - ht - 1, 1, 2, tint(shade('#7a5a3a', -dark * 0.5))) }
  } else if (kind === 'rocks') {
    for (let x = -3; x < w + 3; x += 4 + Math.floor(r() * 8)) { const rr = 1 + Math.floor(r() * 3); ellipse(g, x, hy - rr + 1, rr + 1, rr, base); px(g, x + side * rr, hy - rr, lit) }
  } else if (kind === 'columns') {
    rect(g, 0, hy - 1, w, 1, base)
    const stone = tint(mix(p.far, p.sky2, 0.35)), stoneLit = tint(mix(stone, '#ffffff', 0.18))
    for (let x = 2; x < w; x += 8 + Math.floor(r() * 10)) {
      const ht = 6 + Math.floor(r() * 12), broken = r() < 0.5
      rect(g, x, hy - ht, 3, ht, stone); px(g, x + (side > 0 ? 2 : 0), hy - ht, stoneLit)
      if (broken) { px(g, x, hy - ht - 1, stone); px(g, x + 2, hy - ht + 1, mix(stone, p.sky2, 0.5)) } else rect(g, x - 1, hy - ht - 1, 5, 1, stone)
      if (!broken && r() < 0.4) rect(g, x, hy - ht - 2, 12, 2, stone) // a lintel to the next
    }
  } else if (kind === 'pylons') {
    const pole = tint(mix(p.far, '#2a2e3a', 0.5)), spots: number[] = []
    for (let x = Math.floor(r() * 20); x < w + 40; x += 38 + Math.floor(r() * 10)) spots.push(x)
    for (const x of spots) { rect(g, x, hy - 16, 1, 16, pole); rect(g, x - 3, hy - 15, 7, 1, pole); rect(g, x - 2, hy - 12, 5, 1, pole) }
    for (let i = 0; i + 1 < spots.length; i++) { const a = spots[i], b = spots[i + 1]; for (const dy of [15, 12]) for (let x = a; x <= b; x++) { const u = (x - a) / (b - a); px(g, x, hy - dy + Math.round(3 * 4 * u * (1 - u)), pole) } }
  } else if (kind === 'girders') {
    const steel = tint(mix(p.far, '#20242e', 0.4))
    rect(g, 0, hy - 6, w, 1, steel); rect(g, 0, hy - 3, w, 1, steel)
    for (let x = 0; x < w; x += 6) { rect(g, x, hy - 7, 1, 7, steel); px(g, x + 3, hy - 5, steel); px(g, x + 2, hy - 4, steel) }
  }
}

/** The big thing at the near left edge, behind the partner: every place has a near side. */
function drawFrame(g: Ctx, kind: Frame, lay: Layout, p: Palette, tint: Tint, r: () => number, side: number, dark: number, t: number) {
  const { w, h, horizon: hy } = lay
  const x0 = Math.round(w * 0.06)
  const dk = (c: string) => tint(mix(c, '#121a3d', dark * 0.55))
  if (kind === 'blossom') {
    const crown = dk('#d8709c'), lit = dk('#ffc2d8'), speck = dk('#f6a8c4'), trunk = dk('#5a3a3a')
    for (let i = 0, x = x0; i < 2; i++, x += Math.round(w * 0.1) + Math.floor(r() * 6)) {
      const cr = Math.round(h * (0.075 + r() * 0.03)), cy = hy - Math.round(cr * 1.6) + i * 3
      rect(g, x - 1, cy, 3, hy - cy + 2, trunk)
      const blobs: [number, number, number][] = [[0, 0, cr], [-Math.round(cr * 0.7), Math.round(cr * 0.45), Math.round(cr * 0.75)], [Math.round(cr * 0.7), Math.round(cr * 0.4), Math.round(cr * 0.7)], [0, -Math.round(cr * 0.55), Math.round(cr * 0.7)]]
      for (const [dx, dy, br] of blobs) ellipse(g, x + dx, cy + dy, br, br, crown)
      for (const [dx, dy, br] of blobs) { for (let yy = -br; yy <= 0; yy++) { const half = Math.floor(br * Math.sqrt(1 - (yy * yy) / ((br + 0.5) * (br + 0.5)))); px(g, x + dx + side * half, cy + dy + yy, lit) } for (let n = 0; n < br * 2; n++) { const a = r() * Math.PI * 2, rr = r() * (br - 1); px(g, Math.round(x + dx + Math.cos(a) * rr), Math.round(cy + dy + Math.sin(a) * rr), speck) } }
    }
  } else if (kind === 'palm') {
    const trunk = dk('#8a6a44'), ring = dk('#6a4e30'), leaf = dk('#3f8f4a'), leafLit = dk('#6fc070')
    const ht = Math.round(h * 0.34), base = hy + 2
    let x = x0, top = base - ht
    for (let i = 0; i < ht; i++) { const yy = base - i; x = x0 + Math.round(Math.sin(i / ht * 1.3) * 5); rect(g, x, yy, 3, 1, trunk); if (i % 3 === 0) rect(g, x, yy, 3, 1, ring) }
    top = base - ht
    for (let f = 0; f < 6; f++) {
      const a = -Math.PI * 0.95 + f * (Math.PI * 0.9 / 5), len = 10 + Math.floor(r() * 5)
      for (let k = 1; k < len; k++) { const fx = Math.round(x + 1 + Math.cos(a) * k), fy = Math.round(top + Math.sin(a) * k * 0.6 + (k * k) / (len * 1.6)); px(g, fx, fy, k % 3 ? leaf : leafLit); px(g, fx, fy + 1, leaf) }
    }
  } else if (kind === 'deadtree') {
    const bark = dk('#3e3a32')
    const ht = Math.round(h * 0.3)
    rect(g, x0, hy + 2 - ht, 3, ht, bark)
    const branch = (bx: number, by: number, dx: number, len: number) => { for (let k = 0; k < len; k++) px(g, bx + dx * k, by - Math.round(k * 0.7), bark) }
    branch(x0 + 3, hy - ht + 8, 1, 7); branch(x0, hy - ht + 5, -1, 6); branch(x0 + 2, hy - ht + 2, 1, 5); branch(x0 + 1, hy - ht + 14, -1, 4)
  } else if (kind === 'boulder' || kind === 'crag') {
    const rock = tint(shade(p.far, kind === 'crag' ? -0.05 : -0.15)), lit = tint(mix(rock, p.sky2, 0.3)), crack = tint(shade(rock, -0.3))
    if (kind === 'crag') {
      const ht = Math.round(h * 0.45)
      for (let i = 0; i < ht; i++) { const half = Math.round(2 + (ht - i) * 0.18 + Math.sin(i * 0.6) * 1.2); rect(g, x0 - half, h - 1 - i, half * 2 + 1, 1, rock); px(g, x0 + side * half, h - 1 - i, lit) }
    } else {
      const rx = Math.round(w * 0.07), ry = Math.round(rx * 0.75), cy = hy + 1 - ry
      ellipse(g, x0 + 2, cy, rx, ry, rock)
      ellipse(g, x0 + 2 + side * Math.round(rx * 0.3), cy - Math.round(ry * 0.35), Math.round(rx * 0.55), Math.round(ry * 0.45), lit)
      for (let k = 0; k < 5; k++) px(g, x0 + 2 - side * 2 + k % 2, cy - 2 + k, crack)
      ellipse(g, x0 + rx + 4, hy - 1, Math.round(rx * 0.45), Math.round(ry * 0.4), rock)
    }
  } else if (kind === 'snowpine') {
    const needle = dk('#2f5a4a'), snow = tint(mix('#ffffff', p.sky2, 0.15 + dark * 0.5))
    for (const [x, ht] of [[x0, Math.round(h * 0.34)], [x0 + Math.round(w * 0.09), Math.round(h * 0.26)]]) {
      rect(g, x - 1, hy - 2, 3, 4, dk('#4a3a2a'))
      for (let i = 0; i < ht; i++) { const half = Math.floor(((ht - i) % Math.round(ht / 3) + (ht - i) / 3) / 1.6); rect(g, x - half, hy - 2 - i, half * 2 + 1, 1, needle); if (i % 4 === 1 && half > 1) rect(g, side > 0 ? x + 1 : x - half, hy - 2 - i, Math.ceil(half / 2), 1, snow) }
    }
  } else if (kind === 'pillar') {
    const stone = tint(mix(p.far, p.sky2, 0.25)), lit = tint(mix(stone, '#ffffff', 0.2)), dark2 = tint(shade(stone, -0.3)), moss = dk('#6a8a5a')
    const ht = Math.round(h * 0.36), cw = 9
    for (let i = 0; i < ht; i++) { const yy = hy + 2 - i; rect(g, x0, yy, cw, 1, stone); px(g, x0 + (side > 0 ? cw - 1 : 0), yy, lit); px(g, x0 + 3, yy, dark2); px(g, x0 + 6, yy, dark2) }
    for (let k = 0; k < cw; k++) rect(g, x0 + k, hy + 2 - ht - (k * 3 + 1) % 4, 1, (k * 3 + 1) % 4 + 1, stone) // its broken top
    rect(g, x0 - 2, hy + 1, cw + 4, 2, stone)
    for (let k = 0; k < 6; k++) px(g, x0 + (k * 3) % cw, hy - ht + 6 + k * 3, moss)
  } else if (kind === 'pylon') {
    const steel = dk('#4a4e5a'), ht = Math.round(h * 0.42), base = hy + 2
    for (let i = 0; i < ht; i++) { const half = Math.round(1 + (ht - i) * 0.12); px(g, x0 - half, base - i, steel); px(g, x0 + half, base - i, steel); if (i % 6 === 0) rect(g, x0 - half, base - i, half * 2 + 1, 1, steel); if (i % 6 === 3) px(g, x0, base - i, steel) }
    rect(g, x0 - 7, base - ht + 3, 15, 1, steel); rect(g, x0 - 5, base - ht + 8, 11, 1, steel)
    if (t && t % 37 < 2) { px(g, x0 - 7, base - ht + 4, '#fff6a0'); px(g, x0 + 7, base - ht + 4, '#fff6a0') }
  } else if (kind === 'tank') {
    const steel = dk('#7a8494'), lit = dk('#aab2c0'), band = dk('#5a6272'), cw = Math.round(w * 0.1), ht = Math.round(h * 0.28)
    rect(g, x0, hy + 2 - ht, cw, ht, steel)
    ellipse(g, x0 + Math.round(cw / 2), hy + 2 - ht, Math.round(cw / 2), 2, lit)
    for (let yy = hy + 2 - ht + 5; yy < hy; yy += 6) rect(g, x0, yy, cw, 1, band)
    rect(g, x0 + (side > 0 ? cw - 2 : 1), hy + 2 - ht, 1, ht, lit)
    for (let yy = hy + 2 - ht + 2; yy < hy + 2; yy += 2) px(g, x0 + Math.round(cw * 0.3), yy, band) // a ladder
  }
}

/** A floor that is not a mown field. */
function drawFloor(g: Ctx, kind: Floor, lay: Layout, p: Palette, tint: Tint, r: () => number, t: number, dark: number) {
  const { w, h, horizon: hy } = lay
  const rowColour = (y: number) => { const d = (y - hy) / Math.max(1, h - hy); let c = mix(mix(p.ground2, p.far, 0.3), p.ground, Math.pow(d, 0.7)); if (y - hy < 2) c = mix(c, p.sky2, 0.25); return c }
  if (kind === 'cloudsea') {
    // the place is above the clouds: rows of cloud tops, drifting
    const cl = mix(mix('#ffffff', p.sky2, 0.25), '#2c3566', dark * 0.5), cs = shade(cl, -0.12)
    for (let y = hy; y < h; y++) rect(g, 0, y, w, 1, tint(mix(cl, p.sky2, Math.max(0, 0.4 - (y - hy) / (h - hy)))))
    for (let row = 0, y = hy + 3; y < h; row++, y += 4 + row * 2) {
      const sz = 2 + row, drift = Math.floor(t * (0.1 + row * 0.05))
      for (let x = -sz * 2 + ((row * 17 + drift) % (sz * 4)); x < w + sz; x += sz * 3 + (row % 2)) { ellipse(g, x, y, sz * 2, sz, tint(cs)); ellipse(g, x, y - 1, sz * 2 - 1, sz - 1, tint(cl)) }
    }
    return
  }
  for (let y = hy; y < h; y++) rect(g, 0, y, w, 1, tint(rowColour(y)))
  if (kind === 'ripples') {
    for (let y = hy + 6, k = 0; y < h; k++, y += 2 + Math.floor(k / 2)) { const c = tint(shade(rowColour(y), -0.07)); for (let x = 0; x < w; x++) if ((x + k * 3) % 7 < 4) px(g, x, y + Math.round(Math.sin(x * 0.2 + k) * 0.6), c) }
  } else if (kind === 'cracks' || kind === 'lava') {
    const glow = kind === 'lava' ? 0.6 + 0.4 * Math.sin(t * 0.25) : 0
    for (let i = 0; i < Math.round(w / 10); i++) {
      let x = Math.floor(r() * w), y = hy + 3 + Math.floor(r() * (h - hy - 4))
      const len = 4 + Math.floor(r() * 10)
      for (let k = 0; k < len; k++) {
        if (kind === 'lava') { g.globalAlpha = glow; px(g, x, y, '#ff7a2a'); g.globalAlpha = 0.35 * glow; px(g, x, y - 1, '#ffb05a'); g.globalAlpha = 1 } else px(g, x, y, tint(shade(rowColour(y), -0.18)))
        x += r() < 0.5 ? 1 : -1; y += r() < 0.3 ? 1 : 0
      }
    }
  } else if (kind === 'snow') {
    for (let i = 0; i < Math.round(w * 0.3); i++) { const x = Math.floor(r() * w), y = hy + 2 + Math.floor(r() * (h - hy - 3)), ph = Math.floor(r() * 16); if (!t || (t + ph) % 16 < 3) px(g, x, y, '#ffffff') }
    for (let y = hy + 4, k = 0; y < h; k++, y += 4 + k) for (let x = 0; x < w; x++) if ((x + k * 5) % 13 < 5) px(g, x, y, tint(shade(rowColour(y), -0.04)))
  } else if (kind === 'puddles') {
    for (let i = 0; i < 6; i++) {
      const y = hy + 4 + Math.floor(Math.pow(r(), 0.8) * (h - hy - 10)), d = (y - hy) / (h - hy), rx = 4 + Math.round(d * 14), ry = 1 + Math.round(d * 3), x = Math.floor(r() * w)
      ellipse(g, x, y, rx, ry, tint(mix(p.sky2, '#2a4a5a', 0.45)))
      rect(g, x - Math.round(rx * 0.5), y - ry + 1, Math.round(rx * 0.5), 1, tint(mix(p.sky2, '#ffffff', 0.2)))
    }
  } else if (kind === 'tiles' || kind === 'plates') {
    // a floor of stones (or steel plates) in perspective: seams that widen toward you
    const seam = (y: number) => tint(shade(rowColour(y), kind === 'plates' ? -0.22 : -0.16))
    let y = hy + 2, rowH = 2, k = 0
    while (y < h) {
      rect(g, 0, y, w, 1, seam(y))
      const tw = Math.round(rowH * (kind === 'plates' ? 4 : 3)), off = (k % 2) * Math.round(tw / 2)
      for (let x = -off; x < w; x += tw) { rect(g, x, y + 1, 1, Math.min(rowH, h - y - 1), seam(y)); if (kind === 'plates' && rowH > 4 && y + 2 < h) { px(g, x + 2, y + 2, mix(seam(y), '#ffffff', 0.4)); if (x + tw - 2 < w) px(g, x + tw - 2, y + 2, mix(seam(y), '#ffffff', 0.4)) } }
      if (kind === 'tiles' && r() < 0.5) for (let n = 0; n < 3; n++) px(g, Math.floor(r() * w), Math.min(h - 1, y + 1 + Math.floor(r() * rowH)), tint(mix('#6a8a5a', '#121a3d', dark * 0.5))) // moss in the seams
      y += rowH + 1; rowH = Math.min(14, rowH + 1 + Math.floor(k / 2)); k++
    }
  } else if (kind === 'scree') {
    for (let y = hy + 3, k = 0; y < h; k++, y += 3 + k) for (let x = (k * 7) % 5; x < w; x += 5 + (k % 3)) px(g, x, y, tint(shade(rowColour(y), -0.1)))
  }
}

// ── the front: what stands between you and the Pokemon ─────────────────────
export function paintFront(g: Ctx, s: StageState) {
  const { lay, t } = s
  const { w, h, horizon: hy } = lay
  const look = lookOf(s)
  const { dark, wx, cave } = look
  const place = placeOf(s.biome)
  const tod = (c: string) => mix(mix(c, look.p.sky2, 0.1), '#121a3d', dark * 0.6)
  const p: Palette = cave || !place.colours ? look.p : { ...look.p, far: tod(place.colours.far), ground: tod(place.colours.ground), ground2: tod(place.colours.ground2), pad: tod(place.colours.pad), pad2: tod(place.colours.pad2) }
  g.globalAlpha = 1
  g.clearRect(0, 0, w, h)

  // foreground grass: tall at the left edge, low across the middle, so the near pad sits in the field, not on it
  const blade = shade(p.ground, -0.3 - 0.2 * dark), tip = shade(p.ground, -0.06 - 0.2 * dark)
  if (!cave && (place.fore === 'grass' || place.fore === 'reeds')) {
    const gr = rng('foreground')
    for (let x = 0; x < w; x++) {
      const edge = x < w * 0.1 ? 1 - x / (w * 0.1) : 0
      const ht = Math.round(2 + gr() * 3 + edge * (6 + gr() * 8)) + (place.fore === 'reeds' && x % 5 === 0 ? Math.round(gr() * 9) : 0)
      if (gr() < 0.35 && edge === 0) continue
      const sway = t && ht > 6 ? Math.round(Math.sin(t * 0.18 + x * 0.7)) : 0
      rect(g, x, h - ht + 1, 1, ht - 1, blade)
      px(g, x + sway, h - ht, tip)
    }
  } else if (!cave) {
    drawFore(g, place.fore, lay, p, rng('foreground'), t, dark)
  } else {
    // a cave: a rock lip along the bottom
    for (let x = 0; x < w; x++) { const ht = 2 + Math.round(2 * Math.sin(x * 0.3) + 1.5 * Math.sin(x * 0.11)); rect(g, x, h - ht, 1, ht, shade(p.ground, -0.45)) }
  }

  // rain after a very poor night: short slanted streaks falling a few pixels a frame
  if (wx.rain && place.life !== 'snow') {
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
  } else if (place.life !== 'meadow') {
    drawLife(g, place.life, lay, p, life, t, dark, wx.rain, wx.gloom)
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

/** The near edge of a place that is not grass. */
function drawFore(g: Ctx, kind: Fore, lay: Layout, p: Palette, r: () => number, t: number, dark: number) {
  const { w, h } = lay
  if (kind === 'rocks') {
    const rock = shade(p.ground, -0.35 - dark * 0.2), lit = mix(rock, p.sky2, 0.25)
    for (let x = -4; x < w; x += 6 + Math.floor(r() * 10)) { const edge = x < w * 0.12 ? 1.6 : 1, rr = Math.round((2 + r() * 3) * edge); dome(g, x, h - 1, rr + 1, rr, rock); px(g, x - 1, h - rr, lit) }
  } else if (kind === 'drift') {
    const snow = mix('#ffffff', p.sky2, 0.15 + dark * 0.5), shadow = shade(snow, -0.12)
    for (let x = 0; x < w; x++) { const edge = x < w * 0.12 ? (1 - x / (w * 0.12)) * 8 : 0, ht = Math.round(2 + 1.5 * Math.sin(x * 0.17) + edge); rect(g, x, h - ht, 1, ht, snow); px(g, x, h - ht, shadow) }
  } else if (kind === 'dune') {
    const sand = shade(p.ground, -0.08), grass = shade('#7a9a4a', -dark * 0.5)
    for (let x = 0; x < w * 0.2; x++) { const ht = Math.round((1 - x / (w * 0.2)) * 7 + 1); rect(g, x, h - ht, 1, ht, sand); if (x % 3 === 0) { const bh = 3 + Math.floor(r() * 5), sway = t ? Math.round(Math.sin(t * 0.2 + x)) : 0; rect(g, x, h - ht - bh + 1, 1, bh - 1, grass); px(g, x + sway, h - ht - bh, grass) } }
  } else if (kind === 'pipe') {
    const steel = shade('#8a93a3', -dark * 0.5), lit = mix(steel, '#ffffff', 0.3), dk = shade(steel, -0.35)
    rect(g, 0, h - 5, Math.round(w * 0.4), 4, steel); rect(g, 0, h - 5, Math.round(w * 0.4), 1, lit); rect(g, 0, h - 2, Math.round(w * 0.4), 1, dk)
    for (let x = 6; x < w * 0.4; x += 14) rect(g, x, h - 6, 2, 6, dk)
  }
}

/** The small life of a place that is not the meadow. */
function drawLife(g: Ctx, kind: Life, lay: Layout, p: Palette, r: () => number, t: number, dark: number, rain: boolean, gloom: number) {
  const { w, h, horizon: hy } = lay
  const night = dark > 0.45
  const firefly = (n: number) => {
    for (let i = 0; i < n; i++) {
      const x0 = r() * w, y0 = hy + r() * (h - hy) * 0.7
      if (t && (t + i * 5) % 24 >= 16) continue
      const x = Math.round(x0 + 3 * Math.sin(t * 0.05 + i)), y = Math.round(y0 + 2 * Math.sin(t * 0.07 + i * 2))
      g.globalAlpha = 0.35; px(g, x - 1, y, '#e8ff7a'); px(g, x + 1, y, '#e8ff7a'); px(g, x, y - 1, '#e8ff7a'); px(g, x, y + 1, '#e8ff7a')
      g.globalAlpha = 1; px(g, x, y, '#f4ffb0')
    }
  }
  if (kind === 'petals') {
    if (night && !rain) { firefly(5); return }
    for (let i = 0; i < 9; i++) { const x = Math.round(((r() * w + t * 0.7) % (w + 10)) - 5), y = Math.round((r() * h * 0.9 + t * 0.4 + Math.sin(t * 0.1 + i) * 2) % h); px(g, x, y, i % 3 ? '#ffb3d1' : '#ffffff'); if (i % 2) px(g, x + 1, y, '#ff9ec4') }
  } else if (kind === 'gulls') {
    if (night || rain) return
    for (let i = 0; i < 2; i++) { const x = Math.round(((r() * w + t * (0.5 + i * 0.3)) % (w + 20)) - 10), y = Math.round(hy * (0.25 + i * 0.15) + Math.sin(t * 0.12 + i) * 2), up = !t || t % 6 < 3; const c = '#f4f6fa'; px(g, x, y, c); px(g, x - 1, y - (up ? 1 : 0), c); px(g, x + 1, y - (up ? 1 : 0), c); px(g, x - 2, y - (up ? 2 : 0), c); px(g, x + 2, y - (up ? 2 : 0), c) }
  } else if (kind === 'marsh') {
    if (night && !rain) { firefly(8); return }
    g.globalAlpha = 0.6
    for (let i = 0; i < 5; i++) { const x = Math.round(r() * w), y0 = hy + 6 + r() * (h - hy - 12), y = Math.round(y0 - ((t * 0.3 + i * 7) % 8)); px(g, x, y, mix('#ffffff', p.sky2, 0.3)) }
    g.globalAlpha = 1
  } else if (kind === 'dust' || kind === 'wind') {
    g.globalAlpha = kind === 'dust' ? 0.45 : 0.4
    const c = kind === 'dust' ? mix('#f0d0a0', p.sky2, 0.3) : mix('#ffffff', p.sky2, 0.3)
    for (let i = 0; i < (kind === 'dust' ? 8 : 6); i++) { const len = kind === 'dust' ? 1 : 3 + (i % 4), x = Math.round(((r() * w + t * (kind === 'dust' ? 0.6 : 2.5)) % (w + 10)) - 5), y = Math.round(r() * h * 0.9 + Math.sin(t * 0.08 + i) * 1.5); rect(g, x, y, len, 1, c) }
    g.globalAlpha = 1
    if (kind === 'wind' && !night && !rain) { const x = Math.round(((t * 0.8) % (w + 20)) - 10), y = Math.round(hy * 0.3), up = !t || t % 8 < 4; px(g, x, y, '#2a2a3a'); px(g, x - 1, y - (up ? 1 : 0), '#2a2a3a'); px(g, x + 1, y - (up ? 1 : 0), '#2a2a3a'); px(g, x - 2, y - (up ? 1 : 0), '#2a2a3a'); px(g, x + 2, y - (up ? 1 : 0), '#2a2a3a') }
  } else if (kind === 'embers') {
    for (let i = 0; i < 10; i++) { const x = Math.round(r() * w + Math.sin(t * 0.1 + i) * 2), y = Math.round(h - ((r() * h + t * (0.8 + (i % 3) * 0.3)) % h)); if (t && (t + i) % 7 === 0) continue; px(g, x, y, i % 2 ? '#ff8a3a' : '#ffd06a') }
  } else if (kind === 'snow') {
    const n = rain ? Math.round(w * 0.5) : Math.round(w * 0.18)
    g.globalAlpha = 0.85
    for (let i = 0; i < n; i++) { const x = Math.round(((r() * w + Math.sin(t * 0.05 + i) * 3) % w + w) % w), y = Math.round((r() * h + t * (0.5 + (i % 3) * 0.25)) % (h - 1)); px(g, x, y, '#ffffff') }
    g.globalAlpha = 1
  } else if (kind === 'sparks') {
    if (night && !rain) firefly(4)
    for (let i = 0; i < 3; i++) { if (t && (t + i * 11) % 19 > 2) continue; const x = Math.round(r() * w), y = hy - 14 + Math.round(r() * 4); px(g, x, y, '#fff6a0'); px(g, x + 1, y - 1, '#ffe24a') }
  } else if (kind === 'wisps') {
    for (let i = 0; i < 5; i++) { const x0 = r() * w, y0 = hy + r() * (h - hy) * 0.6, x = Math.round(x0 + 4 * Math.sin(t * 0.04 + i)), y = Math.round(y0 + 3 * Math.sin(t * 0.06 + i * 2)); g.globalAlpha = 0.3 + (night ? 0.4 : 0.1); px(g, x - 1, y, '#c8a8ff'); px(g, x + 1, y, '#c8a8ff'); px(g, x, y - 1, '#c8a8ff'); g.globalAlpha = night ? 1 : 0.6; px(g, x, y, '#efe4ff') }
    g.globalAlpha = 1
  } else if (kind === 'steam') {
    g.globalAlpha = 0.35 * (1 - gloom * 0.5)
    for (let i = 0; i < 3; i++) { const x = Math.round(w * (0.55 + i * 0.15)), y = Math.round(h - 4 - ((t * 0.5 + i * 9) % 18)); ellipse(g, x + Math.round(Math.sin(t * 0.1 + i) * 2), y, 2 + Math.round(((t * 0.5 + i * 9) % 18) / 6), 1, '#e8ecf2') }
    g.globalAlpha = 1
  }
}
