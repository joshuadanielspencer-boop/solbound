// ===========================================================================
// SITES — the places you can actually dock, trade and eventually build.
//
// A body is a world. A SITE is somewhere on or above it with people, a market
// and a reason to exist. Bodies are astronomy; sites are economics.
//
// WHAT EACH SITE'S ECONOMY IS DERIVED FROM, not decorated with:
//   `produces`   what local geography and industry actually yield
//   `consumes`   what the population and industry actually need
//   `makes`      the tiers it can manufacture — this is the dependency ladder
//
// A site that consumes what it cannot make is DEPENDENT, and that dependency is
// the trade route. Severing it is the campaign (docs/design.md §5). So these
// lists are not flavour: `produces` minus `consumes` IS the market, and the
// tiers in `makes` decide what must be imported forever until someone builds a
// factory.
//
// ⚠ SPECULATION, AND LABELLED AS SUCH (design.md §16). No permanent settlement
// exists anywhere but low Earth orbit. Populations, station names and industrial
// capacity here are invented for play. What is NOT invented is WHY each site
// sits where it does — every location is chosen for a real physical reason,
// recorded in `why`, and those reasons are the teaching content.
// ===========================================================================

import { OPERATORS } from "./operators.js";

// ---------------------------------------------------------------------------
// THE CORE SEVEN — the fixed spine of every run.
//
// These are canonical: hand-written, never re-rolled, present in every world
// the generator spawns (worldgen.js draws 9–13 MORE sites around them from
// data/places.js each run). They stay fixed because every save references
// them, the tutorial geography assumes them, and the tests stand on them.
// ---------------------------------------------------------------------------
export const CORE_SITES = [
  // ---- EARTH SYSTEM -----------------------------------------------------
  {
    id: "leo", name: "Gateway Station", body: "earth", system: "earth",
    kind: "orbital", population: 400, owner: "consortium", installation: "entrepot",
    techLevel: 7,
    why: "Low Earth orbit: the top of the deepest gravity well anyone routinely climbs. "
       + "Everything from Earth passes through here, which is exactly why it is expensive.",
    produces: [],
    consumes: ["food", "lifesupport", "propellant"],
    makes: ["advanced", "industrial", "refined"],   // Earth's industry, one lift away
    imports: [],
    dvFromEarth: 0,
    note: "Your home port. Everything is available and nothing is cheap.",
  },
  {
    id: "shackleton", name: "Shackleton Base", body: "luna", system: "earth",
    kind: "surface", population: 90, owner: "consortium",
    techLevel: 4,
    why: "The lunar south pole. Crater floors here have not seen sunlight in two billion years, "
       + "so water ice survives in them — while the crater RIM gets almost continuous sun for power. "
       + "Ice and sunlight within a few miles of each other is why this specific spot matters.",
    produces: ["ice", "regolith", "propellant"],
    consumes: ["food", "machinery", "electronics", "medical"],
    makes: ["refined"],
    imports: ["electronics", "machinery", "medical", "food"],
    dvFromEarth: 5.9,
    note: "Propellant made at the top of a shallow well. This is what changes the map.",
  },

  // ---- MARS SYSTEM ------------------------------------------------------
  {
    id: "phobos-depot", name: "Phobos Depot", body: "phobos", system: "mars",
    kind: "orbital", population: 25, owner: "corporate",
    techLevel: 4,
    why: "Phobos has effectively no gravity well — you land and leave for almost nothing. "
       + "That makes it the cheapest place in the Mars system to keep fuel, and possibly "
       + "the best depot in the inner solar system.",
    produces: ["ice", "propellant"],
    consumes: ["food", "lifesupport", "machinery", "electronics"],
    makes: ["refined"],
    imports: ["electronics", "machinery", "food", "medical"],
    dvFromEarth: 4.3,
    note: "Cheaper to reach than the Moon's surface, and cheaper still to leave.",
  },
  {
    id: "jezero-station", name: "Jezero Station", body: "mars", system: "mars",
    kind: "surface", population: 210, owner: "agency",
    techLevel: 5,
    why: "Beside a dried river delta, where water once pooled. Subsurface ice, clay minerals, "
       + "and an atmosphere that is 95% CO₂ — which a machine can turn into oxygen and methane. "
       + "Mars is the only place off Earth where a colony can make its own fuel from the air.",
    produces: ["volatiles", "ice", "regolith", "food"],
    // `fissiles` is DEMAND, not permission: Jezero runs on fission, the agency
    // that governs it bans unsafeguarded material, and somebody on Mars buys it
    // anyway. That contradiction is the trade route.
    consumes: ["machinery", "electronics", "reactorparts", "medical", "parts", "fissiles"],
    makes: ["refined", "industrial"],
    imports: ["electronics", "reactorparts", "medical", "instruments"],
    dvFromEarth: 4.6,
    note: "Can feed itself and fuel itself. Cannot yet build itself.",
  },

  // ---- THE BELT ---------------------------------------------------------
  {
    id: "ceres-port", name: "Ceres Port", body: "ceres", system: "belt",
    kind: "surface", population: 140, owner: "independent",
    techLevel: 3,
    why: "Ceres is roughly a quarter water by mass and its escape velocity is about 510 m/s — "
       + "you can practically walk off it. Far from the Sun, and yet cheaper to land on and "
       + "leave than our own Moon. 'Far' and 'hard' are different words, and Ceres is the proof.",
    // The free port is where the black market lives — not because Ceres makes
    // arms or enriches anything, but because nobody here asks where a crate came
    // from. Transhipment is what an unpoliced port is FOR, and it is why the
    // cheapest place to buy contraband is the place with the least government.
    produces: ["ice", "propellant", "ore", "volatiles", "arms", "fissiles"],
    consumes: ["food", "machinery", "electronics", "medical", "reactorparts"],
    makes: ["refined"],
    imports: ["electronics", "machinery", "medical", "reactorparts", "food"],
    dvFromEarth: 5.0,
    note: "The water tower of the solar system, and almost free to leave.",
  },
  {
    id: "psyche-works", name: "Psyche Works", body: "psyche", system: "belt",
    kind: "surface", population: 60, owner: "corporate",
    techLevel: 3,
    why: "An asteroid that appears to be largely exposed metal — possibly the stripped core of "
       + "a shattered protoplanet. Iron and nickel at the surface, no digging required.",
    // A metal works in a company town with light law: it makes what it can sell,
    // and nobody in the company objects to munitions.
    produces: ["ore", "metal", "regolith", "arms"],
    consumes: ["food", "lifesupport", "electronics", "medical", "propellant"],
    makes: ["refined"],
    imports: ["food", "lifesupport", "electronics", "medical"],
    dvFromEarth: 5.6,
    note: "Metal in quantity, and nothing else at all. Everything a person needs is imported.",
  },

  // ---- JUPITER SYSTEM ---------------------------------------------------
  {
    id: "callisto-station", name: "Callisto Station", body: "callisto", system: "jupiter",
    kind: "surface", population: 45, owner: "agency",
    techLevel: 2,
    why: "The only Galilean moon far enough out to sit mostly clear of Jupiter's radiation belt. "
       + "Io is bathed in a dose that would kill a person in a day; Callisto is survivable. "
       + "That single fact is why crewed-Jupiter studies keep choosing this moon and no other.",
    produces: ["ice", "propellant", "regolith"],
    // The far frontier: everything runs on reactors nobody out here can fuel, and
    // it is a long way from anyone who could enforce a rule about it.
    consumes: ["food", "lifesupport", "electronics", "reactorparts", "medical", "machinery", "arms", "fissiles"],
    makes: ["refined"],
    imports: ["food", "electronics", "reactorparts", "medical", "machinery", "instruments"],
    dvFromEarth: 7.5,
    note: "Sunlight here is 1/27th of Earth's. Everything runs on imported reactors.",
  },
];

// Legacy alias: the static seven. Game logic must use game.sites (the run's
// generated world) via siteOf() — this export exists for tests, migrations,
// and the generator itself.
export const SITES = CORE_SITES;
export const SITE_BY_ID = Object.fromEntries(CORE_SITES.map((s) => [s.id, s]));

/**
 * The run's site for an id — THE lookup every module uses now that worlds are
 * generated per seed. Sites live on the game (`game.sites`, serialised into
 * saves so a home port can never stop existing); this helper keeps that one
 * fact in one place. Falls back to the core seven so half-migrated callers
 * degrade to the old world instead of crashing.
 */
export const siteOf = (game, id) =>
  (game?.sites || CORE_SITES).find((s) => s.id === id);

/**
 * TECH LEVEL — how developed a port is, 1 (a scratched-out camp) to 7 (Earth's
 * full industrial base, one lift away). Space Trader's central "what can you get
 * here" axis. For now it is the character of a place and gates what its industry
 * can make; when the shipyard lands it will gate which HULLS and MODULES are for
 * sale, exactly as the original did (better ships only at higher-tech ports).
 */
export const TECH_LEVELS = [
  null,
  { n: 1, name: "Outpost",     note: "A foothold. Survival, and not much else." },
  { n: 2, name: "Frontier",    note: "A working settlement scraping a living from the local rock." },
  { n: 3, name: "Established",  note: "Real industry — refining, fabrication, a proper port." },
  { n: 4, name: "Developed",   note: "Makes most of what it needs, and ships the surplus." },
  { n: 5, name: "Advanced",    note: "Heavy industry and its own research." },
  { n: 6, name: "Cutting-edge", note: "Builds what others import." },
  { n: 7, name: "Core",        note: "Earth's full industrial base within reach." },
];

/**
 * GOVERNMENT — who makes the rules at a port, keyed by its owner.
 *
 * This moved to data/operators.js when ports became generated: the operator IS
 * the government (law, tariff, duty, controls, bans, paper), and the pool grew
 * from four to twenty-odd so the draw has personalities to hand out. The four
 * legacy keys are unchanged there, so every old save and the core seven read
 * exactly as before. GOVERNMENTS stays exported as an alias because half the
 * codebase and tests address it by this name, and the name is still accurate.
 *
 * LAW AND DUTY ARE THE SAME AXIS SEEN TWICE. A strict public administration
 * inspects often and charges little; a free port barely stops anyone. That's the
 * real trade-off a smuggler weighs, and it falls straight out of these numbers
 * rather than out of a difficulty setting.
 */
export { OPERATORS as GOVERNMENTS } from "./operators.js";

export const techOf = (site) => TECH_LEVELS[site?.techLevel] || TECH_LEVELS[3];
export const govOf = (site) => OPERATORS[site?.owner] || OPERATORS.independent;

/** Does this government police this commodity? (Its control class is on the
 *  commodity; which classes are policed is on the government.) */
export const controlsCommodity = (gov, commodity) =>
  !!commodity?.control && (gov?.controls || []).includes(commodity.control);

/**
 * Is this commodity BANNED here? The line between this and controlsCommodity is
 * the line between a duty and a crime — and it is the same cargo either way, so
 * the only thing that decides it is whose space you are in. That is the lesson.
 */
export const bansCommodity = (gov, commodity) =>
  !!commodity?.contraband && (gov?.bans || []).includes(commodity.contraband);

/** Is this commodity banned at this SITE (by whoever governs it)? */
export const bannedAt = (site, commodity) => bansCommodity(govOf(site), commodity);
