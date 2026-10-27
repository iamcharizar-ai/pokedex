# Rules version 16: bonds that travel

In force from **27 Oct 2026** (`V16_START` in `core/rules.ts`), the same day as version 15. Every day before it folds exactly as it did. Why: `GAME-DESIGN-2026-10-27.md`.

Under version 14 a bond only counted for the partner, the partner changed at graduation, and every partner climbed the same five perks. So feeding anyone but the partner was a waste, and graduating (the thing the game is built on) threw the bond away. Version 16 splits the bond in two: perks that are **yours**, and a signature that is **each Pokemon's own**.

## 1. Trainer perks: yours for good
Pickup, Endure, Focus, Best friends and Exp. Share now unlock from your **Trainer bond**: every heart across every Pokemon you own (`TRAINER_LEVELS`: 10, 40, 100, 200, 350). The count never goes down, even if a Pokemon is sent to the Professor. A new partner keeps every perk you have. The partner's own bond still adds +5% to every strike per level, and powers a Mega.

**Past 350 hearts: Trainer stars.** Every 150 hearts after the last level is a star (`STAR_EVERY`). Each star waits in Collect as a choice of two perks to rank up. A perk starts at I and a star takes it up one, to VI (`STAR_MAX` ranks):
- Pickup: +5% find chance
- Endure: back a day sooner, down to every 3 days
- Focus: +3% critical hits
- Best friends: +3% XP
- Exp. Share: +3% shared XP

Left alone, the first side pays itself. With every perk at V, a star pays 25 gems.

## 2. Signatures: each Pokemon plays differently
Each Pokemon has a signature, from its first type, in one of six families (the domain that type stands for, as in a gym's weaknesses):

| Family | Types (signature names) | What it does at strength *s* |
|---|---|---|
| **Power** (gym) | Fighting (Guts), Rock (Sturdy), Ground (Sand Force), Steel (Heavy Metal), Fire (Blaze), Dragon (Rough Skin) | Gym work strikes the leader **+4% × s** |
| **Insight** (code) | Psychic (Forewarn), Electric (Static), Ghost (Frisk) | A code day adds **8 × s** research points |
| **Charm** (guitar) | Fairy (Cute Charm), Normal (Serene Grace), Flying (Keen Eye) | A guitar day takes **6 × s** more HP off the wild Pokemon |
| **Forage** (Arbor) | Grass (Harvest) | An Arbor morning finds a berry **10% × s** of the time |
| **Dream** (sleep) | Dark (Bad Dreams) | A night of 80+ gives **⌈s ÷ 2⌉** of the party a heart each |
| **Flow** (routine) | Water (Swift Swim), Ice (Snow Cloak), Bug (Swarm), Poison (Stench) | Routine habits pay **+5% × s** XP |

- A signature's strength is the Pokemon's own bond level (0 to 5) as **partner**, and half that in the **party**.
- Strengths of one family add up, to at most **10** (`SIG_CAP`). Stacking one family soon stops paying, so a good party mixes them, like building a deck.
- A partner that graduates keeps working from the party.

## 3. Hearts
- The partner earns hearts as before: one for each day with a pillar, plus one for each pillar after the first.
- **New:** a party member earns a heart on any day you did its kind of work, so who stands in the party decides who grows.
- "Did its kind of work" means a pillar of that domain was done. For sleep, a measured night of 80+. For routine, at least half the routine habits.

## 4. Berries: who, and when
- A berry can still go to any Pokemon.
- **New:** it pays **double** on a day you did that Pokemon's kind of work. A berry can be worth keeping for tomorrow's gym day, and worth giving to the party member whose signature you want stronger.
- Every heart also raises your Trainer bond, so no berry is wasted.

## 5. The Mart's battle shelf
The X items came in three strengths for the same price per point, so there was nothing to choose between them. From version 16 the Mart sells one of each: X items at the third strength, and Dire Hit 3, beside Guard Spec, Honey and the Tamato Berry. Items already in the Bag still work.
