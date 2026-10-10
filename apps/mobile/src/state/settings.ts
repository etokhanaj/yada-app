/**
 * Reading settings. Three of them, deliberately: appearance, text size, and
 * translation. Apple Books puts type settings behind one quiet control and so
 * does Yada (design brief, "chrome that disappears"). Which versions Compare
 * shows rides along with the translation (plan, "Compare cap").
 *
 * Text size multiplies on top of Dynamic Type rather than replacing it: PRD §8.8
 * requires system font scaling, "not only an in-app slider".
 */

import { create } from "zustand";

import { isTranslation, type TranslationCode } from "../data/queries";
import { parseCompareChoice } from "../lib/compare";

export type Appearance = "system" | "light" | "dark";

/** Steps rather than a continuous slider: each one is a size someone chose on purpose. */
export const TEXT_SCALES = [0.85, 0.92, 1, 1.1, 1.22, 1.36] as const;

interface SettingsState {
  appearance: Appearance;
  textScale: number;
  /** A built-in code or an installed download's ("YLT"). */
  translation: TranslationCode;
  /** The versions Compare shows beside the reader's; null is the default (lib/compare.ts). */
  compareWith: string[] | null;
  /** First launch has opened John 1 (decision 1, JN-01). */
  launched: boolean;
  /** The reader's hint line has been seen and dismissed by a first tap. */
  hintSeen: boolean;
  /** Understand's one-time "Tap a line to see the evidence." has been shown. */
  evidenceHintSeen: boolean;
  hydrated: boolean;
  setAppearance: (value: Appearance) => void;
  setTextScale: (value: number) => void;
  setTranslation: (value: TranslationCode) => void;
  setCompareWith: (value: string[] | null) => void;
  markLaunched: () => void;
  markHintSeen: () => void;
  markEvidenceHintSeen: () => void;
  /** `installed`: downloads attached this launch, so a saved choice of one survives. */
  hydrate: (stored: Record<string, string>, installed?: readonly string[]) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  appearance: "system",
  textScale: 1,
  translation: "BSB",
  compareWith: null,
  launched: false,
  hintSeen: false,
  evidenceHintSeen: false,
  hydrated: false,
  setAppearance: (appearance) => set({ appearance }),
  setTextScale: (textScale) => set({ textScale }),
  setTranslation: (translation) => set({ translation }),
  setCompareWith: (compareWith) => set({ compareWith }),
  markLaunched: () => set({ launched: true }),
  markHintSeen: () => set({ hintSeen: true }),
  markEvidenceHintSeen: () => set({ evidenceHintSeen: true }),
  hydrate: (stored, installed = []) => {
    const translation = stored["translation"];
    set({
      appearance: isAppearance(stored["appearance"]) ? stored["appearance"] : "system",
      textScale: TEXT_SCALES.includes(Number(stored["textScale"]) as (typeof TEXT_SCALES)[number])
        ? Number(stored["textScale"])
        : 1,
      // A download that failed to attach (or was removed) falls back to BSB, as Remove does.
      translation: isTranslation(translation) || (translation !== undefined && installed.includes(translation)) ? translation : "BSB",
      compareWith: parseCompareChoice(stored["compareWith"]),
      launched: stored["launched"] === "1",
      hintSeen: stored["hintSeen"] === "1",
      evidenceHintSeen: stored["evidenceHintSeen"] === "1",
      hydrated: true,
    });
  },
}));

function isAppearance(value: string | undefined): value is Appearance {
  return value === "system" || value === "light" || value === "dark";
}
