// Loaded before anything else (it is the first import in main.tsx).
//
// When the page is opened with ?fixture=<name>, this keeps the fixture apart
// from the real game on this device: everything the app remembers locally
// (which news it has told, the device id, the sound setting) is read and
// written under a `fx.<name>.` prefix instead of its real key. So looking at a
// fixture never marks real news as told, and closing it leaves no trace.
//
// The ledger itself is switched off in lib/store.ts, so nothing is fetched or sent.
import { fixture, type Fixture } from './fixtures.ts'

const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search)
/** The fixture this page was opened with, or null for the real game. */
export const FIXTURE: Fixture | null = fixture(params.get('fixture'), params.get('band'))

/** What the app keeps per device about what it has already told. */
const TOLD = ['pokedex.seen.v1', 'pokedex.toasted.v1', 'pokedex.opened.v1', 'pokedex.hatched.v1']

if (FIXTURE && typeof Storage !== 'undefined') {
  const prefix = `fx.${FIXTURE.name}.`
  const { getItem, setItem, removeItem } = Storage.prototype
  Storage.prototype.getItem = function (key: string) { return getItem.call(this, prefix + key) }
  Storage.prototype.setItem = function (key: string, value: string) { setItem.call(this, prefix + key, value) }
  Storage.prototype.removeItem = function (key: string) { removeItem.call(this, prefix + key) }
  // Without &news a fixture opens quietly, like a first run (which tells nothing: history is not news),
  // so a screen can be looked at or photographed with no window over it.
  // With &news everything recent is told again on every load: the record is emptied, not removed,
  // because a missing record is what the app takes for a first run.
  for (const key of TOLD) { if (params.has('news')) localStorage.setItem(key, '[]'); else localStorage.removeItem(key) }
}
