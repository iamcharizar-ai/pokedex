// Feats: what the work has proved, and what each proof paid. Runs first (they
// can end, but nothing they paid ever does), then the ones closest to done.
import { FEATS, ITEMS, itemName, type Feat } from '../core/economy.ts'
import type { Game } from '../core/fold.ts'
import { Win, plural } from './App.tsx'
import { Gem, ItemIcon } from './Item.tsx'
import { KBar, KMedal } from './Kit.tsx'
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

export function FeatsWin({ game }: { game: Game }) {
  const earned = new Set(game.feats.map((f) => f.id))
  const ratio = (f: Feat) => Math.min(1, (game.counters[f.key] ?? 0) / f.n)
  const next = FEATS.filter((f) => !earned.has(f.id)).sort((a, b) => ratio(b) - ratio(a)).slice(0, 2)
  return (
    <>
      <Win title="Feats" tone="gold" aside={`${earned.size} / ${FEATS.length}`}>
        <p className="muted">Each one pays once. The big ones pay something no shop sells.</p>
        {next.length > 0 && (
          <>
            <span className="k-label">Closest: the next one breathes</span>
            <div className="k-road">
              {next.map((f, i) => {
                const have = Math.min(f.n, game.counters[f.key] ?? 0)
                const big = Object.keys(f.reward.items ?? {})[0]
                return (
                  <div key={f.id} className={`k-step ${i === 0 ? 'now' : 'ahead'}`} data-n={i + 1}>
                    <KMedal on={i === 0} color="#f5b800">{big ? <ItemIcon id={big} size={30} /> : <Gem size={30} />}</KMedal>
                    <div>
                      <span className="name">{f.name}</span><small>{f.text}</small>
                      <div style={{ marginTop: 6 }}><KBar value={have} max={f.n} kind="gold" label={`${have} / ${f.n}`} /></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        <details className="featgroup">
          <summary><b>All feats</b><span>{earned.size} / {FEATS.length}</span></summary>
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
        </details>
        <p className="muted">{plural(game.feats.length, 'feat')} reached. The Key Stone, the Master Ball and the held items that strike ×1.3 are all here and nowhere else.</p>
      </Win>
    </>
  )
}
