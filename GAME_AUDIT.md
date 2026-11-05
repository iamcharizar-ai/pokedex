# Game audit, 5 Nov 2026: design and logic (no UI)

Phase 1 of the brief. **No code was changed.** The redesign proposal is in `GAME_REDESIGN.md`.

How this was checked:

- **Code:** every claim below was traced in `core/` (the game) and `src/lib/` (what writes to the ledger). File and line numbers are given for each one.
- **Your real data:** a read-only export of the live ledger (4,295 events, 3 Oct to 5 Nov) was replayed through the real core with `tools/export-ledger.mjs` and `tools/replay.mjs`.
- **Six-month simulations:** a script played your **current Life OS list** forward through the real `foldGame`. The list is 29 habits: Sleep, Arbor, LeetCode and Gym as pillars, 6 standard habits and 19 basic ones, with Guitar shelved. The simulated player claims everything, throws every ball, feeds every berry, buys eggs and mastery with marks, and buys Mystery Eggs and Rare Candy with gems. There are three paces:
  - **normal**: your brief's assumption. All 4 pillars on about 85% of Mondays to Saturdays, Sunday off, 80% of chores, about 10,000 steps a day and sleep around 85.
  - **real**: the pace your ledger actually shows. About 1.3 pillars on 60% of days, chores about half done, sleep around 78.
  - **strong**: every pillar Monday to Saturday.
- The simulation script is not in the repo. I can add it as `tools/sim-life.mjs` if you want it.

---

## 1. The core loop as it actually works today

You tick habits in Life OS. The game then refolds every day from the ledger:

- The **total XP** of what you ticked fills the partner's level bar.
- The **share of habits ticked** (every habit counts the same, so brushing your teeth counts as much as LeetCode) wears down the wild Pokemon.
- The **pillars** hit the gym leader.
- Opening the app is mostly **collecting**: claim piles, feed berries, put Pokemon in places. Those actions change percentages too small to feel (section 3).

In practice the loop is "do habits, watch two HP bars and one XP bar move". About 40 other systems hang off those three bars, and almost none of them changes what you do tomorrow.

**What your real data says (3 Oct to 5 Nov):**

| | |
|---|---|
| Days with a pillar | 20 of 34 |
| Perfect days | 2 |
| Momentum at ×1.5 | never |
| Non-sleep pillars since 28 Oct | **none**. The only pillar ticked was Sleep, and since v15 that does not count on its own. That is the Lab bug (section 3). |
| Partner | Charmeleon Lv 29 |
| Box | 6 Pokemon, **all Lv 1** |
| League | Erika, 455/2000 HP |
| Wild Pokemon | Venonat, 430/700 HP, out since 28 Oct |
| Research | 23/500 since 27 Oct |
| Wallet | 250 coins, 106 gems, 1 BP, 2 Comet Shards |

---

## 2. Mechanic by mechanic

Works = does what the code says without breaking. Reachable = at your real pace, with the normal pace in brackets. Meaningful = does it change a decision or a result you can feel.

| # | Mechanic | Earns it → spends it | Works? | Reachable? | Meaningful? | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Partner XP, levels, evolution** | All XP: pillar 100, core 30, standard 3, basic 1 (`rules.ts:20`) → evolves at Lv 16 and 36, fully trained at 50 (`rules.ts:73-76`) | Yes | First partner fully trained on day 66 (normal: day 42) | **Yes.** The only thing that moves every day | **Keep** |
| 2 | **Fully trained, next partner** | Lv 50 → the oldest in the Box leads (`fold.ts:717`) | Yes | — | Yes for the first partner. Later ones are skipped (bug B6) | **Fix** |
| 3 | **Branch by habits, and nature** | The share of each kind of work → which branch it takes; best and worst domain → a nature worth +3% on strikes (`fold.ts:684-714`) | Yes | — | Branching is a real identity choice. The nature's +3% is not | Keep the branch, **cut** natures |
| 4 | **Momentum** | Days of the last 7 with 2 pillars → ×1.2 / ×1.35 / ×1.5 XP (`rules.ts:64`) | Yes | **×1.5 can never happen with a weekly rest day** (B7) | Weak | **Fix** |
| 5 | **Wild Pokemon and catching** | 100 × share ticked^1.5 × ball multiplier; HP 700/1,100/1,600/3,000; a perfect day catches on the spot (`rules.ts:91-105`, `fold.ts:1401`) | Yes | A common takes 10.6 days (normal: about 4) | Yes | **Keep.** Pace unchanged, as you asked |
| 6 | **14 kinds of ball** | Coins, marks, rewards → 15 to 110 HP off the wild Pokemon (`economy.ts:77`) | Yes | — | Barely. A Great Ball is 50 of 700 HP. Fourteen kinds, one question | **Merge** into 3 |
| 7 | **Gym leaders, 10 leagues, 122 leaders** | Pillars × weakness ×1.5 × type edge ×1.2 × (1 + about 15 added %) (`fold.ts:1436-1443`) → 20 to 50 gems, a badge, a Plate; the next region once 2 are fully trained | Yes | Kanto beaten by day 79 (normal: 54) | **Medium.** Weakness is the one daily "which pillar today" pull. A win pays gems and a new species pool | **Keep**, simplify the power stack |
| 8 | **TMs** | Marks or coins → the partner counts as another type against leaders (+20%) (`fold.ts:613`) | Yes | — | Small | **Cut** |
| 9 | **Type Plates** (16) | Elite Four and Champions drop one → +35% against leaders of one type (`economy.ts:530`) | Yes | — | Situational. A 16-item collection for one rule | **Cut** (or fold into held items) |
| 10 | **Rematch ranks, Hall of Fame** | After all 122 leaders (`fold.ts:1412`) | Yes | Years at your pace (normal: about 16 months) | Nothing for now | **Park.** Keep the code, take it off the plan |
| 11 | **Weekly boss** | A card of 4 to 5 real tasks → 25/50/75% milestones, then a kill (50 gems, a shard, a Mystery Egg) | As coded | **Can't be killed or caught with your party** (B5). Real pace: 0 kills in 6 months, best 69%. Normal: first kill about day 100 | High in idea, zero in fact | **Fix** |
| 12 | **Professor's Lab** | Desk and party study on non-sleep pillar days → rank: −3% wild HP and a gift (`rules.ts:242-253`, `fold.ts:1360-1375`) | **Partly** (B1 to B4) | Rank 1 needs 10 non-sleep pillar days at your +50; the first Mystery Egg (rank 5) comes about day 150 | −3% of 700 HP is 21 HP a rank. Invisible | **Fix** (bugs and purpose) |
| 13 | **Party (5 behind the partner)** | +2% each, +0.2% per level (`rules.ts:126`, `fold.ts:1175`) | Yes | — | Every member is Lv 1 forever (B5), so about +11% in all | **Fix** |
| 14 | **Signatures (6 families)** | Each Pokemon's first type → a small effect, its own bond level as partner, half that in the party (`bond.ts:20-28`) | Yes | — | Numbers of 4 to 8%. **Charm is dead while Guitar is shelved** (B9), and that is your Porygon and Meowth | **Merge** into fewer, bigger roles |
| 15 | **Hearts (per Pokemon)** | +1 per pillar day as partner, +1 per further pillar, berries, party days of its work (`fold.ts:1259-1263`); capped at 150 (`rules.ts:236`) | Yes | — | The partner's bond adds +5% per level to strikes, and powers the signature | **Keep**, simplify |
| 16 | **Trainer perks (5)** | All hearts → Pickup / Endure / Focus / Best friends / Exp. Share at 10/40/100/200/350 (`bond.ts:16`) | Yes | 350 hearts by about day 100 (normal: about 60) | Pickup and Endure are felt. Focus (crits) and +10% XP are not. Exp. Share breaks pacing (B6) | **Keep 2 to 3** |
| 17 | **Trainer stars** | Every 150 hearts past 350 → +3 to 5% on one perk (`bond.ts:93-121`) | Yes | One star every about 3 weeks (normal) | **No.** This is your "hearts stop mattering after 350" | **Replace** (redesign §5) |
| 18 | **10 berries** | Coins, marks, gems, Pickup, Forage → hearts, double on the Pokemon's own work day (`economy.ts:220, 413-416`) | Yes | — | The "which day, which Pokemon" choice is real. Ten kinds for it is not | **Merge** into 2 |
| 19 | **Mega Evolution** | Key Stone (feat `work7`) + 3 shards of different colours (or Comets) → +10% +5% per bond level on the partner's strikes; ×1.15 in the boss fight (`fold.ts:944-963, 1178`) | Yes | Your path: 3rd Comet on the 1 Dec review + Charmeleon → Charizard at Lv 36 (about 21 Nov) = **Mega Charizard about 1 Dec**. Normal: the shards are there by about day 90 | **+25% on the partner's strikes**, then nearly worthless once it graduates. Only 68 of 1,167 species can Mega | **Fix** (give it a job) |
| 20 | **Mega for a day** | 7 of 7 momentum + every pillar → +10% for the day (`fold.ts:1430`) | Yes | **Impossible with a rest day** (B7). Never happened | — | **Cut** |
| 21 | **Dynamax** | A perfect day → strike ×2, automatically (`fold.ts:1449-1454`) | Yes | 2 in 34 days | The biggest multiplier in the game. No choice, no item, no use beyond the leader | **Merge** with the perfect day; give it a target (the boss) |
| 22 | **Gigantamax** | The same, ×2.5 if the partner has a G-Max form (32 species) | Yes | Same | A picture and +0.5× | **Merge** into Dynamax |
| 23 | **Shards (4 colours + Comet)** | Kit sets, feats, boss kill, milestones, reviews → Mega only (`economy.ts:41-44, 622`) | Yes | Yellow comes only from Guitar feats, which are shelved | One use. Five items | **Merge** |
| 24 | **Held items** (11 domain + 11 Frontier + 16 Plates) | Marks (12), feats, BP → the partner holds one (`economy.ts:108, 504`) | Yes | — | A Muscle Band is +15% on the gym habit's share, about 3 to 5% of a day's strike. A few Frontier items have real effects (Focus Sash, Quick Claw, Shell Bell) | **Cut most**, keep about 4 |
| 25 | **Strong gear kit** (7 pieces) | Each Strong routine drops its piece → a full set pays 10 gems and 3 Iron, every 3rd set a Red Shard (`fold.ts:1291-1307`) | Yes | You have 3 of 7 after 4 workouts | They **look like held items and can't be held** (B8) | **Fix** (rename, or fold into Iron) |
| 26 | **Mastery** (×5) | Marks → +3% per level on that domain's strikes, 220 marks for all 10 (`economy.ts:298-300`) | Yes | Iron: 4 months (normal). Machine Parts: 11 months | The only long marks sink. Each level is unfeelable | **Merge** |
| 27 | **Vitamins** (5) | 10 marks → +3% on one domain, ten at most (`economy.ts:427`) | Yes | — | Mastery again, per Pokemon | **Cut** (same as #26) |
| 28 | **X items, Dire Hit** | Coins, BP → a one-day boost (`economy.ts:435-444`) | Yes | — | Tap before ticking, +60% on one domain for one day. A chore, not a choice | **Cut** |
| 29 | **Guard Spec, Revive, Max Repel** | Coins → forgive a slip, undo a slip, +7 days before a wild one flees | Yes | — | Real insurance, but three items do one job | **Merge** into one ("a rest token") |
| 30 | **Incense (7), Honey, Legend keys (26)** | Marks, gems, BP, symbols → pick the next wild Pokemon | Yes | — | "Pick the next wild one" is a good choice. 34 items for it is not | **Merge** into one lure plus a legend summon |
| 31 | **Eggs (7 kinds), Nursery, Trail Egg** | Steps warm one egg at a time; 100,000 steps finds a Trail Egg (`economy.ts:742`, `fold.ts:1642-1666`) | Yes | Normal: about 1 hatch every 5 days | **Yes.** The only thing steps do, and it feels like walking | **Keep**, fewer kinds |
| 32 | **Fossils** (9) | Pickup, BP, feats → 150 coins → a Pokemon (`economy.ts:483`) | Yes | — | A third way to get a Pokemon | **Merge** into eggs |
| 33 | **Evolution items** (26) | Pickup, shops, BP → evolve a Pokemon that isn't the partner | Yes | — | Box Pokemon do nothing, so evolving them does nothing | **Cut** |
| 34 | **Rare Candy** | 25 gems, 15 BP, research, milestones → +1 level to a Box Pokemon | Yes | — | It **turns gems into skipped partner arcs** (B6) | **Fix** |
| 35 | **Pickup finds** | Trainer perk → an item on about 30 to 70% of pillar days (`economy.ts:562`) | Yes | — | A nice daily drip. Half the table is treasures to sell | **Keep**, smaller table |
| 36 | **Treasures (22), Collector, wanted list** | Pickup → coins, doubled on the list day (`economy.ts:494, 670`) | Yes | — | A coin converter with a timing trick | **Cut** (pay coins direct) |
| 37 | **Coins** | Daily pay 40/90/140, a streak +20, quests, sales → balls, guards, fossils | Yes | Normal: 2,500 to 10,000 a month | Piles up: 4,400 by day 90 (normal), 12,800 at strong | **Keep**, re-price |
| 38 | **Gems** | About 20 sources → Mystery Egg 150, candy 25, themes, Lucky Egg 500 | Yes | Real: about 300 a month. Normal: 600 to 900 | Without candy as a sink, 4,500 sit unspent by month 6 (normal) | **Keep** as the one premium currency |
| 39 | **Marks** (×5: Machine Parts, Iron, Tones, Sprouts, Bells) | One a unit-day, plus extras → five shops | Yes | — | **The same shop five times** (section 4) | **Merge** |
| 40 | **Battle Frontier** (7 facilities), **BP** | Streaks of one kind of day → BP, symbols, Legend keys (`frontier.ts`) | Yes | Real: 2 symbols in 6 months. Normal: every reachable symbol by month 3, then done | Seven streak counters on top of momentum, feats and the pay streak. 2,400 BP unspent at month 6 (normal) | **Cut** to one streak system |
| 41 | **Feats** (65) | Counters → gems and key items (Key Stone, Master Ball, Choice items) | Yes | — | A drip. Some are gates (Key Stone) | **Keep, trim** |
| 42 | **Weekly quests** (2) | 5 days with 2 pillars; a catch → coins and gems | Yes | — | Duplicates momentum and catching | **Merge** |
| 43 | **Season ladder** | Every 1,500 XP of the month → a small reward | Yes | About 6 a month | The level milestones again | **Cut** |
| 44 | **Level milestones** | Every 5 partner levels → a choice of 2 (`economy.ts:714`) | Yes | — | A real small choice | **Keep** |
| 45 | **Chest** | 30 gems → a random 250 coins or balls | Yes | — | Gambling for the cheapest currency | **Cut** |
| 46 | **Themes** (3) | 60 gems → the scene's background | Yes | — | Cosmetic | Keep (harmless) |
| 47 | **Stakes, slips** | An empty day: leader +100 HP, wild +60, −10% of the level's XP (`rules.ts:191`, `fold.ts:1223`). Cancelled by Endure, the Focus Sash or a Guard Spec | Yes | — | Mild (a pillar day does about 300). Three ways to cancel one small cost | **Simplify** |
| 48 | **Dozing** | 2 days without a pillar → a picture only | Yes | — | Feedback, no cost | Keep |
| 49 | **Trainer stats** | 28-day averages (`fold.ts:1856`) | Yes | — | A readout | Keep |
| 50 | **Shelving** (v18) | No habit for a kind of work → its shop, feats, facility and task are hidden | Yes | — | Needed. Leaves dead signatures behind (B9) | Keep, finish |
| 51 | **Month-end review → Comet Shard** | The tick → a Comet and 10 gems | Yes | 1 a month | Your clearest Mega path | Keep |

**Count:** 234 item ids (`economy.ts`), 65 feats, 30 player actions in `spend()` (`fold.ts:830-1148`), 10 or so currencies and pseudo-currencies, and 51 date-gated lines for rules v13 to v19 inside the fold, all written within five weeks.

---

## 3. Bugs, with root cause

### B1. The Lab hasn't moved since 27 Oct. Root cause: no non-sleep pillar was ticked
- **Where:** research runs only `if (v14On(f.day) && pillars > 0)` (`core/fold.ts:1362`). Since v15, `pillars` is **0 on a day whose only pillar is Sleep** (`core/fold.ts:1241`).
- **Your ledger, 28 Oct to 5 Nov:** Sleep was the only pillar done. No `leetcode-coding`, `gym` or `arbor-morning` tick on any of those 9 days (replay: `pillars 0/4` every day). On 3 and 4 Nov you ticked 19 to 21 of 28 habits, but all of them were chores and Sleep.
- **Result:** research has stood at **23/500** since 27 Oct. Nothing is broken with timers or storage. The fold does exactly what the rule says. But the rule is invisible: the Lab says "+50/day" (`src/screens/Lab.tsx:25`), and nothing tells you that today doesn't count.
- **Fix direction:** make the Lab study on any day you show up (redesign §6), or at the very least say "today doesn't count yet: do one of Code, Gym or Arbor".

### B2. The party's auto-fill pulls a Pokemon off the desk
- **Where:** `planFill` (`src/lib/party.ts:100`) fills an open party place from `labOf(g)` (`:35`), which **includes the desk**. `PartyAutoFill` runs it after an hour (`src/Team.tsx:91`). The fold then drops any party member from the desk without a word (`deskNow`, `core/fold.ts:596-602`).
- **Tested:** a party with one open place and the desk holding the oldest lab Pokemon. `planFill` returned `team a,b,c,d,x`, which moves the desk Pokemon into the party.
- **Result:** "I put a Pokemon in the Lab" and an hour later it isn't there. On 4 Nov your ledger has 30 `team` writes and 6 `study` writes in one session, several of them with an open place (`-`). The desk ended on Omanyte, chosen by "auto".

### B3. A Pokemon put on the desk today does not study today
- Research is added at `core/fold.ts:1360-1375`. The day's actions (including `study`) are applied after that, at `:1636-1640`.
- So the new desk counts from the **next** day that has a non-sleep pillar. Combined with B1, it can be many days before anything moves.

### B4. The Lab's numbers are too small to see, even when it works
- A Lv 1 Pokemon studies (10 + level) × rarity: 11 to 33 points (`rules.ts:247`). Rank *n* costs 500 × (*n* + 1) (`rules.ts:249`).
- Your +50 a pillar day moves the dial **10%**. Rank 5 (the first Mystery Egg) is 7,500 points, about 150 pillar days. Each rank is −3% wild HP (`rules.ts:253`), which is 21 HP off a 700 HP Pokemon.
- Box Pokemon never gain levels (B5), so the points never grow.

### B5. The weekly boss can't be beaten or caught with the party you have
- **Damage:** a whole week of progress deals at most `strike × (1 + common)` of its HP (`core/fold.ts:1534-1542`; card work is 0 to 1). `strike = (party power ÷ (6 × boss level))^1.2` (`core/boss.ts:189-193`), and boss level = 13 + 0.18 × the party's levels (`boss.ts:26`).
- **Your party:** Charmeleon Lv 29 plus five Lv 1s: strike **0.26**, common 0.30. **The most this week's Steelix can lose is 34%**, even with every task done.
- **Catching:** a throw needs 40% HP or less left (`boss.ts:57`), so it is impossible too.
- **Why the party is Lv 1:** nothing gives Box Pokemon XP except the Exp. Share perk (350 Trainer hearts), Rare Candy, or leading.
- **In the simulations:**

  | Pace | Boss kills in 6 months | Best |
  |---|---|---|
  | real | 0 | 69% |
  | normal | first kill about day 100, once the party is Lv 50+ | — |

  The strike barely grows with the party, because the boss's level grows with it. With the partner at Lv 29:

  | Party level | Strike |
  |---|---|
  | Lv 1 | 0.23 |
  | Lv 10 | 0.42 |
  | Lv 20 | 0.54 |
  | Lv 30 | 0.61 |
  | Lv 50 | 0.69 |

  It never reaches 1, so a kill needs a Lv 50+ party **plus** about 40% of added bonuses. The v15 change to let the boss come with a party of 3 (`BOSS_MIN_PARTY`) brought it to the screen without making it beatable.

### B6. Exp. Share and Rare Candy skip the partner's whole journey
- **Exp. Share:** at Trainer level 5, every party member gets 10% of the partner's XP each day (`core/fold.ts:1354`).
- **Rare Candy:** costs 25 gems (`economy.ts:597`) and gives one level whatever the level (`fold.ts:1101`). At Lv 40 that is about 490 XP, more than a whole day of the partner's.
- **Normal simulation:** by month 4 the party is Lv 50 to 60. The next partners take over already past their evolution levels:
  - Dratini, 10 Mar: partner, then Dragonair, then Dragonite, then fully trained, **all on the same day**.
  - Poliwag, 2 Mar: partner, then Poliwhirl, then Politoed, the same day.
  - Without buying any candy it still happens, more slowly (Poliwag and Dratini evolved the day they took over). The gems then pile up instead: 4,500 unspent by month 6.
- The partner arc is the core loop, and gems can be spent to skip it.

### B7. Top momentum and "Mega for a day" are impossible with a weekly rest day
- A day "counts" with 2 pillars (`rules.ts:61`), and Sleep alone is 0 pillars (`fold.ts:1241`), so a Sunday off with a good night doesn't count.
- ×1.5 needs 7 of the last 7 days (`rules.ts:64`). A Mega for the day needs 7 of 7 **and** every pillar today (`fold.ts:1430`), which is 8 days running.
- **Your brief's own schedule (Monday to Saturday) can never reach ×1.5 or a Mega day.** The normal simulation topped out at ×1.35, and your real data never got past ×1.2.

### B8. The Strong gear pieces look like held items and can't be held
- Protector, Silver Wing, Power Anklet and the rest are in `GEAR` (`economy.ts:186`) but not in `HELD`. The `hold` action refuses them (`fold.ts:933`).
- They are a 7-piece set counter. Their names are real held items from the games, so "never equipped" in the 27 Oct audit was this, not you.

### B9. Shelved Guitar leaves dead signatures and natures
- Normal, Fairy and Flying Pokemon have the Charm signature, which only works on a Guitar day (`bond.ts` SIG_FAMILY, `fold.ts:1400`). That is your Porygon and Meowth.
- With Guitar shelved, they never fire. `game.sigs` shows guitar 0.5 that does nothing.
- Natures that raise or lower Sp. Def (guitar) are the same.
- Yellow Shards now come only from milestones or Comets.

### B10. Two eggs waiting stops the Nursery
- With two kinds of egg waiting, none goes in until you choose (`fold.ts:1651-1654`, v19). Meanwhile every step walked warms nothing.
- In the simulation this happened within two weeks, as soon as a Trail Egg landed next to a bought one.

### B11. Sleep still pays on score, not bedtime
- The `sleep-before-10` pillar is done at a score of 80 (`core/facts.ts:211`). Bedtime is never read.
- Your band shows bedtimes of 01:14 and 02:08 on nights that counted as done.
- v15 stopped Sleep from carrying a day on its own, but the habit is still named for a bedtime the game never checks.

### B12. Bond at 350 hearts: not a bug, and not much there
- 350 is the last Trainer level (`bond.ts:16`), which unlocks Exp. Share.
- After it, every 150 hearts is a Trainer star: pick one of two perks to rank up by +3 to 5% (`bond.ts:93-121`), up to rank V on all five (25 stars, 4,100 hearts). After that a star is 25 gems.
- Each Pokemon stops at 150 hearts (`rules.ts:236`), when berries are refused. The partner's daily hearts keep counting past 150, but only towards the Trainer total.
- So past 350, a heart is worth 1/150 of a 3% perk rank. You read it right: it stops mattering.

### Things checked and found sound
- **Duplicate taps:** claims, revives and purchases are deduplicated by the fold (`fold.ts:977-983`; `sold` per day).
- **Wallets:** spending is checked against them, so there is no free money.
- **Steps:** they feed the egg, the Trail Egg, an Iron mark at 10,000, the walk feats and the Speed stat. All of that is intended, and none of it double-pays one currency.
- **Determinism:** every random draw is seeded by the day, so two devices agree.
- **No in-app grinding loop exists.** Every currency starts from a tick, a band reading or a Strong or Arbor log. The soft spot is that LeetCode and Gym are honour ticks: the gym pillar doesn't need a Strong workout.
- **Unticking a past day** refolds and can make a later purchase vanish. The PRICED_BY_HEARTS incident was this. It is consistent, but surprising.

---

## 4. The economy

### Flows (sources → currency → sinks)

```
TICKS ─┬─ every habit's XP ──────────────► XP ──► partner level ─► evolve / fully trained ─► next partner
       │                                    └──► season ladder (1,500 XP steps)
       ├─ share of habits ticked ─────────► wild HP ─► catch ─► Box
       ├─ pillars × weakness × ~15 % bonuses ► leader HP ─► gems, badge, Plate, region
       ├─ share ≥ 50 / 75 / 100 % ────────► COINS (40 / 90 / 140 a day, +20 streak)
       ├─ one unit-day per kind of work ──► MARKS ×5 (Parts, Iron, Tones, Sprouts, Bells)
       ├─ pillar days as partner ─────────► HEARTS ─► bond (+5 % a level) ─► Trainer perks ─► stars
       ├─ non-sleep pillar days ──────────► RESEARCH POINTS ─► rank ─► −3 % wild HP, gift
       └─ streaks of one kind of day ─────► BATTLE POINTS ─► symbols, BP Exchange
BAND ──┬─ sleep score ────────────────────► XP (score/100 of a pillar), Bells, Pike
       └─ steps ──────────────────────────► egg warmth, Trail Eggs, Iron (10k), walk feats
STRONG ── workouts, records, routines ────► Iron, gear kit ─► gems, Iron, Red Shard
REVIEW ── month-end tick ─────────────────► Comet Shard + 10 gems

COINS ──► balls, Revive, Max Repel, X items, Guard Spec, Honey, TMs, fossil revival, berries
GEMS  ──► Mystery Egg 150, Rare Candy 25, Full Incense 40, chest 30, themes 60, Lucky Egg 500
MARKS ──► mastery (4×(L+1), 220 for all 10), vitamin 10, work egg 10, friend berry 5, stone 15,
          held item 12 (once), TMs 6 to 9 (once), balls 6 to 8, incense 3
BP    ──► Frontier held items 24 to 140, Legend key 250, Master Ball 600, candy 15, evolution items 30
SHARDS ─► Mega Stone (3 of 3 colours, a Comet for any colour)
```

### Do the five marks buy different things? No. It's the same shop five times.

Every domain shop (`economy.ts:245-266`, plus `DOMAIN_V13` `:602` and `DOMAIN_V19` `:756`) sells the same shelf:

1. one or two balls,
2. an incense for its types,
3. a +15% held item for its own work,
4. TMs of its types,
5. a vitamin for its own work,
6. a 5-heart friendship berry,
7. one evolution stone,
8. an egg of its types,
9. mastery for its own work.

Only the domain on the label changes. Five currencies to track for one decision: "spend Iron on gym things". The only real differences are which Pokemon types the egg and incense pull, and which strike number goes up. The Garden has no ball. Tones are dead while Guitar is shelved.

### A realistic week and month (normal pace: 4 pillars most of Monday to Saturday)

Earned, from the simulation (each month is 30 days):

| | Week 1 | Month 1 | Month 3 | Month 6 |
|---|---|---|---|---|
| XP | about 2,000 | 10,700 | 15,000 | 15,000 |
| Coins | about 600 | 2,565 | 10,016 | 6,940 |
| Gems | about 105 | 610 | 921 | 723 |
| Battle Points | 54 | 324 | 527 | 257 |
| Machine Parts (code) | 4 | 18 | 22 | 21 |
| Iron (gym) | 7 | 48 | 56 | 61 |
| Sprouts (Arbor) | 4 | 25 | 38 | 33 |
| Bells (sleep) | 10 | 43 | 60 | 57 |
| Tones (guitar) | 0 | 0 | 0 | 0 |

At **your real pace** a month is about 6,000 to 7,700 XP, 1,200 to 2,500 coins, 220 to 390 gems, 50 to 90 BP, and 7 to 13 / 16 to 33 / 7 to 14 / 25 to 32 marks (code / gym / Arbor / sleep).

**Do you run out of things to spend on? Yes, at normal effort:**

- **Coins inflate.** 4,400 unspent by day 90 and 12,800 at strong pace, with balls bought every day. A Great Ball (150) is a few hours of chores. Nothing costs more than 380 except the 500-gem Lucky Egg.
- **Gems inflate unless they buy candy.** Spending them on candy breaks pacing (B6). Without candy, 4,500 sit unspent by month 6. A Mystery Egg (150) is a week of normal play.
- **BP is dead early and flooded late.** You hold 1 BP today. At normal pace there are 2,400 BP unspent by month 6, from the 7-day streak bonuses (`frontier.ts:48`). That is enough for 9 Legend keys.
- **Marks are the only currency with a long sink** (mastery, 220 marks each). Iron finishes its mastery in about 4 months, then piles up (57 unspent at month 6 normal, 157 at strong). Bells reach 90. Machine Parts take about 11 months and stay scarce.
- **At your real pace nothing is starved either.** 106 gems and 250 coins are enough for what the shops offer.

**Too cheap:**

- Rare Candy (25 gems): it buys skipped partner arcs.
- Coins in general.
- The 7-day streak BP bonus.

**Too expensive or too far:**

- Research ranks (linear cost on flat income).
- Mastery for code (11 months).
- The boss (impossible).
- Gold symbols at real pace.
- A third shard colour with Guitar shelved.

**Dead or nearly dead:**

- Tones.
- Treasures: they are coins with an extra step.
- Season-ladder items.
- Chest.
- Evolution items: they evolve Pokemon that do nothing.
- Vitamins: mastery again.
- Every X item.

---

## 5. Progression timeline

Simulated from a fresh start under today's rules. Real pace first, normal pace in brackets.

| When | What you have | What you're working toward | What's new |
|---|---|---|---|
| **Day 1** | Charmander, Brock, a wild Pokemon | Lv 16, Brock | First pay and first claims |
| **Week 1** | Lv 13 (normal: Lv 18, already Charmeleon) | Misty, the first catch | Key Stone (normal), first feats, first Silver Symbol |
| **Month 1** | Charmeleon Lv 32, 4 badges, Box 5 (normal: Charizard Lv 42, 7 badges, Box 10) | Charizard, Lv 50, the league | Party of 3 brings the boss. **Unbeatable** (best 22%, normal 40%). Lab rank 0 (normal: 1) |
| **Month 3** | First partner fully trained (day 66), Kanto beaten (day 79), Lab rank 3 (normal: 2 fully trained, Johto open, Lab rank 5) | Region 2 needs 2 fully trained | Trainer L4 to L5: Exp. Share. Boss best 31% (normal: 94%, still no kill) |
| **Month 6** | 2 fully trained, 25 leaders, Johto open (day 140), Lab rank 6, Box 59, boss still never beaten (normal: 7 fully trained, 47 leaders, 4 regions, Box 83, 2 boss kills) | Region 3 | Trainer stars, which you barely notice. Partners take over already evolved (normal) |

### Dead zones and walls

- **Wall: days 1 to 60 at your real pace.** The only bars that move are the partner XP bar and two HP bars. The boss, the Lab and the party are all stuck at near zero, because they all need Pokemon with levels, and nothing gives Box Pokemon levels.
- **Dead zone: Lv 36 to 50 of every partner.** About 2 to 4 weeks with no evolution. Milestones every 5 levels are the only events.
- **Wall: the boss, every week until the party is Lv 50+.** A weekly "you lost" (it leaves without a cost, but it never falls).
- **Wall: the Lab after rank 2.** Rank cost grows by 500 each rank, while points grow only with levels nobody gains.
- **Dead zone after month 3 (normal) or month 6 (real):** every reachable Frontier symbol is won and mastery is maxed for Iron and Bells. Coins, gems and BP have nothing left to buy.
- **Collapse after month 4 (normal):** Exp. Share plus candy means new partners evolve and graduate in days. The one loop that worked stops being a journey.
- **Box bloat:** 59 (real) to 83 (normal) Pokemon by month 6. Eight of them do anything (5 party, 3 desk). The rest are a Pokedex count.

### Low days and skipped days

- **A low day** (chores and Sleep only) still pays XP, a wild hit (share-based) and coins at 50%+. It pays **no** hearts, research or Frontier win. Since Sleep alone isn't a pillar, a great night on a rest day earns no heart either. That is fine for XP, but it makes the Lab and the hearts feel broken on exactly the days you rest.
- **A skipped day** (nothing ticked) costs leader +100 HP, wild +60 and 10% of the level's XP (`rules.ts:191`). Endure forgives one in 7. That is light, which is good.
- **The real cost of skipping is the streak systems:** Frontier runs reset after a 2 to 3 day gap, momentum, run feats and the pay streak all reset. You play in bursts with gaps. The game has about 10 streak counters and **no comeback reward**.

---

## 6. Top 10 problems, ranked by how much they hurt

1. **The party never levels, so the boss, the Lab and the party bonus are dead for months.** One missing XP path (Box Pokemon get none) starves three systems at once (B4, B5). This is the biggest single fault.
2. **The weekly boss is mathematically unbeatable with a normal party** (B5). A weekly system that ends in "you lost" every week for 3+ months teaches you to ignore it.
3. **The Lab only works on non-sleep pillar days, and the screen doesn't say so.** That is your bug (B1). On top of it: the desk silently loses Pokemon (B2), today's placement doesn't count (B3), and the numbers are invisible (B4).
4. **About 40 mechanics feed one strike number** as a stack of 1 to 15% bonuses (`fold.ts:1436-1443`). Held items, mastery, vitamins, natures, TMs, plates, signatures, X items, bond, level, party and Mega: none can be felt. Choices that move invisible numbers aren't choices.
5. **Currency sprawl.** Coins, gems, BP, five marks, five shards, hearts, Trainer hearts and research points. **Five marks buy the same shop five times.** Coins, gems and BP inflate at normal effort.
6. **Mega, Dynamax and Gigantamax are decorations with a multiplier.**
   - **Mega:** +10 to 35% on one Pokemon for a few weeks, from 68 species, through a 5-shard recipe. It is worth almost nothing once that Pokemon graduates.
   - **Dynamax and Gigantamax:** automatic perfect-day ×2 or ×2.5, used only against the gym leader.
   - **Mega for a day:** impossible with a rest day (B7). Nothing (no boss, no gym) is built around any of them.
7. **Exp. Share and Rare Candy skip the core loop** (B6). The thing that worked (raising a partner) gets skipped by month 4 at normal effort.
8. **Streak-heavy design for a bursty player:** 7 Frontier runs, momentum, run feats and the pay streak, and no comeback rule. Your own week (Monday to Saturday) can't hit top momentum (B7).
9. **Your real input doesn't drive most systems.** Chores (25 of 29 habits, the things you actually did all last week) are worth 1 to 3 XP each and feed only catching and coins. Steps feed only eggs. Sleep needs a second pillar to count. Last week you showed up every day, and the Lab, the hearts and the Frontier saw nothing.
10. **Rule-version debt.** Versions 13 to 19 in 20 days, 51 date-gated lines in the fold, and 234 items. Every fix now has to replay five weeks of exceptions. Shelving leaves dead parts (B9). It is past the point where the game can be held in one head, including mine.

---

## 7. Things the brief didn't ask about, but matter

- **Which inputs are measured and which are honour ticks.**
  - Measured: Sleep (band), steps (band), Strong workouts, Arbor practice items, Woodshed logs.
  - Honour ticks: LeetCode and Gym. The `gym` pillar doesn't require a Strong workout.
  - A design that leans on measured inputs is harder to fool yourself with.
- **Life OS also runs this core** (`npm run core` copies it). Any redesign changes Life OS's screens too, and Life OS must still build (`tools/build-core.mjs`).
- **Everything refolds from the ledger.** Every change needs a start date, so old days keep their meaning. A redesign is cheapest as **one** new version with one start date that switches the old systems off, not as seven more patches.
- **The perfect day is a chores test.** With 29 habits, a perfect day means all 25 chores. It is the game's biggest reward (instant catch, ×2 strike, 1-in-10 shiny), and it is decided by brushing and skincare, not by the pillars.

## 8. Questions for you

1. **Guitar or LeetCode?** Your brief lists the pillars as gym, calisthenics (Arbor), guitar and sleep. Life OS has **LeetCode** as a pillar and **Guitar shelved**. I simulated what Life OS has. Which list is the real one going forward?
2. **Is Sunday a planned rest day?** If yes, every "N days running" rule should forgive one rest day a week by design.
3. **Should Sleep count as a day on its own again?** v15 made it not count, because of the 2 to 4 AM nights. That is the direct cause of the Lab and hearts not moving last week. Alternative: count Sleep when the bedtime is before a cutoff (B11).
4. **What do you want the collection to be for?** Today 59 to 83 Pokemon by month 6 and only 8 do anything. Is the Pokedex count itself the reward, or should more of the Box have a job?
5. **How do you open the app?** Daily for a minute, or in bursts every few days (your ledger shows bursts)? The redesign should reward whichever is true.
6. **Keep the long tail?** The Battle Frontier, Rematch ranks and 26 Legend keys are the most content and the least used. OK to park them?
