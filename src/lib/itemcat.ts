// What kind of thing an item is, as the colour of its card's art field (tokens.css --cat-*). The Bag's item sheet
// uses it now; the shop's wares are meant to (UI-AUDIT-2026-11-04 T8).
import type { ItemKind } from '../../core/economy.ts'

const CAT: Partial<Record<ItemKind, string>> = {
  ball: 'ball', berry: 'berry', held: 'held', battle: 'battle', vitamin: 'battle', guard: 'battle', lure: 'battle', field: 'battle', incense: 'battle',
  tm: 'tm', fossil: 'fossil', key: 'key', legend: 'key', unique: 'key', shard: 'key', treasure: 'treasure', evo: 'evo', candy: 'evo',
}
/** The CSS colour for an item kind's art field. */
export const catColor = (kind?: ItemKind | null): string => `var(--cat-${(kind && CAT[kind]) ?? 'other'})`
