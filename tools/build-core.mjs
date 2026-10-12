// Copies core/ into Life OS (src/game-core), which runs the same game to draw
// its partner strip. Run after any change to core/:  npm run core
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DEST = path.resolve(ROOT, '../lifeos/src/game-core')
const FILES = ['rules.ts', 'facts.ts', 'fold.ts', 'order.ts', 'species.ts', 'gyms.ts', 'events.ts', 'types.ts', 'economy.ts', 'boss.ts']

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
