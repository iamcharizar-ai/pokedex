// Feeding (version 14): a berry or a treat goes to any Pokemon you own. The
// partner's bond unlocks its perks; a party member's bond adds to every strike.
// A Pokemon with every bond level takes nothing more, so nothing is thrown away.
//
// Version 16: a bond grows a Pokemon's own signature (Bond.tsx), every heart
// adds to the trainer's perks, and a berry pays double on a day its Pokemon's
// kind of work was done: the sheet marks who that is today.
import { useState } from 'react'
import { nameOf, type Game, type Mon } from '../core/fold.ts'
import { BERRY_HEARTS, BOND_PARTY, itemName } from '../core/economy.ts'
import { BERRY_DOMAIN_MULT, FAMILY_NAME, sigStrength, sigText, signatureOf } from '../core/bond.ts'
import { BOND_PERKS, HEART_CAP, HEART_LEVELS, bondLevel } from '../core/rules.ts'
import { ItemIcon } from './Item.tsx'
import { Sheet } from './screens/Sheet.tsx'
import { still } from './lib/art.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

export const heartsOf = (m: Mon): number => (m.together ?? 0) + (m.fed ?? 0)
const PERK_NAME: Record<string, string> = { pickup: 'Pickup', endure: 'Endure', focus: 'Focus', friends: 'Best friends', share: 'Exp. Share' }

/** Everything in the bag that can be fed, the most hearts first. */
export const treatsIn = (game: Game): string[] =>
  Object.keys(BERRY_HEARTS).filter((b) => (game.inv[b] ?? 0) > 0).sort((a, b) => BERRY_HEARTS[b] - BERRY_HEARTS[a])

/** What the next bond level brings this Pokemon, as the one who leads or as one in the party. */
function nextStep(m: Mon, partner: boolean, v16 = false, inParty = false): string {
  const h = heartsOf(m), lvl = bondLevel(h)
  if (h >= HEART_CAP) return 'Every bond level: it takes nothing more'
  const need = HEART_LEVELS[lvl] - h
  if (v16) { const s = signatureOf(m.form), t = sigText(s.family, sigStrength(lvl + 1, partner || !inParty)); return `${need} ♥ to ${s.name} ${lvl + 1}: ${t[0].toLowerCase()}${t.slice(1)}` }
  return partner ? `${need} ♥ to ${PERK_NAME[BOND_PERKS[lvl]]}` : `${need} ♥ to bond ${lvl + 1} (+${Math.round(BOND_PARTY * 100)}% to every strike)`
}

export function FeedSheet({ game, only, onClose }: { game: Game; only?: string; onClose: () => void }) {
  const treats = only ? [only].filter((b) => (game.inv[b] ?? 0) > 0) : treatsIn(game)
  const [pick, setPick] = useState<string | null>(null)
  const berry = pick && treats.includes(pick) ? pick : treats[0] ?? null
  const inTeam = new Set(game.team.map((m) => m.uid))
  const rows: { m: Mon; where: string }[] = [
    { m: game.partner, where: 'Partner' },
    ...game.team.map((m) => ({ m, where: 'Party' })),
    ...game.queue.filter((m) => !inTeam.has(m.uid)).map((m) => ({ m, where: 'My Pokemon' })),
    ...game.graduates.filter((m) => !inTeam.has(m.uid)).map((m) => ({ m, where: 'Fully trained' })),
  ]
  // version 16: whoever a berry pays double for today comes first, after the partner
  const twiceToday = (m: Mon) => game.v16 && game.worked[signatureOf(m.form).tag] && heartsOf(m) < HEART_CAP
  const sorted = [rows[0], ...rows.slice(1).filter((r) => twiceToday(r.m)), ...rows.slice(1).filter((r) => !twiceToday(r.m))]
  return (
    <Sheet title={only ? `Feed: ${itemName(only)}` : 'Feed a Pokemon'} onClose={onClose}>
      <p className="muted">
        {game.v16
          ? <>Hearts stay with the Pokemon for good and grow its signature: in full as partner, at half in the party. Every heart also counts for your Trainer perks. <b>×{BERRY_DOMAIN_MULT} today</b> marks a Pokemon whose kind of work you did today.</>
          : <>Hearts stay with the Pokemon for good. Your partner's bond unlocks its perks; a party member's adds {Math.round(BOND_PARTY * 100)}% to every strike per bond level.</>}
      </p>
      {treats.length === 0 && <p className="muted">Nothing to feed. Berries are at the Mart and the Garden; Pickup finds them too.</p>}
      {/* the berry is chosen once, here; each Pokemon below has one button */}
      {treats.length > 1 && (
        <div className="feed-pick" role="radiogroup" aria-label="Which berry">
          {treats.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={b === berry} className={`feed-berry ${b === berry ? 'on' : ''}`} onClick={() => { setPick(b); play('tap') }} title={`${itemName(b)}: +${BERRY_HEARTS[b]} hearts`}>
              <ItemIcon id={b} size={28} /><i>{game.inv[b]}</i><small>+{BERRY_HEARTS[b]}</small>
            </button>
          ))}
        </div>
      )}
      <ul className="feed-list">
        {sorted.map(({ m, where }) => {
          const h = heartsOf(m), full = h >= HEART_CAP
          const sig = signatureOf(m.form)
          const twice = game.v16 && game.worked[sig.tag] && !full
          return (
            <li key={m.uid} className={full ? 'full' : ''}>
              <img src={still(m.form, m.shiny)} alt="" width={44} height={44} className="sprite" />
              <span className="feed-who">
                <b>{nameOf(m.form)} <small>{where}</small>{twice && <em className="feed-twice">×{BERRY_DOMAIN_MULT} today</em>}</b>
                <small>{game.v16 && <><ItemIcon id={sig.icon} size={16} /> {FAMILY_NAME[sig.family]} · </>}{h} ♥ · bond {bondLevel(h)} · {nextStep(m, m.uid === game.partner.uid, game.v16, where === 'Party')}</small>
              </span>
              {berry && (
                <button type="button" className={`k-btn feed-go ${twice ? 'main' : ''}`} disabled={full} title={`${itemName(berry)}: +${BERRY_HEARTS[berry] * (twice ? BERRY_DOMAIN_MULT : 1)} hearts (${game.inv[berry]} left)`} onClick={() => { useItem(berry, m.uid, 'feed'); play('feed'); if (only && (game.inv[berry] ?? 0) <= 1) onClose() }}>
                  <ItemIcon id={berry} size={22} />+{Math.min(BERRY_HEARTS[berry] * (twice ? BERRY_DOMAIN_MULT : 1), game.v16 ? HEART_CAP - h : Infinity)}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
