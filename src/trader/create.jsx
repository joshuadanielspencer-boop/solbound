// ===========================================================================
// CAPTAIN CREATION — the customisable person the player is (design.md decision).
//
// Two paths to the same place: pick a ready-made background, or spend the 16
// skill points yourself. Either way you leave with a legal allocation and a
// name. Kept deliberately short — Space Trader's whole creation was one screen,
// and that immediacy is part of what we're borrowing.
// ===========================================================================
import { useState } from "react";
import {
  SKILLS, BACKGROUNDS, SKILL_POINTS, SKILL_MIN, SKILL_MAX, validSkills, backgroundById,
} from "../data/captain.js";

export default function CreateCaptain({ onBegin, onBack }) {
  const [name, setName] = useState("");
  const [skills, setSkills] = useState(BACKGROUNDS[0].skills);
  const [bg, setBg] = useState(BACKGROUNDS[0].id);

  const spent = Object.values(skills).reduce((a, b) => a + b, 0);
  const left = SKILL_POINTS - spent;
  const legal = validSkills(skills);

  const pickBackground = (id) => { setBg(id); setSkills(backgroundById(id).skills); };

  // Manual edits move off any background and respect the point budget: you can
  // only raise a skill if you have points left and it isn't maxed.
  const setSkill = (id, v) => {
    v = Math.max(SKILL_MIN, Math.min(SKILL_MAX, v));
    const next = { ...skills, [id]: v };
    if (Object.values(next).reduce((a, b) => a + b, 0) > SKILL_POINTS) return;
    setBg(null);
    setSkills(next);
  };

  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        {onBack && <button style={s.backLink} onClick={onBack}>← Back to menu</button>}
        <img src={`${import.meta.env.BASE_URL}title-card.png`} alt="SOLBOUND" style={s.logo} />
        <h1 style={s.h1}>Take command</h1>
        <p style={s.lead}>
          You begin with one ship, a modest purse, and the whole solar system priced
          in delta-v. Who are you?
        </p>

        <label style={s.label}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Captain…"
          style={s.input} maxLength={24} aria-label="Captain name" />

        <div style={s.section}>Choose a past</div>
        <div style={s.bgGrid}>
          {BACKGROUNDS.map((b) => (
            <button key={b.id} onClick={() => pickBackground(b.id)}
              style={{ ...s.bgCard, ...(bg === b.id ? s.bgOn : null) }} aria-pressed={bg === b.id}>
              <div style={s.bgTop}><span style={s.bgEmoji}>{b.emoji}</span><b>{b.name}</b></div>
              <div style={s.bgStory}>{b.story}</div>
            </button>
          ))}
        </div>

        <div style={s.section}>
          …or set your own skills
          <span style={{ ...s.points, color: left === 0 ? "var(--gold)" : left < 0 ? "var(--hot)" : "var(--muted)" }}>
            {left} point{left === 1 ? "" : "s"} left
          </span>
        </div>
        <div style={s.skills}>
          {SKILLS.map((sk) => (
            <div key={sk.id} style={s.skillRow}>
              <div style={s.skillHead}>
                <span>{sk.emoji} <b>{sk.name}</b> <span style={s.skillNum}>{skills[sk.id]}</span></span>
                <span style={s.skillAffects}>{sk.affects}</span>
              </div>
              <input type="range" min={SKILL_MIN} max={SKILL_MAX} value={skills[sk.id]}
                onChange={(e) => setSkill(sk.id, +e.target.value)} style={s.slider}
                aria-label={`${sk.name} skill`} />
            </div>
          ))}
        </div>

        <button style={{ ...s.begin, opacity: legal ? 1 : 0.4 }} disabled={!legal}
          onClick={() => onBegin({ name: name.trim() || "Captain", skills })}>
          Begin ▸
        </button>
        {!legal && <div style={s.warn}>Spend exactly {SKILL_POINTS} points across the four skills.</div>}
      </div>
    </div>
  );
}

const s = {
  wrap: { minHeight: "100%", background: "radial-gradient(1200px 600px at 50% -10%, #12203a 0%, var(--bg) 60%)", overflowY: "auto" },
  inner: { maxWidth: 660, margin: "0 auto", padding: "40px 22px 70px" },
  backLink: { background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 13, marginBottom: 10, padding: 0 },
  logo: { width: "100%", maxWidth: 420, height: "auto", display: "block", margin: "0 auto 8px" },
  h1: { textAlign: "center", fontSize: 26, margin: "6px 0 4px" },
  lead: { textAlign: "center", color: "#CDD5E4", fontSize: 15, lineHeight: 1.6, margin: "0 0 26px" },
  label: { display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", marginBottom: 6 },
  input: { width: "100%", padding: "11px 14px", fontSize: 16, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)" },
  section: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", margin: "28px 0 12px" },
  points: { fontSize: 13, letterSpacing: 0.5, textTransform: "none" },
  bgGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  bgCard: { textAlign: "left", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "13px 15px", cursor: "pointer", color: "var(--text)" },
  bgOn: { border: "1px solid var(--gold)" },
  bgTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 15 },
  bgEmoji: { fontSize: 20 },
  bgStory: { fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 },
  skills: { display: "flex", flexDirection: "column", gap: 14 },
  skillRow: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "11px 14px" },
  skillHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12, flexWrap: "wrap" },
  skillNum: { display: "inline-block", minWidth: 22, textAlign: "center", color: "var(--gold)", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  skillAffects: { fontSize: 12, color: "var(--muted)" },
  slider: { width: "100%", accentColor: "var(--gold)" },
  begin: { marginTop: 30, width: "100%", padding: "14px", fontSize: 17, fontWeight: 700, background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 12, cursor: "pointer" },
  warn: { textAlign: "center", color: "var(--hot)", fontSize: 13, marginTop: 10 },
};
