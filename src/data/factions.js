// ===========================================================================
// FACTIONS — the roguelike layer over a fixed solar system.
//
// Joshua's insight (2026-07-25), and it's the right one: the GEOGRAPHY stays
// real and fixed (that's the educational spine), but WHO is out there changes
// every game. At the start of a run, a handful of actors are drawn from this
// pool and seeded into the system at their possible homes. Each one bends the
// world around it — floods a market, chokes a route, offers work, poses a
// threat — so the same real Mars plays completely differently depending on who
// showed up there this time.
//
// This is what replaces roguelike map-generation without faking the map. Vary
// the actors, not the planets.
//
// Each faction is DATA, read by:
//   • markets   — `market` modifiers bend prices/stock at their home
//   • encounters — `danger` raises the odds of trouble in their region
//   • missions  — `offers` seed the kind of work they put on the board
//   • reputation — the player's standing with each, which their disposition seeds
//
// ARCHETYPES span the pressures Joshua named: economic, military, tech, cultural.
// The pool is deliberately larger than any one game uses (draw 3–5 of ~20), so
// no two runs feel the same. Expandable — add an entry and it's in the draw.
//
// `homes` are the site/region ids a faction can spawn at. A region id like
// "belt" means "any belt site"; a concrete id like "mars" pins it. The spawn
// logic resolves regions to concrete sites and avoids collisions.
// ===========================================================================

export const ARCHETYPES = {
  economic: { name: "Economic", tint: "#3E9B6E", note: "Bends what's for sale, and for how much." },
  military: { name: "Military", tint: "#C1542A", note: "Makes a region safer — or far more dangerous." },
  tech:     { name: "Technological", tint: "#7FB2CE", note: "Sells upgrades, drives, and know-how." },
  cultural: { name: "Cultural", tint: "#C0576A", note: "Moves reputation, information, and people." },
};

// Region shorthands the spawner resolves against the run's generated site
// list. Values are SYSTEM ids, not site ids — worlds are drawn per seed now,
// so "the belt" means whatever belt sites this run actually has.
export const REGIONS = {
  cislunar: ["earth"],
  mars:     ["mars"],
  belt:     ["belt"],
  jupiter:  ["jupiter"],
  outer:    ["saturn", "neptune", "pluto"],
  any:      null,   // resolved to "any populated site" at spawn
};

export const FACTIONS = [
  // ---- ECONOMIC ---------------------------------------------------------
  {
    id: "kestrel-industrial", name: "Kestrel Industrial", archetype: "economic",
    homes: ["psyche-works", "ceres-port"],
    blurb: "A metals-and-logistics giant. Where it digs in, ore and metal are cheap and plentiful — and it undercuts anyone who competes.",
    market: { produces: ["ore", "metal"], glut: ["ore", "metal", "parts"], demand: ["machinery", "reactorparts"] },
    danger: 0, disposition: "neutral",
    offers: ["haul", "supply"],
  },
  {
    id: "helios-fuels", name: "Helios Fuels", archetype: "economic",
    homes: ["shackleton", "phobos-depot", "ceres-port"],
    blurb: "Runs ice-to-propellant depots. Its home sells fuel dirt cheap — a depot that changes which routes are even affordable.",
    market: { produces: ["propellant"], glut: ["propellant", "ice"], demand: ["machinery"] },
    danger: 0, disposition: "friendly",
    offers: ["haul"],
  },
  {
    id: "hansa-combine", name: "The Hansa Combine", archetype: "economic",
    homes: ["leo", "jezero-station"],
    blurb: "A trading league that taxes what passes through its ports. Prices run high near it, but its contracts pay well.",
    market: { tariff: 0.25, demand: ["food", "lifesupport", "medical"] },
    danger: 0, disposition: "neutral",
    offers: ["haul", "courier"],
  },
  {
    id: "shortage", name: "The Long Drought", archetype: "economic",
    homes: ["mars", "jupiter", "belt"],
    blurb: "Not a faction but a crisis: a settlement whose life-support chain has failed. It will pay anything for air, water and medicine.",
    market: { crisis: ["lifesupport", "food", "medical"] },
    danger: 0, disposition: "friendly",
    offers: ["rescue", "supply"],
  },

  // ---- MILITARY ---------------------------------------------------------
  {
    id: "sol-patrol", name: "Sol Patrol", archetype: "military",
    homes: ["leo", "cislunar", "mars"],
    blurb: "The nearest thing to law out here. Its region is safe from pirates — but it inspects cargo, and it remembers a bad record.",
    market: {}, danger: -0.6, disposition: "lawful",
    offers: ["bounty", "escort"],
  },
  {
    id: "black-sun", name: "Black Sun Reavers", archetype: "military",
    homes: ["belt", "jupiter"],
    blurb: "Pirates who've claimed the approaches to their region. Cross their space with a full hold and expect company.",
    market: {}, danger: 0.8, disposition: "hostile",
    offers: [],
  },
  {
    id: "free-belt", name: "Free Belt Militia", archetype: "military",
    homes: ["belt"],
    blurb: "Belters who police their own. Friendly if you respect them, deadly if you don't — and they hate the inner-system navies.",
    market: {}, danger: 0.2, disposition: "prickly",
    offers: ["escort", "bounty"],
  },
  {
    id: "blockade", name: "The Cordon", archetype: "military",
    homes: ["mars", "jupiter"],
    blurb: "A power blockading a rival's home over some grievance. Its region is dangerous and its markets are starved — and desperate.",
    market: { crisis: ["food", "parts", "machinery"] }, danger: 0.5, disposition: "wary",
    offers: ["smuggle", "supply"],
  },

  // ---- TECHNOLOGICAL ----------------------------------------------------
  {
    id: "daedalus-yards", name: "Daedalus Yards", archetype: "tech",
    homes: ["leo", "phobos-depot"],
    blurb: "A shipyard consortium. Where it operates, better hulls, drives and modules are for sale — including things nobody else has yet.",
    market: {}, danger: 0, disposition: "neutral",
    offers: ["shipyard", "courier"],
  },
  {
    id: "prometheus-drive", name: "Prometheus Drive Works", archetype: "tech",
    homes: ["mars", "callisto-station"],
    blurb: "Reactor and propulsion research. It's chasing the next drive era, and it'll pay for rare parts and instruments to get there.",
    market: { demand: ["reactorparts", "instruments"] }, danger: 0, disposition: "neutral",
    offers: ["survey", "supply"],
  },
  {
    id: "open-atlas", name: "The Open Atlas", archetype: "tech",
    homes: ["any"],
    blurb: "Itinerant surveyors mapping the system. They trade information — where the ice is, where the ore is, where it's dangerous.",
    market: {}, danger: 0, disposition: "friendly",
    offers: ["survey", "courier"],
  },

  // ---- CULTURAL ---------------------------------------------------------
  {
    id: "first-martians", name: "The First Martians", archetype: "cultural",
    homes: ["jezero-station"],
    blurb: "A born-off-Earth settlement building an identity of its own. Wins its trust and doors open; earn its scorn and they close.",
    market: { demand: ["food", "electronics", "medical"] }, danger: 0, disposition: "proud",
    offers: ["courier", "supply"],
  },
  {
    id: "outer-covenant", name: "The Outer Covenant", archetype: "cultural",
    homes: ["jupiter", "belt"],
    blurb: "A faith of the far dark that shelters travellers and shuns the inner worlds. Sanctuary if you're kind; cold if you're not.",
    market: { demand: ["food", "lifesupport"] }, danger: -0.2, disposition: "reserved",
    offers: ["rescue", "courier"],
  },
  {
    id: "wanderers-guild", name: "The Wanderers' Guild", archetype: "cultural",
    homes: ["any"],
    blurb: "A guild of independent captains. Join their good graces for contracts, discounts, and a warning before trouble.",
    market: {}, danger: -0.1, disposition: "friendly",
    offers: ["haul", "bounty", "courier"],
  },
  {
    id: "archive", name: "The Ceres Archive", archetype: "cultural",
    homes: ["ceres-port", "callisto-station"],
    blurb: "Keepers of the system's memory. They pay in knowledge and standing for lost data, derelict logs, and quiet favours.",
    market: { demand: ["instruments", "electronics"] }, danger: 0, disposition: "reserved",
    offers: ["survey", "courier"],
  },
];

export const FACTION_BY_ID = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));

/** How the player starts standing with a faction of this disposition. */
export const DISPOSITION_START = {
  friendly: 15, lawful: 5, neutral: 0, reserved: -5, proud: -5,
  prickly: -10, wary: -10, hostile: -30,
};
