// @vitest-environment jsdom
// ===========================================================================
// THE WORDS — does the game NAME the astronomy it runs on?
//
// The finding this file exists for: a grep of every player-facing file found
// "Hohmann" zero times, "Kepler" zero, "aerobraking" zero, "synodic" zero,
// while every one of them was load-bearing. docs/astronomy.md's audit never
// caught it because its rule grades whether a fact is USED, never whether it
// is NAMED. These tests hold each lesson to the screen where its number sits.
//
// Two layers: the data (every concept well-formed, every Codex link real) and
// the screens (the word appears where it should and not where it should not —
// a same-system hop is a flat charge and must NOT be called a Hohmann transfer).
// ===========================================================================
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";

import { CONCEPTS, CONCEPT_IDS } from "../src/data/concepts.js";
import { ROUTES } from "../src/app.jsx";
import Play from "../src/trader/play.jsx";
import { SurfacePanel } from "../src/trader/surface.jsx";
import { SfxProvider } from "../src/trader/sfx.jsx";
import { newGame, travelCost } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { MAX_SLOTS, deleteSlot } from "../src/save.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const act = React.act;

// ---------------------------------------------------------------------------
// The data
// ---------------------------------------------------------------------------

describe("the concept list", () => {
  it("has a name and a real sentence for every entry", () => {
    expect(CONCEPT_IDS.length).toBeGreaterThanOrEqual(14);
    for (const id of CONCEPT_IDS) {
      const c = CONCEPTS[id];
      expect(c.name, id).toMatch(/\S/);
      expect(c.text.length, `${id} text too short to teach anything`).toBeGreaterThan(80);
      expect(c.text, `${id} should end a sentence`).toMatch(/[.)]$/);
    }
  });

  it("only points at Codex sandboxes that exist", () => {
    for (const id of CONCEPT_IDS) {
      const { codex } = CONCEPTS[id];
      if (codex === null) continue;
      expect(ROUTES[codex], `${id} → #/${codex} is not a route`).toBeTruthy();
    }
  });

  it("names the big four the grep found missing", () => {
    const names = CONCEPT_IDS.map((id) => CONCEPTS[id].name.toLowerCase()).join(" ");
    for (const word of ["hohmann", "kepler", "aerobraking", "synodic", "inverse-square"]) {
      expect(names, word).toContain(word);
    }
  });
});

// ---------------------------------------------------------------------------
// The engine says what the atmosphere took off the bill
// ---------------------------------------------------------------------------

const freshGame = (seed = 42) => newGame(newPlayer({ name: "Words" }), seed);
const siteIn = (game, system) => game.sites.find((s) => s.system === system && s.id !== game.player.at);
const AIRLESS = new Set(["earth", "mars", "venus"]);

describe("travelCost reports aerobraking", () => {
  it("is positive for a Mars leg and zero for an airless one", () => {
    const game = freshGame();
    const mars = siteIn(game, "mars");
    expect(mars, "seed 42 has no Mars port").toBeTruthy();
    const toMars = travelCost(game, mars.id);
    expect(toMars.aerobrakedKms).toBeGreaterThan(0.5);
    expect(toMars.dvKms).toBeGreaterThan(toMars.aerobrakedKms);

    const rock = game.sites.find((s) => !AIRLESS.has(s.system) && s.system !== "earth");
    expect(rock, "seed 42 has no airless interplanetary port").toBeTruthy();
    expect(travelCost(game, rock.id).aerobrakedKms).toBe(0);
  });

  it("is zero for a hop within the same system", () => {
    const game = freshGame();
    const luna = siteIn(game, "earth");
    expect(luna, "seed 42 has no second Earth-system port").toBeTruthy();
    expect(travelCost(game, luna.id).aerobrakedKms).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The screens
// ---------------------------------------------------------------------------

let container = null, root = null, errors = [], realError = null;

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

const text = () => container.textContent || "";
const buttons = () => [...container.querySelectorAll("button")];
const byText = (re) => buttons().find((b) => re.test(b.textContent || ""));
const rowByText = (re) => [...container.querySelectorAll("[role=button]")].find((b) => re.test(b.textContent || ""));
const click = (el) => { act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };
const lessons = () => [...container.querySelectorAll("[data-lesson]")].map((e) => e.getAttribute("data-lesson"));
const expectQuiet = () => expect(errors.join("\n---\n")).toBe("");

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
const render = (el) => { act(() => root.render(el)); expectQuiet(); };

describe("each lesson sits on the screen where its number is", () => {
  it("the Propellant screen names the rocket equation and links the Codex", () => {
    render(playScreen(freshGame()));
    click(byText(/Propellant/));
    expect(lessons()).toContain("rocketEquation");
    expect(text()).toContain("The rocket equation");
    const link = container.querySelector('a[href="#/rocket"]');
    expect(link, "no Codex link").toBeTruthy();
    expect(link.getAttribute("target")).toBe("_blank");
    expectQuiet();
  });

  it("Build here names the inverse-square law and ISRU", () => {
    render(playScreen(freshGame()));
    click(byText(/Build here/));
    expect(lessons()).toEqual(expect.arrayContaining(["inverseSquare", "isru"]));
    expect(text()).toContain("inverse-square");
    expect(text()).toContain("ISRU");
    expectQuiet();
  });

  it("a Mars destination is called a Hohmann transfer, with aerobraking and a Δv", () => {
    const game = freshGame();
    const mars = siteIn(game, "mars");
    render(playScreen(game));
    click(byText(/Course/));
    const row = rowByText(new RegExp(mars.name));
    expect(row, `no clickable row for ${mars.name}`).toBeTruthy();
    click(row);
    expect(lessons()).toEqual(expect.arrayContaining(["hohmann", "aerobraking"]));
    expect(text()).toContain("Hohmann transfer");
    expect(text()).toContain("Walter Hohmann");
    expect(text()).toContain("Aerobraking");
    expect(text()).toContain("Δv");
    expect(text()).toContain("km/s");
    expectQuiet();
  });

  it("a hop within the Earth system is NOT called a Hohmann transfer", () => {
    // A same-system leg is a flat charge with no orbit to teach; naming it
    // would be the one thing worse than not naming the real one.
    const game = freshGame();
    const luna = siteIn(game, "earth");
    render(playScreen(game));
    click(byText(/Course/));
    click(rowByText(new RegExp(luna.name)));
    expect(lessons()).not.toContain("hohmann");
    expect(lessons()).not.toContain("aerobraking");
    expect(text()).toContain("Δv");     // the number is still there
    expectQuiet();
  });

  it("opening Mars on the orrery names the synodic period and Kepler's third law", () => {
    render(playScreen(freshGame()));
    const mars = [...container.querySelectorAll("[role=button]")]
      .find((e) => /^Mars[.,]/.test(e.getAttribute("aria-label") || ""));
    expect(mars, "no Mars on the orrery").toBeTruthy();
    click(mars);
    expect(lessons()).toContain("synodic");
    expect(text()).toContain("Synodic period");
    expect(text()).toContain("Kepler");
    // 780 days is the textbook Earth–Mars figure; the screen computes it from
    // the same elements the orrery flies on, so it should land within a day.
    expect(text()).toMatch(/7(79|80) days/);
    expectQuiet();
  });

  it("but Earth cannot lap itself, so its atlas gets no synodic lesson", () => {
    render(playScreen(freshGame()));
    const earth = [...container.querySelectorAll("[role=button]")]
      .find((e) => (e.getAttribute("aria-label") || "").startsWith("Earth"));
    click(earth);
    expect(lessons()).not.toContain("synodic");
    expectQuiet();
  });

  it("the Mars surface names the terminator and the axial tilt", () => {
    render(React.createElement(SurfacePanel, { game: freshGame(), bodyId: "mars", onBack: noop }));
    expect(lessons()).toEqual(expect.arrayContaining(["terminator", "axialTilt"]));
    expect(text()).toContain("The terminator");
    expect(text()).toContain("25.2°");    // Mars's real obliquity, from data/bodies.js
    expectQuiet();
  });

  it("every lesson on screen carries its name up front", () => {
    render(playScreen(freshGame()));
    click(byText(/Build here/));
    for (const el of container.querySelectorAll("[data-lesson]")) {
      const id = el.getAttribute("data-lesson");
      expect(el.textContent.startsWith(CONCEPTS[id].name), id).toBe(true);
    }
  });
});
