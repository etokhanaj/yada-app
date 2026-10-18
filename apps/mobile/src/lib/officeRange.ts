/**
 * The Daily Office lectionary's verse ranges as spans of a chapter (Daily prayer, build 8). Pure, so it is tested.
 *
 * - "5:8–12, 18–23": two spans in chapter 5. "2:13–3:5": to the end of 2, then 3:1–5.
 * - "2:1–10a": the whole of verse 10; a verse is the smallest unit Yada's texts have.
 * - "(27–33)" is optional in the Prayer Book and left out; "[100]" is an alternative psalm, skipped.
 * - "17–25" with no chapter is a one-chapter book (Jude, Philemon and the like).
 */

export interface Span {
  readonly chapter: number;
  readonly from: number;
  /** Inclusive; Infinity runs to the chapter's end. */
  readonly to: number;
}

const num = (s: string): number => Number.parseInt(s, 10);

export function spans(ref: string): Span[] {
  const clean = ref.replace(/\([^)]*\)/g, ",").replace(/\[[^\]]*\]/g, "");
  const out: Span[] = [];
  let chapter: number | null = null;
  for (const part of clean.split(",").map((p) => p.trim()).filter((p) => p !== "")) {
    const m = /^(?:(\d+):)?(\d+)[ab]?(?:[–-](?:(\d+):)?(\d+)[ab]?)?$/.exec(part);
    if (m === null) continue;
    const [, c1, v1, c2, v2] = m;
    if (c1 === undefined && chapter === null && v2 === undefined && !part.includes(":")) {
      // A bare number before any chapter is a whole psalm ("146").
      out.push({ chapter: num(v1 ?? "0"), from: 1, to: Infinity });
      continue;
    }
    const start: number = c1 !== undefined ? num(c1) : (chapter ?? 1);
    chapter = start;
    const from = num(v1 ?? "1");
    if (v2 === undefined) {
      out.push({ chapter: start, from, to: from });
    } else if (c2 !== undefined && num(c2) !== start) {
      out.push({ chapter: start, from, to: Infinity });
      for (let c = start + 1; c < num(c2); c += 1) out.push({ chapter: c, from: 1, to: Infinity });
      out.push({ chapter: num(c2), from: 1, to: num(v2) });
      chapter = num(c2);
    } else {
      out.push({ chapter: start, from, to: num(v2) });
    }
  }
  return out;
}

/** A psalm entry: "146", "119:1–24", "21:1–7(8–14)"; an alternative "[100]" gives nothing. */
export function psalmSpans(entry: string): Span[] {
  if (/^\s*\[/.test(entry)) return [];
  const bare = entry.trim();
  return /^\d+$/.test(bare) ? [{ chapter: num(bare), from: 1, to: Infinity }] : spans(bare);
}
