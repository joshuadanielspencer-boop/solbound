// ===========================================================================
// THE TRADE GAME — top level. Splash → captain creation → the play loop.
//
// Holds the one piece of state everything reads: the game value, plus the
// save/load wiring around it. Autosave fires whenever the world materially
// changes (an arrival, a trade), so a refresh never costs more than the current
// leg; Continue resumes it; and the whole game can be exported to / imported
// from a file, which survives a cleared cache and moves between machines.
// ===========================================================================
import { useCallback, useEffect, useRef, useState } from "react";
import Intro from "./intro.jsx";
import Splash from "./splash.jsx";
import CreateCaptain from "./create.jsx";
import Play from "./play.jsx";
import { newPlayer } from "../player.js";
import { newGame } from "../tradergame.js";
import { cargoUsed } from "../player.js";
import { autosave, loadAutosave, hasSave, clearSave } from "../save.js";
import { createMusic, loadAudioPref } from "../audio.js";
import { SfxProvider } from "./sfx.jsx";

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
  const [phase, setPhase] = useState("intro");   // "intro" | "splash" | "create" | "play"
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

  // ---- the soundtrack, for the whole application ---------------------------
  // It used to be created inside Play, which meant it started when a game did
  // and the menu was silent. Owning it here lets one engine span intro → menu →
  // game, so the music carries across a New Game rather than stopping and
  // restarting. Play still decides WHICH cue by reporting where the player is.
  const music = useRef(null);
  const [audio, setAudio] = useState(() => loadAudioPref());
  const [cue, setCue] = useState(null);
  const audioPref = useRef(audio);
  audioPref.current = audio;
  useEffect(() => {
    const m = createMusic();
    music.current = m;
    const off = m.onChange(() => setCue(m.nowPlaying()));
    // Browsers will not let a page make noise before a real gesture, and they
    // are right to. The intro card is skippable by any click or key, so the
    // gesture that dismisses it is usually the one that starts the music.
    const wake = () => { if (audioPref.current.on) { m.start(); setCue(m.nowPlaying()); } };
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      off(); m.dispose(); music.current = null;
    };
  }, []);

  const toggleAudio = useCallback(() => {
    setAudio((a) => {
      const next = { ...a, on: !a.on };
      music.current?.setOn(next.on);
      if (next.on) { music.current?.start(); setCue(music.current?.nowPlaying()); }
      return next;
    });
  }, []);
  const setAudioLevel = useCallback((level) => {
    setAudio((a) => { music.current?.setLevel(level); return { ...a, level }; });
  }, []);
  const setMusicContext = useCallback((c) => music.current?.setContext(c), []);
  // Sound effects go out on their own bus (see audio.js) and are handed to the
  // whole tree through a context, because the things that want to make a noise
  // are leaves — a market row, a back arrow — and prop-drilling to all of them
  // would touch every signature in the panel tree.
  const playSfx = useCallback((id) => music.current?.playSfx(id) ?? false, []);
  const toggleSfx = useCallback(() => {
    setAudio((a) => { const next = { ...a, sfxOn: !a.sfxOn }; music.current?.setSfxOn(next.sfxOn); return next; });
  }, []);
  const setSfxLevel = useCallback((level) => {
    setAudio((a) => { music.current?.setSfxLevel(level); return { ...a, sfxLevel: level }; });
  }, []);

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

  const screen = () => {
    if (phase === "intro") return <Intro onDone={() => setPhase("splash")} />;
    if (phase === "play" && game) {
      return (
        <Play game={game} setGame={setGame} onQuit={() => setPhase("splash")}
          audio={audio} cue={cue} onToggleAudio={toggleAudio} onAudioLevel={setAudioLevel}
          onToggleSfx={toggleSfx} onSfxLevel={setSfxLevel}
          onSetContext={setMusicContext} />
      );
    }
    if (phase === "create") {
      return <CreateCaptain onBegin={beginCaptain} onBack={() => setPhase("splash")} />;
    }
    // The menu has music too — "dock" is the calm set, which is what a title
    // screen wants.
    return (
      <Splash onNew={startNew} hasSave={saveExists} onContinue={resume}
        onImported={(g) => { setGame(g); setPhase("play"); }}
        audio={audio} onToggleAudio={toggleAudio} />
    );
  };

  return <SfxProvider value={playSfx}>{screen()}</SfxProvider>;
}
