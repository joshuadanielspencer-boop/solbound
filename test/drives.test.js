// ===========================================================================
// DRIVE ERAS — the purchase that redraws the map, and the cost that stops it
// being a free upgrade.
//
// What these guard, in order of how badly each would hurt:
//
//   1. AN ERA MUST ACTUALLY OPEN THE MAP. If a nuclear-thermal refit doesn't
//      put ports in reach that a chemical ship cannot touch, the campaign's
//      whole spine (design.md §8) is a cosmetic label on a number.
//   2. MASS STILL WINS. A better drive must NOT make a heavy hull go as far as
//      a light one. The rocket equation is the game; an era changes the base,
//      not the rule.
//   3. HYDROGEN DOES NOT KEEP. Boil-off is why methalox survives the arrival of
//      something with twice its exhaust velocity, and it is the reason the
//      cryocooler exists. If it compounds wrong or leaks into a methalox ship,
//      the lesson is a bug.
//   4. THE HONEST GATES HOLD. The ion drive and the torch are not purchasable,
//      for two completely different reasons, and both reasons are stated.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { DRIVES, tankAfter, boilOff, massRatio } from "../src/propulsion.js";
import { drivesForSale, buyDrive, driveTradeIn, DRIVE_RESALE } from "../src/shipyard.js";
import { newGame, travelCost, destinations, rangeReport, wait, CRYO_FACTOR } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";
import { fittedStats } from "../src/data/hulls.js";

const rich = (over = {}) => {
  const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), 42);
  return { ...g, player: { ...g.player, credits: 20_000_000, ...over } };
};
const withShip = (g, ship) => ({ ...g, player: { ...g.player, ship: { ...g.player.ship, ...ship } } });

describe("an era redraws the map", () => {
  it("nuclear thermal puts ports in reach that no chemical rocket can touch", () => {
    const chem = rich();
    const nuke = withShip(chem, { drive: "ntr" });
    expect(rangeReport(nuke).full).toBeGreaterThan(rangeReport(chem).full);

    // The Belt is the specific door it opens for a starter hull: 147 t of
    // methalox against a 30 t tank is a wall, not a price.
    expect(travelCost(chem, "ceres-port").reachable).toBe(false);
    expect(travelCost(nuke, "ceres-port").reachable).toBe(true);
  });

  it("the same trip costs less propellant at every step up the ladder", () => {
    const cost = (drive) => travelCost(withShip(rich(), { drive }), "jezero-station").fuelTonnes;
    expect(cost("hydrolox")).toBeLessThan(cost("methalox"));
    expect(cost("ntr")).toBeLessThan(cost("hydrolox"));
  });

  it("but the flight TIME does not change — an impulsive drive still flies Hohmann", () => {
    const days = (drive) => travelCost(withShip(rich(), { drive }), "jezero-station").days;
    expect(days("ntr")).toBe(days("methalox"));
  });

  // Pillar 2 of the whole design: mass is what the equation charges for. An era
  // must not let a freighter go where a courier goes.
  it("a heavy hull with a good drive still cannot outreach a light one", () => {
    const light = withShip(rich(), { drive: "ntr", hull: "courier" });
    const heavy = withShip(rich(), { drive: "ntr", hull: "freighter" });
    expect(travelCost(heavy, "ceres-port").fuelTonnes)
      .toBeGreaterThan(travelCost(light, "ceres-port").fuelTonnes);
    expect(travelCost(heavy, "ceres-port").reachable).toBe(false);
  });
});

describe("hydrogen does not keep", () => {
  it("methalox loses nothing, ever — which is most of why it survives", () => {
    expect(tankAfter(30, DRIVES.methalox, 10_000)).toBe(30);
    expect(boilOff(30, DRIVES.methalox, 10_000)).toBe(0);
  });

  it("compounds toward empty rather than crossing zero", () => {
    const t = tankAfter(30, DRIVES.ntr, 100_000);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(0.001);
  });

  it("a cryocooler cuts the loss by roughly the factor it claims", () => {
    const passive = boilOff(30, DRIVES.ntr, 270, 1);
    const cooled = boilOff(30, DRIVES.ntr, 270, CRYO_FACTOR);
    expect(cooled).toBeLessThan(passive * 0.2);
    expect(cooled).toBeGreaterThan(0);
  });

  it("the clock actually drains a hydrogen tank in port, and leaves methane alone", () => {
    const hydro = withShip(rich(), { drive: "ntr" });
    const chem = withShip(rich(), { drive: "methalox" });
    expect(wait(hydro, 180).game.player.ship.fuelTonnes).toBeLessThan(hydro.player.ship.fuelTonnes);
    expect(wait(chem, 180).game.player.ship.fuelTonnes).toBe(chem.player.ship.fuelTonnes);
  });

  it("a fitted cryocooler is felt through the clock, not just in the arithmetic", () => {
    const bare = withShip(rich(), { drive: "ntr", hull: "prospector", modules: [] });
    const cooled = withShip(rich(), { drive: "ntr", hull: "prospector", modules: ["cryo"] });
    expect(fittedStats("prospector", ["cryo"]).cryo).toBe(true);
    expect(wait(cooled, 365).game.player.ship.fuelTonnes)
      .toBeGreaterThan(wait(bare, 365).game.player.ship.fuelTonnes);
  });

  it("boil-off can never take the tank below zero", () => {
    const g = withShip(rich(), { drive: "ntr" });
    expect(wait(g, 100_000).game.player.ship.fuelTonnes).toBeGreaterThanOrEqual(0);
  });
});

describe("the yard sells eras honestly", () => {
  it("a Core yard fits a reactor; a frontier outpost does not", () => {
    const core = drivesForSale(rich({ at: "leo" }), "leo").find((r) => r.drive.id === "ntr");
    const frontier = drivesForSale(rich({ at: "callisto-station" }), "callisto-station").find((r) => r.drive.id === "ntr");
    expect(core.techOK).toBe(true);
    expect(frontier.techOK).toBe(false);
    expect(frontier.reason).toMatch(/yard/);
  });

  it("refuses the refit at a yard that can't do it, whatever the money", () => {
    const g = { ...rich({ at: "callisto-station" }) };
    const r = buyDrive(g, "ntr");
    expect(r.error).toBe("tech");
    expect(r.game).toBeUndefined();
  });

  it("charges the net after trade-in, delivers a full tank, and keeps the hull", () => {
    const g = rich({ at: "leo" });
    const before = g.player.credits;
    const r = buyDrive(g, "ntr");
    expect(r.error).toBeUndefined();
    expect(r.net).toBe(DRIVES.ntr.price - driveTradeIn("methalox"));
    expect(r.game.player.credits).toBe(before - r.net);
    expect(r.game.player.ship.drive).toBe("ntr");
    expect(r.game.player.ship.hull).toBe(g.player.ship.hull);
    expect(r.game.player.ship.fuelTonnes)
      .toBe(fittedStats(g.player.ship.hull, g.player.ship.modules).fuelTonnes);
  });

  // The same anti-exploit the hull yard has: churning a purchase must never
  // print money. Resale is below cost, so a round trip always loses.
  it("refitting back and forth loses money every time", () => {
    const g = rich({ at: "leo" });
    const up = buyDrive(g, "ntr").game;
    const back = buyDrive(up, "methalox").game;
    expect(back.player.credits).toBeLessThan(g.player.credits);
    expect(DRIVE_RESALE).toBeLessThan(1);
  });

  it("refuses a refit you cannot afford, and one you are already flying", () => {
    const poor = { ...rich({ at: "leo" }), player: { ...rich().player, at: "leo", credits: 1000 } };
    expect(buyDrive(poor, "ntr").error).toBe("credits");
    expect(buyDrive(rich({ at: "leo" }), "methalox").error).toBe("already-own");
  });

  // Two drives are withheld for two completely different reasons, and the game
  // states both rather than hiding them behind a tech level.
  it("the ion drive and the torch are not for sale, and each says why", () => {
    for (const id of ["nep", "torch"]) {
      const row = drivesForSale(rich({ at: "leo" }), "leo").find((r) => r.drive.id === id);
      expect(row.canBuy, id).toBe(false);
      expect(row.reason.length, id).toBeGreaterThan(60);
      expect(buyDrive(rich({ at: "leo" }), id).error).toBe("not-for-sale");
    }
    // The torch is labelled fiction; the ion drive is real and merely unmodelled.
    expect(DRIVES.torch.speculative).toBe(true);
    expect(DRIVES.nep.speculative).toBe(false);
  });

  it("every purchasable drive has a price, a tech gate and a real exhaust velocity", () => {
    for (const d of Object.values(DRIVES)) {
      if (!d.forSale) continue;
      expect(d.price, d.id).toBeGreaterThan(0);
      expect(d.minTech, d.id).toBeGreaterThanOrEqual(1);
      expect(massRatio(5.6, d.isp), d.id).toBeGreaterThan(1);
    }
  });
});
