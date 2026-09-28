// ===========================================================================
// THE WORDS — every piece of real astronomy the game runs on, NAMED.
//
// WHY THIS FILE EXISTS. Joshua asked whether the mechanics are ever called by
// their scientific names, with enough context to learn what they are. They were
// not. A grep of every player-facing file found "Hohmann" zero times, "Kepler"
// zero, "aerobraking" zero, "synodic" zero, "inverse-square" zero — while every
// one of them was load-bearing. The player flew Hohmann transfers for fifty
// hours and was never told the word.
//
// docs/astronomy.md's audit did not catch this, and the reason is instructive:
// its one rule is "a fact you had to USE is a mechanic; a fact you READ is a
// card", and it grades card text at zero. That rule is right about the failure
// it guards against. But it never asks whether a mechanic has a NAME — and an
// unnamed mechanic teaches a skill, not a concept. A player who learns to wait
// for the cheap moment without ever hearing "synodic period" cannot look it up,
// cannot transfer it, and will not recognise it in a textbook. The game needs
// both. It had one.
//
// THE RULE FOR EVERY ENTRY: one name, a few sentences, said ONCE, at the moment
// the concept is actually costing the player something — on the screen where
// the number it explains is sitting. Not a glossary tab, not a tutorial. The
// `Lesson` component in ui.jsx renders these; the screen decides when. A
// screen may pass its own live numbers in place of `text` (aerobraking says
// how many km/s it shed THIS trip); the name and the Codex link stay.
//
// ACCURACY (design.md §16): everything here is FACT — established physics with
// textbook figures. Every number is one the engine also holds, or a standard
// published value stated to the precision a player can use. Nothing is
// speculation, so nothing is labelled as such. Where a person is named, the
// date is the one their own paper carries.
//
// `codex` is the hash route of the sandbox that shows the thing working, from
// ROUTES in app.jsx — a test holds every entry here against that table.
// ===========================================================================

export const CONCEPTS = {
  hohmann: {
    name: "Hohmann transfer",
    text: "The cheapest path between two orbits: half an ellipse that just touches both. One burn "
      + "to leave, one to arrive, and nothing between but coasting. It is also the slowest — Earth "
      + "to Mars takes about 259 days this way. Every trip in this game flies one. Walter Hohmann "
      + "worked it out in 1925, thirty-two years before anything flew.",
    codex: "transfer",
  },
  deltaV: {
    name: "Δv (delta-v)",
    text: "The total change in speed a trip demands, in kilometres per second. It is the real "
      + "distance between two places — not how far apart they are, but how hard it is to get "
      + "from one to the other. Mercury is near and expensive; Ceres is far and cheap.",
    codex: "rocket",
  },
  aerobraking: {
    name: "Aerobraking",
    text: "Arriving somewhere with an atmosphere, you can shed speed against the air instead of "
      + "burning propellant to lose it. That is why Mars and Venus are cheaper to reach than "
      + "airless rocks that are closer.",
    codex: null,
  },
  rocketEquation: {
    name: "The rocket equation",
    text: "Propellant has to push the propellant you have not burned yet, so the fuel a trip "
      + "needs grows exponentially with its Δv, not in proportion to it. Twice the Δv is far more "
      + "than twice the fuel. It is why a heavier hold reaches fewer ports. Tsiolkovsky, 1903.",
    codex: "rocket",
  },
  specificImpulse: {
    name: "Specific impulse",
    text: "How much push a drive gets from each kilogram of propellant, quoted in seconds: the "
      + "higher, the less you burn for the same Δv. Chemical drives sit in the 300s and 400s; a "
      + "nuclear-thermal drive roughly doubles that. It is the one number a refit changes, and "
      + "the rocket equation raises it to a power.",
    codex: "rocket",
  },
  synodic: {
    name: "Synodic period",
    text: "How long until two planets return to the same arrangement — the time for the inner "
      + "one to lap the outer one. Earth laps Mars every 780 days, so the cheap moment to leave "
      + "comes round about every 26 months. That is what you are watching when Earth catches Mars "
      + "on the map.",
    codex: "transfer",
  },
  kepler: {
    name: "Kepler's third law",
    text: "The wider an orbit, the slower it is — and not in proportion: the square of the year "
      + "grows with the cube of the distance. Mars is 1.5 times further out than Earth and takes "
      + "1.9 years to go round. Every planet on this map moves by it.",
    codex: null,
  },
  inverseSquare: {
    name: "The inverse-square law",
    text: "Sunlight falls with the square of distance from the Sun: twice as far, a quarter as "
      + "bright. At Mars it is under half of Earth's; at Jupiter about 1/27th; at Saturn about "
      + "1/90th. Past the Belt, solar power stops being an option.",
    codex: null,
  },
  lightLag: {
    name: "Light-time",
    text: "Nothing travels faster than light, including a price. A message from Mars is between "
      + "3 and 22 minutes old when it arrives; from Jupiter, up to 52. Everything you know about "
      + "a distant port is at least that stale.",
    codex: null,
  },
  conjunction: {
    name: "Solar conjunction",
    text: "When the Sun sits between two planets, radio between them has to pass close to it, "
      + "and the Sun drowns the signal. Earth and Mars lose each other for about two weeks every "
      + "26 months. Real missions go quiet and wait.",
    codex: null,
  },
  axialTilt: {
    name: "Axial tilt",
    text: "A world spins on an axis that leans relative to its orbit, and the lean is what makes "
      + "seasons: the hemisphere tipped toward the Sun gets summer, and near the poles the Sun "
      + "can stay down for months. Earth leans 23.4°, Mars 25.2°, Mercury almost not at all.",
    codex: "daynight",
  },
  terminator: {
    name: "The terminator",
    text: "The line between day and night on a world, sweeping round it once per solar day. "
      + "Along it the Sun is low, shadows are long and relief shows; at noon a landscape washes "
      + "flat. It is why a base near a lunar pole can stand in sunlight beside a crater floor "
      + "that has been in shadow for about two billion years.",
    codex: "daynight",
  },
  boilOff: {
    name: "Boil-off",
    text: "Liquid hydrogen has to be kept below −253 °C, and no tank is a perfect flask: heat "
      + "leaks in and some of it boils away every day. Methane keeps at a gentler −162 °C, which "
      + "is why it is the storable choice and hydrogen is the one that needs a cryocooler.",
    codex: null,
  },
  isru: {
    name: "ISRU",
    text: "In-situ resource utilisation: making what you need where you stand instead of "
      + "shipping it across the solar system. Propellant from lunar ice, oxygen from regolith, "
      + "methane from Martian air. Every plant you build is one thing fewer that has to be "
      + "shipped — and shipping is what this whole map charges for.",
    codex: "market",
  },
};

export const CONCEPT_IDS = Object.keys(CONCEPTS);
