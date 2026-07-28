// ===========================================================================
// STARFIELD — the dark behind the orrery.
//
// HONESTY FIRST, because this game's whole claim is that its sky is real: THIS
// IS NOT A STAR MAP. The orrery is a plan view looking down on the ecliptic, so
// there is no direction it could be "looking" and no real sky that belongs
// behind it. These stars are scenery — a dark that reads as space rather than
// as a black rectangle. Nothing in the game reads them, and nothing is taught
// from them.
//
// The real sky, with real catalogued stars at their real coordinates, belongs
// on the observatory screen (see docs/astronomy.md), where it can be looked at
// through an instrument and can mean something. Keeping the two apart is the
// point: decoration is allowed to be invented as long as it never pretends.
//
// DRAWN AS FOUR PATHS, NOT FOUR HUNDRED CIRCLES. Each brightness tier is one
// <path> made of zero-length subpaths with a round linecap — an old trick that
// renders each "M x y l 0 0" as a perfect dot of diameter stroke-width. So the
// whole field costs four DOM nodes instead of hundreds, which is what keeps the
// SVG renderer (design.md §12) the right choice at this scale.
//
// SEEDED AND GENERATED ONCE. A field that reshuffled on every render would
// shimmer every time the clock ticked, which at thirty frames a second is a
// migraine rather than a starscape.
// ===========================================================================

import { withSeed, rand } from "./rng.js";

/**
 * Brightness tiers. Real magnitude distributions are steeply bottom-heavy —
 * there are vastly more faint stars than bright ones — and mirroring that is
 * what stops a field looking like scattered confetti.
 */
export const TIERS = [
  { id: "faint",  count: 420, size: 1.1, opacity: 0.38 },
  { id: "mid",    count: 140, size: 1.7, opacity: 0.54 },
  { id: "bright", count: 44,  size: 2.4, opacity: 0.72 },
  { id: "lead",   count: 10,  size: 3.4, opacity: 0.9 },
];

/**
 * Generate the field for a square viewBox of `size` units.
 *
 * `avoid` is the radius around the centre left comparatively clear, because the
 * Sun's glow lives there and stars drawn under it just turn to mush. They are
 * thinned rather than banned — a hard circular hole reads as a mistake.
 *
 * Returns [{ id, size, opacity, d }] — one SVG path string per tier.
 */
export function starfield(size = 1000, seed = 20350101, avoid = 120, height = size) {
  return withSeed(seed, () => {
    const cx = size / 2, cy = height / 2;
    return TIERS.map((tier) => {
      const parts = [];
      let guard = 0;
      while (parts.length < tier.count && guard < tier.count * 40) {
        guard++;
        const x = rand() * size, y = rand() * height;
        const dx = x - cx, dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        // Thin toward the middle rather than cutting a hole in it.
        if (r < avoid && rand() > (r / avoid) * 0.55) continue;
        parts.push(`M${x.toFixed(1)} ${y.toFixed(1)}l0 0`);
      }
      return { ...tier, d: parts.join("") };
    });
  });
}

/**
 * A faint band across the field, standing in for the Milky Way.
 *
 * Also scenery, and also not a map — but the galaxy IS a band across every real
 * sky, and a starfield with no structure at all looks like static. Returned as
 * the geometry of a rotated ellipse so the caller can paint it with whatever
 * gradient it likes.
 */
export function galacticBand(size = 1000, height = size) {
  return { cx: size / 2, cy: height * 0.42, rx: size * 0.78, ry: height * 0.13, rotate: -24 };
}

/**
 * A stable seed from a string, so every system gets its OWN sky.
 *
 * Carrying one field across every screen made the zoom feel like the camera had
 * not moved — you flew to Jupiter and the same stars were in the same places.
 * They are still not a real sky (see the header), but they should at least
 * change when the viewpoint does, and be the same every time you come back.
 */
export function skySeed(key = "") {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) || 1;
}

/**
 * THE ASTEROID BELT, drawn as a belt.
 *
 * It was three named rocks on three concentric rings around a dot labelled "The
 * Asteroid Belt", which read as a large asteroid with three moons — precisely
 * backwards. The belt is millions of bodies sharing a wide band of heliocentric
 * orbits, and nothing in it orbits anything else.
 *
 * So: a scatter across an annulus. Positions are seeded and therefore stable —
 * the belt should look the same every time you open it — and the count is a
 * visual abstraction rather than a claim about population (design.md §16).
 */
export function beltScatter({ count = 220, rInner = 150, rOuter = 400, cx = 500, cy = 500, seed = 7 } = {}) {
  return withSeed(seed, () => Array.from({ length: count }, () => {
    // Uniform in AREA, not in radius: scattering uniformly in r piles everything
    // against the inner edge, which is how you draw a ring instead of a belt.
    const t = rand();
    const r = Math.sqrt(rInner * rInner + t * (rOuter * rOuter - rInner * rInner));
    const a = rand() * Math.PI * 2;
    return {
      x: +(cx + r * Math.cos(a)).toFixed(1),
      y: +(cy + r * Math.sin(a)).toFixed(1),
      // A few big ones, a great many small ones — the real size distribution's
      // shape, if not its numbers.
      size: +(0.6 + Math.pow(rand(), 3) * 2.4).toFixed(2),
    };
  }));
}
