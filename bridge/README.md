# The health bridge

Google Health, through its `ghealth` command-line tool, into the shared ledger. Nothing else in the workspace talks to Google: the Pokedex and Life OS read the ledger.

```
ghealth  ->  bridge/sync.mjs  ->  ledger (`vitals` events)  ->  Pokedex, Life OS
              map.ts: Google's shapes -> a day's readings
              model.ts + plan.ts: the sleep score and recovery, worked out once, here
```

## Run it

```
npm run health -- --dry-run     print what would be written (needs only ghealth)
npm run health                  last 3 days into the ledger
npm run health -- --days 14     a longer catch-up
```

Needs `ghealth` on PATH (or `GHEALTH_BIN`), already set up with `ghealth setup`, and `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` here or one folder up.

It is safe to run twice: a day whose numbers match the ledger writes nothing.

## Every morning

A scheduled task on the PC (Windows Task Scheduler; tick "Run task as soon as possible after a scheduled start is missed", so a PC that was off at 07:30 catches up when it wakes):

- Program: `cmd.exe`
- Arguments: `/c cd /d "D:\Ai Projects\Claude Code\pokedex" && npm run health >> bridge\last-run.log 2>&1`
- Trigger: daily, 07:30 (the band has synced to the phone by then)

## What the game takes from it

- the **sleep score** (`sleepScore`): a measured night is the Sleep pillar; 80 fills it, 90 pays a second Bell, the boss's sleep task and the sky's weather read it
- **steps** (`steps`): a day of 10,000 pays an Iron mark and a walking feat; steps also warm the Mystery Egg
- **recovery** (`recovery`), shown on Today

`model.ts`, `map.ts` and their tests were moved here from the Vitals repo (which still holds the viewer and the older web sync). `plan.ts` is new: the old PC script wrote the readings but not the scores, which only the web sync did.
