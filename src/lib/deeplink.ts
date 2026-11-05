// A link from Life OS: `?open=counter:<pillar>` opens the Shop on that pillar's own shop (its counter, its aim). Read once, at load.
import { isMarkTag, type MarkTag } from '../../core/economy.ts'

const open = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('open')
/** The pillar a Life OS tile asked to open, or null. */
export const OPEN_COUNTER: MarkTag | null = open?.startsWith('counter:') && isMarkTag(open.slice(8)) ? (open.slice(8) as MarkTag) : null
