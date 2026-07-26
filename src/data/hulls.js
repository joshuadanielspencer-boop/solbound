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

// SLOTS COME IN THREE KINDS, and that is what makes a fit a set of trade-offs
// rather than a shopping list. With one undifferentiated slot count there was
// nothing stopping a player filling every bay with lasers; now a hull's CHARACTER
// is in the shape of its slots, not just their number. The cutter is the ship
// that can carry guns. The freighter is the one that can take a beating. Neither
// can become the other by shopping.
//
// `crew` is BERTHS, including yours — a hull with 1 berth flies alone forever, no
// matter what the mercenaries' guild is offering (see data/crew.js).
export const HULLS = [
  {
    id: "courier", name: "Courier", emoji: "✉️",
    minTech: 1,
    price: 90000,
    dryTonnes: 8, cargoTonnes: 12, fuelTonnes: 30, crew: 1,
    slots: { weapon: 1, shield: 0, gadget: 2 },
    note: "Light and thirsty for its size — carries little but goes far. The starter, and a lifelong runner of small high-value cargo.",
  },
  {
    id: "clipper", name: "Clipper", emoji: "⛵",
    minTech: 3,
    price: 240000,
    dryTonnes: 18, cargoTonnes: 40, fuelTonnes: 60, crew: 2,
    slots: { weapon: 1, shield: 1, gadget: 2 },
    note: "The honest middle: enough hold to matter, enough tank to reach Mars, and a berth for someone who knows something you don't.",
  },
  {
    id: "freighter", name: "Freighter", emoji: "📦",
    minTech: 5,
    price: 620000,
    dryTonnes: 55, cargoTonnes: 140, fuelTonnes: 130, crew: 4,
    slots: { weapon: 1, shield: 2, gadget: 3 },
    note: "A lot of hold. All that mass costs Δv to move, so it lives on cheap short hops and depot fuel — the rocket equation, felt. It cannot fight, but it can be hard to kill.",
  },
  {
    id: "prospector", name: "Prospector", emoji: "⛏",
    minTech: 4,
    price: 380000,
    dryTonnes: 30, cargoTonnes: 55, fuelTonnes: 90, crew: 3,
    slots: { weapon: 1, shield: 1, gadget: 3 },
    note: "Built to go out and come back with something. Gadget bays for mining and survey gear, a big tank for the reach.",
  },
  {
    id: "cutter", name: "Cutter", emoji: "🎯",
    minTech: 4,
    price: 300000,
    dryTonnes: 22, cargoTonnes: 20, fuelTonnes: 70, crew: 3,
    slots: { weapon: 3, shield: 2, gadget: 1 },
    note: "Fast, tough, and short on hold. The only hull that can mount a real battery — an escort and a bounty-hunter's ship, the one that goes looking for the fight.",
  },
];

export const HULL_BY_ID = Object.fromEntries(HULLS.map((h) => [h.id, h]));

/** What a ship fetches when traded in — you never get full price back for a used
 *  hull, which makes buying up a real commitment rather than a free swap. */
export const HULL_RESALE = 0.7;
export const MODULE_RESALE = 0.5;

/** The ship every new captain starts in. */
export const STARTER_HULL = "courier";

/**
 * THE ESCAPE POD — Space Trader's answer to death, and a better one than a
 * game-over screen.
 *
 * It is not a module and takes no slot: it is a thing you either bought or
 * didn't. Losing the ship with one aboard costs you the ship, the hold, and the
 * pod itself — you are picked up and put down at the nearest port in a hull the
 * yard gave you out of pity. Losing the ship without one ends the run.
 *
 * That turns an unlucky roll into a decision the player made hours earlier,
 * which is the difference between a hard game and an unfair one. Priced so it
 * stings early and is beneath notice later, because that is exactly when a
 * captain stops thinking about dying.
 */
export const ESCAPE_POD = {
  id: "pod", name: "Escape pod", emoji: "🛟", price: 35000,
  note: "A one-shot lifeboat. If the ship is lost you survive it — without the ship, the cargo, or the pod.",
};

// ---------------------------------------------------------------------------
// MODULES — what you fit into a hull's slots. Kept minimal for the floor; the
// point at this stage is that a slot is a real either/or, not a +5% shelf.
// ---------------------------------------------------------------------------
export const SLOT_KINDS = {
  weapon: { name: "Weapon", emoji: "⚡", note: "What you shoot back with." },
  shield: { name: "Shield", emoji: "🛡", note: "What you take a hit with." },
  gadget: { name: "Gadget", emoji: "🔩", note: "Everything else a ship can be made to do." },
};

export const MODULES = [
  { id: "hold", name: "Cargo expansion", emoji: "📦", slot: "gadget", price: 24000, adds: { cargoTonnes: 12 },
    note: "More hold, at the cost of a bay you could have used for range or gear." },
  { id: "tank", name: "Drop tank", emoji: "⛽", slot: "gadget", price: 20000, adds: { fuelTonnes: 25 },
    note: "More fuel — more reach, or the same reach with heavier cargo." },
  { id: "miner", name: "Mining rig", emoji: "⛏", slot: "gadget", price: 60000, adds: { canMine: true },
    note: "Extract ice or ore from a body you've surveyed. The first step off the trade treadmill." },
  { id: "lab", name: "Survey lab", emoji: "🔬", slot: "gadget", price: 55000, adds: { canSurvey: true },
    note: "Prospect a site to reveal its resources — you cannot build where you have not surveyed." },
  { id: "smuggler", name: "Shielded hold", emoji: "🕳", slot: "gadget", price: 85000, adds: { concealment: 2 },
    note: "A bay that does not appear on a manifest. Customs have to look harder, and sometimes they don't find it." },
  { id: "shield", name: "Shielding", emoji: "🛡", slot: "shield", price: 45000, adds: { defense: 2 },
    note: "Soak a hit. Turns a bad encounter from fatal into expensive." },
  { id: "laser", name: "Laser", emoji: "⚡", slot: "weapon", price: 40000, adds: { weapon: 2 },
    note: "When talking and running both fail. Also lets you be the pirate." },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));

/** How many bays of each kind a hull has, and how many are spoken for. */
export function slotUsage(hullId, moduleIds = []) {
  const h = HULL_BY_ID[hullId];
  const total = { weapon: 0, shield: 0, gadget: 0, ...(h?.slots || {}) };
  const used = { weapon: 0, shield: 0, gadget: 0 };
  for (const id of moduleIds) {
    const m = MODULE_BY_ID[id];
    if (m) used[m.slot] = (used[m.slot] || 0) + 1;
  }
  return {
    total, used,
    free: { weapon: total.weapon - used.weapon, shield: total.shield - used.shield, gadget: total.gadget - used.gadget },
    totalSlots: total.weapon + total.shield + total.gadget,
    usedSlots: moduleIds.length,
  };
}

/**
 * A hull's effective stats once its fitted modules are applied.
 * Additive `adds` stack; boolean/flag `adds` are ORed in.
 */
export function fittedStats(hullId, moduleIds = []) {
  const h = HULL_BY_ID[hullId];
  if (!h) return null;
  const slots = slotUsage(hullId, moduleIds);
  const stats = {
    dryTonnes: h.dryTonnes, cargoTonnes: h.cargoTonnes, fuelTonnes: h.fuelTonnes,
    slots: slots.total, slotsFree: slots.free, slotCount: slots.totalSlots,
    crew: h.crew,
    canMine: false, canSurvey: false, defense: 0, weapon: 0, concealment: 0,
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
