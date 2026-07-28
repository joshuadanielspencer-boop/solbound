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
export function starfield(size = 1000, seed = 20350101, avoid = 120) {
  return withSeed(seed, () => {
    const cx = size / 2, cy = size / 2;
    return TIERS.map((tier) => {
      const parts = [];
      let guard = 0;
      while (parts.length < tier.count && guard < tier.count * 40) {
        guard++;
        const x = rand() * size, y = rand() * size;
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
export function galacticBand(size = 1000) {
  return { cx: size / 2, cy: size * 0.42, rx: size * 0.78, ry: size * 0.13, rotate: -24 };
}
