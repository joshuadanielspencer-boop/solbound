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
    const pirates = { player: { at: "ceres-port" }, factions: [{ factionId: "black-sun", siteId: "ceres-port", system: "belt", standing: -30 }], markets: {} };
    const patrol = { player: { at: "leo" }, factions: [{ factionId: "sol-patrol", siteId: "leo", system: "earth", standing: 5 }], markets: {} };
    expect(systemInfo(pirates, "ceres-port").danger).toBeGreaterThan(systemInfo(patrol, "leo").danger);
  });

  it("a crisis faction shows up as pressure", () => {
    const g = { player: { at: "jezero-station" }, factions: [{ factionId: "shortage", siteId: "jezero-station", system: "mars", standing: 15 }], markets: {} };
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
    // Jupiter system (its own), never a distant one. Sites are generated per
    // run now, so look each one up in the game's OWN world, not the static list.
    const g = at("callisto-station", 42);
    const local = generateNews(g);
    for (const it of local.items) {
      if (it.siteId) expect(g.sites.find((s) => s.id === it.siteId).system).toBe("jupiter");
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

// ===========================================================================
// THE PAID NEWSPAPER, and the two-number safety readout.
//
// Both are Space Trader screens we had only half of: the news was free (in a
// game whose thesis is that information is a resource), and Police and Pirates
// were netted into one word that could not express the thing that matters most
// now that contraband exists.
// ===========================================================================
import { buyPaper, paperPrice, launch } from "../src/tradergame.js";
import { policeWord, pirateWord, policeLevel } from "../src/worldinfo.js";

describe("the paper costs money", () => {
  const g0 = () => newGame(newPlayer({ name: "V", skills: defaultSkills() }), 42);

  it("charges, and a better-connected port charges more", () => {
    const g = g0();
    const core = paperPrice(g);                                   // Gateway, tech 7
    const frontier = paperPrice({ ...g, player: { ...g.player, at: "callisto-station" } });
    expect(core).toBeGreaterThan(frontier);
    expect(frontier).toBeGreaterThan(0);
  });

  it("buying it takes the money and marks it read for this port", () => {
    const g = g0();
    const r = buyPaper(g);
    expect(r.game.player.credits).toBe(g.player.credits - r.spent);
    expect(r.game.paperAt).toBe(g.player.at);
    expect(buyPaper(r.game).error).toBe("already-read");
  });

  it("won't sell you one you can't afford", () => {
    const g = g0();
    expect(buyPaper({ ...g, player: { ...g.player, credits: 1 } }).error).toBe("credits");
  });

  it("leaving port means yesterday's paper", () => {
    const g = buyPaper(g0()).game;
    expect(launch(g, "shackleton").game.paperAt).toBeNull();
  });
});

describe("police and pirates are two readings, not one", () => {
  it("each has its own vocabulary, from safe to not", () => {
    expect(policeWord(0.9).word).toBe("Abundant");
    expect(policeWord(0.1).word).toBe("Absent");
    expect(pirateWord(0.9).word).toBe("Swarms");
    expect(pirateWord(0.05).word).toBe("Few");
  });

  it("a navy in the neighbourhood raises the police reading, not the pirate one", () => {
    const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), 42);
    const site = SITE_BY_ID["leo"];
    const alone = policeLevel({ ...g, factions: [] }, site);
    const patrolled = policeLevel({ ...g, factions: [{ factionId: "sol-patrol", siteId: "leo", system: "earth", standing: 5 }] }, site);
    expect(patrolled).toBeGreaterThan(alone);
  });

  it("a patrolled system reports low pirates AND high police at once", () => {
    // The distinction the split exists for: this is the best lane in the game
    // for a legal hold and the worst for a banned one, and one netted danger
    // word could not say both.
    const g = newGame(newPlayer({ name: "V", skills: defaultSkills() }), 42);
    const patrolled = { ...g, factions: [{ factionId: "sol-patrol", siteId: "leo", system: "earth", standing: 5 }] };
    const info = systemInfo(patrolled, "leo");
    expect(info.pirateWord).toBe("Few");
    expect(["Abundant", "Moderate"]).toContain(info.policeWord);
  });
});
