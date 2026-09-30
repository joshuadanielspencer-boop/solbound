// ===========================================================================
// MODES — the two ways a game can end, as data.
//
// design.md §12 locked this on 2026-07-25: "Two victory conditions, and they
// define the two modes. A short RUN is bounded — a target fortune under a clock.
// The long CAMPAIGN is open-ended — sever Earth-dependency. These are not
// separate games: a Run is a Campaign with a win-and-stop condition and a
// shorter charter. Same engine, same map, same ships; the victory condition and
// the time cap are DATA, not code paths."
//
// This file is that data. ending.js reads it; nothing else needs to know which
// mode is running except the two screens that show the clock and the ending.
//
// WHY RUN MODE WENT IN NOW, two months after the engine could support it: a
// game with no ending cannot be playtested. There is no session that concludes,
// no score to compare two runs by, and no reason to stop — and every balance
// number in decisions.md is waiting on a playtest that a sandbox cannot host.
// A Run you can finish in an evening is the thing that makes the rest testable.
//
// ⚠ THE TWO NUMBERS ARE FIRST GUESSES. Two million against a $300,000 purse and
// ten years against a nine-month Mars run is a shape, not a measurement: it is
// meant to demand the mid-game (a drive refit is $1.8M) and to fit inside the
// ephemeris' 2050 horizon from a 2035 start with room to spare. Nobody has
// played to either end. They are UNTESTED in decisions.md and they are here,
// in one place, so a playtest can change them without opening the engine.
//
// Ranks are ABSTRACTION (design.md §16): a game's own scale for "how did you
// do", not a claim about anything real.
// ===========================================================================

export const MODES = {
  run: {
    id: "run", name: "Run", emoji: "⏱",
    tagline: "Get rich and retire before the charter runs out.",
    story: "Ten years of charter, one ship, and a number to reach. Reach it and you retire "
      + "rich; run out of calendar and you retire with whatever you have. Every choice is "
      + "priced against the clock.",
    charterYears: 10,
    targetCredits: 2_000_000,
  },
  campaign: {
    id: "campaign", name: "Campaign", emoji: "🌐",
    tagline: "Sever the umbilical to Earth. Open-ended.",
    story: "No clock and no target. Trade until you can build, build until the ports you "
      + "supply no longer need you. The score is how much of the solar system stopped "
      + "depending on Earth because of what you put there. Retire whenever you choose.",
    charterYears: null,
    targetCredits: null,
  },
};

export const MODE_IDS = Object.keys(MODES);
export const MODE_BY_ID = MODES;

// TWO DEFAULTS, and they are different on purpose. The ENGINE's default is the
// open-ended game: newGame() without a mode behaves exactly as every game did
// before modes existed, so nothing that never asked for an ending gets one —
// the crew test's rich captain crossing to Mars is not retired mid-flight by
// a target it never chose. The CREATE SCREEN's default is the Run, because a
// first game should have an ending in sight. Flip DEFAULT_PICK, not DEFAULT_MODE,
// if the Campaign should lead at the front door.
export const DEFAULT_MODE = "campaign";
export const DEFAULT_PICK = "run";

/**
 * How a Run scores: net worth as a fraction of the target. Highest first; the
 * first row whose floor you clear is your rank.
 */
export const RUN_RANKS = [
  { atLeast: 2.0,  name: "Retired a magnate",   note: "Twice what the charter asked." },
  { atLeast: 1.0,  name: "Retired rich",        note: "The charter's target, met." },
  { atLeast: 0.5,  name: "Retired comfortable", note: "Halfway to the target when the calendar ran out." },
  { atLeast: 0.25, name: "Made a living",       note: "Ahead of where you started, and no further." },
  // The bottom rank is reached two ways — the clock ran out, or you stopped
  // early — so its words must be true for both. "The charter ended" was not.
  { atLeast: 0,    name: "Never got going",     note: "Less than a quarter of the way to the number." },
];

/**
 * How a Campaign scores: supply links cured across the whole map — the number
 * industry.js's umbilicalReport() measures, which is the victory condition in
 * design.md §5 and not the player's balance.
 */
export const CAMPAIGN_RANKS = [
  { atLeast: 6, name: "Infrastructure",          note: "Whole ports no longer need Earth because of you." },
  { atLeast: 3, name: "A supply chain",          note: "More than one port, more than one thing." },
  { atLeast: 1, name: "The first cord cut",      note: "One port makes one thing it used to import." },
  { atLeast: 0, name: "Still on the umbilical",  note: "Everything out here is still shipped from Earth." },
];
