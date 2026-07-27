// ===========================================================================
// CREW, WAGES, AND THE ESCAPE POD.
//
// Three systems that all exist to fix the same complaint: nothing after
// character creation could change what your captain was good at, and nothing
// made the calendar cost anything.
//
// What these guard:
//   • the best hand aboard does the job — and it actually reaches the systems
//     that read a skill, or hiring an ace is a wage bill that changes nothing
//   • wages come out every day, at the same rate however the clock is driven
//   • a crew you cannot pay walks, rather than putting you in debt forever
//   • the pod turns a fatal roll into a survivable one exactly once
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  crewForHire, effectiveSkills, dailyWages, berthsFree, hireCrew, dismissCrew, payWages,
} from "../src/crew.js";
import { CREW_BY_ID, berthsFor } from "../src/data/crew.js";
import { newGame, advanceTime, launch, travel, wait, dailyCost, tripCost } from "../src/tradergame.js";
import { newPlayer, priceToBuy, priceToSell } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";
import { HULL_BY_ID } from "../src/data/hulls.js";
import { buyShip } from "../src/shipyard.js";
import { applyOutcome, resolve, legRng } from "../src/encounters.js";
import { ENCOUNTER_BY_ID } from "../src/data/encounters.js";
import { SITE_BY_ID, govOf } from "../src/data/sites.js";

const game = (over = {}) => {
  const g = newGame(newPlayer({ name: "Vega", skills: defaultSkills() }), 42);
  return { ...g, ...over, player: { ...g.player, ...(over.player || {}) } };
};
// crewForHire takes the SITE OBJECT now (worlds are generated per run); the
// tests address ports by id, so resolve against the game's own world.
const at = (g, id) => g.sites.find((s) => s.id === id);
/** A game in a hull with berths, and money to fill them. */
const bigShip = (credits = 5_000_000) => {
  const g = { ...game(), player: { ...game().player, at: "leo", credits } };
  return buyShip(g, "leo", "freighter").game;       // 4 berths → 3 beside yours
};

describe("who is in the bar", () => {
  it("is the same list on the same day, however many times you look", () => {
    const g = game();
    const a = crewForHire(g.seed, at(g, "leo"), g.t).map((c) => c.id);
    const b = crewForHire(g.seed, at(g, "leo"), g.t).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it("differs by port and by season — but not every time you blink", () => {
    const g = game();
    const leo = crewForHire(g.seed, at(g, "leo"), g.t).map((c) => c.id);
    const ceres = crewForHire(g.seed, at(g, "ceres-port"), g.t).map((c) => c.id);
    const later = crewForHire(g.seed, at(g, "leo"), g.t + 200 * 86400000).map((c) => c.id);
    const tomorrow = crewForHire(g.seed, at(g, "leo"), g.t + 86400000).map((c) => c.id);
    expect(leo).not.toEqual(ceres);
    expect(leo).not.toEqual(later);
    expect(leo).toEqual(tomorrow);      // "come back when you can afford them" is a real plan
  });

  it("a developed port offers more people, and better ones", () => {
    const g = game();
    const core = crewForHire(g.seed, at(g, "leo"), g.t);              // tech 7
    const frontier = crewForHire(g.seed, at(g, "callisto-station"), g.t);  // tech 2
    expect(core.length).toBeGreaterThan(frontier.length);
    expect(Math.max(...core.map((c) => c.rating)))
      .toBeGreaterThan(Math.max(...frontier.map((c) => c.rating)));
  });
});

describe("the best hand aboard does the job", () => {
  it("a hired ace raises the skill; a worse one changes nothing", () => {
    const p = newPlayer({ name: "V", skills: { pilot: 4, trader: 4, engineer: 4, fighter: 4 } });
    expect(effectiveSkills(p).pilot).toBe(4);
    expect(effectiveSkills({ ...p, crew: ["okonkwo"] }).pilot).toBe(9);   // rating 9
    expect(effectiveSkills({ ...p, crew: ["prakash"] }).pilot).toBe(5);   // rating 5
    // A captain who is already better than the hire keeps their own number.
    const ace = newPlayer({ name: "A", skills: { pilot: 10, trader: 2, engineer: 2, fighter: 2 } });
    expect(effectiveSkills({ ...ace, crew: ["prakash"] }).pilot).toBe(10);
  });

  it("names who is actually doing it", () => {
    const p = { ...newPlayer({ name: "V", skills: defaultSkills() }), crew: ["okonkwo"] };
    expect(effectiveSkills(p).pilotBy).toBe(CREW_BY_ID.okonkwo.name);
    expect(effectiveSkills(p).traderBy).toBeNull();
  });

  it("reaches the market: a hired factor really does buy cheaper", () => {
    // The test that matters. If hiring a trader didn't move a price, the whole
    // system would be a wage bill with a nice UI.
    const p = newPlayer({ name: "V", skills: defaultSkills() });
    const withFactor = { ...p, crew: ["amadi"] };                 // trader 9
    expect(priceToBuy(withFactor, 100000)).toBeLessThan(priceToBuy(p, 100000));
    expect(priceToSell(withFactor, 100000)).toBeGreaterThan(priceToSell(p, 100000));
  });

  it("reaches the encounter: a hired gunner really does win more fights", () => {
    const base = newPlayer({ name: "V", skills: { pilot: 4, trader: 4, engineer: 4, fighter: 1 } });
    const rate = (player) => {
      let wins = 0;
      for (let i = 0; i < 400; i++) {
        const o = resolve(ENCOUNTER_BY_ID.pirate, "fight", {
          player, site: SITE_BY_ID["jezero-station"], gov: govOf(SITE_BY_ID["jezero-station"]),
          faction: null, danger: 0.5, rng: legRng(91, i),
        });
        if (o.won) wins++;
      }
      return wins / 400;
    };
    expect(rate({ ...base, crew: ["tallow"] })).toBeGreaterThan(rate(base) + 0.1);
  });
});

describe("berths, and who fits in them", () => {
  it("a courier flies alone forever, whatever the guild is offering", () => {
    const g = game();
    expect(berthsFor(HULL_BY_ID.courier)).toBe(0);
    expect(berthsFree(g.player)).toBe(0);
    expect(hireCrew(g, crewForHire(g.seed, at(g, g.player.at), g.t)[0].id).error).toBe("no-berth");
  });

  it("a bigger hull can sign people on, up to its berths", () => {
    let g = bigShip();
    const offered = crewForHire(g.seed, at(g, "leo"), g.t);
    expect(offered.length).toBeGreaterThan(0);
    const r = hireCrew(g, offered[0].id);
    expect(r.error).toBeUndefined();
    expect(r.game.player.crew).toContain(offered[0].id);
    expect(berthsFree(r.game.player)).toBe(berthsFor(HULL_BY_ID.freighter) - 1);
  });

  it("won't hire someone who isn't at this port, or twice", () => {
    const g = bigShip();
    const here = crewForHire(g.seed, at(g, "leo"), g.t).map((c) => c.id);
    const elsewhere = Object.keys(CREW_BY_ID).find((id) => !here.includes(id));
    expect(hireCrew(g, elsewhere).error).toBe("not-here");
    const g2 = hireCrew(g, here[0]).game;
    expect(hireCrew(g2, here[0]).error).toBe("already-aboard");
  });

  it("paying someone off frees the berth and stops the wage", () => {
    let g = bigShip();
    const id = crewForHire(g.seed, at(g, "leo"), g.t)[0].id;
    g = hireCrew(g, id).game;
    const wage = dailyWages(g.player);
    g = dismissCrew(g, id).game;
    expect(g.player.crew).not.toContain(id);
    expect(dailyWages(g.player)).toBeLessThan(wage);
  });
});

describe("wages make the calendar cost something", () => {
  it("a crewed ship pays every day it is under way", () => {
    let g = bigShip();
    g = hireCrew(g, crewForHire(g.seed, at(g, "leo"), g.t)[0].id).game;
    const before = g.player.credits;
    const r = travel(g, "shackleton");               // ~6 days
    expect(r.game.player.credits).toBeLessThan(before);
  });

  it("waiting in port is not free either", () => {
    let g = bigShip();
    g = hireCrew(g, crewForHire(g.seed, at(g, "leo"), g.t)[0].id).game;
    const before = g.player.credits;
    expect(wait(g, 100).player.credits).toBeLessThan(before);
  });

  it("an empty ship still costs nothing — the captain draws no wage", () => {
    const g = game();
    expect(dailyCost(g)).toBe(0);
    expect(wait(g, 500).player.credits).toBe(g.player.credits);
  });

  it("the fast-forward button cannot make a crossing cheaper", () => {
    // Wages accrue per day, and the clock advances in ~30 slivers a second. If
    // rounding happened per sliver, playing at speed would cost a different
    // amount from skipping — the clock rate would be an economic choice.
    let g = bigShip();
    g = hireCrew(g, crewForHire(g.seed, at(g, "leo"), g.t)[0].id).game;
    g = launch(g, "jezero-station").game;
    const oneJump = advanceTime(g, g.leg.arriveT).game;
    let stepped = g;
    for (let i = 1; i <= 50; i++) {
      const r = advanceTime(stepped, g.t + (g.leg.arriveT - g.t) * (i / 50));
      stepped = r.game;
      if (stepped.encounter) break;                  // an encounter stops both paths alike
    }
    if (!stepped.encounter) expect(stepped.player.credits).toBeCloseTo(oneJump.player.credits, 4);
  });

  it("a crew you cannot pay walks, instead of putting you in debt forever", () => {
    const p = { ...newPlayer({ name: "V", skills: defaultSkills() }), credits: 500, crew: ["amadi", "tallow"] };
    const r = payWages(p, 90);
    expect(r.player.credits).toBe(0);
    expect(r.player.crew).toEqual([]);
    expect(r.quit.length).toBe(2);
    expect(r.player.credits).toBeGreaterThanOrEqual(0);   // never negative
  });

  it("tripCost quotes what a crossing will cost in wages before you commit", () => {
    let g = bigShip();
    g = hireCrew(g, crewForHire(g.seed, at(g, "leo"), g.t)[0].id).game;
    expect(tripCost(g, 259)).toBe(Math.round(dailyWages(g.player) * 259));
    expect(tripCost(g, 259)).toBeGreaterThan(0);
  });
});

describe("the escape pod turns a fatal roll into a survivable one", () => {
  const fatal = { credits: 0, hullDamage: 90, fuelTonnes: 0, days: 0, cargoLost: {}, cargoGained: {}, standing: {}, record: null, destroyed: true };

  it("without a pod, the run ends", () => {
    const g = { ...game(), player: { ...game().player, cargo: { machinery: 4 } } };
    const after = applyOutcome(g, { headline: "x", label: "y", detail: "z", effects: fatal });
    expect(after.over?.reason).toBe("destroyed");
    expect(after.rescue).toBeUndefined();
  });

  it("with a pod, you live — and lose the ship, the hold and the crew", () => {
    let g = bigShip();
    g = hireCrew(g, crewForHire(g.seed, at(g, "leo"), g.t)[0].id).game;
    g = { ...g, player: { ...g.player, cargo: { machinery: 20 }, ship: { ...g.player.ship, escapePod: true } } };
    g = launch(g, "shackleton").game;                 // a loaded freighter's honest range
    const after = applyOutcome(g, { headline: "x", label: "y", detail: "z", effects: fatal });

    expect(after.over).toBeUndefined();               // the run continues
    expect(after.rescue.siteId).toBe("shackleton");
    expect(after.player.ship.hull).toBe("courier");   // the yard's pity hull
    expect(after.player.ship.hullPct).toBe(100);
    expect(after.player.cargo).toEqual({});           // the hold went with the ship
    expect(after.player.crew).toEqual([]);            // and so did their contracts
    expect(after.player.ship.escapePod).toBe(false);  // a pod is one use
    expect(after.status).toBe("docked");
    expect(after.leg).toBeNull();
    expect(after.player.at).toBe("shackleton");
  });

  it("keeps your credits — you are broke in ship terms, not bankrupt", () => {
    const g = { ...game(), player: { ...game().player, credits: 250000, ship: { ...game().player.ship, escapePod: true } } };
    const after = applyOutcome(g, { headline: "x", label: "y", detail: "z", effects: fatal });
    expect(after.player.credits).toBe(250000);
  });
});
