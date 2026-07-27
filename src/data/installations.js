// ===========================================================================
// INSTALLATIONS — what is actually built on a place.
//
// The middle term of the atlas equation (docs/site-atlas.md):
//
//     place (fixed, real)  ×  INSTALLATION (drawn)  ×  operator (drawn)
//
// An installation decides what a site DOES: what it turns local resources
// into, what its people and industry must import, how many people are there,
// and its base tech level. worldgen.js draws one per occupied place, filtered
// by what the place can physically support (`requires`), and derives the
// site's whole economy from the pairing.
//
// `scale`      rough population, jittered per seed
// `baseTech`   before the operator's modifier
// `makes`      manufacturing tiers (the dependency ladder, as in sites.js)
// `produce`    what the installation adds to the place's extractables —
//              "propellant" here means "if the place has ice, it refines fuel"
// `needs`      industrial imports beyond what its people eat and breathe
// `requires`   physical preconditions checked against the place:
//              light (≥ Earth-fraction), ice / ore / shelter present,
//              habitability ceiling ("harsh" = no lethal ground)
// ===========================================================================

export const INSTALLATIONS = [
  // ---- INDUSTRY ----------------------------------------------------------
  {
    id: "extraction", name: "Extraction Camp", noun: "camp",
    scale: 40, baseTech: 2, makes: [],
    produce: [], needs: ["machinery"],
    requires: {},
    note: "Digs out whatever the rock has. Everything a person needs arrives by ship.",
  },
  {
    id: "refinery", name: "Refinery", noun: "works",
    scale: 70, baseTech: 3, makes: ["refined"],
    produce: ["propellant"], needs: ["machinery", "parts"],
    requires: { ice: true },
    note: "Where raw becomes worth moving — and where local ice becomes fuel.",
  },
  {
    id: "depot", name: "Propellant Depot", noun: "depot",
    scale: 30, baseTech: 3, makes: ["refined"],
    produce: ["propellant"], needs: ["machinery"],
    requires: { ice: true },
    note: "Fuel made at the top of a shallow well. Depots are what change the map.",
  },
  {
    id: "foundry", name: "Foundry", noun: "works",
    scale: 90, baseTech: 4, makes: ["refined", "industrial"],
    produce: ["metal", "parts"], needs: ["machinery", "electronics"],
    requires: { ore: true },
    note: "Heavy industry: beams, hulls, tanks. The first rung off Earth-dependency.",
  },
  {
    id: "massdriver", name: "Mass-Driver Terminal", noun: "terminal",
    scale: 50, baseTech: 4, makes: ["refined"],
    produce: ["metal"], needs: ["machinery", "parts", "electronics"],
    requires: { ore: true },
    note: "Throws refined cargo into space electromagnetically. Bulk export without rockets.",
  },
  {
    id: "power", name: "Power Station", noun: "array",
    scale: 25, baseTech: 4, makes: ["refined"],
    produce: [], needs: ["machinery", "electronics", "reactorparts"],
    requires: { light: 1.5 },
    note: "Energy is the input to everything. Where sunlight is fierce, industry is cheap.",
  },
  {
    id: "salvage", name: "Salvage Yard", noun: "yard",
    scale: 25, baseTech: 2, makes: [],
    produce: ["parts", "metal"], needs: ["machinery"],
    requires: {},
    note: "Buys wrecks, sells parts with a history. Half of everything here is legal.",
  },
  {
    id: "shipyard", name: "Shipyard", noun: "yards",
    scale: 120, baseTech: 5, makes: ["refined", "industrial"],
    produce: ["parts"], needs: ["metal", "electronics", "machinery"],
    requires: { ore: true },
    note: "Hulls and modules built where the metal is. Money becomes reach here.",
  },
  {
    id: "entrepot", name: "Entrepôt", noun: "station",
    scale: 300, baseTech: 6, makes: ["refined", "industrial", "advanced"],
    produce: [], needs: [],
    requires: {},
    note: "Everything is available and nothing is cheap. Trade is the industry.",
  },

  // ---- PEOPLE ------------------------------------------------------------
  {
    id: "colony", name: "Colony", noun: "settlement",
    scale: 220, baseTech: 3, makes: ["refined"],
    produce: [], needs: ["machinery", "electronics", "medical"],
    requires: { habitable: true },
    note: "The biggest market and the most dependent — people need everything, daily.",
  },
  {
    id: "agriculture", name: "Agricultural Station", noun: "farms",
    scale: 110, baseTech: 3, makes: ["refined"],
    produce: ["food"], needs: ["machinery", "medical"],
    requires: { growLight: true, ice: true },
    note: "Food grown where there is light and water — or fission standing in for the Sun. Changes what a whole region can support.",
  },
  {
    id: "sanatorium", name: "Low-G Sanatorium", noun: "sanatorium",
    scale: 60, baseTech: 4, makes: [],
    produce: [], needs: ["medical", "food", "instruments"],
    requires: { habitable: true },
    note: "Low gravity as medicine: burns, hearts, bones. Patients pay for quiet and care.",
  },
  {
    id: "prison", name: "Penal Colony", noun: "colony",
    scale: 150, baseTech: 1, makes: [],
    produce: ["ore"], needs: ["arms", "medical"],
    requires: {},
    note: "Labour that is not paid, in a place nobody escapes from. It produces cheaply, and it is grim.",
  },
  {
    id: "quarantine", name: "Quarantine Station", noun: "station",
    scale: 30, baseTech: 3, makes: [],
    produce: [], needs: ["medical", "instruments"],
    requires: {},
    note: "Deliberately apart. Nobody docks unless told to — and everything is inspected.",
  },
  {
    id: "resort", name: "Resort", noun: "resort",
    scale: 80, baseTech: 5, makes: [],
    produce: [], needs: ["food", "medical", "electronics"],
    requires: { habitable: true },
    note: "A view worth the ticket. Money arrives on passenger liners and mostly stays.",
  },

  // ---- KNOWLEDGE ---------------------------------------------------------
  {
    id: "research", name: "Research Station", noun: "station",
    scale: 35, baseTech: 5, makes: [],
    produce: [], needs: ["instruments", "electronics", "medical"],
    requires: {},
    note: "Pays well for instruments, knows things worth money, and files everything.",
  },
  {
    id: "observatory", name: "Observatory", noun: "observatory",
    scale: 20, baseTech: 5, makes: [],
    produce: [], needs: ["instruments", "electronics"],
    requires: {},
    note: "Needs dark, cold, quiet, or vacuum — and this place has it.",
  },
  {
    id: "archive", name: "Archive", noun: "archive",
    scale: 25, baseTech: 4, makes: [],
    produce: [], needs: ["electronics", "instruments"],
    requires: { shelter: true },
    note: "The system's memory, kept somewhere nothing can touch it. Buys logs, data, and quiet favours.",
  },
  {
    id: "relay", name: "Comms Relay", noun: "relay",
    scale: 12, baseTech: 5, makes: [],
    produce: [], needs: ["electronics", "reactorparts"],
    requires: {},
    note: "Fresher news for everyone in reach — a purchase against the speed of light.",
  },
  {
    id: "warning-post", name: "Early-Warning Post", noun: "post",
    scale: 10, baseTech: 5, makes: [],
    produce: [], needs: ["instruments", "electronics"],
    requires: {},
    note: "Sees the storm before anyone else's electronics do. Sells the forecast.",
  },
  {
    id: "prospecting", name: "Prospecting Camp", noun: "camp",
    scale: 10, baseTech: 1, makes: [],
    produce: [], needs: [],
    requires: {},
    note: "A claim, a scanner, and a season's supplies. It may not be here next run.",
  },

  // ---- POWER -------------------------------------------------------------
  {
    id: "naval", name: "Naval Station", noun: "station",
    scale: 130, baseTech: 4, makes: ["refined"],
    produce: [], needs: ["arms", "parts", "reactorparts"],
    requires: {},
    note: "Patrols fly from here. The region is safer for cargo and worse for smugglers.",
  },
  {
    id: "customs", name: "Customs House", noun: "house",
    scale: 40, baseTech: 4, makes: [],
    produce: [], needs: ["electronics", "instruments"],
    requires: {},
    note: "A port whose entire business is looking through yours.",
  },

  // ---- TRADE -------------------------------------------------------------
  {
    id: "freeport", name: "Free Haven", noun: "haven",
    scale: 120, baseTech: 3, makes: ["refined"],
    produce: [], needs: [],
    requires: {},
    note: "Nobody asks where a crate came from. Nobody helps you if it goes wrong, either.",
  },
  {
    id: "terminal", name: "Transfer Terminal", noun: "terminal",
    scale: 90, baseTech: 4, makes: [],
    produce: [], needs: ["electronics", "parts"],
    requires: {},
    note: "Passengers, transhipment, and fuel. A place people pass through, and some stay.",
  },

  // ---- BELIEF ------------------------------------------------------------
  {
    id: "monastery", name: "Monastery", noun: "retreat",
    scale: 30, baseTech: 2, makes: [],
    produce: [], needs: [],
    requires: {},
    note: "Hospitality as doctrine. Trades little, shelters anyone, remembers everything.",
  },
  {
    id: "hermitage", name: "Hermitage", noun: "hermitage",
    scale: 4, baseTech: 1, makes: [],
    produce: [], needs: [],
    requires: {},
    note: "Somebody chose to be this far from everyone. They will trade a little, reluctantly.",
  },
];

export const INSTALLATION_BY_ID = Object.fromEntries(INSTALLATIONS.map((i) => [i.id, i]));

/**
 * Can this installation physically exist on this place? The plausibility filter
 * from the atlas: no farms without light or fission-grade tech, no families on
 * lethal ground, no foundry without metal, no archive without shelter.
 */
export function installationFits(inst, place) {
  const r = inst.requires || {};
  if (r.habitable && place.habitability === "lethal") return false;
  if (r.ice && !place.resources.includes("ice")) return false;
  if (r.ore && !place.resources.includes("ore")) return false;
  if (r.shelter && !place.shelter) return false;
  if (r.light && (place.light ?? 0) < r.light) return false;
  // Farms need real sun OR enough tech for fission lamps — encoded as: light
  // above 1/10th Earth, or the place having ice for a buried hydroponics loop.
  if (r.growLight && (place.light ?? 0) < 0.1 && !place.shelter) return false;
  return true;
}
