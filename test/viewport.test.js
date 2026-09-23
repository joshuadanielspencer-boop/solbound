// @vitest-environment jsdom
// ===========================================================================
// THE TWO THINGS THE BROWSER TELLS US ABOUT THE PERSON PLAYING — how wide their
// window is, and whether they have asked for less movement. Both were being
// ignored, and both are cheap to get wrong again, so both are pinned here.
//
// WHY A SEPARATE FILE FROM ui.smoke.test.js. That file asserts the game mounts
// and every screen opens; it deliberately runs in one fixed environment. These
// tests change the environment out from under the app, which is exactly the
// thing a smoke test should not be doing to itself.
// ===========================================================================
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";

import App from "../src/app.jsx";
import Play from "../src/trader/play.jsx";
import { SfxProvider } from "../src/trader/sfx.jsx";
import { newGame } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { MAX_SLOTS, deleteSlot } from "../src/save.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const act = React.act;

let container = null, root = null, errors = [], realError = null;

beforeEach(() => {
  errors = [];
  realError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(" ")); };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  for (let i = 1; i <= MAX_SLOTS; i++) deleteSlot(i);
  window.location.hash = "";
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  console.error = realError;
  vi.useRealTimers();
});

const text = () => container.textContent || "";
const buttons = () => [...container.querySelectorAll("button")];
const byText = (re) => buttons().find((b) => re.test(b.textContent || ""));
const click = (el) => { act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };
const expectQuiet = () => expect(errors.join("\n---\n")).toBe("");

/** The studio card fronts the game and is pure image — skip it as a player does. */
const skipStudioCard = () =>
  act(() => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a" })); });

/** jsdom lets us set innerWidth; the app only ever reads it and the resize event. */
function setWidth(px) {
  act(() => {
    window.innerWidth = px;
    window.dispatchEvent(new window.Event("resize"));
  });
}

/**
 * jsdom has no matchMedia at all, so the app's optional chaining is what keeps
 * the default path alive. Installing one lets us answer the reduced-motion
 * query either way.
 */
function setReducedMotion(on) {
  window.matchMedia = (query) => ({
    matches: on && /prefers-reduced-motion:\s*reduce/.test(query),
    media: query,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
}

// ---------------------------------------------------------------------------
// The window has to be wide enough
// ---------------------------------------------------------------------------

describe("a window too narrow for the game", () => {
  it("covers a phone-width window with the desktop notice", () => {
    window.innerWidth = 375;
    act(() => root.render(React.createElement(App)));
    expect(text()).toContain("needs a desktop window");
    // It is an OVERLAY: a modal dialog laid over the game, which stays mounted
    // underneath so that crossing the threshold does not restart the session.
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expectQuiet();
  });

  it("shows the game at desktop width", () => {
    window.innerWidth = 1280;
    act(() => root.render(React.createElement(App)));
    skipStudioCard();
    expect(text()).not.toContain("needs a desktop window");
    expect(text()).toContain("New game");
    expectQuiet();
  });

  it("tells rather than forbids — 'show it anyway' gets you in", () => {
    window.innerWidth = 375;
    act(() => root.render(React.createElement(App)));
    click(byText(/Show it anyway/));
    skipStudioCard();
    expect(text()).toContain("New game");
    expectQuiet();
  });

  it("follows the window when it is resized across the threshold", () => {
    window.innerWidth = 1280;
    act(() => root.render(React.createElement(App)));
    skipStudioCard();
    expect(text()).toContain("New game");

    setWidth(600);
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();

    // AND BACK. The studio card is NOT skipped a second time here on purpose —
    // if this passes without it, the game was never unmounted, which is the
    // whole point of the overlay.
    setWidth(1280);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(text()).toContain("New game");
    expectQuiet();
  });
});

// ---------------------------------------------------------------------------
// Reduced motion reaches the orrery, which CSS never could
// ---------------------------------------------------------------------------

const audio = { on: false, level: 0.5, sfxOn: false, sfxLevel: 0.7 };
const noop = () => {};

function playScreen(game, setGame = noop) {
  return React.createElement(
    SfxProvider, { value: () => false },
    React.createElement(Play, {
      game, setGame, onQuit: noop, audio, cue: null,
      onToggleAudio: noop, onAudioLevel: noop, onToggleSfx: noop, onSfxLevel: noop,
      onSetContext: noop,
    }),
  );
}

/**
 * Advance in slices with React re-rendering between them — a single big jump
 * fires every interval callback in one batch and flushes once, which is not
 * what a browser does. ui.smoke.test.js has the long version of this note.
 */
async function tick(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await vi.advanceTimersByTimeAsync(step); });
  }
}

/** Drive the real clock loop and report how far the world's date moved. */
async function daysAdvancedOverSeconds(seconds) {
  let game = newGame(newPlayer({ name: "Motion" }), 42);
  const t0 = game.t;
  const setGame = (fn) => {
    game = typeof fn === "function" ? fn(game) : fn;
    act(() => root.render(playScreen(game, setGame)));
  };
  act(() => root.render(playScreen(game, setGame)));
  await tick(seconds * 1000);
  return (game.t - t0) / 86400000;
}

describe("prefers-reduced-motion holds the clock in port", () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });

  it("lets the world turn over for a player who has not asked for less motion", async () => {
    setReducedMotion(false);
    const days = await daysAdvancedOverSeconds(3);
    // DOCK_RATE is a third of a day per second, so three seconds is about a day.
    // Asserting "it moved at all" is the point; the exact figure is timing slop.
    expect(days).toBeGreaterThan(0.2);
  });

  it("holds the date still for a player who has", async () => {
    setReducedMotion(true);
    const days = await daysAdvancedOverSeconds(3);
    expect(days).toBe(0);
  });

  it("says so, and offers to let it run", async () => {
    setReducedMotion(true);
    const game = newGame(newPlayer({ name: "Motion" }), 42);
    act(() => root.render(playScreen(game)));
    expect(text()).toContain("Time held");
    expect(byText(/let it run/)).toBeTruthy();
    expectQuiet();
  });

  it("does not nag a player who has not asked for it", () => {
    setReducedMotion(false);
    const game = newGame(newPlayer({ name: "Motion" }), 42);
    act(() => root.render(playScreen(game)));
    expect(text()).not.toContain("Time held");
    expectQuiet();
  });
});
