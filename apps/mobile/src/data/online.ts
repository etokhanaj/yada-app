/**
 * The Translations sheet's Online group (canvas MT-02): licensed versions read
 * through API.Bible, display-only (CLAUDE.md rule 9, docs/licensed-translations.md).
 *
 * This file is the hook point only. The fetch layer is built separately and
 * registers itself with registerOnlineProvider(); until it does, the group
 * shows placeholder rows, and only behind the dev flag. Nothing here talks to
 * a network, and nothing from these versions may reach the content pipeline.
 */

import { create } from "zustand";

import type { CoverTone } from "../lib/translations";

/** EXPO_PUBLIC_ONLINE_TRANSLATIONS=1 in a development build shows the group. */
export const SHOW_ONLINE_TRANSLATIONS = __DEV__ && process.env.EXPO_PUBLIC_ONLINE_TRANSLATIONS === "1";

export interface OnlineTranslation {
  readonly code: string;
  readonly name: string;
  /** The rights holder, the row's one muted line ("Biblica"). */
  readonly publisher: string;
  readonly cover: CoverTone;
}

export interface OnlineTranslationProvider {
  /** What the account can show; replaces the placeholders once registered. */
  readonly translations: readonly OnlineTranslation[];
  /** The reader picked one: the provider owns fetching, its 30-day cache and the notice it must show. */
  choose(code: string): void;
}

/** From docs/licensed-translations.md: the three versions on the account, and their rights holders. */
export const ONLINE_PLACEHOLDERS: readonly OnlineTranslation[] = [
  { code: "NIV", name: "New International Version", publisher: "Biblica", cover: "sage" },
  { code: "NKJV", name: "New King James Version", publisher: "Thomas Nelson", cover: "forest" },
  { code: "NLT", name: "New Living Translation", publisher: "Tyndale House", cover: "paper" },
];

export const useOnlineProvider = create<{ provider: OnlineTranslationProvider | null }>(() => ({ provider: null }));

export function registerOnlineProvider(provider: OnlineTranslationProvider | null): void {
  useOnlineProvider.setState({ provider });
}
