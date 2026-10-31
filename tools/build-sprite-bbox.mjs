// The visible area of every still sprite, so a grid can draw a Rattata and an Onix at a size that looks alike.
//
//   node tools/build-sprite-bbox.mjs
//
// Every picture is 96 x 96 with a different amount of empty margin. This writes
// sprites/bbox.json: { form: [left, top, right, bottom] } of the pixels that are drawn.
// The Pokedex fetches it once (src/Fit.tsx); run this again after adding sprites.
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const DIR = path.resolve(import.meta.dirname, '..', 'sprites')
const out = {}
for (const file of fs.readdirSync(path.join(DIR, 'static')).filter((f) => f.endsWith('.png')).sort()) {
  const png = PNG.sync.read(fs.readFileSync(path.join(DIR, 'static', file)))
  let l = png.width, t = png.height, r = -1, b = -1
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3] > 24) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y }
  }
  if (r >= 0) out[file.replace(/\.png$/, '')] = [l, t, r + 1, b + 1]
}
fs.writeFileSync(path.join(DIR, 'bbox.json'), JSON.stringify(out))
console.log(`${Object.keys(out).length} sprites, ${(fs.statSync(path.join(DIR, 'bbox.json')).size / 1024).toFixed(0)} KB`)
