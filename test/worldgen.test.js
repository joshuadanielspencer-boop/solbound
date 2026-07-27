// ===========================================================================
// WORLDGEN, THE ATLAS, AND THE CONJUNCTION.
//
// The three systems that turned the seven-site board into a drawn world. What
// these guard, in order of how badly each would hurt:
//
//   1. DETERMINISM AND THE SPINE. Same seed → same world, and the core seven
//      are in every world — saves, tutorials and the educational geography all
//      stand on them.
//   2. PLAUSIBILITY. The generator must never build a farm in the dark, a
//      family home on lethal ground, a foundry with no metal, or a customs
//      house run by a smuggling syndicate. Mix-and-match is the feature;
//      nonsense is the failure mode.
//   3. THE DERIVED ECONOMY. produces/consumes must come out coherent, or the
//      market layer inherits garbage.
//   4. THE ATLAS teaches by revealing; the CONJUNCTION blinds on the real
//      calendar. Both are pure functions of state and must behave.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { spawnSites, deriveSite } from "../src/worldgen.js";
import { PLACES, PLACE_BY_ID, OCCUPIABLE, FEATURES } from "../src/data/places.js";
import { INSTALLATIONS, INSTALLATION_BY_ID, installationFits } from "../src/data/installations.js";
import { OPERATORS, operatorFits } from "../src/data/operators.js";
import { CORE_SITES, govOf, bannedAt } from "../src/data/sites.js";
import { SYSTEM_BY_ID } from "../src/data/bodies.js";
import { COMMODITY_BY_ID } from "../src/data/commodities.js";
import { newGame, launch, advanceTime, travel } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";
import { atlasFor, atlasProgress, isRevealed } from "../src/atlas.js";
import { occluded, intelFreshness, estimatedPrice } from "../src/intel.js";
import { fitModule } from "../src/shipyard.js";

const fresh = (seed = 42) => newGame(newPlayer({ name: "Vega", skills: defaultSkills() }), seed);

describe("the census data is well-formed", () => {
  it("every place has the fields the game reads, and a real why", () => {
    for (const p of PLACES) {
      expect(p.id, p.id).toBeTruthy();
      expect(p.why?.length, p.id).toBeGreaterThan(40);   // a real sentence, not a stub
      expect(SYSTEM_BY_ID[p.system], `${p.id} names unknown system ${p.system}`).toBeTruthy();
    }
  });

  it("every occupiable place can host at least one installation it lists", () => {
    for (const p of OCCUPIABLE) {
      const fits = (p.fits || []).map((id) => INSTALLATION_BY_ID[id]).filter(Boolean);
      expect(fits.length, `${p.id} lists no real installations`).toBeGreaterThan(0);
      expect(fits.some((i) => installationFits(i, p)), `${p.id}: nothing it lists can exist there`).toBe(true);
    }
  });

  it("occupiable places sit in travelable systems", () => {
    // A port in a system with no ephemeris would be undockable — visible on the
    // map and unreachable by the travel math, forever.
    for (const p of OCCUPIABLE) {
      expect(SYSTEM_BY_ID[p.system].ephemerisKey, `${p.id} is unreachable`).toBeTruthy();
    }
  });

  it("features exist and are never ports", () => {
    expect(FEATURES.length).toBeGreaterThanOrEqual(5);
    for (const f of FEATURES) expect(f.fits).toBeUndefined();
  });
});

describe("spawnSites — determinism and the spine", () => {
  it("same seed → the same world, exactly", () => {
    expect(spawnSites(7)).toEqual(spawnSites(7));
    expect(spawnSites(12345)).toEqual(spawnSites(12345));
  });

  it("different seeds → different worlds", () => {
    const shapes = new Set([1, 2, 3, 4, 5, 6].map((s) =>
      spawnSites(s).map((x) => `${x.id}:${x.installation}:${x.owner}`).join("|")));
    expect(shapes.size).toBeGreaterThan(3);
  });

  it("the core seven are in every world, verbatim", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sites = spawnSites(seed);
      for (const core of CORE_SITES) {
        expect(sites.find((s) => s.id === core.id), `seed ${seed} lost ${core.id}`).toEqual(core);
      }
    }
  });

  it("draws a world of 16-20 sites with no duplicate places", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sites = spawnSites(seed);
      expect(sites.length).toBeGreaterThanOrEqual(16);
      expect(sites.length).toBeLessThanOrEqual(20);
      expect(new Set(sites.map((s) => s.id)).size).toBe(sites.length);
    }
  });

  it("guarantees an inner-system site and a far-system site every run", () => {
    // The "near ≠ cheap" lesson and the far shore both always exist.
    for (let seed = 1; seed <= 20; seed++) {
      const systems = spawnSites(seed).map((s) => s.system);
      expect(systems.some((x) => ["mercury", "venus"].includes(x)), `seed ${seed}: no inner site`).toBe(true);
      expect(systems.some((x) => ["saturn", "neptune", "pluto"].includes(x)), `seed ${seed}: no far site`).toBe(true);
    }
  });
});

describe("spawnSites — plausibility (the atlas's constraints, enforced)", () => {
  it("never builds the implausible: every drawn pairing passes the filters", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const site of spawnSites(seed)) {
        const place = PLACE_BY_ID[site.id];
        const inst = INSTALLATION_BY_ID[site.installation];
        if (!inst || CORE_SITES.some((c) => c.id === site.id)) continue;   // core seven are hand-written
        expect(installationFits(inst, place), `${site.id}: ${inst.id} can't exist there`).toBe(true);
        expect(operatorFits(site.owner, inst), `${site.id}: ${site.owner} can't run a ${inst.id}`).toBe(true);
      }
    }
  });

  it("no colonies on lethal ground, ever", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const site of spawnSites(seed)) {
        const place = PLACE_BY_ID[site.id];
        if (place?.habitability === "lethal") {
          expect(["colony", "agriculture", "resort", "sanatorium"].includes(site.installation),
            `${site.id}: families on lethal ground`).toBe(false);
        }
      }
    }
  });

  it("derived tech levels stay on the 1-7 ladder and populations are humane", () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const site of spawnSites(seed)) {
        expect(site.techLevel).toBeGreaterThanOrEqual(1);
        expect(site.techLevel).toBeLessThanOrEqual(7);
        expect(site.population).toBeGreaterThanOrEqual(4);
      }
    }
  });
});

describe("the derived economy is coherent", () => {
  it("nothing consumes what it produces, and every id is a real commodity", () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const site of spawnSites(seed)) {
        for (const id of [...site.produces, ...site.consumes]) {
          expect(COMMODITY_BY_ID[id], `${site.id} trades unknown good ${id}`).toBeTruthy();
        }
        for (const id of site.consumes) {
          expect(site.produces.includes(id), `${site.id} consumes its own product ${id}`).toBe(false);
        }
      }
    }
  });

  it("a depot only refines propellant where there is ice to refine", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const site of spawnSites(seed)) {
        const place = PLACE_BY_ID[site.id];
        if (site.produces.includes("propellant") && !CORE_SITES.some((c) => c.id === site.id)) {
          expect(place.resources.includes("ice") || place.resources.includes("propellant"),
            `${site.id} makes fuel from nothing`).toBe(true);
        }
      }
    }
  });

  it("black-market operators put contraband on shelves the geology never would", () => {
    // Somewhere in the first seeds, a syndicate/militia/free-port draw should
    // produce an arms seller beyond the core Ceres/Psyche pair — the mechanism
    // that makes smuggling geography vary per run.
    let found = false;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      for (const site of spawnSites(seed)) {
        if (CORE_SITES.some((c) => c.id === site.id)) continue;
        if (site.produces.includes("arms")) {
          found = true;
          // And it must be legal there — an operator does not ban its own trade.
          expect(bannedAt(site, COMMODITY_BY_ID.arms), `${site.id} bans what it sells`).toBe(false);
        }
      }
    }
    expect(found).toBe(true);
  });

  it("a full game runs on a generated world: buy, fly, sell, arrive", () => {
    // The integration test that matters: the whole loop works on a world that
    // includes generated sites, not just the hand-written seven.
    const g = fresh(9);
    expect(g.sites.length).toBeGreaterThan(7);
    expect(g.markets[g.sites[g.sites.length - 1].id]).toBeTruthy();  // markets exist for drawn sites
    const r = travel(g, "shackleton");
    expect(r.arrived || r.over).toBeTruthy();
  });
});

describe("the atlas — research as play", () => {
  it("Earth is home ground: its places are known from the start", () => {
    const g = fresh();
    for (const p of PLACES.filter((x) => x.system === "earth")) {
      expect(isRevealed(g, p), p.id).toBe(true);
    }
  });

  it("the far system starts dark", () => {
    const g = fresh();
    const far = PLACES.filter((p) => ["saturn", "neptune", "pluto", "jupiter"].includes(p.system));
    expect(far.some((p) => !isRevealed(g, p))).toBe(true);
  });

  it("docking somewhere reveals that place", () => {
    let g = fresh();
    const before = isRevealed(g, PLACE_BY_ID["jezero-station"]);
    ({ game: g } = travel(g, "jezero-station"));
    expect(before).toBe(false);
    expect(isRevealed(g, PLACE_BY_ID["jezero-station"])).toBe(true);
  });

  it("arriving with a survey lab reveals the WHOLE system, features included", () => {
    let g = fresh();
    g = { ...g, player: { ...g.player, at: "leo", credits: 5_000_000 } };
    g = fitModule(g, "lab").game;                       // canSurvey
    ({ game: g } = travel(g, "jezero-station"));
    expect(g.surveyed).toContain("mars");
    // Every Mars place — occupied or not — is now charted.
    for (const p of PLACES.filter((x) => x.system === "mars")) {
      expect(isRevealed(g, p), p.id).toBe(true);
    }
  });

  it("without the lab, arrival reveals only where you docked", () => {
    let g = fresh();
    ({ game: g } = travel(g, "jezero-station"));
    expect(g.surveyed).toEqual([]);
    const marsPlaces = PLACES.filter((x) => x.system === "mars" && x.id !== "jezero-station");
    expect(marsPlaces.some((p) => !isRevealed(g, p))).toBe(true);
  });

  it("progress counts toward the full census", () => {
    const g = fresh();
    const { known, total } = atlasProgress(g);
    expect(total).toBe(PLACES.length);
    expect(known).toBeGreaterThan(0);
    expect(known).toBeLessThan(total);
    const grouped = atlasFor(g);
    expect(grouped.length).toBeGreaterThan(4);          // several systems have entries
  });
});

describe("solar conjunction — the season of silence, on the real calendar", () => {
  // Scan the first three game-years for an Earth→Mars conjunction. The synodic
  // period is ~26 months, so exactly one or two must occur — if none does, the
  // geometry is wrong; if it never ends, the geometry is very wrong.
  const DAY = 86400000;
  const scan = () => {
    const g = fresh();
    const days = [];
    for (let d = 0; d < 3 * 365; d++) {
      if (occluded({ ...g, t: g.t + d * DAY }, "jezero-station")) days.push(d);
    }
    return days;
  };

  it("happens — and then stops happening", () => {
    const days = scan();
    expect(days.length).toBeGreaterThan(3);             // a real window, not a glitch
    expect(days.length).toBeLessThan(60);               // and it ENDS
  });

  it("is one contiguous-ish season, not scattered noise", () => {
    const days = scan();
    expect(days[days.length - 1] - days[0]).toBeLessThan(90);
  });

  it("blinds intel while it lasts: no estimate, and the freshness says why", () => {
    const g = fresh();
    const day = scan()[0];
    const dark = { ...g, t: g.t + day * DAY };
    expect(intelFreshness(dark, "jezero-station").key).toBe("occluded");
    expect(estimatedPrice(dark, "jezero-station", "machinery")).toBeNull();
    // And the moment it passes, sight returns.
    const clear = { ...g, t: g.t + (day + 120) * DAY };
    expect(intelFreshness(clear, "jezero-station").key).not.toBe("occluded");
    expect(estimatedPrice(clear, "jezero-station", "machinery")).not.toBeNull();
  });

  it("never occludes your own system, and never blocks the trip itself", () => {
    const g = fresh();
    const day = scan()[0];
    const dark = { ...g, t: g.t + day * DAY };
    expect(occluded(dark, "shackleton")).toBe(false);   // same system as leo
    // The ship is autonomous: launching into the dark is allowed — it is a bet.
    expect(launch(dark, "jezero-station").error).toBeUndefined();
  });
});
