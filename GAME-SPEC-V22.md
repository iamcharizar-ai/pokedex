# Game spec, version 22: one game you can explain

Written 10 Nov 2026 for whoever builds it (Opus or Sonnet). It replaces section 5 of `AUDIT-2026-11-10.md`, with the owner's answers of 10 Nov folded in. Read `AUDIT-2026-11-10.md` sections 2 to 4 first for why each cut is made.

**Revised 12 Nov 2026** with the owner's second round of answers: the wild Pokemon is worn down by ticks alone, the Lab pays rewards for research, the Trainer never runs out of levels, the comeback is cut, coins have more to do. Section 1.1 is the rule that came out of it.

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

> Every tick trains your partner and takes one HP off the wild Pokemon. Pillars fight the gym leader. The week's card fights the boss.

**Your Pokemon**

> One Pokemon is your partner and grows. Five more stand in the party and fight. Everyone else is with the Professor, researching, and the research pays you.

**Your pillars**

> Each pillar done drops its berry. Seven of a pillar earns its prize: its shard or its egg.

**The long game**

> Berries make a Pokemon your Best Friend. Three shards of three colours make a Mega Stone. A fully trained Best Friend can Mega. Beat every league and they all come back stronger.

| What you do | What it moves | Where you see it |
|---|---|---|
| Tick anything | Partner XP, and 1 HP off the wild Pokemon | Life OS card |
| Do a pillar | Gym leader's HP, that pillar's track, a berry, the Lab's research | Life OS card and pillar tile |
| Hit the week's targets | Boss's HP | Life OS card |
| Sleep 80+ on a work day | Counts as a pillar | Sleep tile |
| Walk | The egg or fossil in the Nursery | Pokedex, Today |
| Feed a berry | That Pokemon's hearts, and your Trainer level | Pokedex, Party |

### 1.1 Nothing ever runs out

The owner's rule: no part of the game may be finished. Every system either repeats or has no top. Whoever builds this must keep the table true.

| System | How it goes on |
|---|---|
| Partner | Fully trained at 50, then the next one. There is always another to raise |
| Wild Pokemon | Caught, and another stands there the next morning |
| Gym leaders | Ten leagues, then all of them again one rank stronger, without end (the Rematch) |
| Boss | A new one every Monday |
| Pillar tracks | Seven pips, a prize, and it starts again |
| The Lab | Research ranks have no last rank (5.4) |
| The Trainer | Trainer levels have no last level (section 8) |
| Hearts | Each Pokemon tops out at 150, and there is always another Pokemon |
| The Frontier | The only one with an end (seven Gold Symbols). It is a set of trophies, not a loop, and that is said on its screen |

And everything in the table moves only when something is ticked, slept or walked in Life OS.

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

### 3.3 The wild Pokemon: one tick, one HP

The owner's rule: catching is the simple one. No multipliers, no powers, nothing from the Lab or the party. Fights with numbers belong to the gym leader.

- **Every habit ticked takes 1 HP off the wild Pokemon.** That is the whole rule.
- **Every habit on the list ticked** (a perfect day) catches it on the spot, shiny one time in 10, and the partner Dynamaxes.
- Its HP is a number of ticks, by rarity: common 140*, uncommon 220*, rare 320*, legendary 600*. **These are set in the simulator so that a catch takes the same number of days as it does today** (the catch pace stays; today's medians are in `tools/replay.mjs`). They are fixed numbers per rarity, never scaled by anything.
- A thrown ball takes a fixed number of HP (9.5). That is the only other thing that touches it.
- It flees after 21, 28 or 42 days by rarity. Unchanged.
- **Removed:** the `share^1.5` curve, the day's ball multiplier (Poke, Great, Ultra by share), Max Repel, Quick Claw, the Charm signature, and every research cut to wild HP.

### 3.4 The gym leader

`hit = sum over pillars done of (100, or 150 if the leader is weak to that pillar) × tier × (1 + party power)`

- Tier multiplier: 1 pillar ×1, 2 ×1.25, 3 ×1.5, Max ×2 (as `DAY_HIT_MULT` today). A Max day still draws the partner Dynamaxed.
- Party power: section 5.3. This is the one fight in the game with numbers behind it: type, level, hearts, Mega, the Trainer's level.
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
- The Dojo, Silph Co., the Garden, the Music Hall and the Dream House stay as places, with nothing to buy in them. Each one **is** its pillar's track: seven pips, the prize, and its berry count. Shelved pillars hide theirs (`isShelved`), as now.

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

**Lab → Partner → Party or back to the Lab.**

| Where | Its job | Why you would put it there |
|---|---|---|
| **Partner** (1) | Grows | The only one that gains XP. Evolves at 16 and 36 (25 for a two-stage line), **fully trained at 50** (30 for a line that does not evolve). It also counts double in party power |
| **Party** (5) | Fights | Adds to every hit on the leader and the boss |
| **The Lab** (everyone else) | Researches | Every Pokemon you own that is not in the party is with the Professor, and all of them research. The stronger it is, the more it adds (5.4) |

There is no Box, no desk with seats and no bench. A Pokemon is in exactly one of three places and each place has a job. Everything caught, hatched or revived goes to the Lab at Lv 1 and starts researching at once.

### 5.2 The partner

- **Level 50 is the end.** `MAX_LEVEL` 100 and "lead again" are removed. A fully trained Pokemon cannot be partner again.
- When a partner is fully trained, **the game asks who is next** (a choice waiting in Collect). Until answered, the first party member that is not fully trained steps up, else the oldest in the Lab.
- **Changing partner is free and loses nothing.** XP and hearts stay with each Pokemon. The reasons to change: its type beats the current leader (it counts double), or you want a different one evolved first. The reason not to: the one you set down stops growing.
- **Evolution** is the milestone of training. It happens by level, it can change the Pokemon's type (which changes its match-ups and its favourite berry), and only a final form can Mega. Branching by what you did stays.
- **Rare Candy:** one level for any Pokemon not fully trained (built in 21.1; under this spec the cap is fully trained).
- **Evolution stones** evolve a Lab Pokemon one stage without raising it: a Pokedex entry, and a stronger researcher (5.4). Keep the ten stones, cut the sixteen other evolution items.
- **Everstone** stays.

### 5.3 Party power: the one fighting number

For each of the six (partner and five):

`share = (level ÷ 5)% + 1% for each heart level it has` (so a Lv 50 Best Friend is 15%)*

- **Doubled if its type beats the foe's** (the leader's type, or the boss's).
- **Doubled again if it holds a Mega Stone.**
- **The partner's share counts twice.**

Party power is the sum of the six, **plus 2%* for every Trainer level** (section 8).

A Lv 1 Pokemon adds almost nothing, which is honest: the party is worth what you have raised. Finishing a partner no longer costs anything, because it keeps adding its share from the party.

This is the only place level, hearts, type, Mega and the Trainer's level touch a fight.

### 5.4 The Lab: research that pays

The owner's design, kept whole: everyone outside the party researches, a stronger Pokemon researches more, and research pays rewards. It never touches a wild Pokemon's HP.

**The Lab's strength** is the sum of what each Lab Pokemon is worth:

`worth = its level, + 10* if it is in its final form, × 1.5 if it is shiny`

So a freshly caught Lv 1 is worth 1, and a fully trained, fully evolved one is worth 60. Catching many helps a little. Raising one helps a lot. Both count, as the owner asked.

**A day's research** is earned only by work:

`research = pillars done × (20* + the Lab's strength)`

No effort pillar, no research. More pillars, more research. The 20 means the Lab works from day one with nobody in it.

**Ranks have no end.** Rank `n` costs `400 + 100 × n`* points. Each rank pays a find, in a cycle the screen shows in advance, so you can see what the next three ranks bring:

| Rank | Pays |
|---|---|
| 1st of every five | 200* coins |
| 2nd | A berry of your choice (any of the six) |
| 3rd | A Rare Candy |
| 4th | An Incense (choose the next wild Pokemon from three) |
| 5th | A Mystery Egg |
| every 10th, on top | A Comet Shard, and a find from the next region's list of evolution stones and fossils |

The Comet every tenth rank is the one long-game exception to "shards come from tracks": it is the wildcard, it is rare, and it gives the Lab a prize worth chasing.

**Why this holds together, as a player:**

- **Party or Lab is a real choice for every strong Pokemon.** In the party a Lv 50 adds 10 to 15% to your fights. In the Lab it adds 60 to every pillar's research. You have five party places and want your best in both.
- **Nobody is useless.** Every catch, every hatch, every revived fossil makes the Lab a little stronger for good. This answers "what are my other Pokemon doing".
- **Rare Candy and evolution stones get a second use.** Spent on a Lab Pokemon they raise its worth, which is the only way to strengthen one without making it the partner.
- **It loops.** Ranks cost more as they go, and the Lab grows as you catch and raise, so it keeps paying at a steady pace for ever.

**Removed:** the three-seat desk, the desk bonus by rarity, research cutting wild HP, Insight, "the party studies", rank rewards of gems.

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
- **Mega Stone:** three shards of three different colours **and 1,500* coins**, forged at the Forge (unchanged altar). A Comet stands in for a missing colour.
- **Who can hold one:** a fully trained Best Friend whose form has a Mega. X or Y is chosen at the Forge.
- **What it does:** doubles that Pokemon's party share, and it fights as its Mega form's types.

So the chain is: train it (XP), befriend it (berries, which come from pillars), do every pillar (shards), and pay the Forge (coins, which come from showing up). Each link is a different kind of act. That is the diversity the owner asked for.

---

## 7. Eggs, fossils and the Nursery (one place for everything walked)

Steps do one thing: they fill whatever is in the Nursery. One thing is in it at a time (two once the second place is bought, 9.1), and which one goes in is your choice.

| Goes in the Nursery | From | Steps |
|---|---|---|
| Pillar egg | A full track (4.1) | 40,000 |
| Trail Egg | Every 100,000 steps walked | 30,000 |
| Mystery Egg | Rare things shop, for gems | 60,000 |
| **Fossil** | Pickup, or a Lab rank | **20,000*** |

**Fossils are no longer bought and then paid for again.** A fossil is found by Pickup and revived by walking: it goes in the Nursery like an egg. No Battle Points, no 150 coins, no Lab counter. It competes with eggs for the one Nursery place, which is a real choice.

---

## 8. The Trainer: a level with no top

**Trainer hearts** are every heart across every Pokemon you own, and the total never goes down. A Pokemon stops at 150, but there is always another Pokemon, so the total has no ceiling.

**Every 100* Trainer hearts is a Trainer level.** There is no last level. Each one pays three things:

1. **+2%* party power, for good** (5.3). This is the "constantly making my stuff stronger" the owner asked for: it is small, it is permanent, and it comes only from bonding, which comes only from berries, which come only from pillars.
2. **A choice of two** from: two Rare Candies, a Mystery Egg, 400* coins, an Incense.
3. On the way, three one-time **perks**:

| Trainer hearts | Perk |
|---|---|
| 10 | **Pickup**: on a work day the partner may find something (9.3) |
| 100 (level 1) | **Endure**: one empty day a week costs nothing |
| 300 (level 3) | **Close bond**: +10% XP |

Beside the level, the Trainer card counts **Best Friends** (Pokemon at 150 hearts, each with its Ribbon). Reaching 150 on one Pokemon is not the end of anything: it is 1.5 Trainer levels, a Ribbon, and a Pokemon that can now hold a Mega Stone. Then the berries go to the next one.

**Removed:** the neglect bounty, any comeback bonus (the owner cut it on 12 Nov: a pillar pays the same whenever it is done), Sharing, Focus, Exp. Share, Trainer stars, Ribbon rewards every 150 hearts.

The boss card still keeps a neglected pillar on it with a small target (version 21, the owner's rule). That is the game's one nudge towards a pillar you have been skipping, and it is visible.

---

## 9. Money, shops and the Bag

### 9.1 Two currencies, each with enough to do

| | Earned by | Spent on |
|---|---|---|
| **Coins** (everyday) | The day (3.6), Pickup, level milestones, Lab ranks, Trainer levels | The Mart, the Forge's fee, the second Nursery place |
| **Gems** (rare) | Things that happen once or rarely: a catch 3, a shiny 20, an evolution 10, fully trained 15, a gym 10, Elite Four 15, a league 25, a boss 20, a feat, a Frontier Symbol | Rare things |

Battle Points, the BP Exchange, the Collector and the fossil Lab counter are removed.

**What coins are for.** With the marks shops and the junk gone, coins need real uses or they pile up. Four, each a different kind of spend:

1. **Balls** (9.5): the everyday spend. Coins turn into a faster catch.
2. **Evolution stones**: 600* each. Coins turn into a Pokedex entry and a stronger Lab.
3. **The Forge's fee: 1,500* coins to forge a Mega Stone**, on top of the three shards (6.2). The owner's idea. Shards prove the pillars; coins are the months of showing up. This is the big thing to save for.
4. **A second Nursery place: 5,000* coins, once.** Two things warm at the same time. A long-term goal that makes walking worth twice as much.

### 9.2 Two shops

**The Mart (coins):** Great Ball, Quick Ball, Timer Ball, Incense, the ten evolution stones. Always in stock, no daily deals.

**Rare things (gems):** Mystery Egg, Rare Candy, the three scenes, and the held items of 9.4.

Prices are for the simulator (section 12). The rule for setting them: **a bigger or stronger thing is never the worse buy**, and no two things on a shelf do the same job. The simulator must also show that at the real pace **something is affordable every week and the Forge's fee takes about as long to save as three shards take to earn**.

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

HP here is in ticks, the same unit as 3.3. Great (10* HP, any day), Quick (20* on the day it appears, 5* after), Timer (3*, and 3* more a day it has waited, up to ten days), Master (earned, never sold, catches anything). A ball is worth a fixed number of ticks and nothing multiplies it. The other ten are removed.

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
| `game.lab` `{ rank, points, need, strength, next: string[] }` and `game.trainer` `{ hearts, level, toNext }` | Shown in the Pokedex; Life OS needs them only for news ("Research rank 12", "Trainer level 4") |
| `game.tracks[tag]` `{ pips, of, ready, berries }` | Each pillar tile: how far its track is, and a prize waiting |
| `game.today.tier`, `pillarsDone`, `counts` | "One more pillar makes today count" |
| `game.weakToday: Tag[]` | Which pillar hits the current leader hardest, marked on that tile |

**On the pillar tile itself, and with no words** (the owner's decision, 12 Nov):

- **The track** is seven small pips on the tile, filled as the track fills. A full track glows until its prize is collected.
- **The weakness mark** is the current gym leader's badge, small, in a corner of the tile whose pillar that leader is weak to. No label, no number.

Nothing else is added to a tile. The leader's weakness on a tile is the single most useful thing Life OS can show: it turns the league into a reason to pick one pillar over another today.

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
| The egg in the Nursery, trail steps | Unchanged |
| Boss of the week | Unchanged |
| Marks of a pillar | Pips on its track: 1 pip for every 3 marks*, at most 6 |
| Kit pieces held | Kept: they are the Gym track's pips (duplicates dropped) |
| Shards, Comet Shards, Key Stone | Unchanged |
| Coins, gems | Unchanged |
| Battle Points | 2 gems each* |
| Mastery levels | 5 gems a level* |
| Research rank and points | The rank is kept and counts on from there; points start at 0 |
| Berries of removed kinds | 1 pillar-less berry each: converted to Tamato |
| Removed balls | Great Balls, one for one |
| Removed held items, TMs, vitamins, X items, guards, lures, treasures, plates | Bought back: their coin or gem price, or the Collector's price |
| Fossils, evolution stones, Rare Candy, eggs, incense | Unchanged (lures become Incense) |
| Frontier runs and Symbols | Unchanged; the Pyramid's count carries over |
| Feats won | Stay won |
| The research desk and the Box | Gone: everyone not in the party is in the Lab |
| Wild Pokemon's HP | Rescaled to ticks: the same share of the new maximum is left |

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
- days to catch a common, uncommon and rare Pokemon, against today's (`tools/replay.mjs` on the real ledger): they must match within a day;
- Lab ranks a month and Trainer levels a month, in month 1 and in month 6: both must still be arriving in month 6, about one Lab rank a week and one Trainer level a month at the real pace;
- coins earned and spent a month, and the weeks it takes to save the Forge's fee.

Then set the starred numbers. Targets: at the owner's real pace (about 1 effort pillar a day) a first track fills inside three weeks, a first Mega inside three months, and a week never passes with nothing visible happening.

### 12.5 Order of work

Each step ships on its own and leaves the game working.

1. **Freeze and migrate** (12.1, 12.2) with v22 rules equal to today's. Proves the split changes nothing. No visible change.
2. **Words and the day** (sections 2, 3): tier, one tick one HP, the leader's hit, party power, coins.
3. **Tracks and berries** (section 4), with the track pages in place of the marks shops.
4. **The Pokemon's life** (sections 5, 6, 8): level cap, who is next, the Lab, hearts, Trainer levels, Mega.
5. **Shops, Bag, Nursery fossils** (sections 7, 9).
6. **The long road** (section 10): Rematch pay, Champions' keys, Frontier, feats, Collect.
7. **Life OS fields** (section 11), then the screens, then the rule book rewritten from this file.

Run `npm test`, `npm run core`, and both builds at every step. Every memory rule still applies: the catch formula is untouched, shelved pillars hide and never delete, the look of the screens is kept, rules start on the deploy day.

---

## 13. Decided, and what is left

**Decided by the owner (10 and 12 Nov):** berries are bond, never bait. Momentum is the seven dots. Sleep is a pillar only beside another. The track is 7. The wild Pokemon loses 1 HP a tick and nothing else touches it. The Lab pays rewards for research and everyone outside the party researches. No comeback bonus. Removed items are bought back in coins. The track and the weakness mark go on the pillar tile, drawn, with no text. Forging a Mega Stone costs coins as well as shards.

**Left for the simulator, not for the owner:** every number marked *.

**Left for the owner, when it is drawn:** the look of the pips and the badge on a Life OS tile, before it ships.
