import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from 'react'
import { isGym, leaderOf, nameOf, spritePath, type Game, type Mon, type Moment } from '../core/fold.ts'
import type { DayFacts, HabitFact } from '../core/facts.ts'
import { LEAGUES, lineup } from '../core/gyms.ts'
import {
  ADVANTAGE_MULT, GEMS, SEASON_STEP, BALL_MULT, BALL_NAME, GAME_START, GRADUATES_PER_REGION, LEADER_HP, MOMENTUM_WINDOW,
  CLAIM_AUTO, EGG_STEPS, SLEEP_HABIT, bondLevel, HEART_LEVELS, LEGENDARY_EVERY_WILD, PAY_STREAK, REGIONS, REPEL_DAYS, SHINY_ODDS, SHINY_ODDS_WORN, SLEEP_AFTER, SLIP, STAKES_FROM, STEPS_GOAL, TEAM_SIZE, WILD_STAY, TIER_XP, WEAK_MULT, evolveAt, graduateAt, xpForLevel,
} from '../core/rules.ts'
import { BERRY_HEARTS, MARKS, EGG_STEPS_OLD_CHARM, BOND_PARTY, BOND_STEP, MASTERY_MAX, MASTERY_STEP, SELL, itemName as econName, masteryCost } from '../core/economy.ts'
import { CRIT_MULT, DYNAMAX, GIGANTAMAX, LEVEL_POWER, MAX_LEVEL, MEGA_BONUS, MEGA_BOND, RESEARCH_SLOTS, RESEARCH_WILD, RESEARCH_WILD_MAX, TEAM_BONUS, TEAM_LEVEL, TEAM_NATURE, type Tag as TagKind } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { Ball, KeyStone } from './Ball.tsx'
import { FeatsWin } from './Feats.tsx'
import { SleepWin } from './Sleep.tsx'
import type { SleepNight } from '../core/events.ts'
import { ItemIcon } from './Item.tsx'
import { KBar, KPill, KRibbon } from './Kit.tsx'
import { Actions, Coin, Count, Gem, Pop, Quests, ShopTab, TeamTab } from './Play.tsx'
import { Recap } from './Recap.tsx'
import { BossLog, BossTile } from './Boss.tsx'
import { fitOf, useBoxes } from './Fit.tsx'
import { Calendar } from './screens/Calendar.tsx'
import { HpBar } from './screens/HpBar.tsx'
import { hpTone } from './screens/hp.ts'
import { typeColor } from './screens/types.ts'
import { Sheet } from './screens/Sheet.tsx'
import { Tour } from './screens/Tour.tsx'
import { TOUR_KEY, shouldTour } from './screens/tour.ts'
import { SeasonRoad } from './Road.tsx'
import { BattlePrep, BondPerks, FrontierWin, LegendWin, TodayEffects } from './Champion.tsx'
import { FACILITIES } from '../core/frontier.ts'
import { BOSS_HEAL, KILL_CAP, THROWS, THROW_AT } from '../core/boss.ts'
import { KIT_SHARD_EVERY } from '../core/rules.ts'
import { CollectButton } from './Claim.tsx'
import { Toasts } from './Toasts.tsx'
import { FeedSheet, treatsIn } from './Feed.tsx'
import { aBall, badgeArt, badgeName, fmtDay, leagueName, still } from './lib/art.ts'
import { play, setSoundOn, soundOn } from './lib/sfx.ts'
import { LIFEOS_URL, start, useItem, useView } from './lib/store.ts'
import { FIXTURE } from './lib/fixture-boot.ts'
import { dropIn, floatNote, hit, lunge, party, react, ring, stamp, tapPop } from './lib/fx.ts'
import { Sky, skyVars, sleepFor, useClock } from './screens/Sky.tsx'
import { ChestOpener, HatchOpener } from './Reveal.tsx'

type Tab = 'partner' | 'team' | 'shop' | 'dex' | 'trainer'
const TABS: [Tab, string][] = [['partner', 'Today'], ['team', 'Party'], ['shop', 'Shop'], ['dex', 'Pokedex'], ['trainer', 'Journey']]
export const TAG_NAME: Record<string, string> = { code: 'Code', fitness: 'Gym', guitar: 'Guitar', arbor: 'Arbor', sleep: 'Sleep', routine: 'Routine', balanced: 'Balance', health: 'Health tracker' }
const weekday = (day: string, len: 1 | 3 = 1) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: len === 1 ? 'narrow' : 'short' })
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
export const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`
const dexNo = (n: number) => String(n).padStart(3, '0')
const itemName = (item: string): string => econName(item)
const RARITY: Record<string, string> = { C: 'Common', U: 'Uncommon', R: 'Rare', L: 'Legendary' }
/** Badges won so far, across every league. */
const badgesWon = (game: Game): number =>
  LEAGUES.reduce((n, l, i) => n + (i < game.league.index ? l.gyms.length : i === game.league.index ? Math.min(game.league.slot, l.gyms.length) : 0), 0)

function Sprite({ form, shiny, size, className = '' }: { form: string; shiny?: boolean; size: number; className?: string }) {
  return <img src={spritePath(form, shiny)} alt="" width={size} height={size} className={`sprite ${className}`} style={{ width: size, height: size }} />
}

export type Tone = '' | 'blue' | 'green' | 'gold' | 'dark' | 'red' | 'purple'
/** A section of a tab: a heading on the page (a coloured mark, the title, a note on the right) and its content under it.
    No frame: the content stands on the page, and only the things you press look like objects. */
export function Win({ title, aside, tone = '', fold, children }: { title: string; aside?: ReactNode; tone?: Tone; fold?: boolean; children: ReactNode }) {
  // `fold`: shut until tapped, for a store that grows (the Bag, My Pokemon) so the tab around it stays short
  if (fold) {
    return (
      <details className="sec drawer" data-tone={tone || 'dark'}>
        <summary className="sec-h"><i className="sec-mark" aria-hidden /><h2>{title}</h2>{aside !== undefined && <span className="sec-aside">{aside}</span>}<i className="chev" aria-hidden /></summary>
        <div className="sec-b">{children}</div>
      </details>
    )
  }
  return (
    <section className="sec" data-tone={tone || 'dark'}>
      <header className="sec-h"><i className="sec-mark" aria-hidden /><h2>{title}</h2>{aside !== undefined && <span className="sec-aside">{aside}</span>}</header>
      <div className="sec-b">{children}</div>
    </section>
  )
}

/** An egg, drawn here pixel by pixel (no artwork is borrowed for it). */
function Egg() {
  return <img className="egg pix" src="/sprites/items/mystery-egg.png" width={72} height={72} alt="An egg" draggable={false} />
}

// ── Partner: the battle screen ──────────────────────────────────────────────
const stateOf = (h: HabitFact): 'done' | 'part' | 'none' => (h.frac >= 1 ? 'done' : h.frac > 0 ? 'part' : 'none')
const label = (h: HabitFact): string => h.name?.trim() || TAG_NAME[h.tag] || h.id

function Scene({ game }: { game: Game }) {
  const { partner, today, wild } = game
  const xpBar = useRef<HTMLDivElement>(null)
  const lastXp = useRef(game.into)
  // the bar flashes when XP lands while you are looking at it
  useEffect(() => {
    if (game.into > lastXp.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const el = xpBar.current
      el?.classList.remove('reward-pulse')
      void el?.offsetWidth
      el?.classList.add('reward-pulse')
    }
    lastXp.current = game.into
  }, [game.into])
  // ── battle feel: what just happened is played on the sprite it happened to ──
  const stage = useRef<HTMLElement>(null)
  const was = useRef<{ wild: string | null; hit: number; caught: boolean; perfect: boolean } | null>(null)
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const foe = el.querySelector('.foe-pad img.sprite')
    const now = { wild: wild ? wild.form : null, hit: today.hit, caught: Boolean(wild?.caught), perfect: today.perfect }
    const prev = was.current
    was.current = now
    if (!prev) { dropIn(el.querySelector('.me-pad img.sprite')); return } // sent out as the screen opens
    if (now.wild && now.wild !== prev.wild && !now.caught) dropIn(foe, wild?.rarity === 'L')
    else if (now.hit > prev.hit && !now.caught) { lunge(el.querySelector('.me-pad img.sprite')); window.setTimeout(() => hit(foe), 110) }
    if (now.caught && !prev.caught) { stamp(el, 'GOTCHA!', 'gold'); ring(el.querySelector('.foe-pad')); if (wild?.shiny) party(el) }
    if (now.perfect && !prev.perfect) { stamp(el, 'PERFECT DAY', 'green'); party(el, 36) }
  }, [wild?.form, wild?.caught, today.hit, today.perfect])
  // the sky follows the clock, and the weather follows last night's sleep
  const minutes = useClock()
  const score = sleepFor(game.sleep.state === 'measured' ? game.sleep.score : null)
  // tapping a Pokemon: it answers, nothing is earned
  const taps = useRef({ me: 0, foe: 0, at: 0 })
  const pat = (who: 'me' | 'foe') => {
    const t = taps.current
    if (Date.now() - t.at < 450) return
    t.at = Date.now()
    const pad = stage.current?.querySelector(who === 'me' ? '.me-pad' : '.foe-pad')
    const img = pad?.querySelector('img.sprite')
    play('tap')
    if (who === 'me') react(img, pad, t.me++, { shiny: partner.shiny, asleep: game.asleep })
    else { void img?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-12px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260, easing: 'ease-out' }) }
  }
  const press = (who: 'me' | 'foe') => (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pat(who) } }
  const pct = clamp01(game.into / game.need)
  const before = Math.min(pct, clamp01(game.intoBeforeToday / game.need))
  return (
    <section ref={stage} className={`scene ${game.theme} ${game.aura ? `aura-${game.aura}` : ''}`} style={skyVars(minutes, game.theme)} aria-label="Today, as a battle">
      <Sky minutes={minutes} theme={game.theme} score={score} />
      {wild && (
        <>
          <div className="hpbox foe-box">
            <div className="hp-top">
              <span className="hp-name">{wild.caught ? nameOf(wild.form) : `Wild ${nameOf(wild.form)}`}{wild.shiny && <span className="chip">shiny</span>}{wild.rarity !== 'C' && <span className={`chip r-${wild.rarity}`}>{RARITY[wild.rarity]}</span>}</span>
              <span className="hp-lv ballname"><Ball ball={today.ball} size={18} />{wild.caught ? 'Caught' : BALL_NAME[today.ball]}</span>
            </div>
            <HpBar variant="game" value={wild.hp} max={wild.max} name="The wild Pokemon" />
            <div className="hp-sub"><span>{wild.caught ? 'In My Pokemon' : today.hit > 0 ? `Today −${today.hit}` : ''}{!wild.caught && wild.leavesIn !== undefined && wild.leavesIn <= 3 && <b className="leaving"> {wild.leavesIn === 0 ? 'Gets away tomorrow' : `Gets away in ${wild.leavesIn + 1} days`}</b>}</span><b>{wild.hp} / {wild.max}</b></div>
          </div>
          <div className="pad foe-pad" role="button" tabIndex={0} aria-label={`Poke the wild ${nameOf(wild.form)}`} onClick={() => pat('foe')} onKeyDown={press('foe')}>
            <img src={still(wild.form, wild.shiny)} alt="" width={104} height={104} className={`sprite ${wild.caught ? 'got' : ''}`} />
            {wild.caught && <Ball ball={today.ball} size={34} className="caughtball" />}
            {!wild.caught && <Pop value={today.hit} />}
          </div>
        </>
      )}
      <div className="pad me-pad" role="button" tabIndex={0} aria-label={`Pat ${nameOf(game.display)}`} onClick={() => pat('me')} onKeyDown={press('me')}>
        {/* a perfect day: a Gigantamax form when it has one, else it Dynamaxes (the same Pokemon, giant, glowing red) */}
        <Sprite form={game.display} shiny={partner.shiny} size={184} className={`${game.asleep ? 'asleep' : ''} ${game.aura === 'gmax' && game.display === partner.form ? 'dynamax' : ''}`} />
        {game.asleep && <span className="zzz" aria-hidden>Zzz</span>}
      </div>
      <div className="hpbox me-box">
        <div className="hp-top">
          <span className="hp-name">
            {nameOf(game.display)}
            {partner.shiny && <span className="chip">shiny</span>}
            {game.aura === 'mega' && <span className="chip mega">mega</span>}
            {game.aura === 'gmax' && <span className="chip gmax">{game.display === partner.form ? 'dynamax' : 'g-max'}</span>}
          </span>
          <span className="hp-lv">Lv{game.level}</span>
        </div>
        <div className="hp-row">
          <b>EXP</b>
          <div ref={xpBar} className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={game.need} aria-valuenow={Math.round(game.into)} aria-valuetext={`${Math.round(game.into)} of ${game.need} XP, ${Math.round(game.into - game.intoBeforeToday)} of it earned today`} aria-label="Progress to the next level">
            <i className="base" style={{ width: `${before * 100}%` }} />
            <i className="today" style={{ width: `${(pct - before) * 100}%` }} />
          </div>
        </div>
        <div className="hp-sub">
          <span><span className="key" />banked <span className="key today" style={{ marginLeft: 8 }} />today <b>+{today.xp}</b></span>
          <b>{Math.round(game.into)} / {game.need}</b>
        </div>
      </div>
    </section>
  )
}

/** A pillar's picture: the mark its kind of work pays, or the journal for one with no mark. */
const pillarIcon = (tag: string): string => (MARKS as Record<string, { icon: string }>)[tag]?.icon ?? 'journal'

/** Under the scene: what the partner says about today, how close a perfect day is, and the pillars as rings that fill. */
function Talk({ game, pillars, sleepH }: { game: Game; pillars: HabitFact[]; sleepH?: HabitFact }) {
  const { today, wild } = game
  const me = nameOf(game.display)
  const left = today.total - today.done
  const next = pillars.find((h) => h.frac < 1)
  const say: ReactNode = wild?.caught ? <>Gotcha! {nameOf(wild.form)} was caught!</>
    : game.fled ? <>The wild {nameOf(game.fled)} got away. A new one is here.</>
    : game.asleep ? <>{me} is dozing.</>
    : next ? <>Next: <em>{label(next)}</em> · {Math.round(next.worth * (1 - next.frac))} XP</>
    : pillars.length ? <>Every pillar is done today!</>
    : <>What will {me} do today?</>
  const share = today.total > 0 ? today.done / today.total : 0
  // Sleep as a ring: a measured night is one of the pillars already; otherwise its habit gets a ring of its own
  const showSleep = game.sleep.state !== 'measured' && Boolean(sleepH || game.sleep.band)
  const sleepDone = Boolean(sleepH && sleepH.frac >= 1)
  return (
    <section className="dayboard" aria-label="Today's habits">
      <div className="say2" aria-live="polite">
        <p>{say}</p>
        {today.total > 0 && (
          <div className="perfect" title={left ? `${left} left for a perfect day, which catches the wild Pokemon on the spot` : 'A perfect day'}>
            <span className="perfect-track" role="progressbar" aria-valuemin={0} aria-valuemax={today.total} aria-valuenow={today.done} aria-label="Habits ticked today"><i style={{ width: `${share * 100}%` }} /></span>
            <b>{left ? <>{today.done} of {today.total} · <span>{left} to a perfect day</span></> : 'Perfect day!'}</b>
          </div>
        )}
      </div>
      <ul className="pillars">
        {pillars.map((h) => {
          const st = stateOf(h)
          return (
            <li key={h.id} className={`pillar ${st}`} data-tag={h.tag} style={{ ['--p' as string]: h.frac }} title={`${label(h)}: ${Math.round(h.worth * h.frac)} of ${h.worth} XP`}>
              <span className="pillar-ring"><ItemIcon id={pillarIcon(h.tag)} size={30} />{st === 'done' && <i className="pillar-tick" aria-hidden />}</span>
              <b>{h.tag === 'sleep' ? 'Sleep' : label(h)}</b>
              <small>{st === 'done' ? 'Done' : st === 'part' ? `${Math.round(h.frac * 100)}%` : `${h.worth} XP`}</small>
            </li>
          )
        })}
        {/* Sleep is always on the board while its habit is on today's list. With a band it is a pillar paid by last night's score; until the reading arrives it waits here (never a miss); with no band it is a habit ticked by hand */}
        {showSleep && (
          <li className={`pillar ${sleepDone ? 'done' : 'waiting'}`} data-tag="sleep" title={game.sleep.band ? "Last night's reading has not arrived. The band syncs about 07:00; a night with no reading is never a zero." : 'No band yet: tick Sleep by hand in Life OS. With a band it is paid by last night\'s score, and a good night pays Bells.'}>
            <span className="pillar-ring"><ItemIcon id={pillarIcon('sleep')} size={30} />{sleepDone && <i className="pillar-tick" aria-hidden />}</span>
            <b>Sleep</b>
            <small>{sleepDone ? 'Done' : game.sleep.band ? 'Waiting for the band' : `No band · ${sleepH?.worth ?? 30} XP`}</small>
          </li>
        )}
        {pillars.length === 0 && !showSleep && <li className="muted">No pillar habits are on today's list.</li>}
      </ul>
      <a className="lifeos-link" href={LIFEOS_URL} target="_blank" rel="noreferrer">Tick habits in Life OS <span aria-hidden>↗</span></a>
    </section>
  )
}

/** The pace of things: the week's momentum as seven dots and the bonus they make (3 days with two pillars x1.2, 5 x1.35, 7 x1.5), and how far the partner is from its next change. */
function Pace({ game }: { game: Game }) {
  const { momentum } = game
  const prev = game.days.slice(-(MOMENTUM_WINDOW + 1), -1)
  const missing = MOMENTUM_WINDOW - prev.length
  const toLevel = Math.max(0, Math.ceil(xpForLevel(game.next.level) - game.partner.xp))
  return (
    <div className="pace">
      <div className="pace-cell" title="Days with two pillars in the last seven: 3 make XP x1.2, 5 x1.35, 7 x1.5. It slides back a day at a time, never resets.">
        <span className="k-label">Momentum</span>
        <span className="pace-week" aria-label={`${momentum.days} of the last 7 days counted`}>
          {Array.from({ length: MOMENTUM_WINDOW }, (_, i) => {
            const d = prev[i - missing]
            return <i key={i} className={d?.counts ? 'on' : d ? 'off' : 'none'} title={d ? `${fmtDay(d.day)}: ${d.pillars} of ${d.pillarTotal} pillars` : 'before the game began'} />
          })}
          <i className={`now ${game.today.counts ? 'on' : ''}`} title="Today" />
        </span>
        <b className="pace-big">×{momentum.mult}</b>
      </div>
      <div className="pace-cell">
        <span className="k-label">{game.next.what === 'evolve' ? 'Evolves' : game.next.what === 'master' ? 'Level 100' : 'Fully trained'} at Lv {game.next.level}</span>
        <b className="pace-big">{toLevel.toLocaleString('en-IN')}<small> XP to go</small></b>
      </div>
    </div>
  )
}

/** The partner, as the Party tab's hero: on a plinth against its type's colour, with its level, its line ahead, and the bond. Tap it for its page. */
function Summary({ game, onOpen }: { game: Game; onOpen?: () => void }) {
  const { partner } = game
  const rec = SPECIES[partner.form]
  const toGo = Math.max(0, xpForLevel(game.next.level) - Math.round(partner.xp))
  const hearts = (partner.together ?? 0) + (partner.fed ?? 0)
  const bond = bondLevel(hearts)
  const nextAt = HEART_LEVELS[bond]
  // version 14: treats first, since a berry is also bait; and feeding opens a choice of who
  const berry = game.v14 ? treatsIn(game)[0] : Object.keys(BERRY_HEARTS).find((b) => (game.inv[b] ?? 0) > 0)
  const [feeding, setFeeding] = useState(false)
  // what it may become: by what you have done most, when that is known; else every form it can take
  const ahead = game.lean.length > 0 ? game.lean.slice(0, 3).map((x) => ({ form: x.form, note: `${x.pct}% ${TAG_NAME[x.tag] ?? x.tag}` })) : (rec.e ?? []).slice(0, 3).map((f) => ({ form: f, note: '' }))
  return (
    <>
      <section className="hero" style={{ ['--tc' as string]: typeColor(rec.t) }} aria-label="Your partner">
        <button type="button" className="hero-stage" onClick={onOpen} aria-label={`${nameOf(game.display)}: open its page`}>
          <span className="hero-glow" aria-hidden />
          <span className="hero-plinth" aria-hidden />
          <img src={spritePath(game.display, partner.shiny)} alt="" className="sprite" />
        </button>
        <div className="hero-info">
          <span className="k-label">Your partner · No. {dexNo(rec.d)}</span>
          <h2 className="hero-name">
            {nameOf(game.display)}
            {partner.shiny && <span className="tagchip shiny">Shiny</span>}
            {game.aura === 'mega' && <span className="tagchip mega">Mega</span>}
            {game.aura === 'gmax' && <span className="tagchip gmax">G-Max</span>}
          </h2>
          <div className="hero-types">
            {[rec.t, rec.t2].filter(Boolean).map((t) => <span key={t} className="typechip" style={{ ['--tc' as string]: typeColor(t) }}><img src={`/sprites/types/${t}.png`} alt="" width={14} height={14} />{t}</span>)}
            <span className="hero-met">{partner.origin === 'starter' ? 'Starter' : partner.origin === 'egg' ? 'Hatched' : 'Caught'} {fmtDay(partner.from)}</span>
          </div>
          <div className="hero-lv">
            <b>Lv {game.level}</b>
            <KBar value={Math.round(game.into)} max={game.need} ready={toGo === 0} label={`${Math.round(game.into)} / ${game.need}`} />
          </div>
          <div className="hero-line" aria-label="Its line">
            {partner.path.map((f) => <img key={f} src={still(f, partner.shiny)} alt={nameOf(f)} title={nameOf(f)} width={40} height={40} className={`sprite ${f === partner.form ? 'now' : 'past'}`} />)}
            {ahead.length > 0 && (
              <>
                <span className="hero-next">Lv {game.next.level}</span>
                {ahead.map((x) => (
                  <span key={x.form} className="hero-ahead" title={game.dex[x.form] ? nameOf(x.form) : 'Not seen yet'}>
                    <img src={still(x.form, partner.shiny)} alt="" width={40} height={40} className={`sprite ${game.dex[x.form] ? '' : 'unseen'}`} />
                    {x.note && <small>{x.note}</small>}
                  </span>
                ))}
              </>
            )}
            {ahead.length === 0 && <span className="hero-next">{game.next.what === 'master' ? 'Level 100' : 'Fully trained'} at Lv {game.next.level}</span>}
          </div>
          <div className="hero-bond" title={`A heart for each pillar done while it is your partner, and more for each berry. At ${HEART_LEVELS.join(', ')} hearts the bond steps up: +${Math.round(BOND_STEP * 100)}% to every strike each, and a perk. It only ever counts up.`}>
            <span className="hero-hearts" aria-label={`Bond level ${bond} of ${HEART_LEVELS.length}`}>{HEART_LEVELS.map((_, i) => <img key={i} src="/sprites/items/heart-scale.png" width={22} height={22} alt="" className={`pix ${i < bond ? 'on' : ''}`} />)}</span>
            <span className="hero-bondtxt"><b>{hearts} ♥</b>{nextAt ? ` · ${nextAt - hearts} to bond ${bond + 1}` : ' · full bond'}</span>
            <button type="button" className="hero-feed" disabled={!berry} onClick={() => { if (game.v14) setFeeding(true); else { useItem(berry!, '', 'feed'); play('feed') } }} title={berry ? (game.v14 ? 'Feed a Pokemon: choose who and what' : `Feed it: ${econName(berry)}`) : 'No berries: the Mart and the Garden sell them'}><ItemIcon id={berry ?? 'oran-berry'} size={24} />Feed{berry ? <i>{game.inv[berry]}</i> : null}</button>
          </div>
          {feeding && <FeedSheet game={game} onClose={() => setFeeding(false)} />}
        </div>
      </section>
      {game.v13 && <BondPerks game={game} />}
      {game.asleep && <p className="notice warn">Dozing after two days without a pillar. Finish one pillar to wake it. Nothing finished is lost{game.today.day >= STAKES_FROM ? '; a day with nothing ticked also costs what is still in progress (see How it works)' : `. From ${fmtDay(STAKES_FROM)} a day with nothing ticked also costs what is still in progress`}.</p>}
      {game.aura === 'mega' && <p className="notice good">{partner.megas?.length ? 'Mega form: registered for good. Choose which form shows in Choices.' : 'Mega form: full momentum and every pillar done today.'}</p>}
      {game.aura === 'gmax' && <p className="notice gmax">{game.display === partner.form ? 'Perfect day: Dynamaxed for today, every strike ×2.' : 'Perfect day: Gigantamax for today, every strike ×2.5.'}</p>}
    </>
  )
}

const pct = (x: number): string => `${Math.round(x * 100)}%`
/** Everything that raises a strike, added: what applies to all work, then what applies to one kind of work. The sum is applied once. */
function PowerLine({ game }: { game: Game }) {
  const { power } = game
  const common = power.team + power.bond + power.mega + power.item + power.level
  const parts: [string, number][] = [['Level', power.level], ['Team', power.team], ['Bond', power.bond], ['Mega', power.mega], ['Life Orb', power.item]]
  const kinds = (Object.keys(power.domain) as TagKind[]).map((t) => [t, power.domain[t]] as const).filter(([, d]) => d.held + d.mastery + d.nature + d.vitamin > 0)
  return (
    <div className="power" aria-label="What raises a strike">
      <span className="chip" title={parts.filter(([, v]) => v > 0).map(([n, v]) => `${n} +${pct(v)}`).join(' · ') || 'Nothing yet: a team, a bond level or a Mega adds here'}>All work +{pct(common)}</span>
      {kinds.map(([t, d]) => (
        <span key={t} className="chip" data-tag={t} title={[['Held item', d.held], ['Mastery', d.mastery], ['Natures on the team', d.nature], ['Vitamins', d.vitamin]].filter(([, v]) => (v as number) > 0).map(([n, v]) => `${n} +${pct(v as number)}`).join(' · ')}>{TAG_NAME[t]} +{pct(d.held + d.mastery + d.nature + d.vitamin)}</span>
      ))}
      <small className="muted">all added together, once</small>
    </div>
  )
}

/** Who is up in the league, with their HP: worn down by the kind of work you do. */
function LeaderCard({ game }: { game: Game }) {
  const { league } = game
  const t = leaderOf(league.index, league.slot)
  if (!t) return <Win title="League" tone="gold" aside="All beaten"><p className="muted">Every league is beaten.</p></Win>
  const l = LEAGUES[league.index]
  return <LeaderBody game={game} t={t} l={l} />
}
function LeaderBody({ game, t, l }: { game: Game; t: NonNullable<ReturnType<typeof leaderOf>>; l: (typeof LEAGUES)[number] }) {
  const { league, today } = game
  // the leader flinches when today's strike lands
  const row = useRef<HTMLDivElement>(null)
  const lastStrike = useRef(today.strike)
  useEffect(() => {
    if (today.strike > lastStrike.current) { hit(row.current?.querySelector('.foe'), 'left'); floatNote(row.current, `−${today.strike - lastStrike.current}`, 'red') }
    lastStrike.current = today.strike
  }, [today.strike])
  const role = isGym(league.index, league.slot) ? `Gym ${league.slot + 1} of ${l.gyms.length}` : league.slot === lineup(l).length - 1 ? 'Champion' : 'Elite Four'
  return (
    <Win title={`${l.name}: ${t.name}`} tone="gold" aside={role}>
      <div className="leadrow" ref={row}>
        <span className={`foe ${{ '': '', mid: 'hurt', low: 'crit' }[hpTone(league.hp / league.max)]}`}>{t.sprite ? <img src={`/sprites/trainers/${t.sprite}.png`} alt="" width={72} height={72} className="sprite" /> : <span className="nopic" aria-hidden>?</span>}<Pop value={league.waiting ? 0 : today.strike} /></span>
        <div className="leadinfo">
          <HpBar variant="game" value={league.hp} max={league.max} name={t.name} />
          <div className="hp-sub"><span>{league.waiting ? 'Waiting' : today.strike > 0 ? <>Today <b className="dmg">−{today.strike}</b></> : ''}{league.slipped > 0 && <b className="leaving"> Won back {league.slipped} HP</b>}</span><b>{league.hp.toLocaleString('en-IN')} / {league.max.toLocaleString('en-IN')}</b></div>
          <div className="weak">
            <img src={`/sprites/types/${t.type}.png`} alt="" width={16} height={16} /><span>{t.type}</span>
            {league.weak.map((w) => <span key={w} className="chip weakchip" data-tag={w}>{TAG_NAME[w] ?? w} ×{WEAK_MULT}</span>)}
            {league.edge && <span className="chip mega">type edge ×{ADVANTAGE_MULT}</span>}
          </div>
        </div>
      </div>
      {league.waiting && <p className="muted">{l.name} opens with {((l.region ?? 1) - 1) * GRADUATES_PER_REGION} fully trained Pokemon (you have {game.graduates.length}).</p>}
      {game.team.length > 0 && (
        <div className="backing" title="Your team. Each adds to every strike, and more to the work its nature raised.">
          {game.team.map((m) => <img key={m.uid} src={still(m.form, m.shiny)} alt={nameOf(m.form)} width={40} height={40} className="sprite" />)}
        </div>
      )}
      <TodayEffects game={game} />
      <PowerLine game={game} />
    </Win>
  )
}

/** Nothing has been ticked yet: say where the game comes from, instead of showing a row of zeros. */
function FirstRun({ game }: { game: Game }) {
  if (game.days.some((d) => d.xp > 0 || d.ticked > 0)) return null
  return (
    <p className="notice good">
      Nothing has been ticked yet. Every habit you tick in <a href={LIFEOS_URL} target="_blank" rel="noreferrer">Life OS</a> grows your partner and wears down the wild Pokemon. Come back after your first tick.
    </p>
  )
}

/** The morning after an empty day was settled: what it cost, and what can be done about it. */
function SlipNote({ game }: { game: Game }) {
  const s = game.slip
  if (!s) return null
  const cost = [s.leader ? `the leader won back ${s.leader} HP` : '', s.wild ? `the wild Pokemon ${s.wild}` : '', s.xp ? `${s.xp} XP faded` : ''].filter(Boolean).join(', ')
  const revive = (game.inv['revive'] ?? 0) > 0
  return (
    <p className="notice warn">
      Nothing was ticked on {fmtDay(s.empty)}: {cost}. Nothing finished is lost.{' '}
      {revive ? 'A Revive in your Bag takes the leader\'s HP back.' : 'A Revive from the Mart takes the leader\'s HP back.'}
    </p>
  )
}

/** The leader as a challenge card: who is up and how much HP they have left, against their type's colour. Tap for the whole card. */
function LeaderTile({ game }: { game: Game }) {
  const [open, setOpen] = useState(false)
  const { league, today } = game
  const t = leaderOf(league.index, league.slot)
  if (!t) return <div className="duel static"><span className="duel-txt"><span className="k-label">League</span><b>Every league is beaten</b></span></div>
  const l = LEAGUES[league.index]
  const role = isGym(league.index, league.slot) ? `Gym ${league.slot + 1}` : league.slot === lineup(l).length - 1 ? 'Champion' : 'Elite Four'
  return (
    <>
      <button type="button" className="duel" style={{ ['--tc' as string]: typeColor(t.type) }} onClick={() => setOpen(true)} aria-label={`${t.name}, ${Math.round(league.hp)} HP left. Open the leader card`}>
        <span className="duel-art">{t.sprite ? <img src={`/sprites/trainers/${t.sprite}.png`} alt="" width={72} height={72} className="sprite" /> : <span className="nopic" aria-hidden>?</span>}</span>
        <span className="duel-txt">
          <span className="k-label">{l.name} · {role}</span>
          <b>{t.name}</b>
          <HpBar value={league.hp} max={league.max} />
          <small>{league.waiting ? 'Waiting for the region' : today.strike > 0 ? <>Today <em>−{today.strike}</em></> : 'Weak to ' + (league.weak.map((w) => TAG_NAME[w] ?? w).join(' and ') || 'nothing')}</small>
        </span>
      </button>
      {open && <Sheet title={`${l.name}: ${t.name}`} onClose={() => setOpen(false)}><LeaderCard game={game} /></Sheet>}
    </>
  )
}

/** Today: what is happening now, and nothing that belongs to another tab. */
function PartnerTab({ game, facts, nights, onShop }: { game: Game; facts: DayFacts[]; nights: Record<string, SleepNight>; onShop: () => void }) {
  const habits = facts[facts.length - 1]?.habits ?? []
  return (
    <div className="home daypage">
      <div className="day-main">
        <Scene game={game} />
        <FirstRun game={game} />
        <SlipNote game={game} />
        {game.warnings.map((w) => <p key={w} className="notice warn">{w}</p>)}
        <Talk game={game} pillars={habits.filter((h) => h.pillar)} sleepH={habits.find((h) => h.id === SLEEP_HABIT && !h.measured)} />
      </div>
      <div className="day-side">
      <Pace game={game} />
      <Win title="Throw and feed" tone="gold" aside={game.wild && !game.wild.caught ? `${nameOf(game.wild.form)} · ${game.wild.hp} HP` : undefined}>
        <Actions game={game} onShop={onShop} />
      </Win>
      <BattlePrep game={game} />
      <Win title="Challenges" tone="red">
        <div className="duels">
          <LeaderTile game={game} />
          {game.boss && <BossTile game={game} />}
        </div>
      </Win>
      {game.sleep.state === 'measured' && <SleepWin game={game} nights={nights} />}
      </div>
    </div>
  )
}

// ── Choices ─────────────────────────────────────────────────────────────────
// Nothing in here costs anything or is needed for anything: it only changes how
// a registered Mega is drawn and which way a branching Pokemon evolves.
type Choice = 'show' | 'branch'

function Choices({ game }: { game: Game }) {
  const [what, setWhat] = useState<Choice | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const kept = game.partner.megas ?? []
  const branching = [game.partner, ...game.queue].filter((m) => (SPECIES[m.form].e?.length ?? 0) > 1)
  const uses: [Choice, string, string][] = [
    ['show', 'Which form shows', 'Your partner has a Mega form registered for good. Choose whether it is drawn as that or as its ordinary self.'],
    ['branch', 'Choose a branch', 'Decide which way a branching Pokemon evolves. It still evolves on its own, at its level.'],
  ]
  // who each one can be used on right now
  const can: Record<Choice, Mon[]> = { show: kept.length ? [game.partner] : [], branch: branching }
  const why: Record<Choice, string> = {
    show: game.keyStone ? `${nameOf(game.partner.form)} has no Mega Stone forged yet.` : 'Needs the Key Stone and a forged Mega Stone.',
    branch: 'None of your Pokemon has a branching evolution right now.',
  }
  const solo = what === 'show'
  const mon = what ? (can[what].find((m) => m.uid === uid) ?? (solo ? game.partner : null)) : null
  const choices = !what || !mon ? [] : what === 'show' ? ['base', ...kept] : (SPECIES[mon.form].e ?? [])
  const chosen = choices.length === 1 ? choices[0] : choices.includes(to ?? '') ? to : null
  const ready = Boolean(what && mon && chosen)
  const pick = (w: Choice) => { setWhat(what === w ? null : w); setUid(null); setTo(null) }
  const formOf = (f: string) => (f === 'base' && mon ? mon.form : f)
  const confirm = () => {
    if (!what || !mon || !ready) return
    useItem('', mon.uid, what, chosen ?? undefined)
    setWhat(null); setUid(null); setTo(null)
  }
  const sentence = !what || !mon ? '' : what === 'show' ? `${nameOf(mon.form)} is drawn as ${nameOf(formOf(chosen ?? ''))} from today.`
    : `${nameOf(mon.form)} will evolve into ${nameOf(chosen ?? '')} when its level comes.`
  return (
    <Win title="Choices" tone="blue" aside="Free" fold>
      <div className="uses">
        {uses.map(([id, name, text]) => (
          <button key={id} className={`use ${what === id ? 'on' : ''}`} aria-pressed={what === id} disabled={can[id].length === 0} onClick={() => pick(id)}>
            <b>{name}</b>
            <span>{can[id].length === 0 ? why[id] : text}</span>
          </button>
        ))}
      </div>
      {what && (
        <div className="usebox">
          {!solo && (
            <>
              <p className="muted">Which Pokemon?</p>
              <div className="queue pick">
                {can[what].map((m) => (
                  <button key={m.uid} aria-pressed={mon?.uid === m.uid} className={mon?.uid === m.uid ? 'on' : ''} onClick={() => { setUid(m.uid); setTo(null) }} title={nameOf(m.form)}>
                    <img src={still(m.form, m.shiny)} alt={nameOf(m.form)} width={64} height={64} className="sprite" />
                  </button>
                ))}
              </div>
            </>
          )}
          {mon && choices.length > 1 && (
            <>
              <p className="muted">{what === 'branch' ? 'Into which?' : 'Which form?'}</p>
              <div className="queue pick">
                {choices.map((f) => (
                  <button key={f} aria-pressed={chosen === f} className={chosen === f ? 'on' : ''} onClick={() => setTo(f)} title={nameOf(formOf(f))}>
                    <img src={still(formOf(f), mon.shiny)} alt={nameOf(formOf(f))} width={64} height={64} className={`sprite ${what === 'branch' && !game.dex[f] ? 'unseen' : ''}`} />
                  </button>
                ))}
              </div>
            </>
          )}
          {ready && (
            <div className="confirm">
              <p>{sentence} It costs nothing and can be changed again.</p>
              <button className="go" onClick={confirm}>Confirm</button>
              <button className="plain" onClick={() => setWhat(null)}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </Win>
  )
}

// ── Pokedex ─────────────────────────────────────────────────────────────────
type Show = 'all' | 'own' | 'seen' | 'unseen'
const regionOf = (id: string): number => SPECIES[SPECIES[id].b ?? '']?.g ?? SPECIES[id].g ?? 0

/** What it was raised on, as its nature says it. */
const natureLine = (m: Mon): string =>
  !m.nature ? '' : m.nature.up && m.nature.down
    ? `${m.nature.name} nature: raised most on ${TAG_NAME[m.nature.up]}, least on ${TAG_NAME[m.nature.down]}.`
    : `${m.nature.name} nature: raised evenly.`

/** A ring that fills with a share, a number in the middle. */
function Ring({ value, size = 64, children }: { value: number; size?: number; children?: ReactNode }) {
  const R = size / 2 - 4, C = 2 * Math.PI * R
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={R} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={R} className="ring-fill" strokeDasharray={`${C * clamp01(value)} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ring-in">{children}</span>
    </span>
  )
}

/** One Pokedex entry, opened: when you met it, what it became, its other forms. */
function DexEntry({ game, id, owned, onClose }: { game: Game; id: string; owned: Map<string, Mon>; onClose: () => void }) {
  const sel = SPECIES[id]
  const e = game.dex[id]
  const mon = owned.get(id)
  const forms = [...(sel.m ?? []), ...(sel.gm ? [sel.gm] : [])]
  return (
    <Sheet title={e ? sel.n : `Number ${sel.d}`} onClose={onClose}>
      <div className="entry" style={{ ['--tc' as string]: typeColor(e ? sel.t : null) }}>
        <div className="entry-art">
          {e ? <Sprite form={id} shiny={e.shiny} size={136} /> : <img src={still(id)} alt="" width={112} height={112} className="sprite unseen" />}
        </div>
        <span className="k-label">No. {dexNo(sel.d)}{e?.own ? ' · caught' : e ? ' · seen' : ''}</span>
        <h2 className="entry-name">{e ? sel.n : '???'}{e?.shiny && <span className="tagchip">Shiny</span>}</h2>
        {e && <div className="hero-types">{[sel.t, sel.t2].filter(Boolean).map((t) => <span key={t} className="typechip" style={{ ['--tc' as string]: typeColor(t) }}><img src={`/sprites/types/${t}.png`} alt="" width={14} height={14} />{t}</span>)}</div>}
        <dl className="entry-facts">
          <div><dt>First seen</dt><dd>{e ? fmtDay(e.first) : 'Not yet'}</dd></div>
          <div><dt>Yours since</dt><dd>{e?.own ? fmtDay(e.own) : e ? 'Seen, not caught' : '—'}</dd></div>
          {mon?.graduated && <div><dt>Fully trained</dt><dd>{fmtDay(mon.graduated)}, after {plural(mon.together ?? 0, 'day')}</dd></div>}
          {mon?.ball && <div><dt>Caught in</dt><dd className="ballname"><Ball ball={mon.ball} size={16} />{aBall(mon.ball)}</dd></div>}
        </dl>
        {mon?.nature && <p className="muted">{natureLine(mon)}</p>}
        {sel.e && sel.e.length > 1 && <p className="muted">Branches by what you do most while raising it: {sel.e.map((x, i) => `${game.dex[x] ? SPECIES[x].n : '???'} (${TAG_NAME[sel.bt?.[i] ?? ''] ?? '?'})`).join(', ')}.</p>}
        {forms.length > 0 && (
          <div className="entry-forms">
            {forms.map((f) => (
              <span key={f} title={game.dex[f] ? SPECIES[f].n : 'Not registered yet'}>
                <img src={game.dex[f] ? spritePath(f) : still(f)} alt="" width={72} height={72} className={`sprite ${game.dex[f] ? '' : 'unseen'}`} />
                <small>{SPECIES[f].n.includes('Mega') ? 'Mega' : 'Gigantamax'}</small>
              </span>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}

function DexTab({ game }: { game: Game }) {
  const [region, setRegion] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const [show, setShow] = useState<Show>('all')
  const owned = useMemo(() => {
    const m = new Map<string, Mon>()
    for (const x of [...game.graduates, game.partner, ...game.queue]) for (const f of x.path) m.set(f, x)
    return m
  }, [game])
  const all = useMemo(() => Object.entries(SPECIES).filter(([, r]) => !r.f), [])
  const perRegion = useMemo(() => {
    const out = REGIONS.map(() => ({ seen: 0, own: 0, total: 0 }))
    for (const [id] of all) {
      const g = regionOf(id) - 1
      if (!out[g]) continue
      out[g].total++
      if (game.dex[id]) out[g].seen++
      if (game.dex[id]?.own) out[g].own++
    }
    return out
  }, [all, game.dex])
  const entries = useMemo(() => all.filter(([id]) => regionOf(id) === region).sort((a, b) => a[1].d - b[1].d), [all, region])
  const shown = entries.filter(([id]) => (show === 'all' ? true : show === 'own' ? game.dex[id]?.own : show === 'seen' ? game.dex[id] : !game.dex[id]))
  const locked = region > game.regions
  const raisedIn = entries.filter(([id]) => owned.get(id)?.graduated).length
  const seenTotal = Object.keys(game.dex).filter((id) => !SPECIES[id]?.f).length
  const here = perRegion[region - 1]
  // each sprite is sized by what is drawn in it, so a small Pokemon and a large one look alike in the grid
  const boxes = useBoxes()
  const fit = (id: string): CSSProperties | undefined => { const t = boxes ? fitOf(boxes[id], 56, 42) : undefined; return t ? { transform: t } : undefined }
  return (
    <div className="dexpage">
      <div className="regions2" role="tablist" aria-label="Region" data-noswipe>
        {REGIONS.map((name, i) => {
          const r = perRegion[i], shut = i + 1 > game.regions
          return (
            <button key={name} role="tab" aria-selected={region === i + 1} className={`rg ${region === i + 1 ? 'on' : ''} ${shut ? 'lock' : ''}`} onClick={() => { setRegion(i + 1); setOpen(null) }}>
              <b>{name}</b>
              <small>{shut ? 'Locked' : `${r.own} / ${r.total}`}</small>
              <i style={{ width: `${r.total ? (r.own / r.total) * 100 : 0}%` }} />
            </button>
          )
        })}
      </div>

      <header className="dexhead">
        <Ring value={here.total ? here.own / here.total : 0} size={84}><b>{here.total ? Math.round((here.own / here.total) * 100) : 0}%</b></Ring>
        <div className="dexhead-txt">
          <span className="k-label">Region {region} · {seenTotal} of {all.length} seen in all</span>
          <h2>{REGIONS[region - 1]}</h2>
          <p>{locked
            ? `Opens when the ${REGIONS[region - 2]} league is beaten and ${(region - 1) * GRADUATES_PER_REGION} Pokemon are fully trained (you have ${game.graduates.length}).`
            : <><b>{here.own}</b> caught · <b>{here.seen}</b> seen · <b>{raisedIn}</b> raised · {here.total} in all</>}</p>
        </div>
      </header>

      <div className="seg2" role="group" aria-label="Show">
        {([['all', 'All'], ['own', 'Caught'], ['seen', 'Seen'], ['unseen', 'Not seen']] as [Show, string][]).map(([id, text]) => (
          <button key={id} type="button" aria-pressed={show === id} className={show === id ? 'on' : ''} onClick={() => setShow(id)}>{text}</button>
        ))}
      </div>

      <div className={`dex2 ${locked ? 'locked' : ''}`}>
        {shown.map(([id, r]) => {
          const e = game.dex[id]
          const mon = owned.get(id)
          return (
            <button key={id} type="button" className={`dx ${e ? 'seen' : ''} ${e?.own ? 'own' : ''} ${(r.m ?? []).some((f) => game.dex[f]?.own) ? 'mg' : ''}`} onClick={() => setOpen(id)} title={e ? r.n : `#${r.d}`} aria-label={e ? `${r.n}, number ${r.d}${e.own ? ', caught' : ', seen'}` : `Not seen, number ${r.d}`}>
              <img src={still(id, e?.shiny)} alt="" loading="lazy" decoding="async" width={56} height={56} className={`sprite ${e ? '' : 'unseen'}`} style={fit(id)} />
              <span className="dx-no">{dexNo(r.d)}</span>
              {e?.own && (mon?.ball ? <Ball ball={mon.ball} size={16} className="dx-ball" /> : <i className="dx-ball plain" aria-hidden />)}
              {mon?.graduated && <i className="dx-star" title="Fully trained" aria-hidden>★</i>}
              {e?.shiny && <i className="dx-shine" title="Shiny" aria-hidden>✦</i>}
            </button>
          )
        })}
        {shown.length === 0 && <p className="muted dex-none">Nothing here with this filter.</p>}
      </div>
      {open && <DexEntry game={game} id={open} owned={owned} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ── Journey (the Trainer tab's old name in the code) ───────────────────────
const KIND: Record<Moment['kind'], string> = { level: 'Level', evolve: 'Evolved', graduate: 'Trained', partner: 'Partner', catch: 'Caught', appear: 'Wild', form: 'Form', region: 'Region', gym: 'Gym', league: 'League', use: 'Choice', key: 'Key Stone', review: 'Review', boss: 'Boss', mega: 'Mega', transfer: 'Professor', quest: 'Quest', season: 'Season', hatch: 'Hatched', chest: 'Chest', feat: 'Feat', gear: 'Gear', kit: 'Kit', flee: 'Fled', slip: 'Slipped', pickup: 'Pickup', endure: 'Endured', symbol: 'Frontier', summon: 'Legend', fossil: 'Lab', itemevo: 'Evolved', lap: 'Rematch', research: 'Professor', master: 'Lv 100' }
const aOrAn = (w: string): string => `${/^[AEIOU]/i.test(w) ? 'an' : 'a'} ${w}`
function line(m: Moment): string {
  switch (m.kind) {
    case 'level': return `${nameOf(m.form)} reached level ${m.level}`
    case 'evolve': return `${nameOf(m.from)} evolved into ${nameOf(m.form)}${m.picked ? ' (your choice)' : m.tag ? ` (${TAG_NAME[m.tag] ?? m.tag} led)` : ''}`
    case 'graduate': return `${nameOf(m.form)} was fully trained`
    case 'partner': return `${nameOf(m.form)} became the partner${m.origin === 'egg' ? ' (hatched from an egg)' : ''}`
    case 'catch': return `${m.shiny ? 'Shiny ' : ''}${nameOf(m.form)} was caught${m.how === 'perfect' ? ' on the spot, by a perfect day' : m.how === 'ball' ? ' with a thrown ball' : ''} (#${m.n})`
    case 'appear': return `A wild ${nameOf(m.form)} appeared${m.rarity === 'C' ? '' : ` (${RARITY[m.rarity].toLowerCase()})`}`
    case 'form': return `${nameOf(m.form)} registered (${m.what === 'mega' ? 'Mega' : 'Gigantamax'})`
    case 'region': return `${REGIONS[m.n - 1]} opened`
    case 'gym': {
      const t = leaderOf(m.league, m.slot), l = LEAGUES[m.league]
      if (!t || !l) return 'A leader was beaten'
      return isGym(m.league, m.slot) ? `Beat ${t.name} of ${l.name}: ${badgeName(t)}` : m.slot === lineup(l).length - 1 ? `Beat ${t.name}, ${l.name}'s Champion` : `Beat ${t.name} of the ${l.name} Elite Four`
    }
    case 'league': return `The ${leagueName(m.league)} league is yours: entered in the Hall of Fame`
    case 'use': return m.what === 'branch' ? `Chose ${nameOf(m.to ?? '')} as the branch` : `${nameOf(m.form)} came forward as the partner`
    case 'key': return 'The Key Stone is yours: shards can now forge Mega Stones'
    case 'mega': return `${nameOf(m.form)} registered for good`
    case 'transfer': return `${nameOf(m.form)} went to the Professor (+${m.coins} coins)`
    case 'quest': return `${m.name}: ${m.coins ? `+${m.coins} coins` : `+${m.gems} gems`}`
    case 'season': return `Season step ${m.step}: ${m.coins ? `+${m.coins} coins` : m.gems ? `+${m.gems} gems` : itemName(m.item)}`
    case 'hatch': return `A Rare Egg hatched into ${nameOf(m.form)}`
    case 'review': return `Month reviewed (${m.n}): a Comet Shard, which fits any Mega`
    case 'boss': {
      const who = `Lv ${m.level} ${nameOf(m.form)}`
      return m.what === 'appear' ? `A boss appeared: ${who}` : m.what === 'kill' ? `Boss beaten: ${who}` : m.what === 'catch' ? `Boss caught: ${m.shiny ? 'a shiny ' : ''}${who}` : m.what === 'miss' ? `${nameOf(m.form)} broke free of throw ${m.n}` : `The boss ${nameOf(m.form)} left`
    }
    case 'flee': return `The wild ${nameOf(m.form)} got away`
    case 'slip': return `An empty day (${fmtDay(m.empty)}): ${[m.leader ? `the leader won back ${m.leader} HP` : '', m.wild ? `the wild Pokemon ${m.wild} HP` : '', m.xp ? `${m.xp} XP faded` : ''].filter(Boolean).join(', ')}`
    case 'chest': return `Chest ${m.n}: ${m.coins ? `${m.coins} coins` : `${itemName(m.item)}${m.count > 1 ? ` ×${m.count}` : ''}`}`
    case 'gear': return `${itemName(m.item)} dropped by a Strong workout`
    case 'kit': return m.shard ? `A full set of gear (set ${m.n}) became a Red Shard` : `A full set of gear (set ${m.n}) paid gems and Iron`
    case 'pickup': return `${nameOf(m.form)} found ${aOrAn(itemName(m.item))} on the day's walk`
    case 'endure': return `An empty day (${fmtDay(m.empty)}) cost nothing: ${m.how === 'endure' ? 'the bond held (Endure)' : m.how === 'sash' ? 'the Focus Sash held' : 'the Guard Spec stood guard'}`
    case 'symbol': {
      const f = FACILITIES.find((x) => x.id === m.facility)
      return `${f?.brain ?? 'A Frontier Brain'} beaten at the ${f?.name ?? 'Battle Frontier'}: the ${m.tier === 'gold' ? 'Gold' : 'Silver'} Symbol`
    }
    case 'summon': return `The ${itemName(m.key)} called ${nameOf(m.form)}: it comes next`
    case 'fossil': return `The Lab brought the ${itemName(m.item)} back: ${nameOf(m.form)}`
    case 'itemevo': return `${nameOf(m.from)} evolved into ${nameOf(m.form)} (${itemName(m.item)})`
    case 'lap': return `Every league beaten: the Rematch begins at rank ★${m.lap + 1}`
    case 'research': return `The Professor's research reached rank ${m.rank}: wild Pokemon come weaker, and he sent a gift`
    case 'master': return `${nameOf(m.form)} reached level 100 and stepped aside for the next partner`
    case 'feat': return `Feat: ${m.name}${[m.gems ? `+${m.gems} gems` : '', m.coins ? `+${m.coins} coins` : '', ...m.items.map(itemName)].filter(Boolean).map((x, i) => (i ? x : ` (${x}`)).join(', ')}${m.gems || m.coins || m.items.length ? ')' : ''}`
  }
}
/** The league being challenged, as a road: one step per leader, a tick on those behind you, a marker where you stand. */
export function Road({ game }: { game: Game }) {
  const { league } = game
  const done = league.index >= LEAGUES.length
  const index = Math.min(league.index, LEAGUES.length - 1)
  const l = LEAGUES[index]
  const all = lineup(l)
  const at = done ? all.length : league.slot
  return (
    <Win title={`${league.lap > 0 ? `★${league.lap + 1} ` : ''}${l.name} league`} tone="gold" aside={done ? 'All beaten' : league.lap > 0 ? `Rematch rank ★${league.lap + 1}` : `${Math.min(at, l.gyms.length)} / ${l.gyms.length} badges`}>
      <div className="road-win">
        <div className="k-road">
          {at > 0 && <div className="k-road-done"><span className="k-rung past">{at} {at === 1 ? 'leader' : 'leaders'} beaten</span></div>}
          {all.flatMap((t, i) => {
            if (i < at || i > at + 4) return []
            const state = i < at ? 'done' : i === at && !league.waiting ? 'now' : 'ahead'
            const gym = i < l.gyms.length
            const art = gym ? badgeArt(index, i) : null
            const step = (
              <div key={`${t.name}${i}`} className={`k-step ${state}`} data-n={i + 1}>
                {t.sprite ? <img src={`/sprites/trainers/${t.sprite}.png`} alt="" width={52} height={52} className="sprite" loading="lazy" /> : <span className="nopic" aria-hidden>?</span>}
                <div>
                  <span className="name">{t.name}</span>
                  <small>{gym ? badgeName(t) : i === all.length - 1 ? 'Champion' : 'Elite Four'} · {t.type}</small>
                  {state === 'now' && <div style={{ marginTop: 6 }}><HpBar value={league.hp} max={league.max} label={`${league.hp.toLocaleString('en-IN')} HP left`} /></div>}
                </div>
                {gym && <GymBadge art={art} on={state === 'done'} n={i + 1} size={40} title={`${badgeName(t)}: ${state === 'done' ? 'won' : 'not yet'}`} />}
              </div>
            )
            return [step]
          })}
          {all.length - (at + 5) > 0 && <div className="k-road-done"><span className="k-rung past">and {all.length - (at + 5)} more after that</span></div>}
        </div>
      </div>
      {league.waiting && <p className="muted">{l.name} is not open yet.</p>}
      {game.v13 && <p className="muted">{league.lap > 0 ? `Rematch rank ★${league.lap + 1}: every leader has ${Math.round(60 * league.lap)}% more HP, wins pay Battle Points, and each Champion a Legend key.` : 'After Paldea\'s Champion, every league comes back at Rematch rank ★2, then ★3: the road never ends.'}</p>}
    </Win>
  )
}

function HallOfFame({ game }: { game: Game }) {
  if (game.hall.length === 0) {
    return (
      <Win title="Hall of Fame" tone="gold" fold aside="Empty">
        <p className="muted">Beat every leader of a league, up to its Champion, and your partner and team are kept here for good.</p>
      </Win>
    )
  }
  return (
    <Win title="Hall of Fame" tone="gold" fold aside={plural(game.hall.length, 'league')}>
      <ul className="hall">
        {game.hall.map((h) => (
          <li key={h.league}>
            <div><b>{leagueName(h.league)}</b><small>{fmtDay(h.day)} · beat {LEAGUES[h.league].champion.name}</small></div>
            <div className="team">
              <img src={still(h.partner.form, h.partner.shiny)} alt={nameOf(h.partner.form)} title={`${nameOf(h.partner.form)}, the partner`} width={56} height={56} className="sprite lead" />
              {h.team.map((m, i) => <img key={i} src={still(m.form, m.shiny)} alt={nameOf(m.form)} title={nameOf(m.form)} width={44} height={44} className="sprite" />)}
            </div>
          </li>
        ))}
      </ul>
    </Win>
  )
}

/** Every badge won, league by league, with the open league's empty places. */
function BadgeCase({ game }: { game: Game }) {
  const upTo = Math.min(game.league.index, LEAGUES.length - 1)
  return (
    <Win title="Badge case" tone="dark" fold aside={plural(badgesWon(game), 'badge')}>
      {LEAGUES.slice(0, upTo).map((l, index) => (
        <div key={l.name} className="caserow">
          <KRibbon metal={index < game.league.index ? 'gold' : 'silver'}>{l.name}</KRibbon>
          <div className="casemedals">
            {l.gyms.map((t, i) => {
              const on = index < game.league.index || i < game.league.slot
              const title = `${badgeName(t)}: ${on ? `won from ${t.name}` : `beat ${t.name}`}`
              const art = badgeArt(index, i)
              // the real badge where there is a picture of it; an empty numbered place for the regions without one
              return <GymBadge key={i} art={art} on={on} n={i + 1} title={title} />
            })}
          </div>
        </div>
      ))}
      <div className="keyrow">
        <KeyStone size={32} held={Boolean(game.keyStone)} />
        <p className="muted">
          {game.keyStone ? `Key Stone, held since ${fmtDay(game.keyStone)}. A Mega Stone is forged from three shards, in the Forge on the Party tab.` : 'The Key Stone is a feat: any one kind of work, seven days running. Then shards forge Mega Stones.'}
        </p>
      </div>
    </Win>
  )
}

/** Journey: where you are going, and what is next to earn. Roads first; the log is folded away at the bottom. */
function TrainerTab({ game }: { game: Game }) {
  const events = [...game.moments].reverse().filter((m) => m.kind !== 'quest').filter((m, i, all) => m.kind !== 'level' || all.findIndex((x) => x.kind === 'level' && x.day === m.day) === i).slice(0, 80)
  const grouped = events.reduce<[string, Moment[]][]>((acc, m) => {
    const last = acc[acc.length - 1]
    if (last && last[0] === m.day) last[1].push(m)
    else acc.push([m.day, [m]])
    return acc
  }, [])
  const [view, setView] = useState<'roads' | 'days' | 'feats' | 'records'>('roads')
  const menu: [typeof view, string, string, ReactNode][] = [
    ['roads', 'Roads', 'town-map', `${badgesWon(game)}`],
    ['days', 'Days', 'photo-album', null],
    ['feats', 'Feats', 'star-piece', null],
    ['records', 'Records', 'fame-checker', game.hall.length || null],
  ]
  return (
    <div className="journeypage">
      <nav className="pmenu" style={{ ['--n' as string]: menu.length } as CSSProperties} role="tablist" aria-label="Journey" data-noswipe>
        {menu.map(([id, name, icon, badge]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={`pmenu-btn ${view === id ? 'on' : ''}`} onClick={() => { setView(id); play('tap') }}>
            <span className="pmenu-icon"><ItemIcon id={icon} size={30} />{badge !== null && <i className="pmenu-badge">{badge}</i>}</span>
            <b>{name}</b>
          </button>
        ))}
      </nav>
      <div className={`pview ${view === 'records' ? '' : 'two'}`} key={view}>
        {view === 'roads' && (
          <>
            <div className="pcol"><Road game={game} /><SeasonRoad game={game} /></div>
            <div className="pcol"><FrontierWin game={game} /></div>
          </>
        )}
        {view === 'days' && (
          <>
            <div className="pcol"><Quests game={game} /></div>
            <div className="pcol"><Calendar game={game} /></div>
          </>
        )}
        {view === 'feats' && (
          <>
            <div className="pcol"><FeatsWin game={game} /></div>
            <div className="pcol"><LegendWin game={game} /><BossLog game={game} /></div>
          </>
        )}
        {view === 'records' && (
          <>
            {game.league.index > 0 && <BadgeCase game={game} />}
            <HallOfFame game={game} />
            <details className="sec drawer" data-tone="dark">
              <summary className="sec-h"><i className="sec-mark" aria-hidden /><h2>Adventure log</h2><span className="sec-aside">{plural(events.length, 'thing')}</span><i className="chev" aria-hidden /></summary>
              <div className="sec-b">
                {grouped.length === 0 ? <p className="muted">Nothing yet. Tick a pillar in Life OS and it shows up here.</p> : (
                  <ul className="log">
                    {grouped.flatMap(([day, ms]) => [
                      <li key={day} className="dayhead">{fmtDay(day)} · {weekday(day, 3)}</li>,
                      ...ms.map((m, i) => <li className="ev" key={`${day}-${i}`}><span className={`kind k-${m.kind}`}>{KIND[m.kind]}</span><span>{line(m)}</span></li>),
                    ])}
                  </ul>
                )}
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  )
}

function Rule({ title, tone, pic, children }: { title: string; tone: string; pic: ReactNode; children: ReactNode }) {
  return (
    <div className="rule" data-tone={tone}>
      <div className="rule-pic">{pic}</div>
      <b>{title}</b>
      <p>{children}</p>
    </div>
  )
}
const Arrow = () => <span className="rule-arrow" aria-hidden>▸</span>
function RulesTab({ onTour }: { onTour: () => void }) {
  const [sound, setSound] = useState(soundOn())
  return (
    <section className="k-panel">
      <div className="k-panel-b">
        <h2 className="k-type" style={{ fontSize: 26, marginBottom: 12 }}>How it works</h2>
        <div className="rules">
          <Rule title="Do the day" tone="gold" pic={<><span className="rule-chip">{TIER_XP.pillar}</span><span className="rule-chip sm">{TIER_XP.core}</span><span className="rule-chip xs">{TIER_XP.standard}</span></>}>
            Every habit is XP for your partner. Pillars are {TIER_XP.pillar}; chores are small.
          </Rule>
          <Rule title="One day, three hits" tone="blue" pic={<><span className="rule-dot" style={{ background: 'var(--k-blue)' }} /><span className="rule-dot" style={{ background: 'var(--hp-ok)' }} /><span className="rule-dot" style={{ background: 'var(--k-gold)' }} /></>}>
            How much grows the partner. How many habits you tick hurts the wild Pokemon, so showing up catches. What kind of work hurts the leader.
          </Rule>
          <Rule title="Evolves by itself" tone="green" pic={<><span className="rule-chip sm">{evolveAt(3, 1)}</span><Arrow /><span className="rule-chip sm">{evolveAt(3, 2)}</span><Arrow /><span className="rule-chip">{graduateAt(3)}</span></>}>
            At these levels. At {graduateAt(3)} it is fully trained and the next one steps up.
          </Rule>
          <Rule title="The ball is the day" tone="red" pic={<><Ball ball="poke" size={30} /><Arrow /><Ball ball="great" size={34} /><Arrow /><Ball ball="ultra" size={38} /></>}>
            Half the day's habits ticked: ×{BALL_MULT.great}. Four-fifths: ×{BALL_MULT.ultra}. Every habit ticked catches it on the spot.
          </Rule>
          <Rule title="Coins are not XP" tone="gold" pic={<><Coin size={30} /><Arrow /><ItemIcon id="great-ball" size={34} /></>}>
            Showing up pays coins (more the more you tick, and {PAY_STREAK.coins} more on a second day running at {Math.round(PAY_STREAK.share * 100)}% or more), and so do the weekly quests, the season, chests and the Professor. The Mart sells three deals a day, and two guards always.
          </Rule>
          <Rule title="Each work, its mark" tone="blue" pic={<>{(['code', 'fitness', 'guitar', 'arbor', 'sleep'] as const).map((t) => <ItemIcon key={t} id={{ code: 'machine-part', fitness: 'iron', guitar: 'poke-flute', arbor: 'grn-apricorn', sleep: 'lunar-wing' }[t]} size={26} />)}</>}>
            A day of coding, gym, guitar, Arbor or good sleep pays one mark, spent only in that kind's own shop.
          </Rule>
          <Rule title="Sleep" tone="blue" pic={<><ItemIcon id="lunar-wing" size={30} /><span className="rule-chip sm">80</span><span className="rule-chip sm">90</span></>}>
            A night your band measures is a pillar: its score is the XP, 80 fills it, 80 pays a Bell and 90 two, and 90 minutes of deep sleep one more. No reading is never a zero: tick it by hand for less.
          </Rule>
          <Rule title="Balls have conditions" tone="red" pic={<><ItemIcon id="net-ball" size={30} /><ItemIcon id="quick-ball" size={30} /><ItemIcon id="timer-ball" size={30} /></>}>
            A Net Ball hits Water and Bug double. A Quick Ball is best the day it appears. A Timer Ball grows each day it waits.
          </Rule>
          <Rule title="TMs and held items" tone="purple" pic={<><ItemIcon id="tm-water" size={30} /><ItemIcon id="muscle-band" size={30} /></>}>
            Carry three TMs: each counts as one of the partner's types against a leader. Hold one item: it adds to its kind of work. Incense shows three Pokemon and you pick the next wild one.
          </Rule>
          <Rule title="Feats" tone="gold" pic={<><ItemIcon id="key-stone" size={30} /><ItemIcon id="master-ball" size={30} /><ItemIcon id="choice-band" size={30} /></>}>
            Runs of days and lifetime totals pay things no shop sells. One rest day inside a run is forgiven.
          </Rule>
          <Rule title="Mega, forged" tone="purple" pic={<><ItemIcon id="red-shard" size={26} /><ItemIcon id="blue-shard" size={26} /><ItemIcon id="yellow-shard" size={26} /><Arrow /><KeyStone size={38} /></>}>
            The Key Stone is a feat. Three shards of three different colours forge a Mega Stone for one Pokemon, and for one with two Megas the X or Y is yours to choose. A Comet Shard, one for each month-end review in Life OS, fills any socket. A forged stone adds {Math.round(MEGA_BONUS * 100)}% to every strike, and {Math.round(MEGA_BOND * 100)}% more for each bond level.
          </Rule>
          <Rule title="Level is power" tone="gold" pic={<><span className="rule-chip sm">Lv</span><Arrow /><span className="rule-chip">+{Math.round(LEVEL_POWER * 100)}%</span></>}>
            Every level of your partner adds {Math.round(LEVEL_POWER * 100)}% to every strike, and every member of the party {Math.round(TEAM_BONUS * 100)}% plus {(TEAM_LEVEL * 100).toFixed(1)}% a level. Leaders grow too: 15% more HP for every league further on, a quarter more for the Elite Four, 60% more for a Champion.
          </Rule>
          <Rule title="Critical hits and Dynamax" tone="red" pic={<><ItemIcon id="scope-lens" size={30} /><ItemIcon id="dire-hit" size={30} /><span className="rule-chip sm">×{DYNAMAX}</span></>}>
            From bond level 3 about one day in eight is a critical hit: the day's strike ×{CRIT_MULT}. A Dire Hit or a Scope Lens raises the chance. A perfect day Dynamaxes your partner: ×{DYNAMAX}, or ×{GIGANTAMAX} for one with a Gigantamax form.
          </Rule>
          <Rule title="Battle items" tone="red" pic={<><ItemIcon id="x-attack" size={30} /><ItemIcon id="x-special" size={30} /><ItemIcon id="guard-spec" size={30} /></>}>
            An X item, used any time in the day, makes one kind of work strike the leader harder for the whole day: +20%, +40% or +60% from the Mart, +120% from the Battle Frontier. A Guard Spec stands guard over the next empty day.
          </Rule>
          <Rule title="Pickup and treasures" tone="green" pic={<><ItemIcon id="itemfinder" size={30} /><ItemIcon id="nugget" size={30} /><ItemIcon id="helix-fossil" size={30} /></>}>
            From bond level 1 your partner finds things on days with a pillar: berries, balls, treasures for the Collector, fossils the Lab brings back to life, evolution stones. The further you are in the leagues, the better the finds. The Collector wants three kinds of treasure each day and pays double for them, so a treasure can be worth keeping for its day.
          </Rule>
          <Rule title="Evolution items and vitamins" tone="green" pic={<><ItemIcon id="fire-stone" size={30} /><ItemIcon id="rare-candy" size={30} /><ItemIcon id="calcium" size={30} /></>}>
            A stone or trade item evolves a Pokemon in My Pokemon by one stage when the form it becomes has the item's type. A Rare Candy is a level. A vitamin makes one kind of work strike 3% harder for the Pokemon it is given to, for good: in full while it is your partner, a third while it stands in the party.
          </Rule>
          <Rule title="The Battle Frontier" tone="purple" pic={<><ItemIcon id="rainbow-pass" size={30} /><ItemIcon id="point-card" size={30} /></>}>
            Seven facilities, each a run of one kind of day. Every win pays a Battle Point, every seventh in a row a bonus, and the Frontier Brains hand over Silver and Gold Symbols. BP buy held items, X items, fossils and Legend keys at the Exchange.
          </Rule>
          <Rule title="Legends and Rematch" tone="gold" pic={<><ItemIcon id="red-orb" size={30} /><ItemIcon id="blue-orb" size={30} /><ItemIcon id="jade-orb" size={30} /></>}>
            A Legend key calls one legend as the next wild Pokemon, to catch by your work. After Paldea's Champion every league comes back at Rematch rank ★2, then ★3, stronger each time, and every Rematch Champion hands over a Legend key.
          </Rule>
          <Rule title="Added, not stacked" tone="purple" pic={<><span className="rule-chip sm">+</span><span className="rule-chip sm">+</span><span className="rule-chip sm">+</span><Arrow /><span className="rule-chip">×1</span></>}>
            Level, team, bond, a Mega, the held item, mastery, vitamins, natures and the day's X items are added together and applied once. The leader card shows the sum.
          </Rule>
          <Rule title="Strong's training kit" tone="red" pic={<><ItemIcon id="protector" size={28} /><ItemIcon id="power-band" size={28} /><Arrow /><ItemIcon id="red-shard" size={30} /></>}>
            Each workout in Strong's split drops its own piece of gear. A full set of seven pays gems and Iron, and every {KIT_SHARD_EVERY}rd set a Red Shard as well.
          </Rule>
          <Rule title="Leaders and badges" tone="purple" pic={<><span className="rule-chip">{(LEADER_HP / 1000).toFixed(0)}k</span><Arrow /><img src="/sprites/badges/1-1.png" alt="" width={32} height={32} className="gymbadge pix" /></>}>
            Kanto's gym leaders have {LEADER_HP.toLocaleString('en-IN')} HP, and each league further on more. Each is weak to two kinds of work (×{WEAK_MULT}). Beat one, keep the badge.
          </Rule>
          <Rule title="Your team" tone="blue" pic={<><img src="/sprites/ui/party-on.png" alt="" width={30} height={30} className="pix" /><img src="/sprites/ui/party-on.png" alt="" width={30} height={30} className="pix" /><img src="/sprites/ui/party-empty.png" alt="" width={30} height={30} className="pix" /><span className="rule-chip sm">+10%</span></>}>
            The partner and up to {TEAM_SIZE} more stand together, a party of six: they fight the leaders and the weekly boss. Each of the {TEAM_SIZE} adds {Math.round(TEAM_BONUS * 100)}% to every strike, more for its level and bond, and {Math.round(TEAM_NATURE * 100)}% more to the work its nature raised. With the bond's Exp. Share they keep growing, up to level {MAX_LEVEL}.
          </Rule>
          <Rule title="The Professor's lab" tone="purple" pic={<><ItemIcon id="journal" size={30} /><Arrow /><span className="rule-chip sm">−{Math.round(RESEARCH_WILD * 100)}% HP</span></>}>
            Everyone not in the party lives with the Professor; nobody is sold. He studies up to {RESEARCH_SLOTS} of them on his desk, on every day with a pillar: ten plus its level, times its rarity, a shiny half again. Each research rank takes {Math.round(RESEARCH_WILD * 100)}% more HP off every wild Pokemon to come (up to {Math.round(RESEARCH_WILD_MAX * 100)}%) and sends a gift: Rare Candy, stones, Honey, balls, and every fifth rank a Mystery Egg. So a strong Pokemon either fights in the party or helps you catch on the desk.
          </Rule>
          <Rule title="Level 100" tone="gold" pic={<><span className="rule-chip sm">Lv 50</span><Arrow /><span className="rule-chip">Lv {MAX_LEVEL}</span></>}>
            Fully trained (level 50, or 30 for a Pokemon that never evolves) is still the milestone: its nature is set, it counts toward new regions and the boss, and the next partner steps up. After that it can lead again to go on to level {MAX_LEVEL}; there it steps aside by itself, as it has nothing left to learn.
          </Rule>
          <Rule title="Gems" tone="green" pic={<><Gem size={34} /><span className="rule-chip sm">{GEMS.catch}</span><span className="rule-chip sm">{GEMS.evolve}</span><span className="rule-chip sm">{GEMS.gym}</span></>}>
            A catch, an evolution, a badge, a feat. They buy eggs, incense, chests and scenes, never a ball.
          </Rule>
          <Rule title="The season" tone="gold" pic={<><span className="rule-chip sm">1</span><Arrow /><span className="rule-chip sm">2</span><Arrow /><span className="rule-chip sm">3</span></>}>
            Every {SEASON_STEP.toLocaleString('en-IN')} XP of the month's work is a step, and each step hands something over.
          </Rule>
          <Rule title="Collect" tone="gold" pic={<><Coin size={28} /><Gem size={28} /><Arrow /><ItemIcon id="loot-sack" size={30} /></>}>
            Showing-up pay, weekly quests, season steps, feats and a month reviewed wait in the Collect strip until you tap them. Left alone, each pays itself {CLAIM_AUTO} days later, so nothing is lost. A catch and a chest pay at once.
          </Rule>
          <Rule title="Hearts and bond" tone="green" pic={<><ItemIcon id="heart-scale" size={28} /><ItemIcon id="oran-berry" size={28} /><ItemIcon id="sitrus-berry" size={28} /></>}>
            A heart for every pillar you finish while this Pokemon is your partner, and more for the berries and treats you feed to any of your Pokemon (Oran one, Sitrus three, a friendship berry five). A berry can be kept instead and thrown with a ball as bait: more HP off a wild Pokemon, a better chance at the boss, and double for a friendship berry against the types of its domain. A Pokemon with every bond level ({HEART_LEVELS[HEART_LEVELS.length - 1]} hearts) takes nothing more. Each bond level unlocks a perk: Pickup, Endure, Focus, Best friends, Exp. Share. At {HEART_LEVELS.join(', ')} hearts the bond steps up, and each step adds {Math.round(BOND_STEP * 100)}% to every strike. Hearts belong to the Pokemon and only count up. A new partner starts again, but a fully trained one keeps its hearts for the party: each of its bond levels adds {Math.round(BOND_PARTY * 100)}% to every strike on top of its place in the party.
          </Rule>
          <Rule title="Momentum" tone="blue" pic={<><span className="rule-chip sm">×1.2</span><span className="rule-chip sm">×1.35</span><span className="rule-chip">×1.5</span></>}>
            Of the last seven days, three with two pillars make XP ×1.2, five ×1.35, seven ×1.5. It slides back one day at a time, never resets. {SLEEP_AFTER} days with no pillar at all and the partner dozes off until you finish one.
          </Rule>
          <Rule title="Quests and the week" tone="gold" pic={<><span className="rule-chip sm">5</span><Arrow /><Coin size={28} /><Gem size={28} /></>}>
            Only the week has quests: five days with two pillars, and catch a Pokemon. The day itself pays its own coins, and a perfect day pays {GEMS.perfect} gems.
          </Rule>
          <Rule title="Eggs and chests" tone="blue" pic={<><ItemIcon id="rare-egg" size={32} /><ItemIcon id="loot-sack" size={32} /></>}>
            A boss you beat can drop a Mystery Egg, and gems buy one and Chests in the Rare shop. An egg is warmed by the steps the band counts, at most {STEPS_GOAL.toLocaleString()} a day, and hatches into a rare Pokemon at {EGG_STEPS.toLocaleString()} ({EGG_STEPS_OLD_CHARM.toLocaleString()} with an Old Charm). One is kept warm at a time. A day with no band reading adds nothing. A chest opens on the spot.
          </Rule>
          <Rule title="Regions, legendaries, shiny" tone="purple" pic={<><ItemIcon id="star-piece" size={30} /><span className="rule-chip sm">1/{SHINY_ODDS}</span></>}>
            Every {GRADUATES_PER_REGION} fully trained Pokemon open the next region once the league before it is beaten. Every {LEGENDARY_EVERY_WILD}th wild Pokemon is a legendary. A catch on a perfect day is shiny one time in {SHINY_ODDS}; one worn down, one in {SHINY_ODDS_WORN}.
          </Rule>
          <Rule title="Natures" tone="purple" pic={<><span className="rule-chip sm">▲</span><span className="rule-chip sm">▼</span></>}>
            When a partner is fully trained, the work it did most raises its nature and the work it did least lowers it. In your party it adds {Math.round(TEAM_NATURE * 100)}% on the work its nature raised.
          </Rule>
          <Rule title="Mastery" tone="blue" pic={<><ItemIcon id="machine-part" size={28} /><ItemIcon id="iron" size={28} /><Arrow /><span className="rule-chip sm">+{Math.round(MASTERY_STEP * 100)}%</span></>}>
            Spend a kind of work's own marks to raise its mastery: each level makes that work strike {Math.round(MASTERY_STEP * 100)}% harder, up to level {MASTERY_MAX}. The next level costs {masteryCost(0)} marks, then {masteryCost(1)}, and so on.
          </Rule>
          <Rule title="My Pokemon and the Professor" tone="gold" pic={<><Ball ball="poke" size={30} /><Arrow /><Coin size={28} /></>}>
            A caught Pokemon waits in My Pokemon until it is raised. Send one to the Professor instead and he pays coins: {SELL.C} for a common, {SELL.U} uncommon, {SELL.R} rare, {SELL.L} legendary.
          </Rule>
          <Rule title="Guards" tone="red" pic={<><ItemIcon id="max-repel" size={30} /><ItemIcon id="revive" size={30} /></>}>
            Max Repel keeps the wild Pokemon {REPEL_DAYS} days longer, once. A Revive takes back the HP a leader regained on empty days. Both are always on the Mart's shelf.
          </Rule>
          <Rule title="Ten thousand steps" tone="green" pic={<><span className="rule-chip sm">10k</span><Arrow /><ItemIcon id="iron" size={28} /></>}>
            A day of {STEPS_GOAL.toLocaleString('en-IN')} steps on your band pays an extra Iron mark.
          </Rule>
          <Rule title="The weekly boss" tone="purple" pic={<><ItemIcon id="master-ball" size={30} /><span className="rule-chip sm">6</span><Arrow /><span className="rule-chip">5</span></>}>
            Once your party is six, a boss comes each Monday for the week. Its card has five tasks, from Strong, Arbor, Woodshed, your sleep and your days, each a share of its HP. It is levelled to your party, and how hard you hit depends on how strong the six are: their levels, how rare their lines are, their Megas, the bond, and whose type beats its type. Without every task done its last {Math.round((1 - KILL_CAP) * 100)}% never falls, and a day the card does not move heals it {Math.round(BOSS_HEAL * 100)}%. At {Math.round(THROW_AT * 100)}% HP or less you get {THROWS} throws: a chance, never a sure thing, and better the weaker it is.
          </Rule>
          <Rule title="An empty day costs" tone="red" pic={<span className="rule-chip">0</span>}>
            Since {fmtDay(STAKES_FROM)}, a day with nothing ticked is settled two days later, so a late tick still saves it. The leader wins back {SLIP.leader} HP, the wild Pokemon {SLIP.wild}, and a tenth of the XP into your current level fades. A wild Pokemon that stays {WILD_STAY.C} days gets away. Levels, evolutions, trained and caught Pokemon, badges, feats and items are never taken back.
          </Rule>
          <Rule title="A day's list" tone="red" pic={<><span className="rule-dot" /><span className="rule-dot" /><span className="rule-dot" style={{ opacity: 0.3 }} /></>}>
            Fixed when the day starts. You can add a habit today; taking one off starts tomorrow.
          </Rule>
        </div>
        <div className="kit-row" style={{ marginTop: 14 }}>
          <button type="button" className="k-btn" onClick={onTour}>Show the tour</button>
          <button type="button" className={`k-btn ${sound ? 'ok' : ''}`} aria-pressed={sound} onClick={() => { setSoundOn(!sound); setSound(!sound); if (!sound) play('buy') }}>Sound and buzz: {sound ? 'on' : 'off'}</button>
          <span className="muted">Rules version 11. The game began {fmtDay(GAME_START)}.</span>
        </div>
      </div>
    </section>
  )
}

// ── the frame every tab shares ──────────────────────────────────────────────
/** Tab icons, drawn here as plain shapes. */
/** A gym badge: the sprite itself, nothing behind it. One that is not won yet is its dark outline; a region with no sprite yet is an empty numbered place. */
export function GymBadge({ art, on, title, n, size = 48 }: { art: string | null; on: boolean; title: string; n: number; size?: number }) {
  return art
    ? <img src={art} alt={title} title={title} width={size} height={size} className={`gymbadge pix ${on ? '' : 'off'}`} draggable={false} />
    : <span className={`badgeslot ${on ? 'on' : ''}`} title={title} style={{ width: size, height: size }}>{n}</span>
}
/** The bottom bar: sprites from the item sheet, nothing drawn. */
const TAB_SPRITE: Record<Tab, string> = { partner: 'poke-ball', team: 'tm-case', shop: 'coin-case', dex: 'journal', trainer: 'member-card' }
const ICON: Record<Tab, ReactNode> = Object.fromEntries(
  (Object.keys(TAB_SPRITE) as Tab[]).map((t) => [t, <img key={t} src={`/sprites/items/${TAB_SPRITE[t]}.png`} width={48} height={48} alt="" className="tabicon pix" draggable={false} />]),
) as Record<Tab, ReactNode>

/** Always in view: the partner's face in a ring that fills with its level, the two things you spend, Collect, and the season. */
function TopBar({ game, today, status, loading, onHelp }: { game: Game; today: string; status: string[]; loading: boolean; onHelp: () => void }) {
  const seen = Object.keys(game.dex).filter((id) => !SPECIES[id]?.f).length
  const v5 = !loading
  const nx = game.season.next
  const into = clamp01(game.season.into / game.season.need)
  const prize = nx.coins ? `${nx.coins} coins` : nx.gems ? `${nx.gems} gems` : nx.item ? itemName(nx.item) : 'a prize'
  const R = 27, C = 2 * Math.PI * R
  return (
    <header className="topbar tb">
      <span className="tb-ring" title={`Season step ${game.season.step}: ${game.season.into.toLocaleString('en-IN')} of ${game.season.need.toLocaleString('en-IN')} XP of the month's work, then ${prize}`} role="img" aria-label={`Season step ${game.season.step}, ${Math.round(into * 100)} percent to the next, which pays ${prize}`}>
        <svg viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={R} className="track" />
          <circle cx="32" cy="32" r={R} className="fill" strokeDasharray={`${C * into} ${C}`} transform="rotate(-90 32 32)" />
        </svg>
        {v5 ? (nx.coins ? <Coin size={30} /> : nx.gems ? <Gem size={30} /> : nx.item ? <ItemIcon id={nx.item} size={34} /> : <Ball ball="poke" size={32} />) : <Ball ball="poke" size={32} />}
        {v5 && <b className="tb-lv">Season {game.season.step}</b>}
      </span>
      <div className="tb-main">
        <div className="tb-row">
          {v5
            ? <><KPill icon={<Coin size={28} />}><span data-reward-target="coins" title="Coins: for showing up, quests, the season, chests and the Professor"><Count value={game.wallet.coins} /></span></KPill><KPill icon={<Gem size={28} />}><span data-reward-target="gems" title="Gems: from feats, milestones and weekly quests"><Count value={game.wallet.gems} /></span></KPill><CollectButton game={game} today={today} /></>
            : <KPill icon={<Ball ball="poke" size={28} />}><span title="Pokemon seen">{seen}</span></KPill>}
          <span className="tb-gap" />
          <button type="button" className="k-btn help" aria-label="How it works" onClick={onHelp}>?</button>
          <span className={`sync s-${status[0]}`} role="status" aria-label={status[1]} title={status[1]} />
        </div>
      </div>
    </header>
  )
}

/** A swipe started on something that scrolls sideways, or in a field, is that thing's, not the tab bar's. */
function swipeable(el: EventTarget | null): boolean {
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    if (n.matches('input, textarea, select, [data-noswipe]')) return false
    if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return false
  }
  return true
}

export default function App() {
  const view = useView()
  const [tab, setTab] = useState<Tab>('partner')
  const [help, setHelp] = useState(false)
  const [tourOpen, setTourOpen] = useState<boolean | null>(null)
  useEffect(() => start(), [])
  // swipe sideways to change tab: a long, mostly horizontal, quick drag that did not start on something scrolling
  const touch = useRef<{ x: number; y: number; t: number } | null>(null)
  const go = (dir: -1 | 1) => {
    const i = TABS.findIndex(([id]) => id === tab) + dir
    if (i < 0 || i >= TABS.length) return
    setTab(TABS[i][0]); play('tap'); window.scrollTo({ top: 0 })
  }
  const swipeStart = (e: TouchEvent<HTMLElement>) => {
    const t = e.touches[0]
    touch.current = e.touches.length === 1 && swipeable(e.target) && !document.querySelector('.sheet, .capsule, .recap') ? { x: t.clientX, y: t.clientY, t: Date.now() } : null
  }
  const swipeEnd = (e: TouchEvent<HTMLElement>) => {
    const s0 = touch.current
    touch.current = null
    if (!s0) return
    const t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - s0.t > 600) return
    go(dx < 0 ? 1 : -1)
  }
  const { game } = view
  // the first-run tour: for a game that has not started, once on this device (or when asked for, from the help window)
  const fresh = !game.days.some((d) => d.xp > 0 || d.ticked > 0)
  const tourDone = (() => { try { return localStorage.getItem(TOUR_KEY) === '1' } catch { return false } })()
  const tour = tourOpen ?? shouldTour(new URLSearchParams(location.search).get('tour'), tourDone, fresh)
  const closeTour = () => { setTourOpen(false); try { localStorage.setItem(TOUR_KEY, '1') } catch { /* it would only show again */ } }
  // the first read has not landed yet: do not draw an empty day as if it were real
  const loading = view.status === 'connecting'
  const status = view.status === 'live' ? ['live', 'Synced'] : view.status === 'connecting' ? ['connecting', 'Loading'] : view.status === 'error' ? ['error', 'Offline'] : ['off', 'Local only']
  return (
    <div className="shell">
      {FIXTURE && <a className="fixturetag" href={location.pathname} title={`${FIXTURE.note} Nothing here is your game, and nothing is saved. Tap to leave.`}>Fixture: {FIXTURE.name} · {fmtDay(FIXTURE.today)} · not your game ✕</a>}
      <TopBar game={game} today={view.today} status={status} loading={loading} onHelp={() => setHelp(true)} />
      {!loading && <Toasts game={game} today={view.today} />}
      {!loading && <ChestOpener game={game} />}
      {!loading && <HatchOpener game={game} />}
      {!loading && tour && <Tour onClose={closeTour} />}
      <main key={tab} className="tabin" onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
        {loading && (
          <Win title="Loading" tone="dark">
            <div className="care"><Egg /><p>Reading your Life OS ledger...<span className="muted" style={{ display: 'block' }}>Your partner appears as soon as it arrives.</span></p></div>
          </Win>
        )}
        {!loading && tab === 'partner' && <PartnerTab game={game} facts={view.facts} nights={view.nights} onShop={() => setTab('shop')} />}
        {!loading && tab === 'team' && <TeamTab game={game} partnerCard={(open: () => void) => <Summary game={game} onOpen={open} />} choices={<Choices game={game} />} onShop={() => setTab('shop')} />}
        {!loading && tab === 'shop' && <ShopTab game={game} />}
        {!loading && tab === 'dex' && <DexTab game={game} />}
        {!loading && tab === 'trainer' && <TrainerTab game={game} />}
      </main>
      {help && (
        <div className="recap helpwin" role="dialog" aria-modal="true" aria-label="How it works" onClick={() => setHelp(false)}>
          <div className="helpbody" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="k-btn k-close" aria-label="Close" onClick={() => setHelp(false)}>✕</button>
            <RulesTab onTour={() => { setHelp(false); setTourOpen(true) }} />
          </div>
        </div>
      )}
      <nav className="navbar" role="tablist" aria-label="Sections">
        {TABS.map(([id, text]) => <button key={id} role="tab" aria-selected={tab === id} aria-label={text} data-reward-target={id === 'team' ? 'bag' : undefined} className={tab === id ? 'on' : ''} onClick={(e) => { setTab(id); play('tap'); tapPop(e.currentTarget.querySelector('.tabicon')); window.scrollTo({ top: 0 }) }}>{ICON[id]}{text}</button>)}
      </nav>
      {!loading && <Recap game={game} today={view.today} />}
    </div>
  )
}
