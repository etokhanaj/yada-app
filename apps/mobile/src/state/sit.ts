/**
 * The verse Choose a verse (SW-02) hands back to Sit's setup (SW-01). A sheet can't return a value through the router,
 * so the choice is set here and the setup subscribes to it.
 */

import { create } from "zustand";

export interface SitVerse {
  readonly text: string;
  /** "Psalm 46:10", or "Philippians 4:6–7" for a short passage. */
  readonly ref: string;
  /** The words are the BSB's under a licensed translation (rule 9), and say so. */
  readonly bsb: boolean;
  /** The first verse's id, "PSA.46.10": what Save and the kept word attach to. */
  readonly place: string;
}

interface SitChoiceState {
  readonly chosen: SitVerse | null;
  choose(verse: SitVerse): void;
  clear(): void;
}

export const useSitChoice = create<SitChoiceState>((set) => ({
  chosen: null,
  choose: (verse) => set({ chosen: verse }),
  clear: () => set({ chosen: null }),
}));
