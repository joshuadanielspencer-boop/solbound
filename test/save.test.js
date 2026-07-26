// ===========================================================================
// SAVE / LOAD — the round trip, the version guard, and the determinism contract.
//
// A save system's job is to be boring and never lose a game. These pin the three
// ways it could quietly fail: a state that doesn't survive the round trip, a
// save without a version (a time bomb for the first schema change), and a run
// that can't be reproduced from its seed.
// ===========================================================================
import { describe, it, expect, beforeEach } from "vitest";

// Vitest runs in node, which has no localStorage. save.js degrades gracefully
// when it's absent, but the autosave tests need a working one — so give them a
// tiny in-memory shim rather than pulling in a whole DOM environment.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

import {
  makeSave, serialize, deserialize, SAVE_VERSION,
  autosave, loadAutosave, hasSave, clearSave, savedSummary,
} from "../src/save.js";
import { newGame, launch } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";

const freshGame = (seed = 42) => newGame(newPlayer({ name: "Vega", skills: defaultSkills() }), seed);

describe("the round trip", () => {
  it("a game survives serialise → deserialise unchanged", () => {
    const g = freshGame();
    const r = deserialize(serialize(makeSave(g)));
    expect(r.error).toBeUndefined();
    expect(r.save.state).toEqual(JSON.parse(JSON.stringify(g)));
  });

  it("survives the round trip mid-flight, ship and all", () => {
    // The riskiest state to save: in transit, with a leg. If the arc numbers
    // don't survive, a reloaded ship would fly a different path or teleport.
    const g = launch(freshGame(), "jezero-station").game;
    const r = deserialize(serialize(makeSave(g)));
    expect(r.error).toBeUndefined();
    expect(r.save.state.status).toBe("transit");
    expect(r.save.state.leg).toEqual(g.leg);
  });

  it("carries a version and a world seed", () => {
    const save = makeSave(freshGame(77));
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.state.seed).toBe(77);
  });

  it("snapshots — mutating the game after saving doesn't change the save", () => {
    const g = freshGame();
    const save = makeSave(g);
    g.player.credits = 999999;            // scribble on the live game
    expect(save.state.player.credits).not.toBe(999999);
  });
});

describe("bad saves fail loudly, never silently", () => {
  it("rejects junk, non-saves, and truncation with a message", () => {
    for (const bad of ["not json", "{}", '{"version":1}', '{"state":{}}', "null"]) {
      const r = deserialize(bad);
      expect(r.error, bad).toBeTruthy();
      expect(r.message).toBeTruthy();
    }
  });

  it("refuses a save from a newer version than we run", () => {
    const future = serialize({ ...makeSave(freshGame()), version: SAVE_VERSION + 5 });
    expect(deserialize(future).error).toBe("too-new");
  });

  it("refuses a state with no seed — it couldn't be reproduced", () => {
    // The determinism contract, enforced. A run whose world can't be re-rolled
    // from a seed is not a valid SOLBOUND save.
    const s = makeSave(freshGame());
    delete s.state.seed;
    expect(deserialize(serialize(s)).error).toBe("invalid");
  });

  it("refuses a state with a broken ship status", () => {
    const s = makeSave(freshGame());
    s.state.status = "teleporting";
    expect(deserialize(serialize(s)).error).toBe("invalid");
  });
});

describe("migration upgrades old saves instead of breaking them", () => {
  it("a v1 save (no costBasis) loads and gains the field", () => {
    // Hand-build a v1 save the way the old code would have written it: a valid
    // state with no costBasis map. It must migrate, not fail.
    const g = freshGame();
    delete g.player.costBasis;
    const v1 = serialize({ version: 1, slot: "auto", stampMs: 0, label: "old", state: JSON.parse(JSON.stringify(g)) });
    const r = deserialize(v1);
    expect(r.error).toBeUndefined();
    expect(r.save.version).toBe(SAVE_VERSION);
    expect(r.save.state.player.costBasis).toEqual({});
  });
});

describe("the same seed reproduces the same world", () => {
  it("a loaded save has the identical faction spawn a fresh game of that seed would", () => {
    const loaded = deserialize(serialize(makeSave(freshGame(555)))).save.state;
    const fresh = freshGame(555);
    expect(loaded.factions).toEqual(fresh.factions);
  });
});

// ---- localStorage-backed autosave. jsdom provides localStorage. --------------
describe("autosave and resume", () => {
  beforeEach(() => clearSave());

  it("round-trips through storage", () => {
    const g = freshGame();
    expect(hasSave()).toBe(false);
    expect(autosave(g)).toBe(true);
    expect(hasSave()).toBe(true);
    const back = loadAutosave();
    expect(back.state.seed).toBe(g.seed);
    expect(back.state.player.name).toBe("Vega");
  });

  it("clearSave removes it", () => {
    autosave(freshGame());
    clearSave();
    expect(hasSave()).toBe(false);
    expect(loadAutosave()).toBeNull();
  });

  it("summarises a save for the splash without loading the whole world", () => {
    autosave(freshGame(9));
    const s = savedSummary();
    expect(s.name).toBe("Vega");
    expect(typeof s.credits).toBe("number");
    expect(s.dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("a later autosave overwrites the earlier one", () => {
    const g1 = freshGame(1), g2 = freshGame(2);
    autosave(g1); autosave(g2);
    expect(loadAutosave().state.seed).toBe(2);
  });
});
