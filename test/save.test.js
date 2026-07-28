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
  listSaves, nextFreeSlot, saveToSlot, loadSlot, deleteSlot, hasAnySave, MAX_SLOTS,
} from "../src/save.js";
import { newGame, launch } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";

const freshGame = (seed = 42) => newGame(newPlayer({ name: "Vega", skills: defaultSkills() }), seed);

describe("migrations backfill content that did not exist when a save was written", () => {
  it("an old save gains the commodities added since — silently missing goods is the worst save bug", () => {
    // A market's stock map is built once, at newGame. A save written before
    // contraband existed has no entry for arms or fissiles anywhere, so those
    // goods would be untradeable in that game forever, with nothing looking
    // broken. The migration has to seed them.
    const old = JSON.parse(JSON.stringify(makeSave(freshGame(5))));
    old.version = 4;
    for (const m of Object.values(old.state.markets)) {
      delete m.stock.arms;
      delete m.stock.fissiles;
    }
    const r = deserialize(serialize(old));
    expect(r.error).toBeUndefined();
    expect(r.save.version).toBe(SAVE_VERSION);
    expect(r.save.state.markets["ceres-port"].stock.fissiles).toBeGreaterThan(0);
    expect(r.save.state.markets["psyche-works"].stock.arms).toBeGreaterThan(0);
  });

  it("but never disturbs stock the player already moved", () => {
    const old = JSON.parse(JSON.stringify(makeSave(freshGame(5))));
    old.version = 4;
    old.state.markets["leo"].stock.machinery = 3;      // a market they worked over
    const r = deserialize(serialize(old));
    expect(r.save.state.markets["leo"].stock.machinery).toBe(3);
  });
});

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

// ---------------------------------------------------------------------------
// SLOTS — more than one run at a time
//
// Three things have to hold, and the third is the one that would hurt:
//   1. Runs are independent. Two saves must never write over each other.
//   2. Nobody loses the save they already had. The pre-slots autosave has to
//      arrive in slot 1 rather than being orphaned by the upgrade.
//   3. Deleting is final and must not resurrect. Slot 1 is the adopted legacy
//      save, so deleting it has to take the legacy key with it — otherwise the
//      very next listing helpfully brings it back from the dead.
// ---------------------------------------------------------------------------
describe("save slots", () => {
  beforeEach(() => {
    clearSave();
    for (let i = 1; i <= MAX_SLOTS; i++) deleteSlot(i);
  });

  it("starts empty and hands out the lowest free place", () => {
    expect(listSaves()).toEqual([]);
    expect(hasAnySave()).toBe(false);
    expect(nextFreeSlot()).toBe(1);
  });

  it("keeps two runs entirely separate", () => {
    saveToSlot(freshGame(11), 1, 1000);
    saveToSlot(freshGame(22), 2, 2000);
    expect(loadSlot(1).state.seed).toBe(11);
    expect(loadSlot(2).state.seed).toBe(22);
    // The bug this whole change exists to make impossible: one run's autosave
    // landing on another's.
    saveToSlot(freshGame(33), 1, 3000);
    expect(loadSlot(2).state.seed).toBe(22);
  });

  it("lists most recently saved first, which is what Continue names", () => {
    saveToSlot(freshGame(1), 1, 1000);
    saveToSlot(freshGame(2), 2, 5000);
    saveToSlot(freshGame(3), 3, 3000);
    expect(listSaves().map((r) => r.slot)).toEqual([2, 3, 1]);
  });

  it("carries the seed, so two runs on one world can be told apart", () => {
    saveToSlot(freshGame(4242), 1, 1000);
    expect(listSaves()[0].seed).toBe(4242);
  });

  it("reuses a freed place instead of growing gaps forever", () => {
    saveToSlot(freshGame(1), 1, 1);
    saveToSlot(freshGame(2), 2, 2);
    expect(nextFreeSlot()).toBe(3);
    deleteSlot(1);
    expect(nextFreeSlot()).toBe(1);
  });

  it("fills up and says so rather than overwriting somebody", () => {
    for (let i = 1; i <= MAX_SLOTS; i++) saveToSlot(freshGame(i), i, i);
    expect(listSaves().length).toBe(MAX_SLOTS);
    expect(nextFreeSlot()).toBe(null);
  });

  it("adopts a pre-slots autosave into slot 1", () => {
    // The upgrade path for anybody who was already playing. Their run must be
    // in the list, not orphaned under a key nothing reads any more.
    autosave(freshGame(777), 4242);
    expect(listSaves().map((r) => r.seed)).toEqual([777]);
    expect(loadSlot(1).state.seed).toBe(777);
  });

  it("never adopts on top of a real save", () => {
    autosave(freshGame(777), 1);
    saveToSlot(freshGame(999), 1, 2);
    expect(listSaves().map((r) => r.seed)).toEqual([999]);
  });

  it("stays deleted — the legacy key does not resurrect slot 1", () => {
    autosave(freshGame(777), 1);
    expect(listSaves().length).toBe(1);      // adopts
    deleteSlot(1);
    expect(listSaves()).toEqual([]);         // and stays gone
    expect(nextFreeSlot()).toBe(1);
  });

  it("reports a corrupted slot instead of quietly hiding it", () => {
    // A run vanishing from the list with no explanation is worse than a row
    // that says it cannot be read.
    localStorage.setItem("solbound.save.v1.slot.3", "{ this is not json");
    const rows = listSaves();
    expect(rows.length).toBe(1);
    expect(rows[0].damaged).toBe(true);
    expect(rows[0].slot).toBe(3);
    localStorage.removeItem("solbound.save.v1.slot.3");
  });

  it("survives being asked about a slot that holds nothing", () => {
    expect(loadSlot(4)).toBeNull();
    expect(loadSlot(null)).toBeNull();
    expect(saveToSlot(freshGame(), null)).toBe(false);
  });
});
