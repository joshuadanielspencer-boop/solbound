# THE SITE ATLAS — a census of the real solar system, and what to build on it

**This is a content spec, not shipped content.** Two questions drove it, both
Joshua's: *how many distinct places can the real solar system actually support?*
and *what did Space Trader do, and was it enough?* Both are answered below with
data, then the full census.

The design goal, stated once so nothing below drifts from it:

> **A player should learn the real solar system passively, by playing.** Every
> place is real. Every advantage and disadvantage comes from what is actually
> there — the ice, the radiation, the gravity, the light-lag, the geometry.
> Nothing is invented except the people.

---

# PART 0 — THE SPACE TRADER BENCHMARK (researched, from the original source)

The original game's constants file gives exact numbers:

| Constant | Value | Meaning |
|---|---|---|
| Solar systems | **120** | on a 150 × 110 parsec map |
| Min spacing / guaranteed neighbour | 6 / **13** pc | every system has at least one neighbour within 13 pc |
| Fuel range | **14 pc** (starter Gnat) → **20 pc** (best tank) | per jump, refuel at each stop |
| Wormholes | 6 | fast-travel spice between distant pairs |
| Tech levels | 8 | Pre-agricultural → Hi-tech |
| Governments | **17** | Anarchy, Feudal, Theocracy, Corporate, Military, Technocracy… |
| Special resources | 13 | Mineral rich, Lots of water, Desert, Weird mushrooms… |
| System status events | 8 | war, plague, drought, boredom, cold, crop failure, lacking workers |
| Trade goods | 10 | two of them illegal (firearms, narcotics) |
| Ship types | 10 | |

**The number that actually matters is not 120.** Do the density arithmetic:
120 systems over 150 × 110 pc is one system per ~140 pc². A starter ship's
14-pc range disc covers ~615 pc², a max-tank 20-pc disc ~1,260 pc². So the
player's *per-decision menu* was only about **4–9 reachable systems at any
moment**. The other 110+ systems exist to give the map texture — regions with
different character, places you've heard of and never been, room for the
newspaper to report things far away, and a reason the galactic chart feels big.

**So: was our 10–14 plan adequate?** As a per-decision menu, our current 7 sites
already matches Space Trader's effective breadth. What we lack is the **world**
— 120 named places versus 7 — and that's what starves the faction draw,
contraband geography, crew variety, and news. The lesson is also structural:
they *engineered* reachability (no system is ever stranded; a neighbour is
guaranteed within 13 pc). Our equivalent is guaranteeing the cislunar cluster is
always populated and always reachable by a starter Courier, whatever the draw.

**Recommendation, with the benchmark in hand:**
- **Catalog ~60 real places** (the census below finds 62 worth naming).
- **Occupy 16–24 per run** from the draw — more than my earlier 10–14, because
  with real orbits the *reachable-right-now* set shrinks and swells with windows
  and drive tier; a bigger occupied set keeps the per-decision menu near Space
  Trader's 4–9 at every stage of the game.
- **The unoccupied places still exist** — as survey targets, mission
  destinations, and next run's ports. That is what 120-for-a-menu-of-8 was for.

Sources: [original constants header (MAXSOLARSYSTEM 120, GALAXYWIDTH 150, MAXWORMHOLE 6, MAXRANGE 20)](https://github.com/deadjim/dark-nova-android/blob/master/iPhone-Code/Not%20Used/spacetrader.h) · [Wikipedia](https://en.wikipedia.org/wiki/Space_Trader_(Palm_OS)) · [spronck.net](https://www.spronck.net/spacetrader/SpaceTrader.html)

---

# PART 1 — THE CENSUS: every place in the real solar system worth a dot

Answering "is it 20 or 100": **it's about sixty.** Below are 62 entries, each a
genuinely distinct place with a real physical hook. Beyond these you're either
subdividing (a second crater on Mars) or naming rocks with no distinguishing
character (the ten-thousandth S-type asteroid). The solar system's supply of
*personality* is finite, and this is roughly all of it at current knowledge.

Legend: ✦ = fact verified against a source during writing (cited at bottom).
Everything unmarked is written from general knowledge and **must be
source-verified before it ships** (project rule 2).

## The Sun's neighbourhood (3)

| # | Place | The real hook |
|---|---|---|
| 1 | **Sub-Mercurian solar swarm (~0.3 AU)** | Sunlight at 0.3 AU is ~11× Earth's. The best power in the system, and nothing alive needs to be there. A place robots work and people only visit. |
| 2 | **Sun–Earth L1 (1.5M km sunward)** | Where SOHO, ACE and DSCOVR actually sit — the solar-storm early-warning post. Whoever holds it sees a coronal mass ejection *before* everyone else's electronics do. Information as a product, literally. |
| 3 | **Sun–Earth L3 (behind the Sun)** | Permanently occluded from Earth — the one place in the inner system nobody can watch or call. Nothing legitimate needs to be there. That is the point. |

## Earth orbit and cislunar space (6)

| # | Place | The real hook |
|---|---|---|
| 4 | **Low Earth orbit** | The top of the deepest gravity well anyone routinely climbs. Everything from Earth passes through; nothing is cheap. |
| 5 | **Geostationary belt** | The only altitude where you hover over one spot on Earth. Finite, crowded, contested — orbital real estate with an address. Dead satellites get boosted to a "graveyard orbit" 300 km higher: a salvage field already exists there. |
| 6 | **The Van Allen belts** | Not a place to stop — a hazard to route around. Trapped radiation that made even Apollo plan its trajectory. Teaches that near-Earth space has *weather and terrain*. |
| 7 | **Earth–Moon L1** | The saddle point between Earth and Moon — the natural staging post for everything cislunar. |
| 8 | **Earth–Moon L2 (behind the Moon)** ✦ | The only way to talk to the lunar far side. China's Queqiao relay has operated in a halo orbit here since 2018 — the first spacecraft ever stationed on one. A comm node that is a *monopoly* by geometry. |
| 9 | **Sun–Earth L2 (1.5M km anti-sunward)** | Where JWST sits: permanent shadow cold, full-sky view, easy comms. The observatory address of the inner system. |

## Luna (9)

| # | Place | The real hook |
|---|---|---|
| 10 | **Shackleton crater rim, south pole** | Crater floors unlit for ~2 billion years hold water ice; nearby rim ridges get near-continuous sunlight ("peaks of eternal light"). Ice and power within a few km of each other — the reason every current lunar program aims here. |
| 11 | **Peary crater, north pole** | The south pole's quieter twin — polar volatiles and long illumination without the crowds or the politics. A second polar claim for a second faction. |
| 12 | **Mare Tranquillitatis lava-tube conduit** ✦ | Radar confirmed an accessible cave conduit under the Tranquillitatis pit in 2024 — tens of metres wide, 130–170 m down. Rock overhead is free radiation shielding and thermal stability. A vault, an archive, a buried town. |
| 13 | **Tranquility Base** ✦ | Apollo 11's landing site — protected by actual US law (the One Small Step to Protect Human Heritage in Space Act, 2020). The first legally recognised heritage site off Earth. A place you may visit and must not touch: a pilgrimage destination, and a diplomatic incident waiting for whoever ignores it. |
| 14 | **Reiner Gamma, Oceanus Procellarum** ✦ | A bright tadpole-shaped swirl co-located with one of the strongest magnetic anomalies on the Moon — a *mini-magnetosphere* spanning ~360 km that partially deflects the solar wind. A natural radiation shelter on an airless world, beautiful and still not fully explained. If anywhere off Earth becomes "sacred ground," it's this. |
| 15 | **Lunar far side (Daedalus crater)** | 3,500 km of rock between you and every transmitter humanity has. The only radio-quiet zone left anywhere near Earth — *the* observatory site, and useless for anything that needs to phone home (see #8). |
| 16 | **Mare Procellarum titanium basalts** | Ilmenite-rich mare basalt: titanium, iron, and oxygen you can bake out of the rock. Bulk industry's lunar address, and a shallow enough well for a mass driver. |
| 17 | **South Pole–Aitken basin (far side)** | The oldest, deepest impact basin on the Moon — mantle material excavated and lying on the surface. Where you dig to learn what the Moon is made of. |
| 18 | **Lunar south-pole memorials** | Eugene Shoemaker's ashes were deliberately impacted near the south pole aboard Lunar Prospector (1999) — the only human burial on another world. Quiet, real, and exactly the kind of fact a child remembers forever. |

## Interplanetary infrastructure (3)

| # | Place | The real hook |
|---|---|---|
| 19 | **An Aldrin cycler** ✦ | A habitat on a permanent Earth–Mars cycling orbit: 146 days per crossing, repeating every 2.135 years, needing almost no propellant ever again. **A port that is always moving** — you don't fly to it, you catch it. Miss the rendezvous and it's gone for two years. |
| 20 | **A captured near-Earth asteroid, parked cislunar** | Some NEAs cost less delta-v to reach than the lunar surface. Whoever drags one home owns a mine next door to the market. (The samples say what's in them — see #34.) |
| 21 | **Sun–Earth L4/L5** | Sixty degrees ahead of and behind Earth — stable, permanent, with a sightline around the Sun that Earth never has. The solution to the conjunction blackout (see PART 2), which makes a relay here a product. |

## Venus (3)

| # | Place | The real hook |
|---|---|---|
| 22 | **The cloud deck, ~50 km up** | At that altitude, pressure is ~1 atm and temperature is survivable — the most Earth-like environment off Earth — while the surface below runs hot enough to melt lead. Breathable air is a *lifting gas* in CO₂. Cities that float, and can never land. |
| 23 | **Venus orbit** | Aerobraking makes Venus one of the cheapest arrivals in the system, and its short synodic period makes it a frequent window. The natural inner-system junction — a place you pass through on the way to everywhere. |
| 24 | **Maxwell Montes / the surface** | 460 °C and 90 atmospheres. Machines last hours. Whatever works down there is remotely operated from the clouds — a place with jobs and no residents. |

## Mercury (2)

| # | Place | The real hook |
|---|---|---|
| 25 | **Polar cold traps** | Permanently shadowed polar craters hold radar-bright deposits — almost certainly water ice — on the closest planet to the Sun. Ice and 6.7× Earth sunlight within kilometres. The "near ≠ cheap" lesson: MESSENGER needed six flybys over 6.6 years just to stop here. |
| 26 | **Caloris / equatorial solar fields** | The best solar power on any surface in the system, no atmosphere in the way, and gravity shallow enough for a mass driver. A foundry that runs on sunlight and throws its product into space. |

## Mars system (10)

| # | Place | The real hook |
|---|---|---|
| 27 | **Phobos (Stickney crater)** | Effectively no gravity well — land and leave for almost nothing. The best fuel depot in the inner system, and the natural quarantine/staging stop above Mars. |
| 28 | **Deimos** | Higher and smaller: even cheaper to leave, better sightlines, out of the way. The relay-and-watchtower moon. |
| 29 | **Jezero crater** | A dried river delta; subsurface ice, clays, and a 95% CO₂ atmosphere machines can turn into oxygen and methane. The only place off Earth where a colony can fuel itself from the air. |
| 30 | **Hellas Planitia** | The deepest basin on Mars — the thickest air on the planet, meaning the most radiation shielding and the best parachute landing. Where the *second* wave settles. |
| 31 | **Utopia Planitia buried ice** | Orbital radar found a buried ice sheet holding on the order of a Great-Lake's worth of water under mid-latitude plains. Water without going polar. |
| 32 | **Planum Boreum, the north polar cap** | Kilometres-thick water ice, exposed, in quantity. The industrial water source — and six months of polar night to survive while mining it. |
| 33 | **Valles Marineris** | A canyon system as long as the continental US: exposed strata, shadowed walls that may hold ice, natural shelter, and terrain that breaks line-of-sight — smuggler country on an open planet. |
| 34 | **Arsia Mons cave skylights, Tharsis** | Collapsed pits on the volcano's flank open into lava tubes — shelter with kilometres of rock overhead, high on the launch-friendly Tharsis bulge. |
| 35 | **Cerberus Fossae** | Where InSight localised present-day marsquakes — the most seismically alive ground on Mars, suggesting deep activity and possibly deep heat. A research claim with an energy rumour attached. |
| 36 | **Areostationary orbit** | Mars's GEO: hang over one settlement forever. The relay spine of any Martian civilisation, and a chokepoint someone will eventually tax. |

## The Belt (8)

| # | Place | The real hook |
|---|---|---|
| 37 | **Ceres (Occator's bright faculae)** | A quarter water by mass, escape velocity ~510 m/s, and bright salt deposits at Occator left by brines rising from a relict subsurface ocean. The water tower of the system — far away, and almost free to leave. |
| 38 | **Vesta** | A differentiated protoplanet with a basaltic crust — geology like a small terrestrial planet, unlike anything else in the Belt. |
| 39 | **Psyche** | Appears to be largely exposed metal — possibly a stripped protoplanet core. Iron and nickel at the surface, no digging. |
| 40 | **Pallas** | Big, and in an orbit inclined ~35° — *in* the Belt yet brutally expensive to reach. Teaches that inclination costs like distance. The place you go to not be followed. |
| 41 | **Hygiea** | Fourth-largest, carbonaceous — water and organics rather than metal. The Belt's *other* economy. |
| 42 | **A Bennu-type C-rubble pile** ✦ | Returned samples (2023–25) held sodium-rich salts from ancient brines, bio-essential sugars including ribose, all five DNA/RNA nucleobases and 14 of the 20 protein amino acids. The chemistry of life, free-floating. A prospecting and research bonanza in one small rock. |
| 43 | **The Kirkwood gaps** | Not a place — an absence. Jupiter's resonances have swept these orbital lanes almost clean, and anything drifting into one gets perturbed out. The Belt has *shipping lanes and shoals*, and they're gravitational. |
| 44 | **The Hungaria group (inner Belt fringe)** | The closest asteroid family to Mars — the first rocks a Belt-bound prospector reaches, and the natural "shallow end" of asteroid mining. |

## Jupiter system (6)

| # | Place | The real hook |
|---|---|---|
| 45 | **Callisto** | The only Galilean moon sitting mostly outside the radiation belt — Io's surface dose kills in a day; Callisto's is survivable. Why every crewed-Jupiter study picks it. |
| 46 | **Ganymede** | Largest moon in the system, and the only one with its own magnetic field — shielding no other moon has, at the price of sitting deeper in Jupiter's belts and its own gravity. Callisto's rival, with opposite trade-offs. |
| 47 | **Europa** | A global ocean under the ice, and a surface dose lethal in about a day. The most scientifically valuable and least habitable place at Jupiter — rotating crews, robot submarines, and quarantine rules. |
| 48 | **Io** | The most volcanically active body known, drenched in radiation, coated in sulfur. Nobody lives here. Machines, or people who had no choice, work here. |
| 49 | **Himalia (outer irregulars)** | A captured moon far outside the radiation belt — the quiet anchorage of the Jupiter system, where things wait unobserved. |
| 50 | **The Jupiter Trojans (L4 "Greeks" / L5 "Trojans")** | Two swarms of primitive bodies sharing Jupiter's orbit — a second asteroid belt nobody patrols, five AU from the nearest law. NASA's Lucy is en route because they're pristine; smugglers would go for the same reason. |

## Saturn system (6)

| # | Place | The real hook |
|---|---|---|
| 51 | **Titan** | A 1.45-bar atmosphere, ~95% nitrogen, with methane lakes. The only place beyond Earth you could walk unpressurised (suited for cold and air, not vacuum). Nitrogen is the buffer gas every life-support loop needs — Titan is the outer system's life-support well. Aerobraking arrival. |
| 52 | **Enceladus** | Geysers from a subsurface ocean jet straight into space; escape velocity 239 m/s. You can practically fill your tanks from the plume without landing. The refuelling miracle of the outer system. |
| 53 | **The rings** | Nearly pure water ice, pre-crushed, in staggering quantity. Mining without mining. |
| 54 | **Iapetus** | Two-toned (one hemisphere coal-dark, one ice-bright), with an equatorial ridge of mountains 13 km high that nobody fully explains. Far out and cheap to leave — the outer waypoint, and the strangest landscape in the system. |
| 55 | **Rhea / Dione / Mimas** | Ordinary ice moons — exactly what a supply chain wants. The unglamorous middle of the Saturn economy. |
| 56 | **Phoebe** | Retrograde and captured — a Kuiper belt object that came to Saturn, orbiting far outside everything else. The system's back door. |

## The far system (6)

| # | Place | The real hook |
|---|---|---|
| 57 | **Uranus's moons (Miranda, Titania)** | Miranda looks shattered and reassembled — cliffs 20 km high. Titania is the largest. At the edge of practical chemical travel; the definition of "the drive eras redraw the map." |
| 58 | **Neptune orbit / Triton** | Triton orbits *backwards* — a captured Kuiper belt object with nitrogen geysers and a thin nitrogen atmosphere. A KBO you can study without leaving the planets. |
| 59 | **A Centaur (Chariklo)** | Small bodies between Jupiter and Neptune on unstable orbits — Chariklo has *rings*. Waystations that won't be on the same orbit in ten thousand years. |
| 60 | **Pluto–Charon (Sputnik Planitia)** | A convecting nitrogen-ice glacier on a world where nitrogen does what water does on Earth; Charon hangs fixed in the sky (mutual tidal lock). The far shore. |
| 61 | **An Arrokoth-type cold-classical KBO** | Untouched primordial material on an orbit that was never stirred — the oldest unprocessed stuff reachable. The last survey target. |
| 62 | **Ice-giant atmosphere scooping** *(speculative, label it)* | Uranus and Neptune hold helium-3 and deuterium in scoopable upper atmospheres. Real chemistry, speculative economics — flag per §16 and let the late campaign argue about it. |

**Census verdict: 62 named, distinct, real places** — call it **~60**. Your 40
guess was low but the right order of magnitude; 100 is not there without
padding; 20 would waste most of what the solar system actually offers.

---

# PART 2 — THE SPACE BETWEEN: features of space itself as game content

Joshua asked for "the nature of the space itself." These aren't sites — they're
**weather, terrain, and clocks**, and they're all real:

| Feature | The reality | The mechanic it becomes |
|---|---|---|
| **Solar conjunction blackouts** ✦ | Every ~26 months the Sun sits between Earth and Mars, and NASA stops commanding its Mars fleet for ~2 weeks — signals through the corona genuinely corrupt. Every superior planet has an equivalent. | A recurring, *predictable* comms blackout: intel from occluded regions goes stale, prices there become bets, smugglers time runs for conjunction. An L4/L5 relay (site #21) is the counter — and now that relay has a reason to exist. |
| **Light-lag** | Already in the game (intel freshness). | Keep; the atlas gives it more distance to matter over. |
| **Synodic windows** | Already in the game (transfer costs vary with geometry). | The cycler (site #19) turns the window itself into a bus schedule. |
| **Solar storms** | Coronal mass ejections are directional and take ~1–3 days to arrive at 1 AU — meaning a warning post at Sun–Earth L1 (#2) sees them first. | Space's weather event: a storm degrades electronics in transit, grounds departures, spikes demand for parts. Holding L1 data = selling forecasts. |
| **Radiation belts** | Van Allen (#6) and Jupiter's belts (#45–48) are mapped, real, and lethal on real timescales. | Terrain: routes and stay-times are constrained, shielding is cargo mass, and Callisto-vs-Io is a habitability lesson the player *feels*. |
| **Kirkwood gaps** | Resonance lanes swept clean in the Belt (#43). | Navigational texture: the Belt has structure, not uniform rubble. |
| **Low-energy transfers** | The Interplanetary Transport Network: near-zero-fuel routes along gravitational manifolds, at the price of being achingly slow. | The tramp-freight option: cheap, slow, and the reason patience is a strategy. |
| **Heritage law** ✦ | The One Small Step Act (2020) already protects Apollo sites in US law. | A no-touch zone with reputational (and legal) teeth — proof that "sacred site" isn't even speculative. |

---

# PART 3 — INSTALLATIONS (what gets built)

*(Unchanged in substance from the first draft; ~30 types. Summary table —
each carries `produces`, `needs`, `scale`, `baseTech`, `requires`.)*

**Industry:** extraction camp · refinery · propellant depot · foundry ·
fabrication plant (tech 6, the campaign prize) · shipyard · power station ·
salvage yard · mass-driver terminal

**People:** colony · agricultural station · sanatorium (low-g medicine) ·
quarantine station · penal colony · relief camp · resort

**Knowledge:** research station · observatory · university (better crew hires) ·
archive/data haven · comms relay (buys down light-lag/conjunction) ·
prospecting camp · early-warning post (new — site #2's job)

**Power:** naval base · blockade post · customs house · mercenary compound ·
embassy/neutral ground

**Trade:** entrepôt · free haven · terminal · company town · cycler habitat
(new — site #19's job: a moving terminal)

**Belief:** monastery/retreat · ideological commune · hermitage ·
pilgrimage site (new — #13, #14, #18: heritage ground, visited, never worked)

## Constraints (plausibility filter)

No farms without light or power. No families where radiation kills (#47, #48 —
rotating crews, robots, or prisoners only). No heavy industry without metal.
No fabrication below tech 6. Free havens only where patrols are thin (Belt,
Trojans, outer irregulars — never cislunar). Pilgrimage sites only at real
heritage ground. **The bigger the population, the more it imports — arithmetic,
not flavour.**

---

# PART 4 — OPERATORS (who runs it)

*(Unchanged in substance; ~25 operators.)* Space Trader's benchmark says the
variety target is right: they shipped **17 government types** and each one
changed police presence and what was legal. Ours: state (agency, treaty
authority, colonial administration, chartered company-state) · military (navy,
militia, PMC, occupying force) · corporate (extractive combine, propellant
utility, shipbuilder, pharma house, agri-combine, insurance underwriter, bank,
media house) · civil (settler republic, workers' co-op, free port, captains'
guild, homesteaders) · belief/knowledge (monastic order, outer-dark faith,
utopian movement, university consortium, itinerant surveyors) · grey (smuggling
syndicate, pirate band, cartel, salvage clan).

Each sets `law`, `tariff`, `bans`, `disposition`, `techMod`, `offers` — the
machinery for all of which already exists in the game.

---

# PART 5 — RESEARCH AS PLAY: the facts are the treasure

Joshua's instinct, and it closes the loop on the educational mission: **the
atlas facts should be discoverable in-game, not just ambient.**

- **Survey missions** target census entries: *"Radar-map the Utopia ice sheet"*
  → the fact is revealed in the player's atlas → depot viability there is now
  known → the player planned their next run around a true thing they learned.
- **The survey camera** (the existing photo layer, per design.md §13) is the
  instrument: imaging, spectroscopy, thermal mapping each reveal different
  fields of a place's entry.
- **The Archive / university buys data**: facts have a *price*, which is the
  game's thesis (information is a resource) applied to its own teaching content.
- **An in-game atlas screen** collects what's been learned, entry by entry —
  the passport/stamp idea from Shutterbug, grown up: you finish a campaign
  owning a mental map of the real solar system because you needed one to win.

---

# PART 6 — IMPLEMENTATION SKETCH

Three data files and one generator, mirroring `spawnFactions`:

- `data/places.js` — the ~60 census entries. Real, sourced, educational.
  `{ id, name, system, body|orbit, why, resources, hazards, habitability,
  light, gravity, commsNote }`. **Ids derive from the place, never the
  installation** (`ceres`, `titan`, `luna-farside`) — saves key `player.at` and
  markets by site id, and home ports must not stop existing when the generator
  changes.
- `data/installations.js` — ~30 types with `produces`, `needs`, `scale`,
  `baseTech`, `requires` (light, metal, shelter, ice…).
- `data/operators.js` — ~25 with `law`, `tariff`, `bans`, `disposition`,
  `techMod`, `offers`.
- `sites.js` → `spawnSites(seed)`: draw 16–24 places (guaranteeing the cislunar
  cluster), draw a legal installation per place (filtered by `requires`), draw a
  plausible operator, derive the market. Seeded and pure. `spawnFactions` then
  lays its actors over the top: a drawn map *and* drawn politics.

Phasing that keeps every step shippable: **(1)** hand-write ~8 new fixed sites
from the census (inner system + Ganymede) to relieve the 7-site squeeze now;
**(2)** build `spawnSites` over the full census; **(3)** add conjunction
blackouts and the cycler; **(4)** the in-game atlas screen and survey missions.

---

## Sources checked while writing (2026-07-26)

**Space Trader:** [original constants header](https://github.com/deadjim/dark-nova-android/blob/master/iPhone-Code/Not%20Used/spacetrader.h) · [Wikipedia](https://en.wikipedia.org/wiki/Space_Trader_(Palm_OS)) · [spronck.net](https://www.spronck.net/spacetrader/SpaceTrader.html) · [GameFAQs strategy guide](https://gamefaqs.gamespot.com/palmos/917550-space-trader/faqs/23321)

**Solar system, verified this session (✦):**
- Mars conjunction blackout — [NASA/JPL](https://www.jpl.nasa.gov/news/nasas-mars-fleet-will-still-conduct-science-while-lying-low/) · [Space.com](https://www.space.com/nasa-mars-blackout-solar-conjunction-2021) · [CNN](https://edition.cnn.com/2023/11/15/world/nasa-mars-missions-solar-conjunction-scn)
- Queqiao at Earth–Moon L2 — [SpaceNews](https://spacenews.com/change-4-relay-satellite-enters-halo-orbit-around-earth-moon-l2-microsatellite-in-lunar-orbit/) · [The Planetary Society](https://www.planetary.org/articles/0519-change-4-relay-satellite) · [Space: Science & Technology](https://spj.science.org/doi/10.34133/2021/3471608)
- Reiner Gamma mini-magnetosphere — [NASA Science](https://science.nasa.gov/resource/lunar-swirl-reiner-gamma/) · [Communications Physics](https://www.nature.com/articles/s42005-018-0012-9) · [ESA](https://www.esa.int/Science_Exploration/Space_Science/SMART-1/Reiner_Gamma_swirl_magnetic_effect_of_a_cometary_impact)
- Aldrin cycler (146-day legs, 2.135-yr period) — [Wikipedia/Mars cycler](https://en.wikipedia.org/wiki/Mars_cycler) · [buzzaldrin.com](https://buzzaldrin.com/space-vision/advocacy/cycling-pathways-to-occupy-mars/) · [Acta Astronautica](https://www.sciencedirect.com/science/article/abs/pii/S009457651731826X)
- One Small Step Act (Pub. L. 116-275, Dec 31 2020) — [Congress.gov](https://www.congress.gov/bill/116th-congress/senate-bill/1694) · [Space.com](https://www.space.com/one-small-step-space-heritage-act.html)
- Tranquillitatis lava tube — [Nature Astronomy 2024](https://www.nature.com/articles/s41550-024-02302-y) · [ESA](https://blogs.esa.int/caves/2024/12/05/a-shelter-on-the-moon/)
- Bennu samples — [NASA](https://www.nasa.gov/news-release/nasas-asteroid-bennu-sample-reveals-mix-of-lifes-ingredients/) · [Nature Geoscience 2025](https://www.nature.com/articles/s41561-025-01838-6) · [PNAS 2025](https://www.pnas.org/doi/10.1073/pnas.2512461122)

**Everything unmarked must be verified against a primary source before it
becomes player-facing text** (project rule 2 / design.md §16).
