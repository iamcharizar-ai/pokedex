// Version 13 on the screens (RULES-V13.md): the bond's perks, the day's battle
// items, the Battle Frontier, Legend quests, the Collector, the Lab, and what can
// be given to one Pokemon (vitamins, a Rare Candy, an evolution item).
//
// Every action here is one small ledger event (store.useItem), the same as a
// ball thrown or a berry fed; the game is still the ledger, folded.
import { useState, type ReactNode } from 'react'
import { PERKS_V21, hasPerkV21, type PerkV21, STAR_ENDURE_MIN, STAR_EVERY, STAR_FOCUS, STAR_FRIENDS, STAR_MAX, STAR_PICKUP, STAR_SHARE, TRAINER_LEVELS, rankName } from '../core/bond.ts'
import { canCandy, isShelved, nameOf, type Game, type Mon } from '../core/fold.ts'
import { BOOST, DIRE_HIT, EVO_ITEMS, FOSSILS, ITEMS, LEGEND_KEYS, LEGEND_KEY_BP, COLLECTOR_MULT, REVIVE_COST, TREASURE, collectorWants, treasurePrice, VITAMINS, VITAMIN_MAX, VITAMIN_STEP, itemName, type MarkTag } from '../core/economy.ts'
import { FACILITIES, type Facility } from '../core/frontier.ts'
import { BOUNTY, DAY_HIT_MULT, HEART_CAP, TEAM_SIZE, BOND_PERKS, CRIT_BASE, DYNAMAX, ENDURE_DAYS, FRIENDS_XP, GIGANTAMAX, HEART_LEVELS, PICKUP_BASE, PICKUP_STEP, SHARE_XP, V13_START, bondLevel, hasPerk, levelOf, type BondPerk } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { TAG_NAME, Win } from './App.tsx'
import { Coin, ItemIcon } from './Item.tsx'
import { Meter } from './Meter.tsx'
import { Slot } from './Slot.tsx'
import { ObjCard } from './ObjCard.tsx'
import { CropSprite } from './lib/pixel.tsx'
import { useBoxes } from './Fit.tsx'
import { typeColor } from './screens/types.ts'
import { fmtDay, still } from './lib/art.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'
import { heartsOf } from './Feed.tsx'
import { Count } from './Play.tsx'

/** Battle Points: the Frontier's own currency, drawn as a Point Card. */
export const BpIcon = ({ size = 20 }: { size?: number }) => <ItemIcon id="point-card" size={size} />
const pct = (x: number) => `${Math.round(x * 100)}%`
const opens = <>Opens with version 13, on {fmtDay(V13_START)}.</>

// ── the bond's five perks ───────────────────────────────────────────────────
// `k`: its rank from Trainer stars (version 16), 0 as it unlocked
const PERK: Record<BondPerk, { name: string; icon: string; text: (bond: number, k?: number) => string }> = {
  pickup: { name: 'Pickup', icon: 'itemfinder', text: (b, k = 0) => `On a day with a pillar it may find something on the walk: ${pct(Math.min(0.95, PICKUP_BASE + PICKUP_STEP * Math.max(0, b - 1) + STAR_PICKUP * k))} at this bond.` },
  endure: { name: 'Endure', icon: 'guard-spec', text: (_, k = 0) => `One empty day in ${Math.max(STAR_ENDURE_MIN, ENDURE_DAYS - k)} costs nothing.` },
  focus: { name: 'Focus', icon: 'scope-lens', text: (_, k = 0) => `Critical hits on ${pct(CRIT_BASE + STAR_FOCUS * k)} of days, the day's strike ×1.5.` },
  friends: { name: 'Best friends', icon: 'soothe-bell', text: (_, k = 0) => `+${pct(FRIENDS_XP - 1 + STAR_FRIENDS * k)} XP every day.` },
  share: { name: 'Exp. Share', icon: 'exp-share', text: (_, k = 0) => `Everyone in the party below level 100 gets ${pct(SHARE_XP + STAR_SHARE * k)} of its XP, the fully trained as well.` },
}

// ── version 21: the Trainer's ladder (core/bond.ts PERKS_V21) ───────────────
const PERK21: Record<PerkV21, { name: string; icon: string; text: (level: number) => string }> = {
  pickup: { name: 'Pickup', icon: 'itemfinder', text: (b) => `On a day with a pillar it may find something on the walk: ${pct(Math.min(0.95, PICKUP_BASE + PICKUP_STEP * Math.max(0, b - 1)))} at this level.` },
  bounty: { name: 'Bounty', icon: 'star-piece', text: () => `A pillar back after 2 idle days pays its own XP and marks ×${BOUNTY.two}, after 3 or more ×${BOUNTY.three}.` },
  endure: { name: 'Endure', icon: 'guard-spec', text: () => `One empty day in ${ENDURE_DAYS} costs nothing.` },
  friends: { name: 'Best friends', icon: 'soothe-bell', text: () => `+${pct(FRIENDS_XP - 1)} XP every day.` },
  sharing: { name: 'Sharing', icon: 'heart-scale', text: () => `Hearts a Pokemon cannot take go to the party member with the fewest. At ${HEART_CAP} a Pokemon is a Best Friend, its signature in full from the party.` },
}

/** Version 21: five steps of the Trainer's hearts, then the party's Best Friends filling in, one heart each. */
function PerksV21({ game }: { game: Game }) {
  const level = game.trainer.level
  const [pick, setPick] = useState<number | null>(null)
  const shown = pick ?? Math.min(level, PERKS_V21.length - 1)
  const p = PERKS_V21[shown]
  const on = hasPerkV21(level, p)
  const six = [game.partner, ...game.team]
  const best = six.filter((m) => heartsOf(m) >= HEART_CAP).length
  return (
    <section className="perks" aria-label="Trainer perks">
      <span className="k-label">Trainer perks · {game.trainer.hearts} ♥ across all your Pokemon</span>
      <ol className="perk-track">
        {PERKS_V21.map((q, i) => (
          <li key={q}>
            <button type="button" className={`perk-node ${hasPerkV21(level, q) ? 'on' : ''} ${i === shown ? 'sel' : ''}`} aria-pressed={i === shown} aria-label={`${PERK21[q].name}, at ${TRAINER_LEVELS[i]} hearts${hasPerkV21(level, q) ? ', earned' : ''}`} onClick={() => setPick(i)}>
              <span className="perk-ico"><ItemIcon id={PERK21[q].icon} size={24} /></span>
              <small>{hasPerkV21(level, q) ? '✓' : `${TRAINER_LEVELS[i]}♥`}</small>
            </button>
          </li>
        ))}
      </ol>
      <p className="perk-say"><b>{PERK21[p].name}</b> {on ? PERK21[p].text(level) : `At ${TRAINER_LEVELS[shown]} hearts in all: ${PERK21[p].text(shown + 1)}`}</p>
      {/* the bond's endgame: every one of the six a Best Friend (then Ribbons), drawn as six hearts that fill */}
      <div className="perk-best" role="meter" aria-valuemin={0} aria-valuemax={1 + TEAM_SIZE} aria-valuenow={best} aria-label={`${best} of ${1 + TEAM_SIZE} in the party are Best Friends`} title={`A Pokemon with ${HEART_CAP} hearts is a Best Friend. With all six, every 150 more hearts is a Ribbon.`}>
        {Array.from({ length: 1 + TEAM_SIZE }, (_, i) => <i key={i} className={i < best ? 'on' : ''}>♥</i>)}
        <small>Best Friends</small>
      </div>
    </section>
  )
}

/** Version 22 (8): a Trainer level every 100 hearts across everything you own, with no last one, and three perks on the way. */
const PERKS22: { name: string; icon: string; at: number; text: string }[] = [
  { name: 'Pickup', icon: 'itemfinder', at: 10, text: 'On a day with a pillar your partner may find something: coins, a berry, a ball, a Rare Candy, a stone or a fossil.' },
  { name: 'Endure', icon: 'guard-spec', at: 100, text: 'One empty day in seven costs nothing.' },
  { name: 'Close bond', icon: 'soothe-bell', at: 300, text: '+10% XP every day.' },
]
function PerksV22({ game }: { game: Game }) {
  const t = game.trainer
  const bestFriends = [game.partner, ...game.queue, ...game.graduates].filter((m) => heartsOf(m) >= HEART_CAP).length
  const into = t.hearts - t.level * 100
  return (
    <section className="perks" aria-label="Trainer">
      <span className="k-label">Trainer level {t.level} · {t.hearts} ♥ across all your Pokemon</span>
      <Meter kind="gold" value={into} max={100} name={`Hearts to Trainer level ${t.level + 1}`} label={`${into} / 100 ♥ to level ${t.level + 1}`} size="lg" />
      <p className="muted">Every level adds 2% to your party's power for good, and pays a choice of two. There is no last level. {bestFriends > 0 ? `${bestFriends} Best Friend${bestFriends === 1 ? '' : 's'} so far.` : 'A Pokemon at 150 hearts is a Best Friend: it can hold a Mega Stone.'}</p>
      <ol className="perk-track">
        {PERKS22.map((p) => (
          <li key={p.name}>
            <button type="button" className={`perk-node ${t.hearts >= p.at ? 'on' : ''}`} title={p.text} aria-label={`${p.name}, at ${p.at} hearts${t.hearts >= p.at ? ', earned' : ''}: ${p.text}`}>
              <span className="perk-ico"><ItemIcon id={p.icon} size={24} /></span>
              <small>{t.hearts >= p.at ? '✓' : `${p.at}♥`}</small>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The partner's hearts as five steps, each unlocking something. */
export function BondPerks({ game }: { game: Game }) {
  if (game.v22) return <PerksV22 game={game} />
  if (game.tier.v21) return <PerksV21 game={game} />
  return <BondPerksOld game={game} />
}

function BondPerksOld({ game }: { game: Game }) {
  // version 16: the five perks are the trainer's, from every heart across every Pokemon; before it, the partner's
  const v16 = game.v16
  const bond = v16 ? game.trainer.level : bondLevel(heartsOf(game.partner))
  const steps: readonly number[] = v16 ? TRAINER_LEVELS : HEART_LEVELS
  // the hearts themselves are on the partner card above; here, one perk is told at a time: the next one, or the one tapped
  const [pick, setPick] = useState<number | null>(null)
  const shown = pick ?? Math.min(bond, BOND_PERKS.length - 1)
  const p = BOND_PERKS[shown]
  const on = hasPerk(bond, p)
  const rank = (q: BondPerk) => (v16 ? game.trainer.ranks[q] : 0)
  // every perk open: the road goes on in Trainer stars
  const starred = v16 && bond >= BOND_PERKS.length
  const fromLast = TRAINER_LEVELS[TRAINER_LEVELS.length - 1] + game.trainer.stars * STAR_EVERY
  return (
    <section className="perks" aria-label="Bond perks">
      <span className="k-label">{v16 ? `Trainer perks · ${game.trainer.hearts} ♥ across all your Pokemon` : `Bond perks with ${nameOf(game.partner.form)}`}</span>
      <ol className="perk-track">
        {BOND_PERKS.map((q, i) => (
          <li key={q}>
            <button type="button" className={`perk-node ${hasPerk(bond, q) ? 'on' : ''} ${i === shown ? 'sel' : ''}`} aria-pressed={i === shown} aria-label={`${PERK[q].name}, at ${steps[i]} hearts${hasPerk(bond, q) ? ', earned' : ''}`} onClick={() => setPick(i)}>
              <span className="perk-ico"><ItemIcon id={PERK[q].icon} size={24} /></span>
              <small>{hasPerk(bond, q) ? (rank(q) > 0 ? rankName(q, rank(q)).split(' ').pop() : '✓') : `${steps[i]}♥`}</small>
            </button>
          </li>
        ))}
      </ol>
      <p className="perk-say"><b>{v16 ? rankName(p, rank(p)) : PERK[p].name}</b> {on ? PERK[p].text(bond, rank(p)) : `At ${steps[shown]} hearts${v16 ? ' in all' : ''}: ${PERK[p].text(shown + 1)}`}</p>
      {starred && (
        <div className="perk-stars" title={`Every ${STAR_EVERY} hearts past ${TRAINER_LEVELS[TRAINER_LEVELS.length - 1]}: Collect offers two perks, and you rank one up (to ${['', 'I', 'II', 'III', 'IV', 'V', 'VI'][STAR_MAX + 1]}).`}>
          <span className="perk-star-ico" aria-hidden>★<i>{game.trainer.stars}</i></span>
          <span className="perk-star-txt">
            <b>Trainer star {game.trainer.stars + 1}</b>
            <Meter kind="gold" value={game.trainer.hearts - fromLast} max={STAR_EVERY} name={`Hearts to Trainer star ${game.trainer.stars + 1}`} label={`${game.trainer.hearts - fromLast} / ${STAR_EVERY} ♥`} size="lg" />
          </span>
        </div>
      )}
    </section>
  )
}

// ── what today did, in a row of chips ───────────────────────────────────────
export function TodayEffects({ game }: { game: Game }) {
  const t = game.today
  const chips: ReactNode[] = []
  if (t.max) chips.push(<span key="max" className="fxchip max">{game.tier.v21 ? `${t.max === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}: Max day ×${DAY_HIT_MULT[4]}` : t.max === 'gigantamax' ? `Gigantamax ×${GIGANTAMAX}` : `Dynamax ×${DYNAMAX}`}</span>)
  // version 21: a pillar back after idle days paid its comeback bonus
  for (const [tag, x] of Object.entries(game.tier.bounty)) chips.push(<span key={`bounty-${tag}`} className="fxchip find" data-tag={tag}>✦ {TAG_NAME[tag] ?? tag} bounty ×{x}</span>)
  if (t.crit) chips.push(<span key="crit" className="fxchip crit">Critical hit ×1.5</span>)
  for (const [tag, add] of Object.entries(t.boost ?? {})) chips.push(<span key={tag} className="fxchip boost" data-tag={tag}>{TAG_NAME[tag] ?? tag} +{pct(add ?? 0)}</span>)
  if (t.find) chips.push(<span key="find" className="fxchip find"><ItemIcon id={t.find} size={16} />Found {itemName(t.find)}</span>)
  if (game.guard) chips.push(<span key="guard" className="fxchip guard"><ItemIcon id="guard-spec" size={16} />On guard</span>)
  // version 16: what the signatures did today
  const st = game.sigToday
  if (game.v16 && st.charm > 0) chips.push(<span key="charm" className="fxchip sig"><ItemIcon id="pink-scarf" size={16} />Charm −{st.charm} HP</span>)
  if (game.v16 && st.insight > 0) chips.push(<span key="insight" className="fxchip sig"><ItemIcon id="twistedspoon" size={16} />Insight +{st.insight} research</span>)
  if (game.v16 && st.forage) chips.push(<span key="forage" className="fxchip sig"><ItemIcon id={st.forage} size={16} />Forage: {itemName(st.forage)}</span>)
  if (game.v16 && st.dream > 0) chips.push(<span key="dream" className="fxchip sig"><ItemIcon id="blackglasses" size={16} />Dream: {st.dream} ♥</span>)
  return chips.length ? <div className="fxchips">{chips}</div> : null
}

// ── battle prep: the day's X items, Dire Hits, the Guard Spec, Honey ────────
export function BattlePrep({ game }: { game: Game }) {
  if (!game.v13) return null
  const have = (id: string) => game.inv[id] ?? 0
  // version 18: an X item for a kind of work shelved in Life OS stays in the Bag but is out of the way here
  const boosts = Object.keys(BOOST).filter((id) => have(id) > 0 && !isShelved(game, BOOST[id].tag))
  const dires = Object.keys(DIRE_HIT).filter((id) => have(id) > 0)
  const bond = game.v16 ? game.trainer.level : bondLevel(heartsOf(game.partner))
  // version 21 has no Focus perk: a critical hit comes only from a Scope Lens or the day's Dire Hit
  const crit = (!game.tier.v21 && hasPerk(bond, 'focus') ? CRIT_BASE : 0) + (game.partner.held === 'scope-lens' ? 0.1 : 0)
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
        <div className="slot-grid prep" role="group" aria-label="Battle items">
          {items.map((id) => {
            const b = BOOST[id]
            const used = b ? (today[b.tag] ?? 0) >= b.add : id === 'guard-spec' ? game.guard : id === 'honey' ? Boolean(game.wish.chosen) : false
            const sub = b ? `${TAG_NAME[b.tag]} +${pct(b.add)}` : DIRE_HIT[id] ? `crit +${pct(DIRE_HIT[id])}` : id === 'guard-spec' ? (game.guard ? 'on guard' : 'empty day') : (game.wish.chosen ? 'coming' : 'rare next')
            // a thing is its icon and a number; what it does is a stamp, and the rest is in the tip (UI-AUDIT: battle prep on slots)
            const stamp = b ? `+${pct(b.add)}` : DIRE_HIT[id] ? 'crit' : undefined
            return (
              <Slot key={id} material="glass" className={b ? 'tagged' : ''} data-tag={b?.tag} on={used} disabled={used} onClick={() => use(id)}
                icon={<ItemIcon id={id} size={48} />} n={have(id)} stamp={stamp} aria-label={`${itemName(id)}: ${sub}${used ? ', in use' : ''}`}
                tip={{ title: itemName(id), note: <>{used ? 'In use' : sub} · {ITEMS[id]?.text}</> }} />
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
      <span className="facility-ico"><ItemIcon id={f.icon} size={48} /></span>
      <div className="facility-txt">
        <b>{f.name}</b>
        <small>{winLine(f)}</small>
        <Meter value={Math.min(reach, target)} max={target} kind={r.silver ? 'gold' : 'xp'} size="lg" name={`${f.name}: toward ${r.silver ? 'Gold' : 'Silver'}`} label={`${reach} / ${target} for ${r.silver ? 'Gold' : 'Silver'} · best ${r.best}`} />
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
  // version 18: a facility for a kind of work with no habit on the Life OS list waits out of sight until it has one again
  const going = FACILITIES.filter((f) => !won(f) && !isShelved(game, f.win)), done = FACILITIES.filter(won)
  return (
    <Win title="Battle Frontier" tone="purple" aside={<><BpIcon size={22} /> {game.wallet.bp.toLocaleString('en-IN')} BP · {symbols} / 14 Symbols</>}>
      {!game.v13 ? <p className="muted">{opens}</p> : (
        <>
          {going.length > 0 && <div className="facilities">{going.map((f) => <FacilityCard key={f.id} f={f} game={game} />)}</div>}
          {done.length > 0 && (
            <div className="facility-done-row" aria-label="Both Symbols won">
              <span className="k-label">Both Symbols won</span>
              {done.map((f) => <span key={f.id} className="facility-chip" title={`${f.name}: best run ${game.frontier.find((x) => x.id === f.id)!.best}`}><ItemIcon id={f.icon} size={24} />{f.name.replace('Battle ', '')}</span>)}
            </div>
          )}
        </>
      )}
    </Win>
  )
}

// ── Legend quests ───────────────────────────────────────────────────────────
// (UI-AUDIT-2026-11-04 T20) each key is a card of its legend: a silhouette until it is caught, the key in one corner
// (lit when you hold it), what earns the key in the other (the Symbol or the BP, lit once it is won or within reach).
// Use shows only under a key that can be used now; tap a card for where its key comes from.
const KEY_FROM: Record<string, Facility> = Object.fromEntries(FACILITIES.map((f) => [f.goldKey, f]))
export function LegendWin({ game }: { game: Game }) {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const boxes = useBoxes()
  const keys = Object.entries(LEGEND_KEYS)
  const caught = (form: string) => Boolean(game.dex[form]?.own)
  const held = keys.filter(([id]) => (game.inv[id] ?? 0) > 0)
  const legends = keys.flatMap(([, k]) => k.forms)
  const have = legends.filter(caught).length
  const shown = all ? keys : [...held, ...keys.filter(([id]) => !(game.inv[id] ?? 0)).slice(0, Math.max(0, 6 - held.length))]
  const where = (id: string) => (KEY_FROM[id] ? `Gold Symbol at the ${KEY_FROM[id].name}` : `BP Exchange, ${LEGEND_KEY_BP} BP`)
  const met = (id: string) => (KEY_FROM[id] ? Boolean(game.frontier.find((x) => x.id === KEY_FROM[id].id)?.gold) : game.wallet.bp >= LEGEND_KEY_BP)
  const sel = shown.find(([id]) => id === open)
  return (
    <Win title="Legend quests" tone="gold" aside={`${have} / ${legends.length} legends`}>
      {!game.v13 ? <p className="muted">{opens}</p> : (
        <>
          <div className="legend-cards">
            {shown.map(([id, k]) => {
              const n = game.inv[id] ?? 0
              const form = k.forms.find((f) => !caught(f)) ?? k.forms[0]
              const done = k.forms.every(caught)
              const known = Boolean(game.dex[form])
              const usable = n > 0 && !game.wish.chosen
              return (
                <div key={id} className="legend-slot">
                  <ObjCard className={`legendcard ${caught(form) ? '' : 'shadow'} ${open === id ? 'picked' : ''}`} metal={n > 0 ? 'gold' : done ? 'elite' : 'locked'}
                    tc={known ? typeColor(SPECIES[form].t) : undefined}
                    art={<CropSprite src={still(form)} box={boxes?.[form]} />}
                    corners={{
                      tl: <span className={`legend-key ${n ? 'lit' : ''}`}><ItemIcon id={id} size={16} /></span>,
                      tr: <span className={`legend-req ${met(id) ? 'lit' : ''}`}>{KEY_FROM[id] ? <ItemIcon id={KEY_FROM[id].icon} size={16} /> : <BpIcon size={16} />}</span>,
                      trTitle: where(id),
                      ...(k.forms.length > 1 ? { top: <span className="legend-more">+{k.forms.length - 1}</span> } : {}),
                    }}
                    banner={known ? nameOf(form) : '???'} gold={n > 0}
                    aria-pressed={open === id} aria-label={`${k.name}: ${k.forms.map((f) => (game.dex[f] ? nameOf(f) : 'unknown legend')).join(' or ')}${done ? ', caught' : ''}${n ? `, you hold ${n}` : ''}. ${where(id)}`}
                    onClick={() => { setOpen(open === id ? null : id); play('tap') }} />
                  {usable && <button type="button" className="pill-btn gold legend-use" onClick={() => { useItem(id, '', 'summon'); play('catch') }}>Use{n > 1 ? ` ×${n}` : ''}</button>}
                </div>
              )
            })}
          </div>
          {sel && <p className="legend-where"><ItemIcon id={sel[0]} size={24} /><span><b>{sel[1].name}</b> · {sel[1].forms.map((f) => (game.dex[f] ? nameOf(f) : '???')).join(' / ')} · {where(sel[0])}{game.wish.chosen && (game.inv[sel[0]] ?? 0) > 0 ? ` · ${nameOf(game.wish.chosen)} is coming next first` : ''}</span></p>}
          <button type="button" className="pill-btn legend-all" onClick={() => setAll(!all)}>{all ? 'Fewer' : `All ${keys.length} keys`}</button>
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
  const wants = game.v14 ? collectorWants(today) : []
  // the treasures as the Bag's slots, the wanted ones first; tap them in, and the total counts up (UI-AUDIT-2026-11-04 T10)
  const held = [...loot].sort((x, y) => Number(wants.includes(y)) - Number(wants.includes(x)))
  const missing = wants.filter((id) => !loot.includes(id))
  const [picked, setPicked] = useState<string[]>([])
  const pick = picked.filter((id) => loot.includes(id))
  const sel = pick.length ? pick : loot
  const total = sel.reduce((n, id) => n + price(id) * (game.inv[id] ?? 0), 0)
  const toggle = (id: string) => { setPicked(pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]); play('tap') }
  const sell = () => { for (const id of sel) useItem(id, '', 'sell', String(game.inv[id])); setPicked([]); play('buy') }
  return (
    <Win title="The Collector" tone="gold" aside={<><Coin size={22} /> {game.wallet.coins.toLocaleString('en-IN')}</>}>
      {loot.length === 0 && missing.length === 0 ? <p className="muted">Nothing to sell yet. From bond level 1, Pickup finds treasures on days with a pillar.</p> : (
        <>
          <div className="slot-grid collector" role="group" aria-label={wants.length ? `Your treasures; the ones marked ×${COLLECTOR_MULT} are wanted today` : 'Your treasures'}>
            {held.map((id) => {
              const n = game.inv[id] ?? 0, want = wants.includes(id)
              return (
                <Slot key={id} material="glass" className={pick.includes(id) ? 'picked' : ''} icon={<ItemIcon id={id} size={48} />} n={n > 1 ? n : undefined}
                  stamp={want ? `×${COLLECTOR_MULT}` : undefined} aria-pressed={pick.includes(id)}
                  aria-label={`${itemName(id)}, ${n}: ${(price(id) * n).toLocaleString('en-IN')} coins${want ? ', wanted today' : ''}`}
                  tip={{ title: `${itemName(id)} ×${n}`, note: `${price(id).toLocaleString('en-IN')} each${want ? ' today' : ''}` }} onClick={() => toggle(id)} />
              )
            })}
            {missing.map((id) => (
              <Slot key={id} as="span" material="glass" className="want" icon={<ItemIcon id={id} size={48} />} stamp={`×${COLLECTOR_MULT}`}
                tip={{ title: itemName(id), note: `Wanted today; you have none` }} aria-label={`${itemName(id)}: wanted today, you have none`} />
            ))}
          </div>
          {loot.length > 0 && (
            <div className="collector-sum">
              <span className="collector-total" aria-live="polite"><Coin size={24} /><b><Count value={total} /></b><small>{pick.length ? `${pick.length} picked` : 'everything'}</small></span>
              <button type="button" className="k-btn main" onClick={sell}>Sell</button>
            </div>
          )}
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
              <ItemIcon id={id} size={48} />
              <img src={still(form)} alt="" width={44} height={44} className={`sprite ${game.dex[form]?.own ? '' : 'unseen'}`} />
              <span><b>{itemName(id)}{n ? ` ×${n}` : ''}</b><small>{game.dex[form] ? nameOf(form) : '???'}</small></span>
              {n > 0 && <button type="button" className="pill-btn gold" disabled={game.wallet.coins < REVIVE_COST} onClick={() => { useItem(id, '', 'fossil'); play('catch') }}>Revive</button>}
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
  const candy = (game.inv['rare-candy'] ?? 0) > 0 && canCandy(game, m.uid, game.today.day)
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
              return <button key={v} type="button" className="pill-btn" disabled={full} onClick={() => { useItem(v, m.uid, 'vitamin'); play('feed') }} title={ITEMS[v].text}><ItemIcon id={v} size={24} />{itemName(v)} ({m.vits?.[tag] ?? 0}/{VITAMIN_MAX})</button>
            })}
          </div>
          {game.partner.uid !== m.uid && given.length > 0 && <small className="muted">{game.v14 ? `Vitamins count in full while this Pokemon is your partner, and a third while it stands in the party${game.team.some((x) => x.uid === m.uid) ? ' (it does now)' : ''}.` : 'Vitamins count while this Pokemon is your partner.'}</small>}
        </div>
      )}
      {(evos.length > 0 || candy) && (
        <div className="kit-row">
          {evos.map(({ item, form }) => <button key={item} type="button" className="pill-btn gold" onClick={() => { useItem(item, m.uid, 'evolve', form); play('catch'); onDone() }}><ItemIcon id={item} size={24} />{itemName(item)}: into {nameOf(form)}</button>)}
          {candy && <button type="button" className="pill-btn green" onClick={() => { useItem('rare-candy', m.uid, 'candy'); play('feed') }}><ItemIcon id="rare-candy" size={24} />Rare Candy (Lv {levelOf(m.xp)} → {levelOf(m.xp) + 1})</button>}
        </div>
      )}
    </div>
  )
}
