// ===========================================================================
// HIRING — who is in the bar at this port, and what they cost you every day.
//
// Two ideas, and they are the same idea seen from both ends:
//
//   effectiveSkills()  the best person aboard does the job, so a hired hand can
//                      cover a weakness your captain will never fix
//   dailyWages()       and they are paid every day, whether or not the ship is
//                      earning
//
// That second one is the point. Before crew, credits only ever went UP between
// purchases, so time was free and there was no cost to dithering in port or
// taking the slow route. A wage bill makes the clock expensive, which is what
// turns "how long does this take" from flavour into a number you weigh.
//
// WHO IS AVAILABLE is seeded from (run seed, site, and a slow calendar block), so
// the bar at Ceres has the same three people in it all month, every reload —
// deterministic like everything else here, and it means "come back when you can
// afford Ibarra" is a real plan rather than a reroll.
// ===========================================================================

import { CREW, CREW_BY_ID, berthsFor } from "./data/crew.js";
import { siteOf, techOf } from "./data/sites.js";
import { HULL_BY_ID } from "./data/hulls.js";
import { SKILLS } from "./data/captain.js";
import { seeded } from "./rng.js";

const DAY = 86400000;
/** How long the same faces stay in the same bar. */
export const HIRING_BLOCK_DAYS = 40;

/**
 * The crew available at a site right now.
 *
 * A developed port has more people passing through and better ones — the same
 * tech-level axis that gates hulls, applied to the only other thing you can buy
 * that changes what your ship can do.
 */
export function crewForHire(seed, site, t) {
  if (!site) return [];
  // The contract is the SITE, not its id. Getting it wrong used to fail deep in
  // the hash as "cannot read length of undefined", which is how the whole Yard
  // tab crashed unnoticed for a release. Say what is actually wrong.
  if (typeof site === "string") {
    throw new TypeError(`crewForHire wants the site object, not its id ("${site}"). Use siteOf(game, id).`);
  }
  const siteId = site.id;
  const block = Math.floor((t - Date.UTC(2035, 0, 1)) / (HIRING_BLOCK_DAYS * DAY));
  // Hash the three inputs into one stream. Site id goes in character by character
  // so two ports never share a roll.
  let h = (seed >>> 0) ^ (block * 0x9E3779B1);
  for (let i = 0; i < siteId.length; i++) h = Math.imul(h ^ siteId.charCodeAt(i), 0x85EBCA77);
  const rng = seeded(h >>> 0);

  const tech = techOf(site).n;
  const count = tech >= 5 ? 3 : tech >= 3 ? 2 : 1;
  // A frontier outpost does not have a nine-rated engineer hanging around.
  const ceiling = tech >= 6 ? 9 : tech >= 4 ? 8 : 6;

  const pool = CREW.filter((c) => c.rating <= ceiling);
  const picked = [];
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const c of shuffled) {
    if (picked.length >= count) break;
    picked.push(c);
  }
  return picked;
}

// ---------------------------------------------------------------------------
// What a crew does for you
// ---------------------------------------------------------------------------

/**
 * The skills the SHIP actually operates at: the best of the captain and everyone
 * aboard, skill by skill. Every system that reads a skill should read this
 * instead of `player.skills`, or hiring an ace pilot would change nothing.
 */
export function effectiveSkills(player) {
  const out = {};
  for (const s of SKILLS) {
    let best = player.skills?.[s.id] ?? 4;
    let who = null;
    for (const id of player.crew || []) {
      const c = CREW_BY_ID[id];
      if (c && c.skill === s.id && c.rating > best) { best = c.rating; who = c.name; }
    }
    out[s.id] = best;
    out[`${s.id}By`] = who;      // who is actually doing it, for the UI
  }
  return out;
}

/** What the crew costs per day. The captain does not draw a wage. */
export const dailyWages = (player) =>
  (player.crew || []).reduce((a, id) => a + (CREW_BY_ID[id]?.wage || 0), 0);

/** Free berths aboard, after the captain and whoever is already hired. */
export const berthsFree = (player) =>
  berthsFor(HULL_BY_ID[player.ship.hull]) - (player.crew?.length || 0);

// ---------------------------------------------------------------------------
// Hiring and firing
// ---------------------------------------------------------------------------

/** Sign someone on. Costs nothing up front — they cost you every day after. */
export function hireCrew(game, crewId) {
  const c = CREW_BY_ID[crewId];
  if (!c) return { error: "no-such-crew" };
  if ((game.player.crew || []).includes(crewId)) return { error: "already-aboard", reason: "Already signed on." };
  if (berthsFree(game.player) <= 0) {
    return { error: "no-berth", reason: "No free berth. A bigger hull, or let someone go." };
  }
  if (!crewForHire(game.seed, siteOf(game, game.player.at), game.t).some((x) => x.id === crewId)) {
    return { error: "not-here", reason: "They're not at this port." };
  }
  return {
    game: {
      ...game,
      player: { ...game.player, crew: [...(game.player.crew || []), crewId] },
      log: [...(game.log || []), `${c.name} signed on at ${siteOf(game, game.player.at)?.name}.`],
    },
    hired: c,
  };
}

/** Pay someone off. Instant, and free — the wage simply stops. */
export function dismissCrew(game, crewId) {
  if (!(game.player.crew || []).includes(crewId)) return { error: "not-aboard" };
  const c = CREW_BY_ID[crewId];
  return {
    game: {
      ...game,
      player: { ...game.player, crew: game.player.crew.filter((id) => id !== crewId) },
      log: [...(game.log || []), `${c.name} paid off at ${siteOf(game, game.player.at)?.name}.`],
    },
    dismissed: c,
  };
}

// ---------------------------------------------------------------------------
// Paying them
// ---------------------------------------------------------------------------

/**
 * Charge `days` of wages. If the money runs out the crew do not work for free —
 * they take what is left and walk at the next port, which is a consequence the
 * player can see coming rather than a debt spiral they cannot.
 *
 * Returns { player, paid, quit } — `quit` is the crew who left.
 */
export function payWages(player, days) {
  // NOT rounded: the clock advances in ~30 slivers a second, and rounding each
  // sliver would make a fast-forwarded crossing cost a different amount from a
  // skipped one. Round at the point it is shown to a human, never here.
  const owed = dailyWages(player) * days;
  if (owed <= 0) return { player, paid: 0, quit: [] };
  if (player.credits >= owed) {
    return { player: { ...player, credits: player.credits - owed }, paid: owed, quit: [] };
  }
  return {
    player: { ...player, credits: 0, crew: [] },
    paid: player.credits,
    quit: (player.crew || []).map((id) => CREW_BY_ID[id]).filter(Boolean),
  };
}
