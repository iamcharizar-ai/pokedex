// The staged reveals, choreographed with the motion kit (see MOTION-AUDIT.md).
//
//   EvoReveal    an evolution, as the study's 3.6 s "unlocked" popup: the old form
//                charges white, a bloom covers the swap, the new one slams in.
//   Capsule      a reward that waits to be opened: popup → idle (waits for a tap)
//                → burst → what it held. A state machine, not a video.
//   ChestOpener  watches the game for a chest just opened and plays the Capsule.
//
// Everything shown was already earned and is already in the game: these are only
// the telling, and closing or skipping one changes nothing.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { itemName } from '../core/economy.ts'
import type { Game, Moment } from '../core/fold.ts'
import { Coin, ItemIcon } from './Item.tsx'
import { flyReward } from './lib/fly.ts'
import { K, motion, motionConfig, run } from './lib/fx.ts'
import { capsuleBurst, capsulePopup, confetti, evoUnlocked, type RarityName } from './lib/motion.js'
import { play } from './lib/sfx.ts'

// ── an evolution ────────────────────────────────────────────────────────────
export function EvoReveal({ from, to, title, replay = 0 }: { from: string; to: string; title: string; replay?: number }) {
  const [shown, setShown] = useState<'was' | 'now'>('was')
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    setShown('was')
    if (motionConfig.reduced) { setShown('now'); return }
    const q = (s: string) => el.querySelector(s)
    let live = true
    const card = q('.evo-card')
    // the old form charges white (0 → full over half a second), then the popup takes over
    void run(q('.evo-charge'), K(700, [[0, { o: 0 }], [200, { o: 0 }], [620, { o: 1 }], [700, { o: 0 }]]), { dur: 700 })
    const t1 = window.setTimeout(() => {
      if (!live) return
      void evoUnlocked({ dimmer: q('.evo-dim'), sunburst: q('.evo-burst'), rays: q('.evo-rays'), bloom: q('.evo-bloom'), card, title: q('.evo-title'), wings: [...el.querySelectorAll('.evo-wing')], shine: q('.evo-shine'), hold: 400, exit: false })
      play('catch')
    }, 620)
    // the bloom is at its widest when the card starts to slam: swap the sprite under it
    const t2 = window.setTimeout(() => live && setShown('now'), 620 + 700)
    return () => { live = false; window.clearTimeout(t1); window.clearTimeout(t2); el.getAnimations({ subtree: true }).forEach((a) => a.cancel()) }
  }, [from, to, replay])
  return (
    <div ref={root} className="evo" role="img" aria-label={title}>
      <span className="evo-dim" />
      <span className="evo-burst"><span className="evo-rays" /></span>
      <span className="evo-bloom" />
      <span className="evo-wing l" /><span className="evo-wing r" />
      <span className="evo-card">
        <img src={shown === 'was' ? from : to} alt="" className={shown === 'was' ? 'was' : ''} />
        <span className="evo-charge" style={{ WebkitMaskImage: `url(${from})`, maskImage: `url(${from})` }} />
        <span className="evo-shinebox"><span className="evo-shine" /></span>
      </span>
      <span className="evo-title k-type">{title}</span>
    </div>
  )
}

// ── a reward that waits to be opened ────────────────────────────────────────
type Phase = 'popup' | 'idle' | 'play' | 'end'
export function Capsule({ box, rarity = 'common', title, line, children, onDone }: {
  /** what stands closed (a chest, an egg, a ball) */
  box: ReactNode
  rarity?: RarityName
  title: string
  line?: string
  /** what it held */
  children: ReactNode
  onDone: (from: Element | null) => void
}) {
  const [phase, setPhase] = useState<Phase>('popup')
  const host = useRef<HTMLDivElement>(null)
  const boxEl = useRef<HTMLSpanElement>(null)
  const prize = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    if (motionConfig.reduced) { setPhase('idle'); return }
    void capsulePopup(boxEl.current).then(() => { if (live) setPhase('idle') })
    return () => { live = false }
  }, [])
  // idle: the box breathes like a claim button until it is tapped
  useEffect(() => {
    if (phase !== 'idle' || motionConfig.reduced) return
    const el = boxEl.current
    if (!el) return
    const a = el.animate([{ transform: 'translateY(-25px) scale(1.02)' }, { transform: 'translateY(-25px) scale(1.14)', offset: 0.54 }, { transform: 'translateY(-25px) scale(1.02)' }], { duration: 1134, iterations: Infinity, easing: 'ease-in-out' })
    return () => a.cancel()
  }, [phase])

  const open = async () => {
    if (phase !== 'idle') return
    setPhase('play')
    play('catch')
    if (host.current && !motionConfig.reduced) {
      await capsuleBurst({ box: boxEl.current, host: host.current, rarity })
      if (rarity === 'legendary' || rarity === 'epic') void confetti(host.current, { count: 50 })
    }
    setPhase('end')
  }
  useEffect(() => {
    if (phase !== 'end') return
    void motion.popIn(prize.current, { from: 0.3, peak: 1.12 })
  }, [phase])

  const tap = () => { if (phase === 'idle') void open(); else if (phase === 'end') onDone(prize.current) }
  return (
    <div className={`capsule r-${rarity} p-${phase}`} role="dialog" aria-modal="true" aria-label={title} onClick={tap}>
      <div ref={host} className="capsule-stage">
        {phase !== 'end' && <span ref={boxEl} className="capsule-box">{box}</span>}
        {phase === 'end' && <div ref={prize} className="capsule-prize">{children}</div>}
      </div>
      <b className="capsule-title k-type">{phase === 'end' ? title : ' '}</b>
      {phase === 'end' && line && <p className="capsule-line">{line}</p>}
      <button type="button" className={`k-btn main capsule-go ${phase === 'idle' ? 'breathe' : ''}`} autoFocus disabled={phase === 'popup' || phase === 'play'}>
        {phase === 'end' ? 'Collect' : 'Tap to open'}
      </button>
    </div>
  )
}

// ── chests, as they are opened ──────────────────────────────────────────────
const KEY = 'pokedex.opened.v1'
type Chest = Extract<Moment, { kind: 'chest' }>
const load = (): Set<number> | null => {
  try { const raw = localStorage.getItem(KEY); return raw ? new Set(JSON.parse(raw) as number[]) : null } catch { return null }
}

/** A chest bought in the shop opens on the spot in the game; this is the moment of opening it. */
export function ChestOpener({ game }: { game: Game }) {
  const [queue, setQueue] = useState<Chest[]>([])
  const seen = useRef<Set<number> | null | undefined>(undefined)
  const count = game.moments.length
  useEffect(() => {
    if (seen.current === undefined) seen.current = load()
    const chests = game.moments.filter((m): m is Chest => m.kind === 'chest')
    const known = seen.current
    // the first run on a device opens nothing: history is not news
    const fresh = known ? chests.filter((c) => !known.has(c.n)) : []
    seen.current = new Set(chests.map((c) => c.n))
    try { localStorage.setItem(KEY, JSON.stringify([...seen.current])) } catch { /* it would only open twice */ }
    if (fresh.length) setQueue((q) => [...q, ...fresh])
  }, [count])
  const c = queue[0]
  if (!c) return null
  const rare = c.item === 'full-incense' ? 'epic' : c.item === 'ultra-ball' ? 'rare' : 'common'
  const done = (from: Element | null) => {
    if (from) flyReward(from, c.coins ? `+${c.coins}` : `+${c.count} ${itemName(c.item)}`, c.coins ? 'coins' : 'bag')
    setQueue((q) => q.slice(1))
  }
  return (
    <Capsule key={c.n} box={<ItemIcon id="chest" size={120} />} rarity={rare} title={c.coins ? `${c.coins} coins` : `${c.count > 1 ? `${c.count} × ` : ''}${itemName(c.item)}`} line={`Chest ${c.n}`} onDone={done}>
      {c.coins ? <Coin size={110} /> : <ItemIcon id={c.item} size={110} />}
    </Capsule>
  )
}
