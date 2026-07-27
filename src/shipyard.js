// ===========================================================================
// THE SHIP YARD — where money finally has somewhere to go.
//
// Space Trader's Ship Yard + Buy Ship screens: repair the hull, fit modules,
// and trade up to a bigger vessel — gated by the port's tech level, exactly as
// the original did (better ships only at developed ports). This is the core
// PROGRESSION SINK the game was missing: trading piles up credits, and the yard
// is what turns them into reach, hold, and capability.
//
// Pure functions on the game value, like everything else. Each returns a new
// game or an { error, reason } the UI can speak plainly.
// ===========================================================================

import {
  HULLS, HULL_BY_ID, MODULE_BY_ID, MODULES, fittedStats, slotUsage,
  HULL_RESALE, MODULE_RESALE, ESCAPE_POD, SLOT_KINDS,
} from "./data/hulls.js";
import { siteOf, techOf } from "./data/sites.js";
import { cargoUsed } from "./player.js";
import { berthsFor } from "./data/crew.js";

/** What a ship (hull + its fitted modules) is worth as a trade-in. Never the
 *  full price — a used hull loses value, which makes buying up a commitment. */
export function tradeInValue(ship) {
  const hull = HULL_BY_ID[ship.hull];
  let v = (hull?.price || 0) * HULL_RESALE;
  for (const id of ship.modules || []) v += (MODULE_BY_ID[id]?.price || 0) * MODULE_RESALE;
  // A battered hull is worth less — you can't sell damage.
  return Math.round(v * (0.4 + 0.6 * ((ship.hullPct ?? 100) / 100)));
}

// ---------------------------------------------------------------------------
// The escape pod — the cheapest insurance in the game
// ---------------------------------------------------------------------------

/** Buy the pod. It is not a module and takes no bay; you have one or you don't. */
export function buyEscapePod(game) {
  const ship = game.player.ship;
  if (ship.escapePod) return { error: "already-have", reason: "There's already a pod aboard." };
  if (game.player.credits < ESCAPE_POD.price) {
    return { error: "credits", reason: `A pod costs ${ESCAPE_POD.price.toLocaleString()} credits. Cheaper than the alternative.` };
  }
  return {
    game: {
      ...game,
      player: {
        ...game.player,
        credits: game.player.credits - ESCAPE_POD.price,
        ship: { ...ship, escapePod: true },
      },
      log: [...(game.log || []), `Escape pod fitted at ${siteOf(game, game.player.at)?.name}.`],
    },
    spent: ESCAPE_POD.price,
  };
}

// ---------------------------------------------------------------------------
// Buying a ship
// ---------------------------------------------------------------------------

/**
 * The ships this port sells, each with its NET cost after trading in your
 * current hull. Gated by tech level: a frontier outpost sells only the starter,
 * a Core port sells everything. A cheaper ship shows a negative net cost — you
 * get money back for downsizing, just like the original.
 */
export function shipsForSale(game, siteId) {
  const site = siteOf(game, siteId);
  const tech = techOf(site).n;
  const trade = tradeInValue(game.player.ship);
  return HULLS.filter((h) => tech >= (h.minTech || 1)).map((h) => {
    const owned = h.id === game.player.ship.hull;
    const net = owned ? 0 : h.price - trade;
    return {
      hull: h, owned,
      net,
      affordable: owned ? false : net <= game.player.credits,
      // A downgrade can't hold your current cargo or your current crew — flag
      // both so the UI can stop it before it strands anything.
      cargoFits: fittedStats(h.id, []).cargoTonnes >= cargoUsed(game.player),
      crewFits: berthsFor(h) >= (game.player.crew?.length || 0),
      berths: berthsFor(h),
    };
  });
}

/**
 * Trade the current ship for `hullId`. Pays the net cost (or refunds it, if you
 * downsized), delivers the new hull empty of modules with a full tank and a
 * pristine hull. Your cargo carries over — but only if it fits.
 */
export function buyShip(game, siteId, hullId) {
  const site = siteOf(game, siteId);
  const h = HULL_BY_ID[hullId];
  if (!h) return { error: "no-such-ship" };
  if (hullId === game.player.ship.hull) return { error: "already-own", reason: "You're flying it." };
  if (techOf(site).n < (h.minTech || 1)) {
    return { error: "tech", reason: `${site.name} can't build a ${h.name} — it needs a more developed yard.` };
  }
  const stats = fittedStats(hullId, []);
  if (stats.cargoTonnes < cargoUsed(game.player)) {
    return { error: "cargo", reason: `A ${h.name} can't hold your ${cargoUsed(game.player)} t of cargo. Sell some first.` };
  }
  // You cannot leave people behind by accident. A smaller hull means paying
  // somebody off first, deliberately.
  if (berthsFor(h) < (game.player.crew?.length || 0)) {
    return {
      error: "crew",
      reason: `A ${h.name} has ${berthsFor(h)} berth${berthsFor(h) === 1 ? "" : "s"} beside yours, and you're carrying ${game.player.crew.length}. Pay someone off first.`,
    };
  }
  const net = h.price - tradeInValue(game.player.ship);
  if (net > game.player.credits) {
    return { error: "credits", reason: `You need ${net.toLocaleString()} credits after trade-in.` };
  }

  return {
    game: {
      ...game,
      player: {
        ...game.player,
        credits: game.player.credits - net,
        ship: {
          ...game.player.ship,
          hull: hullId,
          modules: [],                    // a fresh ship; re-fit what you want
          fuelTonnes: stats.fuelTonnes,   // delivered full
          hullPct: 100,
        },
      },
      log: [...(game.log || []), `Traded up to a ${h.name} at ${site.name}.`],
    },
    hullName: h.name,
    net,
  };
}

// ---------------------------------------------------------------------------
// Fitting modules
// ---------------------------------------------------------------------------

/** The modules a port sells, with whether you can fit each right now. */
export function modulesForSale(game) {
  const ship = game.player.ship;
  const slots = slotUsage(ship.hull, ship.modules);
  return MODULES.map((m) => ({
    module: m,
    fitted: ship.modules.includes(m.id),
    slotKind: SLOT_KINDS[m.slot],
    slotsFree: slots.free[m.slot],
    canFit: slots.free[m.slot] > 0 && game.player.credits >= m.price && !ship.modules.includes(m.id),
  }));
}

/** Buy and install a module, if the hull has a bay OF THAT KIND and the credits. */
export function fitModule(game, moduleId) {
  const m = MODULE_BY_ID[moduleId];
  const ship = game.player.ship;
  if (!m) return { error: "no-such-module" };
  if (ship.modules.includes(moduleId)) return { error: "already-fitted", reason: "Already aboard." };
  const slots = slotUsage(ship.hull, ship.modules);
  if (slots.free[m.slot] <= 0) {
    const kind = SLOT_KINDS[m.slot].name.toLowerCase();
    return {
      error: "no-slot",
      reason: slots.total[m.slot] === 0
        ? `A ${HULL_BY_ID[ship.hull].name} has no ${kind} bay at all. That's the hull, not the money.`
        : `No free ${kind} bay — remove something first.`,
    };
  }
  if (game.player.credits < m.price) return { error: "credits", reason: `A ${m.name} costs ${m.price.toLocaleString()} credits.` };

  return {
    game: {
      ...game,
      player: {
        ...game.player,
        credits: game.player.credits - m.price,
        ship: { ...ship, modules: [...ship.modules, moduleId] },
      },
    },
    fitted: m.name, spent: m.price,
  };
}

/**
 * Remove a module and sell it back for part of its value. Blocked if pulling it
 * would shrink the hold or tank below what's currently in use — you can't strip
 * a cargo bay you're standing cargo in.
 */
export function removeModule(game, moduleId) {
  const m = MODULE_BY_ID[moduleId];
  const ship = game.player.ship;
  if (!m || !ship.modules.includes(moduleId)) return { error: "not-fitted" };

  const without = ship.modules.filter((id) => id !== moduleId);
  const after = fittedStats(ship.hull, without);
  if (after.cargoTonnes < cargoUsed(game.player)) {
    return { error: "cargo-in-way", reason: "Your hold is too full to remove this bay. Sell some cargo first." };
  }
  const refund = Math.round(m.price * MODULE_RESALE);
  const fuel = Math.min(game.player.ship.fuelTonnes, after.fuelTonnes);   // can't keep fuel a smaller tank won't hold
  return {
    game: {
      ...game,
      player: {
        ...game.player,
        credits: game.player.credits + refund,
        ship: { ...ship, modules: without, fuelTonnes: fuel },
      },
    },
    removed: m.name, refund,
  };
}

// ---------------------------------------------------------------------------
// Repair
// ---------------------------------------------------------------------------

/** Cost to fully repair the hull, scaled by how much damage and how big the
 *  ship is (a bigger hull costs more per point to patch). */
export function repairCost(game) {
  const ship = game.player.ship;
  const damage = 100 - (ship.hullPct ?? 100);
  if (damage <= 0) return 0;
  const hull = HULL_BY_ID[ship.hull];
  const perPct = 400 + (hull?.dryTonnes || 10) * 60;
  return Math.round(damage * perPct);
}

/** Repair up to `pct` points of hull (default: all you can afford / need). */
export function repairHull(game, pct = 100) {
  const ship = game.player.ship;
  const damage = 100 - (ship.hullPct ?? 100);
  if (damage <= 0) return { error: "no-damage", reason: "The hull is already sound." };
  const hull = HULL_BY_ID[ship.hull];
  const perPct = 400 + (hull?.dryTonnes || 10) * 60;
  const wanted = Math.min(pct, damage);
  const affordablePct = Math.min(wanted, Math.floor(game.player.credits / perPct));
  if (affordablePct <= 0) return { error: "credits", reason: `Repairs run ${perPct.toLocaleString()} credits a point.` };
  const cost = affordablePct * perPct;
  return {
    game: {
      ...game,
      player: {
        ...game.player,
        credits: game.player.credits - cost,
        ship: { ...ship, hullPct: (ship.hullPct ?? 100) + affordablePct },
      },
    },
    repaired: affordablePct, cost,
  };
}
