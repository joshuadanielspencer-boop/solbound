# SOLBOUND — session handoff

Paste the "Prompt for the next session" block below into a fresh thread. The rest
of this file is the detail that block points at.

---

## Prompt for the next session

> You're continuing work on **SOLBOUND**, a single-player economic-strategy game
> set in the real solar system. Repo `~/Dropbox/Solbound` (its own git repo, a
> sibling of Shutterbug, no shared code). **LIVE and fully pushed** at
> https://joshuadanielspencer-boop.github.io/solbound/ — push to `main`
> auto-deploys via GitHub Actions (`npm test` gates it). `~/bin/gh` is authed.
>
> **Read first, in order:** `docs/design.md` (master design — §12 lists locked
> decisions, §16 the accuracy policy), `docs/handoff.md` (this file: "Where
> things stand", "Working agreements", "Open decisions"), `docs/astronomy.md`
> (the two-semester curriculum audit and the build order it proposes), and
> `docs/manual.md` (the player-facing manual — it states real prices and goes
> stale the moment you change one). Then skim `src/` and `src/trader/`; every
> file has a header that explains itself and why it is shaped that way.
>
> **What the game is:** Space Trader's loop on the real solar system — a captain
> who buys, flies and sells across real orbits priced by the rocket equation, an
> economy where trade is DEPENDENCY not arbitrage, and a roguelike draw of
> factions and installations over fixed real geography.
>
> **DO NEXT, in this order, unless Joshua redirects:**
>
> 1. **The planet surface map.** Clicking the primary in the system view should
>    open a surface map of that body. The coordinate data landed last session
>    (`src/data/place-coords.js`, generated — 27 real IAU positions) and is
>    tested. Two things to decide before writing code, both flagged to Joshua and
>    unanswered: (a) only **Luna (7 places) and Mars (5)** have enough places to
>    be worth a map — everything else has exactly one, and a surface map showing a
>    single dot is worse than none; (b) **there is no Moon plate** in
>    `public/plates/` (only mars, mercury, europa, enceladus), so
>    `scripts/fetch-plates.mjs` needs a licence-checked lunar entry first — read
>    that script's header before adding one, the licence trap is real and is
>    documented there.
>    What the map is FOR, so it is not just a picture: it finally connects
>    `illumination.js` — a complete, tested engine for real day length, seasons,
>    terminator and polar night that NOTHING has called since the pivot. Shackleton's
>    crater floor in permanent shadow with sunlit rim ridges a few km away is the
>    single fact that explains why every lunar programme aims there. It is also
>    where "you can't build where you haven't surveyed" becomes visible, and the
>    natural home for ISRU siting later.
>
> 2. **Sound effects — brainstorm first, then build.** Joshua asked for ideas for
>    both in-game and menu SFX and has NOT seen a proposal yet. `src/audio.js`
>    already synthesises the whole soundtrack procedurally from scores in
>    `src/data/music.js` — no audio files anywhere, because this is an offline PWA
>    whose whole shell is under half a megabyte. SFX should follow the same
>    approach (short Web Audio envelopes, defined as data) unless there is a
>    reason not to. Propose before building.
>
> 3. **Merging the maps with the Course menu.** Discussed with Joshua, shape not
>    yet agreed. The sketch: zoom level = scope (orrery → system → surface),
>    hovering anything on the map fills the panel with the Course detail, clicking
>    commits, and the Course tab disappears the way the Atlas tab did. The open
>    question I put to him and he has not answered: does the Course tab go away
>    entirely, or survive as a sortable list for comparison? A list genuinely
>    beats a map for "which of these eighteen is cheapest".
>
> 4. Then the backlog in "Open decisions" and `docs/astronomy.md` §7 Phase 1
>    (inverse-square power budgets, real launch windows, inclination cost,
>    reconnecting illumination.js).
>
> **WORKING AGREEMENTS — these are how this project runs, follow them:**
> - Small tested increments. `npm test` AND `npm run build` before every commit.
> - Commit messages say what was **FOUND**, not just what was done — including
>   your own mistakes and the things that turned out to be harder than expected.
>   Read `git log` for the register; it is deliberate and Joshua reads them.
> - **Verify UI changes in the browser** (`solbound-dev` via `.claude/launch.json`,
>   or `npm run dev`). Do not report a UI change as working without opening it.
> - When you deploy, **verify the live bundle by content**, not by CI going green
>   (`curl` the deployed JS and grep for a string you just added — constant NAMES
>   are minified away, string literals survive).
> - **Never invent a number.** Project rule 2 and design.md §16: every fact is
>   sourced, generated, or explicitly labelled speculation. If it cannot be
>   sourced, it does not ship. This is the rule the whole project rests on.
> - Content lives in `src/data/`, never inline in a component (rule 1).
> - Accessibility is required (rule 4): keyboard parity for every hover, colour
>   never the only carrier of meaning, visible focus.
> - Desktop window is the only target. Phones and tablets are explicitly out.
>
> **Balance items await Joshua's playtest — do NOT blind-tune them.** He said
> he is working through it and will report. See "Open decisions" below; several
> have had no feedback across many sessions.

---

## Sound effects — the alert and trade core, built 2026-07-28

Proposed first, as asked, then built the half Joshua picked. Same approach as the
music: **data in `src/data/sfx.js`, one player in `audio.js`, no audio files.**
Ten sounds, about two kilobytes.

**The rule that decides what everything sounds like**, and it is worth keeping if
the set is ever extended:

> There is no sound in space. Everything you hear is inside your own hull, or is
> a tone your own console generated to tell you something.

So no whoosh on launch and no explosion when you are hit. Refuelling is a pump
that takes a moment to come up to pressure and stops with a valve click; damage
is a bandpassed hit and a low thud through the frame; the encounter alert is a
two-tone warble that pulses three times and **stops**, because a tone still
sounding while somebody reads four options is not information, it is pressure to
click anything.

**Two buses, not one.** The SFX bus hangs off the destination beside the music's
master, with its own fader in the ♪ popover. One fader for both means either the
pads are too loud or the warning is inaudible. The stored pref gained `sfxOn` and
`sfxLevel` with NO key bump — they default when absent, so every existing player
keeps their music setting and picks up effects on.

**Tonal effects follow the key of the cue that is playing.** `sfxTranspose()`
reads "F-sharp minor" off the score and folds the interval to ±6 semitones, so a
confirmation chirp sits inside the harmony instead of arriving from another
application — and never lands eleven semitones up as a shriek. Tested against
every cue in `data/music.js`.

**Where they are wired, and why there:** `denied` hangs off `flash(_, "bad")`, so
every refusal in the game already routes through it and no future error has to
remember. `alert` fires from an effect on the encounter's arrival rather than
from wherever the roll happens, so it cannot double-fire or be missed by a path
that forgot. `chart` fires when `visited` or `surveyed` grows. `focus`/`select`/
`back` live in `ui.jsx`'s primitives, so every screen in the panel tree gets them
for nothing — via a small React context (`src/trader/sfx.jsx`) rather than
prop-drilling a player through every component signature.

### Measured in the browser, by counting scheduled audio nodes

Patched `createOscillator`/`createBufferSource` and drove the real game, so "did
it make a sound" is a measurement rather than an assumption:

| | expected | measured |
|---|---|---|
| `focus` (hover a nav row) | 1 tone | +1 osc |
| `select` (open a screen) | 1 tone | +1 osc |
| `buy` | 1 tone + 1 noise | +1 osc, +1 buffer |
| `chart` (arriving somewhere new) | 3 bell partials | +3 osc |

**And one finding that changes the design note:** I had written that `denied`
would be the most-heard sound in the game. It is not. The market **disables the
button rather than raising the error** — a full hold clamps the quantity to zero,
so Buy simply does nothing — so `denied` is reachable mainly from the Yard, where
you can press a purchase you cannot afford. That is the better interface
behaviour and it makes the sound much rarer than the wiring suggests. Corrected
in the file.

**Not yet heard in play:** `alert`, `damage` and `caught`. No encounter rolled on
the two short lunar hops I flew. The wiring is in and tested at the data level;
the *feel* of them is unheard, and they are the three most likely to be wrong.

### Still to build from the proposal, if the core lands well

`launch` (the air bed rising under a 40 Hz structural rumble — the ingredient is
already in `audio.js` as `makeAirBuffer`), `dock` (a thump, then station air
sounding different from ship air), `pause`, and standing up/down. Deliberately
NOT built: anything on the drifting port clock. At a day a second, a per-day
sound is torture.

## Session of 2026-07-28 (second) — the surface map, and a seam that was wrong everywhere

**The two blockers on the surface map both had better answers than the questions
assumed**, and finding them turned up a shipped bug.

### Blocker (a): "only Luna and Mars have enough places" — wrong framing

A map does not have to show only OUR ports. `.cache/gazetteer/` already held the
IAU bulk exports for all 17 bodies from the last session, and every one of them
has real named geography: **15,335 approved features**, from 2 on Deimos to 9,086
on the Moon. So `scripts/gen-place-coords.mjs` now writes a second generated file,
`src/data/landmarks.js` — 320 landmarks across 17 worlds, 33 KB — and Ceres stops
being a dot on a photograph and becomes Occator in a landscape with Kerwan and
Ahuna Mons in it.

**The selection rule is the only judgement in that data, and it is stated in the
file:** largest first, at most three of any one feature type, twenty per body,
then backfill largest-first if the type cap leaves a world short. Diameter alone
is the obvious rule and it is wrong — on Mars it returns twenty continent-sized
terrae and not one volcano, because Terra Cimmeria is 5,856 km and Olympus Mons
is 610. The cap is what earns Tharsis Montes, Ahuna Mons and Loki Patera their
places. The backfill is what stops Callisto (which IS craters) getting ten
landmarks out of 154 available.

Joshua chose: **every body with a placed port gets a map**, plate or no plate.
Five bodies have photographic plates; the rest draw on a flat field with a real
graticule and real landmarks, which is honest and still a map.

### Blocker (b): the lunar plate — found and licence-checked

**`File:CGI Moon Kit - Lroc color poles.tif`** — NASA Scientific Visualization
Studio (svs.gsfc.nasa.gov/4720), LROC WAC colour mosaic, public domain per the
Commons file page, 27360×13680 = exactly 2:1, centred on 0°, **poles filled in**.
Ships at 219 KB through the existing pipeline. In the manifest, `checked` 2026-07-28.

The other PD candidate — USGS's Clementine 750 nm albedo map, also exactly 2:1 —
was **rejected on sight**: black unimaged bands at both poles, and Shackleton is
at −89.67°, inside them. A lunar plate with a hole where the polar shadow is
defeats the only reason that body most needs a map. The reason is recorded in the
manifest so nobody re-proposes it.

**How it was found, because Commons full-text search is useless for this:** the
API's `list=categorymembers` on `Category:Maps_of_the_Moon`. Full-text search
buries global mosaics under thousands of per-crater frames. That note is now in
the script header.

### ⚠ THE BUG: every plate is centred on 0°, and one renderer never knew

`public/plates/*.jpg` all run **−180° at the left edge to +180° at the right**.
Confirmed by eye against `mars.jpg`: Hellas Planitia (70.5°E, 42.4°S) lands at
69.6% across and 73% down, exactly where the bright oval is.

`wanderer.jsx`'s survey-era `BodyView` projected `lonE / 360`, which assumes 0° at
the LEFT edge. **Every pin on that screen has been half a world out since it was
written** — Olympus Mons drawn at 63% across a map where it belongs at 13%, in the
middle of Syrtis Major. It looked completely plausible, which is why nothing
caught it. Fixed (one line; the modulo form agrees for both 0–360 and −180..180
inputs, since they are the same angle).

**And a second, separate wrongness it exposed:** four of `data/features.js`'s
fourteen coordinates are WEST longitudes recorded as east —

| feature | features.js | should be (gazetteer) |
|---|---|---|
| Loki Patera | 308.8 | 51.2°E |
| Conamara Chaos | 274.0 | 86.5°E |
| Damascus Sulcus | 300 | 74.1°E |
| Kraken Mare | 310 | 50°E |

All four are outer-planet satellites, whose IAU convention is west longitude.
**NOT patched**, deliberately: `features.js` is the hand-written draft content
design.md §11 already flags, and patching four of fourteen would make it look
vetted when it is not. The authoritative values are already generated in
`place-coords.js`. That file wants regenerating, not mending — and this is now a
measured example of what "content is a draft" actually costs.

Also found: `place-coords.js`'s own generated header claimed it used "the same
convention data/features.js uses". It does not, and that sentence would have
misled the next person to build on it. Corrected in the generator.

### What landed

- **`src/surface.js`** — pure. `surfaceReport()`, `bodyOf()`, `polarNight()`,
  `seasonAmplitude()`, `nightOutlines()`. 31 tests.
- **`src/trader/surface.jsx`** — `SurfaceView` (the map) and `SurfacePanel` (the
  reading beside it). Kept out of `play.jsx`, which is already 1,295 lines.
- **Third map level.** `surface` state beside `zoom`; Esc unwinds ONE level, so
  the deepest screen is not the hardest to leave. Bodies we hold geography for
  carry a dashed ring; gas giants stay inert, which is the right lesson about
  Jupiter.
- **`illumination.js` is finally called by the game** — first time since the
  pivot. Terminator, lit/dark pins, sun altitude, polar night, and `saySolarDay`.

**Two things the screen refuses to claim,** both printed on it rather than hidden:
the rates are real but the PHASE is not epoch-anchored (so it shows how the light
moves, never what time it is at a named place on a named day); and the model works
on a smooth sphere, so **Shackleton's permanent shadow is NOT what this draws** —
that is a fact about the crater's rim, not its latitude. `phaseAnchored` is false
on every report and a test pins it there.

### Gotchas from this session

- **`nightSpans()` is the wrong shape for a picture.** Drawn as 120 rectangles the
  terminator is a visible staircase, because near the terminator a few degrees of
  longitude move the boundary a long way in latitude. `nightOutlines()` joins them
  into polygons. Two traps in that: darkness spanning ±180 must come back as TWO
  regions (the map's edges are not adjacent) while darkness spanning 0° must stay
  ONE, and at equinox `nightSpans` emits nothing at all for lit columns so the
  present columns are not contiguous. Both are tested.
- **`site.body` is not the world a place is on.** It means "nearest charted
  anchor" — Sputnik Planitia is filed under `charon` and is unambiguously on
  Pluto. The map keys on the gazetteer's `target` via `bodyOf()` instead, which
  sidesteps the whole class. The census entries are still wrong and still worth
  fixing.
- **Ceres and Vesta are ports and are NOT in `ROTATION`.** `isLit()`'s fallback
  returns lit-at-45° — right for "don't block a photograph", wrong for a map that
  states facts. `surfaceReport` passes the gap through as null and the panel says
  so. **Small sourceable follow-up:** add their real rotation periods and tilts
  from the IAU WGCCRE report and they get terminators like everything else.
- **A NaN/crash in the console mid-session was an HMR artefact**, not a defect:
  the component had the new polygon data while still running the old rect JSX.
  Confirmed stale by reloading twice and reopening five maps with no new entries.
  Worth knowing before chasing one.

## Session of 2026-07-28 — the interface session

Almost none of this was new systems; it was making the game legible. Joshua
played it and the feedback was blunt and right: *"the game presents SO MUCH
information all at once, and most of it text that you have to scroll through...
not intuitive what I'm supposed to be doing."*

**The panel became a tree** (`src/trader/ui.jsx` + `src/trader/panels.jsx`, both
new; `play.jsx` dropped 1,800 → 1,200 lines). Each tab is a menu of labelled ways
in, each opening a screen with a back arrow, and every menu button carries the
number you would have gone in to read. Detail arrives on **hover** in a bubble
that is absolutely positioned so the list never reflows under the cursor — the
naive version moves the row you were aiming at out from under the pointer. 160ms
delay before showing, none before hiding.

**The map earned its screen.** Rotated 135.93° so Pluto's major axis lies along
the wide side of the frame (worth 29% more scale in true view — its aphelion
reaches 49.3 AU but its semi-minor axis is only 38.24); viewBox widened to
1350×1000; sun drawn in three layers with a white core; orbits dimmed to 0.26;
starfield per system; the belt redrawn as a band of ~220 rocks around the Sun at
real semi-major axes instead of three moons around a dot; moons animated on real
periods. The **Atlas tab is gone** — clicking a planet opens its system on the map
AND its atlas in the panel.

**Shell and framing.** Studio card intro (skippable, honours reduced motion),
music lifted to the app root so it plays on the menu, Menu became a **pause
overlay** instead of a one-click exit, download button folded into it as Save
Game, net worth removed, splash starfield + 2× logo with its black screened away.

**Coordinates landed** (`scripts/gen-place-coords.mjs` → `src/data/place-coords.js`).
27 real IAU positions pulled from the USGS gazetteer's bulk KMZ exports. Half the
census has no coordinate and never will — orbits, Lagrange points, cyclers,
resonance gaps — and `hasSurface()` says so rather than inventing latitudes.

**Clock:** 2 / 15 / 90 days per second (was 4 / 25 / 120), and time in port drifts
at 1 day per 3 seconds with no pause button. Measured while deciding: trip lengths
are **bimodal** — ~26% are the flat 6-day intra-system hop, only 2% land between
two weeks and two months, ~70% run six months to several years. The gap is real
physics.

**Docs added:** `docs/manual.md` (player manual) and `docs/astronomy.md` (audit of
how much of two semesters of intro astronomy can be taught as mechanics — scores
semester one at ~90% achievable and stellar at ~65%, with the distance ladder as a
literal tech tree and parallax baseline scaling with how far out you build).

### Gotchas worth not rediscovering

- **The browser preview pane collapses to 0×0 intermittently.** Every geometry
  reading taken then is garbage (I once "found" 287px of overflow that was pure
  artefact). Check `innerWidth` before trusting any measurement; screenshots
  sometimes still work when JS reports hidden.
- **Verify deploys by content, not by CI.** Constant names are minified away;
  grep the deployed bundle for a string literal you just added.
- **React delegates mouseenter off mouseover** — a synthetic `mouseenter` in a
  test script never reaches a React handler. Dispatch a bubbling `mouseover` with
  a `relatedTarget`.
- **The IAU gazetteer has no query API.** Its CSV export is not a URL parameter
  and its search page renders client-side. The bulk KMZ files on `GIS_Downloads`
  are the machine interface, and nothing links to them from the search UI.


## Session of 2026-07-27 — what landed, and the one question left open

Three of the four queued items are built and tested (390 passing, 19 files).
**Item 2, the missions board, is deliberately NOT started** — see the direction
call at the end of this section.

**1. Standing is visible** (`src/reputation.js`, new). A Standing tab lists every
placed actor with a tier word, a diverging bar, where they hold, and whether you
are in their hall. A **ledger** on the game (`repLog`) files each move with the
encounter and choice that caused it. Save is **v9**; a v8 save keeps its real
standing and starts with an empty ledger (the encounters that made those numbers
are gone and cannot be reconstructed — better no receipts than invented ones).
Entries record where the number LANDED, not just the delta, because standing
clamps at ±100 and deltas do not add back up. Standing also shows on the docked
port and on every course row. `reputation.js` now OWNS the one effect standing
has (the talk-down bonus); encounters.js reads it from there.

**2. Wait button, range readout, "not traded here" rows.** `wait()` now returns
`{ game, quit }` and refuses while under way (it would let a player step over a
rolled encounter). `rangeReport()` gives "9 of 16 ports in reach on the
propellant aboard" vs what a full tank reaches, on the Dock and the Yard. Untraded
goods list below the market under their own heading — sorting them in by value put
three greyed raws at the TOP of Gateway's shelves. Also fixed: `saveSig` excluded
the clock, so waiting 90 days with no crew changed nothing in the fingerprint and
a refresh silently undid it. The date is in it now, but only while docked.

**3. Drive eras are purchasable** (`shipyard.drivesForSale` / `buyDrive`).
Two claims in the old handoff were wrong and the numbers corrected them:
- **NTR opens the BELT, not Saturn.** A starter Courier goes 9 → 11 reachable
  ports; Ceres goes from 147 t against a 30 t tank to 22 t. Jupiter needs a drop
  tank on top. Saturn stays shut.
- **It does nothing for a freighter** — Ceres still wants 152 t against a 130 t
  tank. Mass is what the equation charges for; an era changes the base, not the
  rule. Tested, because it is the whole design.

**Boil-off is now modelled**, and it is what stops a better exhaust velocity from
being a free upgrade. Methalox is storable (why it was picked for Mars); hydrolox
and NERVA-class NTR fly on liquid hydrogen, which boils ~0.13–0.16%/day passively.
The clock drains the tank wherever you are — ~30% of the reserve over a Mars
coast, nearly all of it over a Saturn-scale run. The **cryocooler** (140k, gadget
bay) cuts it to a tenth and does nothing for methane. Boil-off eats the RESERVE,
never the trip, so it can make an unrefuellable port a trap but can never strand
you mid-flight. **NEP and the torch are listed but unbuyable**, with their reasons
printed: the ion drive waits for a travel model with windows in it, and the torch
is impossible (the screen gives the mass ratio).

**A real bug, found by opening a tab:** the **Yard has been crashing on every
open since crew landed** — play.jsx passed `crewForHire` a site *id* where it
wanted the site. 390 tests, all green, and none of them opens a screen. That is
the gap worth thinking about: there is no UI smoke test of any kind.

### Second batch, same day — Joshua's three notes

**"Not intuitive what I'm supposed to be doing."** The Dock now leads with the
decision: name, chips, a one-line `NextStep` that reads the state you are in, the
propellant/range box, then the market. Prose, the newspaper and the port's
politics fold up underneath. The untraded rows from earlier the same day are
behind a toggle — sorted by value, they put the cheap raws at the TOP, so a
market opened as a wall of "no". That was a wrong call, corrected.

**The map is a control.** Click or keyboard-focus a planet to go inside its
system: the primary, its charted moons on real log-compressed orbital radii, and
this run's ports pinned to the body they sit on. Click a port → it becomes the
destination with the course plotter open. Esc backs out; launching backs out on
its own (a leg is a heliocentric arc a system view cannot draw).

**Time drifts in port** at `DOCK_RATE` (1 day/sec), one click to hold, ticking at
10 fps because every tick re-prices the market. `game.dockClock` (undefined =
running, so no migration). The autosave is debounced 2 s — the signature carries
the docked date, which at a day a second is a ~30 KB write every second otherwise.

**Two things worth knowing next time:**
- **A few places anchor to a body they do not orbit.** `himalia` has
  `body: "callisto"`, `ring-camps` has `body: "mimas"`, `phoebe-gate` has
  `body: "iapetus"` — the data uses `body` as "nearest charted anchor", which was
  invisible until the system view started drawing moons as orbits. Fixing it means
  either adding Himalia/Phoebe to `MOONS` with sourced elements (rule 2) or giving
  places an explicit "not charted, drawn near X" flag. Content work, not a bug.
- **Do not browser-verify on Joshua's live autosave.** Now that the clock drifts
  in port, just having the game open advances his world. Make a scratch captain,
  or snapshot localStorage to a file first — `window.__x` does not survive the
  reload you are about to trigger.

### ⚠ Joshua: two things about your autosave

I browser-verified against your live save (Ada, Gateway Station), and:
- **It migrated v8 → v9 cleanly** and reloads fine. Nothing was lost.
- **Its date moved from Sep 22, 2036 to Jan 29, 2037** — a month from pressing
  the new wait button, then three more because the drifting clock kept running
  while I walked the screens. No money was spent (no crew aboard), no cargo, no
  travel, and the log still has only its opening line — it is the same untouched
  starter captain, four months later with drifted markets. The dock clock is left
  HELD in that save. Say the word and I will reset it to a fresh Ada.
- I also test-bought a nuclear-thermal refit on a temporarily-enriched copy and
  restored credits, drive and log afterwards — verified back at $300,000, methalox,
  empty hold, 17 sites, 4 factions.

### The direction call — please read before the next session builds on it

The missions board is item 2 on the old list and it is the natural next thing.
It is also more Space Trader. Everything in this repo now is Space Trader done
well on real orbits; **the campaign's actual identity — ISRU, severing the
umbilical, becoming infrastructure (design.md §5) — has not been started.**
The mining rig and survey lab modules exist and still do nothing.

The drive work just made this sharper rather than softer: an era refit is the
first purchase that changes what the map *means*, and the obvious next one is a
place that MAKES propellant for you instead of selling it. A missions board built
first would be a large content system layered on a game whose spine is missing.

**Two honest options, and it is your call:**
- **Missions first** — directed goals, income, and the thing that makes standing
  matter. Safe, immediately playable, and defers the spine again.
- **Production chains first** — mining, refining, an owned depot. Riskier, larger,
  and it is what the game is actually about. Missions then have somewhere real to
  point (survey contracts, depot supply) instead of being freight for its own sake.

My recommendation is production chains, after you have played a few runs of what
is here. Balance items below are still unplayed and I have not blind-tuned any.

---

## Where things stand (2026-07-26)

**Repo/deploy.** `~/Dropbox/Solbound`, repo `joshuadanielspencer-boop/solbound`,
LIVE at the URL above. Push to `main` → GitHub Actions runs `npm test` then builds
and deploys. `~/bin/gh` is authed. The front door (`#/`) is the game; the old
"systems hub" labs live behind `#/codex` as reference.

**Architecture.** Vite + React, all state as **pure serialisable values**, logic
in pure functions, UI thin over them. Key modules:
- `ephemeris.js` — real JPL Keplerian positions (validated vs oppositions). Horizon 2050.
- `transfer.js` / `propulsion.js` — Hohmann transfers, windows, the rocket equation, drive eras.
- `market.js` — scarcity prices that can't run away (mean-revert to equilibrium), `avgPrice` (structural), `equilibriumStock`, and `stockRatio` (where faction mods bend supply).
- `player.js` — captain, ship, cargo, credits, buy/sell, cost basis, `priceToBuy/Sell`.
- `tradergame.js` — the game state + the living clock: `newGame`, `launch`, `advanceTime`, `travel` (headless), `refuel`, `shipPosition`, `RATES`, `dailyCost`/`tripCost`, `buyPaper`.
- `intel.js` — market intel: `runPlan`, `cargoValueAt`, `intelFreshness` (light-lag).
- `factions.js` / `data/factions.js` — the roguelike spawn (`spawnFactions`, `factionAt`, `marketMods`) plus `regionDanger` (netted, for how OFTEN), `pirateThreat` and `patrolStrength` (separate, for WHAT).
- `worldinfo.js` — `systemInfo` (tech/gov/police/pirates/pressure), `policeLevel`, `generateNews`.
- `shipyard.js` — `shipsForSale`, `buyShip`, `fitModule`/`removeModule`, `repairHull`, `buyEscapePod`.
- `crew.js` / `data/crew.js` — `crewForHire` (seeded per port per 40 days), `effectiveSkills` (**the best hand aboard does the job — read this, not `player.skills`**), `dailyWages`, `payWages`.
- `save.js` — versioned envelope (**v7**), migration ladder, autosave, file import/export.
- `data/sites.js` — 7 sites with `techLevel`, `owner`; `TECH_LEVELS`, `GOVERNMENTS`
  (each with `law`, `controls`, `duty`, `bans`), `controlsCommodity` / `bannedAt`.
- `data/commodities.js` (+ `CONTROLS`, `CONTRABAND`, per-commodity `control`/`contraband`),
  `data/hulls.js` (+ `minTech`, `slots: {weapon, shield, gadget}`, modules, `ESCAPE_POD`),
  `data/captain.js`.
- `trader/` — the UI: `splash`, `create`, `play` (Dock / Yard / Course tabs), `index`,
  `ships.jsx` (SVG hull + stranger silhouettes for the encounter face-off).
- `data/encounters.js` — the encounter TABLE, the `RECORDS` ladder, salvage finds.
- `encounters.js` — **the resolver**: `resolve(encounter, choice, context) → outcome`,
  plus `rollLegEvent`, `applyOutcome`, `resolveEncounter`, `controlledCargo`, `illegalCargo`.

**New since the module map below was written:** `data/places.js` (the census as
data), `data/installations.js`, `data/operators.js` (now THE government
registry — GOVERNMENTS is an alias), `worldgen.js` (`spawnSites`, `deriveSite`),
`atlas.js` (`atlasFor`, `isRevealed`, `atlasProgress`), `intel.occluded()` (the
conjunction), and `game.sites`/`game.surveyed` in the state. Save is **v8**.
Key invariants, all tested (test/worldgen.test.js): core seven in every world
verbatim; same seed → same world; no implausible pairings (no farms in the
dark, no families on lethal ground, no syndicate customs house); an inner and
a far site guaranteed every draw; conjunction is one contiguous ~2-week season
(seed 42: 18 days, Sep 2036) that blinds intel and never blocks travel.
**Deferred with intent:** the Aldrin cycler stays atlas-only — a moving port
needs phasing mechanics the travel model doesn't have (it uses ideal Hohmann,
no windows), so "catch it or miss it" can't be honest yet. Survey MISSIONS
(directed contracts) wait for the mission board; the lab-sweep reveal is v1.

**Test the whole thing:** `npm test` (348 passing). **Run it:** the browser
preview via `.claude/launch.json` server `solbound-dev` (auto-port), or `npm run dev`.

## How the encounter layer works (read before touching it)

- **One roll per leg, at launch**, keyed to `(seed, game.rollCursor)` — never per
  tick. Per-tick rolling would make the clock RATE a difficulty setting, and would
  break replay. A test pins that fast-forward can't change the world.
- **Quiet encounters don't stop the clock.** "Empty sky" is the heaviest-weighted
  row in the table; it becomes a line in the transit panel instead. That's what
  lets the hazard rate be generous without being an interruption every crossing.
- **No single encounter destroys a sound hull** (`MAX_ENCOUNTER_DAMAGE = 45`). You
  die from flying a battered ship into a second fight — a mistake you can see
  coming. Death sets `game.over` and the autosave is cleared.
- **There are TWO legal tiers, and the distinction is the lesson.**
  - *Controlled* (`commodity.control` + `government.controls`/`duty`): nuclear,
    pharma, dual-use — all real export-control categories. Legal to carry, legal
    to sell, owes a **duty** at a strict port. Never touches your record.
  - *Contraband* (`commodity.contraband` + `government.bans`): **arms** and
    **unsafeguarded fissiles**. Seized outright, fined at a multiple of value,
    and it goes on your record. Sold openly at free ports and company towns;
    banned — and worth 3x more — under the agency and (fissiles only) the
    consortium.
  The pairing is deliberate and real: reactor *components* move under safeguards
  and paperwork, while unsafeguarded fissile material is the thing the safeguards
  exist to stop. Same industry, one side licensed, one side criminal.
- **Contraband is never manufactured by the `makes` tier rule** — only where a
  site lists it explicitly. Without that guard Gateway Station sells munitions on
  turn one, because its `makes` includes the industrial tier.
- **Standing lives on `game.factions[].standing`**, which is where the spawn put
  it. `player.reputation` is a vestigial empty field — don't start a second source
  of truth in it.

## Second pass over the screenshots (2026-07-26, after items 1–7 landed)

All seven items from the first pass are built. Re-reading the images against the
game as it now stands, plus what building them exposed. **Ranked by what would
actually change the game**, which is not the same order as "what's left in the
screenshots".

### 1. THE MAP IS TOO SMALL — and this is now the biggest problem

Space Trader has ~120 systems and a Short Range Chart you navigate by. We have
**seven sites**, and every system we have just built pushes harder on that:

- `mods.produces` is unreachable, because with seven sites every one of them
  already trades everything except precision instruments. A faction can't bring
  anything new to a port when the port already sells it all.
- Contraband has exactly one buy-side (Ceres, Psyche) and two sell-sides. That's
  one route, not a trade.
- Crew hiring re-rolls every 40 days per port, but there are only seven bars.
- Tech level gates hulls, and four of seven sites are tech 3 or below.

Everything downstream — missions, rivals, reputation, prospecting — gets thinner
the fewer places there are to do it. **More sites is the single highest-leverage
thing left**, and it is content work rather than systems work: each new site
needs a real physical reason to exist (`why`), a produces/consumes list, a tech
level and an owner. Candidates that are real places with real reasons: Titan
(nitrogen and methane), Europa (ocean, and lethal radiation), Ganymede (the only
moon with a magnetic field), Vesta, Deimos, Mercury's polar cold traps, a Venus
cloud-deck station, an Earth–Sun L1 or lunar L2 relay, Enceladus.

### 2. Reputation is still invisible — and now it MOVES

Still item 1 on the old roadmap, and more urgent than before: encounters now
write standing in five different places (fight, bribe, comply, help, ignore) and
the only place a player ever sees a number is inside the encounter panel that
changed it. There is no screen that says who likes you, what it took, or what it
buys. Everything needed is in `game.factions[].standing`.

### 3. Waiting is impossible, and wages just made that a real gap

`wait(game, days)` exists in the sim and has no UI. Before wages there was no
reason to want it; now the clock costs money, markets drift, and a faction crisis
eases and returns — so "sit here three weeks for the shortage to bite" is a
strategy the player can reason about and cannot express. It is one button.

### 4. A range readout ("you have fuel to fly 14 parsecs")

Their Ship Yard leads with how far you can go. We make the player open the Course
tab and read six rows to find out. The data is all in `travelCost`; this is a
one-line summary of "with this hold, you can reach X of 7 ports" on the yard and
dock screens — and it would make the cargo-vs-range trade visible at the moment
the player is deciding how much to buy.

### 5. Goods a port does NOT trade should still be listed

Space Trader lists every commodity always, with `---` or "not sold" against the
ones this system has no market for. We omit those rows entirely, which hides
information that teaches: seeing "Reactor components — not sold" at Shackleton is
how you learn what a place can't get.

### 6. System size, and "special resources unknown"

Two small ideas from their System Info. Size is a word we could derive from
population. The better one is **"unknown"**: their price list won't tell you a
system's special resources until you have been there. We have a light-lag
freshness model that does this for prices; extending it to "you have never
visited, so this is guesswork" would cost nothing and would make first visits
matter.

### Deliberately still not taking

Difficulty settings (our difficulty is the rocket equation and the faction draw),
the parsec range model (delta-v is the point), and their Tips system (our notes
are inline, where the decision is).

---

## First pass: what the screenshots had that we didn't — ALL BUILT

Kept for the record. Derived from all 26 images on 2026-07-26; every item below
shipped in the three commits that followed.

1. **The escape pod.** The Ship Yard screen reads *"You need 2000 cr. for an
   escape pod."* That is Space Trader's whole answer to death, and it is better
   than ours: survival becomes a **purchase you either made or didn't**. Buy it
   and losing the ship costs you the ship (you wake up in a Flea); skip it and
   death is final. It converts an unfair-feeling ending into a decision the
   player made hours earlier, and it settles the open question below. **Small,
   and the highest value on this list.**
2. **Police and Pirates as SEPARATE readouts.** Their System Info lists both
   ("Police: Abundant / Pirates: Some"). We collapse them into one danger word,
   which loses the most useful distinction on the screen: a lawful region is
   *safe from raiders and dangerous to smugglers*, and that trade-off is now
   load-bearing since contraband landed. Both numbers already exist —
   `govOf(site).law` and `regionDanger()`. This is a display change.
3. **Separate slot types: weapon / shield / gadget.** Ship Information gives each
   hull its own counts. We have one undifferentiated `slots`, so nothing stops a
   player filling every slot with lasers. Splitting them is what makes a fit a
   set of trade-offs instead of a shopping list.
4. **Crew quarters and mercenaries.** Hulls already carry a `crew` number that
   nothing reads. Space Trader hires named crew into those berths, each with
   their own skills — which is also the cheapest way to make skills matter after
   character creation.
5. **"Current costs" on the target-system screen** — a running per-jump total
   (crew wages, insurance, debt interest). We have no recurring costs at all, so
   credits only ever go up between purchases. A small running cost is what makes
   idling expensive and time genuinely scarce.
6. **Special resources per system** ("Nothing special", "Mineral rich"). Our
   faction market modifiers already do this job, and `factions.marketMods()` is
   still unwired (item 3 below) — so this is *the same feature*, and wiring the
   mods is the version to build.
7. **A paid newspaper** (3 credits). Ours is free. Charging for information is
   thematically right for a game whose thesis is that information is a resource,
   but the light-lag freshness model already carries that idea, so this is
   flavour rather than mechanics.
8. **Encounter art** — their encounter screen shows the two ships facing off,
   with a police/pirate/trader badge. Already on the art list below.

Deliberately NOT taking from them: difficulty settings (our difficulty is the
rocket equation and the faction draw), and the parsec-based "range" model (delta-v
is the whole point of this game).

## The roadmap, as it now stands

Merging the second-pass findings above with what was already queued. Ranked:

1. **More sites.** See second pass §1 — the map is now the constraint on every
   other system. Content work, and the highest leverage thing left.
2. **Reputation as a visible track** — it moves in five places and shows nowhere.
3. **Missions / contracts** — a mission board (freight, passengers, survey,
   bounty). Factions already have `offers`. Gives directed goals and income, and
   it is the thing that would make standing matter.
4. **Prospecting/mining** — the survey-mode camera as the tech tree: "you can't
   build where you haven't surveyed." Mining rig + survey lab modules exist and
   still do nothing.
5. **The small ones from the second pass** — a wait button (§3), a range readout
   (§4), "not sold" rows (§5), unvisited-system fog (§6). All cheap, all
   independent.
6. **Art beyond the silhouettes** — a captain portrait, per-faction colours. The
   encounter face-off is done.
7. **Deferred infra debt:** the 2050 ephemeris horizon (swap to Standish's
   3000 BC–3000 AD tables for a multi-century campaign), and the invented
   `DELTA_V_FROM_LEO` graph (source a real one).

**Done since this list was last written:** the encounter/risk layer, contraband
and customs, the escape pod, police/pirates split, slot kinds, crew and wages,
faction market modifiers wired to prices, the paid newspaper, encounter art.

## Design decisions locked (don't relitigate)

- Two victory conditions = two modes: a short **Run** (get rich, retire, under a
  clock) and a long **Campaign** (sever Earth-dependency, become infrastructure).
  Same engine; victory + time cap are data. (Only Campaign-ish exists so far.)
- The player is a **customisable captain** (name, 4 skills), not a faceless company.
- Keep **SVG/React**, not Canvas — accessibility beats sprite throughput at this scale.
- **Advance-to-next-decision** pacing with continuous animated time, not literal turns.
- Real physics stays **under the hood** — never a design-your-own-rocket screen.

## Suggestions from the wider-games research (2026-07-27)

Mined from Taipan, Elite Dangerous, Sid Meier's Pirates!, Sunless Sea, 80 Days,
FTL, Patrician et al. — each mapped to what it would do HERE. Ranked:

1. **Rare / provenance goods** (Elite Dangerous): goods only one site sells,
   whose value rises with distance from origin — Titan methane distillate,
   lava-tube-aged whisky, Reiner Gamma pilgrim tokens. Gives long hauls a
   guaranteed spine independent of market state; tiny data cost. ED caps value
   ~160-200 ly out; ours would scale with Δv-distance, which teaches the map.
2. **Debt, and a lender with personality** (Taipan's Elder Brother Wu; Space
   Trader had interest too): borrowing against the ship turns a bad encounter
   into a story instead of a reload, and interest makes the calendar cut both
   ways. Pairs with an INSURANCE operator (Mutual Assurance already exists in
   data/operators.js) underwriting hull/cargo — premiums vs pirate risk is a
   real decision.
3. **A career clock** (Pirates! aging): Space Trader's "retire rich" Run mode +
   aging gives campaigns an arc and a scored ending ("what became of you").
   Fits the two-victory design (Run/Campaign) already locked in design.md.
4. **Port reports** (Sunless Sea): first-visit pay for delivering a report to
   the Archive/university/surveyors — makes exploration itself an income line
   and gives the atlas an economic echo. Cheap: `visited` already exists.
5. **Warehouse storage** (Taipan): rent storage at a port to ride out a price
   trough or stage cargo — with theft/spoilage risk at low-law ports. Makes
   markets a game you can play in TIME, not just space.
6. **Event director** (FTL/RimWorld pacing): a storyteller layer that spaces
   encounters/news for drama (quiet stretch → spike) instead of pure hazard
   rolls. Keep determinism: seed-keyed.
7. **Fact-unlocks** (Outer Wilds' knowledge-as-progression): atlas entries that
   CHANGE PLAY when learned — surveying Enceladus reveals plume-scoop refuel,
   surveying Utopia enables a depot contract. Research literally becomes
   capability, which is design.md §1's chain verbatim.
8. **Named rival captains** (Pirates!/ED minor factions): precursor to §9's
   rival layer — a name that recurs in news/encounters before full AI exists.

Sources: [ED rare goods](https://elite-dangerous.fandom.com/wiki/List_of_Rare_Commodities) ·
[Taipan mechanics](https://en.wikipedia.org/wiki/Taipan!) ·
[Pirates! aging](https://sidmeierspirates.fandom.com/wiki/Age) ·
[Sunless Sea port reports](https://sunlesssea.fandom.com/wiki/Port_Report)

## Awaiting Joshua's feedback (no response yet — not settled)

Decisions made this sprint that have had NO playtest or comment. Surface before
building on top of them:

- **Escape pod as the death answer** ($35k, one use, wake at nearest port).
- **Contraband tone & numbers**: arms/fissiles as the two goods; fine 0.35×value
  ×risk; 3.15× legal/banned spread; smuggling being mid-game-by-geography.
- **Wages vs early capital**: cheapest hire $130/day; a crewed 9-month Mars run
  costs more in wages than a starter's cargo. Best pressure or early trap?
- **Encounter frequency**: ~45-50% per quiet Mars leg (0.08/month base).
- **Paid newspaper** ($330–780 by tech) — act-not-tax intent.
- **Slot kinds**: Courier can never mount a shield; only the Cutter fights.
- **Crew pool**: 12 named hands, tech-gated ratings, 40-day refresh.
- **The drawn world itself**: 16-20 sites/run, operator/installation tone
  ("The Quiet Company", "Reiner Gamma Retreat"), name style, census content.
- **Conjunction**: 3° threshold ≈ 18-day blackout; intel fully dark (no stale
  cache); flying still allowed.
- **Atlas reveal rules**: Earth free; docking reveals a place; lab reveals a
  system. And survey-lab-as-instrument vs future survey MISSIONS.
- **Deferred calls**: Aldrin cycler atlas-only until phasing; ephemeris 2050
  horizon still standing (Joshua said multi-mission long games are the goal —
  the 3000AD tables are now genuinely needed, not deferred-forever).
- **~15 unpushed commits** — pushing deploys; his call.

Added 2026-07-27, also unanswered:
- **What standing should BUY** beyond the talk-down bonus. Named on the screen as
  an open question rather than silently built: friendly-port tariff, contracts
  gated on trust, a region that turns hostile.
- **Boil-off as a mechanic at all** — it makes the hydrogen eras a decision
  instead of a straight upgrade, and it is true, but it also means the best drive
  in the game punishes long coasts unless you spend a gadget bay on a cryocooler.
- **The drive ladder stopping where it does** — NTR is the last purchasable era;
  NEP and the torch are shown with reasons. That leaves the outer system genuinely
  shut for now, which may be right (it is what ISRU and depots are FOR) or may
  read as a dead end.
- **Missions vs production chains** — the direction call at the top of this file.

## Open decisions — Joshua has NOT answered these

Surface every one of these when it becomes relevant rather than building past it.

**ANSWERED 2026-07-28 (second session), kept for the record:**
- ~~Surface map scope~~ → **every body with a placed port**, using generated IAU
  landmarks as context. Built.
- ~~The lunar plate~~ → **NASA SVS CGI Moon Kit**, public domain, poles filled.
  Fetched and in the manifest.

**Still asked and unanswered:**
- **Course tab after a map/panel merge:** does it disappear entirely, or survive
  as a sortable comparison list? A list beats a map for "which of these is
  cheapest". My recommendation, on record and not yet acted on: KEEP it as a
  sortable table reached from the map. Joshua's own measurement is the argument —
  trip lengths are bimodal (~26% six-day hops, ~70% six months to years), so the
  interesting comparison is a column of numbers, not a spatial layout. The map
  answers *where*; a table answers *which of these eighteen*.
- **Difficulty.** Now cycles in the pause menu, stores a value, and is wired to
  NOTHING — the dialog says so. `design.md` §12 explicitly declined difficulty
  settings ("our difficulty is the rocket equation and the faction draw"). Joshua
  asked for the control; this is a locked decision that needs revisiting rather
  than quietly overturning.
- ~~Sound effects — asked for a brainstorm~~ → proposed and the core built
  2026-07-28. **Unplayed:** every level, and the alert/damage/caught trio in
  particular, which nobody has yet heard in a real encounter.

**Long-standing, still open (see "Known balance notes"):**
- Escape pod at $35,000 as the answer to death.
- Crew wages: one hire turns a 9-month Mars run into ~$86k, more than a starter's
  cargo. Best pressure in the game, or a trap that makes hiring a mistake?
- Encounter frequency ~45–50% per quiet Mars leg.
- Contraband numbers, the paid newspaper, slot kinds, the drawn world's tone.
- The 2050 ephemeris horizon (Standish Table 1 stops there; multi-century
  campaigns need the 3000 BC–3000 AD tables).
- `DELTA_V_FROM_LEO` is still invented and labelled as such.


## Known balance notes for playtest (not blind-tuned)

**New this session, all first guesses, none playtested:**
- **Drive prices.** Hydrolox $260k, nuclear thermal $1.8M, against a $300k
  starting purse and a $620k top hull. Deliberately sited past the Ship Yard as
  the next mountain; trade-in is 45% (`DRIVE_RESALE`), so a round trip always
  loses. Whether $1.8M is "a campaign's savings" or "twenty minutes of contraband"
  depends entirely on how the mid-game actually earns, which nobody has played.
- **Boil-off rates.** 0.16%/day hydrolox, 0.13%/day NTR, cryocooler ×0.1
  (`CRYO_FACTOR`). Real passive LH2 tankage is in this range and active
  zero-boil-off systems target below 0.1%/day, so the physics is defensible; the
  *feel* is not tested. A Mars coast costs ~30% of the reserve. If that reads as
  nagging rather than as a reason to fit a cryocooler, it is two numbers in
  `DRIVES`.
- **Cryocooler at $140k in a gadget bay** — it competes with the drop tank and the
  survey lab, which is meant to be the trade. A Courier has 2 gadget bays.
- **Standing tiers.** Bands chosen so the data's own dispositions read true
  (hostile opens at Distrusted, friendly at Welcome). Standing still buys exactly
  one thing (up to ±40 points on a talk-down). **What else it should buy is an
  open design question, surfaced on the screen rather than guessed at** — the
  candidates are a friendly port's tariff, contracts gated on trust, and a region
  that turns hostile.
- **Wait steps** are +7 / +30 / +90 days. Waiting is free without a crew, which
  may be too free — the counter-pressure is meant to be the calendar itself, and
  there is no career clock yet.

- **Encounter frequency on long legs.** The hazard rate is per-month-exposed, so
  an 8–9 month Mars run in *quiet* space still comes out around 45–50%, and a
  playtest hit trouble on two consecutive Mars legs. That may be right (it makes
  the long haul feel long) or it may be nagging — it's one constant,
  `encounterChance`'s `0.08` base per month.
- **Duty rates** (3–6% of controlled-cargo value) are a first guess. On a 2 t
  electronics run to Jezero the duty came to ~$58k against ~$1.7M of cargo, which
  felt like a real but survivable toll. Untested at freighter scale.
- **Wages versus early capital — the one to watch.** A single hire at $320/day
  turns a 9-month Mars run into $86,171 of wages, which on a fresh captain's
  purse is more than the cargo. That is either the best pressure in the game (a
  crew is a commitment to short routes until you're rich) or a trap that makes
  hiring a mistake before the mid-game. It wants a real playthrough to tell.
  Wages are per-crew in `data/crew.js`; the cheapest hire is Prakash at $130.
- **Escape pod price ($35,000).** Meant to sting on a starter purse and be
  beneath notice later. Untested against a real death — I have only unit-tested
  the payoff, never lost a ship in play.
- **Paper price** (150 + 90 × tech, so $780 at Gateway and $330 at Callisto).
  Trivial next to any cargo; the point is the act, not the cost. If it reads as
  pure tax, make it free at your home port or fold it into a relay upgrade.
- **The Courier gained a bay** (2 undifferentiated → 1 weapon + 2 gadget). A
  slightly more generous starter than before; watch whether the first hour is now
  too comfortable.
- **Contraband spread.** Fissiles run $3.68M/t at Ceres (free port) against
  $11.6M/t where they're banned — 3.15x, against a fine of ~87% of value plus
  losing the cargo. Arms carry the same 3.15x at a tenth the stake, which makes
  them the sane first smuggling run. Untested over a full campaign; the numbers
  are `equilibriumRatio`'s 0.15 black-market floor and `illegalCargo`'s 0.35 fine
  rate.
- **Contraband is mid-game by geography, not by design.** Both source ports
  (Ceres, Psyche) are out of a starter Courier's range, so the black market opens
  up when the ship does. That seems right, but it means a new player never sees
  the mechanic — worth checking whether it should surface earlier.

- Early growth is fast and capital-limited; the Ship Yard is the first real sink.
- Cislunar (Earth↔Moon) is far more time-efficient than Mars; the reason to fly
  far is meant to come from faction crises (wire their market mods) + bigger ships.
- The starter Courier is cislunar-only with cargo until you trade up (rocket
  equation is honest about cargo mass).
- Content in `src/data/` is still **draft** (a visible in-app notice says so);
  facts aren't source-verified yet (project rule 2 for the eventual educational use).
