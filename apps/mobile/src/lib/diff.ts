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

/** A stretch of a compared version as written, marked where it words the verse differently from yours. */
export interface MarkedPiece {
  readonly text: string;
  readonly marked: boolean;
}

export interface Comparison {
  readonly line: ChangeLine;
  /** The other version's text, whole, in order: joined, the pieces are the text exactly. */
  readonly pieces: readonly MarkedPiece[];
}

interface Run {
  from: string[];
  to: string[];
  /** Indexes, in the other version's words, of what this run says in place of yours. */
  marks: number[];
}

/**
 * Yours against another version (CP-01–05): one line of what it says differently, run by run, and its
 * text with those words marked. A word-level longest common subsequence on folded words, so punctuation
 * never counts (CP-03).
 *
 * The frames mark only words said in place of yours ("hasn’t", "only born"): a word the other adds with
 * nothing of yours opposite (KJV's opening "And" at John 1:5) is counted in the line's "more" but neither
 * marked nor named while a replacement can be named instead (CP-01, CP-05: "and → through him · 1 more change").
 */
export function compareVerse(yours: string, other: string): Comparison {
  const a = splitWords(yours).filter((w) => w.key !== "");
  const all = splitWords(other);
  // The words that count, each with its index in `all`, so marks land on the text as written.
  const kept = all.flatMap((word, at) => (word.key === "" ? [] : [{ word, at }]));
  const b = kept.map((k) => k.word);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = lcs[i] as number[];
      row[j] = a[i]?.key === b[j]?.key ? (lcs[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(lcs[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  // The alignment as a list of steps: a word both share, or a word only one side has.
  type Step = { kind: "same" | "from" | "to"; word: string; bi: number };
  const steps: Step[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i]?.key === b[j]?.key) {
      steps.push({ kind: "same", word: bare(a[i++] as WordPiece), bi: j++ });
    } else if (j >= b.length || (i < a.length && (lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0))) {
      steps.push({ kind: "from", word: bare(a[i++] as WordPiece), bi: -1 });
    } else {
      steps.push({ kind: "to", word: bare(b[j] as WordPiece), bi: j++ });
    }
  }
  // Runs of differing words. Two runs with a single shared word between them are one change, the word
  // on both sides: "one and only → only born" (CP-02), never "one and → …" and "… → born".
  const runs: Run[] = [];
  let open: Run | null = null;
  for (let k = 0; k < steps.length; k++) {
    const step = steps[k] as Step;
    if (step.kind === "same") {
      const next = steps[k + 1];
      if (open !== null && next !== undefined && next.kind !== "same") {
        open.from.push(step.word);
        open.to.push(step.word);
        open.marks.push(step.bi);
      } else {
        open = null;
      }
      continue;
    }
    if (open === null) {
      open = { from: [], to: [], marks: [] };
      runs.push(open);
    }
    open[step.kind].push(step.word);
    if (step.kind === "to") open.marks.push(step.bi);
  }
  const replaced = (r: Run) => r.from.length > 0 && r.to.length > 0;
  const marked = new Set(runs.filter(replaced).flatMap((r) => r.marks.flatMap((m) => kept[m]?.at ?? [])));
  const pieces = markPieces(all, marked);
  // Only the words that differ count towards "throughout", not a shared word a run bridges: counting those
  // called the KJV at John 1:5 worded differently throughout, where CP-01 names its changes.
  const differing = (kind: "from" | "to") => steps.filter((s) => s.kind === kind).length;
  const changed = Math.max(differing("from"), differing("to"));
  if (changed > Math.max(a.length, b.length) * THROUGHOUT) return { line: { changes: [], more: 0, throughout: true }, pieces };
  // A word only added or dropped is named only when nothing was replaced; otherwise it is one of the "more".
  const named = runs.some(replaced) ? runs.filter(replaced) : runs;
  const shown = named.slice(0, CHANGES_SHOWN).map((r) => `${r.from.join(" ") || "…"} → ${r.to.join(" ") || "…"}`);
  return { line: { changes: shown, more: runs.length - shown.length, throughout: false }, pieces };
}

/** The line alone, for a caller with no text to mark. */
export function changeLine(yours: string, other: string): ChangeLine {
  return compareVerse(yours, other).line;
}

const bare = (w: WordPiece) => w.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}’']+$/gu, "");

/**
 * The text cut into marked and unmarked stretches. A mark covers the word itself, never its punctuation
 * or the space after it ("<assemblies>,"), so neighbouring marks stay separate words, as CP-04 draws them.
 */
function markPieces(words: readonly WordPiece[], marked: ReadonlySet<number>): MarkedPiece[] {
  const out: MarkedPiece[] = [];
  const push = (text: string, isMarked: boolean) => {
    if (text === "") return;
    const last = out[out.length - 1];
    if (last !== undefined && last.marked === isMarked && !isMarked) out[out.length - 1] = { text: last.text + text, marked: false };
    else out.push({ text, marked: isMarked });
  };
  words.forEach((w, n) => {
    if (!marked.has(n)) return push(w.text + w.trailing, false);
    const match = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}’']*)$/u.exec(w.text);
    push(match?.[1] ?? "", false);
    push(match?.[2] ?? w.text, true);
    push((match?.[3] ?? "") + w.trailing, false);
  });
  return out;
}

/** CP-03: "All four say the same.", said once over the verse, never four copies of it. */
export function agreeLine(count: number): string {
  if (count === 2) return "Both say the same.";
  const words = ["", "", "two", "three", "four", "five", "six", "seven", "eight"];
  return `All ${words[count] ?? String(count)} say the same.`;
}

/** "has not → hasn’t · 1 more change", or "Worded differently throughout"; "" when nothing differs. */
export function changeText(line: ChangeLine): string {
  if (line.throughout) return "Worded differently throughout";
  const more = line.more === 0 ? [] : [`${line.more} more ${line.more === 1 ? "change" : "changes"}`];
  return [...line.changes, ...more].join(" · ");
}
