# Mega Stones, Momentum and the Forge: the overhaul plan

**Status (25 Nov 2026): a plan for the owner to approve. Nothing is built.** It replaces three earlier drafts the owner rejected the same day ("ignite", "stones armed on the altar", "perfect days inside the Momentum bar").
It also answers the open questions in `FORGE-OVERHAUL.md`. Numbers marked * are starting values, to be tuned with the simulator before launch (`GAME-SPEC-V22.md` section 12).

## Build status (25 Nov 2026)

**Built, behind the start day `V23_START` (a 2099 placeholder), so the game plays exactly as before until the owner sets it on deploy day:**
- The Momentum **ladder** (1, 1.02, 1.05, 1.12, 1.21, 1.33, 1.5, 2 for 0 to 7 good days), only from the streak.
- **Stones on the row**: a good day carries a stone once the seven-day count has reached 4; the week's seeded order; "the next stone not already lit"; a stone made later takes the newest good day still owed one, so it stays on the row longest;
  a Mega is a Mega only while its stone's day is on the row; the Mega's types count in the match-up; a Lab Mega is worth x2 to the Lab; the partner is drawn as its Mega.
  The pure logic is `core/v23.ts`; the state is in `core/fold.ts`; `Game` gains `v23`, `row`, `ring` and `megas`.
- The **streak road** past the Battle Tower: Two months (60 good days: 2,000 coins, 60 gems, 2 Rare Candy), A hundred good days (100: 4,000 coins, 120 gems, a Master Ball), Unstoppable (200: 8,000 coins, 250 gems, 5 Rare Candy).
  Correction to an earlier line in this plan: the Battle Tower in the Frontier already pays a Silver Symbol at 14 good days running (20 gems and a Rare Candy) and a Gold Symbol at 35 (50 gems and the Old Sea Map), so these start beyond it.
- **The Momentum row** on Today is the old seven-dot day row again (gold, dim, today's ring, the multiplier), with the stone sprites and today's ghost stone ready for version 23. It is live now, because it needs no rule change.
- The texts that said a Mega is "for good" are version-aware (Today notice, Bag sheet, Forge, rules, the My Pokemon page, the party card's Mega badge).
- 14 new tests (`core/v23.test.ts`), including one that feeds a Charizard to 150 hearts, forges it and follows it through the row, the Lab and the fade; the oracle and the Life OS copy are updated (`npm run core` ran; Life OS type-checks with it).
  With version 23 off, every fixture and the saved real ledger fold exactly as before (checked by fingerprint).

**Not built yet:** setting `V23_START`; the phase 0 look test; the forge (the next focus); the altar art; the Life OS partner strip drawing the row and the ladder; sound; the spec file (`GAME-SPEC-V23.md`); screenshot baselines.

## Forge phase: the owner's requirements (25 Nov 2026)

The full design of the forge (the experience beat by beat, how each effect is built, the assets and the image prompts) is in **`FORGE-EXPERIENCE.md`**.

These are for the next piece of work and are not built:
- **The player places every shard by hand.** Nothing is placed for them (no "Place them all", no auto-fill).
- **Each crevice lights in the colour of the shard placed in its socket.**
- **Each Mega Stone has its own recipe, and the recipes are randomised.** Some want more red, some more green, some more blue, some three of one colour, and some an even mix of all the colours.
  The recipe of a stone is drawn once, from a seed made from the Mega form, so it is fixed for good and the same on every device and on every replay.
- **A Comet Shard is a wildcard**: it can be placed in any socket and stands for any colour the recipe asks for.
- **Settled (25 Nov 2026):** a recipe may ask for the colour of a pillar that is shelved in Life OS, and then that part can only be filled with a Comet Shard. The owner is happy with that: shelving a habit means not working on it in this phase of life, not never again, and the colour is there for when they return.
  So recipes are not limited to live pillars.
- Still to settle then: the colours are red, blue, green and yellow while there are three sockets, so how "an even mix" is read (one of each of three colours, and which three). The forging rule changes, so it goes behind a gate like the rest.

## 1. What the owner asked for (as understood)

1. The **altar is only the forge**: three sockets round the edge take the shards, and the centre socket is where the Mega Stone is made. Nothing else is placed on it.
2. A Mega Evolution is **temporary**, never permanent.
3. **Momentum goes back to the old look**: seven dots, one per real past day, so you can see which days you were on and which off.
4. On a day that counted, the dot **shows a Mega Stone sprite** instead of the plain circle, if you own stones. That Pokemon is a Mega while its dot is on the row, then goes back to normal.
5. The stones appear in a **random order each week**, and the next stone in line is always one that is **not already lit**. With fewer stones than lit days the extra days stay plain gold dots: the streak still counts.
6. **Each good day raises the Momentum multiplier a little** (a ladder, not three steps), and the multiplier **comes only from the streak**. The owner left the numbers to me.
7. **No cap on Megas**, but the pacing must be thought through.
8. **Pacing:** keep the game at the owner's real pace; do not demand more. But **on full throttle (every day perfect) the whole game should be genuinely, hugely rewarding: an unstoppable state.**
   Perfect days are **not** part of the Momentum bar: the bar counts good days only, as it always did.
9. The forge's art is **painterly, in the spirit of Summertime Saga**, made with the owner's image models.

## 2. How things work today (read from the code)

**Momentum** (`core/fold.ts`, `core/legacy/rules.ts`, `src/App.tsx` `Pace`):
- A rolling window over the **last seven days** (not counting today). A day *counts* when you finish **2 pillars** (`PILLARS_FOR_A_DAY`; Sleep alone does not count).
- 3 counted days give x1.2, 5 give x1.35, 6 give x1.5 (`MOMENTUM_WINDOW_STEPS`). It multiplies **the partner's XP only**. It never resets: it slides back as counted days leave the window.
- **The look changed on 4 Nov 2026** (commit `3240cef`). Until then the row was **seven dots, one per real past day, gold if it counted and pink-grey if not, a white ring for today, and a big multiplier** (`.pace-week`: the owner's pasted picture).
  It is now `mo-pips`: pips that fill from the left by the *count* with x-labels, so you cannot see *which* days counted.
- Life OS draws a Momentum strip too (`lifeos/src/components/PartnerStrip.tsx`, the `dex-week` dots and the multiplier), from a copy of `core/` made by `npm run core`.

**Mega** (`core/fold.ts` `forge`, `core/v22.ts` `shareOf`):
- A stone is forged **for one Pokemon** and is permanent: Key Stone + a fully trained Best Friend (150 hearts) + three shards of three colours + 1,500 coins. It doubles that Pokemon's share of party power forever.
- The spec says a Mega also fights as its Mega form's types. **The code does not do this**; this plan makes it true.
- **Dynamax** is a Max day (every listed pillar, three-quarters of the chores): the strike x2 for the day and the partner drawn Dynamaxed. It is separate and stays as it is.

## 3. The owner's real pace (measured, not guessed)

From a read-only replay of the real ledger on 25 Nov 2026 (54 days, 5,432 events; the scratch copy was deleted afterwards):

- **31% of days counted** (17 of 54). The 7-day count averaged **2.3**. Two perfect days (every habit ticked) in 54.
- **On today's steps the owner spends 64% of mornings at x1, 23% at x1.2, 4% at x1.35 and 9% at x1.5**, a mean of **x1.104**. The best week was **6 counted days** (a run of six).
- The recent weeks have been uneven (counted days per week, oldest first: 0, 6, 2, 2): bursts, then quiet. The design has to be kind to that and generous to the bursts.
- **No Mega yet**, but close: a **Charizard at level 37 with 105 of 150 hearts**, the Key Stone held, 2 Comet Shards and a green one, 2,200 coins. So the first stone is a matter of weeks (level 50 and 45 more hearts), not months. Nothing is forged, so nothing needs migrating.

## 4. The new direction: the streak shows its stones

**In one line:** Momentum goes back to its old seven-dot day row, and each good day gives a small bonus. Once the streak is really on, each good day also carries one of your Mega Stones, and that Pokemon is a Mega while its day is on the row.

### 4.1 The row (see the mock-up in the owner's chat)

- **Seven dots, oldest on the left**, one per real day, then **today's ring** and the **multiplier** at the end. A counted day is gold, a missed day the dim pink-grey, a day before the game began faint.
- A counted day **earned while the streak was on** shows a **stone sprite** (24 px, the existing pixel stones) with a soft glow. Otherwise it is the plain gold dot, so a player with no stones sees exactly the old row.
- **Today's ring** shows the next stone in line, ghosted: who joins if today counts (only if today would earn a stone, and a stone is left).
- The row counts **good days only**. Perfect days do not change it (they have their own reward, section 4.5).

### 4.2 The multiplier: a ladder, only from the streak

XP multiplier by the number of counted days among the seven before today (`k`), starting values*:

| k (counted days) | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| Momentum | x1.00 | x1.02 | x1.05 | x1.12 | x1.21 | x1.33 | **x1.50** | **x2.00** |

- **Every good day adds something**, and each day adds more than the last: the streak snowballs.
- **At the owner's real pace it is the same game:** on the real mornings the mean multiplier is **x1.107 against x1.104 today**. The best week (6) is exactly today's top, x1.5.
- **The seventh good day is the leap: x2.** It has not happened yet (the best run is six), so it costs the owner's current pace nothing, and it is the "full throttle" prize.
- The multiplier comes **only from the streak**: Megas do not change it and it does not change them.

### 4.3 When a day gets a stone

A stone goes on a counted day **if the seven-day count, with that day, has reached 4*** ("the streak is on"). The first three good days of a week are plain gold: the warm-up.
Measured on the real days, with stones to spare, a Mega would be on the row on **about 26% of mornings**, two or more on **21%**, three or more on **15%** (mean 0.74 Megas).
A threshold of 3 gives 66% of mornings, which is close to permanent, so **4 is the recommended value**; it is the pacing knob (decision 2).

- **Which stone:** each week the game makes a **random order of your stones** (seeded by the week, so the game stays a pure fold and every replay agrees). A day that earns a stone takes the **next stone in the order that is not already lit**
  and whose Pokemon is not already a Mega, so a Pokemon with two stones is never wasted twice.
- **The assignment is kept:** a dot keeps its stone while it slides left, even across a change of week. Only new days use the new order.
- **No stone left:** the day stays a plain gold dot. The streak and the multiplier still count.
- **A stone forged later** takes the newest good day that earned one and has none, so it is worth something at once and stays on the row as long as it can. (A stone whose day leaves the row moves to the newest owed day in the same way, so with exactly as many stones as lit days they stay Megas.)
- **No cap on Megas.** The thresholds limit them: at most one per counted day (up to seven), never more than you own, and none in a quiet week.

**How a streak plays out** (the owner's own description, confirmed):
- **A cold start:** the first three good days are plain gold. From the **fourth**, each good day carries a stone and its Pokemon becomes a Mega. A first perfect week therefore shows **four Megas on day 7** (days 4 to 7).
- **Holding the streak:** the plain days age out of the left end, and every new good day carries a stone, so the row fills: **seven Megas on the tenth good day in a row** (sooner if the week before was already good).
- **Breaking it:** the stones already lit **stay lit until their day leaves the row**; nothing vanishes at once. Once the count has fallen below 4, new good days are plain gold again until the count climbs back to 4
  (two or three more good days, depending on how many are still in the window; four from scratch).
- **At the top (seven lit, holding the streak):** Momentum stays at x2. The stones keep **moving along the row**: each evening the stone whose day just left is given to today's dot. With exactly seven stones it goes straight back to the same Pokemon, so nothing changes in the game and only the row moves.
  With **more than seven stones** it goes to the next stone in the week's order, so **a different Pokemon becomes a Mega each day** and one goes back to normal.

### 4.4 What a Mega does while it is on the row

One rule: it **doubles its contribution to its own job**.
- **In the party** (the partner or one of the five): its share of party power x2 (`POWER_MEGA_X`), and its Mega types count in the match-up.
- **In the Lab:** its worth x2 in the Lab's strength (a shiny is x1.5), so its research that day is larger.
- **Everywhere:** it is drawn as its Mega form with a glow on Today, its card, the Lab and the Pokedex; the Mega form is recorded in the Pokedex the first time it shows.
- When the day ages out of the row it goes back to normal, one at a time, oldest first. A quiet week puts everyone back. Nothing is lost.

### 4.5 Full throttle: the whole game, measured

The "unstoppable" state is not one number; it is every system stacking. For a full party of level 50 Best Friends (a 15% share each, the partner counted twice), at today's constants:

| Day | Party power | A pillar's hit, summed over the day | XP multiplier |
|---|---|---|---|
| A typical day for the owner: 1 pillar, no Megas | 1.05 | **236** | x1.1 |
| A good day: 2 pillars (x1.25) | 1.05 | 589 | x1.1 |
| **Full throttle**: 4 pillars, a Max day (x2, Dynamax), no Megas | 1.05 | **1,886** (8 times a typical day) | x2 |
| **Full throttle with 4 Megas on the row** | 1.80 | **2,576** (11 times) | x2 |

So the streak adds **about 37% more hits and 82% more XP** on top of what a perfect day already is. Perfect days keep their own big reward (the strike x2 and Dynamax), the streak turns it into something that grows week on week, and the player who is on every
day for a week is plainly in a different state: a full row of Megas, double XP, double strikes.
If the owner wants it even bigger, the knob is the Mega multiplier (x2 now): for example x3 for the seventh good day, tuned in the simulator. Not planned by default.

### 4.6 The real-choice test (`game-design-real-choices`)

- *Which Pokemon do I forge a stone for?* More stones means a Mega on more of your hot days, but never more than the streak earns.
- *Where does it stand?* The same Mega is a fighter in the party or a researcher in the Lab; you choose which job is doubled.
- *Keeping the streak* now pays three ways: XP, Megas, and the leap at seven.
- It passes "a second step must be a different kind of step": befriend (berries), prove the work (shards), save (coins), then keep showing up.

### 4.7 Starting numbers*

| Number | Start |
|---|---|
| Multiplier ladder (k = 0..7) | 1, 1.02, 1.05, 1.12, 1.21, 1.33, 1.50, 2.00 |
| A stone goes on a day once the 7-day count has reached | 4 |
| Mega share multiplier | x2 (the existing `POWER_MEGA_X`) |
| Lab worth multiplier | x2 |
| Forge price | 3 shards + 1,500 coins (unchanged) |

## 5. The Forge (altar): only a forge

The Forge tab is the altar and nothing else is placed on it: **three sockets round the edge for shards, one centre socket where the Mega Stone is made.** No stones are armed, nothing is charged.
Below the altar, a small read-only list of the stones you own (the ones lit right now glow).

### 5.1 The ritual (what you click and see)

1. The altar is dark: every crevice is plain stone. The centre is empty until a Key Stone is held; with it, a faint rune ring breathes.
2. Pick the Pokemon and its Mega form from the row below (as today; a Pokemon with two Megas shows an X and a Y): its silhouette is engraved in the centre socket.
3. Tap a shard on the ring: it flies into a socket. On landing, the gem lights in the shard's colour and **a pulse of that colour runs down that socket's crevice into the centre** and stays lit.
   Each shard rings a higher note (the existing `thud`, raised).
4. Three colours, three arms lit. The third shard makes the arms **merge**: the centre ring ignites in a three-colour sweep, the outer runes chase round, a shockwave goes out, and the silhouette floods with colour.
5. The finished stone rises out of the centre socket, then the Pokemon appears as its Mega (`EvoReveal`, as now), with a line saying how it shows: "it joins your row on a good day once the streak is on".
6. A Comet Shard is prismatic: its arm cycles through all the colours. Placing one or two shards and leaving spends nothing, as now.

### 5.2 How the glow is built (so one set of art does every colour)

The altar is layered, not pre-lit: a dark base picture, with a **mask** for each lit part (the crevices of each arm, the centre ring, the outer rune arcs). Each mask is filled in code with the shard's colour
(CSS `mask-image` plus a moving gradient, so the energy seems to flow, plus a soft outer glow). The shard colours and the prismatic Comet need **no extra art**.
The altar is three-fold symmetric, as both reference pictures are, so **one arm's masks, rotated 0, 120 and 240 degrees, serve all three sockets**. A growing glow is a mask wiped along its path.

## 6. Assets (made with the owner's image models; I write the prompts and process the files)

I cannot call the image models. The workflow: I give you prompts and exact specs; you generate and drop the files in `assets-src/forge/`; I process them (trim, scale, build masks, check alignment) and wire them in.
Nothing is used until it passes a look in the app. The Momentum row needs **no new art**: it uses the 70 pixel stones that already exist.

**Style (decided): painterly, in the spirit of Summertime Saga.** For the prompts: hand-painted cartoon illustration, confident dark outlines, soft cel shading with gentle gradients, saturated candy colours, glossy highlights on gems and stone, slightly exaggerated shapes.
Both reference pictures already sit in this range, so they are the style guide; each prompt will quote them. The one risk is clashing with the pixel sprites: the altar is a hero object on its own tab and the stones in it are shown in a glow, but phase 0 checks this in the app before more is generated.

| # | Asset | Spec | Why |
|---|---|---|---|
| 1 | **Altar, unlit** | top-down, circular, 2048 px square, transparent outside the circle, **strictly three-fold symmetric**, three shard sockets at 12, 4 and 8 o'clock, a larger centre socket, every crevice and rune **dark**, no glow | the base layer |
| 2 | **Altar, lit (white)** | the *same* picture edited so every crevice, ring and rune glows pure white and nothing else changes | the difference between 1 and 2 *is* the mask, exactly aligned. Use edit mode (image-to-image), not a new generation, so the geometry matches |
| 3 | **Gems** x5 | red, blue, green, yellow, Comet (prismatic); 256 px, transparent, painted to match the altar | the shard icons are 24 px pixel art and would look tiny and mismatched on this altar |
| 4 | **Key Stone, large** | 256 px, transparent | the centre crown; a dark hollow when not held |
| 5 | **Tab floor** | seamless dark mossy flagstone, 512 px tile (like the first reference's wall) | the tab's background |
| 6 | *(optional)* **Generic stone orb** | painted, neutral, 256 px; tinted in code | the ceremony's rising stone, if the pixel stone looks wrong at altar scale |

The unlit/lit pair (1 and 2) is the one that matters. If they do not align, the fallback is to draw the glow shapes as SVG paths over the art in code.

## 7. Technical plan

- **Rules.** A new version gated by a start day (`V23_START`, a 2099 placeholder until the owner sets it on deploy day), built in `core/fold.ts` behind `v23On(day)` as v22 was.
  `core/legacy/` is never edited; `core/oracle.test.ts` must fold every fixture identically while v23 is off, and the real ledger must replay unchanged for every day already lived (`v22-live-engine-oracle`).
- **Momentum.** The window and `counts` stay; the multiplier becomes the ladder in 4.2 (from the start day; older days keep the old steps). `momentum.steps` becomes the ladder, so the screens draw from it.
- **Stones on the row.** The fold keeps, for the days on the row, which day got which stone (the stone's form and Pokemon), the weekly order (a seeded shuffle, `rng` keyed by the week) and today's Megas.
  No new events: the existing `forge` event still makes a stone (and behaves as before until the start day). The `Game` object exposes the seven days with `counts` and an optional stone, for the screen.
- **Effects.** `core/v22.ts` `shareOf`: the Mega flag now means "on the row today"; the match-up uses the Mega form's types. Lab strength: worth x2. `game.display` and the card art read today's Megas.
- **Screens.** `Pace` in `src/App.tsx` goes back to one dot per day (the pre-4-Nov markup, with the stone sprites, the ghosted next stone and the new multiplier); `index.css`/`today.css` get the `.pace-week` styling back.
  Rebuild `Forge.tsx` and `forge.css` as the forge-only altar. Small changes to `Team.tsx`/`MonCard` (the Mega glow), `App.tsx` (the Today aura), `Recap.tsx` (the news), the Lab, the Pokedex, `RulesV22.tsx` (the rules text), the feats and `Play.tsx` (the Bag tile shows which stones are lit).
- **Life OS.** Its partner strip draws the same Momentum (`PartnerStrip.tsx`). `npm run core` copies the new rules there and type-checks it; its strip needs the same change (the ladder instead of steps, and the stones if wanted). It is a separate project, so it is a named task in phase 5 and the build there must pass before anything is deployed.
- **Verification.** Fold tests (the ladder at every k; a counted day below the threshold stays plain; one above takes the next unlit stone; no stone left leaves a plain dot; a stone forged later fills the oldest plain day; the week's order is the same on every replay; a day sliding off puts its Pokemon back; the party and Lab effects; the oracle);
  the simulator and the real-ledger replay for the starred numbers (the throwaway scripts used for section 3 will be rewritten as `tools/` files); `npm run core`, `npm test`, both builds; screenshots of every state (fixtures get a Mega-on-the-row state); an accessibility pass (the row and the altar must read correctly to a screen reader); reduced-motion behaviour.

## 8. Build order

0. **A look test.** I put reference picture 4 into the Forge tab with a fake glow built with the mask technique, on a phone-size screen, so the owner can judge the style and the effect before anything else is made. *Done when the owner says it looks right.*
1. **Momentum's old look back** (screens only, no rules): the seven-dot day row with the multiplier, as before 4 Nov. Small and safe, and it can ship straight away if the owner wants the old row back now.
2. **The rules** (core only): the ladder, stones on the row, the weekly order, the effects; tests, simulator, oracle, replay. The start day stays a placeholder.
3. **The row with stones, and the Mega effects on screen:** the sprites on the dots, the ghosted next stone, cards, Today aura, Lab, Pokedex, news.
4. **The forge:** generate and process assets 1 to 4; the ritual.
5. **Polish and launch:** sound, reduced motion, accessibility, performance on a phone (masks), rules text, the spec update (`GAME-SPEC-V23.md`), Life OS, screenshot baselines; then the owner sets the start day on deploy day.

Phases 2 to 4 land behind the placeholder date, so nothing changes for the player until the owner sets it.

## 9. Risks

- **Balance.** Mega frequency and the x2 leap are tuned on 54 days; more data will move them. Mitigation: the starred numbers, the simulator, and a sensible first guess that matches the owner's pace.
- **A burst-and-quiet pace.** The ladder is kind to bursts and gentle in quiet weeks. If a week of six then zero feels harsh, the fade (one Mega a day) is already the mitigation.
- **The leap at seven being rarely seen.** That is deliberate (it is the reward for full throttle), but it means the top of the ladder is untested by real play. Mitigation: simulate perfect weeks, and keep the knob.
- **Sprite size on a small row** (24 px beside 12 px dots). Mitigation: tried on a phone-size screen in phases 1 and 3.
- **Art alignment, style clash and mobile performance** (the forge). Mitigation: the lit/unlit pair method, an SVG fallback, the phase 0 look test, WebP, few layers.
- **Life OS** is a second place that draws Momentum. Mitigation: named in phase 5, built and checked before deploy.

## 10. Decisions

Settled by the owner: Momentum is a ladder from the streak only (my numbers); no cap on Megas; the painterly forge style; perfect days stay out of the bar; the stone is forged for one Pokemon; no existing Megas to migrate;
the stone threshold of 4 (the owner's own description of the rule); the streak milestones come back (my rewards); and the forge requirements above.

Still open:
1. *(Optional)* A **Mega x3 on a full week** if full throttle should feel even bigger. *Recommended: not by default.*
2. *(Optional idea)* A **beaten boss that has a Mega** pays its stone as a rare prize, a second way to get one.
3. When to **set `V23_START`**: the owner's call, on the day it deploys. Until then everything built behaves as before.
