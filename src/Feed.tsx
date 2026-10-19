// Feeding (version 14): a berry or a treat goes to any Pokemon you own. The
// partner's bond unlocks its perks; a party member's bond adds to every strike.
// A Pokemon with every bond level takes nothing more, so nothing is thrown away.
// Berries can be kept instead, as bait for a throw (see the belt and the boss).
import { nameOf, type Game, type Mon } from '../core/fold.ts'
import { BAIT, BERRY_HEARTS, BOND_PARTY, itemName } from '../core/economy.ts'
import { BOND_PERKS, HEART_CAP, HEART_LEVELS, bondLevel } from '../core/rules.ts'
import { ItemIcon } from './Item.tsx'
import { Sheet } from './screens/Sheet.tsx'
import { still } from './lib/art.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

export const heartsOf = (m: Mon): number => (m.together ?? 0) + (m.fed ?? 0)
const PERK_NAME: Record<string, string> = { pickup: 'Pickup', endure: 'Endure', focus: 'Focus', friends: 'Best friends', share: 'Exp. Share' }

/** Everything in the bag that can be fed, treats first (they are good for nothing else), then berries. */
export const treatsIn = (game: Game): string[] =>
  Object.keys(BERRY_HEARTS).filter((b) => (game.inv[b] ?? 0) > 0).sort((a, b) => Number(Boolean(BAIT[a])) - Number(Boolean(BAIT[b])) || BERRY_HEARTS[b] - BERRY_HEARTS[a])

/** What the next bond level brings this Pokemon, as the one who leads or as one in the party. */
function nextStep(m: Mon, partner: boolean): string {
  const h = heartsOf(m), lvl = bondLevel(h)
  if (h >= HEART_CAP) return 'Every bond level: it takes nothing more'
  const need = HEART_LEVELS[lvl] - h
  return partner ? `${need} ♥ to ${PERK_NAME[BOND_PERKS[lvl]]}` : `${need} ♥ to bond ${lvl + 1} (+${Math.round(BOND_PARTY * 100)}% to every strike)`
}

export function FeedSheet({ game, only, onClose }: { game: Game; only?: string; onClose: () => void }) {
  const treats = only ? [only].filter((b) => (game.inv[b] ?? 0) > 0) : treatsIn(game)
  const inTeam = new Set(game.team.map((m) => m.uid))
  const rows: { m: Mon; where: string }[] = [
    { m: game.partner, where: 'Partner' },
    ...game.team.map((m) => ({ m, where: 'Party' })),
    ...game.queue.filter((m) => !inTeam.has(m.uid)).map((m) => ({ m, where: 'My Pokemon' })),
    ...game.graduates.filter((m) => !inTeam.has(m.uid)).map((m) => ({ m, where: 'Fully trained' })),
  ]
  return (
    <Sheet title={only ? `Feed: ${itemName(only)}` : 'Feed a Pokemon'} onClose={onClose}>
      <p className="muted">
        Hearts stay with the Pokemon for good. Your partner's bond unlocks its perks; a party member's adds {Math.round(BOND_PARTY * 100)}% to every strike per bond level.
        {treats.some((b) => BAIT[b]) ? ' A berry can also be kept as bait for a throw.' : ''}
      </p>
      {treats.length === 0 && <p className="muted">Nothing to feed. Berries are at the Mart and the Garden; Pickup finds them too.</p>}
      <ul className="feed-list">
        {rows.map(({ m, where }) => {
          const h = heartsOf(m), full = h >= HEART_CAP
          return (
            <li key={m.uid} className={full ? 'full' : ''}>
              <img src={still(m.form, m.shiny)} alt="" width={44} height={44} className="sprite" />
              <span className="feed-who">
                <b>{nameOf(m.form)} <small>{where}</small></b>
                <small>{h} ♥ · bond {bondLevel(h)} · {nextStep(m, m.uid === game.partner.uid)}</small>
              </span>
              <span className="feed-btns">
                {treats.map((b) => (
                  <button key={b} type="button" className="k-btn" disabled={full} title={`${itemName(b)}: +${BERRY_HEARTS[b]} hearts (${game.inv[b]} left)`} onClick={() => { useItem(b, m.uid, 'feed'); play('feed'); if (only && (game.inv[b] ?? 0) <= 1) onClose() }}>
                    <ItemIcon id={b} size={22} />+{BERRY_HEARTS[b]}
                  </button>
                ))}
              </span>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
