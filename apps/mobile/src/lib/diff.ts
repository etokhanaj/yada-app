/**
 * Translation compare: which words differ between English versions.
 *
 * Word-level longest common subsequence. Words are compared on a folded key —
 * lowercase, curly quotes straightened, punctuation stripped — because the
 * question a reader is asking is "did the translators choose different words",
 * not "did they punctuate differently". The 1 Corinthians 14:34 entry says the
 * three versions there differ mainly in punctuation; a diff that lit up every
 * comma would contradict it.
 */

export interface WordPiece {
  /** The word as written, with its punctuation. */
  readonly text: string;
  /** Whitespace that followed it in the source. */
  readonly trailing: string;
  readonly key: string;
}

export interface MarkedWord extends WordPiece {
  readonly divergent: boolean;
}

export function foldWord(word: string): string {
  return word
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, "")
    .replace(/^'+|'+$/g, "");
}

export function splitWords(text: string): WordPiece[] {
  const pieces: WordPiece[] = [];
  const pattern = /(\S+)(\s*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const word = match[1] ?? "";
    pieces.push({ text: word, trailing: match[2] ?? "", key: foldWord(word) });
  }
  return pieces;
}

/** True when the versions choose different words, not merely different punctuation. */
export function hasRealDivergence(texts: readonly string[]): boolean {
  const keys = texts.map((text) =>
    splitWords(text)
      .map((w) => w.key)
      .filter((k) => k !== "")
      .join(" "),
  );
  return keys.some((k) => k !== keys[0]);
}

/**
 * Function words, including the KJV's archaic ones (unto, saith), that never
 * carry a difference mark: marking them made a third of 1 Cor 14:34–35 light
 * up, so the marks stopped guiding (v2-review X6).
 */
const UNMARKED = new Set(
  "unto saith thing anything any been keep also the a an and or but to of in for is are be as it they them their if at on with about this that let your own has have not must were was its so he she his her him from by do did no nor".split(
    " ",
  ),
);

/** First five letters: "silent" and "silence" are the same choice of word. */
const stem = (word: string) => foldWord(word).slice(0, 5);

/**
 * Amendment 2 (J01-13): only the reader's translation carries marks, on its
 * content words whose stem no other version uses. WEB and KJV are shown
 * unmarked beneath it.
 */
export function markReadingDifferences(base: string, others: readonly string[]): MarkedWord[] {
  const pool = new Set(others.flatMap((o) => splitWords(o).map((w) => stem(w.text))));
  return splitWords(base).map((w) => {
    const key = foldWord(w.text);
    const content = /\p{L}/u.test(key) && !UNMARKED.has(key);
    return { ...w, divergent: content && !pool.has(stem(w.text)) };
  });
}
