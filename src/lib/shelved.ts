// What the screens show of a feat when a kind of work is shelved (no habit for it on the Life OS list, version 18).
// One rule, used by every list of feats, so a screen cannot forget it: an unfinished feat about a shelved kind of work
// is hidden; one already earned stays. Put the habit back and it is listed again, with its progress.
import { featDomain, type Feat } from '../../core/economy.ts'
import { isShelved, type Game } from '../../core/fold.ts'

export const featShown = (game: Game, f: Feat): boolean => game.feats.some((x) => x.id === f.id) || !isShelved(game, featDomain(f) ?? '')
