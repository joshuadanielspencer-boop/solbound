# SOLBOUND — session handoff

Paste the "Prompt for the next session" block below into a fresh thread. The rest
of this file is the detail that block points at.

---

## Prompt for the next session

> You're continuing work on **SOLBOUND**, a single-player economic-strategy game
> set in the real solar system, repo at `~/Dropbox/Solbound` (its own git repo, a
> sibling of Shutterbug, no shared code). LIVE at
> https://joshuadanielspencer-boop.github.io/solbound/ — **but note: ~8 commits
> are LOCAL and UNPUSHED** (push auto-deploys; Joshua decides when).
>
> **Read first, in order:** `docs/design.md` (master design), `docs/site-atlas.md`
> (the researched census of ~60 real places + the Space Trader benchmark), then
> `docs/handoff.md` (this file — especially "Where things stand", "How the
> encounter layer works", the roadmap, and "Known balance notes"). Then skim
> `src/` — every file has a header explaining itself.
>
> **What the game is:** Space Trader's loop on the real solar system — captain,
> buy/fly/sell across real orbits priced by the rocket equation, an economy where
> trade is DEPENDENCY not arbitrage, and a roguelike draw over fixed real
> geography.
>
> **What's built** (348 tests, all pure functions + a thin React UI):
> the full trade loop on a living orrery · market intel gated by light-lag AND
> **solar conjunction** (real geometry; ~2-week blackouts) · system character with
> police/pirates as separate readings · paid newspaper · save/load (**v8**,
> migration ladder) · Ship Yard with weapon/shield/gadget bays + **escape pod** ·
> **crew** (best hand aboard does the job) with **daily wages** · the
> **encounter/risk layer** (pure resolver, SVG face-off art, customs duty on
> controlled goods, TRUE CONTRABAND — arms/fissiles legal at free ports, seized
> under strict law) · faction market mods wired to prices · and **the drawn
> world**: `worldgen.spawnSites(seed)` draws 9–13 sites from the census around
> the immortal core seven (place × installation × operator, all derived), with
> the **Atlas tab** revealing real places by docking or survey-lab sweeps.
>
> **Do next, in this order unless Joshua redirects:**
> 1. **Reputation as a visible track** — standing moves in five places, shows
>    nowhere. Cheapest big win.
> 2. **Missions/contracts board** — factions have `offers`, operators have
>    personalities, and the drawn world finally gives missions somewhere to go.
>    Include survey contracts (the atlas is the reward track) and Sunless-Sea
>    style "port report" pay for first visits.
> 3. **Drive eras as purchases** — DRIVES exist in propulsion.js but there is no
>    buy path; the player's ship is methalox forever. Nuclear-thermal at a
>    high-tech yard is what opens Saturn (5.6yr/551t today) and IS the campaign
>    spine (design.md §8). Consider alongside: launch-window discounts, and the
>    Aldrin cycler once phasing exists.
> 4. Small UX from the Space Trader pass: a WAIT button (wait() has no UI), a
>    range readout, "not sold" rows.
> 5. See "Suggestions from the wider-games research" in this file for the
>    researched backlog (rare/provenance goods, debt & insurance, aging arc,
>    event director, fact-unlocks).
>
> **Balance items awaiting Joshua's playtest** are listed under "Known balance
> notes" — do NOT blind-tune them. Several design decisions have had NO feedback
> yet (see "Awaiting feedback" section); surface them when relevant rather than
> treating them as settled.
>
> Work the way the existing commits do: small tested increments, honest commit
> messages that say what was FOUND (not just done), `npm test` + `npm run build`
> before every commit, and verify UI changes in the browser preview
> (`solbound-dev`, auto-port).

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
- **~8 unpushed commits** — pushing deploys; his call.

## Known balance notes for playtest (not blind-tuned)

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
