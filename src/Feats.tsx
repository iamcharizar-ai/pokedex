// Feats: what the work has proved, and what each proof paid. Runs first (they
// can end, but nothing they paid ever does), then the ones closest to done.
import { FEATS, ITEMS, MARK_TAGS, itemName, type Feat, type MarkTag } from '../core/economy.ts'
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

export function RunsWin({ game }: { game: Game }) {
  if (game.version < 6) return null
  const RUN_LABEL: [string, string][] = [['work', 'Two pillars'], ...MARK_TAGS.map((t): [string, string] => [t, TAG_NAME[t]])]
  return (
    <Win title="Runs" tone="green" aside="one rest day is forgiven">
      <div className="runs">
        {RUN_LABEL.map(([key, label]) => {
          const r = game.runs[key] ?? { cur: 0, best: 0 }
          const tag = MARK_TAGS.includes(key as MarkTag) ? (key as MarkTag) : null
          return (
            <div key={key} className={`run ${r.cur > 0 ? 'alive' : ''}`} title={`${label}: ${r.cur} now, ${r.best} at best`}>
              {tag ? <MarkIcon tag={tag} size={28} /> : <ItemIcon id="key-stone" size={28} />}
              <b>{r.cur}</b>
              <small>{label}</small>
              <i>best {r.best}</i>
            </div>
          )
        })}
      </div>
      <p className="muted">A run is days in a row on which that kind of work was done. Missing one day does not end it; missing two does. Nothing a run paid is ever taken back.</p>
    </Win>
  )
}

export function FeatsWin({ game }: { game: Game }) {
  if (game.version < 6) return null
  const earned = new Set(game.feats.map((f) => f.id))
  const ratio = (f: Feat) => Math.min(1, (game.counters[f.key] ?? 0) / f.n)
  const next = FEATS.filter((f) => !earned.has(f.id)).sort((a, b) => ratio(b) - ratio(a)).slice(0, 4)
  return (
    <>
      <RunsWin game={game} />
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
