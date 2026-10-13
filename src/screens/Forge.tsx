// The Forge (Party tab): where Mega Stones are made. It used to be a button on
// each Pokemon's own page; now every Pokemon that can Mega is in one place,
// with the Key Stone and the shards that pay for it.
//
// Forging plays the study's staging: three shards slam into the stone one after
// another (lib/fx.forgeSlam), then the evolution popup (EvoReveal) shows the
// Pokemon becoming its Mega. What is forged is one `forge` event in the
// ledger; this screen only tells it.
import { useMemo, useRef, useState } from 'react'
import { useHold } from './overlay.ts'
import { COMET_SHARD, FORGE_COST, SHARDS, forgeShard, itemName } from '../../core/economy.ts'
import { nameOf, spritePath, type Game, type Mon } from '../../core/fold.ts'
import { SPECIES } from '../../core/species.ts'
import { Win } from '../App.tsx'
import { KeyStone } from '../Ball.tsx'
import { ItemIcon } from '../Item.tsx'
import { EvoReveal } from '../Reveal.tsx'
import { still } from '../lib/art.ts'
import { forgeSlam } from '../lib/fx.ts'
import { play } from '../lib/sfx.ts'
import { useItem } from '../lib/store.ts'
import { told } from '../lib/told.ts'

/** How many ready ones are listed before the rest fold away. */
const SHOWN = 4

interface Slot { m: Mon; mega: string; index: number; count: number }

/** The reveal is something the player started: nothing automatic opens over it. */
function Hold() { useHold(); return null }

export function Forge({ game }: { game: Game }) {
  const [reveal, setReveal] = useState<{ from: string; to: string } | null>(null)
  const busy = useRef(false)

  // every Pokemon that has a Mega form, and each of those forms
  const slots = useMemo(() => {
    const seen = new Set<string>()
    const out: Slot[] = []
    for (const m of [game.partner, ...game.graduates, ...game.queue]) {
      if (seen.has(m.uid)) continue
      seen.add(m.uid)
      const megas = SPECIES[m.form]?.m ?? []
      megas.forEach((mega, index) => out.push({ m, mega, index, count: megas.length }))
    }
    return out
  }, [game])

  const shardOf = (s: Slot): string | null => forgeShard(s.count, s.index, s.m.nature?.up, game.inv)
  const state = (s: Slot): 'done' | 'ready' | 'waiting' | 'locked' =>
    s.m.megas?.includes(s.mega) ? 'done' : !game.keyStone ? 'locked' : shardOf(s) ? 'ready' : 'waiting'
  const order = { ready: 0, waiting: 1, locked: 2, done: 3 } as const
  const sorted = [...slots].sort((a, b) => order[state(a)] - order[state(b)])
  const forgeable = slots.filter((s) => state(s) === 'ready').length

  const forge = async (s: Slot, row: Element | null) => {
    const shard = shardOf(s)
    if (!shard || busy.current) return
    busy.current = true
    told.add(`mega:${s.mega}`) // the news window would tell it again: this is the telling
    await forgeSlam(row, `/sprites/items/${shard}.png`, () => { useItem('', s.m.uid, 'forge', s.mega); play('catch') })
    setReveal({ from: s.m.form, to: s.mega })
    busy.current = false
  }

  const row = (s: Slot) => {
    const st = state(s)
    const shard = shardOf(s)
    return (
      <li key={`${s.m.uid}:${s.mega}`} className={`forge-row ${st}`}>
        <span className="forge-pic">
          <img src={still(s.m.form, s.m.shiny)} alt="" width={52} height={52} className="sprite from" />
          <i aria-hidden>▸</i>
          <img src={still(s.mega, s.m.shiny)} alt="" width={52} height={52} className={`sprite to ${st === 'done' ? '' : 'dim'}`} />
        </span>
        <span className="forge-txt">
          <b>{nameOf(s.mega)}</b>
          <small>
            {st === 'done' ? 'Forged: kept for good'
              : st === 'locked' ? 'Needs the Key Stone'
                : st === 'ready' ? `${FORGE_COST} ${itemName(shard!)}`
                  : `Needs ${FORGE_COST} ${s.count > 1 ? (s.index === 0 ? 'red' : 'blue or yellow') : 'matching'} shards (or a Comet)`}
          </small>
        </span>
        {st === 'ready' && <button type="button" className="k-btn main" onClick={(e) => void forge(s, e.currentTarget.closest('.forge-row'))}>Forge</button>}
        {st === 'done' && <span className="forge-tick" aria-hidden>★</span>}
      </li>
    )
  }

  const counts = [...SHARDS, COMET_SHARD].map((id) => [id, game.inv[id] ?? 0] as const)
  return (
    <Win title="The Forge" tone="purple" aside={game.keyStone ? (forgeable ? `${forgeable} ready` : `${slots.filter((s) => state(s) === 'done').length} forged`) : 'Key Stone needed'}>
      <div className="forge-head">
        <KeyStone size={56} held={Boolean(game.keyStone)} />
        <div className="forge-shards" aria-label="Shards you hold">
          {counts.map(([id, n]) => (
            <span key={id} className={n > 0 ? '' : 'none'} title={`${itemName(id)}: ${n}`}><ItemIcon id={id} size={30} /><b>{n}</b></span>
          ))}
        </div>
      </div>
      <p className="muted">
        {game.keyStone
          ? `${FORGE_COST} shards forge one Mega Stone, kept by that Pokemon for good. Red makes an X, blue or yellow a Y, a lone Mega takes its own colour, and a Comet Shard fits any.`
          : 'The Key Stone is a feat: any one kind of work on seven days running. Until it is yours nothing can be forged.'}
      </p>
      {slots.length === 0 && <p className="muted">None of your Pokemon has a Mega form yet. Finish training one that does and it appears here.</p>}
      <ul className="forge-list">{sorted.filter((s) => state(s) === 'ready').slice(0, SHOWN).map(row)}</ul>
      {forgeable > SHOWN && (
        <details className="forge-more">
          <summary>Also ready <span>{forgeable - SHOWN}</span></summary>
          <ul className="forge-list">{sorted.filter((s) => state(s) === 'ready').slice(SHOWN).map(row)}</ul>
        </details>
      )}
      {forgeable === 0 && slots.length > 0 && <p className="muted">Nothing is ready to forge. {game.keyStone ? 'Shards come from feats, every third set of Strong gear, a month reviewed and a boss kill.' : ''}</p>}
      {sorted.some((s) => state(s) === 'waiting' || state(s) === 'locked') && (
        <details className="forge-more">
          <summary>Not ready yet <span>{sorted.filter((s) => state(s) === 'waiting' || state(s) === 'locked').length}</span></summary>
          <ul className="forge-list">{sorted.filter((s) => state(s) === 'waiting' || state(s) === 'locked').map(row)}</ul>
        </details>
      )}
      {sorted.some((s) => state(s) === 'done') && (
        <details className="forge-more">
          <summary>Forged <span>{sorted.filter((s) => state(s) === 'done').length}</span></summary>
          <ul className="forge-list">{sorted.filter((s) => state(s) === 'done').map(row)}</ul>
        </details>
      )}
      {reveal && (
        <div className="capsule" role="dialog" aria-modal="true" aria-label="Mega forged" onClick={() => setReveal(null)}>
          <Hold />
          <div className="capsule-stage" style={{ width: 'min(360px, 92vw)', height: 'auto' }}>
            <EvoReveal from={still(reveal.from)} to={spritePath(reveal.to)} title={`${nameOf(reveal.to)}!`} />
          </div>
          <p className="capsule-line">A Mega Stone is forged. {nameOf(reveal.from)} keeps it for good.</p>
          <button type="button" className="k-btn main capsule-go" autoFocus>Nice</button>
        </div>
      )}
    </Win>
  )
}
