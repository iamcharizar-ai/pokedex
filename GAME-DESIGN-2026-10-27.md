# Game design review, 27 Oct 2026: bond, berries and the partner

You asked three questions about bond perks. All three point at real flaws, and the same test turns up a few more.

**Built the same day as version 16 (A, B and C below): `RULES-V16.md`.** It also cut the Mart's battle shelf to one of each kind. Still open: momentum, the gem shelf, and the fix for the research change.

## How it works today (from the code)

- **Hearts belong to each Pokemon** and are kept for good. You get one heart for each pillar day as partner (more in v13), plus whatever berries add. Bond levels are at 10, 30, 60, 100 and 150 hearts.
- **The five perks only work for the partner.** They are Pickup, Endure, Focus, Best friends and Exp. Share, and they are the same for every Pokemon. The partner also adds +5% to every strike per bond level.
- **In the party, bond is nearly worthless.** It adds +1% per level.
- **The partner changes by itself.** A Pokemon is fully trained at Lv 50 (Lv 30 for a single stage), and the next one from the Box takes over with 0 hearts. Your Charmander is Lv 26 after 25 days, so a partner lasts about 55 days. At about 2 hearts a day, it reaches bond 3 or 4 just before it steps aside.

## Your questions, answered

**1. "If I have a berry, why would I not use it on my partner right away?"**
You wouldn't, and that's the flaw. A berry has one use. On the partner it moves you toward a perk plus 5% a level. On anyone else it's worth 1% a level. Keeping it is never better, and giving it to someone else is almost never better. That's a choice with one answer, which is exactly what version 14 tried to remove.

**2. "Why would I ever want to change my partner?"**
You wouldn't, and the game makes you do it anyway. Training is what moves the game forward: a fully trained Pokemon steps aside so the next one can grow. But all of the bond's value leaves with the old partner. So the system punishes the progress it's built on, and choosing "Lead" yourself is never worth it.

**3. "If every Pokemon has the same perks, isn't it boring?"**
Yes. Each new partner climbs the same ladder of five perks, and loses them at the end. It's a reset, not a new challenge. Nothing about *which* Pokemon you raise changes how the game plays.

## The proposed overhaul: bonds that travel

Three parts, each answering one question.

### A. Trainer perks: earned once, kept for good
The five perks today (Pickup, Endure, Focus, Best friends, Exp. Share) stop being the partner's. They become **yours**, unlocked by the **total hearts across every Pokemon you own** (a "Trainer bond"). A new partner no longer means starting again. Raising more Pokemon, and caring for them, keeps moving you forward.

### B. Signature perks: each Pokemon plays differently
Each Pokemon's own bond unlocks a **signature perk** from its type, tied to the domain that type stands for (the same mapping as gym weaknesses):

| Type family | Domain | Signature (one idea each) |
|---|---|---|
| Fighting, Rock, Ground, Steel, Fire, Dragon | Gym | A gym day strikes harder, more at each bond level |
| Psychic, Electric, Ghost | Code | A code day adds a Machine Part |
| Fairy, Normal, Flying | Guitar | Woodshed clean plays count double for the Palace |
| Grass | Arbor | An Arbor morning finds something on the walk |
| Dark | Sleep | A night of 80+ adds a heart to the whole party |
| Water, Ice, Bug, Poison | Routine | Routine habits pay more XP |

- **As partner**, the signature works in full.
- **In the party**, it works at half strength. Your party becomes a deck you build, a little like Clash Royale: which five signatures do you want behind you this month?
- A fully trained partner stepping aside **keeps working from the party**. Graduation is a gain, not a loss.

### C. Berries: a real choice
Once party members have signatures, *who* gets the berry matters:
- the partner (faster to its next signature level),
- a party member whose signature you want stronger,
- or the Box Pokemon you're about to raise next.

One more twist that adds "a better day to use it": a berry fed on a day you did that Pokemon's domain counts double. Then it can be worth keeping a berry until tomorrow's gym day.

## Other places with the same flaw

1. **Momentum is a tease.** It needs 7 out of 7 days with two pillars for ×1.5, and you play in bursts, so your data never got there. Proposal: momentum slides back one step per missed day instead of being recounted from the last 7, so a good week isn't erased by one bad day.
2. **Money piles up with nothing to want.** You had 38 gems, 19 BP and 19 marks unspent. Milestones and the Forge help. A gem shelf with real trade-offs (reroll the wild Pokemon, swap a signature perk, a second held-item slot) would finish the job.
3. **My own version 15 change weakened a choice.** Party members now study at half a desk place, so with a big collection the desk-versus-party choice matters less. Once you own more than six Pokemon, the half-rate study should stop.
4. **Too many small percentages.** Level, team, bond, mastery, nature, vitamins and held items each add 1 to 5% to a strike. You can't feel any of them. Signatures (B) are a chance to replace several small numbers with a few you can see.

## Suggested order
1. **A + B together** (Trainer perks and signatures). This is the core of your questions, and it changes how graduation feels.
2. **C** (berries), which falls out of B almost for free.
3. Momentum, then the gem shelf, then the fix for my own research change.

All of it would be version 16, dated from the day it ships, with earlier days unchanged as usual.
