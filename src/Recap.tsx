// What happened since this device last looked, said once.
//
// Everything shown here was already earned and is already in the game: this is
// only the telling. Closing it, skipping it or never seeing it changes nothing.
// What has been shown is remembered on this device alone (it is not progress,
// so it does not belong in the ledger).
import { useEffect, useMemo, useState } from 'react'
import { isGym, leaderOf, nameOf, spritePath, type Game, type Moment } from '../core/fold.ts'
import { LEAGUES, lineup } from '../core/gyms.ts'
import { REGIONS, type Ball as BallId } from '../core/rules.ts'
import { Ball, KeyStone } from './Ball.tsx'
import { KMedal, KReveal, type Tier } from './Kit.tsx'
import { aBall, badgeArt, badgeName, fmtDay, leagueName, still } from './lib/art.ts'

const SEEN_KEY = 'pokedex.seen.v1'
/** How far back a moment can still be news. Older than this it is history, in the Adventure log. */
const NEWS_DAYS = 30
/** Not news by themselves: a level is one of many, a wild Pokemon is on the screen already, a choice was made by hand. */
const QUIET = new Set<Moment['kind']>(['level', 'appear', 'use', 'item', 'badge', 'quest', 'season', 'transfer'])
/** Bigger things first. */
const WEIGHT: Partial<Record<Moment['kind'], number>> = { league: 9, key: 8, mega: 7, gym: 6, evolve: 5, graduate: 4, region: 3, catch: 2, form: 1, partner: 0 }

const keyOf = (m: Moment): string =>
  `${m.day}|${m.kind}|${'form' in m ? m.form : ''}|${'n' in m ? m.n : ''}|${'league' in m ? m.league : ''}|${'slot' in m ? m.slot : ''}`

function loadSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

/** The moments this device has not told yet, biggest first, and marks them told. The first run on a device tells nothing: history is not news. */
export function freshMoments(game: Game, today: string): Moment[] {
  const from = new Date(today + 'T12:00:00')
  from.setDate(from.getDate() - NEWS_DAYS)
  const floor = from.toISOString().slice(0, 10)
  const recent = game.moments.filter((m) => m.day >= floor && !QUIET.has(m.kind))
  const seen = loadSeen()
  const fresh = seen ? recent.filter((m) => !seen.has(keyOf(m))) : []
  if (!seen || fresh.length) {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(recent.map(keyOf)))
    } catch {
      /* no storage: the worst case is the same news twice */
    }
  }
  return fresh.sort((a, b) => (WEIGHT[b.kind] ?? 0) - (WEIGHT[a.kind] ?? 0) || (a.day < b.day ? 1 : -1))
}

interface Told { title: string; line: string; art: 'mon' | 'evolve' | 'catch' | 'badge' | 'key' | 'none'; form?: string; from?: string; shiny?: boolean; badge?: string | null; ball?: BallId }

function tell(m: Moment, game: Game): Told {
  switch (m.kind) {
    case 'evolve': return { title: 'Evolved', line: `${nameOf(m.from)} evolved into ${nameOf(m.form)}.`, art: 'evolve', form: m.form, from: m.from }
    case 'graduate': {
      const mon = game.graduates.find((g) => g.uid === m.uid)
      return { title: 'Fully trained', line: `${nameOf(m.form)} is in the Pokedex for good${mon?.nature ? `, with a ${mon.nature.name} nature` : ''}.`, art: 'mon', form: m.form, shiny: mon?.shiny }
    }
    case 'hatch': return { title: 'The egg hatched!', line: `${nameOf(m.form)} is in your Box.`, art: 'mon', form: m.form }
    case 'partner': return { title: m.origin === 'egg' ? 'An egg hatched' : 'New partner', line: `${nameOf(m.form)} is your partner now.`, art: 'mon', form: m.form }
    case 'catch': {
      const ball = game.queue.find((x) => x.uid === m.uid)?.ball ?? game.days.find((d) => d.day === m.day)?.ball ?? 'poke'
      return { title: m.how === 'perfect' ? 'Perfect day: caught!' : 'Gotcha!', line: `${m.shiny ? 'A shiny ' : ''}${nameOf(m.form)} was caught in ${aBall(ball)} and is in your Box.`, art: 'catch', form: m.form, shiny: m.shiny, ball }
    }
    case 'form': return { title: m.what === 'mega' ? 'Mega form' : 'Gigantamax', line: `${nameOf(m.form)} is registered in the Pokedex.`, art: 'mon', form: m.form }
    case 'mega': return { title: 'Mega Evolution, for good', line: `${nameOf(m.form)} is registered to this Pokemon and never runs out.`, art: 'mon', form: m.form }
    case 'key': return { title: 'Key Stone', line: 'From now on a fully evolved partner keeps its Mega form the first time a leader falls to it.', art: 'key' }
    case 'region': return { title: 'New region', line: `${REGIONS[m.n - 1]} is open: new species can turn up from now on.`, art: 'none' }
    case 'gym': {
      const t = leaderOf(m.league, m.slot), l = LEAGUES[m.league]
      if (!t || !l) return { title: 'Leader beaten', line: 'The next one steps up tomorrow.', art: 'none' }
      if (isGym(m.league, m.slot)) return { title: badgeName(t), line: `You beat ${t.name}, gym ${m.slot + 1} of ${l.name}. The badge is yours.`, art: 'badge', badge: badgeArt(m.league, m.slot) }
      return { title: m.slot === lineup(l).length - 1 ? 'Champion' : 'Elite Four', line: `You beat ${t.name} of ${l.name}.`, art: 'none' }
    }
    case 'league': return { title: 'Hall of Fame', line: `The ${leagueName(m.league)} league is yours.`, art: 'none' }
    default: return { title: '', line: '', art: 'none' }
  }
}

/** How big a moment is: it picks the whole look of its reveal. */
const tierOf = (m: Moment): Tier =>
  m.kind === 'key' || m.kind === 'mega' || m.kind === 'league' || (m.kind === 'catch' && m.shiny) ? 'rare'
    : m.kind === 'evolve' || m.kind === 'gym' || m.kind === 'graduate' || m.kind === 'region' ? 'big' : 'ordinary'

const STAR = <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden><path d="M12 2l3 6.6 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.2l1.5-7L2 9.4l7-.8z" fill="#fff3a8" stroke="#141a33" strokeWidth="2" strokeLinejoin="round" /></svg>

/** What stands in the middle of the reveal. */
function Art({ t }: { t: Told }) {
  // the old form as a shadow until it opens, then the new one
  if (t.art === 'evolve' && t.form && t.from) return <><img src={still(t.from)} alt="" className="was" /><img src={spritePath(t.form)} alt="" className="now" /></>
  // the ball of that day closes on it, then it is shown beside its ball
  if (t.art === 'catch' && t.form) return <><img src={spritePath(t.form, t.shiny)} alt="" className="hideuntil" /><span className="ballover"><Ball ball={t.ball ?? 'poke'} size={84} /></span></>
  if (t.art === 'mon' && t.form) return <img src={spritePath(t.form, t.shiny)} alt="" />
  if (t.art === 'badge') return t.badge ? <img src={t.badge} alt="" /> : <KMedal>{STAR}</KMedal>
  if (t.art === 'key') return <KeyStone size={110} />
  return <KMedal>{STAR}</KMedal>
}

/** One window for everything new: the biggest thing drawn large, the rest as a list. One tap, anywhere, closes it. */
export function Recap({ game, today }: { game: Game; today: string }) {
  // read once per day: marking them told is part of reading them
  const [fresh, setFresh] = useState<Moment[]>([])
  const count = game.moments.length
  useEffect(() => {
    const news = freshMoments(game, today)
    if (news.length) setFresh((cur) => [...cur, ...news])
    // `game` is read as it stands when the count of moments changes
  }, [count, today])
  const told = useMemo(() => fresh.map((m) => ({ m, t: tell(m, game) })).filter((x) => x.t.title), [fresh, game])
  useEffect(() => {
    if (!told.length) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setFresh([]) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [told.length])
  if (!told.length) return null
  const [top, ...rest] = told
  const days = new Set(told.map((x) => x.m.day))
  return (
    <div className="recap" role="dialog" aria-modal="true" aria-label="What is new" onClick={() => setFresh([])}>
      <div className="rc-win">
        <div className="rc-body">
        <div className="rc-eyebrow">{days.size > 1 ? 'While you were away' : top.m.day === today ? 'Today' : fmtDay(top.m.day)}</div>
        <KReveal tier={tierOf(top.m)} title={top.t.title}><Art t={top.t} /></KReveal>
        <p>{top.t.line}</p>
        {rest.length > 0 && (
          <ul className="rc-list">
            {rest.slice(0, 8).map(({ m, t }, i) => <li key={i}><b>{t.title}</b><span>{t.line}</span><small>{fmtDay(m.day)}</small></li>)}
            {rest.length > 8 && <li className="more">and {rest.length - 8} more, in the Adventure log on the Trainer tab.</li>}
          </ul>
        )}
        <button className="go" autoFocus>Continue</button>
        <small className="rc-note">Already saved. Tap anywhere to close.</small>
        </div>
      </div>
    </div>
  )
}
