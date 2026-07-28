// ===========================================================================
// SURFACE — what a map of one world contains, as plain values.
//
// The third level of the map: orrery → system → surface. Clicking a body in the
// system view opens the world itself, with this run's ports on it at their real
// IAU coordinates and the day/night terminator across them.
//
// WHY THIS EXISTS AT ALL, beyond being a nice picture: illumination.js has been
// a complete, tested engine for solar day length, seasons, the terminator and
// polar night since before the pivot, and NOTHING HAS CALLED IT SINCE. This is
// the screen that gives it a job. A port is not just a name on a list; it is a
// place at a latitude, and whether the Sun ever reaches it is the difference
// between a solar farm and a reactor.
//
// ---------------------------------------------------------------------------
// ⚠ THE ACCURACY BOUNDARY, and it is the whole reason this file has a header.
//
// illumination.js is explicit that its RATES are real and its PHASE is not:
// every body's solar day is the true one, so the terminator sweeps at the right
// speed and a site's daylight lasts the right number of hours — but which
// meridian faces the Sun on a given calendar date is not tied to a real epoch,
// and neither is where in its year the season sits. Both have the right period
// and the right amplitude off an arbitrary zero.
//
// So this screen may say, and does:
//   ✓ a day here lasts 29½ Earth days
//   ✓ the Sun swings 25° north and south of the equator over a Martian year
//   ✓ this latitude spends part of the year in continuous darkness
// and it must never say:
//   ✗ it is night at Jezero on 14 March 2037
//
// `phaseAnchored` is false on every report this file returns, and the view
// prints the caveat rather than hiding it. When somebody wires up the IAU
// rotational elements (W₀ and Ẇ) plus pole orientation, this flips to true and
// the sentence changes; until then the map shows the RHYTHM, not the calendar.
//
// AND ONE THING THIS ENGINE DOES NOT KNOW: topography. illumination.js works on
// a smooth sphere, so it will happily light Shackleton's crater floor when the
// Sun is south. The real permanent shadow there is a fact about the crater's
// rim, not about its latitude. The view must not claim it, and does not.
// ===========================================================================

import { PLACE_COORDS } from "./data/place-coords.js";
import { landmarksFor, LANDMARKS } from "./data/landmarks.js";
import { ROTATION, MOONS, SYSTEM_BY_ID, BELT_BODIES, saySolarDay } from "./data/bodies.js";
import { isLit, sunAltitude, lightQuality, subsolarLat, nextSunrise } from "./illumination.js";

/**
 * The gazetteer's body name to ours. Only MOON differs.
 *
 * This is the same table scripts/gen-place-coords.mjs holds, and it is repeated
 * rather than imported because that file is a build script that never ships.
 */
const BODY_ID = {
  MOON: "luna", MARS: "mars", MERCURY: "mercury", VENUS: "venus",
  PHOBOS: "phobos", DEIMOS: "deimos", CERES: "ceres", VESTA: "vesta",
  IO: "io", EUROPA: "europa", GANYMEDE: "ganymede", CALLISTO: "callisto",
  TITAN: "titan", ENCELADUS: "enceladus", IAPETUS: "iapetus",
  TRITON: "triton", PLUTO: "pluto",
};

/** Which body a place is actually ON — from the gazetteer, not from `body`.
 *
 *  A place's `body` field in data/places.js means "nearest charted anchor",
 *  which is not the same claim: himalia is filed under callisto, ring-camps
 *  under mimas, and Sputnik Planitia under charon when it is unambiguously on
 *  Pluto. Reading `target` here means the map cannot inherit those. */
export function bodyOf(placeId) {
  const c = PLACE_COORDS[placeId];
  return c ? BODY_ID[c.target] || null : null;
}

/** Bodies this file can draw. */
export const MAPPED = Object.keys(LANDMARKS);

/** Can we open a surface map of this body? */
export const hasSurfaceMap = (bodyId) => Object.hasOwn(LANDMARKS, bodyId);

/** Do we have a photographic plate for it, or only a coloured disc? */
const PLATED = new Set(["luna", "mars", "mercury", "europa", "enceladus"]);
export const hasPlate = (bodyId) => PLATED.has(bodyId);

/** The display name of a body, wherever in the data it happens to live. */
export function bodyName(bodyId) {
  if (SYSTEM_BY_ID[bodyId]) return SYSTEM_BY_ID[bodyId].name;
  const belt = BELT_BODIES.find((b) => b.id === bodyId);
  if (belt) return belt.name;
  for (const list of Object.values(MOONS)) {
    const m = list.find((x) => x.id === bodyId);
    if (m) return m.name;
  }
  return bodyId;
}

/**
 * How far from the pole the polar night reaches right now, in degrees of
 * latitude, or null if there is none.
 *
 * The Sun stands over latitude β. Everywhere poleward of (90° − |β|) in the
 * OPPOSITE hemisphere sees no sunrise at all that day — that is the definition
 * of a polar circle, and on a body with no tilt there isn't one. `hemisphere`
 * is the pole that is currently dark.
 */
export function polarNight(bodyId, t) {
  const r = ROTATION[bodyId];
  if (!r) return null;
  const b = subsolarLat(bodyId, t);
  if (Math.abs(b) < 0.05) return null;              // equinox: no circle
  return { fromLat: 90 - Math.abs(b), hemisphere: b > 0 ? "south" : "north" };
}

/**
 * The largest tilt this body reaches — the amplitude of its seasons, which IS
 * real even though the phase is not. Uranus's moons get 98°, Mercury 0.03°.
 */
export function seasonAmplitude(bodyId) {
  const r = ROTATION[bodyId];
  if (!r) return null;
  return r.obliquity > 90 ? 180 - r.obliquity : r.obliquity;
}

/** One port, placed and lit. */
function portReport(site, bodyId, t) {
  const c = PLACE_COORDS[site.id];
  const known = Boolean(ROTATION[bodyId]);
  const alt = known ? sunAltitude(bodyId, c.lat, c.lonE, t) : null;
  return {
    id: site.id,
    name: site.name,
    iauName: c.iauName,
    lat: c.lat,
    lonE: c.lonE,
    // Unknown rotation is reported as unknown, never as "in daylight". The
    // engine's own fallback returns lit-and-45°, which is the right answer for
    // "don't block the shot" and the wrong one for a map that states facts.
    lit: known ? isLit(bodyId, c.lat, c.lonE, t) : null,
    sunAltDeg: alt,
    light: alt === null ? null : lightQuality(alt),
    nextSunriseMs: known ? nextSunrise(bodyId, c.lat, c.lonE, t) : null,
  };
}

/**
 * Everything a surface map of `bodyId` needs, at time `t`.
 *
 * `sites` is this run's ports (game.sites); only the ones actually on this body
 * appear, and only those with a real coordinate — a port in orbit or at a
 * Lagrange point has no latitude and is not invented one.
 */
export function surfaceReport(bodyId, sites = [], t = 0) {
  if (!hasSurfaceMap(bodyId)) return null;
  const known = Boolean(ROTATION[bodyId]);
  const ports = sites
    .filter((s) => bodyOf(s.id) === bodyId)
    .map((s) => portReport(s, bodyId, t))
    .sort((a, b) => b.lat - a.lat);

  return {
    bodyId,
    name: bodyName(bodyId),
    plate: hasPlate(bodyId),
    ports,
    landmarks: landmarksFor(bodyId),
    // The rotation model, and whether we have one at all. Ceres and Vesta are
    // in the census as ports and NOT in ROTATION, so they draw no terminator
    // and say so — better a stated gap than a confidently flat-lit world.
    rotationKnown: known,
    solarDay: known ? saySolarDay(bodyId) : null,
    seasonAmplitudeDeg: seasonAmplitude(bodyId),
    subsolarLatDeg: known ? subsolarLat(bodyId, t) : null,
    polarNight: polarNight(bodyId, t),
    // Never true today. See this file's header — the view prints the caveat.
    phaseAnchored: false,
  };
}

/**
 * The night side as OUTLINES rather than as columns.
 *
 * illumination.js returns the darkness one strip of longitude at a time, which
 * is the right shape for its own tests and the wrong shape for a picture: drawn
 * as 120 rectangles the terminator comes out as a visible staircase, because
 * near the terminator a few degrees of longitude move the boundary a long way in
 * latitude. Joining the strips into a polygon costs nothing and draws the curve
 * the maths already knew about.
 *
 * Two things this has to get right:
 *   • THE SEAM. Columns arrive in 0..360 and the map runs −180..180, so the
 *     night region that straddles ±180 must come back as TWO polygons, each
 *     meeting its own edge of the map. One polygon spanning the seam would draw
 *     a band straight across the daylight.
 *   • THE GAP. At equinox illumination.js emits nothing at all for the lit
 *     columns, so the present columns are not contiguous. Runs are split on
 *     adjacency rather than assumed to be one block.
 *
 * @returns Array of polygons, each an array of {lonE, lat} in draw order.
 */
export function nightOutlines(spans) {
  const signed = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
  const cols = spans
    .map((s) => ({
      mid: signed((s.lon0 + s.lon1) / 2),
      halfW: (s.lon1 - s.lon0) / 2,
      latFrom: s.latFrom,
      latTo: s.latTo,
    }))
    .sort((a, b) => a.mid - b.mid);

  const runs = [];
  for (const c of cols) {
    const prev = runs.length ? runs[runs.length - 1][runs[runs.length - 1].length - 1] : null;
    // Adjacent columns are exactly one width apart. Anything further is a
    // genuine gap — either daylight between two dark regions, or the seam.
    if (prev && c.mid - prev.mid < c.halfW * 3) runs[runs.length - 1].push(c);
    else runs.push([c]);
  }

  return runs.map((run) => {
    const first = run[0], last = run[run.length - 1];
    const out = [{ lonE: first.mid - first.halfW, lat: first.latFrom }];
    for (const c of run) out.push({ lonE: c.mid, lat: c.latFrom });
    out.push({ lonE: last.mid + last.halfW, lat: last.latFrom });
    out.push({ lonE: last.mid + last.halfW, lat: last.latTo });
    for (let i = run.length - 1; i >= 0; i--) out.push({ lonE: run[i].mid, lat: run[i].latTo });
    out.push({ lonE: first.mid - first.halfW, lat: first.latTo });
    return out;
  });
}

/**
 * The bodies worth offering a map of for a given run: any mapped body that has
 * at least one of this run's ports on it. Used to decide what is clickable in
 * the system view, so nothing opens onto a world with nothing of yours on it.
 */
export function mappedBodiesWithPorts(sites = []) {
  const out = new Set();
  for (const s of sites) {
    const b = bodyOf(s.id);
    if (b && hasSurfaceMap(b)) out.add(b);
  }
  return [...out];
}
