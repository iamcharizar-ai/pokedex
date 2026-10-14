// The Forge (Party tab): where Mega Stones are made, as a small ritual.
//
// An altar: the stone in the middle, three empty sockets round it, and every
// shard you hold floating on the outer ring. Below it, each Pokemon that has a
// Mega form. Pick one that is ready and the shards that fit it light up; tap
// them one at a time and each flies into the next socket and slams home. The
// third lights the altar, and the evolution popup (EvoReveal) shows the Pokemon
// becoming its Mega.
//
// What is forged is still one `forge` event in the ledger, written when the
// third shard lands. Nothing is spent by placing one or two and walking away:
// they go back to the ring.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useHold } from './overlay.ts'
import { COMET_SHARD, FORGE_COST, SHARDS, forgeFair, forgeShard, itemName } from '../../core/economy.ts'
import { nameOf, spritePath, type Game, type Mon } from '../../core/fold.ts'
import { SPECIES } from '../../core/species.ts'
import { Win } from '../App.tsx'
import { KeyStone, MegaStone, megaStoneName } from '../Ball.tsx'
import { ItemIcon } from '../Item.tsx'
import { EvoReveal } from '../Reveal.tsx'
import { still } from '../lib/art.ts'
import { motion, motionConfig } from '../lib/fx.ts'
import { play } from '../lib/sfx.ts'
import { useItem } from '../lib/store.ts'
import { told } from '../lib/told.ts'

interface Slot { m: Mon; mega: string; index: number; count: number }
type State = 'done' | 'ready' | 'waiting' | 'locked'

/** How many of one kind of shard float on the ring, at most: more than that is a number on the last one. */
const RING_MAX = 6
/** The sockets' places round the stone, in degrees from the top. */
const SOCKETS = [0, 120, 240]
const KINDS = [...SHARDS, COMET_SHARD]

/** The reveal is something the player started: nothing automatic opens over it. */
function Hold() { useHold(); return null }

/** "Charizard-Mega-X" is "Charizard X" under its picture; the Mega is said by the mark beside it. */
const shortName = (mega: string): string => nameOf(mega).replace(/[-\s]?Mega[-\s]?/i, ' ').replace(/\s+/g, ' ').trim()
/** Which shards a Mega takes: an X takes red, a Y blue or yellow, a lone Mega any colour. A Comet fits all. */
const wants = (s: Slot): string[] => (s.count > 1 ? (s.index === 0 ? ['red-shard'] : ['blue-shard', 'yellow-shard']) : [...SHARDS])
const wantText = (s: Slot): string => (s.count > 1 ? (s.index === 0 ? 'three red shards' : 'three blue or three yellow shards') : 'three shards of one colour')

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
/** A shard on the ring is keyed "kind:index". */
const kindOf = (key: string): string => key.split(':')[0]
const centre = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }

export function Forge({ game }: { game: Game }) {
  const [reveal, setReveal] = useState<{ from: string; to: string } | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [placed, setPlaced] = useState<string[]>([])
  const [lit, setLit] = useState(false)
  const busy = useRef(false)
  const altar = useRef<HTMLDivElement>(null)
  const sockets = useRef<(HTMLSpanElement | null)[]>([])

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

  // version 13: any three shards of three different colours forge a stone, and the X or Y is chosen below
  const fair = game.v13
  const shardOf = (s: Slot): string | null => (fair ? (forgeFair(game.inv) ? 'any' : null) : forgeShard(s.count, s.index, s.m.nature?.up, game.inv))
  const state = (s: Slot): State => (s.m.megas?.includes(s.mega) ? 'done' : !game.keyStone ? 'locked' : shardOf(s) ? 'ready' : 'waiting')
  const order: Record<State, number> = { ready: 0, waiting: 1, locked: 2, done: 3 }
  const sorted = [...slots].sort((a, b) => order[state(a)] - order[state(b)])
  const keyOf = (s: Slot) => `${s.m.uid}:${s.mega}`
  const sel = sorted.find((s) => keyOf(s) === pick) ?? sorted[0] ?? null
  const st = sel ? state(sel) : null
  const shard = sel && st === 'ready' ? shardOf(sel) : null
  const forgeable = slots.filter((s) => state(s) === 'ready').length

  /** Shards that flew keep their flight (it fills forwards): a shard back on the ring sheds it. */
  const settle = () => altar.current?.querySelectorAll('.orb').forEach((el) => el.getAnimations().forEach((a) => a.cancel()))
  // a new choice starts the ritual again: whatever was placed goes back to the ring
  useEffect(() => { setPlaced([]); setLit(false); settle() }, [pick])

  // the shards on the ring, kind by kind, so each colour sits together
  const ring = useMemo(() => {
    const out: { key: string; kind: string; extra: number }[] = []
    for (const kind of KINDS) {
      const n = game.inv[kind] ?? 0
      for (let i = 0; i < Math.min(n, RING_MAX); i++) out.push({ key: `${kind}:${i}`, kind, extra: i === RING_MAX - 1 ? n - RING_MAX : 0 })
    }
    return out
  }, [game.inv])

  const ignite = async (s: Slot, kinds: string[]) => {
    setLit(true)
    play('catch')
    if (!motionConfig.reduced) {
      const host = altar.current
      if (host) void motion.ringShock(host, { color: '#d9b8ff', size: 60, dur: 700, to: 5 })
      await wait(900)
    }
    told.add(`mega:${s.mega}`) // the news window would tell it again: this is the telling
    useItem(fair ? kinds.join(',') : '', s.m.uid, 'forge', s.mega)
    setPick(`${s.m.uid}:${s.mega}`)
    setPlaced([])
    settle()
    setReveal({ from: s.m.form, to: s.mega })
    setLit(false)
  }

  /** One shard leaves the ring, rises, and drops into the next empty socket. */
  const place = async (key: string, from: HTMLElement | null) => {
    if (!sel || !shard || busy.current) return
    const n = placed.length
    const target = sockets.current[n]
    if (n >= FORGE_COST || !target) return
    busy.current = true
    play('tap')
    if (from && !motionConfig.reduced) {
      const a = centre(from), b = centre(target)
      const dx = b.x - a.x, dy = b.y - a.y
      await from.animate([
        { translate: '0 0', scale: '1' },
        { translate: `${dx * 0.15}px ${dy * 0.15 - 30}px`, scale: '1.45', offset: 0.35 },
        { translate: `${dx}px ${dy}px`, scale: '0.85' },
      ], { duration: 520, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)', fill: 'forwards' }).finished
    }
    const next = [...placed, key]
    setPlaced(next)
    play('thud', n * 3)
    const img = target.querySelector('img')
    if (img && !motionConfig.reduced) void motion.slam(img, { from: 2.2, color: '#c890ff' })
    busy.current = false
    if (n + 1 === FORGE_COST) void ignite(sel, next.map(kindOf))
  }
  const placeAll = async () => {
    // the fair forge places the three colours held most of (a Comet where one is missing)
    const want = fair ? (forgeFair(game.inv) ?? []) : []
    const pickFair = (): typeof ring => {
      const out: typeof ring = []
      const left = [...want]
      for (const k of placed.map(kindOf)) { const i = left.indexOf(k); if (i >= 0) left.splice(i, 1) }
      for (const k of left) { const r = ring.find((x) => x.kind === k && !placed.includes(x.key) && !out.includes(x)); if (r) out.push(r) }
      return out
    }
    const free = fair ? pickFair() : ring.filter((r) => r.kind === shard && !placed.includes(r.key))
    for (const r of free.slice(0, FORGE_COST - placed.length)) {
      await place(r.key, altar.current?.querySelector<HTMLElement>(`[data-key="${r.key}"]`) ?? null)
      if (!motionConfig.reduced) await wait(120)
    }
  }

  const say = !game.keyStone ? 'The altar is cold until the Key Stone is yours: any one kind of work, seven days running.'
    : !sel ? 'None of your Pokemon has a Mega form yet. Train one that does and it appears here.'
      : lit ? 'The stone wakes...'
      : st === 'done' ? `Forged: ${megaStoneName(sel.mega)}. ${nameOf(sel.m.form)} keeps it for good.`
        : st === 'ready' ? (placed.length === 0 ? (fair ? 'Tap three shards of three different colours into the stone.' : `Tap three ${itemName(shard!)}s into the stone.`) : `${FORGE_COST - placed.length} more.`)
          : fair ? `${shortName(sel.mega)} needs three shards of three different colours. A Comet Shard fills any socket.` : `${shortName(sel.mega)} needs ${wantText(sel)}, or three Comet Shards.`
  const total = KINDS.reduce((n, k) => n + (game.inv[k] ?? 0), 0)

  return (
    <Win title="The Forge" tone="purple" aside={game.keyStone ? (forgeable ? `${forgeable} ready to forge` : `${slots.filter((s) => state(s) === 'done').length} forged`) : 'Key Stone needed'}>
      <div className={`forge2 ${game.keyStone ? '' : 'cold'} ${st ?? 'none'} ${lit ? 'lit' : ''}`}>
        <div className="altar" ref={altar} role="group" aria-label="The altar: the stone, three sockets, and your shards round them">
          <span className="altar-runes" aria-hidden />
          <span className="altar-beams" aria-hidden>{SOCKETS.map((a) => <i key={a} style={{ ['--a' as string]: `${a}deg` } as CSSProperties} />)}</span>
          <span className="altar-core" aria-hidden>
            {sel ? <img src={st === 'done' ? spritePath(sel.mega, sel.m.shiny) : still(sel.mega, sel.m.shiny)} alt="" width={96} height={96} className={`sprite ${st === 'done' || lit ? '' : 'unseen'}`} /> : <KeyStone size={64} held={Boolean(game.keyStone)} />}
          </span>
          {SOCKETS.map((a, i) => {
            const full = st === 'done' || i < placed.length
            const ghost = fair ? (i < placed.length ? kindOf(placed[i]) : SHARDS[i]) : shard ?? (sel ? wants(sel)[0] : 'red-shard')
            return (
              <span key={a} ref={(el) => { sockets.current[i] = el }} className={`socket3 ${full ? 'full' : ''}`} style={{ ['--a' as string]: `${a}deg` } as CSSProperties}>
                {st === 'done' ? <i className="socket3-glow" /> : <ItemIcon id={fair ? ghost : i < placed.length && shard ? shard : ghost} size={30} />}
              </span>
            )
          })}
          {ring.map((r, i) => {
            const a = (360 / Math.max(ring.length, 8)) * i - 90 + (ring.length < 8 ? (360 / 8) * (8 - ring.length) / 2 : 0)
            // the fair forge: any colour not placed yet (a Comet always fits)
            const fits = fair ? Boolean(shard) && !placed.includes(r.key) && placed.length < FORGE_COST && (r.kind === COMET_SHARD || !placed.map(kindOf).includes(r.kind))
              : Boolean(shard) && r.kind === shard && !placed.includes(r.key) && placed.length < FORGE_COST
            const gone = placed.includes(r.key)
            return (
              <button
                key={r.key}
                type="button"
                data-key={r.key}
                className={`orb ${fits ? 'fits' : ''} ${gone ? 'gone' : ''}`}
                style={{ ['--a' as string]: `${a}deg`, ['--i' as string]: i } as CSSProperties}
                disabled={!fits}
                aria-label={fits ? `Place a ${itemName(r.kind)} in the stone` : `${itemName(r.kind)}: ${game.inv[r.kind]} held`}
                title={`${itemName(r.kind)}: ${game.inv[r.kind]}`}
                onClick={(e) => void place(r.key, e.currentTarget)}
              >
                <ItemIcon id={r.kind} size={34} />
                {r.extra > 0 && <i className="orb-more">+{r.extra}</i>}
              </button>
            )
          })}
        </div>

        <p className="forge-say" aria-live="polite">{say}</p>
        {st === 'ready' && placed.length < FORGE_COST && !lit && <button type="button" className="forge-all" onClick={() => void placeAll()}>Place them all</button>}

        {sorted.length > 0 && (
          <div className="forge-pick" role="radiogroup" aria-label="Which Mega to forge" data-noswipe>
            {sorted.map((s) => {
              const k = keyOf(s), on = sel && keyOf(sel) === k, ss = state(s)
              return (
                <button key={k} type="button" role="radio" aria-checked={Boolean(on)} className={`fp ${ss} ${on ? 'on' : ''}`} onClick={() => { setPick(k); play('tap') }} title={`${nameOf(s.mega)}: ${ss === 'done' ? 'forged' : ss === 'ready' ? 'ready to forge' : ss === 'locked' ? 'needs the Key Stone' : `needs ${fair ? 'three shards of different colours' : wantText(s)}`}`}>
                  <span className="fp-face"><img src={still(s.m.form, s.m.shiny)} alt="" width={52} height={52} className="sprite" />{ss === 'done' && <i className="fp-star" aria-hidden>★</i>}<span className="fp-stone"><MegaStone mega={s.mega} size={20} /></span></span>
                  <b>{shortName(s.mega)}</b>
                  <small>{ss === 'done' ? 'Forged' : ss === 'ready' ? 'Ready' : ss === 'locked' ? 'Locked' : 'Needs shards'}</small>
                </button>
              )
            })}
          </div>
        )}
        <p className="forge-where">
          {total === 0 ? 'No shards yet. ' : `${total} ${total === 1 ? 'shard' : 'shards'} held. `}
          Shards come from feats, every third set of Strong gear, a month reviewed and a boss. {fair ? 'Any three of three different colours forge a Mega Stone, and for a Pokemon with two Megas the X or Y is yours to choose above; a Comet fills any socket.' : 'Red forges an X, blue or yellow a Y; a Comet fits any.'}
        </p>
      </div>

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

