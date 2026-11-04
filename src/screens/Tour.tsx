// The first-run tour: five cards, once, on a game that has not started. It says
// what this app is (the game your Life OS habits play), what a tick does, where
// rewards wait, what the five tabs are, and the boss to come. Skip is always
// there, and the help window can bring it back.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LIFEOS_URL } from '../lib/store.ts'
import { Ball } from '../Ball.tsx'
import { ItemIcon } from '../Item.tsx'
import { play } from '../lib/sfx.ts'
import { Meter } from '../Meter.tsx'
import { RANK, useOverlay } from './overlay.ts'

interface Card { title: string; art: ReactNode; body: ReactNode }

// Each card shows a small, working piece of the real screen it is about (UI-AUDIT-2026-11-04 T22), with one line under it.
const TABS: [string, string][] = [['coin-case', 'Shop'], ['tm-case', 'Party'], ['poke-ball', 'Today'], ['journal', 'Pokedex'], ['member-card', 'Journey']]
const CARDS: Card[] = [
  {
    title: 'Your habits play this game',
    art: <span className="tour-ring" aria-hidden><span className="tour-ring-fill" /><ItemIcon id="journal" size={48} /><i className="tour-tick pre-stamp">✓</i></span>,
    body: <>You tick habits in <a href={LIFEOS_URL} target="_blank" rel="noreferrer">Life OS</a>; this shows what that did.</>,
  },
  {
    title: 'A tick grows your partner',
    art: (
      <span className="tour-bars" aria-hidden>
        <Meter look="game" kind="xp" value={190} max={282} today={120} name="Experience" label="+120" size="lg" className="pre-sweep" />
        <Meter look="game" kind="hp" value={640} max={1100} ghost={-180} name="The wild Pokemon" label="640 / 1,100" size="lg" />
      </span>
    ),
    body: <>Habits are XP; the share you tick wears down the wild Pokemon.</>,
  },
  {
    title: 'Rewards wait for you',
    art: <span className="tour-bag tb-collect has breathe" aria-hidden><ItemIcon id="loot-sack" size={48} /><i className="tb-count">3</i></span>,
    body: <>Tap the bag in the top bar to collect. Left alone, each pays itself in three days.</>,
  },
  {
    title: 'Five tabs, one job each',
    art: <span className="tour-dock" aria-hidden>{TABS.map(([icon, name], i) => <span key={name} className={i === 2 ? 'on' : ''}><ItemIcon id={icon} size={24} /><small>{name}</small></span>)}</span>,
    body: <>Swipe sideways between them.</>,
  },
  {
    title: 'A boss, once your party is six',
    art: <span className="tour-six" aria-hidden>{Array.from({ length: 6 }, (_, i) => <i key={i} className={`pre-pop ${i < 4 ? 'on' : ''}`} style={{ animationDelay: `${i * 90}ms` }}>{i < 4 && <Ball ball="poke" size={24} />}</i>)}</span>,
    body: <>Your partner and five fully trained: then a boss comes each Monday. Until then, just tick.</>,
  },
]

export function Tour({ onClose }: { onClose: () => void }) {
  const turn = useOverlay(true, RANK.tour)
  const [i, setI] = useState(0)
  const next = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (turn) next.current?.focus() }, [turn, i])
  useEffect(() => {
    if (!turn) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') setI((n) => Math.min(CARDS.length - 1, n + 1)); else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1)) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [turn, onClose])
  if (!turn) return null
  const c = CARDS[i], last = i === CARDS.length - 1
  return (
    <div className="tour-back" role="dialog" aria-modal="true" aria-label="Welcome tour">
      <div className="tour">
        <span className="tour-step k-label">{i + 1} of {CARDS.length}</span>
        <div key={i} className="tour-card">
          <span className="tour-art">{c.art}</span>
          <h2 className="k-type">{c.title}</h2>
          <p>{c.body}</p>
        </div>
        <div className="tour-dots" aria-hidden>{CARDS.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          {i > 0 ? <button type="button" className="tour-skip" onClick={() => { setI(i - 1); play('tap') }}>Back</button> : <button type="button" className="tour-skip" onClick={onClose}>Skip</button>}
          <button ref={next} type="button" className="k-btn main" onClick={() => { if (last) { play('catch'); onClose() } else { setI(i + 1); play('tap') } }}>{last ? "Let's go" : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
