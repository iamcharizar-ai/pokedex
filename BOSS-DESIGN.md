# The weekly boss: design and plan

Written 12 Oct 2026. **Nothing here is built.** This is the design to approve, and the plan to build it.

## 1. The idea in one paragraph

Every Monday a boss Pokemon appears and stays until Sunday night. Beating it takes a **challenge card** of five tasks drawn from the things you already do (a lifting week in Strong, a few Arbor skills, a couple of Woodshed pieces, good nights, steady days), each a different size and picked at random from a few templates so no two weeks match. The boss is **levelled to your party**, and **how hard you can hit it depends on how big and how strong your party is**, so a lone partner can only scratch it, and only a full party of six, with every task done, can finish it. Finishing it is not catching it: a catch is a chance, not a guarantee. It is meant to be hard, and the way to make it easier is the way the whole game already pushes you: level the partner, train more Pokemon, grow the party, forge a Mega, raise the bond.

## 2. What the player sees

- **Home tab:** a Boss card under "Next up". The boss's sprite and level, an HP bar cut into five segments (one per task), days left, and the five tasks each with a progress bar. Tapping a task says where it is done (Strong, Arbor, Woodshed, Vitals, Life OS).
- **Monday:** a toast, "A boss appeared: Lv 43 Tyranitar. Seven days."
- **Through the week:** each task you finish takes a chunk of HP. Boss HP only falls from the card, never from ordinary daily work.
- **Sunday night:** it either leaves (nothing is taken from you) or its HP is at zero and you get throws.
- **Trainer tab:** a history of bosses: name, level, how much you took, caught or not.
- **Life OS:** one more line in the partner strip, "Boss 62% left, 3 days".

## 3. The weekly cycle

- A boss week is the game's existing week (Monday to Sunday, `weekOf`), with the same one day of grace the ticks already have.
- The boss is chosen by a seeded draw on `boss:<week>`, so every device agrees. It is a rare (R) species, and every eighth boss a legendary (L) from a region that is open. A species you already own as a catch is allowed (a second one is worth coins to the Professor).
- The first boss appears the Monday after this ships (the week of go-live is skipped), so nobody starts mid-week.
- Missing a week costs nothing: the boss just leaves. There is no stake and nothing taken back, in keeping with "nothing finished is ever taken away".

## 4. How strong the boss is, and how hard you hit it

Party strength is `Σ` = the sum of the levels of everyone in the party: the partner's current level plus each trained member's finishing level (30 or 50). An empty slot counts as 0, so **the size of the party matters as much as its level**.

- **Boss level** `B = round(13 + 0.18 × Σ)`.
- **Strength ratio** `R = Σ / (6 × B)`. Six members at the boss's level would be 1.0.
- **Strike** `S = clamp(R, 0.12, 1)`.
- **Boss HP** `= B × 100` (so a Lv 43 boss has 4,300 HP), for display. Damage is tracked as a share of that.
- **HP taken this week** `= S × (1 + common bonus) × Σ(task weight × task progress)`, capped at 100%. "Common bonus" is the strike bonus the game already shows on the leader card (party, bond, Mega, held item), so the work done to raise those counts here too. Mastery and natures add to their own task's domain.

Starting constants, first pass. They are meant to be tuned by simulation (section 9) over your real weeks, not trusted yet:

| Party | Boss | All tasks | 80% of tasks | 60% of tasks |
|---|---|---|---|---|
| Partner Lv 15 alone | Lv 16 | 16% HP | 13% | 10% |
| + 1 trained | Lv 23 | 43% | 34% | 26% |
| + 2 trained | Lv 33 | 66% | 52% | 39% |
| + 3 trained | Lv 43 | 82% | 65% | 49% |
| + 4 trained | Lv 53 | 93% | 74% | 56% |
| Full party of 6, partner Lv 45 | Lv 62 | **100%** | 80% | 60% |

So the only way to take it to zero in a week is the full party and every task. Anything less leaves it standing, and a lower ratio simply caps what the week can give you. That is the pressure to grow.

**It heals.** A boss day with no task progress gives back 3% of its max HP (never above full). The week is a race, not a pile-up you can leave to Sunday.

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
- **No new work in the other apps.** Everything is read from events they already write. Strong, Arbor, Woodshed and Vitals need no change. If a week has no event of a kind (no Strong workouts logged, no band), that task falls back to its other template, and if there is nothing at all it is dropped and its share goes to the Life task.
- **Counts twice.** The week's gym session still counts for the day's pillar and XP as it does now. The boss card is on top of that, not instead.
- **Undoing counts.** Progress is recomputed from the events, so unticking or deleting a workout takes it back.

## 6. The catch

Killing the boss and catching it are different things, and you do not have to kill it to try. Once its HP is **at or below 40%**, you can throw up to **three balls** (the Bag already has them). A throw is a ledger event and uses the ball.

`chance = clamp(0.20 + 0.10 × (trained party members, up to 5) + 0.15 (if every task was done) + ball bonus, 0.05, 1) × (1 − 0.6 × HP left)`

where "HP left" is the share of its max HP still standing (0 to 0.4). Ball bonus: Poke 0, Great +0.05, Ultra +0.10, Master 1 (a sure catch, whatever the HP). The roll is seeded (`boss-catch:<week>:<throw>`), so it is the same on every device.

| Party and week | HP left at the throw | Chance with an Ultra Ball |
|---|---|---|
| 3 trained, all tasks | 18% | 0.75 × 0.89 = **67%** |
| 3 trained, 80% of tasks | 35% | 0.60 × 0.79 = **47%** |
| 4 trained, all tasks | 7% | 0.85 × 0.96 = **81%** |
| 5 trained + partner, all tasks (boss dead) | 0% | **95%** |
| 5 trained + partner, 80% of tasks | 20% | 0.80 × 0.88 = **70%** |
| Partner and one trained, all tasks | 57%: **no throw** | the boss is too healthy |

So a small party cannot even attempt a catch (it stays above 40%), a middling one can but will often miss, and only a full party doing everything is close to certain. A boss that is not caught leaves after the third throw or on Sunday. A caught boss goes to the Box as a normal Pokemon with a **1 in 5 shiny chance** (a boss is not an ordinary wild Pokemon).

## 7. What it pays

Everything pays through the Collect strip (it arrives as held rewards), and nothing is taken back.

- **Milestones of HP taken:** 25% a Great Ball and 100 coins; 50% 10 gems and a berry; 75% 25 gems and a TM from the domain of the hardest task; 100% (kill) 50 gems, a shard of the matching colour (never Comet), and the throws.
- **Each completed task:** its domain's marks, a few. So a good Arbor week is also an Arbor shop week.
- **Catch:** the boss, shiny odds 1 in 5, and an extra 30 gems.
- **A near miss is still worth something:** the 25 and 50% prizes make a weak party's week not a total loss.

## 8. How it is built

**The rule that keeps the game consistent.** The fold in `core/` must stay pure and the same in both apps. It cannot call the Arbor or Woodshed coaches, so the card is **decided once and written to the ledger**, the same way the day's habit list already is.

1. **`boss_card` event** (new ledger type): `{ week, species, level, tasks: [{ kind, template, target, items? }] }`. Written by whichever app is opened first in the week (the Pokedex or Life OS) if none exists. Both would compute the same card from the same seed, and the earliest event by server time wins, so a race is harmless.
2. **A planner** (`src/lib/boss.ts` in the Pokedex, with a copy in Life OS if Life OS is to write it) uses the existing coaches (`arbor-core`, `woodshed-core`) and the last three weeks of events to build the card.
3. **Progress is measured from raw events** by a function like `marksOf` already is, per day: sets, skills practised, items logged Clean, nights, ticked share. These go into `FactsInput` as `boss: { card, days: { [day]: { gym, arbor, shed, sleep, life } } }`.
4. **The fold** (`core/fold.ts`, plus `core/boss.ts` for the maths) turns that into `game.boss`: `{ card, level, hp, max, taken, tasks: [{ kind, progress }], daysLeft, throwsLeft, caught }`. It also holds the milestone rewards (the Claim system) and handles the `boss-throw` use event.
5. **Rules:** version 10, a new constant block in `rules.ts` (`BOSS_*`), a new section in the Guide and in How it works.
6. **Sync into Life OS** with `npm run core`, as always. Life OS shows one strip line and does nothing else with it.

**Files touched:** `core/rules.ts`, `core/boss.ts` (new), `core/facts.ts`, `core/fold.ts`, `core/events.ts` (the `boss_card` reader), `core/fold.test.ts`, `src/lib/boss.ts` (new), `src/lib/ingest.ts`, `src/lib/store.ts`, `src/App.tsx` (Boss card), `src/Play.tsx` (throw), Life OS `PartnerStrip.tsx`, `docs/GUIDE.md`.

## 9. Making it hard enough, and checking that it is

- **A simulator** (`tools/boss-sim.mjs`): plays a thousand synthetic seasons for each party size and task-completion rate, and reports the share of weeks that end with the boss dead and caught. The aim: a lone partner never kills it or gets a throw; three trained get a throw in a good week and rarely kill it; the full party kills it in about 60% of weeks, and a full party doing every task catches it nearly always.
- **A replay on your real events** (`tools/export-ledger.mjs`, then the same replay tool the game already has): what card your past weeks would have drawn, and how much of it you would have finished. This is the check that targets are about a quarter above what you do, not impossible.
- **Tests** in `fold.test.ts`: the formulas in the table; an empty slot counts as zero; healing; the throw limit and seeded roll; a week with no boss events; undoing a workout takes progress back; two devices drawing the same card.

## 10. Build plan (about three sessions)

1. **Core:** `boss.ts`, the card shape, the fold, the tests, the simulator. No screens. Tune the constants against the simulator.
2. **Planner and measurement:** `src/lib/boss.ts`, `boss_card` writing and reading, the ingest of weekly progress. Replay against your real ledger and adjust the task sizes.
3. **Screens:** the Boss card on Home, the throw, the Trainer history, the toasts, the Life OS strip line, the Guide and How it works. Ship on a Monday.

**Risks.**
- Targets that are too high make the card feel hopeless; too low and it is a chore list. The replay is the guard, and every size is a named constant.
- Two apps writing the card at once is safe only because the content is deterministic. A test covers it.
- A week with a very different shape (travel, illness) will leave the card unfinished. That is by design, but a once-a-month "rest week" (no boss) is worth considering.

## 11. Decisions I need from you

1. **Hardness.** The table makes a kill possible only with the full party and every task. Is that the level you want, or should five trained with 90% of the tasks be enough?
2. **Healing.** 3% a day with no card progress: keep it, or drop it so the week is less of a race?
3. **Catch.** Is a Master Ball a sure catch at any HP, or should a boss resist it (say 90%)? And is 40% HP the right line for being allowed to throw?
4. **Legendary bosses** every eighth week: yes, or only ever rare ones?
5. **Rest week.** Do you want a monthly week with no boss?
6. **Where the card is written from.** Pokedex only (simplest), or either app (the boss shows in Life OS from the first minute of Monday)?
