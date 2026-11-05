// The Professor's lab: the desk is three places, filled from everyone not in the party. Those Pokemon are
// drawn once, as the lab on the Team screen (UI-AUDIT-2026-11-04: one collection, one grid); here an open
// place, or Replace on a desk card, opens them as a picker sheet, best for study first. Cards on the desk
// can be dragged between its places. One `study` event holds the whole desk.
import { useMemo, useRef, useState } from 'react'
import { nameOf, type Game, type Mon } from '../core/fold.ts'
import { RESEARCH_SLOTS } from '../core/rules.ts'
import { KButton } from './Kit.tsx'
import { MonCard } from './MonCard.tsx'
import { ResearchLab } from './screens/Lab.tsx'
import { Sheet } from './screens/Sheet.tsx'
import { startPress, type DragHooks } from './lib/dragcards.ts'
import { CardMenu, useFlip, useLook } from './lib/cardkit.tsx'
import { IcInfo, IcLab, IcSwap } from './lib/icons.tsx'
import { boxOf, planDesk, type Target } from './lib/party.ts'
import { play } from './lib/sfx.ts'
import { applyPlan, monCardOf, say } from './Team.tsx'
import { deskShare } from './Play.tsx'


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
  const [menu, setMenu] = useState<{ uid: string; onDesk: boolean; rect: DOMRect } | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const { look, boxOf: spriteBox } = useLook()
  const cp = (m: Mon) => ({ mon: monCardOf(m, game), look, box: spriteBox(m.form) })
  const shown = useMemo(() => {
    const at = new Map(box.map((m, i) => [m.uid, i]))
    // the picker: the best for study first, ties in the lab's own order
    return [...box].sort((a, b) => studyValue(b) - studyValue(a) || (at.get(a.uid) ?? 0) - (at.get(b.uid) ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.map((m) => m.uid).join(','), game.research.rank])
  const byUid = new Map([...desk, ...box].map((m) => [m.uid, m]))
  const menuMon = menu ? byUid.get(menu.uid) : undefined
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
                  <small className="lab-pay">{game.tier.v21 ? `+${Math.round(deskShare(m) * 100)}% research` : `+${studyValue(m)} a day`}</small>
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
      {menu && menuMon && (
        <CardMenu anchor={menu.rect} title={nameOf(menuMon.form)} onClose={() => setMenu(null)}>
          <KButton onClick={() => { onOpen(menuMon.uid); setMenu(null) }}><IcInfo size={16} /> Info</KButton>
          {menu.onDesk && box.length > 0 && <KButton tone="main" onClick={() => { setPick(desk.findIndex((x) => x.uid === menuMon.uid)); setMenu(null) }}><IcSwap size={16} /> Replace</KButton>}
          {menu.onDesk
            ? <KButton onClick={() => { moveDesk(game, menuMon.uid, 'lab'); setMenu(null) }}><IcLab size={16} /> Off the desk</KButton>
            : <KButton tone="main" onClick={() => { moveDesk(game, menuMon.uid, { slot: Math.min(desk.length, RESEARCH_SLOTS - 1) }); setMenu(null) }}><IcSwap size={16} /> To the desk</KButton>}
        </CardMenu>
      )}

      {pick !== null && (
        <Sheet title="Who goes on the desk" onClose={() => setPick(null)}>
          <div className="mc-pick">
            <h2 className="k-type">On the desk</h2>
            <p className="muted">The best for study first: the Professor studies them by level and rarity.</p>
            <div className="mon-grid">
              {shown.map((m) => <MonCard key={m.uid} {...cp(m)} role="lab" onClick={() => { if (moveDesk(game, m.uid, { slot: pick })) setPick(null) }} />)}
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}
