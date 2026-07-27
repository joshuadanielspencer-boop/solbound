// ===========================================================================
// THE TRADE GAME — top level. Splash → captain creation → the play loop.
//
// Holds the one piece of state everything reads: the game value, plus the
// save/load wiring around it. Autosave fires whenever the world materially
// changes (an arrival, a trade), so a refresh never costs more than the current
// leg; Continue resumes it; and the whole game can be exported to / imported
// from a file, which survives a cleared cache and moves between machines.
// ===========================================================================
import { useEffect, useRef, useState } from "react";
import Splash from "./splash.jsx";
import CreateCaptain from "./create.jsx";
import Play from "./play.jsx";
import { newPlayer } from "../player.js";
import { newGame } from "../tradergame.js";
import { cargoUsed } from "../player.js";
import { autosave, loadAutosave, hasSave, clearSave } from "../save.js";

// A cheap fingerprint of the things worth persisting. The clock changes `t` and
// the markets ~30 times a second while flying; those must NOT trigger a save, or
// we'd batter localStorage. Everything a player would hate to lose — where they
// are, their money, their cargo, the current leg — is in here, and none of it
// changes on a mere tick.
//
// The DATE is in here only while docked. In transit the clock moves it ~30 times
// a second and it must not trigger a save; docked, the only thing that moves it
// is the wait button — and waiting ninety days with no crew aboard changes
// nothing else in this fingerprint, so a refresh silently undid the wait.
const saveSig = (g) =>
  `${g.status}|${g.player.at}|${Math.round(g.player.credits)}|${g.leg?.to || ""}|${cargoUsed(g.player)}`
  + `|${g.player.ship.fuelTonnes.toFixed(1)}|${g.status === "docked" ? Math.round(g.t / 86400000) : ""}`;

export default function Trader() {
  const [phase, setPhase] = useState("splash");   // "splash" | "create" | "play"
  const [game, setGame] = useState(null);
  const [saveExists, setSaveExists] = useState(() => hasSave());

  // Autosave when something worth keeping changes — an arrival, a trade, a
  // launch, a refuel — but NOT on every clock tick (see saveSig). The stamp is
  // Date.now() here at the UI edge, never inside the sim, which stays clock-free
  // so replays are deterministic.
  //
  // DEBOUNCED, because the clock now drifts in port as well as in flight. The
  // signature includes the docked date (so a wait is never silently undone), and
  // at a day a second that is a fresh signature every second — which without
  // this would be a ~30 KB localStorage write per second for as long as anyone
  // left the game open. Two seconds of quiet is the trigger; a real change (a
  // trade, a launch) is followed by quiet almost immediately, so nothing that
  // matters waits long, and closing the tab mid-drift costs at most two seconds
  // of drift.
  const lastSig = useRef(null);
  useEffect(() => {
    if (phase !== "play" || !game) return;
    // A run that ended is not resumable — leaving it in the autosave would make
    // Continue reopen a wreck. The player still sees the ending in this session.
    if (game.over) { clearSave(); setSaveExists(false); return; }
    const sig = saveSig(game);
    if (sig === lastSig.current) return;      // only a sub-day tick happened; skip
    const id = setTimeout(() => {
      lastSig.current = sig;
      if (autosave(game, Date.now())) setSaveExists(true);
    }, 2000);
    return () => clearTimeout(id);
  }, [game, phase]);

  const startNew = () => { clearSave(); setSaveExists(false); setPhase("create"); };

  const beginCaptain = ({ name, skills }) => {
    const seed = (Date.now() % 100000) | 0;
    setGame(newGame(newPlayer({ name, skills }), seed));
    setPhase("play");
  };

  const resume = () => {
    const save = loadAutosave();
    if (!save) return;
    setGame(save.state);
    setPhase("play");
  };

  if (phase === "play" && game) {
    return <Play game={game} setGame={setGame} onQuit={() => setPhase("splash")} />;
  }
  if (phase === "create") {
    return <CreateCaptain onBegin={beginCaptain} onBack={() => setPhase("splash")} />;
  }
  return <Splash onNew={startNew} hasSave={saveExists} onContinue={resume} onImported={(g) => { setGame(g); setPhase("play"); }} />;
}
