// ===========================================================================
// WORLDGEN — spawning this run's ports over the fixed geography.
//
// The atlas equation (docs/site-atlas.md), executed:
//
//     place (fixed, real)  ×  installation (drawn)  ×  operator (drawn)
//
// The SEVEN CORE SITES never change — they are the educational spine, the
// tutorial geography, and what every existing save stands on. Around them,
// each run draws 9–13 more places from the census and rolls what got built
// there and who runs it. Ceres is always the water tower; whether Titan this
// run is a colony under a settler republic or a refinery under a utility
// concern is this seed's business.
//
// Everything here is SEEDED and PURE, like spawnFactions: same seed → same
// world, so saves replay and a shared seed is a shared map.
//
// Derivation rules (the atlas's "how they combine"):
//   produces   = place.resources ∪ installation.produce ∪ operator.blackMarket
//   consumes   = people's needs (minus what's local) + installation.needs
//   techLevel  = installation.baseTech + operator.techMod, clamped 1..7
//   population = installation.scale, jittered, scaled by habitability
//   government = the operator (law, tariff, bans — see data/operators.js)
// ===========================================================================

import { OCCUPIABLE, CORE_PLACES } from "./data/places.js";
import { INSTALLATION_BY_ID, installationFits } from "./data/installations.js";
import { OPERATORS, OPERATOR_IDS, operatorFits } from "./data/operators.js";
import { CORE_SITES } from "./data/sites.js";
import { seeded } from "./rng.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** "The Utopia ice sheet" → "Utopia"; "Hellas Basin" → "Hellas Basin". A short
 *  stem the site name can build on. */
function stem(placeName) {
  let n = placeName.replace(/^The /, "").split(",")[0];
  const cut = [" ice sheet", " cold traps", " crater", " basalt fields", " solar fields",
    " cloud deck", " swarms", " anchorage", " high anchorage", " lava tube", " mines", " Basin"];
  for (const c of cut) n = n.replace(c, "");
  // Title-case each word, so "ring mines" becomes a name and not a phrase.
  return n.trim().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * How many people can actually live here. Lethal ground halves a crew and
 * forbids families; fierce sunlight and shelter make places roomier than
 * their installation alone would be.
 */
function populationFor(inst, place, rng) {
  const habMult = place.habitability === "lethal" ? 0.4 : place.shelter ? 1.2 : 1;
  return Math.max(4, Math.round(inst.scale * (0.7 + rng() * 0.6) * habMult));
}

/** Build one site from the atlas equation. Exported for tests. */
export function deriveSite(place, inst, opId, rng) {
  const op = OPERATORS[opId];
  const produces = [...new Set([
    ...place.resources,
    ...inst.produce.filter((id) =>
      id !== "propellant" || place.resources.includes("ice")),
    ...(op.blackMarket || []),
  ])];

  // People need food, air and medicine wherever they are; industry needs what
  // the installation says. Nothing consumes what it locally produces.
  const consumes = [...new Set([
    ...(produces.includes("food") ? [] : ["food"]),
    ...(inst.makes.includes("refined") ? [] : ["lifesupport"]),
    "medical",
    ...inst.needs,
  ])].filter((id) => !produces.includes(id));

  return {
    id: place.id,
    name: `${stem(place.name)} ${cap(inst.noun)}`,
    body: place.body, system: place.system, kind: place.kind,
    population: populationFor(inst, place, rng),
    owner: opId,
    techLevel: clamp(inst.baseTech + (op.techMod || 0), 1, 7),
    why: place.why,
    installation: inst.id,
    produces, consumes,
    makes: [...inst.makes],
    imports: [],
    note: inst.note,
  };
}

/**
 * Spawn this run's world: the seven core sites, plus 9–13 drawn places with
 * generated installations and operators.
 *
 * Guarantees that keep a run coherent and teachable:
 *   • the core seven are always present (saves, tutorials, tests stand on them)
 *   • at least one drawn site is INNER (Mercury/Venus) — the "near ≠ cheap"
 *     lesson always has somewhere to be learned
 *   • at least one drawn site is at Saturn or beyond — the far system always
 *     exists to aspire to, even when no starter ship can reach it
 *   • no place is occupied twice
 */
export function spawnSites(seed, extraCount = null) {
  const rng = seeded(((seed >>> 0) ^ 0x51735173) >>> 0);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const coreIds = new Set(CORE_PLACES.map((p) => p.id));
  const pool = shuffle(OCCUPIABLE.filter((p) => !coreIds.has(p.id)));
  const want = extraCount ?? 9 + Math.floor(rng() * 5);   // 9–13 extra

  const drawn = [];
  const take = (place) => {
    if (!place || drawn.includes(place)) return;
    drawn.push(place);
    pool.splice(pool.indexOf(place), 1);
  };

  // The guarantees first, then fill from the shuffle.
  take(pool.find((p) => ["mercury", "venus"].includes(p.system)));
  take(pool.find((p) => ["saturn", "neptune", "pluto"].includes(p.system)));
  while (drawn.length < want && pool.length) take(pool[0]);

  const sites = drawn.map((place) => {
    const fits = place.fits
      .map((id) => INSTALLATION_BY_ID[id])
      .filter((inst) => inst && installationFits(inst, place));
    const inst = fits.length ? pick(fits) : INSTALLATION_BY_ID.prospecting;
    const ops = OPERATOR_IDS.filter((opId) => operatorFits(opId, inst));
    const opId = ops.length ? pick(ops) : "independent";
    return deriveSite(place, inst, opId, rng);
  });

  return [...CORE_SITES, ...sites];
}
