// Version 13 on the screens (RULES-V13.md): the bond's perks, the day's battle
// items, the Battle Frontier, Legend quests, the Collector, the Lab, and what can
// be given to one Pokemon (vitamins, a Rare Candy, an evolution item).
//
// Every action here is one small ledger event (store.useItem), the same as a
// ball thrown or a berry fed; the game is still the ledger, folded.
import { useState, type ReactNode } from 'react'
import { nameOf, type Game, type Mon } from '../core/fold.ts'
import { BOOST, DIRE_HIT, EVO_ITEMS, FOSSILS, ITEMS, LEGEND_KEYS, LEGEND_KEY_BP, REVIVE_COST, TREASURE, VITAMINS, VITAMIN_MAX, VITAMIN_STEP, itemName, type MarkTag } from '../core/economy.ts'
import { FACILITIES, GOLD_BP, SILVER_BP, type Facility } from '../core/frontier.ts'
import { BOND_PERKS, CRIT_BASE, DYNAMAX, ENDURE_DAYS, FRIENDS_XP, GIGANTAMAX, HEART_LEVELS, PICKUP_BASE, PICKUP_STEP, SHARE_XP, V13_START, bondLevel, hasPerk, levelOf, type BondPerk } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { TAG_NAME, Win } from './App.tsx'
import { Coin, ItemIcon } from './Item.tsx'
import { KBar } from './Kit.tsx'
import { fmtDay, still } from './lib/art.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

/** Battle Points: the Frontier's own currency, drawn as a Point Card. */
export const BpIcon = ({ size = 20 }: { size?: number }) => <ItemIcon id="point-card" size={size} />
const pct = (x: number) => `${Math.round(x * 100)}%`
const heartsOf = (m: Mon) => (m.together ?? 0) + (m.fed ?? 0)
const opens = <>Opens with version 13, on {fmtDay(V13_START)}.</>

// ── the bond's five perks ───────────────────────────────────────────────────
const PERK: Record<BondPerk, { name: string; icon: string; text: (bond: number) => string }> = {
  pickup: { name: 'Pickup', icon: 'itemfinder', text: (b) => `On a day with a pillar it may find something on the walk: ${pct(Math.min(0.95, PICKUP_BASE + PICKUP_STEP * Math.max(0, b - 1)))} at this bond.` },
  endure: { name: 'Endure', icon: 'guard-spec', text: () => `One empty day in ${ENDURE_DAYS} costs nothing.` },
  focus: { name: 'Focus', icon: 'scope-lens', text: () => `Critical hits: about one day in eight (${pct(CRIT_BASE)}), the day's strike ×1.5.` },
  friends: { name: 'Best friends', icon: 'soothe-bell', text: () => `+${pct(FRIENDS_XP - 1)} XP every day.` },
  share: { name: 'Exp. Share', icon: 'exp-share', text: () => `Everyone in the party still being raised gets ${pct(SHARE_XP)} of its XP.` },
}

/** The partner's hearts as five steps, each unlocking something. */
export function BondPerks({ game }: { game: Game }) {
  const hearts = heartsOf(game.partner)
  const bond = bondLevel(hearts)
  return (
    <section className="perks" aria-label="Bond perks">
      <div className="perks-h">
        <span className="k-label">Bond with {nameOf(game.partner.form)}</span>
        <b>{hearts} ♥ · level {bond} of {HEART_LEVELS.length}</b>
      </div>
      <ol className="perk-list">
        {BOND_PERKS.map((p, i) => {
          const on = hasPerk(bond, p)
          const at = HEART_LEVELS[i]
          return (
            <li key={p} className={`perk ${on ? 'on' : ''} ${i === bond ? 'next' : ''}`} title={PERK[p].text(Math.max(bond, i + 1))}>
              <span className="perk-ico"><ItemIcon id={PERK[p].icon} size={30} /></span>
              <span className="perk-txt">
                <b>{PERK[p].name}</b>
                <small>{on ? PERK[p].text(bond) : `At ${at} hearts: ${PERK[p].text(i + 1)}`}</small>
              </span>
              <span className="perk-at">{on ? '✓' : `${at}♥`}</span>
            </li>
          )
        })}
      </ol>
      {bond < HEART_LEVELS.length && <KBar value={hearts} max={HEART_LEVELS[bond]} kind="gold" label={`${hearts} / ${HEART_LEVELS[bond]} hearts`} />}
      <p className="muted">A heart for every pillar done while it is your partner, and more from berries: Oran 1, Sitrus 3, Sweet Heart 3, the six friendship berries 5. Hearts stay with the Pokemon for good.</p>
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
  const gmax = Boolean(SPECIES[game.partner.form]?.gm)
  const items = [...boosts, ...dires, ...(have('guard-spec') ? ['guard-spec'] : []), ...(have('honey') ? ['honey'] : [])]
  const use = (id: string) => {
    const what = BOOST[id] || DIRE_HIT[id] ? 'boost' : id === 'guard-spec' ? 'guard' : 'honey'
    useItem(id, '', what)
    play('tap')
  }
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
      ) : <p className="muted">No battle items. X items, Dire Hits and the Guard Spec are on the Mart's battle shelf; Pickup finds some too.</p>}
      <p className="muted">An X item counts for all of today's work, whenever it is used. A perfect day Dynamaxes {nameOf(game.partner.form)}: its strike ×{gmax ? GIGANTAMAX : DYNAMAX}{gmax ? ' (it has a Gigantamax form)' : ''}.</p>
    </Win>
  )
}

// ── the Battle Frontier ─────────────────────────────────────────────────────
function FacilityCard({ f, game }: { f: Facility; game: Game }) {
  const r = game.frontier.find((x) => x.id === f.id)!
  const reach = f.gap === 0 ? r.wins : r.cur
  const target = r.gold ? null : r.silver ? f.gold : f.silver
  return (
    <div className={`facility ${r.gold ? 'gold' : r.silver ? 'silver' : ''}`}>
      <span className="facility-ico"><ItemIcon id={f.icon} size={40} /></span>
      <div className="facility-txt">
        <b>{f.name}</b>
        <small>{f.brain} · a win is {f.what}{f.gap > 1 ? ` · ${f.gap - 1} rest ${f.gap === 2 ? 'day' : 'days'} forgiven` : ''}</small>
        {target ? <KBar value={Math.min(reach, target)} max={target} kind={r.silver ? 'gold' : ''} label={`${f.gap === 0 ? 'Perfect days' : 'Run'} ${reach} / ${target} for ${r.silver ? 'Gold' : 'Silver'}`} /> : <small className="facility-done">Both Symbols won</small>}
        <small className="facility-best">Best run {r.best}{f.gap === 0 ? ` · ${r.wins} in all` : ''}</small>
      </div>
      <span className="symbols" aria-label={`${r.silver ? 'Silver won' : 'Silver not yet'}, ${r.gold ? 'Gold won' : 'Gold not yet'}`}>
        <i className={`symbol s ${r.silver ? 'on' : ''}`} title={r.silver ? `Silver Symbol, ${fmtDay(r.silver)}` : `Silver at ${f.silver}`} />
        <i className={`symbol g ${r.gold ? 'on' : ''}`} title={r.gold ? `Gold Symbol, ${fmtDay(r.gold)}` : `Gold at ${f.gold}: the ${itemName(f.goldKey)}`} />
      </span>
    </div>
  )
}
export function FrontierWin({ game }: { game: Game }) {
  const symbols = game.frontier.reduce((n, r) => n + (r.silver ? 1 : 0) + (r.gold ? 1 : 0), 0)
  return (
    <Win title="Battle Frontier" tone="purple" aside={<><BpIcon size={22} /> {game.wallet.bp.toLocaleString('en-IN')} BP · {symbols} / 14 Symbols</>}>
      {!game.v13 ? <p className="muted">{opens}</p> : (
        <>
          <p className="muted">Seven facilities, each a run of one kind of day. Every win pays a Battle Point, and every seventh in a row a bonus (7, then 14, up to 35); a Silver Symbol pays {SILVER_BP} BP, a Gold one {GOLD_BP} BP and a Legend key. Spend BP at the Exchange in the Shop.</p>
          <div className="facilities">{FACILITIES.map((f) => <FacilityCard key={f.id} f={f} game={game} />)}</div>
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
          <p className="muted">Each Legend key calls one legend as the next wild Pokemon, to be caught by your work like any other. Keys come from Gold Symbols, Rematch Champions and the BP Exchange.{game.wish.chosen ? ` ${nameOf(game.wish.chosen)} is already coming next.` : ''}</p>
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
  const worth = loot.reduce((n, id) => n + TREASURE[id][1] * (game.inv[id] ?? 0), 0)
  const sellAll = () => { for (const id of loot) useItem(id, '', 'sell', String(game.inv[id])); play('buy') }
  return (
    <Win title="The Collector" tone="gold" aside={<><Coin size={22} /> {game.wallet.coins.toLocaleString('en-IN')}</>}>
      <p className="muted">An old man who buys whatever your partner finds on its walks: mushrooms, pearls, nuggets, and the relics of an older age.</p>
      {loot.length === 0 ? <p className="muted">Nothing to sell yet. From bond level 1, Pickup finds treasures on days with a pillar.</p> : (
        <>
          <div className="trade-list">
            {loot.map((id) => (
              <div key={id} className="trade">
                <ItemIcon id={id} size={40} />
                <span><b>{itemName(id)} ×{game.inv[id]}</b><small>{TREASURE[id][1].toLocaleString('en-IN')} coins each</small></span>
                <button type="button" className="k-btn ok" onClick={() => { useItem(id, '', 'sell', String(game.inv[id])); play('buy') }}>Sell <Coin size={16} />{(TREASURE[id][1] * (game.inv[id] ?? 0)).toLocaleString('en-IN')}</button>
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
      <p className="muted">Bring a fossil and the scientists bring it back to life. The Pokemon comes to My Pokemon.</p>
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
      <p className="muted">Fossils are found by Pickup, and sold at the BP Exchange.</p>
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
          {game.partner.uid !== m.uid && given.length > 0 && <small className="muted">Vitamins count while this Pokemon is your partner.</small>}
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
