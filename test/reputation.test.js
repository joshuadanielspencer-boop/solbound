// ===========================================================================
// REPUTATION — the standing track, and the ledger behind it.
//
// What these guard, in order of how badly each would hurt:
//
//   1. THE LEDGER MATCHES THE WORLD. Every entry records where the number
//      LANDED, not just how far it moved — because standing clamps at ±100, so
//      a list of deltas cannot be added back up. If the receipts disagree with
//      the total, the screen is lying about the player's own history.
//   2. THE BANDS MATCH THE DISPOSITIONS. A faction the data calls hostile must
//      not read as "Neutral" on its first screen; a friendly one must not read
//      as suspicious. The ladder is the only place those words are decided.
//   3. THE EFFECT IS SHARED, NOT COPIED. encounters.js reads the talk bonus
//      from here. If someone re-inlines it, the standing screen starts stating
//      a number the resolver no longer uses.
//   4. SAVES SURVIVE. A v8 save has real standing and no receipts; it must load
//      with an empty ledger rather than a broken one.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  REP_TIERS, REP_MIN, REP_MAX, repTier, reputationTrack, standingWith, repAt,
  repEntries, appendRepLog, repLedger, standingTalkBonus, talkBonusPct, REP_LOG_MAX,
} from "../src/reputation.js";
import { newGame } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";
import { DISPOSITION_START, FACTION_BY_ID } from "../src/data/factions.js";
import { applyOutcome, legRng } from "../src/encounters.js";
import { makeSave, serialize, deserialize, SAVE_VERSION } from "../src/save.js";

const game = (over = {}) => {
  const g = newGame(newPlayer({ name: "Vega", skills: defaultSkills() }), 42);
  return { ...g, ...over };
};

// A resolved outcome, hand-built, so a test can move exactly the standing it means to.
const outcome = (standing, over = {}) => ({
  encounterId: "inspection",
  choice: "comply",
  label: "Comply",
  won: true,
  headline: "They waved you through.",
  detail: "",
  effects: {
    credits: 0, hullDamage: 0, fuelTonnes: 0, days: 0,
    cargoLost: {}, cargoGained: {}, standing, record: null, destroyed: false,
    ...over,
  },
});

describe("the ladder", () => {
  it("covers the whole range, high to low, with no gap", () => {
    for (let s = REP_MIN; s <= REP_MAX; s++) expect(repTier(s), `standing ${s}`).toBeTruthy();
    const mins = REP_TIERS.map((t) => t.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);      // ordered high → low
    expect(mins[mins.length - 1]).toBe(REP_MIN);                 // and the floor is covered
  });

  it("clamps beyond the ends rather than falling off them", () => {
    expect(repTier(999).id).toBe("honoured");
    expect(repTier(-999).id).toBe("hunted");
    expect(repTier(undefined).id).toBe("neutral");
  });

  it("every tier carries a word and a note, so colour is never the only signal", () => {
    for (const t of REP_TIERS) {
      expect(t.name, t.id).toBeTruthy();
      expect(t.note.length, t.id).toBeGreaterThan(20);
    }
  });

  // The bands exist to make the DATA's own words true on screen. A hostile
  // faction that greets you as "Neutral" means the ladder is mistuned.
  it("the starting dispositions land where their names promise", () => {
    expect(repTier(DISPOSITION_START.hostile).id).toBe("distrusted");
    expect(repTier(DISPOSITION_START.prickly).id).toBe("wary");
    expect(repTier(DISPOSITION_START.wary).id).toBe("wary");
    expect(repTier(DISPOSITION_START.neutral).id).toBe("neutral");
    expect(repTier(DISPOSITION_START.reserved).id).toBe("neutral");
    expect(repTier(DISPOSITION_START.lawful).id).toBe("neutral");
    expect(repTier(DISPOSITION_START.friendly).id).toBe("welcome");
  });
});

describe("what standing buys", () => {
  it("is a signed shift either way, biggest at the extremes", () => {
    expect(standingTalkBonus(100)).toBeGreaterThan(0);
    expect(standingTalkBonus(-100)).toBeLessThan(0);
    expect(standingTalkBonus(0)).toBe(0);
    expect(talkBonusPct(100)).toBe(40);
    expect(talkBonusPct(-100)).toBe(-40);
  });

  // If someone re-inlines the formula in encounters.js this test still passes,
  // so it is paired with the behavioural one below: standing must MOVE a bribe.
  it("moves a talk-down outcome in the resolver, not just on the screen", async () => {
    const { resolve } = await import("../src/encounters.js");
    const { ENCOUNTER_BY_ID } = await import("../src/data/encounters.js");
    const { SITE_BY_ID, govOf } = await import("../src/data/sites.js");
    const base = {
      player: newPlayer({ name: "V", skills: defaultSkills() }),
      site: SITE_BY_ID["jezero-station"],
      gov: govOf(SITE_BY_ID["jezero-station"]),
      danger: 0.5,
    };
    const wins = (standing) => {
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const o = resolve(ENCOUNTER_BY_ID["extortion"], "talk", {
          ...base,
          faction: { standing, faction: FACTION_BY_ID["black-sun"] },
          rng: legRng(7, i),
        });
        if (o.won) n++;
      }
      return n;
    };
    expect(wins(100)).toBeGreaterThan(wins(-100));
  });
});

describe("the track", () => {
  it("lists every placed actor, best standing first", () => {
    const g = game();
    const track = reputationTrack(g);
    expect(track.length).toBe(g.factions.length);
    for (let i = 1; i < track.length; i++) {
      expect(track[i - 1].standing).toBeGreaterThanOrEqual(track[i].standing);
    }
  });

  it("says whether you are standing in their hall", () => {
    const g = game();
    const them = g.factions[0];
    const at = { ...g, player: { ...g.player, at: them.siteId } };
    const row = reputationTrack(at).find((r) => r.factionId === them.factionId);
    expect(row.atTheirPort).toBe(true);
    expect(row.inTheirSystem).toBe(true);
  });

  it("standingWith and repAt agree with the placement", () => {
    const g = game();
    const p = g.factions[0];
    expect(standingWith(g, p.factionId)).toBe(p.standing);
    expect(repAt(g, p.siteId).factionId).toBe(p.factionId);
    expect(repAt(g, "nowhere-at-all")).toBe(null);
    expect(standingWith(g, "no-such-faction")).toBe(0);
  });
});

describe("the ledger", () => {
  it("records where the number LANDED, not just how far it moved", () => {
    const g = game();
    const id = g.factions[0].factionId;
    const before = g.factions[0].standing;
    const next = applyOutcome(g, outcome({ [id]: -12 }));
    const entry = next.repLog.at(-1);
    expect(entry.factionId).toBe(id);
    expect(entry.delta).toBe(-12);
    expect(entry.standing).toBe(before - 12);
    expect(entry.standing).toBe(next.factions.find((f) => f.factionId === id).standing);
    expect(entry.t).toBe(g.t);
    expect(entry.reason).toContain("Comply");
  });

  // The clamp is exactly why entries carry the landed value. Deltas alone would
  // let the screen report a standing of +140 on a scale that stops at 100.
  it("stays truthful at the clamp, where deltas stop adding up", () => {
    const g = game();
    const id = g.factions[0].factionId;
    let s = { ...g, factions: g.factions.map((f) => (f.factionId === id ? { ...f, standing: 95 } : f)) };
    s = applyOutcome(s, outcome({ [id]: 40 }));
    const entry = s.repLog.at(-1);
    expect(entry.delta).toBe(40);
    expect(entry.standing).toBe(REP_MAX);
    expect(s.factions.find((f) => f.factionId === id).standing).toBe(REP_MAX);
  });

  it("files nothing for nameless raiders, who have no standing to move", () => {
    const g = game();
    const next = applyOutcome(g, outcome({ "not-in-this-run": -30 }));
    expect(next.repLog).toEqual([]);
    expect(next.factions).toEqual(g.factions);
  });

  it("a zero move is not an entry", () => {
    const g = game();
    expect(repEntries({ deltas: { [g.factions[0].factionId]: 0 }, factions: g.factions })).toEqual([]);
  });

  it("is capped, so a long run cannot grow the save without bound", () => {
    let log = [];
    for (let i = 0; i < REP_LOG_MAX + 25; i++) {
      log = appendRepLog(log, [{ t: i, factionId: "x", delta: 1, standing: i, reason: "r" }]);
    }
    expect(log.length).toBe(REP_LOG_MAX);
    expect(log.at(-1).t).toBe(REP_LOG_MAX + 24);       // the newest survives
    expect(log[0].t).toBe(25);                          // the oldest is trimmed
  });

  it("reads back newest first, and filters to one actor", () => {
    const g = game();
    const [a, b] = g.factions;
    let s = applyOutcome(g, outcome({ [a.factionId]: 5 }));
    s = applyOutcome(s, outcome({ [b.factionId]: -5 }));
    expect(repLedger(s)[0].factionId).toBe(b.factionId);
    expect(repLedger(s, { factionId: a.factionId }).length).toBe(1);
    expect(repLedger(s, { limit: 1 }).length).toBe(1);
  });
});

describe("saves", () => {
  it("a new game starts with an empty ledger", () => {
    expect(game().repLog).toEqual([]);
  });

  it("an old save loads with real standing and no receipts, rather than breaking", () => {
    const g = game();
    const old = { ...makeSave(g), version: 8 };
    delete old.state.repLog;
    const r = deserialize(serialize(old));
    expect(r.error).toBeUndefined();
    expect(r.save.version).toBe(SAVE_VERSION);
    expect(r.save.state.repLog).toEqual([]);
    expect(r.save.state.factions.map((f) => f.standing)).toEqual(g.factions.map((f) => f.standing));
  });

  it("the ledger survives a round trip", () => {
    const g = game();
    const next = applyOutcome(g, outcome({ [g.factions[0].factionId]: -7 }));
    const r = deserialize(serialize(makeSave(next)));
    expect(r.save.state.repLog).toEqual(next.repLog);
  });
});
