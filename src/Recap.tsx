// What happened since this device last looked, said once.
//
// Everything shown here was already earned and is already in the game: this is
// only the telling. Closing it, skipping it or never seeing it changes nothing.
// What has been shown is remembered on this device alone (it is not progress,
// so it does not belong in the ledger).
import { useEffect, useMemo, useRef, useState } from 'react'
import { isGym, leaderOf, nameOf, spritePath, type Game, type Moment } from '../core/fold.ts'
import { LEAGUES, lineup } from '../core/gyms.ts'
import { ITEMS, itemName } from '../core/economy.ts'
import { REGIONS, type Ball as BallId } from '../core/rules.ts'
import { Ball, BallItem, KeyStone } from './Ball.tsx'
import { ItemIcon } from './Item.tsx'
import { KReveal, type Tier } from './Kit.tsx'
import { EvoReveal } from './Reveal.tsx'
import { party } from './lib/fx.ts'
import { told } from './lib/told.ts'
import { RANK, useOverlay } from './screens/overlay.ts'
import { aBall, badgeArt, badgeName, fmtDay, leagueName, still } from './lib/art.ts'

const SEEN_KEY = 'pokedex.seen.v1'
/** How far back a moment can still be news. Older than this it is history, in the Adventure log. */
const NEWS_DAYS = 30
/** Not news by themselves: a level is one of many, a wild Pokemon is on the screen already, a choice was made by hand. */
const QUIET = new Set<Moment['kind']>(['level', 'appear', 'use', 'quest', 'season', 'transfer', 'chest', 'slip', 'gear', 'hatch'])
/** A feat is news only when it paid something no shop sells (the Key Stone has a moment of its own). */
const prize = (m: Extract<Moment, { kind: 'feat' }>): string | undefined => m.items.find((id) => ITEMS[id]?.kind === 'unique')
/** Bigger things first. */
const WEIGHT: Partial<Record<Moment['kind'], number>> = { league: 9, boss: 8.5, key: 8, mega: 7, feat: 6.5, gym: 6, evolve: 5, graduate: 4, region: 3, catch: 2, form: 1, partner: 0 }

const keyOf = (m: Moment): string =>
  `${m.day}|${m.kind}|${'form' in m ? m.form : ''}|${'n' in m ? m.n : ''}|${'league' in m ? m.league : ''}|${'slot' in m ? m.slot : ''}|${'id' in m ? m.id : ''}${m.kind === 'boss' ? `|${m.what}` : ''}`

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
  const recent = game.moments.filter((m) => m.day >= floor && !QUIET.has(m.kind) && !(m.kind === 'feat' && !prize(m)))
  const seen = loadSeen()
  // one the screen that did it has already played (a forged Mega) is marked told below but not shown again
  const unseen = seen ? recent.filter((m) => !seen.has(keyOf(m))) : []
  const fresh = unseen.filter((m) => !(m.kind === 'mega' && told.has(`mega:${m.form}`)))
  if (!seen || unseen.length) {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(recent.map(keyOf)))
    } catch {
      /* no storage: the worst case is the same news twice */
    }
  }
  return fresh.sort((a, b) => (WEIGHT[b.kind] ?? 0) - (WEIGHT[a.kind] ?? 0) || (a.day < b.day ? 1 : -1))
}

interface Told { title: string; line: string; art: 'mon' | 'evolve' | 'catch' | 'badge' | 'key' | 'item' | 'none'; form?: string; from?: string; shiny?: boolean; badge?: string | null; ball?: BallId; thrown?: string; item?: string }

function tell(m: Moment, game: Game): Told {
  switch (m.kind) {
    case 'evolve': return { title: 'Evolved', line: `${nameOf(m.from)} evolved into ${nameOf(m.form)}.`, art: 'evolve', form: m.form, from: m.from }
    case 'graduate': {
      const mon = game.graduates.find((g) => g.uid === m.uid)
      return { title: 'Fully trained', line: `${nameOf(m.form)} is in the Pokedex for good${mon?.nature ? `, with a ${mon.nature.name} nature` : ''}.`, art: 'mon', form: m.form, shiny: mon?.shiny }
    }
    case 'hatch': return { title: 'The egg hatched!', line: `${nameOf(m.form)} is in My Pokemon.`, art: 'mon', form: m.form }
    case 'partner': return { title: m.origin === 'egg' ? 'An egg hatched' : 'New partner', line: `${nameOf(m.form)} is your partner now.`, art: 'mon', form: m.form }
    case 'catch': {
      const mon = [...game.queue, ...game.graduates, game.partner].find((x) => x.uid === m.uid)
      const ball = mon?.ball ?? game.days.find((d) => d.day === m.day)?.ball ?? 'poke'
      return { title: m.how === 'perfect' ? 'Perfect day: caught!' : 'Gotcha!', line: `${m.shiny ? 'A shiny ' : ''}${nameOf(m.form)} was caught in ${mon?.thrown ? `a ${itemName(mon.thrown)}` : aBall(ball)} and is in My Pokemon.`, art: 'catch', form: m.form, shiny: m.shiny, ball, thrown: mon?.thrown }
    }
    case 'form': return { title: m.what === 'mega' ? 'Mega form' : 'Gigantamax', line: `${nameOf(m.form)} is registered in the Pokedex.`, art: 'mon', form: m.form }
    case 'mega': return { title: 'Mega Stone forged', line: `${nameOf(m.form)} is registered to this Pokemon and never runs out.`, art: 'mon', form: m.form }
    case 'kit': return m.shard
      ? { title: 'Training kit complete', line: 'A full set of Strong gear became a Red Shard, and paid gems and Iron.', art: 'item', item: 'red-shard' }
      : { title: 'Training kit complete', line: 'A full set of Strong gear paid gems and Iron. Every third set is a Red Shard too.', art: 'item', item: 'iron' }
    case 'feat': { const it = prize(m); return { title: m.name, line: `A feat reached${it ? `: ${itemName(it)} is yours, and no shop sells it` : ''}.`, art: 'item', item: it } }
    case 'boss':
      if (m.what === 'appear') return { title: 'A boss appeared', line: `Lv ${m.level} ${nameOf(m.form)} is here for the week. Its card is on Home.`, art: 'mon', form: m.form }
      if (m.what === 'kill') return { title: 'Boss beaten', line: `${nameOf(m.form)} is down. Its prize waits in Collect.`, art: 'mon', form: m.form }
      if (m.what === 'catch') return { title: 'Boss caught!', line: `${m.shiny ? 'A shiny ' : ''}${nameOf(m.form)} is in My Pokemon.`, art: 'mon', form: m.form, shiny: m.shiny }
      return { title: '', line: '', art: 'none' }
    case 'review': return { title: 'Month reviewed', line: 'A Comet Shard is yours. It fits any Mega: three forge a stone.', art: 'item', item: 'comet-shard' }
    case 'key': return { title: 'Key Stone', line: 'Three shards now forge a Mega Stone for a fully evolved Pokemon.', art: 'key' }
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
  m.kind === 'key' || m.kind === 'mega' || m.kind === 'league' || (m.kind === 'catch' && m.shiny) || (m.kind === 'boss' && m.what !== 'appear') ? 'rare'
    : m.kind === 'boss' || m.kind === 'evolve' || m.kind === 'feat' || m.kind === 'kit' || m.kind === 'gym' || m.kind === 'graduate' || m.kind === 'region' ? 'big' : 'ordinary'

const STAR = <ItemIcon id="star-piece" size={72} />

/** What stands in the middle of the reveal. */
function Art({ t }: { t: Told }) {
  // the old form as a shadow until it opens, then the new one
  if (t.art === 'evolve' && t.form && t.from) return <><img src={still(t.from)} alt="" className="was" /><img src={spritePath(t.form)} alt="" className="now" /></>
  // the ball of that day closes on it, then it is shown beside its ball
  if (t.art === 'catch' && t.form) return <><img src={spritePath(t.form, t.shiny)} alt="" className="hideuntil" /><span className="ballover">{t.thrown ? <BallItem id={t.thrown} size={84} /> : <Ball ball={t.ball ?? 'poke'} size={84} />}</span></>
  if (t.art === 'mon' && t.form) return <img src={spritePath(t.form, t.shiny)} alt="" />
  if (t.art === 'badge') return t.badge ? <img src={t.badge} alt="" className="gymbadge pix" style={{ width: 120, height: 120 }} /> : <span className="badgeslot on" style={{ width: 96, height: 96 }}>★</span>
  if (t.art === 'key') return <KeyStone size={110} />
  if (t.art === 'item' && t.item) return <ItemIcon id={t.item} size={110} />
  return STAR
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
  // big news waits to be opened: the first tap opens it, the next one closes the window
  const [opened, setOpened] = useState(false)
  const [force, setForce] = useState(false)
  const win = useRef<HTMLDivElement>(null)
  const head = told[0]?.m
  useEffect(() => { setOpened(false); setForce(false) }, [head])
  const turn = useOverlay(told.length > 0, RANK.news)
  if (!told.length || !turn) return null
  const [top, ...rest] = told
  const days = new Set(told.map((x) => x.m.day))
  const tier = tierOf(top.m)
  const evolving = top.t.art === 'evolve' && top.t.form && top.t.from
  const close = () => setFresh([])
  const tap = () => { if (opened || evolving) close(); else setForce(true) }
  const onOpen = () => { setOpened(true); if (tier === 'rare') party(win.current, 60) }
  return (
    <div className="recap" role="dialog" aria-modal="true" aria-label="What is new" onClick={tap}>
      <div className="rc-win" ref={win}>
        <div className="rc-body">
        <div className="rc-eyebrow">{days.size > 1 ? 'While you were away' : top.m.day === today ? 'Today' : fmtDay(top.m.day)}</div>
        {evolving
          ? <EvoReveal from={still(top.t.from!)} to={spritePath(top.t.form!)} title={top.t.title} />
          : <KReveal tier={tier} title={top.t.title} wait={tier !== 'ordinary'} force={force} onOpen={onOpen}><Art t={top.t} /></KReveal>}
        <p style={opened || evolving ? undefined : { visibility: 'hidden' }}>{top.t.line}</p>
        {rest.length > 0 && (
          <ul className="rc-list">
            {rest.slice(0, 8).map(({ m, t }, i) => <li key={i}><b>{t.title}</b><span>{t.line}</span><small>{fmtDay(m.day)}</small></li>)}
            {rest.length > 8 && <li className="more">and {rest.length - 8} more, in the Adventure log on the Journey tab.</li>}
          </ul>
        )}
        <button className={`go ${opened || evolving ? '' : 'breathe'}`} autoFocus>{opened || evolving ? 'Continue' : 'Tap to open'}</button>
        <small className="rc-note">Already saved. Tap anywhere to close.</small>
        </div>
      </div>
    </div>
  )
}
