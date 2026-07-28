// ===========================================================================
// THE STUDIO CARD — the first thing anyone sees.
//
// Black, then the mark fades up over a second, holds for two, and fades back to
// black over two more. Then the title menu comes up out of the dark.
//
// TWO THINGS THAT MATTER MORE THAN THE ANIMATION:
//
//   IT IS SKIPPABLE. A five-second unskippable card is charming once and an
//   obstacle every time after — and during development this screen gets loaded
//   dozens of times an hour. Any key, any click, any tap ends it immediately.
//
//   IT RESPECTS prefers-reduced-motion. Someone who has asked their system for
//   less movement gets the card held still and short rather than a sequence of
//   fades. The card still shows, because it is information, not decoration.
//
// The timings live here as data so they can be tuned without reading the
// component, and the whole thing is one <img> and one opacity transition — no
// animation library, no keyframes, nothing to go wrong on a slow machine.
// ===========================================================================

import { useEffect, useRef, useState } from "react";

export const FADE_IN_MS = 1000;
export const HOLD_MS = 2000;
export const FADE_OUT_MS = 2000;
export const TOTAL_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;

/** The reduced-motion path: show it, hold it, move on. No fades. */
const REDUCED_MS = 1600;

export default function Intro({ onDone }) {
  const [opacity, setOpacity] = useState(0);
  const [fade, setFade] = useState(FADE_IN_MS);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const timers = [];
    if (reduced) {
      setFade(0);
      setOpacity(1);
      timers.push(setTimeout(finish, REDUCED_MS));
    } else {
      // A frame's delay before raising opacity, or the browser has nothing to
      // transition FROM and the mark simply appears.
      timers.push(setTimeout(() => setOpacity(1), 30));
      timers.push(setTimeout(() => { setFade(FADE_OUT_MS); setOpacity(0); }, FADE_IN_MS + HOLD_MS));
      timers.push(setTimeout(finish, TOTAL_MS));
    }

    // Skippable by anything at all.
    const skip = () => finish();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  return (
    <div style={S.wrap} role="img" aria-label="Lotus Creative Studios">
      <img
        src={`${import.meta.env.BASE_URL}lotus-logo.png`}
        alt=""
        style={{ ...S.mark, opacity, transition: `opacity ${fade}ms ease-in-out` }}
      />
      <div style={S.skip}>press anything to skip</div>
    </div>
  );
}

const S = {
  // Pure black, not the game's --bg: this is a studio card, and it should read
  // as the lights being off rather than as a screen of the game.
  wrap: {
    position: "fixed", inset: 0, background: "#000", zIndex: 100,
    display: "grid", placeItems: "center", cursor: "pointer",
  },
  mark: { width: "min(52vw, 460px)", height: "auto", display: "block" },
  skip: {
    position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center",
    fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "#2A2A2A",
  },
};
