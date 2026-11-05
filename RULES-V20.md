# Rules version 20: the desk counts the day it is set (from 5 Nov 2026)

`V20_START = 2026-11-05`. Days before it fold exactly as they did. The real ledger was replayed with the old and the new core (snapshots on 20 Oct, 1 Nov, 4 Nov and 5 Nov) and came out the same.

Why: `GAME_AUDIT.md`, bugs B2 and B3. You put a Pokemon on the Professor's desk and the research bar did not move.

## 1. A desk set today studies today (B3)
- **Before:** the day's research was added before the day's own actions, so a `study` event counted from the next day with a pillar.
- **Now:** for days from V20, research is added after the day's actions (`core/fold.ts`, `study()`), so the desk as it stands at the end of the day is the one that studied.
- One side effect: a research rank reached today takes its HP off the **next** wild Pokemon, not one that appeared this morning. The wild Pokemon of the day appears before the day's actions, as it always has.

## 2. The fold says whether today studies
- `game.research.counts` is one of:
  - `'pillar'`: today studies;
  - `'sleep'`: only Sleep is done, and Sleep alone is not a day of work (v15);
  - `'none'`: no pillar yet.
- The Lab shows it under the dial: "Today counts: +N research", or "Today doesn't count yet: do Code, Gym or Arbor". The list of pillars follows Life OS, so a shelved kind is left out.

## 3. Auto-fill never empties the desk (B2, not a rule)
- A party place left open is filled after an hour from the box (`boxOf`), never from the desk (`src/lib/party.ts`, `planFill`).
- The fold drops a party member from the desk, so filling from it emptied a jar without a word.
- With only desk Pokemon in the lab, the place stays open.

Tests: `core/v20.test.ts`, and the new case in `tools/party.test.mjs`.
