// ===========================================================================
// HULLS — the ships, as physical constraints rather than RPG classes.
//
// A hull is not a "class" that dictates a role; it's a set of hard limits — how
// much it masses empty, how much it can carry, how much fuel it holds, how many
// module slots it has. What ROLE it plays is what you fit into it (design.md §8).
// A freighter with a laser is a poorly-armed freighter, not a warship.
//
// The numbers are game-tuned abstractions, but the RELATIONSHIPS are honest and
// carry the lesson: cargo and fuel trade against each other, because both are
// mass, and mass is what the rocket equation charges for. A hull that carries
// more must either mass more (and cost more Δv to move) or hold less fuel.
//
// `dryTonnes` is the empty ship; `cargoTonnes` the hold; `fuelTonnes` the tank.
// Δv available comes from propulsion.js given the fitted drive — it is NOT a
// hull stat, because the same hull with a better engine goes further. That's the
// whole point of keeping propulsion under the hood but real.
// ===========================================================================

export const HULLS = [
  {
    id: "courier", name: "Courier", emoji: "✉️",
    price: 90000,
    dryTonnes: 8, cargoTonnes: 12, fuelTonnes: 30, slots: 2, crew: 1,
    note: "Light and thirsty for its size — carries little but goes far. The starter, and a lifelong runner of small high-value cargo.",
  },
  {
    id: "clipper", name: "Clipper", emoji: "⛵",
    price: 240000,
    dryTonnes: 18, cargoTonnes: 40, fuelTonnes: 60, slots: 3, crew: 2,
    note: "The honest middle: enough hold to matter, enough tank to reach Mars, enough slots to specialise.",
  },
  {
    id: "freighter", name: "Freighter", emoji: "📦",
    price: 620000,
    dryTonnes: 55, cargoTonnes: 140, fuelTonnes: 130, slots: 4, crew: 4,
    note: "A lot of hold. All that mass costs Δv to move, so it lives on cheap short hops and depot fuel — the rocket equation, felt.",
  },
  {
    id: "prospector", name: "Prospector", emoji: "⛏",
    price: 380000,
    dryTonnes: 30, cargoTonnes: 55, fuelTonnes: 90, slots: 4, crew: 3,
    note: "Built to go out and come back with something. Extra slots for mining and survey gear, a big tank for the reach.",
  },
  {
    id: "cutter", name: "Cutter", emoji: "🎯",
    price: 300000,
    dryTonnes: 22, cargoTonnes: 20, fuelTonnes: 70, slots: 4, crew: 3,
    note: "Fast, tough, and short on hold. An escort and a bounty-hunter's ship — the one that goes looking for the fight.",
  },
];

export const HULL_BY_ID = Object.fromEntries(HULLS.map((h) => [h.id, h]));

/** The ship every new captain starts in. */
export const STARTER_HULL = "courier";

// ---------------------------------------------------------------------------
// MODULES — what you fit into a hull's slots. Kept minimal for the floor; the
// point at this stage is that a slot is a real either/or, not a +5% shelf.
// ---------------------------------------------------------------------------
export const MODULES = [
  { id: "hold", name: "Cargo expansion", emoji: "📦", price: 24000, adds: { cargoTonnes: 12 },
    note: "More hold, at the cost of a slot you could have used for range or defence." },
  { id: "tank", name: "Drop tank", emoji: "⛽", price: 20000, adds: { fuelTonnes: 25 },
    note: "More fuel — more reach, or the same reach with heavier cargo." },
  { id: "miner", name: "Mining rig", emoji: "⛏", price: 60000, adds: { canMine: true },
    note: "Extract ice or ore from a body you've surveyed. The first step off the trade treadmill." },
  { id: "lab", name: "Survey lab", emoji: "🔬", price: 55000, adds: { canSurvey: true },
    note: "Prospect a site to reveal its resources — you cannot build where you have not surveyed." },
  { id: "shield", name: "Shielding", emoji: "🛡", price: 45000, adds: { defense: 2 },
    note: "Soak a hit. Turns a bad encounter from fatal into expensive." },
  { id: "laser", name: "Laser", emoji: "⚡", price: 40000, adds: { weapon: 2 },
    note: "When talking and running both fail. Also lets you be the pirate." },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));

/**
 * A hull's effective stats once its fitted modules are applied.
 * Additive `adds` stack; boolean/flag `adds` are ORed in.
 */
export function fittedStats(hullId, moduleIds = []) {
  const h = HULL_BY_ID[hullId];
  if (!h) return null;
  const stats = {
    dryTonnes: h.dryTonnes, cargoTonnes: h.cargoTonnes, fuelTonnes: h.fuelTonnes,
    slots: h.slots, crew: h.crew,
    canMine: false, canSurvey: false, defense: 0, weapon: 0,
  };
  for (const id of moduleIds) {
    const m = MODULE_BY_ID[id];
    if (!m) continue;
    // Each fitted module also adds its own dry mass, so loading up a ship makes
    // it heavier and thus more expensive to move — the trade never disappears.
    stats.dryTonnes += 1.5;
    for (const [k, v] of Object.entries(m.adds)) {
      if (typeof v === "boolean") stats[k] = stats[k] || v;
      else stats[k] = (stats[k] || 0) + v;
    }
  }
  return stats;
}
