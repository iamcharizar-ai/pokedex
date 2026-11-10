# Game spec, version 22: one game you can explain

Written 10 Nov 2026 for whoever builds it (Opus or Sonnet). It replaces section 5 of `AUDIT-2026-11-10.md`, with the owner's answers of 10 Nov folded in. Read `AUDIT-2026-11-10.md` sections 2 to 4 first for why each cut is made.

**Status:** design only. Nothing here is built. The fixes of 10 Nov ("version 21.1", `RULES-V21.md`) are built and are the starting point.

Numbers marked * are first values. Tune them in `tools/sim-life.mjs` before a start date is set (section 12).

---

## 0. The test every rule must pass

The owner plays this from **Life OS**. They open the Pokedex rarely. They judged the old game as a player and found it redundant: the same prize reached three ways, things paid for twice, meters that change nothing.

So every rule in this spec passes four tests. Reject any addition that fails one.

1. **One job.** A thing does one thing. Two things never do the same job.
2. **One source.** A prize comes from one place.
3. **One sentence.** It can be said in a sentence that is simply true, with no "mostly".
4. **It comes from a habit.** If it does not trace back to something ticked, slept or walked, it does not belong.

And one test for anything that stretches a system: **a second step must be a different kind of step.** Mega Evolution passes (levelling is automatic, forging is a choice of colour and Pokemon). Buying a fossil and then paying again to revive it fails (the same act, twice).

---

## 1. The whole game on one page

**Your day**

> Every tick trains your partner. The share you ticked catches the wild Pokemon. Pillars fight the gym leader. The week's card fights the boss.

**Your Pokemon**

> Caught Pokemon wait in the Box. One at a time is your partner and grows. A fully trained Pokemon either fights (the party) or helps you catch (the Lab).

**Your pillars**

> Each pillar done drops its berry. Seven of a pillar earns its prize: its shard or its egg.

**The long game**

> Berries make a Pokemon your Best Friend. Three shards of three colours make a Mega Stone. A fully trained Best Friend can Mega. Beat every league and they all come back stronger.

| What you do | What it moves | Where you see it |
|---|---|---|
| Tick anything | Partner XP | Life OS card |
| Tick more of the list | Wild Pokemon's HP | Life OS card |
| Do a pillar | Gym leader's HP, that pillar's track, a berry | Life OS card and pillar tile |
| Hit the week's targets | Boss's HP | Life OS card |
| Sleep 80+ on a work day | Counts as a pillar | Sleep tile |
| Walk | The egg or fossil in the Nursery | Pokedex, Today |

---

## 2. Words, defined once

Every rule below uses these and only these. The code should have one function for each, in `core/`, and no screen should restate one.

| Word | Meaning |
|---|---|
| **Effort pillar** | A pillar on the Life OS list that is not Sleep: Code, Gym, Arbor, and Guitar while it is on the list. Gym is done by a logged Strong workout (unchanged) |
| **Work day** | A day with at least one effort pillar done |
| **Pillars done** | Effort pillars done, **plus Sleep if the night scored 80+ and it is a work day** |
| **A day that counts** | Pillars done is 2 or more |
| **Tier** | Pillars done: 1, 2, 3. **Max** is every pillar on the list done and three-quarters of the chores |
| **Chores** | Every habit that is not a pillar |

**The Sleep rule, stated once:** a good night is a pillar only beside an effort pillar. On a day with no effort pillar, the night pays its own XP and nothing else: no tier, no dot, no berry, no track pip, no hearts, no coins beyond the chores' pay. Nothing in the game reads Sleep any other way.

This replaces version 21's "effortful tier" and its separate "Sleep bonus". Version 21.1's momentum already uses it (`counts` in `core/fold.ts`).

---

## 3. The day

### 3.1 Partner XP (unchanged)

Every habit pays its XP (pillar 100, core 30, standard 3, basic 1; Sleep by its score), times momentum. Drop the tier XP multiplier (`DAY_XP_MULT`) and the Best friends XP perk moves to section 8.

### 3.2 Momentum (built in 21.1, keep)

Of the last seven days, how many counted: 3 is ×1.2, 5 is ×1.35, 6 is ×1.5. `game.momentum.steps` is what screens draw.

### 3.3 The wild Pokemon (formula unchanged: the catch pace stays)

- Hit for the day: `100 × (share of habits ticked)^1.5 × ball`, where the ball is the day's own (half ticked ×1.3, four-fifths ×1.6). Unchanged.
- A perfect day catches it on the spot, shiny one time in 10. Unchanged.
- It flees after 21, 28 or 42 days by rarity. Unchanged.
- **Removed:** Max Repel, Quick Claw's 25%, the Charm signature, research ranks.
- **Changed:** the Lab desk takes HP off as it appears (section 5.4).

### 3.4 The gym leader

`hit = sum over pillars done of (100, or 150 if the leader is weak to that pillar) × tier × (1 + party power)`

- Tier multiplier: 1 pillar ×1, 2 ×1.25, 3 ×1.5, Max ×2 (as `DAY_HIT_MULT` today). A Max day still draws the partner Dynamaxed.
- Party power: section 5.3.
- Chores do not hit the leader. On a day with no effort pillar the leader is untouched.
- Leader HP, the leagues, the Elite Four, badges, regions opening: unchanged.
- **Removed from the hit:** bond level, partner level, mastery, vitamins, natures, signatures, held stat items, TMs, Type Plates, Expert Belt, X items, Dire Hit, critical hits, Life Orb. Natures stay as a name on the card.

### 3.5 The boss (unchanged, with one swap)

The card, its targets, its payouts and "a beaten boss joins you" stay exactly as version 21 has them. Two changes only:

- Its power bonus becomes the same **party power** number as the leader's (5.3), in place of the Mega-by-bond, type-edge and Rocky Helmet terms. One number to learn.
- It no longer pays a shard (4.1: shards have one source). It pays gems and the Pokemon.

### 3.6 Coins for the day

By tier: 60 / 90 / 140 / 200. A day of chores only: 40 at half the chores, 60 at three-quarters. Unchanged from version 21. Gems by tier (`DAY_GEMS`, `FIRST_PILLAR.gems`) go.

### 3.7 An empty day

Costs what it costs now (`SLIP`). The only protection is the Endure perk (section 8). Revive, Guard Spec and Focus Sash go.

---

## 4. Pillars: berries and tracks

This is the part that ties the game to the habits. A pillar done pays two things, both immediately, both visible on its Life OS tile.

### 4.1 The track: seven earns the prize

Each pillar has a track of **7*** pips. A full track is a prize waiting in Collect: **that pillar's shard, or that pillar's egg**, chosen when it is collected. The track then starts again.

| Pillar | A pip is | Shard | Egg hatches |
|---|---|---|---|
| Gym | One piece of the Strong kit: one per routine in the split, seven different routines | Red | Gym types |
| Code | A day it was done | Blue | Code types |
| Arbor | A day it was done | Green | Arbor types |
| Guitar (when listed) | A day it was done | Yellow | Guitar types |
| Sleep | A night of 80+ on a work day | none | Sleep types (its egg only) |

- **Gym keeps the kit exactly as first designed:** a second workout of a routine already held adds no pip. That is what makes it reward the whole split.
- **Shards come from tracks and nowhere else.** The one exception is the Comet Shard from the month review, which stands in for any colour.
- **The choice is real:** a shard is power (towards a Mega Stone), an egg is a new Pokemon. Until the Key Stone is earned the choice still shows both, with the shard marked "needs the Key Stone to use".
- An egg can only be chosen while fewer than 3 wait (as now).
- **Removed:** all five mark currencies, the five marks shops' goods, mastery, kit Iron, "every third set", the aim switch, shards from bosses, milestones, Ribbons and feats.
- The Dojo, Silph Co., the Garden, the Music Hall and the Dream House stay as places. Each one **is** its pillar's track: seven pips, the prize, and its berry count. Shelved pillars hide theirs (`isShelved`), as now.

### 4.2 The berry: every pillar done drops one

Each pillar done drops **one berry of its own kind** into the Bag. These are the six that exist: Hondew (Code), Kelpsy (Gym), Qualot (Arbor), Grepa (Guitar), Pomeg (Sleep, on a work day), Tamato (chores: one on a day with three-quarters of the chores ticked).

**A berry is fed to one of your Pokemon for hearts: 2*, or 5* if it is that Pokemon's favourite.** A Pokemon's favourite is the berry of its first type's kind of work (`TYPE_DOMAIN`, the mapping signatures use today: Fighting, Rock, Ground, Steel, Fire and Dragon like Kelpsy; Psychic, Electric and Ghost like Hondew; Grass likes Qualot; Dark likes Pomeg; Fairy, Normal and Flying like Grepa; Water, Ice, Bug and Poison like Tamato).

Why this is the right berry system:

- **Berries are bond, as the owner asked.** No bait.
- **They come from habits, not coins.** The 50-coins-a-heart problem disappears because there is no price.
- **The choice is who, not how many.** The pillars you actually do decide which Pokemon bond fastest. A gym-heavy month makes Fire and Fighting types your Best Friends. Feeding a favourite is worth 2.5 times as much, so "who gets this berry" is a real question.
- **Removed:** Oran, Sitrus, Sweet Heart, Heart Scale, berries in every shop, the "double on a day of its work" rule, the Forage signature.

---

## 5. A Pokemon's life

### 5.1 The path

**Box → Partner → Party or Lab → Collection.**

| Where | Its job | Why you would put it there |
|---|---|---|
| **Box** | Waiting | Everything caught, hatched or revived starts here at Lv 1. Most stay: catching fills the Pokedex and opens regions |
| **Partner** (1) | Grows | The only one that gains XP. Evolves at 16 and 36 (25 for a two-stage line), **fully trained at 50** (30 for a line that does not evolve). It also counts double in party power |
| **Party** (5) | Fights | Adds to every hit on the leader and the boss |
| **Lab desk** (3) | Catches | Fully trained only. Each takes 15%* off a wild Pokemon's HP as it appears |
| **Collection** | Bench | Everyone else trained. Swapped in when its type is the one you need |

### 5.2 The partner

- **Level 50 is the end.** `MAX_LEVEL` 100 and "lead again" are removed. A fully trained Pokemon cannot be partner again.
- When a partner is fully trained, **the game asks who is next** (a choice waiting in Collect that names the Box). Until answered, the first party member that is not fully trained steps up, else the oldest in the Box.
- **Changing partner is free and loses nothing.** XP and hearts stay with each Pokemon. The reasons to change: its type beats the current leader (it counts double), or you want a different one evolved first. The reason not to: the one you set down stops growing.
- **Evolution** is the milestone of training. It happens by level, it can change the Pokemon's type (which changes its match-ups and its favourite berry), and only a final form can Mega. Branching by what you did stays.
- **Rare Candy:** one level for any Pokemon not fully trained (built in 21.1; under this spec the cap is fully trained).
- **Evolution stones** evolve a Box Pokemon one stage without raising it, for the Pokedex. Keep the ten stones, cut the sixteen other evolution items.
- **Everstone** stays.

### 5.3 Party power: the one fighting number

For each of the six (partner and five):

`share = (level ÷ 5)% + 1% for each heart level it has` (so a Lv 50 Best Friend is 15%)*

- **Doubled if its type beats the foe's** (the leader's type, or the boss's).
- **Doubled again if it holds a Mega Stone.**
- **The partner's share counts twice.**

Party power is the sum. A Lv 1 Pokemon adds almost nothing, which is honest: the party is worth what you have raised. Finishing a partner no longer costs anything, because it keeps adding its share from the party.

This is the only place level, hearts, type and Mega touch a fight.

### 5.4 The Lab desk

Three seats, fully trained Pokemon only. Each seated Pokemon takes **15%*** off every wild Pokemon's HP when it appears (45% with three, the cap research has today). A Pokemon in the party cannot sit.

- **Removed:** research points, ranks, rank rewards, the desk bonus table, Insight, "the party studies".
- The choice: a trained Pokemon either fights or catches. With none trained the desk is empty and the catch pace is exactly today's.

### 5.5 What a second of the same line does

Unchanged from version 21: it gives the one you have 20 hearts instead of a copy (a shiny is kept).

---

## 6. Hearts and Mega

### 6.1 Hearts: one purpose

Hearts belong to one Pokemon, 0 to 150, drawn as five hearts (levels at 10, 30, 60, 100, 150, as now).

**Sources:** berries (4.2), 1 a work day for the partner, 10 for a Trail Egg hatchling, 20 from a duplicate. Nothing else. The tier's hearts (`DAY_HEARTS`), party-member work hearts, Dream, Shell Bell and Luxury Ball go.

**What they do:** each heart level adds 1% to that Pokemon's party share (5.3), and at **150 it is a Best Friend**: it gets a Ribbon on its card and can hold a Mega Stone.

### 6.2 Mega: the proof you did every pillar

- **Key Stone:** from the feat it comes from today (any one kind of work, seven days running).
- **Mega Stone:** three shards of three different colours, forged at the Forge (unchanged altar). A Comet stands in for a missing colour.
- **Who can hold one:** a fully trained Best Friend whose form has a Mega. X or Y is chosen at the Forge.
- **What it does:** doubles that Pokemon's party share, and it fights as its Mega form's types.

So the chain is: train it (XP), befriend it (berries, which come from pillars), do every pillar (shards). Each link is a different kind of act. That is the diversity the owner asked for.

---

## 7. Eggs, fossils and the Nursery (one place for everything walked)

Steps do one thing: they fill whatever is in the Nursery. One thing is in it at a time, and which one goes in is your choice.

| Goes in the Nursery | From | Steps |
|---|---|---|
| Pillar egg | A full track (4.1) | 40,000 |
| Trail Egg | Every 100,000 steps walked | 30,000 |
| Mystery Egg | Rare things shop, for gems | 60,000 |
| **Fossil** | Pickup only | **20,000*** |

**Fossils are no longer bought and then paid for again.** A fossil is found by Pickup and revived by walking: it goes in the Nursery like an egg. No Battle Points, no 150 coins, no Lab counter. It competes with eggs for the one Nursery place, which is a real choice.

---

## 8. Trainer perks

Three perks, from the total of every heart across every Pokemon (it never goes down):

| Hearts | Perk |
|---|---|
| 10 | **Pickup**: on a work day the partner may find something (section 9.3) |
| 50* | **Endure**: one empty day a week costs nothing |
| 150* | **Close bond**: +10% XP |

After the third perk the long game is **Best Friends**: each Pokemon taken to 150 hearts is a Ribbon, and the Trainer card counts them. That is the answer to "what after the perks".

**Removed:** the neglect bounty (section 8.1), Sharing, Focus, Exp. Share, Trainer stars, Ribbon rewards every 150 hearts.

### 8.1 The neglect bounty: verdict

The owner asked for a careful look. **Cut the ×3 and ×4 bounty. Replace it with one visible comeback.**

What the bounty is: a pillar left for 2 days pays its own XP and its marks ×3 when you return, ×4 after 3 days.

Why it should go:

1. **You cannot see it where you decide.** It is drawn only in the Pokedex. The owner opens Life OS. A reward nobody knows about changes no behaviour, so today it does nothing except move numbers.
2. **It pays for staying away.** It had to be tuned to sit just under the point where skipping beats showing up (`GAME_REDESIGN.md` section 0). A reward that must be capped so it never quite works is a weak reward by design.
3. **It is not a comeback in practice.** Gym was done on 3 of 39 days, so every Gym day was a ×4 day. It became a permanent multiplier on the rarest pillar, not a welcome back.
4. **It breaks tracks.** ×4 on a seven-pip track is more than half the prize for one day.
5. **The same job is already done better.** The boss card keeps a neglected pillar on it with a small target of 2 (the owner's own rule). That is visible, it asks for the pillar twice rather than once, and it pays through the boss.

What replaces it, because the instinct behind it is right (coming back should feel good, not punished):

- **Comeback:** an effort pillar done after 3 or more idle days pays **double its own XP** that day. Nothing else doubles: one pip, one berry.
- **It must be shown on that pillar's Life OS tile** as a small mark while it is on offer. If it cannot be shown in Life OS, do not build it.

---

## 9. Money, shops and the Bag

### 9.1 Two currencies

| | Earned by | Spent at |
|---|---|---|
| **Coins** | The day (3.6), Pickup, level milestones | The Mart |
| **Gems** | Things that happen once or rarely: a catch 3, a shiny 20, an evolution 10, fully trained 15, a gym 10, Elite Four 15, a league 25, a boss 20, a feat, a Frontier Symbol | Rare things |

Battle Points, the BP Exchange, the Collector and the fossil Lab counter are removed.

### 9.2 Two shops

**The Mart (coins):** Great Ball, Quick Ball, Timer Ball, Incense. Always in stock, no daily deals.

**Rare things (gems):** Mystery Egg, Rare Candy, the ten evolution stones, the three scenes, and the held items of 9.4.

Prices are for the simulator (section 12). The rule for setting them: **a bigger or stronger thing is never the worse buy**, and no two things on a shelf do the same job.

### 9.3 Pickup (kept: the owner likes it)

On a work day, with the Pickup perk, the partner may find one thing. The table becomes short and everything in it is directly usable: **coins** (in place of treasures to sell), a berry, a Great Ball, a Rare Candy, an evolution stone, a fossil. No find needs a second step to become worth something, except the fossil, whose second step is walking.

### 9.4 Held items: eight, each a different job

One held by the partner. Bought once for gems, or earned.

| Item | Job |
|---|---|
| Everstone | The partner keeps its form |
| Lucky Punch | Pickup finds twice as often |
| Amulet Coin | The day's coins ×1.25 |
| Lucky Egg | Worn-down catches are shiny 1 in 25, not 1 in 50 |
| Old Charm | Everything in the Nursery needs a fifth fewer steps |
| Soothe Bell | The partner's daily heart is 2, not 1 |
| Rocky Helmet | Party power +10% against the boss |
| Expert Belt | The partner's doubled share counts three times when its type beats the foe |

Old Charm, Lucky Egg and Amulet Coin were always-on keepsakes. Making them held items gives the one slot a real choice. Everything else in `HELD` is removed.

### 9.5 Balls: a choice of timing

Great (50 HP, any day), Quick (100 on the day it appears, 25 after), Timer (15, and 15 more a day it has waited, up to ten days), Master (earned, never sold, catches anything). The other ten are removed.

### 9.6 What is in the Bag afterwards

Balls (4), berries (6), held items (8), shards (4 colours and the Comet), the Key Stone, eggs, fossils (9), evolution stones (10), Rare Candy, Incense, kit pieces (7), Legend keys, scenes (3). About 60 kinds, and each has one use that its card states.

---

## 10. The long road

### 10.1 Leagues and the Rematch (kept: the owner's idea)

Ten leagues, 122 leaders. After the last Champion every league comes back one rank up (+60% HP a rank), as now. This is the endless road and it stays exactly as built.

Two changes so it pays in the game's own terms:

- A Rematch win pays gems (a gym 10, Elite Four 15, a Champion 40*), in place of Battle Points.
- **Every Champion hands over a Legend key, on the first lap as well as the Rematch.** Today only Rematch Champions do, which is after all 122 leaders.

Type Plates are removed (the Elite Four pay gems).

### 10.2 The Battle Frontier: the one streak system

Seven facilities, each a run of one kind of day, as now: the Tower (days that count), one per pillar, the Pyramid (Max days, in place of perfect days). Silver and Gold Symbols as now. A Symbol pays gems; a Gold Symbol pays its Legend key.

**Removed because the Frontier already is them:** the feats for 7, 30 and 100 in a row; the weekly quests; the season ladder.

### 10.3 Legend quests: each legend is one deed

A legend comes one of four ways, and its card names which:

1. A **Gold Symbol** (seven keys, as now).
2. A **Champion** (ten on the first lap, then each Rematch lap's, in `REMATCH_KEYS` order).
3. **Every 8th boss** is a legendary (as now).
4. **Every 25th wild Pokemon** is a legendary (as now).

A key is used from its card and the legend comes as the next wild Pokemon, to be caught by your days. The 250 BP price list is removed. Keys with no deed left after this are cut from the list; do not invent deeds to keep all 26.

### 10.4 Feats: milestones only

Keep one-time milestones that mark something real: firsts (a perfect day, a shiny, a legend, a Mega, a fully trained Pokemon, a hatch), Pokedex counts (10, 25, 50, 100), badges (1, 8), workouts and records, parts owned, long walks, deep nights. They pay gems, and the Key Stone, Master Ball and held items they pay today. Remove every run feat and anything that paid a shard.

### 10.5 Level milestones

Every 5 levels of the partner: a choice of two from coins, gems, three Great Balls, a Rare Candy. No shard.

### 10.6 Collect

Keep it only for rewards that carry a **choice** (a track's prize, a level milestone, who is next). Everything else is paid at once and told as news. Today 66 of 75 collects changed nothing.

---

## 11. Life OS: where the game is actually played

The owner decides what to do in Life OS, so anything meant to change a decision must be there. This is a data contract, not a visual design: the look is the owner's to approve (they removed the "ghost" tiles on 5 Nov, so do not bring that look back without asking).

`foldGame` must expose, for Life OS to draw:

| Field | For |
|---|---|
| `game.momentum` `{ days, mult, steps }` | The seven dots (built) |
| `game.foes` `{ wild: { form, hp, max, leavesIn }, leader: { name, hp, max, weak: Tag[] }, boss: { form, taken } | null }` | One line under the XP bar: the three things today is moving |
| `game.tracks[tag]` `{ pips, of, ready, comeback, berries }` | Each pillar tile: how far its track is, a prize waiting, the comeback on offer |
| `game.today.tier`, `pillarsDone`, `counts` | "One more pillar makes today count" |
| `game.weakToday: Tag[]` | Which pillar hits the current leader hardest, marked on that tile |

The single most useful line in Life OS is the last: **the leader's weakness marked on a pillar tile** turns the league into a reason to pick one pillar over another today.

---

## 12. Building it

### 12.1 Freeze the old rules first

1. Copy `core/fold.ts`, `rules.ts`, `economy.ts`, `bond.ts`, `frontier.ts` as they stand into `core/legacy/`. **Never edit them again.** They compute the game up to the day before `V22_START`.
2. Write `core/migrate.ts`: `legacyGame → v22 state` (12.2).
3. Write the new fold in `core/fold.ts`: it takes the migrated state and folds days from `V22_START`. **No version checks in it.**
4. `foldGame(facts)` splits the days at `V22_START`, runs legacy on the first part, migrates, runs v22 on the rest. With no days after the start, it returns the legacy game shaped as a v22 one.
5. `V22_START` is the deploy day, as always. Prices are part of the frozen legacy, so no date-gating is needed inside v22.

Keep unchanged and shared: `facts.ts`, `events.ts`, `order.ts`, `day.ts`, `strong.ts`, `species.ts`, `gyms.ts`, `types.ts`, `boss.ts` (apart from 3.5).

### 12.2 Migration: nothing earned is lost

| Old | Becomes |
|---|---|
| Each Pokemon's level, XP, hearts, form, Megas, shiny, nature | Unchanged |
| A fully trained Pokemon above Lv 50 | Stays at its level for show; counts as 50 |
| Badges, league position and leader HP, regions, Hall of Fame, Rematch lap | Unchanged |
| Wild Pokemon and its HP, the egg in the Nursery, trail steps | Unchanged |
| Boss of the week | Unchanged |
| Marks of a pillar | Pips on its track: 1 pip for every 3 marks*, at most 6 |
| Kit pieces held | Kept: they are the Gym track's pips (duplicates dropped) |
| Shards, Comet Shards, Key Stone | Unchanged |
| Coins, gems | Unchanged |
| Battle Points | 2 gems each* |
| Mastery levels | 5 gems a level* |
| Research rank and points | 10 gems a rank* |
| Berries of removed kinds | 1 pillar-less berry each: converted to Tamato |
| Removed balls | Great Balls, one for one |
| Removed held items, TMs, vitamins, X items, guards, lures, treasures, plates | Bought back: their coin or gem price, or the Collector's price |
| Fossils, evolution stones, Rare Candy, eggs, incense | Unchanged (lures become Incense) |
| Frontier runs and Symbols | Unchanged; the Pyramid's count carries over |
| Feats won | Stay won |
| The research desk | Emptied (it now takes only the fully trained) |

Write the migration as a pure function with a test that folds the real ledger (see memory `real-ledger-replay`) and asserts: every Pokemon is still there with the same level and hearts, coins did not go down, and no item id survives that the new `ITEMS` does not know.

### 12.3 One rule, two readers

Every action a screen can offer has a predicate in `core/` that the fold also calls, the way `canCandy` works now. `useItem` in `src/lib/store.ts` already refuses and explains a tap that would change nothing; keep it, and move each reason string next to its predicate.

Add the missing kind of test: for each fixture, for every action a screen offers, applying it changes the game.

### 12.4 Tune before a date is set

Extend `tools/sim-life.mjs` with `--rules v22` and report, at the "real", "normal" and "strong" paces over 182 days:

- days to the first shard of each colour, and to the first Mega Stone;
- Pokemon fully trained, Best Friends, leaders beaten, boss win rate;
- gems earned and spent a month (version 21 over-pays gems about 2.5 times; v22 must not end six months with thousands unspent);
- hearts a day and berries a day;
- the comeback's effect: doing a pillar every fourth day must earn less of everything than doing it daily.

Then set the starred numbers. Targets: at the owner's real pace (about 1 effort pillar a day) a first track fills inside three weeks, a first Mega inside three months, and a week never passes with nothing visible happening.

### 12.5 Order of work

Each step ships on its own and leaves the game working.

1. **Freeze and migrate** (12.1, 12.2) with v22 rules equal to today's. Proves the split changes nothing. No visible change.
2. **Words and the day** (sections 2, 3): tier, the leader's hit, party power, coins.
3. **Tracks and berries** (section 4), with the track pages in place of the marks shops.
4. **The Pokemon's life** (sections 5, 6): level cap, who is next, the desk, hearts, Mega.
5. **Shops, Bag, Nursery fossils** (sections 7, 9).
6. **The long road** (section 10): Rematch pay, Champions' keys, Frontier, feats, Collect.
7. **Life OS fields** (section 11), then the screens, then the rule book rewritten from this file.

Run `npm test`, `npm run core`, and both builds at every step. Every memory rule still applies: the catch formula is untouched, shelved pillars hide and never delete, the look of the screens is kept, rules start on the deploy day.

---

## 13. What is still the owner's to decide

1. **The track length** (7). Shorter is more generous; the simulator will show what 7 means at the real pace.
2. **Where the track and the weakness mark go on a Life OS tile** (section 11). Data is specified; the drawing needs approval.
3. **The comeback** (8.1): double XP shown on the tile, or nothing at all.
4. **Coins for removed items** (12.2): bought back at price, as written, or simply dropped.
