// Renders the app icon (the Pokedex's red shell and its blue lens) to public/.
//   node tools/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Raster, hex } from './png.mjs'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const RED = hex('#dc3b45'), RED_DK = hex('#a8242f'), EDGE = hex('#23283a'), WHITE = hex('#ffffff'), BLUE = hex('#2f7fd0'), SKY = hex('#63c6ff')

/** Colour of the icon at (x, y) on a 32-unit grid. Everything that matters sits inside the maskable safe circle. */
function at(x, y) {
  const d = Math.hypot(x - 16, y - 14.5)
  if (Math.hypot(x - 13.4, y - 11.8) < 1.7) return WHITE
  if (d < 5.2) return SKY
  if (d < 6.6) return BLUE
  if (d < 8.3) return WHITE
  if (d < 9.4) return EDGE
  if (y >= 25 && y < 26) return EDGE
  return y >= 26 ? RED_DK : RED
}

function icon(size) {
  const r = new Raster(size, size, RED)
  const u = 32 / size
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) r.rect(x, y, 1, 1, at((x + 0.5) * u, (y + 0.5) * u))
  return r.png()
}

for (const [name, size] of Object.entries({ 'icon-512.png': 512, 'icon-192.png': 192, 'apple-touch-icon.png': 180, 'favicon-32.png': 32 })) {
  writeFileSync(join(PUBLIC, name), icon(size))
  console.log('wrote', name)
}
