// Version 16 on the screens (RULES-V16.md): each Pokemon's signature, and the
// party's signatures together as a deck.
//
// A signature comes from a Pokemon's first type and belongs to one of six
// families, one for each kind of work. Its strength is the Pokemon's own bond
// level as partner, half that in the party; a family adds up to SIG_CAP. So the
// party is chosen like a deck: which families do you want behind you?
import { useState, type CSSProperties } from 'react'
import { FAMILY_NAME, SIG_CAP, SIG_FAMILY, sigStrength, sigText, signatureOf, type SigFamily } from '../core/bond.ts'
import { isShelved, nameOf, type Game, type Mon } from '../core/fold.ts'
import { HEART_LEVELS, bondLevel, type Tag } from '../core/rules.ts'
import { TAG_NAME, Win } from './App.tsx'
import { heartsOf } from './Feed.tsx'
import { ItemIcon } from './Item.tsx'
import { still } from './lib/art.ts'
import { play } from './lib/sfx.ts'
import { CropSprite } from './lib/pixel.tsx'
import { useBoxes } from './Fit.tsx'

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
      <ItemIcon id={s.icon} size={16} /><i>{lvl}</i>
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
      <span className="sigline-ico"><ItemIcon id={s.icon} size={24} /></span>
      <span className="sigline-txt">
        <b>{s.name} <small>{FAMILY_NAME[s.family]} · {s.type}</small></b>
        <small>{lvl === 0 ? `Wakes at bond 1 (${HEART_LEVELS[0]} ♥): ${sigText(s.family, sigStrength(1, partner || !inParty))}` : `${sigText(s.family, partner || inParty ? now : lvl)} (${where})`}</small>
        {next !== undefined && lvl > 0 && <small className="sigline-next">{next - hearts} ♥ to bond {lvl + 1}: {sigText(s.family, sigStrength(lvl + 1, partner || !inParty))}</small>}
      </span>
    </div>
  )
}

/**
 * The party's signatures together, as a row of six badges (UI-AUDIT-2026-11-04 T3): each family's ring fills, in its kind of
 * work's colour, with how strong the party makes it; a pip for each member who brings it (the partner's gold). A family nobody
 * in the party brings is grey. What a family does is said for one at a time: the strongest, or the one tapped.
 */
export function Deck({ game }: { game: Game }) {
  const [pick, setPick] = useState<SigFamily | null>(null)
  const boxes = useBoxes()
  if (!game.v16) return null
  const members: Mon[] = [game.partner, ...game.team.filter((m) => m.uid !== game.partner.uid)]
  const families = (Object.keys(FAMILY_NAME) as SigFamily[])
  const whoOf = (f: SigFamily) => members.filter((m) => signatureOf(m.form).family === f)
  const live = families.filter((f) => game.sigs[TAG_OF[f]] > 0 || whoOf(f).length > 0)
  const strongest = [...live].sort((a, b) => game.sigs[TAG_OF[b]] - game.sigs[TAG_OF[a]])[0] ?? families[0]
  const shown = pick ?? strongest
  const tagOf = TAG_OF[shown], strength = game.sigs[tagOf], who = whoOf(shown)
  const say = !live.includes(shown)
    ? `Nobody in your party brings it. ${FAMILY_TYPES[shown].join(', ')} Pokemon do.`
    : isShelved(game, tagOf) ? `Resting: ${TAG_NAME[tagOf]} is off your Life OS list.`
      : strength > 0 ? `${sigText(shown, strength)}.` : 'Asleep: bond its Pokemon to wake it.'
  return (
    <Win title="Signatures" tone="purple" aside={`${live.length} of 6 families`}>
      <div className="sigrow" role="group" aria-label="The party's signatures">
        {families.map((f) => {
          const on = live.includes(f), tag = TAG_OF[f], st = game.sigs[tag]
          return (
            <button key={f} type="button" className={`sig-node ${on ? '' : 'off'} ${f === shown ? 'sel' : ''}`} aria-pressed={f === shown} onClick={() => { setPick(f); play('tap') }}
              style={{ ['--fc' as string]: `var(--tag-${tag})`, ['--p' as string]: Math.min(1, st / SIG_CAP) } as CSSProperties}
              aria-label={`${FAMILY_NAME[f]}, ${TAG_NAME[tag]}: ${on ? `strength ${st} of ${SIG_CAP}, from ${whoOf(f).map((m) => nameOf(m.form)).join(' and ') || 'nobody yet'}` : 'not in your party'}`}>
              <span className="sig-ring"><ItemIcon id={FAMILY_ICON[f]} size={24} /></span>
              <b>{FAMILY_NAME[f]}</b>
              <span className="sig-pips" aria-hidden>{whoOf(f).map((m) => <i key={m.uid} className={m.uid === game.partner.uid ? 'lead' : ''} />)}</span>
            </button>
          )
        })}
      </div>
      <p className="sig-say">
        <b>{FAMILY_NAME[shown]} <small>{TAG_NAME[tagOf]}</small></b> {say}
        {who.length > 0 && <span className="sig-who">{who.map((m) => <CropSprite key={m.uid} src={still(m.form, m.shiny)} box={boxes?.[m.form]} alt={nameOf(m.form)} title={`${nameOf(m.form)}: ${signatureOf(m.form).name}`} />)}</span>}
      </p>
    </Win>
  )
}
