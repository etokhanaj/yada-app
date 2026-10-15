/**
 * The review queue's list (flagged.ts) against the real sources. Skipped where YADA_ROOT/content/raw is absent,
 * as golden.test.ts is.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { highestVersionOnDisk } from "../package.js";
import { flaggedInBook, type FlaggedSummary } from "./flagged.js";
import { loadBook, understandPaths, type LoadedBook } from "./package.js";
import type { PassageReview } from "./passage.js";
import { summariseBook } from "./summaries.js";

const PATHS = understandPaths();
const HAVE = existsSync(path.join(PATHS.raw, "uw-ust/en_ust")) && existsSync(path.join(PATHS.raw, "bsb-tables/bsb_tables.tsv")) && highestVersionOnDisk("core", PATHS.bundles) > 0;
const SLOW = 120_000;
const HELD = "MAL.3.13-3.18";

describe.skipIf(!HAVE)("flagged summaries for review", () => {
  let loaded: LoadedBook;
  let listed: FlaggedSummary[];
  // A fixed review map, not the live file, which changes with John's decisions.
  const reviews = new Map<string, PassageReview>([[HELD, { status: "held", reason: "test hold" }]]);

  beforeAll(() => {
    loaded = loadBook("MAL", { paths: PATHS, verifyPins: false });
    listed = flaggedInBook(loaded.passages, reviews);
  }, SLOW);
  afterAll(() => loaded?.close());

  it("lists every gate-flagged summary and every one with a decision, flags taken before decisions", () => {
    const raw = summariseBook({ ...loaded.passages, reviews: new Map() });
    const expected = raw.filter((r) => r.flags.length > 0 || r.id === HELD).map((r) => r.id);
    expect(listed.map((s) => s.id)).toEqual(expected);
    const held = listed.find((s) => s.id === HELD);
    expect(held?.flags.some((f) => f.startsWith("held:"))).toBe(false);
    expect(held?.verses[0]).toMatchObject({ chapter: 3, verse: 13 });
    expect(held?.verses.at(-1)).toMatchObject({ chapter: 3, verse: 18 });
    expect(held?.verses.every((v) => v.text !== "")).toBe(true);
  });

  it("calls a summary reviewable only when an approval of its text would clear it", () => {
    for (const s of listed.filter((x) => x.reviewable)) {
      const approved = new Map<string, PassageReview>([[s.id, { status: "approved", sha256: createHash("sha256").update(s.text).digest("hex") }]]);
      const after = summariseBook({ ...loaded.passages, reviews: approved }).find((r) => r.id === s.id);
      expect(after?.flags).toEqual([]);
    }
    expect(listed.find((s) => s.id === HELD)?.reviewable).toBe(true);
  }, SLOW);
});
