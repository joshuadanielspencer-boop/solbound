// ===========================================================================
// GEN-PLACE-COORDS — real coordinates for every place in the census that has
// one, from the IAU Gazetteer of Planetary Nomenclature.
//
//   node scripts/gen-place-coords.mjs            # fetch, match, write
//   node scripts/gen-place-coords.mjs --report   # show what matched, write nothing
//
// WHY THIS EXISTS. data/places.js carries 50 real places with real physical
// reasons and NO POSITIONS, so a surface map could not put any of them anywhere.
// Typing coordinates in by hand is exactly the thing project rule 2 forbids —
// this is a teaching tool, and a crater in the wrong hemisphere is a confidently
// wrong fact. So they are generated, the same way Shutterbug generates its
// geography from Natural Earth.
//
// THE SOURCE is the USGS/IAU gazetteer's own bulk export: one KMZ of centre
// points per body, published at a stable S3 URL, carrying `clean_name`,
// `center_lat`, `center_lon`, `diameter`, `type` and `approval` for every
// approved feature. It is the authority the IAU itself publishes, it is public
// domain, and it is the same data the gazetteer's own search runs on.
//   https://planetarynames.wr.usgs.gov/GIS_Downloads
//
// HALF THE CENSUS HAS NO COORDINATE AND NEVER WILL, and that is not a gap to be
// filled. Low Earth orbit, the Sun–Earth Lagrange points, an Aldrin cycler, the
// Kirkwood gaps, the Jupiter Trojans, "a Bennu-type rubble pile" — these are
// orbits, regions and classes of body, not places on a surface. The script marks
// them `surface: false` rather than inventing a latitude, and the surface map
// simply does not draw them. Being explicit about which half is which is the
// point of doing this with a script at all.
//
// LONGITUDE CONVENTION: the gazetteer publishes positive-east in 0–360 for most
// bodies. This normalises to −180..180 East, which is what the renderer wants
// and what data/features.js already uses (`lonE`).
// ===========================================================================

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CACHE = join(ROOT, ".cache", "gazetteer");
const OUT = join(ROOT, "src", "data", "place-coords.js");
const BASE = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com";

/**
 * Which gazetteer feature each of our places IS.
 *
 * `target` is the gazetteer's body name; `feature` is the exact `clean_name` to
 * match. Where our name for somewhere differs from the IAU's — and it often
 * does, because ours describes what the place is FOR — the IAU name wins here
 * and ours stays in places.js.
 *
 * A place absent from this table is one with no surface coordinate. That is a
 * statement, not an omission: see the header.
 */
const MAPPING = {
  // ---- Luna ---------------------------------------------------------------
  shackleton:        { target: "MOON", feature: "Shackleton" },
  "luna-lavatube":   { target: "MOON", feature: "Mare Tranquillitatis" },
  "luna-farside":    { target: "MOON", feature: "Daedalus" },
  "reiner-gamma":    { target: "MOON", feature: "Reiner Gamma" },
  procellarum:       { target: "MOON", feature: "Oceanus Procellarum" },
  tranquility:       { target: "MOON", feature: "Statio Tranquillitatis" },
  "shoemaker-rest":  { target: "MOON", feature: "Shoemaker" },

  // ---- Mercury & Venus ----------------------------------------------------
  "mercury-caloris": { target: "MERCURY", feature: "Caloris Planitia" },
  maxwell:           { target: "VENUS", feature: "Maxwell Montes" },

  // ---- Mars and its moons -------------------------------------------------
  "jezero-station":  { target: "MARS", feature: "Jezero" },
  hellas:            { target: "MARS", feature: "Hellas Planitia" },
  "utopia-ice":      { target: "MARS", feature: "Utopia Planitia" },
  valles:            { target: "MARS", feature: "Valles Marineris" },
  "arsia-caves":     { target: "MARS", feature: "Arsia Mons" },
  "phobos-depot":    { target: "PHOBOS", feature: "Stickney" },
  deimos:            { target: "DEIMOS", feature: "Swift" },

  // ---- The Belt -----------------------------------------------------------
  "ceres-port":      { target: "CERES", feature: "Occator" },
  vesta:             { target: "VESTA", feature: "Rheasilvia" },

  // ---- Jupiter ------------------------------------------------------------
  "io-forges":       { target: "IO", feature: "Loki Patera" },
  europa:            { target: "EUROPA", feature: "Conamara Chaos" },
  ganymede:          { target: "GANYMEDE", feature: "Galileo Regio" },
  "callisto-station": { target: "CALLISTO", feature: "Valhalla" },

  // ---- Saturn and beyond --------------------------------------------------
  titan:             { target: "TITAN", feature: "Kraken Mare" },
  enceladus:         { target: "ENCELADUS", feature: "Damascus Sulcus" },
  iapetus:           { target: "IAPETUS", feature: "Cassini Regio" },
  triton:            { target: "TRITON", feature: "Leviathan Patera" },
  sputnik:           { target: "PLUTO", feature: "Sputnik Planitia" },
};

// ---------------------------------------------------------------------------

const log = (...a) => console.log(...a);

/** Fetch a body's KMZ once and keep it — these are tens of megabytes. */
async function kmlFor(target) {
  mkdirSync(CACHE, { recursive: true });
  const kmz = join(CACHE, `${target}.kmz`);
  const kml = join(CACHE, `${target}.kml`);
  if (existsSync(kml)) return readFileSync(kml, "utf8");

  const url = `${BASE}/${target}_nomenclature_center_pts.kmz`;
  log(`  fetching ${target}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${target}: HTTP ${res.status}`);
  writeFileSync(kmz, Buffer.from(await res.arrayBuffer()));
  // A KMZ is a zip with one KML in it. unzip -p is everywhere macOS and Linux
  // are, and pulling in a zip library for one file would be silly.
  const out = execFileSync("unzip", ["-p", kmz, "*.kml"], { maxBuffer: 1 << 28 });
  writeFileSync(kml, out);
  return out.toString("utf8");
}

/** Every placemark in a KML, as plain records. */
function parse(kml) {
  const field = (block, name) => {
    const m = block.match(new RegExp(`name="${name}">([^<]*)`));
    return m ? m[1] : null;
  };
  return kml.split("<Placemark").slice(1).map((b) => ({
    name: field(b, "clean_name"),
    lat: Number(field(b, "center_lat")),
    lonE: Number(field(b, "center_lon")),
    diameterKm: Number(field(b, "diameter")),
    type: field(b, "type"),
    approval: field(b, "approval"),
  })).filter((f) => f.name && Number.isFinite(f.lat) && Number.isFinite(f.lonE));
}

/** Gazetteer longitudes come 0–360 East; the renderer wants −180..180. */
const toSignedEast = (lon) => (lon > 180 ? lon - 360 : lon);

async function main() {
  const report = process.argv.includes("--report");
  const targets = [...new Set(Object.values(MAPPING).map((m) => m.target))].sort();
  log(`Gazetteer: ${targets.length} bodies, ${Object.keys(MAPPING).length} places to place.\n`);

  const byTarget = {};
  for (const t of targets) {
    try { byTarget[t] = parse(await kmlFor(t)); }
    catch (e) { console.error(`  ! ${t}: ${e.message}`); byTarget[t] = []; }
  }

  const rows = [];
  const missing = [];
  for (const [placeId, { target, feature }] of Object.entries(MAPPING)) {
    const hit = (byTarget[target] || []).find((f) => f.name === feature);
    if (!hit) { missing.push(`${placeId} → ${target}/${feature}`); continue; }
    rows.push({
      placeId,
      name: hit.name,
      target,
      lat: Math.round(hit.lat * 100) / 100,
      lonE: Math.round(toSignedEast(hit.lonE) * 100) / 100,
      diameterKm: hit.diameterKm ? Math.round(hit.diameterKm * 10) / 10 : null,
      type: hit.type,
      approval: hit.approval,
    });
  }

  rows.sort((a, b) => a.placeId.localeCompare(b.placeId));
  for (const r of rows) {
    log(`  ${r.placeId.padEnd(22)} ${r.name.padEnd(24)} ${String(r.lat).padStart(7)}°  ${String(r.lonE).padStart(8)}°E  ${r.type || ""}`);
  }
  if (missing.length) {
    log(`\n  ${missing.length} NOT FOUND — the IAU name in MAPPING is wrong:`);
    for (const m of missing) log(`    ${m}`);
  }
  log(`\n  ${rows.length} placed, ${missing.length} unmatched.`);
  if (report) return;

  writeFileSync(OUT, emit(rows));
  log(`\nWrote ${OUT}`);
}

function emit(rows) {
  return `// ===========================================================================
// PLACE COORDINATES — GENERATED. Do not hand-edit.
//
//   node scripts/gen-place-coords.mjs
//
// Real latitudes and longitudes for the census places that ARE somewhere on a
// surface, from the IAU Gazetteer of Planetary Nomenclature's own bulk export
// (https://planetarynames.wr.usgs.gov/GIS_Downloads — public domain).
//
// \`lat\` is planetocentric latitude; \`lonE\` is EAST longitude in −180..180, the
// same convention data/features.js uses. \`iauName\` is the IAU's name for the
// feature, which is often not ours: we name places for what they are FOR, and
// the gazetteer names them for whoever the IAU was honouring.
//
// PLACES ABSENT FROM THIS FILE HAVE NO SURFACE COORDINATE, and that is a fact
// about them rather than a gap in the data. Low Earth orbit, the Lagrange
// points, an Aldrin cycler, the Kirkwood gaps and the Trojan swarms are orbits
// and regions, not points on a globe. The surface map does not draw them, and
// nothing should invent a latitude for them.
//
// Generated from ${new Set(rows.map((r) => r.target)).size} bodies · ${rows.length} placed features.
// ===========================================================================

export const PLACE_COORDS = {
${rows.map((r) => `  "${r.placeId}": { lat: ${r.lat}, lonE: ${r.lonE}, iauName: ${JSON.stringify(r.name)}, target: "${r.target}", ${r.diameterKm ? `diameterKm: ${r.diameterKm}, ` : ""}type: ${JSON.stringify(r.type)} },`).join("\n")}
};

/** Does this place sit somewhere on a surface a map could draw? */
export const hasSurface = (placeId) => Object.hasOwn(PLACE_COORDS, placeId);

/** The coordinate, or null for orbits, regions and swarms. */
export const coordsFor = (placeId) => PLACE_COORDS[placeId] || null;
`;
}

main().catch((e) => { console.error(e); process.exit(1); });
