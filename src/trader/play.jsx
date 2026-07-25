// ===========================================================================
// THE TRADE GAME — play screen. Space Trader's loop on the real solar system.
//
// Left: the orrery, planets where they really are on the mission date, the
// player's site ringed, and a real Kepler-solved arc to whatever destination is
// being considered. Right: the dock (buy, sell, refuel at the current site) and
// the course plotter (where can I go, what does it cost in fuel and months).
//
// The screens the "labs" prototyped are now doing their real job: the market
// panel is the dock, the transfer maths is the course cost.
// ===========================================================================
import { useEffect, useMemo, useState } from "react";
import { heliocentric, periodDays } from "../ephemeris.js";
import { project, orbitPath } from "../orrery.js";
import { transferPosition } from "../transfer.js";
import { SYSTEMS, SYSTEM_BY_ID } from "../data/bodies.js";
import { SITE_BY_ID } from "../data/sites.js";
import { COMMODITY_BY_ID, TIERS } from "../data/commodities.js";
import { listing } from "../market.js";
import { buyPrice, sellPrice, cargoUsed, cargoCapacity, cargoFree, netWorth } from "../player.js";
import {
  travelCost, destinations, travel, refuel, fuelPrice, buy, sell, tankMax,
} from "../tradergame.js";

const VB = 1000, CX = 500, CY = 500, R = 360, DAY = 86400000;
const money = (n) => "$" + Math.round(n).toLocaleString();
const fmtDate = (t) => new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDur = (d) => d < 60 ? `${Math.round(d)} days` : d < 700 ? `${(d / 30.44).toFixed(0)} months` : `${(d / 365.25).toFixed(1)} years`;
const dot = (rkm, k = 1) => Math.max(4, Math.min(22, Math.pow(rkm || 1000, 0.25) * 1.25)) * k;

export default function Play({ game, setGame, onQuit }) {
  const [mode, setMode] = useState("dock");       // "dock" | "travel"
  const [dest, setDest] = useState(null);          // hovered/selected destination siteId
  const [sel, setSel] = useState(null);            // selected commodity in the dock
  const [toast, setToast] = useState(null);

  const p = game.player;
  const site = SITE_BY_ID[p.at];
  const sys = SYSTEM_BY_ID[site.system];

  const positions = useMemo(() => {
    const o = {};
    for (const s of SYSTEMS) if (s.ephemerisKey) o[s.id] = heliocentric(s.ephemerisKey, new Date(game.t));
    return o;
  }, [game.t]);

  const orbits = useMemo(() => {
    const o = {};
    for (const s of SYSTEMS) {
      if (!s.ephemerisKey) continue;
      const P = periodDays(s.ephemerisKey), base = Date.UTC(2000, 0, 1);
      o[s.id] = Array.from({ length: 200 }, (_, i) => heliocentric(s.ephemerisKey, new Date(base + (P * i / 200) * DAY)));
    }
    return o;
  }, []);

  const flash = (text, kind = "ok") => setToast({ text, kind });

  const doTravel = (destId) => {
    const r = travel(game, destId);
    if (r.error) return flash(r.reason || r.error, "bad");
    setGame(r.game); setDest(null); setSel(null); setMode("dock");
    flash(`Arrived at ${r.arrived} — ${fmtDur(r.days)}, ${r.spentFuel.toFixed(1)} t of propellant burned.`);
  };

  const doBuy = (id, qty) => { const r = buy(game, id, qty); if (r.error) return flash(errMsg(r.error), "bad"); setGame(r.game); flash(`Bought ${r.bought} t of ${COMMODITY_BY_ID[id].name} for ${money(r.spent)}.`); };
  const doSell = (id, qty) => { const r = sell(game, id, qty); if (r.error) return flash(errMsg(r.error), "bad"); setGame(r.game); flash(`Sold ${r.sold} t of ${COMMODITY_BY_ID[id].name} for ${money(r.earned)}.`); };
  const doRefuel = (t) => { const r = refuel(game, t); if (r.error) return flash(r.reason, "bad"); setGame(r.game); flash(`Took on ${r.tonnes.toFixed(1)} t of propellant for ${money(r.spent)}.`); };

  return (
    <div style={S.app}>
      <Hud game={game} onQuit={onQuit} />
      <div style={S.main}>
        <div style={S.stage}>
          <Orrery positions={positions} orbits={orbits} game={game} dest={dest} />
        </div>
        <aside style={S.panel} aria-live="polite">
          <div style={S.tabs}>
            <button style={{ ...S.tab, ...(mode === "dock" ? S.tabOn : null) }} onClick={() => setMode("dock")}>⚓ Dock</button>
            <button style={{ ...S.tab, ...(mode === "travel" ? S.tabOn : null) }} onClick={() => setMode("travel")}>🧭 Plot a course</button>
          </div>
          {mode === "dock"
            ? <Dock game={game} sel={sel} setSel={setSel} onBuy={doBuy} onSell={doSell} onRefuel={doRefuel} />
            : <Travel game={game} dest={dest} setDest={setDest} onGo={doTravel} />}
        </aside>
      </div>
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

const errMsg = (e) => ({
  "not-sold-here": "This site doesn't trade that.",
  "out-of-stock": "None left to buy here.",
  "hold-full": "The hold is full.",
  "no-credits": "Not enough credits.",
  "none-to-sell": "You have none aboard.",
}[e] || e);

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function Hud({ game, onQuit }) {
  const p = game.player;
  const site = SITE_BY_ID[p.at];
  return (
    <header style={S.hud}>
      <a href="#/" style={S.homeBtn} title="All systems" aria-label="Back to all systems">☰</a>
      <div>
        <div style={S.capName}>{p.name}</div>
        <div style={S.sub}>{p.ship.name} · docked at {site.name}</div>
      </div>
      <div style={S.hudStats}>
        <Hstat label="Credits" value={money(p.credits)} tone="gold" />
        <Hstat label="Net worth" value={money(netWorth(p, game.markets))} />
        <Hstat label="Hold" value={`${cargoUsed(p).toFixed(0)} / ${cargoCapacity(p).toFixed(0)} t`} />
        <Hstat label="Fuel" value={`${p.ship.fuelTonnes.toFixed(0)} / ${tankMax(p).toFixed(0)} t`}
          tone={p.ship.fuelTonnes < tankMax(p) * 0.2 ? "hot" : undefined} />
        <Hstat label="Date" value={fmtDate(game.t)} />
      </div>
      <button style={S.quit} onClick={onQuit}>Abandon</button>
    </header>
  );
}
const Hstat = ({ label, value, tone }) => (
  <div style={{ minWidth: 92 }}>
    <div style={S.hlabel}>{label}</div>
    <div style={{ ...S.hvalue, color: tone === "gold" ? "var(--gold)" : tone === "hot" ? "var(--hot)" : "var(--text)" }}>{value}</div>
  </div>
);

// ---------------------------------------------------------------------------
// The dock — buy, sell, refuel
// ---------------------------------------------------------------------------
function Dock({ game, sel, setSel, onBuy, onSell, onRefuel }) {
  const p = game.player;
  const site = SITE_BY_ID[p.at];
  const market = game.markets[p.at];
  const rows = listing(market, site);
  const fp = fuelPrice(game);
  const tank = tankMax(p), tankFreeT = tank - p.ship.fuelTonnes;

  return (
    <div>
      <div style={S.siteName}>{site.name}</div>
      <div style={S.why}>{site.why}</div>

      {/* Refuel */}
      <div style={S.fuelBox}>
        <div style={S.fuelHead}>
          <span><b>Propellant</b> {fp ? `· ${money(fp)}/t here` : "· not sold here"}</span>
          <span style={S.small}>{p.ship.fuelTonnes.toFixed(0)} / {tank.toFixed(0)} t</span>
        </div>
        {fp && tankFreeT > 0.5 && (
          <div style={S.row}>
            <button style={S.smallBtn} onClick={() => onRefuel(10)}>+10 t</button>
            <button style={S.smallBtn} onClick={() => onRefuel(tankFreeT)}>Fill ({money(fp * tankFreeT)})</button>
          </div>
        )}
      </div>

      <div style={S.marketHead}>Market</div>
      <div style={S.marketList}>
        {rows.map((r) => {
          const held = p.cargo[r.id] || 0;
          const bp = buyPrice(p, market, site, r.id);
          const sp = sellPrice(p, market, site, r.id);
          const on = sel === r.id;
          return (
            <div key={r.id}>
              <button style={{ ...S.mrow, ...(on ? S.mrowOn : null) }} onClick={() => setSel(on ? null : r.id)}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span>{r.produces ? "⛏ " : r.consumes ? "▾ " : ""}{r.name}
                    {held > 0 && <span style={S.held}> · {held} t aboard</span>}</span>
                  <span style={S.tierTag}>{TIERS[r.tier].name} · {r.state}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={S.buyP}>buy {money(bp)}</div>
                  <div style={S.sellP}>sell {money(sp)}</div>
                </div>
              </button>
              {on && <TradeBar row={r} held={held} bp={bp} sp={sp} free={cargoFree(p)}
                credits={p.credits} onBuy={onBuy} onSell={onSell} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeBar({ row, held, bp, sp, free, credits, onBuy, onSell }) {
  const maxBuy = Math.max(0, Math.min(Math.floor(free), Math.floor(credits / bp), Math.floor(row.stock)));
  const [qty, setQty] = useState(1);
  const q = Math.min(qty, Math.max(maxBuy, held, 1));
  return (
    <div style={S.tradeBar}>
      <div style={S.small}>{row.note}</div>
      <div style={{ ...S.row, marginTop: 8, justifyContent: "space-between" }}>
        <div style={S.row}>
          <button style={S.stepBtn} onClick={() => setQty((v) => Math.max(1, v - 1))}>−</button>
          <span style={S.qty}>{q} t</span>
          <button style={S.stepBtn} onClick={() => setQty((v) => v + 1)}>+</button>
          <button style={S.stepBtn} onClick={() => setQty(Math.max(1, maxBuy))} title="As many as you can afford and hold">max</button>
        </div>
        <div style={S.row}>
          <button style={{ ...S.buyBtn, opacity: maxBuy > 0 ? 1 : 0.4 }} disabled={maxBuy <= 0}
            onClick={() => onBuy(row.id, q)}>Buy</button>
          <button style={{ ...S.sellBtn, opacity: held > 0 ? 1 : 0.4 }} disabled={held <= 0}
            onClick={() => onSell(row.id, Math.min(q, held))}>Sell</button>
        </div>
      </div>
      {row.lesson && <div style={S.lesson}>{row.lesson}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The course plotter
// ---------------------------------------------------------------------------
function Travel({ game, dest, setDest, onGo }) {
  const list = destinations(game).sort((a, b) => (a.cost?.days ?? 1e9) - (b.cost?.days ?? 1e9));
  return (
    <div>
      <div style={S.siteName}>Where to?</div>
      <div style={S.why}>Cost is propellant and months. A heavier hold burns more; the outer system needs a bigger tank or a better drive.</div>
      {list.map(({ site, cost }) => {
        if (!cost) return null;
        const on = dest === site.id;
        const ok = cost.reachable && cost.enoughFuel;
        return (
          <div key={site.id} style={{ ...S.destCard, ...(on ? S.destOn : null), opacity: cost.reachable ? 1 : 0.55 }}
            onMouseEnter={() => setDest(site.id)}>
            <button style={S.destBtn} onClick={() => setDest(on ? null : site.id)}>
              <div style={S.row2}>
                <b>{site.name}</b>
                <span style={S.destSys}>{SYSTEM_BY_ID[site.system]?.name}</span>
              </div>
              <div style={S.destMeta}>
                {cost.fuelTonnes.toFixed(0)} t fuel · {fmtDur(cost.days)}
                {!cost.reachable && <span style={S.tooFar}> · out of range</span>}
                {cost.reachable && !cost.enoughFuel && <span style={S.tooFar}> · refuel first</span>}
              </div>
            </button>
            {on && (
              <div style={S.destOpen}>
                <div style={S.small}>{site.why}</div>
                {cost.reachable ? (
                  <button style={{ ...S.goBtn, opacity: ok ? 1 : 0.5 }} disabled={!ok} onClick={() => onGo(site.id)}>
                    {ok ? `Launch — burn ${cost.fuelTonnes.toFixed(1)} t` : "Not enough fuel aboard"}
                  </button>
                ) : <div style={S.warnLine}>{cost.reason}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The orrery
// ---------------------------------------------------------------------------
function Orrery({ positions, orbits, game, dest }) {
  const opts = { cx: CX, cy: CY, radius: R, trueScale: false };
  const hereSys = SITE_BY_ID[game.player.at]?.system;
  const destSys = dest && SITE_BY_ID[dest]?.system;

  // The transfer arc, if a destination in another system is being considered.
  let arc = null;
  if (destSys && destSys !== hereSys) {
    const a = SYSTEM_BY_ID[hereSys], b = SYSTEM_BY_ID[destSys];
    if (a?.ephemerisKey && b?.ephemerisKey) {
      const p1 = positions[a.ephemerisKey === "ceres" ? "belt" : hereSys] || heliocentric(a.ephemerisKey, new Date(game.t));
      const p2 = positions[destSys] || heliocentric(b.ephemerisKey, new Date(game.t));
      const pts = Array.from({ length: 40 }, (_, i) => transferPosition(p1.r, p2.r, p1.lon, i / 39));
      arc = pts.map((pt, i) => { const q = project(pt.r, pt.lon, opts); return `${i ? "L" : "M"} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join(" ");
    }
  }

  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} style={S.svg} role="img" aria-label="The solar system on the mission date">
      <defs>
        <radialGradient id="sun"><stop offset="0%" stopColor="#FFD98A" stopOpacity="0.9" /><stop offset="60%" stopColor="#F2B441" stopOpacity="0.1" /><stop offset="100%" stopColor="#F2B441" stopOpacity="0" /></radialGradient>
      </defs>
      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => (
        <path key={s.id} d={orbitPath(orbits[s.id], opts)} fill="none" stroke="#26324a" strokeWidth="1" strokeOpacity="0.5" />
      ))}
      <circle cx={CX} cy={CY} r="90" fill="url(#sun)" /><circle cx={CX} cy={CY} r="11" fill="#F2B441" />
      {arc && <path d={arc} fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="5 6" />}

      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => {
        const pos = positions[s.id]; const { x, y } = project(pos.r, pos.lon, opts);
        const here = s.id === hereSys || (hereSys === "belt" && s.id === "belt");
        const isDest = s.id === destSys;
        const r = dot(s.radiusKm, s.id === "pluto" ? 1.3 : 1);
        return (
          <g key={s.id}>
            {here && <circle cx={x} cy={y} r={r + 12} fill="none" stroke="#F2B441" strokeWidth="1.5" strokeDasharray="3 4" />}
            {isDest && <circle cx={x} cy={y} r={r + 9} fill="none" stroke="var(--gold)" strokeWidth="2" />}
            <circle cx={x} cy={y} r={r} fill={s.color} stroke="#070A12" strokeWidth="1.5" />
            <text x={x} y={y - r - 8} style={{ ...S.pin, fill: here || isDest ? "#fff" : "#B9C2D4" }}>
              {s.name}{here ? " — you" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Toast({ toast, onDone }) {
  useEffect(() => { const id = setTimeout(onDone, 4200); return () => clearTimeout(id); }, [toast]);
  return <div style={{ ...S.toast, borderColor: toast.kind === "bad" ? "var(--hot)" : "var(--gold)" }}>{toast.text}</div>;
}

const S = {
  app: { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" },
  hud: { display: "flex", alignItems: "center", gap: 18, padding: "10px 18px", borderBottom: "1px solid var(--line)", background: "var(--panel)" },
  homeBtn: { textDecoration: "none", color: "var(--muted)", fontSize: 18, border: "1px solid var(--line)", borderRadius: 8, padding: "3px 10px", background: "var(--panel-2)" },
  capName: { fontSize: 16, fontWeight: 700, letterSpacing: 0.3 },
  sub: { fontSize: 12, color: "var(--muted)" },
  hudStats: { display: "flex", gap: 18, marginLeft: "auto" },
  hlabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)" },
  hvalue: { fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  quit: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 },

  main: { flex: 1, display: "flex", minHeight: 0 },
  stage: { flex: 1, minWidth: 0, display: "flex" },
  svg: { flex: 1, minHeight: 0, width: "100%" },
  panel: { width: 400, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--panel)", display: "flex", flexDirection: "column", overflow: "hidden" },
  tabs: { display: "flex", borderBottom: "1px solid var(--line)" },
  tab: { flex: 1, background: "var(--panel-2)", border: "none", padding: "12px", cursor: "pointer", fontSize: 14, color: "var(--muted)" },
  tabOn: { background: "var(--panel)", color: "var(--gold)", fontWeight: 700, boxShadow: "inset 0 -2px 0 var(--gold)" },

  siteName: { fontSize: 19, fontWeight: 700, padding: "16px 18px 4px" },
  why: { fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, padding: "0 18px 14px" },
  fuelBox: { margin: "0 18px 6px", padding: "10px 12px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10 },
  fuelHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, marginBottom: 8 },
  marketHead: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", padding: "10px 18px 6px" },
  marketList: { overflowY: "auto", padding: "0 12px 16px" },
  mrow: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 10px", background: "none", border: "1px solid transparent", borderRadius: 8, cursor: "pointer", color: "var(--text)", textAlign: "left" },
  mrowOn: { background: "var(--panel-2)", border: "1px solid var(--line)" },
  held: { color: "var(--gold)", fontSize: 12 },
  tierTag: { fontSize: 11, color: "var(--muted)" },
  buyP: { fontSize: 13, fontVariantNumeric: "tabular-nums" },
  sellP: { fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" },
  tradeBar: { padding: "10px 12px", margin: "2px 0 8px", background: "#0B111C", border: "1px solid var(--line)", borderRadius: 8 },
  lesson: { fontSize: 11.5, color: "#9FB2C8", marginTop: 8, lineHeight: 1.5, fontStyle: "italic" },

  destCard: { margin: "0 12px 8px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" },
  destOn: { border: "1px solid var(--gold)" },
  destBtn: { width: "100%", textAlign: "left", background: "none", border: "none", padding: "11px 13px", cursor: "pointer", color: "var(--text)" },
  row2: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  destSys: { fontSize: 11, color: "var(--muted)" },
  destMeta: { fontSize: 12.5, color: "var(--muted)", marginTop: 4, fontVariantNumeric: "tabular-nums" },
  tooFar: { color: "var(--hot)" },
  destOpen: { padding: "0 13px 12px" },
  warnLine: { fontSize: 12, color: "var(--hot)", lineHeight: 1.5, marginTop: 6 },

  row: { display: "flex", gap: 6, alignItems: "center" },
  small: { fontSize: 12, color: "var(--muted)", lineHeight: 1.5 },
  smallBtn: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12 },
  stepBtn: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 13, minWidth: 32 },
  qty: { minWidth: 44, textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  buyBtn: { background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 7, padding: "6px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  sellBtn: { background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 7, padding: "6px 16px", cursor: "pointer", fontSize: 13 },
  goBtn: { marginTop: 10, width: "100%", background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontWeight: 700, fontSize: 14 },

  pin: { fontSize: 12, textAnchor: "middle", pointerEvents: "none", fontFamily: "inherit" },
  toast: { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "var(--panel)", border: "1px solid var(--gold)", borderRadius: 10, padding: "11px 18px", fontSize: 13.5, zIndex: 40, maxWidth: 560, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" },
};
