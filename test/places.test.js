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
import { PLACES } from "../src/data/places.js";

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
