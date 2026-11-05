# Game redesign, v4 (5 Nov 2026): V21 built and tuned, not live

**V4 is V21 as built** (`RULES-V21.md`).

- `V21_START` is a placeholder (2099-01-01). It is set only on your approval.
- Section 0 below is what changed from v3 and the real-code numbers. The rest of this file is the v3 design it was built from. Where they differ, section 0 and `RULES-V21.md` are what the code does.

## 0. V21 as built: changes from v3, tuned constants, real-code numbers

**Your changes:**

1. **A neglected pillar never drops off the card.** The pillar done least in the last 21 days always keeps a task with a target of 1 or 2, even if it was done on fewer than 3 days (`core/boss.ts tasksV21`).
2. **Neglect bounty, tuned on the real code** (`tools/sim-life.mjs --bounty` and `--skip`, 182 days, Code skipped):
   - **Where skipping starts to pay:** skip-and-cash-in never beats steady on XP, at any pace, up to ×5. On the skipped pillar's counter it starts to beat steady **between ×4 and ×5** (normal pace, Tuesday and Wednesday skipped every week: −3% at ×4, +5% at ×5).
   - **Set just under that line: ×3 at 2 idle days, ×4 at 3 or more.**
   - **With ×3 / ×4, steady still wins on every measure at every pace:**

     | Pace | 2-day skip | 3-day skip | Week skip |
     |---|---|---|---|
     | normal | −10% counter, −6% XP | −4%, −11% | −29%, −17% |
     | real | −3%, −6% | −8%, −8% | −38%, −16% |
     | strong | −34%, −7% | −35%, −10% | −35%, −16% |

   - Hearts, gems, research and boss wins are lower for every skip plan.
   - Earlier grid, for the record. The counter change for a 2-day skip was:

     | Pace | ×1.5 | ×2 | ×3 |
     |---|---|---|---|
     | normal | −30% | −24% | −13% |
     | real | −7% | −6% | −4% |

3. **First-pillar bonus:** +1 heart, +40 research and +2 gems on any day with at least one effortful pillar. A 1-pillar day goes from 1 heart, 60 research and 0 gems to **2 hearts, 100 research and 2 gems** (before the desk and a good night).

   | Pace | Lab ranks in 6 months (off → on) | Hearts a day | Gems a month |
   |---|---|---|---|
   | real | 14 → 19 | 4.5 → 4.9 | 324 → 377 |
   | normal | 54 → 62 | 10.3 → 10.9 | 899 → 964 |
   | strong | 69 → 79 | — | — |

   The top stays steep: a Max day is 11 hearts against 2, and 340 research against 100.

**Other context you gave:**

- **Code is your Take U Forward practice.** Its id and mechanics are unchanged, and no new rule or label says "LeetCode".
- **Code stays an honour tick.** No anti-fake mechanism was built.
- **Where a verified source plugs in later:** `VERIFIED_BY` in `core/rules.ts`. Gym is `{ fitness: 'workouts' }`, read by `core/strong.ts`. A LeetCode or other sync for Code would add `code: 'solved'`, a `solved` count in `DayMarks`, and a reader like `strong.ts`. The fold and the tier need no change.

**Constants tuned on the real code** (compared with the v3 model):

| Constant | v3 | Built | Why |
|---|---|---|---|
| `DAY_XP_MULT` | 1 / 1 / 1.1 / 1.25 / 1.5 | **1 / 1 / 1 / 1.1 / 1.15** | Momentum ×1.5 stacks, plus Best friends. The v3 curve trained 9 partners in 6 months against today's 7; this gives 8 |
| `RANK_V21` | 1,200 | **1,500** | The first-pillar research made ranks a third faster; now about 8.7 a month at normal pace |
| `BOUNTY` | ×1.25 / ×1.5 | **×3 / ×4** | Point 2 |
| Boss card (`core/boss.ts`) | stretch 1.25, targets 1 to 6, Max day ×1.5 | **stretch 1.3, targets 2 to 9, Max day ×1.45; every effortful pillar on the card, a neglected one at 2** | Normal pace won 90% of weeks and strong 100% (three seeds each). Now 77% normal, 23% real, 96% strong. No target below 2, so no card falls on its first day |

**Real-code numbers** (`tools/sim-life.mjs --rules v21`, 182 days):

| | normal | real | strong |
|---|---|---|---|
| **Gems a month** | ~915 | ~367 | ~1,190 |
| **Eggs hatched a month** | 5.8 | 5.2 | 5.2 |
| **Box at month 6** | 99 | 65 | 136 |
| **Hearts a day** | 9.4 | 4.8 | 10.6 |
| **Boss win rate** | 92% (24/26) | 27% (7/26) | 100% |
| **A chores-only day** | 176 XP, 22 coins, 138 wild HP, 38 leader HP, 0 research | 96 XP, 0 coins, 58 wild HP, 17 leader HP, 0 research | 187 XP, 37 coins, 187 wild HP, 48 leader HP |
| Fully trained in 6 months | 8 | 3 | 8 |
| Leaders | 58 | 23 | 64 |
| Lab ranks | 52 | 15 | 66 |
| First Mega Stone | day 15 | day 32 | day 13 |
| Weeks with a visible win | 26/26 | 26/26 | 26/26 |

**Where the real code differs from the v3 model:**

1. **Gems are 2.5× the model's** (915 against 375 a month at normal pace). The model counted only tiers, leaders and the boss.
   - By source a month at normal pace: tiers 127, leaders 134, feats 161, quests 79, the season ladder 30, the Frontier 53, and other 323 (evolutions, graduations, catches, the boss, Lab ranks, level milestones, kit sets).
   - Quests, the season ladder and the Frontier (about 160 a month) are V22 cuts.
   - Even after them, gems outrun the sinks: 3,787 unspent by month 6 with Lab picks and Mystery Eggs bought. **V22 needs a gem sink or lower gem sources.**
2. **Hearts at real pace are 4.8 a day, against 2.6.** The first-pillar heart, the bounty, and party members' hearts on days of their work, which the model left out.
3. **The Box is larger** (99 / 65 / 136 against 84 / 43 / 111).
   - Every beaten boss joins.
   - Duplicates were rare (1 in a normal run), because new species are preferred while any are left.
4. **The first Mega comes sooner** (day 15 / 32 against 25 / 73), because each pillar's shop now sells its shard at 20 marks.
5. **A chores-only day pays more XP than modelled** (176 at normal pace against 115). Momentum's free rest day keeps ×1.5 on the week's day off.
   - Its coins are lower (22), because many simulated off days are under half the chores.
   - The wild hit includes balls thrown that day.
6. **Leaders fall faster than today:** 58 in 6 months against 47, from the ×1.25 to ×2 leader hit by tier.

**Not built yet** (screens, needed before `V21_START` is set):

- **The Life OS tile renderer.** The core's `game.tiles` is ready, and `npm run core` carries it.
- **Pokedex screen wording for V21:**
  - the Lab's "+N a day" ledger (it still shows desk and party study);
  - the boss screen (throws, the party lock);
  - the Trainer perk ladder (bounty and Sharing in place of Focus and Exp. Share; no stars);
  - the momentum label ("N of the last 7 days");
  - an "aim" control (shard or egg) for each pillar's tile.
- **None of this is visible today**, because V21 doesn't apply to any real day yet.

---

# The v3 design this was built from

V3 brings in your decisions on the five open points, the neglect bounty (item 11) and the tile spec. **Nothing past step 1 is built.** V21 waits for your "go".

**The design principle:**

- The game heavily rewards the **effortful pillars**: Code, Gym and Arbor, plus Guitar when it is back on the list.
- It also heavily rewards **Max days**.
- Chores are baseline: a small, visible floor and nothing big.
- The tuning target is the normal pace. The real pace is a floor test: a bad week still shows at least one visible win.

**Settled:**

| | Decision |
|---|---|
| Pillars | Code (`leetcode-coding`, used for Take U Forward practice) is a pillar. Guitar stays shelved |
| Cut | The Battle Frontier |
| Held items | At most 4, each with a visible effect |
| Boss | A beaten boss joins you |
| **Catching** | Stays share-of-habits. The catch formula is unchanged |
| **Code** | Stays an honour tick: no stepper, no sync. A verified source can plug in later (section 0) |
| **Gym** | No 20-minute minimum. I read the optional line you left in as **kept**: a Gym day needs a logged Strong workout of any length. If you meant to delete it, this and the core change in §6 both drop |
| **Momentum** | Kept, the sliding version with a free rest day |
| **Arbor** | The tick stays as it is |

**Version names:** step 1 shipped as **V20** (`RULES-V20.md`, live on 5 Nov). The bundle is **V21**: one rule version, one start date (the deploy day).

---

## 1. The loop, in one sentence

**Each effortful pillar you do lifts the whole day a tier. Higher tiers feed your partner, the Lab, the boss and your bond far more. Chores keep the lights on.**

## 2. Reward tiers

**Tier = effortful pillars done that day.** Sleep never counts towards it.

The numbers are for your list (29 habits) on a typical day: sleep around 85, 80% of chores.

| | **Chores only** | **1 pillar** | **2 pillars** | **3 pillars** | **Max day** (all 3 + ¾ of chores) |
|---|---|---|---|---|---|
| XP multiplier | ×1 | ×1 | ×1.1 | ×1.25 | **×1.5** |
| Partner XP, typical (before momentum) | 115 | 215 | 347 | 519 | **≈ 640** |
| Momentum on top (§7) | ×1 to ×1.5 | ×1 to ×1.5 | ×1 to ×1.5 | ×1 to ×1.5 | ×1 to ×1.5 |
| Gym leader hit multiplier | ×1 (chores' XP, about 30) | ×1 (≈ 150) | ×1.25 (≈ 330) | ×1.5 (≈ 570) | **×2 (≈ 780)** |
| Partner hearts | 0 | 1 | 3 | 6 | **10** |
| Research | 0 | 60 | 140 | 220 | **300** |
| Research as a share of a 1,200 rank (typical desk, +40%) | 0 | 7% | 16% | 26% | **35%** |
| Gems | 0 | 0 | 0 | 2 | **5** |
| Coins | 40 (half ticked) / 60 (¾) | 60 | 90 | 140 | **200** |
| Boss | the chores task only | its tasks advance | its tasks advance | its tasks advance | **each task's progress ×1.5** |

**How steep:** from 1 pillar to a Max day is **×10 hearts, ×5 research, ×5 gems, ×2 leader damage, and ×3 XP**.

**Why XP is gentler than v2 (×1.5 at Max, not ×2):** momentum now stacks on top of the tier.

- With v2's ×2 and momentum, a normal-pace partner was fully trained every 3 weeks: **9 in 6 months**.
- With ×1.5 it is **7**, the same as today's game.
- The steep curve lives in hearts, research, gems and the leader instead.

**The perfect day** (every habit ticked) = a Max day plus, as now, an instant catch and a 1-in-10 shiny.

**With Guitar back** the tiers are 1 / 2 / 3+ / Max, and Max needs every effortful pillar on the list.

## 3. Sleep is a bonus on pillar days

- **XP:** the night's score still pays its XP every day.
- **Bonus:** a night of 80+ on a day with **at least one effortful pillar** adds +1 partner heart, +20% research, and +1 Bell (+2 at 90+).
- **Otherwise:** XP only.
- **Counting:** Sleep never counts as a pillar towards a tier, momentum or a boss task.

## 4. The chore floor

**A chores-only day moves:**

| Moves | How much |
|---|---|
| The partner's XP bar | About 115 XP |
| Coins | 40 / 60 |
| The wild Pokemon | Unchanged, by share of habits: about 78 HP at 20 of 28 ticked |
| The gym leader | The chores' XP, about 30 |
| The boss | The chores task, at ¾ ticked |
| The egg | Its steps |

**It doesn't move:** hearts, research, gems, the pillar counters, the Sleep bonus, momentum (it counts as the week's rest day or a step down), or a bounty.

## 5. Neglect bounty (replaces Comeback, on every pillar)

- **Unlock:** at **40 Trainer hearts**, about week 1 at normal pace and week 2 to 3 at real.
- **The rule:** a pillar idle **2 days** pays **+25%**, and **3 or more days** pays **+50%** (the cap). It applies to that pillar's own XP and counter, on the day it comes back. It never stacks past the cap, and doing the pillar clears it.
- **Which pillars:** **all of them**: Code, Gym and Arbor (Guitar when back). There is no verification condition any more.
- **What it doesn't touch:** it isn't a currency, and it doesn't touch the tier, hearts, research, gems or the boss.
- **With the tiers:**
  - It multiplies the pillar's 100 XP **before** the tier multiplier: at most +50 XP on a 1-pillar day, +75 on a Max day.
  - It can't lift a day a tier.
  - On the counter, one comeback day is worth 1.5 days of that pillar against the 2 to 7 days missed.

**Steady beats skip-and-cash-in at every pace.** Model, a week's average over 26 weeks, Code as the skipped pillar, tiers, momentum and bounty all on:

| Pace | Plan | XP a week | Hearts | Research | Gems | Bosses won |
|---|---|---|---|---|---|---|
| normal | **steady** | **4,423** | **67** | **2,074** | **73** | **85%** |
| normal | skip a week every other week | 3,550 (−20%) | 52 | 1,559 | 51 | 46% |
| normal | skip 2 days every week | 3,962 (−10%) | 58 | 1,770 | 65 | 81% |
| real | **steady** | **1,348** | **18** | **477** | **25** | **27%** |
| real | skip a week every other week | 1,190 (−12%) | 13 | 356 | 20 | 23% |
| real | skip 2 days every week | 1,291 (−4%) | 16 | 428 | 21 | 12% |
| strong | **steady** | **5,803** | **93** | **2,903** | **102** | **100%** |
| strong | skip a week every other week | 4,605 (−21%) | 69 | 2,125 | 70 | 50% |
| strong | skip 2 days every week | 5,032 (−13%) | 77 | 2,385 | 87 | 100% |

## 6. Honour ticks

| Pillar | Counts as done (from V21) | Note |
|---|---|---|
| **Gym** | **A Strong workout is logged that day**, any length. The tick is optional: the workout alone counts | A Gym tick with no workout pays as a basic habit (1 XP) |
| **Code** | The tick, as now | Honour |
| **Arbor** | The tick, or every planned practice item logged, as now | Honour for the tick |
| Guitar (when back) | As now | — |

**What changes in the fold (Gym only):**

- `core/facts.ts`: for days from V21, the Gym pillar's `done` comes from `marks.workouts ≥ 1`, not the tick.
- `marksOf` (`src/lib/marks.ts`, which reads Strong workouts from the ledger) moves into the core.
  - Today Life OS folds **without** marks (`lifeos/src/lib/game.ts:28`), so its Gym days would never count.
  - In the core, both apps read the same workouts through `npm run core`.
- If the Gym line goes, neither change is needed.

### Fake-tick exposure

A week of Code and Arbor tapped every day with nothing done, chores as at normal pace. Model, a week's average:

| Week | XP | Hearts | Research | Gems | Counters | Boss won |
|---|---|---|---|---|---|---|
| Honest, normal pace | 4,423 | 67 | 2,074 | 73 | 14.6 | 85% |
| Honest, real pace | 1,348 | 18 | 477 | 25 | 6 | 27% |
| **Fake (Gym needs Strong, as proposed)** | **3,608** | **52** | **1,591** | **53** | **14** | **92%** |
| Fake, if Gym were a plain tick too | 6,034 | 96 | 3,021 | 92 | 21 | 96% |

**What that means:**

- **With the Gym rule,** two fake taps a day earn about **80% of an honest normal week**, and about **3× your real pace**.
- **Without the Gym rule,** fake beats honest normal by **about 40%** on every measure.
- The Strong requirement roughly halves the gap between fake and honest. It costs one rule.
- With Code and Arbor as honour ticks, **the tiers trust you**: a 2-tap habit pays like a 2-pillar day, and every day it keeps momentum at ×1.5 and the boss card full.

## 7. Momentum (kept)

- **Up:** a day with **2 effortful pillars** moves it up one step (×1 → ×1.2 → ×1.35 → ×1.5).
- **Down:** any other day moves it down one, **except one free rest day a week**.
- **What it multiplies:** XP only, after the tier.
- **The Mon to Sat plan reaches ×1.5** in its first week and stays there.

| Pace | Days at ×1.5 in 6 months | Mostly |
|---|---|---|
| normal | 147 of 182 | — |
| real | none | ×1 (158 days) |
| strong | 179 | — |

## 8. The Lab

- **When it studies:** only on days with an effortful pillar.
- **How much:** research by tier (60 / 140 / 220 / 300). Each desk Pokemon adds +10 / 15 / 20 / 30% by rarity, and a Sleep bonus night adds +20%.
- **Rank:** a flat **1,200**.
- **Rank rewards:** odd ranks let you **choose the next wild Pokemon from three**; even ranks give 20 gems; every 5th rank gives a Mystery Egg.
- The −3% wild HP per rank stays, so the catch pace is untouched.

| Pace | Ranks a month (model) |
|---|---|
| normal | 7 to 8 |
| real | 1 to 3 |

## 9. The weekly boss

**Card rules:**

1. 3 to 5 tasks.
2. One effortful task per pillar done on 3+ of the last 21 days, **always at least one**. Together they stand for **70% of its HP**.
3. At most one Sleep task (80+ nights on effortful days) and one chores task (¾-ticked days), 15% each.
4. Targets: the last 21 days' rate × 1.25, between 1 and 6 a week.
5. Shelved pillars never get a task.

**The fight:**

- **Power:** Mega +5% per bond level; +5% for each party member whose type beats the boss's; the Rocky Helmet +15%.
- **A Max day's progress counts ×1.5.**

**Payouts:**

| HP taken | Pays |
|---|---|
| 25% | 100 coins and a Great Ball |
| 50% | 5 gems and an Oran Berry |
| 75% | 10 gems and an Ultra Ball |
| **Beaten** | 20 gems, its shard, and **it joins you** |

## 10. Currencies, held items, the Box

**Currencies:**

| | Earned by | Buys |
|---|---|---|
| Coins | The tier's coins | The Mart: 3 balls, 2 berries, the Rest token |
| Gems | Max days, 3-pillar days, perfect days, leaders (10 / 15 / 40), the boss, even Lab ranks | A Lab pick (60, one per wild Pokemon), a Comet Shard (200), themes, Rare Candy for fully trained Pokemon only |
| **Pillar counters** (Iron, Parts, Sprouts) | +1 per pillar day (× bounty); Iron also from 10k steps and records | At 20: **its egg or its shard**. An egg only while fewer than 3 wait |
| Bells | Sleep bonus nights | At 20: its egg or 5 hearts |

**Held items (4):**

| Item | Effect |
|---|---|
| Rocky Helmet | Boss +15% |
| Expert Belt | +25% when your partner's type beats the leader's |
| Shell Bell | Tier hearts ×1.5 |
| Quick Claw | Wild hit +25% on effortful days |

**What surplus Pokemon are for:**

1. **The weekly deck:** the boss's type changes every week, and type-edge members add +5% each.
2. **The desk:** rarity adds research.
3. **Future partners.**
4. **Duplicates become bond:** a second Pokemon of a line you own adds 20 hearts to the one you have, instead of a copy. A shiny is kept.
5. **The Pokedex.**

**Mega, Max day, bond:**

- **Mega:** +5% per bond level, as partner, and half that from the party. It applies to leader hits and boss damage.
- **Max day:** the top tier. G-Max is its picture.
- **Trainer perks:** Pickup 10, **Neglect bounty 40**, Endure 100, Best friends 200, Sharing 350.
  - Sharing: spare hearts go to the party.
  - 150 hearts = Best Friend; then Ribbons.
- **Cut:** Mega for a day, Trainer stars, and the Exp. Share.
- Rare Candy works on fully trained Pokemon only.

## 11. Life OS tiles

- **The core exposes** `game.tiles` per effortful pillar on today's list: `{ iconId, fill, bountyActive, ready }`.

  | Field | Meaning |
  |---|---|
  | `iconId` | Its shard until your first Mega Stone, then its egg. Switchable in the Pokedex |
  | `fill` | The counter ÷ 20 |
  | `ready` | A choice waits |
  | `bountyActive` | Idle 2+ days and 40 hearts unlocked. **Now on every pillar** |

- **Life OS only renders it:** a ghost icon that fills, glows when ready, and has a reserved badge slot. No numbers, and chore tiles stay plain.
- **Tap or long-press** deep-links to the Pokedex.
- It ships through `npm run core`.

## 12. The V21 bundle

`V21_START` = the deploy day. Earlier days fold as now.

**In V21:**

1. Tiers, the Sleep bonus, the chore floor.
2. The neglect bounty (every pillar).
3. Sliding momentum (2 effortful pillars, one free rest day).
4. Gym needs a logged Strong workout, with `marksOf` moved into the core.
5. The Lab rule.
6. The boss rules.
7. Mega by bond; Max day; Mega for a day, Trainer stars and the Exp. Share switched off.
8. Bond: Sharing, Best Friend, Ribbons, duplicates as hearts.
9. Tile state.

**Later, V22 with a UI pass:**

- the currency merge (pillar counters replace the five marks shops);
- the cuts: held items to 4, TMs, Plates, mastery, vitamins, natures, X items, crits, treasures, chests, quests, season, evolution items, fossils and the Frontier;
- holdings converted to coins and gems.

## 13. Numbers at three paces

Model of V21, 182 days, your list, Guitar shelved.

| | normal | real | strong |
|---|---|---|---|
| XP a week | 4,423 | 1,348 | 5,803 |
| Fully trained in 6 months | 7 | 2 | 10 |
| **Gems a month** | 374 | 120 | 523 |
| **Eggs a month** (laid / hatched) | 5.5 / 5.0 | 4.5 / 4.0 | 5.5 / 4.8 |
| **Box at month 6** | 84 (≈95 with balls) | 43 (≈55) | 111 |
| **Hearts a day** | 9.7 | 2.6 | 13.4 |
| **Boss win rate** | 85% | 27% | 100% |
| Lab ranks in 6 months | 44 | 10 | 62 |
| First Mega Stone | day 25 | day 73 | day 23 |
| Leaders beaten | 43 | 15 | 57 |
| Weeks with a visible win | 26 of 26 | 26 of 26 | 26 of 26 |
| **Fake week** (Code + Arbor taps, Gym needs Strong) | 3,608 XP, 52 hearts, 1,591 research | — | — |

**A chores-only day moves:** about 115 XP, 40 to 60 coins, the wild Pokemon (about 78 HP), about 30 leader HP, the boss's chores task, and the egg's steps.

**How the model works, and its limits:**

- It is arithmetic of these rules on the same day generator as `tools/sim-life.mjs`. Unchanged parts (wild HP, the hit, leader HP, egg sizes) use the core's own functions.
- It throws no balls (catches are low by about 2 a month).
- It assumes one or two type-edge party members and a Mega at bond 3, and leaves out the monthly Comet.
- Real numbers come once V21 is built and `tools/sim-life.mjs` runs it.
