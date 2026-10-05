// Builds core/species.ts from the public species table (names, numbers,
// evolution links) and checks every entry against the sprite archive, so the
// game never refers to a form it cannot show.
//
//   node tools/build-species.mjs <path to unpacked sprites folder>
//
// Also copies the sprites that are actually used into public/sprites/.
import fs from 'node:fs'
import path from 'node:path'

const SRC = process.argv[2]
if (!SRC || !fs.existsSync(path.join(SRC, 'gen5ani'))) {
  console.error('usage: node tools/build-species.mjs <sprites folder containing gen5ani/, gen5/ ...>')
  process.exit(1)
}
const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, 'tools/.cache/pokedex.json')
if (!fs.existsSync(CACHE)) {
  const res = await fetch('https://play.pokemonshowdown.com/data/pokedex.json')
  fs.mkdirSync(path.dirname(CACHE), { recursive: true })
  fs.writeFileSync(CACHE, await res.text())
}
const DEX = JSON.parse(fs.readFileSync(CACHE, 'utf8'))

const toID = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const spriteOf = (e) => (e.baseSpecies ? `${toID(e.baseSpecies)}-${toID(e.forme)}` : toID(e.name))
const genOf = (n) => (n <= 151 ? 1 : n <= 251 ? 2 : n <= 386 ? 3 : n <= 493 ? 4 : n <= 649 ? 5 : n <= 721 ? 6 : n <= 809 ? 7 : n <= 905 ? 8 : 9)
const has = (dir, id, ext) => fs.existsSync(path.join(SRC, dir, `${id}.${ext}`))
const hasAni = (id) => has('gen5ani', id, 'gif')
const hasStatic = (id) => has('gen5', id, 'png')
const hasSprite = (id) => hasAni(id) || hasStatic(id)
const bst = (e) => Object.values(e.baseStats).reduce((a, b) => a + b, 0)
const LEGEND = new Set(['Restricted Legendary', 'Sub-Legendary', 'Mythical'])

// What a branch says about you. The branch whose tag you did best on wins.
const TYPE_TAG = {
  Fighting: 'fitness', Rock: 'fitness', Ground: 'fitness', Steel: 'fitness', Fire: 'fitness', Dragon: 'fitness',
  Psychic: 'code', Electric: 'code', Ghost: 'code',
  Fairy: 'guitar', Normal: 'guitar', Flying: 'guitar',
  Grass: 'arbor', Dark: 'sleep',
  Water: 'routine', Ice: 'routine', Bug: 'routine', Poison: 'routine',
}
const BRANCH_OVERRIDE = {
  eevee: { jolteon: 'code', flareon: 'fitness', sylveon: 'guitar', leafeon: 'arbor', umbreon: 'sleep', vaporeon: 'routine', espeon: 'balanced', glaceon: 'health' },
}

// Real species in their ordinary form, plus the regional variants, which are
// lines of their own that turn up once their region opens.
const REGIONAL = { Alola: 7, Galar: 8, Hisui: 8, Paldea: 9 }
const base = Object.entries(DEX).filter(([, e]) => (!e.forme || REGIONAL[e.forme]) && e.num > 0 && !(e.tags ?? []).includes('Pokestar'))
const byId = new Map(base.map(([id, e]) => [id, e]))
const sid = (key) => spriteOf(byId.get(key))
const ok = (key) => byId.has(key) && hasSprite(sid(key))
const genOfEntry = (e) => REGIONAL[e.forme] ?? genOf(e.num)
// an ordinary species does not evolve into a variant: that keeps every line in one region
const evosOf = (e) => (e.evos ?? []).map(toID).filter((k) => ok(k) && (e.forme || !byId.get(k).forme))
const rootOf = (id) => {
  let cur = id
  for (;;) {
    const p = byId.get(cur)?.prevo
    if (!p || !ok(toID(p)) || !evosOf(byId.get(toID(p))).includes(cur)) return cur
    cur = toID(p)
  }
}
const members = (id) => [id, ...evosOf(byId.get(id)).flatMap(members)]
const depth = (id) => 1 + Math.max(0, ...evosOf(byId.get(id)).map(depth))

const out = {}
const used = new Set() // sprite ids to copy
let lines = 0
for (const [id, e] of base) {
  if (rootOf(id) !== id || !ok(id)) continue
  // reached only through a parent that does not lead here (a variant of a later stage): left out
  if (e.prevo && ok(toID(e.prevo))) continue
  const line = members(id)
  const gen = Math.min(...line.map((m) => genOfEntry(byId.get(m))))
  lines++
  const finals = line.filter((m) => evosOf(byId.get(m)).length === 0)
  const top = Math.max(...finals.map((m) => bst(byId.get(m))))
  const legendary = (e.tags ?? []).some((t) => LEGEND.has(t))
  const rarity = legendary ? 'L' : top >= 590 ? 'R' : top >= 500 ? 'U' : 'C'
  const depthMax = depth(id)
  const rootSprite = sid(id)
  const walk = (key, stage) => {
    const s = byId.get(key)
    const me = sid(key)
    const evoKeys = evosOf(s)
    const evos = evoKeys.map(sid)
    const megas = (s.otherFormes ?? [])
      .map((n) => DEX[toID(n)])
      .filter((f) => f && /^Mega/.test(f.forme))
      .map(spriteOf)
      .filter(hasSprite)
    const gmax = !s.forme && s.canGigantamax && hasSprite(`${me}-gmax`) ? `${me}-gmax` : undefined
    const rec = { n: s.name, d: s.num, t: s.types[0], s: stage }
    if (!hasAni(me)) rec.st = 1
    if (stage === 1) Object.assign(rec, { g: gen, r: rarity, x: depthMax })
    else rec.b = rootSprite
    if (evos.length) rec.e = evos
    if (evos.length > 1) {
      const tag = (ev, i) => TYPE_TAG[byId.get(ev).types[i] ?? byId.get(ev).types[0]] ?? 'routine'
      const first = evoKeys.map((ev) => tag(ev, 0))
      // branches that share a primary type are told apart by their second one
      rec.bt = evoKeys.map((ev, i) => BRANCH_OVERRIDE[key]?.[ev] ?? (first.filter((t) => t === first[i]).length > 1 ? tag(ev, 1) : first[i]))
    }
    if (megas.length) rec.m = megas
    if (gmax) rec.gm = gmax
    out[me] = rec
    used.add(me)
    for (const f of [...megas, ...(gmax ? [gmax] : [])]) {
      used.add(f)
      const fe = Object.values(DEX).find((x) => x.baseSpecies && spriteOf(x) === f)
      out[f] = { n: fe ? fe.name : `${s.name}-Gmax`, d: s.num, t: (fe ?? s).types[0], s: stage, b: rootSprite, f: me }
      if (!hasAni(f)) out[f].st = 1
    }
    evoKeys.forEach((ev) => walk(ev, stage + 1))
  }
  walk(id, 1)
}

// ── write core/species.ts ──
const ordered = Object.fromEntries(Object.entries(out).sort((a, b) => a[1].d - b[1].d || (a[1].f ? 1 : 0) - (b[1].f ? 1 : 0)))
const ts = `// GENERATED by tools/build-species.mjs. Do not edit by hand.
// Names, numbers and evolution links only: no artwork lives in this file.
//
// n name · d dex number · t primary type · s stage · st static sprite only
// first stages: g region (1-9) · r rarity (C U R L) · x stages in the line
// others: b first stage of the line · f the species this is a temporary form of
// e evolutions · bt what each branch stands for · m mega forms · gm gigantamax form
export interface SpeciesRec {
  n: string; d: number; t: string; s: number; st?: 1
  g?: number; r?: 'C' | 'U' | 'R' | 'L'; x?: number
  b?: string; f?: string
  e?: string[]; bt?: string[]; m?: string[]; gm?: string
}
export const SPECIES: Record<string, SpeciesRec> = ${JSON.stringify(ordered)}
`
fs.writeFileSync(path.join(ROOT, 'core/species.ts'), ts)

// ── copy the sprites in use ──
const DEST = path.join(ROOT, 'public/sprites')
const sets = [['gen5ani', 'ani', 'gif'], ['gen5ani-shiny', 'ani-shiny', 'gif'], ['gen5', 'static', 'png'], ['gen5-shiny', 'static-shiny', 'png']]
let copied = 0, bytes = 0
const missingShiny = []
for (const [from, to, ext] of sets) {
  fs.mkdirSync(path.join(DEST, to), { recursive: true })
  for (const id of used) {
    const src = path.join(SRC, from, `${id}.${ext}`)
    if (!fs.existsSync(src)) {
      if (to === 'static-shiny' && !has('gen5ani-shiny', id, 'gif')) missingShiny.push(id)
      continue
    }
    // animated ids do not need a static copy, except as the still for reduced motion
    fs.copyFileSync(src, path.join(DEST, to, `${id}.${ext}`))
    copied++
    bytes += fs.statSync(src).size
  }
}
// ── the Bag's item icons, the gym leaders and the type icons ──
const { TRAINER_SPRITES, LEAGUES } = await import('../core/gyms.ts')
const { STONES } = await import('../core/rules.ts')
// two icons the archive files under another name
const ITEM_FILE = { 'thunder-stone': 'itemicons/thunderstone.png', 'ice-stone': 'itemicons/nevermeltice.png' }
const extras = [
  ...STONES.map((id) => [ITEM_FILE[id] ?? `itemicons/${id}.png`, `items/${id}.png`]),
  ...TRAINER_SPRITES.map((id) => [`trainers/${id}.png`, `trainers/${id}.png`]),
  ...[...new Set(LEAGUES.flatMap((l) => [...l.gyms, ...l.four, l.champion].map((t) => t.type)))].map((t) => [`typeicons/${t}.png`, `types/${t}.png`]),
]
const missing = []
for (const [from, to] of extras) {
  const src = path.join(SRC, from)
  if (!fs.existsSync(src)) { missing.push(from); continue }
  fs.mkdirSync(path.dirname(path.join(DEST, to)), { recursive: true })
  fs.copyFileSync(src, path.join(DEST, to))
}
console.log(`extras: ${extras.length - missing.length} copied`, missing.length ? `· missing: ${missing.join(', ')}` : '')

const firsts = Object.values(out).filter((r) => r.s === 1 && !r.f)
console.log(`${lines} lines, ${Object.keys(out).length} entries (${Object.values(out).filter((r) => r.f).length} temporary forms)`)
console.log('by region', [1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => firsts.filter((r) => r.g === g).length).join(' / '))
console.log('by rarity', ['C', 'U', 'R', 'L'].map((r) => `${r}:${firsts.filter((x) => x.r === r).length}`).join(' '))
console.log('static only', Object.values(out).filter((r) => r.st).length, '· branching', Object.values(out).filter((r) => r.bt).length)
console.log(`copied ${copied} files, ${(bytes / 1e6).toFixed(1)} MB`, missingShiny.length ? `· no shiny sprite: ${missingShiny.join(', ')}` : '')
