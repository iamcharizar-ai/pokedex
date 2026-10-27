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
import { COMET_SHARD, FEATS, FORGE_COST, GEAR_ITEMS, SHARDS, forgeFair, forgeShard, itemName } from '../../core/economy.ts'
import { KIT_SHARD_EVERY } from '../../core/rules.ts'
import { KBar } from '../Kit.tsx'
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

  /** Version 13: the shards that would go in now, best first: one of each colour held, then Comets. Fewer than three is how far you are. */
  const toward = useMemo(() => {
    const out: string[] = [...SHARDS].filter((k) => (game.inv[k] ?? 0) > 0).sort((a, b) => (game.inv[b] ?? 0) - (game.inv[a] ?? 0)).slice(0, FORGE_COST)
    for (let c = game.inv[COMET_SHARD] ?? 0; out.length < FORGE_COST && c > 0; c--) out.push(COMET_SHARD)
    return out
  }, [game.inv])
  const waitingFair = fair && game.keyStone && sel && st === 'waiting'
  const say = !game.keyStone ? 'The altar is cold until the Key Stone is yours: any one kind of work, seven days running.'
    : !sel ? (later ? `None of yours has a Mega form yet. ${nameOf(later.m.form)} will, once it evolves into ${nameOf(later.into)}.` : 'None of your Pokemon has a Mega form yet. Catch or raise one that does and it appears here.')
      : lit ? 'The stone wakes...'
      : st === 'done' ? `Forged: ${megaStoneName(sel.mega)}. ${nameOf(sel.m.form)} keeps it for good.`
        : st === 'ready' ? (placed.length === 0 ? (fair ? 'Tap three shards of three different colours into the stone.' : `Tap three ${itemName(shard!)}s into the stone.`) : `${FORGE_COST - placed.length} more.`)
          : fair ? `${shortName(sel.mega)}: ${toward.length} of ${FORGE_COST} sockets filled by what you hold. ${FORGE_COST - toward.length} more ${FORGE_COST - toward.length === 1 ? 'shard' : 'shards'} of a colour you don't have, or a Comet.` : `${shortName(sel.mega)} needs ${wantText(sel)}, or three Comet Shards.`

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
            const have = waitingFair && i < toward.length
            const ghost = fair ? (i < placed.length ? kindOf(placed[i]) : have ? toward[i] : SHARDS[i]) : shard ?? (sel ? wants(sel)[0] : 'red-shard')
            return (
              <span key={a} ref={(el) => { sockets.current[i] = el }} className={`socket3 ${full ? 'full' : ''} ${have ? 'have' : ''}`} style={{ ['--a' as string]: `${a}deg` } as CSSProperties}>
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
        {st !== 'ready' && st !== 'done' && <NextShards game={game} />}
        {fair && sorted.some((s) => s.count > 1) && <p className="forge-where">A Pokemon with two Megas: the X or Y is yours to choose above.</p>}
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

/**
 * Where the next shards come from, nearest first, each with how far it is:
 * the feats that pay one, Strong's training kit (every KIT_SHARD_EVERY-th full
 * set), a month reviewed (a Comet) and a boss beaten.
 */
function NextShards({ game }: { game: Game }) {
  const earned = new Set(game.feats.map((f) => f.id))
  const feats = FEATS.filter((f) => !earned.has(f.id) && Object.keys(f.reward.items ?? {}).some((id) => KINDS.includes(id)))
    .map((f) => ({ f, have: Math.min(f.n, game.counters[f.key] ?? 0) }))
    .sort((a, b) => b.have / b.f.n - a.have / a.f.n)
    .slice(0, 2)
  const sets = game.counters.sets ?? 0
  const setsToShard = KIT_SHARD_EVERY - (sets % KIT_SHARD_EVERY)
  const pieces = GEAR_ITEMS.filter((g) => (game.inv[g] ?? 0) > 0).length
  const rows: { icon: string; name: string; note: string; bar?: [number, number] }[] = [
    ...feats.map(({ f, have }) => ({ icon: Object.keys(f.reward.items ?? {}).find((id) => KINDS.includes(id))!, name: f.name, note: f.text, bar: [have, f.n] as [number, number] })),
    { icon: 'red-shard', name: "Strong's training kit", note: `${pieces} of ${GEAR_ITEMS.length} pieces toward a set · ${setsToShard === 1 ? 'the next set pays a Red Shard' : `a Red Shard in ${setsToShard} sets`}`, bar: [pieces, GEAR_ITEMS.length] },
    { icon: COMET_SHARD, name: 'A month reviewed', note: 'The month review in Life OS pays a Comet Shard' },
    { icon: 'blue-shard', name: 'A weekly boss beaten', note: 'Pays a shard in the colour of its hardest task' },
  ]
  return (
    <div className="nextshards">
      <span className="k-label">Where the next shards come from</span>
      {rows.map((r) => (
        <div key={r.name} className="nextshard">
          <ItemIcon id={r.icon} size={28} />
          <span><b>{r.name}</b><small>{r.note}</small>{r.bar && <KBar value={r.bar[0]} max={r.bar[1]} label={`${r.bar[0]} / ${r.bar[1]}`} />}</span>
        </div>
      ))}
    </div>
  )
}
