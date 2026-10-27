# Rules version 15: the first weeks of play, read back

In force from **27 Oct 2026** (`V15_START` in `core/rules.ts`). Every day before it folds exactly as it did. Why: `AUDIT-2026-10-27.md`, from the real ledger.

## 1. Sleep alone does not make a day
Last night's Sleep counts as a pillar only on a day with another pillar done. On a day with nothing else, the night still pays its XP, but the day has no pillar: the partner can doze, and no heart, research or "day with a pillar" comes from it. The bedtime itself is not checked.

## 2. The party studies too
Party members study for the Professor at half a desk place (`RESEARCH_PARTY`), so research starts while every Pokemon you own is in the party.

## 3. A boss from a party of three
A weekly boss comes once the party is three (`BOSS_MIN_PARTY`). Its strike is still worked out against six, so a small party hits softer.

## 4. Level milestones
Every `MILESTONE_EVERY` (5) levels the partner reaches, Collect holds a choice of two rewards (`milestoneOptions` in `core/economy.ts`), drawn from:
- 3 Great Balls (2 Ultra Balls from level 40),
- a shard in the colour you hold least of,
- a Rare Candy,
- 100 + 4 × level coins,
- 15 gems.

The two are seeded by the milestone, so every device offers the same. A claim names the side chosen (`item` "0" or "1"). Left alone, the first pays itself after `CLAIM_AUTO` days, like any reward.
