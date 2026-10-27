// Version 16 on the screens (RULES-V16.md): each Pokemon's signature, and the
// party's signatures together as a deck.
//
// A signature comes from a Pokemon's first type and belongs to one of six
// families, one for each kind of work. Its strength is the Pokemon's own bond
// level as partner, half that in the party; a family adds up to SIG_CAP. So the
// party is chosen like a deck: which families do you want behind you?
import type { CSSProperties } from 'react'
import { FAMILY_NAME, SIG_CAP, SIG_FAMILY, sigStrength, sigText, signatureOf, type SigFamily } from '../core/bond.ts'
import { nameOf, type Game, type Mon } from '../core/fold.ts'
import { HEART_LEVELS, bondLevel, type Tag } from '../core/rules.ts'
import { TAG_NAME, Win } from './App.tsx'
import { heartsOf } from './Feed.tsx'
import { ItemIcon } from './Item.tsx'
import { still } from './lib/art.ts'

/** Each family's picture: the item of one of its types. */
const FAMILY_ICON: Record<SigFamily, string> = { power: 'black-belt', insight: 'twistedspoon', charm: 'pink-scarf', forage: 'miracle-seed', dream: 'blackglasses', flow: 'mystic-water' }
const TAG_OF: Record<SigFamily, Tag> = Object.fromEntries(Object.entries(SIG_FAMILY).map(([t, f]) => [f, t])) as Record<SigFamily, Tag>
/** The types that give each family: "who would add to it" */
const FAMILY_TYPES: Record<SigFamily, string[]> = {
  power: ['Fighting', 'Rock', 'Ground', 'Steel', 'Fire', 'Dragon'], insight: ['Psychic', 'Electric', 'Ghost'], charm: ['Fairy', 'Normal', 'Flying'],
  forage: ['Grass'], dream: ['Dark'], flow: ['Water', 'Ice', 'Bug', 'Poison'],
}

/** A Pokemon's signature as a small badge: its picture and its bond level. Drawn on a party slot. */
export function SigBadge({ m }: { m: Mon }) {
  const s = signatureOf(m.form)
  const lvl = bondLevel(heartsOf(m))
  return (
    <span className={`sigbadge ${lvl ? '' : 'dim'}`} title={`${s.name} (${FAMILY_NAME[s.family]}), bond ${lvl}`} aria-hidden>
      <ItemIcon id={s.icon} size={18} /><i>{lvl}</i>
    </span>
  )
}

/** One Pokemon's signature in a line: what it is, what it does now, and what the next bond level makes it. */
export function SigLine({ m, game }: { m: Mon; game: Game }) {
  const s = signatureOf(m.form)
  const hearts = heartsOf(m)
  const lvl = bondLevel(hearts)
  const partner = m.uid === game.partner.uid
  const inParty = game.team.some((x) => x.uid === m.uid)
  const now = sigStrength(lvl, partner)
  const next = HEART_LEVELS[lvl]
  const where = partner ? 'as partner, in full' : inParty ? 'in the party, at half' : 'only as partner or in the party'
  return (
    <div className="sigline" style={{ ['--fc' as string]: `var(--tag-${s.tag})` } as CSSProperties}>
      <span className="sigline-ico"><ItemIcon id={s.icon} size={34} /></span>
      <span className="sigline-txt">
        <b>{s.name} <small>{FAMILY_NAME[s.family]} · {s.type}</small></b>
        <small>{lvl === 0 ? `Wakes at bond 1 (${HEART_LEVELS[0]} ♥): ${sigText(s.family, sigStrength(1, partner || !inParty))}` : `${sigText(s.family, partner || inParty ? now : lvl)} (${where})`}</small>
        {next !== undefined && lvl > 0 && <small className="sigline-next">{next - hearts} ♥ to bond {lvl + 1}: {sigText(s.family, sigStrength(lvl + 1, partner || !inParty))}</small>}
      </span>
    </div>
  )
}

/** The party's signatures together: each family's strength, who gives it, and what it does today. */
export function Deck({ game }: { game: Game }) {
  if (!game.v16) return null
  const members: Mon[] = [game.partner, ...game.team.filter((m) => m.uid !== game.partner.uid)]
  const families = (Object.keys(FAMILY_NAME) as SigFamily[])
  const live = families.filter((f) => game.sigs[TAG_OF[f]] > 0 || members.some((m) => signatureOf(m.form).family === f))
  const empty = families.filter((f) => !live.includes(f))
  return (
    <Win title="Signatures" tone="purple" aside={`${live.length} of 6 families`}>
      <div className="deck">
        {live.map((f) => {
          const tag = TAG_OF[f], s = game.sigs[tag]
          const who = members.filter((m) => signatureOf(m.form).family === f)
          return (
            <div key={f} className="deck-row" style={{ ['--fc' as string]: `var(--tag-${tag})` } as CSSProperties}>
              <span className="deck-ico"><ItemIcon id={FAMILY_ICON[f]} size={30} /></span>
              <span className="deck-txt">
                <b>{FAMILY_NAME[f]} <small>{TAG_NAME[tag]}</small></b>
                <small>{s > 0 ? sigText(f, s) : 'Asleep: bond its Pokemon to wake it'}</small>
                <span className="deck-bar" role="meter" aria-valuemin={0} aria-valuemax={SIG_CAP} aria-valuenow={s} aria-label={`${FAMILY_NAME[f]} strength`}><i style={{ width: `${(s / SIG_CAP) * 100}%` }} /></span>
              </span>
              <span className="deck-who">{who.map((m) => <img key={m.uid} src={still(m.form, m.shiny)} alt={nameOf(m.form)} title={`${nameOf(m.form)}: ${signatureOf(m.form).name}`} width={32} height={32} className={`sprite ${m.uid === game.partner.uid ? 'lead' : ''}`} />)}</span>
            </div>
          )
        })}
        {empty.length > 0 && (
          <p className="deck-missing">
            <span className="k-label">Not in your party</span>
            {empty.map((f) => <span key={f} className="deck-chip" title={`${FAMILY_TYPES[f].join(', ')} Pokemon bring it`}><ItemIcon id={FAMILY_ICON[f]} size={20} />{FAMILY_NAME[f]} <small>{FAMILY_TYPES[f].slice(0, 2).join('/')}{FAMILY_TYPES[f].length > 2 ? '…' : ''}</small></span>)}
          </p>
        )}
      </div>
    </Win>
  )
}
