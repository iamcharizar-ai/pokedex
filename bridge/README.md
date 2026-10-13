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

## How it runs

**Automatically, from Google:** the webhook (last section). Nothing on this PC has to be on. There are no scheduled tasks any more.

**By hand, when you want a catch-up** (a missed day, a long gap, or if the webhook is ever down):

```
npm run health -- --days 14
```

`bridge\run-health.cmd` wraps that for a scheduler if you ever want one again (it appends to `bridge\last-run.log`). Running the sync twice is safe: a day that matches the ledger writes nothing.

## Setup on a new machine

`ghealth` (built from github.com/Google-Health-API/google-health-cli with Go) needs a Google Cloud project with the Health API enabled and a Desktop OAuth client, then `ghealth setup --scopes activity_and_fitness.readonly,health_metrics_and_measurements.readonly,sleep.readonly`. Only those three read scopes are used. The tokens live in `~/.config/ghealth/`. The consent screen is published to production (so the sign-in does not expire after 7 days as it does in Testing); its homepage and privacy page are on the Life OS site (`public/privacy.html`). Google shows an "unverified app" warning at sign-in, which is expected for a personal app. If the log ever says the sign-in expired, run `ghealth auth login` again.

## What the game takes from it

- the **sleep score** (`sleepScore`): a measured night is the Sleep pillar; 80 fills it, 90 pays a second Bell, the boss's sleep task and the sky's weather read it
- **steps** (`steps`): a day of 10,000 pays an Iron mark and a walking feat; steps also warm the Mystery Egg
- **recovery** (`recovery`), shown on Today

`model.ts`, `map.ts` and their tests were moved here from the Vitals repo (which still holds the viewer and the older web sync). `plan.ts` is new: the old PC script wrote the readings but not the scores, which only the web sync did.

## Without the PC: the webhook

Google can tell us when a day changes instead of us asking. `server/health-webhook.ts` (built to `api/health-webhook.js`, served at `https://pokedex-theta-swart.vercel.app/api/health-webhook`) receives the notification, checks the shared secret and Google's signature, answers 204, then reads the touched days from the API and writes what is new, the same way `npm run health` does. `npm run health` does the same job by hand; both can run on the same day because a day that matches the ledger writes nothing. Notifications can arrive in bursts, so a burst may write the same row a few times; the game keeps the newest value per field, so nothing is counted twice.

It runs on six Vercel production variables: `WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. If the refresh token is ever replaced (`ghealth auth login`), update `GOOGLE_REFRESH_TOKEN` and redeploy. The function's log says what each notification did.

The subscriber `lifeos-health` (steps, sleep, weight, distance; automatic subscriptions) was created with a separate config folder, because webhook admin needs the `cloud-platform` scope and a token carrying it is refused by the data endpoints:

```
GHEALTH_CONFIG_DIR=~/.config/ghealth-webhooks
ghealth setup --project-id <PROJECT NUMBER> --scopes cloud-platform ...
ghealth webhooks subscribers create --id lifeos-health --endpoint-uri <url> --secret <WEBHOOK_SECRET> --types steps,sleep,weight,distance
```

**Use the project number (815901456800), not the project ID**, in that config: with the ID the API answers 403 "caller does not have permission". The `cloud-platform` grant is only needed for this; revoke it at myaccount.google.com/permissions afterwards.
