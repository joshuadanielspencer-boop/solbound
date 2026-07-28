# THE CURRICULUM — two semesters of astronomy, and how much of it can be a mechanic

**Joshua's brief:** *"I want this game to teach a semester's worth of solar
astronomy, and cram in as much stellar astronomy as we can... It all needs to be
taught as game mechanics, at least as much as possible."*

This document answers that with an audit rather than a wish list. It takes the
actual contents of the standard two-semester intro sequence, marks what the game
already teaches, and proposes mechanics for the rest — including the honest list
of what cannot be made into one.

The conclusion up front, because it is better than expected:

> **Semester one is roughly two-thirds already built.** The remaining third is
> four mechanics, and three of them are things the design already wanted for
> other reasons.
>
> **Semester two is the surprise.** Stellar astronomy fits this game better than
> planetary astronomy does — because almost all of it is done *from inside the
> solar system, with instruments you had to build and place*, which is exactly
> the economic activity this game is about. The distance ladder is already a tech
> tree. Nobody has to leave.

---

## 0. The test every idea here has to pass

`design.md` §14 already asks whether a feature creates an interesting decision.
Teaching needs one more test on top, because the failure mode is specific and
seductive: it is very easy to add a paragraph of true astronomy to a card and
feel like you taught something.

> **A fact you read is not a mechanic. A fact you had to *use* is.**

So every entry below is graded:

| Grade | Means | Counts as taught? |
|---|---|---|
| **MECHANIC** | The fact changes a decision. Getting it wrong costs you. | Yes — fully |
| **INSTRUMENT** | You measure it yourself, and the measurement is the gameplay. | Yes — and this is the best grade for astronomy specifically |
| **CARD** | True, well-written, ambient text. Read once, maybe. | Barely |
| **NO** | Cannot be made into either without wrecking the game. | No — and say so |

The honest scoring at the end of this document counts MECHANIC and INSTRUMENT
only. **CARD is not teaching, it is decoration with footnotes.**

One more rule, inherited from `design.md` §16 and worth restating because this
document doubles the amount of science in the game:

> Every number a player sees is **fact**, **abstraction**, or **speculation**,
> and the game says which. An instrument that returns a made-up measurement is
> worse than no instrument, because it teaches a wrong thing confidently.

---

## 1. What a semester actually covers

The reference is **OpenStax *Astronomy 2e***, which is the free textbook most
intro sequences in the US actually use, and whose 31 chapters split almost
exactly along the usual two-course line. Chapters 1–14 are the solar-system
course; 15–30 are stars and galaxies.

That book *is* the answer to "what would be covered in a semester or two", so
this document is organised against its spine rather than against a syllabus I
invented.

---

## 2. Semester one — the solar system

### 2a. What the game already teaches, and where

This is a bigger list than I expected before auditing it. Much of it was built
for economic reasons and teaches astronomy as a side effect, which is exactly
the design's stated ambition ("reality is the optimal strategy").

| Topic (OpenStax ch.) | Grade | Where it lives now |
|---|---|---|
| Kepler's laws; real orbital elements | **MECHANIC** | `ephemeris.js` — real JPL elements, validated against three published oppositions |
| Orbital periods; the planets genuinely move | **MECHANIC** | The orrery runs on a live clock |
| Hohmann transfers, Δv, flight times | **MECHANIC** | `transfer.js` — reproduces the published Earth→Mars figures |
| Synodic periods | **MECHANIC** | `transfer.js`; visible as Earth catching Mars on the map |
| Light travel time (ch. 1.5) | **MECHANIC** | `intel.js` — market intel is stale in proportion to distance |
| Solar conjunction | **MECHANIC** | `intel.occluded()` — a real ~2-week comms blackout |
| Aerobraking and atmospheres | **MECHANIC** | `tradergame.js` `AEROBRAKE` — Mars and Venus are cheaper to arrive at |
| Rocket equation; why payload is exponential | **MECHANIC** | `propulsion.js`, and now the drive-era refit |
| Cryogenic volatiles; why methane is storable and hydrogen is not | **MECHANIC** | Boil-off, and the cryocooler that answers it |
| Where water/metals/volatiles actually are | **MECHANIC** | `data/places.js` — it decides what a port produces |
| Solar day length, seasons, terminator, polar night | Built, **unused** | `illumination.js` — real and tested, and the trade game never calls it |
| Radiation environments (Io vs Callisto) | **CARD** | `data/places.js` prose only |
| Planetary composition and interiors | **CARD** | `data/bodies.js` |

**Two findings worth acting on:**

1. **`illumination.js` is a fully built, tested astronomy engine that nothing
   uses.** Real solar day lengths, seasons from real axial tilt, the terminator,
   sun angle, polar night, retrograde rotators handled. It was written for the
   photo-survey game and survived the pivot without being reconnected. That is
   the cheapest astronomy win available — see §2b.
2. **Radiation and composition are the weakest area** — both are pure card text
   today, and both have obvious mechanical forms.

### 2b. The gaps, and the mechanic for each

Ordered by how much astronomy they buy per unit of work.

---

#### ① Sunlight falls as 1/r² — as a power budget

**The single most important missing mechanic**, and `design.md` §6 already
names it as the thing that should gate the outer system by itself.

- Sunlight at Jupiter is about 1/27th of Earth's; at Saturn about 1/90th.
- **Mechanic:** every site and every ship has a power budget. Solar arrays
  produce `P₀ / r²`. Past roughly Mars, arrays stop being viable and you need
  fission — which is a purchase, a mass penalty, and a licensing problem under
  some operators (the game already models nuclear as a *controlled* good).
- **What it teaches by costing you:** the inverse-square law, why the outer
  system is a genuinely different regime, and why "just add more panels" has a
  cliff rather than a slope.
- **Why it is cheap:** `r` is already computed every frame by `ephemeris.js`.
- **Grade: MECHANIC.** Reuses the reactor-parts commodity that already exists.

---

#### ② Real launch windows — phase angle as a schedule

The travel model currently flies an **ideal Hohmann every time**, regardless of
where the planets actually are. `transfer.js` can already find real windows by
stepping the real ephemeris; the trade game does not ask it to.

- **Mechanic:** a trip's Δv depends on the *current* phase angle. Leave at the
  window and it is cheap; leave off-window and you pay, steeply. The Course tab
  shows "next window: 4 months" beside each destination.
- **What it teaches:** the synodic period as a *lived* constraint rather than a
  number, and why real missions launch when they launch.
- **This also unblocks three things already deferred:** the Aldrin cycler (a
  moving port you must catch), the ion drive (whose entire payoff is that
  windows stop mattering — see the note in `propulsion.js`), and the
  wait-versus-go decision that `design.md` §3 calls the atom of the game.
- **Grade: MECHANIC.** The largest single build here, and the highest value.

---

#### ③ Inclination costs like distance

Pallas sits at ~35° inclination. It is *in* the Belt and brutally expensive to
reach, because a plane change is one of the most expensive manoeuvres there is.

- **Mechanic:** add an inclination term to `travelCost`. Pallas becomes the
  place you go to not be followed — expensive, and therefore useful.
- **What it teaches:** that orbits are three-dimensional, which a top-down
  orrery actively hides. This is the correction to our own map's simplification.
- **Grade: MECHANIC.** Small, and it makes an existing census entry meaningful.

---

#### ④ Reconnect `illumination.js` — the day as an operational constraint

- **Mechanic:** surface operations need light or stored power. Shackleton's
  crater floor has not seen the Sun in two billion years and its rim ridges are
  in near-continuous light — a few kilometres apart. Mars's Planum Boreum has
  six months of polar night to survive. Mercury's solar day is 176 Earth days.
- **What it teaches:** rotation, axial tilt, why "day" is not one thing.
- **Caveat, and it must be honoured:** the module's own header says rotational
  *phase* is not epoch-anchored — day *length* and *season* are real, which
  meridian faces the Sun on a given date is not. **So the game may teach the
  former and must not claim the latter.** Polar night: yes. "It is noon at
  Jezero right now": no.
- **Grade: MECHANIC**, with a hard accuracy boundary.

---

#### ⑤ Radiation as cargo mass

- Io's surface dose is lethal in about a day; Callisto sits mostly outside
  Jupiter's belt. That single fact decides where people can live in that system.
- **Mechanic:** shielding is mass, mass is Δv, and Δv is money. Crewed operations
  in a high-dose region need shielding or rotating crews; robots do not care.
  A dose meter that accumulates.
- **Grade: MECHANIC.** Turns the strongest card text in `data/places.js` into a
  cost.

---

#### ⑥ Spectroscopy as prospecting

The survey layer's founding rule is *you cannot build where you have not
surveyed*. Make the survey a real instrument rather than a flag.

- **Mechanic:** the survey lab returns a **spectrum**, and composition is read
  off absorption features. Different instruments see different things — imaging
  gives slope and hazard, near-IR spectroscopy gives hydration and minerals,
  thermal mapping finds the cold traps where ice survives, radar finds
  subsurface ice (this is literally how the Utopia Planitia sheet was found).
- **What it teaches:** that we know what things are made of *because of light*,
  which is the most transferable idea in the whole first semester.
- **Grade: INSTRUMENT.** And it is the bridge to semester two — the same
  instrument reads stars.

---

#### ⑦ Space weather, and information as a product

- CMEs are directional and take ~1–3 days to reach 1 AU, so a post at Sun–Earth
  L1 sees one *before* it arrives. This is what SOHO, ACE and DSCOVR actually do.
- **Mechanic:** a storm degrades electronics in transit, grounds departures, and
  spikes demand for parts. Holding L1 means selling the forecast.
- **Grade: MECHANIC.** The site atlas already lists L1 with this exact job.

---

## 3. Semester two — stellar astronomy

### 3a. Why it fits, which was not obvious

The worry with stellar astronomy in a solar-system game is that the content is
somewhere you cannot go. But that framing is wrong, and the correction is the
whole design:

> **Essentially all of stellar astronomy has been done from inside this solar
> system.** Not by travelling. By building instruments, putting them somewhere
> useful, pointing them, and waiting.

Building things, placing them where physics says they work, and waiting, is
**already the economy of this game**. Joshua's instinct — probes and satellites
and equipment — is exactly right, and it is stronger than it first appears:
stellar astronomy is not a bolt-on subject, it is a second industry with its own
supply chain, its own real estate, and its own commodity.

And the commodity already has a buyer. `data/operators.js` has an **Archive**, a
**university consortium**, and **itinerant surveyors**. `docs/site-atlas.md`
Part 5 already proposed that the Archive buys data. This closes that loop.

### 3b. The distance ladder is already a tech tree

This is the best single idea in this document, and I did not invent it — it is
the actual structure of OpenStax ch. 19, which builds distances in rungs where
each one must be calibrated by the one below it. That is a tech tree with a
physical dependency graph instead of an invented one.

| Rung | Method | What it needs | Reaches |
|---|---|---|---|
| 1 | **Radar ranging** | A transmitter and a nearby body | The solar system, in metres. Sets the AU. |
| 2 | **Parallax** | Two observations from far apart | Nearby stars |
| 3 | **Spectroscopic parallax** | An HR diagram calibrated by rung 2 | Most stars you can get a spectrum of |
| 4 | **Cepheids / RR Lyrae** | Long time-series photometry, calibrated by 2–3 | Distant clusters, other galaxies |
| 5 | **Type Ia supernovae** | A wide survey, patience, and luck | Cosmological distances |

**And here is the mechanic that makes it sing.**

Parallax precision is set by your **baseline**. From Earth, the baseline is 2 AU
— the diameter of Earth's orbit — and that is what every parallax measurement in
history has had to live with.

**You are not stuck with 2 AU.** Put an observing station at Jupiter and your
baseline is ~10 AU. At Neptune, ~60 AU. On a probe at 200 AU, two hundred.

> **The further out your instrument network reaches, the further into the galaxy
> you can see.** Distance measured scales linearly with baseline.

That is physically exact, it is a genuinely novel progression mechanic, and it
does something no other system in this game does: **it makes outer-system
expansion pay off in knowledge rather than cargo.** The outer system is
currently a place with poor economics and long transit times. This gives it a
reason to exist that the trade loop never could.

**Grade: INSTRUMENT**, and it is the spine of semester two the way the drive
eras are the spine of semester one.

### 3c. The HR diagram, discovered rather than shown

Every intro course puts the Hertzsprung–Russell diagram on a slide. It is the
single most important diagram in stellar astronomy and it is almost always
*presented*, which is the least memorable way to learn anything.

**Mechanic:** the player measures stars one at a time. Each measured star plots
a point on a diagram that starts **empty**. Temperature comes from colour or
spectral class; luminosity needs brightness *and distance*, so the distance
ladder is a hard prerequisite.

After a dozen stars: scatter. After forty: **a band appears.** The main sequence
is not announced; it *emerges from the player's own observations*, and then the
giants and the white dwarfs separate out as outliers that will not fit the band.

This is the best teaching opportunity in the entire project. It is the actual
historical discovery, reproduced by the player, using their own data. And it is
mechanically cheap: a scatter plot, a table of measurements, and patience.

**Grade: INSTRUMENT.** Highest teaching value per line of code in this document.

### 3d. Spectroscopy, the master instrument

One instrument, four products — which is exactly why it dominates real
astronomy, and why building it should feel like a milestone:

| Read from the spectrum | Gives you | Curriculum |
|---|---|---|
| Continuum shape / peak | Temperature (Wien) | Blackbody radiation |
| Absorption line pattern | Composition, spectral class **OBAFGKM** | Atomic physics, classification |
| Line **shift** | Radial velocity → binaries, exoplanets | Doppler effect |
| Line **width** | Rotation, pressure → luminosity class | Line broadening |

**Mechanic:** better spectrographs resolve more. A cheap one gives you a colour
and therefore a rough temperature; a good one gives you the class; an excellent
one gives you velocity precise enough to detect a planet.

**Grade: INSTRUMENT.**

### 3e. Stellar evolution, taught as a thing you cannot wait for

The pedagogical problem with stellar evolution is that nothing evolves on a
human timescale — and this game has a real clock, so it cannot cheat.

**The real answer is the one astronomers use: you do not watch one star, you
observe a population.** And the mechanic falls straight out of it:

- **Cluster turnoff dating.** Every star in a cluster formed at about the same
  time. Massive stars burn out first (lifetime scales roughly as M⁻²·⁵, because
  luminosity climbs far faster than mass does). So the main sequence of a cluster
  is *truncated* — and the point where it bends off tells you the cluster's age.
- **Mechanic:** observe enough stars in a cluster, find the turnoff, read the
  age. A puzzle with a real answer, solvable with the HR diagram the player
  already built, and it pays.
- **What it teaches:** stellar lifetimes, the mass–luminosity relation, and the
  idea that astronomy infers time from populations.

**Grade: INSTRUMENT.**

### 3f. Nucleosynthesis — the origin story of your own cargo manifest

"We are made of star stuff" is the most quoted line in astronomy and the least
load-bearing. Here it can be an **inventory property**.

| Where it came from | Elements | In your hold as |
|---|---|---|
| The Big Bang | H, He | Propellant feedstock, life support |
| Fusion in massive stars | C, O, Ne, Mg, Si | Structure, volatiles, organics |
| Core-collapse supernovae | O through the iron peak | Metals |
| Type Ia supernovae | Most of the iron | Refined metal |
| **Neutron-star mergers** (r-process) | Au, Pt, U, the rare heavies | The most valuable things you can carry |

**Mechanic:** every commodity carries its origin, and — this is the part that
does work — **the rare ones are rare *because* the process that made them is
rare.** Psyche is a stripped protoplanetary core with platinum-group metals at
the surface; the reason those are worth carrying across the solar system when ore
is not is a stellar-astronomy fact.

**Grade: MECHANIC** (it justifies the price list) **+ CARD** (the story).

### 3g. Exoplanets — three methods, three instruments

| Method | Needs | Finds |
|---|---|---|
| **Transit** | Photometric time series, many stars, patience | Radius; short-period planets |
| **Radial velocity** | High-resolution spectroscopy | Minimum mass |
| **Direct imaging** | Big aperture + coronagraph | Wide, young, bright planets |

Each biases toward different planets, which is *why* the known exoplanet
population looks the way it does. A player who runs all three and notices they
disagree has learned observational selection effects — arguably the single most
valuable transferable idea in the whole two semesters.

**Grade: INSTRUMENT.**

### 3h. The interstellar probe — Joshua's idea, costed honestly

There is a real mission study to build this on. NASA's Heliophysics Division
funded a two-year, $7M concept study at Johns Hopkins APL for an **Interstellar
Probe**: operate at **1000 AU**, **50-year design life**, reach the heliopause in
about 15 years at roughly **20 AU/year (~95 km/s)**, on no more than 600 W at the
start and half that by the end.

For comparison, Voyager 1 was at about **154 AU** in 2021, moving at ~17 km/s —
under 4 AU/year. It crossed the heliopause at ~121 AU in 2012.

**Why it is a superb fit for this specific game:** it is a decades-long
investment with a real clock already running, a payoff that arrives long after
you launched it, and a set of failure modes that are all real physics.

**Mechanics, all of them true:**

- **RTG decay.** Plutonium-238 has an 87.7-year half-life, so power falls about
  0.8% a year. The probe's instruments must be shed one by one as the budget
  shrinks — *which instrument do you turn off?* is a genuine decision made
  decades after launch.
- **The link budget falls as 1/r².** Data rate drops with distance. At some
  point you are choosing between images and everything else.
- **Growing light-lag,** on the mechanic the game already has. At 1000 AU, one
  way is nearly six days.
- **What it actually returns:** the local interstellar medium measured *in situ*,
  the heliosphere's shape from *outside* it, dust flux — and a parallax baseline
  of hundreds of AU (§3b).

**Grade: MECHANIC + INSTRUMENT.** And it is the natural campaign capstone: the
thing you build when you no longer need Earth.

### 3i. What we should NOT do

Saying no is the reason the rest of this is buildable.

- **Galaxies, cosmology, the Big Bang** (OpenStax ch. 26–30). Real astronomy,
  wrong game. A player with a good telescope may *see* other galaxies as a card;
  they should not be a system. The brief said stellar, and the brief is right.
- **General relativity beyond a mention.** Black holes can be an observation
  target; curved spacetime cannot be a mechanic here.
- **Any screen that asks the player to do algebra.** Instruments produce
  measurements; the *game* does the arithmetic. `design.md` pillar 5 — approachability — is
  the whole differentiator, and this document is the single biggest threat to it.
- **Made-up measurements.** Better to have three real instruments than ten that
  return plausible fiction.

---

## 4. The instrument ladder

Where you build it matters physically. That is the point — this is real estate
with a reason, exactly like the trade sites.

| Instrument | Must be | Because | Measures | Unlocks |
|---|---|---|---|---|
| Optical telescope | Anywhere above atmosphere | No seeing, no absorption | Brightness, colour | Photometry, transits |
| Spectrograph | With a telescope | — | Composition, temperature, velocity | Class, binaries, exoplanets |
| **Radio array** | **Lunar far side** | 3,500 km of rock blocks every transmitter humanity has — the only radio-quiet zone near Earth | Radio sources, pulsars | Timing, the ISM |
| Infrared telescope | **Sun–Earth L2** | Permanent shadow-cold, full-sky view (where JWST sits) | Cold dust, protostars, redshift | Star formation |
| **Long-baseline node** | **As far out as you can reach** | Parallax scales with baseline | Distances | §3b — the ladder |
| Coronagraph | With a big aperture | Blocks the star to see the planet | Direct images | Exoplanets |
| Solar monitor | **Sun–Earth L1** | Sees a CME before it arrives | Space weather | Forecasts as a product |
| Interstellar probe | Outbound, decades | In-situ or nothing | The ISM, the heliopause from outside | The capstone |

Every one of those locations is already in `docs/site-atlas.md` as a real place
with a real hook. **The census was written before this document and already
contains its real estate**, which is a good sign that the two designs agree.

---

## 5. Data as a commodity

The mechanism that turns all of this into economics rather than a museum:

- **Observations are cargo.** A measurement is a thing you own, can carry, and
  can sell — to the Archive, the university consortium, or a rival who would
  rather you had not made it.
- **Novelty prices it.** The first parallax of a given star is worth a great
  deal; the ninth is worth nothing. This is real academic economics and it makes
  a survey a land grab.
- **Light-lag applies to data too.** Your measurement from Neptune takes four
  hours to reach a buyer at Earth. Someone nearer may sell it first.
- **Knowledge is capability, literally** — `design.md` §1's chain, finally closed:
  measure a star → calibrate a rung → reach further → find something → sell it →
  fund the next instrument.

---

## 6. Honest accounting

Counting **MECHANIC** and **INSTRUMENT** only, and counting CARD as zero.

| | Already taught | With this plan | Never |
|---|---|---|---|
| **Semester 1 — Solar system** | ~60% | **~90%** | Planetary geology detail, atmospheric chemistry |
| **Semester 2 — Stellar** | ~0% | **~65%** | Galaxies, cosmology, GR, stellar interiors maths |

The stellar 65% is: distances, parallax, the magnitude/luminosity distinction,
blackbody radiation and temperature, spectral classification, the HR diagram,
the mass–luminosity relation, stellar lifetimes, cluster ages, binaries,
variables, nucleosynthesis, the ISM, exoplanets and selection effects.

What is left out of that 65% is mostly **stellar interiors** — hydrostatic
equilibrium, energy transport, the actual fusion chains — which is the part of
the course that is genuinely mathematical and has no observational hook a player
could hold. It can be a card. It should not be a system.

---

## 7. What to build first

Phased so every step is independently shippable, per `design.md` §14 pillar 7.

**Phase 1 — finish semester one** (all small, all wanted anyway)
1. Inverse-square power budget (§2b①) — gates the outer system, as intended
2. Real launch windows (§2b②) — the big one; unblocks the cycler and the ion drive
3. Inclination cost (§2b③) — tiny; makes Pallas mean something
4. Reconnect `illumination.js` (§2b④) — already built and tested

**Phase 2 — the first instrument**
5. The observatory as a buildable site, with an optical telescope
6. Photometry: brightness and colour → temperature
7. **Parallax from a two-station baseline** — the first rung, and the proof of §3b

**Phase 3 — the diagram**
8. Spectroscopy → spectral class
9. The HR diagram screen, starting empty and filling with the player's own stars
10. The Archive buys data; novelty sets the price

**Phase 4 — depth**
11. Cluster turnoff dating
12. Exoplanet detection, all three methods
13. Long-baseline nodes in the outer system

**Phase 5 — the capstone**
14. The interstellar probe, with RTG decay and a shrinking link budget

**Before any of it:** the content rule. Every star that appears must be a **real
star with real catalogued values** — the same standard `ephemeris.js` holds
itself to. A generated star with a plausible spectrum would undo the entire
premise. The Hipparcos/Gaia bright-star data is public and small enough to ship,
and it is the direct equivalent of what `scripts/gen-geography.mjs` does for
Shutterbug.

---

## 8. The one risk worth naming

This document roughly doubles the science surface of the game, and
`design.md` §15 says complexity is the mortal risk — that the niche is
*approachable*, and a screen needing a spreadsheet means we have lost.

The defence is the grading in §0. **An instrument that returns a number the game
then uses for you is approachable. An instrument that hands the player a formula
is not.** The HR diagram should fill itself in from measurements; the player's
job is deciding *where to point the telescope and what to do with what it found*
— which is the same decision they already make about cargo.

Same game underneath. Bigger numbers, and a longer view.

---

## Sources

- [OpenStax *Astronomy 2e*, via LibreTexts](https://phys.libretexts.org/Bookshelves/Astronomy__Cosmology/Astronomy_2e_(OpenStax)) — the 31-chapter spine used throughout
- [*Astronomy 2e* ch. 19, Celestial Distances](https://phys.libretexts.org/Bookshelves/Astronomy__Cosmology/Astronomy_2e_(OpenStax)/19%3A_Celestial_Distances) — the distance-ladder structure of §3b
- [Interstellar Probe (JHUAPL / NASA concept study)](https://interstellarprobe.jhuapl.edu/Science/) — 1000 AU, 50-year life, the mission §3h is built on
- [Interstellar Probe: Pushing Beyond Voyager — Centauri Dreams](https://www.centauri-dreams.org/2021/10/05/interstellar-probe-pushing-beyond-voyager/) — flyout speed, power budget, Voyager comparison
- [A Concept of Operations for an Interstellar Probe Mission (IEEE)](https://ieeexplore.ieee.org/document/9843219/)

Everything asserted here must still be checked against a primary source before
it becomes player-facing text (project rule 2 / `design.md` §16). This document
is a plan, not shipped content.
