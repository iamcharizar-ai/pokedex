// The first-run tour: five cards, once, on a game that has not started. It says
// what this app is (the game your Life OS habits play), what a tick does, where
// rewards wait, what the five tabs are, and the boss to come. Skip is always
// there, and the help window can bring it back.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LIFEOS_URL } from '../lib/store.ts'
import { Ball } from '../Ball.tsx'
import { ItemIcon } from '../Item.tsx'
import { play } from '../lib/sfx.ts'
import { RANK, useOverlay } from './overlay.ts'

interface Card { title: string; art: ReactNode; body: ReactNode }

const CARDS: Card[] = [
  {
    title: 'Your habits play this game',
    art: <ItemIcon id="journal" size={72} />,
    body: <>You tick habits in <a href={LIFEOS_URL} target="_blank" rel="noreferrer">Life OS</a>. This app shows what that did. There is nothing to tap here to make things happen: the work is done over there.</>,
  },
  {
    title: 'A tick grows your partner',
    art: <Ball ball="great" size={72} />,
    body: <>Every habit is XP for your partner. The share of habits you tick wears down the wild Pokemon, and a perfect day catches it on the spot. Work on a kind of thing (gym, code, guitar) hurts the gym leader.</>,
  },
  {
    title: 'Rewards wait for you',
    art: <ItemIcon id="loot-sack" size={72} />,
    body: <>Pay, quests, season steps and feats wait behind the bag in the top bar. Tap it to collect them. If you never do, each pays itself three days later, so nothing is lost.</>,
  },
  {
    title: 'Five tabs, one job each',
    art: <ItemIcon id="poke-ball" size={72} />,
    body: <><b>Today</b> is the scene, <b>Party</b> is what you own and the Forge, <b>Shop</b> is what you can buy, <b>Pokedex</b> is what you have seen, and <b>Journey</b> is where you are going. Swipe sideways to move between them.</>,
  },
  {
    title: 'A boss, once your party is six',
    art: <ItemIcon id="master-ball" size={72} />,
    body: <>Train five Pokemon fully, and with your partner that is six. Then a boss comes each Monday for the week, and its card of tasks comes from Strong, Arbor, Woodshed, your sleep and your days. Until then, just tick.</>,
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
          {i > 0 ? <button type="button" className="k-btn" onClick={() => { setI(i - 1); play('tap') }}>Back</button> : <button type="button" className="k-btn" onClick={onClose}>Skip</button>}
          <button ref={next} type="button" className="k-btn main" onClick={() => { if (last) { play('catch'); onClose() } else { setI(i + 1); play('tap') } }}>{last ? "Let's go" : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
