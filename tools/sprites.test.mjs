// Sprites: every picture the game can ask for exists, and one that does not never shows as a broken box.
//   node --test tools/sprites.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { SPECIES } from '../core/species.ts'
import { spritePath } from '../core/fold.ts'
import { SPRITE_PLACEHOLDER, fallbacksFor, recover } from '../src/lib/sprite-fallback.ts'

const ROOT = path.resolve(import.meta.dirname, '../sprites')
const has = (p) => fs.existsSync(path.join(ROOT, p.replace(/^\/sprites\//, '')))

test('every species has its picture in the sprites project (a boss can be any of them)', () => {
  const missing = Object.keys(SPECIES).filter((id) => !has(spritePath(id)))
  assert.deepEqual(missing, [])
})

test('the shiny pictures that do not exist are few, and each falls back to a picture that does', () => {
  const missing = Object.keys(SPECIES).filter((id) => !has(spritePath(id, true)))
  assert.ok(missing.length <= 10, `${missing.length} shiny sprites missing: ${missing.join(', ')}`)
  for (const id of missing) assert.ok(fallbacksFor(spritePath(id, true)).some(has), `${id} has nothing to fall back to`)
})

test('a failed sprite tries the ordinary picture, then the still, then a silhouette, once each', () => {
  assert.deepEqual(fallbacksFor('/sprites/ani-shiny/steelix.gif'), ['/sprites/ani/steelix.gif', '/sprites/static/steelix.png', '/sprites/static-shiny/steelix.png'])
  assert.deepEqual(fallbacksFor('/sprites/ani/steelix.gif'), ['/sprites/static/steelix.png'])
  assert.deepEqual(fallbacksFor('https://x.app/sprites/static/steelix.png'), ['https://x.app/sprites/ani/steelix.gif'])
  assert.deepEqual(fallbacksFor('/sprites/items/poke-ball.png'), [])
  const img = { src: '/sprites/ani/steelix.gif', style: {} }
  let state
  const seen = []
  for (let i = 0; i < 5; i++) { state = recover(img, state); if (!state) break; seen.push(img.src) }
  assert.deepEqual(seen, ['/sprites/static/steelix.png', SPRITE_PLACEHOLDER])
  assert.equal(recover(img, state), null, 'the silhouette is the end of it: no loop')
})

test('an item or type picture that fails is hidden, not left broken', () => {
  const img = { src: '/sprites/items/poke-ball.png', style: {} }
  assert.equal(recover(img, undefined), null)
  assert.equal(img.style.visibility, 'hidden')
})

test('an element given a new picture after a failure starts again from it', () => {
  const img = { src: '/sprites/ani/onix.gif', style: {} }
  let state = recover(img, undefined)
  img.src = '/sprites/ani/dratini.gif' // the page now shows another Pokemon
  state = recover(img, state)
  assert.equal(img.src, '/sprites/static/dratini.png')
})
