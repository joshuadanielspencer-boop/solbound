// ===========================================================================
// WORLD INFO — the character of a place, and the news that makes it feel alive.
//
// Two Space Trader screens, both pure functions of the game state:
//
//   systemInfo()  → the "System Info" panel: tech level, government and law,
//                   who's in charge, how dangerous it is, and what pressure the
//                   place is currently under. This is what gives each port a
//                   personality beyond a hand-written blurb.
//
//   generateNews() → the local newspaper: headlines drawn from the roguelike
//                   faction draw and the live markets. It's the "why go far"
//                   signal (a blockaded colony, a cheap-fuel depot) and the
//                   event layer in one — the human-facing companion to the
//                   numeric market intel. Deterministic: same world → same news,
//                   no flicker, reproducible from a save.
// ===========================================================================

import { SITES, SITE_BY_ID, techOf, govOf } from "./data/sites.js";
import { factionAt, regionDanger } from "./factions.js";
import { FACTION_BY_ID } from "./data/factions.js";
import { COMMODITY_BY_ID } from "./data/commodities.js";
import { nominalStock } from "./market.js";

/** A word for how dangerous a region is, from its numeric danger. */
function dangerWord(d) {
  if (d < 0.08) return { word: "Safe", note: "patrolled and quiet" };
  if (d < 0.25) return { word: "Settled", note: "the usual small risks of space" };
  if (d < 0.5) return { word: "Unsettled", note: "raiders work these lanes" };
  return { word: "Dangerous", note: "cross it with a full hold and expect company" };
}

/**
 * The System Info for a site: its character as a place. Pure — reads the site
 * data, the government, and this run's faction placement.
 */
export function systemInfo(game, siteId) {
  const site = SITE_BY_ID[siteId];
  if (!site) return null;
  const tech = techOf(site);
  const gov = govOf(site);
  const control = factionAt(game.factions, siteId);
  const danger = regionDanger(game.factions, site.system);
  const dw = dangerWord(danger);

  // The "pressure" line — Space Trader's status. A controlling faction with a
  // crisis or a blockade dominates it; otherwise it reflects the danger.
  let pressure = "Under no particular pressure.";
  if (control) {
    const f = control.faction;
    if (f.market?.crisis) pressure = `In crisis — desperate for ${f.market.crisis.map((c) => COMMODITY_BY_ID[c]?.name.toLowerCase()).join(", ")}.`;
    else if (f.danger >= 0.5) pressure = `Under threat — ${f.name} makes these approaches dangerous.`;
    else if (f.danger <= -0.4) pressure = `Kept safe by ${f.name}.`;
    else if (f.market?.tariff) pressure = `${f.name} taxes everything that passes through.`;
    else pressure = `${f.name} sets the tone here.`;
  }

  return {
    site, tech, gov, control, danger,
    dangerWord: dw.word, dangerNote: dw.note,
    pressure,
    population: site.population,
  };
}

// ---------------------------------------------------------------------------
// The news
// ---------------------------------------------------------------------------

/**
 * How current the news is at `siteId`, in the newspaper's own voice — high-tech
 * ports hear more, and sooner, about the rest of the system (Space Trader's
 * rule, and our information-as-a-resource idea).
 */
export function newsReach(site) {
  const tech = techOf(site).n;
  if (tech >= 6) return { far: true, note: "wired into the whole system's traffic" };
  if (tech >= 4) return { far: true, note: "well connected to nearby ports" };
  return { far: false, note: "mostly local word-of-mouth" };
}

/**
 * Generate the newspaper for the player's current site. Deterministic from the
 * game state. Two sources:
 *   • faction news — one standing headline per placed faction, describing what
 *     it's doing to the system. The reason to travel, and the state of the
 *     world.
 *   • market watch — the sharpest current shortages of valuable goods, as
 *     actionable tips. These shift as the markets drift.
 *
 * A low-tech port hears only about its own system; a high-tech one hears about
 * everywhere (newsReach).
 */
export function generateNews(game) {
  const here = SITE_BY_ID[game.player.at];
  const reach = newsReach(here);
  const gov = govOf(here);
  const items = [];

  // --- faction headlines -------------------------------------------------
  for (const placed of game.factions) {
    const f = FACTION_BY_ID[placed.factionId];
    const site = SITE_BY_ID[placed.siteId];
    if (!site) continue;
    if (!reach.far && site.system !== here.system) continue;   // out of earshot

    let headline = null, kind = "faction";
    if (f.market?.crisis) {
      headline = `Crisis at ${site.name}: desperate for ${f.market.crisis.map((c) => COMMODITY_BY_ID[c]?.name.toLowerCase()).join(", ")}.`;
      kind = "crisis";
    } else if (f.danger >= 0.5) {
      headline = `${f.name} prey on the approaches to ${site.name}. Haulers, take care.`;
      kind = "danger";
    } else if (f.market?.glut?.includes("propellant") || f.market?.produces?.includes("propellant")) {
      headline = `${f.name} sell propellant cheap at ${site.name} — a depot worth the detour.`;
      kind = "opportunity";
    } else if (f.market?.tariff) {
      headline = `${f.name} tighten their grip on trade through ${site.name}.`;
    } else if (f.danger <= -0.4) {
      headline = `${f.name} keep order around ${site.name}.`;
    } else {
      headline = `${f.name} have made ${site.name} their own.`;
    }
    items.push({ kind, headline, siteId: site.id, priority: kind === "crisis" ? 3 : kind === "danger" ? 2 : 1 });
  }

  // --- market watch: the sharpest shortages of valuable goods ------------
  const watch = [];
  for (const site of SITES) {
    if (!reach.far && site.system !== here.system) continue;
    const m = game.markets[site.id];
    if (!m) continue;
    for (const [id, stock] of Object.entries(m.stock)) {
      const c = COMMODITY_BY_ID[id];
      if (!c || c.valuePerTonne < 40000) continue;         // only goods worth hauling
      // No paper prints "black market short of fissiles, buyers paying well."
      // Contraband demand is something you work out, not something you read.
      if (c.contraband) continue;
      const ratio = stock / nominalStock(site, id);
      if (ratio < 0.4 && site.consumes.includes(id)) {
        watch.push({ severity: (0.4 - ratio) * (c.valuePerTonne / 1e6), siteId: site.id, id, ratio });
      }
    }
  }
  watch.sort((a, b) => b.severity - a.severity);
  for (const w of watch.slice(0, 3)) {
    const site = SITE_BY_ID[w.siteId], c = COMMODITY_BY_ID[w.id];
    items.push({
      kind: "market",
      headline: `${c.name} runs short at ${site.name}; buyers are paying well.`,
      siteId: site.id, priority: 1,
    });
  }

  items.sort((a, b) => b.priority - a.priority);
  return {
    paper: gov.paper,
    reachNote: reach.note,
    items: items.slice(0, 6),
  };
}
