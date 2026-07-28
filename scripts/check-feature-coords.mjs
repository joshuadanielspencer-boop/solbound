// ===========================================================================
// CHECK-FEATURE-COORDS — hold data/features.js against the IAU gazetteer.
//
//   node scripts/check-feature-coords.mjs
//
// WHY THIS IS A CHECKER AND NOT A GENERATOR. `data/features.js` is prose as much
// as data: each entry carries a paragraph about why the place matters, a
// confidence badge and a category, and none of that is in any gazetteer. So the
// coordinates cannot simply be regenerated the way place-coords.js is — the file
// has to stay hand-written and be HELD TO the authority instead.
//
// WHAT IT FOUND ON THE FIRST RUN (2026-07-28), which is why it exists: four of
// the fourteen entries stored WEST longitudes in a field documented as east.
// All four are outer-planet satellites, where the IAU convention is west — so
// somebody read the gazetteer correctly and wrote it into the wrong field, and
// every one of those features was drawn on the opposite side of its world.
//
// Two entries are legitimately absent from the gazetteer and are reported as
// such rather than as failures: Bradbury Landing (a rover's landing site, not an
// approved feature) and "Triton's Geysers" (a phenomenon, not a named place).
//
// The gazetteer cache is shared with gen-place-coords.mjs — run that first, or
// this will fetch the same KMZ files again.
// ===========================================================================

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CACHE = join(ROOT, ".cache", "gazetteer");
const BASE = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com";

/**
 * Our feature id → the gazetteer's body and its own name for the thing.
 *
 * `null` means the gazetteer has no entry, with the reason. Those are not
 * failures; they are places the IAU does not name, and the file is allowed to
 * carry them as long as it is honest about where the number came from.
 */
const MAPPING = {
  "olympus-mons":     { target: "MARS", feature: "Olympus Mons" },
  "valles-marineris": { target: "MARS", feature: "Valles Marineris" },
  "hellas-planitia":  { target: "MARS", feature: "Hellas Planitia" },
  jezero:             { target: "MARS", feature: "Jezero" },
  "bradbury-landing": null,   // a rover landing site; not an approved IAU feature
  tranquillitatis:    { target: "MOON", feature: "Mare Tranquillitatis" },
  tycho:              { target: "MOON", feature: "Tycho" },
  "loki-patera":      { target: "IO", feature: "Loki Patera" },
  "conamara-chaos":   { target: "EUROPA", feature: "Conamara Chaos" },
  "damascus-sulcus":  { target: "ENCELADUS", feature: "Damascus Sulcus" },
  "kraken-mare":      { target: "TITAN", feature: "Kraken Mare" },
  "verona-rupes":     { target: "MIRANDA", feature: "Verona Rupes" },
  "triton-plumes":    null,   // a phenomenon, not a named place
  "sputnik-planitia": { target: "PLUTO", feature: "Sputnik Planitia" },
};

const TOL_DEG = 1.5;   // generous: gazetteer centres and ours may differ slightly

async function kmlFor(target) {
  mkdirSync(CACHE, { recursive: true });
  const kmz = join(CACHE, `${target}.kmz`), kml = join(CACHE, `${target}.kml`);
  if (existsSync(kml)) return readFileSync(kml, "utf8");
  const res = await fetch(`${BASE}/${target}_nomenclature_center_pts.kmz`);
  if (!res.ok) throw new Error(`${target}: HTTP ${res.status}`);
  writeFileSync(kmz, Buffer.from(await res.arrayBuffer()));
  const out = execFileSync("unzip", ["-p", kmz, "*.kml"], { maxBuffer: 1 << 28 });
  writeFileSync(kml, out);
  return out.toString("utf8");
}

function parse(kml) {
  const field = (b, n) => (b.match(new RegExp(`name="${n}">([^<]*)`)) || [])[1] || null;
  return kml.split("<Placemark").slice(1).map((b) => ({
    name: field(b, "clean_name"),
    lat: Number(field(b, "center_lat")),
    lonE: Number(field(b, "center_lon")),
  })).filter((f) => f.name && Number.isFinite(f.lat));
}

/** Both conventions map to the same angle; this is the one the plates use. */
const norm = (lon) => (((lon % 360) + 360) % 360);
const sep = (a, b) => { const d = Math.abs(norm(a) - norm(b)); return Math.min(d, 360 - d); };

// Read the coordinates straight out of the source file rather than importing it,
// so this works on a file that would not even parse.
const src = readFileSync(join(ROOT, "src", "data", "features.js"), "utf8");
const entries = [...src.matchAll(/id:\s*"([\w-]+)"[\s\S]{0,400}?lat:\s*(-?[\d.]+),\s*lonE:\s*(-?[\d.]+)/g)]
  .map((m) => ({ id: m[1], lat: Number(m[2]), lonE: Number(m[3]) }));

const targets = [...new Set(Object.values(MAPPING).filter(Boolean).map((m) => m.target))];
const byTarget = {};
for (const t of targets) {
  try { byTarget[t] = parse(await kmlFor(t)); }
  catch (e) { console.error(`  ! ${t}: ${e.message}`); byTarget[t] = []; }
}

let bad = 0, unnamed = 0, ok = 0;
console.log(`\n${entries.length} coordinates in data/features.js, against the IAU gazetteer:\n`);
for (const e of entries) {
  const map = MAPPING[e.id];
  if (map === null) { console.log(`  –  ${e.id.padEnd(18)} not an IAU-named feature — nothing to check against`); unnamed++; continue; }
  if (map === undefined) { console.log(`  ?  ${e.id.padEnd(18)} not in this script's MAPPING — add it deliberately`); bad++; continue; }
  const hit = (byTarget[map.target] || []).find((f) => f.name === map.feature);
  if (!hit) { console.log(`  ?  ${e.id.padEnd(18)} "${map.feature}" not found on ${map.target}`); bad++; continue; }

  const dLat = Math.abs(hit.lat - e.lat), dLon = sep(hit.lonE, e.lonE);
  if (dLat <= TOL_DEG && dLon <= TOL_DEG) { console.log(`  ✓  ${e.id.padEnd(18)} ${e.lat}°, ${e.lonE}°E`); ok++; continue; }

  // The specific failure worth naming, because it is a convention error rather
  // than a typo and it is invisible in a list of numbers.
  const mirrored = sep(hit.lonE, 360 - norm(e.lonE)) <= TOL_DEG && dLat <= TOL_DEG;
  console.log(`  ✗  ${e.id.padEnd(18)} has ${e.lat}°, ${e.lonE}°E — gazetteer says ${hit.lat}°, ${hit.lonE}°E`
    + (mirrored ? "   ← WEST longitude stored as east" : `   (Δlat ${dLat.toFixed(1)}°, Δlon ${dLon.toFixed(1)}°)`));
  bad++;
}
console.log(`\n  ${ok} agree · ${bad} wrong · ${unnamed} not IAU-named.`);
process.exit(bad ? 1 : 0);
