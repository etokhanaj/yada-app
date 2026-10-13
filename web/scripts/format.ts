/** Small formatting helpers for render.ts, kept apart so they can be tested. */

export const BOOKS: Record<string, string> = {
  GEN: "Genesis",
  LEV: "Leviticus",
  PSA: "Psalm",
  ISA: "Isaiah",
  JHN: "John",
  "1CO": "1 Corinthians",
  REV: "Revelation",
};

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "1CO.14.34" → "1 Corinthians 14:34", with no-break spaces so a reference never splits. */
export function ref(verseId: string): string {
  const [book = "", chapter, verse] = verseId.split(".");
  return `${BOOKS[book] ?? book} ${chapter}:${verse}`.replace(/ /g, "&nbsp;");
}

export const times = (n: number): string => `${n.toLocaleString("en-GB")} ${n === 1 ? "time" : "times"}`;

/** Greek without accents, breathings or case, so καὶ and καί, Ἐν and ἐν count as the same word. */
export const bare = (word: string): string => word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
