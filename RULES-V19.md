# Rules version 19: eggs (from 4 Nov 2026)

`V19_START = 2026-11-04`. Days before it fold exactly as they did; an egg put in the Nursery before it keeps its old size.

## Why: the egg audit

Replaying the real ledger (3 to 22 Oct, 12 days with a band reading) and the live game on 4 Nov:

- **Walking was never the bottleneck.** The band averaged 10,274 steps a day; with the old cut at 10,000 a day the egg saw 7,700 a day, so a 50,000 egg took about 6.5 days. 123,000 steps were walked in 12 days (two and a half eggs' worth) and most of them warmed nothing, because there was no egg.
- **Getting an egg was.** There were three ways in, all desk work, none of them walking:
  - a **boss kill**: the whole card, every task, 95% of the HP; last week's Dragonite left at 99%, and a day of one pillar does not get there;
  - **research rank 5, 10, 15…**: 500 × (rank + 1) points to climb, so about 7,500 points to the first one; the Lab is at rank 0;
  - the **Rare shop, 150 gems**: about 3 gems a day, so one egg every seven weeks.
- With about one pillar a day (the real pace on 22 Oct) that is roughly one egg in two months. So the game design, not the play, made eggs rare: the one activity that hatches an egg could not find one.

## The rules

| Egg | Hatches | Steps | How you get it |
|---|---|---|---|
| Mystery Egg | a rare Pokemon | 60,000 (was 50,000) | a boss kill, every fifth research rank, 150 gems (unchanged) |
| Trail Egg | an uncommon Pokemon with 10 hearts already | 30,000 | **found by walking**: one for every 100,000 steps from 4 Nov |
| Code, Gym, Guitar, Arbor, Sleep Egg | an uncommon (or three in ten a rare) Pokemon of that work's types | 40,000 | **10 of that work's marks** at its shop |

- **No daily cut.** Every step the band counts warms the egg (it was cut at 10,000 a day). A day with no reading still adds nothing. The cut still applies to days before V19.
- **Old Charm** takes a fifth off every egg (a Mystery Egg 48,000, a Trail Egg 24,000, a work egg 32,000).
- **One egg is warmed at a time.** A lone kind goes in at once, as before. With two kinds waiting nothing goes in by itself: the player chooses (`warm`), from the Nursery. The egg put in counts from the next day. Eggs not chosen wait in the Bag.
- Trail Eggs wait in Collect like the other finds, and they come from all the steps, so the same walk can find one and warm another.
- A shelved kind of work hides its egg with its shop (V18).

Egg sizes by kind are in `EGG_KINDS` (core/economy.ts); an egg's size is fixed by the day it was put in (`eggNeed`), so a refold never changes a hatch that already happened.

## On the screens

- The Nursery moved from the Party tab to **Today**.
- The Bag also holds the **Frontier Symbols** (a Symbols pocket) and **Battle Points** (in Money and marks).
- The "Last 14 nights" strip is gone from Last night.
