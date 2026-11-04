// The Team screen as a deck builder: six places (the partner, then five), the lab under them, a card for
// every Pokemon. Where a card stands IS its role, so there is no "make next / partner now / take out"
// to choose between: drag a card to a place (or to the lab), or tap it for Info, Use or Replace.
// Every move goes through lib/party.ts, which writes the same lead and team events as before.
// A place can be left open; if it is still open an hour later the app fills it from the lab.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { nameOf, type Game, type Mon } from '../core/fold.ts'
import { BERRY_DOMAIN_MULT, signatureOf } from '../core/bond.ts'
import { BERRY_HEARTS, itemName } from '../core/economy.ts'
import { HEART_CAP, HEART_LEVELS, MAX_LEVEL, bondLevel, levelOf, xpForLevel } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { Win } from './App.tsx'
import { heartsOf, treatsIn } from './Feed.tsx'
import { ItemIcon } from './Item.tsx'
import { KButton } from './Kit.tsx'
import { CardMenu, LookToggle, useFlip, useLook } from './lib/cardkit.tsx'
import { MonCard, type MonCardData } from './MonCard.tsx'
import { Sheet } from './screens/Sheet.tsx'
import { startPress, type DragHooks } from './lib/dragcards.ts'
import { IcArrowUp, IcHeart, IcInfo, IcLab, IcSort, IcSwap } from './lib/icons.tsx'
import { FILL_AFTER_MS, PLACES, canLead, hasOpen, labOf, nextPlace, placesOf, planFill, planMove, type Plan, type Target } from './lib/party.ts'
import { play } from './lib/sfx.ts'
import { useItem } from './lib/store.ts'

// ── what a card shows, from the game ────────────────────────────────────────
const bagHearts = (game: Game): number => Object.entries(BERRY_HEARTS).reduce((n, [id, h]) => n + (game.inv[id] ?? 0) * h, 0)

export function monCardOf(m: Mon, game: Game): MonCardData {
  const lv = levelOf(m.xp)
  const into = lv >= MAX_LEVEL || m.graduated ? 1 : (m.xp - xpForLevel(lv)) / Math.max(1, xpForLevel(lv + 1) - xpForLevel(lv))
  const hearts = heartsOf(m)
  const need = hearts >= HEART_CAP ? null : HEART_LEVELS[bondLevel(hearts)]
  const s = signatureOf(m.form)
  return {
    form: m.form, name: nameOf(m.form), shiny: m.shiny, level: lv, into, hearts, need, type: SPECIES[m.form].t,
    sig: game.v16 ? { icon: s.icon, name: s.name } : undefined,
    canFeed: need !== null && bagHearts(game) >= need - hearts,
    mega: Boolean(m.megas?.length), trained: Boolean(m.graduated),
  }
}

// ── a short message that does not block ─────────────────────────────────────
const SAY = 'pokedex:say'
/** Say something about a move: what happened, or why it cannot. */
export const say = (text: string, bad = false): void => { window.dispatchEvent(new CustomEvent(SAY, { detail: { text, bad } })) }

export function PartyToast() {
  const [msg, setMsg] = useState<{ text: string; bad: boolean; n: number } | null>(null)
  useEffect(() => {
    let timer = 0
    const on = (e: Event) => {
      const { text, bad } = (e as CustomEvent<{ text: string; bad: boolean }>).detail
      setMsg((m) => ({ text, bad, n: (m?.n ?? 0) + 1 }))
      clearTimeout(timer)
      timer = window.setTimeout(() => setMsg(null), 4200)
    }
    window.addEventListener(SAY, on)
    return () => { window.removeEventListener(SAY, on); clearTimeout(timer) }
  }, [])
  if (!msg) return null
  return createPortal(<div key={msg.n} className={`mc-toast ${msg.bad ? 'bad' : ''}`} role="status">{msg.text}</div>, document.body)
}

// ── how long a place has been open ──────────────────────────────────────────
const OPEN_KEY = 'pokedex.openplace.v1'
let openMem: number | null = null
const openSince = (): number | null => { try { const v = localStorage.getItem(OPEN_KEY); return v ? Number(v) : openMem } catch { return openMem } }
const setOpenSince = (t: number | null): void => { openMem = t; try { if (t === null) localStorage.removeItem(OPEN_KEY); else localStorage.setItem(OPEN_KEY, String(t)) } catch { /* kept in memory */ } }

/** Write a plan's events, in order; note when a place is left open, so the hour starts from now. */
export function applyPlan(plan: Plan): boolean {
  if (!plan.ok) return false
  for (const op of plan.ops) useItem('', op.uid, op.what, op.to)
  const t = plan.ops.find((op) => op.what === 'team')?.to
  if (t !== undefined) setOpenSince(t.split(',').includes('-') ? Date.now() : null)
  return true
}

/** Do a move: the plan, then its events. The reason is said when it cannot be done. */
export function move(game: Game, uid: string, to: Target): boolean {
  const plan = planMove(game, uid, to)
  if (!plan.ok) { say(plan.why, true); play('click'); return false }
  applyPlan(plan)
  if (plan.ops.length) { play('tap'); if (plan.note) say(plan.note) }
  return true
}

/**
 * A place left open is filled from the lab (the oldest first) once it has been open for an hour:
 * for whoever forgot to put someone there. Mounted once, at the top of the app, so it works from any tab.
 */
export function PartyAutoFill({ game }: { game: Game }) {
  const now = useRef(game)
  now.current = game
  const check = useRef(() => {})
  check.current = () => {
    const g = now.current
    if (!hasOpen(g)) { if (openSince() !== null) setOpenSince(null); return }
    const since = openSince()
    if (since === null) { setOpenSince(Date.now()); return }
    if (Date.now() - since < FILL_AFTER_MS) return
    const plan = planFill(g)
    if (!plan) return // nobody in the lab yet: it fills the moment there is someone
    applyPlan(plan)
    if (plan.ok && plan.note) say(plan.note)
  }
  useEffect(() => { check.current() }, [game.teamSlots, game.queue.length, game.graduates.length])
  useEffect(() => {
    const id = window.setInterval(() => check.current(), 60_000)
    const wake = () => { if (!document.hidden) check.current() }
    document.addEventListener('visibilitychange', wake)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', wake) }
  }, [])
  return null
}

// ── where someone stands, as buttons (the page of a Pokemon) ────────────────
export function RoleControl({ game, m, onDone }: { game: Game; m: Mon; onDone: () => void }) {
  const here = m.uid === game.partner.uid ? 'partner' : game.teamSlots.some((x) => x?.uid === m.uid) ? 'party' : 'lab'
  const lead = canLead(game, m)
  const pick = (to: 'partner' | 'party' | 'lab') => {
    if (to === here) return
    const target: Target = to === 'partner' ? { slot: 0 } : to === 'lab' ? 'lab' : { slot: nextPlace(game) }
    if (move(game, m.uid, target)) onDone()
  }
  const stays = 'The partner stays. Put someone else on the Partner place first.'
  const roles: ['partner' | 'party' | 'lab', string, string | null][] = [
    ['partner', 'Partner', here === 'partner' ? null : lead],
    ['party', 'Party', here === 'partner' ? stays : null],
    ['lab', 'Lab', here === 'partner' ? stays : null],
  ]
  return (
    <div className="mp-role">
      <span className="k-label">Where it stands</span>
      <div className="mp-seg" role="group" aria-label="Where it stands">
        {roles.map(([id, name, why]) => (
          <button key={id} type="button" aria-pressed={here === id} disabled={here !== id && Boolean(why)} title={why ?? undefined} onClick={() => pick(id)}>
            {id === 'lab' ? <IcLab size={16} /> : id === 'partner' ? <IcHeart size={14} /> : null}{name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── feeding: a chain of hearts and the big green button ─────────────────────
/**
 * Hearts and the Feed button, like an Upgrade. The bar is a chain with one link for each heart the next
 * bond level takes. The berry picked shows its hearts as striped links ahead of the filled ones; feeding
 * fills them in, left to right. Hold the button to keep feeding.
 */
export function FeedBlock({ game, m }: { game: Game; m: Mon }) {
  const hearts = heartsOf(m), full = hearts >= HEART_CAP
  const lvl = bondLevel(hearts)
  const treats = treatsIn(game)
  const [chosen, setChosen] = useState<string | null>(null)
  const berry = chosen && treats.includes(chosen) ? chosen : treats[0] ?? null
  const sig = signatureOf(m.form)
  const twice = Boolean(game.v16 && game.worked[sig.tag] && !full)
  const gain = berry ? Math.min(BERRY_HEARTS[berry] * (twice ? BERRY_DOMAIN_MULT : 1), game.v16 ? HEART_CAP - hearts : Infinity) : 0
  const can = Boolean(berry) && !full

  // the links of a bond level: one for each heart it takes
  const segOf = (h: number) => {
    const l = bondLevel(h), f = h >= HEART_CAP
    const st = l === 0 ? 0 : HEART_LEVELS[l - 1]
    const en = f ? HEART_CAP : HEART_LEVELS[l]
    return { start: st, total: en - st, filled: f ? en - st : h - st, room: en - h }
  }
  const cur = segOf(hearts)
  const pre = can ? Math.min(gain, cur.room) : 0
  const spill = can && gain > cur.room

  // what was just fed fills in link by link; a bond level reached first fills the level it finished, then the chain starts over
  const seen = useRef(hearts)
  const [sweep, setSweep] = useState<{ from: number; to: number; up: boolean; old: boolean } | null>(null)
  useLayoutEffect(() => {
    if (hearts <= seen.current) { seen.current = hearts; return }
    const was = seen.current
    seen.current = hearts
    const up = bondLevel(was) < bondLevel(hearts)
    setSweep({ from: was, to: hearts, up, old: up })
    const t1 = window.setTimeout(() => setSweep((x) => (x ? { ...x, old: false } : x)), 750)
    const t2 = window.setTimeout(() => setSweep(null), 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [hearts])
  // while the finished level is still filling in, draw it instead of the new one
  const shown = sweep?.old ? { ...segOf(sweep.from), filled: segOf(sweep.from).total } : cur
  const showPre = sweep?.old ? 0 : pre
  const { start, total, filled } = shown
  // one row of links while they fit, else two rows, filled left to right then down (never a sideways scroll)
  const cols = total <= 20 ? total : Math.ceil(total / 2)
  const sweepFrom = sweep?.from ?? 0
  const sweepTo = sweep?.old ? start + total : sweep?.to ?? 0

  // the hold loop outlives a render: it asks the latest numbers, not the ones it was started with
  const latest = useRef({ can, berry, uid: m.uid })
  latest.current = { can, berry, uid: m.uid }
  const timer = useRef(0)
  const held = useRef(0)
  const stop = () => { clearTimeout(timer.current); held.current = 0 }
  useEffect(() => stop, [])
  const feed = (): boolean => {
    const l = latest.current
    if (!l.can || !l.berry) return false
    useItem(l.berry, l.uid, 'feed')
    play('feed')
    return true
  }
  const tick = () => {
    if (!feed()) return stop()
    held.current += 1
    timer.current = window.setTimeout(tick, Math.max(70, 330 - held.current * 30))
  }
  return (
    <div className="mp-feed">
      <div className="mp-feed-top">
        <span><IcHeart size={14} style={{ color: 'var(--k-pink)' }} /> {full ? 'Every bond level' : `Bond ${lvl}`}</span>
        {spill && <small className="up"><IcArrowUp size={12} /> Level up</small>}
      </div>
      <div className={`chain ${full ? 'full' : ''} ${sweep?.up && !sweep.old ? 'lvlup' : ''}`} style={{ ['--cols' as string]: cols } as CSSProperties} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={filled} aria-label={full ? 'Every bond level reached' : `${filled} of ${total} hearts to the next bond level`}>
        {Array.from({ length: total }, (_, i) => {
          const h = start + i
          const on = i < filled
          const grow = sweep !== null && on && h >= sweepFrom && h < sweepTo
          return <i key={i} className={`link ${i % cols === cols - 1 ? 'end' : ''} ${on ? 'on' : i < filled + showPre ? 'pre' : ''} ${grow ? 'grow' : ''}`} style={grow ? { animationDelay: `${(h - sweepFrom) * 40}ms` } : undefined} />
        })}
      </div>
      {treats.length > 1 && (
        <div className="mp-berries" role="radiogroup" aria-label="Which berry">
          {treats.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={b === berry} title={`${itemName(b)}: +${BERRY_HEARTS[b]} hearts`} onClick={() => { setChosen(b); play('tap') }}>
              <ItemIcon id={b} size={28} /><i>{game.inv[b]}</i>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="k-btn ok big"
        disabled={!can}
        onPointerDown={(e) => { if (e.button !== 0 || !can) return; feed(); stop(); timer.current = window.setTimeout(tick, 420) }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={(e) => { if (e.detail === 0) feed() }}
      >
        {full ? 'Nothing left to feed' : berry ? <>Feed <span className="cost"><ItemIcon id={berry} size={20} />×1</span> +{gain} ♥{twice ? ` (×${BERRY_DOMAIN_MULT} today)` : ''}</> : 'No berries'}
      </button>
      {!berry && !full && <small className="muted">Berries are at the Mart and the Garden; Pickup finds them too. They are in the Items tab.</small>}
      {berry && !full && <small className="muted">Hold the button to keep feeding. {game.inv[berry] ?? 0} left.</small>}
    </div>
  )
}

// ── the sort of the lab ─────────────────────────────────────────────────────
type Sort = 'oldest' | 'level' | 'type' | 'new'
const SORTS: [Sort, string][] = [['oldest', 'Oldest'], ['level', 'Level'], ['type', 'Type'], ['new', 'Newest']]
const KEEP = 'pokedex.labsort.v1'
const savedSort = (): Sort => { try { const v = localStorage.getItem(KEEP); return SORTS.some(([s]) => s === v) ? (v as Sort) : 'oldest' } catch { return 'oldest' } }
/** Sorted, and stable: ties keep the lab's own order (the oldest first, which is who a free place fills with). */
export function sortLab(lab: Mon[], by: Sort): Mon[] {
  const at = new Map(lab.map((m, i) => [m.uid, i]))
  const key: Record<Sort, (m: Mon) => number | string> = {
    oldest: (m) => at.get(m.uid) ?? 0, level: (m) => -levelOf(m.xp), type: (m) => SPECIES[m.form].t, new: (m) => -Date.parse(m.from || '1970-01-01'),
  }
  return [...lab].sort((a, b) => (key[by](a) < key[by](b) ? -1 : key[by](a) > key[by](b) ? 1 : (at.get(a.uid) ?? 0) - (at.get(b.uid) ?? 0)))
}

// ── the screen ──────────────────────────────────────────────────────────────
type Menu = { uid: string; place: number | null; rect: DOMRect }
/** Dragging: who, where the pointer is, and which places (0 to 5) and the lab would take the card. */
interface Drag { uid: string; over: Target | null; can: { places: boolean[]; lab: boolean } }
const RIBBON: Record<number, string> = { 0: 'Partner' }

/** Who could go where: a place that takes the card and is not where it already is. */
function dropsFor(game: Game, uid: string): Drag['can'] {
  const takes = (t: Target): boolean => { const p = planMove(game, uid, t); return p.ok && p.ops.length > 0 }
  return { places: Array.from({ length: PLACES }, (_, i) => takes({ slot: i })), lab: takes('lab') }
}

export function TeamScreen({ game, onInfo }: { game: Game; onInfo: (uid: string) => void }) {
  const [menu, setMenu] = useState<Menu | null>(null)
  /** a sheet of cards: pick who goes to a place (`pick`), or where someone goes (`chooser`) */
  const [pick, setPick] = useState<number | null>(null)
  const [chooser, setChooser] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>(savedSort)
  const [drag, setDrag] = useState<Drag | null>(null)
  const places = placesOf(game)
  const lab = labOf(game)
  const shown = sortLab(lab, sort)
  const byUid = new Map([...places.filter((m): m is Mon => m !== null), ...lab].map((m) => [m.uid, m]))
  const menuMon = menu ? byUid.get(menu.uid) : undefined
  const card = (m: Mon) => monCardOf(m, game)
  const { look, setLook, boxOf } = useLook()
  const cp = (m: Mon) => ({ mon: card(m), look, box: boxOf(m.form) })
  const setBy = (s: Sort) => { setSort(s); try { localStorage.setItem(KEEP, s) } catch { /* the sort just is not remembered */ } play('click') }
  const openMenu = (m: Mon, place: number | null) => (e: { currentTarget: HTMLElement }) => { setMenu({ uid: m.uid, place, rect: e.currentTarget.getBoundingClientRect() }); play('click') }
  const bonus = Math.round(game.power.team * 100)
  const free = lab.length
  const open = hasOpen(game)

  // dragging: the drag layer tells these what is happening, they read the game as it is then
  const now = useRef(game)
  now.current = game
  const held = useRef<string | null>(null)
  const hooks = useMemo<DragHooks>(() => ({
    begin: (uid) => { held.current = uid; setMenu(null); setDrag({ uid, over: null, can: dropsFor(now.current, uid) }) },
    hover: (t) => setDrag((d) => (d ? { ...d, over: t } : d)),
    drop: (uid, t) => {
      if (t === null) return false
      const plan = planMove(now.current, uid, t)
      if (!plan.ok) { say(plan.why, true); return false }
      return plan.ops.length > 0 && move(now.current, uid, t)
    },
    end: () => { held.current = null; setDrag(null) },
  }), [])
  const press = (m: Mon) => (e: React.PointerEvent<HTMLElement>) => startPress({ x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, button: e.button }, m.uid, e.currentTarget, hooks)
  const mark = (t: Target): string => {
    if (!drag) return ''
    const ok = t === 'lab' ? drag.can.lab : drag.can.places[t.slot]
    const here = drag.over !== null && (t === 'lab' ? drag.over === 'lab' : drag.over !== 'lab' && drag.over.slot === t.slot)
    return `${ok ? 'can' : ''} ${here ? (ok ? 'drop-ok' : 'drop-bad') : ''}`
  }

  useFlip(held)

  return (
    <>
      <Win title="Your party" tone="gold" aside={game.team.length ? <span className="mc-chip" title="Each party member adds to every strike">+{bonus}% to every strike</span> : `${game.team.length + 1} of ${PLACES}`}>
        <div className="mc-zone">
          <div className="mc-party" role="list" aria-label="The six places">
            {Array.from({ length: PLACES }, (_, i) => {
              const m = places[i]
              return (
                <div key={i} role="listitem" data-place={i} data-flip={m?.uid} className={`pl ${mark({ slot: i })}`}>
                  {m
                    ? <MonCard {...cp(m)} role={i === 0 ? 'partner' : 'party'} ribbon={RIBBON[i]} held={drag?.uid === m.uid} onClick={openMenu(m, i)} onPointerDown={press(m)} aria-haspopup="menu" />
                    : <MonCard state="empty" look={look} emptyText={free ? 'Add' : 'Open'} disabled={free === 0} onClick={() => { setPick(i); play('tap') }} aria-label={free ? `Open place ${i + 1}: pick someone from the lab` : `Open place ${i + 1}: nobody in the lab to add`} />}
                </div>
              )
            })}
          </div>
        </div>
        <p className="mc-note">
          {open && free > 0
            ? 'Drag a card to a place, or tap an open one. A place still open after an hour fills with the oldest in the lab.'
            : open
              ? 'A place is open. Catch or hatch someone and it fills from the lab after an hour.'
              : 'Drag a card to a place or to the lab, or tap it. The first place is the partner: whoever stands there is the one you raise.'}
        </p>
      </Win>

      <Win title="In the lab" tone="dark" aside={`In lab: ${lab.length}`}>
        <div className="mc-head">
          <span className="k-label"><IcSort size={14} /> Sort</span>
          <div className="mc-sort" role="group" aria-label="Sort the lab">
            {SORTS.map(([id, name]) => <button key={id} type="button" aria-pressed={sort === id} onClick={() => setBy(id)}>{name}</button>)}
          </div>
          <LookToggle look={look} setLook={setLook} />
        </div>
        <div className={`mc-zone mc-labzone ${mark('lab')}`} data-lab>
          <div className="mon-grid" role="list" aria-label="In the lab">
            {shown.map((m) => <div key={m.uid} role="listitem" data-flip={m.uid}><MonCard {...cp(m)} role="lab" held={drag?.uid === m.uid} onClick={openMenu(m, null)} onPointerDown={press(m)} aria-haspopup="menu" /></div>)}
            {shown.length < 4 && (
              <div className="mc-emptylab">
                <IcLab size={26} />
                <b>{shown.length ? 'Room for more' : 'Everyone is in the party'}</b>
                <small>New catches and hatches wait here until you put them in a place. Drag a card here to take it out of the party.</small>
              </div>
            )}
          </div>
        </div>
      </Win>

      {menu && menuMon && (
        <CardMenu anchor={menu.rect} title={nameOf(menuMon.form)} onClose={() => setMenu(null)}>
          <KButton onClick={() => { onInfo(menuMon.uid); setMenu(null) }}><IcInfo size={16} /> Info</KButton>
          {menu.place === null
            ? <KButton tone="main" onClick={() => { setChooser(menuMon.uid); setMenu(null) }}><IcSwap size={16} /> Use</KButton>
            : <KButton tone="main" disabled={free === 0} onClick={() => { setPick(menu.place); setMenu(null) }}><IcSwap size={16} /> Replace</KButton>}
          {menu.place !== null && menu.place > 0 && <KButton onClick={() => { setChooser(menuMon.uid); setMenu(null) }}>Move to…</KButton>}
        </CardMenu>
      )}

      {pick !== null && (
        <Sheet title={`Who goes to ${pick === 0 ? 'the Partner place' : `place ${pick + 1}`}`} onClose={() => setPick(null)}>
          <div className="mc-pick">
            <h2 className="k-type">{pick === 0 ? 'A new partner' : `Place ${pick + 1}`}</h2>
            <p className="muted">{places[pick] ? `${nameOf(places[pick]!.form)} goes back to the lab.` : 'Pick from the lab.'}</p>
            <div className="mon-grid">
              {shown.map((m) => {
                const why = pick === 0 ? canLead(game, m) : null
                return <MonCard key={m.uid} {...cp(m)} role="lab" dimmed={Boolean(why)} title={why ?? undefined} onClick={() => { if (move(game, m.uid, { slot: pick })) setPick(null) }} />
              })}
            </div>
          </div>
        </Sheet>
      )}

      {chooser && byUid.get(chooser) && (() => {
        const m = byUid.get(chooser)!
        const from = places.findIndex((x) => x?.uid === m.uid)
        return (
          <Sheet title={`Move ${nameOf(m.form)}`} onClose={() => setChooser(null)}>
            <div className="mc-pick">
              <h2 className="k-type">Where does {nameOf(m.form)} go?</h2>
              <p className="muted">Pick a place. Whoever stands there swaps with it.</p>
              <div className="mc-party">
                {Array.from({ length: PLACES }, (_, i) => {
                  const o = places[i]
                  const go = () => { if (move(game, m.uid, { slot: i })) setChooser(null) }
                  return o
                    ? <MonCard key={i} {...cp(o)} role={i === 0 ? 'partner' : 'party'} ribbon={RIBBON[i]} selected={i === from} onClick={go} />
                    : <MonCard key={i} state="empty" emptyText="Open" onClick={go} />
                })}
              </div>
              {from > 0 && <button type="button" className="mc-pick-lab" onClick={() => { if (move(game, m.uid, 'lab')) setChooser(null) }}><IcLab size={18} /> Send to the lab</button>}
            </div>
          </Sheet>
        )
      })()}
    </>
  )
}
