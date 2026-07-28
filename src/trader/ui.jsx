// ===========================================================================
// PANEL UI — the primitives every screen in the side panel is built from.
//
// WHY THIS FILE EXISTS. The panel had become one long scrolling column per tab:
// the Dock was a port name, a system readout, a faction note, a paragraph of
// prose, a newspaper, a fuel box, a wait box and sixteen market rows, each with
// two lines of description. Everything was true, none of it was ordered, and the
// player's only tool for finding anything was the scroll wheel.
//
// Two rules fix it, and both come straight from Joshua:
//
//   1. GO DEEPER, DON'T GO LONGER. A screen offers a handful of labelled ways
//      in, and each one opens a screen of its own with a way back. Nothing
//      scrolls, because nothing is longer than a screen.
//
//   2. DETAIL ARRIVES ON HOVER, AND DISPLACES NOTHING. A row shows the numbers
//      you choose between — name, price, bay, tonnage. Its prose appears in a
//      bubble UNDER the row when you point at it, drawn over the rows below
//      rather than pushing them down. Nothing on screen ever moves, so the
//      thing you were about to click is still where you left it.
//
// That second rule is the one with a trap in it. The obvious implementation —
// render the description into the flow when hovered — reflows the list under the
// cursor, which moves the row you were aiming at out from under the pointer and
// can immediately un-hover it. The bubble is absolutely positioned for that
// reason, and the hovered row lifts its own z-index so its bubble paints over
// its neighbours instead of under them.
//
// Keyboard parity throughout (project rule 4): every hover behaviour is also a
// focus behaviour, so the bubble opens for a player who is tabbing.
// ===========================================================================

import { useEffect, useRef, useState } from "react";

// The three formatters every screen needs. They lived in play.jsx and are now
// shared, because a panel that formats money differently from the HUD above it
// is the kind of small wrongness nobody can quite name.
export const HOVER_DELAY_MS = 160;

export const money = (n) => "$" + Math.round(n).toLocaleString();
export const fmtDate = (t) =>
  new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
export const fmtDur = (d) =>
  d < 60 ? `${Math.round(d)} days` : d < 700 ? `${(d / 30.44).toFixed(0)} months` : `${(d / 365.25).toFixed(1)} years`;

// ---------------------------------------------------------------------------
// Screen — a panel page, with a title and (below the top level) a way back
// ---------------------------------------------------------------------------

/**
 * `onBack` present = this is a sub-screen and gets a back bar. `hint` is one
 * line under the title for what this screen is for; keep it to one line,
 * because a paragraph here is how the old panel started.
 */
export function Screen({ title, hint, onBack, right, children }) {
  return (
    <div style={S.screen}>
      <div style={S.head}>
        {onBack && (
          <button style={S.back} onClick={onBack} aria-label="Back">←</button>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={S.title}>{title}</div>
          {hint && <div style={S.hint}>{hint}</div>}
        </div>
        {right}
      </div>
      <div style={S.body}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavButton — a labelled way in
// ---------------------------------------------------------------------------

/**
 * The menu row that opens another screen. `value` is the at-a-glance state on
 * the right — the number that means you often do not have to go in at all.
 * `tone` colours that value: "gold" for money, "hot" for a problem, "ok" for
 * something good, undefined for neutral.
 */
export function NavButton({ icon, label, value, tone, note, disabled, onClick }) {
  return (
    <button style={{ ...S.nav, ...(disabled ? S.navOff : null) }} onClick={onClick} disabled={disabled}>
      <span style={S.navIcon} aria-hidden="true">{icon}</span>
      <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <span style={S.navLabel}>{label}</span>
        {note && <span style={S.navNote}>{note}</span>}
      </span>
      {value != null && <span style={{ ...S.navValue, color: toneColor(tone) }}>{value}</span>}
      <span style={S.navChev} aria-hidden="true">›</span>
    </button>
  );
}

const toneColor = (tone) =>
  tone === "gold" ? "var(--gold)" : tone === "hot" ? "var(--hot)"
    : tone === "ok" ? "#3E9B6E" : "var(--muted)";

// ---------------------------------------------------------------------------
// InfoRow — essential data always, prose on hover, nothing ever moves
// ---------------------------------------------------------------------------

/**
 * Wrap any row that has a description worth reading but not worth showing.
 *
 * `info` is the prose. It appears in a bubble anchored under the row, drawn
 * OVER whatever follows — the row's z-index lifts while hovered so the bubble
 * is never painted beneath the next row's background.
 *
 * `onActivate` makes the whole row clickable; leave it off and the row is inert
 * scaffolding around its own buttons.
 */
export function InfoRow({ info, children, onActivate, selected, disabled }) {
  const [open, setOpen] = useState(false);
  // A SHORT DELAY BEFORE THE BUBBLE OPENS. With none, dragging the cursor across
  // a list fired every description on the way past, which is a strobe rather
  // than a hover. 160ms is long enough that crossing a row does nothing and
  // short enough that pointing AT one feels immediate. Leaving hides at once —
  // a delay on the way out would leave bubbles hanging over what you clicked.
  const timer = useRef(null);
  const show = () => {
    if (!info || timer.current) return;
    timer.current = setTimeout(() => { timer.current = null; setOpen(true); }, HOVER_DELAY_MS);
  };
  const hide = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setOpen(false);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const clickable = !!onActivate && !disabled;
  return (
    <div
      style={{ ...S.rowWrap, zIndex: open ? 20 : 1 }}
      onMouseEnter={show} onMouseLeave={hide}
      onFocusCapture={show} onBlurCapture={hide}
    >
      <div
        style={{
          ...S.row,
          ...(selected ? S.rowOn : null),
          ...(open ? S.rowHover : null),
          ...(disabled ? S.rowOff : null),
          cursor: clickable ? "pointer" : "default",
        }}
        {...(clickable
          ? {
            role: "button", tabIndex: 0, onClick: onActivate,
            onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(); } },
          }
          : {})}
      >
        {children}
      </div>
      {open && info && <div style={S.bubble} role="tooltip">{info}</div>}
    </div>
  );
}

/** The left-hand half of a row: a name, and a line of small facts under it. */
export function RowMain({ name, tags, sub }) {
  return (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={S.rowName}>
        <span>{name}</span>
        {tags}
      </div>
      {sub && <div style={S.rowSub}>{sub}</div>}
    </div>
  );
}

/** The right-hand half: a figure, optionally with a second under it. */
export function RowValue({ top, bottom, tone, bottomTone }) {
  return (
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div style={{ ...S.rowTop, color: toneColor(tone) === "var(--muted)" ? "var(--text)" : toneColor(tone) }}>{top}</div>
      {bottom != null && <div style={{ ...S.rowBottom, color: toneColor(bottomTone) }}>{bottom}</div>}
    </div>
  );
}

/**
 * A PRICE PAIR, said out loud.
 *
 * Two bare numbers stacked in the corner of a row do not say which is which, and
 * the market screen showed exactly that. So each is labelled and toned by which
 * way the money goes: BUY is what leaves you, SELL is what arrives.
 *
 * The WORD is what carries the meaning and the colour only agrees with it, which
 * is project rule 4 — red and green are the worst possible pair to lean on
 * alone, and here they are leant on for nothing.
 */
export function PricePair({ buy, sell, sellTone }) {
  return (
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div style={S.priceLine}>
        <span style={{ ...S.priceTag, color: "var(--hot)" }}>BUY</span>
        <span style={{ ...S.rowTop, color: "var(--hot)" }}>{buy}</span>
      </div>
      <div style={{ ...S.priceLine, marginTop: 2 }}>
        <span style={{ ...S.priceTag, color: "#3E9B6E" }}>SELL</span>
        <span style={{ ...S.rowTop, color: sellTone ? toneColor(sellTone) : "#3E9B6E" }}>{sell}</span>
      </div>
    </div>
  );
}

/** A small pill. Colour is always paired with the word itself (rule 4). */
export const Tag = ({ children, tone }) => (
  <span style={{ ...S.tag, color: toneColor(tone), borderColor: toneColor(tone) }}>{children}</span>
);

// ---------------------------------------------------------------------------
// StatStrip — the handful of numbers a screen leads with
// ---------------------------------------------------------------------------

export function StatStrip({ items }) {
  return (
    <div style={S.strip}>
      {items.map((it) => (
        <div key={it.label} style={S.stripItem} title={it.hint || ""}>
          <div style={S.stripLabel}>{it.label}</div>
          <div style={{ ...S.stripValue, color: toneColor(it.tone) === "var(--muted)" ? "var(--text)" : toneColor(it.tone) }}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** An action that is the point of the screen it is on. */
export const PrimaryButton = ({ children, disabled, onClick, tone }) => (
  <button style={{ ...S.primary, ...(disabled ? S.primaryOff : null), ...(tone === "quiet" ? S.primaryQuiet : null) }}
    disabled={disabled} onClick={onClick}>{children}</button>
);

/** One line of explanation, for the bottom of a screen. Never more than two. */
export const Footnote = ({ children }) => <div style={S.footnote}>{children}</div>;

const S = {
  screen: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 },
  head: { display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px 10px", borderBottom: "1px solid var(--line)", flexShrink: 0 },
  back: { background: "var(--panel-2)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "var(--text)", fontSize: 15, flexShrink: 0, lineHeight: 1 },
  title: { fontSize: 17, fontWeight: 700, lineHeight: 1.25 },
  hint: { fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 },
  // The one place scrolling is still allowed, and only as a safety net: a
  // desktop window fits these screens, a very short one would not.
  body: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px 16px", display: "flex", flexDirection: "column", gap: 6 },

  nav: { display: "flex", alignItems: "center", gap: 11, width: "100%", background: "var(--panel-2)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 10, padding: "11px 13px", cursor: "pointer", color: "var(--text)", fontSize: 14, textAlign: "left" },
  navOff: { opacity: 0.45, cursor: "default" },
  navIcon: { fontSize: 15, width: 20, flexShrink: 0, textAlign: "center" },
  navLabel: { display: "block", fontWeight: 600 },
  navNote: { display: "block", fontSize: 11.5, color: "var(--muted)", marginTop: 2 },
  navValue: { fontSize: 12.5, fontVariantNumeric: "tabular-nums", flexShrink: 0, whiteSpace: "nowrap" },
  navChev: { color: "var(--muted)", fontSize: 17, flexShrink: 0, lineHeight: 1 },

  rowWrap: { position: "relative" },
  row: { display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderWidth: "1px", borderStyle: "solid", borderColor: "transparent", borderRadius: 9, background: "#0B111C" },
  rowHover: { borderColor: "var(--line)", background: "var(--panel-2)" },
  rowOn: { borderColor: "var(--gold)", background: "var(--panel-2)" },
  rowOff: { opacity: 0.45 },
  rowName: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13.5 },
  rowSub: { fontSize: 11, color: "var(--muted)", marginTop: 2 },
  rowTop: { fontSize: 13, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  rowBottom: { fontSize: 11.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", marginTop: 1 },
  priceLine: { display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 6 },
  priceTag: { fontSize: 9, fontWeight: 700, letterSpacing: 0.9 },

  // Absolutely positioned so the list never reflows under the cursor.
  bubble: { position: "absolute", top: "100%", left: 0, right: 0, marginTop: 3, background: "#0E1626", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--gold)", borderRadius: 9, padding: "9px 12px", fontSize: 12, lineHeight: 1.55, color: "#CDD5E4", boxShadow: "0 10px 28px rgba(0,0,0,0.6)", pointerEvents: "none" },

  tag: { fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.6, borderWidth: "1px", borderStyle: "solid", borderRadius: 9, padding: "1px 6px", whiteSpace: "nowrap" },

  strip: { display: "flex", flexWrap: "wrap", gap: 14, padding: "2px 0 8px" },
  stripItem: { minWidth: 62, maxWidth: 118 },
  stripLabel: { fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)" },
  stripValue: { fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: 1 },

  primary: { width: "100%", background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 9, padding: "10px", cursor: "pointer", fontWeight: 700, fontSize: 14, marginTop: 2 },
  primaryOff: { opacity: 0.4, cursor: "default" },
  primaryQuiet: { background: "var(--panel-2)", color: "var(--text)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", fontWeight: 600 },

  footnote: { fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 4 },
};

export { S as PANEL_STYLES };
