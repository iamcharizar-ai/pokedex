# The Forge, rebuilt: the experience, and the assets it needs

**Status (25 Nov 2026): built behind `V23_START`; this file keeps the design, the prompts and the review.** It follows `MEGA-OVERHAUL-PLAN.md` (section "Forge phase") and replaces the old ritual in `src/screens/Forge.tsx`.
The owner's description of the experience is the spine of this document; section 2 lists the few corrections and additions I made to it, so they can be approved or refused one by one.

## Build status (25 Nov 2026)

**Done:**
- The altar is chosen and saved (`assets-src/forge/altar-unlit.png`: the navy-maze altar from ChatGPT). `python tools/build-altar.py` turns it into `sprites/forge/`: the cut-out altar, the crevice **flow maps** (how far along the winding crevices each point is from its socket, and from the centre), the well masks and `altar.json`.
  The three sockets' basins came out almost exactly equal (the maze is genuinely three-fold symmetric) and every crevice is fed from its nearest socket.
- **The recipe rule** (`core/v23.ts`, behind `V23_START`): each Mega's recipe is drawn once from its name; a Comet fits any place; the fold spends exactly the shards a forge names and refuses ones that are not the recipe. Tested.
- **The state machine** (`src/screens/forge/machine.ts`, pure and tested): choose, place (tap or drop), lift back, commit (the Key Stone), reveal, collect; every refusal has a reason; the beat timings of the sequence and its gentle version.
- **The glow renderer** (`src/screens/forge/glow.ts`, WebGL2): water filling from each socket in its shard's colour (a Comet's cycles through every colour), the bleach to white, the pour toward the centre, and the wells filling and draining. Checked on the real altar in seven states.
- The shards and the Key Stone use the game's own icons, so no art was needed for them.

**Built (25 Nov 2026, second pass):** the Forge screen itself.
- `src/screens/Forge.tsx` is the game's side: it picks the new altar when `game.v23` and keeps the old ritual (`ForgeClassic.tsx`) for the days before; it works out which Mega is Ready / Needs shards / Needs coins / Not trained / Locked / Forged, draws the picker, writes the forge (`useItem(kinds, uid, 'forge', mega)`) and shows the card after the stone is taken.
- `src/screens/forge/Stage.tsx` is the ritual: the recipe tray and the altar with three socket buttons and the centre. **Every shard you hold floats round the altar as its own object, and so does the Key Stone** (`swarm.ts`, tested): they push each other away like magnets of the same pole (a shard you drag is the shard itself, held by the pointer, and the others move out of its way live; there is no ghost left behind), so when one is placed the rest drift apart to fill its place, and one taken back out of a socket pops out and the others make room.
  Tap a floating shard (it flies to the first empty socket) or drag it onto the socket you choose; tap a placed shard to take it back; a **Place all** button puts every shard the recipe still needs in one go; tap the Key Stone, or drag it to the centre, to commit. There is no shelf, no count badge and no Key Stone button.
  A wrong colour is refused with a reason on the line under the altar. A Comet fits any place. A placed shard hovers in its socket (it does not rise out of it).
- During the forge the shards in the sockets sink into the white as the sockets fill with it (they fade to white and are gone before the light drains out); nothing is pulled into the Key Stone any more, only its energy pulses.
- After the forge the Mega Stone hovers over the centre slot (no ring round it); tapping it flies it to the Items tab of the Party menu (the bottom of the screen where there is no menu) and the tab pops, and **the Key Stone stays resting in the centre until you tap it yourself**, when it comes out and floats among the shards again.
- `src/screens/forge/director.ts` owns time: the glow, the sounds, lightning, sparks, rings, rays, cracks, the flash, the shake and the floating shards' movement, all from one loop that rests when nothing moves. `choreo.ts` says what the light does (tested); `fx.ts` draws the effects; `sound.ts` makes every sound from oscillators and noise (behind the game's sound switch; haptics follow it); `look.ts` has the shard colours.
- The sequence is as in section 5. One white flash over the whole screen (about 60 ms up, 80 ms held, 1.2 s to fade) and the shake on `#root` (about 0.45 s). **There is no Skip, and the sequence always plays whole (6.6 s), whatever the device's motion setting says** (`RESPECT_REDUCED_MOTION = false` in `Stage.tsx`; set it true to give the gentle 2.5 s version to a device that asks for less motion). A bug that cut it short, a negative time on the first frame, is fixed and was found by timing the real run (committed to reveal: 6.6 s).
- Checked in a real browser on a virtual clock (16 frames from the commit to the reveal), by tap and by drag, on a 375 px screen, inside the real app with version 23 forced on locally, and with the old forge's lists (where shards and the Key Stone come from) kept under the altar.

**Still to do:** the sprites reach the live site only after `npm run sprites:deploy` (the altar picture and its maps are in `sprites/forge/`); `V23_START` is still the placeholder, set on the owner's deploy day; timings and the strength of the shake are to be tuned on a real phone; sound balance is untested by ear; the Life OS partner strip does not draw the row or the ladder yet; `GAME-SPEC-V23.md` and the screenshot baselines (`npm run shots -- --update`).

## 1. The experience in one paragraph

You choose which Mega to forge, and the three sockets of the altar wait. The stone's **recipe** (for example two Red and one Blue) is shown on a small tray. You place the shards yourself, by tapping them (they fly in and snap) or by dragging them onto a socket.
Each one **snaps in with a spark**, and its colour **pours into the dark crevices like water**, starting at that socket. When all three are in, **the shards lift off their sockets and float**. That is the moment to place the **Key Stone** in the centre.
The instant it clicks home the Forge **destabilises**: lightning crawls over the altar, the sockets and crevices flare to white, then the sockets **drain like water through the crevices into the Key Stone**, which turns white-hot. The floating shards are pulled in after it.
A held breath of silence, a crack of light across the glowing ball, and then **a white flash over the whole screen with a violent shake**. When the white fades, **the Mega Stone floats in the centre**, waiting for you to tap it and take it.

## 2. What I changed or added (approve or refuse each)

1. **The Key Stone is not used up.** It is yours for good (the game says so everywhere), so it cannot be destroyed by the bang. The glowing ball that cracks is the **energy gathered in and around the Key Stone**; when the white clears, the **Mega Stone floats above the Key Stone**, and when you collect the stone the Key Stone lifts out and returns to its dock.
   You still see exactly what you described: a ball of white light that cracks and a stone that appears.
2. **The recipe is visible**, on a tray of three gem outlines above the altar, so you always know what to place. A wrong colour is refused (the socket flashes and the shard drops back). **A Comet Shard fits any outline** and glows with all the colours.
3. **Nothing is spent until the Key Stone is placed.** Placing and lifting back shards is free, at any time, so you can change your mind. Placing the Key Stone is **the commit**: the shards and the 1,500 coins are paid at that instant (coins fly from the counter into the altar),
   the game records it at once, and the sequence is only the show. If you leave mid-way nothing is lost: the stone is already in your Bag.
4. **The shards are consumed on screen.** After the sockets drain, the three floating shards are pulled into the Key Stone one by one. Forging costs them, so we see them go.
5. **Tap or drag, your choice.** Tapping a shard fills the first empty socket (clockwise from the top); dragging puts it in the socket you pick (the valid sockets pulse while you drag). A placed shard can be tapped to lift it back until the commit.
6. **A held breath before the bang.** About a third of a second of total silence and stillness makes the flash hit harder.
7. **The afterglow takes the stone's own colours** (the two main colours of its sprite), so each stone leaves its own mood on the altar as the white fades.
8. **Skip** (a small button, shown from the second time you forge) so the tenth stone is not a six-second wait. **Safety:** one big flash only, no strobing (never more than three flashes a second), and a gentle version for reduced motion (section 7).
9. **A short card after you collect** says what the stone does ("Charizard becomes Mega Charizard X on the days your streak puts this stone on your row") with the Mega form shown.

## 3. The screen

From the top, on a phone (the altar fills the width):
1. **The Mega picker**: a row of the Pokemon that can be forged and their forms (an X and a Y for one with two), each marked Ready, Needs shards or Locked, as now. Only a Ready one can be started; the others say what is missing.
2. **The recipe tray**: three gem outlines in the colours the stone needs; each fills as its shard is placed. Under it, one line: "Two Red and one Blue. A Comet fits any."
3. **The altar** (square, edge to edge): the three sockets, the centre recess, the crevices, the dark stone floor around it.
4. **The shard shelf**: the shards you hold, by colour, with counts. The ones the recipe still needs glow; the others are dim.
5. **The Key Stone dock**: the Key Stone, dark until the shards float, then pulsing; locked with "1,500 coins needed" if you cannot pay.
6. One line of guidance that changes with the step, and below it what was there before: the stones you own, where the next shards come from, and where the Key Stone comes from.

## 4. The steps (the state machine)

| Step | What you see | What you can do | Written to the game |
|---|---|---|---|
| **Idle** | A dormant altar; a faint rune ring breathes; the centre recess is empty | Pick a Ready Mega | nothing |
| **Chosen** | The Pokemon's dark silhouette in the centre; the recipe tray appears; the shelf lights what is needed | Place a shard; pick another Mega (nothing placed yet is kept) | nothing |
| **Placing (1, 2)** | Each placed shard sits in its socket; its colour has filled its crevice and rests there, shimmering | Place more; lift one back; change the Mega (shards return) | nothing |
| **Armed (3 placed)** | The three shards lift off and float; the sockets are hollow; the centre recess glows white; the Key Stone dock pulses | Place the Key Stone; lift a shard back (it returns and the step goes back to Placing) | nothing |
| **Committed** | The sequence (section 5). Taps are ignored (Skip jumps to the end) | Watch | **the forge** (shards and coins spent, the stone made) |
| **Reveal** | The Mega Stone floats in the centre; "Tap the stone" | Tap it | nothing more |
| **Collected** | The stone flies to the Bag; the Key Stone returns to its dock; the card; the altar resets | Go on | nothing |

A reload at any point before Committed starts again at Idle (placed shards were never spent). After Committed the stone is already in the Bag, so a reload simply shows Idle.

## 5. The sequence, beat by beat (about 7 seconds)

| Time | Beat | On screen | Sound and feel |
|---|---|---|---|
| 0.0 | **Commit** | The Key Stone clunks into the centre; a ring shock; coins fly from the counter into the altar | a heavy click; a coin rush; a short haptic tick |
| 0.5 to 2.0 | **Destabilise** | The altar shudders (a pixel, then two). Thin lightning crawls along the crevices and jumps between sockets; the floating shards spin faster, shedding sparks; sockets and crevices bleach from their colours to white, from the sockets inward | a hum that rises; crackles; a rolling haptic |
| 2.0 to 3.2 | **Drain** | Seen from above, each socket is a disc that has lit white over its whole inside; the white now **fades out** until the socket is empty, and as it fades the **crevices turn whiter** until they are completely white | a descending rush |
| 3.2 to 4.2 | **Pour** | The white **flows along the crevices toward the centre**, emptying them behind it, into the Key Stone, which brightens and pulses as each arm arrives | three rising pulses |
| 4.2 to 4.8 | **Absorb** | The three shards streak into the Key Stone one after another (a ring shock each). It becomes a white-hot ball that swells and trembles; hairline cracks of light spread over it; the screen's edges darken | a rising whine |
| 4.8 to 5.2 | **Hold** | Everything stops. One last crack. | **silence** |
| 5.2 | **Bang** | A **full-screen white** in about 60 ms, a shockwave and rays, and a **hard shake of the whole screen** that dies away over about 0.4 s | a boom with a deep thump; a strong haptic burst |
| 5.3 to 6.6 | **Clear** | The white fades out over about 1.2 s. Shards of light fall from the cracked ball. The altar is calm and dark with the afterglow of the stone's colours; the **Mega Stone floats above the Key Stone**, turning slowly in a soft halo; motes drift | a bright chime that fades |
| 6.6 on | **Reveal** | "Tap the stone" with a gentle pulse | |
| on tap | **Collect** | The stone flies in an arc to the Bag button with a sparkle trail; the Key Stone lifts back to its dock; the card; the altar resets | the existing collect sound |

**Timing is the first thing to tune on a real phone.** The beats are separate pieces that can be lengthened or shortened one by one.

## 6. How each effect is built (so the art stays simple)

| Effect | Method | Needs art? |
|---|---|---|
| The altar and its dormant look | A dark base picture | **yes** (asset 1) |
| **Crevices filling like water, from the socket** | A **flow map** made from the art: for every crevice pixel, how far it is along the crevice from its socket. A small shader (WebGL, with a canvas fallback) lights the pixels whose distance is below the fill level, with a bright wet edge at the front and a slow shimmer behind it, in the shard's colour. One map gives the fill, and a second ("distance to the centre") gives the pour into the Key Stone | **yes**: the altar's flat navy crevices give the maps (a lit twin, asset 2, is only a fallback) |
| Sockets lighting and draining | The same shader on the socket wells, seen from above: each is a disc that lights over its whole inside and **fades out** (never a water level), while the crevices whiten | from the altar's own gold rings |
| Lightning | Jagged bolts drawn in code along the crevice paths and between sockets, redrawn a few times a second | no |
| Sparks, motes, shockwave, rays, the cracks on the ball, the coin rush | Particles and shapes in code | no |
| The white flash and the shake | An overlay and a short CSS transform on the whole screen | no |
| The shards | **The game's own shard icons**, scaled up whole numbers of times with hard edges, floating with a bob and a glow made in code | no |
| The Key Stone | **The game's own Key Stone icon**, scaled up the same way, with its glow made in code | no |
| The Mega Stone | **The pixel stone you already have** (all 70), shown large with hard edges inside a painted glow, so the stone is the same object as in your Bag and on your Momentum row | no |
| Sound | Generated in code like the rest of the game's sounds (no audio files): snap, water trickle, float chime, crackle, drain, whine, boom, afterglow | no |
| Haptics | The phone's vibration, where it has one | no |

The maps are built from the shapes themselves (the navy crevices, found by colour, then how far each point is along the network from its socket), so the altar does not have to be symmetric. Performance: the shader runs only while the forge is animating, at a reduced size.

## 7. Reduced motion and safety

- Reduced motion (the system setting, or the app's own switch): no lightning, no shake, no full-screen flash. The white is a soft glow over the altar only; the sequence is about 2.5 seconds and every change is a cross-fade. Sound and haptics follow their own switches.
- At most one large flash, and no light that flickers more than three times a second.
- Everything is reachable without dragging: every shard, socket and the Key Stone is a button; each step is also announced as text (for example "Red shard placed. Two of three.").

## 8. The recipes (the rule side, built after the screen)

- Each Mega form has **one recipe, drawn once from a seed made of the form's name**, so it is fixed for good and the same on every device and replay.
- The kinds, with starting odds*: **three of one colour** (about 1 in 5), **two of one colour and one of another** (about half), **three different colours** (about 3 in 10). The colours are red, blue, green and yellow. A colour from a shelved pillar can appear: that part is then filled with a Comet (the owner's decision).
- A Comet Shard fits any outline. The forge event already carries the three kinds, so the game checks them against the recipe (Comets as wildcards) and spends them. This changes the forging rule, so it goes behind the same start day as the rest (`V23_START`) and is tested like it.
- Today's rule (three shards of three different colours, Comets standing in) stays for the days before.

## 9. The assets (made with the owner's image models)

I cannot call the image models, so: you type the prompts below, pick the best result of each, and save the files in **`assets-src/forge/`** with the names given. I then check them (symmetry, size, edges), build the maps and wire them in.
**Do them in this order.** The altar first (round 1 is reviewed below; prompt 1 is the regeneration); tell me which result you like, and any lit twins must be edits of that one.

| # | File | What | Size | Notes |
|---|---|---|---|---|
| 1 | `altar-unlit.png` | The altar, dark and dormant, with **wide crevices filled with one flat very dark navy** | 2048 x 2048 | the base layer, **on a transparent background**. The navy is what lets me find the crevices from the picture alone (see the round 1 review) |
| 2a | `altar-lit-grooves.png` | *Optional.* The same picture, only the crevices glowing white | same | an **edit** of #1, used only to check my crevice mask (and as a fallback if the navy fill is not clean enough) |
| 2b | `altar-lit-sockets.png` | *Optional.* The same, only the three socket wells glowing white | same | an edit of #1; the wells can be found from their gold rings, so this is a fallback |
| 2c | `altar-lit-centre.png` | *Optional.* The same, only the centre recess glowing white | same | an edit of #1; likewise a fallback |
| 3 | *(not needed)* | The shards are **the game's own shard icons** (red, blue, green, yellow, Comet), shown large with hard pixel edges | | decided 25 Nov 2026: use what is in the inventory |
| 4 | *(not needed)* | The Key Stone is **the game's own Key Stone icon**, shown large with hard pixel edges | | decided 25 Nov 2026 |
| 5 | `floor.png` | A seamless dark flagstone tile for the tab's background | 1024 x 1024 | optional but it makes the tab feel like a place |

The altar is the one thing to generate (and the floor tile, if you want it). I make the sparks, lightning, shockwave, rays, the cracks on the ball, the coin rush, the white flash, the shake and every sound in code, so there is nothing else to generate.

### The prompts (type or paste them as they are; attach the pictures named)

**Style anchor used in all of them:** a hand-painted 2D cartoon illustration in the spirit of the visual-novel game Summertime Saga: confident dark outlines, soft cel shading with gentle gradients, saturated colours, glossy highlights.

### Round 1 review: the two altars from ChatGPT (25 Nov 2026)

Both are saved in `assets-src/forge/candidates/` (A: geometric, B: organic). I measured them and looked at what my code would light (the crevices) on each.

| | A: geometric | B: organic |
|---|---|---|
| Look | crisp labyrinth of angular crevices, a round gold centre; reads as an ancient mechanism | blobby, wobbly crevices and wide dark pools around stone "islands", an octagonal gold centre |
| Crevice width | median **0.67%** of the altar (about 2.4 px on a phone): too thin to read | median 0.75%, with wide pools up to 2%: uneven |
| Finding the crevices from the picture | 161 fragments: their grey is too close to the shadows between stones | 128 fragments: same problem, and the soft edges blur |
| Water-fill potential | **high**: long, winding, branching paths from each socket; the water would travel a long way and read as clearly directed | medium: the pools would flood rather than flow |
| Robustness for edits and masks | high (crisp edges) | low (soft, organic edges) |
| Three-fold symmetry | broadly left-right, not truly three-fold | none |

**My choice: A's design, regenerated.** Its crisp channels give the "water filling a maze" effect the most to work with, and its round centre suits the round Key Stone. B's organic look would flood rather than flow, and its soft edges would make every mask guesswork.
Symmetry is a convenience, not a need (the code computes the flow from the actual shapes), so I will not insist on it.

What to change (the three things that matter, in order):
1. **Wider, simpler crevices**: about three times wider (3% of the altar's diameter) and fewer, so they read on a phone and the water has a clear route.
2. **One flat very dark navy for every crevice**, clearly darker and bluer than anything else. Then I can find the crevices from the picture alone and the lit edits become a fallback.
3. **No dark gaps anywhere else** (between the outer stones, between the decorative stones): light mortar there, so nothing but a crevice looks like one.

Also ask for a **transparent background** if the tool can (B came with one; A had magenta).

**Prompt 1 (regeneration): attach `altar-A-geometric.png` and ask for 4 variations**

> Edit the attached altar picture. Keep its overall design, its hand-painted cartoon style (bold dark outlines, soft cel shading, glossy gold), the three gold-ringed round wells at 12, 4 and 8 o'clock, the round gold-ringed recess in the centre, the weathered flagstone outer ring and the moss. Change these things:
> 1) Redraw the carved crevices so they are about THREE TIMES WIDER (each about 3 percent of the altar's diameter, roughly 40 pixels on a 1254-pixel picture) and much SIMPLER. From each of the three wells ONE main crevice runs inward and branches at most twice, then joins a closed ring-shaped crevice around the centre recess. A second, wide ring-shaped crevice runs round the altar and connects the three wells to each other through three curved arcs. Remove all the thin zigzag channels. Every crevice must be one connected network that touches all three wells and the ring round the centre.
> 2) Fill the inside of EVERY crevice with one perfectly flat, very dark navy colour (#0B1020), with no texture and no highlights. It must be clearly darker and bluer than any other part of the picture.
> 3) The gaps between the stones of the outer ring and between the decorative stones must be light grey mortar, never dark, so that no dark gap anywhere looks like a crevice. The decoration (runes, cracks, moss) stays shallow and painted flat on the stone.
> 4) Make the three arms identical to each other (the same shape turned by 120 degrees) as far as you can.
> 5) Output a PNG with a fully TRANSPARENT background outside the altar (no magenta, no white). No glow, no light, no magic anywhere: everything is dormant.

If the tool cannot edit, use this version instead (it asks for the same thing from scratch; attach `altar-A-geometric.png` as the style guide):

> Use the attached picture as the style and layout guide: a hand-painted 2D cartoon top-down stone forge altar (bold dark outlines, soft cel shading, glossy gold, moss). Create a new picture of the same kind of altar, square 1:1, the altar centred and filling 90 percent of the width, on a fully transparent background. Three identical round gold-ringed wells at 12, 4 and 8 o'clock; one round gold-ringed recess in the centre; a weathered flagstone outer ring with light grey mortar between its stones. WIDE carved crevices (each about 3 percent of the altar's diameter): from each well one main crevice runs inward, branching at most twice, to a closed ring-shaped crevice round the centre recess, and a second wide ring-shaped crevice joins the three wells with three curved arcs, all one connected network. Fill every crevice with one perfectly flat very dark navy (#0B1020), no texture, no highlights, clearly darker and bluer than anything else; no other dark gaps anywhere (use light mortar). The decoration is shallow and flat on the stone. Completely dormant: no glow, no light, no magic. No text, no characters.

**Prompts 2a to 2c (optional lit twins): only if I ask for them after checking your new altar.** They are the same edit prompts as before: attach the chosen altar and ask the tool to make only the crevices (2a), only the three wells (2b) or only the centre recess (2c) glow pure white (#FFFFFF), changing nothing else.

**Prompts 3 and 4 (the gems and the Key Stone) are no longer needed:** the forge uses the game's own shard and Key Stone icons.

**Prompt 5: the floor (optional)**

> Hand-painted 2D cartoon illustration in the spirit of the visual-novel game Summertime Saga: a seamless, tileable top-down texture of dark blue-grey dungeon flagstones with thin cracks and a few small patches of green moss, dark and low contrast so it can sit behind other things. Even lighting, no objects, no text, no vignette. Square 1:1. The left edge must continue seamlessly into the right edge and the top into the bottom.

### What I check when the files arrive

- The altar: the crevices one connected network that touches all three wells and the ring round the centre, at least about 3% of the altar's width, one flat navy that I can pick out with a threshold (I test that first), no other dark gaps, the wells found from their gold rings, a clean transparent edge. Symmetry is welcome but not needed.
- The lit twins, if I ask for them: aligned with the base (the difference between them must show only light), pure white inside, nothing else changed. If an edit drifted, I redo it from the base or trace the crevices as vector paths instead.
- The gems and Key Stone: clean outlines, a clean edge against the magenta, five gems of the same size.

## 10. Build order for the forge

1. **You make the assets** (section 9); I check them. I can already build the pieces that need no art: the state machine (pure and tested), the timeline controller, the lightning and particle code, the sounds, and the shake and flash.
2. **The shader and flow maps** from the altar and its lit twins; the fill, the drain and the pour, tried on a phone-size screen.
3. **The screen**: the picker, the tray, the shelf, the dock, tap and drag, the sequence end to end.
4. **The recipes** in the rules (behind `V23_START`) and their tests.
5. **Polish**: timings on a real phone, the gentle version, Skip, accessibility, sound balance.

## 11. Decisions for the owner

1. The **Key Stone is kept** (the Mega Stone appears above it and it returns to its dock), instead of being destroyed. *Recommended: yes.*
2. **Nothing is spent until the Key Stone is placed**; coins and shards go at that moment. *Recommended: yes.*
3. The recipe is **shown on a tray**, a wrong colour is refused, a Comet fits any outline. *Recommended: yes.*
4. The Mega Stone in the centre is **your existing pixel stone, large, in a painted glow** (not a new painted stone). *Recommended: yes.*
5. A **Skip button** from the second forge on. *Recommended: yes.*
6. How **hard the shake and flash** are (the plan is one big flash and a strong short shake, with the gentle version for reduced motion). *Recommended: as written, tuned on your phone.*

## Light choreography (round 2)

`src/screens/forge/choreo.ts` (`glowAt`, tested in `tools/forge.test.mjs`) is the single place that says what the altar's light does at each moment:

1. **Sockets charge** (commit + destabilise): each socket gains light, slowly then faster (`rise`, exponential), until completely full and white. The crevices are untouched.
2. **Drain**: the socket empties into its crevices. A wave of white runs out along them from the socket (the shader's `uBleach`, measured along each basin's own route):
   near crevices first, far ones slower (`settle`, exponential). What leaves the socket is exactly what the crevices gain. Ends with every crevice white, every socket empty.
3. **Pour**: the crevices empty into the centre, slow then faster (`rise`); **the centre gains exactly what they lose, and has the most when they are empty**.
4. Hold, flash, clear.

Nothing moves in a straight line: charging uses `rise`, spreading/emptying uses `settle`. Socket and centre masks are true circles measured out to each gold ring (`tools/build-altar.py`).
