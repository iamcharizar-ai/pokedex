// Small news that does not deserve a window: a level, a Pokemon that got away.
// They slide in at the top for a few seconds and go. Said once per device (the
// first run says nothing: history is not news), and never blocking.
import { useEffect, useRef, useState } from 'react'
import { motionConfig } from './lib/fx.ts'
import { toast } from './lib/motion.js'
import { nameOf, type Game, type Moment } from '../core/fold.ts'

const KEY = 'pokedex.toasted.v1'
const SHOWN_MS = 4200

const keyOf = (m: Moment): string => `${m.day}|${m.kind}|${m.kind === 'boss' ? m.what : 'level' in m ? m.level : ''}|${'form' in m ? m.form : ''}`
const textOf = (m: Moment): { title: string; line: string } | null =>
  m.kind === 'level' ? { title: `Level ${m.level}`, line: `${nameOf(m.form)} grew.` }
    : m.kind === 'flee' ? { title: 'It got away', line: `The wild ${nameOf(m.form)} left.` }
      : m.kind === 'boss' && m.what === 'left' ? { title: 'The boss left', line: `${nameOf(m.form)} is gone. Another comes on Monday.` }
      : null

function load(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

export function Toasts({ game, today }: { game: Game; today: string }) {
  const [rail, setRail] = useState<{ key: string; title: string; line: string }[]>([])
  const seen = useRef<Set<string> | null | undefined>(undefined)
  useEffect(() => {
    if (seen.current === undefined) seen.current = load()
    const mine = game.moments.filter((m) => m.day === today && textOf(m))
    const known = seen.current
    const fresh = known ? mine.filter((m) => !known.has(keyOf(m))) : []
    const all = new Set([...(known ?? []), ...mine.map(keyOf)])
    seen.current = all
    try { localStorage.setItem(KEY, JSON.stringify([...all].filter((k) => k.startsWith(today)))) } catch { /* the worst case is a repeated toast */ }
    if (!fresh.length) return
    const added = fresh.map((m) => ({ key: keyOf(m), ...textOf(m)! }))
    setRail((r) => [...r, ...added])
    // not cleared on re-run: each toast leaves on its own clock
    window.setTimeout(() => setRail((r) => r.filter((x) => !added.some((a) => a.key === x.key))), SHOWN_MS)
  }, [game.moments.length, today])
  if (!rail.length) return null
  return (
    <div className="toast-rail" role="status" aria-live="polite">
      {rail.map((t) => <div key={t.key} className="toast" ref={(el) => { if (el && !el.dataset.on && !motionConfig.reduced) { el.dataset.on = '1'; void toast(el, { hold: SHOWN_MS - 1000 }) } }}><b>{t.title}</b> {t.line}</div>)}
    </div>
  )
}
