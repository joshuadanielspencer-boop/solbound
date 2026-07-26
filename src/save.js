// ===========================================================================
// SAVE / LOAD — a versioned envelope around the game state.
//
// The game state is already pure serialisable data (numbers, strings, arrays,
// plain objects — no Date objects, no functions, no class instances), so the
// storage itself is nearly free. What this module actually buys is the two
// things that make saves survive a game that keeps changing:
//
//   1. A VERSION on every save. When the state shape changes — and it will, as
//      encounters, missions and reputation land — a migrator upgrades old saves
//      instead of loading a broken world. A save without a version is a
//      time bomb; the first schema change silently corrupts it.
//
//   2. A determinism contract. The run's variety comes from `seed` (the faction
//      spawn is seeded and pure), so a reload reproduces the same world. Any
//      future ongoing randomness (encounter rolls) must derive from the seed and
//      a saved cursor, never from Math.random, or a reload could be
//      save-scummed and a shared seed wouldn't replay. That rule lives here as a
//      guard: loadGame refuses a state that smells non-deterministic.
//
// STORAGE is localStorage (survives a refresh, an offline PWA, a closed tab) OR
// a downloadable file (survives a cleared cache and moves between machines) —
// the same two-tier approach Shutterbug settled on for its passport.
// ===========================================================================

export const SAVE_VERSION = 1;
const STORAGE_KEY = "solbound.save.v1";      // versioned key so a hard format break can coexist
const AUTOSAVE_SLOT = "auto";

/**
 * Wrap a game in a save envelope. The envelope carries its own version and a
 * stamp so a UI can show "saved 3 minutes ago"; the stamp is passed in rather
 * than read from the clock, because the sim must never call Date.now() itself
 * (it would break replay — the same reason rng.js exists).
 */
export function makeSave(game, { slot = AUTOSAVE_SLOT, stampMs = 0, label = "" } = {}) {
  return {
    version: SAVE_VERSION,
    slot,
    stampMs,
    label: label || `${game.player?.name || "Captain"} · ${new Date(game.t).toISOString().slice(0, 10)}`,
    // The state is the game verbatim. It is already a plain value; we snapshot it
    // through JSON so a save can never alias live objects the game keeps mutating.
    state: JSON.parse(JSON.stringify(game)),
  };
}

/** Serialise a save to a string for a file or storage. */
export const serialize = (save) => JSON.stringify(save);

/**
 * Parse and validate a save string back into a save envelope, running any
 * migrations. Returns { save } or { error } — the caller decides how loudly to
 * complain, but a bad save never silently becomes a broken game.
 */
export function deserialize(text) {
  let raw;
  try { raw = JSON.parse(text); }
  catch { return { error: "not-json", message: "That doesn't look like a SOLBOUND save file." }; }

  if (!raw || typeof raw !== "object" || !("version" in raw) || !raw.state) {
    return { error: "not-a-save", message: "This file isn't a SOLBOUND save." };
  }
  if (raw.version > SAVE_VERSION) {
    return { error: "too-new", message: "This save is from a newer version of SOLBOUND than you're running." };
  }

  const migrated = migrate(raw);
  const problem = validateState(migrated.state);
  if (problem) return { error: "invalid", message: problem };
  return { save: migrated };
}

/**
 * MIGRATIONS. Each step upgrades a save from version N to N+1. New steps are
 * appended as the state shape grows; old saves walk up the ladder to current.
 * There are none yet (we're at v1), and the empty ladder is the point — it's the
 * hook that makes the FIRST schema change a five-line addition instead of a
 * data-loss incident.
 */
const MIGRATIONS = {
  // 1: (save) => { ...upgrade a v1 save to v2...; save.version = 2; return save; },
};

function migrate(save) {
  let s = save;
  while (s.version < SAVE_VERSION) {
    const step = MIGRATIONS[s.version];
    if (!step) { s = { ...s, version: SAVE_VERSION }; break; }   // no-op bump if no migrator
    s = step({ ...s });
  }
  return s;
}

/**
 * A sanity check on a loaded state — enough to catch a truncated file or a
 * hand-edited save, not a full schema. The determinism guard is the important
 * one: a run must carry its seed, or its world can't be reproduced.
 */
function validateState(state) {
  if (!state || typeof state !== "object") return "The save has no game in it.";
  if (typeof state.seed !== "number") return "The save is missing its world seed — it couldn't be reproduced.";
  if (!state.player || typeof state.player.credits !== "number") return "The save has no captain.";
  if (typeof state.t !== "number") return "The save has no clock.";
  if (!Array.isArray(state.factions)) return "The save is missing its world.";
  if (state.status !== "docked" && state.status !== "transit") return "The save's ship is in an unknown state.";
  return null;
}

// ---------------------------------------------------------------------------
// localStorage — autosave and quick-resume
// ---------------------------------------------------------------------------

/** Is localStorage usable here? (Private windows and disabled storage exist.) */
function storageOK() {
  try { const k = "__sb_test__"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return true; }
  catch { return false; }
}

/** Write the autosave. Silent no-op if storage is unavailable — a game that
 *  can't autosave should still be playable, not crash. */
export function autosave(game, stampMs = 0) {
  if (!storageOK()) return false;
  try {
    localStorage.setItem(STORAGE_KEY, serialize(makeSave(game, { slot: AUTOSAVE_SLOT, stampMs })));
    return true;
  } catch { return false; }
}

/** The stored autosave envelope, or null if there is none / it's unreadable. */
export function loadAutosave() {
  if (!storageOK()) return null;
  const text = localStorage.getItem(STORAGE_KEY);
  if (!text) return null;
  const r = deserialize(text);
  return r.error ? null : r.save;
}

/** Is there a resumable game? Cheap check for the splash's Continue button. */
export function hasSave() {
  if (!storageOK()) return false;
  return !!localStorage.getItem(STORAGE_KEY);
}

/** Throw the autosave away (used on abandon / new game over an old one). */
export function clearSave() {
  if (!storageOK()) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** A tiny summary of the stored save for the splash, without loading the world. */
export function savedSummary() {
  const save = loadAutosave();
  if (!save) return null;
  const g = save.state;
  return {
    name: g.player?.name,
    credits: g.player?.credits,
    where: g.status === "transit" ? "under way" : g.player?.at,
    dateISO: new Date(g.t).toISOString().slice(0, 10),
    label: save.label,
  };
}
