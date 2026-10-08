// The balls and the Key Stone, as pictures: the ball sheet and the item icons
// you supplied (public/sprites/balls, public/sprites/items). Nothing is drawn here.
import { BALL_NAME, type Ball as BallId } from '../core/rules.ts'

/** The big ball pictures. Poke, Great and Ultra are the chores' balls; the others are thrown. */
const BIG = new Set(['poke', 'great', 'ultra', 'master', 'premier', 'safari'])
const ID: Record<BallId, string> = { poke: 'poke', great: 'great', ultra: 'ultra' }

export function Ball({ ball, size = 24, className = '' }: { ball: BallId; size?: number; className?: string }) {
  return <img className={`ball ${className}`} src={`/sprites/balls/${ID[ball]}.png`} width={size} height={size} alt={BALL_NAME[ball]} draggable={false} />
}

/** Any ball by its item id ('great-ball', 'net-ball', ...). The ones on the big sheet use it; the rest use the small icon. */
export function BallItem({ id, size = 24, className = '' }: { id: string; size?: number; className?: string }) {
  const short = id.replace(/-ball$/, '')
  const big = BIG.has(short)
  return <img className={`ball ${big ? '' : 'pix'} ${className}`} src={big ? `/sprites/balls/${short}.png` : `/sprites/items/${id}.png`} width={size} height={size} alt="" draggable={false} />
}

export function KeyStone({ size = 24, held = true }: { size?: number; held?: boolean }) {
  return <img className={`keystone pix ${held ? '' : 'unheld'}`} src="/sprites/items/key-stone.png" width={size} height={size} alt={held ? 'Key Stone' : 'Key Stone, not held yet'} draggable={false} />
}
