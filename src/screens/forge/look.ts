// How each kind of shard looks on the altar: the colour of the water it pours into the crevices, and whether it is a Comet (every colour in turn).
import type { RGB } from './glow.ts'
import { COMET } from './machine.ts'

const RGBS: Record<string, RGB> = {
  'red-shard': [1, 0.25, 0.25],
  'blue-shard': [0.3, 0.55, 1],
  'green-shard': [0.25, 0.9, 0.45],
  'yellow-shard': [1, 0.85, 0.25],
}
const HEX: Record<string, string> = { 'red-shard': '#ff5a5a', 'blue-shard': '#5a8cff', 'green-shard': '#4ae673', 'yellow-shard': '#ffd940', [COMET]: '#f3e4ff' }

export const shardRgb = (kind: string | null): RGB => (kind ? RGBS[kind] ?? [1, 1, 1] : [1, 1, 1])
export const shardHex = (kind: string | null): string => (kind ? HEX[kind] ?? '#ffffff' : '#ffffff')
export const isComet = (kind: string | null): boolean => kind === COMET
