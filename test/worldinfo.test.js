// ===========================================================================
// WORLD INFO — system character and the news feed.
//
// These pin that a place reads as itself (tech, government, danger, pressure)
// and that the news is deterministic, reachable-by-tech, and points at the real
// state of the world the faction draw created.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { systemInfo, generateNews, newsReach } from "../src/worldinfo.js";
import { newGame } from "../src/tradergame.js";
import { newPlayer } from "../src/player.js";
import { defaultSkills } from "../src/data/captain.js";
import { SITE_BY_ID, techOf, govOf, GOVERNMENTS, TECH_LEVELS } from "../src/data/sites.js";
import { SITES } from "../src/data/sites.js";

const at = (siteId, seed = 42) => {
  const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), seed);
  return { ...g, player: { ...g.player, at: siteId } };
};

describe("system character is well-formed", () => {
  it("every site has a real tech level and government", () => {
    for (const s of SITES) {
      expect(techOf(s).n, s.id).toBeGreaterThanOrEqual(1);
      expect(govOf(s).paper, s.id).toBeTruthy();
    }
  });

  it("Earth orbit is high-tech; the outer frontier is low-tech", () => {
    expect(techOf(SITE_BY_ID.leo).n).toBeGreaterThan(techOf(SITE_BY_ID["callisto-station"]).n);
  });

  it("systemInfo reports character for any site", () => {
    const info = systemInfo(at("leo"), "leo");
    expect(info.tech.name).toBeTruthy();
    expect(info.gov.type).toBeTruthy();
    expect(typeof info.danger).toBe("number");
    expect(info.pressure).toBeTruthy();
  });

  it("a pirate-controlled region reads as more dangerous than a patrolled one", () => {
    // Construct the two extremes so the check doesn't depend on the random draw.
    const pirates = { player: { at: "ceres-port" }, factions: [{ factionId: "black-sun", siteId: "ceres-port", standing: -30 }], markets: {} };
    const patrol = { player: { at: "leo" }, factions: [{ factionId: "sol-patrol", siteId: "leo", standing: 5 }], markets: {} };
    expect(systemInfo(pirates, "ceres-port").danger).toBeGreaterThan(systemInfo(patrol, "leo").danger);
  });

  it("a crisis faction shows up as pressure", () => {
    const g = { player: { at: "jezero-station" }, factions: [{ factionId: "shortage", siteId: "jezero-station", standing: 15 }], markets: {} };
    expect(systemInfo(g, "jezero-station").pressure.toLowerCase()).toContain("crisis");
  });
});

describe("the news feed", () => {
  it("is deterministic — same world, same news", () => {
    const g = at("leo", 7);
    expect(generateNews(g)).toEqual(generateNews(g));
  });

  it("names the local paper after the government", () => {
    expect(generateNews(at("leo")).paper).toBe(GOVERNMENTS.consortium.paper);
    expect(generateNews(at("callisto-station")).paper).toBe(GOVERNMENTS.agency.paper);
  });

  it("carries headlines about this run's factions", () => {
    const news = generateNews(at("leo", 42));
    expect(news.items.length).toBeGreaterThan(0);
    for (const it of news.items) expect(it.headline).toBeTruthy();
  });

  it("a high-tech port hears about other systems; a low-tech one mostly doesn't", () => {
    // Earth orbit (tech 7) reaches far; Callisto (tech 2) hears mostly its own.
    expect(newsReach(SITE_BY_ID.leo).far).toBe(true);
    expect(newsReach(SITE_BY_ID["callisto-station"]).far).toBe(false);

    // Concretely: at low-tech Callisto, every faction headline is about the
    // Jupiter system (its own), never a distant one.
    const local = generateNews(at("callisto-station", 42));
    for (const it of local.items) {
      if (it.siteId) expect(SITE_BY_ID[it.siteId].system).toBe("jupiter");
    }
  });

  it("surfaces a real crisis when the draw contains one", () => {
    // Find a seed whose draw includes the life-support crisis faction, then check
    // the news reports it as a crisis headline from a high-tech, far-reaching port.
    let seed = -1;
    for (let s = 0; s < 60; s++) {
      const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), s);
      if (g.factions.some((f) => f.factionId === "shortage")) { seed = s; break; }
    }
    expect(seed).toBeGreaterThanOrEqual(0);
    const news = generateNews(at("leo", seed));
    expect(news.items.some((i) => i.kind === "crisis")).toBe(true);
  });
});
