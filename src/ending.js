// ===========================================================================
// ENDING — how a game finishes, and what became of you.
//
// Pure functions over the game value, like everything in the sim. Three ways
// out, and the encounter layer already owns a fourth:
//
//   target    a Run reached its fortune                    → ending here
//   charter   a Run's clock ran out                        → ending here
//   retired   the captain chose to stop, at a port         → retire() here
//   destroyed the ship was lost with no pod                → encounters.js
//
// All four land in the same place — `game.over` — so the UI has one thing to
// check and one screen to show. `over.score` is what that screen reads.
//
// WHERE THE CHECK RUNS. tradergame.js wraps the three things that move money or
// time — advanceTime, wait, sell — in withEnding(). It does NOT run mid-
// encounter: an unresolved encounter holds the world exactly as it holds the
// clock, and a fortune reached in the same tick as a pirate arrives is settled
// after the pirate, not before.
//
// NET WORTH IS CASH PLUS THE SHIP, not cargo. What is in the hold is worth
// whatever the next port pays, which the game refuses to know in advance (that
// is the whole intel layer); the yard's trade-in price is a number the game
// already quotes. Honest and small beats generous and guessed.
// ===========================================================================

import { MODE_BY_ID, DEFAULT_MODE, RUN_RANKS, CAMPAIGN_RANKS } from "./data/modes.js";
import { tradeInValue } from "./shipyard.js";
import { umbilicalReport } from "./industry.js";

const DAY = 86400000;
const YEAR = 365.25 * DAY;

/** The charter a new game starts under: its clock and its target, as data on the save. */
export function charterFor(modeId, startT) {
  const m = MODE_BY_ID[modeId] || MODE_BY_ID[DEFAULT_MODE];
  return {
    modeId: m.id,
    startT,
    endT: m.charterYears ? startT + m.charterYears * YEAR : null,
    targetCredits: m.targetCredits ?? null,
  };
}

/** Cash and the ship at the yard's price. See the header for why not cargo. */
export function netWorth(game) {
  return game.player.credits + tradeInValue(game.player.ship);
}

/** Years left on the charter, or null for an open-ended game. Never negative. */
export function charterLeftYears(game) {
  const endT = game.charter?.endT;
  if (!endT) return null;
  return Math.max(0, (endT - game.t) / YEAR);
}

const rankOf = (table, value) => table.find((r) => value >= r.atLeast) || table[table.length - 1];

/**
 * Everything the ending screen says about a captain. Computed at the moment
 * the game ends and STORED on `over`, so the numbers are the ones that were
 * true then, not whatever the state says after a reload.
 */
export function score(game) {
  const charter = game.charter || charterFor(game.mode || DEFAULT_MODE, game.t);
  const worth = netWorth(game);
  const umb = umbilicalReport(game);
  const days = Math.round((game.t - (charter.startT ?? game.t)) / DAY);
  const isRun = charter.modeId === "run";
  const fraction = charter.targetCredits ? worth / charter.targetCredits : null;
  const rank = isRun ? rankOf(RUN_RANKS, fraction ?? 0) : rankOf(CAMPAIGN_RANKS, umb.cured);
  return {
    modeId: charter.modeId,
    netWorth: Math.round(worth),
    credits: Math.round(game.player.credits),
    shipValue: Math.round(tradeInValue(game.player.ship)),
    targetCredits: charter.targetCredits,
    fraction,
    days,
    years: Math.round((days / 365.25) * 10) / 10,
    portsVisited: (game.visited || []).length,
    plantsBuilt: umb.works,
    linksCured: umb.cured,
    linksTotal: umb.links,
    rank: rank.name,
    rankNote: rank.note,
  };
}

/**
 * Does this game end here? Null if not; otherwise the `over` object to set.
 * Only a charter with a clock or a target can end a game this way — a Campaign
 * never does, which is the definition of open-ended.
 */
export function endingFor(game) {
  if (game.over) return null;
  if (game.encounter && !game.encounter.outcome) return null;   // settle the pirate first
  const c = game.charter;
  if (!c) return null;
  if (c.targetCredits && game.player.credits >= c.targetCredits) {
    return {
      reason: "target",
      headline: "You made the number.",
      detail: `${money(c.targetCredits)} in the account, with ${sayYears(charterLeftYears(game))} still on the charter. `
        + `The ship is yours to sell, the crew is paid off, and nobody out here needs to know how you did it.`,
      t: game.t,
      score: score(game),
    };
  }
  if (c.endT && game.t >= c.endT) {
    return {
      reason: "charter",
      headline: "The charter ran out.",
      detail: `Ten years, to the day. What you have is what you retire on — and the map you leave behind `
        + `is the one you drew on it.`,
      t: game.t,
      score: score(game),
    };
  }
  return null;
}

/** Apply endingFor() to a game value. The one call tradergame.js needs. */
export function withEnding(game) {
  const o = endingFor(game);
  return o ? { ...game, over: o } : game;
}

/**
 * RETIRE — the captain's own choice, at a port. Space Trader's button, and the
 * only way a Campaign ends. Refused in flight: nobody retires between planets.
 */
export function retire(game) {
  if (game.over) return { game };
  if (game.status !== "docked") return { error: "in-flight", reason: "Retire at a port, not between them." };
  const sc = score(game);
  const isRun = sc.modeId === "run";
  return {
    game: {
      ...game,
      over: {
        reason: "retired",
        headline: isRun ? "You called it." : "You stepped off the ship.",
        detail: isRun
          ? `${sayYears(charterLeftYears(game))} still on the charter, and you chose to stop with what you had.`
          : `${sc.linksCured} of ${sc.linksTotal} supply links across the map no longer run to Earth because `
            + `of what you built. That number is what the campaign was for.`,
        t: game.t,
        score: sc,
      },
    },
  };
}

const money = (n) => "$" + Math.round(n).toLocaleString();
const sayYears = (y) => y == null ? "no clock" : y < 1 ? `${Math.round(y * 12)} months` : `${y.toFixed(1)} years`;
