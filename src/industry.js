// ===========================================================================
// INDUSTRY — building things that outlast the trip.
//
// The campaign's spine, and the first system in this game where the player
// changes the WORLD rather than their own balance sheet.
//
// ---------------------------------------------------------------------------
// THE ONE IDEA EVERYTHING HERE HANGS OFF
//
// A cargo you deliver eases a shortage for a season. `advanceMarkets` drags every
// stock back toward the equilibrium that site's own geography sets, so a single
// run of water to Shackleton is a favour, not a cure — which is correct, and is
// what makes a faction crisis a standing reason to keep flying somewhere.
//
// A PLANT MOVES THE EQUILIBRIUM ITSELF. That is the whole difference. Build
// electrolysis at Shackleton and Shackleton stops being a propellant importer,
// permanently, and its price settles at a producer's level instead of an
// importer's. One line of the umbilical goes slack and stays slack.
//
// It reaches prices through `market.mods.owned`, alongside the faction
// modifiers that already bend supply the same way — see stockRatio() in
// market.js. Nothing in the pricing model needed changing: the extension point
// was already there because factions needed it first.
//
// ---------------------------------------------------------------------------
// WHY THE INCOME FALLS, AND WHY THAT IS NOT A BUG
//
// A plant sells its output into the local market at the local price. Supplying a
// shortage cures it, the price drops toward the producer's level, and the
// revenue declines to a floor. Every instinct says to fix that. Do not:
//
//   > Trade is a symptom of dependency, and the win is curing it. (design.md §5)
//
// What you are buying with a plant is not an annuity. It is a port that no
// longer needs you — and `importDependency()` below is the number that says so.
// The money is the by-product; the severed link is the point.
//
// ---------------------------------------------------------------------------
// PURE, like everything else in src/. No clock, no randomness that is not seeded,
// nothing mutated. `tickIndustry` takes a game and a number of days and returns
// a new game, the same contract `advanceTime` uses.
// ===========================================================================

import { PROCESS_BY_ID, PROCESSES, powerSupplied } from "./data/industry.js";
import { PLACE_BY_ID } from "./data/places.js";
import { COMMODITY_BY_ID } from "./data/commodities.js";
import { priceAt } from "./market.js";
import { siteOf } from "./data/sites.js";

const DAY = 86400000;
const round2 = (n) => Math.round(n * 100) / 100;

/** Everything the player has built or is building at a site. */
export const worksAt = (game, siteId) =>
  (game.industry || []).filter((w) => w.siteId === siteId);

/** Everything the player owns anywhere. */
export const allWorks = (game) => game.industry || [];

/** Is this one finished, at time t? */
export const isOnline = (work, t) => t >= work.onlineT;

/** Days left on a build, or 0 if it is running. */
export const daysLeft = (work, t) => Math.max(0, Math.ceil((work.onlineT - t) / DAY));

/**
 * The site's sunlight, as a multiple of Earth's. Real, and already in the
 * census — this is `light` in data/places.js finally costing something.
 */
export function lightAt(siteId) {
  const place = PLACE_BY_ID[siteId];
  return place?.light ?? 0;
}

/**
 * Power generated and power drawn at a site, in kW.
 *
 * Only ONLINE works count on both sides: a plant under construction neither
 * draws nor supplies, which is what lets you build a solar farm and a mine in
 * either order without one of them being starved on paper.
 */
export function powerAt(game, siteId, t = game.t) {
  const light = lightAt(siteId);
  let supply = 0, draw = 0;
  for (const w of worksAt(game, siteId)) {
    if (!isOnline(w, t)) continue;
    const p = PROCESS_BY_ID[w.processId];
    if (!p) continue;
    supply += powerSupplied(p, light);
    draw += p.power || 0;
  }
  return { supply: Math.round(supply), draw: Math.round(draw), light };
}

/**
 * What fraction of nameplate the site's works can actually run at.
 *
 * Short of power, everything throttles together rather than some plants stopping
 * dead. That is the forgiving reading and the legible one: one number on screen,
 * and the fix is obvious.
 */
export function powerFactor(game, siteId, t = game.t) {
  const { supply, draw } = powerAt(game, siteId, t);
  if (draw <= 0) return 1;
  return Math.max(0, Math.min(1, supply / draw));
}

/**
 * Can this process be built here, and if not, why not — in a sentence a player
 * can act on rather than an error code.
 */
export function canBuild(game, siteId, processId) {
  const p = PROCESS_BY_ID[processId];
  const site = siteOf(game, siteId);
  const place = PLACE_BY_ID[siteId];
  if (!p) return { ok: false, reason: "No such process." };
  if (!site) return { ok: false, reason: "Nowhere to build." };

  // YOU CANNOT BUILD WHERE YOU HAVE NOT BEEN. design.md §13's founding rule for
  // the survey layer, and the cheapest possible version of it: docking counts.
  if (!(game.visited || []).includes(siteId)) {
    return { ok: false, reason: "You have never been here." };
  }
  if (worksAt(game, siteId).some((w) => w.processId === processId)) {
    return { ok: false, reason: "You already have one here." };
  }
  if ((site.techLevel ?? 1) < p.minTech) {
    return { ok: false, reason: `Needs a more developed port (tech ${p.minTech}; this is ${site.techLevel}).` };
  }
  // The resource has to actually be here. This is the line that stops an ice
  // mine on Mercury's dayside and keeps the census load-bearing.
  if (p.needsResource && !(place?.resources || []).includes(p.needsResource)) {
    return { ok: false, reason: `There is no ${COMMODITY_BY_ID[p.needsResource]?.name.toLowerCase() || p.needsResource} here.` };
  }
  if (p.needsHabitability && place?.habitability === "lethal") {
    return { ok: false, reason: "Nothing grows on ground this hostile." };
  }
  if (game.player.credits < p.build) {
    return { ok: false, reason: `Costs ${p.build.toLocaleString()}; you have ${Math.round(game.player.credits).toLocaleString()}.` };
  }
  // A warning rather than a refusal: you are allowed to build a plant you cannot
  // yet power, because the fix is another building and the game should let you
  // sequence it yourself.
  const after = powerAt(game, siteId).supply - powerAt(game, siteId).draw - (p.power || 0)
    + powerSupplied(p, lightAt(siteId));
  return { ok: true, warning: after < 0 ? "There is not enough power here to run it yet." : null };
}

/** Commit to a build. Money leaves now; the plant arrives later. */
export function build(game, siteId, processId) {
  const check = canBuild(game, siteId, processId);
  if (!check.ok) return { error: "cannot-build", reason: check.reason };
  const p = PROCESS_BY_ID[processId];
  const work = {
    id: `${siteId}:${processId}`,
    siteId, processId,
    startedT: game.t,
    onlineT: game.t + p.buildDays * DAY,
  };
  return {
    game: {
      ...game,
      player: { ...game.player, credits: game.player.credits - p.build },
      industry: [...(game.industry || []), work],
    },
    work,
    spent: p.build,
  };
}

/**
 * What a site's works produce and consume per day, at full power.
 *
 * Inputs come out of the LOCAL MARKET, which is what makes a chain a chain: an
 * electrolysis plant with no ice under it is a plant buying ice at the market
 * price, and the moment you build the mine underneath it the same plant becomes
 * profitable. Nothing enforces the ordering; the arithmetic just rewards it.
 */
export function dailyFlows(game, siteId, t = game.t) {
  const factor = powerFactor(game, siteId, t);
  const inputs = {}, outputs = {};
  for (const w of worksAt(game, siteId)) {
    if (!isOnline(w, t)) continue;
    const p = PROCESS_BY_ID[w.processId];
    if (!p) continue;
    for (const [id, qty] of Object.entries(p.inputs || {})) inputs[id] = (inputs[id] || 0) + qty * factor;
    for (const [id, qty] of Object.entries(p.outputs || {})) outputs[id] = (outputs[id] || 0) + qty * factor;
  }
  return { inputs, outputs, factor };
}

/** Everything the player's works at a site can make — what moves the equilibrium. */
export function ownedProduces(game, siteId, t = game.t) {
  const out = new Set();
  for (const w of worksAt(game, siteId)) {
    if (!isOnline(w, t)) continue;
    for (const id of Object.keys(PROCESS_BY_ID[w.processId]?.outputs || {})) out.add(id);
  }
  return [...out];
}

/** The daily wage bill of every plant that is running or being built. */
export const industryWages = (game, perHead = 90) =>
  allWorks(game).reduce((n, w) => n + (PROCESS_BY_ID[w.processId]?.crew || 0) * perHead, 0);

/**
 * Run the works forward.
 *
 * Returns `{ game, earned, completed }`. Called from advanceTime, so it sees
 * exactly the days the clock saw and never runs on its own schedule.
 *
 * ORDER MATTERS AND IS DELIBERATE: inputs are drawn from the market BEFORE
 * outputs are added to it, so a plant cannot eat what it just made in the same
 * tick, and a chain that is short of feedstock throttles honestly.
 */
export function tickIndustry(game, days) {
  const works = allWorks(game);
  if (!works.length || days <= 0) return { game, earned: 0, completed: [] };

  // TWO TIMES, ON PURPOSE. `t` is the start of the interval and decides what was
  // already running; `tEnd` is where the clock is going and decides what has just
  // come online. Production therefore uses the conservative reading — a plant
  // that finishes mid-interval earns from the NEXT tick rather than this one —
  // which under-counts by at most one tick and can never pay for work that had
  // not started. The dock clock ticks ten times a second, so "one tick" is a
  // tenth of a day.
  const t = game.t;
  const tEnd = t + days * DAY;
  const completed = works.filter((w) => w.onlineT > t && w.onlineT <= tEnd);
  const markets = { ...game.markets };
  let earned = 0;

  for (const siteId of new Set(works.map((w) => w.siteId))) {
    const m = markets[siteId];
    if (!m) continue;
    const site = m.site;
    const { inputs, outputs } = dailyFlows(game, siteId, t);
    const stock = { ...m.stock };

    // INPUTS: bought off the local market at the local price. A market that
    // cannot supply them throttles that day's run rather than going negative.
    let shortfall = 1;
    for (const [id, qty] of Object.entries(inputs)) {
      const want = qty * days;
      const have = stock[id] || 0;
      if (want > 0 && have < want) shortfall = Math.min(shortfall, have / want);
    }
    for (const [id, qty] of Object.entries(inputs)) {
      const take = qty * days * shortfall;
      if (!take) continue;
      earned -= take * priceAt(m, site, id);
      stock[id] = round2(Math.max(0, (stock[id] || 0) - take));
    }

    // OUTPUTS: sold into the local market at the local price. This is the income
    // that is SUPPOSED to decay — see the header.
    for (const [id, qty] of Object.entries(outputs)) {
      const made = qty * days * shortfall;
      if (!made) continue;
      earned += made * priceAt(m, site, id);
      stock[id] = round2((stock[id] || 0) + made);
    }

    // And the part that outlives the money: the site's own equilibrium moves,
    // so this is a cure rather than a delivery.
    const owned = ownedProduces(game, siteId, t);
    markets[siteId] = { ...m, stock, mods: { ...(m.mods || {}), owned } };
  }

  return {
    game: {
      ...game,
      markets,
      player: { ...game.player, credits: game.player.credits + earned },
    },
    earned,
    completed,
  };
}

/**
 * THE UMBILICAL, AS A NUMBER.
 *
 * How much of what this site needs it still has to have shipped in. 1 means
 * everything; 0 means it needs nobody. Falls as you build, and it is the only
 * score in the game that measures the campaign's actual victory condition
 * rather than the player's wealth.
 */
export function importDependency(game, siteId, t = game.t) {
  const site = siteOf(game, siteId);
  if (!site) return null;
  const needs = site.consumes || [];
  if (!needs.length) return { fraction: 0, imported: [], local: [], needs: 0 };
  const owned = new Set(ownedProduces(game, siteId, t));
  const localAnyway = new Set(site.produces || []);
  const imported = needs.filter((id) => !owned.has(id) && !localAnyway.has(id));
  const local = needs.filter((id) => owned.has(id) || localAnyway.has(id));
  return {
    fraction: imported.length / needs.length,
    imported, local, needs: needs.length,
    // How many of the still-imported goods the player personally cured.
    cured: needs.filter((id) => owned.has(id) && !localAnyway.has(id)).length,
  };
}

/**
 * The campaign scoreboard: every link the player has personally severed, across
 * every site. This is the Campaign victory condition in embryo (design.md §12) —
 * "sever Earth-dependency and become infrastructure" is this number reaching the
 * whole map.
 */
export function umbilicalReport(game) {
  const sites = game.sites || [];
  let cured = 0, links = 0;
  const bySite = [];
  for (const s of sites) {
    const d = importDependency(game, s.id);
    if (!d) continue;
    links += d.needs;
    cured += d.cured || 0;
    if (d.cured) bySite.push({ siteId: s.id, name: s.name, cured: d.cured, of: d.needs });
  }
  return { cured, links, bySite, works: allWorks(game).length };
}

/** Every process, with whether it can go here and why not. For the build screen. */
export function buildOptions(game, siteId) {
  return PROCESSES.map((p) => ({ process: p, ...canBuild(game, siteId, p.id) }));
}
