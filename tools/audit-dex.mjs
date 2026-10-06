// Can every entry in the species table actually be reached by playing?
//   node tools/audit-dex.mjs
// A first stage is reached by turning up in the wild (or hatching); everything
// else by evolving, Mega Evolving or Gigantamaxing from something reached.
// fold.test.ts runs the same check, so an unreachable entry fails the tests.
import { SPECIES } from '../core/species.ts'

export function auditDex() {
  const reached = new Set(Object.entries(SPECIES).filter(([, r]) => r.s === 1 && !r.f && r.g && r.r).map(([id]) => id))
  const todo = [...reached]
  while (todo.length) {
    const r = SPECIES[todo.pop()]
    for (const id of [...(r.e ?? []), ...(r.m ?? []), ...(r.gm ? [r.gm] : [])])
      if (SPECIES[id] && !reached.has(id)) { reached.add(id); todo.push(id) }
  }
  const unreachable = Object.keys(SPECIES).filter((id) => !reached.has(id))
  // a branch no habit can lead to: only a choice by hand gets there
  const byChoiceOnly = Object.values(SPECIES).flatMap((r) => (r.bt ?? []).flatMap((t, i) => (t === 'health' ? [r.e[i]] : [])))
  return { total: Object.keys(SPECIES).length, unreachable, byChoiceOnly }
}

if (import.meta.main) {
  const a = auditDex()
  console.log(`${a.total} entries · ${a.unreachable.length} unreachable${a.unreachable.length ? ': ' + a.unreachable.join(', ') : ''}`)
  console.log(`reached only by choosing the branch by hand: ${a.byChoiceOnly.join(', ') || 'none'}`)
  if (a.unreachable.length) process.exit(1)
}
