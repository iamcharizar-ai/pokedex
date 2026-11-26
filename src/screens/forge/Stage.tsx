// The Forge's altar, as a screen (FORGE-EXPERIENCE.md sections 3 to 5): the recipe tray, the altar with its three sockets, the shards and the Key Stone floating round it,
// and the sequence that follows the commit. It owns the ritual's state (machine.ts) and the elements; the director (director.ts) owns time; the game only
// hears of the forge itself, once, when the Key Stone goes in (`onForge`). Nothing is spent before that: shards placed or lifted are free.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useHold } from '../overlay.ts'
import { COMET_SHARD, SHARDS, itemName } from '../../../core/economy.ts'
import { SPECIES } from '../../../core/species.ts'
import { KeyStone, MegaStone, megaStoneName } from '../../Ball.tsx'
import { ItemIcon } from '../../Item.tsx'
import { still } from '../../lib/art.ts'
import { motionConfig } from '../../lib/fx.ts'
import { typeColor } from '../types.ts'
import { AltarGlow, loadAltarMaps, type AltarMeta } from './glow.ts'
import { Particles } from './fx.ts'
import { Director, type Els, type Geom } from './director.ts'
import { SOCKETS, firstEmpty, freeOf, guidance, idle, placed, recipeText, reduce, trayView, whyNotPlace, type Action, type Forge, type ForgeState, type Refusal, type Result } from './machine.ts'
import { shardHex } from './look.ts'
import { ALTAR, Swarm, altarShare } from './swarm.ts'
import { forgeSound } from './sound.ts'

export interface Chosen { uid: string; form: string; mega: string; shiny: boolean }
export interface StageProps {
  pick: Chosen | null
  /** the three shards the stone needs */
  recipe: string[]
  /** how many of each shard the player holds */
  held: Readonly<Record<string, number>>
  keyStone: boolean
  coins: number
  /** the Forge's fee in coins (0 when it asks none) */
  fee: number
  /** why this Mega cannot be forged yet, for a reason other than the shards, the Key Stone and the coins (null: nothing) */
  gate: string | null
  /** what to say when there is nothing to place (nothing chosen, or this one is already forged) */
  idleNote: string
  /** writes the forge to the game; false if the game refused it */
  onForge: (f: Forge) => boolean
  /** the stone has been taken */
  onCollect: (mega: string, from: string) => void
  /** the sequence or the reveal holds the screen: the picker waits */
  onBusy: (busy: boolean) => void
}

const DEFAULT_META: Pick<AltarMeta, 'wells' | 'centre'> = {
  wells: [{ x: 0.49995, y: 0.17384, r: 0.05463 }, { x: 0.73608, y: 0.58979, r: 0.05781 }, { x: 0.26589, y: 0.58991, r: 0.05781 }],
  centre: { x: 0.50111, y: 0.46876, r: 0.08413 },
}
const SHELF = [...SHARDS, COMET_SHARD]
/** The owner wants the whole sequence every time, whatever the device's motion setting says (it has one flash and one short shake, never a strobe). Set true to give the gentle 2.5 s version to anyone who asks their device for less motion. */
const RESPECT_REDUCED_MOTION = false
const reduced = (): boolean => RESPECT_REDUCED_MOTION && Boolean(motionConfig.reduced)
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

interface Drag { kind: string; key: string; x: number; y: number; near: number }
interface Grab { kind: string; key: string; sx: number; sy: number; el: HTMLElement; moved: boolean; ox: number; oy: number }
const KEY = 'key-stone'

export function Stage(props: StageProps) {
  const { pick, recipe, held, keyStone, coins, fee, gate, idleNote, onForge, onCollect, onBusy } = props
  const [st, setSt] = useState<ForgeState>(idle)
  const stRef = useRef(st)
  const act = (a: Action): Result => { const r = reduce(stRef.current, a); if (r.ok) { stRef.current = r.state; setSt(r.state) } return r }
  const [S, setS] = useState(340)
  const SRef = useRef(S)
  const [meta, setMeta] = useState<Pick<AltarMeta, 'wells' | 'centre'>>(DEFAULT_META)
  const metaRef = useRef(meta)
  /** the altar's share of the arena's width: bigger on a phone (swarm.ts altarShare) */
  const [share, setShare] = useState(ALTAR)
  const shareRef = useRef(share)
  const [flies, setFlies] = useState([{ dx: 0, dy: 0, n: 0 }, { dx: 0, dy: 0, n: 0 }, { dx: 0, dy: 0, n: 0 }])
  const [note, setNote] = useState('')
  /** a refusal, said on the visible line for a few seconds */
  const [warn, setWarn] = useState('')
  const [drag, setDrag] = useState<Drag | null>(null)
  const [bad, setBad] = useState<string | null>(null)
  const [locked, setLocked] = useState<Chosen | null>(null)
  const [glowOk, setGlowOk] = useState(true)

  const stageRef = useRef<HTMLDivElement>(null)
  const glowCanvas = useRef<HTMLCanvasElement>(null)
  const fxCanvas = useRef<HTMLCanvasElement>(null)
  const shardEls = useRef<(HTMLElement | null)[]>([null, null, null])
  const keyEl = useRef<HTMLElement | null>(null)
  const ballEl = useRef<HTMLDivElement>(null)
  const megaEl = useRef<HTMLDivElement>(null)
  const washEl = useRef<HTMLDivElement>(null)
  const darkEl = useRef<HTMLDivElement>(null)
  const flashEl = useRef<HTMLDivElement | null>(null)
  const orbEls = useRef<Record<string, HTMLElement | null>>({})
  const arenaRef = useRef<HTMLDivElement>(null)
  // every shard you hold (and the Key Stone) is one object floating round the altar, pushing the others away (swarm.ts)
  const sw = useRef<Swarm | null>(null)
  sw.current ??= new Swarm()
  const socketKey = useRef<(string | null)[]>([null, null, null])
  const keyKey = useRef<string | null>(null)
  const orbSize = useRef(30)
  const [orbs, setOrbs] = useState<{ key: string; kind: string }[]>([])
  const wellEls = useRef<(HTMLElement | null)[]>([null, null, null, null])
  const dir = useRef<Director | null>(null)
  const glowRef = useRef<AltarGlow | null>(null)
  const grab = useRef<Grab | null>(null)
  const swallow = useRef(false)
  const timers = useRef<number[]>([])

  const fsRef = useRef(2)
  const geom = (): Geom => {
    const s = SRef.current, m = metaRef.current
    return { S: s, wells: m.wells.map((w) => ({ x: w.x * s, y: w.y * s })), centre: { x: m.centre.x * s, y: m.centre.y * s }, fs: fsRef.current }
  }

  // ── the altar's size, and the glow ──
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const size = (): void => {
      const w = Math.round(el.clientWidth)
      if (w > 0) { SRef.current = w; setS(w) }
      const fx = fxCanvas.current
      if (fx) { const px = Math.max(64, Math.min(1024, Math.round(w * Math.min(window.devicePixelRatio || 1, 2)))); if (fx.width !== px) { fx.width = px; fx.height = px } }
      glowRef.current?.resize()
    }
    // the arena's width decides the altar's share of it; the altar box then resizes, and that is measured above
    const fit = (): void => {
      const W = arenaRef.current?.clientWidth ?? 0
      if (W <= 0) return
      const s = altarShare(W)
      sw.current!.altar = s
      if (s !== shareRef.current) { shareRef.current = s; setShare(s) }
    }
    fit(); size()
    const ro = new ResizeObserver(size)
    ro.observe(el)
    const ra = new ResizeObserver(fit)
    if (arenaRef.current) ra.observe(arenaRef.current)
    return () => { ro.disconnect(); ra.disconnect() }
  }, [])

  useEffect(() => {
    const fxc = fxCanvas.current!
    const d = new Director({
      glow: null,
      fx: new Particles(fxc),
      fxCanvas: fxc,
      geom,
      els: (): Els => ({ shards: shardEls.current, key: keyEl.current, ball: ballEl.current, mega: megaEl.current, flash: flashEl.current, wash: washEl.current, dark: darkEl.current, shake: document.getElementById('root') }),
      reduced,
      // the fallback when there is no WebGL: each well is a plain glowing disc
      onWell: (i, level, hex) => { const w = wellEls.current[i]; if (w) { w.style.opacity = String(Math.min(1, level)); w.style.background = hex } },
      // the sequence ended: the stone is there to take. Flushed so the stylesheet has the new phase before the director clears its inline styles.
      onDone: () => { flushSync(() => { act({ t: 'revealed' }) }) },
    })
    dir.current = d
    let gone = false
    loadAltarMaps().then(({ meta: m, images }) => {
      if (gone) return
      metaRef.current = m; setMeta(m)
      try { const g = new AltarGlow(glowCanvas.current!, m, images); glowRef.current = g; d.setGlow(g) } catch { setGlowOk(false) }
    }).catch(() => setGlowOk(false))
    return () => { gone = true; d.destroy(); glowRef.current?.destroy(); glowRef.current = null; dir.current = null; timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Put an object where the swarm says it is (or hide it while it sits in a socket). */
  const applyOrb = (key: string): void => {
    const o = sw.current!.get(key), b = orbEls.current[key], W = arenaRef.current?.clientWidth ?? 0
    if (!o || !b) return
    b.style.display = o.on ? '' : 'none'
    b.style.transform = `translate(${o.x * W}px, ${o.y * W}px)`
  }
  useEffect(() => {
    let raf = 0, last = 0
    const frame = (now: number): void => {
      const dt = last ? (now - last) / 1000 : 0.016
      last = now
      const W = arenaRef.current?.clientWidth ?? 0
      if (W > 0) { sw.current!.step(dt, W, orbSize.current, now / 1000); for (const o of sw.current!.orbs) applyOrb(o.key) }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // the swarm matches what is held: spent shards leave, new ones arrive
  useEffect(() => {
    if (sw.current!.sync({ ...held, [KEY]: keyStone ? 1 : 0 }, [...SHELF, KEY])) setOrbs(sw.current!.orbs.map((o) => ({ key: o.key, kind: o.kind })))
  }, [held, keyStone])
  const wellFrac = (i: number): { x: number; y: number } => { const a = shareRef.current; return { x: (1 - a) / 2 + a * metaRef.current.wells[i].x, y: (1 - a) / 2 + a * metaRef.current.wells[i].y } }
  const centreFrac = (): { x: number; y: number } => { const a = shareRef.current; return { x: (1 - a) / 2 + a * metaRef.current.centre.x, y: (1 - a) / 2 + a * metaRef.current.centre.y } }

  // ── a new choice starts the ritual again: whatever was placed goes back (nothing was spent) ──
  const pickKey = pick ? `${pick.uid}:${pick.mega}` : ''
  useEffect(() => {
    const p = stRef.current.phase
    if (p === 'committed' || p === 'reveal') return
    dir.current?.reset()
    // every shard floats free again, and the Key Stone, if it was resting in the centre, comes out of it
    sw.current!.releaseAll()
    if (keyKey.current) { sw.current!.release(keyKey.current, centreFrac()); keyKey.current = null }
    socketKey.current = [null, null, null]
    setFlies((f) => f.map((v) => ({ ...v, n: v.n + 1 })))
    setNote('')
    if (pick) act({ t: 'choose', pick: { uid: pick.uid, form: pick.mega }, recipe })
    else { stRef.current = idle(); setSt(stRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickKey])

  const busy = st.phase === 'committed' || st.phase === 'reveal'
  /** the Key Stone is in the altar: during the forge, and resting there after, until the player takes it back */
  const keyOut = busy || st.phase === 'rest'
  // once the Key Stone is in, the game moves on (this Mega becomes forged) but the show is still about this one
  const shown = busy ? locked : pick
  useEffect(() => { onBusy(busy) }, [busy, onBusy])

  const kinds = placed(st)
  const armed = st.phase === 'armed'
  const canCommit = armed && keyStone && coins >= fee && !gate
  const px = S
  const shardPx = 24 * Math.max(1, Math.floor((2 * meta.wells[0].r * px * 0.95) / 24))
  const fs = 1
  fsRef.current = fs
  const keyPx = 16 * Math.max(1, Math.floor((2 * meta.centre.r * px * 0.85) / 16))
  const megaPx = 24 * Math.max(2, Math.floor((px * 0.3) / 24))
  const sprPx = Math.round(px * 0.2)
  // a shard is drawn at one size, whole times the art, floating or in its socket; the Key Stone floats at the size it has in the centre
  const orbPx = shardPx
  const keyOrbPx = keyPx
  orbSize.current = orbPx + 8
  const firstOfKind = new Map<string, string>()
  for (const o of orbs) if (!firstOfKind.has(o.kind)) firstOfKind.set(o.kind, o.key)
  const base = shown ? (shown.mega.replace(/-mega[xy]?$/, '')) : ''
  const glowVars = { ['--mc' as string]: typeColor(SPECIES[base]?.t), ['--mc2' as string]: typeColor(SPECIES[base]?.t2 ?? SPECIES[base]?.t) } as CSSProperties

  const refusal = (why: Refusal): string => {
    switch (why) {
      case 'no-pick': return 'Choose a Mega first.'
      case 'wrong-step': return 'Not now.'
      case 'bad-socket': return 'That is not a socket.'
      case 'socket-taken': return 'That socket is taken. Tap its shard to take it back.'
      case 'full': return 'All three sockets are full. The Key Stone is next.'
      case 'not-in-recipe': return 'That colour is not in this recipe. A Comet fits any place.'
      case 'not-held': return 'You have none of those left.'
      case 'no-key-stone': return 'The altar needs the Key Stone.'
      case 'no-coins': return `The Forge asks ${fee.toLocaleString('en-IN')} coins; you have ${coins.toLocaleString('en-IN')}.`
    }
  }
  const later = (ms: number, fn: () => void): void => { timers.current.push(window.setTimeout(fn, ms)) }
  const nope = (why: Refusal, kind?: string): void => {
    forgeSound.nope(); setNote(refusal(why)); setWarn(refusal(why)); later(3200, () => setWarn(''))
    if (kind) { setBad(kind); later(450, () => setBad(null)) }
  }

  // ── placing ──
  /** `origin`: where on the screen the shard came from (a tapped shard, or where it was dropped), so it flies the rest of the way; `key`: which floating shard it is (else the one nearest the socket). */
  const place = (kind: string, socket: number | undefined, origin: { x: number; y: number } | null, key?: string): void => {
    const s = stRef.current
    const why = whyNotPlace(s, kind, held, socket)
    if (why) { nope(why, kind); return }
    const at = socket ?? firstEmpty(s)
    if (!act({ t: 'place', kind, socket: at, held }).ok) return
    const orb = (key ? sw.current!.get(key) : null) ?? sw.current!.nearest(kind, wellFrac(at))
    if (orb) {
      if (!origin) { const r = orbEls.current[orb.key]?.getBoundingClientRect(); if (r) origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
      sw.current!.use(orb.key); socketKey.current[at] = orb.key
    }
    const rect = stageRef.current!.getBoundingClientRect(), w = geom().wells[at]
    const dx = origin && !reduced() ? origin.x - (rect.left + w.x) : 0, dy = origin && !reduced() ? origin.y - (rect.top + w.y) : 0
    setFlies((f) => f.map((v, i) => (i === at ? { dx, dy, n: v.n + 1 } : v)))
    const n = placed(stRef.current).length
    setNote(`${itemName(kind)} placed. ${n} of ${SOCKETS}.`)
    later(reduced() ? 0 : 340, () => {
      if (stRef.current.sockets[at] !== kind) return
      dir.current?.snap(at, kind)
      forgeSound.snap(n); forgeSound.trickle()
      if (stRef.current.phase === 'armed') later(reduced() ? 0 : 500, () => { if (stRef.current.phase === 'armed') forgeSound.float() })
    })
  }
  const lift = (i: number): void => {
    const s = stRef.current
    if (s.sockets[i] === null || (s.phase !== 'chosen' && s.phase !== 'armed')) return
    const kind = s.sockets[i]!
    if (!act({ t: 'lift', socket: i }).ok) return
    // it comes out of its socket and floats again; the others make room
    const k = socketKey.current[i]
    if (k) sw.current!.release(k, wellFrac(i))
    socketKey.current[i] = null
    dir.current?.lift(i)
    forgeSound.lift()
    setNote(`${itemName(kind)} taken back. ${placed(stRef.current).length} of ${SOCKETS}.`)
  }

  // ── the commit: the Key Stone goes in, the game is written, the show begins ──
  const commit = (): void => {
    const s = stRef.current
    if (s.phase !== 'armed') {
      forgeSound.nope()
      const m = s.phase === 'chosen' ? 'Place all three shards first, then the Key Stone.' : guidance(s, { keyStone, coins, fee })
      setNote(m); setWarn(m); later(3200, () => setWarn(''))
      return
    }
    if (gate) { forgeSound.nope(); setNote(gate); return }
    const r = reduce(s, { t: 'commit', keyStone, coins, fee })
    if (!r.ok) { nope(r.why); return }
    if (!onForge(r.forge!)) { forgeSound.nope(); return }
    const kindsNow = [...r.state.sockets]
    // the Key Stone leaves the others and goes into the centre
    const keyOrb = sw.current!.floating(KEY)[0]
    if (keyOrb) { sw.current!.use(keyOrb.key); keyKey.current = keyOrb.key }
    stRef.current = r.state
    setNote('')
    flushSync(() => { setLocked(pick); setSt(r.state) })
    dir.current?.start(kindsNow, fee > 0)
  }

  // ── the reveal: tap the stone to take it; the Key Stone stays in the altar until the player takes it back themselves ──
  const taking = useRef(false)
  /** Fly an element to a point on the screen, in an arc, shrinking on the way. */
  const fly = (el: Element | null, to: { x: number; y: number }, dur: number, scale: number, up: number): void => {
    if (!el) return
    const a = el.getBoundingClientRect()
    const dx = to.x - (a.left + a.width / 2), dy = to.y - (a.top + a.height / 2)
    el.animate([{ translate: '0 0', scale: '1', opacity: 1 }, { translate: `${dx * 0.3}px ${dy * 0.3 - up}px`, scale: '1.15', opacity: 1, offset: 0.35 }, { translate: `${dx}px ${dy}px`, scale: String(scale), opacity: 0.1 }], { duration: dur, easing: 'cubic-bezier(0.5, 0, 0.8, 0.4)', fill: 'forwards' })
  }
  const take = async (): Promise<void> => {
    if (stRef.current.phase !== 'reveal' || taking.current || !shown) return
    taking.current = true
    forgeSound.take()
    const m = megaEl.current
    const bag = document.querySelector('.pmenu-btn:nth-child(3)') ?? document.querySelector('.pmenu-btn')
    // into the inventory: the Items tab of the Party menu, or the bottom of the screen where there is no menu
    const b = bag?.getBoundingClientRect()
    if (!reduced()) { fly(m, b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight }, 650, 0.25, 70); await wait(660) }
    m?.getAnimations().forEach((a) => a.cancel())
    bag?.animate([{ scale: '1' }, { scale: '1.3' }, { scale: '1' }], { duration: 420, easing: 'ease-out' })
    act({ t: 'collect' })
    dir.current?.reset()
    socketKey.current = [null, null, null]
    sw.current!.releaseAll(keyKey.current)
    setFlies((f) => f.map((v) => ({ ...v, n: v.n + 1 })))
    taking.current = false
    setLocked(null)
    onCollect(shown.mega, shown.form)
  }
  const retrieve = (): void => {
    if (stRef.current.phase !== 'rest' || taking.current) return
    forgeSound.take()
    act({ t: 'retrieve' })
    dir.current?.reset()
    // out of the centre it floats among the shards again
    if (keyKey.current) { sw.current!.release(keyKey.current, centreFrac()); keyKey.current = null }
  }

  // ── drag: a floating shard onto a socket (or the Key Stone onto the centre); a tap does the same to the first empty socket ──
  const nearest = (x: number, y: number, key: boolean): number => {
    const r = stageRef.current!.getBoundingClientRect(), g = geom()
    const px = x - r.left, py = y - r.top
    if (key) return Math.hypot(px - g.centre.x, py - g.centre.y) < g.S * 0.2 ? 3 : -1
    let best = -1, bd = g.S * 0.17
    g.wells.forEach((w, i) => { const d = Math.hypot(px - w.x, py - w.y); if (d < bd) { bd = d; best = i } })
    return best
  }
  const down = (kind: string, key: string) => (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    grab.current = { kind, key, sx: e.clientX, sy: e.clientY, el: e.currentTarget, moved: false, ox: 0, oy: 0 }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* no capture here */ }
  }
  const move = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    const g = grab.current
    if (!g) return
    const r = arenaRef.current!.getBoundingClientRect()
    if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 8) {
      g.moved = true
      // the shard itself is taken: it follows the pointer (from where it was grabbed) and the others push away from it
      const o = sw.current!.get(g.key)
      if (o) { g.ox = o.x - (g.sx - r.left) / r.width; g.oy = o.y - (g.sy - r.top) / r.height; sw.current!.grab(g.key) }
    }
    if (g.moved) sw.current!.move(g.key, (e.clientX - r.left) / r.width + g.ox, (e.clientY - r.top) / r.height + g.oy)
    if (g.moved) setDrag({ kind: g.kind, key: g.key, x: e.clientX, y: e.clientY, near: nearest(e.clientX, e.clientY, g.kind === 'key') })
  }
  const up = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    const g = grab.current
    grab.current = null
    if (!g?.moved) return
    swallow.current = true
    setDrag(null)
    sw.current!.drop(g.key)
    if (g.kind === 'key') { if (nearest(e.clientX, e.clientY, true) === 3) commit(); return }
    const at = nearest(e.clientX, e.clientY, false)
    if (at >= 0) place(g.kind, at, { x: e.clientX, y: e.clientY }, g.key)
  }
  const cancel = (): void => { if (grab.current?.moved) sw.current!.drop(grab.current.key); grab.current = null; setDrag(null) }
  const tapShard = (kind: string, key: string) => (e: { currentTarget: HTMLElement }): void => {
    if (swallow.current) { swallow.current = false; return }
    const r = e.currentTarget.getBoundingClientRect()
    place(kind, undefined, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, key)
  }
  const tapKey = (): void => { if (swallow.current) { swallow.current = false; return } commit() }

  // ── place all: one tap puts every shard the recipe still needs into the next sockets (the exact colours first, Comets for what is missing), one after another ──
  const plan = useMemo((): string[] => {
    if (st.phase !== 'chosen') return []
    const open = trayView(recipe, placed(st)).filter((p) => p.by === null).map((p) => p.kind)
    const left: Record<string, number> = {}
    for (const k of SHELF) left[k] = freeOf(st, held, k)
    const out: string[] = []
    for (const kind of open) if (left[kind] > 0) { left[kind]--; out.push(kind) }
    for (let miss = open.length - out.length; miss > 0 && left[COMET_SHARD] > 0; miss--) { left[COMET_SHARD]--; out.push(COMET_SHARD) }
    return out
  }, [st, held, recipe])
  const placeAll = (): void => {
    plan.forEach((kind, i) => later(reduced() ? 0 : i * 220, () => place(kind, undefined, null)))
  }

  // ── what to say ──
  const say = (!shown && st.phase !== 'rest') || st.phase === 'idle'
    ? idleNote
    : st.phase === 'armed' && gate ? gate
    : guidance(st, { keyStone, coins, fee })
  const tray = useMemo(() => trayView(recipe, kinds), [recipe, kinds.join()])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`forge3 ${st.phase} ${canCommit ? 'can' : ''} ${glowOk ? '' : 'noglow'}`} style={glowVars} data-noswipe>
      {shown && (
        <div className="tray" role="group" aria-label={`Recipe: ${recipeText(recipe)}`}>
          <div className="tray-gems">
            {tray.map((p, i) => (
              <span key={i} className={`tray-gem ${p.by ? 'in' : ''}`} style={{ ['--gc' as string]: shardHex(p.by ?? p.kind) } as CSSProperties}>
                <ItemIcon id={p.by ?? p.kind} size={24} />
                {p.by === COMET_SHARD && <i className="tray-gem-comet" aria-hidden>*</i>}
              </span>
            ))}
          </div>
          <p className="tray-text">{recipeText(recipe)}. A Comet fits any place.</p>
        </div>
      )}

      {shown && (gate || !keyStone) && <p className="forge-gate">{gate ?? 'The altar needs the Key Stone before it will forge.'}</p>}

      <div className="stage" ref={arenaRef} role="group" aria-label="The altar: three sockets round a centre, and your shards floating round it">
        <div className="altar-box" ref={stageRef} style={{ width: `${share * 100}%` }}>
          <img className="altar-img" src="/sprites/forge/altar.png" alt="" draggable={false} />
          {[0, 1, 2, 3].map((i) => {
            const w = i < 3 ? meta.wells[i] : meta.centre
            return <i key={i} className="well-fb" ref={(el) => { wellEls.current[i] = el }} style={{ left: `${w.x * 100}%`, top: `${w.y * 100}%`, width: w.r * 2 * px, height: w.r * 2 * px }} aria-hidden />
          })}
          <canvas className="glow" ref={glowCanvas} aria-hidden />
          <div className="dark" ref={darkEl} aria-hidden />
          <div className="core" style={{ left: `${meta.centre.x * 100}%`, top: `${meta.centre.y * 100}%`, ['--mp' as string]: `${megaPx}px` } as CSSProperties}>
            {shown && !keyOut && <img className="sil" src={still(shown.form, shown.shiny)} alt="" width={sprPx} height={sprPx} draggable={false} />}
            <div className="ball" ref={ballEl} aria-hidden />
            {keyOut && <span className="keyst" ref={(el) => { keyEl.current = el }}><KeyStone size={keyPx} /></span>}
            <div className="mega" ref={megaEl} aria-hidden={st.phase !== 'reveal'}>
              {shown && <MegaStone mega={shown.mega} size={megaPx} title="" />}
            </div>
          </div>
          {armed && <span className={`core-ring ${canCommit ? 'on' : ''}`} style={{ left: `${meta.centre.x * 100}%`, top: `${meta.centre.y * 100}%`, width: meta.centre.r * 2.5 * px, height: meta.centre.r * 2.5 * px }} aria-hidden />}
          {meta.wells.map((w, i) => {
            const kind = st.sockets[i]
            const near = drag && drag.near === i
            const hot = drag && drag.kind !== 'key' && st.sockets[i] === null && whyNotPlace(st, drag.kind, held, i) === null
            return (
              <button
                key={i}
                type="button"
                className={`sock ${kind ? 'full' : ''} ${near ? 'near' : ''} ${hot ? 'hot' : ''}`}
                style={{ left: `${w.x * 100}%`, top: `${w.y * 100}%`, width: Math.max(44, w.r * 2 * px), height: Math.max(44, w.r * 2 * px) }}
                onClick={() => { if (kind) lift(i); else place(guessKind(st, held, recipe) ?? '', i, null) }}
                aria-label={kind ? `Socket ${i + 1}: ${itemName(kind)}. ${busy ? '' : 'Tap to take it back.'}` : `Socket ${i + 1}: empty`}
                disabled={busy || st.phase === 'rest'}
              >
                {kind && (
                  <span key={`${i}:${flies[i].n}`} className="shard" ref={(el) => { shardEls.current[i] = el }} style={{ ['--dx' as string]: `${flies[i].dx}px`, ['--dy' as string]: `${flies[i].dy}px`, ['--lift' as string]: '0px', ['--fs' as string]: fs, ['--i' as string]: i } as CSSProperties}>
                    <ItemIcon id={kind} size={shardPx} />
                  </span>
                )}
              </button>
            )
          })}
          {st.phase === 'reveal' && shown && <button type="button" className="mega-take" style={{ left: `${meta.centre.x * 100}%`, top: `${meta.centre.y * 100}%`, width: megaPx + 24, height: megaPx + 24 }} onClick={() => void take()} aria-label={`Take the ${megaStoneName(shown.mega)}`} />}
          {st.phase === 'rest' && <button type="button" className="key-take" style={{ left: `${meta.centre.x * 100}%`, top: `${meta.centre.y * 100}%`, width: Math.max(44, keyPx + 24), height: Math.max(44, keyPx + 24) }} onClick={retrieve} aria-label="Take the Key Stone back" />}
          <canvas className="fxc" ref={fxCanvas} aria-hidden />
          <div className="wash" ref={washEl} aria-hidden />
        </div>
        {/* every shard you hold floats round the altar, outside it, pushing the others away: tap one, or drag it onto a socket; the Key Stone floats among them */}
        {orbs.map((o, i) => {
          const isKey = o.kind === KEY
          const live = isKey ? armed : st.phase === 'chosen'
          const need = isKey ? canCommit : live && whyNotPlace(st, o.kind, held) === null
          const size = (isKey ? keyOrbPx : orbPx) + 12
          return (
            <button
              key={o.key}
              type="button"
              ref={(el) => { orbEls.current[o.key] = el; if (el) applyOrb(o.key) }}
              className={`orb ${isKey ? 'key' : ''} ${need ? 'need' : ''} ${live ? '' : 'idle'} ${bad === o.kind ? 'bad' : ''} ${drag?.key === o.key ? 'dragging' : ''}`}
              style={{ width: size, height: size, margin: `${-size / 2}px 0 0 ${-size / 2}px`, ['--i' as string]: i, ['--oc' as string]: isKey ? '#ffffff' : shardHex(o.kind) } as CSSProperties}
              onPointerDown={down(isKey ? 'key' : o.kind, o.key)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
              onClick={isKey ? tapKey : tapShard(o.kind, o.key)}
              aria-label={isKey ? 'Key Stone' : itemName(o.kind)}
              aria-disabled={!live}
              tabIndex={firstOfKind.get(o.kind) === o.key ? 0 : -1}
            >
              <span className="orb-in">{isKey ? <KeyStone size={keyOrbPx} /> : <ItemIcon id={o.kind} size={orbPx} />}</span>
            </button>
          )
        })}
      </div>

      <p className="forge-say">{warn && (st.phase === 'chosen' || st.phase === 'armed') ? warn : say}</p>
      <span className="sr-only" role="status">{note}</span>

      {plan.length > 0 && <button type="button" className="forge-all" onClick={placeAll}>{plan.length === 3 ? 'Place all' : 'Place what I have'}</button>}

      {busy && <Hold />}
      {createPortal(<div className="forge-flash" ref={flashEl} aria-hidden />, document.body)}
    </div>
  )
}

/** The shard a tap on an empty socket places: the colour the recipe still needs most, else the first held kind that fits. */
function guessKind(s: ForgeState, held: Readonly<Record<string, number>>, recipe: readonly string[]): string | null {
  const have = SHELF.filter((k) => whyNotPlace(s, k, held) === null)
  if (!have.length) return null
  const need = trayView(recipe, placed(s)).find((p) => p.by === null)?.kind
  return have.find((k) => k === need) ?? have[0]
}

/** The reveal is something the player started: nothing automatic opens over it. */
function Hold() { useHold(); return null }
