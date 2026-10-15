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

/** More than this share of the words changed, and Compare says "Worded differently throughout" (CP-04). */
const THROUGHOUT = 0.5;
const CHANGES_SHOWN = 2;

export interface ChangeLine {
  /** "has not → hasn’t", each a run of words that differs between yours and this version. */
  readonly changes: readonly string[];
  /** Runs beyond the first two: "· 1 more change". */
  readonly more: number;
  readonly throughout: boolean;
}

/**
 * One line under each compared version (CP-01, CP-02): what it says differently from yours, run by run,
 * by a word-level longest common subsequence on folded words, so punctuation never counts (CP-03).
 */
export function changeLine(yours: string, other: string): ChangeLine {
  const a = splitWords(yours).filter((w) => w.key !== "");
  const b = splitWords(other).filter((w) => w.key !== "");
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = lcs[i] as number[];
      row[j] = a[i]?.key === b[j]?.key ? (lcs[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(lcs[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  // The alignment as a list of steps: a word both share, or a word only one side has.
  type Step = { kind: "same"; word: string } | { kind: "from" | "to"; word: string };
  const steps: Step[] = [];
  let i = 0;
  let j = 0;
  const bare = (w: WordPiece) => w.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}’']+$/gu, "");
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i]?.key === b[j]?.key) {
      steps.push({ kind: "same", word: bare(a[i++] as WordPiece) });
      j++;
    } else if (j >= b.length || (i < a.length && (lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0))) {
      steps.push({ kind: "from", word: bare(a[i++] as WordPiece) });
    } else {
      steps.push({ kind: "to", word: bare(b[j++] as WordPiece) });
    }
  }
  // Runs of differing words. Two runs with a single shared word between them are one change, the word
  // on both sides: "one and only → only born" (CP-02), never "one and → …" and "… → born".
  const runs: Array<{ from: string[]; to: string[] }> = [];
  let open: { from: string[]; to: string[] } | null = null;
  for (let k = 0; k < steps.length; k++) {
    const step = steps[k] as Step;
    if (step.kind === "same") {
      const next = steps[k + 1];
      if (open !== null && next !== undefined && next.kind !== "same") {
        open.from.push(step.word);
        open.to.push(step.word);
      } else {
        open = null;
      }
      continue;
    }
    if (open === null) {
      open = { from: [], to: [] };
      runs.push(open);
    }
    open[step.kind].push(step.word);
  }
  const changed = runs.reduce((n, r) => n + Math.max(r.from.length, r.to.length), 0);
  if (changed > Math.max(a.length, b.length) * THROUGHOUT) return { changes: [], more: 0, throughout: true };
  const lines = runs.map((r) => `${r.from.join(" ") || "…"} → ${r.to.join(" ") || "…"}`);
  return { changes: lines.slice(0, CHANGES_SHOWN), more: Math.max(0, lines.length - CHANGES_SHOWN), throughout: false };
}

/** "has not → hasn’t · 1 more change", or "Worded differently throughout"; "" when nothing differs. */
export function changeText(line: ChangeLine): string {
  if (line.throughout) return "Worded differently throughout";
  const more = line.more === 0 ? [] : [`${line.more} more ${line.more === 1 ? "change" : "changes"}`];
  return [...line.changes, ...more].join(" · ");
}
