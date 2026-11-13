# The Forge: a full overhaul is planned (to be done later, by Opus)

**Status (13 Nov 2026): planned, not started.** The owner wants the Forge redesigned in full, later, by Opus. Until then the Forge is only
kept working: do not redesign it, retune it or rework its rules in passing. This file is the place to start from when the overhaul begins.

## What was done as groundwork (13 Nov 2026)

- The Forge has a **tab of its own** in Party: **Team, Lab, Items, Forge** (`src/Play.tsx`, `TeamTab`). It used to sit under the Bag
  inside Items. Items is now the Bag and incense. The **Choices** window (which form shows, which branch) moved from Items to the Forge tab, under the altar.
- The Forge also shows **where the Key Stone comes from** (`KeyStoneSource` in `Forge.tsx`: the "A week running" feat and its progress), beside the
  existing "where the next shards come from" list.
- Otherwise nothing about how the Forge works or looks changed. `src/screens/Forge.tsx` and `src/screens/forge.css` are as they were.
- The shard list (`NextShards`) still talks about Strong's old "every third full set" Red Shard; version 22 replaced that with the Gym track. Part of the overhaul.
- `tools/stylediff.mjs` has a `Party:Forge` state so the tab can be captured.

## How the Forge works today (so the overhaul starts from facts)

- **What it makes:** a Mega Stone for one Pokemon, registered on it for good. The ledger event is one `forge` use (`core/fold.ts`, `case 'forge'`).
- **Rules in version 22** (`GAME-SPEC-V22.md` section 6.2, `core/fold.ts`):
  - the Key Stone (a feat: a week running of any kind of work) must be held;
  - the Pokemon must be **fully trained** and a **Best Friend** (hearts at `HEART_CAP`);
  - **three shards of three different colours**; a Comet Shard (one per month-end review in Life OS) fits any socket;
  - **1,500 coins** (`FORGE_COINS`, `core/economy.ts`);
  - a Pokemon with two Megas (X and Y) lets the player choose which: an X takes red, a Y blue or yellow;
  - a forged Mega adds to that Pokemon's share of the party's power.
- **Where shards come from:** a pillar's track (seven pips) pays its shard or its egg, chosen in Collect; a month-end review pays a Comet Shard;
  Strong's Gym track pays a Red Shard.
- **The screen:** an altar with the stone in the middle, three sockets round it, every shard you hold floating on a ring, and below it each
  Pokemon that has a Mega form. Pick one that is ready, tap shards into the sockets; the third lands, the altar lights and `EvoReveal` shows
  the Pokemon becoming its Mega. Placing one or two and walking away spends nothing.
- **Who can be forged:** since 13 Nov 2026 a beaten boss joins as its own form at level 1 (a Gengar, not a Gastly), so a boss can reach its
  Mega like any Pokemon once it is fully trained.

## Open questions for the owner (not decided: ask before building)

- What the overhaul is for: the look and the ritual, the rules (cost, shards, who qualifies), or both.
- Whether the Forge should do more than Megas (it is the only place a shard is ever spent).
- What the tab shows before the Key Stone is held, and with nobody ready.

## Rules for whoever does it

- Version 22 is live and the game is a pure fold of the ledger. A rule change goes in `core/fold.ts` behind `v22On(day)` (or a later date as a
  new gate), never in `core/legacy/`; run `npm run core`, `npm test` and both builds. See the project memory notes on version 22 and
  `GAME-SPEC-V22.md`.
- Keep the Forge's look inside the current design language (objects, not lists; tab strips, not accordions).
