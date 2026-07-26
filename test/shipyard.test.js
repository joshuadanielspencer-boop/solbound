// ===========================================================================
// THE SHIP YARD — buying ships, fitting modules, repairs.
//
// The yard is where money becomes capability, so the tests guard the money:
// tech-gating that can't be skipped, trade-ins that never pay full price, cargo
// that can't vanish into a hull too small to hold it, and no way to conjure
// credits by churning purchases.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  tradeInValue, shipsForSale, buyShip, modulesForSale, fitModule, removeModule,
  repairCost, repairHull, buyEscapePod,
} from "../src/shipyard.js";
import { ESCAPE_POD } from "../src/data/hulls.js";
import { newGame, buy } from "../src/tradergame.js";
import { newPlayer, cargoUsed } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";
import { HULL_BY_ID, fittedStats } from "../src/data/hulls.js";
import { techOf, SITE_BY_ID } from "../src/data/sites.js";

const rich = (siteId = "leo", credits = 5_000_000) => {
  const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), 42);
  return { ...g, player: { ...g.player, at: siteId, credits } };
};

describe("tech gates which ships a port sells", () => {
  it("a Core port sells everything; a frontier outpost only the starter", () => {
    const core = shipsForSale(rich("leo"), "leo").map((s) => s.hull.id);
    const frontier = shipsForSale(rich("callisto-station"), "callisto-station").map((s) => s.hull.id);
    expect(core.length).toBeGreaterThan(frontier.length);
    expect(frontier).toContain("courier");
    expect(frontier).not.toContain("freighter");   // needs a developed yard
  });

  it("refuses to build a ship the port's tech can't support", () => {
    const g = rich("callisto-station");            // tech 2
    expect(buyShip(g, "callisto-station", "freighter").error).toBe("tech");
  });
});

describe("trading up costs real money", () => {
  it("a trade-in never returns full price", () => {
    const g = rich();
    expect(tradeInValue(g.player.ship)).toBeLessThan(HULL_BY_ID.courier.price);
  });

  it("buying a bigger ship charges the net and swaps the hull", () => {
    const g = rich("leo", 5_000_000);
    const before = g.player.credits;
    const r = buyShip(g, "leo", "clipper");
    expect(r.error).toBeUndefined();
    expect(r.game.player.ship.hull).toBe("clipper");
    expect(r.game.player.credits).toBe(before - r.net);
    expect(r.net).toBeGreaterThan(0);              // clipper costs more than the courier trade-in
    expect(r.game.player.ship.modules).toEqual([]); // delivered fresh
    expect(r.game.player.ship.fuelTonnes).toBe(fittedStats("clipper", []).fuelTonnes); // full tank
    expect(r.game.player.ship.hullPct).toBe(100);
  });

  it("won't sell you a ship too small for your cargo", () => {
    let g = rich("leo");
    g = { ...g, player: { ...g.player, cargo: { machinery: 30 } } };   // more than a courier holds
    const r = buyShip(g, "leo", "cutter");         // cutter holds 20 t
    expect(r.error).toBe("cargo");
  });

  it("can't buy a ship you can't afford", () => {
    const g = rich("leo", 1000);
    expect(buyShip(g, "leo", "freighter").error).toBe("credits");
  });

  it("no free money: buy up then trade back down loses value to resale", () => {
    // The anti-exploit. Trade courier→clipper→courier; you must end poorer.
    let g = rich("leo", 5_000_000);
    const start = g.player.credits;
    g = buyShip(g, "leo", "clipper").game;
    g = buyShip(g, "leo", "courier").game;
    expect(g.player.ship.hull).toBe("courier");
    expect(g.player.credits).toBeLessThan(start);
  });
});

describe("fitting modules", () => {
  it("installs a module, taking a slot and the credits", () => {
    const g = rich();
    const r = fitModule(g, "hold");
    expect(r.game.player.ship.modules).toContain("hold");
    expect(r.game.player.credits).toBe(g.player.credits - r.spent);
    expect(fittedStats(r.game.player.ship.hull, r.game.player.ship.modules).cargoTonnes)
      .toBeGreaterThan(fittedStats(g.player.ship.hull, g.player.ship.modules).cargoTonnes);
  });

  it("can't fit more modules than the hull has bays of that kind", () => {
    let g = rich();                                 // courier: 2 gadget bays
    g = fitModule(g, "hold").game;
    g = fitModule(g, "tank").game;
    expect(fitModule(g, "miner").error).toBe("no-slot");
  });

  it("a hull with no bay of a kind can never mount that kind, at any price", () => {
    // The whole point of splitting slots: character comes from the SHAPE of a
    // hull's bays, not their number. A courier cannot be armoured into a warship.
    const g = rich("leo", 5_000_000);
    const r = fitModule(g, "shield");               // courier: 0 shield bays
    expect(r.error).toBe("no-slot");
    expect(r.reason).toMatch(/no shield bay at all/);
  });

  it("but the cutter, which is built for it, can mount a battery", () => {
    let g = rich("leo", 5_000_000);
    g = buyShip(g, "leo", "cutter").game;           // 3 weapon, 2 shield, 1 gadget
    g = fitModule(g, "laser").game;
    g = fitModule(g, "shield").game;
    expect(g.player.ship.modules).toEqual(["laser", "shield"]);
    expect(fittedStats(g.player.ship.hull, g.player.ship.modules).weapon).toBeGreaterThan(0);
  });

  it("removing a module refunds part of its price", () => {
    let g = rich();
    g = fitModule(g, "tank").game;
    const before = g.player.credits;
    const r = removeModule(g, "tank");
    expect(r.game.player.ship.modules).not.toContain("tank");
    expect(r.game.player.credits).toBeGreaterThan(before);
  });

  it("won't let you strip a cargo bay your cargo is sitting in", () => {
    let g = rich();
    g = fitModule(g, "hold").game;                  // +12 t hold
    g = { ...g, player: { ...g.player, cargo: { machinery: 20 } } };  // fills into the extra bay
    expect(removeModule(g, "hold").error).toBe("cargo-in-way");
  });

  it("fitting a module costs money you don't get all back — no churn exploit", () => {
    let g = rich("leo", 200000);
    const start = g.player.credits;
    g = fitModule(g, "tank").game;
    g = removeModule(g, "tank").game;
    expect(g.player.credits).toBeLessThan(start);
  });
});

describe("the escape pod", () => {
  it("costs real money and sticks to the ship", () => {
    const g = rich();
    expect(g.player.ship.escapePod).toBe(false);     // you start without one
    const r = buyEscapePod(g);
    expect(r.game.player.ship.escapePod).toBe(true);
    expect(r.game.player.credits).toBe(g.player.credits - ESCAPE_POD.price);
  });

  it("won't sell you a second one, or one you can't afford", () => {
    const g = buyEscapePod(rich()).game;
    expect(buyEscapePod(g).error).toBe("already-have");
    expect(buyEscapePod({ ...rich(), player: { ...rich().player, credits: 10 } }).error).toBe("credits");
  });

  it("survives a change of ship — it's yours, not the hull's", () => {
    let g = buyEscapePod(rich("leo", 5_000_000)).game;
    g = buyShip(g, "leo", "clipper").game;
    expect(g.player.ship.escapePod).toBe(true);
  });
});

describe("crew berths gate the hull you can fly", () => {
  it("won't sell you a ship with fewer berths than you have people", () => {
    let g = rich("leo", 5_000_000);
    g = buyShip(g, "leo", "freighter").game;         // 4 berths → 3 beside yours
    g = { ...g, player: { ...g.player, crew: ["brant", "haruki", "nassar"] } };
    const r = buyShip(g, "leo", "courier");          // 1 berth → 0 beside yours
    expect(r.error).toBe("crew");
    expect(r.reason).toMatch(/pay someone off/i);
  });

  it("reports berths on the sale list, so the choice is visible", () => {
    const ships = shipsForSale(rich("leo"), "leo");
    expect(ships.find((s) => s.hull.id === "courier").berths).toBe(0);
    expect(ships.find((s) => s.hull.id === "freighter").berths).toBe(3);
  });
});

describe("repair", () => {
  it("a sound hull needs no repair", () => {
    expect(repairCost(rich())).toBe(0);
    expect(repairHull(rich()).error).toBe("no-damage");
  });

  it("costs money and restores integrity", () => {
    let g = rich();
    g = { ...g, player: { ...g.player, ship: { ...g.player.ship, hullPct: 60 } } };
    const cost = repairCost(g);
    expect(cost).toBeGreaterThan(0);
    const r = repairHull(g);
    expect(r.game.player.ship.hullPct).toBe(100);
    expect(r.game.player.credits).toBe(g.player.credits - cost);
  });

  it("only repairs as far as the credits stretch", () => {
    let g = rich("leo", 1);                          // effectively broke
    g = { ...g, player: { ...g.player, credits: 1, ship: { ...g.player.ship, hullPct: 50 } } };
    expect(repairHull(g).error).toBe("credits");
  });
});
