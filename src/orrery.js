// ===========================================================================
// ORRERY PROJECTION — turning astronomical units into pixels.
//
// THE PROBLEM: the solar system is mostly empty, and drawn to scale it is a
// useless picture. At a linear scale that fits Neptune on a 900-pixel board, the
// four inner planets — the four that matter most to a beginner — occupy the
// first fifteen pixels and overlap the Sun.
//
// THE FIX: compress the radius logarithmically and leave the ANGLE alone.
// Angle is the quantity the game actually plays on. Every transfer window, every
// "who is lined up with whom", every opposition is an angle, and all of them
// stay exactly true. What gets distorted is only the sense of distance — and
// that is bought back explicitly by the scale toggle (§ trueScale below), which
// snaps to a linear scale so a child can see, once, how much of the solar system
// is nothing at all. Distorting it silently and never showing the truth would be
// the dishonest version.
// ===========================================================================

// K is the AU at which the log curve starts opening up, and it is the dial that
// decides how crowded the inner system looks. Lowering it from 0.25 to 0.14
// pushes Mercury out from 18% of the board to 23% and widens every inner gap —
// Venus and Earth were 17 pixels apart and are now 21, on a board that is also
// bigger. The four planets a beginner cares about most were the four the old
// curve squeezed hardest, which was exactly backwards.
const K = 0.14;
const R_MAX = 50;    // AU mapped to the outer edge (past the Kuiper Belt ring)

/**
 * Compress an orbital radius in AU to 0..1 across the board.
 * log1p-shaped, so r=0 maps to 0 and the Sun sits at the centre without a
 * special case.
 */
export const logRadius = (au) => Math.log(1 + au / K) / Math.log(1 + R_MAX / K);

/**
 * The honest one, for the scale toggle.
 *
 * `maxAU` is what gets mapped to the outer edge, and it is a parameter rather
 * than the fixed R_MAX because the true-scale view should FILL the board. Pinned
 * at 50 AU, Pluto sat three-quarters of the way out with a wide empty ring
 * around it — a quarter of the frame spent on nothing. Scaling to whatever is
 * currently outermost costs no honesty at all: every ratio between two bodies is
 * identical whatever the divisor, which is the entire property that makes this
 * view worth having. What changes is the miles-per-pixel figure, and the view
 * states that figure on screen rather than assuming it.
 */
export const linearRadius = (au, maxAU = R_MAX) => Math.min(1, au / maxAU);

/**
 * Polar (AU, ecliptic longitude) → SVG point.
 *
 * Screen y is negated so that increasing ecliptic longitude runs
 * counter-clockwise — the direction the planets actually go, seen from above
 * the Sun's north pole. Getting this backwards would draw a solar system that
 * looks perfect and runs in reverse.
 */
export function project(au, lonDeg, { cx, cy, radius, trueScale = false, maxAU = R_MAX }) {
  const t = trueScale ? linearRadius(au, maxAU) : logRadius(au);
  const R = t * radius;
  const a = (lonDeg * Math.PI) / 180;
  return { x: cx + R * Math.cos(a), y: cy - R * Math.sin(a), R };
}

/**
 * The full orbit as an SVG path — sampled from the real ephemeris, not drawn as
 * a circle at the current distance.
 *
 * The first version of this drew a circle whose radius was wherever the planet
 * happened to be that day. Every planet sat neatly on its ring, so it looked
 * perfect and was wrong: run the clock and Mercury's and Pluto's "orbits" would
 * visibly swell and shrink, teaching a child that orbits change size. They
 * don't; the planet moves along a fixed ellipse.
 *
 * Sampling a whole period and projecting each point through the same radial
 * compression gives a curve that is genuinely the orbit, stays put while the
 * clock runs, and still has the planet exactly on it. Eccentricity becomes
 * visible — Pluto's orbit is noticeably off-centre from the Sun, which is the
 * fact that lets it cross inside Neptune's.
 */
export function orbitPath(sample, opts) {
  let d = "";
  for (let i = 0; i < sample.length; i++) {
    const { x, y } = project(sample[i].r, sample[i].lon, opts);
    d += `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d + "Z";
}

/**
 * Where a moon is, on the simplified circular model in data/bodies.js.
 * Mean motion only — see the note there on what that gets right and drops.
 */
export function moonLongitude(moonDef, date) {
  const days = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  return (((moonDef.epochLon + (360 * days) / moonDef.periodDays) % 360) + 360) % 360;
}

/** Format a light-time in seconds the way a person would say it. */
export function sayLightTime(sec) {
  if (sec < 90) return `${sec.toFixed(0)} seconds`;
  if (sec < 5400) return `${(sec / 60).toFixed(0)} minutes`;
  return `${(sec / 3600).toFixed(1)} hours`;
}

/**
 * WHAT THE TRUE-SCALE VIEW IS ACTUALLY SHOWING, in words.
 *
 * The linear view is unusable as a map and that is the entire point of it: the
 * solar system really is almost all nothing, and the compressed view we play on
 * hides that. But a picture of a blob near a dot teaches nothing on its own, so
 * the view has to say what the blob IS.
 *
 * `radiusPx` is the board radius the outermost orbit is drawn at.
 */
export function trueScaleFacts(radiusPx, maxAU = R_MAX) {
  const pxPerAU = radiusPx / maxAU;
  const milesPerPx = 92955807 / pxPerAU;
  return {
    pxPerAU,
    milesPerPx,
    maxAU,
    // Mars is the outer edge of the inner system, and the number is startling.
    innerSystemPct: (1.52 / maxAU) * 100,
    note: `One pixel is about ${(milesPerPx / 1e6).toFixed(1)} million miles. `
      + `Mercury, Venus, Earth and Mars all fit inside the innermost `
      + `${((1.52 / maxAU) * 100).toFixed(0)}% of this view — the solar system is `
      + `overwhelmingly empty, and the map you play on hides that.`,
  };
}

/** Format an AU distance with a miles gloss — design.md §1.7, rule 3 in space. */
export function sayDistance(au) {
  const mi = au * 92955807;
  const mil = mi >= 1e9 ? `${(mi / 1e9).toFixed(1)} billion` : `${(mi / 1e6).toFixed(0)} million`;
  return `${au.toFixed(2)} AU (${mil} miles)`;
}
