// @vitest-environment jsdom
// ===========================================================================
// RUN MODE — the game can end, and it says what became of you.
//
// design.md §12 locked two victory conditions on 2026-07-25 and neither existed
// until 2026-09-30. The reason it mattered: a game with no ending cannot be
// playtested, and every balance number in decisions.md was waiting on a
// playtest. These tests hold the four ways out — target, charter, retired,
// destroyed — to landing in the same place with a score attached.
// ===========================================================================
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";

import { newGame, wait, sell, buy, advanceTime, START_DATE } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { charterFor, endingFor, withEnding, retire, score, netWorth, charterLeftYears } from "../src/ending.js";
import { MODES, DEFAULT_MODE, RUN_RANKS, CAMPAIGN_RANKS } from "../src/data/modes.js";
import { makeSave, serialize, deserialize, SAVE_VERSION, MAX_SLOTS, deleteSlot } from "../src/save.js";
import Play from "../src/trader/play.jsx";
import CreateCaptain from "../src/trader/create.jsx";
import { SfxProvider } from "../src/trader/sfx.jsx";

const DAY = 86400000;
const YEAR = 365.25 * DAY;
const run = (seed = 42) => newGame(newPlayer({ name: "Ender" }), seed, "run");
const campaign = (seed = 42) => newGame(newPlayer({ name: "Ender" }), seed, "campaign");
const withCredits = (g, credits) => ({ ...g, player: { ...g.player, credits } });

// ---------------------------------------------------------------------------
// The data
// ---------------------------------------------------------------------------

describe("modes are data", () => {
  it("a Run has a clock and a target; a Campaign has neither", () => {
    expect(MODES.run.charterYears).toBeGreaterThan(0);
    expect(MODES.run.targetCredits).toBeGreaterThan(0);
    expect(MODES.campaign.charterYears).toBeNull();
    expect(MODES.campaign.targetCredits).toBeNull();
  });

  it("a Run's charter ends inside the ephemeris' validated horizon", () => {
    // Standish Table 1 is good to 2050. A ten-year charter from 2035 must not
    // run the game into dates the orrery cannot vouch for.
    const c = charterFor("run", START_DATE);
    expect(c.endT).toBeLessThanOrEqual(Date.UTC(2050, 0, 1));
  });

  it("rank tables are ordered highest first and bottom out at zero", () => {
    for (const table of [RUN_RANKS, CAMPAIGN_RANKS]) {
      for (let i = 1; i < table.length; i++) expect(table[i].atLeast).toBeLessThan(table[i - 1].atLeast);
      expect(table[table.length - 1].atLeast).toBe(0);
    }
  });
});

describe("a new game carries its mode and charter", () => {
  it("the engine's default is the open-ended game, so nothing that never asked for an ending gets one", () => {
    const g = newGame(newPlayer({ name: "D" }), 1);
    expect(g.mode).toBe(DEFAULT_MODE);
    expect(DEFAULT_MODE).toBe("campaign");
    expect(g.charter.endT).toBeNull();
  });

  it("a Run's charter is ten years from the start date with the target attached", () => {
    const g = run();
    expect(g.charter.startT).toBe(START_DATE);
    expect(g.charter.endT).toBe(START_DATE + MODES.run.charterYears * YEAR);
    expect(g.charter.targetCredits).toBe(MODES.run.targetCredits);
    expect(charterLeftYears(g)).toBeCloseTo(MODES.run.charterYears, 5);
  });

  it("a Campaign's charter has no end and no target", () => {
    const g = campaign();
    expect(g.charter.endT).toBeNull();
    expect(g.charter.targetCredits).toBeNull();
    expect(charterLeftYears(g)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The four ways out
// ---------------------------------------------------------------------------

describe("the target", () => {
  it("is not reached at the start", () => {
    expect(endingFor(run())).toBeNull();
  });

  it("ends the Run the moment credits reach it, with a score", () => {
    const g = withCredits(run(), MODES.run.targetCredits);
    const o = endingFor(g);
    expect(o?.reason).toBe("target");
    expect(o.score.rank).toBe("Retired rich");
    expect(o.score.netWorth).toBeGreaterThanOrEqual(MODES.run.targetCredits);
  });

  it("is checked when time passes in port", () => {
    const g = withCredits(run(), MODES.run.targetCredits);
    expect(wait(g, 1).game.over?.reason).toBe("target");
  });

  it("is checked when the clock runs", () => {
    const g = withCredits(run(), MODES.run.targetCredits);
    expect(advanceTime(g, g.t + DAY).game.over?.reason).toBe("target");
  });

  it("is checked on a sale, which is where the money actually arrives", () => {
    // Whatever the home port sells and a starter can afford a tonne of.
    let g = run();
    let id = null, b = null;
    for (const cand of Object.keys(g.markets[g.player.at].stock)) {
      const r = buy(g, cand, 1);
      if (!r.error) { id = cand; b = r; break; }
    }
    expect(id, "the home port sold nothing a starter could buy a tonne of").toBeTruthy();
    g = withCredits(b.game, MODES.run.targetCredits - 1);
    const s = sell(g, id, 1);
    expect(s.error).toBeUndefined();
    expect(s.game.over?.reason).toBe("target");
  });

  it("never ends a Campaign, however rich", () => {
    const g = withCredits(campaign(), 50_000_000);
    expect(endingFor(g)).toBeNull();
    expect(wait(g, 30).game.over).toBeUndefined();
  });

  it("waits for an unresolved encounter before it settles", () => {
    const g = { ...withCredits(run(), MODES.run.targetCredits), encounter: { encounterId: "x", outcome: null } };
    expect(endingFor(g)).toBeNull();
  });
});

describe("the charter", () => {
  it("ends the Run when the clock runs out", () => {
    const g = run();
    const late = { ...g, t: g.charter.endT - DAY };
    expect(endingFor(late)).toBeNull();
    const r = wait(late, 2);
    expect(r.game.over?.reason).toBe("charter");
    expect(r.game.over.score.years).toBeCloseTo(MODES.run.charterYears, 0);
  });

  it("ranks by how far toward the target you got", () => {
    const g = run();
    const late = { ...g, t: g.charter.endT + DAY };
    const o = endingFor(late);
    expect(o.reason).toBe("charter");
    // A starter's purse against a $2M target is under a quarter of the way.
    expect(o.score.fraction).toBeLessThan(0.25);
    expect(o.score.rank).toBe("Never got going");
  });

  it("never ends a Campaign, however long", () => {
    const g = campaign();
    expect(wait({ ...g, t: g.t + 40 * YEAR }, 365).game.over).toBeUndefined();
  });
});

describe("retiring", () => {
  it("ends the game at a port with a score", () => {
    const r = retire(run());
    expect(r.error).toBeUndefined();
    expect(r.game.over.reason).toBe("retired");
    expect(r.game.over.score.modeId).toBe("run");
  });

  it("is refused in flight", () => {
    const g = { ...run(), status: "transit" };
    expect(retire(g).error).toBe("in-flight");
  });

  it("is the only way a Campaign ends, and it scores the umbilical", () => {
    const r = retire(campaign());
    expect(r.game.over.reason).toBe("retired");
    expect(r.game.over.score.rank).toBe("Still on the umbilical");
    expect(r.game.over.score.linksCured).toBe(0);
    expect(r.game.over.score.linksTotal).toBeGreaterThan(0);
  });

  it("does nothing to a game that is already over", () => {
    const g = retire(run()).game;
    expect(retire(g).game).toBe(g);
  });
});

describe("the score", () => {
  it("counts cash and the ship, not the hold", () => {
    const g = run();
    expect(netWorth(g)).toBeGreaterThan(g.player.credits);
    const sc = score(g);
    expect(sc.netWorth).toBe(sc.credits + sc.shipValue);
    expect(sc.portsVisited).toBe(1);
    expect(sc.plantsBuilt).toBe(0);
    expect(sc.days).toBe(0);
  });

  it("is frozen onto the ending, not recomputed later", () => {
    const g = retire(run()).game;
    const later = withCredits(g, 99);
    expect(later.over.score.credits).toBe(g.player.credits);
  });
});

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

describe("saves know their mode", () => {
  it("a v10 save with no mode becomes an open-ended Campaign", () => {
    const old = JSON.parse(JSON.stringify(makeSave(campaign(5))));
    old.version = 10;
    delete old.state.mode;
    delete old.state.charter;
    const r = deserialize(serialize(old));
    expect(r.error).toBeUndefined();
    expect(r.save.version).toBe(SAVE_VERSION);
    expect(r.save.state.mode).toBe("campaign");
    expect(r.save.state.charter.endT).toBeNull();
    expect(r.save.state.charter.targetCredits).toBeNull();
    // And it still cannot end by the clock.
    expect(endingFor({ ...r.save.state, t: r.save.state.t + 30 * YEAR })).toBeNull();
  });

  it("a Run round-trips with its charter intact", () => {
    const g = run(7);
    const r = deserialize(serialize(makeSave(g)));
    expect(r.save.state.charter).toEqual(g.charter);
    expect(r.save.state.mode).toBe("run");
  });
});

// ---------------------------------------------------------------------------
// The screens
// ---------------------------------------------------------------------------

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
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  console.error = realError;
});
const text = () => container.textContent || "";
const buttons = () => [...container.querySelectorAll("button")];
const byText = (re) => buttons().find((b) => re.test(b.textContent || ""));
const click = (el) => { act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };
const expectQuiet = () => expect(errors.join("\n---\n")).toBe("");
const audio = { on: false, level: 0.5, sfxOn: false, sfxLevel: 0.7 };
const noop = () => {};
function playScreen(game, setGame = noop) {
  return React.createElement(SfxProvider, { value: () => false },
    React.createElement(Play, { game, setGame, onQuit: noop, audio, cue: null,
      onToggleAudio: noop, onAudioLevel: noop, onToggleSfx: noop, onSfxLevel: noop, onSetContext: noop }));
}

describe("the create screen offers both games", () => {
  it("shows two mode cards, Run pressed by default, and passes the choice to Begin", () => {
    let got = null;
    act(() => root.render(React.createElement(CreateCaptain, { onBegin: (x) => { got = x; }, onBack: noop })));
    const runCard = byText(/^⏱Run/), campCard = byText(/^🌐Campaign/);
    expect(runCard, "no Run card").toBeTruthy();
    expect(campCard, "no Campaign card").toBeTruthy();
    expect(runCard.getAttribute("aria-pressed")).toBe("true");
    expect(text()).toContain("10 years · target $2M");
    click(campCard);
    expect(campCard.getAttribute("aria-pressed")).toBe("true");
    click(byText(/Begin/));
    expect(got.mode).toBe("campaign");
    expectQuiet();
  });
});

describe("the HUD shows a Run's clock and target, and nothing for a Campaign", () => {
  it("Run", () => {
    act(() => root.render(playScreen(run())));
    expect(text()).toContain("Charter");
    expect(text()).toContain("10.0 yr");
    expect(text()).toContain("Target");
    expect(text()).toContain("$2,000,000");
    expectQuiet();
  });
  it("Campaign", () => {
    act(() => root.render(playScreen(campaign())));
    expect(text()).not.toContain("Charter");
    expect(text()).not.toContain("Target");
    expectQuiet();
  });
});

describe("the ending screen", () => {
  it("says what became of you, with a rank, when the number is made", () => {
    const g = withEnding(withCredits(run(), MODES.run.targetCredits));
    act(() => root.render(playScreen(g)));
    expect(container.querySelector("[data-ending]")?.getAttribute("data-ending")).toBe("target");
    expect(text()).toContain("What became of you");
    expect(text()).toContain("Retired rich");
    expect(text()).toContain("Net worth");
    expect(text()).toContain("Supply links cured");
    expectQuiet();
  });

  it("keeps the harder framing for a lost ship", () => {
    const g = { ...run(), over: { reason: "destroyed", headline: "Lost.", detail: "Gone.", t: START_DATE } };
    act(() => root.render(playScreen(g)));
    expect(text()).toContain("The run ends here");
    expect(text()).not.toContain("What became of you");
    expectQuiet();
  });

  it("the pause menu retires, but only when asked twice", () => {
    let game = run();
    const setGame = (fn) => { game = typeof fn === "function" ? fn(game) : fn; act(() => root.render(playScreen(game, setGame))); };
    act(() => root.render(playScreen(game, setGame)));
    click(byText(/^Menu$/));
    const b1 = byText(/Retire here/);
    expect(b1, "no Retire button").toBeTruthy();
    click(b1);
    expect(game.over).toBeUndefined();             // asked once: nothing yet
    click(byText(/Retire — end this game now\?/));
    expect(game.over?.reason).toBe("retired");
    expect(text()).toContain("What became of you");
    expectQuiet();
  });
});
