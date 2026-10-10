/**
 * Reading settings. Three of them, deliberately: appearance, text size, and
 * translation. Apple Books puts type settings behind one quiet control and so
 * does Yada (design brief, "chrome that disappears").
 *
 * Text size multiplies on top of Dynamic Type rather than replacing it: PRD §8.8
 * requires system font scaling, "not only an in-app slider".
 */

import { create } from "zustand";

export type Appearance = "system" | "light" | "dark";
export type Translation = "BSB" | "WEB" | "KJV";

export const TRANSLATIONS: ReadonlyArray<{ code: Translation; name: string }> = [
  { code: "BSB", name: "Berean Standard Bible" },
  { code: "WEB", name: "World English Bible" },
  { code: "KJV", name: "King James Version" },
];

/** Steps rather than a continuous slider: each one is a size someone chose on purpose. */
export const TEXT_SCALES = [0.85, 0.92, 1, 1.1, 1.22, 1.36] as const;

interface SettingsState {
  appearance: Appearance;
  textScale: number;
  translation: Translation;
  /** First launch has opened John 1 (decision 1, JN-01). */
  launched: boolean;
  /** The reader's hint line has been seen and dismissed by a first tap. */
  hintSeen: boolean;
  /** Understand's one-time "Tap a line to see the evidence." has been shown. */
  evidenceHintSeen: boolean;
  hydrated: boolean;
  setAppearance: (value: Appearance) => void;
  setTextScale: (value: number) => void;
  setTranslation: (value: Translation) => void;
  markLaunched: () => void;
  markHintSeen: () => void;
  markEvidenceHintSeen: () => void;
  hydrate: (stored: Record<string, string>) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  appearance: "system",
  textScale: 1,
  translation: "BSB",
  launched: false,
  hintSeen: false,
  evidenceHintSeen: false,
  hydrated: false,
  setAppearance: (appearance) => set({ appearance }),
  setTextScale: (textScale) => set({ textScale }),
  setTranslation: (translation) => set({ translation }),
  markLaunched: () => set({ launched: true }),
  markHintSeen: () => set({ hintSeen: true }),
  markEvidenceHintSeen: () => set({ evidenceHintSeen: true }),
  hydrate: (stored) =>
    set({
      appearance: isAppearance(stored["appearance"]) ? stored["appearance"] : "system",
      textScale: TEXT_SCALES.includes(Number(stored["textScale"]) as (typeof TEXT_SCALES)[number])
        ? Number(stored["textScale"])
        : 1,
      translation: isTranslation(stored["translation"]) ? stored["translation"] : "BSB",
      launched: stored["launched"] === "1",
      hintSeen: stored["hintSeen"] === "1",
      evidenceHintSeen: stored["evidenceHintSeen"] === "1",
      hydrated: true,
    }),
}));

function isAppearance(value: string | undefined): value is Appearance {
  return value === "system" || value === "light" || value === "dark";
}

export function isTranslation(value: unknown): value is Translation {
  return value === "BSB" || value === "WEB" || value === "KJV";
}
