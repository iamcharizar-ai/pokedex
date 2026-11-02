# Rules version 18: the game follows Life OS

In force from **2 Nov 2026** (`V18_START` in `core/rules.ts`), the day it shipped. Every day before it folds exactly as it did.

Why: the Woodshed was put on a shelf in Life OS (too much on the routine), but the game still had a Music Hall shop, Woodshed feats, a Battle Palace and a Woodshed task on every boss card, none of which the player could do. The game had the five pillars hard-wired. From now on it reads which kinds of work are on the Life OS list and shows only those.

## 1. Shelved
A kind of work (code, gym, guitar, Arbor, sleep) is **shelved** when no habit on today's Life OS list stands for it. The list is the one the game already counts (version 17: the latest list written for the day), and a habit stands for the kind in its domain (the `domain` set in Life OS, else its id: `woodshed-guitar` is guitar). Sleep also counts while the band reports a night, even with the hand habit retired.

- Archive or delete the habit in Life OS and the kind is shelved at once. Put it back and it returns.
- An empty list (nothing loaded yet) shelves nothing, so a slow sync never hides anything.
- `game.shelved` carries the list; `isShelved(game, tag)` is the one question the screens ask.

## 2. What goes out of sight (nothing is deleted)
- **The shop** for that kind's marks (Music Hall for guitar). The marks you hold stay in the Bag (labelled "shelved") and the Marks tab says they are kept.
- **Unfinished feats** of that kind (the runs, the 100 days, and the Woodshed's "parts owned"; Strong's workout feats for gym). A feat already earned stays.
- **The Battle Frontier facility** for that kind (the Palace for guitar), unless both its Symbols were already won.
- **X items** of that kind: off the Mart's battle shelf and out of Battle prep (any in the Bag stay).
- The kind's **strike chip**, its **weak chip** on a gym leader, and its **signature** line ("Resting: Guitar is off your Life OS list").
- **The boss's task** for that kind (below).

Nothing in the fold changes for these: purchases, feats and runs replay exactly as before.

## 3. The boss
- A shelved kind has **no task on the card**. The other tasks share its HP in proportion (Gym 30 : Arbor 25 : Sleep 15 : Life 10 becomes 37.5 : 31 : 19 : 12.5), and the progress is cut to match. The kill still needs every task that is on the card.
- A card already drawn with that task has it taken off when the list changes. It is judged on the week's last day so far (Sunday once the week is over), for the **whole week**: judging day by day would shift every share in mid-week and heal the boss for work already done. A week that has closed keeps the card it was judged on.
- New cards are drawn without it.

## 4. The same boss every week
With one region open the pool held one rare line (Dratini), so it came back every Monday. From version 18:
- a pool of fewer than **6** rare lines open is topped up with uncommon ones;
- a boss never repeats **one of the last 3**, nor a line already in your party;
- the card carries a **revision** (`rev: 2`). A card of a higher revision replaces an older one for the same week; the first of a revision still stands, so two devices cannot redraw each other.
- The week version 18 began had been drawn by the old planner. It is drawn once more (never as the same boss), whatever has been done on it: the work is measured from the raw events, so it carries over to the new card.

A boss that is not beaten or caught still leaves at the end of its week and costs nothing (that is the design). The boss tile now says how last week ended.

## Seeing it
`?fixture=boss&shelve=guitar` opens the boss fixture with Guitar archived from today.
