// ===========================================================================
// THE TRADE GAME — play screen. Now on the fleet's LIVING clock.
//
// The merge (design.md): the trade loop had abandoned the animated orrery, the
// ship-on-the-map and the pause-for-decisions rhythm that made the fleet good.
// This puts them back. You plot a course, LAUNCH, and watch your ship cross the
// real transfer arc while the planets move; the clock pauses itself on arrival
// and the dock opens. Time you can hurry, slow, or skip — but never fake.
// ===========================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { heliocentric, periodDays, lightTimeSeconds } from "../ephemeris.js";
import { project, orbitPath, sayLightTime, trueScaleFacts, moonLongitude } from "../orrery.js";
import { transferPosition } from "../transfer.js";
import { SYSTEMS, SYSTEM_BY_ID, MOONS, BELT_BODIES } from "../data/bodies.js";
import { siteOf } from "../data/sites.js";
import { COMMODITY_BY_ID } from "../data/commodities.js";
import { cargoUsed, cargoCapacity } from "../player.js";
import { FACTION_BY_ID } from "../data/factions.js";
import { buyShip, fitModule, removeModule, repairHull, buyEscapePod, buyDrive } from "../shipyard.js";
import { DRIVES } from "../propulsion.js";
import { contextOf } from "../audio.js";
import { starfield, galacticBand, skySeed, beltScatter } from "../starfield.js";
import { hireCrew, dismissCrew } from "../crew.js";
import { FaceOff } from "./ships.jsx";
import Panel, { SystemAtlas } from "./panels.jsx";
import { makeSave, serialize } from "../save.js";
import { encounterView, resolveEncounter, dismissEncounter } from "../encounters.js";
import { RECORD_BY_ID } from "../data/encounters.js";
import {
  launch, advanceTime, shipPosition, refuel, fuelPrice,
  buy, sell, tankMax, RATES, dailyCost, buyPaper,
  wait, rangeReport,
} from "../tradergame.js";

// THE BOARD IS WIDER THAN IT IS TALL, because the stage it sits in is. A square
// viewBox letterboxed itself on every desktop window and left a third of the
// screen empty on each side. 1350×1000 is close to the stage's own shape, so the
// map fills it.
const VBW = 1350, VBH = 1000, CX = VBW / 2, CY = VBH / 2, R = 472, DAY = 86400000;

// AND THE WHOLE MAP IS TURNED, which is what buys the width back.
//
// Pluto's orbit is the one that decides how big anything can be drawn: it is
// eccentric enough (e = 0.249) that its aphelion reaches 49.3 AU while its
// perihelion is only 29.7. Laid out with that long axis VERTICAL, the true-scale
// view has to fit 49.3 AU into half the height. Laid along the wide direction
// instead, the vertical requirement drops to the semi-minor axis — 38.2 AU — and
// everything can be drawn about a third larger.
//
// Pluto's longitude of perihelion is 224.07°, so its aphelion lies at 44.07°.
// Turning the map by 135.93° puts that aphelion at screen-left. Rotation changes
// nothing the map claims: every angle BETWEEN two bodies is preserved, and the
// map never asserts which way ecliptic zero points.
const MAP_ROTATION = 135.93;

// The true-scale fit, worked out from Pluto's real elements (a = 39.482 AU,
// e = 0.2488): 12.238 viewBox units per AU puts its full ellipse inside the
// frame with the semi-minor axis just touching top and bottom.
const TRUE_AU_AT_R = 38.24;          // AU that maps to R — the semi-minor axis
const TRUE_SUN_DX = 120;             // the Sun is a FOCUS, not the centre: shift
                                     // it so the ellipse sits centred in frame
// True-scale view only: anything drawn nearer the Sun than this is part of the
// inner cluster and gets its name in the side legend instead of on its dot.
// 100 units catches everything in through Saturn, which is where the pile-up is.

/** How fast the clock drifts while you are docked, in mission-days per real
 *  second. Slow enough to read a market under, fast enough that Earth visibly
 *  moves in ten seconds — a planet covers about a degree a day. */
// Time in port drifts at one day every three seconds. It was one day a second,
// which was fast enough that a player reading a market panel watched the date
// run away underneath them. Slower reads as a world ticking over rather than a
// clock being hurried.
const DOCK_RATE = 1 / 3;
const money = (n) => "$" + Math.round(n).toLocaleString();
const fmtDate = (t) => new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDur = (d) => d < 60 ? `${Math.round(d)} days` : d < 700 ? `${(d / 30.44).toFixed(0)} months` : `${(d / 365.25).toFixed(1)} years`;
const dot = (rkm, k = 1) => Math.max(4, Math.min(22, Math.pow(rkm || 1000, 0.25) * 1.25)) * k;

export default function Play({ game, setGame, onQuit, audio, cue, onToggleAudio, onAudioLevel, onSetContext }) {
  const [mode, setMode] = useState("dock");
  const [dest, setDest] = useState(null);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  // Which system the map is inside, or null for the whole solar system.
  const [zoom, setZoom] = useState(null);
  // MENU IS A PAUSE, NOT AN EXIT. It used to drop you straight back to the title
  // screen, which is a destructive-feeling action to put one click from the
  // player's thumb with no confirmation. It opens this instead.
  const [paused, setPaused] = useState(false);
  // The scale toggle. The playable map compresses distance logarithmically so
  // the inner planets are legible; this is the honest picture, kept one click
  // away rather than hidden (orrery.js explains why that matters).
  const [trueScale, setTrueScale] = useState(false);

  const flash = (text, kind = "ok") => setToast({ text, kind });

  // The soundtrack lives in index.jsx so it spans the menu as well as the game.
  // Play's only job is to say WHERE the player is, which decides the cue.
  const musicContext = contextOf(game, (siteId) => siteOf(game, siteId)?.system);
  useEffect(() => { onSetContext?.(musicContext); }, [musicContext, onSetContext]);
  const transit = game.status === "transit";
  // The clock holds for an encounter, for the end of a run, and for the pause
  // menu — which is the whole point of calling it a pause.
  const stopped = !!game.encounter || !!game.over || paused;


  // ---- the living clock ---------------------------------------------------
  // setInterval, not requestAnimationFrame: rAF is throttled to zero in a hidden
  // tab, which would silently freeze the game whenever the player looked away.
  // dt is measured from the wall clock, so a stalled tab slows the sim rather
  // than desynchronising it.
  //
  // TIME ALWAYS RUNS IN PORT, and there is no longer a way to hold it. A static
  // orrery reads as a diagram; a moving one teaches the synodic period for free,
  // which is the single most useful thing this map can do — and a pause button
  // is an invitation to switch that lesson off. What the clock genuinely costs
  // is WAGES, which accrue per day, so dithering is free with an empty ship and
  // expensive with a crew aboard. The Wait button on the Dock is how you spend
  // time deliberately; this is just the world turning over.
  const clockOn = transit ? RATES[game.rateIdx].days > 0 : true;
  const stepDays = transit ? RATES[game.rateIdx].days : DOCK_RATE;
  useEffect(() => {
    if (stopped || !clockOn) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(400, now - last);
      last = now;
      setGame((g) => {
        if (g.encounter || g.over) return g;
        const rate = g.status === "transit" ? RATES[g.rateIdx].days : DOCK_RATE;
        if (rate <= 0) return g;
        const r = advanceTime(g, g.t + rate * (dt / 1000) * DAY);
        if (r.arrived) queueMicrotask(() => { flash(`Arrived at ${r.arrived}.`); setMode("dock"); });
        if (r.encounter) queueMicrotask(() => flash(r.encounter, "bad"));
        if (r.quit?.length) queueMicrotask(() => flash(`${r.quit.map((c) => c.name).join(" and ")} left the ship — you ran out of wages.`, "bad"));
        return r.game;
      });
    }, transit ? 33 : 100);
    return () => clearInterval(id);
  }, [transit, stopped, clockOn, stepDays]);

  const setRate = (i) => setGame((g) => ({ ...g, rateIdx: i }));
  const skip = () => setGame((g) => {
    if (g.status !== "transit" || g.encounter || g.over) return g;
    const r = advanceTime(g, g.leg.arriveT);
    if (r.arrived) queueMicrotask(() => { flash(`Arrived at ${r.arrived}.`); setMode("dock"); });
    if (r.encounter) queueMicrotask(() => flash(r.encounter, "bad"));
    if (r.quit?.length) queueMicrotask(() => flash(`${r.quit.map((c) => c.name).join(" and ")} left the ship — you ran out of wages.`, "bad"));
    return { ...r.game, rateIdx: 0 };
  });

  // Esc backs out of a zoomed system, the same key the old fleet map used.
  useEffect(() => {
    if (!paused) return;
    const onKey = (e) => { if (e.key === "Escape") setPaused(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => { if (e.key === "Escape") setZoom(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

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
    // Back out to the solar system: the leg is a heliocentric arc, and a system
    // view cannot draw it. Watching the ship cross is the point of launching.
    setZoom(null);
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

  // Everything the panel screens can do, in one bundle. The screens live in
  // panels.jsx and hold no game state of their own — they read the game and
  // call these, which keeps every mutation in one file with the clock.
  const actions = {
    buy: doBuy, sell: doSell, refuel: doRefuel, wait: doWait, buyPaper: doBuyPaper,
    buyShip: doBuyShip, fit: doFit, remove: doRemove, repair: doRepair, buyPod: doBuyPod,
    hire: doHire, dismiss: doPayOff, buyDrive: doBuyDrive, launch: doLaunch,
  };

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
      <Hud game={game} onQuit={() => setPaused(true)} setRate={setRate} skip={skip}
        audio={audio} cue={cue} onToggleAudio={onToggleAudio} onAudioLevel={onAudioLevel} />
      <div style={S.main}>
        <div style={S.stage}>
          {zoom
            ? <SystemView game={game} systemId={zoom} dest={dest} onBack={() => setZoom(null)}
                onPick={(id) => {
                  // The map picks the trip; the course plotter prices it.
                  if (id === game.player.at) { setMode("dock"); return; }
                  setDest(id); setMode("travel");
                }} />
            : <>
                <Orrery positions={positions} orbits={orbits} game={game} dest={dest}
                  onZoom={(id) => setZoom(id)} trueScale={trueScale} />
                <ScaleToggle on={trueScale} onToggle={() => setTrueScale((v) => !v)} />
              </>}
        </div>
        <aside style={S.panel} aria-live="polite">
          {game.over ? (
            <GameOver game={game} onQuit={onQuit} />
          ) : game.encounter ? (
            <EncounterPanel game={game} onChoose={doChoose} onDismiss={doDismiss} />
          ) : zoom ? (
            // THE MAP AND THE PANEL MOVE TOGETHER. Clicking a planet opens its
            // system on the map and its atlas here, so what you are reading
            // about is what you are looking at. Backing out returns both.
            <SystemAtlas game={game} systemId={zoom} onBack={() => setZoom(null)} />
          ) : transit ? (
            <TransitPanel game={game} />
          ) : (
            <>
              <div style={S.tabs}>
                <button style={{ ...S.tab, ...(mode === "dock" ? S.tabOn : null) }} onClick={() => setMode("dock")}>⚓ Dock</button>
                <button style={{ ...S.tab, ...(mode === "yard" ? S.tabOn : null) }} onClick={() => setMode("yard")}>🔧 Yard</button>
                <button style={{ ...S.tab, ...(mode === "travel" ? S.tabOn : null) }} onClick={() => setMode("travel")}>🧭 Course</button>
                <button style={{ ...S.tab, ...(mode === "standing" ? S.tabOn : null) }} onClick={() => setMode("standing")}>⚖ Standing</button>
              </div>
              <Panel game={game} mode={mode} dest={dest} setDest={setDest} actions={actions} />
            </>
          )}
        </aside>
      </div>
      {paused && (
        <PauseMenu game={game} setGame={setGame} audio={audio}
          onResume={() => setPaused(false)} onQuit={onQuit}
          onSave={downloadSave} onToggleAudio={onToggleAudio} />
      )}
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
function Hud({ game, onQuit, setRate, skip, audio, cue, onToggleAudio, onAudioLevel }) {
  const p = game.player;
  const transit = game.status === "transit";
  const here = siteOf(game, p.at);
  const where = transit ? `en route to ${siteOf(game, game.leg.to)?.name}` : `docked at ${here?.name}`;
  return (
    <header style={S.hud}>
      <MusicControl audio={audio} cue={cue} onToggle={onToggleAudio} onLevel={onAudioLevel} />
      <div>
        <div style={S.capName}>{p.name}</div>
        <div style={S.sub}>{p.ship.name} · {where}</div>
      </div>
      <div style={S.hudStats}>
        <Hstat label="Credits" value={money(p.credits)} tone="gold" />
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
        <div style={S.clock}>
          <button style={S.quit} onClick={onQuit}>Menu</button>
        </div>
      )}
    </header>
  );
}
/**
 * The music control. Small on purpose — it is a background score, and a
 * transport bar would invite the player to manage it instead of playing.
 *
 * The cue's name is in the tooltip rather than on screen: knowing what is
 * playing is a nice thing to be able to find out and a distracting thing to be
 * told continuously.
 */
function MusicControl({ audio, cue, onToggle, onLevel }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={S.musicWrap} onMouseLeave={() => setOpen(false)}>
      <button onClick={onToggle} onFocus={() => setOpen(true)} onMouseEnter={() => setOpen(true)}
        aria-pressed={audio.on} style={{ ...S.homeBtn, color: audio.on ? "var(--gold)" : "var(--muted)" }}
        title={audio.on ? `Music on${cue ? ` — ${cue.name}` : ""}. Click to silence.` : "Music off. Click to play."}
        aria-label={audio.on ? "Turn music off" : "Turn music on"}>
        {audio.on ? "♪" : "♪̸"}
      </button>
      {open && audio.on && (
        <div style={S.musicPop}>
          {cue && <div style={S.musicCue}>{cue.name}</div>}
          <input type="range" min="0" max="1" step="0.05" value={audio.level}
            onChange={(e) => onLevel(Number(e.target.value))}
            aria-label="Music volume" style={{ width: 110 }} />
        </div>
      )}
    </div>
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

/** A collapsed section. Prose is worth having and worth being able to put away. */
function Fold({ title, children, open: initial = false }) {
  const [open, setOpen] = useState(initial);
  return (
    <div style={{ margin: "0 18px 14px" }}>
      <button style={S.foldHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "▾" : "▸"} {title}
      </button>
      {open && <div style={{ padding: "8px 2px 0" }}>{children}</div>}
    </div>
  );
}

/**
 * WHAT AM I MEANT TO BE DOING? The game never said, and "overwhelming, and not
 * intuitive what I'm supposed to be doing" is the most useful note this project
 * has had. One sentence, read off the state the player is actually in — not a
 * tutorial, not a quest marker, just the next sensible move stated out loud.
 *
 * Ordered by urgency: a problem that blocks you first, then the ordinary loop.
 */
function NextStep({ game }) {
  const p = game.player;
  const held = cargoUsed(p);
  const range = rangeReport(game);
  const fp = fuelPrice(game);
  const lowFuel = p.ship.fuelTonnes < tankMax(p) * 0.25;

  let text;
  if ((p.ship.hullPct ?? 100) < 50) {
    text = "Your hull is badly opened up. Repair it in the Yard before the next crossing — a second fight is what kills you.";
  } else if (range.now === 0 && fp) {
    text = "You cannot reach anywhere on the propellant aboard. Refuel here first.";
  } else if (range.now === 0) {
    text = "You cannot reach anywhere on the propellant aboard, and this port sells none. Check the Course tab for what a full tank would open.";
  } else if (held > 0) {
    text = `You are carrying ${held.toFixed(0)} t. Open the Course tab — it estimates what your cargo fetches at each port before you commit to the trip.`;
  } else if (lowFuel) {
    text = "The hold is empty and the tank is low. Buy something this port is long on, top up the propellant, and pick a port that is short on it.";
  } else {
    text = "The hold is empty. Buy something this port has a surplus of (◆), then find a port that has to import it (○). That gap is the whole trade.";
  }
  return <div style={S.nextStep}>{text}</div>;
}

/**
 * WHAT THE TANK IS LOSING WHILE YOU STAND HERE. Only shown for a drive that
 * actually boils — a methalox ship should never see this line, because methane
 * keeps, and that is the point of methane.
 */

/**
 * HOW FAR THIS SHIP CAN GO, in one line, where the player is deciding how much
 * to buy. The gap between "with what's aboard" and "with a full tank" is the
 * refuelling decision; the fact that both numbers FALL as the hold fills is the
 * rocket equation, stated without an equation.
 */

/**
 * WAITING. wait() sat in the sim for weeks with no way to ask for it, because
 * before wages there was nothing to weigh: time in port was free. Now the clock
 * charges you, so "sit here three weeks for the shortage to bite" is a position
 * you take — and the box quotes the bill before you take it.
 */


// ---------------------------------------------------------------------------
// Course plotter
// ---------------------------------------------------------------------------

/**
 * What the port ahead will want to see. Shown BEFORE you commit, because a cost
 * you can only discover by being stopped is a gotcha, not a decision — and the
 * whole point is that you weigh the duty against the profit while plotting.
 */

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

/** A diverging bar centred on zero: left of centre is trouble, right is trust.
 *  Never the only carrier of meaning — the tier word and the number sit above it. */

// ---------------------------------------------------------------------------
// THE ATLAS — what this captain has learned about the real solar system.
//
// Research as play: every place in the census has an entry, and entries reveal
// by playing — Earth from the start, anywhere you dock, and whole systems at
// once when you arrive with a survey lab fitted. The facts are the treasure,
// and they are real (docs/site-atlas.md carries the sourcing ledger).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The Ship Yard — repair, fit modules, trade up (tech-gated). Where money goes.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// System Info — the character of a port (tech, government, danger, pressure).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The local newspaper — the "why go far" signal, drawn from factions + markets.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Market intel — see the trade before you fly (Space Trader's Average Price
// List + Price Differences, and our light-lag information model made visible).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Orrery — with the player ship on it
// ---------------------------------------------------------------------------
/**
 * The dark behind everything. Four paths for four hundred stars (starfield.js
 * explains the trick), generated once and never again — a field that reshuffled
 * on every clock tick would shimmer thirty times a second.
 *
 * Deliberately dim: the planets are the subject, and a starfield you actually
 * notice is one that is competing with them.
 */
function Stars({ seed = 20350101, avoid = 120 }) {
  const field = useMemo(() => starfield(VBW, seed, avoid, VBH), [seed, avoid]);
  const band = useMemo(() => galacticBand(VBW, VBH), []);
  return (
    <g aria-hidden="true" pointerEvents="none">
      <ellipse cx={band.cx} cy={band.cy} rx={band.rx} ry={band.ry} fill="url(#band)"
        transform={`rotate(${band.rotate} ${band.cx} ${band.cy})`} />
      {field.map((t) => (
        <path key={t.id} d={t.d} stroke="#DCE6FF" strokeWidth={t.size} strokeOpacity={t.opacity}
          strokeLinecap="round" fill="none" />
      ))}
    </g>
  );
}

/**
 * THE SCALE TOGGLE — the honest picture, one click away.
 *
 * The map you play on compresses radius logarithmically, because drawn to scale
 * the four planets a beginner cares about most occupy the first fifteen pixels
 * and overlap the Sun. That compression is a lie of convenience, and the rule
 * this project holds itself to (design.md §16) is that where the game
 * simplifies, it simplifies LEGIBLY and says so.
 *
 * So the truth is a button rather than a footnote — and the true view teaches
 * something the playable one cannot: that the solar system is almost entirely
 * nothing, and that "far" and "hard" are different words.
 */
function ScaleToggle({ on, onToggle }) {
  const facts = trueScaleFacts(R, TRUE_AU_AT_R);
  return (
    <div style={S.scaleWrap}>
      <button onClick={onToggle} aria-pressed={on} style={{ ...S.scaleBtn, ...(on ? S.scaleBtnOn : null) }}
        title={on ? "Back to the readable map" : "Show the planets at their true relative distances"}>
        {on ? "◎ True distance" : "◉ Readable map"}
      </button>
      <div style={S.scaleNote}>
        {on ? facts.note
          : "Distance is compressed so the inner planets are legible — angles are exact, spacing is not."}
      </div>
    </div>
  );
}

function Orrery({ positions, orbits, game, dest, onZoom, trueScale }) {
  const opts = trueScale
    ? { cx: CX + TRUE_SUN_DX, cy: CY, radius: R, trueScale: true, maxAU: TRUE_AU_AT_R, rotate: MAP_ROTATION }
    : { cx: CX, cy: CY, radius: R, trueScale: false, rotate: MAP_ROTATION };
  // At true scale everything shrinks toward the middle, so the Sun's furniture
  // and the planet dots have to shrink with it or they swallow the inner system
  // whole. Positions stay exact; only the SYMBOLS get smaller, which is the same
  // fudge the compressed view already makes and is stated on screen.
  const sunK = trueScale ? 0.22 : 1;   // bigger than a dot, small enough that Venus outward stays clear of it
  const dotK = trueScale ? 0.42 : 1;
  // True scale carries no labels: they are what made the inner cluster
  // unreadable, and the side legend was a second answer to the same problem.
  // Point at a planet and it names itself.
  const [hover, setHover] = useState(null);
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
    <svg viewBox={`0 0 ${VBW} ${VBH}`} style={S.svg} role="img" aria-label="The solar system on the mission date">
      <defs>
        {/* THE SUN IN THREE LAYERS. It was one flat gold disc inside one flat
            gold glow, which read as a coin rather than as the only thing out
            here putting out light. A star is white-hot in the middle and the
            colour is in the air around it, so: a white core, a gold corona,
            and a wide soft haze that fades to nothing. */}
        <radialGradient id="sunCore">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="42%" stopColor="#FFF8E2" stopOpacity="1" />
          <stop offset="78%" stopColor="#FFD873" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#F2B441" stopOpacity="0.8" />
        </radialGradient>
        <radialGradient id="sunCorona">
          <stop offset="0%" stopColor="#FFF3CC" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#FFC957" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#F2B441" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sunHaze">
          <stop offset="0%" stopColor="#FFE39A" stopOpacity="0.30" />
          <stop offset="40%" stopColor="#F2B441" stopOpacity="0.13" />
          <stop offset="72%" stopColor="#F2B441" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#F2B441" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="band"><stop offset="0%" stopColor="#8FA6D8" stopOpacity="0.10" /><stop offset="100%" stopColor="#8FA6D8" stopOpacity="0" /></radialGradient>
      </defs>
      <Stars />
      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => (
        <path key={s.id} d={orbitPath(orbits[s.id], opts)} fill="none" stroke="#26324a" strokeWidth="1" strokeOpacity="0.26" />
      ))}
      {/* Doubled: the core and corona were a coin at this board size. The haze is
          scaled less than double on purpose — at 264 units it reached past Mars
          and washed the inner planets out, which is the opposite of the point. */}
      <circle cx={opts.cx} cy={opts.cy} r={186 * sunK} fill="url(#sunHaze)" />
      <circle cx={opts.cx} cy={opts.cy} r={80 * sunK} fill="url(#sunCorona)" />
      <circle cx={opts.cx} cy={opts.cy} r={26 * sunK} fill="url(#sunCore)" />
      {arc && <path d={arc} fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="5 6" strokeOpacity={transit ? 0.9 : 0.6} />}

      {/* THE MAP IS A CONTROL NOW, NOT A PICTURE. Space Trader's chart was how
          you navigated; ours was a diagram you looked at while reading a list.
          Click (or Enter/Space) a planet to go inside its system. Keyboard
          reachable because the map must not be mouse-only (project rule 4). */}
      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => {
        const pos = positions[s.id]; const { x, y, R: Rpx } = project(pos.r, pos.lon, opts);
        const here = s.id === hereSys, isDest = s.id === destSys;
        const r = dot(s.radiusKm, s.id === "pluto" ? 1.3 : 1) * dotK;
        const held = game.factions?.some((fx) => fx.system === s.id);
        const ports = (game.sites || []).filter((x) => x.system === s.id).length;
        const label = `${s.name}${ports ? `, ${ports} port${ports === 1 ? "" : "s"}` : ", no ports"}. Open this system.`;
        // TRUE SCALE CARRIES NO STANDING LABELS. The inner planets land within a
        // few pixels of each other out there, and every attempt at labelling
        // them in place failed the same way — stacked text over the Sun, then a
        // ring of leaders that turned "Mars" and "Venus" into "Marus", then a
        // side legend that was a whole second diagram. Pointing at one names it,
        // which is the only version that cannot collide with anything.
        const named = !trueScale || hover === s.id;
        return (
          <g key={s.id} role="button" tabIndex={0} aria-label={label} style={{ cursor: "pointer" }}
            onClick={() => onZoom(s.id)}
            onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover((h) => (h === s.id ? null : h))}
            onFocus={() => setHover(s.id)} onBlur={() => setHover((h) => (h === s.id ? null : h))}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onZoom(s.id); } }}>
            {/* A generous invisible target — the dots are as small as 4px, and at
                true scale they are smaller still. */}
            <circle cx={x} cy={y} r={Math.max(trueScale ? 13 : 20, r + 12)} fill="transparent" />
            {here && !transit && <circle cx={x} cy={y} r={r + 12} fill="none" stroke="#F2B441" strokeWidth="1.5" strokeDasharray="3 4" />}
            {isDest && <circle cx={x} cy={y} r={r + 9} fill="none" stroke="var(--gold)" strokeWidth="2" />}
            <circle cx={x} cy={y} r={r} fill={s.color} stroke="#070A12" strokeWidth="1.5" />
            {named && (
              <text x={x} y={y - r - 8} style={{ ...S.pin, fill: here || isDest ? "#fff" : "#B9C2D4" }}>
                {s.name}{here && !transit ? " — you" : ""}{held ? " ◆" : ""}
                {ports > 0 && <tspan style={{ fill: "var(--gold)" }}> ·{ports}</tspan>}
              </text>
            )}
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

// ---------------------------------------------------------------------------
// SYSTEM VIEW — inside one planet's system: its moons, and this run's ports.
//
// The orrery answers "where is everything"; this answers "what is actually
// HERE", which is the question a player asks when they click a planet. Moon
// orbital radii and periods are real (data/bodies.js); their PHASES are not yet
// epoch-anchored, which is flagged there and is why this view never claims a
// particular moon is at a particular place on a particular date — it shows the
// spacing and the sizes, which are the true parts.
//
// Radii are compressed logarithmically for the same reason the orrery is: drawn
// to scale, Phobos would be inside the planet dot and Iapetus off the board.
// ---------------------------------------------------------------------------
function SystemView({ game, systemId, dest, onPick, onBack }) {
  const sys = SYSTEM_BY_ID[systemId];
  const moons = MOONS[systemId] || [];
  const belt = systemId === "belt" ? BELT_BODIES : [];
  const sites = (game.sites || []).filter((s) => s.system === systemId);
  const hereId = game.player.at;

  // Every system gets its own sky. One field carried across every screen made
  // the zoom feel like the camera had not moved — you flew to Jupiter and found
  // the same stars in the same places.
  const sky = useMemo(() => skySeed(systemId), [systemId]);

  // THE BELT IS A BAND, NOT A BODY. It used to be three named rocks on three
  // concentric rings around a dot labelled "The Asteroid Belt", which read as a
  // large asteroid with three moons — exactly backwards. Nothing in the belt
  // orbits anything else; they all orbit the Sun, which is what sits at the
  // centre here. So the named rocks are scattered THROUGH a field of rubble
  // rather than ringed around a primary.
  const rubble = useMemo(
    () => (belt.length ? beltScatter({ seed: sky, rInner: 138, rOuter: 412, cx: CX, cy: CY }) : []),
    [belt.length, sky],
  );

  // One ring per body, log-compressed. Moon rings start well outside PLANET_RING
  // so a planet's own settlements never sit on top of its moons' orbits.
  // Far enough out that a wide site pin never reaches back over the primary or
  // its name. At 122 the Valles Marineris pin was touching Mars.
  const PLANET_RING = 168;
  const maxA = Math.max(...moons.map((m) => m.aKm), 1);
  const ringOf = (aKm) => (Math.log(1 + (aKm / maxA) / 0.12) / Math.log(1 + 1 / 0.12)) * 180 + 190;
  // Belt members sit at their REAL semi-major axes, mapped across the band, so
  // Vesta really is inside Ceres and Psyche really is outside it.
  const AU_IN = 2.1, AU_OUT = 3.3, BAND_IN = 165, BAND_OUT = 390;
  const beltRing = (au) =>
    BAND_IN + ((Math.min(AU_OUT, Math.max(AU_IN, au)) - AU_IN) / (AU_OUT - AU_IN)) * (BAND_OUT - BAND_IN);
  const bodies = belt.length
    ? belt.map((b) => ({ id: b.id, name: b.name, radiusKm: b.radiusKm, ring: beltRing(b.aAU), note: b.note }))
    : moons.map((m) => ({ id: m.id, name: m.name, radiusKm: m.radiusKm, ring: ringOf(m.aKm), note: m.note }));

  const angleFor = (i, n, startDeg = -90) => (startDeg + (360 / Math.max(n, 1)) * i) * (Math.PI / 180);

  // THE MOONS GO ROUND. They were pinned at fixed angles, so a system opened as
  // a still diagram while the solar map outside it was alive — and the moons are
  // the fastest-moving things in the game, which made standing still the worst
  // possible choice for them. moonLongitude() has been in orrery.js since the
  // first build, driven by each moon's REAL period from data/bodies.js: Phobos
  // laps Mars in 7.7 hours, Io laps Jupiter in 1.8 days, our Moon takes 27.3.
  //
  // The phase is honest about what it is. data/bodies.js flags that these are
  // not epoch-anchored — the SPEEDS and the spacing are real, which meridian
  // faces where on a given date is not — so this shows the rhythm without
  // claiming a position.
  const placed = bodies.map((b, i) => {
    const moon = moons.find((m) => m.id === b.id);
    const a = moon
      ? (moonLongitude(moon, new Date(game.t)) * Math.PI) / 180
      : angleFor(i, bodies.length);
    return { ...b, x: CX + b.ring * Math.cos(a), y: CY - b.ring * Math.sin(a), sites: sites.filter((s) => s.body === b.id) };
  });

  // Anything whose `body` is the primary itself — a surface settlement, or
  // something parked in orbit around it — rings the planet at its own radius.
  // Mars draws four of these, and at any tighter radius they sat on the planet.
  const atPlanet = sites.filter((s) => !bodies.some((b) => b.id === s.body));

  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} style={S.svg} role="img"
      aria-label={`${sys?.name}: ${bodies.length} charted bodies, ${sites.length} ports.`}>
      <defs>
        <radialGradient id="sysSunCore">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="55%" stopColor="#FFE7A6" stopOpacity="1" />
          <stop offset="100%" stopColor="#F2B441" stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id="sysSunHaze">
          <stop offset="0%" stopColor="#FFE39A" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#F2B441" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#F2B441" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Stars seed={sky} avoid={belt.length ? 0 : 90} />
      {/* The belt's rubble, drawn under everything else. Warm and stony rather
          than the blue-white of the stars behind it — at this size the only
          thing telling a rock from a star is its colour. */}
      {rubble.map((a, i) => (
        <circle key={i} cx={a.x} cy={a.y} r={a.size * 1.15} fill="#B39B7E" fillOpacity="0.7" />
      ))}
      {!belt.length && bodies.map((b) => (
        <circle key={b.id} cx={CX} cy={CY} r={b.ring} fill="none" stroke="#26324a" strokeOpacity="0.55" />
      ))}
      {systemId === "saturn" && (
        <ellipse cx={CX} cy={CY} rx={78} ry={78} fill="none" stroke="#D8C08A" strokeOpacity="0.3" strokeWidth={26} />
      )}

      {/* The primary, and anything sitting on or above it. In the belt the
          primary is the SUN — nothing out there orbits anything else. */}
      {belt.length ? (
        <g>
          <circle cx={CX} cy={CY} r="74" fill="url(#sysSunHaze)" />
          <circle cx={CX} cy={CY} r="11" fill="url(#sysSunCore)" />
          <text x={CX} y={CY + 32} style={{ ...S.pin, fill: "#9FAAC2", fontSize: 12 }}>the Sun</text>
        </g>
      ) : (
        <g>
          <circle cx={CX} cy={CY} r={40} fill={sys?.color || "#9AA6B8"} stroke="#070A12" strokeWidth="2" />
          {/* The primary's name goes ABOVE it. Below is where the ring of site
              pins lands (PLANET_RING = 122), and "Mars" was being sat on by
              whichever settlement happened to be drawn at the bottom. */}
          <text x={CX} y={CY - 52} style={{ ...S.pin, fill: "#fff", fontSize: 16 }}>{sys?.name}</text>
        </g>
      )}
      {/* Ports on the primary itself start at the BOTTOM of their ring, so the
          first one never lands under the planet's name at the top. */}
      {atPlanet.map((s, i) => {
        const a = angleFor(i, atPlanet.length, 90);
        const x = CX + PLANET_RING * Math.cos(a), y = CY + PLANET_RING * Math.sin(a);
        return <SitePin key={s.id} site={s} x={x} y={y} here={s.id === hereId} sel={dest === s.id} onPick={onPick} />;
      })}

      {placed.map((b) => (
        <g key={b.id}>
          <circle cx={b.x} cy={b.y} r={Math.max(6, dot(b.radiusKm, 1.6))} fill="#C9CFDC" stroke="#070A12" strokeWidth="1.5" />
          <text x={b.x} y={b.y - Math.max(6, dot(b.radiusKm, 1.6)) - 9} style={{ ...S.pin, fill: "#B9C2D4" }}>{b.name}</text>
          {/* Stacked downward, never spread sideways: a body sitting near the
              right-hand edge would push a 108px-wide pin off the board. */}
          {b.sites.map((s, i) => (
            <SitePin key={s.id} site={s} x={b.x} y={b.y + 30 + i * 30}
              here={s.id === hereId} sel={dest === s.id} onPick={onPick} />
          ))}
        </g>
      ))}

      {sites.length === 0 && (
        <text x={CX} y={CY + 150} style={{ ...S.pin, fill: "var(--muted)", fontSize: 14 }}>
          Nobody has built anything here this run.
        </text>
      )}
      <g role="button" tabIndex={0} aria-label="Back to the solar system" style={{ cursor: "pointer" }}
        onClick={onBack} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack(); } }}>
        <rect x="24" y="24" width="184" height="40" rx="10" fill="var(--panel-2)" stroke="var(--line)" />
        <text x="116" y="50" style={{ ...S.pin, fill: "#CDD5E4", fontSize: 14 }}>← Solar system (Esc)</text>
      </g>
    </svg>
  );
}

/** A port on the system map. Clicking one selects it as your destination and
 *  opens the course plotter — the map picks the trip, the panel prices it. */
function SitePin({ site, x, y, here, sel, onPick }) {
  // THE PIN FITS THE NAME, rather than the name being cut to fit the pin. It was
  // a fixed 108 units wide with everything past fourteen characters replaced by
  // an ellipsis, which turned "Tranquillitatis lava tube Archive" and "Sunward
  // Watch (Sun-Earth L1) Post" into the same unreadable stub.
  //
  // SVG cannot measure text without rendering it, so the width is estimated from
  // the character count. 5.9 units per character at 11px is a little generous
  // for this typeface, which is the right direction to be wrong in: a pin
  // slightly too wide looks deliberate, one slightly too narrow clips.
  const label = `${here ? "⚓ " : ""}${site.name}`;
  const h = 26;
  const w = Math.max(96, label.length * 5.9 + 20);
  // And it is kept inside the frame: a long name on a body near the edge would
  // otherwise hang off the board entirely.
  const cx = Math.min(VBW - w / 2 - 8, Math.max(w / 2 + 8, x));
  return (
    <g role="button" tabIndex={0} style={{ cursor: "pointer" }}
      aria-label={`${site.name}${here ? ", where you are docked" : ""}. Plot a course.`}
      onClick={() => onPick(site.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(site.id); } }}>
      <rect x={cx - w / 2} y={y - h / 2} width={w} height={h} rx={7}
        fill={here ? "rgba(242,180,65,0.18)" : "var(--panel-2)"}
        stroke={here ? "var(--gold)" : sel ? "var(--gold)" : "var(--line)"} strokeWidth={sel || here ? 2 : 1} />
      <text x={cx} y={y + 4} style={{ ...S.pin, fill: here ? "var(--gold)" : "#CDD5E4", fontSize: 11 }}>
        {label}
      </text>
    </g>
  );
}

/**
 * THE PAUSE MENU. "Menu" used to mean "abandon this and go back to the title",
 * one click from the player's thumb with no confirmation — which is a strange
 * thing to make the easiest button on the screen.
 *
 * It stops the world instead (the clock reads `paused`), and offers the four
 * things a player actually wants mid-run plus the way out. Escape or Resume
 * closes it.
 *
 * DIFFICULTY IS HERE AND IS NOT WIRED TO ANYTHING, and the screen says so.
 * design.md §12 explicitly declined difficulty settings — "our difficulty is the
 * rocket equation and the faction draw" — so this stores a choice and changes
 * nothing until that decision is revisited. A control that quietly did nothing
 * would be worse than one that admits it.
 */
const DIFFICULTIES = ["Forgiving", "Standard", "Unforgiving"];

function PauseMenu({ game, setGame, audio, onResume, onQuit, onSave, onToggleAudio }) {
  const diff = game.difficulty || "Standard";
  const cycle = () => setGame((g) => ({
    ...g,
    difficulty: DIFFICULTIES[(DIFFICULTIES.indexOf(g.difficulty || "Standard") + 1) % DIFFICULTIES.length],
  }));
  return (
    <div style={S.modalWrap} role="dialog" aria-modal="true" aria-label="Game paused"
      onClick={(e) => { if (e.target === e.currentTarget) onResume(); }}>
      <div style={S.modal}>
        <div style={S.modalTitle}>Paused</div>
        <div style={S.modalSub}>{game.player.name} · {fmtDate(game.t)}</div>

        <button style={S.modalPrimary} onClick={onResume}>Resume</button>
        <button style={S.modalBtn} onClick={onSave}>Save game to a file</button>
        <button style={S.modalBtn} onClick={onToggleAudio}>
          Music <span style={S.modalVal}>{audio?.on ? "on" : "off"}</span>
        </button>
        <button style={S.modalBtn} onClick={cycle}>
          Difficulty <span style={S.modalVal}>{diff}</span>
        </button>
        <button style={{ ...S.modalBtn, ...S.modalQuit }} onClick={onQuit}>Return to main menu</button>

        <div style={S.modalNote}>
          The game autosaves on its own; the file is the copy that survives a cleared
          cache. Difficulty is stored but not yet wired to anything.
        </div>
      </div>
    </div>
  );
}

function Toast({ toast, onDone }) {
  useEffect(() => { const id = setTimeout(onDone, 4200); return () => clearTimeout(id); }, [toast]);
  return <div style={{ ...S.toast, borderColor: toast.kind === "bad" ? "var(--hot)" : "var(--gold)" }}>{toast.text}</div>;
}

const S = {
  app: { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" },
  hud: { display: "flex", alignItems: "center", gap: 16, padding: "10px 18px", borderBottom: "1px solid var(--line)", background: "var(--panel)" },
  homeBtn: { textDecoration: "none", color: "var(--muted)", fontSize: 18, border: "1px solid var(--line)", borderRadius: 8, padding: "3px 10px", background: "var(--panel-2)", cursor: "pointer" },
  musicWrap: { position: "relative" },
  musicPop: { position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 8px 26px rgba(0,0,0,0.5)" },
  musicCue: { fontSize: 11, color: "var(--gold)", whiteSpace: "nowrap", letterSpacing: 0.4 },
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
  stage: { flex: 1, minWidth: 0, display: "flex", position: "relative" },
  scaleWrap: { position: "absolute", left: 18, bottom: 16, maxWidth: 340, display: "flex", flexDirection: "column", gap: 7, pointerEvents: "none" },
  // Border split into its three longhands, not the shorthand: the "on" state
  // overrides only borderColor, and React warns (rightly) that mixing shorthand
  // with longhand on a rerender can drop the other properties. Same pattern the
  // rest of this stylesheet already uses.
  scaleBtn: { alignSelf: "flex-start", background: "var(--panel-2)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "var(--muted)", pointerEvents: "auto" },
  scaleBtnOn: { borderColor: "var(--gold)", color: "var(--gold)" },
  scaleNote: { fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, fontStyle: "italic" },
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
  deadToggle: { width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 10px 2px", cursor: "pointer", color: "var(--muted)", fontSize: 11.5 },
  foldHead: { width: "100%", textAlign: "left", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 11px", cursor: "pointer", color: "var(--muted)", fontSize: 12.5 },
  // The one line that answers "what am I supposed to be doing". Deliberately
  // the brightest non-price thing on the screen.
  nextStep: { margin: "2px 18px 12px", padding: "10px 12px", background: "rgba(242,180,65,0.08)", border: "1px solid rgba(242,180,65,0.3)", borderRadius: 9, fontSize: 12.5, lineHeight: 1.55, color: "#E8EDF6" },
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
  modalWrap: { position: "fixed", inset: 0, background: "rgba(4,7,14,0.72)", display: "grid", placeItems: "center", zIndex: 60 },
  modal: { width: 340, background: "var(--panel)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 14, padding: "22px 22px 18px", display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.65)" },
  modalTitle: { fontSize: 20, fontWeight: 700, textAlign: "center" },
  modalSub: { fontSize: 12, color: "var(--muted)", textAlign: "center", marginBottom: 10 },
  modalPrimary: { width: "100%", background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 9, padding: "11px", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  modalBtn: { width: "100%", background: "var(--panel-2)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 9, padding: "10px", cursor: "pointer", color: "var(--text)", fontSize: 13.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  modalVal: { color: "var(--gold)", fontSize: 12.5 },
  modalQuit: { color: "var(--hot)", marginTop: 6 },
  modalNote: { fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginTop: 8, textAlign: "center" },
  toast: { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "var(--panel)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--gold)", borderRadius: 10, padding: "11px 18px", fontSize: 13.5, zIndex: 40, maxWidth: 560, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" },
};
