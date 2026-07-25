// ===========================================================================
// THE TRADE GAME — the Space Trader loop as one coherent state.
//
// Guards the things that make the loop a GAME rather than a spreadsheet: that
// fuel is the rocket equation and can genuinely run out, that a starter run is
// actually completable (an unwinnable first move is a dead game), that time and
// markets move while you fly, and that nothing leaks money or goods.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  newGame, travelCost, destinations, travel, refuel, fuelPrice,
  buy, sell, wait, tankMax, tankFree, START_DATE,
} from "../src/tradergame.js";
import { newPlayer, cargoUsed } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";

const freshGame = (over = {}) => newGame(newPlayer({ name: "Vega", skills: defaultSkills(), ...over }));

describe("a starter captain has a real first move", () => {
  it("can reach the Moon and Mars with an empty hold, but not the outer system", () => {
    // If the starter ship couldn't reach anything, the game would be dead on
    // arrival. If it could reach everything, the rocket equation would be a lie.
    const g = freshGame();
    const reach = Object.fromEntries(destinations(g).map((d) => [d.site.id, d.cost?.reachable]));
    expect(reach["shackleton"]).toBe(true);       // cheap cislunar hop
    expect(reach["jezero-station"]).toBe(true);    // Mars, reachable empty
    expect(reach["callisto-station"]).toBe(false); // Jupiter is a rocket-equation wall
  });

  it("a first Gateway→Moon machinery run turns a profit", () => {
    // The actual Space Trader floor: buy, fly, sell, come out ahead. If this
    // ever goes negative the onboarding loop is broken.
    let g = freshGame();
    const start = g.player.credits;
    ({ game: g } = buy(g, "machinery", 4));
    const t = travel(g, "shackleton");
    expect(t.error).toBeUndefined();
    g = t.game;
    const s = sell(g, "machinery", 4);
    g = s.game;
    expect(g.player.credits).toBeGreaterThan(start);
  });
});

describe("fuel is the rocket equation", () => {
  it("a heavier hold makes the same trip cost more propellant", () => {
    const empty = freshGame();
    const loaded = freshGame();
    loaded.player.cargo = { machinery: 10 };
    const a = travelCost(empty, "jezero-station").fuelTonnes;
    const b = travelCost(loaded, "jezero-station").fuelTonnes;
    expect(b).toBeGreaterThan(a);   // mass is what the equation charges for
  });

  it("an interplanetary trip spends fuel and advances the clock by months", () => {
    let g = freshGame();
    const fuel0 = g.player.ship.fuelTonnes;
    const r = travel(g, "jezero-station");
    expect(r.error).toBeUndefined();
    expect(r.game.player.ship.fuelTonnes).toBeLessThan(fuel0);
    expect(r.game.t).toBeGreaterThan(START_DATE + 100 * 86400000);   // Mars is far
    expect(r.game.player.at).toBe("jezero-station");
  });

  it("refuses a trip the tank can't hold even full, with a reason", () => {
    const r = travel(freshGame(), "callisto-station");
    expect(r.error).toBe("unreachable");
    expect(r.reason).toMatch(/tank holds/);
  });

  it("refuses a trip you can afford in mass but not in current fuel", () => {
    let g = freshGame();
    g = { ...g, player: { ...g.player, ship: { ...g.player.ship, fuelTonnes: 1 } } };
    const r = travel(g, "jezero-station");
    expect(r.error).toBe("low-fuel");
  });
});

describe("refuelling is the depot lesson", () => {
  it("buying propellant fills the tank and costs credits", () => {
    // Fly to the Moon first (it makes propellant); Gateway sells it dear, the
    // Moon cheap — that difference is the whole point of a depot.
    let g = freshGame();
    ({ game: g } = travel(g, "shackleton"));
    const before = g.player.ship.fuelTonnes;
    const r = refuel(g, 5);
    expect(r.tonnes).toBeGreaterThan(0);
    expect(r.game.player.ship.fuelTonnes).toBeGreaterThan(before);
    expect(r.game.player.credits).toBeLessThan(g.player.credits);
  });

  it("can't overfill the tank", () => {
    let g = freshGame();
    ({ game: g } = travel(g, "shackleton"));
    const r = refuel(g, 9999);
    expect(r.game.player.ship.fuelTonnes).toBeLessThanOrEqual(tankMax(r.game.player) + 1e-6);
  });

  it("the Moon sells propellant it makes from its own ice", () => {
    let g = freshGame();
    ({ game: g } = travel(g, "shackleton"));
    expect(fuelPrice(g)).toBeGreaterThan(0);
  });
});

describe("time and markets move while you fly", () => {
  it("prices at the destination are not the prices you saw at departure", () => {
    // Months pass in transit; the market drifts. This is the seed of stale
    // information (design.md §7). A game where the market froze mid-flight would
    // make travel time meaningless.
    let g = freshGame();
    const before = JSON.stringify(g.markets["jezero-station"].stock);
    ({ game: g } = travel(g, "jezero-station"));
    expect(JSON.stringify(g.markets["jezero-station"].stock)).not.toBe(before);
  });

  it("waiting also drifts the markets", () => {
    const g = freshGame();
    const g2 = wait(g, 200);
    expect(g2.t).toBeGreaterThan(g.t);
    expect(JSON.stringify(g2.markets)).not.toBe(JSON.stringify(g.markets));
  });
});

describe("nothing leaks", () => {
  it("travel and refuel never mutate the input game", () => {
    const g = freshGame();
    const snap = JSON.stringify(g);
    travel(g, "shackleton");
    buy(g, "machinery", 2);
    expect(JSON.stringify(g)).toBe(snap);
  });

  it("a same-site buy then sell loses money to the spread", () => {
    // The anti-exploit, at the game level: churning one market is always a loss.
    let g = freshGame();
    const start = g.player.credits;
    ({ game: g } = buy(g, "machinery", 3));
    const s = sell(g, "machinery", 3);
    expect(s.game.player.credits).toBeLessThan(start);
    expect(cargoUsed(s.game.player)).toBe(0);
  });
});
