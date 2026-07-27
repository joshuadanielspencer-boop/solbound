// ===========================================================================
// MARKETS — prices that respond to scarcity, and refuse to run away.
//
// DAMPING AND BOUNDS ARE HERE FROM THE FIRST COMMIT, deliberately. Emergent
// supply/demand loops love to hyperinflate or collapse to zero, and every
// design pass on this project independently flagged it (docs/design.md §15).
// Retrofitting stability into an economy players have already learned is far
// harder than building it in, so:
//
//   • price is a FUNCTION OF STOCK, not an accumulator that drifts
//   • it is clamped to [floor, ceiling] multiples of the base value
//   • a single trade cannot move the price more than a few percent
//
// The first rule is the important one. A price that is recomputed from
// inventory each tick cannot spiral, because there is nothing to spiral — it is
// a lookup, not a feedback loop. Stock itself is bounded by storage capacity.
//
// WHAT THE PRICE CURVE TEACHES: scarcity is not linear. A site with half its
// normal stock pays a little more; a site nearly out pays enormously more,
// because at that point it is not buying goods, it is buying survival. That
// asymmetry is what makes supplying a struggling colony lucrative and what makes
// a shortage a genuine event rather than a number.
// ===========================================================================

import { COMMODITIES, COMMODITY_BY_ID } from "./data/commodities.js";
import { CORE_SITES, bannedAt } from "./data/sites.js";

/**
 * Does this site's industry MAKE this good, by virtue of its tier?
 *
 * One predicate, used by every function that needs the answer, because it used
 * to be copied into four of them — and the moment contraband arrived, a copy
 * that disagreed would have had Gateway Station openly manufacturing munitions
 * because its `makes` list includes the industrial tier. Contraband is never
 * manufactured by the tier rule: it is stocked only where a site lists it
 * explicitly, which is what keeps it to the ports that should have it.
 */
const manufactures = (site, c) =>
  !!c && !c.contraband
  && (site.makes || []).includes(c.tier)
  && !site.consumes.includes(c.id);

/** Price never falls below 25% of base, nor rises above 6x it. */
export const PRICE_FLOOR = 0.25;
export const PRICE_CEILING = 6.0;

/** Stock at which a site is "comfortable" — the price equals the base value. */
const NOMINAL_DAYS = 120;   // days of consumption a healthy site holds

/**
 * Price multiplier as a function of how well stocked a site is.
 *
 * `ratio` is stock ÷ nominal stock. The curve is deliberately asymmetric:
 *
 *   ratio 0.0  →  6.00x   desperate: it is buying survival, not goods
 *   ratio 0.25 →  2.29x   short
 *   ratio 0.5  →  1.44x   lean
 *   ratio 1.0  →  1.00x   comfortable
 *   ratio 2.0  →  0.70x   glutted
 *   ratio 4.0+ →  0.25x   worthless here
 *
 * An inverse power law rather than a straight line, because scarcity in real
 * life is not linear — the last tonne of oxygen is not worth the same as the
 * hundredth.
 */
const CURVE_OFFSET = 0.05;   // how sharply the price spikes as stock nears zero
const CURVE_POWER = 0.62;    // how steeply it falls as stock piles up
// Normalised so that m(1) === 1 exactly: a comfortably stocked site trades at
// the commodity's base value, by construction rather than by coincidence. The
// first version of this curve returned 0.38 at nominal stock, which quietly
// meant every price in the game was wrong by a factor of nearly three.
const CURVE_K = Math.pow(1 + CURVE_OFFSET, CURVE_POWER);

export function priceMultiplier(ratio) {
  const r = Math.max(0, ratio);
  const m = CURVE_K / Math.pow(r + CURVE_OFFSET, CURVE_POWER);
  return Math.min(PRICE_CEILING, Math.max(PRICE_FLOOR, m));
}

/** A site's nominal (comfortable) stock of a commodity, in tonnes. */
export function nominalStock(site, commodityId) {
  const daily = dailyConsumption(site, commodityId);
  const prod = dailyProduction(site, commodityId);
  const c = COMMODITY_BY_ID[commodityId];
  // Manufactured goods are held against demand from elsewhere rather than local
  // use, so they get a floor proportional to the population that makes them.
  const floor = manufactures(site, c) ? Math.max(20, site.population * 0.35) : 20;
  return Math.max(floor, (daily + prod) * NOMINAL_DAYS);
}

/**
 * Daily consumption in tonnes. Driven by population and by what the site's
 * industry needs — so a bigger settlement is a bigger market, which is the
 * whole reason to care about population at all.
 */
export function dailyConsumption(site, commodityId) {
  if (!site.consumes.includes(commodityId)) return 0;
  const c = COMMODITY_BY_ID[commodityId];
  // Cheap bulk goods are consumed by the tonne; precision instruments are not.
  // Scaling inversely with value keeps a site from consuming $9M/t of
  // instruments daily, which would make the economy nonsense.
  const perPerson = 0.004 * Math.pow(10000 / c.valuePerTonne, 0.45);
  return site.population * perPerson;
}

/** Daily production in tonnes, from local geography and industry. */
export function dailyProduction(site, commodityId) {
  const c = COMMODITY_BY_ID[commodityId];
  if (!c) return 0;
  const extracts = site.produces.includes(commodityId);
  if (!extracts && !manufactures(site, c)) return 0;
  const perPerson = 0.011 * Math.pow(10000 / c.valuePerTonne, 0.45);
  // Manufacturing is slower than digging something out of the ground.
  return site.population * perPerson * (extracts ? 1 : 0.55);
}

/** How much better stocked an importer starts than it settles at (0.65 vs 0.55
 *  of nominal, for a legal good — the ratio, so a black market lifts the same
 *  way from its own much lower floor). */
const START_STOCK_LIFT = 0.65 / 0.55;

/**
 * Build the starting market state for every site.
 *
 * `modsBySite` is this run's faction modifiers (factions.marketMods) — the
 * roguelike layer finally reaching prices. They are stored ON the market rather
 * than looked up at price time, because price is a pure function of stock and
 * everything that reads a price would otherwise need the faction list threaded
 * through it. A market carries its own world.
 */
export function initialMarkets(modsBySite = {}, sites = CORE_SITES) {
  const markets = {};
  for (const site of sites) {
    const mods = modsBySite[site.id] || {};
    const stock = {};
    for (const c of COMMODITIES) {
      const extracts = site.produces.includes(c.id);
      const needs = site.consumes.includes(c.id);
      // A site also SELLS anything its industry can manufacture. Without this,
      // Gateway Station — which sits one lift below Earth's entire industrial
      // base — stocked no electronics at all, and there was nothing to buy on
      // turn one. `makes` is the dependency ladder, so it has to reach the
      // shelves.
      // A faction that PRODUCES something puts it on the shelves of a port that
      // has no geological business selling it — which is how "Helios Fuels moved
      // in" becomes "there is propellant here now" rather than a tooltip.
      const factionMakes = (mods.produces || []).includes(c.id);
      const makes = manufactures(site, c) || factionMakes;
      if (!extracts && !needs && !makes) continue;
      const nominal = nominalStock(site, c.id);
      // Producers start well stocked; importers start a little short, which is
      // what makes them worth flying to on day one. A banned good starts at its
      // black-market level — which is barely stocked, and priced accordingly.
      //
      // The LIFT matters and is easy to lose: importers must start ABOVE where
      // they settle, or opening stock equals equilibrium, mean reversion has
      // nothing left to do, and every market in the game sits perfectly still
      // for the whole run. (It did, for about ten minutes.)
      // Producers open at their steady surplus; importers open a little better
      // stocked than they settle at, so the world is already drifting on turn one.
      const ratio = stockRatio(site, c, mods);
      stock[c.id] = (extracts || makes) ? nominal * ratio : nominal * ratio * START_STOCK_LIFT;
    }
    // The market carries a snapshot of its own site. Sites are generated per
    // run now, so nothing downstream can reach a static list — and a site
    // definition never changes mid-run, so the snapshot can't go stale.
    markets[site.id] = { siteId: site.id, stock, mods, site };
  }
  return markets;
}

/**
 * The EXPECTED (structural) mid price of a commodity at a site — the price it
 * would show at its equilibrium stock, ignoring today's transient shortage or
 * glut. This is PUBLIC KNOWLEDGE: everyone knows Mars structurally pays a
 * premium for machinery because Mars imports machinery. It's what a trader can
 * know about a place without being there, and it's the honest basis for the
 * "average price list" (see intel.js). The live priceAt() adds the transient
 * swing on top — the part you only see for sure when you arrive.
 */
export function avgPrice(site, commodityId, mods = {}) {
  const c = COMMODITY_BY_ID[commodityId];
  if (!c) return null;
  const eq = equilibriumStock(site, commodityId, mods);
  return Math.round(c.valuePerTonne * priceMultiplier(eq / nominalStock(site, commodityId)));
}

/** Current unit price of a commodity at a site, in dollars per tonne. */
export function priceAt(market, site, commodityId) {
  const c = COMMODITY_BY_ID[commodityId];
  if (!c || !market) return null;
  const stock = market.stock[commodityId];
  if (stock === undefined) return null;   // not traded here at all
  return Math.round(c.valuePerTonne * priceMultiplier(stock / nominalStock(site, commodityId)));
}

/**
 * Everything traded at a site, with prices and stock, for the market screen.
 *
 * WITH `includeUntraded`, the goods this site has NO market for come back too,
 * flagged `traded: false` and priced null. Omitting them entirely hid the most
 * teachable thing on the screen: "Reactor components — not traded here" at a
 * polar ice camp is how a player learns what a place cannot get, which is the
 * whole dependency thesis (design.md §5) stated as a row in a table. Space
 * Trader listed every good at every system for exactly this reason.
 *
 * Untraded rows carry `why` — the plain reason, which is always one of the same
 * three: it isn't here, nobody here needs it, and nobody here can build it.
 */
export function listing(market, site, { includeUntraded = false } = {}) {
  if (!market) return [];
  const rows = Object.keys(market.stock).map((id) => {
    const c = COMMODITY_BY_ID[id];
    const nominal = nominalStock(site, id);
    const stock = market.stock[id];
    const ratio = stock / nominal;
    return {
      id, name: c.name, tier: c.tier, note: c.note, lesson: c.lesson,
      contraband: c.contraband || null,
      banned: bannedAt(site, c),      // legal to hold here, or a crime?
      traded: true,
      stock, nominal, ratio,
      price: priceAt(market, site, id),
      base: c.valuePerTonne,
      produces: site.produces.includes(id),
      consumes: site.consumes.includes(id),
      // Plain language, because a ratio is not a decision (design.md §2 pillar 5)
      state: ratio < 0.3 ? "critically short" : ratio < 0.7 ? "short"
        : ratio < 1.6 ? "steady" : "surplus",
    };
  });

  if (includeUntraded) {
    for (const c of COMMODITIES) {
      if (market.stock[c.id] !== undefined) continue;
      rows.push({
        id: c.id, name: c.name, tier: c.tier, note: c.note, lesson: c.lesson,
        contraband: c.contraband || null,
        banned: bannedAt(site, c),
        traded: false,
        stock: 0, nominal: nominalStock(site, c.id), ratio: 0,
        price: null,
        base: c.valuePerTonne,
        produces: false, consumes: false,
        state: "not traded here",
        why: `Nothing here extracts it, needs it, or can build it — so there is no market to buy from or sell into.`,
      });
    }
  }
  // Traded goods first, cheapest to dearest; the dead rows follow. Sorting them
  // together by value put three greyed-out raws at the TOP of Gateway Station's
  // market, which buried the actual shelves under a lesson.
  return rows.sort((a, b) => (a.traded === b.traded ? a.base - b.base : a.traded ? -1 : 1));
}

/** How fast an unattended market drifts back to its natural level. A ~60-day
 *  half-life: quick enough that a shortage you supply eases within a season,
 *  slow enough that a real imbalance is worth crossing space for. */
const REVERSION_HALFLIFE = 60;

/**
 * The stock level a site settles at when left alone — its equilibrium, set by
 * the background economy nobody sees. A producer sits in surplus; an importer
 * sits in a CHRONIC SHORTAGE (elevated price) but never starves to zero.
 *
 * This is the fix for the long-haul jackpot: without it, a consuming frontier
 * drifted to empty over a months-long transit and hit the price ceiling, so
 * every delivery there was a windfall. With it, an unattended importer stabilises
 * at a sensible shortage, and the player's edge is catching TEMPORARY swings —
 * or a faction-driven crisis — not the permanent starvation of an idle market.
 */
export function equilibriumStock(site, commodityId, mods = {}) {
  return nominalStock(site, commodityId) * stockRatio(site, COMMODITY_BY_ID[commodityId], mods);
}

/**
 * WHERE THE FACTION DRAW REACHES PRICES.
 *
 * The roguelike layer has always described itself — "The Long Drought will pay
 * anything for air and medicine" — while the prices underneath it stayed exactly
 * the same as everywhere else. That made the newspaper a liar and every faction
 * a paint job. These two functions are the fix, and they work through STOCK
 * rather than through a price multiplier, because price here is a pure function
 * of stock: bend the supply and the price follows, bounded by the same curve
 * that stops everything else running away.
 *
 *   crisis  → 0.12   nothing is coming and people are dying (about 3.2x base)
 *   demand  → 0.38   structurally short, and it shows in the price
 *   glut    → 2.2    they are drowning in it and will let it go cheap
 *
 * A banned good is the floor of all of them, because no legal supply exists.
 */
const SURPLUS = 1.4;        // a producer's steady overhang
const IMPORTING = 0.55;     // a consumer's chronic, never-quite-enough shortage
const BANNED = 0.15;        // a black market: no legal supply at all
const CRISIS = 0.12;        // nothing is coming, and people are dying

function stockRatio(site, c, mods = {}) {
  if (!c) return 1;
  // A crisis overrides the geography entirely. That is what makes it a crisis:
  // Mars grows its own food right up until the day the chain breaks.
  if ((mods.crisis || []).includes(c.id)) return CRISIS;

  const produces = site.produces.includes(c.id)
    || manufactures(site, c)
    || (mods.produces || []).includes(c.id);
  let r = produces ? SURPLUS
    : bannedAt(site, c) ? BANNED
      : site.consumes.includes(c.id) ? IMPORTING : 1;

  // Modifiers multiply the base rather than replacing it, which matters: a
  // faction demanding food at a site that GROWS food should eat into the
  // surplus, not be silently ignored because the producer branch won first.
  // (It was, and the newspaper cheerfully reported a demand the prices denied.)
  if ((mods.glut || []).includes(c.id)) r *= 1.6;
  if ((mods.demand || []).includes(c.id)) r *= 0.6;
  return r;
}

/**
 * Advance every market by `days`, mean-reverting each stock toward its
 * equilibrium (see equilibriumStock). Because price is a function of stock, the
 * market can never spiral — and now it can't be starved into a jackpot either.
 * Linear in the reverted fraction, so stepping the clock in many small ticks
 * lands within rounding of one big jump (a test pins this).
 */
export function advanceMarkets(markets, days) {
  const frac = 1 - Math.pow(0.5, days / REVERSION_HALFLIFE);
  const out = {};
  for (const m of Object.values(markets)) {
    const site = m.site;
    if (!site) { out[m.siteId] = m; continue; }
    const stock = { ...m.stock };
    for (const id of Object.keys(stock)) {
      // The market drifts toward the equilibrium ITS OWN WORLD sets, so a crisis
      // stays a crisis while the faction causing it is there — supplying it eases
      // the price for a season, and then it starves again. That is what makes a
      // faction crisis a standing reason to fly somewhere rather than a one-off.
      const eq = equilibriumStock(site, id, m.mods);
      stock[id] = Math.max(0, stock[id] + (eq - stock[id]) * frac);
    }
    out[site.id] = { ...m, stock };
  }
  return out;
}

/**
 * Buy `tonnes` of a commodity. Returns the new markets, the cost, and how much
 * was actually available — a market cannot sell what it does not have.
 *
 * The price is computed ONCE from pre-trade stock rather than integrated across
 * the purchase. That is a deliberate simplification and a forgiving one: it
 * means a player cannot accidentally pay a ruinous marginal price by buying
 * slightly too much, which would be a nasty surprise rather than a decision.
 */
export function buy(markets, siteId, commodityId, tonnes) {
  const m = markets[siteId];
  const site = m?.site;
  if (!site || !m || m.stock[commodityId] === undefined) return null;

  const available = m.stock[commodityId];
  const qty = Math.max(0, Math.min(tonnes, available));
  if (qty <= 0) return null;

  const unit = priceAt(m, site, commodityId);
  return {
    markets: { ...markets, [siteId]: { ...m, stock: { ...m.stock, [commodityId]: available - qty } } },
    tonnes: qty,
    unit,
    total: Math.round(unit * qty),
  };
}

/** Sell into a market. Adds to its stock, which lowers what it will pay next. */
export function sell(markets, siteId, commodityId, tonnes) {
  const m = markets[siteId];
  const site = m?.site;
  if (!site || !m) return null;

  // A site will buy anything, even something it neither makes nor consumes —
  // but at a poor price, because it has no use for it. Refusing outright would
  // strand cargo and be far more annoying than paying badly for it.
  const known = m.stock[commodityId] !== undefined;
  const unit = known
    ? priceAt(m, site, commodityId)
    : Math.round(COMMODITY_BY_ID[commodityId].valuePerTonne * PRICE_FLOOR);

  const stock = { ...m.stock };
  if (known) stock[commodityId] = stock[commodityId] + tonnes;

  return {
    markets: { ...markets, [siteId]: { ...m, stock } },
    tonnes,
    unit,
    total: Math.round(unit * tonnes),
    unwanted: !known,
  };
}

/**
 * The best trades between two sites, given a ship's Δv cost and drive.
 *
 * This is the query the whole economy is built to answer, and it is where the
 * design's thesis becomes visible: run it on water ice and the margin is
 * catastrophically negative; run it on instruments and it is fine. The player
 * learns ISRU from arithmetic rather than from a tooltip.
 */
export function tradeOpportunities(markets, fromId, toId, shippingCostPerTonne) {
  const from = markets[fromId]?.site, to = markets[toId]?.site;
  if (!from || !to) return [];
  const mf = markets[fromId], mt = markets[toId];
  if (!mf || !mt) return [];

  const out = [];
  for (const id of Object.keys(mf.stock)) {
    const buyPrice = priceAt(mf, from, id);
    const sellPrice = priceAt(mt, to, id);
    if (buyPrice == null || sellPrice == null) continue;
    const profit = sellPrice - buyPrice - shippingCostPerTonne;
    out.push({
      id, name: COMMODITY_BY_ID[id].name,
      buyPrice, sellPrice, shipping: Math.round(shippingCostPerTonne),
      profitPerTonne: Math.round(profit),
      available: mf.stock[id],
      viable: profit > 0,
    });
  }
  return out.sort((a, b) => b.profitPerTonne - a.profitPerTonne);
}
