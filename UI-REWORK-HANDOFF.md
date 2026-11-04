# UI rework: what was done, and what is left

Written 5 Nov 2026 at the end of a cloud session, for a local Claude Code session to carry on. It stands on its own. The audit behind it is `UI-AUDIT-2026-11-04.md`:
- §1 is the benchmark's design DNA
- §3 is the show-don't-tell list (T1 to T25)
- §8 is the phased plan
- the Progress notes are at the end

**Status (updated 5 Nov 2026, local session):** phases 0 to 9 are done and on `master`. What is left is in §5 (the leftovers, and the parts of phase 9 that need rewriting rather than moving).

---

## 0. Start here

1. `git checkout master && git pull`. The work came from the branch `claude/trusting-hopper-z9jl9q` and is merged.
2. `npm ci`, then check you start green:
   - `npm test` (208 pass)
   - `npx tsc -b`
   - `npm run build`
   - `npm run a11y -- --strict` (0 small targets, 0 unnamed)
   - `npm run shots` (30 of 30 the same)
3. `VITE_SUPABASE_DISABLE=1 npm run dev`, then open `http://localhost:5190/?fixture=late&tour=0`. **Never run against the real ledger.**
4. The baselines in `tests/baseline` were taken on Windows (the owner's PC). On Linux, text smoothing differs: re-take them there from unchanged code first, in their own commit, before judging a change.

---

## 1. The owner's decisions (do not reopen these)

- **Benchmark:** the card deck (Team and Lab: `MonCard`, `cardkit`, `moncard.css`, `party.css`) and the Bag (the block-game inventory, which stays as it is). Everything is measured against them.
- **Baselines** are re-taken only after a phase is approved, and in their own commit.
- **The Nursery** stays on Today; there is no egg tile.
- **The green "can feed" arrow** shows only where **one** held berry finishes the next bond level, counting ×2 when that kind of work was done today. On a busy day every new catch at 0/10 lights up; that is correct.
- **Keep the card tap popup (Info / Use / Replace)** on Team. Say why before ever changing it.
- **Incense** lives in Party (Items). The Shop only sells it as a ware.
- **`public/world/`** must not ship (deleted: unused, no licence).
- **Long grids** (Lab, Pokedex) stay flat with `content-visibility: auto`. No paging, no bands.
- **The scene's habitat** follows the **wild** Pokémon's type; the partner's type tints its pad.
- **The Collector and Collect** use the Bag's slot in dark glass (`Slot material="glass"`).
- **The cream HP boxes** are retired.
- **The meadow scene is approved as it is.** Its drawing must not change (§4 has the hash check).
- **No cap** on the wild Pokémon's size.
- **HP and EXP bars** use the classic game look (`Meter look="game"`: HP green, amber, red; EXP green with today striped gold), with **the numbers inside the bar**. **No type symbol on the scene's plates.**
- **The partner card is not upsized** in the party grid (it would break 3 across on a phone).

From the original brief:
- Visual and UX only. **Never touch `core/`** (rules shared with Life OS), rules, currencies or persistence. If an idea needs a rules change, flag it and ask.
- No new mechanics.
- **Sprite URLs under `/sprites` stay stable**: Life OS loads them.
- New CSS goes in the `screens` layer and reads `styles/tokens.css`. Only `tokens.css` defines `:root`. Every stylesheet is imported once, by `styles/index.css` (a test checks both).
- Tests, typecheck and `a11y --strict` stay green.
- Honour `prefers-reduced-motion`. Animate only transform, opacity and filter.
- **Pixel art at whole-number scales only.** Item sprites are 24 px, so draw them at 24, 48 or 72; Pokémon stills are 96 px. Never rotate a sprite.

---

## 2. What was done, phase by phase

| Phase | Commit(s) | What |
|---|---|---|
| Audit | `af8182d` | `UI-AUDIT-2026-11-04.md` |
| 0 Defects | `ea62b4e`, baselines `d34b410` | See below |
| 1 Foundations | `3f14316` | See below. No screen changed, which an unmasked pixel diff proved |
| 2 Today scene | `a9158a8`, `7bf16dd`, baselines `f7f59d9` | See below |
| 3 Party | `546770a` | See below |
| 4 Today below the scene | `3240cef`, `cab0fb3`, baselines `63f802c` and `3ac35a6` | See below |
| 5 Overlays | `cd4aece`, `cab0fb3` | See below |
| Loose ends | `99ac3ba` | See below |
| Windows baselines | `22ad19f` | No screen change; text smoothing only |
| 6 Shop | `d099fa6` | See below |
| 7 Pokedex | `1f58e95` | See below |
| 8 Journey | `41aae4e` | See below |
| 9 Legacy | `fef0155`, baselines `5c17925` | See below |

**Phase 0, defects:**
- The news window no longer opens scrolled past its reveal.
- Toasts wait for windows.
- The Bag's `.mc*` classes became `.inv*` (they collided with the card's).
- 133 dead CSS rules removed.
- The Lab toggles have 44 px targets. The strict a11y check had been red.
- The scene sprites draw at whole-number scales, and the wild Pokémon is 96 px, not 80.
- Asleep is dimmed, not grey.
- Open party places are quiet.
- The egg tile is gone from Today.
- The green-arrow rule.
- `public/world/` deleted.
- `content-visibility` on the long grids.
- The season road shows what's coming.
- The Collector chips are one colour.
- Shorter battle-prep captions.
- The tour's Skip is a text link.
- The top bar says "Step N".

**Phase 1, foundations:**
- `ObjCard` (MonCard rebuilt on it, pixel-identical)
- `Slot` in stone or glass (the Bag rebuilt on it, pixel-identical)
- `Meter`
- `lib/fit.ts` and `lib/pixel.tsx`
- one toast (`lib/toast.ts`)
- one close (`KClose`, 44 px glass)
- tokens and motion presets
- a Foundations section on `?kit`

**Phase 2, the Today scene:**
- A pixel diorama: two canvases at native size, enlarged by a whole number.
- All 12 places (meadow, flowers, shore, marsh, canyon, volcano, snow, cliff, pass, plain, ruins, steelworks) plus the cave scene. Lit by the hour, with the weather from your sleep and small animated life.
- The nameplates replace the cream boxes, with the classic bars, the numbers inside them, and "−N" and "+N" chips.
- The partner's pad is tinted by its type.

**Phase 3, Party:**
- Order: party, Signatures, Trainer perks, then the lab.
- The old hero plinth is replaced by a Feed button and the partner's state.
- Feeding is the cards, with ghost hearts. Party, Today and the Bag all open it.
- Signatures are a badge row.
- The Trainer star is a meter.
- A Pokémon's page opens on its own card at hero size.
- The duplicate Lab box grid was removed; the desk picker and Replace remain.
- The how-to line shows only once.

**Phase 4, Today below the scene:**
- A throw ghost on the wild Pokémon's HP bar (`lib/aim.ts`).
- Momentum pips with their steps.
- An XP meter between the forms.
- The desktop columns balanced.
- The Nursery says its number once.
- Battle prep as glass slots.
- The boss lock as six places.
- The first-day card.
- The partner line says only what is left.
- Every HP bar is the classic game bar.
- The belt's icons at 2×, never rotated.

**Phase 5, overlays:**
- The news list has a picture for each item.
- Collect is glass slots: merged with ×N, growing with the amount, a caption each, a total, and the milestone choice as slots.
- The Bag's item sheet opens on the item as a card on its category's colour.
- The tour is working pieces of the real UI. Back and Skip are text.
- The help pictures are real pieces at whole sizes.
- Two new baselines: the news window and Collect.

**Loose ends (the last commit before the merge):**
- The leader's power is one stacked bar, a coloured part per source with the total written in it (T24).
- A fixture-only `?aura=mega|gmax`, for seeing those days. Both looks were checked on screen.
- A Dynamax is now one whole step bigger whenever it fits the scene, on a phone too.
- The plate's tag no longer gets cut off.
- The help's Season and Level 100 pictures are real pieces.

**Phase 6, Shop:**
- Every ware is an `ObjCard`: the field is its kind (`catColor`, a TM's type), the metal says whether you can buy it (gold yes, grey `locked` not yet, silver bought or sold; a grey ware's item stays visible, dimmed), and the banner is the price with what you hold of it filled in behind (`--held`).
- X items and TMs carry their kind of work as the corner badge (not inside that work's own shop).
- The three bought scenes are a still `MiniScene` (`screens/Stage.tsx`), the meadow painted at 50×52, ×2.
- Shelf headings are `ShelfHead`: one word and an icon, the old sentence in the tip.
- Shop › Marks is one `.pmenu.sub` row. Incense is gone from the Shop's Gems counter.
- The Collector: glass slots, a ×2 stamp on today's wanted ones (the ones you lack shown dark), tap them in and one total counts up; one Sell (everything when nothing is picked).

**Phase 7, Pokedex:**
- Each entry is a mini `ObjCard` (`.dexcard`): caught is the type colour, seen only is that field faded, not seen is the grey frame and a silhouette; the ball is the corner badge, the number the banner, fully trained the gold frame, a Mega the Mega frame. The sprite is `CropSprite` at 1× (`lazy`).
- The header is `SegRing` (caught, seen only, the track for not seen) with a key of three dots and numbers.

**Phase 8, Journey:**
- The season road: one collected node (a stamp when a step was collected since you last looked, `pokedex:season-seen`), the step you are on lit, the next ones locked; the rule in the tip.
- Legend quests: a card per key, a silhouette until caught, the key and what earns it lit or dark in the corners; Use only under a key usable now; tap a card for where its key comes from.
- League trail: badges not yet won are a readable grey; the Rematch sentence is the heading's tip.
- Every `KBar` outside the kit page is now `Meter` (feats and their folds, quests, pay, the Frontier, boss tasks, the Forge).

**Phase 9, legacy:**
- The five old stylesheets open the `screens` layer, first and in their old order; `legacy` is empty. Proved by the screenshots and by `tools/stylediff.mjs` (every element's computed style in ~100 states, old build against new). The old declarations that had only lost because of the layer were deleted.
- `.ring` (Pokedex) had been leaking onto the news reveal's ring and pushing its badge down: it is `.dexring` now.
- Item icons at 24, 48, 72 or 120 only (16 on tiny chips). The Bag is unchanged. The top bar's and sub-menus' icons went from 30 to 24.
- Secondary actions are `.pill-btn` (in `parts.css`, with `gold` and `green`); each screen's one main action keeps `.k-btn`.

---

## 3. The parts to build from

| Part | Where | Notes |
|---|---|---|
| `ObjCard` | `src/ObjCard.tsx`; look in `screens/moncard.css`, metals in `screens/parts.css` | Any thing as a card. `metal` (silver, gold, elite, mega, locked, blue, pink), `tc` (field colour), `corners`, `banner`, `pill`, `ribbon`, `empty`. `MonCard` is ObjCard plus a Pokémon (`size="hero"` for the page). |
| `Slot` | `src/Slot.tsx`; stone in `screens/menu.css`, glass in `parts.css` | Icon, count, gold E (`on`), corner `stamp`, `tip`, `disabled`. `.slot-grid` lays them out. |
| `Meter` | `src/Meter.tsx`, `parts.css` | `today`, `ghost` (±, striped and pulsing), `lost`, `links` (a chain), `marks`, `size`, `look="game"`, `label` inside, `className` for presets. |
| `HpBar` | `src/screens/HpBar.tsx` | Now just `Meter look="game" kind="hp"`. |
| `catColor(kind)` | `src/lib/itemcat.ts` | An item kind's field colour (`--cat-*`). |
| `wholeScale`, `fullFit` | `src/lib/fit.ts` (tested in `tools/fit.test.mjs`) | Whole-number sprite scales. |
| `PixelSprite`, `CropSprite`, `useBig`, `useNatural` | `src/lib/pixel.tsx` | A GIF at a whole scale (with `up` for a Dynamax); a still's drawn part at 1×. |
| `note()` | `src/lib/toast.ts` | The one toast. |
| `aim()`, `useAim()` | `src/lib/aim.ts` | A ball held over the wild Pokémon. |
| `KClose` | `src/Kit.tsx` | The one close. |
| Tokens | `styles/tokens.css`, last block | Metals, `--cat-*`, slot materials, meter colours. |
| Presets | `screens/presets.css` (the `motion` layer) | `pre-obj`, `pre-pop`, `pre-stamp`, `pre-sweep`, `pre-hint`, `ghost-pulse`. |
| Scene | `src/screens/stage.ts` (pure painter, `PLACES` table, `biomeOf`, `layoutFor`, `lightAt`), `src/screens/Stage.tsx` (canvases, 8 fps loop), `Scene` in `src/App.tsx`, `screens/scene.css` | Tested in `tools/stage.test.mjs`. `sky.ts` is unchanged. |

Fixture view switches: `&news`, `&band=84`, `&tour=1`, `&clock=19:30`, `&sleep=30`, `&aura=mega` or `&aura=gmax`, `&shelve=guitar`.

---

## 4. How to work (keep to this)

- **After each phase:**
  - capture phone (390) and desktop (1280) of what changed, before and after, and show the owner
  - list exactly which baselines `npm run shots` changed
  - re-take them only after approval, in their own commit (`npm run shots -- --update`, then `npm run shots` again for all the same)
- **`content-visibility`:** off-screen grid cells draw empty in a full-page screenshot, and lazy images don't load until scrolled. `tools/shots.mjs` and `tools/a11y.mjs` switch content-visibility off. Ad-hoc scripts must do the same, and scroll the page before a full-page shot.
- **"No visual change" refactors:** prove them with an unmasked pixel diff (the baselines mask sprites). The animated GIFs (the partner in the scene, any `spritePath`) move between captures, so diff two captures of one build first.
- **`node tools/css-unused.mjs`** (`--fix` deletes):
  - It can't see a selector whose class word appears elsewhere in the code. Check by hand.
  - **Grep a class name before reusing it.** `.hero`, `.fx-stamp` and `.mc` already had meanings and caused bugs.
- **The meadow must not change.** If you edit `stage.ts`, hash its output before and after. This should print `70b18a46221311a648c20f41fe4a8c5d27235830`:

```js
// node meadowhash.mjs (outside src)
import { createHash } from 'node:crypto'
import { layoutFor, paintBack, paintFront } from './src/screens/stage.ts'
const rec = () => { const r = []; return { r, fillStyle: '', globalAlpha: 1, fillRect(x, y, w, h) { r.push([x, y, w, h, this.fillStyle, this.globalAlpha]) }, clearRect() {} } }
const h = createHash('sha1')
for (const [w, hh] of [[179, 195], [198, 127]]) for (const minutes of [0, 420, 720, 1170, 1380]) for (const score of [null, 95, 65, 20]) for (const theme of ['', 'theme-cave', 'theme-night']) for (const aura of [null, 'gmax']) for (const t of [0, 37]) {
  const s = { lay: layoutFor(w, hh), minutes, score, theme, biome: 'meadow', seed: 'porygon', partnerTc: '#ee8130', aura, t }
  for (const p of [paintBack, paintFront]) { const g = rec(); p(g, s); h.update(JSON.stringify(g.r)) }
}
console.log(h.digest('hex'))
```

- **Commits:** end with the session's attribution lines, no model names, and plain English like the existing audits.

---

## 5. What is left

### Needs the owner's decision
- **The bought beach scene** is the meadow at noon, an older bug. A `shore` place exists now. Switching it (`biome = game.theme === 'theme-beach' ? 'shore' : …` in `Scene`) changes what a bought scene looks like, so ask first. The Shop's Beach miniature would follow (`MiniScene` paints the meadow).
- **Top bar and sub-menu icons** are 24 px now (were 30, not a whole scale). If they read too small, the fix is a bigger box drawn at 48, not 30.

### Phase 9, the rewriting part
- The five old files still hold about 1,000 used rules, and the cream palette block in `tokens.css` is still read by them (`--edge` 46 times, `--lbl` 29, `--muted` 24). Retiring them means moving each rule into the screen it styles and deleting what a screen overrides, a screen at a time, with `tools/stylediff.mjs` proving each step.
- The kit page (`?kit`) shows small spacing differences after the layer move (its `.kit` collides with the training kit's `.kit`). Dev-only.

### Small things
- More help rules could use real pieces (Gems, Milestones and a few others still use number chips).
- **On desktop**, a big partner (Tangrowth) draws at 2× on a 3× stage. This is accepted.
- **A Dynamax** can touch the scene's left edge on a phone.

## 6. Deploying

- Production is `master`, built by Vercel. Phases 0 to 9 are on it.
- The sprites are a separate Vercel project (`npm run sprites:deploy`), and nothing here changed them.
- `public/world/` was removed. The service worker and `vercel.json` never referenced it.
