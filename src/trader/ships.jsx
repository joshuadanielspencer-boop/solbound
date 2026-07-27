// ===========================================================================
// SHIP SILHOUETTES — the encounter face-off, drawn rather than described.
//
// Space Trader put two ships nose to nose at the top of every encounter, with a
// badge saying whose the other one was. It is the single cheapest thing in that
// game and it does more work than any text: you know instantly whether this is a
// patrol, a raider or somebody wanting to trade, before you have read a word.
//
// SVG, not sprites, for the same reason the rest of the game is SVG (design.md
// §12): these are a handful of shapes, they scale to any size, they cost nothing
// to ship, and they inherit the theme's colours instead of fighting them.
//
// Every ship faces RIGHT and is drawn in a 100x60 box, so the encounter can flip
// one of them and put them nose to nose without any per-ship fiddling.
// ===========================================================================

/** The player's hull, one silhouette per class — recognisably the ship you bought. */
export function HullArt({ hull = "courier", color = "var(--gold)", size = 92 }) {
  const body = {
    // A needle: all engine and tank, almost no hold.
    courier: "M8 30 L58 22 L88 30 L58 38 Z",
    // Broad-shouldered and slab-sided.
    clipper: "M6 30 L28 18 L70 20 L92 30 L70 40 L28 42 Z",
    // A brick with engines. Cargo first, everything else later.
    freighter: "M4 16 L66 16 L94 30 L66 44 L4 44 Z",
    // Blunt nose, gear hanging off it.
    prospector: "M6 20 L60 18 L90 30 L60 42 L6 40 Z M20 12 L34 12 L34 20 L20 20 Z M20 40 L34 40 L34 48 L20 48 Z",
    // Lean and forward-swept: the one built for a fight.
    cutter: "M4 30 L34 20 L92 28 L92 32 L34 40 Z M30 8 L46 22 L34 22 Z M30 52 L46 38 L34 38 Z",
  }[hull] || "M8 30 L58 22 L88 30 L58 38 Z";

  return (
    <svg viewBox="0 0 100 60" width={size} height={size * 0.6} role="img" aria-label={`${hull} silhouette`}>
      <path d={body} fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {/* The drive glow, so a ship reads as under power rather than adrift. */}
      <ellipse cx="6" cy="30" rx="5" ry="3.5" fill={color} fillOpacity="0.55" />
    </svg>
  );
}

/**
 * Whoever it is out there. The shape carries the meaning: a patrol is a blunt
 * wedge with a badge, a raider is all spines, a trader is a fat hull, a wreck is
 * broken.
 */
export function StrangerArt({ kind = "hostile", encounterId = "", size = 92 }) {
  const derelict = encounterId === "derelict" || encounterId === "windfall";
  const tone = derelict ? "#8891A5"
    : kind === "hostile" ? "var(--hot)"
      : kind === "authority" ? "#7FB2CE"
        : "#3E9B6E";

  const shape = derelict
    // A hull that stopped being a ship a long time ago.
    ? "M14 22 L58 16 L74 26 L52 30 L70 34 L44 44 L18 38 Z"
    : kind === "hostile"
      // Spines and a forward-swept ram.
      ? "M4 30 L30 18 L88 26 L88 34 L30 42 Z M26 6 L44 20 L30 20 Z M26 54 L44 40 L30 40 Z"
      : kind === "authority"
        // A blunt, heavy wedge — built to be seen and not to be argued with.
        ? "M6 18 L62 22 L90 30 L62 38 L6 42 Z M20 22 L20 38 L34 38 L34 22 Z"
        // A fat, unthreatening hauler.
        : "M8 20 L64 18 L92 30 L64 42 L8 40 Z";

  return (
    <svg viewBox="0 0 100 60" width={size} height={size * 0.6} role="img"
      aria-label={derelict ? "a drifting wreck" : `an approaching ${kind} ship`}
      style={{ transform: "scaleX(-1)" }}>
      <path d={shape} fill={tone} fillOpacity={derelict ? 0.12 : 0.22} stroke={tone}
        strokeWidth="1.6" strokeLinejoin="round" strokeDasharray={derelict ? "4 3" : undefined} />
      {!derelict && <ellipse cx="6" cy="30" rx="5" ry="3.5" fill={tone} fillOpacity="0.55" />}
      {/* The authority badge — Space Trader's little shield, which is how you
          know at a glance that running is a different decision this time. */}
      {kind === "authority" && (
        <g transform="translate(64 8) scale(-1 1)">
          <path d="M0 0 L12 0 L12 8 L6 13 L0 8 Z" fill="#7FB2CE" fillOpacity="0.35" stroke="#7FB2CE" strokeWidth="1.2" />
          <path d="M6 3 L7.2 5.6 L10 5.9 L7.9 7.7 L8.5 10.4 L6 9 L3.5 10.4 L4.1 7.7 L2 5.9 L4.8 5.6 Z" fill="#7FB2CE" />
        </g>
      )}
    </svg>
  );
}

/** The two of them, nose to nose, with the range between. */
export function FaceOff({ hull, kind, encounterId, distanceNote }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "4px 0 14px" }}>
      <HullArt hull={hull} />
      <div style={{ flex: 1, textAlign: "center", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>
        <div style={{ borderTop: "1px dashed var(--line)", margin: "0 4px 4px" }} />
        {distanceNote}
      </div>
      <StrangerArt kind={kind} encounterId={encounterId} />
    </div>
  );
}
