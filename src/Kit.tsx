// The kit: the pieces every screen will be built from, and one page that
// shows them all (open the Pokedex with ?kit). Nothing here reads the game or
// the ledger. The page uses stand-in art drawn here, so the look can be judged
// before any real screen changes.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Ball, KeyStone } from './Ball.tsx'
import './kit.css'

// ── pieces ──────────────────────────────────────────────────────────────────
type Tone = 'neutral' | 'main' | 'ok'
export function KButton({ tone = 'neutral', big, disabled, onClick, children }: { tone?: Tone; big?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode }) {
  return <button type="button" className={`k-btn ${tone === 'neutral' ? '' : tone} ${big ? 'big' : ''}`} disabled={disabled} onClick={onClick}>{children}</button>
}
export function KClose({ onClick, label = 'Close' }: { onClick?: () => void; label?: string }) {
  return <button type="button" className="k-btn k-close" aria-label={label} onClick={onClick}>✕</button>
}
export function KPanel({ onClose, children }: { onClose?: () => void; children: ReactNode }) {
  return <section className="k-panel">{onClose && <KClose onClick={onClose} />}<div className="k-panel-b">{children}</div></section>
}
export function KRibbon({ metal = 'blue', children }: { metal?: 'blue' | 'gold' | 'silver' | 'purple'; children: ReactNode }) {
  return <div className="k-ribbon-wrap"><h2 className={`k-ribbon ${metal === 'blue' ? '' : metal}`}>{children}</h2></div>
}
export function KPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="k-pill"><span className="ico">{icon}</span><span>{children}</span></span>
}
/** `ready` turns it green with an arrow: something can happen now. */
export function KBar({ value, max, ready, kind = '', label }: { value: number; max: number; ready?: boolean; kind?: '' | 'gold' | 'hp' | 'hp mid' | 'hp low'; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className={`k-bar ${kind} ${ready ? 'ready' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <i style={{ width: `${pct * 100}%` }} />
      <span>{label ?? `${value}/${max}`}</span>
    </div>
  )
}
export function KMedal({ on = true, color, title, children }: { on?: boolean; color?: string; title?: string; children: ReactNode }) {
  return <span className={`k-medal ${on ? '' : 'off'}`} title={title} style={color ? ({ '--c': color } as CSSProperties) : undefined}><span>{children}</span></span>
}
/** One Pokemon as an object. `stage` picks the frame's metal; `mega` the shimmering one; `missing` the grey not-found one. */
export function KCard({ stage = 1, mega, missing, level, gem, gemColor, ball, bar, note, art }: {
  stage?: 1 | 2 | 3; mega?: boolean; missing?: boolean; level?: number; gem?: string; gemColor?: string; ball?: ReactNode; bar?: ReactNode; note?: string; art: ReactNode
}) {
  return (
    <div className={`k-card s${stage} ${mega ? 'mega' : ''} ${missing ? 'missing' : ''}`}>
      <div className="k-card-f">
        {gem && !missing && <span className="k-gem" style={gemColor ? ({ '--c': gemColor } as CSSProperties) : undefined}>{gem}</span>}
        {ball && !missing && <span className="k-ballmark">{ball}</span>}
        <div className="k-card-art">{art}</div>
        {level !== undefined && !missing && <div className="k-card-lv">Level {level}</div>}
      </div>
      {missing ? <div className="k-card-note">Not found</div> : bar}
      {note && !missing && <div className="k-card-note">{note}</div>}
    </div>
  )
}

/**
 * A reward told in three beats, the way the study found them staged: it
 * APPEARS, IDLES (so there is a moment to see what it is), then OPENS.
 * It runs by itself; a tap only hurries it. `tier` swaps all the parts at
 * once: background, back effect, front effect, how much of each.
 */
export type Tier = 'ordinary' | 'big' | 'rare'
const SPARKS: Record<Tier, number> = { ordinary: 10, big: 18, rare: 28 }
export function KReveal({ tier = 'ordinary', title, children, replay = 0 }: { tier?: Tier; title: string; children: ReactNode; replay?: number }) {
  const [phase, setPhase] = useState<'appear' | 'idle' | 'open'>('appear')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    setPhase('appear')
    timer.current = setTimeout(() => {
      setPhase('idle')
      timer.current = setTimeout(() => setPhase('open'), tier === 'rare' ? 1500 : tier === 'big' ? 1100 : 700)
    }, 600)
    return () => clearTimeout(timer.current)
  }, [tier, replay])
  const hurry = () => { clearTimeout(timer.current); setPhase('open') }
  const n = SPARKS[tier]
  return (
    <div className={`k-reveal ${tier === 'ordinary' ? '' : tier} ${phase}`} onClick={hurry} role="img" aria-label={title}>
      <span className="rays" />
      <span className="ring" />
      <span className="obj">{children}</span>
      <span className="sparks" aria-hidden>
        {Array.from({ length: n }, (_, i) => <i key={i} style={{ '--a': `${(360 / n) * i + (i % 2) * 9}deg`, '--d': 90 + ((i * 37) % 70), '--i': i } as CSSProperties} />)}
      </span>
      <span className="cap k-type">{title}</span>
    </div>
  )
}

// ── stand-in art for this page only ─────────────────────────────────────────
const BLOB = [
  '....oooo....', '..oobbbboo..', '.obbbbbbbbo.', '.obwwbbwwbo.', 'obbwkbbwkbbo', 'obbbbbbbbbbo',
  'obbbbmmbbbbo', 'obbbbbbbbbbo', '.obbbbbbbbo.', '.obsbbbbsbo.', '..oo.oo.oo..', '............',
]
function Blob({ size = 72, hue = '#5fbf7a' }: { size?: number; hue?: string }) {
  const fill: Record<string, string> = { o: '#141a33', b: hue, w: '#fff', k: '#141a33', m: '#c2453a', s: 'rgba(0,0,0,.2)' }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden>
      {BLOB.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill[c]} />)))}
    </svg>
  )
}
const Star = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M12 2l3 6.6 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.2l1.5-7L2 9.4l7-.8z" fill="#fff3a8" stroke="#141a33" strokeWidth="2" strokeLinejoin="round" /></svg>
)
const TABS = ['Partner', 'Box', 'Pokedex', 'League', 'Trainer']

// ── the page ────────────────────────────────────────────────────────────────
export function KitPage() {
  const [tab, setTab] = useState(0)
  const [xp, setXp] = useState(120)
  const [tier, setTier] = useState<Tier>('ordinary')
  const [replay, setReplay] = useState(0)
  const [open, setOpen] = useState(true)
  const show = (t: Tier) => { setTier(t); setReplay((r) => r + 1) }
  return (
    <main className="kit">
      <h1 className="k-type">The kit</h1>
      <p>Every piece the new Pokedex screens will be built from, in our own colours. Stand-in art only; nothing here touches your game. Press things: buttons sink, the bar fills, the reveals replay.</p>

      <div className="kit-bar-top" aria-label="Top bar">
        <span className="k-type sm" style={{ fontSize: 18 }}>Lv 17</span>
        <div style={{ flex: '1 1 140px', minWidth: 120 }}><KBar value={31} max={210} label="31 / 210" /></div>
        <KPill icon={<Star size={30} />}>3</KPill>
        <KPill icon={<Ball ball="great" size={30} />}>5 / 151</KPill>
        <KPill icon={<KeyStone size={30} />}>1</KPill>
      </div>

      <div className="kit-grid">
        <KPanel>
          <span className="k-label">Buttons: colour says what it does</span>
          <div className="kit-row">
            <KButton tone="main" big onClick={() => setXp((v) => (v >= 210 ? 0 : Math.min(210, v + 45)))}>Add XP</KButton>
          </div>
          <div className="kit-row" style={{ marginTop: 14 }}>
            <KButton>Info</KButton>
            <KButton tone="ok">Confirm</KButton>
            <KButton disabled>Not yet</KButton>
            <KClose />
          </div>
          <p className="kit-note">Gold is the one main action on a screen. Blue is neutral. Green confirms a choice. Grey cannot be pressed yet. Red is only ever close.</p>
        </KPanel>

        <KPanel>
          <span className="k-label">Bars: blue while filling, green when ready</span>
          <div style={{ display: 'grid', gap: 10 }}>
            <KBar value={xp} max={210} ready={xp >= 210} label={xp >= 210 ? 'Evolves!' : `${xp} / 210 XP`} />
            <KBar value={2905} max={4000} kind="hp" label="2,905 / 4,000" />
            <KBar value={1700} max={4000} kind="hp mid" label="1,700 / 4,000" />
            <KBar value={520} max={4000} kind="hp low" label="520 / 4,000" />
            <KBar value={7} max={8} kind="gold" label="7 of 8 badges" />
          </div>
          <p className="kit-note">Press Add XP: the bar turns green with an arrow the moment something can happen.</p>
        </KPanel>
      </div>

      <KRibbon metal="gold">Cards: one Pokemon as an object</KRibbon>
      <KPanel>
        <div className="kit-row" style={{ alignItems: 'flex-start', gap: 18 }}>
          <KCard stage={1} level={7} art={<Blob hue="#5fbf7a" />} bar={<KBar value={90} max={210} />} note="First stage" ball={<Ball ball="poke" size={22} />} />
          <KCard stage={2} level={24} art={<Blob hue="#63c6ff" />} bar={<KBar value={210} max={210} ready label="Evolves!" />} note="Second stage" ball={<Ball ball="great" size={22} />} />
          <KCard stage={3} level={50} gem="At" gemColor="#dc3b45" art={<Blob hue="#f5b800" />} bar={<KBar value={34} max={34} kind="gold" label="34 days" />} note="Fully trained" ball={<Ball ball="ultra" size={22} />} />
          <KCard stage={3} mega level={50} gem="Sp" gemColor="#2f7fd0" art={<Blob hue="#b9a6ff" size={84} />} bar={<KBar value={51} max={51} kind="gold" label="51 days" />} note="Mega, for good" />
          <KCard missing art={<Blob />} />
        </div>
        <p className="kit-note">The frame is the stage: bronze, silver, gold, and a shimmering one once a Mega is registered. The corner gem is the nature (the stat it raises). The ball it was caught in sits on the other corner. Grey with "Not found" is a promise, not a hole.</p>
      </KPanel>

      <div className="kit-grid">
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <KRibbon metal="silver">The road</KRibbon>
          <KPanel>
            <div className="k-road">
              <div className="k-step done" data-n="1"><KMedal color="#b9c4d8"><Star /></KMedal><div><span className="name">First badge</span><small>Won 12 Oct</small></div></div>
              <div className="k-step now" data-n="2"><KMedal color="#63c6ff"><Star /></KMedal><div><span className="name">Second badge</span><small>The leader up now</small><div style={{ marginTop: 6 }}><KBar value={1700} max={4000} kind="hp mid" label="1,700 left" /></div></div></div>
              <div className="k-step ahead" data-n="3"><KMedal on={false}><Star /></KMedal><div><span className="name">Third badge</span><small>Not yet</small></div></div>
              <div className="k-step key ahead" data-n="8"><KeyStone size={52} /><div><span className="name">Key Stone</span><small>With the eighth badge</small></div></div>
            </div>
          </KPanel>
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <KRibbon metal="purple">The ladder</KRibbon>
          <KPanel>
            <div className="k-ladder">
              <div className="head k-type"><Ball ball="ultra" size={44} />27</div>
              <div className="k-rung"><span>30 coding days</span><Star /></div>
              <div className="k-rung"><span>40 coding days</span><Star /></div>
              <div className="k-rung past">20 · reached</div>
              <div className="k-rung past">10 · reached</div>
            </div>
            <p className="kit-note">One big number, the next two things, everything behind you folded away.</p>
          </KPanel>

          <KRibbon>Medallions</KRibbon>
          <KPanel>
            <div className="kit-row">
              <KMedal color="#f5b800" title="Won"><Star /></KMedal>
              <KMedal color="#63c6ff" title="Won"><Ball ball="great" size={36} /></KMedal>
              <KMedal color="#e0559a" title="Won"><KeyStone size={36} /></KMedal>
              <KMedal on={false} title="Not yet"><Star /></KMedal>
              <KMedal on={false} title="Not yet"><Star /></KMedal>
            </div>
          </KPanel>
        </div>
      </div>

      <KRibbon metal="gold">The reveal: appear, idle, open</KRibbon>
      <KPanel>
        <KReveal tier={tier} replay={replay} title={tier === 'ordinary' ? 'Gotcha!' : tier === 'big' ? 'New badge!' : 'Mega, for good!'}>
          {tier === 'ordinary' ? <Ball ball="great" size={96} /> : tier === 'big' ? <KMedal color="#f5b800"><Star /></KMedal> : <KeyStone size={110} />}
        </KReveal>
        <div className="kit-row" style={{ marginTop: 14 }}>
          <KButton onClick={() => show('ordinary')}>Ordinary</KButton>
          <KButton tone="main" onClick={() => show('big')}>Big</KButton>
          <KButton tone="ok" onClick={() => show('rare')}>Rare</KButton>
        </div>
        <p className="kit-note">Three tiers, one recipe. Ordinary is a level or a catch; big is an evolution or a badge; rare is the Key Stone, a Mega, a Champion, a shiny. The tier changes the colour, the rays, the ring and how many sparks, all at once. It plays by itself; a tap only hurries it. The reward is already saved before any of this starts.</p>
      </KPanel>

      <KRibbon>A window, and the bottom bar</KRibbon>
      {open
        ? (
          <KPanel onClose={() => setOpen(false)}>
            <div className="kit-row" style={{ alignItems: 'flex-start' }}>
              <KCard stage={2} level={24} art={<Blob hue="#63c6ff" />} bar={<KBar value={150} max={210} />} />
              <div style={{ flex: '1 1 220px', display: 'grid', gap: 8 }}>
                <span className="k-type" style={{ fontSize: 28 }}>Stand-in</span>
                <div className="kit-row"><div className="k-tile"><span className="k-label">Nature</span><b>Modest</b></div><div className="k-tile"><span className="k-label">Together</span><b>12 days</b></div></div>
                <div className="kit-row"><KButton tone="main">Make next</KButton><KButton>Evolution line</KButton></div>
              </div>
            </div>
          </KPanel>
        )
        : <div className="kit-row"><KButton onClick={() => setOpen(true)}>Open the window again</KButton></div>}

      <nav className="kit-tabs" aria-label="Bottom bar">
        {TABS.map((t, i) => (
          <button key={t} type="button" className={tab === i ? 'on' : ''} aria-pressed={tab === i} onClick={() => setTab(i)}>
            <span className="kit-ico">{i === 0 ? <Blob size={30} /> : i === 1 ? <Ball ball="poke" size={30} /> : i === 2 ? <Ball ball="ultra" size={30} /> : i === 3 ? <Star /> : <KeyStone size={30} />}</span>
            {t}
            {i === 1 && <span className="dot">2</span>}
          </button>
        ))}
      </nav>
      <p>Five tabs. Only the open one is lifted, lit and named. A count means something new to look at, never something left undone.</p>
    </main>
  )
}
