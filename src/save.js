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

import { initialMarkets } from "./market.js";
import { marketMods } from "./factions.js";
import { CORE_SITES } from "./data/sites.js";

export const SAVE_VERSION = 9;
const STORAGE_KEY = "solbound.save.v1";      // versioned key so a hard format break can coexist
const AUTOSAVE_SLOT = "auto";

// ---------------------------------------------------------------------------
// SLOTS — more than one run at a time
// ---------------------------------------------------------------------------
//
// The game kept exactly one autosave, under one key, and "Continue" resumed it.
// That is fine for one captain and wrong for the shape the game is growing into:
// a Run and a Campaign are two different games (design.md §12), a seed is worth
// keeping to compare worlds, and a player who wants to try a smuggling run
// should not have to destroy the campaign they are twelve hours into.
//
// So a save now lives at `solbound.save.v1.slot.<n>` and the old single key is
// migrated into slot 1 the first time anything asks for the list. That migration
// is why the legacy key is still read here at all — deleting it would silently
// destroy the save of anybody who had been playing.
//
// SLOTS ARE NUMBERED RATHER THAN KEYED BY A GENERATED ID, because the number is
// something a person can be shown ("Run 3") and because reusing the lowest free
// number after a delete keeps the list from growing gaps forever. There is no
// account and no server: this is local storage on one machine, and the file
// export remains the way a run moves between machines.
const SLOT_PREFIX = "solbound.save.v1.slot.";
export const MAX_SLOTS = 6;

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
  // v1 → v2: cost-basis tracking. Old saves have no costBasis map; default it to
  // empty. The only cost is that goods bought before the upgrade show no
  // purchase price on their first sale — a cosmetic loss, not a broken world.
  1: (save) => {
    if (save.state?.player && !save.state.player.costBasis) save.state.player.costBasis = {};
    save.version = 2;
    return save;
  },
  // v2 → v3: hull integrity. Old ships have no hullPct; default them to pristine.
  2: (save) => {
    const ship = save.state?.player?.ship;
    if (ship && ship.hullPct === undefined) ship.hullPct = 100;
    save.version = 3;
    return save;
  },
  // v3 → v4: the encounter layer. Old saves have no roll cursor and no pending
  // encounter. Defaulting the cursor to 0 is safe BECAUSE the cursor is only
  // ever used with the seed to key a roll — an old save resumes with the same
  // world and simply starts its encounter sequence from the beginning. A leg
  // already under way when the save was made has no rolled event, so that one
  // crossing is quiet; every leg after it rolls normally.
  3: (save) => {
    const s = save.state;
    if (s) {
      if (s.rollCursor === undefined) s.rollCursor = 0;
      if (s.encounter === undefined) s.encounter = null;
      if (s.player && !s.player.record) s.player.record = "clean";
    }
    save.version = 4;
    return save;
  },
  // v4 → v5: contraband. A market's stock map is built once, at newGame, from
  // whatever commodities existed THEN — so an older save has no entry for arms
  // or fissiles anywhere, and those goods are untradeable in it forever. Nothing
  // looks broken; the feature is just silently absent, which is the worst kind of
  // save bug. Seed any commodity a site should now trade at its opening level,
  // leaving every existing stock exactly where the player left it.
  4: (save) => {
    const markets = save.state?.markets;
    if (markets) {
      const fresh = initialMarkets();
      for (const [siteId, m] of Object.entries(fresh)) {
        if (!markets[siteId]) { markets[siteId] = m; continue; }
        for (const [id, qty] of Object.entries(m.stock)) {
          if (markets[siteId].stock[id] === undefined) markets[siteId].stock[id] = qty;
        }
      }
    }
    save.version = 5;
    return save;
  },
  // v5 → v6: crew and the escape pod. Both default to "you have none", which is
  // the honest reading of a save written before either existed — and it means an
  // old captain is not silently handed a lifeboat they never bought.
  5: (save) => {
    const p = save.state?.player;
    if (p) {
      if (!Array.isArray(p.crew)) p.crew = [];
      if (p.ship && p.ship.escapePod === undefined) p.ship.escapePod = false;
    }
    save.version = 6;
    return save;
  },
  // v6 → v7: faction market modifiers now live ON each market. An older save's
  // markets have none, so its crises would quietly price like anywhere else —
  // the newspaper would report a colony starving while its shelves stayed full.
  // Recompute them from the save's own faction placement, which is deterministic
  // and still right.
  6: (save) => {
    const s = save.state;
    if (s?.markets && Array.isArray(s.factions)) {
      for (const [siteId, m] of Object.entries(s.markets)) {
        if (!m.mods) m.mods = marketMods(s.factions, siteId);
      }
    }
    save.version = 7;
    return save;
  },
  // v7 → v8: generated worlds. Sites now live ON the game (`state.sites`) and
  // each market carries its site snapshot. An old save's world was exactly the
  // seven core sites, so that is what it keeps — its home port, markets and
  // faction placements all stay precisely where the player left them, which is
  // the entire reason site ids derive from places and the core seven are
  // immortal. Also backfills the geography (`system`, `siteName`) that placed
  // factions now carry, and the `surveyed` list the atlas screen reads.
  7: (save) => {
    const s = save.state;
    if (s) {
      if (!Array.isArray(s.sites)) s.sites = JSON.parse(JSON.stringify(CORE_SITES));
      if (s.markets) {
        for (const [siteId, m] of Object.entries(s.markets)) {
          if (!m.site) m.site = s.sites.find((x) => x.id === siteId) || null;
        }
      }
      if (Array.isArray(s.factions)) {
        for (const p of s.factions) {
          const site = s.sites.find((x) => x.id === p.siteId);
          if (p.system === undefined) p.system = site?.system || null;
          if (p.siteName === undefined) p.siteName = site?.name || p.siteId;
        }
      }
      if (!Array.isArray(s.surveyed)) s.surveyed = [];
    }
    save.version = 8;
    return save;
  },
  // v8 → v9: the reputation ledger. An older save's standing numbers are real —
  // they were written onto `factions` all along — but nothing recorded how they
  // got there, and that history cannot be reconstructed (the encounters that
  // moved them are gone). So the ledger starts empty and fills from here on,
  // which is the honest reading: the standing screen shows the right numbers
  // with no receipts before this point, rather than inventing receipts.
  8: (save) => {
    const s = save.state;
    if (s && !Array.isArray(s.repLog)) s.repLog = [];
    save.version = 9;
    return save;
  },
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
  return save ? summarise(save) : null;
}

// ---------------------------------------------------------------------------
// The slot API — see the note beside SLOT_PREFIX for why this exists
// ---------------------------------------------------------------------------

const slotKey = (slot) => `${SLOT_PREFIX}${slot}`;

/** What a menu needs to show about a run without loading its world. */
function summarise(save, slot = null) {
  const g = save.state;
  return {
    slot,
    name: g.player?.name,
    credits: g.player?.credits,
    where: g.status === "transit" ? "under way" : g.player?.at,
    dateISO: new Date(g.t).toISOString().slice(0, 10),
    seed: g.seed,
    over: !!g.over,
    stampMs: save.stampMs || 0,
    label: save.label,
  };
}

/**
 * Move a pre-slots autosave into slot 1.
 *
 * Runs once, lazily, the first time anything asks about slots — and ONLY when
 * no slot is occupied, so it can never overwrite a real save. The old key is
 * left in place rather than deleted: it costs a few kilobytes and it means a
 * mistake here is recoverable rather than final.
 */
function adoptLegacySave() {
  if (!storageOK()) return;
  for (let i = 1; i <= MAX_SLOTS; i++) if (localStorage.getItem(slotKey(i))) return;
  const legacy = localStorage.getItem(STORAGE_KEY);
  if (!legacy) return;
  try { localStorage.setItem(slotKey(1), legacy); } catch { /* full or blocked */ }
}

/** Every run this browser is holding, most recently saved first. */
export function listSaves() {
  if (!storageOK()) return [];
  adoptLegacySave();
  const out = [];
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const text = localStorage.getItem(slotKey(i));
    if (!text) continue;
    const r = deserialize(text);
    // A slot that will not parse is reported as damaged rather than hidden. A
    // run vanishing from the list with no explanation is the worse failure.
    if (r.error) { out.push({ slot: i, damaged: true, message: r.message }); continue; }
    out.push(summarise(r.save, i));
  }
  return out.sort((a, b) => (b.stampMs || 0) - (a.stampMs || 0));
}

/** The lowest slot with nothing in it, or null when every one is taken. */
export function nextFreeSlot() {
  if (!storageOK()) return 1;
  adoptLegacySave();
  for (let i = 1; i <= MAX_SLOTS; i++) if (!localStorage.getItem(slotKey(i))) return i;
  return null;
}

/** Write a run to its slot. Same silent-failure contract as autosave(). */
export function saveToSlot(game, slot, stampMs = 0) {
  if (!storageOK() || !slot) return false;
  try {
    localStorage.setItem(slotKey(slot), serialize(makeSave(game, { slot, stampMs })));
    return true;
  } catch { return false; }
}

/** The save in a slot, or null. */
export function loadSlot(slot) {
  if (!storageOK() || !slot) return null;
  const text = localStorage.getItem(slotKey(slot));
  if (!text) return null;
  const r = deserialize(text);
  return r.error ? null : r.save;
}

/** Throw a run away. Irreversible, so the UI asks first. */
export function deleteSlot(slot) {
  if (!storageOK() || !slot) return;
  try { localStorage.removeItem(slotKey(slot)); } catch { /* ignore */ }
  // If slot 1 was the adopted legacy save, drop the legacy key with it —
  // otherwise the next call to listSaves() would helpfully resurrect it.
  if (Number(slot) === 1) { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }
}

/** Is there anything at all to continue? */
export const hasAnySave = () => listSaves().length > 0;
