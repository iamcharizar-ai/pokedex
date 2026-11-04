// The foundations of UI-AUDIT-2026-11-04 phase 1, on the ?kit page: the object card, the slot in both
// materials, the meter with its today and ghost parts, the one toast, the one close and the motion presets.
// Stand-in numbers only; nothing here reads or writes the game.
import { useState } from 'react'
import { ItemIcon, Coin, Gem } from '../Item.tsx'
import { KButton, KClose } from '../Kit.tsx'
import { Meter } from '../Meter.tsx'
import { MonCard } from '../MonCard.tsx'
import { ObjCard, type Metal } from '../ObjCard.tsx'
import { Slot } from '../Slot.tsx'
import { note } from '../lib/toast.ts'

/** An item on a card: its 24px sprite at 3x. */
const Item = ({ id }: { id: string }) => <ItemIcon id={id} size={72} className="mc-item" />

const WARES: { id: string; cat: string; metal: Metal; price: string; label: string }[] = [
  { id: 'ultra-ball', cat: 'var(--cat-ball)', metal: 'gold', price: '380', label: 'Ultra Ball: you can buy it' },
  { id: 'sitrus-berry', cat: 'var(--cat-berry)', metal: 'silver', price: '150', label: 'Sitrus Berry' },
  { id: 'exp-share', cat: 'var(--cat-held)', metal: 'locked', price: '140', label: 'Exp. Share: not yet' },
  { id: 'rare-candy', cat: 'var(--cat-evo)', metal: 'blue', price: '×2', label: 'Rare Candy, two' },
]

export function Foundations() {
  const [ghost, setGhost] = useState(110)
  const [beat, setBeat] = useState(0)
  return (
    <section className="found" aria-label="Foundations">
      <h2 className="k-type">Foundations</h2>
      <p className="kit-note">The pieces the rework is built from (UI-AUDIT-2026-11-04, phase 1). Nothing on a screen uses the new ones yet; each phase adopts them.</p>

      <div className="kit-grid">
        <div className="found-panel">
          <span className="k-label">Object card: one anatomy for any thing</span>
          <div className="found-cards">
            <MonCard look="full" role="partner" ribbon="Partner" mon={{ form: 'charmeleon', name: 'Charmeleon', level: 23, into: 0.4, hearts: 56, need: 60, type: 'Fire', canFeed: true, sig: { icon: 'charcoal', name: 'Blaze' } }} />
            {WARES.map((w) => (
              <ObjCard key={w.id} look="full" metal={w.metal} tc={w.cat} art={<Item id={w.id} />} aria-label={w.label}
                corners={{ tl: <ItemIcon id={w.id === 'rare-candy' ? 'rare-candy' : 'coin'} size={16} /> }}
                banner={w.metal === 'locked' ? 'Lv 30' : <>{w.id !== 'rare-candy' && <Coin size={14} />} {w.price}</>} />
            ))}
          </div>
          <p className="kit-note">The Pokemon card is this shape filled with a Pokemon. The frame&apos;s metal says the state: gold you can buy it, silver ordinary, grey not yet, blue a reward. The field&apos;s colour says what kind of thing it is.</p>
        </div>

        <div className="found-panel">
          <span className="k-label">Slot: the Bag&apos;s, and the same on the night page</span>
          <div className="slot-grid found-slots">
            <Slot icon={<ItemIcon id="ultra-ball" size={32} />} n="16" tip={{ title: 'Ultra Ball', note: '×16' }} />
            <Slot icon={<ItemIcon id="exp-share" size={32} />} on tip={{ title: 'Exp. Share', note: 'Equipped' }} />
            <Slot icon={<ItemIcon id="big-pearl" size={32} />} n="2" stamp="×2" tip={{ title: 'Big Pearl', note: 'Wanted today' }} />
            <Slot as="span" className="blank" aria-hidden />
          </div>
          <div className="slot-grid found-slots glassrow">
            <Slot material="glass" icon={<ItemIcon id="ultra-ball" size={32} />} n="16" tip={{ title: 'Ultra Ball', note: '×16' }} />
            <Slot material="glass" icon={<ItemIcon id="exp-share" size={32} />} on tip={{ title: 'Exp. Share', note: 'Equipped' }} />
            <Slot material="glass" icon={<ItemIcon id="big-pearl" size={32} />} n="2" stamp="×2" tip={{ title: 'Big Pearl', note: 'Wanted today' }} />
            <Slot material="glass" icon={<Gem size={32} />} n="2.5k" tip={{ title: 'Gems' }} />
          </div>
          <p className="kit-note">A thing is its icon and a number. Stone is the Bag; glass is the same slot for the Collector, Collect and battle prep.</p>
        </div>

        <div className="found-panel">
          <span className="k-label">Meter: today, and what an action would do</span>
          <div className="found-meters">
            <small>A wild Pokemon, and an Ultra Ball held over it</small>
            <Meter kind="hp" value={219} max={1100} ghost={-ghost} name="The wild Pokemon's HP" ghostText={`${ghost} off with an Ultra Ball`} label="219 / 1,100" size="lg" />
            <div className="kit-row"><KButton onClick={() => setGhost(110)}>Ultra Ball</KButton><KButton onClick={() => setGhost(219)}>Master Ball</KButton><KButton onClick={() => setGhost(0)}>None</KButton></div>
            <small>Experience, with today&apos;s part brighter</small>
            <Meter key={beat} kind="xp" value={230} max={486} today={181} name="Experience" label="230 / 486 · +181 today" className="pre-sweep" />
            <small>Hearts to the next bond level, and a berry&apos;s worth ghosted</small>
            <Meter kind="hearts" links={20} value={14} max={20} ghost={5} name="Hearts" ghostText="5 more with a Sitrus Berry" />
            <small>A season step, its rewards as marks</small>
            <Meter kind="gold" value={345} max={1500} marks={[1 / 3, 2 / 3]} name="Season step" size="sm" />
          </div>
        </div>

        <div className="found-panel">
          <span className="k-label">One toast, one close, the motion presets</span>
          <div className="kit-row">
            <KButton onClick={() => note('Lapras moved to place 3.')}>Say a note</KButton>
            <KButton onClick={() => note('The partner stays. Put someone else on the Partner place first.', true)}>Say why not</KButton>
            <KClose label="Close (a sample)" />
          </div>
          <div className="kit-row found-fx" key={beat}>
            <span className="pre-pop"><ItemIcon id="rare-candy" size={48} /></span>
            <b className="pre-stamp k-type">×2</b>
            <span className="found-hint"><ItemIcon id="ultra-ball" size={48} /><span className="pre-hint" style={{ ['--hx1' as string]: '96px', ['--hint-times' as string]: 3 }}><ItemIcon id="ultra-ball" size={48} /></span><i className="found-socket" /></span>
          </div>
          <div className="kit-row"><KButton onClick={() => setBeat((b) => b + 1)}>Play again</KButton><span className="pre-obj found-obj">Hover me: .pre-obj</span></div>
          <p className="kit-note">Pop: something arrived. Stamp: it counts. Hint: a ghost shows what to do, a few times, then stops. With reduced motion, none of them move.</p>
        </div>
      </div>
    </section>
  )
}
