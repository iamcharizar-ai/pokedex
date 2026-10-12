# A complete UI overhaul: the plan

Written 13 Oct 2026. **A plan, not a build.** It comes from reading the Pokedex end to end (about 1,370 lines of CSS in five files, a 1,070-line `App.tsx`, five tabs) and from the motion study. Nothing here changes the game's rules.

## 1. What is wrong with the UI today

1. **Two visual systems at once.** `index.css` is the original cream-window game (`--lbl`, `--gold`); `kit.css` and `skin.css` are the newer dark Clash-style one (`--k-*`). `skin.css` repaints the old classes, `economy.css` and `motion.css` add more on top. A change has to be made in two or three places, and the cascade order decides who wins.
2. **Home is one long scroll.** Scene, notices, the talk bubble, next-up, boss, egg, actions, leader, momentum, sleep, quests: eleven blocks, most below the fold. The day's one question ("what do I do next?") is answered by three of them in three places.
3. **Five tabs hold nine ideas.** "Team" is the party, the bond, the bag and the Box. "Trainer" is a stats card, the season, bosses, feats, work and the adventure log. Nobody searching for their coins finds the Bag under Team.
4. **Two card designs.** `MonCard` (older) and `KCard` (the kit's frame by stage) both exist; only the kit page uses the better one.
5. **Windows, not sheets.** Item pages and popups are centred modals, which are the hardest thing to reach with a thumb on a phone, and the app is used on a phone.
6. **The Pokedex grid draws a whole region at once** (up to about 150 cells, each an animated GIF), and the sprite files are loaded one by one.
7. **Only dark.** A bright room, a large-text setting and a high-contrast need are unserved.
8. **No empty states except one.** A new device, or a reset ledger, is a screen of zeros.
9. **The preview cannot show the game.** An empty ledger shows no collect strip, no boss, no chest. Every screen I have built since the claim had to be tested by calling pieces by hand.

## 2. The overhaul, in the order it should happen

### Phase 0: a fixture ledger (small, and the key to everything after)
`?fixture=<name>` loads a canned ledger instead of the network: `week` (a normal week with quests and a chest), `boss` (party of six, a boss at 35% HP, a Master Ball in the Bag), `late` (a hundred days, Megas, shiny, full feats), `empty`. Then every screen can be shown, screenshotted and diffed. Add a Playwright run that opens each tab under each fixture and compares screenshots. **Every later phase leans on this.** (About half a day.)

### Phase 1: one token layer and cascade layers
- `tokens.css`: a single palette with dark and light values, a 4-pixel spacing scale, three radii, three elevations, one type scale (display, title, body, label, number), and motion tokens that mirror `motion.js` (`--t-pop: 250ms`, `--ease-out`, ...).
- `@layer reset, tokens, kit, screens, motion;` so order is decided once and `skin.css` stops fighting `index.css`.
- Delete the old cream-window skin once every screen is on the kit's pieces (`KPanel`, `KRibbon`, `KBar`, `KCard`, `KButton`).
- Result: five overlapping files become one tokens file, one kit file and a small file per screen, with the 112-rule cleanup done earlier as the model.

### Phase 2: the screens, rebuilt on the kit
- **Home becomes "Today".** One screen, no scroll for the main question: the scene; under it a row of three tiles (**Next up**, **Boss**, **Collect**); then an accordion for the rest (momentum, sleep, quests, leader). The Collect strip becomes a badge on the top bar that opens a bottom sheet, so unclaimed rewards are one tap from anywhere.
- **Team becomes "Party".** Partner, the five, the bond card. The Bag and the Box get their own tab.
- **Shop** stays one shop at a time, adds an "I can afford" toggle and a search, and shows what each shelf item does at a glance (the stat it moves) instead of a paragraph.
- **Dex** keeps its region pages, and gets a completion ring, a search, and still sprites in the grid with the animated one only on the detail page.
- **Trainer becomes "Journey".** The season road, the feats road, bosses, the 28-day card and the adventure log, as one scroll of roads rather than six windows.
- Every Pokemon is a `KCard`. `MonCard` is deleted.

### Phase 3: how it is held
- **Bottom sheets** instead of centred modals for item pages, the Box, the throw and Collect, draggable down to close, so the thumb never reaches the top.
- **Swipe between tabs**, with the bar following.
- **Haptics** (`navigator.vibrate`) on a collect, a hit, a catch and a level banner, off with sound.
- **A top HUD with a level ring** around the partner's face, coin and gem pills that show the change as it lands, and a Collect badge with a count.

### Phase 4: the scene
The Home scene is the game's face and is currently two sprites on a flat sky. Layered parallax (sky, far hills, near ground), a sky that follows the real clock and the weather the sleep score implies (a good night is clear), the partner idling and turning to look at what the wild Pokemon does, and a tap on the partner that makes it react (no reward, just life). This is the highest "feels alive" return and the most taste-dependent, so it comes after the structure is settled.

### Phase 5: readable data
- Replace the XP bars-per-day with a **calendar heat map** of the last 12 weeks (each cell a day, brighter for more pillars, a ring for a perfect day, a dot for a boss week).
- Momentum as seven pips with the bonus on the end.
- Leader and boss HP bars share one component with the same segment marks.

### Phase 6: for everyone
- **Light theme, large text, high contrast**, picked in the help window and remembered. Tokens make this a values change, not a rewrite.
- **A first-run tour** of five cards (what Life OS is, what a tick does, the partner, collect, the boss) and **empty states** for every list.
- **Accessibility pass:** every tap target 44 pixels or more, every motion has a non-motion equivalent (a label or a colour), focus rings checked on each screen, live regions for claims and news.
- **Performance:** split the code per tab, one sprite sheet for item icons, cache the fold by day boundary, stop GIFs off screen.

### Phase 7: Life OS gets the same kit
Today the two apps share a core and nothing else. Share the tokens and motion kit the same way the core is shared (copy script into `src/ui-kit/`). Life OS gets: a stamp on a tick, the claim-button breathing on the month review and the Sunday panel (started), a streak flame, and the partner strip using the Pokedex's top-bar pieces.

## 3. What I would not do

- **A rewrite in another framework or a game engine.** The game is a spreadsheet of events with a face. React is enough; the cost is in design and testing, not in rendering.
- **Re-skin by hand per screen without Phase 0.** That is how the two visual systems happened.
- **More currencies, more tabs or more windows.** The overhaul should leave the game with fewer places to look, not more.
- **Anything that copies art or sound** from the study. The kit is choreography; the look stays ours.

## 4. Size and risk

| Phase | Effort | Risk | Why it is in this order |
|---|---|---|---|
| 0 Fixtures and screenshot tests | half a day | low | nothing else can be checked without it |
| 1 Tokens and layers | 1 session | medium (visual drift) | stops the two skins fighting; screenshots catch drift |
| 2 Screens on the kit | 3 sessions | medium | the structural win: Home and the tab layout |
| 3 Sheets, swipe, haptics, HUD | 1 session | low | reach and feel |
| 4 The scene | 1 to 2 sessions | taste | after the structure is stable |
| 5 Data views | 1 session | low | |
| 6 Themes, tour, a11y, perf | 2 sessions | low | |
| 7 Shared kit with Life OS | 1 session | low | after the Pokedex kit has settled |

**Total: about eleven sessions.** Phases 0 to 2 are the part that matters; everything after is polish on a clean base.

## 5. Decisions for you

1. **Home as "Today" with three tiles:** is Next up, Boss and Collect the right three?
2. **Bag and Box as their own tab,** taking the Team tab's overload with them, or leave them under Party?
3. **Light theme:** do you want one, or is dark-only the look?
4. **Phase 4's scene:** how much life do you want on Home (a parallax scene and a reacting partner, or keep it simple)?
