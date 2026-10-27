// Copies core/ into Life OS (src/game-core), which runs the same game to draw
// its partner strip. Run after any change to core/:  npm run core
//
// Then it typechecks Life OS the way its Vercel build does (tsc -b). A core
// change can break Life OS without touching it (a new kind of moment its news
// lines do not cover), and a failed build there means no deploy. Better to
// learn it here than from a site that never updated.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const DEST = path.resolve(ROOT, '../lifeos/src/game-core')
const FILES = ['rules.ts', 'bond.ts', 'facts.ts', 'fold.ts', 'order.ts', 'species.ts', 'gyms.ts', 'events.ts', 'types.ts', 'economy.ts', 'boss.ts', 'frontier.ts', 'day.ts']

if (!fs.existsSync(path.dirname(DEST))) {
  console.error('Life OS not found next to this repo; nothing copied.')
  process.exit(0)
}
fs.mkdirSync(DEST, { recursive: true })
for (const f of FILES) fs.copyFileSync(path.join(ROOT, 'core', f), path.join(DEST, f))
fs.writeFileSync(
  path.join(DEST, 'README.md'),
  '# game-core\n\nCopied from the pokedex repo (`core/`) by `npm run core` there. Do not edit it here.\n\nRules, the day list and the fold that turns days into a partner, a queue and a collection. Names and numbers only: the sprites are served by the Pokedex site.\n',
)
console.log(`copied ${FILES.length} files to ${DEST}`)
const lifeos = path.resolve(ROOT, '../lifeos')
const tsc = spawnSync(process.execPath, [path.join(lifeos, 'node_modules', 'typescript', 'bin', 'tsc'), '-b'], { cwd: lifeos, encoding: 'utf8' })
if (tsc.status !== 0) {
  console.error(`Life OS no longer builds with this core (its Vercel deploy would fail):
${tsc.stdout}${tsc.stderr}`)
  process.exit(1)
}
console.log('Life OS typechecks with it (tsc -b)')
