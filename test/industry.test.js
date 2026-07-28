// ===========================================================================
// INDUSTRY — the campaign's spine.
//
// The claims worth defending, in the order they matter:
//
//   1. A PLANT CURES, A CARGO EASES. This is the whole design (design.md §5).
//      A delivery is dragged back to the site's equilibrium by advanceMarkets; a
//      plant MOVES that equilibrium. If this test ever passes for a delivery
//      too, the difference between trading and building has collapsed.
//   2. THE INCOME DECAYS. Deliberately. Supplying a shortage cures it and the
//      price falls, and a test that demanded rising revenue would be arguing
//      with the thesis.
//   3. GEOGRAPHY STILL DECIDES. No ice mine where there is no ice. The census is
//      load-bearing or it is decoration.
//   4. SUNLIGHT FALLS AS 1/r². The same solar farm that runs a plant at Luna
//      cannot run one at Saturn, and that is what gates the outer system.
//   5. A CHAIN IS A CHAIN. An electrolysis plant with no ice under it throttles.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  build, canBuild, tickIndustry, powerAt, powerFactor, dailyFlows,
  ownedProduces, importDependency, umbilicalReport, buildOptions,
  worksAt, isOnline, daysLeft, lightAt, industryWages,
} from "../src/industry.js";
import { PROCESS_BY_ID, PROCESSES, H2_FRACTION, O2_FRACTION, powerSupplied } from "../src/data/industry.js";
import { newGame, advanceTime } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { priceAt, advanceMarkets, equilibriumStock } from "../src/market.js";
import { siteOf } from "../src/data/sites.js";
import { PLACE_BY_ID } from "../src/data/places.js";

const DAY = 86400000;

/** A game with money and somewhere it has been. */
function rich(credits = 50_000_000, at = "shackleton") {
  const g = newGame(newPlayer({ name: "Builder" }), 42);
  return {
    ...g,
    player: { ...g.player, credits, at },
    visited: [...new Set([...g.visited, at])],
  };
}

describe("the chemistry is the chemistry", () => {
  it("splits water by the atomic weights, not by a game number", () => {
    // H2O = 2 x 1.008 + 15.999. This is arithmetic, not balance.
    expect(H2_FRACTION + O2_FRACTION).toBeCloseTo(1, 4);
    expect(H2_FRACTION).toBeCloseTo(2 * 1.008 / (2 * 1.008 + 15.999), 3);
  });

  it("never makes more mass than it consumes", () => {
    // A refining process that produced more tonnes than it ate would be a
    // perpetual motion machine wearing an industrial hat.
    for (const p of PROCESSES) {
      const inMass = Object.values(p.inputs || {}).reduce((a, b) => a + b, 0);
      const outMass = Object.values(p.outputs || {}).reduce((a, b) => a + b, 0);
      if (inMass === 0) continue;            // extraction: the ground is the input
      expect(outMass, `${p.id} makes ${outMass} t from ${inMass} t`).toBeLessThanOrEqual(inMass + 1e-9);
    }
  });

  it("gives every process a reason and something it teaches", () => {
    for (const p of PROCESSES) {
      expect(p.why, p.id).toBeTruthy();
      expect(p.teaches, p.id).toBeTruthy();
      expect(p.build, p.id).toBeGreaterThan(0);
      expect(p.buildDays, p.id).toBeGreaterThan(0);
    }
  });
});

describe("geography decides what can be built", () => {
  it("refuses an ice mine where there is no ice", () => {
    // Psyche is a stripped metallic core: ore, metal and regolith, and not a
    // gram of ice. The census says so, and the census has to bite.
    const g = { ...rich(50_000_000, "psyche-works"), visited: ["leo", "psyche-works"] };
    expect(PLACE_BY_ID["psyche-works"].resources).not.toContain("ice");
    const r = canBuild(g, "psyche-works", "ice-mine");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no water ice here/i);
  });

  it("refuses a greenhouse on ground that would kill the gardener", () => {
    const g = { ...rich(50_000_000, "mercury-caloris"), visited: ["leo", "mercury-caloris"] };
    expect(canBuild(g, "mercury-caloris", "greenhouse").reason).toMatch(/nothing grows/i);
  });

  it("allows one where there is", () => {
    // Shackleton is a polar cold trap; ice is the entire reason it exists.
    expect(PLACE_BY_ID.shackleton.resources).toContain("ice");
    expect(canBuild(rich(), "shackleton", "ice-mine").ok).toBe(true);
  });

  it("refuses to build somewhere you have never been", () => {
    // design.md §13: you cannot build where you have not surveyed. Docking is
    // the cheapest honest version of that rule.
    const g = { ...rich(), visited: ["leo"] };
    expect(canBuild(g, "shackleton", "ice-mine").reason).toMatch(/never been/i);
  });

  it("refuses what you cannot afford, and says by how much", () => {
    const r = canBuild(rich(1000), "shackleton", "ice-mine");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Costs/);
  });

  it("will not sell you two of the same plant", () => {
    const g = build(rich(), "shackleton", "ice-mine").game;
    expect(canBuild(g, "shackleton", "ice-mine").reason).toMatch(/already have one/i);
  });

  it("offers every process with a verdict on each", () => {
    const opts = buildOptions(rich(), "shackleton");
    expect(opts.length).toBe(PROCESSES.length);
    for (const o of opts) expect(o.ok === true || typeof o.reason === "string").toBe(true);
  });
});

describe("a build takes time and money", () => {
  it("charges now and delivers later", () => {
    const g0 = rich();
    const p = PROCESS_BY_ID["ice-mine"];
    const { game, spent } = build(g0, "shackleton", "ice-mine");
    expect(spent).toBe(p.build);
    expect(game.player.credits).toBe(g0.player.credits - p.build);
    const w = worksAt(game, "shackleton")[0];
    expect(isOnline(w, game.t)).toBe(false);
    expect(daysLeft(w, game.t)).toBe(p.buildDays);
    expect(isOnline(w, game.t + p.buildDays * DAY)).toBe(true);
  });

  it("produces nothing at all while it is still being built", () => {
    const { game } = build(rich(), "shackleton", "ice-mine");
    const flows = dailyFlows(game, "shackleton", game.t);
    expect(Object.keys(flows.outputs).length).toBe(0);
    const r = tickIndustry(game, 10);
    expect(r.earned).toBe(0);
  });

  it("reports the day it comes online, once", () => {
    const p = PROCESS_BY_ID["ice-mine"];
    const { game } = build(rich(), "shackleton", "ice-mine");
    const before = tickIndustry({ ...game, t: game.t + (p.buildDays - 20) * DAY }, 5);
    expect(before.completed.length).toBe(0);
    const at = tickIndustry({ ...game, t: game.t + (p.buildDays - 2) * DAY }, 5);
    expect(at.completed.map((w) => w.processId)).toEqual(["ice-mine"]);
    const after = tickIndustry({ ...game, t: game.t + (p.buildDays + 30) * DAY }, 5);
    expect(after.completed.length).toBe(0);
  });

  it("puts every plant's crew on the daily wage bill", () => {
    const g = build(rich(), "shackleton", "ice-mine").game;
    expect(industryWages(g)).toBe(PROCESS_BY_ID["ice-mine"].crew * 90);
  });
});

describe("sunlight falls as one over r squared, and that gates the outer system", () => {
  const solar = PROCESS_BY_ID["solar-farm"];

  it("delivers full power near Earth and almost none at Saturn", () => {
    // `light` is already in the census as a real number; this is the first thing
    // that ever charged for it.
    const luna = lightAt("shackleton");
    const titan = lightAt("titan");
    expect(luna).toBeGreaterThan(titan * 20);
    expect(powerSupplied(solar, luna)).toBeGreaterThan(powerSupplied(solar, titan) * 20);
  });

  it("cannot run a plant out there that it runs easily in here", () => {
    // The same hardware, the same process, two distances. This is design.md §6's
    // "this gates the outer system by itself", as arithmetic.
    const needs = PROCESS_BY_ID["electrolysis"].power;
    expect(powerSupplied(solar, lightAt("shackleton"))).toBeGreaterThan(needs);
    expect(powerSupplied(solar, lightAt("titan"))).toBeLessThan(needs);
  });

  it("a reactor does not care how far from the Sun it is", () => {
    const fission = PROCESS_BY_ID["fission-plant"];
    expect(powerSupplied(fission, lightAt("shackleton")))
      .toBe(powerSupplied(fission, lightAt("titan")));
  });

  it("throttles everything together when power is short", () => {
    // Build a plant with no power at all behind it: it runs at zero rather than
    // pretending, and the fix is visible on the same screen.
    let g = rich();
    g = build(g, "shackleton", "ice-mine").game;
    const online = { ...g, t: g.t + 200 * DAY };
    expect(powerAt(online, "shackleton").supply).toBe(0);
    expect(powerFactor(online, "shackleton")).toBe(0);
    expect(dailyFlows(online, "shackleton").outputs.ice || 0).toBe(0);
  });

  it("runs at full rate once there is a farm over it", () => {
    let g = rich();
    g = build(g, "shackleton", "solar-farm").game;
    g = build(g, "shackleton", "ice-mine").game;
    const online = { ...g, t: g.t + 200 * DAY };
    expect(powerFactor(online, "shackleton")).toBe(1);
    expect(dailyFlows(online, "shackleton").outputs.ice)
      .toBeCloseTo(PROCESS_BY_ID["ice-mine"].outputs.ice, 6);
  });
});

describe("a chain is a chain", () => {
  /** A site with power and both halves of the water chain, all online. */
  function chained(processes) {
    let g = rich();
    for (const id of processes) g = build(g, "shackleton", id).game;
    return { ...g, t: g.t + 200 * DAY };
  }

  it("an electrolysis plant with no mine under it eats the market's ice", () => {
    const g = chained(["solar-farm", "electrolysis"]);
    const flows = dailyFlows(g, "shackleton");
    expect(flows.inputs.ice).toBeGreaterThan(0);
    expect(flows.outputs.propellant).toBeGreaterThan(0);
    // And it costs money to run — it is buying feedstock at the local price.
    const spent = tickIndustry(g, 1);
    expect(Object.keys(dailyFlows(g, "shackleton").inputs)).toContain("ice");
    expect(spent.game.markets.shackleton.stock.ice)
      .toBeLessThan(g.markets.shackleton.stock.ice);
  });

  it("throttles when the market runs out of feedstock", () => {
    const g = chained(["solar-farm", "electrolysis"]);
    const starved = {
      ...g,
      markets: { ...g.markets, shackleton: { ...g.markets.shackleton, stock: { ...g.markets.shackleton.stock, ice: 0 } } },
    };
    const r = tickIndustry(starved, 1);
    expect(r.game.markets.shackleton.stock.propellant)
      .toBeCloseTo(starved.markets.shackleton.stock.propellant, 6);
  });

  it("mine plus plant makes propellant out of the ground", () => {
    const g = chained(["solar-farm", "ice-mine", "electrolysis"]);
    const r = tickIndustry(g, 1);
    expect(r.game.markets.shackleton.stock.propellant)
      .toBeGreaterThan(g.markets.shackleton.stock.propellant);
    expect(r.earned).toBeGreaterThan(0);
  });
});

describe("a plant CURES, a cargo only eases — the whole design", () => {
  // FOOD is the example, and the data chose it rather than me: every one of the
  // seventeen sites in a seed-42 world imports food, and not one of them grows
  // it. That is design.md §5's thesis sitting in the census already — "food is
  // the import a colony resents most, because it arrives constantly and it is
  // the one thing they could grow".
  //
  // My first attempt used propellant at Shackleton and was simply wrong:
  // Shackleton sits on ice and already makes its own. There was nothing there to
  // cure, and the test failed against correct code.
  const site = () => siteOf(rich(), "shackleton");

  /** Shackleton with power and a greenhouse, all online. */
  function farming() {
    let g = rich();
    for (const id of ["solar-farm", "greenhouse"]) g = build(g, "shackleton", id).game;
    return { ...g, t: g.t + 200 * DAY };
  }

  it("moves the site's equilibrium, which a delivery cannot", () => {
    // THE test. Shackleton imports food; its equilibrium stock is an importer's
    // chronic shortage. Owning production makes it a producer's surplus — and
    // that is the number advanceMarkets drags everything toward, so the shortage
    // does not simply come back.
    const s = site();
    expect(s.consumes).toContain("food");
    expect(s.produces).not.toContain("food");
    const asImporter = equilibriumStock(s, "food", {});
    const asOwner = equilibriumStock(s, "food", { owned: ["food"] });
    expect(asOwner).toBeGreaterThan(asImporter * 2);
  });

  it("and the cure survives the market drifting back", () => {
    const g = farming();
    const started = tickIndustry(g, 1).game;
    expect(started.markets.shackleton.mods.owned).toContain("food");

    // Four hundred days of drift — far longer than any delivery's effect lasts.
    const drifted = { ...started, markets: advanceMarkets(started.markets, 400) };
    const before = priceAt(g.markets.shackleton, site(), "food");
    const after = priceAt(drifted.markets.shackleton, site(), "food");
    expect(after).toBeLessThan(before * 0.8);
  });

  it("a DELIVERY, by contrast, washes out — and that comparison IS the design", () => {
    // The control, and the reason the test above means anything. Put tonnage on
    // the shelf by hand with no plant behind it, drift the same four hundred
    // days, and compare how much of each effect is left.
    //
    // Not asserting the delivery returns EXACTLY to par: mean reversion is
    // asymptotic and four hundred days is not forever, so a big enough drop
    // leaves a few percent behind. The claim is the ratio — a plant's effect
    // must be an order of magnitude more durable than a delivery's.
    const g = rich();
    const site0 = site();
    const m = g.markets.shackleton;
    const par = priceAt(m, site0, "food");

    const delivered = { ...m, stock: { ...m.stock, food: (m.stock.food || 0) + 400 } };
    const deliveryLeft = Math.abs(priceAt(advanceMarkets({ shackleton: delivered }, 400).shackleton, site0, "food") - par);

    const built = tickIndustry(farming(), 1).game;
    const plantLeft = Math.abs(priceAt(advanceMarkets(built.markets, 400).shackleton, site0, "food") - par);

    expect(deliveryLeft / par).toBeLessThan(0.06);      // a few percent, and fading
    expect(plantLeft).toBeGreaterThan(deliveryLeft * 5);
  });

  it("earns less as it succeeds, and that is the point", () => {
    // Revenue decays because curing a shortage is what destroys the margin on
    // it. A test demanding the opposite would be arguing with design.md §5.
    const g = farming();
    const first = tickIndustry(g, 5);
    let cur = first.game;
    for (let i = 0; i < 12; i++) cur = tickIndustry(cur, 5).game;
    const later = tickIndustry(cur, 5);
    expect(later.earned).toBeLessThan(first.earned);
  });
});

describe("the umbilical, as a number", () => {
  /** Shackleton, growing its own food. */
  function farming() {
    let g = rich();
    for (const id of ["solar-farm", "greenhouse"]) g = build(g, "shackleton", id).game;
    return { ...g, t: g.t + 200 * DAY };
  }

  it("counts what a site still has to have shipped in", () => {
    const d = importDependency(rich(), "shackleton");
    expect(d.needs).toBeGreaterThan(0);
    expect(d.fraction).toBeGreaterThan(0);
    expect(d.cured).toBe(0);
    expect(d.imported).toContain("food");
  });

  it("falls when you cure one of its needs", () => {
    const before = importDependency(rich(), "shackleton");
    const after = importDependency(farming(), "shackleton");
    expect(after.fraction).toBeLessThan(before.fraction);
    expect(after.cured).toBe(1);
    expect(after.imported).not.toContain("food");
    expect(after.local).toContain("food");
  });

  it("never counts a need the geography already met as something you cured", () => {
    // Shackleton sits on ice and makes its own propellant. Building an
    // electrolysis plant there is a business decision, not a severed link, and
    // the campaign score must not pretend otherwise.
    let g = rich();
    for (const id of ["solar-farm", "ice-mine", "electrolysis"]) g = build(g, "shackleton", id).game;
    g = { ...g, t: g.t + 200 * DAY };
    expect(importDependency(g, "shackleton").cured).toBe(0);
  });

  it("scores the campaign across every site, not just this one", () => {
    const g = farming();
    const r = umbilicalReport(g);
    expect(r.works).toBe(2);
    expect(r.links).toBeGreaterThan(0);
    expect(r.cured).toBe(1);
    expect(r.bySite.map((x) => x.siteId)).toContain("shackleton");
  });
});

describe("it runs on the game's own clock, not its own", () => {
  it("advanceTime pays the plant and moves the market", () => {
    let g = rich();
    for (const id of ["solar-farm", "ice-mine"]) g = build(g, "shackleton", id).game;
    const online = { ...g, t: g.t + 200 * DAY };
    const before = online.player.credits;
    const r = advanceTime(online, online.t + 30 * DAY);
    expect(r.game.player.credits).toBeGreaterThan(before);
  });

  it("many small ticks land where one big tick does", () => {
    // The same invariant advanceMarkets holds. Without it the port clock's
    // ten-ticks-a-second would earn a different amount from a skip.
    let g = rich();
    for (const id of ["solar-farm", "ice-mine"]) g = build(g, "shackleton", id).game;
    g = { ...g, t: g.t + 200 * DAY };

    const oneJump = tickIndustry(g, 20).game.player.credits;
    let many = g;
    for (let i = 0; i < 20; i++) many = tickIndustry(many, 1).game;
    // Not identical — price moves between ticks, which is real — but close.
    expect(Math.abs(many.player.credits - oneJump) / Math.abs(oneJump - g.player.credits))
      .toBeLessThan(0.25);
  });

  it("does nothing at all for a player who has built nothing", () => {
    const g = rich();
    const r = tickIndustry(g, 100);
    expect(r.game).toBe(g);
    expect(r.earned).toBe(0);
  });
});
