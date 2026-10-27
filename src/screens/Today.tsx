// Today (home): the few things worth doing now, picked from the game, so the
// front page answers "what is there to do?" without opening anything. Each row
// is a fact the game already knows and the page does not already show: a catch
// within reach, the egg's steps. The leader and the rewards have their own
// places on this page, so they are not repeated here. Nothing here is a new rule.
import { Win } from '../App.tsx'
import { ItemIcon } from '../Item.tsx'
import { KBar } from '../Kit.tsx'
import { BALLS, itemName, throwHp } from '../../core/economy.ts'
import { nameOf, type Game } from '../../core/fold.ts'
import { SPECIES } from '../../core/species.ts'
import { STEPS_GOAL } from '../../core/rules.ts'

interface Row { key: string; icon: string; head: string; sub: string; bar?: { value: number; max: number } }

/** What a ball would take off the wild Pokemon today. */
const hitOf = (game: Game, ball: string): number => {
  const w = game.wild
  if (!w || w.caught) return 0
  const r = SPECIES[w.form]
  return Math.min(w.hp, throwHp(ball, { types: [r.t, r.t2], from: w.from, owned: Boolean(game.dex[w.form]?.own) }, game.today.day))
}

export function todayRows(game: Game): Row[] {
  const rows: Row[] = []
  const w = game.wild
  if (w && !w.caught) {
    const balls = Object.keys(BALLS).filter((b) => (game.inv[b] ?? 0) > 0 && BALLS[b].hp < 1_000_000)
    const best = balls.sort((a, b) => hitOf(game, b) - hitOf(game, a))[0]
    const reach = balls.reduce((n, b) => n + hitOf(game, b) * (game.inv[b] ?? 0), 0)
    const name = nameOf(w.form)
    const leaving = w.leavesIn !== undefined && w.leavesIn <= 3 ? ` It gets away in ${w.leavesIn + 1} day${w.leavesIn ? 's' : ''}.` : ''
    if (best && hitOf(game, best) >= w.hp) rows.push({ key: 'wild', icon: best, head: `Catch ${name} now`, sub: `A ${itemName(best)} finishes it (${w.hp} HP left).${leaving}` })
    else if (best && reach >= w.hp) rows.push({ key: 'wild', icon: best, head: `${name} is within reach`, sub: `${w.hp} HP left and the balls in your bag can take it, ${hitOf(game, best)} at a time.${leaving}` })
    else rows.push({ key: 'wild', icon: 'poke-ball', head: `${name}: ${w.hp} HP left`, sub: `Today's work wears it down; a ball finishes it.${leaving}` })
  }
  if (game.egg) {
    const left = Math.max(0, game.egg.need - game.egg.have)
    const set = game.egg.since === game.today.day
    rows.push({ key: 'egg', icon: 'rare-egg', head: left <= STEPS_GOAL ? 'The egg hatches soon' : 'The egg is warming', sub: set ? 'Set up today: its steps count from tomorrow.' : `${left.toLocaleString()} steps to go (up to ${STEPS_GOAL.toLocaleString()} a day count).`, bar: { value: game.egg.have, max: game.egg.need } })
  }
  return rows
}

export function TodayWin({ game }: { game: Game }) {
  const rows = todayRows(game)
  if (rows.length === 0) return null
  return (
    <Win title="Today" tone="green" aside={`${rows.length} thing${rows.length > 1 ? 's' : ''}`}>
      <ul className="todaylist">
        {rows.map((r) => (
          <li key={r.key} className="todayrow">
            <ItemIcon id={r.icon} size={32} />
            <span className="todaytxt"><b>{r.head}</b><small>{r.sub}</small>{r.bar && <KBar value={r.bar.value} max={r.bar.max} kind={r.key === 'egg' ? 'gold' : 'hp'} label={r.key === 'egg' ? `${r.bar.value.toLocaleString()} / ${r.bar.max.toLocaleString()} steps` : `${Math.round((r.bar.value / r.bar.max) * 100)}% down`} />}</span>
          </li>
        ))}
      </ul>
    </Win>
  )
}
