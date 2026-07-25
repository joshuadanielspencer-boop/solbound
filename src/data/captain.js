// ===========================================================================
// THE CAPTAIN — the customisable person the player is.
//
// Space Trader let you spend 16 points across four skills at the start, with
// strengths and weaknesses. SOLBOUND keeps that, because a build you chose is a
// build you're invested in, and it's the cheapest possible replayability: the
// same map plays differently as a Trader than as an Engineer.
//
// Every skill has to EARN its place by changing a decision the player already
// makes — a skill that only tweaks a hidden number is bookkeeping (design.md
// §14, the scope test). What each one touches is recorded here so the systems
// that read it stay honest to the description the player was shown.
// ===========================================================================

export const SKILLS = [
  {
    id: "pilot", name: "Pilot", emoji: "🧭",
    blurb: "Steadier hands on the stick.",
    // Touches: evasion in encounters, and a small discount on the off-window
    // Δv penalty (a better pilot flies a tighter trajectory).
    affects: "Evade trouble in transit; waste less fuel flying off the ideal window.",
  },
  {
    id: "trader", name: "Trader", emoji: "💱",
    blurb: "Reads a market, and a face.",
    // Touches: buy/sell spread — a better trader buys nearer the low and sells
    // nearer the high of the scarcity curve.
    affects: "Better prices at every market, both buying and selling.",
  },
  {
    id: "engineer", name: "Engineer", emoji: "🔧",
    blurb: "Keeps the ship whole.",
    // Touches: repair rate, fuel efficiency (a well-tuned drive gets slightly
    // more Δv from the same tank), and equipment reliability.
    affects: "Cheaper repairs, and a little more range from the same fuel.",
  },
  {
    id: "fighter", name: "Fighter", emoji: "🎯",
    blurb: "When talking fails.",
    // Touches: combat resolution when an encounter turns to a fight.
    affects: "Win the fights you can't avoid; survive the ones you lose.",
  },
];

export const SKILL_POINTS = 16;   // total to allocate
export const SKILL_MIN = 1;       // no skill starts at zero — everyone can do a little
export const SKILL_MAX = 10;      // and none starts maxed — growth is earned in play

/**
 * Backgrounds — pre-baked skill spreads, so a player who doesn't want to fiddle
 * with sliders can pick a character instead. Each is a legal allocation (sums to
 * SKILL_POINTS, every skill within [MIN, MAX]).
 *
 * They also quietly teach the four playstyles Space Trader hid behind its skill
 * screen: the map really does play differently depending on this choice.
 */
export const BACKGROUNDS = [
  {
    id: "hauler", name: "Ex-hauler", emoji: "📦",
    story: "Twenty years running lunar freight for someone else. Now the ship is yours.",
    skills: { pilot: 4, trader: 7, engineer: 4, fighter: 1 },
  },
  {
    id: "mechanic", name: "Station mechanic", emoji: "🔧",
    story: "You kept other people's ships flying. This one you'll keep flying yourself.",
    skills: { pilot: 3, trader: 3, engineer: 9, fighter: 1 },
  },
  {
    id: "pilot", name: "Test pilot", emoji: "🧭",
    story: "You flew the prototypes nobody else would. Orbits hold no surprises for you.",
    skills: { pilot: 9, trader: 3, engineer: 3, fighter: 1 },
  },
  {
    id: "privateer", name: "Privateer", emoji: "🎯",
    story: "The Belt is lawless if you let it be. You didn't.",
    skills: { pilot: 4, trader: 2, engineer: 3, fighter: 7 },
  },
];

/** Is a skill allocation legal? Used by the creator and the tests. */
export function validSkills(skills) {
  const vals = SKILLS.map((s) => skills[s.id]);
  if (vals.some((v) => !Number.isInteger(v) || v < SKILL_MIN || v > SKILL_MAX)) return false;
  return vals.reduce((a, b) => a + b, 0) === SKILL_POINTS;
}

export const backgroundById = (id) => BACKGROUNDS.find((b) => b.id === id);

/** A fresh, legal, middle-of-the-road allocation to seed the creator UI. */
export const defaultSkills = () => ({ pilot: 4, trader: 4, engineer: 4, fighter: 4 });
