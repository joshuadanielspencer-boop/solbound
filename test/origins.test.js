// @vitest-environment jsdom
// ===========================================================================
// THE HISTORY ON THE SURFACE MAP — does the panel actually SHOW who a feature
// is named for, and can a keyboard reach it?
//
// data/features.js has carried "Named for Tycho Brahe, the Danish astronomer…"
// since the survey era, and the trade game never showed a word of it: the
// surface panel listed landmark NAMES from the gazetteer and nothing else. The
// origins now come from the same gazetteer download as the coordinates, so
// they are sourced by construction; this holds the panel to displaying them.
// ===========================================================================
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";

import { SurfacePanel } from "../src/trader/surface.jsx";
import { newGame } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { LANDMARKS } from "../src/data/landmarks.js";

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
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  console.error = realError;
});

const text = () => container.textContent || "";
const click = (el) => { act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };
const expectQuiet = () => expect(errors.join("\n---\n")).toBe("");
const game = () => newGame(newPlayer({ name: "Names" }), 42);
const mount = (bodyId) => act(() => root.render(React.createElement(SurfacePanel, { game: game(), bodyId, onBack: () => {} })));

describe("the surface panel names who a feature honours", () => {
  it("landmarks are buttons, and opening one shows its origin and the IAU citation", () => {
    mount("luna");
    const first = LANDMARKS.luna[0];
    const chip = [...container.querySelectorAll("button")].find((b) => b.textContent.startsWith(first.name));
    expect(chip, "landmark is not a button").toBeTruthy();
    expect(chip.getAttribute("aria-pressed")).toBe("false");

    expect(text()).not.toContain(`Named for ${first.origin}`);
    click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(text()).toContain(`Named for ${first.origin}`);
    const cite = container.querySelector(`a[href="https://planetarynames.wr.usgs.gov/Feature/${first.iau}"]`);
    expect(cite, "no IAU citation link").toBeTruthy();
    expect(cite.getAttribute("target")).toBe("_blank");
    expectQuiet();
  });

  it("opens one at a time, and a second click closes it", () => {
    mount("mars");
    const [a, b] = LANDMARKS.mars;
    const chipOf = (l) => [...container.querySelectorAll("button")].find((x) => x.textContent.startsWith(l.name));
    click(chipOf(a));
    expect(container.querySelector("[data-landmark]").getAttribute("data-landmark")).toBe(a.name);
    click(chipOf(b));
    expect(container.querySelectorAll("[data-landmark]").length).toBe(1);
    expect(container.querySelector("[data-landmark]").getAttribute("data-landmark")).toBe(b.name);
    click(chipOf(b));
    expect(container.querySelector("[data-landmark]")).toBeNull();
    expectQuiet();
  });

  it("a port says who its feature is named for, without being asked", () => {
    // Gateway Station's world has ports; Shackleton is one on Luna in the core
    // set, and its crater honours an Antarctic explorer.
    mount("luna");
    expect(text()).toMatch(/Named for .*Antarctic explorer/);
    expectQuiet();
  });
});
