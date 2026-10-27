// The weekly boss on the Today tab: who it is, its HP cut into the card's five
// tasks, how far each task is, and the throw once it is weak enough.
//
// Nothing here decides anything: the card and the week's progress come from the
// ledger (lib/boss.ts writes them), the fold works out the HP, and a throw is
// one `boss-throw` event. The throw's outcome is a seeded roll, so this screen
// can know it a moment early and play the right ending.
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { BOSS_WHERE, bossNeed, KILL_CAP, THROW_AT, catchChance, type BossKind } from '../core/boss.ts'
import { BALLS, itemName, rng } from '../core/economy.ts'
import { nameOf, spritePath, type BossView, type Game } from '../core/fold.ts'
import { SPECIES } from '../core/species.ts'
import { addDays, mondayOf } from '../core/facts.ts'
import { PLAN_BY } from './lib/boss.ts'
import { Win } from './App.tsx'
import { BallItem } from './Ball.tsx'
import { ItemIcon } from './Item.tsx'
import { KBar } from './Kit.tsx'
import { HpBar } from './screens/HpBar.tsx'
import { Sheet } from './screens/Sheet.tsx'
import { typeColor } from './screens/types.ts'
import { fmtDay } from './lib/art.ts'
import { EASE, K, dropIn, floatNote, hit, motionConfig, party, ring, run, stamp } from './lib/fx.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

const ICON: Record<BossKind, string> = { gym: 'iron', arbor: 'grn-apricorn', shed: 'poke-flute', sleep: 'lunar-wing', life: 'journal' }
const pct = (x: number): string => `${Math.round(x * 100)}%`

/** Before there is a boss: what it takes, so the goal is in view. */
function Locked({ game }: { game: Game }) {
  const need = bossNeed(game.today.day || '9999-99-99')
  const have = Math.min(need, game.bossParty)
  // a card is drawn only in the first PLAN_BY days of a week (lib/boss.ts)
  const today = game.today.day
  const soon = Boolean(today) && today <= addDays(mondayOf(today), PLAN_BY)
  return (
    <div className="duel static bosslock" title={`A boss is a week-long fight. It comes once your party is ${need}: the partner and ${need - 1} more. A bigger party hits it harder.`}>
      <ItemIcon id="master-ball" size={30} />
      <span>
        <b>{have < need ? `A boss comes once your party is ${need}` : soon ? 'A boss arrives this week' : 'A boss comes on Monday'}</b>
        <small>{have < need ? `${have} of ${need} in your party: add ${need - have} more to bring one out. Fully trained members make a throw at it likelier.` : soon ? 'Your party is ready: it is drawn the next time the Pokedex syncs. A fuller party hits it harder.' : 'Your party is ready. A boss is drawn in the first days of each week. A fuller party hits it harder.'}</small>
      </span>
      <span className="bosslock-pips" aria-hidden>{Array.from({ length: need }, (_, i) => <i key={i} className={i < have ? 'on' : ''} />)}</span>
    </div>
  )
}

/** The ball goes out, closes on it, rocks three times, and either clicks shut or bursts open. */
async function throwScene(stage: HTMLElement, sprite: HTMLElement, caught: boolean): Promise<void> {
  if (motionConfig.reduced) return
  const ball = stage.querySelector<HTMLElement>('.boss-ball')
  if (!ball) return
  // out on an arc, like a potion falling: up 100 ms, down onto it
  await run(ball, K(420, [[0, { t: { x: -220, y: 60, s: 0.6, r: -200 }, o: 1 }, EASE.out], [200, { t: { x: -90, y: -90, s: 1, r: -60 }, o: 1 }, EASE.in], [420, { t: { x: 0, y: 0, s: 1, r: 0 }, o: 1 }]]), { dur: 420 })
  ring(stage, '#fff', 36)
  void run(sprite, K(180, [[0, { t: { s: 1 }, o: 1 }, EASE.in], [180, { t: { s: 0.05 }, o: 0 }]]), { dur: 180 })
  for (let i = 0; i < 3; i++) {
    await run(ball, K(520, [[0, { t: { r: 0 } }, EASE.inOut], [130, { t: { r: -22 } }, EASE.inOut], [260, { t: { r: 18 } }, EASE.inOut], [390, { t: { r: -8 } }, EASE.inOut], [520, { t: { r: 0 } }]]), { dur: 520, delay: 180 })
    play('click', i)
  }
  if (caught) {
    await run(ball, K(260, [[0, { t: { s: 1 } }, EASE.out], [100, { t: { s: 1.22 } }, EASE.inOut], [260, { t: { s: 1 } }]]), { dur: 260 })
  } else {
    void run(ball, K(160, [[0, { t: { s: 1 }, o: 1 }], [160, { t: { s: 1.8 }, o: 0 }]]), { dur: 160 })
    sprite.getAnimations().forEach((a) => a.cancel())
    dropIn(sprite, true)
  }
}

function Fight({ boss, game }: { boss: BossView; game: Game }) {
  const stage = useRef<HTMLDivElement>(null)
  const sprite = useRef<HTMLImageElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const was = useRef<{ taken: number; killed: boolean; week: string } | null>(null)
  // what just happened to it is played on it
  useEffect(() => {
    const prev = was.current
    was.current = { taken: boss.taken, killed: boss.killed, week: boss.week }
    if (!prev || prev.week !== boss.week) { dropIn(sprite.current, true); return }
    if (boss.taken > prev.taken + 0.001) { hit(sprite.current, 'left'); floatNote(stage.current, `−${Math.round((boss.taken - prev.taken) * boss.max)}`, 'red') }
    if (boss.killed && !prev.killed) { stamp(stage.current, 'BOSS DOWN', 'purple'); party(stage.current, 60) }
  }, [boss.taken, boss.killed, boss.week])

  // the same sum the game makes: the throw and the Zoom Lens
  const odds = (item: string): number => Math.min(1, catchChance(item, boss.trained, boss.allDone, boss.hpLeft, boss.strike) + (game.v13 && game.partner.held === 'zoom-lens' ? 0.05 : 0))
  const balls = Object.keys(BALLS).filter((b) => (game.inv[b] ?? 0) > 0)
    .sort((a, b) => odds(b) - odds(a))
  const toss = async (item: string) => {
    if (busy || !stage.current || !sprite.current) return
    // the ball has to be on the page before the scene can move it
    flushSync(() => setBusy(item))
    play('throw')
    // the same seeded roll the game makes, so the ending shown is the one that happens
    const caught = rng(`boss-catch:${boss.week}:${boss.throws + 1}`)() < odds(item)
    await throwScene(stage.current, sprite.current, caught)
    stamp(stage.current, caught ? 'GOTCHA!' : 'BROKE FREE', caught ? 'gold' : 'red')
    if (caught) party(stage.current, 70)
    play(caught ? 'catch' : 'hit')
    useItem(item, '', 'boss-throw')
    setBusy(null)
  }

  const type = SPECIES[boss.form]?.t
  // where each task's share of the bar ends
  const edges = boss.tasks.slice(0, -1).map((_, i) => boss.tasks.slice(0, i + 1).reduce((n, t) => n + t.share, 0))
  return (
    <Win title={`Boss: ${nameOf(boss.form)}`} tone="purple" aside={boss.caught ? 'Caught' : boss.fled ? 'Gone' : `Lv ${boss.level} · ${boss.daysLeft === 0 ? 'last day' : `${boss.daysLeft} ${boss.daysLeft === 1 ? 'day' : 'days'} left`}`}>
      <div className={`boss r-${boss.rarity} ${boss.mega ? 'mega' : ''}`}>
        <div className="boss-stage" ref={stage}>
          <img ref={sprite} src={spritePath(boss.form)} alt="" width={120} height={120} className={`sprite ${boss.caught || boss.fled ? 'gone' : ''}`} />
          {busy && <span className="boss-ball"><BallItem id={busy} size={44} /></span>}
          {boss.caught && <span className="boss-caught"><ItemIcon id="poke-ball" size={44} /></span>}
        </div>
        <div className="boss-info">
          <div className="boss-hp" title="Each segment is one task on the card">
            <HpBar value={boss.hp} max={boss.max} label={`${boss.hp.toLocaleString('en-IN')} / ${boss.max.toLocaleString('en-IN')} HP`} segments={edges} />
          </div>
          <p className="boss-line">
            {type && <><img src={`/sprites/types/${type}.png`} alt="" width={14} height={14} /> {type} · </>}
            {boss.rarity === 'L' ? (boss.mega ? 'Mega legendary' : 'Legendary') : 'Rare'} · your party hits at <b>{pct(boss.strike)}</b>{boss.common > 0 ? <>, +{pct(boss.common)} from the team</> : null}
          </p>
          {boss.strike < 0.999 && !boss.caught && <p className="muted">It is levelled to your party and stronger than it. Finishing stronger Pokemon, a Mega and a higher bond all raise the hit.</p>}
        </div>
      </div>

      <ul className="boss-tasks">
        {boss.tasks.map((t, i) => (
          <li key={i} className={t.p >= 1 ? 'done' : ''}>
            <ItemIcon id={ICON[t.kind]} size={30} />
            <span className="boss-task">
              <b>{t.text}</b>
              <small>{BOSS_WHERE[t.kind]} · {pct(t.share)} of its HP</small>
              <KBar value={Math.round(t.p * 100)} max={100} ready={t.p >= 1} kind={t.p >= 1 ? '' : 'gold'} label={t.p >= 1 ? 'Done' : pct(t.p)} />
            </span>
          </li>
        ))}
      </ul>

      {!boss.caught && !boss.fled && boss.taken >= KILL_CAP - 1e-9 && !boss.allDone && <p className="notice warn">The last of its HP only falls when every task on the card is done.</p>}
      {boss.caught && <p className="notice good">Caught. It is in My Pokemon.</p>}
      {boss.fled && <p className="notice warn">It broke free three times and left. Another comes on Monday.</p>}
      {!boss.caught && !boss.fled && (boss.canThrow
        ? (
          <div className="boss-throws">
            <p className="muted">It is weak enough to throw at. {boss.throwsLeft} {boss.throwsLeft === 1 ? 'throw' : 'throws'} left. A finished card, less HP on it and a stronger party all raise the chance.</p>
            <div className="actions">
              {balls.length === 0 && <p className="muted">You have no balls. The Mart sells them.</p>}
              {balls.map((b) => (
                <button key={b} type="button" className="k-btn main act" disabled={Boolean(busy)} onClick={() => void toss(b)} title={`${itemName(b)} at the boss`}>
                  <BallItem id={b} size={30} />
                  <span>{itemName(b)}<small>{pct(odds(b))} a throw · {game.inv[b]} left</small></span>
                </button>
              ))}
            </div>
          </div>
        )
        : <p className="muted">You can throw at it once it is at {pct(THROW_AT)} HP or less. It heals a little on a day the card does not move.</p>)}
    </Win>
  )
}

/** The boss as a tile on Today: who it is, what is left of it, how the card is going. Tap for the whole fight. With none, what it takes to bring one out. */
export function BossTile({ game }: { game: Game }) {
  const [open, setOpen] = useState(false)
  const b = game.boss
  if (!b) return <Locked game={game} />
  const done = b.tasks.filter((t) => t.p >= 1).length
  const state = b.caught ? 'Caught' : b.fled ? 'It left' : b.canThrow ? 'Throw now' : b.daysLeft === 0 ? 'Last day' : `${b.daysLeft} ${b.daysLeft === 1 ? 'day' : 'days'} left`
  return (
    <>
      <button type="button" className={`duel boss-duel ${b.canThrow ? 'hot' : ''}`} style={{ ['--tc' as string]: typeColor(SPECIES[b.form]?.t) }} onClick={() => setOpen(true)} aria-label={`Boss ${nameOf(b.form)}, level ${b.level}, ${b.hp} HP left. Open the fight`}>
        <span className="duel-art"><img src={spritePath(b.form)} alt="" width={72} height={72} className="sprite" /></span>
        <span className="duel-txt">
          <span className="k-label">Weekly boss · Lv {b.level}</span>
          <b>{nameOf(b.form)}</b>
          <HpBar value={b.hp} max={b.max} />
          <small>{done} of {b.tasks.length} tasks · <em>{state}</em></small>
        </span>
      </button>
      {open && <Sheet title={`Boss: ${nameOf(b.form)}`} onClose={() => setOpen(false)}><Fight boss={b} game={game} /></Sheet>}
    </>
  )
}

/** Every boss so far, for the Journey tab. */
export function BossLog({ game }: { game: Game }) {
  if (!game.bossLog.length) {
    return (
      <Win title="Bosses" tone="purple" fold aside="None yet">
        <p className="muted">{game.bossParty >= bossNeed(game.today.day || '9999-99-99') ? 'A boss comes on Monday. Each one you meet, beat or catch is listed here.' : `A boss comes each Monday once your party is ${bossNeed(game.today.day || '9999-99-99')} (${game.bossParty} now). Each one you meet, beat or catch is listed here.`}</p>
      </Win>
    )
  }
  return (
    <Win title="Bosses" tone="purple" aside={`${game.bossLog.filter((b) => b.caught).length} caught`}>
      <ul className="boss-log">
        {[...game.bossLog].reverse().map((b) => (
          <li key={b.week}>
            <img src={spritePath(b.form)} alt="" width={44} height={44} className="sprite" />
            <span><b>{nameOf(b.form)}</b><small>Lv {b.level} · week of {fmtDay(b.week)}</small></span>
            <span className={`chip ${b.caught ? 'mega' : ''}`}>{b.caught ? 'Caught' : b.killed ? 'Beaten' : `${pct(b.taken)} taken`}</span>
          </li>
        ))}
      </ul>
    </Win>
  )
}
