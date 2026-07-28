// ===========================================================================
// SPLASH + START MENU — the front door.
//
// Replaces the old "systems hub" that exposed the under-the-hood labs as the
// landing page. The game is the front door now: title, then Continue (if any run
// exists) / New game, plus load-from-file.
//
// CONTINUE NO LONGER RESUMES A GAME. It opens the list of runs (saves.jsx) and
// you pick one, because there can now be up to MAX_SLOTS of them. The most
// recent one is named under the button so the common case — one player, one
// campaign — still reads as "carry on with that".
//
// OPTIONS IS GONE. It was an honest placeholder for a settings model that never
// arrived, and everything it actually did is now where it belongs: music and
// effects live behind the ♪ control in the game's own header, next to the sound
// they change. A menu entry that opens a box explaining it does almost nothing
// is worse than no menu entry.
//
// `chrome` mode renders CHILDREN instead of the menu, keeping the title, the
// starfield and the copyright line around whatever screen the front door is
// showing — so stepping from the title to the runs list does not feel like
// leaving the game.
//
// The labs still exist for reference (the in-game Codex to be), reachable from
// a quiet link here rather than being the first thing anyone sees.
// ===========================================================================
import { useMemo, useRef, useState } from "react";
import { listSaves, deserialize } from "../save.js";
import { starfield, galacticBand } from "../starfield.js";

/**
 * The same starfield the orrery uses, behind the title. Its own seed, so the
 * front door does not show the same sky as Earth's system — and stretched to
 * the window rather than a square, since a splash is whatever shape the window
 * is (starfield.js takes a height for exactly this).
 */
function SplashSky() {
  const W = 1600, H = 900;
  const field = useMemo(() => starfield(W, 8675309, 0, H), []);
  const band = useMemo(() => galacticBand(W, H), []);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={s.sky} aria-hidden="true">
      <defs>
        <radialGradient id="splashBand">
          <stop offset="0%" stopColor="#8FA6D8" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#8FA6D8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={band.cx} cy={band.cy} rx={band.rx} ry={band.ry} fill="url(#splashBand)"
        transform={`rotate(${band.rotate} ${band.cx} ${band.cy})`} />
      {field.map((t) => (
        <path key={t.id} d={t.d} stroke="#DCE6FF" strokeWidth={t.size} strokeOpacity={t.opacity}
          strokeLinecap="round" fill="none" />
      ))}
    </svg>
  );
}

export default function Splash({ onNew, hasSave, onContinue, onImported, audio, onToggleAudio, chrome, children }) {
  const [fileError, setFileError] = useState(null);
  const fileInput = useRef(null);
  // The most recent run, named under Continue. Reading it here rather than
  // taking it as a prop keeps the front door honest after a delete.
  const runs = hasSave ? listSaves() : [];
  const summary = runs.find((r) => !r.damaged) || null;

  const onFile = async (e) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const r = deserialize(await file.text());
    if (r.error) { setFileError(r.message); return; }
    onImported?.(r.save.state);
  };

  return (
    <div style={s.wrap}>
      <SplashSky />
      <img src={`${import.meta.env.BASE_URL}title-card.png`} alt="SOLBOUND" style={s.logoWide} />
      <div style={s.inner}>

        {chrome ? children : (
          <div style={s.menu}>
            {summary && (
              <button style={s.primary} onClick={onContinue}>
                <div style={s.contTop}>Continue ▸</div>
                <div style={s.contSub}>
                  {summary.name} · {summary.where === "under way" ? "under way" : summary.where} · {summary.dateISO}
                  {runs.length > 1 && ` · ${runs.length} runs`}
                </div>
              </button>
            )}
            <button style={summary ? s.secondary : s.primary} onClick={onNew}>New game{summary ? "" : " ▸"}</button>
            <button style={s.secondary} onClick={() => fileInput.current?.click()}>Load from file</button>
            <input ref={fileInput} type="file" accept=".json,application/json" onChange={onFile} style={{ display: "none" }} />
            {fileError && <div style={s.fileErr}>{fileError}</div>}
          </div>
        )}
        <p style={s.copyright}>© 2026 Lotus Creative Studios</p>
      </div>
    </div>
  );
}

const s = {
  wrap: { position: "relative", minHeight: "100%", display: "grid", placeItems: "center", background: "radial-gradient(1100px 560px at 50% 8%, #14243f 0%, var(--bg) 62%)", padding: "40px 20px", overflow: "hidden" },
  sky: { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" },
  inner: { position: "relative", width: "100%", maxWidth: 560, textAlign: "center" },
  copyright: { marginTop: 26, fontSize: 11.5, letterSpacing: 0.6, color: "var(--muted)", opacity: 0.75 },
  // THE LOGO'S BLACK IS BLENDED AWAY rather than edited out of the file.
  // `mix-blend-mode: screen` drops every black pixel to nothing and keeps the
  // bright ones, so the title card's square backing disappears into the
  // starfield behind it. Done in CSS the PNG stays the master, and the same
  // art works on whatever we put behind it later.
  //
  // It sits OUTSIDE the 560px menu column so it can be twice the size without
  // dragging the buttons wider with it.
  // Sized by BOTH axes so it can be twice as big without pushing the menu off a
  // short window: the browser takes whichever cap binds and keeps the aspect.
  // The negative bottom margin reclaims the title card's dead lower third —
  // which is pure black, and therefore already invisible once screened.
  logoWide: { maxWidth: "min(96vw, 960px)", maxHeight: "44vh", width: "auto", height: "auto", display: "block", margin: "-1vh auto -6vh", mixBlendMode: "screen", position: "relative" },
  tagline: { fontSize: 15.5, color: "#CDD5E4", lineHeight: 1.6, margin: "6px 0 30px" },
  menu: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 340, margin: "0 auto" },
  primary: { padding: "14px", fontSize: 16, fontWeight: 700, background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 12, cursor: "pointer" },
  contTop: { fontSize: 17 },
  contSub: { fontSize: 12, fontWeight: 400, marginTop: 3, opacity: 0.8 },
  secondary: { padding: "13px", fontSize: 15, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 12, cursor: "pointer" },
  fileErr: { fontSize: 12.5, color: "var(--hot)", lineHeight: 1.5, marginTop: 2 },
  draft: { fontSize: 12, color: "var(--muted)", maxWidth: 420, margin: "30px auto 0", lineHeight: 1.6 },

  optionsBox: { maxWidth: 400, margin: "0 auto", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, textAlign: "left" },
  optTitle: { fontSize: 18, fontWeight: 700, marginBottom: 10 },
  optNote: { fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 },
  optRow: { display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 },
  optBtn: { background: "var(--panel-2)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 8, padding: "5px 16px", cursor: "pointer", color: "var(--text)", fontSize: 12.5, minWidth: 64 },
  optVal: { color: "var(--muted)" },
  back: { marginTop: 16, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 },
};
