// ===========================================================================
// MUSIC AND STARFIELD — the halves that can be tested without a browser.
//
// The engine itself needs an AudioContext and gets none here; what IS testable
// is everything that decides WHAT should sound and WHEN, which is where the
// bugs a player would notice actually live:
//
//   1. THE SCORES ARE PLAYABLE. Every note name has to parse to a frequency. A
//      typo like "H3" or "Db4" would silently drop a voice out of a chord, and
//      nobody would ever know which note went missing.
//   2. EVERY MOMENT HAS MUSIC. If a context has no cue that claims it, the
//      engine falls back to silence at exactly the moment something dramatic is
//      happening. Each context must be covered.
//   3. THE MUSIC FOLLOWS THE GAME, AND DOES NOT TWITCH AT IT. A cue that still
//      fits must be kept rather than restarted on every state change.
//   4. THE SKY DOES NOT SHIMMER. The starfield must be identical for the same
//      seed, or it redraws itself thirty times a second.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  noteToFreq, chordFreqs, beatSeconds, barSeconds, contextOf, cuesFor, cueFor, cueBars,
  keyRoot, sfxTranspose, semitoneRatio, sfxAllowed, sfxDuration,
} from "../src/audio.js";
import { SFX, SFX_IDS, RATE_LIMIT_MS } from "../src/data/sfx.js";
import { CUES, CUE_BY_ID, CONTEXTS, ROTATE_AFTER_SECONDS, CROSSFADE_SECONDS } from "../src/data/music.js";
import { starfield, galacticBand, TIERS } from "../src/starfield.js";

describe("the scores are playable", () => {
  it("every note in every cue parses to a real frequency", () => {
    for (const cue of CUES) {
      for (const chord of cue.chords) {
        for (const n of chord.notes) {
          const f = noteToFreq(n);
          expect(f, `${cue.id}: "${n}"`).not.toBe(null);
          expect(f, `${cue.id}: "${n}"`).toBeGreaterThan(20);      // below hearing
          expect(f, `${cue.id}: "${n}"`).toBeLessThan(4200);       // shrill
        }
        expect(chordFreqs(chord.notes).length).toBe(chord.notes.length);
      }
    }
  });

  it("concert pitch is where a piano tuner left it", () => {
    expect(noteToFreq("A4")).toBeCloseTo(440, 6);
    expect(noteToFreq("A3")).toBeCloseTo(220, 6);
    expect(noteToFreq("A5")).toBeCloseTo(880, 6);
    expect(noteToFreq("C4")).toBeCloseTo(261.626, 2);           // middle C
    expect(noteToFreq("F#3")).toBeCloseTo(184.997, 2);
  });

  it("refuses a note name it does not understand rather than guessing", () => {
    for (const bad of ["H3", "Db4", "", "A", "4A", null, undefined, "A#"]) {
      expect(noteToFreq(bad), String(bad)).toBe(null);
    }
    expect(chordFreqs(["A3", "H9", "C4"]).length).toBe(2);       // the bad one is dropped
  });

  it("every chord is written low note first, so the bass is the root", () => {
    for (const cue of CUES) {
      for (const chord of cue.chords) {
        const f = chordFreqs(chord.notes);
        expect(f[0], `${cue.id}`).toBe(Math.min(...f));
      }
    }
  });

  it("every cue carries a complete voice, a tempo and a name a player could read", () => {
    for (const cue of CUES) {
      expect(cue.name.length, cue.id).toBeGreaterThan(2);
      expect(cue.blurb.length, cue.id).toBeGreaterThan(20);
      expect(cue.bpm, cue.id).toBeGreaterThan(30);
      expect(cue.bpm, cue.id).toBeLessThan(200);
      expect(cue.chords.length, cue.id).toBeGreaterThan(1);
      const v = cue.voice;
      for (const k of ["padCutoff", "padDetune", "arpEvery", "bassEvery", "reverb", "air"]) {
        expect(typeof v[k], `${cue.id}.${k}`).toBe("number");
      }
      expect(v.air, cue.id).toBeLessThanOrEqual(1);
      // An arpeggio degree must exist in a four-note chord.
      for (const d of v.arp || []) expect(d, cue.id).toBeLessThan(4);
    }
  });

  it("ids are unique, and the lookup agrees with the list", () => {
    expect(new Set(CUES.map((c) => c.id)).size).toBe(CUES.length);
    expect(Object.keys(CUE_BY_ID).length).toBe(CUES.length);
  });

  it("bars and beats come out of the tempo the way a metronome would", () => {
    expect(beatSeconds(60)).toBe(1);
    expect(barSeconds(60)).toBe(4);
    expect(barSeconds(120)).toBe(2);
    // Nothing should state its whole progression in under fifteen seconds, or
    // the loop is audible as a loop.
    for (const cue of CUES) {
      expect(cueBars(cue) * barSeconds(cue.bpm), cue.id).toBeGreaterThan(15);
    }
  });
});

describe("every moment has music", () => {
  it("no context is left silent", () => {
    for (const c of CONTEXTS) {
      expect(cuesFor(c).length, c).toBeGreaterThan(0);
      expect(cueFor(c), c).toBeTruthy();
    }
  });

  it("reads the game state, with an encounter outranking everything", () => {
    const sys = (id) => ({ leo: "earth", "ceres-port": "belt", "callisto-station": "jupiter" }[id]);
    const g = (over) => ({ status: "docked", player: { at: "leo" }, ...over });
    expect(contextOf(g(), sys)).toBe("dock");
    expect(contextOf(g({ player: { at: "ceres-port" } }), sys)).toBe("belt");
    expect(contextOf(g({ player: { at: "callisto-station" } }), sys)).toBe("outer");
    expect(contextOf(g({ status: "transit", leg: { to: "leo" } }), sys)).toBe("transit");
    // Under way to the Belt is belt music, not generic transit — where you are
    // going is what the crossing feels like.
    expect(contextOf(g({ status: "transit", leg: { to: "ceres-port" } }), sys)).toBe("belt");
    // An unresolved encounter beats all of it.
    expect(contextOf(g({ encounter: { outcome: null } }), sys)).toBe("encounter");
    // A resolved one does not — the decision is made, the tension is over.
    expect(contextOf(g({ encounter: { outcome: {} } }), sys)).toBe("dock");
    expect(contextOf(null, sys)).toBe("dock");
  });

  it("keeps a cue that still fits rather than restarting on every tick", () => {
    const first = cueFor("dock");
    expect(cueFor("dock", first.id).id).toBe(first.id);
    expect(cueFor("dock", first.id, false).id).toBe(first.id);
  });

  it("rotates to a different cue when asked, and comes back round", () => {
    const set = cuesFor("dock");
    expect(set.length).toBeGreaterThan(1);          // or rotation is meaningless
    let id = set[0].id;
    const seen = new Set([id]);
    for (let i = 0; i < set.length; i++) { id = cueFor("dock", id, true).id; seen.add(id); }
    expect(seen.size).toBe(set.length);             // every cue in the set gets a turn
  });

  it("falls back to the first fitting cue when the previous one does not suit", () => {
    // Flying into an encounter: the calm cue does not claim "encounter", so the
    // engine must pick one that does rather than hold the wrong music.
    const enc = cueFor("encounter", "gateway");
    expect(enc.contexts).toContain("encounter");
  });

  it("crossfades slowly and rotates slowly — this is background, not a playlist", () => {
    expect(CROSSFADE_SECONDS).toBeGreaterThanOrEqual(3);
    expect(ROTATE_AFTER_SECONDS).toBeGreaterThan(120);
  });
});

describe("the starfield", () => {
  it("is identical for the same seed, so it cannot shimmer", () => {
    expect(starfield(1000, 7)).toEqual(starfield(1000, 7));
    expect(starfield(1000, 7)).not.toEqual(starfield(1000, 8));
  });

  it("draws every tier as one path, which is the whole point", () => {
    const f = starfield(1000, 42);
    expect(f.length).toBe(TIERS.length);
    for (const t of f) {
      expect(t.d.startsWith("M"), t.id).toBe(true);
      expect(t.d.includes("l0 0"), t.id).toBe(true);       // zero-length = a round dot
    }
  });

  it("stays inside the viewBox — a star outside it is wasted work", () => {
    for (const t of starfield(1000, 3)) {
      for (const m of t.d.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(0);
        expect(Number(m[1])).toBeLessThanOrEqual(1000);
        expect(Number(m[2])).toBeGreaterThanOrEqual(0);
        expect(Number(m[2])).toBeLessThanOrEqual(1000);
      }
    }
  });

  it("thins toward the middle, where the Sun's glow would drown them", () => {
    const inner = (avoid) => {
      let n = 0;
      for (const t of starfield(1000, 11, avoid)) {
        for (const m of t.d.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)) {
          const dx = Number(m[1]) - 500, dy = Number(m[2]) - 500;
          if (Math.sqrt(dx * dx + dy * dy) < 120) n++;
        }
      }
      return n;
    };
    expect(inner(120)).toBeLessThan(inner(0));
  });

  it("is dim enough that the planets stay the subject", () => {
    for (const t of TIERS) {
      expect(t.opacity, t.id).toBeLessThan(0.95);
      expect(t.size, t.id).toBeLessThan(5);
    }
    // Faint stars must outnumber bright ones, the way a real sky does.
    expect(TIERS[0].count).toBeGreaterThan(TIERS[TIERS.length - 1].count * 10);
  });

  it("puts the galactic band across the field, not through the middle of it", () => {
    const b = galacticBand(1000);
    expect(b.cy).not.toBe(500);
    expect(b.rx).toBeGreaterThan(b.ry * 3);       // a band, not a blob
  });

  it("does not leave the global generator seeded — the run must stay reproducible", () => {
    // withSeed's contract, exercised through starfield: the very bug rng.js
    // exists to prevent (a stray seeded generator making everything after it
    // deterministic in a way nobody asked for).
    starfield(1000, 99);
    const a = Math.random(), b = Math.random();
    expect(a).not.toBe(b);
  });
});

// ===========================================================================
// SOUND EFFECTS
//
// Same split as the music: the engine needs an AudioContext and gets none here,
// but everything that decides WHAT sounds and WHEN is plain arithmetic over
// plain data, and that is where a player-visible bug would actually live.
// ===========================================================================

describe("the effect definitions are playable", () => {
  it("every layer names a kind the engine can build", () => {
    for (const [id, def] of Object.entries(SFX)) {
      expect(def.layers.length, id).toBeGreaterThan(0);
      for (const l of def.layers) {
        expect(["tone", "noise"], `${id}`).toContain(l.kind);
        expect(l.dur, `${id}`).toBeGreaterThan(0);
        if (l.kind === "tone") {
          expect(l.freq, `${id}`).toBeGreaterThan(20);
          expect(l.freq, `${id}`).toBeLessThan(9000);
          expect(["sine", "square", "sawtooth", "triangle"], id).toContain(l.wave || "sine");
        }
      }
    }
  });

  it("stays short enough to be an effect and not an interruption", () => {
    // The longest thing here is the encounter alert, and even that has to stop.
    // A tone still sounding while somebody reads four options is not
    // information, it is pressure to click anything.
    for (const id of SFX_IDS) {
      expect(sfxDuration(SFX[id]), id).toBeLessThan(1.7);
    }
    expect(sfxDuration(SFX.alert)).toBeLessThan(1.1);
  });

  it("says, for every sound, what visible thing it marks", () => {
    // Project rule 4: sound is the second channel and never the only one. If a
    // sound cannot name what it accompanies on screen, it should not exist.
    for (const id of SFX_IDS) {
      expect(SFX[id].marks, id).toBeTruthy();
    }
  });

  it("keeps the levels inside a range that will not clip the bus", () => {
    for (const [id, def] of Object.entries(SFX)) {
      expect(def.gain, id).toBeGreaterThan(0);
      expect(def.gain, id).toBeLessThanOrEqual(0.6);
      const stacked = def.layers.reduce((n, l) => n + (l.peak ?? 0.4), 0);
      expect(stacked * def.gain, id).toBeLessThan(1);
    }
  });
});

describe("effects sit in the key the music is in", () => {
  it("reads the keys the scores are actually written in", () => {
    expect(keyRoot("A minor")).toBe(9);
    expect(keyRoot("C minor")).toBe(0);
    expect(keyRoot("D minor")).toBe(2);
    expect(keyRoot("E minor")).toBe(4);
    expect(keyRoot("F-sharp minor")).toBe(6);
    expect(keyRoot("")).toBe(null);
    expect(keyRoot("H major")).toBe(null);
  });

  it("parses every key in data/music.js", () => {
    for (const cue of CUES) expect(keyRoot(cue.key), cue.id).not.toBe(null);
  });

  it("never transposes a chirp more than a tritone", () => {
    // Moving a bright confirmation ping up eleven semitones turns a clean sound
    // into a shriek, so the interval folds to the nearest equivalent.
    for (const cue of CUES) {
      const n = sfxTranspose(cue.key);
      expect(Math.abs(n), cue.id).toBeLessThanOrEqual(6);
    }
    expect(sfxTranspose("A minor")).toBe(-3);      // not +9
    expect(sfxTranspose("C minor")).toBe(0);
    expect(sfxTranspose("F-sharp minor")).toBe(6);
  });

  it("keeps every transposed tone inside hearing at the extremes", () => {
    for (const cue of CUES) {
      const r = semitoneRatio(sfxTranspose(cue.key));
      for (const id of SFX_IDS) {
        if (!SFX[id].tonal) continue;
        for (const l of SFX[id].layers) {
          if (l.kind !== "tone") continue;
          expect(l.freq * r, `${id} in ${cue.key}`).toBeGreaterThan(40);
          expect(l.freq * r, `${id} in ${cue.key}`).toBeLessThan(9000);
        }
      }
    }
  });
});

describe("the rate limiter", () => {
  it("lets a first play through and blocks an immediate repeat", () => {
    expect(sfxAllowed(undefined, 1000)).toBe(true);
    expect(sfxAllowed(1000, 1000)).toBe(false);
    expect(sfxAllowed(1000, 1000 + RATE_LIMIT_MS - 1)).toBe(false);
    expect(sfxAllowed(1000, 1000 + RATE_LIMIT_MS)).toBe(true);
  });

  it("is short enough that mashing a button still hears every press", () => {
    // The limiter exists for the 10 fps market re-price and the day-a-second
    // dock clock, not to swallow deliberate input.
    expect(RATE_LIMIT_MS).toBeLessThanOrEqual(120);
  });
});
