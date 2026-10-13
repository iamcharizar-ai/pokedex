# What changed: the overhaul (phases 0 to 7) and the rules since

This is the single file to read for everything that changed from the start of the UI overhaul (commit `4298f01`, phase 0) to today (`0569614`, rules version 12), plus the Life OS and health-bridge work that went with it. The phase plan and its reasoning stay in `UI-OVERHAUL.md`; the rules themselves are in `lifeos/docs/GUIDE.md`. This file is the record of what was built and how it works.

Where the two repos are involved, Pokedex is the game (the source of truth for rules) and Life OS is the habit tracker that writes to the same ledger and carries a copy of the game core.

## 1. The shape of the system

```
Life OS (habits)  ──writes ticks──►  shared ledger (Supabase `events`)  ◄──writes vitals── bridge/sync.mjs ◄── ghealth CLI (Google Health)
                                              │
                                              ▼ read, then folded by foldGame()
                                    Pokedex (game; tabs Today, Party, Shop, Pokedex, Journey)
```

- **The ledger is the only shared state.** Neither app talks to the other. Each folds the same events into the same game state, so they agree.
- **The game core is shared code.** `pokedex/core/*.ts` is the one copy of the rules. `npm run core` copies it to `lifeos/src/game-core`, and a test fails if the copies differ. Edit the Pokedex copy, then run `npm run core`.
- **The motion kit is shared too.** `npm run kit` copies `src/lib/motion.js` (plus its types and timing tokens) to `lifeos/src/ui-kit`, with a drift test. Only motion is shared; each app keeps its own look.

## 2. Phase by phase

Each phase lists what was built, the logic behind it, and where it lives. Commit hashes are in the Pokedex repo.

### Phase 0: fixtures and screenshots (`4298f01`)
- **What:** canned ledgers you can open with `?fixture=empty|week|late|boss`. They use a separate `fx.<name>.` localStorage prefix and switch the live ledger off, so the real game is never touched. Also `&tour=0|1`, `?clock=HH:MM`, `?sleep=NN`.
- **Logic:** `src/lib/fixtures.ts` builds the ledgers from a fixed start date, so the same fixture always looks the same.
- **Testing:** `tools/shots.mjs` takes Playwright screenshots of every tab under each fixture and compares them with `tests/baseline/`. A change beyond 0.2% of pixels fails. `tests/heights.txt` records how tall each screen is. Run `npm run shots -- --update` after a change you meant to make.

### Phase 1: tokens and layers (`0cde2c1`)
- **What:** `src/styles/index.css` declares four CSS layers, `tokens, legacy, screens, motion`, and it is the only stylesheet code imports. `tokens.css` is the only place `:root` colours are defined.
- **Logic:** all the old CSS was put in one `legacy` layer, in its original order. Separate layers per file had flipped specificity-based skin overrides (grey tags, grey bars); screenshots confirmed zero diff after the change.
- **Testing:** `tools/styles.test.mjs` checks that every stylesheet is imported once, into a layer, and that `:root` values appear only in `tokens.css`. `tools/css-unused.mjs` lists dead rules; 112 were removed.

### Phase 2: five tabs, one job each (`c532b9d`)
- **What:** the bar is Today, Party, Shop, Pokedex, Journey. The old Home and Trainer tabs were merged. The Nursery (the egg's own space) and the Forge (Mega Stones from shards) got their own screens.
- **Logic:** each tab has one job. Today answers "what is happening today"; Party is the team and its training; Shop buys; Pokedex is the collection; Journey is history and the season.

### Phase 3: sheets, one overlay queue, swipe, haptics (`1d75041`)
- **What:** a top bar with a level ring and a Collect badge; every detail view is a sheet; swipe between tabs; haptic buzzes on the beats.
- **Logic:** `src/screens/overlay.ts` has one queue for things that take over the screen, ranked `{sheet: -1, tour: -0.5, news: 0, chest: 1, hatch: 2}`. `useOverlay` and `useHold` read it. A new overlay can never cover a more important one.

### Phase 4: the scene (`8251a39`)
- **What:** a sky that follows the phone's clock (dawn, noon, dusk, night), with weather that comes from last night's sleep score. The partner lunges when tapped and answers taps.
- **Logic:** `src/screens/sky.ts` picks the sky from the clock and the sleep score. `tools/sky.test.mjs` checks the mapping.

### Phase 5: data views (`1fe53d8`)
- **What:** a 12-week calendar on Journey, one cell a day, brighter for more work; a gold ring for a perfect day; a dot for a week a boss came.
- **Logic:** `src/screens/calendar.ts` buckets days into five levels from pillars and ticks. Monday-first weeks, the newest ending with today.

### Phase 6: tour, accessibility, performance (`1fe53d8`)
- **What:** a first-run tour (shown once, for a game with no history); one HP bar with one colour rule (amber at or below half, red at or below a fifth); empty states; tap targets at least 44px; sprites loaded lazily.
- **Testing:** `tools/a11y.mjs --strict` reports small targets and unnamed controls. Small targets went from 17 kinds to 0, unnamed from several to 0.
- **Performance:** the Party tab under the heaviest fixture went from 340 files (27 KB) to 62 (3 KB). Deliberately not done: splitting the script per tab, a sprite sheet, caching the fold (it takes 22 ms for 1,700 events, 75 ms for 6,000).

### Phase 7: the shared motion kit with Life OS (`a15ea58`, `9130c6c`)
- **What, Pokedex side:** `tools/build-ui-kit.mjs` (`npm run kit`) copies the motion code to Life OS and writes `motion-tokens.css` with seven tokens: `--t-fade`, `--t-slide`, `--t-pop`, `--t-breathe`, `--ease-out`, `--ease-in`, `--ease-in-out`.
- **What, Life OS side:**
  - **XP chip when a habit expires.** It pushes out away from the XP bar (320 ms), hangs about a second with a small bob, then is pulled to the bar over about a second, slow at first and quick at the end. The bar pulses on landing. Several chips leave 180 ms apart. Measured in headless Chromium: 2.6 s end to end. `src/lib/flyReward.ts`, `BEATS = { push: 320, hang: 1050, pull: 1050, land: 180 }`.
  - **Tick.** A tick flashes the row and stamps its XP in (not on load, not on un-tick). `HabitsScreen.tsx`.
  - **Month review card.** Calm, no breathing. The Comet Shard floats on its own with no box behind it (`.review-shard`). One yellow "Close <Month>" button (it turns green with "Closed · tap to undo"), and a "Graph" link. Closing flies a shard to the "to collect" chip.
  - **Momentum flame.** The partner strip's momentum is a flame that grows with the multiplier (×1.35 and ×1.5 steps). `.flame`.
  - All of the motion is off under `prefers-reduced-motion`.
- **Gotcha, recorded in both docs:** Life OS's `.neo-button` and `.neo-card` backgrounds are unlayered, so a Tailwind `bg-*` class cannot override them. Use the `neo-card-yellow` / `neo-card-green` classes.

## 3. The rules, version by version (what the game does now)

Version 8 and 9 came before the overhaul began and are in `GUIDE.md`. The versions that changed during the overhaul:

### Version 10: the weekly boss (`77d3fe9`, `471eaef`)
- **Unlocks** only at a full party of six (the partner plus five fully trained). A boss comes each Monday for the week.
- **Its card** has up to five tasks taken from what you really do (sets, sessions, pieces of gear, etc.).
- **Its level:** `round(13 + 0.18 × Σ party levels)`. A legendary or Mega is heavier still.
- **Your strength against it:** each member's `level × rarity factor (common 1.0, uncommon 1.1, rare 1.25, legendary 1.5) × 1.15 if Mega`, against the six of the boss. Each hit is `clamp(ratio^1.2, 0.12, 1)`.
- **The kill needs every task.** Without the whole card done, no more than 95% of its HP falls (`KILL_CAP`). A day the card does not move heals the boss 3% (`BOSS_HEAL`).
- **Catching.** At 40% HP or less you get three throws. Catch chance is `CATCH_BASE 0.05`, plus per trained member, plus `0.30` for finishing the card, minus an HP cost; Master Ball is `0.9`.
- **Code:** `core/boss.ts` (maths), `core/fold.ts` (the run, `boss` state, `bossLog`), `src/Boss.tsx` (the tile, the fight, the log).
- **Simulator:** `tools/boss-sim.mjs` runs the odds so the numbers can be tuned before shipping.

### Version 11: scarcer Mega Stones (`5cd8391`)
- The kit paid a shard each set with no limit, which made Mega Stones far too easy. Now `KIT_SHARD_EVERY = 3`, so a shard every third full kit set. `KIT_IRON = 3`. Run 7 feats pay 15 gems.

### Version 12: eggs warmed by steps (`0569614`)
- **Before:** a Mystery Egg was warmed by days with two pillars (five days, four with an Old Charm), and when the Box was empty the game made up an "egg" partner.
- **Now, from `2026-10-14`:**
  - A Mystery Egg is warmed by the band's steps: each day adds `min(steps, 10,000)`, so a day with no reading adds nothing. It hatches at **50,000** steps (40,000 with an Old Charm). Five full days is the fastest.
  - **A beaten boss drops an egg** (`hold()` on the kill reward). The Rare shop still sells one for 150 gems.
  - **An empty Box gives a plain starter**, not an "egg". The "Hatched from an egg" label now means only a real hatch.
  - One egg is kept warm at a time; spares wait in the Bag.
- **Consequence:** no egg moves until steps arrive from a real Vitals sync. The egg logic is tested with fixed step counts, so it is not waiting on hardware.
- **Code:** `core/rules.ts` (`EGG_DAYS`, `EGG_STEPS`), `core/economy.ts` (`EGG_STEPS_OLD_CHARM`, item texts), `core/fold.ts` (the egg step in the fold, the boss drop), `src/screens/Nursery.tsx`, `src/Play.tsx`, `src/App.tsx` (the Rules text).
- **Not done:** the egg as a reward for other things (only the boss drop). `GUIDE.md` lists this as the one reward still open.

## 4. Life OS: the sync and its rules

Life OS carries a copy of the game core (`src/game-core`) so it can show the same numbers. It was synced for each version above:

| Commit | What |
|---|---|
| `9524714` | Month review: the shard flies to the strip; the Sunday panel shows "All clear". |
| `eebeb8a` | Sync core, version 10: reads the weekly boss from the ledger; strip line and toasts. |
| `b7e4fa6` | Sync core, version 11: scarcer Mega Stones. |
| `9130c6c` | Phase 7 (the kit, the chip, the review card, the tick, the flame). |
| `8dbb2a4` | Sync core, version 12: eggs on steps; guide and Vitals assessment updated. |

Life OS shows no egg of its own. The egg is a Pokedex thing; Life OS only needs the core copy to agree on the numbers.

The on-hold Life OS items from before the overhaul are all done: (a) the XP chip push, hang and pull; (b) the month review card, no breathing and no shabby card; (c) the box behind the Comet Shard icon, removed.

## 5. The Vitals question and the health bridge

**The question you asked:** do we need Vitals, or can the Google Health CLI feed the ecosystem directly?

**Answer, and what was built:** the CLI can feed it directly, and that path is built in `pokedex/bridge/`:

```
ghealth  →  bridge/sync.mjs  →  ledger (`vitals` events)  →  Pokedex, Life OS
             map.ts: Google's shapes → a day's readings
             model.ts + plan.ts: the sleep score and recovery, worked out once
```

- **Why the bridge computes the scores:** the old PC script `vitals/tools/sync.mjs` wrote the readings but **not the sleep score or recovery**; only the Vitals web sync did. The game pays the Sleep pillar, the second Bell, the boss's sleep task and the sky's weather on the score, so a CLI-only feed would have left the Sleep pillar unmeasured. `plan.ts` closes that gap.
- **Idempotent:** a day whose numbers match the ledger writes nothing. Running it twice is safe.
- **The Vitals app** (viewer plus Vercel web sync) is no longer in the game's path. It is untouched; archive it when the bridge is proven.
- **Not tested against a real band.** `ghealth` is not installed on this machine. First check: `npm run health -- --dry-run` on a machine with `ghealth`.
- **Schedule:** `bridge/README.md` has a Windows Task Scheduler recipe for 07:30 daily, with catch-up if the PC was off.
- **Assessment:** `lifeos/docs/VITALS-ASSESSMENT.md` records the options and the follow-up.

## 6. Tests and tools

| Command | What it checks |
|---|---|
| `npm test` (Pokedex, 94 tests incl. bridge) | Fold and rules (`core/fold.test.ts`), fixtures, styles and layers, sky, screens and the calendar, the Life OS kit copy, the bridge's mapping and planning |
| `npm run shots` | Screenshot comparison of every tab under each fixture, and the sky (`--update` to accept) |
| `npm run a11y` | Tap targets and unnamed controls, strict |
| `npm run core` / `npm run kit` | Copy the shared core and motion kit to Life OS (both have drift tests) |
| `npm run health` | Google Health into the ledger (`--dry-run` to preview) |
| `npm run build` | Typecheck and build |
| Life OS `npx tsc -b`, `npx vite build` | Life OS typecheck and build |

## 7. Known gaps and what is still open

- **Not yet proven on a real band.** The bridge, and therefore steps and measured sleep, are untested against Google Health. Eggs will not move until steps arrive.
- **Journey is still over the 2,500px target** (about 2,800 to 3,200px). The feats are folded behind one "All feats" line with the two closest shown. The league ladder (about 635px) and the season (about 467px) are the largest sections left.
- **Not built, on purpose:** per-tab code splitting, a sprite sheet for item icons, caching the fold. Measured, and not worth it yet.
- **Egg as a reward beyond the boss.** Left for later.
- **Vitals viewer trim or archive.** A decision for you once the bridge is proven.
- **Life OS egg display.** Not needed; Life OS shows no eggs.

## 8. File map

**Pokedex (game)**
- `core/`: `rules.ts` (numbers), `economy.ts` (items, shops, feats, chests), `boss.ts`, `fold.ts` (the game state), `facts.ts`, `events.ts`, `fold.test.ts`
- `src/`: `App.tsx` (tabs, top bar, scene, rules text), `Boss.tsx`, `Claim.tsx` (Collect), `Feats.tsx`, `Calendar` in `screens/`, `Nursery.tsx`, `Forge.tsx`, `Sky.tsx`, `HpBar.tsx`, `Tour.tsx`, `Sheet.tsx`, `overlay.ts`, `styles/` (layers and tokens), `lib/` (fixtures, motion, store, fx, sfx)
- `bridge/`: the health bridge (`sync.mjs`, `map.ts`, `model.ts`, `plan.ts`, README and tests)
- `tools/`: `shots.mjs`, `a11y.mjs`, `css-unused.mjs`, `build-core.mjs`, `build-ui-kit.mjs`, `boss-sim.mjs`, and the tests
- Docs: `UI-OVERHAUL.md` (the plan and phases), `BOSS-DESIGN.md`, `MOTION-AUDIT.md`, `AUDIT-2026-10-12.md`, and this file

**Life OS (habits)**
- `src/screens/HabitsScreen.tsx` (tick, chip, expiry), `src/lib/flyReward.ts` (the three-beat reward), `src/components/WeeklyPanels.tsx` (month review, Sunday panel), `src/components/PartnerStrip.tsx` (momentum flame), `src/index.css`
- `src/game-core/` (synced copy of the game core), `src/ui-kit/` (synced motion kit)
- `docs/GUIDE.md` (rules, per version, and the egg section), `docs/VITALS-ASSESSMENT.md`

## 9. How to keep it right

1. Change the rules in the **Pokedex** `core/`, not in Life OS.
2. Run `npm run core` and `npm run kit` in the Pokedex, then `npm test` there and `npx tsc -b` in Life OS.
3. Run `npm run shots`. If a change is meant, `npm run shots -- --update`.
4. Update `docs/GUIDE.md` (rules) and the relevant phase note here when something changes.
