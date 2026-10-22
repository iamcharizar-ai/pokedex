# Rules version 14: every item asks a question

In force from **19 Oct 2026** (`V14_START` in `core/rules.ts`). Every day before it folds exactly as it did.

## The test

An item is only worth keeping if keeping it could be worth more than using it now. It needs at least one of:

- **another use**,
- **a better day** to use it,
- **a better target**,
- **a limit** that forces a choice.

Before version 14, berries, treasures and vitamins on a trained Pokemon failed that test (`AUDIT-2026-10-19.md`). The three roles a Pokemon can have also blurred together.

## 1. The day starts before you wake

After midnight it stays yesterday until the first of these:

- the band's reading of the night,
- **Start my day**,
- the **day's start time**:
  - two hours before your usual wake,
  - "usual wake" is the median of your last 7 measured nights,
  - never before 04:00 or after 07:00,
  - 05:00 until there are 3 nights to go on.

The 14:00 fallback is gone. With your nights, the day starts at about 06:00, so it's already today when you wake.

The Sleep pillar fills in whenever the reading lands. Everything is worked out again from the ledger, so a late reading changes nothing except when you see it (`core/day.ts`).

## 2. Sleep without a reading

A night the band never read can be **reported by hand**:

- It pays as a core habit (30 XP).
- It earns no Bells and doesn't count for the Battle Pike.
- The band's reading replaces it when it comes.

If you don't report it, the night still isn't part of the day, so it's never a miss.

## 3. Items

**Berries are food.** (The bait idea was dropped on 2026-10-22: a throw takes only the ball.)

- **Feed** any Pokemon you own, not only the partner:
  - The partner's bond unlocks its perks.
  - A party member's bond adds 1% to every strike per bond level.
- **Price follows hearts**: within a currency, a berry that costs less never feeds more. Oran 50 coins for 1 heart, Sitrus 150 for 3 (3 marks at the Garden), Tamato 250 for 5, the other friendship berries 5 marks for 5 hearts.
- A Pokemon with all 150 hearts takes no more food, so nothing is wasted.

**The Collector's wanted list.**

- Each day he wants three kinds of treasure and pays **×2** for them.
- The list is the same on every device.
- So a treasure can be worth keeping until its day comes.

**Vitamins count in the party.** A party member's vitamins count at **one third**. The partner's still count in full.

## 4. Three roles for your Pokemon

| Role | Who | What it does |
|---|---|---|
| **Partner** | one | Grows: your work is its XP, its evolutions and its bond perks |
| **Party** | up to 5 more | Fights the gym leaders and the weekly boss |
| **The Professor's lab** | everyone else | Helps you catch and collect |

**Nobody is sold any more.** The Box is the Professor's lab.

**The research desk:**

- The Professor studies up to **3** of your Pokemon on his desk.
- On every day with a pillar, each one adds **(10 + its level) × its rarity weight** to his research. The weights are: common 1, uncommon 1.5, rare 2, legendary 3. A shiny counts half again.
- Rank *n* takes 500 × *n* points.
- **Each rank:**
  - takes **3% more HP off every wild Pokemon** that appears, up to 45%,
  - sends a gift, in rotation: Rare Candy, Honey, Ultra Balls, Full Incense, and a stone on every even rank.
- **Every fifth rank:** a Mystery Egg.
- **Who sits on the desk:** whoever you choose. If you haven't chosen, the Professor takes the most valuable Pokemon outside the party.

**So a strong Pokemon has to pick a side:**

- in the **party**, it hits leaders and the boss harder,
- on the **desk**, wild Pokemon come weaker and gifts come faster.

You have five party places and three desk places, so the choice is real.

## 5. Level 100

- **Fully trained (Lv 50, or Lv 30 for a Pokemon that never evolves) is still the milestone:**
  - its nature is set,
  - it counts toward new regions and as trained for the boss,
  - the next partner steps up.
- **After that it can go on to level 100:**
  - by leading again ("Partner now" works on a fully trained Pokemon), or
  - through the bond's Exp. Share, which now reaches every party member below Lv 100, fully trained ones included.
  - A Rare Candy also works on a fully trained Pokemon.
- At Lv 100 a partner **steps aside on its own**: it has nothing left to learn. The next one comes from the lab.

## 6. The morning sync

- **Life OS opens faster:**
  - It reads the rows that decide the day first: the band's nights and any Start my day.
  - It reads only the newest habit library, not every copy ever saved.
- **`/api/health-check`:**
  - Life OS calls it on this site while Sleep is waiting.
  - It reads Google itself, at most once a minute.
  - It answers either "Google doesn't have last night yet: open Google Health" or "scoring it now", and that line shows on the Sleep row.
