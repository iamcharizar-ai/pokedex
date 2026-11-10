# Rules version 21: effort tiers (built, not live)

`V21_START = 2026-11-05`: **live from 5 Nov 2026**, the day it shipped (a Thursday, so this week's boss is still the card the old planner drew; the first V21 card is drawn on Monday 9 Nov). Days before it fold as they did.

- **Your real ledger** folds exactly as before (checked against the committed core on 20 Oct, 1 Nov, 4 Nov and 5 Nov).
- **To play it:** `node tools/sim-life.mjs --pace normal --rules v21`.
- **Design:** `GAME_REDESIGN.md` v4.

All numbers live in `core/rules.ts`, `core/boss.ts` and `core/economy.ts`, under "version 21".

## The day
- **Tier** = effortful pillars done (Code, Gym, Arbor; Guitar when it is back). Sleep never counts. A **Max day** is every effortful pillar on the list plus ¾ of the chores.

  | | chores only | 1 | 2 | 3 | Max |
  |---|---|---|---|---|---|
  | XP | ×1 | ×1 | ×1 | ×1.1 | ×1.15 |
  | Leader hit | ×1 | ×1 | ×1.25 | ×1.5 | ×2 |
  | Hearts | 0 | 1 | 3 | 6 | 10 |
  | Research | 0 | 60 | 140 | 220 | 300 |
  | Gems | 0 | 0 | 0 | 2 | 5 |
  | Coins | 40 / 60 | 60 | 90 | 140 | 200 |

  - Chores-only coins: 40 at half the chores, 60 at ¾.
  - On a chores-only day the night's XP doesn't hit the leader.
- **First pillar of the day** (any day with at least one): +1 heart, +40 research, +2 gems.
- **Sleep bonus** (a night of 80+ on a day with an effortful pillar): +1 heart, +20% research, and the Bells. A night alone pays its XP only.
- **Neglect bounty** (from 40 Trainer hearts, on every effortful pillar):
  - A pillar idle 2 days pays its own XP and marks **×3** when it comes back; 3 or more days, **×4**. Doing it clears it.
  - Tuned just under the line where skipping starts to pay; see `GAME_REDESIGN.md` v4.
- **Momentum slides:** a day with 2 effortful pillars moves it up a step (×1 → 1.2 → 1.35 → 1.5); any other day moves it down one, except one free day a week.
- **Gym is a logged Strong workout**, any length (`VERIFIED_BY` in rules.ts). A Gym tick without one pays as a basic habit.
  - Code and Arbor stay honour ticks.
  - Strong is read by `core/strong.ts`, which both apps run. Life OS's game link now keeps Strong's `workout` and `workout_delete` events.

## The Lab
- **When:** only on days with an effortful pillar.
- **How much:** the tier's research plus the first pillar's, ×(1 + the desk's bonus: common 10%, uncommon 15%, rare 20%, legendary 30%, a shiny ×1.5), × the Sleep bonus. The party no longer studies.
- **Rank:** a flat 1,500.
- **Rank rewards:** odd ranks a Lab pick (a Full Incense: choose the next wild one from three), even ranks 20 gems, every fifth a Mystery Egg.

## The boss
- **The card** (`core/boss.ts tasksV21`, drawn by `src/lib/boss.ts`):
  - **every effortful pillar on the list always has a task**, so a neglected pillar never drops off (Code now has one too);
  - a pillar done on 3+ of the last 21 days gets a target sized to them; one done on fewer gets a target of 2;
  - **no task asks for fewer than 2**, so no single day finishes a task and no card is beaten on its first day;
  - effortful tasks share 70% of its HP;
  - one task for good nights on a day of work and one for days with ¾ ticked, 15% each;
  - at most 5 tasks (the chores task goes first);
  - targets are the last 21 days' rate × 1.3, from 2 to 9 a week.
  - A V21 card is revision 3: it replaces a card an older app drew for the same week (`src/lib/store.ts` draws it again).
- **The fight:**
  - The card is its HP.
  - Power multiplies the work: a Mega +5% per bond level (half from the party), +5% per party member whose type beats it, and the Rocky Helmet.
  - A Max day's progress counts ×1.45.
  - No heal on rest days, no throws, no party minimum.
- **Payouts:** 25% pays 100 coins and a Great Ball; 50% pays 5 gems and an Oran Berry; 75% pays 10 gems and an Ultra Ball. **Beaten:** 20 gems, its shard, and **it joins you**.

## Bond, Mega, the rest
- **Trainer perks:** Pickup at 10 hearts, the neglect bounty at 40, Endure at 100, Best friends at 200, **Sharing** at 350.
  - Sharing: hearts a Pokemon can't take go to the party member with the fewest.
  - Focus, Exp. Share and Trainer stars are off.
- **Best Friend:** a party member at 150 hearts works at full signature strength.
- **Ribbons:** once all six are Best Friends, every 150 hearts is a Ribbon: two of a Mystery Egg, a shard, or a Lab pick.
- **Mega:** worth +5% per bond level (half from the party), in both fights. Mega for a day is gone.
- **Max day is the Dynamax.** G-Max is only its picture. The perfect day keeps its instant catch and shiny chance.
- **Duplicates:** a second of a line already yours (not a shiny) gives that one 20 hearts instead of a copy.
- **Rare Candy** works on fully trained Pokemon only.
- **Each pillar's shop** sells its egg and its shard at 20 marks. An egg can only be bought while fewer than 3 wait.
- **Tiles:** `game.tiles` for Life OS, one per effortful pillar on the list: `{ iconId, fill, ready, bountyActive, bounty }`. The aim (shard or egg) can be switched with an `aim` use.

Tests: `core/v21.test.ts`.

## Start day

`V21_START` will be a **Monday**, so the boss's week starts with the rules. This was checked by folding the real ledger plus synthetic days (6 to 15 Nov 2026) with `V21_START` set to Mon 9 Nov in a scratch copy of the code.

| What | On the first day |
|---|---|
| **The Lab** | The points are scaled to the flat rank so the dial keeps its fill: **23 of 500 becomes 69 of 1,500**. From then the day's research is by tier |
| **The wild Pokemon** | Nothing changes. One mid-fight keeps its HP (Venonat 326/700 carried on and was caught later that week). Catching is untouched |
| **The boss** | The week before closes on Sunday as it always would. Monday's card is drawn by the V21 planner from the last 21 days: in the run, Code, Gym and Arbor at 2 each (Gym and Arbor neglected), good nights at 2, steady days at 2. A comeback Monday (a Max day) took it to 72%, and Tuesday beat it |
| **Momentum** | Starts at the step nearest the old multiplier (yours was ×1, so ×1). It does not drop to ×1 from a higher one |
| **Hearts** | Partner and Trainer hearts carry over. The first Max day gave 12 (10, the first pillar's 1, a good night's 1) |
| **Trainer perks** | The ladder changes. At 83 hearts you are level 2, which is now the neglect bounty: **Endure moves to 100 hearts**, so it is off until then (two days in the run) |
| **Neglect bounty** | Counted from your real history. Every pillar idle since 27 Oct pays ×4 the first day it is done (it did, on Monday) |
| **Bells** | From the first day, only on a night of 80+ with an effortful pillar done |
| **Coins** | From the first day, the tier's coins, not the old pay by share |
| **Gym** | From the first day, a logged Strong workout. A Gym tick without one is a basic habit |
| **Life OS tiles** | Appear on the first day, one per effortful pillar on the list |

## Version 21.1: the fixes of 10 Nov 2026

`V21_FIX = 2026-11-10` (`core/rules.ts`). Earlier days fold as they did. Found in `AUDIT-2026-11-10.md`; tests in `core/v21fix.test.ts`.

- **Rare Candy** is for any Pokemon you own with a level still to gain, the partner too. `canCandy` in `core/fold.ts` is the one rule; the fold and both screens that offer a candy read it. The partner evolves or finishes training on the spot, and whoever leads at the end of the day's actions evolves that day.
- **Momentum** is the seven days again: 3 days that counted ×1.2, 5 ×1.35, **6** ×1.5. A day counts with two pillars; a good night can be one of them, never the only one. `game.momentum.steps` carries the steps, and both apps draw from it.
- **Endure** is read from version 21's own ladder (100 Trainer hearts), as its screen says.
- **A tap the rules would ignore is not written.** `useItem` in `src/lib/store.ts` folds the action first; if the game would be no different it says why and writes nothing.
- Screens corrected: the pay table on Goals, the rule book, Battle prep's critical chance, the shard and ball texts, the Mega bonus in the strike breakdown.
