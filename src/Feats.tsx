// Feats: what the work has proved, and what each proof paid. Runs first (they
// can end, but nothing they paid ever does), then the ones closest to done.
import { FEATS, ITEMS, MARKS, MARK_TAGS, itemName, type Feat, type MarkTag } from '../core/economy.ts'
import type { Game } from '../core/fold.ts'
import { TAG_NAME, Win, plural } from './App.tsx'
import { Gem, ItemIcon, MarkIcon } from './Item.tsx'
import { KBar } from './Kit.tsx'
import { fmtDay } from './lib/art.ts'

const GROUP: Record<Feat['group'], string> = { run: 'Runs', total: 'For life', perfect: 'Perfect days', collect: 'Collection', raise: 'Raising', league: 'Leagues' }
const ORDER: Feat['group'][] = ['run', 'total', 'perfect', 'collect', 'raise', 'league']

function Reward({ f }: { f: Feat }) {
  const items = Object.entries(f.reward.items ?? {})
  return (
    <span className="freward">
      {f.reward.gems ? <span className="fr"><Gem size={18} />{f.reward.gems}</span> : null}
      {f.reward.coins ? <span className="fr"><ItemIcon id="coin" size={18} />{f.reward.coins}</span> : null}
      {items.map(([id, n]) => <span key={id} className={`fr ${ITEMS[id]?.kind === 'unique' || ITEMS[id]?.kind === 'key' ? 'big' : ''}`} title={itemName(id)}><ItemIcon id={id} size={24} />{n > 1 ? `×${n}` : ''}</span>)}
    </span>
  )
}

function FeatRow({ f, game }: { f: Feat; game: Game }) {
  const got = game.feats.find((x) => x.id === f.id)
  const have = Math.min(f.n, game.counters[f.key] ?? 0)
  return (
    <li className={`feat ${got ? 'done' : ''}`}>
      <div className="fname"><b>{f.name}</b><small>{f.text}</small></div>
      {got ? <span className="fwhen">{fmtDay(got.day)}</span> : <KBar value={have} max={f.n} label={`${have} / ${f.n}`} />}
      <Reward f={f} />
    </li>
  )
}

/** Each kind of work in one place: how many days, the run, the best run, the mark balance and the mastery level. (Field notes, runs and mastery were three windows.) */
export function WorkWin({ game }: { game: Game }) {
  const n = game.notes
  const detail: Record<MarkTag, string> = {
    code: plural(n.codeDays, 'coding day'),
    fitness: `${plural(n.workouts, 'workout')} · ${plural(n.records, 'record')} beaten`,
    guitar: `${plural(n.guitarDays, 'full session')} · ${plural(n.clean, 'clean play')} · ${plural(n.owned, 'part')} owned`,
    arbor: plural(n.arborDays, 'full morning'),
    sleep: plural(game.counters['days:sleep'] ?? 0, 'measured good night'),
  }
  const extra: [string, string, string][] = [
    ['work', 'Two pillars', 'a counting day'], ['work3', 'Three pillars', 'a hard day'],
  ]
  return (
    <Win title="Your work" tone="green" aside="one rest day is forgiven">
      <ul className="work">
        {MARK_TAGS.map((t) => {
          const r = game.runs[t] ?? { cur: 0, best: 0 }
          return (
            <li key={t} className={r.cur > 0 ? 'alive' : ''} data-tag={t}>
              <MarkIcon tag={t} size={30} />
              <span className="wname"><b>{TAG_NAME[t]}</b><small>{detail[t]}</small></span>
              <span className="wrun"><b>{r.cur}</b><small>running · best {r.best}</small></span>
              <span className="wlvl" title={`${TAG_NAME[t]} level ${game.mastery[t]}: ${TAG_NAME[t].toLowerCase()} work strikes leaders +${game.mastery[t] * 3}% harder`}><b>Lv {game.mastery[t]}</b><small>{game.wallet.marks[t]} {MARKS[t].name}</small></span>
            </li>
          )
        })}
        {extra.map(([key, label, what]) => {
          const r = game.runs[key] ?? { cur: 0, best: 0 }
          return (
            <li key={key} className={`sub ${r.cur > 0 ? 'alive' : ''}`}>
              <ItemIcon id="key-stone" size={26} />
              <span className="wname"><b>{label}</b><small>{what}</small></span>
              <span className="wrun"><b>{r.cur}</b><small>running · best {r.best}</small></span>
              <span />
            </li>
          )
        })}
        <li className="sub"><ItemIcon id="power-anklet" size={26} /><span className="wname"><b>Steps</b><small>{n.stepDays ? `${n.steps.toLocaleString('en-IN')} steps over ${plural(n.stepDays, 'measured day')}` : 'not measured yet'}</small></span><span /><span /></li>
      </ul>
      <p className="muted">A run is days in a row on which that kind of work was done. Missing one day does not end it; missing two does. Levels are bought with marks in that kind's shop. Nothing earned here is ever taken back.</p>
    </Win>
  )
}

export function FeatsWin({ game }: { game: Game }) {
  const earned = new Set(game.feats.map((f) => f.id))
  const ratio = (f: Feat) => Math.min(1, (game.counters[f.key] ?? 0) / f.n)
  const next = FEATS.filter((f) => !earned.has(f.id)).sort((a, b) => ratio(b) - ratio(a)).slice(0, 4)
  return (
    <>
      <WorkWin game={game} />
      <Win title="Feats" tone="gold" aside={`${earned.size} / ${FEATS.length}`}>
        <p className="muted">Each one pays once. The big ones pay something no shop sells.</p>
        {next.length > 0 && (
          <>
            <span className="k-label">Closest</span>
            <ul className="feats">{next.map((f) => <FeatRow key={f.id} f={f} game={game} />)}</ul>
          </>
        )}
        {ORDER.map((g) => {
          const list = FEATS.filter((f) => f.group === g)
          const n = list.filter((f) => earned.has(f.id)).length
          return (
            <details key={g} className="featgroup">
              <summary><b>{GROUP[g]}</b><span>{n} / {list.length}</span></summary>
              <ul className="feats">{list.map((f) => <FeatRow key={f.id} f={f} game={game} />)}</ul>
            </details>
          )
        })}
        <p className="muted">{plural(game.feats.length, 'feat')} reached. The Key Stone, the Master Ball and the held items that strike ×1.3 are all here and nowhere else.</p>
      </Win>
    </>
  )
}
