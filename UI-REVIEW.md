# The UI, reviewed and rebuilt

Written 14 Oct 2026. The first overhaul (UI-OVERHAUL.md) fixed the structure: five tabs with one job each, sheets, one overlay queue, tokens and layers. It did not fix the look. This is a review of what was wrong with the look, and what replaced it.

## What was wrong

1. **Everything was a window.** Each section was a `Win`: a cream frame, a coloured title strip with outlined text, and a dark quilted body. Inside it sat more framed tiles. A pillar, a shop item, a Forge row, a Pokedex cell, a step on a road and a quest were all the same bordered box, so nothing stood out from anything else. That is the "AI boxes" feeling: one shape used for every job.
2. **Chunky meant nothing.** Things you press (buttons) and things you only read (a quest, a feat, a road step) had the same 3-pixel black outline and hard drop shadow. You could not tell at a glance what was tappable.
3. **No hero on any tab.** Today had a fine scene, but under it everything had the same weight. Party opened on an empty egg window and a definition list (Met / Type / Next / Line / Bond). The partner, the thing the whole game is about, was a table.
4. **Moments that should feel like a ritual were lists.** The Forge was a row per Mega with a "Forge" button: a form, not a forge.
5. **Text did the explaining.** Paragraphs under the bond, the Mart, the Forge and the shards said what a picture could show. Every shop card carried its full description, so the shelf was a wall of grey text with a big green button under each item.
6. **Desktop was a stretched phone.** At 1,200 pixels wide, Today was one long column with the pillars spread across the full width.
7. **Overlays had their own third look.** The help window and the news window were the old cream panels with a stack of bordered cards.

## The rules the rebuild follows

- **Content stands on the page.** A section is a heading (a small diamond in the section's colour, the title, a note at the right) and its content under it. No frame.
- **Only what you press is an object.** Buttons, sockets, shards, chips and drawers have depth. Rows of information have a hairline between them and nothing else.
- **One hero per tab,** and colour that means something. A leader, a boss and a Pokedex entry glow in their type's colour. A kind of work has one colour everywhere: code blue, gym red, guitar orange, Arbor green, sleep violet.
- **Show, then say.** Rings fill and sockets light up; a description lives in a sheet you open when you want it.
- All new CSS is in the `screens` layer, one file per tab (`src/screens/*.css`), reading the tokens in `styles/tokens.css`. 149 rules for the replaced screens were deleted with `tools/css-unused.mjs --fix`.

## What changed, tab by tab

**The frame.** A night ground with light pooled at the top instead of diagonal stripes. The top bar is glass. The tab bar is a floating dock where each tab is named, and the open one is lifted and lit. Sheets are the same dark glass as the page, not cream.

**Today.** The scene is a stage with rounded corners. Under it, the partner's line and a single bar to a perfect day. The pillars are **rings that fill in their own colour**, with the mark that kind of work pays in the middle; a finished one is solid with a tick. Momentum and "XP to evolve" are two numbers side by side. Throwing and feeding are a **belt of round sockets** (the ball, how many are left, how much it takes off), and a thrown ball now arcs from its socket onto the wild Pokemon wherever the two are on screen. The leader and the boss are **portrait cards** against their type's colour. On a wide screen the page has two columns: the scene and the day on the left, everything you act on at the right.

**Party.** The partner is the **hero**: large, on a plinth, against its type's colour, with its level, its line (where it came from and the forms it may become, by what you have done most), and its bond as hearts with a Feed button. The separate Bond window is gone. The party is **six platforms**, the partner's lit gold; the fully trained Pokemon not in it are a **bench** you scroll. The Box and the bench are sprites standing on their shadows, not framed cards.

**The Forge is a ritual now.** An altar: the stone in the middle (or the chosen Mega waiting in it as a silhouette), **three empty sockets around it**, and every shard you hold **floating on an outer ring**, colour by colour. Pick a Pokemon below the altar; the shards that fit it start to glow. Tap them one at a time: each lifts off the ring, flies into the next socket and slams home. The third lights the beams from the sockets to the stone, the stone charges, and the evolution reveal plays the Mega. Nothing is written until the third shard lands: switch to another Pokemon halfway and the shards go back to the ring. "Place them all" is there for when you just want it done. Without the Key Stone, the altar is drawn cold and grey, so the goal is still in view.

**Shop.** Goods stand on **wooden shelves** whose planks join into one shelf per row, each with a **paper price tag** hanging under it (green when owned, red when sold for the day). What an item does is in its **sheet**: tap it, read it, buy it there, with the reason it cannot be bought yet if it can't. A domain shop's mastery is a row of pips with one Train button; its TMs are on the same kind of shelf.

**Pokedex.** The region's completion is a **ring** next to its name. Filters are one segmented control (All, Caught, Seen, Not seen; Caught is new). The grid is **one flat grid of sprites** with no box round each, a small ball beside the ones you caught. An entry opens as a sheet. **There is no banded "001 to 036" fold** (see the note below).

**Journey.** Roads are **trails**: a thin line with a node for each stop, a tick on the ones behind you, and only the stop you are on lit. Quests, feats, bosses and the Hall of Fame are rows with hairlines. The calendar's days are soft squares without outlines. Two columns on a wide screen.

**Sheets and windows.** The leader card, the boss fight (its tasks are rows now), Collect (each reward is a row with a "Collect" pill instead of a bright yellow block), a Pokemon's page (its facts as a row of numbers, not four tiles), the help window (the rules as a readable list) and the news window are all on the page's dark glass.

## Checked

- `npm test`: 112 pass.
- `npm run a11y -- --strict`: no tap target under 44 pixels, nothing unnamed, under every fixture.
- `npm run shots -- --update` took new baselines (every picture changed, on purpose), and a second run is 26 of 26 identical.
- The Forge was played in a real browser on the `boss` fixture: three red shards into Alakazam, the altar lit, the reveal played, the ledger got one `forge` event, three shards left the Bag, and Alakazam shows as forged.
- Heights on a phone (`tests/heights.txt`): Today about 1,550, Party 2,050 to 2,300, Shop 1,000 to 1,200, Journey 2,400 to 2,650, Pokedex about 3,740 (one region's grid).

## A note on the Pokedex fold

The screenshot with "001 to 036 · 2 seen · 2 yours" bands is not in this repository: no commit on any branch has it, and the shop text in the other screenshot ("Three deals a day, and a few things always on the shelf") is also newer than anything here. That work is on your machine and was never pushed. This rebuild started from `master`, where the Pokedex was already one flat grid, and keeps it that way. If you push the local work later, the bands will come back in a merge: drop them then.
