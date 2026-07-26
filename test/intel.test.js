// ===========================================================================
// MARKET INTEL — the "look before you leap" layer.
//
// The point of this feature is to make trade a decision you can SEE. These pin
// that it tells the truth: live prices where you are, honest structural
// estimates elsewhere, freshness that degrades with light-lag, and a run plan
// that actually identifies the profitable cargo.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  intelFreshness, estimatedPrice, priceList, runPlan, cargoValueAt,
} from "../src/intel.js";
import { newGame, buy, travel } from "../src/tradergame.js";
import { priceAt } from "../src/market.js";
import { SITE_BY_ID } from "../src/data/sites.js";
import { newPlayer } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";

const freshGame = () => newGame(newPlayer({ name: "Vega", skills: defaultSkills() }), 42);
// The captain's real sell price at their current site, via the live intel path.
const priceToSellReal = (g, siteId, id) => estimatedPrice(g, siteId, id).sell;

describe("freshness follows light-lag", () => {
  it("is LIVE at your current site", () => {
    expect(intelFreshness(freshGame(), "leo").key).toBe("live");
  });

  it("is worse for a distant system than a near one", () => {
    const g = freshGame();
    const near = intelFreshness(g, "shackleton");   // cislunar
    const far = intelFreshness(g, "callisto-station"); // Jupiter
    const rank = { live: 0, recent: 1, delayed: 2, stale: 3 };
    expect(rank[far.key]).toBeGreaterThanOrEqual(rank[near.key]);
    expect(far.key).not.toBe("live");
  });
});

describe("prices are live here, estimated elsewhere", () => {
  it("marks the current site's prices live and a remote site's estimated", () => {
    const g = freshGame();
    expect(estimatedPrice(g, "leo", "machinery").live).toBe(true);
    expect(estimatedPrice(g, "jezero-station", "machinery").live).toBe(false);
  });

  it("buy is always above sell — the spread survives estimation", () => {
    const g = freshGame();
    for (const site of ["leo", "jezero-station", "callisto-station"]) {
      const e = estimatedPrice(g, site, "electronics");
      if (e) expect(e.buy).toBeGreaterThan(e.sell);
    }
  });

  it("the estimate is honest: it's close to what you actually find on arrival", () => {
    // The estimate for a remote place is its structural (equilibrium) price, and
    // an unattended market drifts toward equilibrium — so after a long flight the
    // estimate and the real price on arrival should be in the same ballpark.
    // Not identical (time passed, the market drifted), but not a lie either.
    let g = freshGame();
    const est = estimatedPrice(g, "jezero-station", "machinery").sell;
    const t = travel(g, "jezero-station");            // headless: launch → arrive
    g = t.game;
    const real = priceToSellReal(g, "jezero-station", "machinery");
    // Within ~35% — the transient swing, not an order of magnitude out.
    expect(Math.abs(real - est) / est).toBeLessThan(0.35);
  });
});

describe("the price list is the Average Price List", () => {
  it("lists what a site trades, with prices", () => {
    const rows = priceList(freshGame(), "shackleton");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.buy).toBeGreaterThan(0);
      expect(r.sell).toBeGreaterThan(0);
      expect(typeof r.name).toBe("string");
    }
  });

  it("flags whether the numbers are live or estimated", () => {
    expect(priceList(freshGame(), "leo").every((r) => r.live)).toBe(true);
    expect(priceList(freshGame(), "callisto-station").every((r) => !r.live)).toBe(true);
  });
});

describe("the run plan finds the profitable cargo before you fly", () => {
  it("ranks goods by margin and identifies the viable ones", () => {
    const g = freshGame();
    const { rows } = runPlan(g, "shackleton", 200);
    expect(rows.length).toBeGreaterThan(0);
    // Sorted best-first.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].marginPerTonne).toBeLessThanOrEqual(rows[i - 1].marginPerTonne);
    }
    // Something must be worth carrying from Earth to the Moon, or the loop is dead.
    expect(rows.some((r) => r.viable)).toBe(true);
  });

  it("bulk goods that can't pay their transport are marked unviable", () => {
    // Ice/regolith margins over a real shipping cost must be negative — the whole
    // dependency thesis, now visible to the player before they waste a trip.
    const g = freshGame();
    const { rows } = runPlan(g, "jezero-station", 4000);
    const ice = rows.find((r) => r.id === "ice");
    if (ice) expect(ice.viable).toBe(false);
  });

  it("shipping cost eats into the margin", () => {
    const g = freshGame();
    const cheap = runPlan(g, "shackleton", 0).rows.find((r) => r.id === "machinery");
    const dear = runPlan(g, "shackleton", 5000).rows.find((r) => r.id === "machinery");
    expect(dear.marginPerTonne).toBeLessThan(cheap.marginPerTonne);
  });

  it("carries a confidence label for the destination", () => {
    expect(runPlan(freshGame(), "callisto-station", 0).freshness.key).not.toBe("live");
  });
});

describe("what my cargo is worth there", () => {
  it("estimates the sale value of the current hold at a destination", () => {
    let g = freshGame();
    ({ game: g } = buy(g, "machinery", 4));
    const at = cargoValueAt(g, "shackleton");
    expect(at.total).toBeGreaterThan(0);
    expect(at.lines.find((l) => l.id === "machinery").tonnes).toBe(4);
  });

  it("is zero with an empty hold", () => {
    expect(cargoValueAt(freshGame(), "shackleton").total).toBe(0);
  });
});
