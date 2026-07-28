// ===========================================================================
// SFX CONTEXT — one line of plumbing so a button does not have to be handed a
// sound player through six layers of props.
//
// The audio engine lives in index.jsx (it has to, so the music spans the menu
// as well as the game). Everything that wants to make a noise is a leaf: a row
// in the market, the back arrow on a screen, a toast. Prop-drilling `playSfx`
// to all of them would touch every component signature in the panel tree and
// make the next person adding a screen wonder why their button is silent.
//
// The default is a no-op that returns false, so a component rendered outside
// the provider — in a test, or in the codex labs — simply makes no sound rather
// than throwing.
// ===========================================================================
import { createContext, useContext } from "react";

const SfxContext = createContext(() => false);

export const SfxProvider = SfxContext.Provider;

/** `const sfx = useSfx();` then `sfx("select")`. Never throws, never blocks. */
export const useSfx = () => useContext(SfxContext);
