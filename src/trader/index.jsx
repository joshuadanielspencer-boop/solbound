// ===========================================================================
// THE TRADE GAME — top level. Captain creation, then the play loop.
//
// Holds the one piece of state everything else reads: the game value. Creation
// makes a captain and a fresh game; play mutates it through the pure functions
// in tradergame.js. When save/load lands, it hangs here.
// ===========================================================================
import { useState } from "react";
import CreateCaptain from "./create.jsx";
import Play from "./play.jsx";
import { newPlayer } from "../player.js";
import { newGame } from "../tradergame.js";

export default function Trader() {
  const [game, setGame] = useState(null);

  if (!game) {
    return (
      <CreateCaptain onBegin={({ name, skills }) => {
        setGame(newGame(newPlayer({ name, skills })));
      }} />
    );
  }

  return <Play game={game} setGame={setGame} onQuit={() => setGame(null)} />;
}
