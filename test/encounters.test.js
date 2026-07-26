// ===========================================================================
// ENCOUNTERS — the risk layer.
//
// What these tests actually guard, in order of how badly each would hurt:
//
//   1. DETERMINISM. The whole save contract rests on it. A reload must replay
//      the same trouble and the same result, or every fight is save-scummable
//      and a shared seed means nothing.
//   2. THE ANTI-EXPLOITS. Nothing here may print money or cargo: you can't lose
//      cargo you don't have, can't gain more than the hold holds, can't drive
//      credits negative, can't run a shakedown for profit.
//   3. THE ANTI-FRUSTRATION INVARIANT. No single encounter destroys a sound
//      hull. You die from flying a battered ship into a second fight — a
//      mistake you can see coming — never from one unlucky roll at full health.
//   4. THAT THE INPUTS ACTUALLY MATTER. A laser must beat no laser; a light
//      hold must outrun a full one; the Trader skill must move a bribe. If the
//      choices that led here don't change the outcome, the layer is theatre.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  resolve, applyOutcome, resolveEncounter, dismissEncounter, encounterView,
  rollLegEvent, encounterChance, pickEncounter, biasKeyFor, controlledCargo,
  legRng, MAX_ENCOUNTER_DAMAGE,
} from "../src/encounters.js";
import { ENCOUNTER_BY_ID, RECORDS, recordIndex, worsenRecord } from "../src/data/encounters.js";
import { newGame, launch, advanceTime, travel } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";
import { GOVERNMENTS, SITE_BY_ID, govOf } from "../src/data/sites.js";
import { FACTION_BY_ID } from "../src/data/factions.js";

const game = (over = {}) => {
  const g = newGame(newPlayer({ name: "Vega", skills: defaultSkills() }), 42);
  return { ...g, ...over, player: { ...g.player, ...(over.player || {}) } };
};

// A resolution context built by hand, so a test can dial exactly one input.
const ctx = (over = {}) => ({
  player: newPlayer({ name: "V", skills: defaultSkills() }),
  site: SITE_BY_ID["jezero-station"],
  gov: govOf(SITE_BY_ID["jezero-station"]),
  faction: null,
  danger: 0.5,
  rng: legRng(1, 1),
  ...over,
});

const withCargo = (player, cargo) => ({ ...player, cargo });
const withSkills = (player, skills) => ({ ...player, skills: { ...player.skills, ...skills } });
const withShip = (player, ship) => ({ ...player, ship: { ...player.ship, ...ship } });

/** Run a choice many times over independent streams, and count the wins. */
const trials = (encounterId, choice, over = {}, n = 400) => {
  let wins = 0;
  const outs = [];
  for (let i = 0; i < n; i++) {
    const o = resolve(ENCOUNTER_BY_ID[encounterId], choice, ctx({ ...over, rng: legRng(7, i) }));
    outs.push(o);
    if (o.won) wins++;
  }
  return { rate: wins / n, outs };
};

// ---------------------------------------------------------------------------

describe("the resolver honours its contract", () => {
  it("refuses a choice the encounter doesn't offer", () => {
    expect(resolve(ENCOUNTER_BY_ID.pirate, "salvage", ctx()).error).toBe("illegal-choice");
    expect(resolve("nope", "fight", ctx()).error).toBe("no-such-encounter");
  });

  it("every action every encounter offers actually resolves", () => {
    // A table entry listing an action the resolver can't handle would be a
    // dead button in the middle of a fight.
    for (const enc of Object.values(ENCOUNTER_BY_ID)) {
      for (const a of enc.actions) {
        const o = resolve(enc, a, ctx({ player: withCargo(ctx().player, { machinery: 6 }) }));
        expect(o.error, `${enc.id}/${a}`).toBeUndefined();
        expect(o.headline, `${enc.id}/${a}`).toBeTruthy();
        expect(o.detail, `${enc.id}/${a}`).toBeTruthy();
        expect(o.effects, `${enc.id}/${a}`).toBeTruthy();
      }
    }
  });

  it("never mutates its inputs", () => {
    const c = ctx({ player: withCargo(ctx().player, { machinery: 8, medical: 1 }) });
    const snap = JSON.stringify(c.player);
    resolve(ENCOUNTER_BY_ID.pirate, "fight", c);
    resolve(ENCOUNTER_BY_ID.inspection, "comply", c);
    expect(JSON.stringify(c.player)).toBe(snap);
  });

  it("is deterministic: same encounter, same choice, same stream → same outcome", () => {
    const a = resolve(ENCOUNTER_BY_ID.pirate, "fight", ctx({ rng: legRng(9, 3) }));
    const b = resolve(ENCOUNTER_BY_ID.pirate, "fight", ctx({ rng: legRng(9, 3) }));
    expect(a).toEqual(b);
  });
});

describe("the choices that led here decide it", () => {
  it("a laser wins fights a bare hull loses", () => {
    const bare = trials("pirate", "fight");
    const armed = trials("pirate", "fight", {
      player: withShip(newPlayer({ name: "V", skills: defaultSkills() }), { modules: ["laser"] }),
    });
    expect(armed.rate).toBeGreaterThan(bare.rate + 0.1);
  });

  it("the Fighter skill wins fights the Trader loses", () => {
    const base = newPlayer({ name: "V", skills: defaultSkills() });
    const brawler = trials("pirate", "fight", { player: withSkills(base, { fighter: 10 }) });
    const clerk = trials("pirate", "fight", { player: withSkills(base, { fighter: 1 }) });
    expect(brawler.rate).toBeGreaterThan(clerk.rate + 0.1);
  });

  it("shielding softens the hit you take when you lose", () => {
    const base = newPlayer({ name: "V", skills: defaultSkills() });
    const avg = (o) => o.outs.filter((x) => !x.won).reduce((a, x) => a + x.effects.hullDamage, 0)
      / Math.max(1, o.outs.filter((x) => !x.won).length);
    const bare = avg(trials("pirate", "fight", { player: base }));
    const armoured = avg(trials("pirate", "fight", { player: withShip(base, { modules: ["shield"] }) }));
    expect(armoured).toBeLessThan(bare);
  });

  it("a light hold outruns a full one — mass is what the chase charges for", () => {
    const base = newPlayer({ name: "V", skills: defaultSkills() });
    const empty = trials("pirate", "flee", { player: base });
    const loaded = trials("pirate", "flee", { player: withCargo(base, { machinery: 12 }) });
    expect(empty.rate).toBeGreaterThan(loaded.rate + 0.05);
  });

  it("the Pilot skill is what makes running work", () => {
    const base = newPlayer({ name: "V", skills: defaultSkills() });
    const ace = trials("pirate", "flee", { player: withSkills(base, { pilot: 10 }) });
    const lubber = trials("pirate", "flee", { player: withSkills(base, { pilot: 1 }) });
    expect(ace.rate).toBeGreaterThan(lubber.rate + 0.1);
  });

  it("a better Trader pays less to be waved through", () => {
    const base = { ...newPlayer({ name: "V", skills: defaultSkills() }), credits: 400000 };
    const cost = (skills) => {
      let total = 0;
      for (let i = 0; i < 200; i++) {
        const o = resolve(ENCOUNTER_BY_ID.extortion, "bribe",
          ctx({ player: withSkills(base, skills), rng: legRng(3, i) }));
        total += -o.effects.credits;
      }
      return total / 200;
    };
    expect(cost({ trader: 10 })).toBeLessThan(cost({ trader: 1 }));
  });

  it("standing you've earned helps you talk your way out", () => {
    const rate = (standing) => {
      let wins = 0;
      for (let i = 0; i < 300; i++) {
        const o = resolve(ENCOUNTER_BY_ID.extortion, "talk", ctx({
          faction: { factionId: "free-belt", faction: FACTION_BY_ID["free-belt"], standing },
          rng: legRng(11, i),
        }));
        if (o.won) wins++;
      }
      return wins / 300;
    };
    expect(rate(90)).toBeGreaterThan(rate(-90));
  });
});

describe("nothing here prints money or cargo", () => {
  it("you cannot lose cargo you do not have", () => {
    const empty = ctx({ player: withCargo(ctx().player, {}) });
    for (const choice of ["fight", "flee", "submit", "bribe"]) {
      for (let i = 0; i < 50; i++) {
        const o = resolve(ENCOUNTER_BY_ID.pirate, choice, { ...empty, rng: legRng(5, i) });
        expect(Object.keys(o.effects.cargoLost)).toEqual([]);
      }
    }
  });

  it("cargo taken never exceeds what is aboard", () => {
    const c = ctx({ player: withCargo(ctx().player, { machinery: 4, parts: 2 }) });
    let everTaken = 0;
    for (const [encId, choice] of [["pirate", "submit"], ["ambush", "fight"], ["ambush", "flee"], ["extortion", "bribe"]]) {
      for (let i = 0; i < 120; i++) {
        const o = resolve(ENCOUNTER_BY_ID[encId], choice, { ...c, rng: legRng(6, i) });
        for (const [id, qty] of Object.entries(o.effects.cargoLost)) {
          expect(qty, `${encId}/${choice}`).toBeLessThanOrEqual(c.player.cargo[id] + 1e-9);
          everTaken++;
        }
      }
    }
    expect(everTaken).toBeGreaterThan(0);        // and the test isn't vacuous
  });

  it("salvage never overflows the hold", () => {
    // A courier holds 12 t. Fill it to 11.5 and see what a wreck can add.
    let g = game();
    g = { ...g, player: withCargo(g.player, { machinery: 11.5 }) };
    for (let i = 0; i < 200; i++) {
      const o = resolve(ENCOUNTER_BY_ID.windfall, "salvage", ctx({ player: g.player, rng: legRng(8, i) }));
      const after = applyOutcome(g, o);
      const used = Object.values(after.player.cargo).reduce((a, b) => a + b, 0);
      expect(used).toBeLessThanOrEqual(12.0001);
    }
  });

  it("credits never go negative, however bad it gets", () => {
    let g = game();
    g = { ...g, player: { ...g.player, credits: 500, cargo: { medical: 2 } } };
    for (let i = 0; i < 200; i++) {
      for (const choice of ["comply", "bribe", "flee"]) {
        const o = resolve(ENCOUNTER_BY_ID.inspection, choice, ctx({ player: g.player, rng: legRng(4, i) }));
        expect(applyOutcome(g, o).player.credits).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("the tank never goes negative — you arrive dry, not owing propellant", () => {
    let g = game();
    g = { ...g, player: withShip(g.player, { fuelTonnes: 0.2 }) };
    for (let i = 0; i < 100; i++) {
      const o = resolve(ENCOUNTER_BY_ID.pirate, "flee", ctx({ player: g.player, rng: legRng(2, i) }));
      expect(applyOutcome(g, o).player.ship.fuelTonnes).toBeGreaterThanOrEqual(0);
    }
  });

  it("submitting is never free — an empty hold pays in credits instead", () => {
    const g = { ...game(), player: { ...game().player, cargo: {}, credits: 200000 } };
    const o = resolve(ENCOUNTER_BY_ID.pirate, "submit", ctx({ player: g.player }));
    expect(o.effects.credits).toBeLessThan(0);
    expect(applyOutcome(g, o).player.credits).toBeLessThan(g.player.credits);
  });

  it("running never gains you anything", () => {
    for (let i = 0; i < 200; i++) {
      const o = resolve(ENCOUNTER_BY_ID.pirate, "flee",
        ctx({ player: withCargo(ctx().player, { machinery: 5 }), rng: legRng(12, i) }));
      expect(o.effects.credits).toBeLessThanOrEqual(0);
      expect(Object.keys(o.effects.cargoGained)).toEqual([]);
      expect(o.effects.fuelTonnes).toBeLessThan(0);   // a burn is always a burn
    }
  });
});

describe("no single encounter destroys a sound hull", () => {
  it("damage is capped below fatal", () => {
    expect(MAX_ENCOUNTER_DAMAGE).toBeLessThan(100);
  });

  it("a pristine ship survives every outcome of every encounter", () => {
    const g = game();
    expect(g.player.ship.hullPct).toBe(100);
    for (const enc of Object.values(ENCOUNTER_BY_ID)) {
      for (const a of enc.actions) {
        for (let i = 0; i < 40; i++) {
          const o = resolve(enc, a, ctx({ player: g.player, danger: 1, rng: legRng(13, i) }));
          expect(o.effects.hullDamage, `${enc.id}/${a}`).toBeLessThanOrEqual(MAX_ENCOUNTER_DAMAGE);
          expect(o.effects.destroyed, `${enc.id}/${a}`).toBe(false);
        }
      }
    }
  });

  it("but a battered one can die — and the run ends when it does", () => {
    let g = game();
    g = { ...g, player: withShip(g.player, { hullPct: 8 }) };
    let died = false;
    for (let i = 0; i < 200 && !died; i++) {
      const o = resolve(ENCOUNTER_BY_ID.ambush, "fight", ctx({ player: g.player, danger: 1, rng: legRng(14, i) }));
      if (o.effects.destroyed) {
        died = true;
        const after = applyOutcome(g, o);
        expect(after.over?.reason).toBe("destroyed");
        expect(after.player.ship.hullPct).toBe(0);
      }
    }
    expect(died).toBe(true);
  });
});

describe("contraband and the law", () => {
  it("a strict administration polices what a free port does not", () => {
    const p = withCargo(newPlayer({ name: "V", skills: defaultSkills() }), { medical: 2, reactorparts: 1 });
    const strict = controlledCargo(p, GOVERNMENTS.agency);
    const free = controlledCargo(p, GOVERNMENTS.independent);
    expect(strict.any).toBe(true);
    expect(strict.duty).toBeGreaterThan(0);
    expect(free.any).toBe(false);
    expect(free.duty).toBe(0);
  });

  it("a corporate charter wants the reactor parts and ignores the medicine", () => {
    const p = withCargo(newPlayer({ name: "V", skills: defaultSkills() }), { medical: 2, reactorparts: 1 });
    const c = controlledCargo(p, GOVERNMENTS.consortium);
    expect(c.lines.map((l) => l.id)).toEqual(["reactorparts"]);
  });

  it("duty scales with what you are carrying — the richest run is the one they want to stop", () => {
    const one = controlledCargo(withCargo(newPlayer({ name: "V", skills: defaultSkills() }), { medical: 1 }), GOVERNMENTS.agency);
    const four = controlledCargo(withCargo(newPlayer({ name: "V", skills: defaultSkills() }), { medical: 4 }), GOVERNMENTS.agency);
    expect(four.duty).toBeCloseTo(one.duty * 4, -2);
  });

  it("complying with a clean hold costs nothing but days", () => {
    const c = ctx({ player: withCargo(ctx().player, { machinery: 5 }) });
    const o = resolve(ENCOUNTER_BY_ID.inspection, "comply", c);
    expect(o.effects.credits).toBe(0);
    expect(Object.keys(o.effects.cargoLost)).toEqual([]);
    expect(o.effects.record).toBeNull();
    expect(o.effects.days).toBeGreaterThan(0);
  });

  it("complying with controlled cargo pays the duty and keeps the record clean", () => {
    const p = { ...withCargo(ctx().player, { medical: 2 }), credits: 5_000_000 };
    const o = resolve(ENCOUNTER_BY_ID.inspection, "comply", ctx({ player: p }));
    const owed = controlledCargo(p, govOf(SITE_BY_ID["jezero-station"]));
    expect(o.effects.credits).toBe(-owed.duty);
    expect(o.effects.record).toBeNull();          // paying a duty is not a crime
    expect(o.won).toBe(true);
  });

  it("running from a patrol always marks your record, caught or not", () => {
    for (let i = 0; i < 60; i++) {
      const o = resolve(ENCOUNTER_BY_ID.inspection, "flee", ctx({ player: ctx().player, rng: legRng(15, i) }));
      expect(recordIndex(o.effects.record)).toBeGreaterThan(recordIndex("clean"));
    }
  });

  it("the record ladder bottoms out instead of running off the end", () => {
    expect(worsenRecord("wanted")).toBe("wanted");
    expect(worsenRecord("clean", 99)).toBe(RECORDS[RECORDS.length - 1].id);
  });

  it("a record makes the next patrol likelier to stop you", () => {
    const share = (record) => {
      let authority = 0;
      for (let i = 0; i < 400; i++) {
        const e = pickEncounter(legRng(21, i), { biasKey: "military_lawful", danger: 0.2, law: 0.85, record });
        if (e.kind === "authority") authority++;
      }
      return authority / 400;
    };
    expect(share("wanted")).toBeGreaterThan(share("clean"));
  });
});

describe("the roll — how often, and what kind", () => {
  it("danger and exposure both raise the odds", () => {
    expect(encounterChance(0.8, 30)).toBeGreaterThan(encounterChance(0.1, 30));
    expect(encounterChance(0.4, 240)).toBeGreaterThan(encounterChance(0.4, 6));
    expect(encounterChance(0.9, 900)).toBeLessThanOrEqual(1);
    expect(encounterChance(0, 6)).toBeGreaterThan(0);      // space is never perfectly safe
  });

  it("a six-day cislunar hop through quiet space is usually uneventful", () => {
    expect(encounterChance(0.1, 6)).toBeLessThan(0.1);
  });

  it("who holds a region decides what it throws at you", () => {
    const kinds = (biasKey) => {
      const out = {};
      for (let i = 0; i < 500; i++) {
        const e = pickEncounter(legRng(31, i), { biasKey, danger: 0.6, law: 0.8 });
        out[e.kind] = (out[e.kind] || 0) + 1;
      }
      return out;
    };
    const pirates = kinds("military_hostile"), navy = kinds("military_lawful");
    expect(pirates.hostile).toBeGreaterThan(navy.hostile);
    expect(navy.authority).toBeGreaterThan(pirates.authority || 0);
  });

  it("a military faction's danger sign decides which column it reads", () => {
    expect(biasKeyFor(FACTION_BY_ID["black-sun"])).toBe("military_hostile");
    expect(biasKeyFor(FACTION_BY_ID["sol-patrol"])).toBe("military_lawful");
    expect(biasKeyFor(FACTION_BY_ID["kestrel-industrial"])).toBe("economic");
    expect(biasKeyFor(null)).toBe("none");
  });

  it("customs do not appear where there is no law to enforce", () => {
    let authority = 0;
    for (let i = 0; i < 600; i++) {
      const e = pickEncounter(legRng(41, i), { biasKey: "none", danger: 0.5, law: 0.3 });
      if (e.kind === "authority") authority++;
    }
    expect(authority / 600).toBeLessThan(0.05);
  });

  it("the ambush only waits where the region is genuinely dangerous", () => {
    for (let i = 0; i < 300; i++) {
      expect(pickEncounter(legRng(51, i), { biasKey: "military_hostile", danger: 0.2, law: 0.5 }).id)
        .not.toBe("ambush");
    }
  });

  it("the same seed rolls the same trouble, every time", () => {
    const a = newGame(newPlayer({ name: "A", skills: defaultSkills() }), 77);
    const b = newGame(newPlayer({ name: "B", skills: defaultSkills() }), 77);
    const leg = { from: "leo", to: "jezero-station", days: 259 };
    expect(rollLegEvent(a, leg, 0)).toEqual(rollLegEvent(b, leg, 0));
  });

  it("a different cursor is a different roll — trouble doesn't repeat forever", () => {
    const g = game();
    const leg = { from: "leo", to: "jezero-station", days: 259 };
    const rolls = Array.from({ length: 12 }, (_, i) => JSON.stringify(rollLegEvent(g, leg, i)));
    expect(new Set(rolls).size).toBeGreaterThan(1);
  });
});

describe("the clock stops for it, like an arrival", () => {
  // Find a seed whose first Mars leg actually throws something, so the wiring is
  // tested against a real event rather than a mocked one.
  const seedWithEncounter = () => {
    for (let s = 1; s < 400; s++) {
      const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), s);
      const l = launch(g, "jezero-station");
      if (l.game?.leg?.event) return { seed: s, launched: l.game };
    }
    return null;
  };

  it("some seed, somewhere, throws an encounter on the way to Mars", () => {
    expect(seedWithEncounter()).not.toBeNull();
  });

  it("the clock stops AT the encounter, short of arrival, and pauses itself", () => {
    const { launched } = seedWithEncounter();
    const r = advanceTime(launched, launched.leg.arriveT);
    expect(r.encounter).toBeTruthy();
    expect(r.game.t).toBe(launched.leg.event.atT);
    expect(r.game.t).toBeLessThan(launched.leg.arriveT);
    expect(r.game.rateIdx).toBe(0);
    expect(r.game.status).toBe("transit");        // still flying; just stopped
    expect(r.game.player.at).toBe("leo");
  });

  it("an unresolved encounter holds the clock — you cannot fast-forward past it", () => {
    const { launched } = seedWithEncounter();
    const stopped = advanceTime(launched, launched.leg.arriveT).game;
    const again = advanceTime(stopped, stopped.t + 500 * 86400000);
    expect(again.game.t).toBe(stopped.t);
    expect(again.game.player.at).toBe("leo");
  });

  it("resolving it, then dismissing it, lets the ship fly on and arrive", () => {
    const { launched } = seedWithEncounter();
    const stopped = advanceTime(launched, launched.leg.arriveT).game;
    const view = encounterView(stopped);
    const res = resolveEncounter(stopped, view.encounter.actions[0]);
    expect(res.outcome).toBeTruthy();
    expect(res.game.encounter.outcome).toBeTruthy();      // stored on the game, so a reload keeps it
    const flying = dismissEncounter(res.game);
    expect(flying.encounter).toBeNull();
    const done = advanceTime(flying, flying.leg.arriveT + 1);
    expect(done.arrived).toBeTruthy();
    expect(done.game.player.at).toBe("jezero-station");
  });

  it("it only fires once per leg", () => {
    const { launched } = seedWithEncounter();
    const stopped = advanceTime(launched, launched.leg.arriveT).game;
    const res = resolveEncounter(stopped, encounterView(stopped).encounter.actions[0]);
    const flying = dismissEncounter(res.game);
    const done = advanceTime(flying, flying.leg.arriveT + 1);
    expect(done.encounter).toBeUndefined();
    expect(done.arrived).toBeTruthy();
  });

  it("won't resolve the same encounter twice", () => {
    const { launched } = seedWithEncounter();
    const stopped = advanceTime(launched, launched.leg.arriveT).game;
    const res = resolveEncounter(stopped, encounterView(stopped).encounter.actions[0]);
    expect(resolveEncounter(res.game, "ignore").error).toBe("already-resolved");
  });

  it("time lost pushes the arrival back, so the delay is a real delay", () => {
    const { launched } = seedWithEncounter();
    const stopped = advanceTime(launched, launched.leg.arriveT).game;
    const before = stopped.leg.arriveT;
    const view = encounterView(stopped);
    // Pick an action that always costs days.
    const choice = view.encounter.actions.find((a) => ["help", "salvage", "flee", "submit", "comply", "trade"].includes(a))
      || view.encounter.actions[0];
    const res = resolveEncounter(stopped, choice);
    if (res.outcome.effects.days > 0) expect(res.game.leg.arriveT).toBeGreaterThan(before);
  });

  it("the fast-forward button cannot change the world", () => {
    // The roll happens once, at launch, keyed to the seed — NOT per tick. If it
    // were per tick, playing at 120 days a second would roll fewer checks than
    // playing paused, and the clock rate would be a difficulty setting.
    const { launched } = seedWithEncounter();
    const oneJump = advanceTime(launched, launched.leg.arriveT).game;
    let stepped = launched;
    for (let i = 1; i <= 40; i++) {
      const r = advanceTime(stepped, launched.t + (launched.leg.arriveT - launched.t) * (i / 40));
      stepped = r.game;
      if (stepped.encounter) break;
    }
    expect(stepped.encounter?.encounterId).toBe(oneJump.encounter?.encounterId);
    expect(stepped.t).toBeCloseTo(oneJump.t, -2);
  });

  it("a quiet leg is texture, not an interruption", () => {
    // "Empty sky" is in the table with the heaviest weight, and it must never
    // stop the clock — a pause that offers no decision is an interruption.
    let quiet = null;
    for (let s = 1; s < 400 && !quiet; s++) {
      const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), s);
      const l = launch(g, "jezero-station");
      if (l.game?.leg?.quietNote) quiet = l.game;
    }
    expect(quiet).not.toBeNull();
    expect(quiet.leg.event).toBeNull();
    const done = advanceTime(quiet, quiet.leg.arriveT);
    expect(done.arrived).toBeTruthy();            // flew straight through
  });
});

describe("headless travel still takes the risk", () => {
  it("travel() reports what happened on the way", () => {
    // A headless crossing that skipped encounters would be a second, safer game.
    let any = false;
    for (let s = 1; s < 60 && !any; s++) {
      const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), s);
      const r = travel(g, "jezero-station");
      if (r.events?.length) {
        any = true;
        expect(r.arrived || r.over).toBeTruthy();
        expect(r.events[0].headline).toBeTruthy();
      }
    }
    expect(any).toBe(true);
  });

  it("a crossing always ends somewhere — arrived, or over", () => {
    for (let s = 1; s < 40; s++) {
      const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), s);
      const r = travel(g, "shackleton");
      expect(r.arrived || r.over).toBeTruthy();
    }
  });
});

describe("consequences that outlive the encounter", () => {
  it("standing moves on the placed faction, and stays in bounds", () => {
    const g = game();
    const fid = g.factions[0].factionId;
    const o = { headline: "x", label: "y", effects: { ...blankish(), standing: { [fid]: 999 } } };
    const after = applyOutcome(g, o);
    expect(after.factions.find((f) => f.factionId === fid).standing).toBe(100);
    const down = applyOutcome(g, { headline: "x", label: "y", effects: { ...blankish(), standing: { [fid]: -999 } } });
    expect(down.factions.find((f) => f.factionId === fid).standing).toBe(-100);
  });

  it("hull damage lands where the Ship Yard can already repair it", () => {
    const g = game();
    const after = applyOutcome(g, { headline: "x", label: "y", effects: { ...blankish(), hullDamage: 30 } });
    expect(after.player.ship.hullPct).toBe(70);
  });

  it("salvage arrives with a zero cost basis — it cost you time, not money", () => {
    const g = game();
    const o = resolve(ENCOUNTER_BY_ID.windfall, "salvage", ctx({ player: g.player, rng: legRng(61, 2) }));
    if (Object.keys(o.effects.cargoGained).length) {
      const after = applyOutcome(g, o);
      const id = Object.keys(o.effects.cargoGained)[0];
      expect(after.player.costBasis[id]).toBe(0);
    }
  });

  it("an encounter writes a line in the log", () => {
    const g = game();
    const after = applyOutcome(g, { headline: "They flew off.", label: "Run", effects: blankish() });
    expect(after.log[after.log.length - 1]).toContain("They flew off.");
  });
});

// A neutral effects block for the apply-layer tests.
function blankish() {
  return { credits: 0, hullDamage: 0, fuelTonnes: 0, days: 0, cargoLost: {}, cargoGained: {}, standing: {}, record: null, destroyed: false };
}
