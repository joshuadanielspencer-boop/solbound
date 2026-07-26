// ===========================================================================
// THE PLAYER — the captain, the ship, the money, and the hold.
//
// This is the Space Trader floor's state (design.md, decisions 2026-07-25). It
// deliberately sits ALONGSIDE the fleet sim rather than inside it: sim.js models
// a fleet of abstract craft for the strategy layer, while this models the one
// ship the player IS, with a captain, credits and a cargo manifest. They'll
// converge, but keeping them separate keeps each testable on its own.
//
// PURE FUNCTIONS, like everything else in this codebase. buyGoods/sellGoods
// return a new player and new markets; nothing mutates, so saves are trivial and
// the whole thing is testable without a browser.
//
// The captain's Trader skill reaches into buying and selling here — a better
// trader captures more of the spread. That's the skill EARNING its place by
// changing a decision the player already makes, not tweaking a hidden number.
// ===========================================================================

import { HULL_BY_ID, STARTER_HULL, fittedStats } from "./data/hulls.js";
import { COMMODITY_BY_ID } from "./data/commodities.js";
import { priceAt, buy as marketBuy, sell as marketSell } from "./market.js";
import { SITE_BY_ID } from "./data/sites.js";

// Starting capital is deliberately not "pocket change." SOLBOUND's dependency
// model makes cheap bulk goods unshippable on purpose (design.md §5), so the
// cheapest thing worth carrying — machinery at ~$64k/t — already costs real
// money. A captain who couldn't afford a few tonnes of it could make no first
// trade at all. $300k buys a partial hold of an entry good and leaves a buffer
// for fuel and repairs: capital-constrained, not broke. You can't fill the hold
// on day one, which is exactly the early-game tension we want.
export const START_CREDITS = 300000;
export const START_SITE = "leo";

/**
 * Create a new captain. `skills` must be a legal allocation (see captain.js);
 * validation lives there and is asserted by the caller/tests, not re-done here.
 */
export function newPlayer({ name, skills, avatar = null, hull = STARTER_HULL, modules = [] }) {
  const h = HULL_BY_ID[hull];
  return {
    name: name || "Captain",
    avatar,
    skills,
    credits: START_CREDITS,
    ship: {
      hull,
      modules,
      drive: "methalox",   // the starter engine; better drives are bought/unlocked later
      name: shipName(name),
      fuelTonnes: fittedStats(hull, modules).fuelTonnes,  // start with a full tank
    },
    at: START_SITE,        // docked here
    cargo: {},             // commodityId -> tonnes
    // What you paid, on average, per tonne of each good in the hold. Kept
    // alongside cargo (not inside it) so everything that reads cargo as plain
    // tonnage still works. Powers the "you paid $X, profit $Y" the sell screen
    // shows — the clarity touch that tells a player at a glance whether a trade
    // was good (Space Trader had exactly this).
    costBasis: {},         // commodityId -> avg dollars per tonne paid
    reputation: {},        // faction -> standing (built later)
    record: "clean",       // police record (built later)
    log: [],
  };
}

const shipName = (captain) => {
  // A quiet bit of texture: name the ship after the captain until they rename it.
  const stems = ["'s Venture", "'s Gamble", "'s Errand", "'s Long Way"];
  return `${(captain || "Captain").split(" ")[0]}${stems[(captain || "C").length % stems.length]}`;
};

// ---------------------------------------------------------------------------
// The hold
// ---------------------------------------------------------------------------

/** Tonnes currently in the hold. */
export const cargoUsed = (player) =>
  Object.values(player.cargo).reduce((a, b) => a + b, 0);

/** Total hold capacity, from the fitted ship. */
export const cargoCapacity = (player) =>
  fittedStats(player.ship.hull, player.ship.modules).cargoTonnes;

/** Free hold space, in tonnes. */
export const cargoFree = (player) => cargoCapacity(player) - cargoUsed(player);

// ---------------------------------------------------------------------------
// The bid-ask spread, and the Trader skill's effect on it
// ---------------------------------------------------------------------------
// THE HOUSE SPREAD is what stops the money printer. priceAt() is a mid price; a
// market SELLS to you above it and BUYS from you below it. Without this, buying
// a good makes it scarcer, so selling it straight back earns more than you paid
// — an infinite-money exploit that has nothing to do with travelling anywhere.
// The spread is friction that makes a same-site round trip always a loss, so the
// only way to profit is to actually MOVE goods to where they're wanted.
const HOUSE_SPREAD = 0.08;   // 8% each side; a round trip costs ~16% in friction

// A Trader skill of 4 (average) faces the full house spread. Each point narrows
// it, each point below widens it — but the bonus is capped below HOUSE_SPREAD,
// so buy price stays strictly above sell price for everyone. It's an edge on the
// spread, never a reversal of it.
const traderBonus = (player) => {
  const t = player.skills?.trader ?? 4;
  return Math.max(-HOUSE_SPREAD * 0.5, Math.min(HOUSE_SPREAD * 0.75, (t - 4) * 0.012));
};

// The spread applied to any mid price, exported so the intel layer (which works
// from ESTIMATED mid prices at remote sites) charges the captain exactly what a
// real transaction would. One source of truth for "what would I pay / get".
export const priceToBuy = (player, mid) => Math.round(mid * (1 + HOUSE_SPREAD - traderBonus(player)));
export const priceToSell = (player, mid) => Math.round(mid * (1 - HOUSE_SPREAD + traderBonus(player)));

/** What the captain actually pays to buy, per tonne (better trader → less). */
export const buyPrice = (player, market, site, id) => {
  const mid = priceAt(market, site, id);
  return mid == null ? null : priceToBuy(player, mid);
};

/** What the captain actually gets to sell, per tonne (better trader → more). */
export const sellPrice = (player, market, site, id) => {
  const mid = priceAt(market, site, id);
  return mid == null ? null : priceToSell(player, mid);
};

// ---------------------------------------------------------------------------
// Buying and selling — the atoms of the whole loop
// ---------------------------------------------------------------------------

/**
 * Buy `tonnes` of a commodity at the player's current site.
 *
 * Bounded by three real limits, checked in order: the market's stock, the hold's
 * free space, and the captain's credits. Returns { player, markets, bought,
 * spent } or a { error } explaining which limit bit — the UI turns that into a
 * plain sentence rather than a silent no-op.
 */
export function buyGoods(player, markets, id, tonnes) {
  const site = SITE_BY_ID[player.at];
  const market = markets[player.at];
  if (!site || !market || market.stock[id] === undefined) return { error: "not-sold-here" };

  const unit = buyPrice(player, market, site, id);
  const byMoney = Math.floor(player.credits / unit);
  const byHold = Math.floor(cargoFree(player));
  const byStock = Math.floor(market.stock[id]);
  const qty = Math.max(0, Math.min(tonnes, byMoney, byHold, byStock));

  if (qty <= 0) {
    return { error: byStock <= 0 ? "out-of-stock" : byHold <= 0 ? "hold-full" : "no-credits" };
  }

  // Move the goods out of the market at the market's price, then charge the
  // captain the (possibly better) trader price. The gap is the skill's value.
  const res = marketBuy(markets, player.at, id, qty);
  const spent = unit * qty;
  // Weighted-average cost basis: blend the new lot's price into whatever's
  // already aboard, so a later sale can honestly say what you paid.
  const had = player.cargo[id] || 0;
  const prevCost = player.costBasis?.[id] || 0;
  const newAvg = (had * prevCost + qty * unit) / (had + qty);
  return {
    player: {
      ...player,
      credits: player.credits - spent,
      cargo: { ...player.cargo, [id]: had + qty },
      costBasis: { ...player.costBasis, [id]: newAvg },
    },
    markets: res.markets,
    bought: qty,
    unit,
    spent,
  };
}

/** Sell `tonnes` from the hold at the current site. */
export function sellGoods(player, markets, id, tonnes) {
  const site = SITE_BY_ID[player.at];
  const market = markets[player.at];
  if (!site || !market) return { error: "no-market" };

  const have = player.cargo[id] || 0;
  const qty = Math.max(0, Math.min(tonnes, have));
  if (qty <= 0) return { error: "none-to-sell" };

  const unit = sellPrice(player, market, site, id);
  const res = marketSell(markets, player.at, id, qty);
  const remaining = have - qty;
  const cargo = { ...player.cargo };
  const costBasis = { ...player.costBasis };
  const paid = costBasis[id] || 0;
  if (remaining > 0) cargo[id] = remaining;
  else { delete cargo[id]; delete costBasis[id]; }   // hold empty of it → forget the basis

  return {
    player: { ...player, credits: player.credits + unit * qty, cargo, costBasis },
    markets: res.markets,
    sold: qty,
    unit,
    earned: unit * qty,
    // What the sale actually made against what you paid — the number that tells
    // you at a glance whether it was a good trade.
    paidPerTonne: Math.round(paid),
    profit: Math.round((unit - paid) * qty),
    profitPerTonne: Math.round(unit - paid),
    unwanted: res.unwanted,
  };
}

/** Net worth: credits plus the resale value of the hold at the current site. */
export function netWorth(player, markets) {
  const site = SITE_BY_ID[player.at];
  const market = markets?.[player.at];
  let hold = 0;
  for (const [id, qty] of Object.entries(player.cargo)) {
    const p = market ? sellPrice(player, market, site, id) : COMMODITY_BY_ID[id]?.valuePerTonne || 0;
    hold += p * qty;
  }
  return Math.round(player.credits + hold);
}
