// ===========================================================================
// THE PLAYER — captain, ship, hold, and the buy/sell atoms of the trade loop.
//
// This is the Space Trader floor's state. The tests guard the three things that
// would quietly ruin a trading game: cargo/credit conservation (no money or
// goods created from nothing), the hold/credit/stock limits actually biting, and
// the Trader skill being a real edge rather than an exploit.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  newPlayer, buyGoods, sellGoods, cargoUsed, cargoCapacity, cargoFree,
  buyPrice, sellPrice, netWorth, START_CREDITS,
} from "../src/player.js";
import { initialMarkets, priceAt } from "../src/market.js";
import { SITE_BY_ID } from "../src/data/sites.js";
import { HULL_BY_ID, fittedStats, STARTER_HULL } from "../src/data/hulls.js";
import { SKILLS, BACKGROUNDS, validSkills, defaultSkills, SKILL_POINTS } from "../src/data/captain.js";

const mk = (over = {}) => newPlayer({ name: "Vega", skills: defaultSkills(), ...over });

describe("captain creation", () => {
  it("every background is a legal skill allocation", () => {
    // A background that didn't sum to the point budget would be a free (or
    // crippled) start, quietly unbalancing the whole game.
    for (const b of BACKGROUNDS) {
      expect(validSkills(b.skills), b.id).toBe(true);
      expect(Object.values(b.skills).reduce((a, c) => a + c, 0)).toBe(SKILL_POINTS);
    }
  });

  it("the default allocation is legal", () => {
    expect(validSkills(defaultSkills())).toBe(true);
  });

  it("rejects over-spent, under-spent, and out-of-range allocations", () => {
    expect(validSkills({ pilot: 5, trader: 5, engineer: 5, fighter: 5 })).toBe(false); // 20
    expect(validSkills({ pilot: 1, trader: 1, engineer: 1, fighter: 1 })).toBe(false); // 4
    expect(validSkills({ pilot: 13, trader: 1, engineer: 1, fighter: 1 })).toBe(false); // >max
    expect(validSkills({ pilot: 0, trader: 8, engineer: 4, fighter: 4 })).toBe(false); // <min
  });

  it("a new captain starts docked at Earth orbit, in the starter ship, with the starting purse", () => {
    const p = mk();
    expect(p.at).toBe("leo");
    expect(p.ship.hull).toBe(STARTER_HULL);
    expect(p.credits).toBe(START_CREDITS);
    expect(cargoUsed(p)).toBe(0);
  });
});

describe("hulls trade cargo against fuel against slots", () => {
  it("fitting a module adds its capability and its mass", () => {
    const bare = fittedStats("clipper", []);
    const withHold = fittedStats("clipper", ["hold"]);
    expect(withHold.cargoTonnes).toBe(bare.cargoTonnes + 12);
    expect(withHold.dryTonnes).toBeGreaterThan(bare.dryTonnes);   // heavier now
  });

  it("a mining rig makes a ship able to mine, and it wasn't before", () => {
    expect(fittedStats("prospector", []).canMine).toBe(false);
    expect(fittedStats("prospector", ["miner"]).canMine).toBe(true);
  });

  it("bigger holds cost more ship", () => {
    expect(HULL_BY_ID.freighter.cargoTonnes).toBeGreaterThan(HULL_BY_ID.courier.cargoTonnes);
    expect(HULL_BY_ID.freighter.price).toBeGreaterThan(HULL_BY_ID.courier.price);
  });
});

describe("buying", () => {
  it("moves goods into the hold and takes the money", () => {
    const p = mk();
    const m = initialMarkets();
    const r = buyGoods(p, m, "machinery", 3);
    expect(r.bought).toBe(3);
    expect(r.player.cargo.machinery).toBe(3);
    expect(r.player.credits).toBe(START_CREDITS - r.spent);
    expect(cargoUsed(r.player)).toBe(3);
  });

  it("can't buy past the hold", () => {
    const p = mk();                                   // courier: 12 t hold
    const m = initialMarkets();
    // Buy something cheap enough that money isn't the limit — regolith at Gateway
    // isn't sold, so use a light high-availability good. Force the hold limit
    // with a huge request of a cheap item where stock and money aren't binding.
    const r = buyGoods({ ...p, credits: 1e12 }, m, "machinery", 9999);
    expect(cargoUsed(r.player)).toBeLessThanOrEqual(cargoCapacity(r.player));
  });

  it("can't spend money it doesn't have", () => {
    const p = { ...mk(), credits: 1000 };             // instruments are millions/t
    const m = initialMarkets();
    const r = buyGoods(p, m, "instruments", 5);
    // Either it bought zero (error) or it bought within budget.
    if (r.error) expect(r.error).toBe("no-credits");
    else expect(r.spent).toBeLessThanOrEqual(1000);
  });

  it("can't buy what a site doesn't stock", () => {
    const p = mk();
    const m = initialMarkets();
    // Gateway doesn't produce or consume raw regolith.
    expect(buyGoods(p, m, "regolith", 5).error).toBe("not-sold-here");
  });
});

describe("selling", () => {
  it("empties the hold and pays out", () => {
    let p = mk(), m = initialMarkets();
    ({ player: p, markets: m } = buyGoods(p, m, "machinery", 4));
    const before = p.credits;
    const r = sellGoods(p, m, "machinery", 4);
    expect(r.sold).toBe(4);
    expect(r.player.cargo.machinery).toBeUndefined();   // hold cleared of it
    expect(r.player.credits).toBeGreaterThan(before);
  });

  it("can't sell what you don't have", () => {
    expect(sellGoods(mk(), initialMarkets(), "food", 3).error).toBe("none-to-sell");
  });

  it("selling into a market lowers what it pays next — you move the price", () => {
    let p = { ...mk(), cargo: { electronics: 60 } }, m = initialMarkets();
    const first = sellPrice(p, m.shackleton, SITE_BY_ID.shackleton, "electronics");
    p = { ...p, at: "shackleton" };
    const r = sellGoods(p, m, "electronics", 50);
    const after = sellPrice(r.player, r.markets.shackleton, SITE_BY_ID.shackleton, "electronics");
    expect(after).toBeLessThan(first);
  });
});

describe("the Trader skill is a real edge, not an exploit", () => {
  const market = initialMarkets();
  const site = SITE_BY_ID.leo;
  const good = "electronics";

  it("a better trader buys cheaper and sells dearer", () => {
    const ace = mk({ skills: { pilot: 3, trader: 10, engineer: 2, fighter: 1 } });
    const dud = mk({ skills: { pilot: 5, trader: 1, engineer: 5, fighter: 5 } });
    expect(buyPrice(ace, market.leo, site, good)).toBeLessThan(buyPrice(dud, market.leo, site, good));
    expect(sellPrice(ace, market.leo, site, good)).toBeGreaterThan(sellPrice(dud, market.leo, site, good));
  });

  it("even the best trader can't buy below a bounded fraction of the market price", () => {
    // No free money: the edge is capped, so buy < sell always holds and you
    // can't churn one market against itself for profit.
    const ace = mk({ skills: { pilot: 1, trader: 10, engineer: 4, fighter: 1 } });
    const buy = buyPrice(ace, market.leo, site, good);
    const sell = sellPrice(ace, market.leo, site, good);
    expect(sell).toBeGreaterThan(buy * 0.8);    // the spread stays sane, never punitive
    // Buy then immediately sell at the SAME site must lose money (the point).
    expect(sell).toBeLessThan(buy);
  });
});

describe("cost basis tells you what you paid", () => {
  it("records the weighted-average purchase price", () => {
    let p = mk(), m = initialMarkets();
    ({ player: p, markets: m } = buyGoods(p, m, "machinery", 3));
    expect(p.costBasis.machinery).toBeGreaterThan(0);
    // The basis should equal the unit price paid, on a single lot.
    const r2 = buyGoods(p, m, "machinery", 2);
    // After a second lot at a (slightly different) price, the basis is a blend
    // between the two, never outside their range.
    const lo = Math.min(p.costBasis.machinery, r2.unit);
    const hi = Math.max(p.costBasis.machinery, r2.unit);
    expect(r2.player.costBasis.machinery).toBeGreaterThanOrEqual(lo - 1);
    expect(r2.player.costBasis.machinery).toBeLessThanOrEqual(hi + 1);
  });

  it("reports profit and loss on a sale", () => {
    // Same-site round trip loses to the spread, so profit is negative — and the
    // number is reported, which is the whole point (a player sees it was a bad
    // trade).
    let p = mk(), m = initialMarkets();
    ({ player: p, markets: m } = buyGoods(p, m, "machinery", 3));
    const r = sellGoods(p, m, "machinery", 3);
    expect(r.paidPerTonne).toBeGreaterThan(0);
    expect(r.profit).toBeLessThan(0);              // sold at same site → loss
    expect(r.profit).toBe(r.profitPerTonne * 3);
  });

  it("forgets the basis once the hold is empty of a good", () => {
    let p = mk(), m = initialMarkets();
    ({ player: p, markets: m } = buyGoods(p, m, "machinery", 3));
    const r = sellGoods(p, m, "machinery", 3);
    expect(r.player.costBasis.machinery).toBeUndefined();
  });

  it("a real cross-site run shows a profit", () => {
    // Buy at Gateway (producer, cheap), carry to the Moon (importer, dear), sell.
    let p = mk(), m = initialMarkets();
    ({ player: p, markets: m } = buyGoods(p, m, "machinery", 3));
    const basis = p.costBasis.machinery;
    p = { ...p, at: "shackleton" };
    const r = sellGoods(p, m, "machinery", 3);
    expect(r.paidPerTonne).toBeCloseTo(Math.round(basis), 0);
    expect(r.profit).toBeGreaterThan(0);           // structural gain, cross-site
  });
});

describe("conservation — nothing from nothing", () => {
  it("a full buy-then-sell round trip conserves credits minus the spread", () => {
    let p = mk(), m = initialMarkets();
    const start = p.credits;
    ({ player: p, markets: m } = buyGoods(p, m, "machinery", 3));
    const r = sellGoods(p, m, "machinery", 3);
    // You end with less than you started (bought high-ish, sold at same site),
    // never more — a same-site round trip is a loss, which is what stops
    // infinite-money exploits.
    expect(r.player.credits).toBeLessThan(start);
    expect(cargoUsed(r.player)).toBe(0);
  });

  it("buy/sell never mutate the inputs", () => {
    const p = mk(), m = initialMarkets();
    const snapP = JSON.stringify(p), snapM = JSON.stringify(m);
    buyGoods(p, m, "machinery", 2);
    sellGoods({ ...p, cargo: { machinery: 2 } }, m, "machinery", 2);
    expect(JSON.stringify(p)).toBe(snapP);
    expect(JSON.stringify(m)).toBe(snapM);
  });

  it("net worth counts credits plus the hold", () => {
    let p = mk(), m = initialMarkets();
    const before = netWorth(p, m);
    ({ player: p, markets: m } = buyGoods(p, m, "machinery", 3));
    const after = netWorth(p, m);
    // Buying converts credits to cargo; net worth barely moves (down by the
    // spread only), rather than collapsing — the goods are still worth money.
    expect(after).toBeGreaterThan(before * 0.9);
    expect(after).toBeLessThanOrEqual(before);
  });
});
