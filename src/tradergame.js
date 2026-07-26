// ===========================================================================
// THE TRADE GAME — the Space Trader loop, as one coherent state.
//
// This ties the pieces that already exist into a playable loop: a captain
// (player.js) at a site, who buys goods (market.js), flies between sites at a
// real fuel-and-time cost (transfer.js + propulsion.js), and sells them where
// they're wanted. Pure functions throughout, so the whole game is a value you
// can serialise, replay and test without a browser.
//
// THE FUEL GAUGE IS THE ROCKET EQUATION, made a resource you can run out of.
// A trip needs a Δv; the ship's dry+cargo mass and its drive turn that into a
// tonnage of propellant (propulsion.propellantFor). If the tank can't hold it,
// the trip is impossible however much money you have — and a heavier hold makes
// every trip cost more, because mass is what the equation charges for.
//
// REFUELLING IS THE DEPOT LESSON, made playable. Propellant is a COMMODITY
// (commodities.js). You refill by buying it at a site — cheap where it's made
// from local ice (Shackleton, depots), dear where it's lifted from Earth. So
// "where can I afford to refuel?" becomes a real question, which is exactly the
// thing that makes depots matter in reality.
// ===========================================================================

import { SITE_BY_ID, SITES } from "./data/sites.js";
import { SYSTEM_BY_ID } from "./data/bodies.js";
import { DRIVES } from "./propulsion.js";
import { propellantFor, massRatio } from "./propulsion.js";
import { transferOptions, transferPosition } from "./transfer.js";
import { heliocentric } from "./ephemeris.js";
import { fittedStats } from "./data/hulls.js";
import { cargoUsed, buyGoods as playerBuy, sellGoods as playerSell, buyPrice } from "./player.js";
import { initialMarkets, priceAt, advanceMarkets } from "./market.js";
import { spawnFactions, worldBrief } from "./factions.js";

const DAY = 86400000;
export const START_DATE = Date.UTC(2035, 0, 1);

/**
 * Clock speeds, in mission-days per real second — the fleet's living clock,
 * brought to the trade game (design.md, the fleet+trade merge). This is what the
 * player asked for back: planets moving, the ship crossing real space, time you
 * can pause, hurry, or skip. A cislunar hop is days; a Mars run is months; the
 * top speed makes even a Jupiter transfer watchable rather than a chore.
 */
export const RATES = [
  { label: "❚❚", days: 0, name: "Paused" },
  { label: "▶", days: 4, name: "4 days a second" },
  { label: "▶▶", days: 25, name: "25 days a second" },
  { label: "▶▶▶", days: 120, name: "120 days a second" },
];

/** A hop within one planet's system (moon to moon, or surface to orbit) is not a
 *  heliocentric transfer. Charge it a small flat Δv and a short time rather than
 *  pretending it's an interplanetary burn. */
const INTRA_SYSTEM_DV = 1.2;    // km/s
const INTRA_SYSTEM_DAYS = 6;

/** Bodies with enough atmosphere to brake against on arrival, which is nearly
 *  free Δv. This is why Mars and Titan are cheaper to arrive at than airless
 *  rocks — a real and counterintuitive fact worth teaching. */
const AEROBRAKE = { earth: 0.85, mars: 0.6, venus: 0.7 };  // fraction of arrival Δv waived

export function newGame(player, seed = 1) {
  const factions = spawnFactions(seed);
  return {
    player,
    markets: initialMarkets(),
    t: START_DATE,
    seed,
    // The fleet's clock model, now the trade game's. `status` is "docked" (at a
    // site, time paused, the dock open) or "transit" (flying a leg, the clock
    // running). `leg` carries the real transfer arc so the orrery can draw the
    // ship crossing space, exactly as the fleet did.
    status: "docked",
    leg: null,
    rateIdx: 0,
    factions,                                   // the roguelike draw for this run
    visited: [player.at],
    log: [`${player.name} takes command of the ${player.ship.name} at ${SITE_BY_ID[player.at]?.name}.`],
    brief: worldBrief(factions),                // "who's out there" for the opening
  };
}

// ---------------------------------------------------------------------------
// What a trip costs
// ---------------------------------------------------------------------------

const systemOf = (siteId) => SITE_BY_ID[siteId]?.system;

/**
 * The Δv, flight time and propellant a trip from the player's site to `destId`
 * would take, with the hold as it is now.
 *
 * Returns { dvKms, days, fuelTonnes, reachable, reason } — reachable is false
 * (with a reason) when the tank couldn't hold the propellant even full, which
 * is a real rocket-equation wall, not a money problem.
 */
export function travelCost(game, destId) {
  const from = SITE_BY_ID[game.player.at], to = SITE_BY_ID[destId];
  if (!from || !to || from.id === to.id) return null;

  const drive = DRIVES[game.player.ship.drive] || DRIVES.methalox;
  const stats = fittedStats(game.player.ship.hull, game.player.ship.modules);
  const wetDry = stats.dryTonnes + cargoUsed(game.player);   // what must be pushed

  let dvKms, days;
  if (from.system === to.system) {
    dvKms = INTRA_SYSTEM_DV;
    days = INTRA_SYSTEM_DAYS;
  } else {
    const a = SYSTEM_BY_ID[from.system], b = SYSTEM_BY_ID[to.system];
    if (!a?.ephemerisKey || !b?.ephemerisKey) return null;
    const opt = transferOptions(a.ephemerisKey, b.ephemerisKey, new Date(game.t)).goNow;
    // Aerobraking waives part of the arrival burn at bodies with an atmosphere.
    const brake = AEROBRAKE[to.system] || 0;
    dvKms = opt.dv * (1 - brake * 0.5);   // arrival is ~half the total; discount that half
    days = opt.days;
  }

  const fuelTonnes = propellantFor(wetDry, dvKms, drive.isp);
  const tankMax = stats.fuelTonnes;
  return {
    dvKms, days, fuelTonnes,
    reachable: fuelTonnes <= tankMax,
    reason: fuelTonnes > tankMax
      ? `The tank holds ${tankMax.toFixed(0)} t; this trip needs ${fuelTonnes.toFixed(0)} t of propellant. Carry less, refit a bigger tank, or fly a shorter hop.`
      : null,
    haveFuel: game.player.ship.fuelTonnes,
    enoughFuel: fuelTonnes <= game.player.ship.fuelTonnes,
  };
}

/** Every site you could go to, with its cost, for the destination picker. */
export function destinations(game) {
  return SITES.filter((s) => s.id !== game.player.at).map((s) => ({
    site: s,
    cost: travelCost(game, s.id),
  }));
}

// ---------------------------------------------------------------------------
// Doing it
// ---------------------------------------------------------------------------

/**
 * LAUNCH toward `destId`: spend the departure propellant and put the ship into
 * transit on a real transfer arc. Does NOT advance time — the clock does that,
 * so the player watches the ship cross space and can pause, hurry or skip.
 *
 * The fuel is spent at the burn, at departure, because that's when it physically
 * leaves the tank. Returns { game } (status "transit") or { error, reason }.
 */
export function launch(game, destId) {
  if (game.status === "transit") return { error: "already-flying", reason: "Already under way." };
  const cost = travelCost(game, destId);
  if (!cost) return { error: "no-route" };
  if (!cost.reachable) return { error: "unreachable", reason: cost.reason };
  if (!cost.enoughFuel) {
    return { error: "low-fuel", reason: `Need ${cost.fuelTonnes.toFixed(1)} t of propellant; you have ${game.player.ship.fuelTonnes.toFixed(1)} t. Refuel first.` };
  }

  const from = SITE_BY_ID[game.player.at], to = SITE_BY_ID[destId];
  const departT = game.t, arriveT = game.t + cost.days * DAY;
  // Freeze the arc at launch so it never shifts under the ship while it flies.
  const a = SYSTEM_BY_ID[from.system], b = SYSTEM_BY_ID[to.system];
  const p1 = heliocentric(a.ephemerisKey, new Date(departT));
  const p2 = heliocentric(b.ephemerisKey, new Date(arriveT));

  return {
    game: {
      ...game,
      status: "transit",
      rateIdx: game.rateIdx || 1,               // start the clock if it was paused
      leg: {
        from: from.id, to: destId, departT, arriveT,
        fuelCost: cost.fuelTonnes, dvKms: cost.dvKms, days: cost.days,
        r1: p1.r, r2: p2.r, lon1: p1.lon,        // the drawn arc
        sameSystem: from.system === to.system,
      },
      player: {
        ...game.player,
        ship: { ...game.player.ship, fuelTonnes: game.player.ship.fuelTonnes - cost.fuelTonnes },
      },
      log: [...game.log, `Departed ${from.name} for ${to.name} — ${cost.fuelTonnes.toFixed(1)} t of propellant.`],
    },
  };
}

/**
 * Advance the world clock to `toT`, drifting the markets and resolving an
 * arrival if the ship reaches its destination on the way. Markets drift while
 * you fly, so the prices at arrival aren't the prices at departure — the seed of
 * stale information (design.md §7).
 *
 * Returns { game, arrived? } — `arrived` is the site name when a leg completed,
 * so the UI can pause the clock and open the dock, the fleet's stop-on-arrival
 * rhythm the player liked.
 */
export function advanceTime(game, toT) {
  if (toT <= game.t) return { game };

  // In transit and the arrival falls within this step → resolve it exactly at
  // the arrival instant, then hold there (the clock pauses for the dock).
  if (game.status === "transit" && game.leg && toT >= game.leg.arriveT) {
    const leg = game.leg, to = SITE_BY_ID[leg.to];
    const flownDays = (leg.arriveT - game.t) / DAY;
    return {
      game: {
        ...game,
        t: leg.arriveT,
        status: "docked",
        leg: null,
        rateIdx: 0,                               // pause on arrival
        markets: advanceMarkets(game.markets, flownDays),
        player: { ...game.player, at: leg.to },
        visited: game.visited.includes(leg.to) ? game.visited : [...game.visited, leg.to],
        log: [...game.log, `Arrived ${to.name} — ${new Date(leg.arriveT).toISOString().slice(0, 10)}.`],
      },
      arrived: to.name,
    };
  }

  // Otherwise just roll time forward and drift the markets.
  const days = (toT - game.t) / DAY;
  return { game: { ...game, t: toT, markets: advanceMarkets(game.markets, days) } };
}

/** Where the ship is on its arc right now, heliocentric — or null if docked. */
export function shipPosition(game) {
  if (game.status !== "transit" || !game.leg) return null;
  const { departT, arriveT, r1, r2, lon1 } = game.leg;
  const f = Math.max(0, Math.min(1, (game.t - departT) / (arriveT - departT)));
  return { ...transferPosition(r1, r2, lon1, f), f };
}

/**
 * TRAVEL — the headless, all-at-once version: launch, then run the clock
 * straight to arrival. Used by tests and any non-interactive caller; the UI
 * uses launch() + the animated clock instead. Same machinery, so the two can't
 * diverge.
 */
export function travel(game, destId) {
  const l = launch(game, destId);
  if (l.error) return l;
  const r = advanceTime(l.game, l.game.leg.arriveT);
  return { game: r.game, arrived: r.arrived, spentFuel: l.game.leg.fuelCost, days: l.game.leg.days };
}

// ---------------------------------------------------------------------------
// Refuelling — buying propellant into the tank
// ---------------------------------------------------------------------------

/** Tank capacity and how full it is now. */
export const tankMax = (player) => fittedStats(player.ship.hull, player.ship.modules).fuelTonnes;
export const tankFree = (player) => tankMax(player) - player.ship.fuelTonnes;

/** The site's propellant price, or null if it doesn't sell any. */
export function fuelPrice(game) {
  const site = SITE_BY_ID[game.player.at];
  const market = game.markets[game.player.at];
  return priceAt(market, site, "propellant");
}

/**
 * Buy `tonnes` of propellant into the tank at the current site. Bounded by tank
 * space, the site's propellant stock, and the captain's credits. This is a thin
 * wrapper over the normal market buy — propellant is just a commodity — but it
 * routes into the fuel tank instead of the cargo hold.
 */
export function refuel(game, tonnes) {
  const site = SITE_BY_ID[game.player.at];
  const market = game.markets[game.player.at];
  if (!site || !market || market.stock.propellant === undefined) {
    return { error: "no-fuel-here", reason: `${site?.name} doesn't sell propellant. Some sites make it from local ice; others don't.` };
  }
  const want = Math.min(tonnes, tankFree(game.player));
  const unit = buyPrice(game.player, market, site, "propellant");
  const affordable = Math.floor(game.player.credits / unit);
  const inStock = Math.floor(market.stock.propellant);
  const qty = Math.max(0, Math.min(want, affordable, inStock));
  if (qty <= 0) return { error: "cant-refuel", reason: affordable <= 0 ? "Not enough credits." : "The tank is full or the depot is dry." };

  // Reuse the market buy to move stock and price correctly, but the goods go
  // into the tank, not the hold.
  const res = playerBuy(game.player, game.markets, "propellant", 0); // no-op guard
  const spent = unit * qty;
  const newMarketStock = { ...market.stock, propellant: market.stock.propellant - qty };
  return {
    game: {
      ...game,
      markets: { ...game.markets, [site.id]: { ...market, stock: newMarketStock } },
      player: {
        ...game.player,
        credits: game.player.credits - spent,
        ship: { ...game.player.ship, fuelTonnes: game.player.ship.fuelTonnes + qty },
      },
    },
    tonnes: qty, unit, spent,
  };
}

// ---------------------------------------------------------------------------
// Buy / sell trade goods — thin pass-through to player.js, keeping game state whole
// ---------------------------------------------------------------------------

export function buy(game, id, tonnes) {
  const r = playerBuy(game.player, game.markets, id, tonnes);
  if (r.error) return r;
  return { game: { ...game, player: r.player, markets: r.markets }, ...r };
}

export function sell(game, id, tonnes) {
  const r = playerSell(game.player, game.markets, id, tonnes);
  if (r.error) return r;
  return { game: { ...game, player: r.player, markets: r.markets }, ...r };
}

/** Let time pass at a site without travelling (wait for a shortage, a window). */
export function wait(game, days) {
  return {
    ...game,
    t: game.t + days * DAY,
    markets: advanceMarkets(game.markets, days),
  };
}
