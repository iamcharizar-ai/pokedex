// The Professor's lab as the same kind of screen as the party: the desk is three places and the box under
// it holds everyone else not in the party, as cards. Drag a card to a place on the desk (a card there
// swaps) or back to the box; or tap a card for Info and a button that does the same. One `study` event
// holds the whole desk.
import { useMemo, useRef, useState } from 'react'
import { nameOf, type Game, type Mon } from '../core/fold.ts'
import { RESEARCH_SLOTS, levelOf } from '../core/rules.ts'
import { SPECIES } from '../core/species.ts'
import { Win, plural } from './App.tsx'
import { KButton } from './Kit.tsx'
import { MonCard } from './MonCard.tsx'
import { ResearchLab } from './screens/Lab.tsx'
import { Sheet } from './screens/Sheet.tsx'
import { startPress, type DragHooks } from './lib/dragcards.ts'
import { CardMenu, LookToggle, SortBar, useFlip, useLook } from './lib/cardkit.tsx'
import { IcInfo, IcLab, IcSwap } from './lib/icons.tsx'
import { boxOf, planDesk, type Target } from './lib/party.ts'
import { play } from './lib/sfx.ts'
import { applyPlan, monCardOf, say } from './Team.tsx'

type Sort = 'study' | 'level' | 'type' | 'new'
const SORTS: [Sort, string][] = [['study', 'Study'], ['level', 'Level'], ['type', 'Type'], ['new', 'Newest']]
const KEEP = 'pokedex.boxsort.v1'
const savedSort = (): Sort => { try { const v = localStorage.getItem(KEEP); return SORTS.some(([s]) => s === v) ? (v as Sort) : 'study' } catch { return 'study' } }

interface Drag { uid: string; over: Target | null; can: { places: boolean[]; box: boolean } }

/** A move on the desk: the plan, then its event. */
function moveDesk(game: Game, uid: string, to: Target): boolean {
  const plan = planDesk(game, uid, to)
  if (!plan.ok) { say(plan.why, true); play('click'); return false }
  applyPlan(plan)
  if (plan.ops.length) play('tap')
  return true
}

export function ResearchTab({ game, onOpen, studyValue }: { game: Game; onOpen: (uid: string) => void; studyValue: (m: Mon) => number }) {
  const desk = game.research.desk
  const box = boxOf(game)
  const [sort, setSort] = useState<Sort>(savedSort)
  const [menu, setMenu] = useState<{ uid: string; onDesk: boolean; rect: DOMRect } | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const { look, setLook, boxOf: spriteBox } = useLook()
  const cp = (m: Mon) => ({ mon: monCardOf(m, game), look, box: spriteBox(m.form) })
  const shown = useMemo(() => {
    const at = new Map(box.map((m, i) => [m.uid, i]))
    const key: Record<Sort, (m: Mon) => number | string> = { study: (m) => -studyValue(m), level: (m) => -levelOf(m.xp), type: (m) => SPECIES[m.form].t, new: (m) => -Date.parse(m.from || '1970-01-01') }
    return [...box].sort((a, b) => (key[sort](a) < key[sort](b) ? -1 : key[sort](a) > key[sort](b) ? 1 : (at.get(a.uid) ?? 0) - (at.get(b.uid) ?? 0)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.map((m) => m.uid).join(','), sort, game.research.rank])
  const byUid = new Map([...desk, ...box].map((m) => [m.uid, m]))
  const menuMon = menu ? byUid.get(menu.uid) : undefined
  const setBy = (s: Sort) => { setSort(s); try { localStorage.setItem(KEEP, s) } catch { /* not remembered */ } play('click') }
  const openMenu = (m: Mon, onDesk: boolean) => (e: { currentTarget: HTMLElement }) => { setMenu({ uid: m.uid, onDesk, rect: e.currentTarget.getBoundingClientRect() }); play('click') }

  // dragging, as on the Team screen: places 0 to 2 on the desk, and the box
  const now = useRef(game)
  now.current = game
  const held = useRef<string | null>(null)
  const hooks = useMemo<DragHooks>(() => ({
    begin: (uid) => {
      held.current = uid
      setMenu(null)
      const takes = (t: Target): boolean => { const p = planDesk(now.current, uid, t); return p.ok && p.ops.length > 0 }
      setDrag({ uid, over: null, can: { places: Array.from({ length: RESEARCH_SLOTS }, (_, i) => takes({ slot: i })), box: takes('lab') } })
    },
    hover: (t) => setDrag((d) => (d ? { ...d, over: t } : d)),
    drop: (uid, t) => {
      if (t === null) return false
      const plan = planDesk(now.current, uid, t)
      if (!plan.ok) { say(plan.why, true); return false }
      return plan.ops.length > 0 && moveDesk(now.current, uid, t)
    },
    end: () => { held.current = null; setDrag(null) },
  }), [])
  const press = (m: Mon) => (e: React.PointerEvent<HTMLElement>) => startPress({ x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, button: e.button }, m.uid, e.currentTarget, hooks)
  const mark = (t: Target): string => {
    if (!drag) return ''
    const ok = t === 'lab' ? drag.can.box : drag.can.places[t.slot]
    const here = drag.over !== null && (t === 'lab' ? drag.over === 'lab' : drag.over !== 'lab' && drag.over.slot === t.slot)
    return `${ok ? 'can' : ''} ${here ? (ok ? 'drop-ok' : 'drop-bad') : ''}`
  }
  useFlip(held)

  const deskRow = (
    <div className="lab-desk mc-zone">
      <div className="lab-cards" role="list" aria-label="The desk">
        {Array.from({ length: RESEARCH_SLOTS }, (_, i) => {
          const m = desk[i]
          return (
            <div key={i} role="listitem" data-place={i} data-flip={m?.uid} className={`pl ${mark({ slot: i })}`}>
              {m
                ? <>
                  <MonCard {...cp(m)} role="party" held={drag?.uid === m.uid} onClick={openMenu(m, true)} onPointerDown={press(m)} aria-haspopup="menu" />
                  <small className="lab-pay">+{studyValue(m)} a day</small>
                </>
                : <MonCard state="empty" look={look} emptyText={box.length ? 'Add' : 'Empty'} disabled={box.length === 0} onClick={() => { setPick(i); play('tap') }} aria-label={box.length ? 'Empty place on the desk: pick someone from the box' : 'Empty place on the desk'} />}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <>
      <ResearchLab game={game} desk={deskRow} />
      <Win title="Lab box" tone="dark" aside={plural(box.length, 'Pokemon', 'Pokemon')}>
        <div className="mc-head">
          <span className="k-label">Sort</span>
          <SortBar sorts={SORTS} value={sort} onChange={setBy} />
          <LookToggle look={look} setLook={setLook} />
        </div>
        <div className={`mc-zone mc-labzone ${mark('lab')}`} data-lab>
          <div className="mon-grid" role="list" aria-label="The lab box">
            {shown.map((m) => <div key={m.uid} role="listitem" data-flip={m.uid}><MonCard {...cp(m)} role="lab" held={drag?.uid === m.uid} onClick={openMenu(m, false)} onPointerDown={press(m)} aria-haspopup="menu" /></div>)}
            {shown.length < 4 && (
              <div className="mc-emptylab">
                <IcLab size={26} />
                <b>{shown.length ? 'Room for more' : 'Everyone else is on the desk or in your party'}</b>
                <small>Drag a card up to the desk to have it studied. Catch the wild Pokemon and it comes here. Drag a card from the desk back here to take it off.</small>
              </div>
            )}
          </div>
        </div>
      </Win>

      {menu && menuMon && (
        <CardMenu anchor={menu.rect} title={nameOf(menuMon.form)} onClose={() => setMenu(null)}>
          <KButton onClick={() => { onOpen(menuMon.uid); setMenu(null) }}><IcInfo size={16} /> Info</KButton>
          {menu.onDesk
            ? <KButton tone="main" onClick={() => { moveDesk(game, menuMon.uid, 'lab'); setMenu(null) }}><IcLab size={16} /> Off the desk</KButton>
            : <KButton tone="main" onClick={() => { moveDesk(game, menuMon.uid, { slot: Math.min(desk.length, RESEARCH_SLOTS - 1) }); setMenu(null) }}><IcSwap size={16} /> To the desk</KButton>}
        </CardMenu>
      )}

      {pick !== null && (
        <Sheet title="Who goes on the desk" onClose={() => setPick(null)}>
          <div className="mc-pick">
            <h2 className="k-type">On the desk</h2>
            <p className="muted">Pick from the box. The Professor studies them by level and rarity.</p>
            <div className="mon-grid">
              {shown.map((m) => <MonCard key={m.uid} {...cp(m)} role="lab" onClick={() => { if (moveDesk(game, m.uid, { slot: pick })) setPick(null) }} />)}
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}
