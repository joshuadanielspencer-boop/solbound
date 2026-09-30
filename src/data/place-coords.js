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
// names them for whoever the IAU was honouring. `origin` is the gazetteer's
// own account of that — who or what the name honours — and `iau` is the
// feature's id on planetarynames.wr.usgs.gov, which is the citation.
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
  "arsia-caves": { lat: -8.26, lonE: -120.09, iauName: "Arsia Mons", target: "MARS", diameterKm: 470, type: "Mons, montes", origin: "Arsia Silva-classical albedo feature name.", iau: 394 },
  "callisto-station": { lat: 14.7, lonE: -56, iauName: "Valhalla", target: "CALLISTO", diameterKm: 3000, type: "Large ringed feature", origin: "Norse; Odin's hall, where he received the souls of slain warriors.", iau: 6284 },
  "ceres-port": { lat: 19.82, lonE: -120.66, iauName: "Occator", target: "CERES", diameterKm: 92, type: "Crater, craters", origin: "Roman agricultural deity of the harrowing.", iau: 15341 },
  "deimos": { lat: 12.5, lonE: 1.8, iauName: "Swift", target: "DEIMOS", diameterKm: 1, type: "Crater, craters", origin: "Jonathan; British writer (1667-1745).", iau: 5789 },
  "enceladus": { lat: -80.59, lonE: 74.13, iauName: "Damascus Sulcus", target: "ENCELADUS", diameterKm: 125, type: "Sulcus, sulci", origin: "Home city of the merchant Ayyub, father of Ghanim and Fitnah in the \"Tale of Ghanim Bin Ayyub, the Distraught, the Thrall O’ Love.\"", iau: 14252 },
  "europa": { lat: 9.7, lonE: 87.3, iauName: "Conamara Chaos", target: "EUROPA", diameterKm: 143.7, type: "Chaos, chaoses", origin: "Rugged part of western Ireland named for Conmac, son of the Queen of Connacht.", iau: 1282 },
  "ganymede": { lat: 45, lonE: -127, iauName: "Galileo Regio", target: "GANYMEDE", diameterKm: 4439, type: "Regio, regiones", origin: "Italian astronomer (1564-1642).", iau: 2076 },
  "hellas": { lat: -42.43, lonE: 70.5, iauName: "Hellas Planitia", target: "MARS", diameterKm: 2299.2, type: "Planitia, planitiae", origin: "Classical albedo feature name.", iau: 2432 },
  "iapetus": { lat: -28.1, lonE: -92.6, iauName: "Cassini Regio", target: "IAPETUS", type: "Regio, regiones", origin: "Italian-French astronomer who discovered Iapetus in 1671, Rhea in 1672, Tethys and Dione in 1684 (1625-1712).", iau: 1047 },
  "io-forges": { lat: 13.01, lonE: 51.21, iauName: "Loki Patera", target: "IO", diameterKm: 226.6, type: "Patera, paterae", origin: "Norse blacksmith, trickster god.", iau: 3459 },
  "jezero-station": { lat: 18.41, lonE: 77.69, iauName: "Jezero", target: "MARS", diameterKm: 47.5, type: "Crater, craters", origin: "Town in Bosnia-Herzegovina.", iau: 14300 },
  "luna-farside": { lat: -5.83, lonE: 179.4, iauName: "Daedalus", target: "MOON", diameterKm: 93.6, type: "Crater, craters", origin: "Greek mythological character.", iau: 1381 },
  "luna-lavatube": { lat: 8.35, lonE: 30.83, iauName: "Mare Tranquillitatis", target: "MOON", diameterKm: 875.7, type: "Mare, maria", origin: "\"Sea of Tranquility.\"", iau: 3691 },
  "maxwell": { lat: 65.2, lonE: 3.3, iauName: "Maxwell Montes", target: "VENUS", diameterKm: 797, type: "Mons, montes", origin: "James C.; British physicist (1831-1879).", iau: 3766 },
  "mercury-caloris": { lat: 31.65, lonE: 161.98, iauName: "Caloris Planitia", target: "MERCURY", diameterKm: 1500, type: "Planitia, planitiae", origin: "\"Hot plain\"; surface temperature hottest near this position.", iau: 979 },
  "phobos-depot": { lat: 1, lonE: -49, iauName: "Stickney", target: "PHOBOS", diameterKm: 9, type: "Crater, craters", origin: "Angeline; wife of American astronomer A. Hall (1830-1892).", iau: 5707 },
  "procellarum": { lat: 20.67, lonE: -56.68, iauName: "Oceanus Procellarum", target: "MOON", diameterKm: 2592.2, type: "Oceanus, oceani", origin: "\"Ocean of Storms.\"", iau: 4395 },
  "reiner-gamma": { lat: 7.39, lonE: -58.96, iauName: "Reiner Gamma", target: "MOON", diameterKm: 73.4, type: "Albedo Feature", origin: "Reinieri, Vincentio; Italian astronomer, mathematician (unkn-1648).", iau: 4987 },
  "shackleton": { lat: -89.67, lonE: 129.78, iauName: "Shackleton", target: "MOON", diameterKm: 20.9, type: "Crater, craters", origin: "Sir Ernest Henry; Irish-born British Antarctic explorer (1874-1922).", iau: 5450 },
  "shoemaker-rest": { lat: -88.14, lonE: 45.91, iauName: "Shoemaker", target: "MOON", diameterKm: 51.8, type: "Crater, craters", origin: "Eugene Merle; American astrogeologist (1928-1997).", iau: 5494 },
  "sputnik": { lat: 19.51, lonE: 178.69, iauName: "Sputnik Planitia", target: "PLUTO", diameterKm: 1492, type: "Planitia, planitiae", origin: "Soviet Union's Sputnik 1 (literally Satellite 1), the first human-built satellite of the Earth (1957).", iau: 15669 },
  "titan": { lat: 68, lonE: 50, iauName: "Kraken Mare", target: "TITAN", diameterKm: 1170, type: "Mare, maria", origin: "Fabulous sea monster in the Norwegian seas, said to be a mile and a half in circumference and to cause a whirlpool when it dives.", iau: 14399 },
  "tranquility": { lat: 0.67, lonE: 23.47, iauName: "Statio Tranquillitatis", target: "MOON", type: "Statio", origin: "\"Tranquility Base,\" Apollo 11 landing site.", iau: 5684 },
  "triton": { lat: 17, lonE: 28.5, iauName: "Leviathan Patera", target: "TRITON", type: "Patera, paterae", origin: "Hebrew sea monster upholding earth.", iau: 3368 },
  "utopia-ice": { lat: 46.74, lonE: 117.52, iauName: "Utopia Planitia", target: "MARS", diameterKm: 3560.4, type: "Planitia, planitiae", origin: "Classical albedo feature name.", iau: 6260 },
  "valles": { lat: -14.01, lonE: -58.59, iauName: "Valles Marineris", target: "MARS", diameterKm: 3761.3, type: "Vallis, valles", origin: "General name of the system of canyons honoring the scientific team of the Mariner 9 program.", iau: 6288 },
  "vesta": { lat: -71.95, lonE: 86.3, iauName: "Rheasilvia", target: "VESTA", diameterKm: 450, type: "Crater, craters", origin: "Rhea Silvia, Roman vestal virgin, mother of Romulus and Remus (c. 770 B.C.).", iau: 14886 },
};

/** Does this place sit somewhere on a surface a map could draw? */
export const hasSurface = (placeId) => Object.hasOwn(PLACE_COORDS, placeId);

/** The coordinate, or null for orbits, regions and swarms. */
export const coordsFor = (placeId) => PLACE_COORDS[placeId] || null;
