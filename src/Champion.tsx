// Version 13 on the screens (RULES-V13.md): the bond's perks, the day's battle
// items, the Battle Frontier, Legend quests, the Collector, the Lab, and what can
// be given to one Pokemon (vitamins, a Rare Candy, an evolution item).
//
// Every action here is one small ledger event (store.useItem), the same as a
// ball thrown or a berry fed; the game is still the ledger, folded.
import { useState, type ReactNode } from 'react'
import { nameOf, type Game, type Mon } from '../core/fold.ts'
import { BERRY_HEARTS, BOOST, DIRE_HIT, EVO_ITEMS, FOSSILS, ITEMS, LEGEND_KEYS, LEGEND_KEY_BP, COLLECTOR_MULT, REVIVE_COST, TREASURE, collectorWants, treasurePrice, VITAMINS, VITAMIN_MAX, VITAMIN_STEP, itemName, type MarkTag } from '../core/economy.ts'
import { FACILITIES, type Facility } from '../core/frontier.ts'
import { BOND_PERKS, CRIT_BASE, DYNAMAX, ENDURE_DAYS, FRIENDS_XP, GIGANTAMAX, HEART_CAP, HEART_LEVELS, PICKUP_BASE, PICKUP_STEP, SHARE_XP, V13_START, bondLevel, hasPerk, levelOf, type BondPerk } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { TAG_NAME, Win } from './App.tsx'
import { Coin, ItemIcon } from './Item.tsx'
import { KBar } from './Kit.tsx'
import { fmtDay, still } from './lib/art.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'
import { heartsOf, treatsIn } from './Feed.tsx'

/** Battle Points: the Frontier's own currency, drawn as a Point Card. */
export const BpIcon = ({ size = 20 }: { size?: number }) => <ItemIcon id="point-card" size={size} />
const pct = (x: number) => `${Math.round(x * 100)}%`
const opens = <>Opens with version 13, on {fmtDay(V13_START)}.</>

// ── the bond's five perks ───────────────────────────────────────────────────
const PERK: Record<BondPerk, { name: string; icon: string; text: (bond: number) => string }> = {
  pickup: { name: 'Pickup', icon: 'itemfinder', text: (b) => `On a day with a pillar it may find something on the walk: ${pct(Math.min(0.95, PICKUP_BASE + PICKUP_STEP * Math.max(0, b - 1)))} at this bond.` },
  endure: { name: 'Endure', icon: 'guard-spec', text: () => `One empty day in ${ENDURE_DAYS} costs nothing.` },
  focus: { name: 'Focus', icon: 'scope-lens', text: () => `Critical hits: about one day in eight (${pct(CRIT_BASE)}), the day's strike ×1.5.` },
  friends: { name: 'Best friends', icon: 'soothe-bell', text: () => `+${pct(FRIENDS_XP - 1)} XP every day.` },
  share: { name: 'Exp. Share', icon: 'exp-share', text: () => `Everyone in the party below level 100 gets ${pct(SHARE_XP)} of its XP, the fully trained as well.` },
}

/** The partner's hearts as five steps, each unlocking something. */
export function BondPerks({ game }: { game: Game }) {
  const hearts = heartsOf(game.partner)
  const bond = bondLevel(hearts)
  // the hearts themselves are on the partner card above; here, one perk is told at a time: the next one, or the one tapped
  const [pick, setPick] = useState<number | null>(null)
  const shown = pick ?? Math.min(bond, BOND_PERKS.length - 1)
  const p = BOND_PERKS[shown]
  const on = hasPerk(bond, p)
  return (
    <section className="perks" aria-label="Bond perks">
      <span className="k-label">Bond perks with {nameOf(game.partner.form)}</span>
      <ol className="perk-track">
        {BOND_PERKS.map((q, i) => (
          <li key={q}>
            <button type="button" className={`perk-node ${hasPerk(bond, q) ? 'on' : ''} ${i === shown ? 'sel' : ''}`} aria-pressed={i === shown} aria-label={`${PERK[q].name}, at ${HEART_LEVELS[i]} hearts${hasPerk(bond, q) ? ', earned' : ''}`} onClick={() => setPick(i)}>
              <span className="perk-ico"><ItemIcon id={PERK[q].icon} size={30} /></span>
              <small>{hasPerk(bond, q) ? '✓' : `${HEART_LEVELS[i]}♥`}</small>
            </button>
          </li>
        ))}
      </ol>
      <p className="perk-say"><b>{PERK[p].name}</b> {on ? PERK[p].text(bond) : `At ${HEART_LEVELS[shown]} hearts: ${PERK[p].text(shown + 1)}`}</p>
    </section>
  )
}

// ── what today did, in a row of chips ───────────────────────────────────────
export function TodayEffects({ game }: { game: Game }) {
  const t = game.today
  const chips: ReactNode[] = []
  if (t.max) chips.push(<span key="max" className="fxchip max">{t.max === 'gigantamax' ? `Gigantamax ×${GIGANTAMAX}` : `Dynamax ×${DYNAMAX}`}</span>)
  if (t.crit) chips.push(<span key="crit" className="fxchip crit">Critical hit ×1.5</span>)
  for (const [tag, add] of Object.entries(t.boost ?? {})) chips.push(<span key={tag} className="fxchip boost" data-tag={tag}>{TAG_NAME[tag] ?? tag} +{pct(add ?? 0)}</span>)
  if (t.find) chips.push(<span key="find" className="fxchip find"><ItemIcon id={t.find} size={18} />Found {itemName(t.find)}</span>)
  if (game.guard) chips.push(<span key="guard" className="fxchip guard"><ItemIcon id="guard-spec" size={18} />On guard</span>)
  return chips.length ? <div className="fxchips">{chips}</div> : null
}

// ── battle prep: the day's X items, Dire Hits, the Guard Spec, Honey ────────
export function BattlePrep({ game }: { game: Game }) {
  if (!game.v13) return null
  const have = (id: string) => game.inv[id] ?? 0
  const boosts = Object.keys(BOOST).filter((id) => have(id) > 0)
  const dires = Object.keys(DIRE_HIT).filter((id) => have(id) > 0)
  const bond = bondLevel(heartsOf(game.partner))
  const crit = (hasPerk(bond, 'focus') ? CRIT_BASE : 0) + (game.partner.held === 'scope-lens' ? 0.1 : 0)
  const today = game.today.boost ?? {}
  const items = [...boosts, ...dires, ...(have('guard-spec') ? ['guard-spec'] : []), ...(have('honey') ? ['honey'] : [])]
  const use = (id: string) => {
    const what = BOOST[id] || DIRE_HIT[id] ? 'boost' : id === 'guard-spec' ? 'guard' : 'honey'
    useItem(id, '', what)
    play('tap')
  }
  if (!items.length && crit === 0 && !game.today.max && !game.today.crit && !game.guard && !game.today.find && !Object.keys(today).length) return null
  return (
    <Win title="Battle prep" tone="red" aside={crit > 0 ? `Critical ${pct(crit)}` : undefined}>
      <TodayEffects game={game} />
      {items.length > 0 ? (
        <div className="belt prep" role="group" aria-label="Battle items">
          {items.map((id) => {
            const b = BOOST[id]
            const used = b ? (today[b.tag] ?? 0) >= b.add : id === 'guard-spec' ? game.guard : id === 'honey' ? Boolean(game.wish.chosen) : false
            const sub = b ? `${TAG_NAME[b.tag]} +${pct(b.add)}` : DIRE_HIT[id] ? `crit +${pct(DIRE_HIT[id])}` : id === 'guard-spec' ? (game.guard ? 'on guard' : 'next empty day') : (game.wish.chosen ? 'one is coming' : 'a rare one next')
            return (
              <button key={id} type="button" className={`socket guard ${used ? '' : 'ready'}`} disabled={used} onClick={() => use(id)} title={ITEMS[id]?.text} aria-label={`${itemName(id)}: ${sub}`}>
                <span className="socket-well"><ItemIcon id={id} size={36} /><i className="socket-n">{have(id)}</i></span>
                <b>{itemName(id)}</b>
                <small>{used ? 'In use' : sub}</small>
              </button>
            )
          })}
        </div>
      ) : null}
    </Win>
  )
}

// ── the Battle Frontier ─────────────────────────────────────────────────────
/** What a win is, and how many days off a run survives, in one line. */
const winLine = (f: Facility): string => `${f.what[0].toUpperCase()}${f.what.slice(1)}${f.gap > 1 ? ` · ${f.gap - 1} rest ${f.gap === 2 ? 'day' : 'days'} ok` : ''}`
function FacilityCard({ f, game }: { f: Facility; game: Game }) {
  const r = game.frontier.find((x) => x.id === f.id)!
  const reach = f.gap === 0 ? r.wins : r.cur
  const target = r.silver ? f.gold : f.silver
  return (
    <div className={`facility ${r.silver ? 'silver' : ''}`} title={`${f.brain}, the ${f.name}'s Brain`}>
      <span className="facility-ico"><ItemIcon id={f.icon} size={40} /></span>
      <div className="facility-txt">
        <b>{f.name}</b>
        <small>{winLine(f)}</small>
        <KBar value={Math.min(reach, target)} max={target} kind={r.silver ? 'gold' : ''} label={`${reach} / ${target} for ${r.silver ? 'Gold' : 'Silver'} · best ${r.best}`} />
      </div>
      <span className="symbols" aria-label={`${r.silver ? 'Silver won' : 'Silver not yet'}, Gold not yet`}>
        <i className={`symbol s ${r.silver ? 'on' : ''}`} title={r.silver ? `Silver Symbol, ${fmtDay(r.silver)}` : `Silver at ${f.silver}`} />
        <i className="symbol g" title={`Gold at ${f.gold}: the ${itemName(f.goldKey)}`} />
      </span>
    </div>
  )
}
export function FrontierWin({ game }: { game: Game }) {
  const symbols = game.frontier.reduce((n, r) => n + (r.silver ? 1 : 0) + (r.gold ? 1 : 0), 0)
  const won = (f: Facility) => Boolean(game.frontier.find((x) => x.id === f.id)?.gold)
  // a facility with both Symbols has nothing left to chase: it steps down to a chip at the end
  const going = FACILITIES.filter((f) => !won(f)), done = FACILITIES.filter(won)
  return (
    <Win title="Battle Frontier" tone="purple" aside={<><BpIcon size={22} /> {game.wallet.bp.toLocaleString('en-IN')} BP · {symbols} / 14 Symbols</>}>
      {!game.v13 ? <p className="muted">{opens}</p> : (
        <>
          {going.length > 0 && <div className="facilities">{going.map((f) => <FacilityCard key={f.id} f={f} game={game} />)}</div>}
          {done.length > 0 && (
            <div className="facility-done-row" aria-label="Both Symbols won">
              <span className="k-label">Both Symbols won</span>
              {done.map((f) => <span key={f.id} className="facility-chip" title={`${f.name}: best run ${game.frontier.find((x) => x.id === f.id)!.best}`}><ItemIcon id={f.icon} size={22} />{f.name.replace('Battle ', '')}</span>)}
            </div>
          )}
        </>
      )}
    </Win>
  )
}

// ── Legend quests ───────────────────────────────────────────────────────────
const WHERE_KEY: Record<string, string> = Object.fromEntries(FACILITIES.map((f) => [f.goldKey, `Gold Symbol at the ${f.name}`]))
export function LegendWin({ game }: { game: Game }) {
  const [all, setAll] = useState(false)
  const keys = Object.entries(LEGEND_KEYS)
  const caught = (form: string) => Boolean(game.dex[form]?.own)
  const held = keys.filter(([id]) => (game.inv[id] ?? 0) > 0)
  const legends = keys.flatMap(([, k]) => k.forms)
  const have = legends.filter(caught).length
  const shown = all ? keys : [...held, ...keys.filter(([id]) => !(game.inv[id] ?? 0)).slice(0, Math.max(0, 6 - held.length))]
  return (
    <Win title="Legend quests" tone="gold" aside={`${have} / ${legends.length} legends`}>
      {!game.v13 ? <p className="muted">{opens}</p> : (
        <>
          <div className="legends">
            {shown.map(([id, k]) => {
              const n = game.inv[id] ?? 0
              return (
                <div key={id} className={`legend ${n ? 'have' : ''}`}>
                  <span className="legend-key"><ItemIcon id={id} size={36} />{n > 1 && <i>×{n}</i>}</span>
                  <span className="legend-mons">{k.forms.map((f) => <img key={f} src={still(f)} alt="" width={48} height={48} className={`sprite ${caught(f) ? '' : 'unseen'}`} title={caught(f) ? `${nameOf(f)}: caught` : game.dex[f] ? nameOf(f) : '???'} />)}</span>
                  <span className="legend-txt">
                    <b>{k.name}</b>
                    <small>{k.forms.map((f) => (game.dex[f] ? nameOf(f) : '???')).join(' / ')} · {WHERE_KEY[id] ?? `BP Exchange, ${LEGEND_KEY_BP} BP`}</small>
                  </span>
                  {n > 0 && <button type="button" className="k-btn main" disabled={Boolean(game.wish.chosen)} onClick={() => { useItem(id, '', 'summon'); play('catch') }}>Use</button>}
                </div>
              )
            })}
          </div>
          <button type="button" className="k-btn" onClick={() => setAll(!all)}>{all ? 'Fewer' : `All ${keys.length} keys`}</button>
        </>
      )}
    </Win>
  )
}

// ── the Collector and the Lab (Shop) ────────────────────────────────────────
export function CollectorWin({ game }: { game: Game }) {
  const loot = Object.keys(TREASURE).filter((id) => (game.inv[id] ?? 0) > 0)
  const today = game.today.day
  const price = (id: string) => (game.v14 ? treasurePrice(id, today) : TREASURE[id][1])
  const worth = loot.reduce((n, id) => n + price(id) * (game.inv[id] ?? 0), 0)
  const wants = game.v14 ? collectorWants(today) : []
  const sellAll = () => { for (const id of loot) useItem(id, '', 'sell', String(game.inv[id])); play('buy') }
  return (
    <Win title="The Collector" tone="gold" aside={<><Coin size={22} /> {game.wallet.coins.toLocaleString('en-IN')}</>}>
      {wants.length > 0 && <p className="muted">Today he pays ×{COLLECTOR_MULT} for the marked ones.</p>}
      {wants.length > 0 && (
        <div className="wanted" aria-label="Wanted today">
          <span className="k-label">Wanted today</span>
          <div className="kit-row">{wants.map((id) => <span key={id} className={`chip ${(game.inv[id] ?? 0) > 0 ? 'mega' : ''}`} title={`${itemName(id)}: ${price(id).toLocaleString('en-IN')} coins today`}><ItemIcon id={id} size={22} />{itemName(id)} ×{COLLECTOR_MULT}</span>)}</div>
        </div>
      )}
      {loot.length === 0 ? <p className="muted">Nothing to sell yet. From bond level 1, Pickup finds treasures on days with a pillar.</p> : (
        <>
          <div className="trade-list">
            {loot.map((id) => (
              <div key={id} className="trade">
                <ItemIcon id={id} size={40} />
                <span><b>{itemName(id)} ×{game.inv[id]}</b><small>{price(id).toLocaleString('en-IN')} coins each{wants.includes(id) ? ' · wanted today' : wants.length ? ` · ${(TREASURE[id][1] * COLLECTOR_MULT).toLocaleString('en-IN')} on its day` : ''}</small></span>
                <button type="button" className={`k-btn ${wants.includes(id) || !wants.length ? 'ok' : ''}`} onClick={() => { useItem(id, '', 'sell', String(game.inv[id])); play('buy') }}>Sell <Coin size={16} />{(price(id) * (game.inv[id] ?? 0)).toLocaleString('en-IN')}</button>
              </div>
            ))}
          </div>
          {loot.length > 1 && <button type="button" className="k-btn main big" onClick={sellAll}>Sell everything for {worth.toLocaleString('en-IN')} coins</button>}
        </>
      )}
    </Win>
  )
}
export function LabWin({ game }: { game: Game }) {
  const fossils = Object.keys(FOSSILS)
  return (
    <Win title="The Lab" tone="blue" aside={`${REVIVE_COST} coins a revival`}>
      <div className="trade-list">
        {fossils.map((id) => {
          const n = game.inv[id] ?? 0
          const form = FOSSILS[id].species
          return (
            <div key={id} className={`trade ${n ? '' : 'dim'}`}>
              <ItemIcon id={id} size={40} />
              <img src={still(form)} alt="" width={44} height={44} className={`sprite ${game.dex[form]?.own ? '' : 'unseen'}`} />
              <span><b>{itemName(id)}{n ? ` ×${n}` : ''}</b><small>{game.dex[form] ? nameOf(form) : '???'}</small></span>
              {n > 0 && <button type="button" className="k-btn main" disabled={game.wallet.coins < REVIVE_COST} onClick={() => { useItem(id, '', 'fossil'); play('catch') }}>Revive</button>}
            </div>
          )
        })}
      </div>
    </Win>
  )
}

// ── one Pokemon: vitamins, a Rare Candy, an evolution item ──────────────────
/** The evolution items that would work on this Pokemon now, with what each would make of it. */
export function evolutionsFor(game: Game, m: Mon): { item: string; form: string }[] {
  const next = SPECIES[m.form]?.e ?? []
  return Object.keys(EVO_ITEMS).flatMap((item) => {
    if (!(game.inv[item] ?? 0)) return []
    const form = next.find((f) => SPECIES[f] && (EVO_ITEMS[item].types.includes(SPECIES[f].t) || (SPECIES[f].t2 !== undefined && EVO_ITEMS[item].types.includes(SPECIES[f].t2!))))
    return form ? [{ item, form }] : []
  })
}
export function MonExtras({ game, m, onDone }: { game: Game; m: Mon; onDone: () => void }) {
  if (!game.v13) return null
  const inBox = game.queue.some((x) => x.uid === m.uid)
  const vits = Object.keys(VITAMINS)
  const owned = vits.filter((v) => (game.inv[v] ?? 0) > 0)
  const evos = inBox ? evolutionsFor(game, m) : []
  const candy = inBox && (game.inv['rare-candy'] ?? 0) > 0
  const given = Object.entries(m.vits ?? {}).filter(([, n]) => (n ?? 0) > 0)
  const treats = treatsIn(game)
  const hearts = heartsOf(m)
  return (
    <div className="mon-extras">
      {(given.length > 0 || owned.length > 0) && (
        <div className="vits">
          <span className="k-label">Vitamins{given.length ? ` · ${given.map(([t, n]) => `${TAG_NAME[t]} +${pct(VITAMIN_STEP * (n ?? 0))}`).join(', ')}` : ''}</span>
          <div className="kit-row">
            {owned.map((v) => {
              const tag = VITAMINS[v] as MarkTag
              const full = (m.vits?.[tag] ?? 0) >= VITAMIN_MAX
              return <button key={v} type="button" className="k-btn" disabled={full} onClick={() => { useItem(v, m.uid, 'vitamin'); play('feed') }} title={ITEMS[v].text}><ItemIcon id={v} size={22} />{itemName(v)} ({m.vits?.[tag] ?? 0}/{VITAMIN_MAX})</button>
            })}
          </div>
          {game.partner.uid !== m.uid && given.length > 0 && <small className="muted">{game.v14 ? `Vitamins count in full while this Pokemon is your partner, and a third while it stands in the party${game.team.some((x) => x.uid === m.uid) ? ' (it does now)' : ''}.` : 'Vitamins count while this Pokemon is your partner.'}</small>}
        </div>
      )}
      {game.v14 && treats.length > 0 && (
        <div className="vits">
          <span className="k-label">Hearts · {hearts} ♥, bond {bondLevel(hearts)}{hearts >= HEART_CAP ? ' (full)' : ''}</span>
          <div className="kit-row">
            {treats.map((b) => <button key={b} type="button" className="k-btn" disabled={hearts >= HEART_CAP} onClick={() => { useItem(b, m.uid, 'feed'); play('feed') }} title={ITEMS[b].text}><ItemIcon id={b} size={22} />+{BERRY_HEARTS[b]} ♥ <small>{game.inv[b]}</small></button>)}
          </div>
        </div>
      )}
      {(evos.length > 0 || candy) && (
        <div className="kit-row">
          {evos.map(({ item, form }) => <button key={item} type="button" className="k-btn main" onClick={() => { useItem(item, m.uid, 'evolve', form); play('catch'); onDone() }}><ItemIcon id={item} size={22} />{itemName(item)}: into {nameOf(form)}</button>)}
          {candy && <button type="button" className="k-btn ok" onClick={() => { useItem('rare-candy', m.uid, 'candy'); play('feed') }}><ItemIcon id="rare-candy" size={22} />Rare Candy (Lv {levelOf(m.xp)} → {levelOf(m.xp) + 1})</button>}
        </div>
      )}
    </div>
  )
}
