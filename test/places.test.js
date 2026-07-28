// ===========================================================================
// PLACE COORDINATES — generated from the IAU gazetteer, and checked against
// facts a person can verify without the gazetteer.
//
// This is the one file in the project where a wrong number would be both
// invisible and educationally fatal: a crater in the wrong hemisphere looks
// exactly like a crater in the right one. So the tests are not "does it parse"
// — they are ground truth a reader can check for themselves:
//
//   Shackleton is AT the lunar south pole. Apollo 11 landed at 0.67°N 23.47°E.
//   Perseverance is in Jezero at 18.4°N. Hellas is the southern basin, Utopia
//   the northern plains. Enceladus's tiger stripes are around its south pole.
//
// And the structural rule that matters as much: HALF THE CENSUS HAS NO
// COORDINATE, because half of it is orbits and regions rather than points on a
// globe. Anything that ever gives Low Earth orbit a latitude has invented one.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { PLACE_COORDS, hasSurface, coordsFor } from "../src/data/place-coords.js";
import { PLACES, PLACE_BY_ID } from "../src/data/places.js";
import { MOONS, BELT_BODIES } from "../src/data/bodies.js";
import { bodyOf } from "../src/surface.js";

describe("the coordinates are real", () => {
  it("Shackleton is at the lunar south pole, where the ice is", () => {
    expect(PLACE_COORDS.shackleton.lat).toBeLessThan(-85);
    expect(PLACE_COORDS.shackleton.iauName).toBe("Shackleton");
  });

  it("Tranquility Base is where Apollo 11 actually landed", () => {
    const c = PLACE_COORDS.tranquility;
    expect(c.lat).toBeCloseTo(0.67, 1);
    expect(c.lonE).toBeCloseTo(23.47, 1);
  });

  it("Jezero is where Perseverance is sitting", () => {
    const c = PLACE_COORDS["jezero-station"];
    expect(c.lat).toBeCloseTo(18.4, 0);
    expect(c.lonE).toBeCloseTo(77.7, 0);
  });

  it("Mars's basins are in the hemispheres they are in", () => {
    expect(PLACE_COORDS.hellas.lat).toBeLessThan(-30);        // southern
    expect(PLACE_COORDS["utopia-ice"].lat).toBeGreaterThan(30); // northern
    expect(PLACE_COORDS.valles.lat).toBeLessThan(0);          // just south of the equator
    expect(PLACE_COORDS.valles.lat).toBeGreaterThan(-25);
  });

  it("the far-southern features are far south", () => {
    expect(PLACE_COORDS.enceladus.lat).toBeLessThan(-70);   // the tiger stripes
    expect(PLACE_COORDS.vesta.lat).toBeLessThan(-60);       // Rheasilvia
  });

  it("Daedalus really is on the lunar far side", () => {
    // The far side is the hemisphere centred on 180°. Radio quiet lives here.
    expect(Math.abs(PLACE_COORDS["luna-farside"].lonE)).toBeGreaterThan(90);
  });
});

describe("every coordinate is well formed", () => {
  it("latitudes are latitudes and longitudes are signed east", () => {
    for (const [id, c] of Object.entries(PLACE_COORDS)) {
      expect(c.lat, id).toBeGreaterThanOrEqual(-90);
      expect(c.lat, id).toBeLessThanOrEqual(90);
      expect(c.lonE, id).toBeGreaterThanOrEqual(-180);
      expect(c.lonE, id).toBeLessThanOrEqual(180);
      expect(c.iauName, id).toBeTruthy();
      expect(c.target, id).toMatch(/^[A-Z]+$/);
    }
  });

  it("every coordinate belongs to a place that exists", () => {
    const ids = new Set(PLACES.map((p) => p.id));
    for (const id of Object.keys(PLACE_COORDS)) {
      expect(ids.has(id), `${id} is not in PLACES`).toBe(true);
    }
  });
});

describe("what has no coordinate, and why", () => {
  // The structural claim. An orbit is not a point on a globe, and the moment
  // something hands one a latitude, it has been invented.
  it("orbits, Lagrange points and regions have none — and must not", () => {
    for (const id of ["leo", "geo-graveyard", "se-l1", "em-l2", "se-l3",
      "aldrin-cycler", "kirkwood", "trojan-camp", "van-allen", "areostationary"]) {
      expect(hasSurface(id), `${id} should have no surface coordinate`).toBe(false);
      expect(coordsFor(id)).toBe(null);
    }
  });

  it("roughly half the census is surface and half is not", () => {
    const placed = Object.keys(PLACE_COORDS).length;
    expect(placed).toBeGreaterThan(20);
    expect(placed).toBeLessThan(PLACES.length);
  });

  it("coordsFor is null rather than undefined for an unknown id", () => {
    expect(coordsFor("no-such-place")).toBe(null);
    expect(hasSurface("no-such-place")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// `body` MEANS THE WORLD IT IS ON OR ORBITS
//
// The field drifted into meaning "the nearest charted thing", which read fine in
// a list and was wrong the moment the system view started drawing moons on real
// orbits: a settlement was pinned to a world it does not go round. Four entries
// were wrong; these pin all four by name so the drift cannot come back quietly.
// ---------------------------------------------------------------------------
describe("every place names the world it is actually on", () => {
  const by = (id) => PLACE_BY_ID[id];

  it("puts Sputnik Planitia on Pluto, not on Charon", () => {
    // The one that is simply a mistake rather than a convention: it is a
    // nitrogen glacier on Pluto's surface, and it was filed under its moon.
    expect(by("sputnik").body).toBe("pluto");
    expect(by("sputnik").kind).toBe("surface");
  });

  it("puts the three outer anchorages around their primary", () => {
    // Himalia and Phoebe are moons of Jupiter and Saturn in their own right —
    // they are absent from MOONS only because we hold no sourced elements for
    // them. The ring mines are in Saturn's rings. None of the three orbits the
    // moon they used to be filed under.
    expect(by("himalia").body).toBe("jupiter");
    expect(by("phoebe-gate").body).toBe("saturn");
    expect(by("ring-camps").body).toBe("saturn");
  });

  it("never names a body outside its own system", () => {
    // The general guard behind the four specifics: a place's body must be its
    // system's primary, a charted moon of that system, or a named belt body.
    const belt = new Set(BELT_BODIES.map((b) => b.id));
    for (const p of PLACES) {
      if (!p.body) continue;                       // orbits and regions: fine
      const charted = new Set((MOONS[p.system] || []).map((m) => m.id));
      const ok = p.body === p.system || charted.has(p.body) || belt.has(p.body);
      expect(ok, `${p.id} says body "${p.body}" in system "${p.system}"`).toBe(true);
    }
  });

  it("agrees with the gazetteer wherever the gazetteer has an opinion", () => {
    // place-coords.js knows which world each surface feature is really on,
    // straight from the IAU. Where both exist they must not disagree — that
    // disagreement is exactly how the Sputnik error survived.
    for (const [placeId] of Object.entries(PLACE_COORDS)) {
      const p = PLACE_BY_ID[placeId];
      if (!p || p.kind !== "surface") continue;
      expect(bodyOf(placeId), `${placeId}`).toBe(p.body);
    }
  });
});
