// ===========================================================================
// THE ENCOUNTER RESOLVER — what a decision in the dark actually costs you.
//
// The table lives in data/encounters.js. This is the machine that turns
// "a rolled encounter + the choice you made" into consequences that outlive it.
//
// THE CONTRACT (design.md §10), and it is the whole point of this file:
//
//     resolve(encounter, choice, context) → outcome
//
// A PURE FUNCTION. Everything that led here goes in — the captain's skills, the
// ship's fit, how full the hold is, who you're dealing with, how you stand with
// them, how lawless the region is. What comes out is never win/lose but: cargo
// taken, hull opened up, propellant burned evading, days lost, standing moved, a
// police record earned. Auto-resolve calls it and reports. A tactical mini-game,
// if it is ever built, becomes an interactive way of playing out the SAME call,
// with the player's moves perturbing its inputs. Same contract in, same
// consequences out — which is what makes the tactical layer additive instead of
// a rewrite.
//
// DETERMINISM IS NOT OPTIONAL HERE (save.js says so, and means it). Randomness
// comes from the run's seed plus a saved cursor, never Math.random. So:
//   • the encounter for a leg is rolled ONCE, at launch, and stored on the leg
//   • the outcome of a choice is drawn from a generator keyed to that same
//     cursor
// which means reloading a save and making the same choice gives the same result
// — no save-scumming a fight — while a DIFFERENT choice genuinely plays out
// differently. A shared seed replays exactly.
//
// WHERE THE LAW COMES IN. An inspection is thrown by the government of the port
// you are flying TO — interception is cheap near ports and absurd in deep space
// (design.md §10), so the patrol that stops you is the one whose dock you are
// approaching. Its `law` decides how often that happens and how hard it is to
// talk around; its `controls` and `duty` decide what it wants from your hold.
//
// STANDING lives on the placed faction (game.factions[].standing), which is
// where the spawn put it. This module returns deltas; applyOutcome writes them.
// ===========================================================================

import {
  ENCOUNTERS, ENCOUNTER_BY_ID, ACTIONS, KIND_BIAS_BY_ARCHETYPE,
  SALVAGE_FINDS, worsenRecord, recordIndex,
} from "./data/encounters.js";
import { SITE_BY_ID, govOf, controlsCommodity } from "./data/sites.js";
import { COMMODITY_BY_ID, CONTROLS } from "./data/commodities.js";
import { FACTION_BY_ID } from "./data/factions.js";
import { factionAt, regionDanger } from "./factions.js";
import { fittedStats } from "./data/hulls.js";
import { cargoUsed, cargoCapacity } from "./player.js";
import { seeded } from "./rng.js";

const DAY = 86400000;

/**
 * NO SINGLE ENCOUNTER MAY DESTROY A SOUND HULL. Damage is capped below 100, so
 * losing a fight in a pristine ship is always expensive and never fatal — you
 * die from flying a battered ship into another fight, which is a mistake you can
 * see coming and avoid. Anti-frustration, and a tested invariant.
 */
export const MAX_ENCOUNTER_DAMAGE = 45;

// ---------------------------------------------------------------------------
// Determinism plumbing
// ---------------------------------------------------------------------------

/** A generator keyed to (run seed, roll cursor, salt). Same inputs → same
 *  stream, forever, which is what makes a save replay and a reload not reroll. */
export function legRng(seed, cursor, salt = 0) {
  const a = Math.imul((seed >>> 0) ^ 0x9E3779B1, 0x85EBCA77);
  const b = Math.imul((cursor + 1) >>> 0, 0xC2B2AE3D);
  const c = Math.imul((salt + 1) >>> 0, 0x27D4EB2F);
  return seeded((a ^ b ^ c) >>> 0);
}

/** Weighted pick from [{ weight }], using `rng`. Returns null if nothing has weight. */
function weightedPick(rng, items, weightOf = (x) => x.weight) {
  const total = items.reduce((a, x) => a + Math.max(0, weightOf(x)), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const x of items) {
    r -= Math.max(0, weightOf(x));
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

const between = (rng, lo, hi) => lo + rng() * (hi - lo);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Rolling the leg — does anything happen out there, and what?
// ---------------------------------------------------------------------------

/**
 * The chance that a leg throws an encounter at all.
 *
 * A HAZARD RATE, not a flat per-trip number: exposure is what matters, so eight
 * months across a pirate coast is genuinely more dangerous than a six-day hop,
 * and the same route is safer once a navy moves in. Capped at four months of
 * exposure so a Jupiter run isn't a certainty.
 */
export function encounterChance(danger, days) {
  const months = clamp(days / 30, 0.15, 4);
  const perMonth = clamp(0.08 + Math.max(0, danger) * 0.55, 0, 0.85);
  return 1 - Math.pow(1 - perMonth, months);
}

/** Which column of KIND_BIAS_BY_ARCHETYPE a region's dominant actor reads from.
 *  A military faction splits two ways: its danger sign says whether it preys on
 *  the lanes or patrols them. */
export function biasKeyFor(faction) {
  if (!faction) return "none";
  if (faction.archetype === "military") return (faction.danger || 0) > 0 ? "military_hostile" : "military_lawful";
  return KIND_BIAS_BY_ARCHETYPE[faction.archetype] ? faction.archetype : "none";
}

/**
 * Draw one encounter from the table, biased by who holds the region and by how
 * lawful the destination is. `minDanger` encounters (the planned ambush) only
 * appear where the region is genuinely dangerous, and customs only appear where
 * there is someone to enforce it — a free port has no patrols to send.
 */
export function pickEncounter(rng, { biasKey = "none", danger = 0, law = 0.5, record = "clean" } = {}) {
  const bias = KIND_BIAS_BY_ARCHETYPE[biasKey] || KIND_BIAS_BY_ARCHETYPE.none;
  const pool = ENCOUNTERS.filter((e) => (e.minDanger ?? 0) <= danger);
  // A record you earned by running is a magnet for the next patrol.
  const recordPull = 1 + recordIndex(record) * 0.6;
  return weightedPick(rng, pool, (e) => {
    let w = e.weight * (bias[e.kind] ?? 1);
    if (e.kind === "authority") w *= clamp((law - 0.25) / 0.6, 0, 1) * recordPull;
    return w;
  });
}

/** Who you're dealing with out here. Hostile encounters belong to whoever makes
 *  the region dangerous; everything else to whoever holds the port ahead. */
function counterparty(game, leg, kind) {
  const to = SITE_BY_ID[leg.to], from = SITE_BY_ID[leg.from];
  const inSystem = (sys) => game.factions.filter((p) => SITE_BY_ID[p.siteId]?.system === sys);
  const near = [...inSystem(to?.system), ...inSystem(from?.system)];
  if (kind === "hostile") {
    const worst = near
      .map((p) => ({ p, f: FACTION_BY_ID[p.factionId] }))
      .filter((x) => (x.f?.danger || 0) > 0)
      .sort((a, b) => b.f.danger - a.f.danger)[0];
    return worst ? worst.p : null;      // null = nameless raiders, and no standing to move
  }
  return factionAt(game.factions, leg.to) || near[0] || null;
}

/**
 * Roll the whole leg at launch: whether something happens, what, and when.
 *
 * Returns one of:
 *   • { encounterId, atFraction, cursor, factionId, danger, law, biasKey } — pause here
 *   • { quiet: true, note } — nothing worth stopping for, but the sky wasn't empty
 *   • null — an uneventful crossing
 *
 * QUIET ENCOUNTERS DO NOT STOP THE CLOCK. A pause that offers no decision is an
 * interruption, not a beat, so "empty sky" becomes a line in the transit panel
 * instead. That lets the hazard rate be generous without being annoying.
 */
export function rollLegEvent(game, leg, cursor) {
  const to = SITE_BY_ID[leg.to], from = SITE_BY_ID[leg.from];
  if (!to || !from) return null;
  const rng = legRng(game.seed, cursor, 0);

  const danger = Math.max(
    regionDanger(game.factions, to.system),
    regionDanger(game.factions, from.system),
  );
  const law = govOf(to).law;
  if (rng() >= encounterChance(danger, leg.days)) return null;

  const control = factionAt(game.factions, leg.to) || factionAt(game.factions, leg.from);
  const biasKey = biasKeyFor(control?.faction);
  const enc = pickEncounter(rng, { biasKey, danger, law, record: game.player.record });
  if (!enc) return null;
  if (enc.kind === "quiet") return { quiet: true, note: enc.text };

  const party = counterparty(game, leg, enc.kind);
  return {
    encounterId: enc.id,
    atFraction: round2(between(rng, 0.15, 0.85)),
    cursor,
    factionId: party?.factionId || null,
    danger: round2(danger),
    law,
    biasKey,
  };
}

// ---------------------------------------------------------------------------
// Contraband — what a patrol wants from your hold
// ---------------------------------------------------------------------------

/**
 * The controlled cargo aboard under a given government, and the duty owed on it.
 * Legal goods, legally sold — but a strict port wants its paperwork and its cut,
 * and the cut scales with what you're carrying, which is what makes the richest
 * runs the ones a patrol most wants to stop.
 */
export function controlledCargo(player, gov) {
  const lines = [];
  let duty = 0, value = 0;
  for (const [id, tonnes] of Object.entries(player.cargo || {})) {
    const c = COMMODITY_BY_ID[id];
    if (!c || tonnes <= 0 || !controlsCommodity(gov, c)) continue;
    const v = c.valuePerTonne * tonnes;
    value += v;
    duty += v * (gov.duty || 0);
    lines.push({ id, name: c.name, tonnes: round2(tonnes), control: CONTROLS[c.control]?.name, value: Math.round(v) });
  }
  return { lines, value: Math.round(value), duty: Math.round(duty), any: lines.length > 0 };
}

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

const skill = (p, k) => p.skills?.[k] ?? 4;
const stats = (p) => fittedStats(p.ship.hull, p.ship.modules) || { weapon: 0, defense: 0, fuelTonnes: 30 };
const loadFraction = (p) => {
  const cap = cargoCapacity(p);
  return cap > 0 ? clamp(cargoUsed(p) / cap, 0, 1) : 0;
};

const blank = () => ({
  credits: 0, hullDamage: 0, fuelTonnes: 0, days: 0,
  cargoLost: {}, cargoGained: {}, standing: {}, record: null, destroyed: false,
});

/** How hard whoever this is hits. Region danger plus the encounter's own stakes:
 *  a planned ambush at a chokepoint is a worse fight than a chancer. */
const foeStrength = (danger, enc) =>
  2 + Math.max(0, danger) * 5 + (enc.stakes?.hullAtRisk || 0) * 3;

/**
 * Take `fraction` of the hold, most valuable first — raiders know what's worth
 * the mass. Never takes more than is aboard.
 */
function takeCargo(player, fraction) {
  const held = Object.entries(player.cargo || {}).filter(([, t]) => t > 0);
  const total = held.reduce((a, [, t]) => a + t, 0);
  if (total <= 0 || fraction <= 0) return {};
  let want = total * clamp(fraction, 0, 1);
  const byValue = held.sort((a, b) =>
    (COMMODITY_BY_ID[b[0]]?.valuePerTonne || 0) - (COMMODITY_BY_ID[a[0]]?.valuePerTonne || 0));
  const lost = {};
  for (const [id, tonnes] of byValue) {
    if (want <= 0.005) break;
    const take = Math.min(tonnes, want);
    lost[id] = round2(take);
    want -= take;
  }
  return lost;
}

/** Damage from a hit, softened by shielding, capped so a sound hull survives. */
function damageFrom(rng, foe, player) {
  const soak = 1 - clamp(stats(player).defense * 0.14, 0, 0.55);
  return Math.round(clamp(between(rng, 0.55, 1.15) * foe * 4.2 * soak, 4, MAX_ENCOUNTER_DAMAGE));
}

const named = (ctx) => ctx.faction?.faction?.name || "them";
const moveStanding = (ctx, delta) =>
  ctx.faction?.factionId ? { [ctx.faction.factionId]: delta } : {};

// --- the handlers, one per action -----------------------------------------

const HANDLERS = {
  fight(enc, ctx) {
    const { player, rng, danger } = ctx;
    const foe = foeStrength(danger, enc);
    const attack = 1 + stats(player).weapon * 1.8 + skill(player, "fighter") * 0.8;
    const won = rng() < attack / (attack + foe);
    const e = blank();

    if (won) {
      e.hullDamage = Math.round(damageFrom(rng, foe, player) * 0.45);
      e.fuelTonnes = -round2(between(rng, 0.2, 0.8));
      e.days = Math.round(between(rng, 1, 4));
      Object.assign(e.standing, moveStanding(ctx, enc.kind === "authority" ? -25 : -12));
      if (enc.kind === "authority") e.record = worsenRecord(player.record, 2);
      // Beaten raiders leave things behind. Not a payday — a consolation.
      const bounty = Math.round(between(rng, 4000, 22000) * (1 + Math.max(0, danger)));
      e.credits = bounty;
      return {
        won: true,
        headline: "You drove them off.",
        detail: `The exchange was short. ${e.hullDamage} points off the hull, ${bounty.toLocaleString()} credits' worth of `
          + `salvage out of what they dropped, and ${e.days} day${e.days === 1 ? "" : "s"} lost getting back on the trajectory.`,
        effects: e,
      };
    }

    e.hullDamage = damageFrom(rng, foe, player);
    e.cargoLost = takeCargo(player, enc.stakes?.cargoAtRisk ?? 0.5);
    e.fuelTonnes = -round2(between(rng, 0.3, 1.2));
    e.days = Math.round(between(rng, 2, 6));
    Object.assign(e.standing, moveStanding(ctx, enc.kind === "authority" ? -35 : -8));
    if (enc.kind === "authority") e.record = worsenRecord(player.record, 3);
    const destroyed = (player.ship.hullPct ?? 100) - e.hullDamage <= 0;
    e.destroyed = destroyed;
    return {
      won: false,
      headline: destroyed ? "They cut you open." : "You lost the exchange.",
      detail: destroyed
        ? "The hull was already too far gone to take it. The ship comes apart around you."
        : `${e.hullDamage} points off the hull, and they took what they came for before breaking off.`,
      effects: e,
    };
  },

  flee(enc, ctx) {
    const { player, rng, danger } = ctx;
    const escape = 1 + skill(player, "pilot") * 0.9 + (1 - loadFraction(player)) * 2.5;
    const chase = 2 + Math.max(0, danger) * 4;
    const got = rng() < escape / (escape + chase);
    const e = blank();
    // Running is a burn, and a burn is propellant and a bent trajectory.
    e.fuelTonnes = -round2(between(rng, 0.04, 0.09) * stats(player).fuelTonnes);
    e.days = Math.round(between(rng, 2, 9));

    if (enc.kind === "authority") {
      // Running from a patrol is remembered whether or not they catch you.
      e.record = worsenRecord(player.record, got ? 1 : 2);
      Object.assign(e.standing, moveStanding(ctx, got ? -14 : -22));
      if (!got) {
        const owed = controlledCargo(player, ctx.gov);
        e.credits = -Math.min(player.credits, Math.round((owed.duty || 25000) * 2.5));
        e.hullDamage = Math.round(damageFrom(rng, chase, player) * 0.4);
      }
      return {
        won: got,
        headline: got ? "You outran the patrol." : "The patrol ran you down.",
        detail: got
          ? `Fuel spent and days lost, and your name is in a log now. ${named(ctx)} do not forget a ship that runs.`
          : `They matched you, boarded, and made the fine hurt. ${Math.abs(e.credits).toLocaleString()} credits, and a mark on your record.`,
        effects: e,
      };
    }

    if (got) {
      return {
        won: true,
        headline: "You burned clear.",
        detail: `A hard burn away from the intercept — ${Math.abs(e.fuelTonnes).toFixed(1)} t of propellant and `
          + `${e.days} days off the schedule, but the hold is intact.`,
        effects: e,
      };
    }
    e.hullDamage = damageFrom(rng, foeStrength(danger, enc), player);
    e.cargoLost = takeCargo(player, (enc.stakes?.cargoAtRisk ?? 0.5) * 0.7);
    e.destroyed = (player.ship.hullPct ?? 100) - e.hullDamage <= 0;
    Object.assign(e.standing, moveStanding(ctx, -6));
    return {
      won: false,
      headline: e.destroyed ? "They caught you, and finished it." : "They ran you down.",
      detail: e.destroyed
        ? "You did not have the hull left to take a hit while running."
        : "You were too heavy to get away. They put a hole in you and helped themselves on the way past.",
      effects: e,
    };
  },

  submit(enc, ctx) {
    const { player, rng } = ctx;
    const e = blank();
    e.cargoLost = takeCargo(player, enc.stakes?.cargoAtRisk ?? 0.6);
    e.days = Math.round(between(rng, 1, 3));
    if (!Object.keys(e.cargoLost).length) {
      // An empty hold is its own kind of insult. They take a cut of the till.
      e.credits = -Math.min(player.credits, Math.round(player.credits * 0.06));
    }
    return {
      won: false,
      headline: "You opened the hold.",
      detail: Object.keys(e.cargoLost).length
        ? "They took the good stuff and left, which is the deal you made. Nobody was hurt, and the ship is whole."
        : `Nothing worth taking aboard, so they took ${Math.abs(e.credits).toLocaleString()} credits instead and let you go.`,
      effects: e,
    };
  },

  bribe(enc, ctx) {
    const { player, rng, danger } = ctx;
    const e = blank();
    const t = skill(player, "trader");

    if (enc.kind === "authority") {
      // Offering money to a patrol is a gamble against how lawful they are —
      // and a strict administration is exactly the one you cannot buy.
      const caught = rng() < clamp(ctx.gov.law * 0.85 - (t - 4) * 0.04, 0.05, 0.95);
      const owed = controlledCargo(player, ctx.gov);
      if (caught) {
        e.credits = -Math.min(player.credits, Math.round((owed.duty || 20000) * 3 + 15000));
        e.record = worsenRecord(player.record, 2);
        Object.assign(e.standing, moveStanding(ctx, -25));
        e.days = Math.round(between(rng, 2, 5));
        return {
          won: false,
          headline: "They logged the offer.",
          detail: `The officer wrote down what you said, word for word, and fined you `
            + `${Math.abs(e.credits).toLocaleString()} credits for it. It is on your record now.`,
          effects: e,
        };
      }
      const price = Math.round(clamp((owed.duty || 12000) * between(rng, 0.4, 0.75) * (1 - (t - 4) * 0.05), 2000, player.credits));
      e.credits = -price;
      e.days = 1;
      return {
        won: true,
        headline: "The inspection got shorter.",
        detail: `${price.toLocaleString()} credits, quietly, and nobody opened anything. Cheaper than the duty — this time.`,
        effects: e,
      };
    }

    // A shakedown: they name a price, and a good trader talks it down.
    const frac = clamp((enc.stakes?.creditsAtRisk ?? 0.15) * (1 - (t - 4) * 0.06), 0.02, 0.5);
    const price = Math.round(player.credits * frac);
    if (price <= 0 || player.credits < price || player.credits < 1000) {
      e.cargoLost = takeCargo(player, (enc.stakes?.cargoAtRisk ?? 0.5) * 0.8);
      e.days = Math.round(between(rng, 1, 3));
      return {
        won: false,
        headline: "You had nothing to offer.",
        detail: "They looked at your accounts, laughed, and took payment out of the hold instead.",
        effects: e,
      };
    }
    e.credits = -price;
    e.days = Math.round(between(rng, 1, 3));
    Object.assign(e.standing, moveStanding(ctx, danger > 0.4 ? 2 : 5));
    return {
      won: true,
      headline: "Paid, and waved through.",
      detail: `${price.toLocaleString()} credits buys you a clear lane. ${named(ctx)} will remember you as someone who pays — `
        + `which is worth something, and costs something.`,
      effects: e,
    };
  },

  comply(enc, ctx) {
    const { player, rng } = ctx;
    const e = blank();
    e.days = Math.round(between(rng, 1, 4));
    const owed = controlledCargo(player, ctx.gov);

    if (!owed.any) {
      Object.assign(e.standing, moveStanding(ctx, 3));
      return {
        won: true,
        headline: "Nothing to declare.",
        detail: `They walked the hold, checked the manifest against it, and thanked you for the time. `
          + `${e.days} day${e.days === 1 ? "" : "s"} gone, and a patrol that now knows your ship as a clean one.`,
        effects: e,
      };
    }
    const list = owed.lines.map((l) => `${l.tonnes} t of ${l.name.toLowerCase()}`).join(" and ");
    if (player.credits >= owed.duty) {
      e.credits = -owed.duty;
      Object.assign(e.standing, moveStanding(ctx, 2));
      return {
        won: true,
        headline: "Duty paid.",
        detail: `${list} aboard, and ${ctx.gov.type.toLowerCase()} wants its share: `
          + `${owed.duty.toLocaleString()} credits. Declared, stamped, and legal — your record stays clean.`,
        effects: e,
      };
    }
    // Can't pay: they take the cargo in lieu, which is the expensive way to learn
    // what a duty costs.
    const seized = {};
    let need = owed.duty - player.credits;
    for (const l of owed.lines) {
      if (need <= 0) break;
      const perTonne = COMMODITY_BY_ID[l.id].valuePerTonne;
      const take = Math.min(l.tonnes, need / perTonne);
      seized[l.id] = round2(take);
      need -= take * perTonne;
    }
    e.credits = -player.credits;
    e.cargoLost = seized;
    return {
      won: false,
      headline: "You could not cover the duty.",
      detail: `${owed.duty.toLocaleString()} credits owed on ${list}, and you did not have it. They took the balance out of the hold.`,
      effects: e,
    };
  },

  talk(enc, ctx) {
    const { player, rng } = ctx;
    const e = blank();
    const standing = ctx.faction?.standing ?? 0;
    const p = clamp(0.2 + skill(player, "trader") * 0.055 + standing / 250, 0.05, 0.9);
    e.days = Math.round(between(rng, 1, 4));
    if (rng() < p) {
      Object.assign(e.standing, moveStanding(ctx, 6));
      return {
        won: true,
        headline: "You talked your way out of it.",
        detail: `Names, routes, a favour owed somewhere — whatever it was, it worked. ${named(ctx)} let you pass, `
          + `and think a little better of you for the conversation.`,
        effects: e,
      };
    }
    if (enc.kind === "authority") {
      Object.assign(e.standing, moveStanding(ctx, -8));
      return {
        won: false,
        headline: "They were not interested.",
        detail: "You are welcome to comply, they say, or to explain yourself at the port. Nothing was lost but patience and days.",
        effects: e,
      };
    }
    const price = Math.round(player.credits * clamp(enc.stakes?.creditsAtRisk ?? 0.15, 0, 0.4));
    e.credits = -Math.min(player.credits, price);
    Object.assign(e.standing, moveStanding(ctx, -4));
    return {
      won: false,
      headline: "Talking made it worse.",
      detail: `They doubled down, and it cost you ${Math.abs(e.credits).toLocaleString()} credits to end the conversation.`,
      effects: e,
    };
  },

  help(enc, ctx) {
    const { player, rng } = ctx;
    const e = blank();
    const eng = skill(player, "engineer");
    // A better engineer fixes it faster. Time is the cost; goodwill is the pay.
    e.days = Math.round(clamp(between(rng, 6, 16) - eng * 0.7, 2, 20));
    e.fuelTonnes = -round2(between(rng, 0.2, 1.0));
    const goodwill = Math.round(clamp(8 + eng * 0.8 + between(rng, 0, 6), 6, 22));
    Object.assign(e.standing, moveStanding(ctx, goodwill));
    // Sometimes they can actually pay. Usually they can't, and say so.
    const paid = rng() < 0.45 ? Math.round(between(rng, 3000, 30000)) : 0;
    e.credits = paid;
    return {
      won: true,
      headline: enc.id === "conscript" ? "You took the cargo." : "You went alongside.",
      detail: `${e.days} days out of your schedule and ${Math.abs(e.fuelTonnes).toFixed(1)} t of propellant matching orbits. `
        + (paid ? `They paid what they could — ${paid.toLocaleString()} credits — and ` : "They had nothing to pay with, and ")
        + `word gets around. ${named(ctx)} owe you one.`,
      effects: e,
    };
  },

  ignore(enc, ctx) {
    const e = blank();
    if (enc.stakes?.karma || enc.stakes?.standingFaction === "nearest") {
      Object.assign(e.standing, moveStanding(ctx, -7));
      return {
        won: true,
        headline: "You flew on.",
        detail: "The channel stayed open for a while after you passed. Someone logged which ship did not stop, "
          + "and out here that list gets read.",
        effects: e,
      };
    }
    if (enc.kind === "authority") {
      Object.assign(e.standing, moveStanding(ctx, -10));
      e.record = worsenRecord(ctx.player.record, 1);
      return {
        won: false,
        headline: "You did not answer.",
        detail: "Ignoring a navy's request is not a crime. It is, however, filed.",
        effects: e,
      };
    }
    return {
      won: true,
      headline: "You minded your own business.",
      detail: "Whatever that was, it is behind you now.",
      effects: e,
    };
  },

  trade(enc, ctx) {
    const { player, rng } = ctx;
    const e = blank();
    const t = skill(player, "trader");
    e.days = Math.round(between(rng, 1, 3));
    const held = Object.entries(player.cargo || {}).filter(([, q]) => q > 0);

    if (held.length) {
      // They want something you have, and off-book means no house spread.
      const [id, tonnes] = held[Math.floor(rng() * held.length)];
      const c = COMMODITY_BY_ID[id];
      const qty = round2(Math.min(tonnes, Math.max(0.5, tonnes * between(rng, 0.4, 1))));
      const mult = clamp(between(rng, 1.05, 1.45) + (t - 4) * 0.02, 0.9, 1.8);
      const paid = Math.round(c.valuePerTonne * mult * qty);
      e.cargoLost = { [id]: qty };
      e.credits = paid;
      return {
        won: true,
        headline: "You made a deal.",
        detail: `${qty} t of ${c.name.toLowerCase()} across for ${paid.toLocaleString()} credits — `
          + `${Math.round((mult - 1) * 100)}% over the book price, and no port taking a cut.`,
        effects: e,
      };
    }

    // Empty hold: they're selling, and cheap — if you have room and money.
    const find = weightedPick(rng, SALVAGE_FINDS);
    const c = COMMODITY_BY_ID[find.id];
    const room = cargoCapacity(player) - cargoUsed(player);
    const mult = clamp(between(rng, 0.55, 0.85) - (t - 4) * 0.015, 0.35, 1);
    const affordable = player.credits / (c.valuePerTonne * mult);
    const qty = round2(clamp(Math.min(between(rng, find.min, find.max), room, affordable), 0, 1e6));
    if (qty < 0.1) {
      return {
        won: false,
        headline: "Nothing doing.",
        detail: "They had cargo to move and you had neither the room nor the money for it. You wished each other luck.",
        effects: e,
      };
    }
    e.cargoGained = { [find.id]: qty };
    e.credits = -Math.round(c.valuePerTonne * mult * qty);
    return {
      won: true,
      headline: "You bought off the books.",
      detail: `${qty} t of ${c.name.toLowerCase()} at ${Math.round(mult * 100)}% of book, `
        + `${Math.abs(e.credits).toLocaleString()} credits. What it's worth depends entirely on where you take it.`,
      effects: e,
    };
  },

  salvage(enc, ctx) {
    const { player, rng } = ctx;
    const e = blank();
    e.days = Math.round(between(rng, 2, 7));
    e.fuelTonnes = -round2(between(rng, 0.1, 0.6));

    // Wrecks are not always empty, and not always safe.
    if (rng() < (enc.stakes?.hullAtRisk || 0)) {
      e.hullDamage = Math.round(clamp(between(rng, 5, 18), 4, MAX_ENCOUNTER_DAMAGE));
      e.destroyed = (player.ship.hullPct ?? 100) - e.hullDamage <= 0;
      return {
        won: false,
        headline: "The wreck was not done killing people.",
        detail: e.destroyed
          ? "A charged capacitor bank let go as you cut in. Your ship had nothing left to absorb it."
          : `Something under pressure let go while you were cutting. ${e.hullDamage} points off the hull for nothing.`,
        effects: e,
      };
    }

    const find = weightedPick(rng, SALVAGE_FINDS);
    const c = COMMODITY_BY_ID[find.id];
    const room = Math.max(0, cargoCapacity(player) - cargoUsed(player));
    const eng = skill(player, "engineer");
    const qty = round2(clamp(between(rng, find.min, find.max) * (0.7 + eng * 0.07), 0, room));
    if (qty < 0.1) {
      return {
        won: false,
        headline: "No room for any of it.",
        detail: "There was salvage worth taking and nowhere to put it. You logged the position and moved on.",
        effects: e,
      };
    }
    e.cargoGained = { [find.id]: qty };
    return {
      won: true,
      headline: "You came away with something.",
      detail: `${find.text} ${qty} t of ${c.name.toLowerCase()} aboard, for ${e.days} days and a little propellant. `
        + `It cost you nothing but time, which is the only reason it was worth doing.`,
      effects: e,
    };
  },
};

/**
 * RESOLVE — the contract. Pure: same encounter, same choice, same context (and
 * the same rng stream) always give the same outcome.
 *
 * `context` = { player, site, gov, faction, danger, rng }, where `site`/`gov` are
 * the port being approached and `faction` is the placed counterparty (or null for
 * nameless raiders).
 */
export function resolve(encounter, choice, context) {
  const enc = typeof encounter === "string" ? ENCOUNTER_BY_ID[encounter] : encounter;
  if (!enc) return { error: "no-such-encounter" };
  if (!enc.actions.includes(choice)) return { error: "illegal-choice" };
  const handler = HANDLERS[choice];
  if (!handler) return { error: "no-handler" };

  const out = handler(enc, context);
  return {
    encounterId: enc.id,
    choice,
    label: ACTIONS[choice]?.label || choice,
    won: !!out.won,
    headline: out.headline,
    detail: out.detail,
    effects: out.effects,
  };
}

// ---------------------------------------------------------------------------
// Applying an outcome to the world
// ---------------------------------------------------------------------------

/**
 * Fold an outcome's effects into the game. Pure — returns a new game.
 *
 * The invariants that stop an encounter being an exploit or a soft-lock:
 *   • you cannot lose cargo you don't have, or more of it than you hold
 *   • credits never go below zero
 *   • gained cargo never overflows the hold
 *   • the tank never goes negative (you arrive dry, not owing propellant)
 *   • lost days push the ARRIVAL back, so time spent is time really spent
 */
export function applyOutcome(game, outcome) {
  const e = outcome.effects;
  const p = game.player;

  const cargo = { ...p.cargo };
  const costBasis = { ...(p.costBasis || {}) };
  for (const [id, qty] of Object.entries(e.cargoLost || {})) {
    const have = cargo[id] || 0;
    const gone = Math.min(have, qty);
    const left = round2(have - gone);
    if (left > 0.001) cargo[id] = left;
    else { delete cargo[id]; delete costBasis[id]; }
  }
  // Salvage and off-book buys go in at what they cost you, which for salvage is
  // nothing — so the sell screen honestly reports the whole price as profit.
  let free = cargoCapacity(p) - Object.values(cargo).reduce((a, b) => a + b, 0);
  for (const [id, qty] of Object.entries(e.cargoGained || {})) {
    const take = round2(Math.max(0, Math.min(qty, free)));
    if (take <= 0) continue;
    const had = cargo[id] || 0;
    const prev = costBasis[id] || 0;
    const unit = e.credits < 0 && Object.keys(e.cargoGained).length === 1
      ? Math.abs(e.credits) / Math.max(take, 0.001) : 0;
    costBasis[id] = (had * prev + take * unit) / (had + take);
    cargo[id] = round2(had + take);
    free -= take;
  }

  const hullPct = Math.max(0, (p.ship.hullPct ?? 100) - (e.hullDamage || 0));
  const player = {
    ...p,
    credits: Math.max(0, Math.round(p.credits + (e.credits || 0))),
    cargo, costBasis,
    record: e.record || p.record,
    ship: {
      ...p.ship,
      hullPct,
      fuelTonnes: Math.max(0, round2(p.ship.fuelTonnes + (e.fuelTonnes || 0))),
    },
  };

  const factions = game.factions.map((f) =>
    e.standing?.[f.factionId] !== undefined
      ? { ...f, standing: clamp(f.standing + e.standing[f.factionId], -100, 100) }
      : f);

  // Days lost push the arrival back; the clock then drifts the markets over them
  // for free, so a delay genuinely changes the prices you arrive to.
  const leg = game.leg && e.days
    ? { ...game.leg, arriveT: game.leg.arriveT + e.days * DAY }
    : game.leg;

  const next = {
    ...game,
    player, factions, leg,
    log: [...(game.log || []), `${outcome.headline} (${outcome.label})`],
  };
  if (e.destroyed || hullPct <= 0) {
    next.over = {
      reason: "destroyed",
      headline: outcome.headline,
      detail: outcome.detail,
      t: game.t,
    };
  }
  return next;
}

// ---------------------------------------------------------------------------
// The game-level wrapper the UI calls
// ---------------------------------------------------------------------------

/** Everything the encounter panel needs to draw itself, from a pending event. */
export function encounterView(game) {
  const pending = game.encounter;
  if (!pending) return null;
  const enc = ENCOUNTER_BY_ID[pending.encounterId];
  if (!enc) return null;
  const site = SITE_BY_ID[game.leg?.to] || SITE_BY_ID[game.player.at];
  const gov = govOf(site);
  const faction = pending.factionId
    ? { ...game.factions.find((f) => f.factionId === pending.factionId), faction: FACTION_BY_ID[pending.factionId] }
    : null;
  return {
    encounter: enc,
    faction: faction?.faction ? faction : null,
    site, gov,
    danger: pending.danger,
    actions: enc.actions.map((id) => ACTIONS[id]).filter(Boolean),
    controlled: enc.stakes?.contrabandCheck ? controlledCargo(game.player, gov) : null,
    outcome: pending.outcome || null,
  };
}

/**
 * Resolve the pending encounter with the player's choice and fold the result
 * into the world. The outcome is stored ON the game (not in component state) so
 * an autosave mid-encounter can't lose it, and so a reload shows the same result.
 */
export function resolveEncounter(game, choice) {
  const view = encounterView(game);
  if (!view) return { error: "no-encounter" };
  if (game.encounter.outcome) return { error: "already-resolved" };

  const site = view.site;
  const outcome = resolve(view.encounter, choice, {
    player: game.player,
    site,
    gov: view.gov,
    faction: view.faction,
    danger: game.encounter.danger ?? regionDanger(game.factions, site.system),
    // Salt 1 keeps the resolution stream separate from the roll stream, so the
    // choice you make decides the outcome — and re-loading and choosing the same
    // thing gives the same answer.
    rng: legRng(game.seed, game.encounter.cursor ?? 0, 1),
  });
  if (outcome.error) return outcome;

  const applied = applyOutcome(game, outcome);
  return {
    game: { ...applied, encounter: { ...game.encounter, choice, outcome } },
    outcome,
  };
}

/** Close the encounter panel and get back under way. */
export function dismissEncounter(game) {
  if (!game.encounter) return game;
  return { ...game, encounter: null, rateIdx: game.status === "transit" ? Math.max(1, game.rateIdx) : 0 };
}
