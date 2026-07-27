// ===========================================================================
// FACTION SPAWN — the roguelike layer.
//
// The two things that would ruin it: a spawn that isn't reproducible (breaks
// save/load and shareable seeds) and a spawn that produces an incoherent world
// (two actors on one site, or the same run every seed). Both are pinned here.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { spawnFactions, factionAt, regionDanger, marketMods, worldBrief } from "../src/factions.js";
import { FACTIONS, FACTION_BY_ID, REGIONS } from "../src/data/factions.js";
import { SITE_BY_ID, SITES } from "../src/data/sites.js";
import { initialMarkets, priceAt, advanceMarkets } from "../src/market.js";
import { newGame } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";

describe("the pool is well-formed", () => {
  it("every faction can actually be placed somewhere", () => {
    // A faction whose homes don't resolve to a real site could never spawn —
    // dead content that quietly shrinks the draw.
    for (const f of FACTIONS) {
      const homes = f.homes.flatMap((h) => h === "any" ? ["leo"] : REGIONS[h] || [h]);
      const real = homes.filter((id) => SITE_BY_ID[id]);
      expect(real.length, `${f.id} has no real home`).toBeGreaterThan(0);
    }
  });

  it("covers all four archetypes, so a run can have a real mix", () => {
    const kinds = new Set(FACTIONS.map((f) => f.archetype));
    expect([...kinds].sort()).toEqual(["cultural", "economic", "military", "tech"]);
  });

  it("is big enough to make runs differ", () => {
    expect(FACTIONS.length).toBeGreaterThanOrEqual(12);
  });
});

describe("spawning is reproducible", () => {
  it("same seed → same run, every time", () => {
    // The whole save/load and shareable-seed story rests on this.
    expect(spawnFactions(12345)).toEqual(spawnFactions(12345));
    expect(spawnFactions(999, 5)).toEqual(spawnFactions(999, 5));
  });

  it("different seeds → different runs", () => {
    const runs = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) =>
      spawnFactions(s).map((p) => `${p.factionId}@${p.siteId}`).sort().join("|")));
    expect(runs.size).toBeGreaterThan(4);   // real variety, not the same board
  });
});

describe("a spawned world is coherent", () => {
  it("places the requested number of factions", () => {
    for (const n of [3, 4, 5]) expect(spawnFactions(42, n)).toHaveLength(n);
  });

  it("never puts two factions on the same site", () => {
    for (let seed = 0; seed < 40; seed++) {
      const placed = spawnFactions(seed, 5);
      const sites = placed.map((p) => p.siteId);
      expect(new Set(sites).size, `seed ${seed} double-booked a site`).toBe(sites.length);
    }
  });

  it("only places factions at their own possible homes", () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const p of spawnFactions(seed, 5)) {
        const f = FACTION_BY_ID[p.factionId];
        const homes = new Set(f.homes.flatMap((h) => h === "any" ? Object.keys(SITE_BY_ID) : REGIONS[h] || [h]));
        expect(homes.has(p.siteId), `${f.id} spawned at ${p.siteId}, not a home`).toBe(true);
      }
    }
  });

  it("tends to spread across archetypes rather than clumping", () => {
    // Not guaranteed every seed, but over the first several draws the mix should
    // usually span 3+ archetypes — that's what keeps a run from being all
    // pirates or all merchants.
    let mixed = 0;
    for (let seed = 0; seed < 20; seed++) {
      const arch = new Set(spawnFactions(seed, 4).map((p) => FACTION_BY_ID[p.factionId].archetype));
      if (arch.size >= 3) mixed++;
    }
    expect(mixed).toBeGreaterThan(14);   // the strong majority of runs are varied
  });
});

describe("the placed world reads back correctly", () => {
  it("factionAt finds who controls a site, and nobody where none is", () => {
    const placed = spawnFactions(7, 4);
    const occupied = placed[0].siteId;
    expect(factionAt(placed, occupied).factionId).toBe(placed[0].factionId);
    const empty = Object.keys(SITE_BY_ID).find((id) => !placed.some((p) => p.siteId === id));
    if (empty) expect(factionAt(placed, empty)).toBeNull();
  });

  it("a pirate region is more dangerous than a patrolled one", () => {
    // Construct the two extremes by hand so the test doesn't depend on the draw.
    const pirates = [{ factionId: "black-sun", siteId: "ceres-port", standing: -30 }];
    const patrol = [{ factionId: "sol-patrol", siteId: "leo", standing: 5 }];
    expect(regionDanger(pirates, "belt")).toBeGreaterThan(regionDanger(patrol, "earth"));
    // And a lawman actually makes his region safer than empty space.
    expect(regionDanger(patrol, "earth")).toBeLessThan(0.1 + 1e-9);
  });

  it("danger stays within bounds however many actors pile into a region", () => {
    const many = FACTIONS.slice(0, 6).map((f, i) => ({ factionId: f.id, siteId: `x${i}`, standing: 0 }));
    // (siteIds are fake here; regionDanger only reads faction danger by system,
    //  so this just checks the clamp holds under nonsense input.)
    const d = regionDanger(many, "belt");
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it("market modifiers come from the controlling faction", () => {
    const placed = [{ factionId: "helios-fuels", siteId: "phobos-depot", standing: 15 }];
    const mods = marketMods(placed, "phobos-depot");
    expect(mods.glut).toContain("propellant");   // Helios floods fuel where it sits
    expect(marketMods(placed, "leo")).toEqual({}); // and does nothing where it isn't
  });

  it("the opening brief names every actor and where it is", () => {
    const placed = spawnFactions(3, 4);
    const brief = worldBrief(placed);
    expect(brief).toHaveLength(4);
    for (const p of placed) {
      expect(brief.some((line) => line.includes(FACTION_BY_ID[p.factionId].name))).toBe(true);
    }
  });
});

// ===========================================================================
// WHERE THE DRAW REACHES PRICES.
//
// The faction layer described itself for a long time before it did anything:
// the newspaper announced a colony in crisis while its shelves priced exactly
// like everywhere else. These guard the wiring that closed that gap, and the
// specific bug it had on the way (a `demand` modifier silently ignored at any
// site that produced the good, because the producer branch won first).
// ===========================================================================
describe("the faction draw reaches the shelves", () => {
  const gameWith = (placed) => {
    const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), 7);
    const mods = Object.fromEntries(SITES.map((s) => [s.id, marketMods(placed, s.id)]));
    return { ...g, factions: placed, markets: initialMarkets(mods) };
  };
  const priceOf = (g, siteId, id) => priceAt(g.markets[siteId], SITE_BY_ID[siteId], id);

  it("a crisis makes a colony pay through the nose, geography be damned", () => {
    // Jezero GROWS food. A failed life-support chain doesn't care.
    const calm = gameWith([]);
    const starving = gameWith([{ factionId: "shortage", siteId: "jezero-station", standing: 15 }]);
    expect(priceOf(starving, "jezero-station", "food"))
      .toBeGreaterThan(priceOf(calm, "jezero-station", "food") * 2);
  });

  it("a glut makes its home the cheap place to fill up", () => {
    const calm = gameWith([]);
    const depot = gameWith([{ factionId: "helios-fuels", siteId: "phobos-depot", standing: 15 }]);
    expect(priceOf(depot, "phobos-depot", "propellant"))
      .toBeLessThan(priceOf(calm, "phobos-depot", "propellant"));
  });

  it("a demand eats into a producer's surplus instead of being ignored", () => {
    // The regression this exists for: `demand` used to do nothing wherever the
    // site already produced the good, so The First Martians could "want food"
    // on a world that grows it and move no number at all.
    const calm = gameWith([]);
    const proud = gameWith([{ factionId: "first-martians", siteId: "jezero-station", standing: -5 }]);
    expect(priceOf(proud, "jezero-station", "food"))
      .toBeGreaterThan(priceOf(calm, "jezero-station", "food"));
  });

  it("a faction can put a good on shelves the geology never would", () => {
    // ⚠ NO SHIPPED FACTION EXERCISES THIS YET, and that is worth knowing: with
    // only seven sites, every one of them already trades everything except
    // precision instruments, so `produces` has nothing left to add. The
    // mechanism is real and tested here directly; it becomes visible in play the
    // moment either the site list grows or a faction produces instruments.
    const plain = initialMarkets();
    const withMaker = initialMarkets({ "psyche-works": { produces: ["instruments"] } });
    expect(plain["psyche-works"].stock.instruments).toBeUndefined();
    expect(withMaker["psyche-works"].stock.instruments).toBeGreaterThan(0);
  });

  it("a crisis STAYS a crisis while the faction causing it is there", () => {
    // Supplying it should ease the price for a season and then have it starve
    // again — otherwise one delivery permanently solves a standing situation and
    // the reason to fly there evaporates.
    let g = gameWith([{ factionId: "shortage", siteId: "jezero-station", standing: 15 }]);
    const before = priceOf(g, "jezero-station", "food");
    // Dump a lot of food in.
    g = { ...g, markets: { ...g.markets, "jezero-station": {
      ...g.markets["jezero-station"],
      stock: { ...g.markets["jezero-station"].stock, food: g.markets["jezero-station"].stock.food + 400 },
    } } };
    expect(priceOf(g, "jezero-station", "food")).toBeLessThan(before);   // relief
    g = { ...g, markets: advanceMarkets(g.markets, 600) };
    expect(priceOf(g, "jezero-station", "food")).toBeGreaterThan(before * 0.9);  // and it comes back
  });
});
