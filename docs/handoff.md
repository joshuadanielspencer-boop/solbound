# SOLBOUND — session handoff

Paste the "Prompt for the next session" block below into a fresh thread. The rest
of this file is the detail that block points at.

---

## Prompt for the next session

> You're continuing work on **SOLBOUND**, a single-player economic-strategy game
> set in the real solar system, in the repo at `~/Dropbox/Solbound` (its own git
> repo, a sibling of Shutterbug, no shared code). It's **live** and auto-deploys
> on push to `main`: https://joshuadanielspencer-boop.github.io/solbound/
>
> **Read first, in order:** `docs/design.md` (the master design — SOLBOUND, the
> trade/colony game; NOT the archived `docs/design-survey-era.md`), then
> `docs/handoff.md` (this file's detail sections), then skim `src/` — it's small,
> tested, and every file has a header explaining itself.
>
> **What the game is:** Space Trader's loop (create a captain, buy where a good is
> cheap, cross real orbits at a real fuel-and-time cost, sell where it's dear,
> upgrade) on the real solar system, with real orbital mechanics, the rocket
> equation as the fuel model, a scarcity-priced economy where **trade is
> DEPENDENCY not arbitrage** (bulk goods can't ship; only high value-per-kg
> crosses the system), and a roguelike **faction** layer that rolls a different
> world each seed over the fixed (educational) geography.
>
> **What's built and playable** (269 tests, all pure-function + tested): the whole
> Space Trader floor. Living orrery with a drivable clock, your ship flying real
> transfer arcs and pausing on arrival; captain creation with 4 skills; markets +
> cargo + buy/sell with a house spread and cost-basis; **market intel** (see a
> destination's prices before you fly, freshness gated by light-lag); **system
> character** (tech level, government, danger) + a **newspaper** driven by
> factions and market shortages; **save/load** (versioned, migrating, autosave +
> file); a **Ship Yard** (repair, fit modules, trade up hulls gated by port
> tech); and the **encounter / risk layer** — trouble in transit, resolved by a
> pure function, with customs duty on controlled cargo.
>
> **Do next: reputation as a visible track, then missions.** Standing now MOVES
> (encounters write it) but nothing surfaces it — see the ranked roadmap below.
>
> Work the way the existing commits do: small tested increments, honest commit
> messages that say what was found (not just done), and `npm test` + `npm run
> build` before every commit. The user plays and gives feedback between features;
> flag balance/feel questions for playtest rather than blind-tuning.

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
- `market.js` — scarcity prices that can't run away (mean-revert to equilibrium), `avgPrice` (structural), `equilibriumStock`.
- `player.js` — captain, ship, cargo, credits, buy/sell, cost basis, `priceToBuy/Sell`.
- `tradergame.js` — the game state + the living clock: `newGame`, `launch`, `advanceTime`, `travel` (headless), `refuel`, `shipPosition`, `RATES`.
- `intel.js` — market intel: `runPlan`, `cargoValueAt`, `intelFreshness` (light-lag).
- `factions.js` / `data/factions.js` — the roguelike spawn (`spawnFactions`, `regionDanger`, `factionAt`, `marketMods`).
- `worldinfo.js` — `systemInfo` (tech/gov/danger/pressure) + `generateNews`.
- `shipyard.js` — `shipsForSale`, `buyShip`, `fitModule`/`removeModule`, `repairHull`.
- `save.js` — versioned envelope (**v4**), migration ladder, autosave, file import/export.
- `data/sites.js` — 7 sites with `techLevel`, `owner`; `TECH_LEVELS`, `GOVERNMENTS`
  (each with `law`, `controls`, `duty`).
- `data/commodities.js` (+ `CONTROLS` and per-commodity `control`), `data/hulls.js`
  (+ `minTech`, modules), `data/captain.js`.
- `trader/` — the UI: `splash`, `create`, `play` (Dock / Yard / Course tabs), `index`.
- `data/encounters.js` — the encounter TABLE, the `RECORDS` ladder, salvage finds.
- `encounters.js` — **the resolver**: `resolve(encounter, choice, context) → outcome`,
  plus `rollLegEvent`, `applyOutcome`, `resolveEncounter`, `controlledCargo`.

**Test the whole thing:** `npm test` (269 passing). **Run it:** the browser
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
- **Contraband is a DUTY, not a crime.** Controlled goods (nuclear / pharma /
  dual-use — all three are real export-control categories) are legal to carry and
  legal to sell; a strict port wants its paperwork and a percentage. The police
  record is earned by RUNNING from a patrol, never by what's in the hold. The
  alternative — "delivering medicine to a colony is a crime" — teaches the wrong
  thing. Whether SOLBOUND also wants genuine illegal goods (Space Trader's
  firearms/narcotics, profitable *because* banned) is **an open call for Joshua**;
  it would need a new commodity and a tonal decision.
- **Standing lives on `game.factions[].standing`**, which is where the spawn put
  it. `player.reputation` is a vestigial empty field — don't start a second source
  of truth in it.

## The roadmap after encounters (from the Space Trader screenshot analysis)

Ranked, now that the risk layer has landed:
1. **Reputation as a visible track** — per-faction `standing` exists AND now moves
   (encounters write it), but nothing shows it. Surface who likes you and what it
   unlocks. This is the cheapest big win on the list.
2. **Missions / contracts** — a mission board (freight, passengers, survey,
   bounty). Factions already have `offers`. Gives directed goals and income.
3. **Wire faction market modifiers** — `factions.marketMods()` exists but isn't
   applied to prices yet; doing so makes a blockade/crisis actually spike prices,
   deepening "why go far."
4. **Prospecting/mining** — the survey-mode camera as the tech tree: "you can't
   build where you haven't surveyed." Mining rig + survey lab modules exist.
5. **Art** — ship sprites per hull, a captain portrait, the encounter face-off
   screen. Pure polish; independent of systems.
6. **Deferred infra debt:** the 2050 ephemeris horizon (swap to Standish's
   3000 BC–3000 AD tables for a multi-century campaign), and the invented
   `DELTA_V_FROM_LEO` graph (source a real one).

## Design decisions locked (don't relitigate)

- Two victory conditions = two modes: a short **Run** (get rich, retire, under a
  clock) and a long **Campaign** (sever Earth-dependency, become infrastructure).
  Same engine; victory + time cap are data. (Only Campaign-ish exists so far.)
- The player is a **customisable captain** (name, 4 skills), not a faceless company.
- Keep **SVG/React**, not Canvas — accessibility beats sprite throughput at this scale.
- **Advance-to-next-decision** pacing with continuous animated time, not literal turns.
- Real physics stays **under the hood** — never a design-your-own-rocket screen.

## Known balance notes for playtest (not blind-tuned)

- **Encounter frequency on long legs.** The hazard rate is per-month-exposed, so
  an 8–9 month Mars run in *quiet* space still comes out around 45–50%, and a
  playtest hit trouble on two consecutive Mars legs. That may be right (it makes
  the long haul feel long) or it may be nagging — it's one constant,
  `encounterChance`'s `0.08` base per month.
- **Duty rates** (3–6% of controlled-cargo value) are a first guess. On a 2 t
  electronics run to Jezero the duty came to ~$58k against ~$1.7M of cargo, which
  felt like a real but survivable toll. Untested at freighter scale.
- **Whether death should be a hard end.** Losing the ship currently ends the run
  and clears the autosave. The gentler alternative — escape pod, wake up broke at
  the nearest port with a starter Courier — keeps a long campaign alive. Joshua's
  call; the resolver already reports `destroyed` either way.

- Early growth is fast and capital-limited; the Ship Yard is the first real sink.
- Cislunar (Earth↔Moon) is far more time-efficient than Mars; the reason to fly
  far is meant to come from faction crises (wire their market mods) + bigger ships.
- The starter Courier is cislunar-only with cargo until you trade up (rocket
  equation is honest about cargo mass).
- Content in `src/data/` is still **draft** (a visible in-app notice says so);
  facts aren't source-verified yet (project rule 2 for the eventual educational use).
