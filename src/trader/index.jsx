// ===========================================================================
// THE TRADE GAME — top level. Splash → captain creation → the play loop.
//
// Holds the one piece of state everything reads: the game value. Splash is the
// front door; New Game runs creation, which makes a captain and a fresh
// (seeded, faction-spawned) game; play mutates it through the pure functions in
// tradergame.js. Save/load hangs here when it lands — `hasSave`/`onContinue`
// are stubbed so the menu already shows the shape.
// ===========================================================================
import { useState } from "react";
import Splash from "./splash.jsx";
import CreateCaptain from "./create.jsx";
import Play from "./play.jsx";
import { newPlayer } from "../player.js";
import { newGame } from "../tradergame.js";

export default function Trader() {
  const [phase, setPhase] = useState("splash");   // "splash" | "create" | "play"
  const [game, setGame] = useState(null);

  if (phase === "play" && game) {
    return <Play game={game} setGame={setGame} onQuit={() => setPhase("splash")} />;
  }
  if (phase === "create") {
    return (
      <CreateCaptain onBegin={({ name, skills }) => {
        // Seed the run from the clock so each new game rolls a different world;
        // deterministic replay still works from the stored seed once save/load
        // exists.
        const seed = (Date.now() % 100000) | 0;
        setGame(newGame(newPlayer({ name, skills }), seed));
        setPhase("play");
      }} />
    );
  }
  return (
    <Splash
      onNew={() => setPhase("create")}
      hasSave={false}
      onContinue={() => { if (game) setPhase("play"); }}
    />
  );
}
