# SOLBOUND

**A single-player economic-strategy game set in the real solar system.**

> *Everything is bound to Sol.*

You begin with one ship, a modest purse, and an umbilical to Earth. You buy
where a good is cheap, cross real orbits at a real fuel-and-time cost, and sell
where it is dear. You end as part of the reason people can live out here at all.

**Play it:** https://joshuadanielspencer-boop.github.io/solbound/

Read [`docs/design.md`](docs/design.md) first — it is the whole plan.
[`docs/handoff.md`](docs/handoff.md) is the working log.

```bash
npm install
npm run dev     # → http://localhost:5173/  (set PORT to pin another)
npm test        # 549 tests across 26 files
npm run build
```

**Desktop only.** Phones and tablets are explicitly out of scope — the game is a
map beside a panel, and that does not survive a narrow window.

## The two ideas it is built on

**The map is delta-v, not distance.** How far apart two places are in kilometres
barely matters; what matters is the velocity change to get between them, and
when the geometry permits it cheaply. Ceres is far and cheap to land on. Mercury
is near and brutally expensive. Learning that "far" and "hard" are different
words is the single most useful thing this game can teach.

**Trade is dependency, not arbitrage.** At 5.6 km/s and eight months to Mars,
with roughly 72% of the departing vehicle being propellant, buy-low-sell-high in
bulk ore is false. What actually crosses the solar system is high value per
kilogram and impossible to make locally. So the early game is running the
umbilical — and the campaign is about severing it. Every production chain you
stand up is one fewer thing that must be shipped, which makes ISRU the victory
condition rather than a tech unlock.

## What is in it

- **A living orrery.** Real JPL Keplerian elements for all eight planets and
  Pluto. Ships fly true transfer ellipses, Kepler-solved, while the planets move
  under a clock you can hurry, slow, skip or pause.
- **A rocket-equation fuel gauge.** Five drives across four propulsion eras. A
  trip needs a Δv; your dry-plus-cargo mass and your drive turn that into a
  tonnage of propellant. If the tank cannot hold it, the trip is impossible
  however much money you have — and a fuller hold reaches fewer ports.
- **A drawn world.** 7 core ports plus 9–13 more drawn from a 50-place census,
  so every seeded run has a different map over fixed real geography. Factions,
  operators and installations are drawn with them.
- **Markets that model dependency**, with damping and bounds from the first
  commit, faction modifiers, contraband and customs.
- **Production chains.** 13 processes across power, extraction, refining and
  fabrication. A cargo eases a shortage for a season; a **plant moves the site's
  equilibrium**, which cures it. Solar output falls as 1/r² off each site's real
  light level, so the array that runs an electrolysis plant at Luna cannot run
  one at Titan.
- **Three map scopes** — orrery → system → surface. Every body carrying a port
  opens its own surface map: this run's ports at real IAU coordinates, 320
  generated landmarks across 17 worlds, and the real terminator over both.
- **Encounters** — police, pirates, traders, inspections — resolved as pure
  functions, with an escape pod as the answer to death.
- **Procedural audio.** The whole soundtrack and every sound effect are
  synthesised from scores in `src/data/`. There are no audio files in this repo.
- **Saves** with a versioned migration chain (currently v10), autosave, named
  slots, and export/import to a file.

Behind `#/codex` are the systems on their own — the rocket equation, the
transfer planner, day/night, the market model — plus the earlier survey-game
demo this project grew out of.

## What it does not have yet

**No ending.** Both victory conditions are designed and neither is implemented:
the short **Run** (get rich and retire under a clock) and the long **Campaign**
(sever Earth-dependency). `importDependency()` measures the second one and
nothing checks it.

Also absent: missions and contracts, rivals, a tactical combat layer, and any
onboarding — the first ten minutes currently hand you every system at once. No
PWA or offline support. No mobile layout.

## Accuracy

The project rule is: **never invent a number.** Every fact is sourced,
generated, or explicitly labelled speculation, in three categories the game
distinguishes on screen — **fact** (measured), **abstraction** (a game system
standing in for a real process), **speculation** (invented futures, labelled).

`npm test` checks the physics against **independently published values**, never
against itself:

- **Ephemeris** — the Mars, Jupiter and Saturn oppositions of 2024–25, Earth's
  perihelion and aphelion distances, every sidereal period, and Pluto's 1979–99
  excursion inside Neptune's orbit. Opposition agreement is **0.22°–0.30°**,
  which is the half-day slop from testing dates published to the day, not table
  error.
- **Transfers** — the textbook Earth→Mars figures (259 days, 44°, 5.6 km/s) and
  the Earth–Mars / Earth–Venus / Earth–Jupiter synodic periods to the day.
- **Trajectories** — two invariants a straight-line fake would fail: exactly
  180° of longitude swept, and visibly faster near the Sun.
- **Bodies** — Ceres' and Vesta's obliquities derived from JPL SBDB poles
  (spin axis rotated equatorial→ecliptic, dotted with the orbit normal), landing
  on the published ~4° and ~27°.
- **Illumination** — published day lengths, that exactly half a world is lit at
  any moment, that polar night happens, and that the drawn terminator agrees
  with the rule the game enforces.
- **The economy** — that a delivery's effect decays and a plant's does not, and
  that supplying a shortage cures it and the income falls. Both are design
  claims, held by tests.
- **The UI** — a jsdom smoke test opens every tab, every screen, every system
  and all seventeen surface maps, and **fails on any `console.error`**.

This matters more than it looks. A broken ephemeris still draws a solar system
that goes round, and every number the game teaches would be quietly wrong.

### Known accuracy debt

- `DELTA_V_FROM_LEO` is **invented** — labelled in code as "ordering, not
  quotes". For a game whose map *is* delta-v, it needs real sourced edges.
- The ephemeris horizon is **2050** (Standish Table 1 is valid 1800–2050). A
  multi-century campaign needs the 3000 BC–3000 AD tables.
- `src/data/features.js` was hand-written from memory and is being regenerated
  from the IAU Gazetteer. Four of its coordinates were already found to be west
  longitudes recorded as east. `scripts/check-feature-coords.mjs` now holds the
  file against the gazetteer and exits non-zero on disagreement.
- Rotational phase is **not epoch-anchored**. Day *length* and *season* are
  real; which meridian faces the Sun on a given date is not. The game may teach
  the former and must not claim the latter.

## The two project rules

1. **All content lives in `src/data/`**, never inline in a component.
2. **Every fact must be accurate and verifiable** before it ships. If it cannot
   be sourced, it is speculation and must be marked as such.

Two more that have joined them: accessibility is required (keyboard parity for
every hover, colour never the only carrier of meaning, visible focus), and
`npm test` **and** `npm run build` pass before every commit.

## Body plates

`public/plates/<body>.jpg` — global equirectangular mosaics, 2:1. Currently
**Mars, Mercury, Europa, Enceladus and Luna**, all public domain.
`node scripts/fetch-plates.mjs` fetches them from a manifest whose every entry
was licence-checked by hand; the script's header records what is deliberately
absent and why. Two real traps it documents:

- **Titan's** best global mosaic on Commons is *Attribution*, not public domain —
  Cassini is a joint NASA/ESA mission and ESA's default is CC BY-SA 3.0 IGO.
- **"Callisto Hemispherical Globes"** is 2:1 and is two circles on a black
  field, not a cylindrical map. It passes an automated aspect check and would
  put every pin somewhere it isn't. A human has to look at each plate once.

## Layout

Every file carries a header explaining what it is and why it is shaped that way.

```
src/
  ephemeris.js     JPL Keplerian elements + Kepler solve. The file everything stands on.
  transfer.js      Hohmann transfers, launch windows, light lag. What it costs to go.
  propulsion.js    The rocket equation, five drives, four eras, feasibility.
  tradergame.js    The trade loop as one pure, serialisable state.
  market.js        Prices, supply, demand, damping. The economy's core.
  industry.js      Production chains. A plant moves the site's equilibrium.
  worldgen.js      The seeded draw: which places exist this run.
  encounters.js    Police, pirates, inspections. Pure resolution.
  factions.js  reputation.js  crew.js  shipyard.js  intel.js
  illumination.js  Day/night, seasons, sun angle, polar night.
  orrery.js  surface.js  starfield.js  atlas.js  worldinfo.js
  sim.js           Clock, fleet, events. Pure and testable.
  rng.js           The one RNG. Seeded runs are reproducible.
  save.js          Versioned saves + the migration chain.
  audio.js         The whole soundtrack, synthesised. No audio files.
  app.jsx          Router: the game, and #/codex behind it.
  wanderer.jsx     The earlier survey-game demo.
  trader/          The game's screens (play, panels, surface, ui, saves, …).
  labs/            The codex sandboxes.
  data/            ALL content. bodies, places, commodities, industry, crew,
                   factions, hulls, encounters, music, sfx, landmarks, …
public/plates/     Global equirectangular body maps (PD; see fetch-plates.mjs).
scripts/           Plate fetching, coordinate generation, gazetteer checks.
test/              549 tests across 26 files.
docs/
  design.md        The master design. §12 locked decisions, §16 accuracy policy.
  handoff.md       The working log — where things stand, open decisions.
  astronomy.md     The curriculum audit and the build order it proposes.
  manual.md        The player-facing manual.
  site-atlas.md    The census.
```

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/`. `npm test` gates the deploy — a build that skips the
ephemeris suite is worse than no build. The bundle is 518 kB (172 kB gzipped).

Verify a deploy **by content**, not by CI going green: `curl` the deployed JS
and grep for a string literal you just added. Constant names are minified away;
string literals survive.
