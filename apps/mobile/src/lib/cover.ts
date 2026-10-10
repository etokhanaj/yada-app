/**
 * Depth (brief §8.14, canvas DP-01–DP-03): a passage's own word as its cover.
 * The word is the first `key_words` entry of the first entry in the passage;
 * its transliteration and gloss come from that verse's sourced token
 * (STEPBible), never the entry's generated gloss, so the cover carries no
 * unreviewed text. A passage with no entry has no word: its title takes the slot.
 */

export interface CoverWord {
  readonly surface: string;
  readonly translit: string;
  readonly gloss: string | null;
}

export function pickCoverWord(
  keyWords: ReadonlyArray<{ surface: string }>,
  tokens: ReadonlyArray<{ surface: string; translit: string; gloss: string | null }>,
): CoverWord | null {
  for (const kw of keyWords) {
    const token = tokens.find((t) => t.surface === kw.surface);
    if (token !== undefined) return { surface: token.surface, translit: token.translit, gloss: token.gloss };
  }
  return null;
}
