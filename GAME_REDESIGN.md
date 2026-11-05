# Game redesign proposal, v2 (5 Nov 2026)

Revised from your brief of 5 Nov (items 1 to 10), the neglect-bounty addendum (item 11) and the tile spec. **Nothing past step 1 is built.** This waits for your approval of the V21 bundle.

**The design principle, which overrides v1 where they conflict:**

- The game heavily rewards the **effortful pillars**: Code, Gym and Arbor, plus Guitar when it is back on the list.
- It also heavily rewards **Max days**.
- Chores are baseline. They get a small, visible floor and nothing big.
- The tuning target is the normal pace. The real pace is a floor test: a bad week still shows at least one visible win.

**Settled by your answers:**

- LeetCode is a pillar and Guitar stays shelved.
- The Battle Frontier is cut.
- At most 4 held items stay, each with a visible effect.
- A beaten boss joins you.

**Version names:** step 1 already shipped as **V20** (`V20_START = 2026-11-05`, see `RULES-V20.md`). So the bundle your brief calls "V20" is **V21**: one rule version with one start date, the day it deploys.

---

## Step 1: done (V20)

- **B2: auto-fill skips the desk.** An open party place fills from the box, never from the desk (`src/lib/party.ts`, `planFill`).
- **B3: a desk change counts today.** From V20 the day's research is added after the day's actions (`core/fold.ts`, `study()`).
- **The Lab says whether today counts, and why:**
  - the fold exposes `research.counts`, which is `pillar`, `sleep` or `none`;
  - the Lab shows "Today counts: +N research" or "Today doesn't count yet: Sleep alone isn't a day of work. Do Code, Gym or Arbor…".
- **Tests:**
  - `core/v20.test.ts` and a new case in `tools/party.test.mjs`;
  - `npm test` passes, 213 of 213;
  - `npm run core` copied the core into Life OS, and Life OS typechecks with it.
- **Old days:** the real ledger folds identically with the old and the new core.
- **Not committed yet.**
- **The simulator:** `node tools/sim-life.mjs --pace normal|real|strong` plays today's rules forward.

---

## 1. The core loop, in one sentence

**Each effortful pillar you do lifts the whole day a tier. Higher tiers feed your partner, the Lab, the boss and your bond far more. Chores keep the lights on.**

## 2. Reward tiers (item 3)

**Tier = how many effortful pillars are done that day** (verified, section 6). Sleep does not count towards the tier (section 3).

The numbers are for your list (29 habits) on a typical day: sleep around 85 and 80% of chores.

| | **Chores only** | **1 pillar** | **2 pillars** | **3 pillars** | **Max day** (all 3 + ¾ of chores) |
|---|---|---|---|---|---|
| XP multiplier | ×1 | ×1 | ×1.25 | ×1.5 | **×2** |
| Partner XP, typical | 115 | 215 | 394 | 623 | **≈ 840** |
| Gym leader hit multiplier | ×1 (chores' XP only, about 30) | ×1 (≈ 150) | ×1.25 (≈ 330) | ×1.5 (≈ 570) | **×2 (≈ 780)** |
| Partner hearts | 0 | 1 | 3 | 6 | **10** |
| Research | 0 | 60 | 140 | 220 | **300** |
| Research as a share of a 1,200 rank, with a typical desk (+40%) | 0 | 7% | 16% | 26% | **35%** |
| Gems | 0 | 0 | 0 | 2 | **5** |
| Coins | 40 (half ticked) / 60 (¾) | 60 | 90 | 140 | **200** |
| Boss | the chores task only | its tasks advance | its tasks advance | its tasks advance | **each task's progress ×1.5** |

**How steep:** from 1 pillar to a Max day is **×10 hearts, ×5 research and ×4 XP**.

**The perfect day** (every habit ticked) is a Max day plus, as now, an instant catch and a 1-in-10 shiny.

**With Guitar back** there are four effortful pillars. The tiers become 1 / 2 / 3+ / Max, and Max needs every effortful pillar on the list plus ¾ of chores.

**How often each tier came up in the model** (days a month):

| Pace | Chores only | 1 | 2 | 3 | Max |
|---|---|---|---|---|---|
| normal | 6 to 11 | 0 to 1 | 2 to 7 | 1 to 6 | **10 to 16** |
| real | 11 to 17 | 12 to 17 | 1 to 5 | 0 | 0 to 1 |
| strong | 4 to 5 | 0 | 0 | 0 to 1 | **25 to 26** |

## 3. Sleep is a bonus on pillar days (item 2)

- **XP:** the night's score still pays its XP every day (score ÷ 100 of 100 XP).
- **Bonus:** a night of 80+ on a day with **at least one effortful pillar** adds:
  - +1 partner heart,
  - +20% research,
  - +1 Bell (+2 at 90+).
- **On a day with no effortful pillar:** XP only. No heart, no research, no Bell, no tier.
- **Counting:** Sleep never counts as a pillar towards a tier, a boss task's minimum, or anything else.

## 4. The chore floor (item 4)

**A chores-only day still moves:**

| Moves | How much |
|---|---|
| The partner's XP bar | Chores' XP plus the night's: about 115 XP, an eighth of a Max day |
| Coins | 40 at half ticked, 60 at three-quarters |
| The wild Pokemon | The catch pace is unchanged: about 78 HP off a 700 HP Pokemon at 20 of 28 ticked |
| The gym leader | The chores' own XP: about 30. The night's XP doesn't hit on a chores-only day |
| The boss | The chores task, on a day with three-quarters ticked |
| The egg | Its steps, which are walking, not chores |

**It does not move:** hearts, research, gems, the pillar counters, the Sleep bonus, or a neglect bounty.

**One tension for you to decide (Q1):** the wild Pokemon is worn down by the **share of habits ticked**, and chores are 25 of 28. Today a day of chores alone wears it down about as fast as a day of pillars. You asked to keep the catch pace. The principle says chores get nothing big. The two can be squared by counting each effortful pillar as 4 habits in the share. That keeps the normal pace about where it is and slows catching on chores-only days. This is **not** in the model.

## 5. Neglect bounty (item 11; replaces Comeback)

- **Unlock:** at **40 Trainer hearts**. This is item 8's slot, which was Comeback's. That's about week 1 at normal pace and week 2 to 3 at real.
- **The rule:** a pillar idle for **2 days** pays **+25%**, and **3 or more days** pays **+50%** (the cap). It applies to **that pillar's own XP and its counter**, on the day it comes back. It never stacks past +50%, and doing the pillar clears it.
- **What it doesn't touch:**
  - It is **not a currency**.
  - It doesn't touch the day's tier, hearts, research, gems or the boss.
  - A returning pillar counts as one pillar towards the tier, like any other.
- **Interaction with the tiers:** the bounty multiplies the pillar's 100 XP **before** the tier multiplier. So the most it can add is +50 XP on a 1-pillar day, or +100 on a Max day. That is small next to the gap between tiers (215 → 840 XP). It **can't** lift a day a tier. It makes the comeback day visibly better, without making skipping pay.
- **Honour pillars:** Gym and Code pay a bounty only with the verification of section 6. That ships in the same V21 bundle, so they are included. If verification is held back, **Gym and Code are excluded**, and the bounty applies to Arbor (practice logs) and, when it returns, Guitar (Woodshed logs).
- **The core computes it.** Life OS shows it on the tile (section 13).

**Proof that steady beats skip-and-cash-in** (model, 182 days, the skipped pillar is Code):

| Pace | Plan | XP | Hearts | Research | Gems | Code counter | Bosses won |
|---|---|---|---|---|---|---|---|
| normal | **steady** | **100,020** | **1,738** | **53,911** | **1,906** | **126** | **22** |
| normal | skip a week every other week | 78,363 (−22%) | 1,342 | 40,529 | 1,337 | 66 (−48%) | 12 |
| normal | skip 2 days every week | 87,388 (−13%) | 1,497 | 46,018 | 1,696 | 95 (−25%) | 21 |
| real | **steady** | **36,078** | **468** | **12,404** | **640** | **61** | **7** |
| real | skip a week every other week | 31,466 (−13%) | 348 | 9,244 | 530 | 29 (−53%) | 6 |
| real | skip 2 days every week | 34,366 (−5%) | 425 | 11,138 | 540 | 51 (−18%) | 3 |
| strong | **steady** | **133,730** | **2,420** | **75,466** | **2,647** | **157** | **26** |
| strong | skip a week every other week | 100,637 (−25%) | 1,796 | 55,249 | 1,827 | 85 (−46%) | 13 |
| strong | skip 2 days every week | 112,209 (−16%) | 2,004 | 62,018 | 2,282 | 111 (−29%) | 26 |

**Steady wins on every measure, at every pace.** That follows from the cap: one returning day at +50% is 1.5 days' worth of that pillar's counter, against 3 to 7 days missed, plus every tier reward those days would have paid.

At real pace the bounty matters most: 76 bounty days and about a fifth of all counter income over six months. That is exactly the bursty player it is for.

## 6. Honour ticks become verified (item 9)

| Pillar | Done when (from V21) | A tick without it |
|---|---|---|
| **Gym** | A finished **Strong workout of 20+ minutes** is logged that day. The tick is optional: the workout alone counts | Pays as a basic habit (1 XP), never a pillar |
| **Code** | **Problems solved ≥ 1 is logged** that day (proposal below) | Same |
| **Arbor** | Every practice item on the day's Arbor plan is logged (already measured, as `frac`) | Same. Today the tick alone counts |
| Guitar (when back) | The Woodshed session's items are logged (already measured) | Same |

**Code proposal (Q2):**

- **Option A, honour count:** ticking LeetCode in Life OS asks "how many solved?" (a 1 to 5 stepper) and writes a `code_log` event `{ solved }`.
- **Option B, measured:** Life OS's `api/` reads LeetCode's public recent-accepted submissions for your username once a day and writes the same event.
- B is truly verified. A is an honest count, which is better than a bare tick.

**What changes in the fold:**

- `core/facts.ts` (`factsFor`), for days from V21: a pillar's `done` and `frac` come from the day's verified marks (`marks.workouts`, the new `marks.solved`, and the Arbor and Woodshed logs), not from the tick. A tick with no mark is a basic habit.
- `DayMarks` gains `solved`. `src/lib/ingest.ts` reads `code_log` into it. 3+ solved also adds +1 to the Code counter.
- **Prerequisite found while checking:** Life OS calls `buildFacts` **without `marks`** (`lifeos/src/lib/game.ts:28`). So today its fold never sees Strong workouts, and with this rule it would never count a Gym day.
  - Fix: move `marksOf` (`src/lib/marks.ts`) into the core.
  - Then both apps build marks the same way, and `npm run core` carries it.
- **Boss tasks:** the gym task counts workouts and the code task counts solves. Both are measured.

## 7. The Lab (item 1)

- **When it studies:** only on days with an effortful pillar. Sleep alone doesn't count, and neither do chores.
- **How much:** research by tier, from the table above: 60 / 140 / 220 / 300.
  - Each Pokemon on the desk adds +10 / 15 / 20 / 30% by rarity (common, uncommon, rare, legendary).
  - A Sleep bonus night adds +20%.
  - The party no longer studies at half; research comes from your day now, not from levels nobody gains.
- **Rank:** a flat **1,200 points**.
  - A 1-pillar day moves the dial **7%** (8% with a good night). A Max day moves it **35 to 42%**.
- **Rank rewards, in turn:**
  - odd ranks: **choose the next wild Pokemon from three**;
  - even ranks: 20 gems;
  - every 5th rank: a Mystery Egg.
- **The −3% wild HP per rank stays as it is**, so the catch pace is untouched.

| Pace | Ranks a month (model) |
|---|---|
| normal | 7 to 8 |
| real | 1 to 3 |
| strong | 10 to 11 |

## 8. The weekly boss (item 7)

**Card rules:**

1. **3 to 5 tasks.**
2. **Effortful tasks:**
   - one for each effortful pillar done on **3 or more of the last 21 days** (one task per pillar);
   - **always at least one**: if none qualifies, the pillar done most often;
   - together they stand for **70% of its HP**.
3. **At most one Sleep task** (nights of 80+ **on effortful days**) and **at most one chores task** (days with ¾ ticked), 15% of HP each.
4. **Targets:** the last 21 days' rate × 1.25, between 1 and 6 a week. Counted from measured inputs only (Strong, Arbor logs, solves, the band).
5. **Shelved pillars** never get a task (v18 rule kept).

**The fight:**

- The card is its HP.
- **Power** multiplies every task's damage:
  - Mega: +5% per bond level;
  - +5% for each party member whose type beats the boss's;
  - the Rocky Helmet: +15%.
- **A Max day's progress counts ×1.5.**
- Enough power forgives one missed task.

**Milestones kept** (amounts trimmed to fit the gem budget, section 9):

| HP taken | Pays |
|---|---|
| 25% | 100 coins and a Great Ball |
| 50% | 5 gems and an Oran Berry |
| 75% | 10 gems and an Ultra Ball |
| **Beaten** | 20 gems, the shard of its hardest task, and **it joins you** (a rare; a legendary every 8th week). No throws |

| Pace | Bosses beaten (model) |
|---|---|
| normal | **85%** (22 of 26 weeks) |
| real | **27%** (7 of 26). The 25% milestone came in most weeks |
| strong | 100% |

## 9. Currencies

| | Earned by | Buys |
|---|---|---|
| **Coins** | The tier's coins | The Mart: 3 balls, 2 berries, the Rest token |
| **Gems** | Max days (5), 3-pillar days (2), perfect days (+5), leaders (10 / 15 / 40), the boss, even Lab ranks, level milestones | **A Lab pick** (choose the next wild one, 60, at most one per wild Pokemon), **a Comet Shard** (200, any colour for a Mega), themes (60), Rare Candy for fully trained Pokemon only (25) |
| **Pillar counters** (Iron, Parts, Sprouts; Tones when Guitar is back) | +1 per verified pillar day (× bounty); Iron also +1 a day of 10,000 steps and +2 a record; Parts +1 at 3+ solved | At **20**: **its egg** (Pokemon of its types) **or its shard** (its colour). An egg only while fewer than 3 eggs wait, so eggs never pile up unhatched |
| **Bells** (Sleep) | Sleep bonus nights only | At 20: its egg or 5 hearts |

**Gems in the model:**

| Pace | Gems a month | What they went on | Left at month 6 |
|---|---|---|---|
| normal | **375** | 13 bought Lab picks and 3 Comets | 886 |
| real | **120** | 6 picks and a Comet | 160 |
| strong | 523 | — | — |

**Held items, at most 4.** One per system, each shown as a number on that system's bar:

| Item | Effect | Where it comes from |
|---|---|---|
| **Rocky Helmet** | Boss damage +15% | Your first boss beaten |
| **Expert Belt** | +25% on a leader whose type your partner's type beats | Your first Elite Four win |
| **Shell Bell** | The partner's tier hearts ×1.5 | The 30-heart feat |
| **Quick Claw** | The wild hit +25% on effortful days | Lab rank 3 |

Every other held item, TM and Plate goes in the cleanup (V22).

## 10. Pokemon inflow and the Box (item 6)

Model numbers. The model throws no balls, so add about 2 catches a month at each pace.

| Pace | Caught a month | Hatched a month | Bosses a month | **In per month** | **Box at month 6** |
|---|---|---|---|---|---|
| normal | 5.3 | 5.0 | 3.7 | **14** | **84** (about 95 with balls) |
| real | 1.8 | 4.0 | 1.2 | **7** | **43** (about 55) |
| strong | 9.3 | 4.8 | 4.3 | **18.5** | **111** |

- **Hatching is capped by steps**, which is walking: about 5 a month at 10,000 steps a day.
- **Eggs:** about 5.5 a month are laid at normal pace (Trail, counters, Lab). They no longer pile up: at most 3 wait at a time.
- **Gems no longer buy eggs**, which cuts inflow.

**What surplus Pokemon are for:**

1. **The weekly deck.** The boss's type changes every week, and each party member whose type beats it adds +5%. Rebuilding the party from the Box each Monday is the reason to own many types. That's your Clash Royale deck builder with a weekly opponent.
2. **The desk.** Rarity adds 10 to 30% research each, so rare and legendary Pokemon have a job.
3. **Future partners.** At normal pace one is fully trained about every 4 weeks.
4. **Duplicates become bond.** A second Pokemon of a line you own (a boss repeat, say) adds **20 hearts to the one you have** instead of a new copy. A shiny is kept as its own. This keeps the Box to distinct species and feeds Best Friend.
5. **The Pokedex:** feats at 10, 25, 50 and 100 owned.

Being plain about it: most of the Box will be a collection. That is acceptable only while inflow stays near these numbers. Nothing pays you to hoard, so there is no obvious "sell" move to make (your v14 rule).

## 11. Mega, Max day, bond

- **Mega:**
  - Key Stone (first 7-day run) + 3 shards of different colours (or Comets), forged on any Pokemon of yours that has a Mega.
  - Worth **+5% per bond level** of that Pokemon: up to +25% as partner and half that from the party. That applies to leader hits and boss damage.
  - Model: first Mega Stone on **day 25** at normal pace, **day 73** at real. Real is earlier with the monthly Comet, which the model leaves out. Your own route: Comet #3 on the 1 Dec review, so Mega Charizard in early December.
- **Max day (Dynamax):** the top tier of section 2. G-Max is its picture for the 32 species that have one. There is no separate number.
- **Mega for a day: cut.**
- **Bond:**

  | Trainer hearts | Perk |
  |---|---|
  | 10 | Pickup |
  | **40** | **Neglect bounty** (section 5) |
  | 100 | Endure (one empty day in 7 is free) |
  | 200 | Best friends (+10% XP) |
  | 350 | Sharing |

  - **Sharing:** hearts a Pokemon can't take (it is at 150) go to the party member with the fewest.
  - **150 hearts = Best Friend:** that Pokemon's signature works at full strength from the party.
  - **After a full party of Best Friends:** every 150 hearts is a Ribbon, a choice of a Mystery Egg, a shard, or a Lab pick.
  - **Trainer stars and Exp. Share: cut.**

| Pace | Hearts a day (model) |
|---|---|
| normal | **9.7** |
| real | **2.6** |
| strong | 13.4 |

- **Momentum: cut.** The tiers reward each day steeply and the bounty rewards returning, so a second XP multiplier from the last 7 days adds a number and no decision (Q4).
- **Party levels stop mattering outside the partner place.** The boss no longer reads levels and the Lab reads rarity, so the party needs no XP path.
- Rare Candy works on fully trained Pokemon only, and the Exp. Share is gone. That ends the instant graduations (B6).

## 12. The V21 bundle (item 5): one rule version, one start date

`V21_START` = the day it deploys. Days before it fold as they do now. `npm run core`, then Life OS must build.

**In V21:**

1. Reward tiers, the Sleep bonus and the chore floor (sections 2 to 4).
2. The neglect bounty (section 5).
3. Verified pillars: Gym, Code and Arbor (section 6). This includes moving `marksOf` into the core, the `code_log` event, and Life OS passing marks.
4. The Lab rule (section 7).
5. The boss rules (section 8).
6. Mega by bond and Max day (section 11). Mega for a day, momentum, Trainer stars and the Exp. Share are switched off.
7. Bond: Sharing, Best Friend, Ribbons and duplicates as hearts.
8. Tile state for Life OS (section 13).

**Not in V21** (V22, with its own UI pass):

- the currency merge (pillar counters replace the five marks shops; coins and gems re-priced);
- the cuts: held items down to 4, TMs, Plates, mastery, vitamins, natures, X items, crits, treasures, chests, quests, the season ladder, evolution items, fossils and the Frontier.

Until V22 those keep working as they do. Their small strike percentages stay in the formula and V21's tier multiplier applies on top.

**Your holdings at V22:** cut items become coins or gems at shop value, and BP becomes gems at 10 to 1. Nothing disappears without paying out.

## 13. Life OS tile display (tile spec)

**The core exposes:** `game.tiles: Partial<Record<'code' | 'fitness' | 'arbor' | 'guitar', { iconId: string; fill: number; bountyActive: boolean; ready: boolean }>>`. Life OS renders it and holds no game logic.

| Field | Meaning |
|---|---|
| `iconId` | What that pillar's counter is aiming at: **its shard** (`red-shard`, `blue-shard`, `green-shard`; yellow for Guitar) until you have forged a Mega Stone, then **its egg** (`egg-fitness`…). You can switch the aim in the Pokedex (a new `aim` use) |
| `fill` | The counter ÷ 20, from 0 to 1. Drawn as a ghost outline that fills |
| `ready` | The counter has reached 20 and a choice waits in Collect. The icon glows |
| `bountyActive` | The pillar is idle 2+ days, the bounty is unlocked (40 Trainer hearts), and the pillar is verified (section 6). A small ×2 or sparkle badge sits in a slot that is always reserved, so the layout never shifts |

- **Which tiles:** only effortful pillars on today's Life OS list. Shelved ones are absent, and chore tiles stay plain.
- **No numbers on tiles.**
- **Tap or long-press** deep-links to the Pokedex (`/?open=counter:<tag>`), where the numbers live: "Iron 13/20, bounty +50% today, egg or shard".
- **Build path:** it comes through the existing `npm run core` step (Life OS already calls `foldGame`).
- **Prerequisite:** Life OS has to pass `marks` (section 6), or its Gym fill would read zero.

## 14. Simulation results (item 10)

Model of the V21 design, 182 days, your list, with Guitar shelved.

| | normal | real | strong |
|---|---|---|---|
| **Gems a month** | 375 | 120 | 523 |
| **Eggs a month** (laid / hatched) | 5.5 / 5.0 | 4.5 / 4.0 | 5.5 / 4.8 |
| **Box at month 6** | 84 (≈95 with balls) | 43 (≈55) | 111 |
| **Hearts a day** | 9.7 | 2.6 | 13.4 |
| **Boss win rate** | 85% | 27% | 100% |
| Lab ranks in 6 months | 44 | 10 | 62 |
| First Mega Stone | day 25 | day 73 | day 23 |
| Leaders beaten | 44 | 15 | 57 |
| **Floor test** (weeks with a visible win) | 26 of 26 | **26 of 26** | 26 of 26 |
| A chores-only day moves | about 115 XP, 40 to 60 coins, the wild Pokemon (about 78 HP), about 30 leader HP, the boss's chores task, the egg's steps | same | same |

The **thinnest real-pace weeks** were "a pillar egg, a hatch, boss 25%" and "a Trail Egg, a Lv 15 milestone". Those visible wins come from walking and the 25% milestone. That passes, but walking is doing much of the floor's work.

**How the model works, and its limits:**

- It is arithmetic of the rules above, on the same day generator as `tools/sim-life.mjs`. Unchanged parts (wild HP, the hit and the ball, leader HP, egg sizes) use the core's own functions.
- It is **not** the core: it becomes real numbers only once V21 is built. Then `tools/sim-life.mjs` runs it for real.
- It throws no balls (catches are low by about 2 a month).
- It assumes one or two type-edge party members and a Mega at bond 3.
- It leaves out the monthly Comet.
- The model script is in my scratch space, not the repo. I can add it as `tools/sim-design.mjs` if you want it kept.

---

## 15. Decisions before I build V21

1. **Catching and chores (section 4):** keep the share as it is (catch pace exactly as now), or count each effortful pillar as 4 habits in the share (normal pace about the same, chores-only days catch slower)?
2. **Code verification:** Option A (a "how many solved" stepper on the LeetCode tick) or Option B (a LeetCode sync by username)? B needs your LeetCode username.
3. **Gym:** is 20 minutes the right minimum for a Strong workout?
4. **Momentum cut:** OK, now that tiers and the bounty do its job?
5. **Arbor:** should a tick alone stop counting, so it needs the practice logged like Gym and Code?
