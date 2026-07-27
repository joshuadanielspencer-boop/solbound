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
import { siteOf } from "../data/sites.js";
import { COMMODITY_BY_ID, TIERS } from "../data/commodities.js";
import { listing } from "../market.js";
import { buyPrice, sellPrice, cargoUsed, cargoCapacity, cargoFree, netWorth } from "../player.js";
import { factionAt } from "../factions.js";
import { FACTION_BY_ID } from "../data/factions.js";
import { reputationTrack, repAt, repLedger, REP_MIN, REP_MAX } from "../reputation.js";
import { runPlan, cargoValueAt } from "../intel.js";
import { atlasFor, atlasProgress } from "../atlas.js";
import { systemInfo, generateNews } from "../worldinfo.js";
import { fittedStats, MODULE_BY_ID, HULL_BY_ID, ESCAPE_POD, SLOT_KINDS, slotUsage } from "../data/hulls.js";
import { techOf, TECH_LEVELS } from "../data/sites.js";
import { shipsForSale, modulesForSale, tradeInValue, repairCost, drivesForSale, driveTradeIn } from "../shipyard.js";
import { buyShip, fitModule, removeModule, repairHull, buyEscapePod, buyDrive } from "../shipyard.js";
import { DRIVES, tankAfter } from "../propulsion.js";
import { CRYO_FACTOR } from "../tradergame.js";
import { crewForHire, hireCrew, dismissCrew, effectiveSkills, dailyWages, berthsFree } from "../crew.js";
import { CREW_BY_ID, berthsFor } from "../data/crew.js";
import { SKILLS } from "../data/captain.js";
import { FaceOff, HullArt } from "./ships.jsx";
import { makeSave, serialize } from "../save.js";
import { encounterView, resolveEncounter, dismissEncounter, controlledCargo, illegalCargo } from "../encounters.js";
import { RECORD_BY_ID } from "../data/encounters.js";
import { govOf } from "../data/sites.js";
import {
  travelCost, destinations, launch, advanceTime, shipPosition, refuel, fuelPrice,
  buy, sell, tankMax, RATES, dailyCost, tripCost, paperPrice, buyPaper,
  wait, rangeReport,
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
  const stopped = !!game.encounter || !!game.over;   // the clock holds for both

  // ---- the living clock ---------------------------------------------------
  // setInterval, not requestAnimationFrame: rAF is throttled to zero in a hidden
  // tab, which would silently freeze the game whenever the player looked away.
  // dt is measured from the wall clock, so a stalled tab slows the sim rather
  // than desynchronising it. The clock only runs while in transit.
  useEffect(() => {
    if (!transit || stopped || RATES[game.rateIdx].days === 0) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(150, now - last);
      last = now;
      setGame((g) => {
        if (g.status !== "transit" || g.encounter || g.over) return g;
        const r = advanceTime(g, g.t + RATES[g.rateIdx].days * (dt / 1000) * DAY);
        if (r.arrived) queueMicrotask(() => { flash(`Arrived at ${r.arrived}.`); setMode("dock"); });
        if (r.encounter) queueMicrotask(() => flash(r.encounter, "bad"));
        if (r.quit?.length) queueMicrotask(() => flash(`${r.quit.map((c) => c.name).join(" and ")} left the ship — you ran out of wages.`, "bad"));
        return r.game;
      });
    }, 33);
    return () => clearInterval(id);
  }, [transit, stopped, game.rateIdx]);

  const setRate = (i) => setGame((g) => ({ ...g, rateIdx: i }));
  const skip = () => setGame((g) => {
    if (g.status !== "transit" || g.encounter || g.over) return g;
    const r = advanceTime(g, g.leg.arriveT);
    if (r.arrived) queueMicrotask(() => { flash(`Arrived at ${r.arrived}.`); setMode("dock"); });
    if (r.encounter) queueMicrotask(() => flash(r.encounter, "bad"));
    if (r.quit?.length) queueMicrotask(() => flash(`${r.quit.map((c) => c.name).join(" and ")} left the ship — you ran out of wages.`, "bad"));
    return { ...r.game, rateIdx: 0 };
  });

  // The encounter: choose, see what it cost, then get back under way.
  const doChoose = (choice) => {
    const r = resolveEncounter(game, choice);
    if (r.error) return flash(r.error, "bad");
    setGame(r.game);
  };
  const doDismiss = () => setGame((g) => dismissEncounter(g));

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
    flash(`Under way to ${siteOf(game, destId)?.name}. Run the clock.`);
  };
  const doBuy = (id, qty) => { const r = buy(game, id, qty); if (r.error) return flash(errMsg(r.error), "bad"); setGame(r.game); flash(`Bought ${r.bought} t of ${COMMODITY_BY_ID[id].name} for ${money(r.spent)}.`); };
  const doSell = (id, qty) => {
    const r = sell(game, id, qty); if (r.error) return flash(errMsg(r.error), "bad");
    setGame(r.game);
    const p = r.profit;
    const verdict = p > 0 ? `profit ${money(p)}` : p < 0 ? `LOSS ${money(-p)}` : "break-even";
    flash(`Sold ${r.sold} t of ${COMMODITY_BY_ID[id].name} for ${money(r.earned)} — ${verdict}.`, p < 0 ? "bad" : "ok");
  };
  const doRefuel = (t) => { const r = refuel(game, t); if (r.error) return flash(r.reason, "bad"); setGame(r.game); flash(`Took on ${r.tonnes.toFixed(1)} t of propellant for ${money(r.spent)}.`); };

  // Ship-yard actions.
  const doBuyShip = (hullId) => { const r = buyShip(game, game.player.at, hullId); if (r.error) return flash(r.reason || r.error, "bad"); setGame(r.game); flash(r.net >= 0 ? `Traded up to a ${r.hullName} for ${money(r.net)}.` : `Traded down to a ${r.hullName}, ${money(-r.net)} back.`); };
  const doFit = (id) => { const r = fitModule(game, id); if (r.error) return flash(r.reason || r.error, "bad"); setGame(r.game); flash(`Fitted a ${r.fitted} for ${money(r.spent)}.`); };
  const doRemove = (id) => { const r = removeModule(game, id); if (r.error) return flash(r.reason || r.error, "bad"); setGame(r.game); flash(`Removed the ${r.removed}, ${money(r.refund)} back.`); };
  const doRepair = () => { const r = repairHull(game); if (r.error) return flash(r.reason || r.error, "bad"); setGame(r.game); flash(`Repaired ${r.repaired} points of hull for ${money(r.cost)}.`); };
  const doBuyPod = () => { const r = buyEscapePod(game); if (r.error) return flash(r.reason || r.error, "bad"); setGame(r.game); flash(`Escape pod fitted for ${money(r.spent)}. Cheaper than the alternative.`); };
  const doBuyDrive = (id) => { const r = buyDrive(game, id); if (r.error) return flash(r.reason || r.error, "bad"); setGame(r.game); flash(`Refitted with a ${r.driveName.toLowerCase()} for ${money(r.net)}. The map just changed — check your course.`); };
  const doHire = (id) => { const r = hireCrew(game, id); if (r.error) return flash(r.reason || r.error, "bad"); setGame(r.game); flash(`${r.hired.name} signed on at ${money(r.hired.wage)}/day.`); };
  const doBuyPaper = () => { const r = buyPaper(game); if (r.error) return flash(r.reason || r.error, "bad"); setGame(r.game); };
  // Waiting in port. The bill and the drift are the point, so the toast says
  // what it cost — otherwise "wait 30 days" reads as a free button.
  const doWait = (days) => {
    const before = game.player.credits;
    const r = wait(game, days);
    setGame(r.game);
    const spent = before - r.game.player.credits;
    flash(spent > 0
      ? `Waited ${fmtDur(days)}. ${money(spent)} in wages, and the market moved.`
      : `Waited ${fmtDur(days)}. The market moved; nothing else did.`);
    if (r.quit?.length) flash(`${r.quit.map((c) => c.name).join(" and ")} left the ship — you ran out of wages.`, "bad");
  };
  const doPayOff = (id) => { const r = dismissCrew(game, id); if (r.error) return flash(r.reason || r.error, "bad"); setGame(r.game); flash(`${r.dismissed.name} paid off.`); };

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
          {game.over ? (
            <GameOver game={game} onQuit={onQuit} />
          ) : game.encounter ? (
            <EncounterPanel game={game} onChoose={doChoose} onDismiss={doDismiss} />
          ) : transit ? (
            <TransitPanel game={game} />
          ) : (
            <>
              <div style={S.tabs}>
                <button style={{ ...S.tab, ...(mode === "dock" ? S.tabOn : null) }} onClick={() => setMode("dock")}>⚓ Dock</button>
                <button style={{ ...S.tab, ...(mode === "yard" ? S.tabOn : null) }} onClick={() => setMode("yard")}>🔧 Yard</button>
                <button style={{ ...S.tab, ...(mode === "travel" ? S.tabOn : null) }} onClick={() => setMode("travel")}>🧭 Course</button>
                <button style={{ ...S.tab, ...(mode === "standing" ? S.tabOn : null) }} onClick={() => setMode("standing")}>⚖ Standing</button>
                <button style={{ ...S.tab, ...(mode === "atlas" ? S.tabOn : null) }} onClick={() => setMode("atlas")}>🗺 Atlas</button>
              </div>
              {mode === "dock" ? <Dock game={game} sel={sel} setSel={setSel} onBuy={doBuy} onSell={doSell} onRefuel={doRefuel} onBuyPaper={doBuyPaper} onWait={doWait} />
                : mode === "yard" ? <Yard game={game} onBuyShip={doBuyShip} onFit={doFit} onRemove={doRemove} onRepair={doRepair} onBuyPod={doBuyPod} onHire={doHire} onDismiss={doPayOff} onBuyDrive={doBuyDrive} />
                  : mode === "standing" ? <StandingPanel game={game} />
                    : mode === "atlas" ? <AtlasPanel game={game} />
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
  const here = siteOf(game, p.at);
  const where = transit ? `en route to ${siteOf(game, game.leg.to)?.name}` : `docked at ${here?.name}`;
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
        {/* Hull is a live gauge now that something out there can open it up — and
            a battered hull is what turns the next encounter fatal. */}
        <Hstat label="Hull" value={`${p.ship.hullPct ?? 100}%`}
          tone={(p.ship.hullPct ?? 100) < 50 ? "hot" : undefined} />
        {p.record !== "clean" && (
          <Hstat label="Record" value={RECORD_BY_ID[p.record]?.name || p.record} tone="hot" />
        )}
        {dailyCost(game) > 0 && <Hstat label="Wages" value={`${money(dailyCost(game))}/day`} />}
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
  const from = siteOf(game, leg.from), to = siteOf(game, leg.to);
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
      {/* The reserve is draining under you on a hydrogen drive, and arriving
          somewhere that doesn't sell propellant with an empty tank is the
          consequence you cannot see coming from a static number. */}
      <Row label="In the tank" value={`${game.player.ship.fuelTonnes.toFixed(1)} t`}
        hint={(DRIVES[game.player.ship.drive] || DRIVES.methalox).boilOffPerDay
          ? "boiling off as you coast — hydrogen does not keep"
          : "methane keeps; nothing is being lost"} />
      <Row label="A message home takes" value={lag ? sayLightTime(lag) : "—"} hint="one way, at the speed of light" />
      {/* A quiet leg still had something in it — it just wasn't worth stopping for. */}
      {leg.quietNote && <p style={{ ...S.small, marginTop: 14, fontStyle: "italic" }}>{leg.quietNote}</p>}
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
// The encounter — the one screen where the clock stops for a decision.
//
// Two states in one panel: the CHOICE (what's happening, what you're carrying,
// what each option would mean) and then the OUTCOME (what it cost, itemised).
// The outcome lives on the game rather than in component state, so a refresh
// mid-encounter shows the same result instead of quietly rerolling it.
// ---------------------------------------------------------------------------
function EncounterPanel({ game, onChoose, onDismiss }) {
  const view = encounterView(game);
  if (!view) return null;
  const { encounter: enc, faction, actions, controlled, illegal, outcome, gov } = view;
  const kindTone = { hostile: "var(--hot)", authority: "#7FB2CE", opportunity: "#3E9B6E", quiet: "var(--muted)" }[enc.kind];
  const kindWord = { hostile: "Hostile", authority: "Authority", opportunity: "Opportunity", quiet: "Quiet" }[enc.kind];
  const p = game.player;

  return (
    <div style={{ overflowY: "auto", padding: "18px 18px 24px" }}>
      <div style={{ ...S.encKind, color: kindTone, borderColor: kindTone }}>⚠ {kindWord} · encounter</div>
      <FaceOff hull={p.ship.hull} kind={enc.kind} encounterId={enc.id}
        distanceNote={game.leg ? `${Math.round((1 - (game.leg.arriveT - game.t) / (game.leg.arriveT - game.leg.departT)) * 100)}% of the way to ${siteOf(game, game.leg.to)?.name}` : "in transit"} />
      <div style={S.encTitle}>{enc.title}</div>
      <div style={S.encText}>{enc.text}</div>

      {faction?.faction && (
        <div style={S.encWho}>
          <b>{faction.faction.name}</b> — you stand at {faction.standing > 0 ? "+" : ""}{faction.standing} with them.
        </div>
      )}

      {illegal?.any && (
        <div style={{ ...S.encWho, borderColor: "var(--hot)", background: "rgba(193,84,42,0.12)" }}>
          <b style={{ color: "var(--hot)" }}>You are carrying contraband.</b>{" "}
          {illegal.lines.map((l) => `${l.tonnes} t ${l.name.toLowerCase()}`).join(", ")} — banned under {gov.type.toLowerCase()}.
          If they open the hold it is seized, and the fine runs to about {money(illegal.fine)}.
        </div>
      )}

      {controlled && (
        <div style={{ ...S.encWho, borderColor: controlled.any ? "var(--hot)" : "var(--line)" }}>
          {controlled.any ? (
            <>
              <b>{gov.type}</b> polices your hold: {controlled.lines.map((l) => `${l.tonnes} t ${l.name.toLowerCase()}`).join(", ")}.
              Declared, the duty comes to <b>{money(controlled.duty)}</b>.
            </>
          ) : (
            <><b>{gov.type}</b>, and nothing in your hold is theirs to want. Complying costs you time, and nothing else.</>
          )}
        </div>
      )}

      <div style={S.encStatus}>
        <span>Hull {p.ship.hullPct ?? 100}%</span>
        <span>Hold {cargoUsed(p).toFixed(1)} t</span>
        <span>Fuel {p.ship.fuelTonnes.toFixed(1)} t</span>
        <span>{money(p.credits)}</span>
      </div>

      {!outcome ? (
        <>
          <div style={S.encPrompt}>What do you do?</div>
          {actions.map((a) => (
            <button key={a.id} style={S.encBtn} onClick={() => onChoose(a.id)}>
              <b>{a.label}</b>
              <div style={S.small}>{a.note}</div>
            </button>
          ))}
        </>
      ) : (
        <>
          <div style={{ ...S.encResult, borderColor: outcome.won ? "#3E9B6E" : "var(--hot)" }}>
            <div style={{ ...S.encHeadline, color: outcome.won ? "#3E9B6E" : "var(--hot)" }}>{outcome.headline}</div>
            <div style={S.encText}>{outcome.detail}</div>
            <EffectList game={game} effects={outcome.effects} />
          </div>
          {game.rescue && (
            <div style={{ ...S.encWho, borderColor: "var(--gold)", background: "rgba(242,180,65,0.08)" }}>
              <b style={{ color: "var(--gold)" }}>The pod worked.</b> {game.rescue.detail}
            </div>
          )}
          <button style={S.goBtn} onClick={onDismiss}>
            {game.over ? "…" : game.rescue ? `Put down at ${game.rescue.siteName}` : "Back under way"}
          </button>
        </>
      )}
    </div>
  );
}

/** What it cost, itemised — consequences you can read at a glance. */
function EffectList({ game, effects: e }) {
  const lines = [];
  if (e.credits) lines.push([e.credits > 0 ? "Credits gained" : "Credits lost", money(Math.abs(e.credits)), e.credits > 0]);
  for (const [id, qty] of Object.entries(e.cargoLost || {})) lines.push([`${COMMODITY_BY_ID[id]?.name} taken`, `${qty} t`, false]);
  for (const [id, qty] of Object.entries(e.cargoGained || {})) lines.push([`${COMMODITY_BY_ID[id]?.name} aboard`, `${qty} t`, true]);
  if (e.hullDamage) lines.push(["Hull damage", `−${e.hullDamage} points`, false]);
  if (e.fuelTonnes) lines.push(["Propellant burned", `${Math.abs(e.fuelTonnes).toFixed(1)} t`, false]);
  if (e.days) lines.push(["Days lost", `${e.days}`, false]);
  for (const [fid, d] of Object.entries(e.standing || {})) {
    lines.push([`Standing with ${FACTION_BY_ID[fid]?.name || fid}`, `${d > 0 ? "+" : ""}${d}`, d > 0]);
  }
  if (e.record) lines.push(["Police record", RECORD_BY_ID[e.record]?.name || e.record, false]);
  if (!lines.length) return <div style={{ ...S.small, marginTop: 8 }}>Nothing lost but the time it took.</div>;
  return (
    <div style={{ marginTop: 10 }}>
      {lines.map(([label, value, good], i) => (
        <div key={i} style={S.intelRow}>
          <span style={S.small}>{label}</span>
          <span style={{ color: good ? "#3E9B6E" : "var(--hot)", fontWeight: 600 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/** The run ends here. Honest about it, and offers the only thing left to do. */
function GameOver({ game, onQuit }) {
  return (
    <div style={{ padding: "24px 18px" }}>
      <div style={{ ...S.encKind, color: "var(--hot)", borderColor: "var(--hot)" }}>The run ends here</div>
      <div style={S.encTitle}>{game.over.headline}</div>
      <div style={S.encText}>{game.over.detail}</div>
      <div style={S.hr} />
      <Row label="Captain" value={game.player.name} />
      <Row label="Last seen" value={fmtDate(game.over.t)} />
      <Row label="Credits" value={money(game.player.credits)} />
      <Row label="Ports visited" value={`${game.visited.length}`} />
      <p style={{ ...S.small, marginTop: 16 }}>
        A hull that has already been opened up does not survive a second fight. The Ship Yard
        repairs damage; the trick is going there before the next crossing, not after.
      </p>
      <button style={S.goBtn} onClick={onQuit}>New captain</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dock
// ---------------------------------------------------------------------------
function Dock({ game, sel, setSel, onBuy, onSell, onRefuel, onBuyPaper, onWait }) {
  const p = game.player;
  const site = siteOf(game, p.at);
  const market = game.markets[p.at];
  // Every commodity, including the ones this port has no market for. What a
  // place CANNOT get is half of what makes it a place (design.md §5).
  const rows = listing(market, site, { includeUntraded: true });
  const fp = fuelPrice(game);
  const tank = tankMax(p), tankFreeT = tank - p.ship.fuelTonnes;
  const control = factionAt(game.factions, site.id);
  const rep = repAt(game, site.id);

  return (
    <div style={{ overflowY: "auto" }}>
      <div style={S.siteName}>{site.name}</div>
      <SystemInfoBlock game={game} siteId={p.at} />
      {control && rep && (
        <div style={S.faction}>
          <div>
            <b>{control.faction.name}</b> holds this port.
            {/* Standing where it would change a decision, not only on its own
                screen — this is whose hall you are standing in right now. */}
            <span style={{ ...S.repChip, color: rep.tier.tone, borderColor: rep.tier.tone }}>
              {rep.tier.name} {rep.standing > 0 ? "+" : ""}{rep.standing}
            </span>
          </div>
          <div style={{ marginTop: 4 }}>{control.faction.blurb}</div>
        </div>
      )}
      <div style={S.why}>{site.why}</div>

      <Newspaper game={game} onBuyPaper={onBuyPaper} />

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
        <BoilOffLine game={game} />
        <RangeLine game={game} />
      </div>

      <WaitBox game={game} onWait={onWait} />

      <div style={S.marketHead}>Market</div>
      <div style={{ padding: "0 12px 16px" }}>
        {rows.map((r, i) => {
          const held = p.cargo[r.id] || 0;
          const paid = Math.round(p.costBasis?.[r.id] || 0);
          // A good this port has no market for still gets a row. It cannot be
          // bought or sold here, and saying so is the lesson: what a place
          // can't get is why anyone flies to it. They sit BELOW the shelves,
          // under their own heading, so the lesson doesn't bury the market.
          if (!r.traded) {
            return (
              <div key={r.id}>
                {rows[i - 1]?.traded !== false && <div style={S.deadHead}>No market here for</div>}
                <div style={S.mrowDead} title={r.why}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span>{r.name}{held > 0 && <span style={S.held}> · {held} t aboard</span>}</span>
                    <span style={S.tierTag}>{TIERS[r.tier].name}</span>
                  </div>
                  <span style={S.notSold}>not traded here</span>
                </div>
              </div>
            );
          }
          const bp = buyPrice(p, market, site, r.id), sp = sellPrice(p, market, site, r.id);
          const on = sel === r.id;
          return (
            <div key={r.id}>
              <button style={{ ...S.mrow, ...(on ? S.mrowOn : null) }} onClick={() => setSel(on ? null : r.id)}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span>{r.produces ? "◆ " : r.consumes ? "○ " : ""}{r.name}
                    {/* Space Trader bolded illegal goods in its price list. Same
                        job here: you must be able to see the risk in the row. */}
                    {r.banned && <span style={S.bannedTag}>⚠ illegal here</span>}
                    {r.contraband && !r.banned && <span style={S.legalTag}>legal here</span>}
                    {held > 0 && <span style={S.held}> · {held} t aboard</span>}</span>
                  <span style={S.tierTag}>
                    {TIERS[r.tier].name} · {r.state}
                    {held > 0 && paid > 0 && ` · paid ${money(paid)}`}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={S.buyP}>buy {money(bp)}</div>
                  <div style={{ ...S.sellP, color: held > 0 && paid > 0 ? (sp >= paid ? "#3E9B6E" : "var(--hot)") : "var(--muted)" }}>
                    sell {money(sp)}{held > 0 && paid > 0 && ` (${sp >= paid ? "+" : "−"}${money(Math.abs(sp - paid))})`}
                  </div>
                </div>
              </button>
              {on && <TradeBar row={r} held={held} bp={bp} sp={sp} paid={paid} free={cargoFree(p)} credits={p.credits} onBuy={onBuy} onSell={onSell} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * WHAT THE TANK IS LOSING WHILE YOU STAND HERE. Only shown for a drive that
 * actually boils — a methalox ship should never see this line, because methane
 * keeps, and that is the point of methane.
 */
function BoilOffLine({ game }) {
  const p = game.player;
  const drive = DRIVES[p.ship.drive] || DRIVES.methalox;
  if (!drive.boilOffPerDay) return null;
  const stats = fittedStats(p.ship.hull, p.ship.modules);
  const insulation = stats?.cryo ? CRYO_FACTOR : 1;
  const perMonth = p.ship.fuelTonnes - tankAfter(p.ship.fuelTonnes, drive, 30, insulation);
  if (perMonth < 0.01) return null;
  return (
    <div style={{ ...S.small, marginTop: 8, color: "var(--gold)" }}>
      ❄ Boiling off about <b>{perMonth.toFixed(1)} t a month</b> — {drive.name.toLowerCase()} runs on
      hydrogen{stats?.cryo ? ", even with the cryocooler running" : ", and nothing aboard is chilling it"}.
      It goes on wherever you are.
    </div>
  );
}

/**
 * HOW FAR THIS SHIP CAN GO, in one line, where the player is deciding how much
 * to buy. The gap between "with what's aboard" and "with a full tank" is the
 * refuelling decision; the fact that both numbers FALL as the hold fills is the
 * rocket equation, stated without an equation.
 */
function RangeLine({ game }) {
  const r = rangeReport(game);
  if (!r.total) return null;
  return (
    <div style={{ ...S.small, marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 7 }}>
      <b style={{ color: r.now ? "var(--text)" : "var(--hot)" }}>{r.now} of {r.total} ports</b> in reach
      on the propellant aboard{r.full > r.now && <> · <b>{r.full}</b> with the tank full</>}
      {r.farthest && <> · farthest is {r.farthest.name}, {fmtDur(r.farthest.days)} out</>}.
      {" "}A fuller hold reaches fewer — mass is what the equation charges for.
    </div>
  );
}

/**
 * WAITING. wait() sat in the sim for weeks with no way to ask for it, because
 * before wages there was nothing to weigh: time in port was free. Now the clock
 * charges you, so "sit here three weeks for the shortage to bite" is a position
 * you take — and the box quotes the bill before you take it.
 */
function WaitBox({ game, onWait }) {
  const perDay = dailyCost(game);
  const OPTIONS = [7, 30, 90];
  return (
    <div style={S.fuelBox}>
      <div style={S.fuelHead}>
        <span><b>Wait here</b></span>
        <span style={S.small}>{perDay > 0 ? `${money(perDay)}/day in wages` : "costs you nothing but the date"}</span>
      </div>
      <div style={S.row}>
        {OPTIONS.map((d) => (
          <button key={d} style={S.smallBtn} onClick={() => onWait(d)}
            title={`Wait ${d} days here${perDay > 0 ? ` — ${money(perDay * d)} in wages` : ""}`}>
            +{d} days{perDay > 0 && ` (${money(perDay * d)})`}
          </button>
        ))}
      </div>
      <div style={{ ...S.small, marginTop: 7 }}>
        Prices drift back toward what a place structurally pays. Waiting sells a glut
        down and lets a shortage bite — against a wage bill and a calendar that does
        not come back.
      </div>
    </div>
  );
}

function TradeBar({ row, held, bp, sp, paid, free, credits, onBuy, onSell }) {
  const maxBuy = Math.max(0, Math.min(Math.floor(free), Math.floor(credits / bp), Math.floor(row.stock)));
  const [qty, setQty] = useState(1);
  const q = Math.min(qty, Math.max(maxBuy, held, 1));
  const sellQ = Math.min(q, held);
  return (
    <div style={S.tradeBar}>
      <div style={S.small}>{row.note}</div>
      {held > 0 && paid > 0 && (
        <div style={{ ...S.small, marginTop: 6, color: sp >= paid ? "#3E9B6E" : "var(--hot)" }}>
          You paid {money(paid)}/t. Selling {sellQ} t now = {sp >= paid ? "profit" : "loss"} {money(Math.abs((sp - paid) * sellQ))}.
        </div>
      )}
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
        const rep = repAt(game, site.id);
        return (
          <div key={site.id} style={{ ...S.destCard, ...(on ? S.destOn : null), opacity: cost.reachable ? 1 : 0.55 }}
            onMouseEnter={() => setDest(site.id)}>
            <button style={S.destBtn} onClick={() => setDest(on ? null : site.id)}>
              <div style={S.row2}><b>{site.name}</b><span style={S.destSys}>{SYSTEM_BY_ID[site.system]?.name}</span></div>
              <div style={S.destMeta}>
                {cost.fuelTonnes.toFixed(0)} t fuel · {fmtDur(cost.days)}
                {/* Space Trader's "current costs" — what the CLOCK will charge
                    you for this crossing, quoted before you commit to it. */}
                {dailyCost(game) > 0 && <span> · {money(tripCost(game, cost.days))} in wages</span>}
                {!cost.reachable && <span style={S.tooFar}> · out of range</span>}
                {cost.reachable && !cost.enoughFuel && <span style={S.tooFar}> · refuel first</span>}
                {control && <span style={S.destFaction}> · {control.faction.name}</span>}
                {/* Who runs it AND how you stand with them — the port you are
                    least welcome at is worth knowing before you burn for it. */}
                {rep && <span style={{ color: rep.tier.tone }}> ({rep.tier.name.toLowerCase()})</span>}
              </div>
            </button>
            {on && (
              <div style={S.destOpen}>
                <div style={S.small}>{site.why}</div>
                <CustomsWarning game={game} site={site} />
                <MarketIntel game={game} toId={site.id}
                  shippingPerTonne={cost.fuelTonnes && cargoUsed(game.player) ? (cost.fuelTonnes * (fuelPrice(game) || 1200)) / Math.max(1, cargoUsed(game.player)) : 0} />
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

/**
 * What the port ahead will want to see. Shown BEFORE you commit, because a cost
 * you can only discover by being stopped is a gotcha, not a decision — and the
 * whole point is that you weigh the duty against the profit while plotting.
 */
function CustomsWarning({ game, site }) {
  const gov = govOf(site);
  const owed = controlledCargo(game.player, gov);
  const banned = illegalCargo(game.player, gov);
  if (!owed.any && !banned.any) return null;
  return (
    <>
      {banned.any && (
        <div style={{ ...S.customs, background: "rgba(193,84,42,0.12)", borderColor: "var(--hot)" }}>
          <b style={{ color: "var(--hot)" }}>Illegal here.</b>{" "}
          {banned.lines.map((l) => `${l.tonnes} t ${l.name.toLowerCase()}`).join(" and ")} — banned under {gov.type.toLowerCase()},
          and this is a <b>{Math.round(gov.law * 100)}%</b>-policed approach. Caught, you lose the cargo and about {money(banned.fine)}.
          That is the trade: this is also where it is worth most.
        </div>
      )}
      {owed.any && (
        <div style={S.customs}>
          <b>{gov.type}</b> — this port polices controlled cargo.
          You are carrying {owed.lines.map((l) => `${l.tonnes} t ${l.name.toLowerCase()}`).join(" and ")};
          declared at inspection the duty is about <b>{money(owed.duty)}</b>. Legal, and not cheap.
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// STANDING — who out here knows your name, what it took, and what it buys.
//
// The three questions the game could not answer. Standing moved in five places
// (fight, bribe, comply, help, ignore) and the only number a player ever saw was
// inside the encounter panel that had just changed it; dismiss the panel and the
// figure was gone. reputation.js owns the ladder and the effects, so this screen
// can state what standing DOES exactly rather than approximating it.
//
// Colour is never the message (project rule 4): every tier shows its word and a
// signed number, and the bar carries a text label for a screen reader.
// ---------------------------------------------------------------------------
function StandingPanel({ game }) {
  const track = reputationTrack(game);
  const [open, setOpen] = useState(null);
  return (
    <div style={{ overflowY: "auto", paddingBottom: 20 }}>
      <div style={S.siteName}>Standing</div>
      <div style={S.why}>
        Who is out here this run, and what they make of you. Standing moves when you meet
        them between worlds — a fight, a bribe, an inspection complied with, a distress
        call answered or ignored. It starts where their disposition puts it, not at zero.
      </div>

      {track.length === 0 && (
        <div style={{ ...S.small, padding: "0 18px" }}>Nobody has been drawn into this world. That should not happen.</div>
      )}

      {track.map((r) => {
        const ledger = repLedger(game, { factionId: r.factionId, limit: 6 });
        const isOpen = open === r.factionId;
        return (
          <div key={r.factionId} style={S.repCard}>
            <div style={S.row2}>
              <b>{r.faction.name}</b>
              <span style={{ color: r.tier.tone, fontWeight: 700, fontSize: 13 }}>
                {r.tier.name} · {r.standing > 0 ? "+" : ""}{r.standing}
              </span>
            </div>
            <RepBar standing={r.standing} tone={r.tier.tone} label={`${r.faction.name}: ${r.tier.name}`} />
            <div style={{ ...S.small, marginTop: 6 }}>
              {r.archetype?.name} · holds {r.siteName}
              {r.atTheirPort ? " — you are docked in their hall" : r.inTheirSystem ? " — you are in their space" : ""}
            </div>
            <div style={{ ...S.small, marginTop: 6, color: "#CDD5E4" }}>{r.tier.note}</div>

            <button style={S.repLedgerBtn} onClick={() => setOpen(isOpen ? null : r.factionId)}
              aria-expanded={isOpen}>
              {ledger.length
                ? `${isOpen ? "▾" : "▸"} What it took (${ledger.length})`
                : "▸ Nothing between you yet"}
            </button>
            {isOpen && (
              ledger.length ? (
                <div style={{ marginTop: 6 }}>
                  {ledger.map((e, i) => (
                    <div key={i} style={S.repEntry}>
                      <div style={S.row2}>
                        <span style={S.small}>{fmtDate(e.t)}</span>
                        <span style={{ color: e.delta > 0 ? "#3E9B6E" : "var(--hot)", fontWeight: 700, fontSize: 12.5 }}>
                          {e.delta > 0 ? "+" : ""}{e.delta} → {e.standing > 0 ? "+" : ""}{e.standing}
                        </span>
                      </div>
                      <div style={{ ...S.small, color: "#CDD5E4" }}>{e.reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ ...S.small, marginTop: 6 }}>
                  You have not met them out there. This number is where their disposition
                  toward a stranger started, and nothing has moved it.
                </div>
              )
            )}
          </div>
        );
      })}

      <div style={S.yardHead}>What standing buys</div>
      <div style={{ ...S.small, padding: "0 18px 6px" }}>
        One thing today, and this screen will not pretend otherwise: <b>a name they know is a
        name they will listen to</b>. Talking your way out of an encounter shifts by up to 40
        percentage points across the ladder
        {track.length ? <> — with your best name out here, {track[0].faction.name}, that is currently{" "}
          <b>{track[0].talkBonusPct > 0 ? "+" : ""}{track[0].talkBonusPct} points</b></> : null}.
        Everything else standing could buy — a friendly port's tariff, contracts offered only to
        names they trust, a region that turns hostile — is not built yet. It is the next decision,
        not a hidden feature.
      </div>
    </div>
  );
}

/** A diverging bar centred on zero: left of centre is trouble, right is trust.
 *  Never the only carrier of meaning — the tier word and the number sit above it. */
function RepBar({ standing, tone, label }) {
  const span = REP_MAX - REP_MIN;                 // 200 points, centre at 50%
  const f = Math.max(0, Math.min(1, (standing - REP_MIN) / span));
  const left = Math.min(f, 0.5), right = Math.max(f, 0.5);
  return (
    <div style={S.repTrack} role="img" aria-label={`${label}, ${standing > 0 ? "plus " : ""}${standing} out of 100`}>
      <div style={{ ...S.repFill, left: `${left * 100}%`, width: `${(right - left) * 100}%`, background: tone }} />
      <div style={S.repZero} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// THE ATLAS — what this captain has learned about the real solar system.
//
// Research as play: every place in the census has an entry, and entries reveal
// by playing — Earth from the start, anywhere you dock, and whole systems at
// once when you arrive with a survey lab fitted. The facts are the treasure,
// and they are real (docs/site-atlas.md carries the sourcing ledger).
// ---------------------------------------------------------------------------
function AtlasPanel({ game }) {
  const groups = atlasFor(game);
  const { known, total } = atlasProgress(game);
  const hasLab = fittedStats(game.player.ship.hull, game.player.ship.modules).canSurvey;
  return (
    <div style={{ overflowY: "auto", paddingBottom: 20 }}>
      <div style={S.siteName}>Atlas</div>
      <div style={S.why}>
        {known} of {total} places charted. Docking somewhere charts it;
        arriving anywhere with a <b>survey lab</b> fitted charts its whole system —
        including the places nobody has built on{hasLab ? ". Yours is aboard." : ". You don't carry one."}
      </div>
      {groups.map(({ system, surveyed, places }) => (
        <div key={system.id}>
          <div style={S.yardHead}>
            {system.name}
            {surveyed && <span style={{ ...S.legalTag, marginLeft: 8 }}>surveyed</span>}
          </div>
          {places.map(({ place, revealed, feature, site, visited }) => (
            <div key={place.id} style={{ ...S.atlasRow, opacity: revealed ? 1 : 0.55 }}>
              {revealed ? (
                <>
                  <div style={S.row2}>
                    <b>{place.name}</b>
                    <span style={S.small}>
                      {visited ? "✓ visited" : feature ? "landmark" : site ? site.name : "unoccupied"}
                    </span>
                  </div>
                  <div style={{ ...S.small, marginTop: 3 }}>{place.why}</div>
                </>
              ) : (
                <div style={S.row2}>
                  <span style={{ color: "var(--muted)" }}>???</span>
                  <span style={S.small}>{feature ? "landmark — survey to chart" : "unsurveyed"}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      <div style={{ ...S.small, padding: "10px 18px", fontStyle: "italic" }}>
        Every entry here is a real place, and every reason is a real reason.
        The atlas persists with your save — a finished run is a finished map.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The Ship Yard — repair, fit modules, trade up (tech-gated). Where money goes.
// ---------------------------------------------------------------------------
function Yard({ game, onBuyShip, onFit, onRemove, onRepair, onBuyPod, onHire, onDismiss, onBuyDrive }) {
  const p = game.player;
  const site = siteOf(game, p.at);
  const stats = fittedStats(p.ship.hull, p.ship.modules);
  const slots = slotUsage(p.ship.hull, p.ship.modules);
  const hull = HULL_BY_ID[p.ship.hull];
  const dmg = 100 - (p.ship.hullPct ?? 100);
  const repair = repairCost(game);
  const ships = shipsForSale(game, p.at);
  const mods = modulesForSale(game);
  const yardTech = techOf(site);
  const eff = effectiveSkills(p);
  // crewForHire wants the SITE, not its id — passing the id made siteId
  // undefined and threw on the first character of the hash. It has been
  // crashing the whole Yard tab since crew landed; nothing tests the UI.
  const forHire = crewForHire(game.seed, site, game.t);
  const berths = berthsFor(hull);

  return (
    <div style={{ overflowY: "auto", paddingBottom: 20 }}>
      <div style={S.siteName}>Ship Yard</div>
      <div style={S.why}>{yardTech.name} yard — {yardTech.note} Trade-in on your {hull.name}: {money(tradeInValue(p.ship))}.</div>

      {/* Current ship */}
      <div style={S.yardCard}>
        <div style={S.yardTop}><b>{hull.emoji} {p.ship.name}</b><span style={S.small}>{hull.name}</span></div>
        <div style={S.yardStats}>
          <span>Hold {stats.cargoTonnes} t</span>
          <span>Tank {stats.fuelTonnes} t</span>
          <span>Berths {p.crew?.length || 0}/{berths}</span>
          <span style={{ color: dmg > 0 ? "var(--hot)" : "#3E9B6E" }}>Hull {p.ship.hullPct ?? 100}%</span>
        </div>
        <div style={{ ...S.yardStats, marginTop: 6 }}>
          {Object.entries(SLOT_KINDS).map(([k, kind]) => (
            <span key={k} style={{ color: slots.total[k] === 0 ? "var(--muted)" : "#CDD5E4" }}
              title={kind.note}>{kind.emoji} {kind.name} {slots.used[k]}/{slots.total[k]}</span>
          ))}
        </div>
        {/* Their Ship Yard led with how far you can go. Ours made you open the
            course plotter and read every row to find out. */}
        <RangeLine game={game} />
        {dmg > 0
          ? <button style={S.yardBtn} onClick={onRepair}>Repair hull — {money(repair)}</button>
          : <div style={{ ...S.small, marginTop: 6 }}>Hull sound. No repairs needed.</div>}
      </div>

      <DriveShop game={game} onBuyDrive={onBuyDrive} />

      {/* The escape pod — the cheapest insurance in the game */}
      <div style={{ ...S.yardCard, borderColor: p.ship.escapePod ? "#3E9B6E" : "var(--hot)" }}>
        <div style={S.yardTop}>
          <b>{ESCAPE_POD.emoji} {ESCAPE_POD.name}</b>
          <span style={{ ...S.small, color: p.ship.escapePod ? "#3E9B6E" : "var(--hot)" }}>
            {p.ship.escapePod ? "Aboard" : "Not fitted"}
          </span>
        </div>
        <div style={S.small}>{ESCAPE_POD.note}</div>
        {!p.ship.escapePod && (
          <button style={S.yardBtn} onClick={onBuyPod}>Fit a pod — {money(ESCAPE_POD.price)}</button>
        )}
      </div>

      {/* Crew */}
      <div style={S.yardHead}>Crew ({p.crew?.length || 0}/{berths} berths · {money(dailyWages(p))}/day)</div>
      {berths === 0 && (
        <div style={{ ...S.small, padding: "0 18px 6px" }}>
          A {hull.name} has one berth, and you're in it. A bigger hull is the only way to carry anyone.
        </div>
      )}
      {(p.crew || []).map((id) => {
        const c = CREW_BY_ID[id];
        return (
          <div key={id} style={S.modRow}>
            <div>
              <b>{c.name}</b> <span style={S.crewTag}>{c.skill} {c.rating}</span>
              <div style={S.small}>{money(c.wage)}/day · {c.blurb}</div>
            </div>
            <button style={S.modBtn} onClick={() => onDismiss(id)}>Pay off</button>
          </div>
        );
      })}
      {berths > 0 && (
        <>
          <div style={{ ...S.small, padding: "4px 18px 6px" }}>
            {/* The rule, stated where it applies, because it's the whole system */}
            The best hand aboard does the job: {SKILLS.map((s) => `${s.name} ${eff[s.id]}${eff[`${s.id}By`] ? "*" : ""}`).join(" · ")}
            {SKILLS.some((s) => eff[`${s.id}By`]) && <span> — * = a hire, not you.</span>}
          </div>
          {forHire.filter((c) => !(p.crew || []).includes(c.id)).map((c) => (
            <div key={c.id} style={S.modRow}>
              <div>
                <b>{c.name}</b> <span style={S.crewTag}>{c.skill} {c.rating}</span>
                <div style={S.small}>{money(c.wage)}/day · {c.blurb}</div>
              </div>
              <button style={{ ...S.modBtn, opacity: berthsFree(p) > 0 ? 1 : 0.4 }}
                disabled={berthsFree(p) <= 0} onClick={() => onHire(c.id)}>
                {berthsFree(p) > 0 ? "Sign on" : "No berth"}
              </button>
            </div>
          ))}
        </>
      )}

      {/* Fitted modules */}
      <div style={S.yardHead}>Fittings ({slots.usedSlots}/{slots.totalSlots} bays)</div>
      {p.ship.modules.length === 0 && <div style={{ ...S.small, padding: "0 18px 6px" }}>Nothing fitted. Add capability below.</div>}
      {p.ship.modules.map((id) => (
        <div key={id} style={S.modRow}>
          <div><b>{MODULE_BY_ID[id].emoji} {MODULE_BY_ID[id].name}</b> <span style={S.crewTag}>{MODULE_BY_ID[id].slot}</span>
            <div style={S.small}>{MODULE_BY_ID[id].note}</div></div>
          <button style={S.modBtn} onClick={() => onRemove(id)}>Remove</button>
        </div>
      ))}

      {/* Modules for sale */}
      <div style={S.yardHead}>Fit a module</div>
      {mods.filter((m) => !m.fitted).map(({ module, canFit, slotsFree, slotKind }) => {
        const noBay = slotsFree <= 0;
        return (
          <div key={module.id} style={{ ...S.modRow, opacity: noBay ? 0.55 : 1 }}>
            <div><b>{module.emoji} {module.name}</b> <span style={S.small}>{money(module.price)}</span>
              {" "}<span style={S.crewTag}>{slotKind.name.toLowerCase()} bay</span>
              <div style={S.small}>{module.note}</div></div>
            <button style={{ ...S.modBtn, opacity: canFit ? 1 : 0.4 }} disabled={!canFit}
              onClick={() => onFit(module.id)}
              title={noBay ? `This hull has no free ${slotKind.name.toLowerCase()} bay` : ""}>
              {noBay ? "No bay" : "Fit"}
            </button>
          </div>
        );
      })}

      {/* Ships for sale */}
      <div style={S.yardHead}>Ships for sale</div>
      {ships.map(({ hull: h, owned, net, affordable, cargoFits, crewFits, berths: b }) => (
        <div key={h.id} style={{ ...S.shipRow, ...(owned ? S.shipOwned : null) }}>
          <div style={{ flex: 1 }}>
            <div><b>{h.emoji} {h.name}</b> {owned && <span style={S.ownedTag}>current</span>}</div>
            <div style={S.small}>
              hold {h.cargoTonnes} t · tank {h.fuelTonnes} t · {b} berth{b === 1 ? "" : "s"}
              {" · "}⚡{h.slots.weapon} 🛡{h.slots.shield} 🔩{h.slots.gadget}
            </div>
            <div style={S.shipNote}>{h.note}</div>
          </div>
          {owned ? <span style={S.small}>—</span>
            : <button style={{ ...S.shipBuyBtn, opacity: affordable && cargoFits && crewFits ? 1 : 0.4 }}
                disabled={!affordable || !cargoFits || !crewFits}
                onClick={() => onBuyShip(h.id)}
                title={!cargoFits ? "Your cargo won't fit — sell some first"
                  : !crewFits ? "Not enough berths for your crew — pay someone off first" : ""}>
                {net >= 0 ? money(net) : `+${money(-net)}`}
              </button>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// THE DRIVE SHOP — the only purchase that redraws the map.
//
// Everything else in this yard changes a number. An era changes what the map
// MEANS (design.md §8), because the rocket equation charges exponentially and a
// new era doubles the base you are exponentiating against. So this is priced as
// the campaign's mountain and gated on a yard that could plausibly build one.
//
// The drives that are NOT for sale are listed with their reasons, because the
// reasons teach: the ion drive waits for a travel model with launch windows in
// it, and the torch is impossible and this game says why.
// ---------------------------------------------------------------------------
function DriveShop({ game, onBuyDrive }) {
  const p = game.player;
  const rows = drivesForSale(game);
  const current = DRIVES[p.ship.drive] || DRIVES.methalox;
  const stats = fittedStats(p.ship.hull, p.ship.modules);
  const insulation = stats?.cryo ? CRYO_FACTOR : 1;
  // What the tank alone would lose over a long coast — the number that makes
  // "hydrogen does not keep" a fact you feel rather than read.
  const yearKept = tankAfter(1, current, 365, insulation);

  return (
    <>
      <div style={S.yardHead}>Drive · {current.name}</div>
      <div style={{ ...S.small, padding: "0 18px 8px" }}>
        {current.note}{" "}
        {current.boilOffPerDay > 0 ? (
          <span style={{ color: yearKept < 0.75 ? "var(--hot)" : "var(--gold)" }}>
            It runs on liquid hydrogen, which boils: a year of coasting leaves{" "}
            <b>{Math.round(yearKept * 100)}%</b> of whatever is still in the tank
            {stats?.cryo ? ", with the cryocooler running." : ". A cryocooler cuts that to a tenth."}
          </span>
        ) : (
          <span>It keeps indefinitely in the tank — which is most of why anyone still flies one.</span>
        )}
      </div>
      {rows.map(({ drive: d, owned, net, canBuy, reason }) => (
        <div key={d.id} style={{ ...S.shipRow, ...(owned ? S.shipOwned : null), opacity: d.forSale ? 1 : 0.6 }}>
          <div style={{ flex: 1 }}>
            <div>
              <b>{d.name}</b> {owned && <span style={S.ownedTag}>fitted</span>}
              {d.speculative && <span style={S.bannedTag}>speculative</span>}
            </div>
            <div style={S.small}>
              {d.isp} s exhaust · {d.trajectory}
              {d.boilOffPerDay > 0 ? " · hydrogen, and it boils" : " · storable"}
              {d.forSale && !owned && ` · needs a ${TECH_LEVELS[d.minTech]?.name.toLowerCase()} yard`}
            </div>
            <div style={S.shipNote}>{reason || d.note}</div>
          </div>
          {owned ? <span style={S.small}>—</span>
            : d.forSale
              ? <button style={{ ...S.shipBuyBtn, opacity: canBuy ? 1 : 0.4 }} disabled={!canBuy}
                  onClick={() => onBuyDrive(d.id)} title={reason || ""}>
                  {net >= 0 ? money(net) : `+${money(-net)}`}
                </button>
              : <span style={S.small}>—</span>}
        </div>
      ))}
      <div style={{ ...S.small, padding: "6px 18px 0" }}>
        Trade-in on the {current.name.toLowerCase()} aboard: {money(driveTradeIn(p.ship.drive))}.
        A refit delivers the tank full. Your drive comes with you when you change hulls.
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// System Info — the character of a port (tech, government, danger, pressure).
// ---------------------------------------------------------------------------
function SystemInfoBlock({ game, siteId }) {
  const info = systemInfo(game, siteId);
  if (!info) return null;
  // POLICE AND PIRATES ON SEPARATE LINES, as Space Trader had them — because a
  // heavily patrolled lane is SAFE for a legal hold and hostile to a banned one,
  // and one netted "danger" word cannot say that.
  const pTone = { Abundant: "#7FB2CE", Moderate: "#7FB2CE", Sparse: "var(--muted)", Absent: "var(--gold)" }[info.policeWord];
  const rTone = { Swarms: "var(--hot)", Many: "var(--hot)", Some: "var(--gold)", Few: "#3E9B6E" }[info.pirateWord];
  return (
    <div style={S.sysinfo}>
      <div style={S.sysRow}>
        <span style={S.sysChip}>{info.tech.name}</span>
        <span style={S.sysChip}>{info.gov.type}</span>
        <span style={S.sysPop}>pop. {info.population.toLocaleString()}</span>
      </div>
      <div style={S.sysRow}>
        <span style={{ ...S.sysChip, color: pTone, borderColor: pTone }} title={info.policeNote}>
          👮 Police: {info.policeWord}
        </span>
        <span style={{ ...S.sysChip, color: rTone, borderColor: rTone }} title={info.pirateNote}>
          ☠ Pirates: {info.pirateWord}
        </span>
      </div>
      <div style={S.sysPressure}>{info.pressure}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The local newspaper — the "why go far" signal, drawn from factions + markets.
// ---------------------------------------------------------------------------
function Newspaper({ game, onBuyPaper }) {
  const [open, setOpen] = useState(true);
  const news = generateNews(game);
  if (!news.items.length) return null;
  const bought = game.paperAt === game.player.at;
  const price = paperPrice(game);
  const tone = { crisis: "var(--hot)", danger: "var(--hot)", opportunity: "#3E9B6E", market: "var(--gold)" };
  return (
    <div style={S.paper}>
      <button style={S.paperHead} onClick={() => setOpen((v) => !v)}>
        <span>📰 {news.paper}</span>
        <span style={S.paperToggle}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (bought ? (
        <div style={S.paperBody}>
          {news.items.map((it, i) => (
            <div key={i} style={S.headline}>
              <span style={{ color: tone[it.kind] || "var(--muted)" }}>▍</span> {it.headline}
            </div>
          ))}
          <div style={S.paperNote}>{news.reachNote}</div>
        </div>
      ) : (
        // Not free. The whole game says information is a resource; a feed of
        // every shortage in the system, handed over for nothing, said otherwise.
        <div style={S.paperBody}>
          <div style={S.small}>
            {news.items.length} {news.items.length === 1 ? "story" : "stories"} on the wire today — {news.reachNote}.
          </div>
          <button style={{ ...S.smallBtn, marginTop: 8 }} onClick={onBuyPaper}>
            Buy a copy — {money(price)}
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market intel — see the trade before you fly (Space Trader's Average Price
// List + Price Differences, and our light-lag information model made visible).
// ---------------------------------------------------------------------------
function MarketIntel({ game, toId, shippingPerTonne }) {
  const carrying = cargoUsed(game.player) > 0;
  const { rows, freshness } = runPlan(game, toId, shippingPerTonne);
  const cargo = carrying ? cargoValueAt(game, toId) : null;
  const best = rows.filter((r) => r.viable).slice(0, 3);
  const freshTone = { live: "#3E9B6E", recent: "#3E9B6E", delayed: "var(--gold)", stale: "var(--hot)", occluded: "var(--hot)" }[freshness?.key] || "var(--muted)";

  // SOLAR CONJUNCTION: the Sun stands between here and there. No estimates, no
  // news — flying is still allowed, but it is a bet, and the panel says so
  // instead of pretending an empty list means "nothing profitable".
  if (freshness?.key === "occluded") {
    return (
      <div style={S.intel}>
        <div style={S.intelHead}>
          Market intel
          <span style={{ ...S.freshTag, color: freshTone, borderColor: freshTone }}>{freshness.label}</span>
        </div>
        <div style={{ ...S.small, color: "var(--hot)" }}>☀ Solar conjunction.</div>
        <div style={S.intelNote}>{freshness.note}</div>
      </div>
    );
  }

  return (
    <div style={S.intel}>
      <div style={S.intelHead}>
        Market intel
        <span style={{ ...S.freshTag, color: freshTone, borderColor: freshTone }}>{freshness?.label}</span>
      </div>

      {carrying && (
        <div style={S.intelBlock}>
          <div style={S.intelLabel}>Your cargo would fetch there (est.)</div>
          {cargo.lines.map((l) => (
            <div key={l.id} style={S.intelRow}>
              <span>{l.tonnes} t {l.name}</span>
              <span>{l.sold ? money(l.value) : "not traded there"}</span>
            </div>
          ))}
          <div style={{ ...S.intelRow, fontWeight: 700, color: "var(--gold)" }}>
            <span>Total</span><span>~{money(cargo.total)}</span>
          </div>
        </div>
      )}

      <div style={S.intelBlock}>
        <div style={S.intelLabel}>Best to carry from here (est. margin/t)</div>
        {best.length ? best.map((r) => (
          <div key={r.id} style={S.intelRow}>
            <span>{r.name}</span>
            <span style={{ color: "var(--gold)" }}>+{money(r.marginPerTonne)}</span>
          </div>
        )) : <div style={S.small}>Nothing here pays for the trip. Try a nearer world or a fuller hold.</div>}
      </div>
      <div style={S.intelNote}>{freshness?.note}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orrery — with the player ship on it
// ---------------------------------------------------------------------------
function Orrery({ positions, orbits, game, dest }) {
  const opts = { cx: CX, cy: CY, radius: R, trueScale: false };
  const hereSys = siteOf(game, game.player.at)?.system;
  const transit = game.status === "transit";
  const destSys = transit ? siteOf(game, game.leg.to)?.system : (dest && siteOf(game, dest)?.system);

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
        const held = game.factions?.some((fx) => fx.system === s.id);
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
  // Five tabs in a 400px panel: tighter than four were, and nowrap so a label
  // never breaks in half rather than shrinking the row.
  tab: { flex: 1, background: "var(--panel-2)", border: "none", padding: "12px 3px", cursor: "pointer", fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap" },
  tabOn: { background: "var(--panel)", color: "var(--gold)", fontWeight: 700, boxShadow: "inset 0 -2px 0 var(--gold)" },

  encKind: { display: "inline-block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1.2, borderWidth: "1px", borderStyle: "solid", borderColor: "transparent", borderRadius: 10, padding: "2px 9px", marginBottom: 12 },
  encTitle: { fontSize: 20, fontWeight: 700, lineHeight: 1.3, marginBottom: 8 },
  encText: { fontSize: 13.5, color: "#CDD5E4", lineHeight: 1.6 },
  encWho: { marginTop: 12, padding: "9px 12px", background: "var(--panel-2)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 9, fontSize: 12.5, lineHeight: 1.55 },
  encStatus: { display: "flex", flexWrap: "wrap", gap: 12, margin: "14px 0", padding: "9px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", fontSize: 12.5, color: "#CDD5E4", fontVariantNumeric: "tabular-nums" },
  encPrompt: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", margin: "4px 0 8px" },
  encBtn: { width: "100%", textAlign: "left", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 9, padding: "10px 13px", marginBottom: 7, cursor: "pointer", color: "var(--text)", fontSize: 14 },
  encResult: { padding: "12px 14px", background: "#0B111C", borderWidth: "1px", borderStyle: "solid", borderColor: "transparent", borderRadius: 10, marginBottom: 12 },
  encHeadline: { fontSize: 16, fontWeight: 700, marginBottom: 6 },

  transitHead: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold)", marginBottom: 10 },
  route: { fontSize: 20, fontWeight: 700, marginBottom: 14 },
  arrow: { color: "var(--muted)" },
  progressTrack: { height: 8, background: "var(--panel-2)", borderRadius: 5, overflow: "hidden", border: "1px solid var(--line)" },
  progressFill: { height: "100%", background: "var(--gold)" },
  hr: { height: 1, background: "var(--line)", margin: "16px 0" },

  siteName: { fontSize: 19, fontWeight: 700, padding: "16px 18px 4px" },
  sysinfo: { padding: "0 18px 8px" },
  sysRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 5 },
  sysChip: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 10, padding: "2px 8px" },
  sysPop: { fontSize: 11.5, color: "var(--muted)", marginLeft: "auto" },
  sysPressure: { fontSize: 12.5, color: "#CDD5E4", lineHeight: 1.5 },
  faction: { margin: "0 18px 8px", padding: "9px 12px", background: "rgba(242,180,65,0.08)", border: "1px solid rgba(242,180,65,0.35)", borderRadius: 9, fontSize: 12.5, lineHeight: 1.5 },
  paper: { margin: "0 18px 12px", border: "1px solid var(--line)", borderRadius: 9, overflow: "hidden", background: "#0B111C" },
  paperHead: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "var(--panel-2)", border: "none", cursor: "pointer", color: "var(--text)", fontSize: 13, fontWeight: 600 },
  paperToggle: { color: "var(--muted)" },
  paperBody: { padding: "8px 12px 10px" },
  headline: { fontSize: 12.5, lineHeight: 1.5, padding: "4px 0", color: "#DCE3F0" },
  paperNote: { fontSize: 11, color: "var(--muted)", fontStyle: "italic", marginTop: 6 },
  why: { fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, padding: "0 18px 14px" },
  fuelBox: { margin: "0 18px 6px", padding: "10px 12px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10 },
  fuelHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, marginBottom: 8 },
  marketHead: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", padding: "10px 18px 6px" },
  yardCard: { margin: "0 18px 6px", padding: "12px 14px", background: "var(--panel-2)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 10 },
  yardTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  yardStats: { display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12.5, color: "#CDD5E4", fontVariantNumeric: "tabular-nums" },
  yardBtn: { marginTop: 10, width: "100%", background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 8, padding: "8px", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  yardHead: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", padding: "14px 18px 6px" },
  modRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, margin: "0 18px 6px", padding: "9px 12px", background: "#0B111C", border: "1px solid var(--line)", borderRadius: 8 },
  modBtn: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, flexShrink: 0 },
  shipRow: { display: "flex", alignItems: "center", gap: 10, margin: "0 18px 6px", padding: "10px 12px", background: "var(--panel-2)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 8 },
  shipOwned: { borderColor: "var(--gold)" },
  ownedTag: { fontSize: 10, color: "var(--gold)", border: "1px solid var(--gold)", borderRadius: 10, padding: "1px 7px", marginLeft: 6 },
  shipNote: { fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 3 },
  shipBuyBtn: { background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  mrow: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 10px", background: "none", border: "1px solid transparent", borderRadius: 8, cursor: "pointer", color: "var(--text)", textAlign: "left" },
  mrowOn: { background: "var(--panel-2)", border: "1px solid var(--line)" },
  // A good with no market here. Dimmed and not a button, because there is
  // nothing to press — but present, because its absence is information.
  mrowDead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 10px", border: "1px solid transparent", borderRadius: 8, opacity: 0.45, color: "var(--muted)", textAlign: "left" },
  notSold: { fontSize: 12, color: "var(--muted)", fontStyle: "italic", whiteSpace: "nowrap" },
  deadHead: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", padding: "14px 0 4px", borderTop: "1px solid var(--line)", marginTop: 8 },
  held: { color: "var(--gold)", fontSize: 12 },
  crewTag: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 9, padding: "1px 6px", marginLeft: 4 },
  atlasRow: { margin: "0 18px 6px", padding: "9px 12px", background: "#0B111C", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 8, fontSize: 13 },
  repCard: { margin: "0 18px 8px", padding: "11px 13px", background: "#0B111C", border: "1px solid var(--line)", borderRadius: 9, fontSize: 13 },
  repTrack: { position: "relative", height: 7, marginTop: 8, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 5, overflow: "hidden" },
  repFill: { position: "absolute", top: 0, bottom: 0, minWidth: 2 },
  repZero: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line)" },
  repLedgerBtn: { marginTop: 9, width: "100%", textAlign: "left", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 7, padding: "6px 10px", cursor: "pointer", color: "var(--muted)", fontSize: 12 },
  repEntry: { padding: "6px 0", borderTop: "1px solid var(--line)" },
  repChip: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, borderWidth: "1px", borderStyle: "solid", borderRadius: 10, padding: "1px 7px", marginLeft: 6, whiteSpace: "nowrap" },
  bannedTag: { fontSize: 10, color: "var(--hot)", border: "1px solid var(--hot)", borderRadius: 9, padding: "1px 6px", marginLeft: 6, whiteSpace: "nowrap" },
  legalTag: { fontSize: 10, color: "#3E9B6E", border: "1px solid #3E9B6E", borderRadius: 9, padding: "1px 6px", marginLeft: 6, whiteSpace: "nowrap" },
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

  customs: { margin: "10px 0 0", padding: "9px 11px", background: "rgba(127,178,206,0.08)", borderWidth: "1px", borderStyle: "solid", borderColor: "rgba(127,178,206,0.4)", borderRadius: 8, fontSize: 12, lineHeight: 1.55 },
  intel: { margin: "10px 0 4px", padding: "10px 12px", background: "#0B111C", border: "1px solid var(--line)", borderRadius: 8 },
  intelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 8 },
  freshTag: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, borderWidth: "1px", borderStyle: "solid", borderColor: "transparent", borderRadius: 10, padding: "1px 7px" },
  intelBlock: { marginBottom: 10 },
  intelLabel: { fontSize: 11, color: "var(--muted)", marginBottom: 4 },
  intelRow: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0", fontVariantNumeric: "tabular-nums" },
  intelNote: { fontSize: 11, color: "var(--muted)", lineHeight: 1.5, fontStyle: "italic" },

  row: { display: "flex", gap: 6, alignItems: "center" },
  small: { fontSize: 12, color: "var(--muted)", lineHeight: 1.5 },
  smallBtn: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12 },
  stepBtn: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 13, minWidth: 32 },
  qty: { minWidth: 44, textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  buyBtn: { background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 7, padding: "6px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  sellBtn: { background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 7, padding: "6px 16px", cursor: "pointer", fontSize: 13 },
  goBtn: { marginTop: 10, width: "100%", background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontWeight: 700, fontSize: 14 },

  pin: { fontSize: 12, textAnchor: "middle", pointerEvents: "none", fontFamily: "inherit" },
  toast: { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "var(--panel)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--gold)", borderRadius: 10, padding: "11px 18px", fontSize: 13.5, zIndex: 40, maxWidth: 560, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" },
};
