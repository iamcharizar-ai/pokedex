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
import { aBall, badgeArt, badgeName, fmtDay, leagueName, still } from './lib/art.ts'

const SEEN_KEY = 'pokedex.seen.v1'
/** How far back a moment can still be news. Older than this it is history, in the Adventure log. */
const NEWS_DAYS = 30
/** Not news by themselves: a level is one of many, a wild Pokemon is on the screen already, a choice was made by hand. */
const QUIET = new Set<Moment['kind']>(['level', 'appear', 'use', 'item', 'badge'])
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

function Art({ t }: { t: Told }) {
  if (t.art === 'evolve' && t.form && t.from)
    return <div className="rc-art evolve"><img src={still(t.from)} alt="" width={96} height={96} className="sprite was" /><img src={spritePath(t.form)} alt="" width={120} height={120} className="sprite now" /></div>
  if (t.art === 'catch' && t.form)
    return <div className="rc-art catch"><img src={spritePath(t.form, t.shiny)} alt="" width={112} height={112} className="sprite" /><Ball ball={t.ball ?? 'poke'} size={48} /></div>
  if (t.art === 'mon' && t.form) return <div className="rc-art"><img src={spritePath(t.form, t.shiny)} alt="" width={120} height={120} className="sprite pop" /></div>
  if (t.art === 'badge') return <div className="rc-art">{t.badge ? <img src={t.badge} alt="" width={96} height={96} className="sprite pop" /> : <span className="badge b0 on pop" style={{ width: 80 }} />}</div>
  if (t.art === 'key') return <div className="rc-art"><span className="pop"><KeyStone size={84} /></span></div>
  return null
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
        <div className="rc-eyebrow">{days.size > 1 ? 'While you were away' : top.m.day === today ? 'Today' : fmtDay(top.m.day)}</div>
        <Art t={top.t} />
        <h2>{top.t.title}</h2>
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
  )
}
