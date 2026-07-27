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

import { siteOf, techOf } from "./data/sites.js";
import { SYSTEM_BY_ID } from "./data/bodies.js";
import { DRIVES } from "./propulsion.js";
import { propellantFor, massRatio, tankAfter } from "./propulsion.js";
import { transferOptions, transferPosition, hohmann } from "./transfer.js";
import { heliocentric } from "./ephemeris.js";
import { fittedStats } from "./data/hulls.js";
import { cargoUsed, buyGoods as playerBuy, sellGoods as playerSell, buyPrice } from "./player.js";
import { initialMarkets, priceAt, advanceMarkets } from "./market.js";
import { spawnFactions, worldBrief, marketMods } from "./factions.js";
import { spawnSites } from "./worldgen.js";
import { rollLegEvent, resolveEncounter, dismissEncounter } from "./encounters.js";
import { ENCOUNTER_BY_ID } from "./data/encounters.js";
import { dailyWages, payWages } from "./crew.js";

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
 *  free Δv. This is why Mars and Venus are cheaper to REACH than airless rocks
 *  despite being real distances — a genuinely counterintuitive true thing, and
 *  the thing that makes a starter cargo run to Mars feasible at all. Fraction of
 *  the arrival burn an atmosphere lets you shed. */
const AEROBRAKE = { earth: 0.85, mars: 0.85, venus: 0.9 };

export function newGame(player, seed = 1) {
  // The world itself is drawn now: the seven core sites plus 9-13 more places
  // from the atlas census, each with a generated installation and operator
  // (worldgen.js). Sites live ON the game and travel in the save, so a home
  // port can never stop existing when the generator changes.
  const sites = spawnSites(seed);
  const factions = spawnFactions(seed, sites);
  // The faction draw reaches the shelves: each placed actor bends its home
  // market (glut, demand, crisis, what it produces), and the market carries
  // those modifiers from here on so prices never disagree with the newspaper.
  const mods = Object.fromEntries(sites.map((s) => [s.id, marketMods(factions, s.id)]));
  return {
    player,
    sites,
    surveyed: [],                               // systems swept by a survey lab (atlas reveals)
    markets: initialMarkets(mods, sites),
    t: START_DATE,
    seed,
    // The fleet's clock model, now the trade game's. `status` is "docked" (at a
    // site, time paused, the dock open) or "transit" (flying a leg, the clock
    // running). `leg` carries the real transfer arc so the orrery can draw the
    // ship crossing space, exactly as the fleet did.
    status: "docked",
    leg: null,
    rateIdx: 0,
    // The encounter layer. `rollCursor` is the determinism contract save.js
    // insists on: every roll is keyed to (seed, cursor), so a reload replays the
    // same trouble rather than rerolling it, and a shared seed replays exactly.
    // `encounter` is the one currently on screen, if any.
    rollCursor: 0,
    encounter: null,
    factions,                                   // the roguelike draw for this run
    // Standing moves during encounters and is written back onto `factions`; this
    // is the receipt for each move (reputation.js), so the standing screen can
    // say what it TOOK as well as where you ended up.
    repLog: [],
    visited: [player.at],
    log: [`${player.name} takes command of the ${player.ship.name} at ${sites.find((s) => s.id === player.at)?.name}.`],
    brief: worldBrief(factions),                // "who's out there" for the opening
  };
}

// ---------------------------------------------------------------------------
// What a trip costs
// ---------------------------------------------------------------------------

const systemOf = (game, siteId) => siteOf(game, siteId)?.system;

/**
 * The Δv, flight time and propellant a trip from the player's site to `destId`
 * would take, with the hold as it is now.
 *
 * Returns { dvKms, days, fuelTonnes, reachable, reason } — reachable is false
 * (with a reason) when the tank couldn't hold the propellant even full, which
 * is a real rocket-equation wall, not a money problem.
 */
/**
 * WHAT THE CLOCK COSTS. Space Trader's "current costs" line, and the reason it
 * matters: before crew, credits only ever moved up between purchases, so time
 * was free — dithering in port, taking the slow route and waiting out a shortage
 * all cost nothing. A wage bill running every day makes the calendar a resource,
 * which is what a game about eight-month transfers needs it to be.
 */
export const dailyCost = (game) => dailyWages(game.player);
export const tripCost = (game, days) => Math.round(dailyCost(game) * days);

export function travelCost(game, destId) {
  const from = siteOf(game, game.player.at), to = siteOf(game, destId);
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
    // Minimum-energy transfer between the two orbits at their current radii.
    const ra = heliocentric(a.ephemerisKey, new Date(game.t)).r;
    const rb = heliocentric(b.ephemerisKey, new Date(game.t)).r;
    const h = hohmann(ra, rb);
    const brake = AEROBRAKE[to.system] || 0;
    // The DEPARTURE burn is unavoidable; the ARRIVAL burn is what an atmosphere
    // lets you brake away for nearly free. Magnitudes, because an inward transfer
    // (to Venus) has negative signed burns. Ideal Hohmann (no window penalty) so
    // a route's cost is predictable rather than swinging with the date — the
    // launch-window trade can return later as a discount, not a confusing tax.
    dvKms = Math.abs(h.dv1) + Math.abs(h.dv2) * (1 - brake);
    days = h.days;
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
  return (game.sites || []).filter((s) => s.id !== game.player.at).map((s) => ({
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

  const from = siteOf(game, game.player.at), to = siteOf(game, destId);
  const departT = game.t, arriveT = game.t + cost.days * DAY;
  // Freeze the arc at launch so it never shifts under the ship while it flies.
  const a = SYSTEM_BY_ID[from.system], b = SYSTEM_BY_ID[to.system];
  const p1 = heliocentric(a.ephemerisKey, new Date(departT));
  const p2 = heliocentric(b.ephemerisKey, new Date(arriveT));

  // ROLL THE LEG'S TROUBLE NOW, not tick by tick. One roll at departure, keyed
  // to the run's seed and a cursor, decides whether something happens and when.
  // Rolling per tick would make the outcome depend on the clock RATE, which is a
  // player setting — the fast-forward button must not change the world.
  const cursor = game.rollCursor ?? 0;
  const legBase = { from: from.id, to: destId, days: cost.days };
  const event = rollLegEvent(game, legBase, cursor);
  const atT = event && !event.quiet ? departT + event.atFraction * (arriveT - departT) : null;

  return {
    game: {
      ...game,
      status: "transit",
      rateIdx: game.rateIdx || 1,               // start the clock if it was paused
      rollCursor: cursor + 1,
      paperAt: null,                            // yesterday's paper, and you've left

      leg: {
        from: from.id, to: destId, departT, arriveT,
        fuelCost: cost.fuelTonnes, dvKms: cost.dvKms, days: cost.days,
        r1: p1.r, r2: p2.r, lon1: p1.lon,        // the drawn arc
        sameSystem: from.system === to.system,
        event: event && !event.quiet ? { ...event, atT } : null,
        quietNote: event?.quiet ? event.note : null,
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
/**
 * Everything that happens purely because `days` went by: markets drift, the crew
 * get paid, and cryogenic propellant boils away. One place, so the clock's three
 * stopping points (an encounter, an arrival, an ordinary tick) can't disagree
 * about what a day costs.
 *
 * BOIL-OFF is what stops a better drive from being simply a better drive. Methane
 * keeps — which is exactly why it was picked for Mars. Hydrogen does not, and both
 * hydrolox and NERVA-class nuclear thermal fly on hydrogen, so the era that
 * doubles your exhaust velocity also drains your reserve while you coast. The
 * cryocooler is the answer, and it costs a gadget bay.
 *
 * It is applied to what is left in the TANK, not to the trip: the propellant for a
 * leg is spent at the departure burn, so boil-off eats the reserve you were going
 * to arrive with. It can make a port you cannot refuel at into a trap. It can
 * never strand you mid-flight, which would be a gotcha rather than a lesson.
 */
function passTime(game, days) {
  const w = payWages(game.player, days);
  const drive = DRIVES[w.player.ship.drive] || DRIVES.methalox;
  const stats = fittedStats(w.player.ship.hull, w.player.ship.modules);
  const kept = tankAfter(w.player.ship.fuelTonnes, drive, days, stats?.cryo ? CRYO_FACTOR : 1);
  return {
    player: kept === w.player.ship.fuelTonnes
      ? w.player
      : { ...w.player, ship: { ...w.player.ship, fuelTonnes: Math.max(0, kept) } },
    markets: advanceMarkets(game.markets, days),
    quit: w.quit,
  };
}

/** What a cryocooler multiplies the boil-off rate by. A tenth: active
 *  refrigeration is the difference between "loses most of it over a Saturn run"
 *  and "loses a fifth", which is the difference between possible and not. */
export const CRYO_FACTOR = 0.1;

export function advanceTime(game, toT) {
  if (toT <= game.t) return { game };
  // An unresolved encounter holds the clock. The player has a decision to make
  // and the world waits for it, exactly as it waits at a dock.
  if (game.encounter && !game.encounter.outcome) return { game };
  if (game.over) return { game };

  // Trouble on the way, and it falls within this step → stop AT it, pause the
  // clock, and hand the decision up. Same rhythm as an arrival, which is the
  // rhythm the fleet sim established and the player liked.
  const ev = game.status === "transit" ? game.leg?.event : null;
  if (ev && !ev.fired && toT >= ev.atT) {
    const days = (ev.atT - game.t) / DAY;
    const p = passTime(game, days);
    return {
      game: {
        ...game,
        t: ev.atT,
        rateIdx: 0,
        markets: p.markets,
        player: p.player,
        leg: { ...game.leg, event: { ...ev, fired: true } },
        encounter: { ...ev, outcome: null },
      },
      encounter: ENCOUNTER_BY_ID[ev.encounterId]?.title || "Encounter",
      quit: p.quit,
    };
  }

  // In transit and the arrival falls within this step → resolve it exactly at
  // the arrival instant, then hold there (the clock pauses for the dock).
  if (game.status === "transit" && game.leg && toT >= game.leg.arriveT) {
    const leg = game.leg, to = siteOf(game, leg.to);
    const flownDays = (leg.arriveT - game.t) / DAY;
    const p = passTime(game, flownDays);
    // RESEARCH AS PLAY: a fitted survey lab sweeps the whole system on arrival,
    // revealing every atlas place there — including the ones nobody occupied
    // this run. This is the lab module's first real job, and it is the loop the
    // design wants: you learn the real solar system because learning it pays.
    const canSurvey = fittedStats(game.player.ship.hull, game.player.ship.modules).canSurvey;
    const surveyed = canSurvey && !(game.surveyed || []).includes(to.system)
      ? [...(game.surveyed || []), to.system]
      : (game.surveyed || []);
    return {
      game: {
        ...game,
        t: leg.arriveT,
        status: "docked",
        leg: null,
        rateIdx: 0,                               // pause on arrival
        markets: p.markets,
        surveyed,
        player: { ...p.player, at: leg.to },
        visited: game.visited.includes(leg.to) ? game.visited : [...game.visited, leg.to],
        log: [
          ...game.log,
          `Arrived ${to.name} — ${new Date(leg.arriveT).toISOString().slice(0, 10)}.`,
          ...p.quit.map((c) => `${c.name} left the ship at ${to.name} — unpaid wages.`),
        ],
      },
      arrived: to.name,
      quit: p.quit,
    };
  }

  // Otherwise just roll time forward, drift the markets, and pay the crew.
  const days = (toT - game.t) / DAY;
  const p = passTime(game, days);
  return { game: { ...game, t: toT, markets: p.markets, player: p.player }, quit: p.quit };
}

/** Where the ship is on its arc right now, heliocentric — or null if docked. */
export function shipPosition(game) {
  if (game.status !== "transit" || !game.leg) return null;
  const { departT, arriveT, r1, r2, lon1 } = game.leg;
  const f = Math.max(0, Math.min(1, (game.t - departT) / (arriveT - departT)));
  return { ...transferPosition(r1, r2, lon1, f), f };
}

/**
 * The choice a headless caller makes when trouble finds it: the passive one it
 * can actually take. Deliberately ordered from meekest outward, so an automated
 * crossing never picks a fight it didn't have to.
 */
const PASSIVE_ORDER = ["ignore", "comply", "submit", "talk", "trade", "salvage", "help", "bribe", "flee", "fight"];
const autoChoice = (encounterId) => {
  const enc = ENCOUNTER_BY_ID[encounterId];
  return PASSIVE_ORDER.find((a) => enc?.actions.includes(a)) || enc?.actions[0];
};

/**
 * TRAVEL — the headless, all-at-once version: launch, then run the clock
 * straight to arrival. Used by tests and any non-interactive caller; the UI
 * uses launch() + the animated clock instead. Same machinery, so the two can't
 * diverge.
 *
 * Encounters DO fire on this path — a headless crossing that skipped the risk
 * layer would be a second, safer game. It simply makes the passive choice and
 * records what happened in `events`, so a caller can see what the trip cost.
 */
export function travel(game, destId, { choose = autoChoice } = {}) {
  const l = launch(game, destId);
  if (l.error) return l;
  let g = l.game;
  const events = [];
  // Bounded: one encounter per leg today, so this loop can run at most twice.
  for (let guard = 0; guard < 4; guard++) {
    const r = advanceTime(g, g.leg ? g.leg.arriveT : g.t);
    g = r.game;
    if (r.arrived) return { game: g, arrived: r.arrived, spentFuel: l.game.leg.fuelCost, days: l.game.leg.days, events };
    if (!g.encounter) break;
    const res = resolveEncounter(g, choose(g.encounter.encounterId));
    if (res.error) break;
    events.push(res.outcome);
    g = dismissEncounter(res.game);
    if (g.over) return { game: g, over: g.over, events };
  }
  return { game: g, events };
}

// ---------------------------------------------------------------------------
// Refuelling — buying propellant into the tank
// ---------------------------------------------------------------------------

/** Tank capacity and how full it is now. */
export const tankMax = (player) => fittedStats(player.ship.hull, player.ship.modules).fuelTonnes;
export const tankFree = (player) => tankMax(player) - player.ship.fuelTonnes;

/** The site's propellant price, or null if it doesn't sell any. */
export function fuelPrice(game) {
  const market = game.markets[game.player.at];
  const site = market?.site;
  return priceAt(market, site, "propellant");
}

/**
 * Buy `tonnes` of propellant into the tank at the current site. Bounded by tank
 * space, the site's propellant stock, and the captain's credits. This is a thin
 * wrapper over the normal market buy — propellant is just a commodity — but it
 * routes into the fuel tank instead of the cargo hold.
 */
export function refuel(game, tonnes) {
  const market = game.markets[game.player.at];
  const site = market?.site;
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

// ---------------------------------------------------------------------------
// The local paper — information as a thing you buy
// ---------------------------------------------------------------------------

/**
 * Space Trader charged 3 credits for the newspaper, and it was right to: this is
 * a game whose thesis is that information is a resource (design.md §7), and a
 * free feed of every shortage in the system quietly contradicts that.
 *
 * The price is small on purpose. It is not meant to be an agonising decision —
 * it is meant to make reading the news an ACT, so that skipping it is possible
 * and flying blind is something the player chose. A better-connected port
 * charges more, because it knows more (newsReach).
 */
export const paperPrice = (game) => 150 + techOf(siteOf(game, game.player.at))?.n * 90;

/** Buy this port's paper. It stays readable until you leave. */
export function buyPaper(game) {
  if (game.paperAt === game.player.at) return { error: "already-read", reason: "You've already read it." };
  const price = paperPrice(game);
  if (game.player.credits < price) return { error: "credits", reason: `The paper costs ${price} credits.` };
  return {
    game: {
      ...game,
      paperAt: game.player.at,
      player: { ...game.player, credits: game.player.credits - price },
    },
    spent: price,
  };
}

/**
 * Let time pass at a site without travelling — wait out a glut, wait for a
 * shortage to bite, wait for a crisis to reach the port you can actually reach.
 *
 * This existed in the sim for a long time with no way to ask for it, and before
 * wages there was no reason to want one: time in port was free, so "wait" was a
 * button that did nothing to you. A wage bill changed that. Now the clock costs
 * money, markets drift back toward equilibrium, and waiting is a position you
 * take on the price moving further than the bill you run up holding still.
 *
 * Returns { game, quit } like advanceTime does — waiting can bankrupt you into
 * losing your crew exactly as flying can, and the UI has to be able to say so.
 */
export function wait(game, days) {
  if (game.status === "transit") return { game, quit: [] };   // the clock owns time in flight
  if (game.over) return { game, quit: [] };
  const p = passTime(game, days);
  return {
    game: {
      ...game,
      t: game.t + days * DAY,
      markets: p.markets,
      player: p.player,      // waiting in port is not free once you have a crew
    },
    quit: p.quit,
  };
}

/**
 * HOW FAR CAN THIS SHIP GO — the readout Space Trader's Ship Yard led with, and
 * that we made the player derive by opening the course plotter and reading every
 * row. Two counts, and the gap between them is the whole point:
 *
 *   `now`   ports you could launch for on the propellant actually aboard
 *   `full`  ports you could reach with the tank filled
 *
 * and both shrink as the hold fills, because mass is what the rocket equation
 * charges for. That makes the cargo-versus-range trade visible at the moment the
 * player is deciding how much to buy, rather than after they have bought it.
 */
export function rangeReport(game) {
  const list = destinations(game);
  let now = 0, full = 0, farthest = null;
  for (const { site, cost } of list) {
    if (!cost) continue;
    if (cost.reachable) {
      full++;
      if (!farthest || cost.days > farthest.days) farthest = { name: site.name, days: cost.days };
    }
    if (cost.reachable && cost.enoughFuel) now++;
  }
  return { now, full, total: list.length, farthest };
}
