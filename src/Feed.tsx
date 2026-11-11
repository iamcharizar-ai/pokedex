// Feeding (version 14): a berry or a treat goes to any Pokemon you own. The
// partner's bond unlocks its perks; a party member's bond adds to every strike.
// A Pokemon with every bond level takes nothing more, so nothing is thrown away.
//
// Version 16: a bond grows a Pokemon's own signature (Bond.tsx), every heart
// adds to the trainer's perks, and a berry pays double on a day its Pokemon's
// kind of work was done: the sheet marks who that is today.
//
// The sheet is the cards themselves (UI-AUDIT-2026-11-04 T2): each card's hearts pill shows what one berry
// would add as ghost hearts, a green arrow where it finishes a bond level; tap a card to feed it.
import { useState } from 'react'
import { MonCard } from './MonCard.tsx'
import { monCardOf } from './Team.tsx'
import { useLook } from './lib/cardkit.tsx'
import { nameOf, type Game, type Mon } from '../core/fold.ts'
import { BERRY_HEARTS, itemName } from '../core/economy.ts'
import { BERRY_DOMAIN_MULT, signatureOf } from '../core/bond.ts'
import { berryGain, likesBerry } from '../core/v22.ts'
import { HEART_CAP } from '../core/rules.ts'
import { ItemIcon } from './Item.tsx'
import { Sheet } from './screens/Sheet.tsx'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

export const heartsOf = (m: Mon): number => (m.together ?? 0) + (m.fed ?? 0)

/** Everything in the bag that can be fed, the most hearts first. */
export const treatsIn = (game: Game): string[] =>
  Object.keys(BERRY_HEARTS).filter((b) => (game.inv[b] ?? 0) > 0).sort((a, b) => BERRY_HEARTS[b] - BERRY_HEARTS[a])

export function FeedSheet({ game, only, onClose }: { game: Game; only?: string; onClose: () => void }) {
  const treats = only ? [only].filter((b) => (game.inv[b] ?? 0) > 0) : treatsIn(game)
  const [pick, setPick] = useState<string | null>(null)
  const berry = pick && treats.includes(pick) ? pick : treats[0] ?? null
  const { look, boxOf } = useLook()
  // everyone you own, once: the partner, the party, then the rest
  const seen = new Set<string>()
  const all = [game.partner, ...game.team, ...game.queue, ...game.graduates].filter((m) => (seen.has(m.uid) ? false : (seen.add(m.uid), true)))
  // version 16: a berry pays double for whoever's kind of work was done today; they come first, after the partner
  // version 22: a berry's favourite takes 5 hearts and anyone else 2, whatever was done today; they come first
  const twice = (m: Mon) => Boolean(game.v22 ? berry && likesBerry(berry, m.form, game.today.day) && heartsOf(m) < HEART_CAP : game.v16 && game.worked[signatureOf(m.form).tag] && heartsOf(m) < HEART_CAP)
  const sorted = [all[0], ...all.slice(1).filter(twice), ...all.slice(1).filter((m) => !twice(m))]
  const gainOf = (m: Mon) => (berry ? Math.min(berryGain(berry, m.form, game.today.day, !game.v22 && twice(m)), game.v16 ? HEART_CAP - heartsOf(m) : Infinity) : 0)
  const feed = (m: Mon) => { if (!berry || heartsOf(m) >= HEART_CAP) return; useItem(berry, m.uid, 'feed'); play('feed') }
  return (
    <Sheet title={only ? `Feed: ${itemName(only)}` : 'Feed a Pokemon'} onClose={onClose}>
      <div className="feed2">
        <h2 className="k-type">{only ? `Feed: ${itemName(only)}` : 'Feed a Pokemon'}</h2>
        {/* the berry is chosen once, here; every card below shows what one would give it */}
        {treats.length > 1 && (
          <div className="feed-pick" role="radiogroup" aria-label="Which berry">
            {treats.map((b) => (
              <button key={b} type="button" role="radio" aria-checked={b === berry} className={`feed-berry ${b === berry ? 'on' : ''}`} onClick={() => { setPick(b); play('tap') }} title={`${itemName(b)}: +${BERRY_HEARTS[b]} hearts`}>
                <ItemIcon id={b} size={24} /><i>{game.inv[b]}</i><small>+{BERRY_HEARTS[b]}</small>
              </button>
            ))}
          </div>
        )}
        {berry
          ? <p className="feed2-say"><ItemIcon id={berry} size={24} /><span>Tap a card to give it one. {game.v16 && <><b>×{BERRY_DOMAIN_MULT} today</b> on a card: its kind of work was done.</>}</span></p>
          : <p className="muted">Nothing to feed. Berries are at the Mart and the Garden; Pickup finds them too.</p>}
        <div className="mon-grid" role="list" aria-label="Who to feed">
          {sorted.map((m) => {
            const card = monCardOf(m, game), gain = gainOf(m), full = heartsOf(m) >= HEART_CAP
            const mon = { ...card, ghost: full ? 0 : gain, canFeed: card.need !== null && heartsOf(m) + gain >= card.need }
            return (
              <div key={m.uid} role="listitem">
                <MonCard mon={mon} look={look} box={boxOf(m.form)} role={m.uid === game.partner.uid ? 'partner' : 'party'} ribbon={m.uid === game.partner.uid ? 'Partner' : twice(m) ? `×${BERRY_DOMAIN_MULT} today` : undefined}
                  dimmed={full || !berry} disabled={full || !berry} onClick={() => feed(m)}
                  aria-label={full ? `${nameOf(m.form)}: every bond level reached` : `Feed ${nameOf(m.form)} one ${berry ? itemName(berry) : 'berry'}: plus ${gain} hearts, ${heartsOf(m)} now`} />
              </div>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}
