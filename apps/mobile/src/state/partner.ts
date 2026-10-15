/**
 * MM-03: the last original word tapped in Understand, so the verse at the top of the sheet keeps its BSB
 * partner underlined after the word's card closes ("afterwards just the mark"). Cleared when the sheet
 * closes; the interlinear's own mark (state/sheets.ts openWord) still follows the open card only.
 */

import { create } from "zustand";

interface PartnerState {
  /** `${ord}:${position}`. */
  word: string | null;
  setWord: (word: string | null) => void;
}

export const usePartner = create<PartnerState>((set) => ({
  word: null,
  setWord: (word) => set({ word }),
}));

/** The tapped word's position when it is in this verse, else null. */
export function partnerPosition(word: string | null, ord: number): number | null {
  if (word === null) return null;
  const [o, p] = word.split(":");
  return Number(o) === ord && p !== undefined ? Number(p) : null;
}
