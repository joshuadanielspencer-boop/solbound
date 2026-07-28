// ===========================================================================
// SURFACE — the third level of the map.
//
// What these tests are actually defending, in order of how badly each one hurt
// when it was wrong:
//
//   1. THE SEAM. Plates are centred on 0° longitude, coordinates are signed
//      east, and the survey-era view projected `lonE / 360` as though 0° were
//      the left edge. Everything looked plausible and every pin was half a world
//      out. The projection is pinned against known features here, on the plate
//      as it actually ships.
//   2. THE BODY. A port's world comes from the gazetteer's target, not from a
//      place's `body` field, which means "nearest charted anchor" and files
//      Sputnik Planitia under Charon.
//   3. THE ACCURACY BOUNDARY. day length and season amplitude are real; phase
//      is not. `phaseAnchored` must stay false until somebody wires the IAU
//      rotational elements, and a body with no rotation model must report the
//      gap rather than a confident "in daylight".
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  surfaceReport, bodyOf, hasSurfaceMap, hasPlate, bodyName, nightOutlines,
  polarNight, seasonAmplitude, mappedBodiesWithPorts, MAPPED,
} from "../src/surface.js";
import { nightSpans, isLit, sunAltitude } from "../src/illumination.js";
import { periodDays } from "../src/ephemeris.js";
import { PLACE_COORDS } from "../src/data/place-coords.js";
import { LANDMARKS, landmarksFor } from "../src/data/landmarks.js";
import { ROTATION } from "../src/data/bodies.js";
import { spawnSites } from "../src/worldgen.js";

const DAY = 86400000;

// The projection the surface view uses, repeated here so the arithmetic is
// under test rather than only under a component. −180 at the left edge, +180 at
// the right, matching every plate in public/plates/.
const fx = (lonE) => ((((lonE + 180) % 360) + 360) % 360) / 360;
const fy = (lat) => (90 - lat) / 180;

describe("the projection — where a coordinate lands on the plate", () => {
  it("puts 0° longitude in the middle and the poles at the edges", () => {
    expect(fx(0)).toBeCloseTo(0.5, 6);
    expect(fx(-180)).toBeCloseTo(0, 6);
    expect(fy(90)).toBeCloseTo(0, 6);
    expect(fy(-90)).toBeCloseTo(1, 6);
    expect(fy(0)).toBeCloseTo(0.5, 6);
  });

  it("lands Hellas Planitia where Hellas Planitia visibly is on mars.jpg", () => {
    // The check that caught the bug: the bright oval on the Mars plate sits a
    // little under 70% across and a little under three quarters down. Under the
    // OLD convention (lonE / 360) it would be at 20% across — nowhere near it.
    const { lat, lonE } = PLACE_COORDS.hellas;
    expect(fx(lonE)).toBeCloseTo(0.696, 2);
    expect(fy(lat)).toBeCloseTo(0.736, 2);
    expect(lonE / 360).toBeCloseTo(0.196, 2);      // what the old code computed
  });

  it("keeps the lunar south-polar craters at the bottom of the plate", () => {
    // Shackleton is at −89.67° and Shoemaker at −88.14°, so both must land in
    // the last ~1% of the frame whatever their longitude. This is why the plate
    // had to be one with its poles filled in: the other public-domain candidate
    // has black unimaged bands exactly here.
    expect(fy(PLACE_COORDS.shackleton.lat)).toBeGreaterThan(0.998);
    expect(fy(PLACE_COORDS["shoemaker-rest"].lat)).toBeGreaterThan(0.989);
  });

  it("wraps a 0–360 longitude to the same place as its signed twin", () => {
    // nightSpans() works in 0..360 and the coordinates are signed; both go
    // through one projection, so the two conventions must agree.
    expect(fx(310)).toBeCloseTo(fx(-50), 9);
    expect(fx(180)).toBeCloseTo(fx(-180), 9);
  });
});

describe("which world a place is on", () => {
  it("reads the gazetteer's target, not the census's anchor field", () => {
    // The case that proves the point: places.js files Sputnik Planitia under
    // `body: "charon"`. It is on Pluto.
    expect(bodyOf("sputnik")).toBe("pluto");
    expect(bodyOf("shackleton")).toBe("luna");
    expect(bodyOf("jezero-station")).toBe("mars");
    expect(bodyOf("phobos-depot")).toBe("phobos");
  });

  it("returns null for a place that is not on any surface", () => {
    // Low Earth orbit, the Lagrange points, the cyclers — real places, no
    // latitude, and place-coords.js deliberately holds no entry for them.
    expect(bodyOf("gateway")).toBeNull();
    expect(bodyOf("nowhere-at-all")).toBeNull();
  });
});

describe("the landmark data", () => {
  it("covers every body that any placed port sits on", () => {
    const bodies = new Set(Object.keys(PLACE_COORDS).map(bodyOf));
    for (const b of bodies) expect(hasSurfaceMap(b)).toBe(true);
  });

  it("never repeats a port's own feature as scenery", () => {
    // A port draws itself; drawing it twice would put a nameless ring under
    // its pin and read as two different places at the same coordinate.
    const ports = new Set(
      Object.entries(PLACE_COORDS).map(([id, c]) => `${bodyOf(id)}/${c.iauName}`),
    );
    for (const [bodyId, list] of Object.entries(LANDMARKS)) {
      for (const l of list) {
        expect(ports.has(`${bodyId}/${l.name}`), `${bodyId}/${l.name}`).toBe(false);
      }
    }
  });

  it("holds coordinates in signed east, in range, on every body", () => {
    for (const [bodyId, list] of Object.entries(LANDMARKS)) {
      for (const l of list) {
        expect(l.lonE, `${bodyId}/${l.name}`).toBeGreaterThanOrEqual(-180);
        expect(l.lonE, `${bodyId}/${l.name}`).toBeLessThanOrEqual(180);
        expect(Math.abs(l.lat), `${bodyId}/${l.name}`).toBeLessThanOrEqual(90);
        expect(l.name).toBe(l.name.trim());        // the gazetteer has stray spaces
      }
    }
  });

  it("is sorted largest first, which is what makes the top of the list a map", () => {
    for (const list of Object.values(LANDMARKS)) {
      const d = list.map((l) => l.diameterKm || 0);
      expect([...d].sort((a, b) => b - a)).toEqual(d);
    }
  });

  it("gives even the thinnest world what it actually has", () => {
    // Deimos has two named features in the entire gazetteer and one of them is
    // a port. One landmark is the honest answer, not a bug.
    expect(landmarksFor("deimos").length).toBe(1);
    expect(landmarksFor("luna").length).toBe(20);
    expect(landmarksFor("nosuchbody")).toEqual([]);
  });

  it("earns its type cap: Mars gets a volcano, not twenty terrae", () => {
    // Ranking by diameter alone returns Terra Cimmeria (5,856 km) down to
    // Margaritifer Terra and no volcano at all, because Olympus Mons is 610 km.
    const mars = landmarksFor("mars").map((l) => l.type);
    expect(mars.filter((t) => t.startsWith("Terra")).length).toBeLessThanOrEqual(3);
    expect(new Set(mars).size).toBeGreaterThan(5);
  });
});

describe("the surface report", () => {
  const sites = spawnSites(42);

  it("places only the ports that are actually on that body", () => {
    const rep = surfaceReport("luna", sites, Date.UTC(2036, 0, 1));
    expect(rep.ports.length).toBeGreaterThan(0);
    for (const p of rep.ports) expect(bodyOf(p.id)).toBe("luna");
    // Shackleton is a core site, so it is on the Moon in every run.
    expect(rep.ports.map((p) => p.id)).toContain("shackleton");
  });

  it("carries the real coordinate and the IAU's own name for it", () => {
    const rep = surfaceReport("mars", sites, 0);
    const jezero = rep.ports.find((p) => p.id === "jezero-station");
    expect(jezero.lat).toBeCloseTo(18.41, 2);
    expect(jezero.iauName).toBe("Jezero");
  });

  it("returns null for a body we hold no geography for", () => {
    expect(surfaceReport("jupiter", sites, 0)).toBeNull();
    expect(surfaceReport("psyche", sites, 0)).toBeNull();
  });

  it("never claims an anchored phase", () => {
    // The one flag that stops this screen becoming a lie. illumination.js has
    // real rates off an arbitrary zero; until the IAU rotational elements go in,
    // this stays false and the view prints the caveat.
    for (const b of MAPPED) {
      const rep = surfaceReport(b, sites, Date.UTC(2040, 5, 5));
      if (rep) expect(rep.phaseAnchored).toBe(false);
    }
  });

  it("now has a rotation model for every world it can draw", () => {
    // It did not. Ceres and Vesta are ports and were absent from ROTATION, so
    // their maps drew flat-lit with no terminator and said so. Their periods and
    // poles came from JPL on 2026-07-28 (see data/bodies.js). This asserts the
    // gap is closed and would catch a new mapped body arriving without one.
    for (const b of MAPPED) {
      const rep = surfaceReport(b, sites, Date.UTC(2040, 5, 5));
      expect(rep.rotationKnown, `${b} has no rotation model`).toBe(true);
      expect(rep.solarDay, `${b} cannot say how long its day is`).toBeTruthy();
    }
  });

  it("still reports an unknown rotation as unknown rather than as daylight", () => {
    // The branch has no live caller now that all seventeen worlds have a model,
    // and it stays because the alternative is what it replaced: isLit()'s own
    // fallback returns TRUE — right for "don't block a photograph", wrong for a
    // map that states facts. Exercised directly so it cannot rot.
    expect(ROTATION.psyche).toBeUndefined();
    expect(polarNight("psyche", 0)).toBeNull();
    expect(seasonAmplitude("psyche")).toBeNull();
  });

  it("runs Ceres's seasons on Ceres's year, not on Earth's", () => {
    // The bug that giving Ceres a rotation model exposed, and that the UI smoke
    // test caught within minutes: illumination.js asks the ephemeris for a
    // body's year, ELEMENTS holds the nine planets and nothing else, and it
    // THREW rather than falling back — a blank screen instead of a wrong number.
    //
    // Measure the season's PERIOD, not how much of the swing fits in a window.
    // My first attempt did the latter and failed against correct code: the
    // sub-solar latitude peaks a quarter of the way round a year, so 365 days of
    // a 1,680-day year already covers 98% of the swing. Half a year to the first
    // return to the equator is the quantity that actually differs.
    const halfYear = (bodyId) => {
      const at = (d) => surfaceReport(bodyId, sites, d * DAY).subsolarLatDeg;
      const sign0 = Math.sign(at(1));
      for (let d = 2; d < 4000; d += 2) if (Math.sign(at(d)) !== sign0) return d;
      return null;
    };
    expect(halfYear("ceres")).toBeGreaterThan(700);      // ~840; an Earth year would give ~182
    expect(halfYear("ceres")).toBeLessThan(1000);
    expect(halfYear("vesta")).toBeGreaterThan(550);      // ~665
    expect(halfYear("vesta")).toBeLessThan(800);
  });

  it("agrees with the ephemeris where the ephemeris has an opinion", () => {
    // Ceres doubles as the Asteroid Belt's ephemeris key, so ELEMENTS does carry
    // it — 1683.1 days against the 1680 quoted from JPL. The stored value wins
    // (it is the sourced one), and the two agreeing to 0.2% is the cross-check
    // that neither is a typo.
    expect(periodDays("ceres")).toBeCloseTo(1680, -1);
    expect(periodDays("vesta")).toBeNull();              // not a planet; must not throw
  });
});

describe("the night side, as an outline", () => {
  // Drawn as one rectangle per column the terminator is a visible staircase,
  // because near the terminator a few degrees of longitude move the boundary a
  // long way in latitude. These pin the two things joining them up can break.

  it("returns TWO regions when the darkness straddles the ±180 seam", () => {
    // One polygon spanning the seam would draw a band straight across the
    // daylight, because the map's left and right edges are not adjacent.
    // 150°E through 210°E is one continuous band on the globe and TWO bands on
    // the map, because the map is cut at ±180. (Darkness spanning 330°→30°, by
    // contrast, is continuous on both, and is the case below.)
    const polys = nightOutlines([
      { lon0: 150, lon1: 180, latFrom: 90, latTo: -90 },
      { lon0: 180, lon1: 210, latFrom: 90, latTo: -90 },
    ]);
    expect(polys.length).toBe(2);
    const spanOf = (p) => [Math.min(...p.map((v) => v.lonE)), Math.max(...p.map((v) => v.lonE))];
    const sides = polys.map(spanOf).sort((a, b) => a[0] - b[0]);
    expect(sides[0]).toEqual([-180, -150]);      // hugs the left edge
    expect(sides[1]).toEqual([150, 180]);        // hugs the right edge
  });

  it("keeps darkness that crosses 0° as ONE region", () => {
    // The mirror of the case above, and the one a naive seam fix breaks:
    // 330°E → 30°E is contiguous on the map and must not be split.
    const polys = nightOutlines([
      { lon0: 330, lon1: 360, latFrom: 90, latTo: -90 },
      { lon0: 0, lon1: 30, latFrom: 90, latTo: -90 },
    ]);
    expect(polys.length).toBe(1);
    expect(Math.min(...polys[0].map((v) => v.lonE))).toBe(-30);
    expect(Math.max(...polys[0].map((v) => v.lonE))).toBe(30);
  });

  it("splits on a genuine gap of daylight too", () => {
    // At equinox illumination.js emits nothing at all for the lit columns, so
    // the present columns are not contiguous and must not be joined.
    const polys = nightOutlines([
      { lon0: 0, lon1: 10, latFrom: 90, latTo: -90 },
      { lon0: 120, lon1: 130, latFrom: 90, latTo: -90 },
    ]);
    expect(polys.length).toBe(2);
  });

  it("reaches the poles the spans reach, and no further", () => {
    const t = Date.UTC(2037, 3, 3);
    const spans = nightSpans("mars", t, 180);
    const polys = nightOutlines(spans);
    const lats = polys.flat().map((p) => p.lat);
    expect(Math.max(...lats)).toBeLessThanOrEqual(90);
    expect(Math.min(...lats)).toBeGreaterThanOrEqual(-90);
    // Every span survives into some polygon — nothing is silently dropped.
    expect(polys.reduce((n, p) => n + p.length, 0)).toBe(spans.length * 2 + polys.length * 4);
  });

  it("covers a lit point nowhere and a dark point somewhere", () => {
    // The claim the picture makes has to match the claim the pin makes. Sample
    // the polygons as a point-in-polygon test against isLit() itself.
    const t = Date.UTC(2037, 6, 20);
    const polys = nightOutlines(nightSpans("mars", t, 180));
    const inside = (lat, lonE) => polys.some((poly) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.lonE > lonE) !== (b.lonE > lonE)
          && lat < ((b.lat - a.lat) * (lonE - a.lonE)) / (b.lonE - a.lonE) + a.lat) hit = !hit;
      }
      return hit;
    });
    let agree = 0, total = 0;
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let lon = -170; lon <= 170; lon += 20) {
        total++;
        // The polygon boundary is a piecewise approximation of a curve, so a
        // sample landing within a degree of the terminator may legitimately
        // disagree; everything else must not.
        if (Math.abs(sunAltitude("mars", lat, lon, t)) < 3) { agree++; continue; }
        if (inside(lat, lon) === !isLit("mars", lat, lon, t)) agree++;
      }
    }
    expect(agree).toBe(total);
  });
});

describe("seasons and polar night — the part that is genuinely real", () => {
  it("gives each body the amplitude its axial tilt actually has", () => {
    expect(seasonAmplitude("mars")).toBeCloseTo(25.19, 2);
    expect(seasonAmplitude("mercury")).toBeCloseTo(0.034, 3);
    // Retrograde rotators are upside down; the tilt that matters is the
    // supplement, so Venus's 177.36° is a 2.64° season, not a 177° one.
    expect(seasonAmplitude("venus")).toBeCloseTo(2.64, 2);
    expect(seasonAmplitude("pluto")).toBeCloseTo(57.47, 2);
  });

  it("opens a polar circle at 90° minus the sub-solar latitude", () => {
    // Whatever the (unanchored) phase, the geometry must hold: the dark cap
    // reaches from the pole down to 90° − |β|, in the hemisphere tilted away.
    let found = null;
    for (let d = 0; d < 700 && !found; d += 7) {
      const pn = polarNight("mars", d * DAY);
      if (pn && pn.fromLat < 80) found = pn;
    }
    expect(found).not.toBeNull();
    expect(found.fromLat).toBeGreaterThan(90 - 25.19 - 0.01);
    expect(["north", "south"]).toContain(found.hemisphere);
  });

  it("gives a body with no tilt no polar night worth the name", () => {
    // Mercury's 0.034° means its polar circle never reaches below 89.97°, which
    // is why its cold traps are about crater walls and not about seasons.
    for (let d = 0; d < 400; d += 11) {
      const pn = polarNight("mercury", d * DAY);
      if (pn) expect(pn.fromLat).toBeGreaterThan(89.9);
    }
  });

  it("gives Ceres and Vesta the tilts JPL's poles imply", () => {
    // Derived, not quoted — see data/bodies.js and test/bodies.test.js, which
    // re-does the arithmetic. Here it only has to reach the map.
    expect(seasonAmplitude("ceres")).toBeCloseTo(4.05, 1);
    expect(seasonAmplitude("vesta")).toBeCloseTo(27.47, 1);
    // Vesta tilts far enough to have a real polar night; Ceres barely does,
    // which is why its poles hold ice and its equator does not.
    let vestaCap = null;
    for (let d = 0; d < 1400 && !vestaCap; d += 20) {
      const pn = polarNight("vesta", d * DAY);
      if (pn && pn.fromLat < 70) vestaCap = pn;
    }
    expect(vestaCap, "Vesta should reach a deep polar night within its year").not.toBeNull();
  });
});

describe("plumbing", () => {
  it("knows which bodies ship with a photographic plate", () => {
    expect(hasPlate("luna")).toBe(true);
    expect(hasPlate("mars")).toBe(true);
    expect(hasPlate("titan")).toBe(false);        // Commons' best mosaic is not PD
    expect(hasSurfaceMap("titan")).toBe(true);    // but it still gets a map
  });

  it("names a body wherever in the data it lives", () => {
    expect(bodyName("mars")).toBe("Mars");
    expect(bodyName("luna")).toBe("The Moon");
    expect(bodyName("ceres")).toBe("Ceres");
  });

  it("lists the worlds a given run has anything on", () => {
    const bodies = mappedBodiesWithPorts(spawnSites(42));
    expect(bodies).toContain("luna");
    expect(bodies).toContain("mars");
    for (const b of bodies) expect(hasSurfaceMap(b)).toBe(true);
  });
});
