// ===========================================================================
// APP — the front door and the router.
//
// Most of what SOLBOUND has built is invisible: the physics and the economy are
// tested code with no screens. This hub fixes that. Each system gets its own
// hash route so it can be opened, bookmarked and shared on its own — exactly the
// "try them all individually" the design called for — and the sandboxes double
// as the in-game Codex later.
//
// Hash routing (not path routing) on purpose: it works on GitHub Pages with no
// server rewrites, and every panel gets a real URL like /solbound/#/rocket.
//
// AND IT CHECKS THE WINDOW IS WIDE ENOUGH BEFORE IT DRAWS ANYTHING. design.md
// §12 puts phones and tablets out of scope, which is a fine decision and was
// never implemented — so a phone got the desktop layout, folded in half, with
// the map pushed off-screen and half the viewport dead black. "Out of scope"
// and "broken" look identical to someone who followed a link. This is the
// difference: one sentence that says what the game needs, on a game that is
// live at a public URL where most links get opened on a phone.
// ===========================================================================
import { useEffect, useState } from "react";
import Wanderer from "./wanderer.jsx";
import RocketLab from "./labs/rocket.jsx";
import MarketLab from "./labs/market.jsx";
import DayNightLab from "./labs/daynight.jsx";
import TransferLab from "./labs/transfer.jsx";
import Trader from "./trader/index.jsx";

// Exported so data/concepts.js can be held against it: every lesson that says
// "→ Codex" has to point at a sandbox that exists.
export const ROUTES = {
  play:     { comp: Trader,      title: "SOLBOUND — the trade game", blurb: "Take command of a captain and one ship. Buy where a good is cheap, cross real orbits at a real fuel-and-time cost, sell where it's dear. The Space Trader floor, on the real solar system.", emoji: "🚀", tag: "playable" },
  fleet:    { comp: Wanderer,    title: "The fleet (survey demo)", blurb: "The earlier build: fly three ships across a live solar system with launch windows, real transfer orbits, the day/night terminator, and the survey game.", emoji: "🛰", tag: "demo" },
  rocket:   { comp: RocketLab,   title: "The rocket equation", blurb: "Drag the velocity change and watch the fuel cost explode. Why 'far' and 'hard' are different words — and why the torch drive is fiction.", emoji: "🧮", tag: "physics" },
  transfer: { comp: TransferLab, title: "Transfer planner", blurb: "Pick two worlds and a date. See the launch-window geometry, what leaving now costs, and when the cheap window opens.", emoji: "🪐", tag: "physics" },
  daynight: { comp: DayNightLab, title: "Day, night & seasons", blurb: "What 'the terminator' is: the day/night line, sweeping each world at its real day length. Mars is 24h 39m; Venus's day is longer than its year.", emoji: "🌓", tag: "physics" },
  market:   { comp: MarketLab,   title: "Trade & the ISRU lesson", blurb: "Two markets, live prices, and the split the physics forces: what's worth shipping across the solar system, and what you must make where you stand.", emoji: "📦", tag: "economy" },
};

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, "") || "home");
  useEffect(() => {
    const on = () => setRoute(window.location.hash.replace(/^#\/?/, "") || "home");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

// The reference panels — the "Codex". These are no longer the front door; the
// GAME is. They live behind #/codex as reference and as dev/test surfaces.
const CODEX_IDS = ["rocket", "transfer", "daynight", "market", "fleet"];

/**
 * THE NARROWEST WINDOW THE GAME IS DRAWN FOR. The play screen is a map beside a
 * panel; the panel alone wants about 500px and the map is not worth having
 * below roughly 400. 900 is where the two stop fitting side by side, measured
 * by narrowing the real thing until it broke rather than picked off a
 * breakpoint list.
 */
const MIN_WIDTH = 900;

function useWideEnough() {
  const [wide, setWide] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= MIN_WIDTH);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= MIN_WIDTH);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return wide;
}

/**
 * IT TELLS, IT DOES NOT FORBID. A hard block on a game somebody has just
 * followed a link to is a door slammed; the honest version says what the game
 * needs, and then lets them look anyway if they want to. Most will turn around,
 * which is the point — but the ones who came to see the title screen on a train
 * are not wrong to.
 */
function TooNarrow({ onAnyway }) {
  return (
    <div style={s.narrowWrap} role="dialog" aria-modal="true" aria-label="This game needs a desktop window">
      <div style={s.narrowCard}>
        <div style={s.narrowMark}>SOLBOUND</div>
        <h1 style={s.narrowTitle}>This one needs a desktop window.</h1>
        <p style={s.narrowBody}>
          SOLBOUND is a map beside a panel — a living solar system on one side and
          the ports, markets and your ship on the other. Below about {MIN_WIDTH} pixels
          they stop fitting side by side, so the game is built for a desktop window
          and does not have a phone layout.
        </p>
        <p style={s.narrowBody}>
          Open it on a laptop or desktop and it will be waiting.
        </p>
        <button style={s.narrowButton} onClick={onAnyway}>
          Show it anyway
        </button>
        <p style={s.narrowFoot}>It will be cramped, and some of it will not fit.</p>
      </div>
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  const wide = useWideEnough();
  // Asking for it anyway is remembered for the session, not stored — a person
  // who rotates a tablet back to landscape should simply get the game.
  const [anyway, setAnyway] = useState(false);
  return (
    <>
      <Routed route={route} />
      {/* AN OVERLAY, NOT A REPLACEMENT, and the difference is a bug I wrote and
          then caught with a test. Returning the notice INSTEAD of the route
          unmounts the game — so a desktop player who snaps the window to half
          the screen and back loses their position and gets the studio card
          again on the way in. Laying it over the top leaves the game mounted
          and running underneath, and crossing the threshold twice is a no-op. */}
      {!wide && !anyway && <TooNarrow onAnyway={() => setAnyway(true)} />}
    </>
  );
}

function Routed({ route }) {
  // The game is the front door: empty hash, or the legacy #/play, lands there.
  if (route === "home" || route === "play") return <Trader />;
  if (route === "codex") return <Codex />;
  const entry = ROUTES[route];
  if (!entry) return <Trader />;      // anything unknown → the game
  const C = entry.comp;
  return <C />;
}

function Codex() {
  useEffect(() => { document.title = "SOLBOUND — Reference & systems"; }, []);
  const tagColor = { physics: "#7FB2CE", economy: "#3E9B6E", demo: "var(--muted)" };
  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        <header style={s.header}>
          <a href="#/" style={s.backToGame}>← Back to the game</a>
          <div style={s.codexTitle}>Reference &amp; systems</div>
          <p style={s.tagline}>
            The engines under the game, each on its own — the rocket equation, the
            transfer maths, day and night, the market model — plus the earlier survey
            fleet demo. A place to see how the real physics works, and the seed of an
            in-game Codex.
          </p>
        </header>

        <div style={s.grid}>
          {CODEX_IDS.map((id) => {
            const r = ROUTES[id];
            return (
              <a key={id} href={`#/${id}`} style={s.card}>
                <div style={s.cardTop}>
                  <span style={s.emoji}>{r.emoji}</span>
                  <span style={{ ...s.tag, color: tagColor[r.tag] || "var(--muted)", borderColor: tagColor[r.tag] || "var(--line)" }}>{r.tag}</span>
                </div>
                <div style={s.cardTitle}>{r.title}</div>
                <div style={s.cardBlurb}>{r.blurb}</div>
                <div style={s.cardGo}>Open →</div>
              </a>
            );
          })}
        </div>

        <footer style={s.footer}>
          Built with real orbital mechanics (JPL elements), the Tsiolkovsky rocket
          equation, and a scarcity-priced economy. Every panel has its own link.
        </footer>
      </div>
    </div>
  );
}

const s = {
  narrowWrap: { position: "fixed", inset: 0, zIndex: 900, display: "flex", alignItems: "center",
    justifyContent: "center", padding: "32px 20px",
    background: "radial-gradient(900px 500px at 50% -10%, #12203a 0%, var(--bg) 60%)" },
  narrowCard: { maxWidth: 420, textAlign: "center" },
  narrowMark: { fontSize: 15, letterSpacing: 6, color: "var(--gold)", marginBottom: 28, fontWeight: 600 },
  narrowTitle: { fontSize: 23, lineHeight: 1.35, margin: "0 0 18px", fontWeight: 700 },
  narrowBody: { fontSize: 15, lineHeight: 1.65, color: "#CDD5E4", margin: "0 0 14px" },
  narrowButton: { marginTop: 14, padding: "11px 20px", fontSize: 14.5, fontFamily: "inherit",
    color: "var(--text)", background: "var(--panel)", border: "1px solid var(--line)",
    borderRadius: 10, cursor: "pointer" },
  narrowFoot: { fontSize: 12.5, color: "var(--muted)", margin: "10px 0 0" },
  wrap: { minHeight: "100%", background: "radial-gradient(1200px 600px at 50% -10%, #12203a 0%, var(--bg) 60%)" },
  inner: { maxWidth: 960, margin: "0 auto", padding: "60px 22px 80px" },
  header: { textAlign: "center", marginBottom: 40 },
  titleCard: { width: "100%", maxWidth: 620, height: "auto", display: "block", margin: "0 auto" },
  backToGame: { display: "inline-block", marginBottom: 14, fontSize: 13, color: "var(--gold)", textDecoration: "none" },
  codexTitle: { fontSize: 26, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 },
  tagline: { fontSize: 15, color: "#CDD5E4", margin: "4px auto 0", lineHeight: 1.6, maxWidth: 620 },
  draft: { fontSize: 12.5, color: "var(--muted)", maxWidth: 620, margin: "18px auto 0", lineHeight: 1.6,
    background: "rgba(228,113,63,0.10)", border: "1px solid rgba(228,113,63,0.35)", borderRadius: 8, padding: "10px 14px" },
  unknown: { textAlign: "center", color: "var(--hot)", marginBottom: 18, fontSize: 14 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 },
  card: { display: "block", textDecoration: "none", color: "var(--text)", background: "var(--panel)",
    border: "1px solid var(--line)", borderRadius: 14, padding: 20, transition: "border-color .15s, transform .15s" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  emoji: { fontSize: 26 },
  tag: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, border: "1px solid", borderRadius: 20, padding: "2px 9px" },
  cardTitle: { fontSize: 18, fontWeight: 700, marginBottom: 7 },
  cardBlurb: { fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)", marginBottom: 14 },
  cardGo: { fontSize: 13, color: "var(--gold)", fontWeight: 600 },
  footer: { textAlign: "center", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6, marginTop: 40, maxWidth: 640, marginLeft: "auto", marginRight: "auto" },
};
