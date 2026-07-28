// ===========================================================================
// GEN-PLACE-COORDS — real coordinates for every place in the census that has
// one, from the IAU Gazetteer of Planetary Nomenclature. Writes TWO files:
//
//   src/data/place-coords.js   where our ports are
//   src/data/landmarks.js      what else is on that world, so the map is a map
//
//   node scripts/gen-place-coords.mjs            # fetch, match, write
//   node scripts/gen-place-coords.mjs --report   # show what matched, write nothing
//
// WHY THE SECOND FILE. Almost every body in the census has exactly ONE port on
// it, and a surface map showing a single dot on an empty plate is worse than no
// map at all — it teaches nothing and it looks broken. The fix is not to invent
// more ports. It is that these are REAL WORLDS with real named geography, and
// the same gazetteer that placed the ports has between 2 and 9,086 approved
// features per body sitting in the same download. Ceres stops being a dot and
// becomes Occator in a landscape with Kerwan and Ahuna Mons in it.
//
// The selection rule is deliberate and is stated here because it is the only
// editorial judgement in this file: LARGEST FIRST, at most three of any one
// feature type, twenty per body. Diameter alone is the obvious rule and it is
// wrong — on Mars it returns twenty continent-sized terrae and planitiae and no
// volcano at all, because Olympus Mons is 610 km and Terra Cimmeria is 5,856.
// The type cap is what puts Tharsis Montes on Mars, Ahuna Mons on Ceres and
// Loki Patera on Io. Nothing is chosen by hand; change the two constants and
// the whole set changes.
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
// bodies. This normalises to −180..180 East, which is the convention the PLATES
// use — every image in public/plates/ is centred on 0° longitude.
//
// ⚠ IT IS NOT THE CONVENTION data/features.js USES, and an earlier version of
// this header said it was. That file stores 0–360 and the survey-era body view
// in wanderer.jsx projects it as `lonE / 360`, so its pins have always been half
// a world out — Olympus Mons is drawn at 63% across a plate where it belongs at
// 13%. Worse, three of its coordinates are WEST longitudes recorded as east
// (Loki Patera 308.8 should be 51.2°E; Conamara Chaos 274.0 should be 86.5°E),
// which is the "content written from memory" debt in design.md §11 showing its
// face. THIS file is generated from the authority and is the one to trust; the
// surface map reads from here and does not touch features.js.
//
// AND IT KEYS ON `target`, NOT on a place's `body` field. `body` in places.js
// means "nearest charted anchor" rather than "the world this is on" — himalia
// is filed under callisto, ring-camps under mimas, and Sputnik Planitia under
// charon when it is unambiguously on Pluto. The gazetteer's target is the fact.
// ===========================================================================

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CACHE = join(ROOT, ".cache", "gazetteer");
const OUT = join(ROOT, "src", "data", "place-coords.js");
const OUT_LANDMARKS = join(ROOT, "src", "data", "landmarks.js");
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

/**
 * The gazetteer's body name to ours. Only MOON differs; the rest lowercase.
 * Kept explicit so a new target fails loudly rather than guessing.
 */
const BODY_ID = {
  MOON: "luna", MARS: "mars", MERCURY: "mercury", VENUS: "venus",
  PHOBOS: "phobos", DEIMOS: "deimos", CERES: "ceres", VESTA: "vesta",
  IO: "io", EUROPA: "europa", GANYMEDE: "ganymede", CALLISTO: "callisto",
  TITAN: "titan", ENCELADUS: "enceladus", IAPETUS: "iapetus",
  TRITON: "triton", PLUTO: "pluto",
};

/** See the header: largest first, at most three of a type, twenty per body. */
const LANDMARKS_PER_BODY = 20;
const MAX_PER_TYPE = 3;

// ---------------------------------------------------------------------------

const log = (...a) => console.log(...a);

/** The gazetteer has stray double and trailing spaces in a few clean_names. */
const tidy = (s) => s.replace(/\s+/g, " ").trim();

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

  // ---- the context layer --------------------------------------------------
  const taken = new Set(rows.map((r) => `${r.target}/${r.name}`));
  const landmarks = {};
  log(`\nLandmarks — largest first, max ${MAX_PER_TYPE} per type, ${LANDMARKS_PER_BODY} per body:`);
  for (const target of targets) {
    const id = BODY_ID[target];
    if (!id) { console.error(`  ! ${target}: no body id — add it to BODY_ID.`); continue; }
    const pool = (byTarget[target] || [])
      .filter((f) => !taken.has(`${target}/${f.name}`))     // ports draw themselves
      .sort((a, b) => (b.diameterKm || 0) - (a.diameterKm || 0));

    // Diverse first, then backfill. The type cap alone leaves crater-dominated
    // worlds threadbare — Callisto IS craters, and capping them at three gave it
    // ten landmarks out of 154 available. So: take the varied ones, then top up
    // largest-first from whatever is left, which keeps the cap's effect at the
    // head of the list where it decides what a glance at the map shows.
    const seen = {};
    const diverse = pool.filter((f) => (seen[f.type || "?"] = (seen[f.type || "?"] || 0) + 1) <= MAX_PER_TYPE);
    const chosen = new Set(diverse.slice(0, LANDMARKS_PER_BODY));
    for (const f of pool) {
      if (chosen.size >= LANDMARKS_PER_BODY) break;
      chosen.add(f);
    }
    const picks = pool
      .filter((f) => chosen.has(f))
      .map((f) => ({
        name: tidy(f.name),
        lat: Math.round(f.lat * 100) / 100,
        lonE: Math.round(toSignedEast(f.lonE) * 100) / 100,
        diameterKm: f.diameterKm ? Math.round(f.diameterKm) : null,
        type: f.type,
      }));
    landmarks[id] = picks;
    log(`  ${id.padEnd(10)} ${String(picks.length).padStart(2)} of ${String((byTarget[target] || []).length).padStart(4)} named features`);
  }

  if (report) return;

  writeFileSync(OUT, emit(rows));
  log(`\nWrote ${OUT}`);
  writeFileSync(OUT_LANDMARKS, emitLandmarks(landmarks, byTarget));
  log(`Wrote ${OUT_LANDMARKS}`);
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
// \`lat\` is planetocentric latitude; \`lonE\` is EAST longitude in −180..180 —
// the convention the PLATES use, since every image in public/plates/ is centred
// on 0° longitude. It is NOT the convention data/features.js uses (that file is
// 0–360, and three of its longitudes are west values recorded as east); read
// this file, not that one. \`iauName\` is the IAU's name for the feature, which
// is often not ours: we name places for what they are FOR, and the gazetteer
// names them for whoever the IAU was honouring.
//
// \`target\` is the body the feature is actually ON, and it is the field the
// surface map keys on. A place's \`body\` in places.js means "nearest charted
// anchor" and disagrees in a handful of cases — Sputnik Planitia is filed under
// charon there and is unambiguously on Pluto.
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

function emitLandmarks(landmarks, byTarget) {
  const bodies = Object.keys(landmarks).sort();
  const total = bodies.reduce((n, b) => n + landmarks[b].length, 0);
  const counts = Object.entries(byTarget).map(([t, f]) => [t, f.length]);
  const named = counts.reduce((n, [, c]) => n + c, 0);
  const fewest = counts.reduce((a, b) => (b[1] < a[1] ? b : a));
  const most = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  const range = `${fewest[1]} on ${BODY_ID[fewest[0]]} to ${most[1].toLocaleString("en-GB")} on ${BODY_ID[most[0]]}`;
  return `// ===========================================================================
// LANDMARKS — GENERATED. Do not hand-edit.
//
//   node scripts/gen-place-coords.mjs
//
// The named geography of each world, so a surface map is a map of somewhere
// rather than a dot on a photograph. Same source and same licence as
// place-coords.js: the IAU Gazetteer of Planetary Nomenclature's bulk export
// (https://planetarynames.wr.usgs.gov/GIS_Downloads — public domain).
//
// WHY THIS EXISTS. All but two bodies in the census hold exactly one port, and a
// map with one pin on it is worse than none. These worlds are not empty, though:
// the gazetteer lists ${named.toLocaleString("en-GB")} approved features across the ${bodies.length} bodies below — from
// ${range}. This file is the ${LANDMARKS_PER_BODY} most prominent of them per body.
//
// THE SELECTION RULE, which is the only judgement in this data: largest first,
// at most ${MAX_PER_TYPE} of any one feature type. Diameter alone is the obvious rule and it
// is wrong — on Mars it returns twenty continent-sized terrae and not one
// volcano, because Terra Cimmeria is 5,856 km across and Olympus Mons is 610.
// The type cap is what earns Tharsis Montes its place, and Ahuna Mons on Ceres,
// and Loki Patera on Io.
//
// A port's own feature is excluded here, because the port draws itself.
//
// \`lonE\` is EAST longitude in −180..180, matching place-coords.js and the
// 0°-centred plates in public/plates/. \`diameterKm\` is null where the gazetteer
// records none, which is normal for linear and albedo features.
//
// Generated: ${bodies.length} bodies · ${total} landmarks.
// ===========================================================================

export const LANDMARKS = {
${bodies.map((b) => `  ${b}: [\n${landmarks[b].map((f) =>
    `    { name: ${JSON.stringify(f.name)}, lat: ${f.lat}, lonE: ${f.lonE}, diameterKm: ${f.diameterKm}, type: ${JSON.stringify(f.type)} },`).join("\n")}\n  ],`).join("\n")}
};

/** The named geography of a body, largest first. Empty array if we have none. */
export const landmarksFor = (bodyId) => LANDMARKS[bodyId] || [];

/** Every body this file can furnish a map for. */
export const MAPPED_BODIES = Object.keys(LANDMARKS);
`;
}

main().catch((e) => { console.error(e); process.exit(1); });
