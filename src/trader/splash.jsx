// ===========================================================================
// SPLASH + START MENU — the front door.
//
// Replaces the old "systems hub" that exposed the under-the-hood labs as the
// landing page. The game is the front door now: title, then Continue (if a save
// exists) / New game / Options, plus load-from-file. Continue and file import
// are wired to the real save layer; Options is an honest placeholder until a
// settings model exists.
//
// The labs still exist for reference (the in-game Codex to be), reachable from
// a quiet link here rather than being the first thing anyone sees.
// ===========================================================================
import { useRef, useState } from "react";
import { savedSummary, deserialize } from "../save.js";

export default function Splash({ onNew, hasSave, onContinue, onImported }) {
  const [options, setOptions] = useState(false);
  const [fileError, setFileError] = useState(null);
  const fileInput = useRef(null);
  const summary = hasSave ? savedSummary() : null;

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
      <div style={s.inner}>
        <img src={`${import.meta.env.BASE_URL}title-card.png`} alt="SOLBOUND" style={s.logo} />
        <p style={s.tagline}>An economic strategy game in the real solar system.<br />The map is delta-v, not distance.</p>

        {options ? (
          <Options onBack={() => setOptions(false)} />
        ) : (
          <div style={s.menu}>
            {summary && (
              <button style={s.primary} onClick={onContinue}>
                <div style={s.contTop}>Continue ▸</div>
                <div style={s.contSub}>{summary.name} · {summary.where === "under way" ? "under way" : summary.where} · {summary.dateISO}</div>
              </button>
            )}
            <button style={summary ? s.secondary : s.primary} onClick={onNew}>New game{summary ? "" : " ▸"}</button>
            <button style={s.secondary} onClick={() => fileInput.current?.click()}>Load from file</button>
            <button style={s.secondary} onClick={() => setOptions(true)}>Options</button>
            <input ref={fileInput} type="file" accept=".json,application/json" onChange={onFile} style={{ display: "none" }} />
            {fileError && <div style={s.fileErr}>{fileError}</div>}
          </div>
        )}

        <p style={s.draft}>
          Early build. The economy and physics underneath are real and tested; the
          game around them is still coming together. Facts and figures on the cards
          are drafts — don't learn from them yet.
        </p>
        <a href="#/codex" style={s.codex}>Reference &amp; systems →</a>
      </div>
    </div>
  );
}

function Options({ onBack }) {
  return (
    <div style={s.optionsBox}>
      <div style={s.optTitle}>Options</div>
      <p style={s.optNote}>
        Difficulty, victory conditions (a short <b>Run</b> to a target fortune, or the
        long <b>Campaign</b> to sever Earth-dependency), sound and accessibility settings
        will live here. Not wired yet.
      </p>
      <div style={s.optRow}><span>Mode</span><span style={s.optVal}>Campaign (only mode so far)</span></div>
      <div style={s.optRow}><span>Difficulty</span><span style={s.optVal}>Standard</span></div>
      <div style={s.optRow}><span>Reduce motion</span><span style={s.optVal}>Follows your system setting</span></div>
      <button style={s.back} onClick={onBack}>← Back</button>
    </div>
  );
}

const s = {
  wrap: { minHeight: "100%", display: "grid", placeItems: "center", background: "radial-gradient(1100px 560px at 50% 8%, #14243f 0%, var(--bg) 62%)", padding: "40px 20px" },
  inner: { width: "100%", maxWidth: 560, textAlign: "center" },
  logo: { width: "100%", maxWidth: 480, height: "auto", display: "block", margin: "0 auto 6px" },
  tagline: { fontSize: 15.5, color: "#CDD5E4", lineHeight: 1.6, margin: "6px 0 30px" },
  menu: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 340, margin: "0 auto" },
  primary: { padding: "14px", fontSize: 16, fontWeight: 700, background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 12, cursor: "pointer" },
  contTop: { fontSize: 17 },
  contSub: { fontSize: 12, fontWeight: 400, marginTop: 3, opacity: 0.8 },
  secondary: { padding: "13px", fontSize: 15, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 12, cursor: "pointer" },
  fileErr: { fontSize: 12.5, color: "var(--hot)", lineHeight: 1.5, marginTop: 2 },
  draft: { fontSize: 12, color: "var(--muted)", maxWidth: 420, margin: "30px auto 0", lineHeight: 1.6 },
  codex: { display: "inline-block", marginTop: 16, fontSize: 12.5, color: "var(--muted)", textDecoration: "none", borderBottom: "1px dotted var(--muted)", paddingBottom: 1 },

  optionsBox: { maxWidth: 400, margin: "0 auto", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, textAlign: "left" },
  optTitle: { fontSize: 18, fontWeight: 700, marginBottom: 10 },
  optNote: { fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 },
  optRow: { display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 },
  optVal: { color: "var(--muted)" },
  back: { marginTop: 16, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 },
};
