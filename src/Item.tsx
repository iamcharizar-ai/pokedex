// One picture for any item, coin or gem: the sprite whose file name is the item's id.
import { MARKS, itemName, type MarkTag } from '../core/economy.ts'
import { BallItem } from './Ball.tsx'

const BIG_BALLS = /^(poke|great|ultra|master|premier|safari)-ball$/
/** Items whose file is not named for them. */
const FILE: Record<string, string> = { chest: 'loot-sack', 'rare-egg': 'mystery-egg', coin: 'nugget', gem: 'psychic-gem', berry: 'oran-berry', incense: 'full-incense' }
const THEME_SWATCH: Record<string, [string, string]> = { 'theme-beach': ['#58c8e8', '#f1dc9a'], 'theme-cave': ['#4a4466', '#8a7a6a'], 'theme-night': ['#121a3d', '#3d7a5c'] }

export function ItemIcon({ id, size = 44, className = '' }: { id: string; size?: number; className?: string }) {
  if (BIG_BALLS.test(id)) return <BallItem id={id} size={size} className={className} />
  if (THEME_SWATCH[id]) {
    const [sky, ground] = THEME_SWATCH[id]
    return <span className={`swatch ${className}`} style={{ width: size, height: size, background: `linear-gradient(${sky} 0 55%, ${ground} 55%)` }} />
  }
  return <img className={`pix itemimg ${className}`} src={`/sprites/items/${FILE[id] ?? id}.png`} width={size} height={size} alt={itemName(id)} draggable={false} />
}

export const Coin = ({ size = 26 }: { size?: number }) => <ItemIcon id="coin" size={size} className="coin" />
export const Gem = ({ size = 26 }: { size?: number }) => <ItemIcon id="gem" size={size} className="gem" />
export const EggIcon = ({ size = 40 }: { size?: number }) => <ItemIcon id="rare-egg" size={size} />
/** A domain's mark: Machine Parts, Iron, Tones, Seeds, Bells. */
export const MarkIcon = ({ tag, size = 26 }: { tag: MarkTag; size?: number }) => <ItemIcon id={MARKS[tag].icon} size={size} className="mark" />
