/**
 * The reader beneath a passage guide follows it. A guide's Next row opens the
 * following passage inside the same sheet (ON-04); the reader under the sheet
 * moves to that passage too, so × lands on the text the reader was just
 * guided through, not on the passage before it.
 *
 * Keyed by the reader that opened the guide: several readers can sit in the
 * stack (a See also jump pushes another), and only the one under the sheet moves.
 */

import type { BookCode } from "@yada/schema";
import { create } from "zustand";

export interface GuideFollow {
  readonly reader: string;
  readonly book: BookCode;
  readonly chapter: number;
  readonly verse: number;
}

interface GuideState {
  follow: GuideFollow | null;
  setFollow: (follow: GuideFollow | null) => void;
}

export const useGuide = create<GuideState>((set) => ({
  follow: null,
  setFollow: (follow) => set({ follow }),
}));
