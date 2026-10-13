# Pokedex

The progression layer for Life OS. It shows one partner that levels up and evolves from the work ticked in Life OS, the queue waiting behind it, and the collection of everything raised so far.

Nothing is earned here and nothing is stored: the game is recomputed from the shared event ledger every time. The full explanation of the system is in the Life OS repo, `docs/GUIDE.md`.

## Layout

- `core/` is the game, shared with Life OS: `rules.ts` (every number), `facts.ts` (habits and ticks into a list of days), `fold.ts` (days into partner, queue, collection, badges), `species.ts` (generated table).
- `src/` is this site: `lib/ingest.ts` turns ledger events into what the core needs, `lib/store.ts` reads the ledger, `App.tsx` draws it.
- `public/sprites/` holds the sprites in use. Life OS loads them from this site by address.
- `tools/build-species.mjs` regenerates `core/species.ts` and copies sprites from an unpacked sprite archive.
- `tools/build-core.mjs` copies `core/` into Life OS.
- `tools/replay.mjs` replays an exported ledger through the game.

## Commands

```
npm run dev       # needs VITE_SUPABASE_DISABLE=1 or a stand-in ledger: never test on the real one
npm test          # the rules, as tests
npm run core      # after any change to core/
npm run species -- <sprites folder>
```

## Settings

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: the same ledger Life OS uses. Without them the site shows an empty game.

## Sprites

The sprite files are third-party artwork and are not covered by this repo's code. Keep this repo private.
