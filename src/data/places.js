// ===========================================================================
// PLACES — the fixed geography: every location in the real solar system worth
// a dot, from docs/site-atlas.md's census.
//
// A PLACE is not a port. It is somewhere something COULD be, with the real
// physical reason why: the ice, the sunlight, the radiation, the geometry.
// What is actually built there this run (an installation), and who runs it
// (an operator), are drawn per seed by worldgen.js. The geography never
// changes — that's the educational spine — the occupation of it does.
//
//   place.id IS the site id when occupied. Saves key player.at and markets by
//   it, so ids derive from the PLACE, never from what's built there.
//
// `resources`  what can be extracted here (commodity ids)
// `fits`       which installation types could plausibly exist here
// `habitability` open (families can live) | harsh (crews, with care)
//              | lethal (rotating crews / machines / prisoners) | none
// `light`      sunlight as a multiple of Earth's (drives farming + solar)
// `shelter`    natural radiation/thermal shielding (caves, magnetism, depth)
// `occupiable` false = an atlas entry only: a feature you learn, not a port
//
// ⚠ VERIFICATION LEDGER (project rule 2). Facts marked ✦ were checked against
// the sources listed in docs/site-atlas.md during writing. Everything else is
// standard textbook material written from general knowledge and MUST be
// verified against a primary source before shipping outside the draft notice.
// ===========================================================================

export const PLACES = [
  // ======================= EARTH & CISLUNAR ================================
  {
    id: "leo", name: "Low Earth orbit", system: "earth", body: "earth", kind: "orbital",
    core: true,   // the fixed home port; worldgen never leaves it out
    why: "The top of the deepest gravity well anyone routinely climbs. Everything from Earth passes through here, which is exactly why it is expensive.",
    resources: [], habitability: "harsh", light: 1, shelter: false,
    fits: ["entrepot", "shipyard", "terminal"],
  },
  {
    id: "geo-graveyard", name: "The Graveyard Belt", system: "earth", body: "earth", kind: "orbital",
    why: "Dead satellites are boosted a few hundred kilometres above the geostationary belt and abandoned there. Decades of retired hardware drift in a thin ring — an orbital scrapyard that nobody planned and nobody owns.",
    resources: ["parts", "metal", "electronics"],   // what salvage recovers
    habitability: "harsh", light: 1, shelter: false,
    fits: ["salvage", "relay"],
  },
  {
    id: "em-l2", name: "Farside Relay Point (Earth–Moon L2)", system: "earth", body: "luna", kind: "orbital",
    why: "The only way to talk to the lunar far side is through a relay hanging beyond the Moon — China's Queqiao has operated in a halo orbit here since 2018, the first spacecraft ever stationed on one. Whoever holds this point holds the far side's voice. ✦",
    resources: [], habitability: "harsh", light: 1, shelter: false,
    fits: ["relay", "warning-post"],
  },
  {
    id: "se-l1", name: "Sunward Watch (Sun–Earth L1)", system: "earth", body: "earth", kind: "orbital",
    why: "A gravitational balance point 1.5 million km sunward, where solar observatories actually sit. A storm leaving the Sun passes here first — whoever holds L1 sees it coming before anyone's electronics do.",
    resources: [], habitability: "harsh", light: 1, shelter: false,
    fits: ["warning-post", "observatory", "relay"],
  },
  {
    id: "shackleton", name: "Shackleton crater, lunar south pole", system: "earth", body: "luna", kind: "surface",
    core: true,
    why: "Crater floors here have not seen sunlight in two billion years, so water ice survives in them — while the crater rim gets almost continuous sun for power. Ice and sunlight within a few miles of each other is why this specific spot matters.",
    resources: ["ice", "regolith", "propellant"], habitability: "harsh", light: 1, shelter: false,
    fits: ["depot", "extraction", "colony", "observatory"],
  },
  {
    id: "luna-lavatube", name: "The Tranquillitatis lava tube", system: "earth", body: "luna", kind: "surface",
    why: "Radar confirmed an accessible cave conduit beneath the Mare Tranquillitatis pit in 2024 — tens of metres wide, over a hundred metres down. Rock overhead is free radiation shielding and a steady temperature, on a surface that swings three hundred degrees. ✦",
    resources: ["regolith"], habitability: "harsh", light: 1, shelter: true,
    fits: ["colony", "archive", "monastery"],
  },
  {
    id: "luna-farside", name: "Daedalus crater, lunar far side", system: "earth", body: "luna", kind: "surface",
    why: "Thirty-five hundred kilometres of rock between here and every transmitter humanity has ever built. The only radio-quiet ground left anywhere near Earth — and useless for anything that needs to phone home without a relay.",
    resources: ["regolith"], habitability: "harsh", light: 1, shelter: false,
    fits: ["observatory", "research", "archive"],
  },
  {
    id: "reiner-gamma", name: "Reiner Gamma", system: "earth", body: "luna", kind: "surface",
    why: "A bright, tadpole-shaped swirl lying under one of the strongest magnetic anomalies on the Moon — a natural mini-magnetosphere hundreds of kilometres across that partially deflects the solar wind. A radiation shelter with no roof, beautiful, and still not fully explained. ✦",
    resources: ["regolith"], habitability: "harsh", light: 1, shelter: true,
    fits: ["research", "monastery", "sanatorium"],
  },
  {
    id: "procellarum", name: "Mare Procellarum basalt fields", system: "earth", body: "luna", kind: "surface",
    why: "Titanium-rich mare basalt you can bake oxygen and metal out of, on a well shallow enough that a mass driver can throw cargo straight off the surface.",
    resources: ["ore", "metal", "regolith"], habitability: "harsh", light: 1, shelter: false,
    fits: ["extraction", "foundry", "massdriver"],
  },
  {
    id: "nea-anchorage", name: "The Anchorage (captured asteroid)", system: "earth", body: "earth", kind: "orbital",
    why: "Some near-Earth asteroids cost less rocket to reach than the surface of our own Moon. This one was nudged into a high lunar orbit — a mine parked next door to the market.",
    resources: ["ore", "ice", "volatiles"], habitability: "harsh", light: 1, shelter: false,
    fits: ["extraction", "refinery", "salvage"],
  },

  // ======================= MERCURY =========================================
  {
    id: "mercury-poles", name: "Mercury's polar cold traps", system: "mercury", body: "mercury", kind: "surface",
    why: "Permanently shadowed polar craters hold radar-bright deposits — almost certainly water ice — on the closest planet to the Sun, while the terrain around them gets nearly seven times Earth's sunlight. Near does not mean cheap: stopping this deep in the Sun's well is among the most expensive trips in the system.",
    resources: ["ice", "ore", "regolith"], habitability: "harsh", light: 6.7, shelter: true,
    fits: ["extraction", "depot", "power", "research"],
  },
  {
    id: "mercury-caloris", name: "Caloris solar fields", system: "mercury", body: "mercury", kind: "surface",
    why: "The best solar power on any surface in the solar system — no atmosphere, no weather, and 6.7 times Earth's light — over gravity shallow enough for a mass driver to throw refined metal into space.",
    resources: ["ore", "metal", "regolith"], habitability: "lethal", light: 6.7, shelter: false,
    fits: ["power", "foundry", "massdriver"],
  },

  // ======================= VENUS ===========================================
  {
    id: "venus-clouds", name: "The Venus cloud deck", system: "venus", body: "venus", kind: "orbital",
    why: "Fifty kilometres up, the pressure is about one atmosphere and the temperature is survivable — the most Earth-like environment off Earth — while the surface below runs hot enough to melt lead. Breathable air is a lifting gas in carbon dioxide: cities here float, and can never land.",
    resources: ["volatiles"], habitability: "harsh", light: 1.9, shelter: false,
    fits: ["colony", "research", "resort", "agriculture"],
  },
  {
    id: "venus-orbit", name: "Venus high anchorage", system: "venus", body: "venus", kind: "orbital",
    why: "Its thick atmosphere makes Venus one of the cheapest arrivals in the system — the air does your braking for free — and its frequent launch windows make it the natural junction of the inner system: a place you pass through on the way to everywhere.",
    resources: [], habitability: "harsh", light: 1.9, shelter: false,
    fits: ["terminal", "relay", "naval"],
  },

  // ======================= MARS ============================================
  {
    id: "phobos-depot", name: "Phobos", system: "mars", body: "phobos", kind: "orbital",
    core: true,
    why: "Phobos has effectively no gravity well — you land and leave for almost nothing. That makes it the cheapest place in the Mars system to keep fuel, and possibly the best depot in the inner solar system.",
    resources: ["ice", "regolith", "propellant"], habitability: "harsh", light: 0.43, shelter: false,
    fits: ["depot", "terminal", "naval"],
  },
  {
    id: "jezero-station", name: "Jezero crater", system: "mars", body: "mars", kind: "surface",
    core: true,
    why: "Beside a dried river delta, where water once pooled. Subsurface ice, clay minerals, and an atmosphere that is 95% CO₂ — which a machine can turn into oxygen and methane. Mars is the only place off Earth where a colony can make its own fuel from the air.",
    resources: ["volatiles", "ice", "regolith", "food"], habitability: "harsh", light: 0.43, shelter: false,
    fits: ["colony", "research", "agriculture"],
  },
  {
    id: "deimos", name: "Deimos", system: "mars", body: "deimos", kind: "orbital",
    why: "Smaller and higher than Phobos: cheaper still to leave, with a clear view of everything below. So small that a hard jump would put you into orbit — the watchtower of the Mars system.",
    resources: ["regolith"], habitability: "harsh", light: 0.43, shelter: false,
    fits: ["relay", "depot", "observatory", "warning-post"],
  },
  {
    id: "hellas", name: "Hellas Basin", system: "mars", body: "mars", kind: "surface",
    why: "The deepest basin on Mars, where the atmosphere is at its thickest — meaning the most radiation shielding and the gentlest landing on the planet. Where the second wave settles.",
    resources: ["volatiles", "ice", "regolith"], habitability: "harsh", light: 0.43, shelter: true,
    fits: ["colony", "terminal", "sanatorium", "agriculture"],
  },
  {
    id: "utopia-ice", name: "The Utopia ice sheet", system: "mars", body: "mars", kind: "surface",
    why: "Orbital radar found a buried sheet of water ice under these mid-latitude plains holding as much water as a Great Lake — without going to the poles to mine it.",
    resources: ["ice", "volatiles", "regolith"], habitability: "harsh", light: 0.43, shelter: false,
    fits: ["extraction", "depot", "colony"],
  },
  {
    id: "valles", name: "Valles Marineris", system: "mars", body: "mars", kind: "surface",
    why: "A canyon system as long as the continental United States: exposed rock strata, shadowed walls that may hold ice, natural shelter — and terrain that breaks every line of sight. Smuggler country on an open planet.",
    resources: ["ice", "ore", "regolith"], habitability: "harsh", light: 0.43, shelter: true,
    fits: ["extraction", "freeport", "research", "colony"],
  },
  {
    id: "arsia-caves", name: "The Arsia Mons caves", system: "mars", body: "mars", kind: "surface",
    why: "Collapsed pits on the volcano's flank open into lava tubes — shelter with rock overhead, high on the Tharsis bulge where the thin air makes launching cheap and landing hard.",
    resources: ["regolith", "ore"], habitability: "harsh", light: 0.43, shelter: true,
    fits: ["colony", "archive", "monastery", "freeport"],
  },
  {
    id: "areostationary", name: "Areostationary orbit", system: "mars", body: "mars", kind: "orbital",
    why: "Mars's version of geostationary orbit: hang over one settlement forever. The relay spine of any Martian civilisation — and a chokepoint somebody will eventually tax.",
    resources: [], habitability: "harsh", light: 0.43, shelter: false,
    fits: ["relay", "terminal", "customs"],
  },

  // ======================= THE BELT ========================================
  {
    id: "ceres-port", name: "Ceres", system: "belt", body: "ceres", kind: "surface",
    core: true,
    why: "Ceres is roughly a quarter water by mass and its escape velocity is about 510 m/s — you can practically walk off it. Far from the Sun, and yet cheaper to land on and leave than our own Moon. 'Far' and 'hard' are different words, and Ceres is the proof.",
    resources: ["ice", "propellant", "ore", "volatiles"], habitability: "harsh", light: 0.13, shelter: false,
    fits: ["entrepot", "depot", "colony", "freeport"],
  },
  {
    id: "psyche-works", name: "Psyche", system: "belt", body: "psyche", kind: "surface",
    core: true,
    why: "An asteroid that appears to be largely exposed metal — possibly the stripped core of a shattered protoplanet. Iron and nickel at the surface, no digging required.",
    resources: ["ore", "metal", "regolith"], habitability: "harsh", light: 0.12, shelter: false,
    fits: ["extraction", "foundry", "shipyard"],
  },
  {
    id: "vesta", name: "Vesta", system: "belt", body: "vesta", kind: "surface",
    why: "A differentiated protoplanet with a basaltic crust — geology like a small terrestrial planet, which nothing else in the Belt has. Where you mine the kinds of rock Earth is made of.",
    resources: ["ore", "metal", "regolith"], habitability: "harsh", light: 0.18, shelter: false,
    fits: ["extraction", "foundry", "research"],
  },
  {
    id: "pallas", name: "Pallas", system: "belt", body: "ceres", kind: "surface",
    why: "One of the largest asteroids, in an orbit tilted about 35 degrees out of the plane everything else uses. It is in the Belt and still brutally expensive to reach — inclination costs like distance. The place you go to not be followed.",
    resources: ["ice", "ore", "regolith"], habitability: "harsh", light: 0.13, shelter: false,
    fits: ["freeport", "extraction", "prison"],
  },
  {
    id: "hygiea", name: "Hygiea", system: "belt", body: "ceres", kind: "surface",
    why: "The fourth-largest object in the Belt, and carbonaceous — water and organic chemistry rather than metal. The Belt's other economy.",
    resources: ["ice", "volatiles", "ore"], habitability: "harsh", light: 0.11, shelter: false,
    fits: ["extraction", "refinery", "colony"],
  },
  {
    id: "brine-rock", name: "A carbonaceous rubble pile", system: "belt", body: "ceres", kind: "surface",
    why: "Samples returned from the asteroid Bennu held salts left by ancient brines, bio-essential sugars, and amino acids — the chemistry of life, free-floating in rocks like this one. A prospector's claim and a laboratory in the same small rubble pile. ✦",
    resources: ["ice", "volatiles"], habitability: "harsh", light: 0.12, shelter: false,
    fits: ["prospecting", "research", "extraction"],
  },

  // ======================= JUPITER =========================================
  {
    id: "callisto-station", name: "Callisto", system: "jupiter", body: "callisto", kind: "surface",
    core: true,
    why: "The only Galilean moon far enough out to sit mostly clear of Jupiter's radiation belt. Io is bathed in a dose that would kill a person in a day; Callisto is survivable. That single fact is why crewed-Jupiter studies keep choosing this moon and no other.",
    resources: ["ice", "propellant", "regolith"], habitability: "harsh", light: 0.037, shelter: false,
    fits: ["colony", "depot", "research", "terminal"],
  },
  {
    id: "ganymede", name: "Ganymede", system: "jupiter", body: "ganymede", kind: "surface",
    why: "The largest moon in the solar system, and the only one with a magnetic field of its own — shielding no other moon has, at the price of sitting deeper in Jupiter's radiation belt and deeper in its own gravity well. Callisto's rival, with the opposite trade-offs.",
    resources: ["ice", "ore", "regolith"], habitability: "harsh", light: 0.037, shelter: true,
    fits: ["colony", "shipyard", "naval", "foundry"],
  },
  {
    id: "europa", name: "Europa", system: "jupiter", body: "europa", kind: "surface",
    why: "A global ocean of salt water under the ice — more liquid water than Earth has — beneath a surface where the radiation dose is lethal in about a day. The most scientifically valuable and least habitable place at Jupiter: rotating crews, robot submarines, and strict quarantine.",
    resources: ["ice", "volatiles"], habitability: "lethal", light: 0.037, shelter: false,
    fits: ["research", "quarantine"],
  },
  {
    id: "io-forges", name: "Io", system: "jupiter", body: "io", kind: "surface",
    why: "The most volcanically active body known, coated in sulfur, deep inside radiation that would kill an unshielded person in a day. Nobody lives here. Machines work here — and, in some runs, people who were given no choice.",
    resources: ["ore", "metal", "volatiles"], habitability: "lethal", light: 0.037, shelter: false,
    fits: ["extraction", "prison"],
  },
  {
    id: "himalia", name: "Himalia anchorage", system: "jupiter", body: "callisto", kind: "orbital",
    why: "A captured moon orbiting far outside the radiation belt and far outside anyone's attention — the quiet outer anchorage of the Jupiter system, where things wait unobserved.",
    resources: ["regolith", "ice"], habitability: "harsh", light: 0.037, shelter: false,
    fits: ["freeport", "depot", "salvage"],
  },
  {
    id: "trojan-camp", name: "The Trojan swarms", system: "jupiter", body: "callisto", kind: "orbital",
    why: "Two enormous swarms of primitive bodies share Jupiter's orbit, sixty degrees ahead of and behind it — a second asteroid belt nobody patrols, five AU from the nearest law. Scientists want them because they are pristine. Others want them for the same reason.",
    resources: ["ice", "volatiles", "regolith"], habitability: "harsh", light: 0.037, shelter: false,
    fits: ["prospecting", "freeport", "extraction"],
  },

  // ======================= SATURN ==========================================
  {
    id: "titan", name: "Titan", system: "saturn", body: "titan", kind: "surface",
    why: "A thick nitrogen atmosphere half again as dense as Earth's, with lakes of liquid methane. Nitrogen is the buffer gas every life-support loop in the solar system needs, and almost nowhere else has it in bulk — Titan is the outer system's life-support well, and its air brakes your arrival for free.",
    resources: ["volatiles", "ice", "propellant"], habitability: "harsh", light: 0.011, shelter: true,
    fits: ["colony", "refinery", "agriculture", "terminal"],
  },
  {
    id: "enceladus", name: "Enceladus", system: "saturn", body: "enceladus", kind: "surface",
    why: "Geysers from a buried ocean jet water straight into space through cracks in the south polar ice, and the escape velocity is 239 m/s — you can practically fill your tanks from the plume without landing. The refuelling miracle of the outer system.",
    resources: ["ice", "propellant", "volatiles"], habitability: "harsh", light: 0.011, shelter: false,
    fits: ["depot", "research", "monastery"],
  },
  {
    id: "ring-camps", name: "The ring mines", system: "saturn", body: "mimas", kind: "orbital",
    why: "Saturn's rings are nearly pure water ice in staggering quantity, already broken into convenient pieces. Mining without the mining.",
    resources: ["ice", "propellant"], habitability: "harsh", light: 0.011, shelter: false,
    fits: ["extraction", "depot"],
  },
  {
    id: "iapetus", name: "Iapetus", system: "saturn", body: "iapetus", kind: "surface",
    why: "One hemisphere is coal-dark, the other ice-bright, and a ridge of mountains up to 13 km high runs along its equator — nobody fully knows why. Far out from Saturn and cheap to leave: the strangest waypoint in the system.",
    resources: ["ice", "regolith"], habitability: "harsh", light: 0.011, shelter: false,
    fits: ["observatory", "relay", "monastery", "depot"],
  },
  {
    id: "phoebe-gate", name: "Phoebe", system: "saturn", body: "iapetus", kind: "orbital",
    why: "Retrograde and captured — a piece of the Kuiper belt that wandered in and stayed, orbiting far outside everything else at Saturn. The system's unwatched back door.",
    resources: ["ice", "regolith", "volatiles"], habitability: "harsh", light: 0.011, shelter: false,
    fits: ["freeport", "salvage", "depot"],
  },

  // ======================= THE FAR SYSTEM ==================================
  {
    id: "triton", name: "Triton", system: "neptune", body: "triton", kind: "surface",
    why: "It orbits Neptune backwards, so it was captured, not born there — a Kuiper belt world you can visit without leaving the planets. Nitrogen geysers erupt from its surface at 38 degrees above absolute zero.",
    resources: ["volatiles", "ice"], habitability: "harsh", light: 0.001, shelter: false,
    fits: ["research", "depot", "colony"],
  },
  {
    id: "sputnik", name: "Sputnik Planitia, Pluto", system: "pluto", body: "charon", kind: "surface",
    why: "A glacier of frozen nitrogen the size of Texas, slowly churning — on a world where nitrogen ice does what water ice does on Earth. Charon hangs fixed in the sky, the two locked face to face forever. The far shore of the map.",
    resources: ["volatiles", "ice"], habitability: "harsh", light: 0.0006, shelter: false,
    fits: ["research", "relay", "hermitage"],
  },

  // ======================= ATLAS-ONLY FEATURES =============================
  // Real, teachable, and not ports: things a player learns, not places they
  // dock. They appear in the in-game atlas and in survey results.
  {
    id: "tranquility", name: "Tranquility Base", system: "earth", body: "luna", kind: "surface",
    occupiable: false,
    why: "Apollo 11's landing site, protected by actual law — the One Small Step Act of 2020 requires missions to leave it undisturbed. The first legally recognised heritage site off Earth: a place you may visit, and must not touch. ✦",
  },
  {
    id: "shoemaker-rest", name: "The Shoemaker Grave", system: "earth", body: "luna", kind: "surface",
    occupiable: false,
    why: "The ashes of the geologist Eugene Shoemaker rode the Lunar Prospector spacecraft into the Moon's south polar region in 1999 — the only human burial on another world.",
  },
  {
    id: "van-allen", name: "The Van Allen belts", system: "earth", body: "earth", kind: "orbital",
    occupiable: false,
    why: "Two doughnuts of trapped radiation around Earth, discovered by the very first US satellite. Crews route around or hurry through them — near-Earth space has terrain, and this is it.",
  },
  {
    id: "se-l3", name: "The Far Point (Sun–Earth L3)", system: "earth", body: "earth", kind: "orbital",
    occupiable: false,
    why: "A balance point on the far side of the Sun — permanently hidden from Earth. Nothing legitimate needs to be somewhere nobody can watch or call. That is precisely its appeal.",
  },
  {
    id: "kirkwood", name: "The Kirkwood gaps", system: "belt", body: "ceres", kind: "orbital",
    occupiable: false,
    why: "Lanes swept almost clean through the asteroid belt by Jupiter's gravity — anything orbiting there gets pulled out of step and thrown elsewhere. The Belt has shipping lanes and shoals, and they are gravitational.",
  },
  {
    id: "aldrin-cycler", name: "The Aldrin Cycler", system: "mars", body: "mars", kind: "orbital",
    occupiable: false,
    why: "A proposed habitat on a permanent orbit that swings past Earth and Mars forever — 146 days per crossing, repeating every 2.14 years, needing almost no fuel once established. A port that is always moving: you don't fly to it, you catch it. ✦",
  },
  {
    id: "maxwell", name: "Maxwell Montes, Venus", system: "venus", body: "venus", kind: "surface",
    occupiable: false,
    why: "The highest mountains on Venus, under ninety atmospheres of pressure at 460 °C — hot enough to melt lead. Machines sent to the surface last hours. Whatever works down there is run from the clouds.",
  },
  {
    id: "conjunction-note", name: "Solar conjunction", system: "sun", body: null, kind: "orbital",
    occupiable: false,
    why: "Every 26 months the Sun stands between Earth and Mars, and even NASA stops sending commands for about two weeks — radio through the solar corona genuinely corrupts. Every far planet has its season of silence. ✦",
  },
  {
    id: "arrokoth", name: "Arrokoth", system: "kuiper", body: null, kind: "surface",
    occupiable: false,
    why: "Two soft lobes gently joined, orbiting undisturbed since the solar system formed — the most primitive object ever visited. Out here the map stops being a map and becomes a frontier.",
  },
];

export const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));
export const OCCUPIABLE = PLACES.filter((p) => p.occupiable !== false);
export const CORE_PLACES = PLACES.filter((p) => p.core);
export const FEATURES = PLACES.filter((p) => p.occupiable === false);
