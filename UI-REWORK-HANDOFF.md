# UI rework: handoff for the next session

Written 4 Nov 2026 at the end of a cloud session. This file is meant to be enough on its own for a local Claude Code session to carry on. Read it fully, then read `UI-AUDIT-2026-11-04.md` (the audit, the plan, and the "Progress" section at the end).

---

## 0. Start here (a checklist for the next session)

1. `git fetch origin && git checkout claude/trusting-hopper-z9jl9q`. All the work is on this branch. **None of it is on `master`, so none of it is deployed** (see §2).
2. `npm ci`, then check the starting point is green:
   - `npm test` (207 tests should pass)
   - `npx tsc -b`
   - `npm run build`
   - `npm run a11y -- --strict` (0 small targets, 0 unnamed)
   - `npm run shots` (30 of 30 the same: 28 tabs, sky and band pictures, plus the news window and Collect)
3. `VITE_SUPABASE_DISABLE=1 npm run dev` and open `http://localhost:5190/?fixture=late&tour=0`. **Never point the dev server at the real ledger.**
4. Pick the next item from §6. Work in the order given, and stop after each phase with before/after screenshots for the owner (§4 has the rules).

---

## 1. What this is

The owner asked for an audit of every screen against the two screens they love (the **card deck** in Team and Lab, and the **Bag**), then a phased rework to bring the whole app up to them. The audit is `UI-AUDIT-2026-11-04.md`:
- §1 is the benchmark's design DNA (the measuring stick).
- §3 is the show-don't-tell list (T1 to T25).
- §8 is the phased plan.

Phases 0 to 5 are done. Phase 6 (Shop) is next.

---

## 2. Where the work is, and how it gets deployed

- **Branch:** `claude/trusting-hopper-z9jl9q`, based on `master` at `54e367f`.
- **Production** is whatever `master` holds; Vercel builds it. No pull request exists for this branch, and nothing has been merged.
- **To deploy:** merge the branch into `master` (or open a PR and merge it), then push `master`. If Vercel's GitHub integration is on, a PR also gets a preview URL. The sprites are a separate Vercel project (`npm run sprites:deploy`), and nothing in this work changes them.
- `public/world/` was deleted, as the owner asked (it was unused and had no licence). The service worker and `vercel.json` never referenced it.

Commits on the branch, oldest first:

| Commit | What |
|---|---|
| `af8182d` | The audit (`UI-AUDIT-2026-11-04.md`) |
| `ea62b4e` | Phase 0: defects and guardrails |
| `d34b410` | Baselines re-taken after phase 0 |
| `3f14316` | Phase 1: foundations (no screen changes) |
| `a9158a8` | Phase 2 prototype: the meadow |
| `7bf16dd` | Phase 2: all twelve places; classic bars on the plates |
| `f7f59d9` | Baselines after phase 2 |
| `546770a` | Phase 3: Party |
| `3240cef` | Phase 4, in part: Today below the scene |
| `63f802c` | Baselines after phase 3 and phase 4 in part |
| `51c1b2d` | The handoff (this file, first version) |
| `cd4aece` | Phase 5: overlays; two new baselines (`overlay-news.png`, `overlay-collect.png`) |

---

## 3. The owner's decisions (do not reopen these)

From the audit's questions:
- **Q1** Baselines are re-taken only after a phase is approved, and in their own commit.
- **Q2** The Nursery stays on Today; the egg tile on Today is removed. (Done.)
- **Q3** The green "can feed" arrow shows only where **one** held berry would finish the next bond level, counting the ×2 when that kind of work was done today. (Done. On a busy day this lights every new catch at 0/10, which is correct under the rule. The owner was told and did not object.)
- **Q4** **Keep the tap popup on cards (Info / Use / Replace).** Explain why before ever changing it. Do not add or remove items on the Team card menu.
- **Q5** Incense lives in Party (Items); the Shop only sells it as a ware. (Not done yet: phase 6.)
- **Q6** `public/world/` must not ship. (Deleted.)
- **Q7** Long grids stay flat with `content-visibility: auto`, with no paging and no bands. This applies to the Lab and the Pokedex. (Done.)
- **Q8** The scene's habitat follows the **wild** Pokémon's type only; the partner's type tints its pad. (Done.)
- **Q9** The Collector and Collect use the Bag's slot as a **token variant, dark style** (`Slot material="glass"`). (The component is done; adopting it is phases 5 and 6.)
- **Q10** The cream HP boxes are retired. (Done.)

Later, on screenshots:
- **The meadow scene was approved as it is.** Do not change the meadow's look. `stage.ts` must keep drawing it identically (§5 has the hash check).
- **No cap** on the wild Pokémon's size on desktop.
- **Plates:** use the **old bar look** (`Meter look="game"`): HP green, amber or red; EXP green with today striped gold; the numbers inside the bar. **No type symbol on the plates.** The owner liked the numbers inside the bar.
- **The partner card was not made bigger** in the party grid (it would break the 3-across grid on a phone). It was reported, with no answer yet.

Constraints from the original brief that still hold:
- Visual and UX only. **Do not touch `core/`** (rules shared with Life OS), game rules, currencies or persistence. If an idea needs a rules change, flag it and ask.
- No new mechanics.
- **Sprite URLs under `/sprites` stay stable**: Life OS loads them by address.
- New CSS goes in the `screens` layer and reads `styles/tokens.css`. Only `tokens.css` may define `:root` (a test enforces it). Every stylesheet is imported once, through `styles/index.css`.
- `npm test`, typecheck and `npm run a11y -- --strict` stay green.
- Honour `prefers-reduced-motion`. Animate only transform, opacity and filter.
- Pixel art is drawn at **whole-number scales only** (see `lib/fit.ts`).

---

## 4. How work was done (keep doing it this way)

- **Before/after:** after each phase, capture phone (390) and desktop (1280) of the screens it touched, against the same captures from before, and show the owner. The fixtures are `empty`, `week`, `late` and `boss`. Useful extra query parameters:
  - `&news` replays the news window
  - `&band=84` shows a measured night
  - `&tour=1` opens the tour
  - `&clock=19:30` sets the scene's time
  - `&sleep=30` sets last night's sleep (the weather)
- **`npm run shots`** compares 28 masked screenshots with `tests/baseline/`. A phase is expected to change some of them; list exactly which, and **do not re-take baselines until the owner approves the phase**. Then re-take them in a separate commit (`npm run shots -- --update`, then run `npm run shots` again: 28 of 28 the same).
- **Content-visibility:** the long grids use `content-visibility: auto`. A full-page screenshot draws the off-screen cells empty, and lazy images don't load until scrolled. `tools/shots.mjs` and `tools/a11y.mjs` switch content-visibility off. Any ad-hoc capture script has to do the same, and also scroll through the page before a full-page shot.
- **Playwright in the cloud** needed `executablePath: '/opt/pw-browsers/chromium'` (env `PW_CHROME` for the repo's tools). Locally the normal Playwright browser should do.
- **Pixel-exact refactors:** when a component is rebuilt with "no visual change", prove it with an **unmasked** pixel diff (the baselines mask sprites). Animated GIFs differ between captures (the scene's partner, any `spritePath` GIF): diff two captures of the same build first, to see which regions always move.
- **`node tools/css-unused.mjs`** lists dead rules and `--fix` deletes them. Two catches:
  - It can't see a selector whose class word still appears somewhere in the code (`.sky` survived that way, and was deleted by hand).
  - A generic class can collide: `.hero` and `.fx-stamp` already had meanings. **Grep for a class name before reusing it.**
- **Commits** end with the session's attribution lines, and no model names. Plain English in docs, in the style of the existing audits.

---

## 5. What exists now (the parts to build from)

### The foundations (phase 1), all shown on `?kit` → "Foundations"

| Part | File | Use it for |
|---|---|---|
| `ObjCard` | `src/ObjCard.tsx` (look: `screens/moncard.css`, metals: `screens/parts.css`) | Any "thing" as a card: metal (silver, gold, elite, mega, locked, blue, pink), art field `tc`, corner badges, banner, pill, ribbon, empty state. **`MonCard` is ObjCard plus a Pokémon** (`size="hero"` for the page). |
| `Slot` | `src/Slot.tsx` (look: `screens/menu.css` for stone, `parts.css` for glass) | "A thing is its icon and a number": count, gold E, corner `stamp`, tip, `disabled`. Stone is the Bag; glass is the night page. `.slot-grid` lays slots out on a page. |
| `Meter` | `src/Meter.tsx` (`parts.css`) | Every bar. Props: `today` (brighter part), `ghost` (± what an action would do, striped and pulsing), `lost` (pale, what was taken), `links` (a chain), `marks`, `size`, `look="game"` (the classic bar), `label` inside. |
| `lib/fit.ts` | `wholeScale`, `fullFit` | The whole-number scale for any sprite. Tested in `tools/fit.test.mjs`. |
| `lib/pixel.tsx` | `PixelSprite` (a GIF at a whole scale), `CropSprite` (a 96 px still's drawn part at 1×), `useBig`, `useNatural` | Small Pokémon without shrinking them by a fraction. |
| `lib/toast.ts` | `note(text, bad)` | The app's one toast, shown by `Toasts.tsx` in the top rail. News waits for windows; notes show at once. |
| `lib/aim.ts` | `aim(hp)`, `useAim()` | A ball held over the wild Pokémon. |
| `KClose` | `src/Kit.tsx` | The one close: a 44 px glass ✕. |
| Tokens | `styles/tokens.css`, last block | Metals, item categories (`--cat-*`), slot materials, meter colours. |
| Motion presets | `screens/presets.css` (the `motion` layer) | `pre-obj`, `pre-pop`, `pre-stamp`, `pre-sweep` (on a Meter), `pre-hint` (a ghost showing what to do), `ghost-pulse`. All stop under reduced motion. |

### The Today scene (phase 2)

- **`src/screens/stage.ts`** is the pure painter: `paintBack` and `paintFront`, `layoutFor`, `biomeOf`, `lightAt` and `litFilter`, `lookOf`, and the `PLACES` table (one row per place). The stage is drawn at native size (the CSS size ÷ k, with k = 2 on a phone and 3 wider) and enlarged with hard edges.
- **`src/screens/Stage.tsx`** holds the two canvases and the 8 fps loop. The loop never runs with reduced motion, and pauses off-screen or in a hidden tab.
- **The Scene** in `src/App.tsx`:
  - the pads are positioned from `layoutFor`
  - the wild Pokémon is drawn bbox-cropped at a whole scale
  - both Pokémon get `--lit`
  - the nameplates are `.np` in `screens/scene.css`
- **`sky.ts`** (colours, the arc, the weather) and its tests are unchanged. `Sky.tsx` now only holds `useClock` and `sleepFor`.
- **The twelve places:** meadow, flowers, shore, marsh, canyon, volcano, snow, cliff, pass, plain, ruins and steelworks, plus the bought cave scene.
- **Tests:** `tools/stage.test.mjs` draws every place at five hours, in four weathers, with both auras, at two sizes, and fails on any fraction or anything drawn far off the stage. No two places may draw the same picture.
- **The meadow must not change.** Hash the painter's output before and after any edit to `stage.ts`. The script used is below; it should print `70b18a46221311a648c20f41fe4a8c5d27235830` while the meadow is untouched:

```js
// node meadowhash.mjs (put it outside src)
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

- **To look at all the places at once**, load `/src/screens/stage.ts` from the dev server inside a page (`await import('/src/screens/stage.ts')`) and paint canvases for each biome at 12:15, 19:30 and 23:00.

### Party (phase 3)

- **Order:** party, Signatures, Trainer perks, then the lab. `TeamScreen` takes `under` and `between` slots (`src/Team.tsx`).
- **`PartyNotes`** (in `App.tsx`) is the Feed button plus the dozing, Mega and Dynamax notices. The old `Summary` hero is gone.
- **`FeedSheet`** (`src/Feed.tsx`) is a grid of `MonCard`s with ghost hearts (`MonCardData.ghost`). Party, Today's Feed socket and the Bag all open it.
- **`Deck`** (`src/Bond.tsx`) is the signature badges row. The Trainer star in `BondPerks` (`src/Champion.tsx`) is a `Meter`.
- **`MonPage`** (`src/Play.tsx`) opens on `MonCard size="hero"`, with the facts as chips.
- **The Lab sub-tab** (`src/Research.tsx`) has the desk, the dial and the research. The "Lab box" grid is gone; desk places fill from the picker sheet, and a desk card's menu has Replace.

### Overlays (phase 5)

- **News window** (`src/Recap.tsx`, `NewsArt`): each item in the list has a picture. A Pokémon is shown at 1× in a portrait window on its type's colour; a catch carries the ball as a stamp, an evolution an ▲; badges, items and the Key Stone appear as themselves. The hero reveal opens at the top (the phase 0 fix).
- **Collect** (`src/Claim.tsx`): the plain rewards are `Slot material="glass"`.
  - Coins grow with the amount: coin, then nugget, then sack.
  - Identical rewards merge into one slot with a "×N" stamp, and one tap claims them all. Flights still start from the slot.
  - A caption names the source, and a red ring marks a reward that pays itself soon.
  - A total line (coins, gems, things) sits above "Collect all".
  - The two-way milestone choices keep their own card.
- **The Bag's item sheet** (`Play.tsx`) opens on the item as an `ObjCard`: its kind is the field's colour (`lib/itemcat.ts` `catColor`, ready for the shop's wares), the count is the banner, and the frame is gold when it is in use.
- **Tour** (`src/screens/Tour.tsx`): each card shows a small working piece of the real UI (a ring that fills and ticks, the two game bars, the breathing Collect bag, the dock, six places for the boss) with one line.
- **Help** (`RulesTab` in `App.tsx`): the first rules use the real pieces (rings, game bars, an evolution line at 1×). Every item icon there is 24 px, and the column's `scale(0.8)` is gone.
- **`tools/shots.mjs`** now also captures the news window (`late&news`) and the Collect sheet (`boss`): `npm run shots -- overlay`.

### Today, in part (phase 4)

- `Pace` (`App.tsx`): momentum pips with steps; the XP meter between forms.
- Desktop columns balanced.
- The Nursery deduplicated.
- Battle prep as glass slots.
- The boss lock as six places.
- The throw ghost.

---

## 6. What is left, in order

Each phase should leave the app working and green. The T numbers are the audit's §3.

### Phase 4, the rest: DONE (5 Nov). What was done: the first-day card (the first habit's ring with a ghost tick, and an Open Life OS button, in place of the paragraph); the partner line says only what is left; every HP bar (leader card, leader sheet, league trail, boss) is the classic game bar (`HpBar` now draws `Meter look="game"`); the throw belt's icons at 48 px (2×), lifted on hover but never turned. Still open from it: T24, the leader's power chips as one stacked bar; and the Mega/Gigantamax looks, never seen on screen (no fixture has them).

### (the original phase 4 notes, kept for reference)

1. **Empty state and first day** (the "big" part left out on purpose):
   - Replace the text block ("Nothing has been ticked yet…") with the scene plus one card: the first habit to tick, with a `pre-hint` ghost tick on its ring.
   - The asleep partner is already dimmed rather than grey; consider a pixel "z" bubble instead of the CSS "Zzz".
   - Baselines: `empty-today`.
2. **The partner line** ("12 of 15 · 3 to a perfect day") says the bar's ratio twice; keep one. A one-line change in `Talk` (`App.tsx`).
3. **Challenges, the leader duel card:** the HP bar could use `Meter look="game"` like the plates, for consistency. The leader sheet's "all added together, once" power chips become one stacked bar coloured by source (T24): `PowerLine` in `App.tsx`.
4. **The Throw belt sockets** still carry text under them ("−110 HP"). It is fine to keep (it is short and on the object), but the item icons are at 58 and 36 px. Use 48 or 72 (24 px sprites).
5. Check the **Mega and Gigantamax looks** on screen. No fixture has one. Either add a fixture variant (a fixture is ordinary ledger events in `src/lib/fixtures.ts`, and `tools/fixtures.test.mjs` checks them; adding events does not touch `core/`), or force them temporarily in a scratch copy. The scene draws a framed border, the Dynamax at the next whole size, and a red-tinted sky on Gigantamax.

### Phase 5: overlays: DONE (see §5). The milestone choice in Collect is two slots now, and the tour's Back is a text button like Skip. Still open: more help rules could use real pieces (the season, Level 100, Gems still use number chips).

### (the original phase 5 notes, kept for reference)

- **News window (`src/Recap.tsx`), T13:** each news item becomes a small object. A catch is the sprite in its ball; a badge is the badge art; an evolution is old → new form; a find is the item. Use `ObjCard` (small) or `Slot`. Keep the hero reveal pinned at the top with the list scrolling under it. (The scroll-to-bottom bug is already fixed in phase 0.)
- **Collect sheet (`src/Claim.tsx`), T14:** rewards as objects that grow with the amount (coin, pile, sack, as the top-bar chip does), identical rewards merged into one with "×N", and "Collect all" sending them flying (`lib/fly.ts` exists). Use `Slot material="glass"` (Q9).
- **Tour (`src/screens/Tour.tsx`), T22:** each card shows a ghost of the real UI (the scene, a ring filling, the bag breathing, the dock) with one short line. Skip is already text.
- **Help window (`RulesTab` in `App.tsx`), T23:** the picture column uses the real small components (a ring, a socket, a card), not the abstract number chips.
- **Item sheet (Bag, `Play.tsx`):** an `ObjCard` header (item art at 72 px on its category colour) plus one line.
- Add the news window and Collect to the baselines (they aren't captured today).

### Phase 6: Shop (`src/Play.tsx` shops, `src/Champion.tsx` Collector, `screens/shop.css`, `menu.css` `.ware`)

- **Wares on `ObjCard`, T8 and T9:**
  - the art field is the item's category colour (`--cat-ball`, `--cat-berry`, …)
  - a kind-of-work badge in the corner for X items and TMs
  - the item at 48 or 72 px
  - the metal says affordability: gold for "you can buy it", locked for "you can't"
  - the price pill shows your wallet as a meter behind the number
  - buying drains the pill and the coin chip ticks down
- **Theme wares (T12):** a live miniature of the scene. `stage.ts` can paint a small canvas at k = 1: pass the theme and the meadow.
- **The Collector (T10):** the treasures as `Slot material="glass"` with a gold "×2" `stamp` on the wanted ones, one running total, and one Sell button. Drop the ten big blue Sell buttons.
- **Shelf headings:** one word plus an icon, not a sentence in capitals.
- **Shop › Marks:** flatten the third level of navigation into one segmented row.
- **Incense (Q5):** remove the Incense section from Shop › Gems & BP (keep the ware).
- Baselines: `*-shop`.

### Phase 7: Pokedex (`DexTab` in `App.tsx`, `screens/dex.css`, plus the `.dex2` and `.dx` overrides in `menu.css`)

- **Cells as mini `ObjCard`s** (about 76 px, 3 to 4 across):
  - caught: the type colour as the field (now every caught cell is the same gold)
  - seen only: a desaturated field
  - not seen: a dark silhouette
  - the ball as a corner badge
  - the sprite whole-number scaled (bbox or `CropSprite`), not 56 px
- **The header (T21):** one segmented ring (caught, seen, not seen) replaces four numbers in prose.
- **Keep it one flat grid** with `content-visibility` (Q7); never bands.
- **Clean up the duplicated rules:** `.dx` is defined in both `dex.css` and `menu.css`, and the later one wins.
- Baselines: `*-pokedex`.

### Phase 8: Journey (`src/Road.tsx`, `src/Feats.tsx`, `src/Champion.tsx` LegendWin and Frontier, `screens/journey.css`)

- The season road already shows its rewards dimmed (phase 0). Add the motion study's node states (locked, ready, collected stamp) with `pre-stamp`. The rule sentence goes into a tip.
- **Legend quests (T20):** silhouette `ObjCard`s with the requirement's icon lit or dark. The Use button appears only when it can be used; drop the chunky gold Use on every row.
- **League trail:** lift the badge silhouettes from near-black to a readable grey. The Rematch sentence goes into a tip.
- **Feats:** the "Closest to done" road and the "All feats" fold could use `Meter`.
- Baselines: `*-journey`.

### Phase 9: retire legacy

- **The legacy layer is about 1,000 rules** (`index.css`, `kit.css`, `skin.css`, `motion.css`, `economy.css`). Move what still applies into `screens/*.css`, delete the rest, and finish with `legacy` empty and the screenshots unchanged.
- **`k-btn`** keeps its chunky look only for the one main action of a screen; the others become pills.
- **Bars:** `KBar` and `HpBar` are still used (quests, leader, boss, frontier). Move them to `Meter`.
- **Retire the cream palette block** in `tokens.css`.
- **Item icons** are 24 px sprites drawn at 22 to 44 px all over the app. Each phase above should draw the items it touches at 24, 48 or 72. Here, sweep whatever is left: `grep -rn "ItemIcon id=.* size={" src` and fix any size that isn't 24, 48 or 72 (or 16 for tiny chips, accepting the blur, or better a 24 crop).

---

## 7. Known issues and loose ends

- **Not seen on screen:** the Mega and Gigantamax scene looks (no fixture has them).
- **Desktop scale mix:** a big partner (Tangrowth) draws at 2× on a 3× stage. This is accepted, not a bug.
- **The beach scene** was only ever the meadow at noon (an older bug: the inline sky colours overrode its sand palette). The shore place exists now. A follow-up could make the bought beach use the `shore` place: in `Scene`, `biome = game.theme === 'theme-beach' ? 'shore' : …`. Ask first, because it changes what a bought scene looks like.
- **`tests/heights.txt`:** `boss-party` is about 24,000 px (300 lab cards, flat by Q7). That is expected.
- **Collector chip:** the "wanted" chips now show a count instead of a second colour (phase 0).
- **Lab desk:** the "Replace" button on a desk card's menu is new (phase 3). It is the Lab desk's menu, not the Team card popup from Q4.
- **Not in the repo:** the cloud session's helper scripts (capture, before/after sheets). Write your own small Playwright scripts. The pattern: `chromium.launch()`, a context at 390×844 or 1280×900 with `reducedMotion: 'reduce'`, `goto('/?fixture=…&tour=0&clock=12:15')`, click `.navbar button[aria-label="Party"]`, then screenshot.
