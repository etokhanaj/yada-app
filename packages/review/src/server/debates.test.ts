import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import type { DebatePassage, DebatesResponse, PositionDecisionResponse } from "../shared/api.js";
import { decisionsPath, RefusedError } from "./actions.js";
import {
  buildDebates,
  counterText,
  decidePosition,
  FIRST_PASSAGE_ID,
  type DebatesContext,
  type PositionDecisionRecord,
} from "./debates.js";
import { startReviewServer } from "./main.js";
import { createTempStaging } from "./test-staging.js";

/** A frozen copy of debates.json from before John's review (0a2dd49: every position a draft). The live file changes
 * with each decision John makes in the queue, so tests read this snapshot, copied to a temp dir, never the live file. */
const REAL_DEBATES = path.join(path.dirname(new URL(import.meta.url).pathname), "fixtures", "debates.pre-review.json");

const JHN_6 = [
  [53, "So Jesus said to them, “Truly, truly, I tell you, unless you eat the flesh…"],
  [54, "Whoever eats My flesh and drinks My blood has eternal life…"],
  [55, "For My flesh is real food, and My blood is real drink."],
  [56, "Whoever eats My flesh and drinks My blood remains in Me, and I in him."],
  [57, "Just as the living Father sent Me and I live because of the Father…"],
  [58, "This is the bread that came down from heaven…"],
] as const;

interface TempDebates {
  dir: string;
  debatesPath: string;
  ctx: DebatesContext;
}

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
});

function setup(): TempDebates {
  const dir = mkdtempSync(path.join(tmpdir(), "yada-debates-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const debatesPath = path.join(dir, "debates.json");
  copyFileSync(REAL_DEBATES, debatesPath);

  const coreDbPath = path.join(dir, "core.db");
  const core = new DatabaseSync(coreDbPath);
  core.exec(`
    CREATE TABLE verses (ord INTEGER PRIMARY KEY, verse_id TEXT NOT NULL UNIQUE, book TEXT NOT NULL,
                         chapter INTEGER NOT NULL, verse INTEGER NOT NULL);
    CREATE TABLE texts (translation TEXT NOT NULL, ord INTEGER NOT NULL, text TEXT NOT NULL);`);
  for (const [verse, text] of JHN_6) {
    const ord = 43_006_000 + verse;
    core.prepare("INSERT INTO verses VALUES (?, ?, 'JHN', 6, ?)").run(ord, `JHN.6.${verse}`, verse);
    core.prepare("INSERT INTO texts VALUES ('BSB', ?, ?)").run(ord, text);
    core.prepare("INSERT INTO texts VALUES ('WEB', ?, 'not BSB')").run(ord);
  }
  core.close();

  return {
    dir,
    debatesPath,
    ctx: {
      debatesPath,
      coreDbPath,
      reviewDir: path.join(dir, "review"),
      reviewer: "tester",
      now: () => new Date("2026-10-12T10:00:00.000Z"),
    },
  };
}

function passage(ctx: DebatesContext, id: string): DebatePassage {
  const found = buildDebates(ctx).passages.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no passage ${id}`);
  return found;
}

function sha(ctx: DebatesContext, id: string, index: number): string {
  const position = passage(ctx, id).positions[index];
  if (position === undefined) throw new Error(`no position ${index}`);
  return position.text_sha256;
}

function storedStatus(file: string, id: string, index: number): unknown {
  const data = JSON.parse(readFileSync(file, "utf8")) as {
    entries: Array<{ book: string; from: number[]; to: number[]; positions?: Array<{ status: string }> }>;
  };
  const entry = data.entries.find((e) => `${e.book}.${e.from.join(".")}-${e.to.join(".")}` === id);
  return entry?.positions?.[index]?.status;
}

function logLines(dir: string): PositionDecisionRecord[] {
  const file = decisionsPath(dir);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as PositionDecisionRecord);
}

function leftoverTemps(file: string): string[] {
  return readdirSync(path.dirname(file)).filter((name) => name.endsWith(".tmp"));
}

function refusal(fn: () => unknown): RefusedError {
  try {
    fn();
  } catch (error) {
    if (error instanceof RefusedError) return error;
    throw error;
  }
  throw new Error("expected the decision to be refused");
}

describe("debate positions queue", () => {
  it("holds the 19 positions passages, JHN 6:53–58 first, then canonical order", () => {
    const { ctx } = setup();
    const { passages } = buildDebates(ctx);
    expect(passages).toHaveLength(19);
    expect(passages[0]?.id).toBe(FIRST_PASSAGE_ID);
    expect(passages[0]?.display_ref).toBe("John 6:53–58");
    expect(passages.slice(1).map((p) => p.id)).toEqual([
      "GEN.1.1-2.3",
      "GEN.1.26-1.26",
      "JDG.11.29-11.40",
      "1SA.28.7-28.20",
      "PSA.2.7-2.7",
      "PSA.137.8-137.9",
      "PRO.8.22-8.31",
      "ISA.14.12-14.15",
      "ISA.52.13-53.12",
      "JER.31.31-31.34",
      "EZK.28.12-28.19",
      "EZK.40.1-48.35",
      "MIC.5.2-5.2",
      "ROM.7.14-7.25",
      "ROM.13.1-13.7",
      "JAS.2.14-2.26",
      "REV.7.4-7.8",
      "REV.13.1-13.18",
    ]);
    const refs = passages.map((p) => p.display_ref);
    expect(refs).toContain("Psalm 2:7");
    expect(refs).toContain("Isaiah 52:13–53:12");
  });

  it("carries the BSB text of the range, in order, and nothing from other translations", () => {
    const { ctx } = setup();
    const jhn = passage(ctx, FIRST_PASSAGE_ID);
    expect(jhn.verses.map((v) => v.verse)).toEqual([53, 54, 55, 56, 57, 58]);
    expect(jhn.verses[0]?.text).toBe(JHN_6[0][1]);
    expect(jhn.verses.some((v) => v.text === "not BSB")).toBe(false);
  });

  it("never puts question, kind, ref or note in the payload", () => {
    const { ctx } = setup();
    const payload = JSON.stringify(buildDebates(ctx));
    expect(payload).not.toMatch(/"(question|kind|ref|note|_why|suggested_note)"/);

    const raw = JSON.parse(readFileSync(ctx.debatesPath, "utf8")) as {
      entries: Array<{ question?: string; kind?: string; positions?: Array<{ ref?: string; note?: string }> }>;
    };
    for (const entry of raw.entries.filter((e) => e.kind === "positions" && (e.positions?.length ?? 0) > 0)) {
      if (entry.question !== undefined) expect(payload).not.toContain(entry.question);
      for (const p of entry.positions ?? []) {
        if (p.ref !== undefined) expect(payload).not.toContain(p.ref);
        if (p.note !== undefined) expect(payload).not.toContain(p.note);
      }
    }
  });

  it("shows held_by and the check flag, which never blocks approval", () => {
    const { ctx } = setup();
    const isa = passage(ctx, "ISA.52.13-53.12");
    expect(isa.positions.some((p) => p.held_by === "the Targum")).toBe(true);

    // Ellicott vol. 8's Revelation lines carry the page-scan flag (its scan is damaged; no second copy).
    const rev = passage(ctx, "REV.13.1-13.18");
    const checked = rev.positions.findIndex((p) => p.check);
    expect(checked).toBeGreaterThanOrEqual(0);
    const after = decidePosition(ctx, rev.id, String(checked), "approve", {
      text_sha256: sha(ctx, rev.id, checked),
      side: "symbolic",
    });
    expect(after.positions[checked]?.status).toBe("approved");
  });

  it("lists positions on a tn-readings or data entry, never on a held one", () => {
    const { ctx } = setup();
    const data = JSON.parse(readFileSync(ctx.debatesPath, "utf8")) as {
      entries: Array<{ book: string; from: number[]; kind?: string; positions?: unknown[] }>;
    };
    const draft = { text: "A source sentence.", source: "Tyndale Open Study Notes", ref: "TYN 6:1-2", status: "draft" };
    const pick = (kind: string) => {
      const entry = data.entries.find((e) => e.kind === kind && (e.positions?.length ?? 0) === 0);
      if (entry === undefined) throw new Error(`no empty ${kind} entry in the fixture`);
      entry.positions = [draft];
      return `${entry.book}.${entry.from.join(".")}`;
    };
    const tn = pick("tn-readings");
    const held = pick("held");
    writeFileSync(ctx.debatesPath, JSON.stringify(data, null, 1));

    const ids = buildDebates(ctx).passages.map((p) => p.id);
    expect(ids).toHaveLength(20);
    expect(ids.some((id) => id.startsWith(`${tn}-`))).toBe(true);
    expect(ids.some((id) => id.startsWith(`${held}-`))).toBe(false);
  });

  it("shows a passage only once approved positions hold two distinct sides", () => {
    expect(counterText(1, 0)).toBe("1 position · doesn't show");
    expect(counterText(2, 0)).toBe("2 positions approved · shows in the app");
    expect(counterText(0, 2)).toBe("0 positions · doesn't show · 2 need a side");

    const { ctx } = setup();
    const id = FIRST_PASSAGE_ID;
    expect(passage(ctx, id).counter).toBe("0 positions · doesn't show");

    const one = decidePosition(ctx, id, "0", "approve", { text_sha256: sha(ctx, id, 0), side: "Lord's Supper" });
    expect([one.approved, one.sides, one.shows_in_app, one.counter]).toEqual([1, ["Lord's Supper"], false, "1 position · doesn't show"]);

    decidePosition(ctx, id, "1", "reject", { text_sha256: sha(ctx, id, 1) });
    expect(passage(ctx, id).approved).toBe(1);

    // Two approved sentences on one side are not two positions (1 Corinthians 11:2–16); case and spacing match.
    const same = decidePosition(ctx, id, "2", "approve", { text_sha256: sha(ctx, id, 2), side: "  lord's   supper " });
    expect([same.approved, same.sides, same.shows_in_app]).toEqual([2, ["Lord's Supper"], false]);
    expect(same.positions[2]?.side).toBe("lord's supper");
    expect(same.counter).toBe("1 position · doesn't show");

    const two = decidePosition(ctx, id, "3", "approve", { text_sha256: sha(ctx, id, 3), side: "believing" });
    expect([two.approved, two.sides, two.shows_in_app]).toEqual([3, ["Lord's Supper", "believing"], true]);
    expect(two.counter).toBe("2 positions approved · shows in the app");
  });

  it("refuses to approve without a side, and takes a side only on approve and side", () => {
    const { ctx } = setup();
    const id = FIRST_PASSAGE_ID;
    const text_sha256 = sha(ctx, id, 0);
    expect(refusal(() => decidePosition(ctx, id, "0", "approve", { text_sha256 })).httpStatus).toBe(400);
    expect(refusal(() => decidePosition(ctx, id, "0", "approve", { text_sha256, side: "   " })).httpStatus).toBe(400);
    expect(refusal(() => decidePosition(ctx, id, "0", "approve", { text_sha256, side: "x".repeat(41) })).httpStatus).toBe(400);
    expect(refusal(() => decidePosition(ctx, id, "0", "reject", { text_sha256, side: "a" })).httpStatus).toBe(400);
    expect(refusal(() => decidePosition(ctx, id, "0", "approve", { text_sha256, side: "a", text: "new" })).httpStatus).toBe(400);
    // A side is set on an approved position only.
    expect(refusal(() => decidePosition(ctx, id, "0", "side", { text_sha256, side: "a" })).httpStatus).toBe(409);
    expect(storedStatus(ctx.debatesPath, id, 0)).toBe("draft");
    expect(logLines(ctx.reviewDir)).toEqual([]);
  });

  it("tags an approved position's side, lists it as needing one until then, and logs the action", () => {
    const { ctx } = setup();
    const id = FIRST_PASSAGE_ID;
    // An approval from before sides existed: approved, no side.
    const data = JSON.parse(readFileSync(ctx.debatesPath, "utf8")) as { entries: Array<Record<string, unknown>> };
    const jhn = data.entries.find((e) => e["book"] === "JHN") as { positions: Array<Record<string, unknown>> };
    (jhn.positions[0] as Record<string, unknown>)["status"] = "approved";
    (jhn.positions[1] as Record<string, unknown>)["status"] = "approved";
    writeFileSync(ctx.debatesPath, JSON.stringify(data, null, 1));
    const textBefore = jhn.positions.map((p) => p["text"]);

    const before = passage(ctx, id);
    expect([before.approved, before.sides, before.needs_side, before.shows_in_app]).toEqual([2, [], 2, false]);
    expect(before.counter).toBe("0 positions · doesn't show · 2 need a side");

    const tagged = decidePosition(ctx, id, "0", "side", { text_sha256: sha(ctx, id, 0), side: "Lord's Supper" });
    expect([tagged.positions[0]?.status, tagged.positions[0]?.side, tagged.needs_side]).toEqual(["approved", "Lord's Supper", 1]);
    expect(refusal(() => decidePosition(ctx, id, "0", "side", { text_sha256: sha(ctx, id, 0), side: "Lord's Supper" })).httpStatus).toBe(409);
    const retagged = decidePosition(ctx, id, "0", "side", { text_sha256: sha(ctx, id, 0), side: "sacrament" });
    expect(retagged.positions[0]?.side).toBe("sacrament");

    const stored = JSON.parse(readFileSync(ctx.debatesPath, "utf8")) as typeof data;
    const after = stored.entries.find((e) => e["book"] === "JHN") as typeof jhn;
    expect(after.positions.map((p) => p["text"])).toEqual(textBefore);
    expect(after.positions[0]?.["side"]).toBe("sacrament");

    const lines = logLines(ctx.reviewDir);
    expect(lines.map((l) => [l.decision, l.action, l.side, l.previous_side])).toEqual([
      ["side", "side", "Lord's Supper", null],
      ["side", "side", "sacrament", "Lord's Supper"],
    ]);
    expect(lines[0]).toMatchObject({ kind: "debate_position", status: "approved", previous_status: "approved", position: 0 });
  });

  it("accepts a suggested side in one tap; a suggestion alone counts for nothing", () => {
    const { ctx } = setup();
    const id = FIRST_PASSAGE_ID;
    const data = JSON.parse(readFileSync(ctx.debatesPath, "utf8")) as { entries: Array<Record<string, unknown>> };
    const jhn = data.entries.find((e) => e["book"] === "JHN") as { positions: Array<Record<string, unknown>> };
    Object.assign(jhn.positions[0] as object, { status: "approved", side_suggested: "Lord's Supper" });
    Object.assign(jhn.positions[1] as object, { status: "approved", side_suggested: "believing in him" });
    writeFileSync(ctx.debatesPath, JSON.stringify(data, null, 1));

    const before = passage(ctx, id);
    expect([before.sides, before.shows_in_app, before.positions[0]?.side_suggested]).toEqual([[], false, "Lord's Supper"]);
    // No suggestion to accept on a position without one, and none on a draft.
    expect(refusal(() => decidePosition(ctx, id, "2", "accept-suggestion", { text_sha256: sha(ctx, id, 2) })).httpStatus).toBe(409);
    expect(refusal(() => decidePosition(ctx, id, "0", "accept-suggestion", { text_sha256: sha(ctx, id, 0), side: "x" })).httpStatus).toBe(400);

    decidePosition(ctx, id, "0", "accept-suggestion", { text_sha256: sha(ctx, id, 0) });
    const both = decidePosition(ctx, id, "1", "accept-suggestion", { text_sha256: sha(ctx, id, 1) });
    expect([both.sides, both.shows_in_app, both.needs_side]).toEqual([["Lord's Supper", "believing in him"], true, 0]);
    expect(both.positions[0]).toMatchObject({ side: "Lord's Supper", side_suggested: null });

    const stored = JSON.parse(readFileSync(ctx.debatesPath, "utf8")) as typeof data;
    const after = (stored.entries.find((e) => e["book"] === "JHN") as typeof jhn).positions[0] as Record<string, unknown>;
    expect([after["side"], "side_suggested" in after]).toEqual(["Lord's Supper", false]);
    const lines = logLines(ctx.reviewDir);
    expect(lines.map((l) => [l.decision, l.action, l.side])).toEqual([
      ["side", "accept-suggestion", "Lord's Supper"],
      ["side", "accept-suggestion", "believing in him"],
    ]);

    // Leaving approved drops the side: a draft or rejected position holds none.
    const undone = decidePosition(ctx, id, "0", "undo", { text_sha256: sha(ctx, id, 0) });
    expect([undone.positions[0]?.side, undone.sides, undone.shows_in_app]).toEqual([null, ["believing in him"], false]);
  });

  it("a framing side never makes a passage show, whatever its case or spacing (John, 15 Oct 2026)", () => {
    const { ctx } = setup();
    const id = FIRST_PASSAGE_ID;
    decidePosition(ctx, id, "0", "approve", { text_sha256: sha(ctx, id, 0), side: "Lord's Supper" });
    const framed = decidePosition(ctx, id, "1", "approve", { text_sha256: sha(ctx, id, 1), side: "  Context " });
    expect([framed.sides, framed.shows_in_app, framed.counter]).toEqual([["Lord's Supper", "Context"], false, "1 position · doesn't show"]);
    const lists = decidePosition(ctx, id, "2", "approve", { text_sha256: sha(ctx, id, 2), side: "LISTS the views" });
    expect(lists.shows_in_app).toBe(false);
    const two = decidePosition(ctx, id, "3", "approve", { text_sha256: sha(ctx, id, 3), side: "believing" });
    expect([two.shows_in_app, two.counter]).toEqual([true, "2 positions approved · shows in the app"]);
  });

  it("sides count per axis; an axis is set or accepted in one tap and logged like a side (Hosea 1:2)", () => {
    const { ctx } = setup();
    const id = FIRST_PASSAGE_ID;
    const data = JSON.parse(readFileSync(ctx.debatesPath, "utf8")) as { entries: Array<Record<string, unknown>> };
    const jhn = data.entries.find((e) => e["book"] === "JHN") as { positions: Array<Record<string, unknown>> };
    Object.assign(jhn.positions[0] as object, { status: "approved", side: "allegory", axis_suggested: "real or allegory" });
    Object.assign(jhn.positions[1] as object, { status: "approved", side: "prostitute", axis_suggested: "what Gomer was" });
    writeFileSync(ctx.debatesPath, JSON.stringify(data, null, 1));
    const textBefore = jhn.positions.map((p) => p["text"]);

    // Until John sets axes, every position is on the default axis: today's rule, and it shows.
    const before = passage(ctx, id);
    expect([before.axes, before.shows_in_app, before.positions[0]?.axis, before.positions[0]?.axis_suggested]).toEqual([
      [],
      true,
      null,
      "real or allegory",
    ]);
    // No axis on a draft, nothing extra in the body, and no suggestion to accept where there is none.
    expect(refusal(() => decidePosition(ctx, id, "2", "axis", { text_sha256: sha(ctx, id, 2), axis: "x" })).httpStatus).toBe(409);
    expect(refusal(() => decidePosition(ctx, id, "0", "accept-axis", { text_sha256: sha(ctx, id, 0), axis: "x" })).httpStatus).toBe(400);
    expect(refusal(() => decidePosition(ctx, id, "0", "axis", { text_sha256: sha(ctx, id, 0), axis: "x".repeat(41) })).httpStatus).toBe(400);

    const one = decidePosition(ctx, id, "0", "accept-axis", { text_sha256: sha(ctx, id, 0) });
    expect([one.axes, one.shows_in_app, one.positions[0]?.axis, one.positions[0]?.axis_suggested]).toEqual([["real or allegory"], false, "real or allegory", null]);
    expect(refusal(() => decidePosition(ctx, id, "0", "accept-axis", { text_sha256: sha(ctx, id, 0) })).httpStatus).toBe(409);
    // One side on each of two questions is not two positions.
    const split = decidePosition(ctx, id, "1", "axis", { text_sha256: sha(ctx, id, 1), axis: "  what  Gomer was " });
    expect([split.axes, split.shows_in_app, split.counter]).toEqual([["real or allegory", "what Gomer was"], false, "1 position · doesn't show"]);
    // Two sides on one question show; axes match whatever their case.
    decidePosition(ctx, id, "2", "approve", { text_sha256: sha(ctx, id, 2), side: "real marriage" });
    const shows = decidePosition(ctx, id, "2", "axis", { text_sha256: sha(ctx, id, 2), axis: "Real or Allegory" });
    expect([shows.shows_in_app, shows.counter]).toEqual([true, "2 positions approved · shows in the app"]);
    // An empty axis returns a position to the default axis.
    const cleared = decidePosition(ctx, id, "1", "axis", { text_sha256: sha(ctx, id, 1), axis: " " });
    expect(cleared.positions[1]?.axis).toBe(null);

    const stored = JSON.parse(readFileSync(ctx.debatesPath, "utf8")) as typeof data;
    const after = stored.entries.find((e) => e["book"] === "JHN") as typeof jhn;
    expect(after.positions.map((p) => p["text"])).toEqual(textBefore);
    expect([after.positions[0]?.["axis"], "axis_suggested" in (after.positions[0] ?? {}), "axis" in (after.positions[1] ?? {})]).toEqual([
      "real or allegory",
      false,
      false,
    ]);
    const lines = logLines(ctx.reviewDir).filter((l) => l.decision === "axis");
    expect(lines.map((l) => [l.action, l.position, l.axis, l.previous_axis, l.side])).toEqual([
      ["accept-axis", 0, "real or allegory", null, "allegory"],
      ["axis", 1, "what Gomer was", null, "prostitute"],
      ["axis", 2, "Real or Allegory", null, "real marriage"],
      ["axis", 1, null, "what Gomer was", "prostitute"],
    ]);
    expect(lines[0]).toMatchObject({ kind: "debate_position", status: "approved", previous_status: "approved" });

    // Leaving approved drops the axis with the side.
    const undone = decidePosition(ctx, id, "0", "undo", { text_sha256: sha(ctx, id, 0) });
    expect([undone.positions[0]?.side, undone.positions[0]?.axis]).toEqual([null, null]);
  });

  it("reject sets rejected in the file, keeps its formatting, and logs one line", () => {
    const { ctx } = setup();
    const before = readFileSync(ctx.debatesPath, "utf8");
    const id = FIRST_PASSAGE_ID;
    decidePosition(ctx, id, "3", "reject", { text_sha256: sha(ctx, id, 3) });

    expect(storedStatus(ctx.debatesPath, id, 3)).toBe("rejected");
    const after = readFileSync(ctx.debatesPath, "utf8");
    // Only the one status changed: same bytes once it is put back.
    const restored = JSON.stringify(
      (() => {
        const data = JSON.parse(after) as { entries: Array<Record<string, unknown>> };
        const entry = data.entries.find((e) => e["book"] === "JHN") as { positions: Array<{ status: string }> };
        (entry.positions[3] as { status: string }).status = "draft";
        return data;
      })(),
      null,
      1,
    );
    expect(restored).toBe(before);
    expect(after).toContain("“"); // UTF-8 kept, not \u escapes
    expect(leftoverTemps(ctx.debatesPath)).toEqual([]);

    const lines = logLines(ctx.reviewDir);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      at: "2026-10-12T10:00:00.000Z",
      kind: "debate_position",
      reviewer: "tester",
      passage: { book: "JHN", from: [6, 53], to: [6, 58] },
      position: 3,
      decision: "rejected",
      action: "reject",
      previous_status: "draft",
      side: null,
      previous_side: null,
    });
    expect(lines[0]?.source).toBe(passage(ctx, id).positions[3]?.source);
  });

  it("undo returns the position to draft and logs undo", () => {
    const { ctx } = setup();
    const id = FIRST_PASSAGE_ID;
    decidePosition(ctx, id, "0", "approve", { text_sha256: sha(ctx, id, 0), side: "Lord's Supper" });
    const undone = decidePosition(ctx, id, "0", "undo", { text_sha256: sha(ctx, id, 0) });
    expect(undone.positions[0]?.status).toBe("draft");
    expect(storedStatus(ctx.debatesPath, id, 0)).toBe("draft");
    expect(readFileSync(ctx.debatesPath, "utf8")).toBe(readFileSync(REAL_DEBATES, "utf8"));

    const lines = logLines(ctx.reviewDir);
    expect(lines.map((l) => l.decision)).toEqual(["approved", "undo"]);
    expect(lines[0]).toMatchObject({ action: "approve", side: "Lord's Supper", previous_side: null });
    expect(lines[1]).toMatchObject({ status: "draft", previous_status: "approved", position: 0, side: null, previous_side: "Lord's Supper" });

    // Undo on a draft is a no-op, so it is refused rather than logged.
    expect(refusal(() => decidePosition(ctx, id, "0", "undo", { text_sha256: sha(ctx, id, 0) })).httpStatus).toBe(409);
    expect(logLines(ctx.reviewDir)).toHaveLength(2);
  });

  it("refuses a decision on a sentence that changed after it was read", () => {
    const { ctx } = setup();
    const error = refusal(() => decidePosition(ctx, FIRST_PASSAGE_ID, "0", "approve", { text_sha256: "0".repeat(64) }));
    expect(error.httpStatus).toBe(409);
    expect(refusal(() => decidePosition(ctx, FIRST_PASSAGE_ID, "0", "approve", {})).httpStatus).toBe(400);
    expect(storedStatus(ctx.debatesPath, FIRST_PASSAGE_ID, 0)).toBe("draft");
    expect(logLines(ctx.reviewDir)).toEqual([]);
  });
});

describe("debate positions over HTTP", () => {
  async function serve(): Promise<{ t: TempDebates; url: string }> {
    const t = setup();
    const staging = createTempStaging();
    cleanups.push(() => staging.cleanup());
    const running = await startReviewServer({
      port: 0,
      staticDir: null,
      env: {
        YADA_STAGING_DB: staging.dbPath,
        YADA_REVIEW_DIR: t.ctx.reviewDir,
        YADA_DEBATES: t.debatesPath,
        YADA_CORE_DB: t.ctx.coreDbPath,
        YADA_REVIEWER: "tester",
      },
    });
    cleanups.push(() => new Promise<void>((resolve) => running.server.close(() => resolve())));
    return { t, url: running.url };
  }

  function post(url: string, body: unknown): Promise<Response> {
    return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  it("loading writes nothing", async () => {
    const { t, url } = await serve();
    const bytes = readFileSync(t.debatesPath);
    const mtime = statSync(t.debatesPath).mtimeMs;

    for (let i = 0; i < 3; i += 1) {
      const res = await fetch(`${url}/api/debates`);
      expect(res.status).toBe(200);
      await res.json();
    }
    await fetch(`${url}/api/meta`);

    expect(statSync(t.debatesPath).mtimeMs).toBe(mtime);
    expect(readFileSync(t.debatesPath).equals(bytes)).toBe(true);
    expect(existsSync(decisionsPath(t.ctx.reviewDir))).toBe(false);
  });

  it("the payload never contains question or kind", async () => {
    const { url } = await serve();
    const text = await (await fetch(`${url}/api/debates`)).text();
    expect(text).not.toMatch(/"question"|"kind"/);
    const body = JSON.parse(text) as DebatesResponse;
    expect(body.passages).toHaveLength(19);
    for (const p of body.passages) {
      expect(Object.keys(p).sort()).toEqual(
        ["approved", "axes", "counter", "display_ref", "id", "needs_side", "positions", "shows_in_app", "sides", "verses"].sort(),
      );
      for (const pos of p.positions) {
        expect(Object.keys(pos).sort()).toEqual(
          ["axis", "axis_suggested", "check", "held_by", "index", "side", "side_suggested", "source", "status", "text", "text_sha256"].sort(),
        );
      }
    }
  });

  it("records one position per request and refuses a request naming two", async () => {
    const { t, url } = await serve();
    const base = `${url}/api/debates/${encodeURIComponent(FIRST_PASSAGE_ID)}/positions`;
    const body = (await (await fetch(`${url}/api/debates`)).json()) as DebatesResponse;
    const jhn = body.passages[0] as DebatePassage;
    const [first, second] = jhn.positions;
    if (first === undefined || second === undefined) throw new Error("JHN has fewer than two positions");
    const before = readFileSync(t.debatesPath);

    const inBody = await post(`${base}/0/approve`, { text_sha256: first.text_sha256, positions: [0, 1] });
    expect(inBody.status).toBe(400);
    const inPath = await post(`${base}/0,1/approve`, { text_sha256: first.text_sha256 });
    expect(inPath.status).toBe(400);
    const listed = await post(`${url}/api/debates/${encodeURIComponent(FIRST_PASSAGE_ID)}/approve`, {
      positions: [
        { index: 0, text_sha256: first.text_sha256 },
        { index: 1, text_sha256: second.text_sha256 },
      ],
    });
    expect(listed.status).toBe(404);
    const form = await fetch(`${base}/0/approve`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `text_sha256=${first.text_sha256}`,
    });
    expect(form.status).toBe(415);
    expect(readFileSync(t.debatesPath).equals(before)).toBe(true);
    expect(existsSync(decisionsPath(t.ctx.reviewDir))).toBe(false);

    const noSide = await post(`${base}/0/approve`, { text_sha256: first.text_sha256 });
    expect(noSide.status).toBe(400);
    expect(readFileSync(t.debatesPath).equals(before)).toBe(true);

    const ok = await post(`${base}/1/reject`, { text_sha256: second.text_sha256 });
    expect(ok.status).toBe(200);
    const result = (await ok.json()) as PositionDecisionResponse;
    expect(result.passage.positions[1]?.status).toBe("rejected");
    expect(result.logged_to).toBe(decisionsPath(t.ctx.reviewDir));
    expect(storedStatus(t.debatesPath, FIRST_PASSAGE_ID, 1)).toBe("rejected");
    expect(storedStatus(t.debatesPath, FIRST_PASSAGE_ID, 0)).toBe("draft");
  });
});
