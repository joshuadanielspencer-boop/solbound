// ===========================================================================
// BODIES — the derived entries in ROTATION, re-derived.
//
// Most of that table is quoted: a solar day length and an axial tilt you can
// look up. Ceres and Vesta are not — neither figure is published in the form the
// table wants, so both are computed from JPL Small-Body Database values (see the
// provenance block in data/bodies.js).
//
// A derived number nobody re-derives is a number somebody typed, which is
// exactly what project rule 2 exists to stop. So this file does the arithmetic
// again from the same quoted inputs. If someone edits the table by hand, or
// fat-fingers a digit, this fails.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { ROTATION, saySolarDay } from "../src/data/bodies.js";

const DEG = Math.PI / 180;
const ECLIPTIC = 23.43929111 * DEG;     // obliquity of the ecliptic, J2000

/**
 * The inputs, quoted from JPL SBDB exactly as data/bodies.js records them.
 * Repeated here on purpose: a test that imported the same constants would only
 * be checking that a variable equals itself.
 */
const JPL = {
  ceres: {
    rotSidH: 9.0741700, poleRA: 291.421, poleDec: 66.758,
    incDeg: 10.60, nodeDeg: 80.20, periodDays: 1680,
    ref: "Nature vol. 537, pp515-517 (22 September 2016)",
  },
  vesta: {
    rotSidH: 5.3421276, poleRA: 309.0611, poleDec: 42.232386,
    incDeg: 7.14, nodeDeg: 104.00, periodDays: 1330,
    ref: "Park, R.S. et al. 2025, Nat Astron, DOI: 10.1038/s41550-025-02533-7",
  },
};

/** The angle between the spin axis and the orbit normal, in degrees. */
function obliquityToOrbit({ poleRA, poleDec, incDeg, nodeDeg }) {
  const a = poleRA * DEG, d = poleDec * DEG;
  // Spin axis in equatorial J2000...
  const x = Math.cos(d) * Math.cos(a);
  const y = Math.cos(d) * Math.sin(a);
  const z = Math.sin(d);
  // ...rotated into the ecliptic frame the orbital elements are given in.
  const ye = y * Math.cos(ECLIPTIC) + z * Math.sin(ECLIPTIC);
  const ze = -y * Math.sin(ECLIPTIC) + z * Math.cos(ECLIPTIC);
  const i = incDeg * DEG, om = nodeDeg * DEG;
  const n = [Math.sin(i) * Math.sin(om), -Math.sin(i) * Math.cos(om), Math.cos(i)];
  const dot = Math.max(-1, Math.min(1, x * n[0] + ye * n[1] + ze * n[2]));
  return Math.acos(dot) / DEG;
}

/** Noon to noon, from the sidereal spin and the year. */
const solarDay = ({ rotSidH, periodDays }) => 1 / (1 / rotSidH - 1 / (periodDays * 24));

describe("Ceres and Vesta rotate, and the numbers are derived not typed", () => {
  for (const [id, jpl] of Object.entries(JPL)) {
    it(`${id}: the stored obliquity is what the JPL pole and orbit give`, () => {
      expect(ROTATION[id], `${id} is missing from ROTATION`).toBeTruthy();
      expect(ROTATION[id].obliquity).toBeCloseTo(obliquityToOrbit(jpl), 2);
    });

    it(`${id}: the stored solar day is the sidereal spin corrected for the year`, () => {
      expect(ROTATION[id].solarDayH).toBeCloseTo(solarDay(jpl), 4);
      // And the correction is real but tiny out here, which is worth pinning:
      // both bodies spin far faster than they orbit.
      expect(ROTATION[id].solarDayH).toBeGreaterThan(jpl.rotSidH);
      expect(ROTATION[id].solarDayH - jpl.rotSidH).toBeLessThan(0.01);
    });
  }

  it("lands on the published approximations, which is the cross-check", () => {
    // Ceres is usually quoted at about 4° and Vesta at about 27°. If the frame
    // rotation above were wrong — the commonest way to get this exactly
    // backwards — neither would land anywhere near.
    expect(ROTATION.ceres.obliquity).toBeGreaterThan(3.5);
    expect(ROTATION.ceres.obliquity).toBeLessThan(4.5);
    expect(ROTATION.vesta.obliquity).toBeGreaterThan(27);
    expect(ROTATION.vesta.obliquity).toBeLessThan(28);
  });

  it("says the day out loud the way the rest of the table does", () => {
    expect(saySolarDay("ceres")).toBe("9h 4m 34s");
    expect(saySolarDay("vesta")).toBe("5h 20m 35s");
  });
});
