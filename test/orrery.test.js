// ===========================================================================
// ORRERY PROJECTION — the map's one deliberate lie, and its limits.
//
// The playable map compresses radius logarithmically so the inner planets are
// legible. That is a lie of convenience, and these tests pin exactly how far it
// is allowed to go:
//
//   1. ANGLE IS NEVER TOUCHED. Every transfer window, every opposition, every
//      "who is lined up with whom" is an angle. Compressing radius is a
//      simplification; bending angle would be a falsehood, and the whole
//      educational claim rests on the difference.
//   2. THE SOLAR SYSTEM RUNS ANTICLOCKWISE seen from the Sun's north pole.
//      Getting this backwards draws a system that looks perfect and runs in
//      reverse, which is the kind of bug nobody notices for a year.
//   3. ORDER IS PRESERVED. A compression that ever put Mars outside Jupiter
//      would teach something false about the arrangement of the planets.
//   4. TRUE SCALE IS ACTUALLY TRUE. If the "honest" view is not exactly linear
//      it is worse than not having one, because it claims to be the truth.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { logRadius, linearRadius, project, orbitPath, trueScaleFacts, sayLightTime, sayDistance } from "../src/orrery.js";

const OPTS = { cx: 500, cy: 500, radius: 448 };
const AU = {
  mercury: 0.387, venus: 0.723, earth: 1.0, mars: 1.524, belt: 2.77,
  jupiter: 5.20, saturn: 9.58, uranus: 19.2, neptune: 30.07, pluto: 39.5,
};
const ORDER = ["mercury", "venus", "earth", "mars", "belt", "jupiter", "saturn", "uranus", "neptune", "pluto"];

describe("the compression is a simplification, not a falsehood", () => {
  it("leaves angle completely alone", () => {
    for (const lon of [0, 37, 90, 180, 271, 359]) {
      for (const au of [0.4, 1, 5, 30]) {
        for (const trueScale of [false, true]) {
          const p = project(au, lon, { ...OPTS, trueScale });
          const back = ((Math.atan2(500 - p.y, p.x - 500) * 180) / Math.PI + 360) % 360;
          expect(back, `${au} AU at ${lon}°`).toBeCloseTo(lon % 360, 6);
        }
      }
    }
  });

  it("runs anticlockwise, the way the planets actually go", () => {
    // Increasing ecliptic longitude must move a body counter-clockwise on
    // screen, which in SVG's y-down space means y DECREASES from 0° to 90°.
    const a = project(1, 0, OPTS), b = project(1, 90, OPTS);
    expect(a.x).toBeGreaterThan(500);          // 0° is to the right
    expect(a.y).toBeCloseTo(500, 6);
    expect(b.y).toBeLessThan(500);             // 90° is UP the screen
    expect(b.x).toBeCloseTo(500, 6);
  });

  it("never reorders the planets", () => {
    for (const scale of [logRadius, linearRadius]) {
      for (let i = 1; i < ORDER.length; i++) {
        expect(scale(AU[ORDER[i]]), `${ORDER[i]} vs ${ORDER[i - 1]}`)
          .toBeGreaterThan(scale(AU[ORDER[i - 1]]));
      }
    }
  });

  it("puts the Sun exactly at the centre with no special case", () => {
    expect(logRadius(0)).toBe(0);
    expect(linearRadius(0)).toBe(0);
    const p = project(0, 123, OPTS);
    expect(p.x).toBeCloseTo(500, 6);
    expect(p.y).toBeCloseTo(500, 6);
  });
});

describe("true scale is actually true", () => {
  it("is exactly linear in AU — the honest view cannot be approximately honest", () => {
    const r = (au) => project(au, 0, { ...OPTS, trueScale: true }).R;
    expect(r(2) / r(1)).toBeCloseTo(2, 9);
    expect(r(30) / r(10)).toBeCloseTo(3, 9);
    // and the ratio of any two planets is the ratio of their real distances
    expect(r(AU.jupiter) / r(AU.earth)).toBeCloseTo(AU.jupiter / AU.earth, 9);
    expect(r(AU.neptune) / r(AU.mars)).toBeCloseTo(AU.neptune / AU.mars, 9);
  });

  it("shows the emptiness the playable map hides", () => {
    // The whole point of the toggle: at true scale the inner system is a
    // rounding error, and on the compressed map it is nearly half the board.
    const trueMars = linearRadius(AU.mars);
    const logMars = logRadius(AU.mars);
    expect(trueMars).toBeLessThan(0.04);
    expect(logMars).toBeGreaterThan(0.35);
    expect(logMars / trueMars).toBeGreaterThan(10);
  });

  it("states what it is showing, in miles, without inventing numbers", () => {
    const f = trueScaleFacts(448);
    expect(f.pxPerAU).toBeCloseTo(448 / 50, 9);
    // One AU is 92,955,807 miles; the note must agree with that arithmetic.
    expect(f.milesPerPx).toBeCloseTo(92955807 / (448 / 50), 3);
    expect(f.innerSystemPct).toBeCloseTo(3.04, 2);
    expect(f.note).toMatch(/million miles/);
    expect(f.note).toMatch(/3%/);
  });
});

describe("the board fits its frame", () => {
  it("nothing is drawn outside the viewBox, with room left for a label", () => {
    // The board is 1000 units square centred at 500,500, so the drawn radius
    // must stay under 500 — and short of it, because labels sit above dots.
    for (const lon of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const p = project(50, lon, OPTS);          // the outermost mapped orbit
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1000);
    }
    expect(OPTS.radius).toBeLessThan(500);
    expect(500 - OPTS.radius).toBeGreaterThanOrEqual(40);   // margin for labels
  });

  it("uses most of the frame — the target is a desktop window", () => {
    expect(OPTS.radius / 500).toBeGreaterThan(0.85);
  });

  it("gives the inner planets room to be told apart", () => {
    // The four a beginner cares about most were the four the old curve squeezed
    // hardest. Every inner gap must be worth at least 15 screen pixels.
    const px = (au) => logRadius(au) * OPTS.radius;
    const gaps = [
      px(AU.venus) - px(AU.mercury),
      px(AU.earth) - px(AU.venus),
      px(AU.mars) - px(AU.earth),
    ];
    for (const g of gaps) expect(g).toBeGreaterThan(15);
    // and Mercury must clear the Sun's corona rather than sitting in it
    expect(px(AU.mercury)).toBeGreaterThan(60);
  });
});

describe("an orbit is a path, not a circle", () => {
  it("closes, and traces every sampled point", () => {
    const sample = Array.from({ length: 12 }, (_, i) => ({ r: 1 + 0.2 * Math.sin(i), lon: i * 30 }));
    const d = orbitPath(sample, OPTS);
    expect(d.startsWith("M")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
    expect((d.match(/L/g) || []).length).toBe(sample.length - 1);
  });

  it("an eccentric orbit is drawn off-centre from the Sun, because it is", () => {
    // Pluto's eccentricity is what lets it cross inside Neptune. A path drawn
    // at one fixed radius would hide that entirely.
    const ecc = Array.from({ length: 36 }, (_, i) => {
      const lon = i * 10;
      return { r: 39.5 * (1 - 0.25 * Math.cos((lon * Math.PI) / 180)), lon };
    });
    const near = project(ecc[0].r, ecc[0].lon, OPTS).R;      // perihelion, 29.6 AU
    const far = project(ecc[18].r, ecc[18].lon, OPTS).R;     // aphelion, 49.4 AU
    expect(far).toBeGreaterThan(near);
    // Stated in PIXELS rather than as a ratio, because that is what "visible"
    // means and because the log curve is brutal out here: a 67% difference in
    // AU comes out as under 10% of the board. Forty pixels of off-centre is
    // still plainly visible; a ratio test would have demanded the compression
    // not be a compression.
    expect(far - near).toBeGreaterThan(25);
  });
});

describe("the human-readable formatters", () => {
  it("says light time the way a person would", () => {
    expect(sayLightTime(42)).toBe("42 seconds");
    expect(sayLightTime(600)).toBe("10 minutes");
    expect(sayLightTime(7200)).toBe("2.0 hours");
  });

  it("gives distances imperial-first, per project rule 3", () => {
    const s = sayDistance(1);
    expect(s).toMatch(/^1\.00 AU/);
    expect(s).toMatch(/93 million miles/);
    expect(sayDistance(30)).toMatch(/billion miles/);
  });
});
