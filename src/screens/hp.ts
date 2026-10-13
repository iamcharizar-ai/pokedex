// Where an HP bar changes colour. The only place these numbers are written.
export const HP_MID = 0.5
export const HP_LOW = 0.2
/** Amber at half, red at a fifth. */
export const hpTone = (frac: number): '' | 'mid' | 'low' => (frac <= HP_LOW ? 'low' : frac <= HP_MID ? 'mid' : '')
