/**
 * The guide's rules against the real bundles (rule 5: the data is the oracle,
 * the hand-copied fixture in lib/guide.test.ts the suspect). Skipped when
 * content/bundles has not been built.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { VerseEntry } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { evidenceMarks, GUIDE_PICKS, pickClaims } from "../lib/guide";
import { rangeInBook } from "../lib/saved";
import { getPericopes, getTextsInRange, getTokens, type Db } from "./queries";

const bundles = path.resolve(__dirname, "../../../../content/bundles");
const corePath = path.join(bundles, "core.v4.db");
const johnPath = path.join(bundles, "jhn.v2.db");
const have = existsSync(corePath) && existsSync(johnPath);

const open = (file: string): Db => {
  const db = new DatabaseSync(file, { readOnly: true });
  return {
    getAllAsync: async <T,>(sql: string, params: Array<string | number | null>) => db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T,>(sql: string, params: Array<string | number | null>) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
  };
};

describe.skipIf(!have)("the guide against the bundles", () => {
  const core = have ? open(corePath) : (null as unknown as Db);
  const john = have ? open(johnPath) : (null as unknown as Db);

  it("finds John's 46 passages, two of them across a chapter break (edge case 5)", async () => {
    const pericopes = await getPericopes(john);
    expect(pericopes).toHaveLength(46);
    const crossing = pericopes.filter((p) => Math.floor(p.start_ord / 1000) !== Math.floor(p.end_ord / 1000)).map((p) => rangeInBook(p.pericope_id));
    expect(crossing).toEqual(["7:53–8:11", "15:18–16:4"]);
  });

  it("marks the three 'was' of John 1:1 in the BSB from the SBLGNT tokens (PG-10)", async () => {
    const entry = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../golden/jhn.1.1.json"), "utf8")) as VerseEntry;
    const [c2] = pickClaims(entry.claims, ["c2"]);
    const [row] = await getTextsInRange(core, 43001001, 43001001);
    const text = row?.texts["BSB"] ?? "";
    const tokens = (await getTokens(core, 43001001)).words;
    const marks = c2 === undefined ? null : evidenceMarks(c2, [{ ord: 43001001, verseId: "JHN.1.1", text, tokens }]);
    expect(marks?.count).toBe(3);
    expect((marks?.ranges.get(43001001) ?? []).map(([a, b]) => text.slice(a, b))).toEqual(["was", "was", "was"]);
  });

  it("finds every claim the two full guides pick in the bundled entries", async () => {
    for (const [pericope, pick] of Object.entries(GUIDE_PICKS)) {
      const book = pericope.slice(0, 3).toLowerCase();
      const db = open(path.join(bundles, `${book}.v2.db`));
      const row = await db.getFirstAsync<{ payload: string }>("SELECT payload FROM entries WHERE verse_id = ?", [pick.entry]);
      const entry = JSON.parse(row?.payload ?? "{}") as VerseEntry;
      expect(pickClaims(entry.claims, [...pick.notice, ...pick.differ])).toHaveLength(pick.notice.length + pick.differ.length);
    }
  });
});
