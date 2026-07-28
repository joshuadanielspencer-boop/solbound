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
import { saveToSlot, loadSlot, deleteSlot, listSaves, nextFreeSlot } from "../save.js";
import { createMusic, loadAudioPref } from "../audio.js";
import { SfxProvider } from "./sfx.jsx";
import Saves from "./saves.jsx";

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
  // "intro" | "splash" | "saves" | "create" | "play"
  //
  // `saves` is new: the front door no longer resumes THE save, it opens the list
  // of runs and you pick one. See src/trader/saves.jsx for why one autosave was
  // the wrong shape for a game with two victory conditions and a seed worth
  // keeping.
  const [phase, setPhase] = useState("intro");
  const [game, setGame] = useState(null);
  // Which slot the open game belongs to. Every autosave goes here, so two runs
  // can never write over each other — the bug this whole change exists to make
  // impossible.
  const [slot, setSlot] = useState(null);
  const [saveCount, setSaveCount] = useState(() => listSaves().length);

  // Autosave when something worth keeping changes — an arrival, a trade, a
  // launch, a refuel — but NOT on every clock tick (see saveSig). The stamp is
  // Date.now() here at the UI edge, never inside the sim, which stays clock-free
  // so replays are deterministic.
  //
  // DEBOUNCED, because the clock drifts in port as well as in flight and the
  // signature includes the docked date (so a deliberate wait is never silently
  // undone). Without a debounce that is a ~30 KB localStorage write every time
  // the date rolls over, for as long as anyone leaves the game open.
  //
  // ⚠ AND THE DEBOUNCE WAS BROKEN, WHICH MEANT THE GAME WAS NOT AUTOSAVING.
  // Found 2026-07-28 by starting a second run and watching its slot stay empty.
  //
  // The effect used to depend on `game`. The port clock ticks ten times a second
  // and hands back a NEW game object every tick, so the effect re-ran ten times
  // a second, and React runs the previous cleanup before each re-run — which
  // cleared the pending timeout. A two-second timer that is cancelled every
  // hundred milliseconds never fires. In transit it is worse: that clock ticks
  // at 33 ms. The save only ever landed in the moments the clock was stopped —
  // an encounter, the pause menu — which is why it looked like it worked.
  //
  // It became broken rather than being written broken: the debounce was correct
  // when the dock clock still had a hold button, and removing that button (so a
  // static orrery could never be chosen) quietly took the quiet periods with it.
  //
  // The fix is to depend on the SIGNATURE, not on the game. The signature only
  // changes when something worth saving changes, so the timer now survives long
  // enough to fire. The game itself is read through a ref at write time, so what
  // lands is the latest state rather than the state as it was two seconds ago.
  const gameRef = useRef(game);
  gameRef.current = game;
  const saveKey = phase === "play" && game && !game.over ? saveSig(game) : null;
  useEffect(() => {
    if (!saveKey || !slot) return;
    const id = setTimeout(() => {
      if (saveToSlot(gameRef.current, slot, Date.now())) setSaveCount(listSaves().length);
    }, 2000);
    return () => clearTimeout(id);
  }, [saveKey, slot]);

  // A run that ended is not resumable — leaving it in its slot would make the
  // list offer to reopen a wreck. The player still sees the ending in this
  // session; the slot frees up for the next run.
  useEffect(() => {
    if (phase !== "play" || !game?.over || !slot) return;
    deleteSlot(slot);
    setSaveCount(listSaves().length);
  }, [phase, game?.over, slot]);

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

  // A new run claims a slot BEFORE the captain is named, so the autosave has
  // somewhere to go the moment the game starts. `into` comes from the runs
  // screen, which knows which places are free; the splash's New game button
  // takes the lowest free one and falls back to the list when all are taken.
  const startNew = (into = null) => {
    const target = into ?? nextFreeSlot();
    if (!target) { setPhase("saves"); return; }
    setSlot(target);
    setPhase("create");
  };

  const beginCaptain = ({ name, skills }) => {
    const seed = (Date.now() % 100000) | 0;
    setGame(newGame(newPlayer({ name, skills }), seed));
    setPhase("play");
  };

  const resume = (which) => {
    const save = loadSlot(which);
    if (!save) return;
    setSlot(which);
    setGame(save.state);
    setPhase("play");
  };

  const removeRun = (which) => {
    deleteSlot(which);
    setSaveCount(listSaves().length);
  };

  // A file import is a run in its own right, so it takes its own slot rather
  // than landing on top of whatever was open.
  const importSave = (state) => {
    const target = nextFreeSlot();
    if (!target) { setPhase("saves"); return; }
    setSlot(target);
    setGame(state);
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
    if (phase === "saves") {
      return (
        <Splash chrome onNew={startNew} hasSave={saveCount > 0} onContinue={() => setPhase("saves")}
          onImported={importSave} audio={audio} onToggleAudio={toggleAudio}>
          <Saves onResume={resume} onNew={startNew} onDelete={removeRun}
            onBack={() => setPhase("splash")} />
        </Splash>
      );
    }
    // The menu has music too — "dock" is the calm set, which is what a title
    // screen wants.
    return (
      <Splash onNew={() => startNew()} hasSave={saveCount > 0} onContinue={() => setPhase("saves")}
        onImported={importSave}
        audio={audio} onToggleAudio={toggleAudio} />
    );
  };

  return <SfxProvider value={playSfx}>{screen()}</SfxProvider>;
}
