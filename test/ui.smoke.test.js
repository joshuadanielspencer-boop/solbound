// @vitest-environment jsdom
// ===========================================================================
// UI SMOKE TEST — does every screen open, and does the game still save?
//
// WHY THIS FILE EXISTS, and it is the least theoretical reason in the project:
// 493 tests were passing and the game had two bugs that a player would hit in
// the first ten minutes, because nothing had ever OPENED A SCREEN.
//
//   • 2026-07-27 — the Ship Yard crashed on every open, from the moment crew
//     landed, because play.jsx passed `crewForHire` a site id where it wanted
//     the site. Found by clicking the tab.
//   • 2026-07-28 — the autosave never fired. The debounce depended on `game`,
//     the port clock hands back a new game object ten times a second, and React
//     clears a pending effect timer on every re-run. Found by starting a second
//     run and watching its slot stay empty.
//
// Both are invisible to a unit test of the simulation and obvious to anything
// that mounts the thing. So this mounts the thing.
//
// WHAT IT IS AND IS NOT. It is a smoke test: it asserts that screens render, that
// the obvious paths through them do not throw, and that the two known regressions
// stay fixed. It is not a snapshot suite — pinning markup would fight every
// layout change, and layout changes here are the point. It asserts BEHAVIOUR and
// SILENCE: nothing thrown, and nothing written to console.error, which is where
// React reports the NaN-attribute and key-order classes of bug that otherwise
// only show up as something looking slightly wrong.
// ===========================================================================
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";

import Play from "../src/trader/play.jsx";
import Trader from "../src/trader/index.jsx";
import { SurfaceView, SurfacePanel } from "../src/trader/surface.jsx";
import { SfxProvider } from "../src/trader/sfx.jsx";
import { newGame } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { SYSTEMS } from "../src/data/bodies.js";
import { MAPPED } from "../src/surface.js";
import { listSaves, deleteSlot, MAX_SLOTS } from "../src/save.js";

// React needs telling it is inside a test, or every act() warns.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const act = React.act;

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let container = null, root = null, errors = [];
let realError = null;

beforeEach(() => {
  errors = [];
  realError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(" ")); };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  for (let i = 1; i <= MAX_SLOTS; i++) deleteSlot(i);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  console.error = realError;
});

/** Render, run effects, and fail loudly on anything React complained about. */
function render(el) {
  act(() => root.render(el));
  expectQuiet();
}

function expectQuiet() {
  // React logs render errors here rather than throwing them where a test can
  // see them, so silence is the assertion.
  expect(errors.join("\n---\n")).toBe("");
}

const text = () => container.textContent || "";
const buttons = () => [...container.querySelectorAll("button")];
const byText = (re) => buttons().find((b) => re.test(b.textContent || ""));
const click = (el) => { act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };

/**
 * Advance fake time the way a browser spends it: in slices, with React allowed
 * to re-render between them. See the note in the autosave test for why a single
 * big jump is useless here.
 */
async function tick(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await vi.advanceTimersByTimeAsync(step); });
  }
}

const audio = { on: false, level: 0.5, sfxOn: false, sfxLevel: 0.7 };
const noop = () => {};

/** Play, with the props index.jsx gives it and the sound turned off. */
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

const freshGame = (seed = 42) => newGame(newPlayer({ name: "Smoke" }), seed);

// ---------------------------------------------------------------------------

describe("the game mounts and stays mounted", () => {
  it("renders the play screen with a real game", () => {
    render(playScreen(freshGame()));
    expect(text()).toContain("Smoke");
    expect(text()).toContain("Gateway Station");
  });

  it("opens all four tabs", () => {
    // The regression: the Ship Yard threw on every open for a whole session and
    // 390 passing tests never noticed, because none of them opened a tab.
    render(playScreen(freshGame()));
    for (const tab of [/Yard/, /Course/, /Standing/, /Dock/]) {
      const b = byText(tab);
      expect(b, `no ${tab} tab`).toBeTruthy();
      click(b);
      expectQuiet();
      expect(text().length).toBeGreaterThan(0);
    }
  });

  it("opens every screen the Dock and the Yard lead to", () => {
    // Each tab is a menu of labelled ways in (trader/ui.jsx). Walk into each
    // one and back out, which is the path a player takes in their first minute.
    render(playScreen(freshGame()));
    for (const [tab, entries] of [
      [/Dock/, [/Market/, /Propellant/, /Wait here/, /This port/, /Ledger/]],
      [/Yard/, [/drive/i, /module/i, /crew|hire/i, /ship/i]],
    ]) {
      click(byText(tab));
      for (const entry of entries) {
        const b = byText(entry);
        if (!b) continue;               // a yard too primitive to offer it
        click(b);
        expectQuiet();
        const back = buttons().find((x) => x.getAttribute("aria-label") === "Back");
        if (back) click(back);
        expectQuiet();
      }
    }
  });
});

describe("the map, at all three depths", () => {
  it("opens every system from the orrery", () => {
    render(playScreen(freshGame()));
    for (const sys of SYSTEMS) {
      const g = [...container.querySelectorAll("[role=button]")]
        .find((e) => (e.getAttribute("aria-label") || "").startsWith(`${sys.name}.`)
          || (e.getAttribute("aria-label") || "").startsWith(`${sys.name},`));
      if (!g) continue;
      act(() => { g.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
      expectQuiet();
      const back = [...container.querySelectorAll("[role=button]")]
        .find((e) => (e.getAttribute("aria-label") || "").startsWith("Back to the solar"));
      if (back) act(() => { back.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
      expectQuiet();
    }
  });

  it("draws a surface map of every body we hold geography for", () => {
    // Seventeen worlds, five of them with photographic plates and twelve
    // without, at a date chosen to put several of them mid-terminator.
    const game = { ...freshGame(), t: Date.UTC(2037, 5, 14) };
    for (const bodyId of MAPPED) {
      render(React.createElement(
        SfxProvider, { value: () => false },
        React.createElement(SurfaceView, {
          game, bodyId, dest: null, onPick: noop, onBack: noop,
        }),
      ));
      expect(text().length, bodyId).toBeGreaterThan(0);
    }
  });

  it("writes a panel beside every surface map", () => {
    const game = { ...freshGame(), t: Date.UTC(2037, 5, 14) };
    for (const bodyId of MAPPED) {
      render(React.createElement(
        SfxProvider, { value: () => false },
        React.createElement(SurfacePanel, { game, bodyId, onBack: noop }),
      ));
      // Every one of them states what it does and does not claim.
      expect(text(), bodyId).toContain("named geography");
    }
  });
});

describe("the front door", () => {
  it("walks title → runs → captain → playing, and saves on the way", async () => {
    // THE OTHER REGRESSION, and the reason this file has fake timers in it.
    // The autosave is debounced by two seconds and the port clock re-renders ten
    // times a second; if the debounce depends on the game object rather than on
    // what actually changed, the timer is cancelled forever and NOTHING IS EVER
    // SAVED. That is what was shipping, and it looked fine.
    vi.useFakeTimers();
    try {
      render(React.createElement(Trader));

      // The studio card is skippable by anything at all.
      act(() => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a" })); });
      expect(text()).toMatch(/New game/);

      click(byText(/New game/));
      expect(text()).toMatch(/Take command/);

      const input = container.querySelector("input:not([type=file])");
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, "Smoke");
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
      click(byText(/Begin/));
      expect(text()).toContain("Gateway Station");

      // Nothing is written yet — the debounce has not elapsed.
      expect(listSaves().length).toBe(0);

      // ⚠ ADVANCE IN SMALL STEPS, EACH IN ITS OWN act(). This is the whole
      // difference between a test that catches the bug and a test that watches
      // it go past. One `advanceTimersByTimeAsync(6000)` fires every interval
      // callback in a batch and lets React flush ONCE at the end — so the
      // autosave effect re-runs once, its timer survives, and the save lands
      // even with the bug present. Verified by putting the bug back: the
      // batched version stayed green.
      //
      // Stepping 100 ms at a time makes React re-render between clock ticks,
      // which is what actually happens in a browser, and which is what cancels
      // a badly-scoped debounce forever.
      await tick(6000);
      const saved = listSaves();
      expect(saved.length, "the run never autosaved").toBe(1);
      expect(saved[0].name).toBe("Smoke");
      expect(saved[0].slot).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a second run beside the first instead of over it", async () => {
    // The thing multiple slots exist to make impossible. Play one run, walk out
    // through the pause menu, start another, and both must be in the list.
    vi.useFakeTimers();
    try {
      render(React.createElement(Trader));
      act(() => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a" })); });

      const nameAndBegin = (name) => {
        const input = container.querySelector("input:not([type=file])");
        act(() => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          setter.call(input, name);
          input.dispatchEvent(new window.Event("input", { bubbles: true }));
        });
        click(byText(/Begin/));
      };

      click(byText(/^New game/));
      nameAndBegin("First");
      await tick(6000);
      expect(listSaves().map((r) => r.name)).toEqual(["First"]);

      // Out through the pause menu, which is the only way back to the title.
      click(byText(/^Menu$/));
      click(byText(/Return to main menu/));
      expect(text()).toMatch(/Continue/);

      // Continue opens the runs list rather than resuming — that IS the change.
      click(byText(/Continue/));
      expect(text()).toContain("Your runs");
      expect(text()).toContain("First");

      click(byText(/Start a new run/));
      nameAndBegin("Second");
      await tick(6000);

      const runs = listSaves();
      expect(runs.map((r) => r.name).sort()).toEqual(["First", "Second"]);
      expect(new Set(runs.map((r) => r.slot)).size).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
