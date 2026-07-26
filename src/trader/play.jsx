// ===========================================================================
// THE TRADE GAME — play screen. Now on the fleet's LIVING clock.
//
// The merge (design.md): the trade loop had abandoned the animated orrery, the
// ship-on-the-map and the pause-for-decisions rhythm that made the fleet good.
// This puts them back. You plot a course, LAUNCH, and watch your ship cross the
// real transfer arc while the planets move; the clock pauses itself on arrival
// and the dock opens. Time you can hurry, slow, or skip — but never fake.
// ===========================================================================
import { useEffect, useMemo, useState } from "react";
import { heliocentric, periodDays, lightTimeSeconds } from "../ephemeris.js";
import { project, orbitPath, sayLightTime } from "../orrery.js";
import { transferPosition } from "../transfer.js";
import { SYSTEMS, SYSTEM_BY_ID } from "../data/bodies.js";
import { SITE_BY_ID } from "../data/sites.js";
import { COMMODITY_BY_ID, TIERS } from "../data/commodities.js";
import { listing } from "../market.js";
import { buyPrice, sellPrice, cargoUsed, cargoCapacity, cargoFree, netWorth } from "../player.js";
import { factionAt } from "../factions.js";
import { makeSave, serialize } from "../save.js";
import {
  travelCost, destinations, launch, advanceTime, shipPosition, refuel, fuelPrice,
  buy, sell, tankMax, RATES,
} from "../tradergame.js";

const VB = 1000, CX = 500, CY = 500, R = 360, DAY = 86400000;
const money = (n) => "$" + Math.round(n).toLocaleString();
const fmtDate = (t) => new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDur = (d) => d < 60 ? `${Math.round(d)} days` : d < 700 ? `${(d / 30.44).toFixed(0)} months` : `${(d / 365.25).toFixed(1)} years`;
const dot = (rkm, k = 1) => Math.max(4, Math.min(22, Math.pow(rkm || 1000, 0.25) * 1.25)) * k;

export default function Play({ game, setGame, onQuit }) {
  const [mode, setMode] = useState("dock");
  const [dest, setDest] = useState(null);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);

  const flash = (text, kind = "ok") => setToast({ text, kind });
  const transit = game.status === "transit";

  // ---- the living clock ---------------------------------------------------
  // setInterval, not requestAnimationFrame: rAF is throttled to zero in a hidden
  // tab, which would silently freeze the game whenever the player looked away.
  // dt is measured from the wall clock, so a stalled tab slows the sim rather
  // than desynchronising it. The clock only runs while in transit.
  useEffect(() => {
    if (!transit || RATES[game.rateIdx].days === 0) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(150, now - last);
      last = now;
      setGame((g) => {
        if (g.status !== "transit") return g;
        const r = advanceTime(g, g.t + RATES[g.rateIdx].days * (dt / 1000) * DAY);
        if (r.arrived) queueMicrotask(() => { flash(`Arrived at ${r.arrived}.`); setMode("dock"); });
        return r.game;
      });
    }, 33);
    return () => clearInterval(id);
  }, [transit, game.rateIdx]);

  const setRate = (i) => setGame((g) => ({ ...g, rateIdx: i }));
  const skip = () => setGame((g) => {
    if (g.status !== "transit") return g;
    const r = advanceTime(g, g.leg.arriveT);
    if (r.arrived) queueMicrotask(() => { flash(`Arrived at ${r.arrived}.`); setMode("dock"); });
    return { ...r.game, rateIdx: 0 };
  });

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

  const doLaunch = (destId) => {
    const r = launch(game, destId);
    if (r.error) return flash(r.reason || r.error, "bad");
    setGame(r.game); setDest(null); setSel(null);
    flash(`Under way to ${SITE_BY_ID[destId].name}. Run the clock.`);
  };
  const doBuy = (id, qty) => { const r = buy(game, id, qty); if (r.error) return flash(errMsg(r.error), "bad"); setGame(r.game); flash(`Bought ${r.bought} t of ${COMMODITY_BY_ID[id].name} for ${money(r.spent)}.`); };
  const doSell = (id, qty) => { const r = sell(game, id, qty); if (r.error) return flash(errMsg(r.error), "bad"); setGame(r.game); flash(`Sold ${r.sold} t of ${COMMODITY_BY_ID[id].name} for ${money(r.earned)}.`); };
  const doRefuel = (t) => { const r = refuel(game, t); if (r.error) return flash(r.reason, "bad"); setGame(r.game); flash(`Took on ${r.tonnes.toFixed(1)} t of propellant for ${money(r.spent)}.`); };

  // Download the current game as a file — survives a cleared cache and moves
  // between machines, the same escape hatch Shutterbug's passport has. The
  // filename carries the captain and date so a folder of saves is legible.
  const downloadSave = () => {
    const g = game;
    const name = `solbound-${(g.player.name || "captain").toLowerCase().replace(/\W+/g, "-")}-${new Date(g.t).toISOString().slice(0, 10)}.json`;
    const blob = new Blob([serialize(makeSave(g, { stampMs: Date.now() }))], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash("Save downloaded. It also autosaves on every arrival and trade.");
  };

  return (
    <div style={S.app}>
      <Hud game={game} onQuit={onQuit} setRate={setRate} skip={skip} onDownload={downloadSave} />
      <div style={S.main}>
        <div style={S.stage}>
          <Orrery positions={positions} orbits={orbits} game={game} dest={dest} />
        </div>
        <aside style={S.panel} aria-live="polite">
          {transit ? (
            <TransitPanel game={game} />
          ) : (
            <>
              <div style={S.tabs}>
                <button style={{ ...S.tab, ...(mode === "dock" ? S.tabOn : null) }} onClick={() => setMode("dock")}>⚓ Dock</button>
                <button style={{ ...S.tab, ...(mode === "travel" ? S.tabOn : null) }} onClick={() => setMode("travel")}>🧭 Plot a course</button>
              </div>
              {mode === "dock"
                ? <Dock game={game} sel={sel} setSel={setSel} onBuy={doBuy} onSell={doSell} onRefuel={doRefuel} />
                : <Travel game={game} dest={dest} setDest={setDest} onGo={doLaunch} />}
            </>
          )}
        </aside>
      </div>
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

const errMsg = (e) => ({
  "not-sold-here": "This site doesn't trade that.", "out-of-stock": "None left to buy here.",
  "hold-full": "The hold is full.", "no-credits": "Not enough credits.", "none-to-sell": "You have none aboard.",
}[e] || e);

// ---------------------------------------------------------------------------
// HUD — now with the clock
// ---------------------------------------------------------------------------
function Hud({ game, onQuit, setRate, skip, onDownload }) {
  const p = game.player;
  const transit = game.status === "transit";
  const here = SITE_BY_ID[p.at];
  const where = transit ? `en route to ${SITE_BY_ID[game.leg.to]?.name}` : `docked at ${here.name}`;
  return (
    <header style={S.hud}>
      <button onClick={onDownload} style={S.homeBtn} title="Download this game as a file"
        aria-label="Download save file">⤓</button>
      <div>
        <div style={S.capName}>{p.name}</div>
        <div style={S.sub}>{p.ship.name} · {where}</div>
      </div>
      <div style={S.hudStats}>
        <Hstat label="Credits" value={money(p.credits)} tone="gold" />
        <Hstat label="Net worth" value={money(netWorth(p, game.markets))} />
        <Hstat label="Hold" value={`${cargoUsed(p).toFixed(0)} / ${cargoCapacity(p).toFixed(0)} t`} />
        <Hstat label="Fuel" value={`${p.ship.fuelTonnes.toFixed(0)} / ${tankMax(p).toFixed(0)} t`}
          tone={p.ship.fuelTonnes < tankMax(p) * 0.2 ? "hot" : undefined} />
        <Hstat label="Date" value={fmtDate(game.t)} />
      </div>
      {transit ? (
        <div style={S.clock}>
          {RATES.map((r, i) => (
            <button key={i} onClick={() => setRate(i)} aria-pressed={game.rateIdx === i} title={r.name}
              style={{ ...S.rateBtn, ...(game.rateIdx === i ? S.rateOn : null) }}>{r.label}</button>
          ))}
          <button onClick={skip} style={S.skipBtn} title="Skip to arrival">⏭</button>
        </div>
      ) : (
        <button style={S.quit} onClick={onQuit}>Menu</button>
      )}
    </header>
  );
}
const Hstat = ({ label, value, tone }) => (
  <div style={{ minWidth: 90 }}>
    <div style={S.hlabel}>{label}</div>
    <div style={{ ...S.hvalue, color: tone === "gold" ? "var(--gold)" : tone === "hot" ? "var(--hot)" : "var(--text)" }}>{value}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Transit panel — what you see while flying
// ---------------------------------------------------------------------------
function TransitPanel({ game }) {
  const leg = game.leg;
  const from = SITE_BY_ID[leg.from], to = SITE_BY_ID[leg.to];
  const f = Math.max(0, Math.min(1, (game.t - leg.departT) / (leg.arriveT - leg.departT)));
  const remainDays = Math.max(0, (leg.arriveT - game.t) / DAY);
  // How long a message home would take from here — the loneliness curve, live.
  const toSys = SYSTEM_BY_ID[to.system];
  const lag = toSys?.ephemerisKey ? lightTimeSeconds("earth", toSys.ephemerisKey, new Date(game.t)) : 0;
  return (
    <div style={{ padding: "20px 18px" }}>
      <div style={S.transitHead}>Under way</div>
      <div style={S.route}>{from.name} <span style={S.arrow}>→</span> {to.name}</div>
      <div style={S.progressTrack}><div style={{ ...S.progressFill, width: `${f * 100}%` }} /></div>
      <div style={S.small}>{Math.round(f * 100)}% · arriving {fmtDate(leg.arriveT)} · {fmtDur(remainDays)} to go</div>

      <div style={S.hr} />
      <Row label="Time under way" value={fmtDur((game.t - leg.departT) / DAY)} />
      <Row label="Propellant burned" value={`${leg.fuelCost.toFixed(1)} t`} />
      <Row label="A message home takes" value={lag ? sayLightTime(lag) : "—"} hint="one way, at the speed of light" />
      <p style={{ ...S.small, marginTop: 16 }}>
        The clock is running (top right). Speed it up, or skip straight to arrival.
        The market you're headed for is drifting while you fly — the prices won't be
        quite what you saw at departure.
      </p>
    </div>
  );
}
const Row = ({ label, value, hint }) => (
  <div style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
    <div style={S.hlabel}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
    {hint && <div style={S.small}>{hint}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Dock
// ---------------------------------------------------------------------------
function Dock({ game, sel, setSel, onBuy, onSell, onRefuel }) {
  const p = game.player;
  const site = SITE_BY_ID[p.at];
  const market = game.markets[p.at];
  const rows = listing(market, site);
  const fp = fuelPrice(game);
  const tank = tankMax(p), tankFreeT = tank - p.ship.fuelTonnes;
  const control = factionAt(game.factions, site.id);

  return (
    <div style={{ overflowY: "auto" }}>
      <div style={S.siteName}>{site.name}</div>
      {control && (
        <div style={S.faction}>
          <b>{control.faction.name}</b> holds this port. {control.faction.blurb}
        </div>
      )}
      <div style={S.why}>{site.why}</div>

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
      <div style={{ padding: "0 12px 16px" }}>
        {rows.map((r) => {
          const held = p.cargo[r.id] || 0;
          const bp = buyPrice(p, market, site, r.id), sp = sellPrice(p, market, site, r.id);
          const on = sel === r.id;
          return (
            <div key={r.id}>
              <button style={{ ...S.mrow, ...(on ? S.mrowOn : null) }} onClick={() => setSel(on ? null : r.id)}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span>{r.produces ? "◆ " : r.consumes ? "○ " : ""}{r.name}
                    {held > 0 && <span style={S.held}> · {held} t aboard</span>}</span>
                  <span style={S.tierTag}>{TIERS[r.tier].name} · {r.state}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={S.buyP}>buy {money(bp)}</div>
                  <div style={S.sellP}>sell {money(sp)}</div>
                </div>
              </button>
              {on && <TradeBar row={r} held={held} bp={bp} sp={sp} free={cargoFree(p)} credits={p.credits} onBuy={onBuy} onSell={onSell} />}
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
          <button style={{ ...S.buyBtn, opacity: maxBuy > 0 ? 1 : 0.4 }} disabled={maxBuy <= 0} onClick={() => onBuy(row.id, q)}>Buy</button>
          <button style={{ ...S.sellBtn, opacity: held > 0 ? 1 : 0.4 }} disabled={held <= 0} onClick={() => onSell(row.id, Math.min(q, held))}>Sell</button>
        </div>
      </div>
      {row.lesson && <div style={S.lesson}>{row.lesson}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course plotter
// ---------------------------------------------------------------------------
function Travel({ game, dest, setDest, onGo }) {
  const list = destinations(game).sort((a, b) => (a.cost?.days ?? 1e9) - (b.cost?.days ?? 1e9));
  return (
    <div style={{ overflowY: "auto" }}>
      <div style={S.siteName}>Where to?</div>
      <div style={S.why}>Cost is propellant and months. A heavier hold burns more; the outer system needs a bigger tank or a better drive. Once you launch, run the clock to fly there.</div>
      {list.map(({ site, cost }) => {
        if (!cost) return null;
        const on = dest === site.id, ok = cost.reachable && cost.enoughFuel;
        const control = factionAt(game.factions, site.id);
        return (
          <div key={site.id} style={{ ...S.destCard, ...(on ? S.destOn : null), opacity: cost.reachable ? 1 : 0.55 }}
            onMouseEnter={() => setDest(site.id)}>
            <button style={S.destBtn} onClick={() => setDest(on ? null : site.id)}>
              <div style={S.row2}><b>{site.name}</b><span style={S.destSys}>{SYSTEM_BY_ID[site.system]?.name}</span></div>
              <div style={S.destMeta}>
                {cost.fuelTonnes.toFixed(0)} t fuel · {fmtDur(cost.days)}
                {!cost.reachable && <span style={S.tooFar}> · out of range</span>}
                {cost.reachable && !cost.enoughFuel && <span style={S.tooFar}> · refuel first</span>}
                {control && <span style={S.destFaction}> · {control.faction.name}</span>}
              </div>
            </button>
            {on && (
              <div style={S.destOpen}>
                <div style={S.small}>{site.why}</div>
                {cost.reachable
                  ? <button style={{ ...S.goBtn, opacity: ok ? 1 : 0.5 }} disabled={!ok} onClick={() => onGo(site.id)}>
                      {ok ? `Launch — burn ${cost.fuelTonnes.toFixed(1)} t` : "Not enough fuel aboard"}
                    </button>
                  : <div style={S.warnLine}>{cost.reason}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orrery — with the player ship on it
// ---------------------------------------------------------------------------
function Orrery({ positions, orbits, game, dest }) {
  const opts = { cx: CX, cy: CY, radius: R, trueScale: false };
  const hereSys = SITE_BY_ID[game.player.at]?.system;
  const transit = game.status === "transit";
  const destSys = transit ? SITE_BY_ID[game.leg.to]?.system : (dest && SITE_BY_ID[dest]?.system);

  // The arc: the actual leg while flying, or a preview to a considered target.
  let arc = null, legR1, legR2, legLon1;
  if (transit) { ({ r1: legR1, r2: legR2, lon1: legLon1 } = game.leg); }
  else if (destSys && destSys !== hereSys) {
    const a = SYSTEM_BY_ID[hereSys], b = SYSTEM_BY_ID[destSys];
    if (a?.ephemerisKey && b?.ephemerisKey) {
      const p1 = positions[hereSys] || heliocentric(a.ephemerisKey, new Date(game.t));
      const p2 = positions[destSys] || heliocentric(b.ephemerisKey, new Date(game.t));
      legR1 = p1.r; legR2 = p2.r; legLon1 = p1.lon;
    }
  }
  if (legR1 != null) {
    const pts = Array.from({ length: 44 }, (_, i) => transferPosition(legR1, legR2, legLon1, i / 43));
    arc = pts.map((pt, i) => { const q = project(pt.r, pt.lon, opts); return `${i ? "L" : "M"} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join(" ");
  }

  const ship = transit ? shipPosition(game) : null;
  const shipXY = ship ? project(ship.r, ship.lon, opts) : null;

  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} style={S.svg} role="img" aria-label="The solar system on the mission date">
      <defs><radialGradient id="sun"><stop offset="0%" stopColor="#FFD98A" stopOpacity="0.9" /><stop offset="60%" stopColor="#F2B441" stopOpacity="0.1" /><stop offset="100%" stopColor="#F2B441" stopOpacity="0" /></radialGradient></defs>
      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => (
        <path key={s.id} d={orbitPath(orbits[s.id], opts)} fill="none" stroke="#26324a" strokeWidth="1" strokeOpacity="0.5" />
      ))}
      <circle cx={CX} cy={CY} r="90" fill="url(#sun)" /><circle cx={CX} cy={CY} r="11" fill="#F2B441" />
      {arc && <path d={arc} fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="5 6" strokeOpacity={transit ? 0.9 : 0.6} />}

      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => {
        const pos = positions[s.id]; const { x, y } = project(pos.r, pos.lon, opts);
        const here = s.id === hereSys, isDest = s.id === destSys;
        const r = dot(s.radiusKm, s.id === "pluto" ? 1.3 : 1);
        const held = game.factions?.some((fx) => SITE_BY_ID[fx.siteId]?.system === s.id);
        return (
          <g key={s.id}>
            {here && !transit && <circle cx={x} cy={y} r={r + 12} fill="none" stroke="#F2B441" strokeWidth="1.5" strokeDasharray="3 4" />}
            {isDest && <circle cx={x} cy={y} r={r + 9} fill="none" stroke="var(--gold)" strokeWidth="2" />}
            <circle cx={x} cy={y} r={r} fill={s.color} stroke="#070A12" strokeWidth="1.5" />
            <text x={x} y={y - r - 8} style={{ ...S.pin, fill: here || isDest ? "#fff" : "#B9C2D4" }}>
              {s.name}{here && !transit ? " — you" : ""}{held ? " ◆" : ""}
            </text>
          </g>
        );
      })}

      {shipXY && (
        <g>
          <circle cx={shipXY.x} cy={shipXY.y} r="6" fill="var(--gold)" stroke="#070A12" strokeWidth="1.5" />
          <text x={shipXY.x} y={shipXY.y + 18} style={{ ...S.pin, fill: "var(--gold)" }}>{game.player.ship.name} · {Math.round(ship.f * 100)}%</text>
        </g>
      )}
    </svg>
  );
}

function Toast({ toast, onDone }) {
  useEffect(() => { const id = setTimeout(onDone, 4200); return () => clearTimeout(id); }, [toast]);
  return <div style={{ ...S.toast, borderColor: toast.kind === "bad" ? "var(--hot)" : "var(--gold)" }}>{toast.text}</div>;
}

const S = {
  app: { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" },
  hud: { display: "flex", alignItems: "center", gap: 16, padding: "10px 18px", borderBottom: "1px solid var(--line)", background: "var(--panel)" },
  homeBtn: { textDecoration: "none", color: "var(--muted)", fontSize: 18, border: "1px solid var(--line)", borderRadius: 8, padding: "3px 10px", background: "var(--panel-2)" },
  capName: { fontSize: 16, fontWeight: 700, letterSpacing: 0.3 },
  sub: { fontSize: 12, color: "var(--muted)" },
  hudStats: { display: "flex", gap: 16, marginLeft: "auto" },
  hlabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)" },
  hvalue: { fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  quit: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 },
  clock: { display: "flex", gap: 5, alignItems: "center" },
  rateBtn: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 7, padding: "5px 9px", cursor: "pointer", fontSize: 12, minWidth: 34 },
  rateOn: { background: "var(--gold)", color: "#1A1200", fontWeight: 700 },
  skipBtn: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13, marginLeft: 4 },

  main: { flex: 1, display: "flex", minHeight: 0 },
  stage: { flex: 1, minWidth: 0, display: "flex" },
  svg: { flex: 1, minHeight: 0, width: "100%" },
  panel: { width: 400, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--panel)", display: "flex", flexDirection: "column", overflow: "hidden" },
  tabs: { display: "flex", borderBottom: "1px solid var(--line)" },
  tab: { flex: 1, background: "var(--panel-2)", border: "none", padding: "12px", cursor: "pointer", fontSize: 14, color: "var(--muted)" },
  tabOn: { background: "var(--panel)", color: "var(--gold)", fontWeight: 700, boxShadow: "inset 0 -2px 0 var(--gold)" },

  transitHead: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold)", marginBottom: 10 },
  route: { fontSize: 20, fontWeight: 700, marginBottom: 14 },
  arrow: { color: "var(--muted)" },
  progressTrack: { height: 8, background: "var(--panel-2)", borderRadius: 5, overflow: "hidden", border: "1px solid var(--line)" },
  progressFill: { height: "100%", background: "var(--gold)" },
  hr: { height: 1, background: "var(--line)", margin: "16px 0" },

  siteName: { fontSize: 19, fontWeight: 700, padding: "16px 18px 4px" },
  faction: { margin: "0 18px 8px", padding: "9px 12px", background: "rgba(242,180,65,0.08)", border: "1px solid rgba(242,180,65,0.35)", borderRadius: 9, fontSize: 12.5, lineHeight: 1.5 },
  why: { fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, padding: "0 18px 14px" },
  fuelBox: { margin: "0 18px 6px", padding: "10px 12px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10 },
  fuelHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, marginBottom: 8 },
  marketHead: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", padding: "10px 18px 6px" },
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
  destFaction: { color: "var(--gold)" },
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
