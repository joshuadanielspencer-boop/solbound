// ===========================================================================
// INDUSTRY — the processes you can build, and what they actually do.
//
// This is the campaign's spine (design.md §5). Everything else in the game so
// far is Space Trader done well on real orbits: you carry what a colony cannot
// make. This is the other half — you BUILD the thing that makes it, and one more
// line of the umbilical goes slack.
//
//   > Trade is a symptom of dependency, and the win is curing it.
//
// So a plant here is not an income stream that grows. It is an income stream
// that DECAYS, on purpose: you sell into the local market, the shortage eases,
// the price falls, and what you are left with is a port that no longer needs
// importing. That decline is not a balance problem to be fixed. It is the thesis.
//
// ---------------------------------------------------------------------------
// WHAT IS FACT HERE AND WHAT IS ABSTRACTION (design.md §16, and it matters more
// in this file than in any other, because every number below is about a real
// industrial process somebody is actually trying to build).
//
// FACT — the chemistry, and the mass ratios that fall out of it:
//   • Water electrolysis splits H₂O into 11.19% hydrogen and 88.81% oxygen BY
//     MASS. That is just the atomic weights (2 × 1.008 against 15.999), and it
//     is why "water is propellant" is a statement about oxidiser far more than
//     about fuel.
//   • The Sabatier reaction, CO₂ + 4H₂ → CH₄ + 2H₂O, is how you make methane on
//     Mars out of the atmosphere. It is exothermic, it is a century old, and it
//     is the reason Mars ascent vehicles are designed around methalox.
//   • Molten regolith electrolysis yields metal AND oxygen, because lunar
//     regolith is roughly 40–45% oxygen by mass — the most abundant element in
//     the lunar surface is the one you breathe.
//   • Sunlight falls as 1/r². Every site already carries its real `light` in
//     data/places.js, so the power budget below is not a new invention: it is
//     that number finally costing something.
//
// ABSTRACTION — tuned for play, and not pretending otherwise:
//   • throughput (tonnes/day), build cost, build time, crew and power draw.
//     Nobody has built any of these off Earth. The RATIOS between processes are
//     chosen to teach the dependency ladder — extraction is cheap and fast,
//     refining is dearer, fabrication is dearest and needs the other two first.
//   • that a plant sells its whole output into the local market at the local
//     price. Real offtake is contracts and take-or-pay; this is the version that
//     fits on one screen.
//
// SPECULATION — none. Nothing here is a 22nd-century invention; every process
// is one somebody is prototyping now.
// ===========================================================================

/** The mass split of water, from the atomic weights. Not a game number. */
export const H2_FRACTION = 0.1119;
export const O2_FRACTION = 0.8881;

/**
 * `needsResource` — the place must actually have it. You cannot mine ice where
 *   there is none, and data/places.js already says where there is.
 * `inputs` / `outputs` — tonnes per day at full rate.
 * `power` — kW. See POWER below; this is what gates the outer system.
 * `minTech` — how developed the port has to be to host it.
 * `build` / `buildDays` — capital and calendar.
 * `crew` — heads, paid out of the same wage bill as a ship's crew.
 */
export const PROCESSES = [
  // ---- EXTRACTION — cheap, fast, and it must be where the resource is -----
  {
    id: "ice-mine", name: "Ice mine", kind: "extraction",
    needsResource: "ice",
    inputs: {}, outputs: { ice: 14 },
    power: 30, minTech: 2, build: 340000, buildDays: 60, crew: 3,
    why: "Water ice is propellant, air, drinking water and radiation shielding — one resource, four needs. It is also far too cheap to ship, which is exactly why it has to be dug where it is used.",
    teaches: "The keystone resource. Everything downstream of here starts as ice.",
  },
  {
    id: "regolith-scoop", name: "Regolith scoop", kind: "extraction",
    needsResource: "regolith",
    inputs: {}, outputs: { regolith: 26 },
    power: 18, minTech: 1, build: 180000, buildDays: 40, crew: 2,
    why: "Loose surface rock, scraped up by the tonne. The cheapest substance in the solar system and the feedstock for the two most useful things on it: metal and oxygen.",
    teaches: "The floor of the ladder. Worth less than the fuel to move a metre of it.",
  },
  {
    id: "ore-mine", name: "Ore mine", kind: "extraction",
    needsResource: "ore",
    inputs: {}, outputs: { ore: 11 },
    power: 45, minTech: 3, build: 520000, buildDays: 80, crew: 5,
    why: "Iron, nickel, aluminium and silicon, taken out of the ground rather than lifted out of a gravity well.",
    teaches: "Bulk industry starts here, and bulk industry is the only kind that can ever be local.",
  },
  {
    id: "volatile-still", name: "Volatile still", kind: "extraction",
    needsResource: "volatiles",
    inputs: {}, outputs: { volatiles: 9 },
    power: 55, minTech: 3, build: 610000, buildDays: 75, crew: 4,
    why: "CO₂, nitrogen, methane and ammonia, condensed out of an atmosphere or baked out of ice. Titan's air is mostly nitrogen; Mars's is almost entirely CO₂.",
    teaches: "Life support and chemistry both start with volatiles, and only some worlds have them.",
  },

  // ---- REFINING — where the real chemistry is -----------------------------
  {
    id: "electrolysis", name: "Electrolysis plant", kind: "refining",
    inputs: { ice: 12 }, outputs: { propellant: 11.4 },
    power: 220, minTech: 3, build: 780000, buildDays: 90, crew: 4,
    why: "Water, split with electricity into hydrogen and oxygen. By mass it is 11% hydrogen and 89% oxygen — which is the quiet fact behind the whole enterprise: propellant is mostly oxidiser, and oxidiser is mostly water.",
    teaches: "Why a depot changes the map. Propellant made in space is cheap; propellant lifted from Earth is absurd.",
    note: "The 5% that does not come out the other side is what the plant loses to boil-off and to running itself.",
  },
  {
    id: "sabatier", name: "Sabatier reactor", kind: "refining",
    inputs: { volatiles: 8, propellant: 1.2 }, outputs: { propellant: 6.5, lifesupport: 2 },
    power: 160, minTech: 4, build: 690000, buildDays: 85, crew: 3,
    why: "CO₂ + 4H₂ → CH₄ + 2H₂O. A hundred-year-old reaction that turns a planet's own atmosphere into methane and water, and the reason every serious Mars plan flies a methalox ascent vehicle it intends to refuel on arrival.",
    teaches: "You do not have to bring the fuel. You have to bring the hydrogen and a reactor.",
  },
  {
    id: "regolith-electrolysis", name: "Molten regolith electrolysis", kind: "refining",
    inputs: { regolith: 20 }, outputs: { metal: 3.4, lifesupport: 1.8 },
    power: 340, minTech: 4, build: 950000, buildDays: 110, crew: 5,
    why: "Melt the rock and run current through it, and it separates into metal and oxygen. Lunar regolith is 40–45% oxygen by mass — the most abundant element under a boot on the Moon is the one inside the suit.",
    teaches: "There is no ore-grade deposit needed. The dirt itself is the resource.",
  },
  {
    id: "smelter", name: "Smelter", kind: "refining",
    inputs: { ore: 9 }, outputs: { metal: 5.2 },
    power: 280, minTech: 4, build: 820000, buildDays: 95, crew: 6,
    why: "Ore in, structural alloy out. Slower and hungrier than digging, and the first step that turns a mining camp into somewhere things get made.",
    teaches: "The middle of the ladder, and the step most colonies never get to.",
  },
  {
    id: "greenhouse", name: "Greenhouse", kind: "refining",
    inputs: { ice: 4, lifesupport: 0.4 }, outputs: { food: 1.1 },
    power: 190, minTech: 3, build: 560000, buildDays: 70, crew: 4,
    needsHabitability: true,
    why: "Light, water and a sealed volume. Food is the import a colony resents most, because it arrives constantly and it is the one thing they could grow.",
    teaches: "Sunlight is a resource with a price, and past Mars it costs more than the crop.",
  },

  // ---- FABRICATION — the top of the ladder, and it needs the rest ---------
  {
    id: "fabricator", name: "Fabricator", kind: "fabrication",
    inputs: { metal: 3.5 }, outputs: { parts: 0.42 },
    power: 300, minTech: 5, build: 1400000, buildDays: 130, crew: 8,
    why: "Beams, tankage, pressure hulls. The point at which a settlement stops importing its own buildings.",
    teaches: "Everything heavy must be made where it is used, or it does not happen at all.",
  },
  {
    id: "machine-shop", name: "Machine shop", kind: "fabrication",
    inputs: { metal: 2.2, parts: 0.3 }, outputs: { machinery: 0.14 },
    power: 260, minTech: 6, build: 2100000, buildDays: 160, crew: 10,
    why: "Pumps, drills, processors, robotics — the machines that build the next plant. This is the rung where a colony stops needing you at all.",
    teaches: "The last thing to become local, and the one that ends the umbilical.",
  },

  // ---- POWER — the thing that decides whether any of it runs -------------
  {
    id: "solar-farm", name: "Solar farm", kind: "power",
    inputs: {}, outputs: {},
    // Rated at 1 AU. What it actually delivers falls as 1/r² — see POWER below,
    // and this is the whole reason the outer system gates itself.
    providesAt1AU: 400,
    power: 0, minTech: 2, build: 260000, buildDays: 45, crew: 1,
    why: "Panels, pointed at the Sun. At Earth's distance one array runs a small plant; at Jupiter the same array delivers about a twenty-seventh as much, and at Saturn about a ninetieth.",
    teaches: "The inverse-square law, priced. Past Mars, adding panels stops being an answer.",
  },
  {
    id: "fission-plant", name: "Fission plant", kind: "power",
    inputs: {}, outputs: {},
    provides: 900,
    power: 0, minTech: 5, build: 2600000, buildDays: 140, crew: 4,
    controlled: true,
    why: "A reactor does not care how far from the Sun it is, which past Mars stops being a preference and becomes the only option. It is also a controlled export everywhere that controls anything.",
    teaches: "Why the outer system is a different regime rather than a longer trip.",
  },
];

export const PROCESS_BY_ID = Object.fromEntries(PROCESSES.map((p) => [p.id, p]));

/** What a kind of process is called on screen, and the order they are offered. */
export const KINDS = [
  { id: "power", name: "Power", note: "Nothing else runs without it." },
  { id: "extraction", name: "Extraction", note: "Only where the resource actually is." },
  { id: "refining", name: "Refining", note: "Turns what is local into what is useful." },
  { id: "fabrication", name: "Fabrication", note: "The rung that ends the umbilical." },
];

/**
 * POWER, AND WHY IT IS THE INTERESTING CONSTRAINT.
 *
 * Every site in data/places.js already carries `light` — sunlight as a multiple
 * of Earth's, which is a real 1/r² number and has never cost anything. Here it
 * finally does: a solar farm delivers `providesAt1AU × light`, so the same
 * hardware that runs a plant at Luna delivers 3.7% of that at Jupiter and 1.1%
 * at Saturn. Past Mars you build a reactor or you build nothing.
 *
 * That is design.md §6's "this gates the outer system by itself", and
 * docs/astronomy.md §2b① item 1, arriving through the back door of an
 * industry screen rather than as a physics lesson.
 */
export const solarOutput = (process, light) =>
  (process.providesAt1AU || 0) * Math.max(0, light || 0);

/** Nameplate power a process supplies, at a given site's sunlight. */
export const powerSupplied = (process, light) =>
  process.provides || solarOutput(process, light);

/** How long a build takes and what it costs are both on the process. */
export const buildCost = (process) => process.build;
export const buildDays = (process) => process.buildDays;
