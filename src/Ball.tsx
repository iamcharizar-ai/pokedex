// The balls and the Key Stone, as pictures: the item icons you supplied
// (sprites/items). Mega Stones have their own pictures (sprites/megastones); only a Mega without one is drawn.
import { useState, type CSSProperties } from 'react'
import { BALL_NAME, type Ball as BallId } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { MEGASTONE_ART } from './lib/megastone-art.ts'
import { typeColor } from './screens/types.ts'

/**
 * Every ball is drawn from its crisp pixel icon (sprites/items/<id>.png), blown up without smoothing. The large ball sheet
 * (sprites/balls) was a blurred upscale whose rims showed light fringes at any size, so it is no longer used.
 */
export function Ball({ ball, size = 24, className = '' }: { ball: BallId; size?: number; className?: string }) {
  return <img className={`ball pix ${className}`} src={`/sprites/items/${ball}-ball.png`} width={size} height={size} alt={BALL_NAME[ball]} draggable={false} />
}

/** Any ball by its item id ('great-ball', 'net-ball', ...). */
export function BallItem({ id, size = 24, className = '' }: { id: string; size?: number; className?: string }) {
  return <img className={`ball pix ${className}`} src={`/sprites/items/${id}.png`} width={size} height={size} alt="" draggable={false} />
}

export function KeyStone({ size = 24, held = true }: { size?: number; held?: boolean }) {
  return <img className={`keystone pix ${held ? '' : 'unheld'}`} src="/sprites/items/key-stone.png" width={size} height={size} alt={held ? 'Key Stone' : 'Key Stone, not held yet'} draggable={false} />
}

/** The stones whose name is not the species with "ite" on the end (the games' own spelling). */
const STONE_NAME: Record<string, string> = { 'crabominable-mega': 'Crabominite', 'glimmora-mega': 'Glimmoranite' }

/**
 * A Mega Stone's name, the way the games make it: the species with "ite" on the end, and X or Y when there are two
 * ("charizard-megax" is Charizardite X, "kangaskhan-mega" Kangaskhanite).
 */
export function megaStoneName(mega: string): string {
  if (STONE_NAME[mega]) return STONE_NAME[mega]
  const base = mega.replace(/-mega[xy]?$/, '')
  const name = (SPECIES[base]?.n ?? base).replace(/\s+/g, '')
  const stem = /[aeiou]$/i.test(name) ? name.slice(0, -1) : name
  const side = mega.endsWith('megax') ? ' X' : mega.endsWith('megay') ? ' Y' : ''
  return `${stem}ite${side}`
}

/**
 * A Mega Stone: its own pixel picture (sprites/megastones/<form>.png, the wiki's 24px art blown up 8 times with nothing smoothed:
 * tools/build-megastones.mjs), drawn without smoothing. Sizes that are a multiple of 24 (24, 48, 72, 96) keep every pixel square.
 * A Mega with no picture yet, or one that fails to load, is an orb in the colour of its Pokemon with the Mega swirl inside.
 * The Key Stone (the trainer's, one for good) is the item picture; Mega Stones (one per Pokemon) are these.
 */
export function MegaStone({ mega, size = 28, title }: { mega: string; size?: number; title?: string }) {
  const [failed, setFailed] = useState(false)
  if (MEGASTONE_ART.has(mega) && !failed) return <img className="megastone-art pix" src={`/sprites/megastones/${mega}.png`} width={size} height={size} title={title ?? megaStoneName(mega)} alt={megaStoneName(mega)} draggable={false} onError={() => setFailed(true)} />
  const base = mega.replace(/-mega[xy]?$/, '')
  const t = SPECIES[base]?.t, t2 = SPECIES[base]?.t2
  return <span className="megastone" style={{ width: size, height: size, ['--mc' as string]: typeColor(t), ['--mc2' as string]: typeColor(t2 ?? t) } as CSSProperties} title={title ?? megaStoneName(mega)} role="img" aria-label={megaStoneName(mega)} />
}
