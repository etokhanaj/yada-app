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
  hydrated: boolean;
  setAppearance: (value: Appearance) => void;
  setTextScale: (value: number) => void;
  setTranslation: (value: Translation) => void;
  hydrate: (stored: Record<string, string>) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  appearance: "system",
  textScale: 1,
  translation: "BSB",
  hydrated: false,
  setAppearance: (appearance) => set({ appearance }),
  setTextScale: (textScale) => set({ textScale }),
  setTranslation: (translation) => set({ translation }),
  hydrate: (stored) =>
    set({
      appearance: isAppearance(stored["appearance"]) ? stored["appearance"] : "system",
      textScale: TEXT_SCALES.includes(Number(stored["textScale"]) as (typeof TEXT_SCALES)[number])
        ? Number(stored["textScale"])
        : 1,
      translation: isTranslation(stored["translation"]) ? stored["translation"] : "BSB",
      hydrated: true,
    }),
}));

function isAppearance(value: string | undefined): value is Appearance {
  return value === "system" || value === "light" || value === "dark";
}

export function isTranslation(value: unknown): value is Translation {
  return value === "BSB" || value === "WEB" || value === "KJV";
}
