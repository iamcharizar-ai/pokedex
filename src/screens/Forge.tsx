// The Forge (Party tab): where Mega Stones are made.
//
// From version 23 (V23_START) each Mega has its own recipe of three shards and the Forge is the altar of screens/forge/: you place the shards yourself, then the
// Key Stone, and the forge runs (FORGE-EXPERIENCE.md). Before that day the old ritual (ForgeClassic.tsx) is kept, because the old rule does not know recipes.
//
// This file is the game's side of it: which Mega can be forged and what it needs, the picker, the card after the stone is taken, and what the screen shows
// below the altar. What is forged is still one `forge` event in the ledger, written when the Key Stone goes in; nothing is spent before that.
import { useCallback, useMemo, useState } from 'react'
import { FORGE_COINS } from '../../core/economy.ts'
import { HEART_CAP } from '../../core/rules.ts'
import { recipeOf } from '../../core/v23.ts'
import { nameOf, spritePath, type Game, type Mon } from '../../core/fold.ts'
import { SPECIES } from '../../core/species.ts'
import { Win } from './../App.tsx'
import { MegaStone, megaStoneName } from '../Ball.tsx'
import { still } from '../lib/art.ts'
import { play } from '../lib/sfx.ts'
import { useItem } from '../lib/store.ts'
import { told } from '../lib/told.ts'
import { useHold } from './overlay.ts'
import { ForgeClassic, KeyStoneSource, NextShards } from './ForgeClassic.tsx'
import { Stage } from './forge/Stage.tsx'
import { recipeReachable, type Forge as ForgeEvent } from './forge/machine.ts'

interface Slot { m: Mon; mega: string; index: number; count: number }
type State = 'done' | 'ready' | 'shards' | 'coins' | 'training' | 'locked'

/** "Charizard-Mega-X" is "Charizard X" under its picture; the Mega is said by the mark beside it. */
const shortName = (mega: string): string => nameOf(mega).replace(/[-\s]?Mega[-\s]?/i, ' ').replace(/\s+/g, ' ').trim()
const SMALL: Record<State, string> = { done: 'Forged', ready: 'Ready', shards: 'Needs shards', coins: 'Needs coins', training: 'Not trained', locked: 'Locked' }

export function Forge({ game }: { game: Game }) {
  return game.v23 ? <Altar game={game} /> : <ForgeClassic game={game} />
}

function Altar({ game }: { game: Game }) {
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [card, setCard] = useState<{ mega: string; from: string } | null>(null)
  const onBusy = useCallback((b: boolean) => setBusy(b), [])

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

  const fee = game.v22 ? FORGE_COINS : 0
  const trained = (s: Slot): boolean => !game.v22 || (Boolean(s.m.graduated) && (s.m.together ?? 0) + (s.m.fed ?? 0) >= HEART_CAP)
  const state = (s: Slot): State => (s.m.megas?.includes(s.mega) ? 'done' : !game.keyStone ? 'locked' : !trained(s) ? 'training' : !recipeReachable(game.inv, recipeOf(s.mega)) ? 'shards' : game.wallet.coins < fee ? 'coins' : 'ready')
  const order: Record<State, number> = { ready: 0, shards: 1, coins: 2, training: 3, locked: 4, done: 5 }
  const sorted = [...slots].sort((a, b) => order[state(a)] - order[state(b)])
  const keyOf = (s: Slot) => `${s.m.uid}:${s.mega}`
  const sel = sorted.find((s) => keyOf(s) === pick) ?? sorted[0] ?? null
  const st = sel ? state(sel) : null
  const forgeable = slots.filter((s) => state(s) === 'ready').length
  const forged = slots.filter((s) => state(s) === 'done').length

  // with no Mega yet: the nearest of yours that will have one, further along its line
  const later = useMemo(() => {
    const ahead = (form: string, depth = 0): string | null => {
      if (depth > 3) return null
      for (const f of SPECIES[form]?.e ?? []) if (SPECIES[f]?.m?.length) return f
      for (const f of SPECIES[form]?.e ?? []) { const g = ahead(f, depth + 1); if (g) return g }
      return null
    }
    for (const m of [game.partner, ...game.queue, ...game.graduates]) { const into = ahead(m.form); if (into) return { m, into } }
    return null
  }, [game])

  const idleNote = !game.keyStone && !sel ? 'The altar is cold until the Key Stone is yours: any one kind of work, seven days running.'
    : !sel ? (later ? `None of yours has a Mega form yet. ${nameOf(later.m.form)} will, once it evolves into ${nameOf(later.into)}.` : 'None of your Pokemon has a Mega form yet. Catch or raise one that does and it appears here.')
      : st === 'done' ? `Forged: ${megaStoneName(sel.mega)}. ${nameOf(sel.m.form)} keeps it for good, and is a Mega on the days your streak puts it on the Momentum row.`
        : 'Choose a Mega to forge.'
  const gate = sel && st === 'training' ? `A Mega Stone needs a fully trained Best Friend (${HEART_CAP} hearts).` : null

  const onForge = useCallback((f: ForgeEvent): boolean => {
    told.add(`mega:${f.form}`) // the news window would tell it again: this is the telling
    return useItem(f.kinds.join(','), f.uid, 'forge', f.form)
  }, [])

  return (
    <Win title="The Forge" tone="purple" aside={game.keyStone ? (forgeable ? `${forgeable} ready to forge` : `${forged} forged`) : 'Key Stone needed'}>
      <div className="forge2">
        {sorted.length > 0 && (
          <div className="forge-pick" role="radiogroup" aria-label="Which Mega to forge" data-noswipe>
            {sorted.map((s) => {
              const k = keyOf(s), on = sel && keyOf(sel) === k, ss = state(s)
              return (
                <button key={k} type="button" role="radio" aria-checked={Boolean(on)} disabled={busy} className={`fp ${ss === 'ready' ? 'ready' : ss === 'done' ? 'done' : ss === 'locked' ? 'locked' : 'waiting'} ${on ? 'on' : ''}`} onClick={() => { setPick(k); play('tap') }} title={`${nameOf(s.mega)}: ${SMALL[ss]}`}>
                  <span className="fp-face"><img src={still(s.m.form, s.m.shiny)} alt="" width={52} height={52} className="sprite" />{ss === 'done' && <i className="fp-star" aria-hidden>★</i>}<span className="fp-stone"><MegaStone mega={s.mega} size={24} /></span></span>
                  <b>{shortName(s.mega)}</b>
                  <small>{SMALL[ss]}</small>
                </button>
              )
            })}
          </div>
        )}

        <Stage
          pick={sel && st !== 'done' ? { uid: sel.m.uid, form: sel.m.form, mega: sel.mega, shiny: Boolean(sel.m.shiny) } : null}
          recipe={sel ? recipeOf(sel.mega) : []}
          held={game.inv}
          keyStone={Boolean(game.keyStone)}
          coins={game.wallet.coins}
          fee={fee}
          gate={gate}
          idleNote={idleNote}
          onForge={onForge}
          onCollect={(mega, from) => setCard({ mega, from })}
          onBusy={onBusy}
        />

        {st !== 'ready' && st !== 'done' && <NextShards game={game} />}
        <KeyStoneSource game={game} />
        {sorted.some((s) => s.count > 1) && <p className="forge-where">A Pokemon with two Megas: the X or Y is yours to choose above, and each has its own recipe.</p>}
      </div>

      {card && (
        <div className="capsule" role="dialog" aria-modal="true" aria-label="Mega Stone taken" onClick={() => setCard(null)}>
          <Hold />
          <div className="capsule-stage" style={{ width: 'min(360px, 92vw)', height: 'auto' }}>
            <img src={spritePath(card.mega)} alt={nameOf(card.mega)} width={192} height={192} className="sprite" style={{ imageRendering: 'pixelated', display: 'block', margin: '0 auto' }} />
          </div>
          <MegaStone mega={card.mega} size={72} />
          <p className="capsule-line">{megaStoneName(card.mega)} lies in your Bag. {nameOf(card.from)} keeps it for good: on the days your streak puts this stone on the Momentum row, {nameOf(card.from)} is {nameOf(card.mega)}.</p>
          <button type="button" className="k-btn main capsule-go" autoFocus>Nice</button>
        </div>
      )}
    </Win>
  )
}

/** The card is something the player started: nothing automatic opens over it. */
function Hold() { useHold(); return null }
