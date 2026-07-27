// ===========================================================================
// MARKET INTEL — seeing the trade before you commit to the trip.
//
// This is the Space Trader "Average Price List" + "Price Differences", and it's
// the fix for the game's biggest confusion: prices were hidden until arrival, so
// every run was a blind gamble. Now you can look before you leap.
//
// THE INFORMATION MODEL, and it's the light-lag idea made concrete (design.md
// §7):
//
//   • At the site you're AT, prices are LIVE and exact — you're standing there.
//   • At a REMOTE site, you know its EXPECTED (structural) price — the public
//     fact that Mars imports machinery and so pays a premium for it — but not
//     today's transient shortage or glut. That expected price is avgPrice()
//     (market.js), and it degrades in freshness with light-lag: the further out,
//     the older any real news you have.
//
// So planning is honest: the STRUCTURAL opportunity (buy where a good is made,
// sell where it's needed) is knowable from your chair, which is enough to make a
// smart decision — and the TRANSIENT swing is the bonus or risk you only resolve
// on arrival. That gap is what makes fresh information (being close, buying news)
// worth having, and it's exactly the two-tier "you are not there" texture the
// design wanted.
//
// Pure functions. The estimate is deterministic (it's the structural price, no
// random noise), so it never flickers and a save reproduces it.
// ===========================================================================

import { siteOf } from "./data/sites.js";
import { SYSTEM_BY_ID } from "./data/bodies.js";
import { COMMODITY_BY_ID, COMMODITIES } from "./data/commodities.js";
import { avgPrice, priceAt } from "./market.js";
import { priceToBuy, priceToSell } from "./player.js";
import { lightTimeSeconds, heliocentric } from "./ephemeris.js";

/**
 * SOLAR CONJUNCTION — the Sun standing between you and there.
 *
 * This is real, and it is not small: every ~26 months the Sun sits between
 * Earth and Mars, and NASA genuinely stops commanding its entire Mars fleet
 * for about two weeks, because radio through the solar corona corrupts. Every
 * pair of worlds has its season of silence (docs/site-atlas.md, sourced).
 *
 * Geometry, not a timer: from your position, if the Sun lies within a few
 * degrees of the line of sight to the target AND the target is on the far
 * side, you are occluded. Computed from the same ephemeris everything else
 * uses, so conjunctions arrive on the real calendar — a player who learns to
 * check the sky before relying on intel has learned an actual fact about
 * living in a solar system.
 */
const CORONA_DEG = 3;   // NASA's command moratorium uses a similar exclusion angle

export function occluded(game, siteId) {
  const fromSys = SYSTEM_BY_ID[siteOf(game, game.player.at)?.system];
  const toSys = SYSTEM_BY_ID[siteOf(game, siteId)?.system];
  if (!fromSys?.ephemerisKey || !toSys?.ephemerisKey || fromSys.id === toSys.id) return false;

  const d = new Date(game.t);
  // heliocentric() hands back x/y in AU directly (its `lon` is in degrees —
  // feeding that to cos/sin as radians turned real conjunction seasons into
  // scattered noise, which is exactly what the test caught).
  const { x: x1, y: y1 } = heliocentric(fromSys.ephemerisKey, d);
  const { x: x2, y: y2 } = heliocentric(toSys.ephemerisKey, d);

  // Angle at the observer between "toward the Sun" and "toward the target".
  const sx = -x1, sy = -y1;                    // Sun direction
  const tx = x2 - x1, ty = y2 - y1;            // target direction
  const dot = sx * tx + sy * ty;
  const cos = dot / (Math.hypot(sx, sy) * Math.hypot(tx, ty) || 1);
  const deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;

  // Small angle AND the target genuinely beyond the Sun (not between us and it).
  return deg < CORONA_DEG && Math.hypot(tx, ty) > Math.hypot(sx, sy);
}

/**
 * How fresh your information about a site is, from the one-way light time
 * between where you are and there. "live" when it's your current site.
 * "occluded" beats everything: through the corona there is no picture at all.
 */
export function intelFreshness(game, siteId) {
  if (siteId === game.player.at && game.status === "docked") {
    return { key: "live", label: "Live", note: "You're here — these are the real prices." };
  }
  if (occluded(game, siteId)) {
    return {
      key: "occluded", label: "Conjunction",
      note: "The Sun stands between here and there. Nothing gets through the corona — no prices, no news, until the geometry moves on.",
    };
  }
  const fromSys = SYSTEM_BY_ID[siteOf(game, game.player.at)?.system];
  const toSys = SYSTEM_BY_ID[siteOf(game, siteId)?.system];
  if (!fromSys?.ephemerisKey || !toSys?.ephemerisKey || fromSys.id === toSys.id) {
    return { key: "recent", label: "Recent", note: "Nearby — your information is current." };
  }
  const sec = lightTimeSeconds(fromSys.ephemerisKey, toSys.ephemerisKey, new Date(game.t));
  const min = sec / 60;
  if (min < 20) return { key: "recent", label: "Recent", note: `News travels ~${Math.round(min)} min — reasonably current.` };
  if (min < 90) return { key: "delayed", label: "Delayed", note: `${Math.round(min)} min of light-lag — expect drift.` };
  return { key: "stale", label: "Stale", note: `${(min / 60).toFixed(1)} h of light-lag — this is an old picture.` };
}

/**
 * The estimated buy/sell price of a commodity at a site, as the captain would
 * face it (spread and Trader skill applied). LIVE at the current site (actual
 * stock), ESTIMATE elsewhere (structural avgPrice).
 */
export function estimatedPrice(game, siteId, commodityId) {
  const site = siteOf(game, siteId);
  if (!site) return null;
  const live = siteId === game.player.at && game.status === "docked";
  // Through the corona there is no estimate to give. The trip is still
  // flyable — the ship is autonomous — but the trade becomes a true blind bet,
  // which is exactly what conjunction did to real mission planning.
  if (!live && occluded(game, siteId)) return null;
  let mid;
  if (live) {
    mid = priceAt(game.markets[siteId], site, commodityId);
  } else {
    // The structural estimate has to know about this run's factions too, or the
    // intel panel would quote a peaceful price for a colony everyone knows is
    // in crisis — and the newspaper would be reporting a shortage the numbers
    // denied.
    mid = avgPrice(site, commodityId, game.markets[siteId]?.mods);
  }
  if (mid == null) return null;
  return {
    live,
    buy: priceToBuy(game.player, mid),
    sell: priceToSell(game.player, mid),
  };
}

/** Every good traded at a site, with estimated prices — the Average Price List. */
export function priceList(game, siteId) {
  const site = siteOf(game, siteId);
  if (!site) return [];
  const traded = new Set([...(site.produces || []), ...(site.consumes || [])]);
  // Also anything its industry manufactures shows up (it sells those).
  for (const c of COMMODITIES) if ((site.makes || []).includes(c.tier) && !site.consumes.includes(c.id)) traded.add(c.id);
  return [...traded]
    .map((id) => {
      const est = estimatedPrice(game, siteId, id);
      if (!est) return null;
      return {
        id, name: COMMODITY_BY_ID[id].name, tier: COMMODITY_BY_ID[id].tier,
        buy: est.buy, sell: est.sell, live: est.live,
        produces: site.produces.includes(id), consumes: site.consumes.includes(id),
      };
    })
    .filter(Boolean)
    .sort((a, b) => COMMODITY_BY_ID[a.id].valuePerTonne - COMMODITY_BY_ID[b.id].valuePerTonne);
}

/**
 * PRICE DIFFERENCES — the planning view for a run from where you are to `toId`.
 *
 * For each good: what you'd pay to buy it HERE (live), what you'd likely get for
 * it THERE (estimated), and the margin per tonne. `shippingPerTonne` is the fuel
 * cost of the trip spread over the cargo, so the margin is honest about
 * transport. Returns the goods worth carrying, best first, plus the confidence
 * in the destination estimate.
 */
export function runPlan(game, toId, shippingPerTonne = 0) {
  const fromId = game.player.at;
  const from = siteOf(game, fromId), to = siteOf(game, toId);
  if (!from || !to || fromId === toId) return { rows: [], freshness: null };

  const freshness = intelFreshness(game, toId);
  const rows = [];
  for (const c of COMMODITIES) {
    const here = estimatedPrice(game, fromId, c.id);
    const there = estimatedPrice(game, toId, c.id);
    if (!here || !there) continue;              // not traded at one end
    const margin = there.sell - here.buy - shippingPerTonne;
    rows.push({
      id: c.id, name: c.name, tier: c.tier,
      buyHere: here.buy, sellThere: there.sell,
      shipping: Math.round(shippingPerTonne),
      marginPerTonne: Math.round(margin),
      viable: margin > 0,
    });
  }
  rows.sort((a, b) => b.marginPerTonne - a.marginPerTonne);
  return { rows, freshness };
}

/**
 * What the cargo you're CARRYING would fetch at `toId`, estimated. So the
 * question "is this where I should offload?" has a number, before you fly.
 */
export function cargoValueAt(game, toId) {
  let total = 0;
  const lines = [];
  for (const [id, tonnes] of Object.entries(game.player.cargo)) {
    const est = estimatedPrice(game, toId, id);
    const unit = est ? est.sell : 0;
    total += unit * tonnes;
    lines.push({ id, name: COMMODITY_BY_ID[id].name, tonnes, unit, value: unit * tonnes, sold: !!est });
  }
  return { total: Math.round(total), lines, freshness: intelFreshness(game, toId) };
}
