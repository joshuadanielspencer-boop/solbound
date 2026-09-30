# SOLBOUND — decisions

One table for every decision that is open, awaiting playtest, or answered and
kept for the record. This replaces three sections that used to sit at the end
of `handoff.md` — "Awaiting Joshua's feedback", "Open decisions" and "Known
balance notes" — which carried the same dozen items three times over, and
which every session re-read and re-stated. Now each item is here once, with a
status, and the handoff links to it.

**Status key:** `OPEN` — asked, unanswered · `UNTESTED` — built on a first
guess, needs a playthrough, do NOT blind-tune · `ANSWERED` — settled, with the
call recorded · `LOCKED` — in `design.md` §12, do not relitigate · `DEBT` —
infrastructure that must be paid, not a choice.

Surface an `OPEN` item when it becomes relevant rather than building past it.
Change an `UNTESTED` number only after someone has played against it.

---

## Design questions

| Decision | Status | Where it stands |
|---|---|---|
| **Difficulty** — the pause menu cycles a value that is wired to nothing | `OPEN` | `design.md` §12 explicitly declined difficulty settings ("our difficulty is the rocket equation and the faction draw"). Joshua asked for the control. Needs revisiting properly, not quietly overturning. Recommendation on record: delete the control, or make it *charter length* in Run mode, which is data and consistent with §12. |
| **What standing should BUY** beyond the ±40 talk-down bonus | `OPEN` | Candidates named on the Standing screen rather than built: a friendly port's tariff, contracts gated on trust, a region that turns hostile. |
| **Boil-off as a mechanic at all** | `OPEN` | True, and it makes the hydrogen eras a decision rather than a straight upgrade — but the best drive in the game punishes long coasts unless a gadget bay goes to a cryocooler. |
| **The drive ladder stopping at NTR** | `OPEN` | NEP and the torch are shown with reasons, not sold. Leaves the outer system shut — which may be right (it is what ISRU and depots are *for*) or may read as a dead end. |
| **Survey lab as instrument vs. survey MISSIONS** | `OPEN` | Today the lab reveals a system on arrival. Whether surveying should also be contracted work is unanswered, and missions are unbuilt. |
| **The cycler** | `OPEN` | Atlas-only until the travel model has phasing. Deferred, not declined. |
| **Missions vs. production chains** — which first | `ANSWERED` 2026-07-28 | Production chains. Built. Missions now have somewhere to point. |
| **Surface map scope** | `ANSWERED` 2026-07-28 | Every body with a placed port, with generated IAU landmarks as context. Built. |
| **The lunar plate** | `ANSWERED` 2026-07-28 | NASA SVS CGI Moon Kit, public domain, poles filled. In the manifest. |
| **Course tab after the map/panel merge** | `ANSWERED` 2026-07-28 | Kept as a sortable table (soonest / cheapest / best paid). The map answers *where*; a table answers *which of these eighteen*. Trip lengths are bimodal (~26% six-day hops, ~70% six months to years), so the comparison is a column of numbers. |
| **"Not sold" rows on the market** | `ANSWERED` | Built, then removed at Joshua's call: a thing you cannot act on is not a choice. What you cannot *afford* still shows, because that is one. |
| **Sound effects** | `ANSWERED` 2026-07-28 | Proposed, core built, procedural like the music. `alert`, `damage`, `caught` still never heard in a real encounter → see UNTESTED. |
| Two victory conditions = two modes (Run / Campaign), data not code paths | `LOCKED` | `design.md` §12. Neither implemented as of 2026-09-30; Run mode is next. |
| Customisable captain, not a faceless company | `LOCKED` | `design.md` §12. Built. |
| SVG/React, not Canvas | `LOCKED` | Accessibility beats sprite throughput at this scale. |
| Advance-to-next-decision pacing over continuous animated time | `LOCKED` | Time always runs in port; see `play.jsx` for the reasoning. Exception: a player whose OS asks for reduced motion gets a held docked clock (2026-09-23). |
| Real physics under the hood, never a design-your-own-rocket screen | `LOCKED` | |
| Desktop window only | `LOCKED` | Phones get a card saying so (2026-09-23), not a broken layout. |

## Balance — built on first guesses, none playtested

Every number here is a guess that has never met a player. **Do not tune blind.**
The constant that owns each one is named so a playtest can go straight to it.

| Item | Status | The guess, and what to watch |
|---|---|---|
| **Escape pod** at $35,000 as the answer to death | `UNTESTED` | Meant to sting on a starter purse and be beneath notice later. Only unit-tested; nobody has lost a ship in play. |
| **Crew wages vs. early capital** — the one to watch | `UNTESTED` | One $320/day hire turns a 9-month Mars run into ~$86k of wages, more than a starter's cargo. Either the best pressure in the game (a crew commits you to short routes until you are rich) or a trap. Cheapest hire is Prakash at $130; wages are per-crew in `data/crew.js`. |
| **Encounter frequency** ~45–50% per quiet Mars leg | `UNTESTED` | Per-month-exposed hazard; a playtest hit trouble on two consecutive Mars legs. Right (the haul feels long) or nagging. One constant: `encounterChance`'s `0.08`/month. |
| **Contraband**: arms/fissiles; fine 0.35× value; 3.15× legal/banned spread | `UNTESTED` | Fissiles $3.68M/t at Ceres vs $11.6M/t banned. Arms carry the same spread at a tenth the stake — the sane first run. Constants: `equilibriumRatio`'s 0.15 floor, `illegalCargo`'s 0.35. |
| **Contraband is mid-game by geography** | `UNTESTED` | Both source ports (Ceres, Psyche) are out of a starter Courier's range. Seems right; means a new player never sees the mechanic. |
| **Duty rates** 3–6% of controlled-cargo value | `UNTESTED` | ~$58k on ~$1.7M of electronics to Jezero — real but survivable. Untested at freighter scale. |
| **Paid newspaper** $150 + $90 × tech ($780 Gateway, $330 Callisto) | `UNTESTED` | Trivial next to any cargo; the point is the act. If it reads as pure tax, make it free at the home port. |
| **Slot kinds** — a Courier can never mount a shield; only the Cutter fights | `UNTESTED` | |
| **The Courier gained a bay** (1 weapon + 2 gadget) | `UNTESTED` | Watch whether the first hour is now too comfortable. |
| **Crew pool**: 12 named hands, tech-gated, 40-day refresh | `UNTESTED` | |
| **Drive prices**: hydrolox $260k, NTR $1.8M, trade-in 45% (`DRIVE_RESALE`) | `UNTESTED` | Sited past the Ship Yard as the next mountain. Whether $1.8M is "a campaign's savings" or "twenty minutes of contraband" depends on how the mid-game earns — unplayed. |
| **Boil-off rates**: 0.16%/day hydrolox, 0.13%/day NTR, cryocooler ×0.1 (`CRYO_FACTOR`) | `UNTESTED` | Physics defensible (passive LH2 tankage is in this range). A Mars coast costs ~30% of the reserve; if that reads as nagging, it is two numbers in `DRIVES`. |
| **Cryocooler** $140k in a gadget bay | `UNTESTED` | Competes with the drop tank and the survey lab — meant to. |
| **Standing tiers** | `UNTESTED` | Bands chosen so the data's own dispositions read true (hostile opens at Distrusted, friendly at Welcome). |
| **Wait steps** +7 / +30 / +90 days | `UNTESTED` | Free without a crew, which may be too free. The counter-pressure is meant to be the calendar, and there is no career clock yet → Run mode. |
| **Conjunction**: 3° threshold ≈ 18-day blackout; intel fully dark; flying allowed | `UNTESTED` | |
| **Atlas reveal rules**: Earth free; docking reveals a place; a lab reveals a system | `UNTESTED` | |
| **Industry balance** — build costs, throughputs, the 90/day-per-head plant wage | `UNTESTED` | Entirely unplayed. Whether a $260,000 solar farm against a $300,000 purse is the right first mountain. |
| **The drawn world's tone** — 16–20 sites, operator names ("The Quiet Company"), place names, census content | `UNTESTED` | |
| **SFX levels**, and `alert` / `damage` / `caught` in particular | `UNTESTED` | Never heard in a real encounter. |
| Early growth is fast and capital-limited; the Ship Yard is the first sink | `UNTESTED` | Observation from the one early playtest. |
| Cislunar is far more time-efficient than Mars | `UNTESTED` | The reason to fly far is meant to come from faction crises and bigger ships. |

## Infrastructure debt

| Item | Status | Why it is debt, not a choice |
|---|---|---|
| **`DELTA_V_FROM_LEO` is invented** — labelled "ordering, not quotes" | `DEBT` | In a game whose first principle is *the map is delta-v*, the map is made up. Both external briefs flagged it independently. Needs real sourced edges. |
| **Ephemeris horizon is 2050** (Standish Table 1, 1800–2050) | `DEBT` | Joshua said multi-mission long games are the goal, so this is now genuinely blocking, not deferred. Needs the 3000 BC–3000 AD tables and their correction terms. |
| **`data/features.js` is hand-written from memory** | `DEBT` | Four coordinates were already found to be west longitudes recorded as east. Regenerate from the gazetteer, do not patch. `scripts/check-feature-coords.mjs` holds it and exits non-zero on disagreement. |
| **Rotational phase is not epoch-anchored** | `DEBT` | Day *length* and *season* are real; which meridian faces the Sun today is not. The game may teach the former and must not claim the latter. |
| **Content in `src/data/` is draft** | `DEBT` | A visible in-app notice says so. Rule 2 verification pass against primary sources before anything reaches a child. |
| **No LICENSE file** | `OPEN` | Public repo, all-rights-reserved by default. Joshua's call. |
| **Dependencies drifting** — Vite 5→8, React 18→19, vitest 4→5 | `DEBT` | Zero vulnerabilities; deprecation warnings on every build. One deliberate session rather than a forced one. |
| **`node_modules` inside Dropbox** | `OPEN` | A selective-sync setting on Joshua's machine, not a repo change. |
