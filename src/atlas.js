// ===========================================================================
// THE ATLAS — what the captain has learned about the real solar system.
//
// Research as play (docs/site-atlas.md part 5): the census facts are the
// treasure. Every place in data/places.js — occupied or not, port or bare
// feature — has an entry here, and entries are REVEALED by playing:
//
//   • Earth-system places are known from the start (you grew up there)
//   • docking somewhere reveals that place
//   • arriving anywhere with a survey lab fitted reveals the WHOLE system,
//     including the places nobody occupied this run and the features nothing
//     can occupy (the Kirkwood gaps, Tranquility Base, the Van Allen belts)
//
// So a finished campaign leaves the player owning a mental map of the actual
// solar system, because owning one paid. Pure functions over game state.
// ===========================================================================

import { PLACES } from "./data/places.js";
import { SYSTEMS } from "./data/bodies.js";

/** Is this atlas entry revealed to this captain? */
export function isRevealed(game, place) {
  if (place.system === "earth") return true;                       // home ground
  if ((game.visited || []).includes(place.id)) return true;        // been there
  if ((game.surveyed || []).includes(place.system)) return true;   // swept it
  return false;
}

/**
 * The whole atlas, grouped by system in board order, each entry flagged with
 * what the UI needs: revealed, occupied this run (and by what), or feature.
 */
export function atlasFor(game) {
  const bySystem = [];
  for (const sys of SYSTEMS) {
    const places = PLACES.filter((p) => p.system === sys.id);
    if (!places.length) continue;
    bySystem.push({
      system: sys,
      surveyed: sys.id === "earth" || (game.surveyed || []).includes(sys.id),
      places: places.map((p) => {
        const site = (game.sites || []).find((s) => s.id === p.id);
        return {
          place: p,
          revealed: isRevealed(game, p),
          feature: p.occupiable === false,
          site: site || null,                    // the port here this run, if any
          visited: (game.visited || []).includes(p.id),
        };
      }),
    });
  }
  return bySystem;
}

/** "12 of 47 charted" — the collector's count for the header. */
export function atlasProgress(game) {
  const total = PLACES.length;
  const known = PLACES.filter((p) => isRevealed(game, p)).length;
  return { known, total };
}
