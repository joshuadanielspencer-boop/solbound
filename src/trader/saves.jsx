// ===========================================================================
// YOUR RUNS — the screen between the title and the game.
//
// The front door used to go Continue → straight into the one save that existed.
// That is fine for one captain and wrong for the shape this game is growing
// into: a Run and a Campaign are two different games (design.md §12), a seed is
// a world worth keeping to compare against another, and someone who wants to try
// a smuggling run should not have to destroy the campaign they are twelve hours
// into.
//
// So this lists what the browser is holding, up to MAX_SLOTS, and every run says
// enough to be recognised without opening it: who, where, when, and how much.
//
// DELETING IS THE ONLY IRREVERSIBLE THING ON THIS SCREEN, so it asks — inline,
// on the row itself, rather than in a dialog that covers what you are about to
// destroy. There is no undo and there should not be one; the file export is the
// real safety net and it is one click away inside the game.
// ===========================================================================
import { useState } from "react";
import { listSaves, nextFreeSlot, MAX_SLOTS } from "../save.js";
import { useSfx } from "./sfx.jsx";

const money = (n) => "$" + Math.round(n || 0).toLocaleString();

export default function Saves({ onResume, onNew, onDelete, onBack }) {
  const sfx = useSfx();
  // Re-read on every render rather than caching in state: a delete has to be
  // visible immediately, and reading six localStorage keys costs nothing.
  const [version, setVersion] = useState(0);
  const [confirming, setConfirming] = useState(null);
  const saves = listSaves();
  const free = nextFreeSlot();
  const refresh = () => setVersion((v) => v + 1);

  return (
    <div style={s.wrap} data-version={version}>
      <div style={s.head}>
        <button style={s.back} onClick={() => { sfx("back"); onBack(); }} aria-label="Back to the title">←</button>
        <div>
          <div style={s.title}>Your runs</div>
          <div style={s.sub}>
            {saves.length
              ? `${saves.length} of ${MAX_SLOTS} · pick one up where you left it`
              : "Nothing saved on this machine yet."}
          </div>
        </div>
      </div>

      <div style={s.list}>
        {saves.map((r) => (
          <div key={r.slot} style={s.row}>
            {r.damaged ? (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.name}>Run {r.slot} — unreadable</div>
                <div style={s.meta}>{r.message}</div>
              </div>
            ) : (
              <button style={s.open}
                onClick={() => { sfx("select"); onResume(r.slot); }}
                aria-label={`Resume ${r.name}, ${r.where}, ${r.dateISO}`}>
                <div style={s.name}>
                  {r.name}
                  {r.over && <span style={s.dead}>ended</span>}
                </div>
                <div style={s.meta}>
                  {r.where === "under way" ? "under way" : r.where} · {r.dateISO} · {money(r.credits)}
                </div>
                {/* The seed is on the row because a world is worth being able to
                    name. Two runs on the same seed are the same solar system
                    with different decisions in it, which is a comparison the
                    game is built to support and nothing else surfaces. */}
                <div style={s.seed}>seed {r.seed}</div>
              </button>
            )}
            {confirming === r.slot ? (
              <div style={s.confirmRow}>
                <span style={s.confirmText}>Delete?</span>
                <button style={s.danger}
                  onClick={() => { sfx("back"); onDelete(r.slot); setConfirming(null); refresh(); }}>Yes</button>
                <button style={s.small} onClick={() => setConfirming(null)}>No</button>
              </div>
            ) : (
              <button style={s.small} onClick={() => setConfirming(r.slot)}
                aria-label={`Delete ${r.name || `run ${r.slot}`}`}>Delete</button>
            )}
          </div>
        ))}

        {free ? (
          <button style={s.newRun} onClick={() => { sfx("select"); onNew(free); }}>
            + Start a new run
            <span style={s.newSub}>{saves.length ? `${MAX_SLOTS - saves.length} free` : "one ship, and the whole solar system priced in delta-v"}</span>
          </button>
        ) : (
          <div style={s.fullNote}>
            All {MAX_SLOTS} places are taken. Delete one to start another — and export it
            from inside the game first if you want to keep it.
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { position: "relative", width: "100%", maxWidth: 520, margin: "0 auto", textAlign: "left" },
  head: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  back: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 9, width: 36, height: 36, cursor: "pointer", color: "var(--text)", fontSize: 16, flexShrink: 0 },
  title: { fontSize: 21, fontWeight: 700 },
  sub: { fontSize: 12.5, color: "var(--muted)", marginTop: 2 },
  list: { display: "flex", flexDirection: "column", gap: 9 },
  row: { display: "flex", alignItems: "center", gap: 8, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "4px 10px 4px 4px" },
  open: { flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: "10px 12px", cursor: "pointer", color: "var(--text)", borderRadius: 9 },
  name: { fontSize: 15.5, fontWeight: 700 },
  dead: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--hot)", border: "1px solid var(--hot)", borderRadius: 9, padding: "1px 7px", marginLeft: 8 },
  meta: { fontSize: 12.5, color: "var(--muted)", marginTop: 3, fontVariantNumeric: "tabular-nums" },
  seed: { fontSize: 11, color: "var(--muted)", opacity: 0.7, marginTop: 2 },
  small: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 11px", cursor: "pointer", color: "var(--muted)", fontSize: 12, flexShrink: 0 },
  danger: { background: "var(--panel-2)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--hot)", borderRadius: 8, padding: "6px 11px", cursor: "pointer", color: "var(--hot)", fontSize: 12, flexShrink: 0 },
  confirmRow: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 },
  confirmText: { fontSize: 12, color: "var(--muted)" },
  newRun: { display: "flex", flexDirection: "column", gap: 3, textAlign: "left", background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 12, padding: "13px 16px", cursor: "pointer", fontSize: 15.5, fontWeight: 700 },
  newSub: { fontSize: 12, fontWeight: 400, opacity: 0.78 },
  fullNote: { fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, padding: "10px 2px" },
};
