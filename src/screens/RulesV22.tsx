// How it works, as version 22 plays it (GAME-SPEC-V22.md). Every number is read from the rules, never typed here, so this page cannot drift from the game.
import { BALL_TICKS, FORGE_COINS, FOSSIL_STEPS, HELD_V22, NURSERY_PLACE_COINS, STONE_COINS, STONES_V22, labCost } from '../../core/economy.ts'
import { DAY_COINS, DAY_HIT_MULT, HEART_CAP, LAB_BASE, MOMENTUM_WINDOW_STEPS, PILLAR_HIT, SLIP, SLIP_WILD_TICKS, TRACK_LEN, TRAINER_HEARTS, WEAK_HIT, WILD_STAY, WILD_TICKS, BERRY_FAVOURITE, BERRY_PLAIN, POWER_TRAINER, evolveAt, graduateAt, TIER_XP } from '../../core/rules.ts'
import { Rule } from '../App.tsx'
import { Coin, Gem, ItemIcon } from '../Item.tsx'

const chip = (t: string, sm = true) => <span className={`rule-chip ${sm ? 'sm' : ''}`}>{t}</span>
const icons = (...ids: string[]) => <>{ids.map((id) => <ItemIcon key={id} id={id} size={24} />)}</>

export function RulesV22Body() {
  const steps = MOMENTUM_WINDOW_STEPS.map(([d, m]) => `${d} days ×${m}`).join(', ')
  return (
    <div className="rules">
      <Rule title="Do the day" tone="gold" pic={<>{chip(String(TIER_XP.pillar))}{chip(String(TIER_XP.core))}{chip(String(TIER_XP.standard))}{chip(String(TIER_XP.basic))}</>}>
        Every habit you tick pays XP to your partner: a pillar {TIER_XP.pillar}, a core habit {TIER_XP.core}, the small ones {TIER_XP.standard} or {TIER_XP.basic}. Everything the game does starts from a tick in Life OS.
      </Rule>
      <Rule title="One day, four things" tone="blue" pic={icons('poke-ball', 'iron', 'master-ball')}>
        Every tick trains your partner and takes one HP off the wild Pokemon. Pillars fight the gym leader. The week's card fights the boss. Whatever you do in a day, it is one of these.
      </Rule>
      <Rule title="Pillars and the day's tier" tone="red" pic={<>{chip('1')}{chip('2')}{chip('3')}{chip('Max', false)}</>}>
        An effort pillar is any pillar but Sleep. A good night counts as a pillar only beside one: a night alone pays its own XP and nothing else. The day's tier is the pillars done, 1 to 3. A Max day is every pillar on your list and three-quarters of the chores.
      </Rule>
      <Rule title="The wild Pokemon" tone="red" pic={icons('poke-ball', 'great-ball')}>
        One habit ticked is one HP off, and nothing multiplies it. A common one has {WILD_TICKS.C} HP, an uncommon {WILD_TICKS.U}, a rare {WILD_TICKS.R}, a legendary {WILD_TICKS.L}. Tick everything on a day and it is caught on the spot (and your partner Dynamaxes). It flees after {WILD_STAY.C} days, {WILD_STAY.R} for a rare one.
      </Rule>
      <Rule title="Balls choose a time" tone="red" pic={icons('great-ball', 'quick-ball', 'timer-ball')}>
        A Great Ball takes {BALL_TICKS['great-ball']} HP any day. A Quick Ball takes {BALL_TICKS['quick-ball'].first} on the day the wild Pokemon appears and {BALL_TICKS['quick-ball'].after} after. A Timer Ball takes {BALL_TICKS['timer-ball'].base}, and {BALL_TICKS['timer-ball'].perDay} more for each day it has waited (up to ten). A Master Ball catches anything, and cannot be bought.
      </Rule>
      <Rule title="The gym leader" tone="purple" pic={<>{chip(String(PILLAR_HIT))}{chip(String(WEAK_HIT))}</>}>
        Each pillar you do hits the leader for {PILLAR_HIT}, or {WEAK_HIT} if they are weak to it, times your party's power, times the day's tier (two ×{DAY_HIT_MULT[2]}, three ×{DAY_HIT_MULT[3]}, a Max day ×{DAY_HIT_MULT[4]}). Chores do not hit. Beat all of a league and the next opens; beat every league and they all come back stronger, for ever.
      </Rule>
      <Rule title="Party power" tone="blue" pic={icons('exp-share')}>
        Your partner and up to five more fight together. Each adds its level and its bond, doubled when its type beats the leader's, doubled again with a Mega Stone, and your partner counts twice. Every Trainer level adds {Math.round(POWER_TRAINER * 100)}% on top. It is the one number behind every strike and the boss.
      </Rule>
      <Rule title="Tracks" tone="gold" pic={<>{chip(`${TRACK_LEN}`)}{icons('red-shard', 'rare-egg')}</>}>
        Each pillar has a track of {TRACK_LEN} pips: a day of Code, Arbor or Guitar, a good night beside a pillar, or a routine of your Strong split you have not done on this track yet. A full track is a prize to choose in Collect: that pillar's shard, or its egg. Shards come from nowhere else.
      </Rule>
      <Rule title="Berries" tone="green" pic={icons('hondew-berry', 'kelpsy-berry', 'qualot-berry')}>
        Every pillar you do drops its own berry. Fed to a Pokemon it gives {BERRY_PLAIN} hearts, or {BERRY_FAVOURITE} to the Pokemon that likes it best: the berry of its first type's kind of work. So the pillars you do decide who becomes your Best Friend.
      </Rule>
      <Rule title="Hearts and Best Friends" tone="green" pic={icons('heart-scale')}>
        Hearts belong to one Pokemon, up to {HEART_CAP}, and only go up. Your partner earns one on every day with a pillar. At {HEART_CAP} it is a Best Friend: it can hold a Mega Stone. Each bond level adds to its share of the party's power.
      </Rule>
      <Rule title="A Pokemon's life" tone="blue" pic={icons('poke-ball', 'journal')}>
        Everything you catch goes to the Lab. One is your partner and is the only one that gains XP: it evolves at Lv {evolveAt(3, 1)} and {evolveAt(3, 2)} and is fully trained at {graduateAt(3)}, then the next steps up. Five more stand in the party and fight. Level {graduateAt(3)} is the end: a Rare Candy gives any Pokemon still being raised one level.
      </Rule>
      <Rule title="The Lab" tone="purple" pic={icons('scanner')}>
        Everyone who is not in your party researches. Each pillar you do adds {LAB_BASE} and the Lab's strength: a Pokemon is worth its level, more in its last form, half as much again if shiny. A rank takes {labCost(0)} points, then {labCost(1)}, and so on, and pays a gift: coins, a berry, a Rare Candy, an Incense, a Mystery Egg. There is no last rank.
      </Rule>
      <Rule title="The Trainer" tone="gold" pic={icons('itemfinder', 'guard-spec', 'soothe-bell')}>
        Every {TRAINER_HEARTS} hearts across all your Pokemon is a Trainer level, with no last one: a choice of two gifts and a little more party power for good. On the way: Pickup at 10 hearts, Endure (one empty day a week costs nothing) at {TRAINER_HEARTS}, and +10% XP at {3 * TRAINER_HEARTS}.
      </Rule>
      <Rule title="Mega" tone="purple" pic={icons('red-shard', 'blue-shard', 'green-shard', 'key-stone')}>
        With the Key Stone, a fully trained Best Friend can hold a Mega Stone: three shards of three different colours and {FORGE_COINS.toLocaleString('en-IN')} coins. It doubles that Pokemon's share of the party's power.
      </Rule>
      <Rule title="Eggs and fossils" tone="blue" pic={icons('rare-egg', 'trail-egg', 'helix-fossil')}>
        The Nursery warms what you put in it with the steps your band counts: a track's egg 40,000, a Trail Egg 30,000 (one for every 100,000 steps walked), a Mystery Egg 60,000, a fossil {FOSSIL_STEPS.toLocaleString('en-IN')} to bring it back. A second place costs {NURSERY_PLACE_COINS.toLocaleString('en-IN')} coins.
      </Rule>
      <Rule title="Coins" tone="gold" pic={<><Coin size={24} />{chip(String(DAY_COINS[1]))}{chip(String(DAY_COINS[4]))}</>}>
        A day pays {DAY_COINS[1]} for one pillar, {DAY_COINS[2]} for two, {DAY_COINS[3]} for three and {DAY_COINS[4]} for a Max day. Spend them at the Mart (balls, incense, the {STONES_V22.length} evolution stones at {STONE_COINS}), on a Mega Stone, and on a second Nursery place.
      </Rule>
      <Rule title="Gems" tone="green" pic={<Gem size={24} />}>
        Gems come from things that happen once: a catch, an evolution, a badge, a Champion, a boss, a feat. They buy Rare things: a Mystery Egg, a Rare Candy, the scenes, and eight held items ({Object.keys(HELD_V22).length}), each doing a different job.
      </Rule>
      <Rule title="Pickup" tone="green" pic={icons('itemfinder')}>
        From 10 hearts, on a day with a pillar your partner may find something on the walk: coins, a berry, a ball, a Rare Candy, an evolution stone or a fossil. The further you are in the leagues, the better the finds.
      </Rule>
      <Rule title="Momentum" tone="blue" pic={<>{MOMENTUM_WINDOW_STEPS.map(([, m]) => chip(`×${m}`))}</>}>
        Of the last seven days, {steps} that counted make your XP bigger. A day counts with two pillars, a good night being one of them but never the only one. It slides back a day at a time and never resets. Two days with no pillar and your partner dozes off.
      </Rule>
      <Rule title="The weekly boss" tone="purple" pic={icons('master-ball')}>
        Every Monday a boss comes with a card of tasks sized to your last three weeks: the pillars you do, a task for any you have been skipping, good nights and steady days. The card is its HP. Beat it and it joins you.
      </Rule>
      <Rule title="The Battle Frontier" tone="purple" pic={icons('rainbow-pass', 'relic-statue')}>
        Seven facilities, each a run of one kind of day, and the only streaks in the game: the Tower for days that count, one for each pillar, the Pyramid for Max days. A Silver Symbol and a Gold Symbol pay gems, and a Gold Symbol a Legend key.
      </Rule>
      <Rule title="Legends" tone="gold" pic={icons('red-orb', 'blue-orb', 'soul-dew')}>
        Each Legend key has one deed: a Gold Symbol, or the Champion of a league. Use a key and that legend comes as the next wild Pokemon, caught by your days. Every eighth boss and every twenty-fifth wild Pokemon is a legendary too.
      </Rule>
      <Rule title="Feats" tone="gold" pic={icons('key-stone')}>
        Feats are milestones: a first, a hundred, a year of something. A week running of any kind of work earns the Key Stone. They pay gems and the odd keepsake.
      </Rule>
      <Rule title="Collect" tone="gold" pic={<><Coin size={24} /><Gem size={24} /></>}>
        Every reward waits in Collect until you tap it: the day's pay, a track's prize, a Lab gift, a boss prize, a level milestone, a Trainer level. A choice is yours to make; left alone, each pays itself (a choice pays its first side) after three days, so nothing is lost.
      </Rule>
      <Rule title="An empty day costs" tone="red" pic={<span className="rule-chip">0</span>}>
        A day with nothing ticked is settled two days later, so a late tick still saves it. The leader wins back {SLIP.leader} HP, the wild Pokemon {SLIP_WILD_TICKS}, and a tenth of the XP into your partner's level fades. Nothing finished is ever taken back. Endure forgives one such day a week.
      </Rule>
      <Rule title="A day's list" tone="red" pic={<><span className="rule-dot" /><span className="rule-dot" /><span className="rule-dot" style={{ opacity: 0.3 }} /></>}>
        The game reads the list Life OS shows, at once. A kind of work with no habit left on it (say you shelve Guitar) is shelved here too: its track, its feats and the boss's task for it hide until it is back, and nothing is lost.
      </Rule>
    </div>
  )
}
