// ===========================================================================
// CREW — the people in the other berths.
//
// Space Trader's mercenaries, and they answer a real problem: after character
// creation, the four skills never change again. A captain who spent their points
// on Trader is a bad pilot forever, and no amount of money fixes it. That makes
// the most interesting choice in the game a permanent one made before the player
// knew anything.
//
// Crew fix that WITHOUT undoing the choice. The rule is the simple one:
//
//     THE BEST PERSON ABOARD DOES THE JOB.
//
// Your Fighter skill is your own unless you hired someone better, in which case
// it is theirs. So a hopeless pilot can buy their way to competence — but only by
// spending a berth on it, and berths are a hull stat (`crew` in hulls.js). The
// Courier flies alone forever. That is the trade: capability for hull size and a
// wage bill that runs every single day.
//
// ⚠ SPECULATION (design.md §16). These are invented people with invented names.
// Nothing here is a claim about anything.
// ===========================================================================

export const CREW = [
  // ---- PILOTS -----------------------------------------------------------
  { id: "vasquez", name: "Rell Vasquez", skill: "pilot", rating: 7, wage: 320,
    blurb: "Flew tugs in the Jovian radiation belt for six years and still has all her teeth." },
  { id: "okonkwo", name: "Ada Okonkwo", skill: "pilot", rating: 9, wage: 880,
    blurb: "Held a burn through a failing gimbal for ninety seconds. The ship survived. She does not discuss it." },
  { id: "prakash", name: "Devi Prakash", skill: "pilot", rating: 5, wage: 130,
    blurb: "Two hundred hours logged, all of them cislunar, all of them uneventful. She would like that to change." },

  // ---- FIGHTERS ---------------------------------------------------------
  { id: "brant", name: "Cyrus Brant", skill: "fighter", rating: 8, wage: 640,
    blurb: "Belt militia, honourably discharged, and vague about which militia." },
  { id: "sork", name: "Mira Sork", skill: "fighter", rating: 6, wage: 250,
    blurb: "Ran point defence on a convoy that got through. Sleeps badly." },
  { id: "tallow", name: "Ezra Tallow", skill: "fighter", rating: 9, wage: 960,
    blurb: "Was a pirate. Says he has stopped. The reference is from someone who would know." },

  // ---- ENGINEERS --------------------------------------------------------
  { id: "haruki", name: "Jun Haruki", skill: "engineer", rating: 8, wage: 600,
    blurb: "Kept a Ceres water plant running eleven years past its rated life with parts he made himself." },
  { id: "delacroix", name: "Simone Delacroix", skill: "engineer", rating: 6, wage: 240,
    blurb: "Reactor tech, second class, and studying for first on the long crossings." },
  { id: "ibarra", name: "Tomas Ibarra", skill: "engineer", rating: 9, wage: 900,
    blurb: "Can hear a bearing going. Genuinely — he will stop mid-sentence and go and fix it." },

  // ---- TRADERS ----------------------------------------------------------
  { id: "nassar", name: "Yusra Nassar", skill: "trader", rating: 8, wage: 620,
    blurb: "Knows what a port will pay before the port does. Charges accordingly." },
  { id: "voss", name: "Henrik Voss", skill: "trader", rating: 6, wage: 230,
    blurb: "Factor for a Hansa house until the house decided it no longer needed factors." },
  { id: "amadi", name: "Chidi Amadi", skill: "trader", rating: 9, wage: 940,
    blurb: "Has a name at every free port between here and Callisto, and a different one at each." },
];

export const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c]));

/**
 * How many berths a hull has, minus the one you are sitting in. A hull with one
 * berth has no room for anybody, which is the Courier's whole character: it goes
 * far, carries little, and you do everything yourself.
 */
export const berthsFor = (hull) => Math.max(0, (hull?.crew || 1) - 1);
