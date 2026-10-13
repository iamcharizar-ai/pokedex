# A complete UI overhaul: the plan

Written 13 Oct 2026, revised 14 Oct after your answers. **Phases 0 to 3 are built; the rest is a plan.** It comes from reading the Pokedex end to end (about 1,370 lines of CSS in five files, a 1,070-line `App.tsx`, five tabs) and from the motion study.

## 0. Where this stands

**Your decisions**
- **No light theme.** Dark only.
- **The Home scene: as alive as I like.**
- **Every tab has one job.** Shop and Pokedex already do. Team mostly does. Home and Trainer are a mix, and Trainer is not used: its trainer card, trainer profile and "Your work" are dead weight, and last night's sleep belongs on Home.
- **Team needs a forge:** a place for Mega Stones, using the evolution choreography from the motion kit.
- **Mega Stones come too often** against how many Pokemon can use one.

**On hold until the rest is settled** (yours, recorded so they are not lost):
1. The egg gets a dedicated space, not a card on Home.
2. Steps from Vitals hatch the egg.
3. No second egg appears while one is warming; eggs themselves can be rewards.
4. Life OS: the XP chip should push out, hang for about a second, then be pulled in more slowly.
5. Life OS: the breathing month-review button looks shabby, and so does the square behind the Comet Shard.

**Built so far:** phase 0 (section 3), the Mega rebalance (section 4, rules version 11), screenshot comparison, phase 1 (section 5), phase 2 (section 5, with the result in section 2) and phase 3 (section 5).

**Your answers to the last round:** the Mega proposal, yes; Playwright, yes; the boss on Today as a tile that opens its full view.

## 1. What is wrong with the UI today

1. **Two visual systems at once.** `index.css` is the original cream-window game; `kit.css` and `skin.css` are the newer dark one. `skin.css` repaints the old classes and two more files sit on top. A change is made in two or three places and the cascade order decides who wins.
2. **Home is eleven blocks long**, and "what do I do next?" is answered in three of them.
3. **Tabs hold several ideas each.** Trainer is a stats card, the season, bosses, feats, work, sleep, badges, a chart and a log.
4. **Two card designs.** `MonCard` (older) and `KCard` (the kit's); only the kit page uses the better one.
5. **Windows, not sheets.** Centred modals are the hardest thing to reach with a thumb.
6. **Several overlays can open at once.** Seen in the `late` fixture: a chest capsule over the news window over a toast. They need one queue.
7. **The Pokedex grid draws a whole region at once** (up to about 150 animated GIFs).

## 2. Five tabs, one job each (built, phase 2)

**Measured result** (pixels tall on a phone, before and after, from `tests/heights.txt`): Today 3,814 to 1,624; Journey 14,517 to 2,796; Party 4,457 to 3,201 (with 16 trained Pokemon and a Box of 286, the heaviest fixture); Shop 2,500 and Pokedex 4,463 unchanged. Section 4 of the file `tests/heights.txt` has every fixture.

Each tab answers one question. Nothing appears in two places.

| Tab | The question | What is in it | What leaves |
|---|---|---|---|
| **Today** (was Home) | What is happening today? | The scene (partner against the wild Pokemon). Today's XP, the pillars and the week's seven momentum pips as one strip. Collect. **Last night** (moved here from Trainer). Throw and feed. Two compact tiles: the leader, and this week's boss (HP, days left, tasks done), each opening its full view as a sheet. | The momentum window and the quests window (to Journey). The egg card (on hold: it gets its own space). |
| **Party** (was Team) | What do I have, and what can I do with it? | The partner's summary. The party of six. The bond. Choices (branch, which form shows). **The Forge** (new, below). The Box. The Bag. | Nothing. |
| **Shop** | What can I buy? | As now. | |
| **Pokedex** | What have I seen and caught? | As now. | |
| **Journey** (was Trainer) | Where am I going, and what is next to earn? | Roads, top to bottom: the league (leaders and badges), the season, the week's quests, the feats, bosses beaten. The Hall of Fame. The adventure log, folded shut at the bottom. | **Trainer card, Trainer profile, Your work, XP per day**: deleted. Last night: to Today. |

Why this split: **Today** is everything that changes while you tick; **Party** is everything you own; **Journey** is everything you are walking toward. A thing that is none of those (the trainer card's totals, the 28-day stats, the per-domain "work" table) had no reader, so it goes. What the work table held that mattered is already elsewhere: runs are on the feats road, mastery levels are in each domain's shop.

### The Forge (Party tab)
A window of its own, not a line on a Pokemon's page:
- **The stone and the shards.** The Key Stone (dark until it is earned, with the feat that earns it), and your shards by colour as counts.
- **Who can Mega.** Every fully evolved Pokemon you own that has a Mega form, as cards: forged ones lit, forgeable ones breathing with their shard cost, the rest dark with what they need (the Key Stone, or which colour).
- **Forging** plays the full choreography: three shards slam into the stone one after another, the stone pulses, then the motion kit's "unlocked" popup (dimmer, sunburst, bloom, the Mega form slamming in, the title, the shine). Today it is a button on a Pokemon's page and only the slam plays.
- It also gives Megas a place to be *seen*: today a forged Mega is a chip on one page.

## 3. Phase 0, built: fixtures

`?fixture=<name>` loads a canned ledger instead of the network.

| Fixture | What it shows |
|---|---|
| `empty` | A new device: a habit library, nothing ticked. |
| `week` | Eleven ordinary days: partner at level 23, a wild Pokemon at 219 of 1,100 HP, two rewards to collect, the Key Stone just earned. |
| `late` | Five months: four trained Pokemon, a Box of 29, 22 feats, an egg warming, chests opened, 16,000 coins. |
| `boss` | A party of six on the Wednesday of a boss week: Dragonite at 958 of 6,200 HP, four kinds of ball to throw, eight rewards to collect. |

- **Add `&news`** to have everything recent told again on every load (reveals, toasts, chests, hatches). Without it a fixture opens quietly, so a screen can be looked at with nothing over it.
- **A fixture is ordinary ledger events** (a library, ticks, things bought) folded by the real rules, so it cannot show a state the game cannot reach.
- **It cannot touch your game.** The ledger is switched off while one is loaded, and this device's own memory (which news was told, the device id) is kept under a `fx.<name>.` prefix. A yellow tag on screen says it is a fixture.
- **`tools/fixtures.test.mjs`** folds each one and fails if a rules change leaves it showing nothing (no boss in `boss`, nothing to collect in `week`). It runs with `npm test`.

**What it found on its first day:**
- **The boss's throw animation never played.** The outcome was right, but the scene looked for the ball before the page had drawn it. Fixed, and seen working: the ball flies, rocks three times, the boss breaks free.
- **Overlays stack** (item 6 above).
- **The chest capsule works with real taps.**

**Screenshot comparison, built.** `npm run build && npm run shots` opens every tab of every fixture in a phone-sized browser, with motion stopped and the animated sprites masked, and compares it with `tests/baseline/` (20 pictures). It is stable (a rerun is 20 of 20 identical) and sensitive (one button turned red changed 15 of them). `npm run shots -- --update` takes new baselines after a change you meant. A difference is written to `tests/diff/`.

It also records how tall each screen is (`tests/heights.txt`). On a phone, **Trainer is 6,300 to 14,500 pixels tall** (seven to seventeen screens of scrolling), Pokedex 4,300 to 4,500, Team up to 4,500, Home up to 3,800, Shop about 2,500. That is the "stuff merged in tabs" you described, measured. Section 2's tabs should each come in under about 2,500.

## 4. Mega Stones: the numbers, and a proposal

Shards do not come from quests, seasons or pillars. They come from four places:

| Source | How many |
|---|---|
| **Feats** | 15 of the 52 pay one: a run of 7 days (1 each for code, gym, guitar, Arbor), a run of 30 (1 each), 100 days in all (1 each, not gym), a run of 100 (2 each). **19 in all, ever.** |
| **Strong's training kit** | A Red Shard for every full set of the seven routines, **with no limit**. |
| **A month-end review** | One Comet Shard a month, which fits any Mega. |
| **A boss kill** | One, rarely. |

A stone costs 3. Measured on the fixtures, **from feats alone**:

| | Days played | Trained | Can Mega | Shards | Stones |
|---|---|---|---|---|---|
| `late` | 151 | 4 | **1** (Charizard) | 8 | **2** |
| `boss` | 425 | 16 | **6** | 16 | **5** |

So feats alone gave two stones for the first Pokemon that can use one, and the fixtures have no Strong workouts or month reviews in them. With a seven-routine split and a review every month, five months is about 8 + 10 + 5 = 23 shards: **seven stones for one Pokemon**. You are right, and the unlimited source is the gear kit.

**Done, rules version 11.**
1. **The gear kit pays a Red Shard on every third full set**, and gems and Iron on the others. It stays worth doing; it stops being a tap.
2. **A run of 7 days pays gems, not a shard.** Those four arrive in the first fortnight, months before anything can Mega. The Key Stone still comes from a run of 7.
3. **A stone still costs 3.** With the two changes, five months gives about 4 (feats) + 3 (kit) + 5 (reviews) = 12 shards, four stones, against one to three Pokemon that can use them: scarce enough to choose, not so scarce that a review feels wasted.
4. **Nothing already earned is taken back.** Shards in the Bag stay.

**After the change**, feats alone give 5 shards by day 151 (was 8) and 12 by day 425 (was 16), and a full set of the kit pays Iron and gems instead of a shard two sets in three.

## 5. The rest of the overhaul, in order

### Phase 1: one token layer and cascade layers (built)
- **`src/styles/tokens.css`** is the one place a colour, face or size is defined: the old window palette, the kit's palette, and new scales (a 4-pixel spacing grid, three radii, three lifts, a type scale, the motion kit's timings and easings) that the rebuilt screens will read. A test (`tools/styles.test.mjs`) fails if any other file defines a `:root` value.
- **`src/styles/index.css`** is the only stylesheet code imports. It declares `@layer tokens, legacy, screens, motion;` and imports each file into a layer. A second test fails if a stylesheet is left out or imported around it.
- **All five old files are one layer, `legacy`, in the order they always cascaded in.** I first tried one layer per file and the screenshots caught it: a layer beats specificity, and the skin retints the cream screens by out-ranking them on specificity (a plain `.kind` over `.kind.k-catch`), so splitting them turned the adventure log's coloured tags grey, bars from blue/green/gold to grey, and a road's gap from 8 to 10 pixels. One `legacy` layer gives zero differences across all 20 screenshots.
- **A screen is rebuilt by moving it into `screens`** (one small file) and deleting its rules from `legacy` in the same change. When the last has moved, `legacy` is empty and goes. That is how the two skins stop fighting without a risky big-bang rewrite.

### Phase 2: the five tabs of section 2 (built)
- **Today** (was Home): the scene, one strip (the day's pillars, the seven momentum dots, how far from evolving), the throw and feed buttons, then two tiles: **the leader** and **the boss**. Each tile shows who it is, the HP left and one line of state, and opens the full view as a **bottom sheet** (backdrop, close button and Escape all close it; `screens/Sheet.tsx`). Last night sits at the bottom, with the last 14 nights folded under it. The momentum window, the quests and the egg card are gone from here.
- **Party** (was Team): **the Nursery** (the egg's own space, drawn large with cracks that grow; empty, it says where one comes from), the partner, the party of six, the bond, then **the Forge**, then the Choices, Bag and Box folded shut. Each Pokemon's own page no longer has a forge block.
- **The Forge** (`screens/Forge.tsx`): the Key Stone, every shard you hold (the Comet too), and every Mega form of every Pokemon that has one. The ones ready to forge show first (four, the rest folded), then those that are not ready, then those forged. Forging plays the shard slam into the stone, then the evolution popup with the Mega slamming in. It tells the news window it has already told it, so there is no second window after.
- **Journey** (was Trainer): the league road, the season, pay and quests, feats, bosses beaten, then the Badge case and the Hall of Fame folded shut, and the Adventure log folded at the bottom. The road shows what is behind as a count, this leader, and the next four. **Deleted:** the trainer card, the trainer profile (the radar), "Your work", the XP chart and the full sleep page.
- The window frame (`Win`) can now fold shut (`fold`), which keeps a store that grows from making a tab long.
- 58 CSS rules for the deleted and replaced screens were removed with `tools/css-unused.mjs` (a permanent tool: it lists, or with `--fix` removes, rules for classes no code uses). The screenshots were identical before and after.
- **Not done in phase 2:** `MonCard` is still in use (every Pokemon a `KCard` is a visual change that belongs with phase 3's cards), and the Collect strip is still a block at the top of every tab rather than a badge that opens a sheet (phase 3).

### Phase 3: how it is held (built)
- **A top bar with the partner in a level ring.** One compact row (about 90 pixels): the partner's face inside a ring that fills with its level progress and wears its level, then coins, gems, and a **Collect badge**, then help and sync. The season is a thin bar under it. The old Collect strip, which sat as a block on top of every tab, is gone.
- **Collect is a sheet.** The badge is gold with a count when rewards wait (and breathes), grey when not. Tapping opens a thumb-reachable list with "Collect all"; claiming flies each reward to the pill or tab that keeps it, and the sheet puts itself away once the last is taken.
- **One overlay queue** (`screens/overlay.ts`). The news window, a chest, a hatch and a sheet you opened now take turns: a sheet you opened goes first and everything automatic waits behind it; otherwise news, then chests, then hatches, in the order they asked. Checked on the `late` fixture, which used to stack three at once: news first, then each chest alone, never two together.
- **A Pokemon's page is a sheet**, like the boss and the leader. The Shop's old chest window is deleted (it opened a second window over the new capsule: a bug from the motion work).
- **Sheets close four ways:** the backdrop, the close button, Escape, or **dragging the handle down** past about a hundred pixels (a shorter drag snaps back).
- **Swipe between tabs:** a long, mostly sideways, quick drag changes tab. It ignores a drag that starts on something that scrolls sideways or in a field, does nothing while a sheet or overlay is open, and stops at the first and last tab.
- **Haptics** (`navigator.vibrate`) on the beats that have a sound: a tap, a buy, a hit, a collect, a catch, a level banner. They follow the sound switch, now labelled "Sound and buzz". Nothing happens on a device that cannot vibrate.
- **Not done:** the cards. Every Pokemon is still a `MonCard`; moving them to the kit's `KCard` is a visual change that fits with phase 4.
- Heights fell again, about 160 pixels on every tab (Today 1,465 under `boss`; Journey 2,637).

### Phase 4: the scene
Layered parallax (sky, far hills, near ground), a sky on the real clock with the weather last night's sleep implies, the partner idling and turning toward what the wild Pokemon does, and reacting when tapped. No reward for tapping: it is life, not a mechanic.

### Phase 5: readable data
With the trainer card gone this is small: a 12-week calendar heat map on Journey in place of the XP chart (a cell a day, a ring for a perfect day, a dot for a boss week), and one HP-bar component for the wild Pokemon, the leader and the boss.

### Phase 6: for everyone
A first-run tour of five cards and an empty state for every list; an accessibility pass (44-pixel targets, a non-motion equivalent for every motion, focus rings, live regions); performance (code split per tab, one sprite sheet for item icons, the fold cached by day, GIFs stopped off screen).

### Phase 7: Life OS gets the same kit
Share the tokens and motion kit the way the core is shared. This is where the on-hold Life OS items are done properly.

## 6. What I would not do

- **A rewrite in another framework or a game engine.** The game is a spreadsheet of events with a face.
- **More currencies, more tabs or more windows.** The overhaul should leave fewer places to look.
- **Anything that copies art or sound** from the study. The kit is choreography; the look stays ours.

## 7. Size

| Phase | Effort | State |
|---|---|---|
| 0 Fixtures and screenshots | half a day | **done** |
| 1 Tokens and layers | 1 session | **done** |
| 2 Five tabs and the Forge | 3 sessions | **done** |
| 3 Sheets, queue, swipe, haptics, top bar | 1 session | **done** |
| 4 The scene | 1 to 2 sessions | |
| 5 Data views | half a session | |
| 6 Tour, accessibility, performance | 2 sessions | |
| 7 Shared kit with Life OS, and the on-hold Life OS items | 1 session | |

## 8. Decisions I still need

1. **Vitals first, then the egg.** See `lifeos/docs/VITALS-ASSESSMENT.md`. The egg-on-steps change (rules version 12) only means something once a real sync has landed, and nothing in the repo shows one has. Can you check Today's "Last night" on a morning after the 07:00 job, or tell me where the Google Health data comes from today?
2. **Phase 4, the scene** (parallax, a sky on the real clock, a partner that reacts), or the egg change, or the Vitals trim, next?
