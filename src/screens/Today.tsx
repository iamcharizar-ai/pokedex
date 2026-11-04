// Small things the page did not already say:
// - whether the balls in the bag can finish the wild Pokemon (the heading of
//   Throw and feed; its HP is already on the scene, so it is not repeated),
// - and for the tab bar, which other tab has something you can do right now.
// Nothing here is a new rule: all of it is read from the game as it stands.
import { BALLS, EVO_ITEMS, FOSSILS, REVIVE_COST, collectorWants, itemName, throwHp } from '../../core/economy.ts'
import type { Game } from '../../core/fold.ts'
import { SPECIES } from '../../core/species.ts'
import { V14_START } from '../../core/rules.ts'

/** What a ball would take off the wild Pokemon today. */
const hitOf = (game: Game, ball: string): number => {
  const w = game.wild
  if (!w || w.caught) return 0
  const r = SPECIES[w.form]
  return Math.min(w.hp, throwHp(ball, { types: [r.t, r.t2], from: w.from, owned: Boolean(game.dex[w.form]?.own) }, game.today.day))
}

/** "A Great Ball catches it" / "Your balls can catch it", or nothing when they cannot. A Master Ball always can, so it is left out: it is not spent lightly. */
export function reachNote(game: Game): string | undefined {
  const w = game.wild
  if (!w || w.caught) return undefined
  const balls = Object.keys(BALLS).filter((b) => (game.inv[b] ?? 0) > 0 && BALLS[b].hp < 1_000_000).sort((a, b) => hitOf(game, b) - hitOf(game, a))
  if (!balls.length) return undefined
  if (hitOf(game, balls[0]) >= w.hp) return `A ${itemName(balls[0])} catches it`
  const reach = balls.reduce((n, b) => n + hitOf(game, b) * (game.inv[b] ?? 0), 0)
  return reach >= w.hp ? 'Your balls can catch it' : undefined
}

/**
 * Which tabs have something you can do now, and what, for a dot on the tab bar.
 * Only things that are waiting on you and would be missed: a fossil you can
 * afford to bring back, a treasure the Collector pays double for today, a stone
 * that evolves one of your Pokemon. Collect has its own place in the top bar.
 */
export function tabTodo(game: Game): { shop: string | null; shopAt: 'coins' | 'gems' | null; team: string | null } {
  const has = (id: string) => (game.inv[id] ?? 0) > 0
  const fossil = Object.keys(FOSSILS).find(has)
  const wanted = game.today.day >= V14_START ? collectorWants(game.today.day).find(has) : undefined
  const shop = fossil && game.wallet.coins >= REVIVE_COST ? `The Lab can bring your ${itemName(fossil)} back` : wanted ? `The Collector pays double for your ${itemName(wanted)} today` : null
  const stone = Object.entries(EVO_ITEMS).find(([id, e]) => has(id) && game.queue.some((m) => (SPECIES[m.form]?.e ?? []).some((f) => SPECIES[f] && (e.types.includes(SPECIES[f].t) || (SPECIES[f].t2 !== undefined && e.types.includes(SPECIES[f].t2!))))))
  const team = stone ? `A ${itemName(stone[0])} can evolve one of your Pokemon` : null
  // which Shop counter it is at: the Lab is with the gems, the Collector with the coins
  return { shop, shopAt: !shop ? null : fossil && game.wallet.coins >= REVIVE_COST ? 'gems' : 'coins', team }
}
