// ===========================================================================
// REPUTATION — who out here knows your name, and what it took.
//
// Standing already MOVED in five places (fight, bribe, comply, help, ignore) and
// showed nowhere: the only number a player ever saw was inside the encounter
// panel that had just changed it, and by the time they dismissed it the figure
// was gone. A quantity that changes invisibly is not a system, it is a rumour.
//
// So this module is the one home for three questions the game could not answer:
//
//   WHO LIKES YOU     reputationTrack() — every placed actor, their standing,
//                     and the tier word that says what that number means
//   WHAT IT TOOK      the ledger (game.repLog) — dated entries, each with the
//                     encounter and the choice that moved the needle
//   WHAT IT BUYS      standingTalkBonus() — the one real effect standing has
//                     today, which encounters.js now reads FROM HERE rather
//                     than computing inline
//
// That last one matters more than it looks. Effects of standing scattered
// through the resolver are effects nobody can enumerate, and a reputation screen
// that cannot list what reputation does is a scoreboard, not a system
// (design.md §14: if it only adds bookkeeping, simplify it). One module owns
// them; the screen reads that module; the two can never drift.
//
// STANDING IS NOT STORED HERE. It lives on game.factions[].standing, where the
// spawn put it (encounters.js says the same). This file only reads, describes,
// and appends to the ledger. Pure functions, no state.
//
// ACCESSIBILITY (project rule 4): every tier carries a WORD and a signed NUMBER
// as well as a tone. Nothing in the UI may lean on the colour alone.
// ===========================================================================

import { FACTION_BY_ID, ARCHETYPES } from "./data/factions.js";
import { siteOf } from "./data/sites.js";

/**
 * The ladder. `min` is the lowest standing that reads as this tier; the bands
 * are chosen so the starting dispositions (data/factions.js DISPOSITION_START)
 * land where their names promise: a hostile band opens at Distrusted (−30), a
 * prickly one at Wary (−10), a friendly one already Welcome (+15).
 *
 * Ordered high to low, so `find` picks the first tier a standing clears.
 */
export const REP_TIERS = [
  {
    id: "honoured", name: "Honoured", min: 70, tone: "#3E9B6E",
    note: "They will go out of their way for you. Whatever you did, it is still being told.",
  },
  {
    id: "trusted", name: "Trusted", min: 40, tone: "#3E9B6E",
    note: "A known quantity, and a welcome one. Their people talk to you first and check afterwards.",
  },
  {
    id: "welcome", name: "Welcome", min: 15, tone: "#7FB2CE",
    note: "You have done them no harm and some good. Doors open, if not quickly.",
  },
  {
    id: "neutral", name: "Neutral", min: -9, tone: "var(--muted)",
    note: "A hull with a name on it. They have no opinion of you worth acting on.",
  },
  {
    id: "wary", name: "Wary", min: -29, tone: "var(--gold)",
    note: "Something about you did not sit right. They watch, and they are slower to help.",
  },
  {
    id: "distrusted", name: "Distrusted", min: -59, tone: "var(--hot)",
    note: "They expect the worst of you, and act on the expectation. Talking your way past them is hard.",
  },
  {
    id: "hunted", name: "Hunted", min: -100, tone: "var(--hot)",
    note: "You are a problem they intend to solve. Their space is not a place to be caught slow.",
  },
];

export const REP_MIN = -100, REP_MAX = 100;

/** The tier a standing reads as. Always returns one — the ladder covers the range. */
export function repTier(standing = 0) {
  const s = Math.max(REP_MIN, Math.min(REP_MAX, standing || 0));
  return REP_TIERS.find((t) => s >= t.min) || REP_TIERS[REP_TIERS.length - 1];
}

/**
 * WHAT STANDING BUYS, today, in full.
 *
 * One effect, and it is the honest one: a name somebody knows is a name they
 * will listen to. This is the term encounters.js's `talk` handler adds to its
 * success probability — extracted to here so the reputation screen can state the
 * effect exactly rather than approximating it, and so the next effect that lands
 * has an obvious place to live.
 *
 * 250 is the divisor the resolver has always used: a swing from Hunted to
 * Honoured is worth about 0.8 of a point of the Trader skill, which is real
 * without eclipsing the skill the player actually chose.
 */
export const TALK_DIVISOR = 250;
export const standingTalkBonus = (standing = 0) => (standing || 0) / TALK_DIVISOR;

/** The same figure as a percentage, for a screen that has to say it out loud. */
export const talkBonusPct = (standing = 0) => Math.round(standingTalkBonus(standing) * 100);

/**
 * Every placed actor in this run, with everything a screen needs about them:
 * their standing, the tier it reads as, where they sit, and whether you are
 * standing in their hall right now.
 *
 * Sorted by standing, best first — the question a player asks this screen is
 * "who is on my side", not "who is listed first in the data".
 */
export function reputationTrack(game) {
  const here = siteOf(game, game.player?.at);
  return (game.factions || [])
    .map((p) => {
      const faction = FACTION_BY_ID[p.factionId];
      return {
        factionId: p.factionId,
        faction,
        archetype: ARCHETYPES[faction?.archetype] || null,
        standing: p.standing || 0,
        tier: repTier(p.standing || 0),
        siteId: p.siteId,
        siteName: p.siteName || p.siteId,
        system: p.system,
        atTheirPort: !!here && here.id === p.siteId,
        inTheirSystem: !!here && here.system === p.system,
        talkBonusPct: talkBonusPct(p.standing || 0),
      };
    })
    .filter((r) => r.faction)
    .sort((a, b) => b.standing - a.standing);
}

/** Standing with one faction, whether or not they were drawn this run. */
export function standingWith(game, factionId) {
  const p = (game.factions || []).find((f) => f.factionId === factionId);
  return p ? p.standing || 0 : 0;
}

/**
 * Who holds a port and how you stand with them — the version the dock and the
 * course plotter want, so standing shows up at the moment it would change a
 * decision rather than only on its own screen.
 */
export function repAt(game, siteId) {
  const p = (game.factions || []).find((f) => f.siteId === siteId);
  if (!p) return null;
  const faction = FACTION_BY_ID[p.factionId];
  if (!faction) return null;
  return { factionId: p.factionId, faction, standing: p.standing || 0, tier: repTier(p.standing || 0) };
}

// ---------------------------------------------------------------------------
// The ledger — what it took
// ---------------------------------------------------------------------------

/** Entries kept. Long enough to tell the story of a run, short enough that a
 *  save never grows without bound (the whole state is JSON in localStorage). */
export const REP_LOG_MAX = 60;

/**
 * Turn an outcome's standing deltas into ledger entries. Pure, and it takes the
 * ALREADY-APPLIED factions so each entry records where the number landed — a
 * ledger that only carries deltas cannot be read back without replaying every
 * encounter, and the clamp at ±100 means the deltas do not even sum correctly.
 */
export function repEntries({ deltas = {}, factions = [], t = 0, reason = "" }) {
  const out = [];
  for (const [factionId, delta] of Object.entries(deltas)) {
    if (!delta) continue;
    const placed = factions.find((f) => f.factionId === factionId);
    if (!placed) continue;                       // nameless raiders move nobody's needle
    out.push({ t, factionId, delta, standing: placed.standing, reason });
  }
  return out;
}

/** Append entries to the run's ledger, oldest trimmed away first. */
export function appendRepLog(log = [], entries = []) {
  if (!entries.length) return log;
  const next = [...log, ...entries];
  return next.length > REP_LOG_MAX ? next.slice(next.length - REP_LOG_MAX) : next;
}

/**
 * The ledger, newest first, decorated with the faction it belongs to. Pass a
 * `factionId` for one actor's history — that is the view that answers "what did
 * I do to them", which is the question the number alone provokes.
 */
export function repLedger(game, { factionId = null, limit = 0 } = {}) {
  const rows = (game.repLog || [])
    .filter((e) => !factionId || e.factionId === factionId)
    .map((e) => ({ ...e, faction: FACTION_BY_ID[e.factionId] || null }))
    .reverse();
  return limit > 0 ? rows.slice(0, limit) : rows;
}
