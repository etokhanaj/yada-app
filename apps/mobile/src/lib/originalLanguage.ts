import type { Script } from "../data/queries";

export type OriginalLanguage = "Greek" | "Hebrew" | "Aramaic" | "Hebrew and Aramaic";

/**
 * The language a verse or word is written in, from its tokens' morphology codes, whose first letter is
 * OSHB's language: "H" Hebrew, "A" Aramaic (packages/schema morph.ts). Calling Daniel 3 Hebrew states
 * something the data says is not so (rule 4; John, 15 Oct 2026). Daniel 2:4 switches mid-verse, so a
 * span holding both says both. No tokens (a verse the source omits) falls back to the book's script.
 */
export function originalLanguage(script: Script, letters: Iterable<string>): OriginalLanguage {
  if (script === "greek") return "Greek";
  let hebrew = false;
  let aramaic = false;
  for (const l of letters) {
    if (l === "A") aramaic = true;
    else if (l === "H") hebrew = true;
  }
  if (aramaic) return hebrew ? "Hebrew and Aramaic" : "Aramaic";
  return "Hebrew";
}
