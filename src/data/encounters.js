// ===========================================================================
// ENCOUNTERS — what happens between worlds.
//
// This is the table Joshua asked to start. It answers "what fills the months in
// transit" and it's where the risk layer lives — travel stops being dead time.
//
// HOW IT FITS THE MERGED GAME (design.md, the fleet+trade merge): while your
// ship flies the real transfer arc on the live orrery, the clock rolls a check
// each leg against the region's danger (factions.regionDanger — a pirate-held
// approach is dangerous, a patrolled one safe). On a hit, the sim PAUSES — just
// as an arrival pauses it — and presents the encounter. That reuses the fleet's
// stop-for-a-decision rhythm the player already liked.
//
// EVERY ENCOUNTER IS A CHOICE WITH CONSEQUENCES THAT OUTLIVE IT, resolved by a
// PURE FUNCTION so auto-resolve now and a tactical mini-game later share one
// contract (design.md §10). What goes in: the captain's skills, the ship's
// fit, the cargo, who you're dealing with, your standing with them. What comes
// out: not win/lose but — cargo lost or gained, fuel/time spent, hull damage,
// reputation moved, a record earned. The table below is DATA; the resolver
// (encounters.js, next) turns a rolled encounter + the player's choice into
// that outcome.
//
// `weightsByArchetype` biases WHICH encounter a region tends to throw based on
// who controls it: pirate space favours raiders, lawful space favours
// inspections, a trade league favours opportunities. So the roguelike faction
// draw shapes the texture of travel, not just the prices.
// ===========================================================================

// The choices a player can be offered. Not every encounter offers all of them;
// each encounter lists which apply. The resolver reads `skill` to know which
// captain skill tilts the odds.
export const ACTIONS = {
  fight:    { id: "fight",    label: "Fight",     skill: "fighter", note: "Trade shots. Your weapons, shields and Fighter skill decide it." },
  flee:     { id: "flee",     label: "Run",       skill: "pilot",   note: "Burn away. Your Pilot skill and a lighter hold help you escape." },
  submit:   { id: "submit",   label: "Submit",    skill: null,      note: "Hand over what they want and hope that ends it." },
  bribe:    { id: "bribe",    label: "Pay them",  skill: "trader",  note: "Buy your way clear. Your Trader skill sets the price." },
  comply:   { id: "comply",   label: "Comply",    skill: null,      note: "Open the hold for inspection. Clean cargo, no problem." },
  talk:     { id: "talk",     label: "Talk",      skill: "trader",  note: "Negotiate. Standing and a silver tongue can turn this around." },
  help:     { id: "help",     label: "Help",      skill: "engineer",note: "Lend aid or make repairs. Costs time; earns goodwill." },
  ignore:   { id: "ignore",   label: "Ignore",    skill: null,      note: "Fly on and mind your own business." },
  trade:    { id: "trade",    label: "Deal",      skill: "trader",  note: "Do business on the spot, away from any market." },
  salvage:  { id: "salvage",  label: "Salvage",   skill: "engineer",note: "Board and strip it. Slow, and not always safe." },
};

export const ENCOUNTERS = [
  // ---- HOSTILE ----------------------------------------------------------
  {
    id: "pirate", kind: "hostile", weight: 1,
    title: "Raiders on an intercept",
    text: "A ship with no transponder matches your course and opens a channel: leave the hold, or be taken with it.",
    actions: ["fight", "flee", "bribe", "submit"],
    // Consequences are the resolver's job; these are the levers it reads.
    stakes: { cargoAtRisk: 0.6, hullAtRisk: 0.5, standingFaction: "aggressor" },
  },
  {
    id: "ambush", kind: "hostile", weight: 0.5, minDanger: 0.5,
    title: "A trap at the chokepoint",
    text: "Two ships were waiting where the geometry forces everyone through. This was planned.",
    actions: ["fight", "flee", "bribe"],
    stakes: { cargoAtRisk: 0.9, hullAtRisk: 0.8, standingFaction: "aggressor" },
  },
  {
    id: "extortion", kind: "hostile", weight: 0.6,
    title: "A 'toll' for safe passage",
    text: "A local militia says this is their space, and their protection isn't free. Refuse and you're fair game.",
    actions: ["bribe", "fight", "flee", "talk"],
    stakes: { creditsAtRisk: 0.15, standingFaction: "controller" },
  },

  // ---- AUTHORITY --------------------------------------------------------
  {
    id: "inspection", kind: "authority", weight: 1,
    title: "Customs wants a look",
    text: "A patrol signals you to hold for inspection. If your hold is clean, this is a formality. If it isn't…",
    actions: ["comply", "flee", "bribe"],
    stakes: { contrabandCheck: true, standingFaction: "controller", recordRisk: true },
  },
  {
    id: "conscript", kind: "authority", weight: 0.4,
    title: "Pressed for aid",
    text: "A navy short of hulls asks you to carry priority cargo on your route. Saying no is remembered.",
    actions: ["help", "talk", "ignore"],
    stakes: { standingFaction: "controller", timeCost: 0.1 },
  },

  // ---- OPPORTUNITY ------------------------------------------------------
  {
    id: "trader", kind: "opportunity", weight: 1,
    title: "A trader hails you",
    text: "An independent hauler has cargo to move and no patience for a port. The price is off-book, for better or worse.",
    actions: ["trade", "ignore"],
    stakes: { dealQuality: "variable" },
  },
  {
    id: "distress", kind: "opportunity", weight: 0.8,
    title: "A distress call",
    text: "A ship is venting air and losing power. They can't pay much — but the people who help are remembered, and so are the ones who don't.",
    actions: ["help", "ignore"],
    stakes: { standingFaction: "nearest", timeCost: 0.15, karma: true },
  },
  {
    id: "derelict", kind: "opportunity", weight: 0.5,
    title: "A derelict, drifting",
    text: "An old wreck tumbles on your path, hold maybe intact. Salvage is legal out here — and sometimes wrecks aren't as empty as they look.",
    actions: ["salvage", "ignore"],
    stakes: { salvage: true, hullAtRisk: 0.2 },
  },
  {
    id: "windfall", kind: "opportunity", weight: 0.3,
    title: "An abandoned cache",
    text: "Someone stashed cargo on a transfer orbit and never came back for it. Finders keepers, if your hold has room.",
    actions: ["salvage", "ignore"],
    stakes: { salvage: true },
  },

  // ---- QUIET ------------------------------------------------------------
  {
    id: "quiet", kind: "quiet", weight: 2,
    title: "Empty sky",
    text: "Months of nothing but the sun getting smaller behind you. The ship hums. You catch up on the logs.",
    actions: ["ignore"],
    stakes: {},
  },
];

export const ENCOUNTER_BY_ID = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, e]));

// Which kinds of encounter a region favours, by the archetype of whoever holds
// it. A pirate coast throws raiders; a patrolled lane throws inspections; a
// trade league throws deals. Numbers are relative weights layered on each
// encounter's base weight.
// ---------------------------------------------------------------------------
// THE POLICE RECORD — a consequence that outlives the encounter.
//
// Earned by RUNNING from a patrol or by a bribe that goes wrong, never by what's
// in the hold (see CONTROLS in commodities.js — controlled cargo is legal cargo
// that owes a duty). A record is sticky: it raises how often you're stopped and
// how badly a stop goes, so an evasion you got away with today is a tax on every
// crossing after it.
// ---------------------------------------------------------------------------
export const RECORDS = [
  { id: "clean",  name: "Clean",     note: "No patrol has any reason to look twice at you." },
  { id: "noted",  name: "Noted",     note: "A patrol logged you once. It follows you around." },
  { id: "marked", name: "Marked",    note: "Customs pull you aside on principle now." },
  { id: "wanted", name: "Wanted",    note: "Lawful ports want a word. Expect to be stopped, and searched." },
];

export const RECORD_BY_ID = Object.fromEntries(RECORDS.map((r) => [r.id, r]));
export const recordIndex = (id) => Math.max(0, RECORDS.findIndex((r) => r.id === id));

/** One step worse, stopping at the bottom of the ladder. */
export const worsenRecord = (id, steps = 1) =>
  RECORDS[Math.min(RECORDS.length - 1, recordIndex(id) + steps)].id;

/**
 * WHAT'S IN A WRECK. Salvage is weighted toward the dull and heavy, because
 * that's what a wreck actually is — a ship, and ships are mostly structure. The
 * jackpot (a crate of instruments) is deliberately rare, so "board the derelict"
 * stays a gamble rather than a payday you'd plan a route around.
 */
export const SALVAGE_FINDS = [
  { id: "parts",       weight: 3,   min: 1.5, max: 7,   text: "Hull plate and tankage, cut free and stacked." },
  { id: "metal",       weight: 2.5, min: 1,   max: 6,   text: "Structural alloy, still good." },
  { id: "propellant",  weight: 2,   min: 1,   max: 5,   text: "A part-full tank you can decant." },
  { id: "lifesupport", weight: 1.5, min: 0.5, max: 3,   text: "Scrubber cartridges, sealed and unused." },
  { id: "electronics", weight: 1,   min: 0.3, max: 2,   text: "Avionics crates nobody got back for." },
  { id: "instruments", weight: 0.3, min: 0.1, max: 0.8, text: "A survey package worth more than the wreck around it." },
];

export const KIND_BIAS_BY_ARCHETYPE = {
  military_hostile: { hostile: 3, authority: 0.3, opportunity: 0.5, quiet: 0.5 },
  military_lawful:  { hostile: 0.3, authority: 3, opportunity: 0.7, quiet: 1 },
  economic:         { hostile: 0.6, authority: 0.7, opportunity: 2.5, quiet: 1 },
  tech:             { hostile: 0.5, authority: 0.6, opportunity: 1.5, quiet: 1.5 },
  cultural:         { hostile: 0.4, authority: 0.5, opportunity: 1.6, quiet: 1.8 },
  none:             { hostile: 1, authority: 0.6, opportunity: 1, quiet: 2 },   // lawless empty space
};
