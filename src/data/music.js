// ===========================================================================
// MUSIC — five cues, written as data rather than recorded as files.
//
// WHY THERE ARE NO AUDIO FILES. Five minutes of decent ambient loop is tens of
// megabytes, which this project cannot spend: the game is an offline-capable
// PWA whose whole app shell is under half a megabyte, and every byte of it is
// precached onto someone's iPad. So the cues are SCORES — key, tempo, chord
// progression, and the shape of the synth that plays them — and audio.js builds
// the sound in the browser with the Web Audio API. The whole soundtrack costs
// about four kilobytes and never touches the network.
//
// It also means the music is generative rather than looped: the pad voicings
// and the arpeggio order move within the written chords, so a cue that plays
// for twenty minutes does not repeat itself the way a two-minute loop does.
//
// WHAT EACH CUE IS FOR. A cue lists the `contexts` it suits, and audio.js picks
// from whatever matches where the player currently is. Within a matching set it
// rotates every few minutes, so sitting in one port does not mean hearing one
// piece forever. Contexts:
//
//   dock       docked at an inner-system port — the ordinary state
//   belt       docked in, or flying to, the asteroid belt
//   outer      Jupiter and beyond, where the sunlight runs out
//   transit    under way, anywhere
//   encounter  something has stopped the clock and wants a decision
//
// Project rule 1: this is content, so it lives here and audio.js only plays it.
// ===========================================================================

/**
 * Chords are written as note names — the score, not the frequency. audio.js
 * turns them into hertz, so a chord can be read and edited by someone who
 * knows music and not the Web Audio API.
 *
 * `bars` is how long each chord is held, in bars of four beats.
 *
 * `voice` shapes the synth:
 *   padCutoff    lowpass corner for the pad, in Hz — the "warmth" dial
 *   padDetune    cents of detune between the pad's paired oscillators
 *   arp          which notes of the chord the arpeggio walks, by chord degree
 *   arpEvery     beats between arpeggio notes (0 = no arpeggio at all)
 *   arpWave      oscillator type for the arpeggio
 *   bassEvery    beats between bass notes (0 = no bass)
 *   reverb       tail length in seconds — how big the room is
 *   air          level of the filtered-noise bed, 0..1
 */
export const CUES = [
  {
    id: "gateway",
    name: "Gateway",
    blurb: "Home, and the lights of Earth underneath you. Warm, and going somewhere.",
    contexts: ["dock"],
    key: "A minor", bpm: 72,
    chords: [
      { notes: ["A2", "A3", "C4", "E4"], bars: 2 },
      { notes: ["F2", "F3", "A3", "C4"], bars: 2 },
      { notes: ["C3", "C4", "E4", "G4"], bars: 2 },
      { notes: ["G2", "G3", "B3", "D4"], bars: 2 },
    ],
    voice: {
      padCutoff: 1150, padDetune: 9, arp: [1, 2, 3, 2], arpEvery: 0.5, arpWave: "triangle",
      bassEvery: 2, reverb: 3.4, air: 0.10,
    },
  },
  {
    id: "long-coast",
    name: "The Long Coast",
    blurb: "Eight months of nothing in particular. The piece with the fewest notes in it.",
    contexts: ["transit"],
    key: "D minor", bpm: 56,
    chords: [
      { notes: ["D2", "D3", "F3", "A3"], bars: 4 },
      { notes: ["A2", "A3", "C4", "E4"], bars: 4 },
      { notes: ["B2", "B3", "D4", "F4"], bars: 4 },
      { notes: ["F2", "F3", "A3", "C4"], bars: 4 },
    ],
    voice: {
      padCutoff: 820, padDetune: 6, arp: [3], arpEvery: 8, arpWave: "sine",
      bassEvery: 4, reverb: 6.5, air: 0.16,
    },
  },
  {
    id: "cold-ledger",
    name: "Cold Ledger",
    blurb: "Past Mars the sunlight runs out and the arithmetic gets honest. Low, and in no hurry.",
    contexts: ["outer", "transit"],
    key: "F-sharp minor", bpm: 52,
    chords: [
      { notes: ["F#1", "F#2", "C#3", "A3"], bars: 4 },
      { notes: ["D2", "D3", "A3", "F#4"], bars: 4 },
      { notes: ["C#2", "C#3", "G#3", "E4"], bars: 4 },
      { notes: ["F#1", "F#2", "C#3", "G#3"], bars: 4 },
    ],
    voice: {
      padCutoff: 600, padDetune: 14, arp: [2, 3], arpEvery: 6, arpWave: "sine",
      bassEvery: 4, reverb: 7.5, air: 0.22,
    },
  },
  {
    id: "dust-and-ice",
    name: "Dust and Ice",
    blurb: "Working music for the Belt. Somebody's pumps are running somewhere.",
    contexts: ["belt", "dock"],
    key: "C minor", bpm: 88,
    chords: [
      { notes: ["C2", "C3", "D#3", "G3"], bars: 2 },
      { notes: ["G#1", "G#2", "C3", "D#3"], bars: 2 },
      { notes: ["D#2", "D#3", "G3", "A#3"], bars: 2 },
      { notes: ["A#1", "A#2", "D3", "F3"], bars: 2 },
    ],
    voice: {
      padCutoff: 1000, padDetune: 11, arp: [1, 3, 2, 3], arpEvery: 0.25, arpWave: "square",
      bassEvery: 1, reverb: 2.6, air: 0.08,
    },
  },
  {
    id: "contact",
    name: "Contact",
    blurb: "Something matched your orbit, which costs about as much as the trip. It wanted to.",
    contexts: ["encounter"],
    key: "E minor", bpm: 96,
    // EIGHT BARS, NOT FOUR, and the test is why. At this tempo a four-chord
    // progression states itself in ten seconds, and an encounter sits on screen
    // for a minute while you read the options — so the player would hear the
    // same ten seconds six times while deciding. The harmonic rhythm stays one
    // chord per bar, because that urgency is the point; the statement is twice
    // as long, so it does not announce its own loop.
    chords: [
      { notes: ["E2", "E3", "G3", "B3"], bars: 1 },
      { notes: ["E2", "E3", "G3", "A#3"], bars: 1 },   // tritone: something is wrong
      { notes: ["C2", "C3", "G3", "D#4"], bars: 1 },
      { notes: ["B1", "B2", "F#3", "D4"], bars: 1 },
      { notes: ["E2", "E3", "G3", "B3"], bars: 1 },
      { notes: ["G2", "G3", "B3", "D4"], bars: 1 },    // a moment of light
      { notes: ["A2", "A3", "C4", "E4"], bars: 1 },
      { notes: ["B1", "B2", "D#3", "F#3"], bars: 1 },  // dominant, pulling back round
    ],
    voice: {
      padCutoff: 1500, padDetune: 18, arp: [1, 1, 3, 2], arpEvery: 0.25, arpWave: "sawtooth",
      bassEvery: 0.5, reverb: 1.9, air: 0.05,
    },
  },
];

export const CUE_BY_ID = Object.fromEntries(CUES.map((c) => [c.id, c]));

/** Every context a cue may claim. `cueFor` in audio.js falls back down this
 *  list, so the order is the fallback order and "dock" must stay last. */
export const CONTEXTS = ["encounter", "outer", "belt", "transit", "dock"];

/** How long a cue plays before the engine rotates to another one that fits the
 *  same moment. Long enough not to feel like a shuffle, short enough that a
 *  long stay in port is not one piece on repeat. */
export const ROTATE_AFTER_SECONDS = 230;

/** Seconds of crossfade between cues. Slow, because a hard cut in ambient music
 *  reads as a bug. */
export const CROSSFADE_SECONDS = 6;
