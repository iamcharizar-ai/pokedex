# Motion audit: the animation study, applied

Written 13 Oct 2026. Source: `clash-royale-study/animation-study/` (the spec, and its motion kit). What is taken from it is **choreography only**: timings, easing, the order of beats, the idea of a reward as a state machine. Every sprite, colour, word and sound here is ours.

Status key: **done** = built and in the app · **boss** = built with the weekly boss · **next** = not built, worth doing · **no** = looked at and left out.

## 1. What the study says, in five lines

1. **Fades are linear and short (133 ms); moves are eased.** Nothing lingers.
2. **Punch is three tricks:** overshoot and settle, an additive colour flash that fades to nothing, and a scale stamp (arrive big, land small).
3. **Rewards are state machines:** appear, **wait for the tap**, burst, show. The wait is the point; it is what makes it yours.
4. **Rarity changes the layers, not the timing:** the better the thing, the more glow, lift and build-up, on the same beats.
5. **Combat feel is squash, stretch and a tiny recoil:** a 4-unit knock in 83 ms reads as a hit.

## 2. Where each recipe went

| Recipe from the study | Where it is in the Pokedex | Status |
|---|---|---|
| Motion kit (`motion.js`), tokens and easings | `src/lib/motion.js` with types, wrapped by `src/lib/fx.ts` | done |
| **Claim breathing** (up 617 ms, down 517 ms) | The Collect chips and "Tap to open" buttons (`.breathe`) | done |
| **Toast** (pop on an arc in 333 ms, hold, shrink out in 150 ms) | Level-ups and a fled Pokemon (`Toasts.tsx`) | done |
| **Reward state machine** (popup, idle, play, end) | `Capsule` in `Reveal.tsx`: chests now open when *you* tap them | done |
| **Wait for the tap** | Big and rare news in the Recap window waits to be opened; ordinary news still plays by itself | done |
| **"Evolution unlocked" popup** (dimmer, sunburst, bloom, card slam, title, shine) | `EvoReveal`: the old form charges white, the bloom covers the swap, the new form slams in | done |
| **Shard slam** (4× to 1× in 400 ms, magenta flash, frame pulse) | Forging a Mega Stone: three shards slam into the Key Stone, then it pulses and throws a ring | done |
| **Deploy drop** (falls narrow, lands flat, rebounds, 567 ms) | The partner as Home opens; a new wild Pokemon as it appears (the long version for a legendary) | done |
| **Hit recoil** (4 units, 83 ms, 11% stretch) | The wild Pokemon when the day's ticks land; the leader when the strike lands, with a floating number | done |
| **Title stamp** (1.6 to 0.9 in 167 ms with a flash) | "GOTCHA!" on a catch, "PERFECT DAY" on a perfect day | done |
| **Confetti** | A shiny catch, a perfect day, rare news opened | done |
| **Upgrade pop** (1, 1.2, 0.94) | Buying something on a shop shelf | done |
| **Battle-start pop** (0.54, 1.25, 0.75, 1) | A tab icon when you choose its tab | done |
| **Rewards grow with the amount** (bag, chest, cart) | Collect chips: coin, big nugget, loot sack at 100 and 250 coins | done |
| **Blurred popup backdrop** | Recap and capsule windows blur the game behind them | done |
| **Shock ring** | A catch, a forge | done |
| **Fly to where it is kept** (ours, not from the study) | Collected rewards fly to the coin pill, the gem pill or the Bag tab | done |
| **Rarity layers** (glow colour, lift, build-up) | Capsule glow by rarity; boss reveals by rarity | boss |
| **Battle intro and "FIGHT" stamp** | The boss appearing on Monday | boss |
| **Health bar variants and segments** | The boss's five-segment HP bar | boss |
| **Three-throw state machine** | Throwing at the boss: shake, shake, click or break out | boss |
| **Card flip** (scaleX 1, 0.22, 1) | Not used: nothing in the game is face-down yet | next |
| **Mystery box with three spins and an upgrade chance** | Would suit the Rare shop's chest becoming a spin | next |
| **Trophy-road node states** (locked, unlocked, collect, collected) | Feats and the season ladder are lists today, not a road | next |
| **Level-up banner** | Levels are a toast; a full banner at evolution levels only would be right | next |
| **Status tints** (heal, poison, rage) | Nothing in the game has a status | no |
| **Projectiles, spell radii, unit run cycles** | There is no arena | no |

## 3. Things found while doing it, fixed

- **Chests opened without being opened.** Buying one changed a number. It now pops up, waits, and bursts when you tap it, and what it held flies to where it is kept.
- **Every piece of news played at you.** A badge or a Mega was over before you looked. Big and rare news now waits for a tap.
- **Evolution had no moment of its own.** It used the same box as a catch. It now has the staged popup.
- **Nothing on the Home scene reacted.** HP bars moved, sprites did not. The wild Pokemon and the leader now flinch, and the partner is sent out.
- **A forge was a button.** It is now three shards going into the stone.
- **Two unused keyframes** left by the earlier claim work were removed.

## 4. Worth doing next (not built)

Ordered by how much it would add.

1. **A road for the season and the feats.** The study's trophy road is four node states and a toast. The season ladder (a step every 1,500 XP) and the feats would read far better as a road you walk than as lists, with the next node breathing.
2. **A level-up banner at the levels that matter.** A toast is right for most levels; the level before an evolution, and the level of a graduation, deserve the banner with the icon pop (0.1, 1.48, 0.7, 1.09).
3. **The egg as a capsule.** A hatch is in the Recap window today. It should be the egg on screen, cracking over its last day, and tapped open.
4. **A spin for the Rare shop's chest.** Three quick spins with a visible chance to upgrade, as the study's mystery box does, instead of a fixed roll. This is a rules change as well as a screen.
5. **Sound on the beats.** The kit has the beats labelled. A rising tone on a chain of collects, a thud on the slam, a click on a catch.
6. **Life OS.** The same kit would give the checklist the tick a little stamp, the Sunday panel a claim button, and the month review a capsule for its Comet Shard. Life OS already has the fly-to-bar; the rest is small.

## 5. Rules kept

- **Reduced motion is honoured everywhere.** The kit and `fx.ts` do nothing when it is on; the screens show their end state.
- **Nothing flashes faster than three times a second.**
- **Only transform, opacity and filter are animated,** so nothing here costs layout.
- **Everything shown was already earned.** These are the telling. Skipping, closing or never seeing one changes nothing in the game.
- **No art, sprites, fonts or sound from the study's source** are in this repo, and none should be added.
