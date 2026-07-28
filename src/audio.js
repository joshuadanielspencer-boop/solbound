// ===========================================================================
// AUDIO — the soundtrack, synthesised in the browser from the scores in
// data/music.js.
//
// Two halves, and the split is the usual one in this codebase:
//
//   PURE          noteToFreq, chordFreqs, contextOf, cueFor, nextCue — plain
//                 functions over plain values, unit-tested, no browser needed
//   THE ENGINE    createMusic() — everything that touches an AudioContext,
//                 untestable in node and therefore kept as thin as possible
//
// WHY GENERATIVE. Recorded loops are megabytes, and this game is an offline PWA
// that precaches its whole shell. Building the sound from oscillators costs
// nothing to ship and never repeats exactly: the pad rotates its voicing and
// the arpeggio walks its own path within the written chords, so twenty minutes
// in port does not sound like a two-minute loop played ten times.
//
// BROWSERS DO NOT LET A PAGE MAKE NOISE UNPROMPTED, and they are right to. The
// context is created on the first real click and stays suspended until then, so
// nothing plays at somebody who did not ask for it. The preference — on/off and
// level — persists, so the answer is remembered.
// ===========================================================================

import { CUES, CUE_BY_ID, ROTATE_AFTER_SECONDS, CROSSFADE_SECONDS } from "./data/music.js";
import { SFX, RATE_LIMIT_MS, SFX_BUS } from "./data/sfx.js";

const STORE_KEY = "solbound.audio.v1";

// ---------------------------------------------------------------------------
// The pure half
// ---------------------------------------------------------------------------

const SEMITONES = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

/**
 * A note name ("A2", "F#3", "D#4") to its frequency in hertz.
 *
 * Equal temperament off A4 = 440 Hz, which is the same arithmetic a piano
 * tuner uses: every semitone is a factor of the twelfth root of two.
 */
export function noteToFreq(note) {
  const m = /^([A-G]#?)(-?\d+)$/.exec(String(note).trim());
  if (!m) return null;
  const semitone = SEMITONES[m[1]];
  if (semitone === undefined) return null;
  const midi = 12 * (Number(m[2]) + 1) + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A chord's note names to frequencies, dropping anything unparseable. */
export const chordFreqs = (notes = []) => notes.map(noteToFreq).filter((f) => f !== null);

/** Seconds per beat, and per bar of four. */
export const beatSeconds = (bpm) => 60 / bpm;
export const barSeconds = (bpm) => (60 / bpm) * 4;

/**
 * WHERE THE PLAYER IS, as one word the score can be written against.
 *
 * Order matters and mirrors data/music.js CONTEXTS: an encounter outranks
 * everything (the clock has stopped and something wants an answer), then how
 * far out you are, then whether you are moving at all.
 */
export function contextOf(game, systemOf) {
  if (!game) return "dock";
  if (game.encounter && !game.encounter.outcome) return "encounter";
  const where = game.status === "transit" ? game.leg?.to : game.player?.at;
  const sys = systemOf ? systemOf(where) : null;
  if (sys === "jupiter" || sys === "saturn" || sys === "neptune" || sys === "uranus" || sys === "pluto") return "outer";
  if (sys === "belt") return "belt";
  if (game.status === "transit") return "transit";
  return "dock";
}

/** Every cue that suits this moment, in the order they are written. */
export const cuesFor = (context) => CUES.filter((c) => c.contexts.includes(context));

/**
 * The cue to play. `previousId` keeps a cue that still fits rather than
 * restarting the set on every state change — the music should follow the game,
 * not twitch at it. `rotate` forces a move to the next fitting cue, which is
 * what the rotation timer does so a long stay in port is not one piece on loop.
 */
export function cueFor(context, previousId = null, rotate = false) {
  const options = cuesFor(context);
  if (!options.length) return CUES[0];
  const at = options.findIndex((c) => c.id === previousId);
  if (at >= 0 && !rotate) return options[at];
  if (at >= 0) return options[(at + 1) % options.length];
  return options[0];
}

/** Total bars in one pass of a cue's progression — one full statement. */
export const cueBars = (cue) => cue.chords.reduce((n, c) => n + c.bars, 0);

// ---------------------------------------------------------------------------
// Sound effects, the pure half
// ---------------------------------------------------------------------------

/**
 * The root of a cue's key, in semitones above C. `null` if unparseable.
 *
 * The scores write keys the way a musician does — "A minor", "F-sharp minor" —
 * so this reads that rather than making the data carry a number nobody could
 * check by eye.
 */
export function keyRoot(keyName) {
  const m = /^([A-G])(?:[-\s]?(sharp|flat|#|b))?/i.exec(String(keyName || "").trim());
  if (!m) return null;
  const base = SEMITONES[m[1].toUpperCase()];
  if (base === undefined) return null;
  const acc = (m[2] || "").toLowerCase();
  const shift = acc === "sharp" || acc === "#" ? 1 : acc === "flat" || acc === "b" ? -1 : 0;
  return ((base + shift) % 12 + 12) % 12;
}

/**
 * How far to transpose a tonal effect so it sits in the cue that is playing.
 *
 * The sounds are written in C. Moving them by the cue's root would send a bright
 * confirmation chirp up as much as eleven semitones, which turns a clean ping
 * into a shriek — so the interval is folded to the nearest equivalent, ±6 at
 * worst. A tritone away is still the furthest any of them can land, and that is
 * fine: it is one interval, not an octave of drift.
 */
export function sfxTranspose(keyName) {
  const root = keyRoot(keyName);
  if (root === null) return 0;
  return root > 6 ? root - 12 : root;
}

/** Semitones to a frequency ratio. */
export const semitoneRatio = (n) => Math.pow(2, n / 12);

/**
 * May this sound play now?
 *
 * `lastAt` is when it last played, in ms, or undefined. See RATE_LIMIT_MS in
 * data/sfx.js for why this exists at all — the market re-prices thirty times a
 * second and nothing wired near it may become a drone.
 */
export const sfxAllowed = (lastAt, now, limit = RATE_LIMIT_MS) =>
  lastAt === undefined || lastAt === null || now - lastAt >= limit;

/** How long a sound lasts, from its longest layer. Used to size its bus node. */
export const sfxDuration = (def) =>
  Math.max(0, ...(def?.layers || []).map((l) => (l.at || 0) + (l.dur || 0)));

// ---------------------------------------------------------------------------
// Stored preference
// ---------------------------------------------------------------------------

const DEFAULT_PREF = { on: true, level: 0.5, sfxOn: true, sfxLevel: 0.7 };

/**
 * The stored preference.
 *
 * SFX were added to this later and the key was deliberately NOT bumped: the two
 * new fields simply default when absent, so every existing player keeps their
 * music setting and picks up sound effects on. A version bump plus a migration
 * ladder would be more ceremony than two booleans deserve.
 */
export function loadAudioPref() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_PREF };
    const p = JSON.parse(raw);
    return {
      on: p.on !== false,
      level: typeof p.level === "number" ? clamp(p.level, 0, 1) : DEFAULT_PREF.level,
      sfxOn: p.sfxOn !== false,
      sfxLevel: typeof p.sfxLevel === "number" ? clamp(p.sfxLevel, 0, 1) : DEFAULT_PREF.sfxLevel,
    };
  } catch { return { ...DEFAULT_PREF }; }
}

export function saveAudioPref(pref) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(pref)); } catch { /* private window */ }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * A reverb impulse, generated rather than downloaded: white noise decaying
 * exponentially. It is not a real room — it is the cheapest thing that stops
 * the pads sounding like they were recorded inside a telephone, and it costs
 * one buffer instead of a WAV file.
 */
function makeImpulse(ctx, seconds) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      // Math.random is fine HERE and nowhere else in this codebase: reverb
      // noise is not game state, is never saved, and cannot affect a replay.
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
  }
  return buf;
}

/** A quiet bed of filtered noise — the sound of a ship being a ship. */
function makeAirBuffer(ctx) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;      // brown-ish noise: gentler than white
    data[i] = last * 3.2;
  }
  return buf;
}

/**
 * Build the music engine. Returns a small control surface; everything inside is
 * the only place in the project allowed to touch an AudioContext.
 *
 *   start()             create/resume the context (call from a user gesture)
 *   setContext(name)    tell it where the player is; it picks and crossfades
 *   setOn(bool) / setLevel(0..1)
 *   nowPlaying()        the cue currently sounding, for the UI
 *   dispose()
 */
export function createMusic() {
  let ctx = null, master = null, verb = null, verbGain = null;
  // The SFX bus hangs off the destination beside `master`, NOT inside it. An
  // alert has to stay audible when the music is turned down or off, and one
  // fader for both means either the pads are too loud or the warning is
  // inaudible. Two buses, two faders, one context.
  let sfxBus = null;
  const lastPlayed = {};
  let pref = loadAudioPref();
  let context = "dock";
  let current = null;             // { cue, gain, voices[], startedAt, bar }
  let outgoing = [];
  let timer = null, rotateAt = 0;
  let listeners = [];

  const notify = () => listeners.forEach((f) => { try { f(); } catch { /* a UI callback must not kill the audio */ } });

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = pref.on ? pref.level * 0.5 : 0;   // 0.5: headroom, this is background
    master.connect(ctx.destination);
    verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx, 5);
    verbGain = ctx.createGain();
    verbGain.gain.value = 0.85;
    verb.connect(verbGain);
    verbGain.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = pref.sfxOn ? pref.sfxLevel * SFX_BUS : 0;
    sfxBus.connect(ctx.destination);
    return ctx;
  }

  /**
   * A short burst of shaped noise, built once and reused. Effects are far
   * shorter than the music's air bed, so half a second is plenty and it costs
   * one buffer for the whole session.
   */
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    // Math.random is fine HERE and nowhere else: an effect's noise is not game
    // state, is never saved, and cannot affect a replay.
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /** One layer of one effect. Returns nothing; it schedules and forgets. */
  function playLayer(layer, into, at, ratio) {
    const t0 = at + (layer.at || 0);
    const dur = layer.dur || 0.1;
    const attack = Math.min(layer.attack ?? 0.005, dur * 0.5);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(layer.peak ?? 0.4, t0 + attack);
    // Exponential, because a linear fade on a short percussive sound reads as a
    // click at the end rather than as a decay.
    env.gain.exponentialRampToValueAtTime(0.0006, t0 + dur);
    env.connect(into);

    let node = env;
    if (layer.bp || layer.lp) {
      const f = ctx.createBiquadFilter();
      f.type = layer.bp ? "bandpass" : "lowpass";
      const corner = layer.bp || layer.lp;
      f.frequency.setValueAtTime(corner, t0);
      if (layer.sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, layer.sweepTo), t0 + dur);
      f.Q.value = layer.q ?? (layer.bp ? 2 : 0.7);
      f.connect(env);
      node = f;
    }

    if (layer.kind === "noise") {
      const src = ctx.createBufferSource();
      src.buffer = noise();
      src.loop = true;
      src.connect(node);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
      return;
    }
    const o = ctx.createOscillator();
    o.type = layer.wave || "sine";
    o.frequency.setValueAtTime(layer.freq * ratio, t0);
    if (layer.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, layer.to * ratio), t0 + dur);
    o.connect(node);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** Build the voices for one cue and start its clock. */
  function buildCue(cue) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    const send = ctx.createGain();
    send.gain.value = 0.5;
    send.connect(verb);
    g.connect(send);

    const v = cue.voice;
    const voices = [];

    // AIR — a continuous noise bed, looped, filtered right down.
    if (v.air > 0) {
      const src = ctx.createBufferSource();
      src.buffer = makeAirBuffer(ctx);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 380;
      const ag = ctx.createGain();
      ag.gain.value = v.air * 0.5;
      src.connect(f); f.connect(ag); ag.connect(g);
      src.start();
      voices.push({ stop: () => { try { src.stop(); } catch { /* already stopped */ } } });
    }

    return { cue, gain: g, send, voices, bar: 0, nextAt: 0, chordIdx: 0, arpIdx: 0, arpAt: 0, bassAt: 0 };
  }

  /** One pad chord: paired detuned oscillators per note, swelling and fading. */
  function playChord(node, freqs, at, dur) {
    const v = node.cue.voice;
    for (const f of freqs) {
      for (const cents of [-v.padDetune, v.padDetune]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = cents;
        const filt = ctx.createBiquadFilter();
        filt.type = "lowpass";
        filt.frequency.setValueAtTime(v.padCutoff * 0.6, at);
        filt.frequency.linearRampToValueAtTime(v.padCutoff, at + dur * 0.5);
        filt.frequency.linearRampToValueAtTime(v.padCutoff * 0.7, at + dur);
        filt.Q.value = 0.6;
        const env = ctx.createGain();
        const peak = 0.05;
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(peak, at + dur * 0.35);      // slow swell
        env.gain.linearRampToValueAtTime(peak * 0.75, at + dur * 0.8);
        env.gain.linearRampToValueAtTime(0, at + dur + 0.4);
        o.connect(filt); filt.connect(env); env.connect(node.gain);
        o.start(at); o.stop(at + dur + 0.6);
      }
    }
  }

  /** A plucked note for the arpeggio, or a bass note if `bass`. */
  function playNote(node, freq, at, bass = false) {
    const v = node.cue.voice;
    const o = ctx.createOscillator();
    o.type = bass ? "triangle" : v.arpWave;
    o.frequency.value = freq;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = bass ? 260 : v.padCutoff * 1.8;
    const env = ctx.createGain();
    const peak = bass ? 0.10 : 0.035;
    const dur = bass ? 0.9 : 0.6;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    o.connect(filt); filt.connect(env); env.connect(node.gain);
    o.start(at); o.stop(at + dur + 0.05);
  }

  /**
   * The scheduler. Runs on a plain interval and writes audio events a little way
   * into the future — the standard Web Audio pattern, because setInterval is far
   * too jittery to fire a note ON the beat but perfectly good at deciding what
   * the next half-second should contain.
   */
  const LOOKAHEAD = 0.35;
  function tick() {
    if (!ctx || !current) return;
    const now = ctx.currentTime;

    // Rotate to another cue that suits the same moment, so a long stay in one
    // place is not one piece on repeat.
    if (rotateAt && now > rotateAt) {
      const next = cueFor(context, current.cue.id, true);
      if (next.id !== current.cue.id) switchTo(next);
      rotateAt = now + ROTATE_AFTER_SECONDS;
    }

    for (const node of [current, ...outgoing]) {
      const cue = node.cue;
      const bar = barSeconds(cue.bpm), beat = beatSeconds(cue.bpm);
      if (node.nextAt === 0) node.nextAt = now + 0.1;

      while (node.nextAt < now + LOOKAHEAD) {
        const chord = cue.chords[node.chordIdx % cue.chords.length];
        const freqs = chordFreqs(chord.notes);
        const dur = chord.bars * bar;
        playChord(node, freqs, node.nextAt, dur);

        // Bass: the root, on its own subdivision.
        if (cue.voice.bassEvery > 0 && freqs.length) {
          for (let t = 0; t < dur; t += cue.voice.bassEvery * beat) {
            playNote(node, freqs[0], node.nextAt + t, true);
          }
        }

        // Arpeggio: walks the chord degrees the score names. The walk carries
        // across chords rather than resetting, which is what stops it sounding
        // like the same four notes over and over.
        if (cue.voice.arpEvery > 0 && cue.voice.arp?.length) {
          for (let t = 0; t < dur; t += cue.voice.arpEvery * beat) {
            const degree = cue.voice.arp[node.arpIdx % cue.voice.arp.length];
            const f = freqs[Math.min(degree, freqs.length - 1)];
            // Lift an occasional note an octave — a little air in the line.
            const lift = node.arpIdx % 7 === 6 ? 2 : 1;
            if (f) playNote(node, f * lift, node.nextAt + t);
            node.arpIdx++;
          }
        }

        node.nextAt += dur;
        node.chordIdx++;
      }
    }

    // Retire anything that has finished fading out.
    outgoing = outgoing.filter((n) => {
      if (n.gain.gain.value > 0.001) return true;
      n.voices.forEach((v) => v.stop());
      try { n.gain.disconnect(); } catch { /* already gone */ }
      return false;
    });
  }

  function switchTo(cue) {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (current) {
      current.gain.gain.cancelScheduledValues(now);
      current.gain.gain.setValueAtTime(current.gain.gain.value, now);
      current.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
      outgoing.push(current);
    }
    current = buildCue(cue);
    current.gain.gain.setValueAtTime(0, now);
    current.gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
    rotateAt = now + ROTATE_AFTER_SECONDS;
    notify();
  }

  return {
    /** Call from a real user gesture. Safe to call repeatedly. */
    start() {
      if (!ensureContext()) return false;
      if (ctx.state === "suspended") ctx.resume();
      if (!current) switchTo(cueFor(context));
      if (!timer) timer = setInterval(tick, 120);
      return true;
    },
    setContext(name) {
      if (name === context) return;
      context = name;
      if (!ctx || !current) return;
      const next = cueFor(context, current.cue.id);
      if (next.id !== current.cue.id) switchTo(next);
    },
    setOn(on) {
      pref = { ...pref, on };
      saveAudioPref(pref);
      if (!ctx) return;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(on ? pref.level * 0.5 : 0, now + 0.6);
    },
    setLevel(level) {
      pref = { ...pref, level: clamp(level, 0, 1) };
      saveAudioPref(pref);
      if (!ctx || !pref.on) return;
      master.gain.setTargetAtTime(pref.level * 0.5, ctx.currentTime, 0.05);
    },

    /**
     * Fire an effect. Safe to call before anything has started, safe to call
     * with an id that does not exist, and safe to call far too often — the rate
     * limit is here rather than at the call sites, so no caller has to remember.
     *
     * `nowMs` is injectable purely so a test can drive the limiter.
     */
    playSfx(id, nowMs = Date.now()) {
      const def = SFX[id];
      if (!def || !pref.sfxOn) return false;
      if (!sfxAllowed(lastPlayed[id], nowMs)) return false;
      if (!ctx || ctx.state !== "running") return false;    // no gesture yet
      lastPlayed[id] = nowMs;
      // Tonal effects follow the cue that is playing, so a confirmation chirp
      // belongs to the music instead of arriving from another application.
      const ratio = def.tonal ? semitoneRatio(sfxTranspose(current?.cue?.key)) : 1;
      const g = ctx.createGain();
      g.gain.value = def.gain ?? 0.4;
      g.connect(sfxBus);
      const at = ctx.currentTime + 0.01;
      for (const layer of def.layers) playLayer(layer, g, at, ratio);
      // Let go of the node once the sound is over. Without this every effect
      // leaves a live GainNode attached to the bus for the life of the session.
      setTimeout(() => { try { g.disconnect(); } catch { /* already gone */ } },
        (sfxDuration(def) + 0.4) * 1000);
      return true;
    },
    setSfxOn(on) {
      pref = { ...pref, sfxOn: on };
      saveAudioPref(pref);
      if (!ctx) return;
      sfxBus.gain.setTargetAtTime(on ? pref.sfxLevel * SFX_BUS : 0, ctx.currentTime, 0.03);
    },
    setSfxLevel(level) {
      pref = { ...pref, sfxLevel: clamp(level, 0, 1) };
      saveAudioPref(pref);
      if (!ctx || !pref.sfxOn) return;
      sfxBus.gain.setTargetAtTime(pref.sfxLevel * SFX_BUS, ctx.currentTime, 0.05);
    },
    pref: () => ({ ...pref }),
    nowPlaying: () => (current ? CUE_BY_ID[current.cue.id] : null),
    onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn); }; },
    dispose() {
      if (timer) clearInterval(timer);
      timer = null;
      try { ctx && ctx.close(); } catch { /* nothing to close */ }
      ctx = null; current = null; outgoing = []; listeners = []; sfxBus = null; noiseBuf = null;
    },
  };
}
