// ===========================================================================
// THE SURFACE MAP — the third level of the map, and illumination.js's first job.
//
//   orrery (the solar system) → system (a planet and its moons) → SURFACE
//
// An equirectangular plate of one world, this run's ports pinned at their real
// IAU coordinates, the named geography around them, and the night side drawn
// across the lot.
//
// THREE THINGS THIS FILE GETS RIGHT THAT THE SURVEY-ERA BODY VIEW GOT WRONG,
// and they are worth listing because they all look identical from the outside:
//
//   1. THE SEAM. Every plate in public/plates/ is centred on 0° longitude and
//      runs −180° at the left edge to +180° at the right. wanderer.jsx projects
//      `lonE / 360`, which assumes 0° at the left edge, so every one of its pins
//      is displaced by half a world — Olympus Mons is drawn at 63% across a
//      plate where it belongs at 13%. `px()` below is the corrected version and
//      is the single most load-bearing line in this file.
//
//   2. THE SOURCE. Coordinates come from data/place-coords.js and
//      data/landmarks.js, both GENERATED from the IAU gazetteer. data/features.js
//      is hand-written draft content (design.md §11) and three of its longitudes
//      are west values recorded as east. Nothing here reads it.
//
//   3. THE BODY. Which world a port is on comes from the gazetteer's `target`
//      via surface.js `bodyOf()`, not from a place's `body` field — that field
//      means "nearest charted anchor" and puts Sputnik Planitia on Charon.
//
// WHAT IT MAY CLAIM. The terminator sweeps at the real rate for this body and
// the seasons have the real amplitude and period, but neither is anchored to a
// real epoch — see the header of src/surface.js. The footer says so on screen,
// every time, rather than letting a player infer a calendar from a picture.
// ===========================================================================

import { useEffect, useMemo, useState } from "react";
import { nightSpans } from "../illumination.js";
import { surfaceReport, nightOutlines } from "../surface.js";
import { Screen, StatStrip, Footnote } from "./ui.jsx";

const VBW = 1350, VBH = 1000;
const W = 1120, H = 560;
const X0 = (VBW - W) / 2, Y0 = 210;

/**
 * Longitude to x. −180 at the left edge, +180 at the right: see note 1 above.
 * Accepts either convention — coordinates arrive signed (−180..180) and
 * nightSpans() works in 0..360 — because both wrap to the same point.
 */
const px = (lonE) => X0 + ((((lonE + 180) % 360) + 360) % 360) / 360 * W;
/** Latitude to y. North at the top, which needs saying because y grows down. */
const py = (lat) => Y0 + ((90 - lat) / 180) * H;

/**
 * Which landmarks get their name printed.
 *
 * Twenty labels on one plate collide — the Moon put "Mare Serenitatis" through
 * "Lacus Somniorum" and "Montes Apenninus" through "Dorsum Buckland". The list
 * arrives largest first, so a greedy pass keeps the name of the biggest feature
 * in any crowded neighbourhood and drops the rest to a bare ring. The RING stays
 * either way: the geography is still drawn, and every name is in the panel.
 */
function labelled(landmarks, ports = [], minSepDeg = 26) {
  // Ports are seeded first and never yield: this run's own ports are the point
  // of the screen, and a landmark name printed through "Ceres Port" costs more
  // than the landmark name is worth.
  const kept = [...ports];
  return landmarks.map((l) => {
    // Longitudes converge toward the poles on an equirectangular plate, so the
    // separation test has to as well or the polar labels never clear each other.
    const scale = Math.cos((l.lat * Math.PI) / 180);
    const clash = kept.some((k) =>
      Math.abs(k.lat - l.lat) < minSepDeg * 0.45
      && Math.abs(((k.lonE - l.lonE + 540) % 360) - 180) < minSepDeg * Math.max(0.35, scale));
    if (!clash) kept.push(l);
    return { l, label: !clash };
  });
}

/** How big to draw a landmark's mark, from its real diameter. */
function markRadius(diameterKm, bodyRadiusHint) {
  if (!diameterKm) return 3;
  return Math.max(2.5, Math.min(9, Math.sqrt(diameterKm) / (bodyRadiusHint || 9)));
}

export function SurfaceView({ game, bodyId, dest, onPick, onBack }) {
  const [plateOk, setPlateOk] = useState(true);
  useEffect(() => { setPlateOk(true); }, [bodyId]);

  const rep = useMemo(
    () => surfaceReport(bodyId, game.sites || [], game.t),
    [bodyId, game.sites, game.t],
  );
  // The terminator is expensive-ish (120 columns × a trig solve) and the clock
  // ticks 30 times a second in flight, so it is recomputed on the DAY rather
  // than on the millisecond. On the slowest body here that is far finer than
  // anything visible; on the fastest (Phobos, 7.7 hours) it is the difference
  // between a smooth sweep and a stutter, and a stutter is the honest reading
  // of "this world turns three times a day".
  const day = Math.floor(game.t / 86400000);
  const night = useMemo(
    () => (rep?.rotationKnown ? nightOutlines(nightSpans(bodyId, day * 86400000, 180)) : []),
    [bodyId, day, rep?.rotationKnown],
  );

  if (!rep) return null;
  const hereId = game.player.at;
  // Marks scale off how much real estate the body has: a 20 km crater is a
  // landmark on Phobos and invisible on Mars.
  const biggest = Math.max(1, ...rep.landmarks.map((l) => l.diameterKm || 0));
  const hint = Math.max(3, Math.sqrt(biggest) / 8);

  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} style={{ flex: 1, minHeight: 0, width: "100%" }} role="img"
      aria-label={`Surface map of ${rep.name}. ${rep.ports.length} of your ports, `
        + `${rep.landmarks.length} named features. The port list and the lighting are also in the panel.`}>
      <defs>
        <clipPath id="surfClip"><rect x={X0} y={Y0} width={W} height={H} /></clipPath>
        <linearGradient id="surfFall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.26" />
        </linearGradient>
      </defs>

      <text x={X0} y={Y0 - 74} style={S.title}>{rep.name}</text>
      <text x={X0} y={Y0 - 48} style={S.sub}>
        {rep.solarDay ? `A day here lasts ${rep.solarDay}.` : "Rotation not in the model for this body."}
        {rep.seasonAmplitudeDeg > 1
          && `  The Sun swings ${rep.seasonAmplitudeDeg.toFixed(0)}° north and south through its year.`}
      </text>

      <g clipPath="url(#surfClip)">
        {rep.plate && plateOk ? (
          <image href={`${import.meta.env.BASE_URL}plates/${bodyId}.jpg`}
            x={X0} y={Y0} width={W} height={H} preserveAspectRatio="none"
            onError={() => setPlateOk(false)} />
        ) : (
          <rect x={X0} y={Y0} width={W} height={H} fill="#3B4353" />
        )}
        <rect x={X0} y={Y0} width={W} height={H} fill="url(#surfFall)" />

        {/* THE NIGHT SIDE. One filled path per contiguous region — see
            nightOutlines() in surface.js for why it is not one path, and why it
            is not the 120 rectangles illumination.js hands over. */}
        <g opacity={0.72}>
          {night.map((poly, i) => (
            <path key={i} fill="#04070E"
              d={poly.map((p, j) => `${j ? "L" : "M"}${px(p.lonE).toFixed(1)} ${py(p.lat).toFixed(1)}`).join(" ") + "Z"} />
          ))}
        </g>
      </g>

      {/* Graticule. The equator is solid and brighter because latitude is the
          quantity that decides whether the Sun ever reaches you. */}
      {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((l) => (
        <line key={l} x1={px(l)} y1={Y0} x2={px(l)} y2={Y0 + H}
          stroke="#fff" strokeOpacity={l === 0 ? 0.22 : 0.08} />
      ))}
      {[60, 30, 0, -30, -60].map((l) => (
        <line key={l} x1={X0} y1={py(l)} x2={X0 + W} y2={py(l)} stroke="#fff"
          strokeOpacity={l === 0 ? 0.26 : 0.08} strokeDasharray={l === 0 ? "" : "4 7"} />
      ))}
      <rect x={X0} y={Y0} width={W} height={H} fill="none" stroke="#26324a" strokeWidth={2} />
      <text x={X0} y={Y0 + H + 20} style={S.axis}>180° W</text>
      <text x={X0 + W / 2} y={Y0 + H + 20} style={{ ...S.axis, textAnchor: "middle" }}>0°</text>
      <text x={X0 + W} y={Y0 + H + 20} style={{ ...S.axis, textAnchor: "end" }}>180° E</text>

      {/* The named geography. Not focusable: twenty extra tab stops between the
          player and the Back button would be a worse screen for a keyboard user,
          not a better one. The same names are listed as text in the panel, which
          is where a screen reader should meet them (project rule 4). */}
      <g aria-hidden="true">
        {labelled(rep.landmarks, rep.ports).map(({ l, label }) => {
          const x = px(l.lonE), y = py(l.lat);
          return (
            <g key={l.name}>
              <circle cx={x} cy={y} r={markRadius(l.diameterKm, hint)}
                fill="none" stroke="#DDE4F0" strokeOpacity={0.42} strokeWidth={1.2} />
              {label && (
                <text x={x} y={y - markRadius(l.diameterKm, hint) - 5} style={S.landmark}>{l.name}</text>
              )}
            </g>
          );
        })}
      </g>

      {/* This run's ports. Solid when the Sun is up, hollow when it is not —
          SHAPE, not just colour, so the state survives a colourblind reading. */}
      {rep.ports.map((p) => {
        const x = px(p.lonE), y = py(p.lat);
        const here = p.id === hereId, sel = p.id === dest;
        const lit = p.lit === true;
        return (
          <g key={p.id} role="button" tabIndex={0} style={{ cursor: "pointer" }}
            aria-label={`${p.name}, at ${Math.abs(p.lat).toFixed(0)} degrees `
              + `${p.lat >= 0 ? "north" : "south"}. `
              + (p.lit === null ? "Lighting not modelled here. "
                : lit ? `In daylight, sun ${p.sunAltDeg.toFixed(0)} degrees up. ` : "In local night. ")
              + (here ? "You are docked here." : "Plot a course.")}
            onClick={() => onPick(p.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.id); } }}>
            <circle cx={x} cy={y} r={20} fill="transparent" />
            <circle cx={x} cy={y} r={here || sel ? 9 : 6.5}
              fill={lit ? (here ? "var(--gold)" : "#fff") : "none"}
              stroke={here || sel ? "var(--gold)" : lit ? "#070A12" : "#9FB2C8"} strokeWidth={2.2} />
            <text x={x + 14} y={y + 5}
              style={{ ...S.port, fill: here ? "var(--gold)" : lit ? "#EAF0FA" : "#9FB2C8" }}>
              {here ? "⚓ " : ""}{p.name}
            </text>
          </g>
        );
      })}

      {rep.ports.length === 0 && (
        <text x={VBW / 2} y={Y0 + H + 52} style={{ ...S.axis, textAnchor: "middle", fontSize: 13 }}>
          Nothing of yours is on this world — the geography is real all the same.
        </text>
      )}

      <g role="button" tabIndex={0} aria-label="Back to the system view" style={{ cursor: "pointer" }}
        onClick={onBack} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack(); } }}>
        <rect x="24" y="24" width="184" height="40" rx="10" fill="var(--panel-2)" stroke="var(--line)" />
        <text x="116" y="50" style={{ ...S.port, textAnchor: "middle", fill: "#CDD5E4", fontSize: 14 }}>
          ← System (Esc)
        </text>
      </g>
    </svg>
  );
}

/**
 * The panel beside the map. Same rule as the system view: what you are reading
 * about is what you are looking at.
 *
 * It carries the two things the SVG cannot — the honesty note about what the
 * lighting does and does not claim, and the geography as TEXT, which is how a
 * screen-reader user meets a map.
 */
export function SurfacePanel({ game, bodyId, onBack }) {
  const rep = useMemo(
    () => surfaceReport(bodyId, game.sites || [], game.t),
    [bodyId, game.sites, game.t],
  );
  if (!rep) return null;

  const dark = rep.ports.filter((p) => p.lit === false).length;
  return (
    <Screen title={rep.name} onBack={onBack}
      hint={`${rep.ports.length} of your ports · ${rep.landmarks.length} named features`}>
      <StatStrip items={[
        { label: "Solar day", value: rep.solarDay || "not modelled" },
        { label: "Axial tilt", value: rep.seasonAmplitudeDeg === null ? "—" : `${rep.seasonAmplitudeDeg.toFixed(1)}°` },
        { label: "In darkness", value: rep.rotationKnown ? `${dark} of ${rep.ports.length}` : "—" },
      ]} />

      {rep.polarNight && (
        <div style={S.note}>
          <strong>Polar night.</strong> With the Sun {rep.subsolarLatDeg >= 0 ? "north" : "south"} of the
          equator, everywhere poleward of {rep.polarNight.fromLat.toFixed(0)}° {rep.polarNight.hemisphere}
          {" "}sees no sunrise at all. That is not weather; it is the axial tilt, and it is why a base
          near a pole is a decision about power before it is anything else.
        </div>
      )}

      {!rep.rotationKnown && (
        <div style={S.note}>
          <strong>No rotation model for {rep.name}.</strong> Its day length and tilt are not in
          <code> data/bodies.js</code>, so no terminator is drawn here. A flat-lit world stated as
          fact would be worse than an admitted gap.
        </div>
      )}

      <div style={S.head}>Your ports here</div>
      {rep.ports.length === 0 && <div style={S.dim}>None this run.</div>}
      {rep.ports.map((p) => (
        <div key={p.id} style={S.row}>
          <div style={{ minWidth: 0 }}>
            <div style={S.rowName}>{p.name}</div>
            <div style={S.dim}>
              {Math.abs(p.lat).toFixed(1)}°{p.lat >= 0 ? "N" : "S"}, {Math.abs(p.lonE).toFixed(1)}°
              {p.lonE >= 0 ? "E" : "W"} — {p.iauName}
            </div>
          </div>
          <div style={{ ...S.lit, color: p.lit === false ? "#9FB2C8" : "var(--gold)" }}>
            {p.lit === null ? "—" : p.lit ? `☀ ${p.sunAltDeg.toFixed(0)}°` : "☾ night"}
          </div>
        </div>
      ))}

      <div style={S.head}>The named geography</div>
      <div style={S.dim}>
        The {rep.landmarks.length} largest approved features on {rep.name}, from the IAU Gazetteer of
        Planetary Nomenclature. Largest first.
      </div>
      <div style={S.landmarkList}>
        {rep.landmarks.map((l) => (
          <span key={l.name} style={S.chip}>
            {l.name}{l.diameterKm ? ` · ${l.diameterKm.toLocaleString()} km` : ""}
          </span>
        ))}
      </div>

      <Footnote>
        The length of the day and the swing of the seasons are real. WHERE the Sun stands on a given
        date is not — the model has the right rhythm off an arbitrary zero, so this shows how the
        light moves here, never what time it is at a named place on a named day. Nor does it know
        about terrain: a crater floor in permanent shadow is a fact about its rim, not its latitude.
      </Footnote>
    </Screen>
  );
}

const S = {
  title: { fontSize: 26, fill: "#EAF0FA", fontWeight: 700, fontFamily: "inherit" },
  sub: { fontSize: 13, fill: "#9FB2C8", fontFamily: "inherit" },
  axis: { fontSize: 11.5, fill: "#8A94A8", fontFamily: "inherit" },
  landmark: { fontSize: 10.5, fill: "#C2CBDB", fillOpacity: 0.72, textAnchor: "middle", fontFamily: "inherit", pointerEvents: "none" },
  port: { fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", pointerEvents: "none" },

  note: { margin: "0 0 12px", padding: "10px 12px", background: "rgba(242,180,65,0.08)", border: "1px solid rgba(242,180,65,0.3)", borderRadius: 9, fontSize: 12.5, lineHeight: 1.55 },
  head: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", margin: "14px 0 6px" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 5, background: "#0B111C", border: "1px solid var(--line)", borderRadius: 8 },
  rowName: { fontSize: 13.5, fontWeight: 600 },
  lit: { fontSize: 12.5, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  dim: { fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 },
  landmarkList: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 },
  chip: { fontSize: 11, color: "#B9C2D4", border: "1px solid var(--line)", borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" },
};
