// ===========================================================================
// OPERATORS — who runs a place, and therefore what the law is there.
//
// The third term of the atlas equation. An operator sets everything the
// GOVERNMENTS table used to hand-write per owner: how hard the law leans
// (`law`), the cut on trade (`tariff`), which controlled classes are policed
// and at what duty, what is BANNED outright (the contraband line), the local
// paper, and the starting disposition toward a stranger with a hold.
//
// The four legacy keys (consortium, agency, corporate, independent) are still
// here, unchanged, because seven canonical sites and every existing save
// reference them. The rest are the draw pool: Space Trader shipped 17
// government types because who runs a port is half its personality, and this
// pool is ours.
//
// `techMod`     nudges the installation's base tech (a university consortium
//               raises a station's level; homesteaders lower it)
// `blackMarket` goods this operator openly sells that the geology doesn't
//               provide — the supply side of the contraband economy
// `lawful`      true = can't be drawn onto a freeport/prison-style installation;
//               false = can't be drawn onto customs/naval
// ===========================================================================

export const OPERATORS = {
  // ---- THE LEGACY FOUR (canonical sites + saves depend on these) ---------
  consortium: {
    name: "Orbital Consortium", type: "Corporate charter",
    tariff: 0.12, law: 0.7, duty: 0.06, controls: ["nuclear"], bans: ["fissiles"],
    paper: "The Orbital Ledger", disposition: 0, techMod: 0, lawful: true,
    note: "Corporate order — trade is free but taxed, and the rules are enforced.",
  },
  agency: {
    name: "Joint Agency", type: "Public administration",
    tariff: 0.05, law: 0.85, duty: 0.045, controls: ["nuclear", "pharma", "dual"], bans: ["arms", "fissiles"],
    paper: "The Agency Bulletin", disposition: 0, techMod: 0, lawful: true,
    note: "Low tariffs, strict oversight, and thorough inspections.",
  },
  corporate: {
    name: "Kestrel Industrial", type: "Company town",
    tariff: 0.15, law: 0.5, duty: 0, controls: [], bans: [],
    paper: "The Kestrel Dispatch", disposition: 0, techMod: 0, lawful: true,
    note: "High margins for the company, light law for everyone else.",
  },
  independent: {
    name: "Independent", type: "Free port",
    tariff: 0.03, law: 0.3, duty: 0, controls: [], bans: [],
    paper: "The Free Signal", disposition: 0, techMod: 0, lawful: false,
    blackMarket: ["arms", "fissiles"],
    note: "Nobody's in charge — cheap to trade, and you watch your own back.",
  },

  // ---- STATE -------------------------------------------------------------
  treaty: {
    name: "Safeguards Directorate", type: "Treaty authority",
    tariff: 0.04, law: 0.95, duty: 0.05, controls: ["nuclear", "pharma", "dual"], bans: ["arms", "fissiles"],
    paper: "The Compliance Record", disposition: -5, techMod: 0, lawful: true,
    note: "Exists to enforce the safeguards. The single worst place in the system to be caught.",
  },
  colonial: {
    name: "Colonial Administration", type: "Colonial office",
    tariff: 0.18, law: 0.75, duty: 0.05, controls: ["nuclear", "dual"], bans: ["arms"],
    paper: "The Gazette", disposition: -5, techMod: 0, lawful: true,
    note: "A homeland governing a settlement that increasingly resents it. The tariff says who profits.",
  },

  // ---- MILITARY ----------------------------------------------------------
  navy: {
    name: "Fleet Command", type: "Naval administration",
    tariff: 0.08, law: 0.9, duty: 0.04, controls: ["nuclear", "dual"], bans: ["arms", "fissiles"],
    paper: "The Signal Log", disposition: 0, techMod: 0, lawful: true,
    note: "Everything moves on schedule and every hold gets looked at. Safe, and it knows it.",
  },
  militia: {
    name: "Settlers' Militia", type: "Militia charter",
    tariff: 0.05, law: 0.45, duty: 0, controls: [], bans: ["fissiles"],
    paper: "The Watch Report", disposition: -10, techMod: -1, lawful: true,
    blackMarket: ["arms"],
    note: "Polices its own, arms its own, and has no love for outside navies.",
  },
  pmc: {
    name: "Aegis Solutions", type: "Contractor concession",
    tariff: 0.1, law: 0.35, duty: 0, controls: [], bans: [],
    paper: "The Contract Sheet", disposition: -5, techMod: 0, lawful: false,
    blackMarket: ["arms"],
    note: "Security is a product here, and so is everything security requires.",
  },

  // ---- CORPORATE ---------------------------------------------------------
  utility: {
    name: "Helios Utility Concern", type: "Utility concession",
    tariff: 0.06, law: 0.55, duty: 0.03, controls: ["nuclear"], bans: ["fissiles"],
    paper: "The Grid Bulletin", disposition: 5, techMod: 0, lawful: true,
    note: "Sells power and propellant at volume. Keeps its region's lights on, and charges for it.",
  },
  pharma: {
    name: "Asclepios Group", type: "Licensed monopoly",
    tariff: 0.12, law: 0.7, duty: 0.06, controls: ["pharma"], bans: [],
    paper: "The Formulary", disposition: 0, techMod: 1, lawful: true,
    note: "Medicine is made under licence and priced under monopoly. Bring instruments; leave rich or annoyed.",
  },
  underwriter: {
    name: "Mutual Assurance", type: "Underwriters' compact",
    tariff: 0.07, law: 0.65, duty: 0.04, controls: ["dual"], bans: [],
    paper: "The Actuarial Notice", disposition: 5, techMod: 0, lawful: true,
    note: "Runs rescue and inspection because claims are expensive. Politeness with a ledger behind it.",
  },

  // ---- CIVIL -------------------------------------------------------------
  republic: {
    name: "Settler Republic", type: "Settler republic",
    tariff: 0.06, law: 0.55, duty: 0.02, controls: ["nuclear"], bans: ["fissiles"],
    paper: "The Common Voice", disposition: 5, techMod: 0, lawful: true,
    note: "Governs itself, loudly and proudly. Fair courts, slow ones.",
  },
  cooperative: {
    name: "Workers' Cooperative", type: "Cooperative charter",
    tariff: 0.04, law: 0.5, duty: 0.02, controls: [], bans: ["arms"],
    paper: "The Rota", disposition: 10, techMod: -1, lawful: true,
    note: "Owned by the people doing the work. Honest prices, and nothing fancy.",
  },
  guild: {
    name: "The Captains' Guild", type: "Guild hall",
    tariff: 0.05, law: 0.5, duty: 0.02, controls: [], bans: [],
    paper: "The Manifest", disposition: 10, techMod: 0, lawful: true,
    note: "Run by and for the people who fly. Contracts, gossip, and a warning before trouble.",
  },
  homestead: {
    name: "The Families", type: "Homestead claim",
    tariff: 0, law: 0.2, duty: 0, controls: [], bans: [],
    paper: "The Wire", disposition: 5, techMod: -1, lawful: false,
    note: "A handful of households and no institution at all. What law there is, is manners.",
  },

  // ---- BELIEF & KNOWLEDGE ------------------------------------------------
  monastic: {
    name: "The Order of the Long Dark", type: "Monastic rule",
    tariff: 0, law: 0.6, duty: 0, controls: [], bans: ["arms", "fissiles"],
    paper: "The Lection", disposition: 10, techMod: -1, lawful: true,
    note: "Hospitality is doctrine and weapons stay at the dock. They remember every kindness, and everything else.",
  },
  university: {
    name: "University Consortium", type: "Academic charter",
    tariff: 0.05, law: 0.7, duty: 0.03, controls: ["dual"], bans: ["arms", "fissiles"],
    paper: "The Proceedings", disposition: 5, techMod: 1, lawful: true,
    note: "Where crews get better and instruments are always wanted. Publishes what it learns — eventually.",
  },
  surveyors: {
    name: "The Open Atlas", type: "Surveyors' camp",
    tariff: 0.02, law: 0.3, duty: 0, controls: [], bans: [],
    paper: "The Field Notes", disposition: 10, techMod: 0, lawful: false,
    note: "Itinerant mappers. They trade in where the ice is, where the ore is, and where it's dangerous.",
  },

  // ---- GREY --------------------------------------------------------------
  syndicate: {
    name: "The Quiet Company", type: "Syndicate ground",
    tariff: 0.08, law: 0.15, duty: 0, controls: [], bans: [],
    paper: "The Whisper", disposition: -10, techMod: 0, lawful: false,
    blackMarket: ["arms", "fissiles"],
    note: "Everything is for sale, provenance included. Prices are fair because the alternative is theirs too.",
  },
  clan: {
    name: "The Reclaimers", type: "Salvage clan",
    tariff: 0.03, law: 0.25, duty: 0, controls: [], bans: [],
    paper: "The Tally", disposition: 0, techMod: -1, lawful: false,
    blackMarket: ["arms"],
    note: "A family business in wreckage. Half of what they sell has a serial number filed off.",
  },
};

export const OPERATOR_IDS = Object.keys(OPERATORS);

/**
 * Which operators can plausibly run which installation. Lawless operators
 * don't run customs houses; navies don't run free havens; the treaty
 * directorate runs quarantine and research, not casinos.
 */
export function operatorFits(opId, inst) {
  const op = OPERATORS[opId];
  if (!op) return false;
  const lawlessOnly = ["freeport", "prison"].includes(inst.id);
  const lawfulOnly = ["customs", "naval", "quarantine", "warning-post"].includes(inst.id);
  if (lawlessOnly && op.lawful) return false;
  if (lawfulOnly && !op.lawful) return false;
  if (inst.id === "monastery" || inst.id === "hermitage") return ["monastic", "homestead", "surveyors"].includes(opId);
  if (inst.id === "university" || inst.id === "research" || inst.id === "observatory") {
    return ["university", "agency", "treaty", "consortium", "surveyors", "underwriter", "pharma"].includes(opId);
  }
  return true;
}
