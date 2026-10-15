/**
 * Depth (brief §8.14, canvas DP-01–DP-03): a passage's own word as its cover. It was chosen from the AI
 * entries' key words, which are retired (docs/no-ai-understand.md), so no word is chosen now and the
 * passage title takes the slot.
 */

export interface CoverWord {
  readonly surface: string;
  readonly translit: string;
  readonly gloss: string | null;
}
