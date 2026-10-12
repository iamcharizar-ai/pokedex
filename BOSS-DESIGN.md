# The weekly boss: design and plan

Written 12 Oct 2026, revised the same day after your answers. **Nothing here is built.** This is the design to approve, and the plan to build it.

## 0. Decisions made

From you:
- **No rest week.**
- **A boss does not exist until the party is full:** the partner and five trained Pokemon. Before that the card never shows.
- **The kill needs every task done.** Nothing less ever finishes it.
- **Strength, not just numbers.** Six weak Pokemon must not be able to beat a Mega legendary. What the party *is* (rarity, finishing level, Megas, bond, type edge) counts, not only how many there are.

From me (the rest, and why):
- **Healing: kept.** A boss day with no card progress gives back 3% of its HP. It makes the week a race rather than a pile-up you can leave to Sunday, and it is the one thing that makes slacking early cost something.
- **Master Ball: strong, not a sure thing.** A boss resists it: a Master Ball makes the catch 90% at any HP you are allowed to throw at, never 100%.
- **Legendary bosses: yes.** Every eighth boss is a legendary from a region that is open, shown in its Mega form when it has one.
- **Who writes the card: the Pokedex only.** It is where the planner needs the Arbor and Woodshed coaches, and writing it from two places doubles the code for little. Life OS reads it, and if the Pokedex has not been opened yet on Monday its strip says "Open the Pokedex to meet this week's boss".

## 1. The idea in one paragraph

Every Monday, once your party is full, a boss Pokemon appears and stays until Sunday night. Beating it takes a **challenge card** of five tasks drawn from what you already do (a lifting week in Strong, a few Arbor skills, a couple of Woodshed pieces, good nights, steady days), each from a few templates picked at random, so no two weeks match. The boss is **levelled to your party and scaled by its own rarity**, and **how hard you can hit it depends on the strength of the six, not only their number**. Every task has to be done to kill it, and a kill is not a catch: that is a chance. It is meant to be hard, and the way it gets easier is the way the whole game already pushes you: finish better Pokemon, forge Megas, raise the bond, and fill the party with ones that matter.

## 2. What the player sees

- **Home tab:** a Boss card under "Next up": the boss's sprite and level, an HP bar cut into five segments (one per task), days left, and the five tasks each with a progress bar. Tapping a task says where it is done (Strong, Arbor, Woodshed, Vitals, Life OS).
- **Monday:** a toast, "A boss appeared: Lv 62 Mega Mewtwo X. Seven days."
- **Through the week:** each task you do takes a chunk of HP. Boss HP only falls from the card, never from ordinary daily work.
- **Sunday night:** it leaves (nothing is taken from you), or you throw at it.
- **Trainer tab:** a history: name, level, how much you took, caught or not.
- **Life OS:** one more line in the partner strip, "Boss 62% left, 3 days".
- **Before the party is full:** a locked line on Home, "A boss appears once you have six: 4 of 6", so the goal is visible.

## 3. The weekly cycle

- A boss week is the game's existing week (Monday to Sunday), with the same one day of grace ticks already have.
- The first boss appears on the first Monday after the party is full (and after this ships). Drop below six later and the current week's boss carries on; the next one waits until the party is full again.
- The boss is chosen by a seeded draw on `boss:<week>`, so every device agrees: a rare (R) species, and every eighth boss a legendary (L). It is never a species whose region is closed.
- A missed week costs nothing: the boss leaves. There is no stake and nothing is taken back, in keeping with "nothing finished is ever taken away".

## 4. How strong the boss is, and how hard you hit it

**Member power.** Each of the six has a power:

`power = level × rarity factor × (1.15 if it has a Mega registered)`

- *level* is the partner's current level, and for a trained member the level it finished at (30 or 50).
- *rarity factor* is the rarity of its line: common 1.0, uncommon 1.1, rare 1.25, legendary 1.5.

`Σlevel` is the six levels added; `Σpower` is the six powers added.

**The boss.**
- **Level** `B = round(13 + 0.18 × Σlevel)`.
- **Rarity factor** of the boss: rare 1.0, legendary 1.35, and ×1.15 more if it is shown as a Mega.
- **Strength ratio** `R = Σpower / (6 × B × boss factor)`.
- **Strike** `S = clamp(R^1.2, 0.12, 1)`.
- **Boss HP** `= B × 100`, for display. Damage is tracked as a share of it.

**HP taken so far** `= S × (1 + common bonus) × Σ(task weight × task progress)`.

The *common bonus* is what the leader card already shows (party, bond including the kept bond of trained members, Mega, held item), plus **+4% for each party member whose type beats the boss's type** (up to +24%). So the work you have done to raise those counts here too, and a boss's type picks which of your Pokemon matter.

**The kill rule.** Everything above is capped at **95% of its HP unless all five tasks are at 100%**. The last 5% only falls when the card is complete.

Starting constants, first pass, to be tuned by simulation (section 9), not trusted yet. Each cell is the share of HP taken in a week with **every task done**:

| Party of six | Rare boss | Legendary boss | Mega legendary boss |
|---|---|---|---|
| Six commons, partner Lv 10 | 65% | 45% | 38% |
| Mixed uncommon/rare, no Mega | 97% | 68% | 57% |
| Rares, two Megas | **100% kill** | 91% | 77% |
| Legendaries and Megas | **100% kill** | **100% kill** | **100% kill** |

Doing 80% of the tasks takes about four-fifths of those. So six weak Pokemon can wound a rare boss and cannot touch a Mega legendary, a decent party kills rare bosses but not legendary ones, and killing a Mega legendary needs the best party you can build and a perfect week.

**It heals.** A boss day with no card progress gives back 3% of its max HP (never above full).

## 5. The challenge card

Five tasks, one per kind of work, a fixed share of the boss's HP each. Every task is cumulative across the week and shows 0 to 100%. Each is built from templates; a seeded draw picks the template, so the same week is the same card on every device.

| Kind | Share | Where it comes from | Templates (one is drawn) |
|---|---|---|---|
| **Gym** | 30% | `workout` events from Strong | **Volume:** `totalSets` for the week reaches `max(24, 1.25 × your average of the last three weeks)`. **Sessions:** four workouts of at least 40 minutes. **Record:** two lifts that beat every earlier session, plus 16 sets. |
| **Arbor** | 25% | `skill` events: the coach's `workingSet` | The coach picks three skills from your working set by the seed. **Spread:** practise each on four different days. **Push:** practise all three on three days and log a new best on one. |
| **Woodshed** | 20% | `guitar` logs: the coach's `rotation` and `reviewDue` | The coach picks two items: your weakest unfinished one and one review due. **Clean:** log each "Clean" on three different days. **Tempo:** hit the target tempo plus 5% on one, Clean on the other. |
| **Sleep** | 15% | Vitals `sleepScore` (or the 22:30 bedtime tick if there is no band) | **Four nights at 80 or more**, or **five nights in bed by 22:30**; one drawn. |
| **Life** | 10% | Life OS ticks | **Four days at 75% or more of the habits ticked**, or **one perfect day plus two days at 75%**. |

Notes:
- **Sized to you.** Targets come from your own recent weeks (gym from your sets, Arbor and Woodshed from the coaches' own picks), and sit about a quarter above what you actually do, so a full card is a real week, not a given.
- **No new work in the other apps.** Everything is read from events they already write. Strong, Arbor, Woodshed and Vitals need no change. If a week has no event of a kind (no workouts logged, no band), that task falls back to its other template; with nothing at all it is dropped and its share moves to the Life task. A dropped task counts as complete for the kill rule.
- **Counts twice.** The week's gym session still counts for the day's pillar and XP as it does now. The boss card is on top of that.
- **Undoing counts.** Progress is recomputed from the events, so unticking or deleting a workout takes it back.

## 6. The catch

Killing the boss and catching it are different things, and you do not have to kill it to try. Once its HP is **at or below 40%**, you can throw up to **three balls** (the Bag already has them). A throw is a ledger event and uses the ball.

`chance = clamp(0.20 + 0.10 × (trained party members, up to 5) + 0.15 (if every task was done) + ball bonus, 0.05, 1) × (1 − 0.6 × HP left)`

where "HP left" is the share of its max HP still standing (0 to 0.4). Ball bonus: Poke 0, Great +0.05, Ultra +0.10. A **Master Ball** makes it 90% at any HP you may throw at, never more. The roll is seeded (`boss-catch:<week>:<throw>`), so it is the same on every device.

Because the party is always full (five trained), the first part is at least 0.70, so the HP left and the ball are what vary. With an Ultra Ball:

| Week | HP left at the throw | Chance |
|---|---|---|
| Every task, boss dead | 0% | **95%** |
| Every task done but only 91% of HP taken (a hard boss) | 9% | 0.95 × 0.95 = **90%** |
| 80% of tasks, 25% HP left | 25% | 0.80 × 0.85 = **68%** |
| 60% of tasks, 40% HP left | 40% | 0.80 × 0.76 = **61%** |
| Boss still above 40% HP | | **no throw** |

A boss that is not caught leaves after the third throw or on Sunday. A caught boss goes to the Box as a normal Pokemon with a **1 in 5 shiny chance** (a boss is not an ordinary wild Pokemon). Note that a *kill* is not needed for a catch: a strong week that stops at 20% HP is a decent attempt. The kill rule matters for the milestone prize, not for the throw.

## 7. What it pays

Everything pays through the Collect strip (it arrives as held rewards), and nothing is taken back.

- **Milestones of HP taken:** 25% a Great Ball and 100 coins; 50% 10 gems and a berry; 75% 25 gems and a TM from the domain of the hardest task; **a kill** 50 gems and a shard of the matching colour (never Comet).
- **Each completed task:** its domain's marks, a few. So a good Arbor week is also an Arbor shop week.
- **Catch:** the boss, and an extra 30 gems.
- **A near miss is still worth something:** the 25 and 50% prizes make a weaker week not a total loss.

## 8. How it is built

**The rule that keeps the game consistent.** The fold in `core/` must stay pure and the same in both apps. It cannot call the Arbor or Woodshed coaches, so the card is **decided once and written to the ledger**, the same way the day's habit list already is.

1. **`boss_card` event** (new ledger type): `{ week, species, level, tasks: [{ kind, template, target, items? }] }`. Written by the Pokedex the first time it is opened in a boss week and none exists. The content is deterministic from the seed, and the earliest event by server time wins, so two devices racing is harmless.
2. **A planner** (`src/lib/boss.ts`) uses the existing coaches (`src/linked/arbor-model.ts`, the Woodshed copy) and the last three weeks of events to build the card.
3. **Progress is measured from raw events** by a function like `marksOf` already is, per day: sets, skills practised, items logged Clean, nights, ticked share. These go into `FactsInput` as `boss: { card, days: { [day]: { gym, arbor, shed, sleep, life } } }`.
4. **The fold** (`core/fold.ts`, with the maths in `core/boss.ts`) turns that into `game.boss`: `{ card, level, hp, max, taken, tasks: [{ kind, progress }], daysLeft, throwsLeft, caught, locked }`. It holds the milestone rewards (the Claim system) and handles the `boss-throw` use event. Member power needs two things per member: its rarity (already in `SPECIES`) and its registered Megas (already on the member).
5. **Rules:** version 10, a new `BOSS_*` block in `rules.ts`, a new section in the Guide and in How it works.
6. **Sync into Life OS** with `npm run core`, as always. Life OS shows one strip line and does nothing else with it.

**Files touched:** `core/rules.ts`, `core/boss.ts` (new), `core/facts.ts`, `core/fold.ts`, `core/events.ts` (the `boss_card` reader), `core/fold.test.ts`, `src/lib/boss.ts` (new), `src/lib/ingest.ts`, `src/lib/store.ts`, `src/App.tsx` (Boss card), `src/Play.tsx` (throw), Life OS `PartnerStrip.tsx`, `docs/GUIDE.md`.

## 9. Making it hard enough, and checking that it is

- **A simulator** (`tools/boss-sim.mjs`): plays a thousand synthetic seasons for each party type (the four in the table, and the ones between) against each boss kind, at 60, 80, 90 and 100% of tasks, and reports the share of weeks that end with the boss dead, in throw range, and caught. Aims: six commons never kill anything; a mixed party kills a rare boss in a small share of perfect weeks and no legendary; only a legendary-and-Mega party kills a Mega legendary, and only in a perfect week.
- **A replay on your real events** (`tools/export-ledger.mjs`, then the same replay tool the game already has): the card your past weeks would have drawn, and how much of it you would have finished. This is the check that targets sit about a quarter above what you do and are not impossible.
- **Tests** in `fold.test.ts`: the formulas and the table; an empty party gives no boss; the 95% cap without a full card; healing; the throw limit, the 40% line and the seeded roll; a Master Ball at 90%; undoing a workout takes progress back; two devices drawing the same card.

## 10. Build plan (about three sessions)

1. **Core:** `boss.ts`, the card shape, the fold, the tests, the simulator. No screens. Tune the constants against the simulator.
2. **Planner and measurement:** `src/lib/boss.ts`, `boss_card` writing and reading, the weekly progress ingest. Replay against your real ledger and adjust the task sizes.
3. **Screens:** the Boss card and the locked line on Home, the throw, the Trainer history, the toasts, the Life OS strip line, the Guide and How it works. Ship on a Monday.

**Risks.**
- Targets too high make the card feel hopeless; too low and it is a chore list. The replay is the guard, and every size is a named constant.
- Two devices writing the card at once is safe only because the content is deterministic. A test covers it.
- A week with a very different shape (travel, illness) leaves the card unfinished. That is by design, and the 25% and 50% prizes soften it.
- The party is full only after a long time (five finished Pokemon at 30 to 50 levels each). The boss may not appear for weeks. That is as you asked, but it means this system is a late-game one; the locked line on Home is how it stays in view.

## 11. Open points

Nothing blocks the build. Two things I would like your eye on once the simulator exists, because they are tuning rather than design: the 95% cap (whether the last 5% feels like a fair gate), and whether a *kill* should pay noticeably more than a high catch-attempt week, since the kill is rare by design.
