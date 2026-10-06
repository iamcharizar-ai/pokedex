// The three balls and the Key Stone, drawn here pixel by pixel like the egg
// (no artwork is borrowed for them).
import { BALL_NAME, type Ball as BallId } from '../core/rules.ts'

const BALL = [
  '....oooo....', '..oottttoo..', '.otaattaato.', '.otaattaato.', 'otttttttttto', 'ooooowwooooo',
  'ooooowwooooo', 'owwwwoowwwwo', '.owwwwwwwwo.', '.owwwwwwsso.', '..oowwssoo..', '....oooo....',
]
// t the top half · a its markings · w the bottom half · s shade · o outline
const BALL_FILL: Record<BallId, Record<string, string>> = {
  poke: { o: '#23283a', t: '#dc3b45', a: '#f0717a', w: '#fbf6e3', s: '#ddd3b4' },
  great: { o: '#23283a', t: '#2f7fd0', a: '#dc3b45', w: '#fbf6e3', s: '#ddd3b4' },
  ultra: { o: '#23283a', t: '#2b3048', a: '#f5b800', w: '#fbf6e3', s: '#ddd3b4' },
}

export function Ball({ ball, size = 24, className = '' }: { ball: BallId; size?: number; className?: string }) {
  const fill = BALL_FILL[ball]
  return (
    <svg className={`ball ${className}`} width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" role="img" aria-label={BALL_NAME[ball]}>
      {BALL.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill[c]} />)))}
    </svg>
  )
}

const STONE = [
  '....oooo....', '..oobbccoo..', '.obbbccccgo.', '.obbwwccggo.', 'opbwwwcgggyo', 'oppbwccggyyo',
  'opppprryyyyo', 'opppprryyyyo', '.oppprryyyo.', '.oopprryyoo.', '..ooorrooo..', '....oooo....',
]
const STONE_FILL: Record<string, string> = { o: '#23283a', b: '#63c6ff', c: '#3fd07a', g: '#b6e08a', y: '#f5b800', r: '#ee7b2f', p: '#e0559a', w: '#ffffff' }

export function KeyStone({ size = 24, held = true }: { size?: number; held?: boolean }) {
  return (
    <svg className={`keystone ${held ? '' : 'unheld'}`} width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" role="img" aria-label={held ? 'Key Stone' : 'Key Stone, not held yet'}>
      {STONE.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={STONE_FILL[c]} />)))}
    </svg>
  )
}
