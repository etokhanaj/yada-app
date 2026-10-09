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

/**
 * Indices of `a` and `b` that sit on one longest common subsequence of keys.
 * Words that fold to nothing (a lone dash) count as matched: punctuation is not
 * a divergence.
 */
export function lcsMatches(a: readonly WordPiece[], b: readonly WordPiece[]): { a: boolean[]; b: boolean[] } {
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const row = table[i] as number[];
      row[j] =
        a[i]?.key === b[j]?.key
          ? (table[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(table[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const matchedA = a.map((w) => w.key === "");
  const matchedB = b.map((w) => w.key === "");
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i]?.key === b[j]?.key) {
      matchedA[i] = true;
      matchedB[j] = true;
      i++;
      j++;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      i++;
    } else {
      j++;
    }
  }
  return { a: matchedA, b: matchedB };
}

export interface ComparedText<T extends string = string> {
  readonly translation: T;
  readonly words: MarkedWord[];
}

/**
 * Compare every text against the one being read. Each other version marks the
 * words the base lacks; the base marks only the words no other version shares.
 * Marking a base word whenever any one version lacked it shaded most of BSB at
 * 1 Corinthians 14:34 (simulator, App v1) — so much that nothing stood out.
 */
export function compareTranslations<T extends string>(
  base: { translation: T; text: string },
  others: ReadonlyArray<{ translation: T; text: string }>,
): Array<ComparedText<T>> {
  const baseWords = splitWords(base.text);
  const sharedSomewhere = baseWords.map(() => others.length === 0);
  const compared: Array<ComparedText<T>> = [];
  for (const other of others) {
    const words = splitWords(other.text);
    const { a, b } = lcsMatches(baseWords, words);
    a.forEach((matched, index) => {
      if (matched) sharedSomewhere[index] = true;
    });
    compared.push({ translation: other.translation, words: words.map((w, index) => ({ ...w, divergent: !b[index] })) });
  }
  return [
    { translation: base.translation, words: baseWords.map((w, index) => ({ ...w, divergent: !(sharedSomewhere[index] ?? true) })) },
    ...compared,
  ];
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
