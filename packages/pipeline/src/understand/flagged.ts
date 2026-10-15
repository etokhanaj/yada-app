/**
 * The passage summaries John reviews by hand (packages/review, "Passage summaries"). Read-only: it builds each
 * book's summaries as `yada understand` does and writes nothing.
 *
 * A summary is listed when the gate flags it, or when passage_reviews.json already has a decision for it (a
 * hold hides one the gate passed). Flags are taken with no hand decisions applied, so an approved summary
 * stays listed with the flags John approved it over.
 *
 * `reviewable` is proven, not assumed: the book is summarised again with every listed text approved by its own
 * sha256, and a summary counts only if that clears its flags. A passage with no candidate sentences, and Psalms
 * and Proverbs, are built on paths that never read passage_reviews.json, so an approval there would be a click
 * that changes nothing (9 of 60 on 15 Oct 2026).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadBook, readPassageReviews, understandPaths, type UnderstandPaths } from "./package.js";
import type { PassageBookData, PassageResult, PassageReview } from "./passage.js";
import { vk } from "./sources.js";
import { summariseBook } from "./summaries.js";

export interface FlaggedSummary {
  id: string;
  book: string;
  label: string;
  range: string;
  /** The summary exactly as built: the text an approval's sha256 is taken of. */
  text: string;
  /** The gate's flags, before any hand decision. Empty for a summary only a hold hides. */
  flags: string[];
  /** Whether an approval in passage_reviews.json would show it. */
  reviewable: boolean;
  /** BSB, in order, for context. */
  verses: Array<{ chapter: number; verse: number; text: string }>;
}

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** One book's listed summaries. `reviews` is passage_reviews.json's entries, read only for which ids it names. */
export function flaggedInBook(data: PassageBookData, reviews: ReadonlyMap<string, PassageReview>): FlaggedSummary[] {
  const raw = summariseBook({ ...data, reviews: new Map() });
  const listed = raw.filter((r) => r.flags.length > 0 || reviews.has(r.id));
  const approveAll = new Map<string, PassageReview>(listed.map((r) => [r.id, { status: "approved", sha256: sha256(r.text) }]));
  const cleared = new Set(
    summariseBook({ ...data, reviews: approveAll })
      .filter((r) => r.flags.length === 0)
      .map((r) => r.id),
  );
  return listed.map((r) => toFlagged(data, r, cleared.has(r.id)));
}

function toFlagged(data: PassageBookData, r: PassageResult, reviewable: boolean): FlaggedSummary {
  const verses = [...data.ordRef]
    .filter(([ord, [, v]]) => ord >= r.startOrd && ord <= r.endOrd && v > 0)
    .sort(([a], [b]) => a - b)
    .map(([, [chapter, verse]]) => ({ chapter, verse, text: data.bsb.get(vk(chapter, verse)) ?? "" }));
  return { id: r.id, book: data.book, label: r.label, range: r.range, text: r.text, flags: r.flags, reviewable, verses };
}

/** Every book in the manifest's `understand` list, in its order. */
export function flaggedSummaries(paths: UnderstandPaths = understandPaths()): FlaggedSummary[] {
  const manifest = JSON.parse(readFileSync(path.join(paths.bundles, "manifest.json"), "utf8")) as { understand?: Array<{ book: string }> };
  const reviews = readPassageReviews();
  const out: FlaggedSummary[] = [];
  for (const { book } of manifest.understand ?? []) {
    const loaded = loadBook(book, { paths, verifyPins: false });
    try {
      out.push(...flaggedInBook(loaded.passages, reviews));
    } finally {
      loaded.close();
    }
  }
  return out;
}

// The review server runs this file as a child process and reads the list as JSON on stdout.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.stdout.write(JSON.stringify(flaggedSummaries()));
}
