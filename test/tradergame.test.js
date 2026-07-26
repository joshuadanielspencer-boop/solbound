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
  launch, advanceTime, shipPosition, RATES,
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

describe("the living clock — launch, fly, arrive", () => {
  it("launch puts the ship in transit and spends the departure fuel, but no time passes yet", () => {
    // The whole point of the merge: you don't teleport, you set out. Time is the
    // clock's job, so the player can watch, pause and skip.
    const g = freshGame();
    const fuel0 = g.player.ship.fuelTonnes;
    const r = launch(g, "jezero-station");
    expect(r.error).toBeUndefined();
    expect(r.game.status).toBe("transit");
    expect(r.game.leg.to).toBe("jezero-station");
    expect(r.game.t).toBe(g.t);                              // no time has passed
    expect(r.game.player.ship.fuelTonnes).toBeLessThan(fuel0); // but the burn happened
    expect(r.game.player.at).toBe("leo");                    // still "from" until arrival
  });

  it("the clock advances the ship along a real arc, then pauses it on arrival", () => {
    let { game } = launch(freshGame(), "jezero-station");
    const mid = game.t + (game.leg.arriveT - game.t) / 2;

    // Halfway: still flying, and genuinely between the two orbits, not teleporting.
    const midway = advanceTime(game, mid);
    expect(midway.arrived).toBeUndefined();
    const pos = shipPosition(midway.game);
    expect(pos.f).toBeGreaterThan(0.4).toBeLessThan(0.6);
    expect(pos.r).toBeGreaterThan(midway.game.leg.r1);
    expect(pos.r).toBeLessThan(midway.game.leg.r2);

    // Push past arrival: it resolves exactly at the arrival instant and pauses.
    const done = advanceTime(midway.game, game.leg.arriveT + 999 * 86400000);
    expect(done.arrived).toBe("Jezero Station");
    expect(done.game.status).toBe("docked");
    expect(done.game.player.at).toBe("jezero-station");
    expect(done.game.rateIdx).toBe(0);                       // clock paused for the dock
    expect(shipPosition(done.game)).toBeNull();
  });

  it("a docked ship has no position on the arc", () => {
    expect(shipPosition(freshGame())).toBeNull();
  });

  it("can't launch a second leg while already flying", () => {
    const { game } = launch(freshGame(), "shackleton");
    expect(launch(game, "jezero-station").error).toBe("already-flying");
  });

  it("offers a real pause", () => {
    expect(RATES[0].days).toBe(0);
  });

  it("markets drift by the same amount whether time passes in one step or many", () => {
    // The clock ticks in small steps while playing; a test/headless caller jumps
    // straight to arrival. Both must land on the same world, or the animated and
    // headless paths would diverge.
    const g = launch(freshGame(), "jezero-station").game;
    const bulk = advanceTime(g, g.leg.arriveT).game;
    let step = g;
    const N = 20;
    for (let i = 1; i <= N; i++) step = advanceTime(step, g.t + (g.leg.arriveT - g.t) * (i / N)).game;
    // Compare a representative market's stock; linear drift makes these equal.
    expect(step.markets["jezero-station"].stock.machinery)
      .toBeCloseTo(bulk.markets["jezero-station"].stock.machinery, 4);
  });
});

describe("the run gets a roguelike world", () => {
  it("spawns factions and an opening brief", () => {
    const g = freshGame();
    expect(g.factions.length).toBeGreaterThanOrEqual(3);
    expect(g.brief.length).toBe(g.factions.length);
  });

  it("the same seed produces the same world", () => {
    const a = newGame(newPlayer({ name: "A", skills: defaultSkills() }), 77);
    const b = newGame(newPlayer({ name: "B", skills: defaultSkills() }), 77);
    expect(a.factions).toEqual(b.factions);
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
