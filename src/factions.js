// ===========================================================================
// FACTION SPAWN — rolling a fresh solar system at the start of each run.
//
// The geography never changes (design.md — that's the educational spine); the
// ACTORS do. At the start of a run we draw a handful of factions from the pool
// (data/factions.js), place each at one of its possible homes, and compute how
// each one bends the world. Same seed → same run, so a game is reproducible and
// shareable, and save/load is trivial. Different seed → a different set of
// pressures and opportunities over the same real map.
//
// This is the roguelike, done without faking the planets.
//
// Everything here is SEEDED and PURE. No Math.random — the run's variety comes
// from one integer, which is exactly what makes it replayable (rng.js).
// ===========================================================================

import { FACTIONS, FACTION_BY_ID, REGIONS, DISPOSITION_START } from "./data/factions.js";
import { CORE_SITES } from "./data/sites.js";
import { seeded } from "./rng.js";

/** Resolve a faction's `homes` (which may include region shorthands) to concrete
 *  site ids that exist IN THIS RUN's generated world. Regions name systems, so a
 *  faction that can live "in the belt" can spawn at whatever belt sites this
 *  seed actually drew. */
function possibleSites(faction, sites) {
  const out = new Set();
  for (const h of faction.homes) {
    if (h === "any") sites.forEach((s) => out.add(s.id));
    else if (REGIONS[h]) sites.forEach((s) => REGIONS[h].includes(s.system) && out.add(s.id));
    else if (sites.some((s) => s.id === h)) out.add(h);
  }
  return [...out];
}

/**
 * Draw and place `count` factions for a new run.
 *
 * Rules that keep a run coherent:
 *  • No two factions share a home site — a place has one dominant actor, so its
 *    character is legible rather than a muddle of conflicting modifiers.
 *  • The draw is spread across archetypes where it can be, so a run isn't all
 *    pirates or all merchants — you get a MIX of pressures, which is what makes
 *    the strategic picture interesting.
 *
 * Returns an array of { faction, siteId, standing } — the placed actors.
 */
export function spawnFactions(seed, sites = CORE_SITES, count = 4) {
  const rng = seeded(seed >>> 0);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const takenSites = new Set();
  const placed = [];

  // Try to cover distinct archetypes first, then fill the rest at random — so a
  // run reliably has a spread of economic / military / tech / cultural pressure.
  const byArch = {};
  for (const f of FACTIONS) (byArch[f.archetype] ||= []).push(f);
  const archOrder = shuffle(Object.keys(byArch));
  const queue = [
    ...archOrder.map((a) => pick(byArch[a])),               // one per archetype, shuffled
    ...shuffle(FACTIONS),                                    // then everyone, for the remainder
  ];

  const usedFactions = new Set();
  for (const faction of queue) {
    if (placed.length >= count) break;
    if (usedFactions.has(faction.id)) continue;
    const homes = shuffle(possibleSites(faction, sites)).filter((id) => !takenSites.has(id));
    if (!homes.length) continue;                            // no free home; skip this one
    const siteId = homes[0];
    const site = sites.find((s) => s.id === siteId);
    takenSites.add(siteId);
    usedFactions.add(faction.id);
    // The placed record carries its own geography (system, name). Sites are
    // per-run now, so anything reading the placement later — danger, news, the
    // brief — must not have to reach back into a site list to know where it is.
    placed.push({
      factionId: faction.id,
      siteId,
      system: site.system,
      siteName: site.name,
      standing: DISPOSITION_START[faction.disposition] ?? 0,
    });
  }
  return placed;
}

// ---------------------------------------------------------------------------
// Reading the placed world
// ---------------------------------------------------------------------------

/** The faction that controls a site this run, or null. */
export function factionAt(placed, siteId) {
  const p = placed.find((x) => x.siteId === siteId);
  return p ? { ...p, faction: FACTION_BY_ID[p.factionId] } : null;
}

/**
 * The danger level of a region this run, 0..1-ish, from whoever's active there.
 * Feeds the encounter roll: a pirate-held approach is dangerous, a patrolled
 * one is safe. Danger from multiple nearby actors adds, then clamps.
 */
export function regionDanger(placed, systemId) {
  let d = 0.1;   // space is never perfectly safe
  for (const p of placed) {
    if (p.system === systemId) d += FACTION_BY_ID[p.factionId].danger || 0;
  }
  return Math.max(0, Math.min(1, d));
}

/**
 * PIRATES AND POLICE ARE TWO NUMBERS, NOT ONE.
 *
 * regionDanger() nets them against each other, which is right for "how likely is
 * trouble" and wrong for everything else — because a heavily policed region is
 * SAFE FROM RAIDERS and DANGEROUS TO SMUGGLERS at the same time. Netting those
 * to a single word threw away the most useful thing on the screen, and it became
 * load-bearing the moment contraband landed: the run you want with a legal hold
 * is the exact opposite of the run you want with a banned one.
 *
 * So: predators add to one number, patrols to the other, and nothing cancels.
 */
export function pirateThreat(placed, systemId) {
  let t = 0.08;   // opportunists exist everywhere
  for (const p of placed) {
    const d = FACTION_BY_ID[p.factionId]?.danger || 0;
    if (p.system === systemId && d > 0) t += d;
  }
  return Math.max(0, Math.min(1, t));
}

/** How much law patrols this region, from factions that keep order (negative
 *  `danger` is what a navy looks like in the data). */
export function patrolStrength(placed, systemId) {
  let s = 0;
  for (const p of placed) {
    const d = FACTION_BY_ID[p.factionId]?.danger || 0;
    if (p.system === systemId && d < 0) s += -d;
  }
  return Math.max(0, Math.min(1, s));
}

/**
 * How this run's factions bend a site's market — the modifiers markets.js will
 * apply on top of the base geography. Returns { glut, demand, crisis, produces,
 * tariff } merged from the controlling faction (and any whose effect reaches
 * here). Kept as plain data so the market layer stays the single place that
 * turns modifiers into prices.
 */
export function marketMods(placed, siteId) {
  const here = factionAt(placed, siteId);
  if (!here) return {};
  return here.faction.market || {};
}

/** A one-line human summary of who's out there, for the run's opening brief. */
export function worldBrief(placed) {
  return placed.map((p) => {
    const f = FACTION_BY_ID[p.factionId];
    return `${f.name} at ${p.siteName || p.siteId}: ${f.blurb}`;
  });
}
