// ===========================================================================
// SOUND EFFECTS — written as data, the same way data/music.js writes the score.
//
// WHY THERE ARE STILL NO AUDIO FILES. Same reason as the music: this is an
// offline PWA whose whole shell is under half a megabyte, and a folder of WAVs
// is tens of times that. Every sound below is an envelope — a few oscillators
// and a burst of filtered noise — and the whole set costs about two kilobytes.
//
// ---------------------------------------------------------------------------
// THE RULE THAT DECIDES WHAT EVERYTHING SOUNDS LIKE
//
//   > There is no sound in space. Everything you hear is inside your own hull,
//   > or is a tone your own console generated to tell you something.
//
// So there is no whoosh when you launch and no explosion when you are hit.
// What there is: the structure, the machinery, and the instruments. It is the
// same discipline the rest of the project runs on — the physics decides the
// design rather than the design borrowing from films — and it happens to give
// the game a palette nothing else sounds like.
//
// THREE RULES THAT KEEP IT FROM BEING ANNOYING, all enforced in audio.js:
//   1. A SEPARATE BUS with its own level. Ambient music and an alert tone want
//      completely different volumes, and one fader for both means either the
//      music is too loud or the warning is unhearable.
//   2. A RATE LIMIT per sound. The market re-prices at 10 fps and the port clock
//      drifts a day a second; anything that could fire on a tick must not.
//   3. NOTHING IS EVER ONLY A SOUND (project rule 4). Every entry below marks
//      something already visible on screen. Sound is the second channel, never
//      the only one.
//
// ---------------------------------------------------------------------------
// THE FORMAT
//
// A sound is `{ gain, tonal, layers: [...] }`. Each layer is one of:
//
//   { kind: "tone", wave, freq, to, dur, at, attack, peak, lp, q }
//       An oscillator. `to` glides the frequency to a second value across the
//       layer; `lp` is a lowpass corner in Hz, which is what stops a square wave
//       sounding like a 1980s alarm clock.
//
//   { kind: "noise", dur, at, attack, peak, lp, bp, sweepTo, q }
//       A burst of noise. `bp` band-passes it (machinery, impacts), `lp`
//       low-passes it (air, pumps). `sweepTo` moves the filter across the layer,
//       which is the whole difference between a pump and a hiss.
//
// `at` is seconds from the start of the sound, so a layer list is a little
// score. `peak` is relative within the sound; `gain` is the sound's own level.
//
// `tonal: true` means the sound has a pitch worth relating to the music, and
// audio.js transposes it into the key of whatever cue is playing. A confirmation
// chirp that sits inside the harmony reads as part of the game; the same chirp a
// tritone away reads as a notification from another application.
// ===========================================================================

export const SFX = {
  // ---- the panel: small, dry, console-like -------------------------------
  focus: {
    gain: 0.16, tonal: true,
    layers: [{ kind: "tone", wave: "sine", freq: 1174.7, dur: 0.05, attack: 0.004, peak: 0.5, lp: 4200 }],
    marks: "The cursor or the keyboard moved onto something.",
  },
  select: {
    gain: 0.34, tonal: true,
    layers: [{ kind: "tone", wave: "triangle", freq: 523.3, to: 784, dur: 0.1, attack: 0.005, peak: 0.55, lp: 3400 }],
    marks: "A screen opened.",
  },
  back: {
    gain: 0.3, tonal: true,
    layers: [{ kind: "tone", wave: "triangle", freq: 784, to: 523.3, dur: 0.1, attack: 0.005, peak: 0.5, lp: 3000 }],
    marks: "A screen closed.",
  },
  denied: {
    // Whatever you just tried, you cannot. Low and soft rather than a buzzer,
    // because a refusal that scolds makes the whole game feel like it is telling
    // you off.
    //
    // I expected this to be the most-heard sound in the game and measured it in
    // the browser instead: it is NOT. The market disables the button rather than
    // raising the error — a full hold clamps the quantity to zero, so Buy simply
    // does nothing — so this is reachable mainly from the Yard, where you can
    // press a purchase you cannot afford. Worth knowing before tuning it, and
    // worth noticing that the interface prevents most errors rather than
    // reporting them, which is the better behaviour and makes this sound rarer
    // than the wiring suggests.
    gain: 0.3,
    layers: [{ kind: "tone", wave: "square", freq: 155.6, to: 116.5, dur: 0.13, attack: 0.008, peak: 0.4, lp: 780 }],
    marks: "The toast that just appeared in red.",
  },

  // ---- trade: cargo clamps and a pump, not a cash register ---------------
  buy: {
    gain: 0.42, tonal: true,
    layers: [
      { kind: "noise", dur: 0.1, bp: 200, q: 2.6, peak: 0.55, attack: 0.002 },
      { kind: "tone", wave: "triangle", freq: 392, to: 523.3, dur: 0.13, at: 0.035, attack: 0.006, peak: 0.4, lp: 2800 },
    ],
    marks: "Credits down, hold up. Both are in the header.",
  },
  sell: {
    gain: 0.42, tonal: true,
    layers: [
      { kind: "noise", dur: 0.09, bp: 260, q: 2.6, peak: 0.45, attack: 0.002 },
      { kind: "tone", wave: "triangle", freq: 523.3, to: 784, dur: 0.15, at: 0.035, attack: 0.006, peak: 0.45, lp: 3400 },
    ],
    marks: "Credits up, hold down, and the toast says the profit.",
  },
  refuel: {
    // A pump: noise that takes a moment to come up to pressure, runs, and stops
    // with the mechanical click of a valve. The click is what makes it read as
    // machinery rather than as a whoosh.
    gain: 0.38,
    layers: [
      { kind: "noise", dur: 0.8, lp: 460, sweepTo: 880, attack: 0.2, peak: 0.5 },
      { kind: "tone", wave: "square", freq: 128, dur: 0.045, at: 0.78, attack: 0.001, peak: 0.32, lp: 1400 },
    ],
    marks: "The propellant figure in the header climbing.",
  },

  // ---- the alerts: the only things allowed to cut through ----------------
  alert: {
    // Something matched your orbit. Three pulses of an alternating two-tone
    // warble and then silence — the shape a spacecraft caution-and-warning tone
    // has, which is where the idea comes from; it is not a reproduction of any
    // particular one and does not claim to be.
    //
    // THREE PULSES, NOT A LOOP. An encounter sits on screen for as long as it
    // takes to read the options, and a tone that keeps going for a minute stops
    // being information and becomes pressure to click anything.
    gain: 0.4,
    layers: [
      { kind: "tone", wave: "square", freq: 740, dur: 0.13, at: 0.0, attack: 0.004, peak: 0.34, lp: 2200 },
      { kind: "tone", wave: "square", freq: 587.3, dur: 0.13, at: 0.15, attack: 0.004, peak: 0.34, lp: 2200 },
      { kind: "tone", wave: "square", freq: 740, dur: 0.13, at: 0.3, attack: 0.004, peak: 0.34, lp: 2200 },
      { kind: "tone", wave: "square", freq: 587.3, dur: 0.13, at: 0.45, attack: 0.004, peak: 0.34, lp: 2200 },
      { kind: "tone", wave: "square", freq: 740, dur: 0.16, at: 0.6, attack: 0.004, peak: 0.34, lp: 2200 },
      { kind: "tone", wave: "square", freq: 587.3, dur: 0.2, at: 0.76, attack: 0.004, peak: 0.3, lp: 2000 },
    ],
    marks: "The encounter panel that just replaced the whole side panel.",
  },
  damage: {
    // Through the frame, not through vacuum: a bandpassed hit and a low thud you
    // would feel in the deck.
    gain: 0.5,
    layers: [
      { kind: "noise", dur: 0.22, bp: 320, q: 1.1, sweepTo: 90, peak: 0.7, attack: 0.001 },
      { kind: "tone", wave: "sine", freq: 74, to: 44, dur: 0.5, attack: 0.004, peak: 0.55, lp: 200 },
    ],
    marks: "The hull percentage in the header dropping.",
  },
  caught: {
    // Customs found it. A descending three-note figure — the only sound here
    // that is a phrase rather than an event, because this is the one outcome
    // that follows you afterwards.
    gain: 0.4, tonal: true,
    layers: [
      { kind: "tone", wave: "triangle", freq: 587.3, dur: 0.16, at: 0.0, attack: 0.006, peak: 0.45, lp: 2200 },
      { kind: "tone", wave: "triangle", freq: 493.9, dur: 0.16, at: 0.16, attack: 0.006, peak: 0.45, lp: 2000 },
      { kind: "tone", wave: "triangle", freq: 415.3, dur: 0.5, at: 0.32, attack: 0.008, peak: 0.5, lp: 1700 },
      { kind: "tone", wave: "sine", freq: 103.8, dur: 0.7, at: 0.32, attack: 0.02, peak: 0.4, lp: 300 },
    ],
    marks: "The seizure and the fine, itemised in the encounter result.",
  },

  // ---- and the one that is a reward --------------------------------------
  chart: {
    // You now know somewhere you did not. Three partials of a bell with a long
    // decay — the brightest thing in the set, because design.md §1 says the
    // whole game is knowledge becoming capability and this is the moment it
    // happens.
    gain: 0.34, tonal: true,
    layers: [
      { kind: "tone", wave: "sine", freq: 880, dur: 1.5, attack: 0.004, peak: 0.34, lp: 5000 },
      { kind: "tone", wave: "sine", freq: 1318.5, dur: 1.1, at: 0.012, attack: 0.004, peak: 0.2, lp: 6000 },
      { kind: "tone", wave: "sine", freq: 2637, dur: 0.7, at: 0.02, attack: 0.003, peak: 0.09, lp: 8000 },
    ],
    marks: "A new entry in the Atlas, and the arrival toast.",
  },
};

export const SFX_IDS = Object.keys(SFX);

/**
 * How long a sound must wait before it may play again.
 *
 * The market re-prices at 10 fps and the docked clock drifts a day a second, so
 * anything wired near those has to be gated or it becomes a drone. 80 ms is
 * under the threshold at which two presses feel like one, so a player mashing a
 * button still hears every press.
 */
export const RATE_LIMIT_MS = 80;

/** The SFX bus's level relative to the music, before the player's own fader. */
export const SFX_BUS = 0.9;
