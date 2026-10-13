# The health bridge

The bridge reads Google Health, through its `ghealth` command-line tool, into the shared ledger. Nothing else in the workspace talks to Google: the Pokedex and Life OS read the ledger.

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

## Every day

`bridgeun-health.cmd` runs the sync and appends to `bridge\last-run.log`. Two daily tasks call it: 07:30 (last night's sleep and yesterday's final steps) and 21:30 (today's steps, for the egg). Create them once, in PowerShell:

```powershell
$s = 'D:\Ai Projects\Claude Code\pokedexridgeun-health.cmd'
foreach ($t in @(@('LifeOS Health Sync Morning','07:30'), @('LifeOS Health Sync Evening','21:30'))) {
  Register-ScheduledTask -TaskName $t[0] -Force `
    -Action (New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$s`"") `
    -Trigger (New-ScheduledTaskTrigger -Daily -At $t[1]) `
    -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries)
}
```

`-StartWhenAvailable` makes a PC that was off at the time catch up when it wakes. A run reads the last 3 days, so a missed day or two is filled in.

## Setup on a new machine

`ghealth` (built from github.com/Google-Health-API/google-health-cli with Go) needs a Google Cloud project with the Health API enabled and a Desktop OAuth client, then `ghealth setup --scopes activity_and_fitness.readonly,health_metrics_and_measurements.readonly,sleep.readonly`. Only those three read scopes are used. The tokens live in `~/.config/ghealth/`. While the consent screen is in Testing, the Google account must be listed as a test user, and Google expires a Testing app's refresh token after 7 days: if the log says the sign-in expired, run `ghealth auth login` again (or publish the consent screen to production, which is allowed for personal use).

## What the game takes from it

- the **sleep score** (`sleepScore`): a measured night is the Sleep pillar; 80 fills it, 90 pays a second Bell, the boss's sleep task and the sky's weather read it
- **steps** (`steps`): a day of 10,000 pays an Iron mark and a walking feat; steps also warm the Mystery Egg
- **recovery** (`recovery`), shown on Today

`model.ts`, `map.ts` and their tests were moved here from the Vitals repo (which still holds the viewer and the older web sync). `plan.ts` is new: the old PC script wrote the readings but not the scores, which only the web sync did.
