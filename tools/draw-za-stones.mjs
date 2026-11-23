// The eight Z-A Mega Stones the PokeFarm wiki has no picture of (Chimechite, Golurkite, Chesnaughtite, Delphoxite, Greninjite,
// Crabominite, Scovillainite, Glimmoranite), drawn in the same hand as the others: the pixel layout of an existing stone
// (Venusaurite: outline, rim, a two-colour swirl, a white glint) filled with the colours of that stone in the game's own art
// (Bulbapedia's "Bag <Stone> ZA Sprite", read straight off the pictures).
//
//   node tools/draw-za-stones.mjs
//
// Each layout colour belongs to one of three families (the rim, the first swirl colour, the second); within a family it keeps its
// place on the dark-to-light ramp, and that place is looked up on the ramp of the new stone. So the shading stays where the
// artist put it and only the colours change. The result is written to tools/megastones-src, like the wiki's own pictures.
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const SRC = path.resolve(import.meta.dirname, 'megastones-src')
const TEMPLATE = 'Mega_Stone_Venusaurite.png'
const hex = (s) => [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b

/** The template's colours, by family. The outline and the white glint are kept as they are. */
const FAMILY = {
  rim: ['63adce', '2994bd'],
  a: ['2c956f', '0c4e36', '106b4a', '377d82'],
  b: ['ff52c6', 'bd4a8c', '885e88', 'b17fca', '86507e'],
}

/** Each stone's three ramps (any order: they are sorted dark to light), from its picture in the game. */
const STONES = {
  Chesnaughtite: { rim: ['b8aca9', 'ecebdd'], a: ['295a00', '467019', '7d9b5e'], b: ['680418', '87112c', '97324a', 'ab596c'] },
  Delphoxite: { rim: ['413146', '7a6f7e'], a: ['ea8678', 'f8cebe', 'fceea3'], b: ['b23d35', 'de3a22', 'e1523d', 'f2b768'] },
  Greninjite: { rim: ['597ea5', '68acd7'], a: ['df6f83', 'e99aa8', 'ffa3b3'], b: ['201f1f', '4c4c4c', '6b7b7b'] },
  Chimechite: { rim: ['bea15a', 'f4dc70'], a: ['33759a', '6aa0ba', 'b8dbe7'], b: ['b33150', 'e54262', 'ed7a91'] },
  Golurkite: { rim: ['677b89', '7ca8b0'], a: ['bb9b68', 'efd484', 'f5e1a9'], b: ['793385', 'a15bac', 'bd8dc5'] },
  Crabominite: { rim: ['c6bac2', 'ebe7e9'], a: ['31bde7', '4dc9ea', 'a5e7f7'], b: ['414181', '585478', '706d8b'] },
  Scovillainite: { rim: ['527d4c', '5fab5d'], a: ['3c5243', '287454', '5d7971'], b: ['bc2d28', 'df4f32', 'e88470'] },
  Glimmoranite: { rim: ['2553b3', '2171eb'], a: ['439a99', '4ad3c7', '81e1d8'], b: ['222266', '1b368f', '2361ce'] },
}

/** The colour at `t` (0 dark, 1 light) along a ramp of colours sorted dark to light. */
function along(ramp, t) {
  if (ramp.length === 1) return ramp[0]
  const at = t * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(at)), f = at - i
  return ramp[i].map((v, k) => Math.round(v + (ramp[i + 1][k] - v) * f))
}

const template = PNG.sync.read(fs.readFileSync(path.join(SRC, TEMPLATE)))
const where = {} // template colour -> [family, 0..1 place on its ramp]
for (const [fam, list] of Object.entries(FAMILY)) {
  const L = list.map((h) => lum(hex(h))), lo = Math.min(...L), hi = Math.max(...L)
  list.forEach((h, i) => { where[h] = [fam, hi === lo ? 0.5 : (L[i] - lo) / (hi - lo)] })
}

for (const [name, ramps] of Object.entries(STONES)) {
  const sorted = Object.fromEntries(Object.entries(ramps).map(([k, v]) => [k, v.map(hex).sort((x, y) => lum(x) - lum(y))]))
  const out = new PNG({ width: 24, height: 24 })
  for (let i = 0; i < template.data.length; i += 4) {
    const px = [template.data[i], template.data[i + 1], template.data[i + 2]]
    const key = px.map((v) => v.toString(16).padStart(2, '0')).join('')
    let rgb = px
    if (where[key]) rgb = along(sorted[where[key][0]], where[key][1])
    else if (template.data[i + 3] && key !== 'ffffff' && key !== '202031') throw new Error(`template colour ${key} has no family`)
    out.data[i] = rgb[0]; out.data[i + 1] = rgb[1]; out.data[i + 2] = rgb[2]; out.data[i + 3] = template.data[i + 3]
  }
  fs.writeFileSync(path.join(SRC, `Mega_Stone_${name}.png`), PNG.sync.write(out))
}
console.log(`${Object.keys(STONES).length} stones drawn into tools/megastones-src`)
