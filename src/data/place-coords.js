// ===========================================================================
// PLACE COORDINATES — GENERATED. Do not hand-edit.
//
//   node scripts/gen-place-coords.mjs
//
// Real latitudes and longitudes for the census places that ARE somewhere on a
// surface, from the IAU Gazetteer of Planetary Nomenclature's own bulk export
// (https://planetarynames.wr.usgs.gov/GIS_Downloads — public domain).
//
// `lat` is planetocentric latitude; `lonE` is EAST longitude in −180..180 —
// the convention the PLATES use, since every image in public/plates/ is centred
// on 0° longitude. It is NOT the convention data/features.js uses (that file is
// 0–360, and three of its longitudes are west values recorded as east); read
// this file, not that one. `iauName` is the IAU's name for the feature, which
// is often not ours: we name places for what they are FOR, and the gazetteer
// names them for whoever the IAU was honouring.
//
// `target` is the body the feature is actually ON, and it is the field the
// surface map keys on. A place's `body` in places.js means "nearest charted
// anchor" and disagrees in a handful of cases — Sputnik Planitia is filed under
// charon there and is unambiguously on Pluto.
//
// PLACES ABSENT FROM THIS FILE HAVE NO SURFACE COORDINATE, and that is a fact
// about them rather than a gap in the data. Low Earth orbit, the Lagrange
// points, an Aldrin cycler, the Kirkwood gaps and the Trojan swarms are orbits
// and regions, not points on a globe. The surface map does not draw them, and
// nothing should invent a latitude for them.
//
// Generated from 17 bodies · 27 placed features.
// ===========================================================================

export const PLACE_COORDS = {
  "arsia-caves": { lat: -8.26, lonE: -120.09, iauName: "Arsia Mons", target: "MARS", diameterKm: 470, type: "Mons, montes" },
  "callisto-station": { lat: 14.7, lonE: -56, iauName: "Valhalla", target: "CALLISTO", diameterKm: 3000, type: "Large ringed feature" },
  "ceres-port": { lat: 19.82, lonE: -120.66, iauName: "Occator", target: "CERES", diameterKm: 92, type: "Crater, craters" },
  "deimos": { lat: 12.5, lonE: 1.8, iauName: "Swift", target: "DEIMOS", diameterKm: 1, type: "Crater, craters" },
  "enceladus": { lat: -80.59, lonE: 74.13, iauName: "Damascus Sulcus", target: "ENCELADUS", diameterKm: 125, type: "Sulcus, sulci" },
  "europa": { lat: 9.7, lonE: 87.3, iauName: "Conamara Chaos", target: "EUROPA", diameterKm: 143.7, type: "Chaos, chaoses" },
  "ganymede": { lat: 45, lonE: -127, iauName: "Galileo Regio", target: "GANYMEDE", diameterKm: 4439, type: "Regio, regiones" },
  "hellas": { lat: -42.43, lonE: 70.5, iauName: "Hellas Planitia", target: "MARS", diameterKm: 2299.2, type: "Planitia, planitiae" },
  "iapetus": { lat: -28.1, lonE: -92.6, iauName: "Cassini Regio", target: "IAPETUS", type: "Regio, regiones" },
  "io-forges": { lat: 13.01, lonE: 51.21, iauName: "Loki Patera", target: "IO", diameterKm: 226.6, type: "Patera, paterae" },
  "jezero-station": { lat: 18.41, lonE: 77.69, iauName: "Jezero", target: "MARS", diameterKm: 47.5, type: "Crater, craters" },
  "luna-farside": { lat: -5.83, lonE: 179.4, iauName: "Daedalus", target: "MOON", diameterKm: 93.6, type: "Crater, craters" },
  "luna-lavatube": { lat: 8.35, lonE: 30.83, iauName: "Mare Tranquillitatis", target: "MOON", diameterKm: 875.7, type: "Mare, maria" },
  "maxwell": { lat: 65.2, lonE: 3.3, iauName: "Maxwell Montes", target: "VENUS", diameterKm: 797, type: "Mons, montes" },
  "mercury-caloris": { lat: 31.65, lonE: 161.98, iauName: "Caloris Planitia", target: "MERCURY", diameterKm: 1500, type: "Planitia, planitiae" },
  "phobos-depot": { lat: 1, lonE: -49, iauName: "Stickney", target: "PHOBOS", diameterKm: 9, type: "Crater, craters" },
  "procellarum": { lat: 20.67, lonE: -56.68, iauName: "Oceanus Procellarum", target: "MOON", diameterKm: 2592.2, type: "Oceanus, oceani" },
  "reiner-gamma": { lat: 7.39, lonE: -58.96, iauName: "Reiner Gamma", target: "MOON", diameterKm: 73.4, type: "Albedo Feature" },
  "shackleton": { lat: -89.67, lonE: 129.78, iauName: "Shackleton", target: "MOON", diameterKm: 20.9, type: "Crater, craters" },
  "shoemaker-rest": { lat: -88.14, lonE: 45.91, iauName: "Shoemaker", target: "MOON", diameterKm: 51.8, type: "Crater, craters" },
  "sputnik": { lat: 19.51, lonE: 178.69, iauName: "Sputnik Planitia", target: "PLUTO", diameterKm: 1492, type: "Planitia, planitiae" },
  "titan": { lat: 68, lonE: 50, iauName: "Kraken Mare", target: "TITAN", diameterKm: 1170, type: "Mare, maria" },
  "tranquility": { lat: 0.67, lonE: 23.47, iauName: "Statio Tranquillitatis", target: "MOON", type: "Statio" },
  "triton": { lat: 17, lonE: 28.5, iauName: "Leviathan Patera", target: "TRITON", type: "Patera, paterae" },
  "utopia-ice": { lat: 46.74, lonE: 117.52, iauName: "Utopia Planitia", target: "MARS", diameterKm: 3560.4, type: "Planitia, planitiae" },
  "valles": { lat: -14.01, lonE: -58.59, iauName: "Valles Marineris", target: "MARS", diameterKm: 3761.3, type: "Vallis, valles" },
  "vesta": { lat: -71.95, lonE: 86.3, iauName: "Rheasilvia", target: "VESTA", diameterKm: 450, type: "Crater, craters" },
};

/** Does this place sit somewhere on a surface a map could draw? */
export const hasSurface = (placeId) => Object.hasOwn(PLACE_COORDS, placeId);

/** The coordinate, or null for orbits, regions and swarms. */
export const coordsFor = (placeId) => PLACE_COORDS[placeId] || null;
