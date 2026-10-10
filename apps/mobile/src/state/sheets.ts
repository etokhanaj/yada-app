/**
 * What the evidence sheet has open, so the Understand sheet behind it can mark
 * it: the word whose card is open is marked in the interlinear, as the
 * selected verse is marked in the reader (canvas J01-07).
 */

import { create } from "zustand";

interface SheetsState {
  /** `${ord}:${position}` of the word whose card is open. */
  openWord: string | null;
  setOpenWord: (key: string | null) => void;
}

export const useSheets = create<SheetsState>((set) => ({
  openWord: null,
  setOpenWord: (openWord) => set({ openWord }),
}));
