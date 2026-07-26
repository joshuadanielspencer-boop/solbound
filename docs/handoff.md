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
> **What's built and playable** (217 tests, all pure-function + tested): the whole
> Space Trader floor. Living orrery with a drivable clock, your ship flying real
> transfer arcs and pausing on arrival; captain creation with 4 skills; markets +
> cargo + buy/sell with a house spread and cost-basis; **market intel** (see a
> destination's prices before you fly, freshness gated by light-lag); **system
> character** (tech level, government, danger) + a **newspaper** driven by
> factions and market shortages; **save/load** (versioned, migrating, autosave +
> file); and a **Ship Yard** (repair, fit modules, trade up hulls gated by port
> tech).
>
> **Do next: the encounter / risk layer.** This is the one big system missing, and
> it's what makes choices carry weight. The table already exists as data in
> `src/data/encounters.js`; the resolver does not. Build a **pure-function
> resolver** — `resolve(encounter, choice, context) → outcome` — where inputs are
> the choices that led to the fight (captain skills, ship fit, cargo, standing
> with whoever it is) and outputs are consequences that outlive it (cargo lost,
> hull damage → which the Ship Yard's repair already handles, fuel/time spent,
> reputation moved, a police record). Encounters fire **during transit**: roll
> against `factions.regionDanger()` per leg, pause the clock like an arrival, show
> the encounter, resolve the choice. Keep auto-resolve now; a tactical mini-game
> later must reuse the same resolver contract (design.md §10). Bring in
> **contraband + government law** here too — the `government.law` and site
> `techLevel`/owner data exist; illegal goods under some governments give the
> authority/inspection encounters teeth. Follow the project's discipline: pure
> functions, a real test file asserting outcomes and the anti-exploit cases, then
> wire the UI and verify in the browser.
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
- `save.js` — versioned envelope (**v3**), migration ladder, autosave, file import/export.
- `data/sites.js` — 7 sites with `techLevel`, `owner`; `TECH_LEVELS`, `GOVERNMENTS`.
- `data/commodities.js`, `data/hulls.js` (+ `minTech`, modules), `data/captain.js`.
- `trader/` — the UI: `splash`, `create`, `play` (Dock / Yard / Course tabs), `index`.
- `data/encounters.js` — the encounter TABLE (data only; resolver not built).

**Test the whole thing:** `npm test` (217 passing). **Run it:** the browser
preview via `.claude/launch.json` server `solbound-dev` (port 5273), or `npm run
dev`.

## The roadmap after encounters (from the Space Trader screenshot analysis)

Ranked, once the risk layer lands:
1. **Reputation as a visible track** — per-faction `standing` already exists in
   state; surface who likes you and what it unlocks.
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

- Early growth is fast and capital-limited; the Ship Yard is the first real sink.
- Cislunar (Earth↔Moon) is far more time-efficient than Mars; the reason to fly
  far is meant to come from faction crises (wire their market mods) + bigger ships.
- The starter Courier is cislunar-only with cargo until you trade up (rocket
  equation is honest about cargo mass).
- Content in `src/data/` is still **draft** (a visible in-app notice says so);
  facts aren't source-verified yet (project rule 2 for the eventual educational use).
