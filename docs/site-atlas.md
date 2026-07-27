# THE SITE ATLAS — places, installations, and who runs them

**This is a content spec, not shipped content.** It exists to answer one question:
how do we get from seven hand-written ports to a solar system with enough places,
enough variety, and enough personality that a route is a *choice*?

## The idea

A site is not one thing. It is **three things multiplied together**:

```
      WHERE it is   ×   WHAT it is   ×   WHO runs it   =   a port with an economy
      (fixed, real)     (drawn)          (drawn)
```

The geography never changes — that is the educational spine, and it is why
`why:` on every site is a real physical fact. But a place is only a *location*
until something is built on it, and what gets built, and who builds it, can be
drawn fresh every run.

That means Ceres is always the water tower of the solar system, and its escape
velocity is always about 510 m/s — but in one run it is a free port run by
settlers, in the next a naval station that has closed the Belt to smuggling, and
in the next a company town where a mining combine owns the air. Same rock. Same
physics. A completely different game.

**This is the existing faction principle pushed one level down.** Factions
already vary per seed and bend a market. This makes the ports themselves vary,
which is where the variety actually needs to live, because a market modifier on
a port that is always the same port is decoration.

### What the three parts each decide

| | Decides |
|---|---|
| **Place** | What can physically be extracted here, how hard it is to reach and leave, what will kill you, how much sunlight there is |
| **Installation** | What the place *does* — what it turns local resources into, what it needs shipped in, how many people are there, its tech level |
| **Operator** | The law, the tariff, what's banned, how it treats you, what work it offers, whether it's dangerous |

`produces` falls out of **place ∩ installation**. `consumes` falls out of
**installation + population**. `government` comes from the **operator**. Nothing
needs hand-authoring per site except the physical `why`, which is the part that
must be true.

> ⚠ **EVERY FACT BELOW NEEDS SOURCE-CHECKING BEFORE IT SHIPS** (project rule 2 /
> design.md §16). This document is a brainstorm written from general knowledge;
> the two 2024–25 findings marked ✦ were checked during writing and are cited at
> the bottom. Everything else is "almost certainly right, verify anyway."

---

# PART 1 — PLACES

Where something could plausibly be, and the physical reason anyone would bother.
"Resources" is what is *locally available*, not what is there in the game today.

## The inner system

| Place | Why anyone is here | Local resources | Fits |
|---|---|---|---|
| **Mercury — polar cold traps** | Craters at the poles never see sunlight and hold radar-bright deposits, very probably water ice, on the planet closest to the Sun. Peaks nearby get near-continuous sun. | ice, metals, regolith | mining, depot, power station, research |
| **Mercury — Caloris / equatorial** | ~6.7× Earth's sunlight and no atmosphere: the best solar power in the system, and a low-gravity airless surface ideal for a mass driver. | metals, regolith, **power** | power station, foundry, mass-driver terminal |
| **Venus — cloud deck, ~50 km** | At that altitude pressure is about one atmosphere and the temperature is survivable, while the surface below is hot enough to melt lead. Breathable air is a lifting gas in a CO₂ atmosphere. | CO₂, nitrogen, sulfur compounds | colony, research, observatory, resort |
| **Venus — orbit** | Aerobraking makes arrival cheap; a natural waypoint on inner-system routes. | — | terminal, relay, naval station |
| **A sun-facing collector swarm (~0.3 AU)** | Power density scales as 1/r². Closer is dramatically better, and nothing living needs to be there. | **power** | power station, foundry |

## Earth and Luna

| Place | Why anyone is here | Local resources | Fits |
|---|---|---|---|
| **Low Earth orbit** | The top of the deepest gravity well anyone routinely climbs. Everything from Earth passes through. | — (everything imported *down*) | entrepôt, shipyard, terminal, HQ |
| **Geostationary belt** | The only orbit where you hang over one spot on Earth. Crowded, contested, valuable. | — | relay, broadcast, power station |
| **Luna — south pole (Shackleton)** | Crater floors unlit for ~2 billion years hold water ice; the rim gets almost continuous sunlight. Ice and power within a few miles of each other. | ice, propellant, regolith | depot, mining, colony, observatory |
| **Luna — far side (e.g. Daedalus)** | The only radio-quiet surface in the inner solar system: 3,500 km of rock between you and every transmitter on Earth. There is nowhere else like it. | regolith | **observatory** (uniquely), research, archive |
| **Luna — Mare Tranquillitatis lava tube** ✦ | Radar confirmed an accessible cave conduit beneath the Tranquillitatis pit in 2024 — tens of metres wide, 130–170 m down. Rock overhead is free radiation shielding and free thermal stability. | regolith, **shelter** | colony, archive, vault, sanatorium |
| **Luna — mare basalts (Procellarum)** | Titanium- and iron-rich basalt, and a shallow enough well that a mass driver can throw cargo off it. | ore, metal, regolith, oxygen | mining, foundry, mass-driver terminal |
| **A captured near-Earth asteroid** | Some NEAs are easier to reach than the Moon's surface. Whoever parks one in cislunar space owns a mine next door to the market. | ore, ice, organics | mining, refinery, salvage |

## Mars

| Place | Why anyone is here | Local resources | Fits |
|---|---|---|---|
| **Phobos** | Effectively no gravity well — you land and leave for almost nothing. Probably the best depot in the inner system. | ice (probable), regolith | depot, terminal, naval station |
| **Deimos** | Smaller and higher than Phobos: cheaper still to leave, further from Mars's well. | regolith | depot, relay, observatory |
| **Jezero crater** | A dried river delta where water pooled; subsurface ice, clay minerals, and a 95% CO₂ atmosphere a machine can turn into oxygen and methane. | volatiles, ice, regolith, food | colony, research, agriculture |
| **Hellas Planitia** | The deepest basin on Mars, where the atmosphere is thickest — meaning the most radiation shielding and the best parachute landing on the planet. | volatiles, ice, regolith | colony, terminal, sanatorium |
| **Utopia Planitia** | Orbital radar found a buried ice sheet holding on the order of a large terrestrial lake's worth of water. | ice, volatiles | mining, depot, colony |
| **Planum Boreum (north polar cap)** | Kilometres-thick water ice, exposed, in enormous quantity. | ice, propellant | mining, depot, research |
| **Valles Marineris** | A canyon system thousands of kilometres long: exposed stratigraphy, possible ice in shadowed walls, and natural shelter. | ice, ore, regolith | mining, research, settlement |
| **Olympus Mons / Tharsis** | Volcanic province, high altitude, lava tubes. Thin air is bad for landing and good for launching. | regolith, ore | terminal, research, mining |
| **Areostationary orbit** | Comms relay for the whole Mars system. | — | relay, terminal, naval station |

## The Belt

| Place | Why anyone is here | Local resources | Fits |
|---|---|---|---|
| **Ceres** | Roughly a quarter water by mass, escape velocity ~510 m/s. Far from the Sun and cheaper to leave than our own Moon. | ice, propellant, volatiles, ore | entrepôt, depot, colony, free haven |
| **Vesta** | Differentiated with a basaltic crust — a protoplanet that got most of the way there. A different mineral profile from anything else in the Belt. | ore, metal, regolith | mining, foundry, research |
| **Psyche** | Appears to be largely exposed metal, possibly the stripped core of a shattered protoplanet. Iron and nickel at the surface. | ore, metal | mining, foundry, shipyard |
| **Pallas** | An orbit inclined about 35° to the ecliptic. It is *in* the Belt and expensive to reach anyway — inclination costs like distance. | ore, ice | mining, prison, hideout |
| **Hygiea** | The fourth-largest belt object and carbonaceous: water and organics rather than metal. | ice, volatiles, organics | mining, refinery, colony |
| **A C-type rubble pile (Bennu-like)** ✦ | Returned samples contain hydrated minerals, sodium-rich salts from ancient brines, sugars, all five DNA/RNA nucleobases and 14 of the 20 protein amino acids. The chemistry of life is *already there*. | ice, organics, volatiles | mining, research, prospecting camp |
| **The Jupiter Trojans** | Two enormous swarms of primitive bodies sharing Jupiter's orbit — a second belt nobody thinks about, out where nothing is patrolled. | ice, organics, regolith | prospecting, free haven, hideout |

## Jupiter

| Place | Why anyone is here | Local resources | Fits |
|---|---|---|---|
| **Callisto** | The only Galilean moon far enough out to sit mostly clear of the radiation belt. Io's surface dose would kill a person in a day; Callisto's is survivable. | ice, propellant, regolith | colony, depot, research, terminal |
| **Ganymede** | The largest moon in the solar system and the only one with its own magnetic field, which gives it shielding no other moon has — but it sits deeper in Jupiter's radiation belt and deeper in its own well. | ice, ore, regolith | colony, shipyard, naval base |
| **Europa** | A subsurface ocean under an ice shell, and a surface radiation dose that is lethal in about a day. The most interesting place in the system to study and among the worst to stay. | ice, volatiles | research (rotating crews), quarantine |
| **Io** | The most volcanically active body known, coated in sulfur compounds, sitting in the worst of the radiation. No one lives here; machines might work here. | sulfur, metals | robotic mining, penal labour |
| **Himalia** | A captured outer irregular moon, far outside the radiation belt — a quiet anchorage at Jupiter's distance. | regolith, ice | depot, hideout, naval station |

## Saturn

| Place | Why anyone is here | Local resources | Fits |
|---|---|---|---|
| **Titan** | A 1.45-bar atmosphere that is ~95% nitrogen, with lakes of liquid methane and ethane. Nitrogen is the buffer gas every life-support loop needs, and almost nowhere else has it in bulk. Aerobraking arrival. | nitrogen, methane, volatiles, organics | colony, refinery, agriculture, terminal |
| **Enceladus** | Plumes of water vapour jet from a subsurface ocean into space. Escape velocity is 239 m/s — you barely have to stop to fill a tank. | ice, propellant, volatiles | depot, research, monastery |
| **The rings** | Almost pure water ice in staggering quantity, already broken into convenient pieces. | ice, propellant | mining, depot |
| **Iapetus** | Far out from Saturn, cheap to leave, and famously two-toned. A natural outer-system waypoint. | ice, regolith | depot, observatory, relay |
| **Mimas / Dione / Rhea** | Ordinary ice moons — which is exactly what a supply chain wants. | ice, propellant | depot, mining |

## The ice giants and beyond

| Place | Why anyone is here | Local resources | Fits |
|---|---|---|---|
| **Triton (Neptune)** | Retrograde, therefore captured — a Kuiper belt object with nitrogen geysers and a thin nitrogen atmosphere. | nitrogen, ice, volatiles | research, depot, colony |
| **Miranda / Titania / Oberon (Uranus)** | Ice moons at the edge of practical travel; Miranda's terrain suggests it was shattered and reassembled. | ice, volatiles | research, prospecting |
| **Uranus / Neptune upper atmosphere** | Deuterium and helium isotopes, scoopable without landing on anything. | fuel isotopes | scooping station *(speculative)* |
| **Pluto — Sputnik Planitia** | A nitrogen ice glacier, convecting, on a world where nitrogen behaves the way water does on Earth. | nitrogen, ice | research, relay, hermitage |
| **A Kuiper belt object (Arrokoth-like)** | Untouched primordial material, and the far edge of anywhere anyone goes. | ice, organics | research, hideout, monastery |

---

# PART 2 — INSTALLATIONS

**What the something is.** Each type has a characteristic economy: what it turns
local resources into, what it must import, roughly how many people, and its tech
level. These are the knobs that make two ports on identical rocks feel different.

### Industry

| Type | Produces | Imports | Pop | Tech | Character |
|---|---|---|---|---|---|
| **Extraction camp** | whatever the place has, raw | food, lifesupport, machinery | small | 1–2 | Everything a person needs is shipped in |
| **Refinery** | refined tier from local raw | machinery, parts, power | medium | 3–4 | Where raw becomes worth moving |
| **Propellant depot** | propellant | machinery | small | 2–4 | Changes which routes exist at all |
| **Foundry / heavy works** | parts, machinery | ore, metal, electronics | medium | 4–5 | The first rung off Earth dependency |
| **Fabrication plant** | electronics, instruments | metal, parts, power | medium | 6 | Rare, precious, and the campaign's whole point |
| **Shipyard** | hulls and modules | parts, metal, electronics | medium | 5–6 | Where money becomes reach |
| **Power station** | cheap refined goods (energy is the input to everything) | machinery, reactorparts | small | 4–5 | Solar inside Mars, fission outside it |
| **Salvage yard** | parts, metal, cheap modules | — | small | 2–3 | Buys wrecks; sells things with a history |

### People

| Type | Produces | Imports | Pop | Tech | Character |
|---|---|---|---|---|---|
| **Colony / settlement** | a little of everything local | food, lifesupport, medical, machinery | large | 2–5 | The biggest market, and the most dependent |
| **Agricultural station** | food | water, power, volatiles | medium | 3–4 | Needs light and water; changes what a region can support |
| **Sanatorium** (low-g medical) | — | medical, food, lifesupport | small | 4–5 | Low gravity as a treatment; passengers, not cargo |
| **Quarantine station** | — | medical, lifesupport | small | 3 | Deliberately isolated. Nobody docks unless told to |
| **Penal colony** | ore, refined goods, cheaply | food, lifesupport, arms | medium | 1–2 | Labour that isn't paid; grim, and produces below cost |
| **Refugee / relief camp** | — | food, medical, lifesupport | large | 1 | Desperate demand, no money. Pays in standing |
| **Resort / casino** | — | food, luxuries, medical | small | 5 | Passengers and money that came from somewhere |

### Knowledge

| Type | Produces | Imports | Pop | Tech | Character |
|---|---|---|---|---|---|
| **Research station** | survey data, samples | instruments, electronics, lifesupport | small | 5–6 | Pays well for instruments; knows things |
| **Observatory** | astronomical data | instruments, electronics | small | 5 | Needs dark, cold, quiet, or vacuum |
| **University / academy** | trained crew *(hire better here)* | instruments, food, electronics | medium | 6 | Where a captain's skills could actually improve |
| **Archive / data haven** | information, fresher intel | electronics, power | small | 4–5 | Buys logs, derelict data, quiet favours |
| **Comms relay** | **fresher market intel** | electronics, reactorparts | tiny | 4–6 | Directly attacks the light-lag penalty. A real upgrade path |
| **Prospecting camp** | claims, survey data | everything | tiny | 1 | Temporary. May not be there next run |

### Power

| Type | Produces | Imports | Pop | Tech | Character |
|---|---|---|---|---|---|
| **Naval base** | escort, bounty work | arms, food, parts, reactorparts | medium | 4–5 | Raises police everywhere near it |
| **Fortress / blockade post** | — | arms, food, parts | small | 4 | Sits on a chokepoint and charges for passage |
| **Customs house** | — | — | small | 4–6 | The port whose entire job is inspecting you |
| **Mercenary compound** | arms, escort | food, parts, arms | small | 3–4 | Sells the same services to both sides |
| **Embassy / neutral ground** | — | luxuries, food | small | 5 | Nobody's law. Everyone's meeting place |

### Trade

| Type | Produces | Imports | Pop | Tech | Character |
|---|---|---|---|---|---|
| **Entrepôt** | — (moves everything) | — | large | 5–7 | Everything available, nothing cheap |
| **Free haven** | — | everything | medium | 3–4 | Contraband is legal. Nobody asks. Nobody helps |
| **Terminal / transfer station** | — | food, propellant | medium | 4 | Passengers and transhipment; a place you pass through |
| **Company town** | whatever the company extracts | food, lifesupport | medium | 3–4 | The company owns the air you breathe |

### Belief

| Type | Produces | Imports | Pop | Tech | Character |
|---|---|---|---|---|---|
| **Monastery / retreat** | — | food, lifesupport | small | 2–3 | Shelters travellers. Trades little, remembers everything |
| **Ideological commune** | food, refined goods | machinery, medical | medium | 2–4 | Self-sufficiency as doctrine — the campaign's thesis, lived |
| **Hermitage** | — | almost nothing | tiny | 1 | Somebody chose to be this far from everyone |

---

# PART 3 — OPERATORS

**Who runs it.** The operator sets law, tariff, what's banned, and how the place
treats you. The existing four (`consortium`, `agency`, `corporate`,
`independent`) are the seed of this; here is the fuller pool.

### State

| Operator | Law | Tariff | Bans | Character |
|---|---|---|---|---|
| **National space agency** | very high | low | nuclear, arms | Strict, thorough, slow. Low tariffs, real inspections |
| **Supranational treaty authority** | highest | low | everything controlled | Exists to enforce safeguards. The worst place to be caught |
| **Colonial administration** | high | high | arms | A homeland governing a settlement that resents it |
| **Chartered company-state** | medium-high | high | fissiles | Corporate order with a flag |

### Military

| Operator | Law | Tariff | Bans | Character |
|---|---|---|---|---|
| **Navy / patrol fleet** | very high | medium | arms, fissiles | Region is safe from raiders and hostile to smugglers |
| **Local militia** | medium | low | — | Polices its own, hates outside navies, sells you arms |
| **Private military contractor** | low | medium | — | Sells arms openly; law is whatever the contract says |
| **Occupying force** | high | punitive | most things | Blockade, shortage, resentment, and desperate prices |

### Corporate

| Operator | Law | Tariff | Bans | Character |
|---|---|---|---|---|
| **Extractive combine** | medium-low | high | — | Company town. Light law for everyone but competitors |
| **Energy / propellant utility** | medium | low | — | Fuel is cheap here and that changes the map |
| **Shipbuilder consortium** | medium | medium | — | Hulls and modules nobody else sells yet |
| **Pharmaceutical house** | high | high | — | Medicine is made here and licensed everywhere |
| **Agricultural combine** | medium | medium | — | Food, in quantity, in a place that shouldn't have it |
| **Insurance underwriter** | high | low | — | Runs rescue stations because claims are expensive |
| **Bank / clearing house** | high | low | — | Money moves through here. So do favours |
| **Media / broadcast house** | low | low | — | Sells information, and reputation, and rumours |

### Civil

| Operator | Law | Tariff | Bans | Character |
|---|---|---|---|---|
| **Settler republic** | medium | low | — | Governs itself, badly and proudly |
| **Workers' cooperative** | medium | low | — | Owned by the people doing the work. Fair, and slow |
| **Free port / no authority** | very low | minimal | nothing | Everything is legal. So is what happens to you |
| **Captains' guild** | medium | low | — | Contracts, discounts, and a warning before trouble |
| **Homesteaders** | low | none | — | A handful of families, and no institution at all |

### Belief and knowledge

| Operator | Law | Tariff | Bans | Character |
|---|---|---|---|---|
| **Monastic order** | high (their own) | none | arms, fissiles | Hospitality as doctrine. Long memory |
| **Outer-dark faith** | medium | low | arms | Shelters travellers, shuns the inner worlds |
| **Utopian movement** | high | none | arms, contraband | Ideology as law, and it *is* enforced |
| **University consortium** | high | low | fissiles, arms | Where crew get better and instruments are wanted |
| **Itinerant surveyors** | none | none | — | Trade in where the ice is and where it's dangerous |

### Grey and criminal

| Operator | Law | Tariff | Bans | Character |
|---|---|---|---|---|
| **Smuggling syndicate** | very low | low | — | Contraband cheap. Everything else has a price too |
| **Pirate band** | none | — | — | Not a port so much as a risk with a dock |
| **Cartel** | low | extortionate | competitors' goods | Controls one scarce good absolutely |
| **Salvage clan** | low | low | — | Family business. Half of it is legal |

---

# PART 4 — HOW THEY COMBINE

## The derivation

```
produces   = place.resources  ∩  installation.canMake
consumes   = installation.needs  +  population needs
techLevel  = installation.baseTech  ±  operator modifier
government = operator (law, tariff, bans)
population = installation.scale  ×  place habitability
pressure   = whatever the three disagree about
```

**The interesting sites are where the three fight.** A research station on
Europa run by a supranational authority is a place with enormous instrument
demand, no local industry, lethal surroundings and the strictest customs in the
game. A free haven in the Trojans run by a smuggling syndicate is the same rock
with the opposite everything.

## What varies per seed, and what never does

| Never changes | Changes every run |
|---|---|
| Which places exist and where they are | Which places have anything on them |
| The physical `why` of each | What kind of installation it is |
| What can be extracted there | Who runs it |
| Delta-v, sunlight, radiation, gravity | Its tech level, law, tariff, market |

A run might have 10–14 *occupied* sites drawn from ~40 places. **The places you
never visit in a given run are as important as the ones you do** — they are why
the next run is different.

## Constraints worth encoding

Not every combination is plausible, and the implausible ones are worth blocking:

- **No agriculture without light or power.** Titan can farm under fission; the
  Trojans cannot farm at all.
- **No colony where radiation kills.** Europa's surface and Io get rotating
  crews, robots, or prisoners — never families.
- **No heavy industry without metal nearby.** A foundry on Enceladus is silly.
- **No fabrication plant below tech 6**, and tech 6 needs an established
  industrial base — so an outer-system chip fab is a *late-campaign achievement*,
  not a starting condition.
- **A free haven needs somewhere to hide.** It belongs where patrols are thin:
  the Belt, the Trojans, the outer moons — never in Earth orbit.
- **The bigger the population, the more it must import.** That is the whole
  dependency thesis, and it should be arithmetic, not flavour.

## Why this fixes what's currently broken

- **`mods.produces` becomes reachable.** With 40 places and drawn installations,
  most ports *won't* trade most goods — so a faction bringing propellant to a
  port that has none is a real event.
- **Contraband gets a real map.** Free havens and syndicate ports are drawn, so
  the smuggling geography changes every run instead of being "Ceres, always."
- **Tech levels spread out.** Prospecting camps at 1, fabrication plants at 6, and
  a reason to fly to a specific port for a specific hull.
- **Crew hiring gets interesting.** A university produces good crew; a penal
  colony produces desperate ones.
- **Missions write themselves.** A relief camp needs food. A quarantine station
  needs medicine and no questions. A blockade post wants somebody to run it.

---

## Implementation sketch (for whoever builds this)

Three data files and one generator, mirroring how factions already work:

- `data/places.js` — the ~40 fixed locations. Real, sourced, educational. Carries
  `why`, `resources`, `system`, `body`, `hazards`, `habitability`, `dvNote`.
- `data/installations.js` — the ~30 types above, each with `produces`, `needs`,
  `scale`, `baseTech`, `requires` (e.g. `light`, `metal`, `shelter`).
- `data/operators.js` — the ~25 operators, each with `law`, `tariff`, `bans`,
  `disposition`, `techMod`, `offers`.
- `sites.js` — `spawnSites(seed)`: draw N places, draw a legal installation for
  each (filtered by `requires` against the place), draw an operator (filtered by
  plausibility), derive the market profile. Seeded and pure, exactly like
  `spawnFactions`.

The existing `SITES` array becomes the *output* of that function rather than a
hand-written constant, and `spawnFactions` then places its actors over the top —
so a run has both a drawn map and drawn politics.

**Migration note:** every save stores `player.at` as a site id, and markets are
keyed by site id. Site ids must therefore be stable and derived from the PLACE
(`ceres`, `titan`, `luna-farside`), never from the installation — otherwise a
save's home port stops existing when the shape of the generator changes.

---

## Sources checked while writing (2026-07-26)

- Lunar lava tube ✦ — [Radar evidence of an accessible cave conduit on the Moon below the Mare Tranquillitatis pit, *Nature Astronomy*, 2024](https://www.nature.com/articles/s41550-024-02302-y) · [ESA summary](https://blogs.esa.int/caves/2024/12/05/a-shelter-on-the-moon/)
- Bennu organics ✦ — [NASA: Asteroid Bennu Sample Reveals Mix of Life's Ingredients](https://www.nasa.gov/news-release/nasas-asteroid-bennu-sample-reveals-mix-of-lifes-ingredients/) · [Bio-essential sugars in samples from asteroid Bennu, *Nature Geoscience*, 2025](https://www.nature.com/articles/s41561-025-01838-6) · [Prebiotic organic compounds in samples of asteroid Bennu, *PNAS*, 2025](https://www.pnas.org/doi/10.1073/pnas.2512461122)

Everything else in this document is written from general knowledge and **must be
verified against a primary source before it becomes player-facing text.**
