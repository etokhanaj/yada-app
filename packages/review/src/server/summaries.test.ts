import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FIX_NOTE_MAX, FIX_REASON, REJECTED_REASON, type SummariesResponse, type SummaryDecisionResponse, type SummaryItem } from "../shared/api.js";
import { decisionsPath, RefusedError } from "./actions.js";
import { passageReviewsPath } from "./config.js";
import { startReviewServer } from "./main.js";
import {
  buildSummaries,
  decideSummary,
  serializeReviews,
  sha256,
  SummarySource,
  type RawSummary,
  type SummariesContext,
  type SummaryDecisionRecord,
} from "./summaries.js";
import { createTempStaging } from "./test-staging.js";

const PENDING = "JHN.1.1-1.5";
const HELD = "DEU.1.1-1.8";
const APPROVED = "MRK.1.1-1.8";
const CHANGED = "GEN.1.1-1.5";
const PSALM = "PSA.1.1-1.6";

const raw = (id: string, text: string, flags: string[], reviewable = true): RawSummary => ({
  id,
  book: id.split(".")[0] ?? "",
  label: `Label of ${id}`,
  range: id,
  text,
  flags,
  reviewable,
  verses: [{ chapter: 1, verse: 1, text: `BSB of ${id}` }],
});

const LIST: RawSummary[] = [
  raw(HELD, "Moses says: “I, Yahweh, promised…”", []),
  raw(APPROVED, "John baptizes in the wilderness.", ["b: over budget"]),
  raw(CHANGED, "God creates the heavens and the earth.", ["f: no person"]),
  raw(PENDING, "The Word was with God.", ["a: no headline", "g: text hygiene"]),
  raw(PSALM, "", ["a: no lead"], false),
];

/** The live file's layout: one entry per line, curly quotes kept as they are. */
const REVIEWS = `{
  "_why": "Passage summaries decided by hand.",
  "status": "approved",
  "entries": {
    "${HELD}": { "status": "held", "reason": "Yahweh's words framed as Moses' (\\"Moses says: “I, Yahweh…”\\")" },
    "${APPROVED}": { "status": "approved", "sha256": "${sha256("John baptizes in the wilderness.")}" },
    "${CHANGED}": { "status": "approved", "sha256": "${sha256("an older text")}" }
  }
}
`;

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
});

async function setup(list: RawSummary[] = LIST): Promise<{ ctx: SummariesContext; file: string; dir: string }> {
  const dir = mkdtempSync(path.join(tmpdir(), "yada-summaries-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "passage_reviews.json");
  writeFileSync(file, REVIEWS, "utf8");
  const summaries = new SummarySource(() => Promise.resolve(list));
  await summaries.settled();
  return {
    dir,
    file,
    ctx: {
      passageReviewsPath: file,
      reviewDir: path.join(dir, "review"),
      reviewer: "tester",
      summaries,
      now: () => new Date("2026-10-15T10:00:00.000Z"),
    },
  };
}

function items(ctx: SummariesContext): SummaryItem[] {
  const res = buildSummaries(ctx);
  if (res.state !== "ready") throw new Error(`not ready: ${res.state}`);
  return res.items;
}

function logLines(ctx: SummariesContext): SummaryDecisionRecord[] {
  return readFileSync(decisionsPath(ctx.reviewDir), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as SummaryDecisionRecord);
}

function refusal(fn: () => unknown): RefusedError {
  try {
    fn();
  } catch (error) {
    if (error instanceof RefusedError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("passage summaries queue: listing", () => {
  it("lists every summary with its standing in passage_reviews.json", async () => {
    const { ctx } = await setup();
    const byId = new Map(items(ctx).map((i) => [i.id, i]));
    expect([...byId.keys()]).toEqual([HELD, APPROVED, CHANGED, PENDING, PSALM]);
    expect(byId.get(PENDING)).toMatchObject({
      status: "pending",
      reason: null,
      reviewable: true,
      flags: ["a: no headline", "g: text hygiene"],
      text: "The Word was with God.",
      text_sha256: sha256("The Word was with God."),
      label: `Label of ${PENDING}`,
      verses: [{ chapter: 1, verse: 1, text: `BSB of ${PENDING}` }],
    });
    expect(byId.get(HELD)).toMatchObject({ status: "held", flags: [] });
    expect(byId.get(HELD)?.reason).toContain("framed as Moses'");
    expect(byId.get(APPROVED)?.status).toBe("approved");
    // An approval of another text does not show this one, as summaries.ts reads it.
    expect(byId.get(CHANGED)?.status).toBe("changed");
    expect(byId.get(PSALM)?.reviewable).toBe(false);
  });

  it("reads as loading until the pipeline answers, and passes on its error", async () => {
    let finish: (list: RawSummary[]) => void = () => {};
    const source = new SummarySource(() => new Promise((resolve) => (finish = resolve)));
    const ctx: SummariesContext = { passageReviewsPath: "/nonexistent", reviewDir: "/nonexistent", reviewer: "t", summaries: source };
    expect(buildSummaries(ctx)).toEqual({ state: "loading" });
    expect(refusal(() => decideSummary(ctx, PENDING, "approve", { text_sha256: "x" })).httpStatus).toBe(503);
    finish([]);
    await source.settled();

    const failing = new SummarySource(() => Promise.reject(new Error("flagged.ts exited 1")));
    await failing.settled();
    expect(buildSummaries({ ...ctx, summaries: failing })).toEqual({ state: "error", error: "flagged.ts exited 1" });
  });

  it("reads the live passage_reviews.json, which round-trips through the writer", () => {
    const live = readFileSync(passageReviewsPath({}), "utf8");
    expect(serializeReviews(JSON.parse(live) as Record<string, unknown>, live.endsWith("\n"))).toBe(live);
  });
});

describe("passage summaries queue: decisions", () => {
  it("approve writes the sha256 of the text shown and touches no other entry", async () => {
    const { ctx, file } = await setup();
    const before = readFileSync(file, "utf8").split("\n");
    const item = decideSummary(ctx, PENDING, "approve", { text_sha256: sha256("The Word was with God.") });
    expect(item.status).toBe("approved");

    const after = readFileSync(file, "utf8");
    const parsed = JSON.parse(after) as { entries: Record<string, unknown> };
    expect(parsed.entries[PENDING]).toEqual({ status: "approved", sha256: sha256("The Word was with God.") });
    // Every earlier line is unchanged; the new entry is one more line.
    const lines = after.split("\n");
    expect(lines.length).toBe(before.length + 1);
    for (const line of before.filter((l) => l.includes('"status": "held"') || l.includes(APPROVED) || l.includes(CHANGED))) {
      expect(lines).toContain(line.endsWith(",") ? line : `${line},`);
    }
    expect(after.endsWith("\n")).toBe(true);
    expect(serializeReviews(JSON.parse(after) as Record<string, unknown>)).toBe(after);

    expect(logLines(ctx)).toEqual([
      {
        at: "2026-10-15T10:00:00.000Z",
        kind: "passage_summary",
        passage: PENDING,
        action: "approve",
        decision: "approved",
        status: "approved",
        previous_status: null,
        previous: null,
        text_sha256: sha256("The Word was with God."),
        flags: ["a: no headline", "g: text hygiene"],
        reviewer: "tester",
      },
    ]);
  });

  it("reject holds it with John's reason; approving a hold makes it approved with the sha256", async () => {
    const { ctx, file } = await setup();
    decideSummary(ctx, PENDING, "reject", { text_sha256: sha256("The Word was with God.") });
    let entries = (JSON.parse(readFileSync(file, "utf8")) as { entries: Record<string, unknown> }).entries;
    expect(entries[PENDING]).toEqual({ status: "held", reason: REJECTED_REASON });
    expect(items(ctx).find((i) => i.id === PENDING)?.status).toBe("held");

    const text = "Moses says: “I, Yahweh, promised…”";
    decideSummary(ctx, HELD, "approve", { text_sha256: sha256(text) });
    entries = (JSON.parse(readFileSync(file, "utf8")) as { entries: Record<string, unknown> }).entries;
    expect(entries[HELD]).toEqual({ status: "approved", sha256: sha256(text) });
    expect(Object.keys(entries)).toEqual([HELD, APPROVED, CHANGED, PENDING]);
    // The hold's own reason is kept in the log.
    const last = logLines(ctx).at(-1);
    expect(last?.previous_status).toBe("held");
    expect(last?.previous?.reason).toContain("framed as Moses'");
  });

  it("refuses what is not one decision on the text on screen", async () => {
    const { ctx, file } = await setup();
    const original = readFileSync(file, "utf8");
    const good = { text_sha256: sha256("The Word was with God.") };

    expect(refusal(() => decideSummary(ctx, PENDING, "approve", {})).httpStatus).toBe(400);
    expect(refusal(() => decideSummary(ctx, PENDING, "approve", { ...good, text: "edited" })).httpStatus).toBe(400);
    expect(refusal(() => decideSummary(ctx, PENDING, "approve", { text_sha256: sha256("other") })).httpStatus).toBe(409);
    expect(refusal(() => decideSummary(ctx, "JHN.9.9-9.9", "approve", good)).httpStatus).toBe(404);
    expect(refusal(() => decideSummary(ctx, PSALM, "approve", { text_sha256: sha256("") })).httpStatus).toBe(422);
    expect(refusal(() => decideSummary(ctx, APPROVED, "approve", { text_sha256: sha256("John baptizes in the wilderness.") })).httpStatus).toBe(409);
    expect(readFileSync(file, "utf8")).toBe(original);

    writeFileSync(file, JSON.stringify(JSON.parse(original), null, 2), "utf8");
    expect(refusal(() => decideSummary(ctx, PENDING, "approve", good)).httpStatus).toBe(500);
  });
});

describe("passage summaries queue: needs a fix", () => {
  const text = "The Word was with God.";
  const entriesOf = (file: string): Record<string, unknown> =>
    (JSON.parse(readFileSync(file, "utf8")) as { entries: Record<string, unknown> }).entries;

  it("fix holds it with the note and the sha256 read, logs it, and touches no other entry", async () => {
    const { ctx, file } = await setup();
    const before = entriesOf(file);
    const item = decideSummary(ctx, PENDING, "fix", { text_sha256: sha256(text), note: "  Needs verse 3 for context.  " });
    expect(item).toMatchObject({ status: "fix", reason: FIX_REASON, fix: "Needs verse 3 for context." });

    const after = readFileSync(file, "utf8");
    const entries = entriesOf(file);
    expect(entries[PENDING]).toEqual({ status: "held", reason: FIX_REASON, fix: "Needs verse 3 for context.", sha256: sha256(text) });
    for (const id of [HELD, APPROVED, CHANGED]) expect(entries[id]).toEqual(before[id]);
    expect(serializeReviews(JSON.parse(after) as Record<string, unknown>)).toBe(after);

    expect(logLines(ctx)).toEqual([
      {
        at: "2026-10-15T10:00:00.000Z",
        kind: "passage_summary",
        passage: PENDING,
        action: "fix",
        decision: "needs a fix",
        status: "held",
        previous_status: null,
        previous: null,
        text_sha256: sha256(text),
        note: "Needs verse 3 for context.",
        flags: ["a: no headline", "g: text hygiene"],
        reviewer: "tester",
      },
    ]);
    // The same note on the same text is no new decision.
    expect(refusal(() => decideSummary(ctx, PENDING, "fix", { text_sha256: sha256(text), note: "Needs verse 3 for context." })).httpStatus).toBe(409);
  });

  it("refuses an empty or overlong note, a stale text, and a note on another action", async () => {
    const { ctx, file } = await setup();
    const original = readFileSync(file, "utf8");
    const good = { text_sha256: sha256(text) };
    for (const note of [undefined, "", "   ", 7, "x".repeat(FIX_NOTE_MAX + 1)]) {
      const body = note === undefined ? good : { ...good, note };
      expect(refusal(() => decideSummary(ctx, PENDING, "fix", body)).httpStatus).toBe(400);
    }
    expect(refusal(() => decideSummary(ctx, PENDING, "fix", { text_sha256: sha256("other"), note: "fix" })).httpStatus).toBe(409);
    expect(refusal(() => decideSummary(ctx, PENDING, "fix", { ...good, note: "fix", text: "edited" })).httpStatus).toBe(400);
    expect(refusal(() => decideSummary(ctx, PENDING, "reject", { ...good, note: "fix" })).httpStatus).toBe(400);
    expect(readFileSync(file, "utf8")).toBe(original);

    decideSummary(ctx, PENDING, "fix", { ...good, note: "x".repeat(FIX_NOTE_MAX) });
    expect(items(ctx).find((i) => i.id === PENDING)?.fix).toHaveLength(FIX_NOTE_MAX);
  });

  it("shows a fix as undecided, changed since the note, once its text changes; approve then works", async () => {
    const { ctx, file } = await setup();
    decideSummary(ctx, PENDING, "fix", { text_sha256: sha256(text), note: "Use verse 2." });

    const fixed = "The Word was with God, and the Word was God.";
    const later = new SummarySource(() => Promise.resolve(LIST.map((r) => (r.id === PENDING ? { ...r, text: fixed } : r))));
    await later.settled();
    const ctx2 = { ...ctx, summaries: later };
    expect(items(ctx2).find((i) => i.id === PENDING)).toMatchObject({ status: "fix_changed", fix: "Use verse 2." });
    // A decision names the new text; the old one is stale.
    expect(refusal(() => decideSummary(ctx2, PENDING, "approve", { text_sha256: sha256(text) })).httpStatus).toBe(409);

    expect(decideSummary(ctx2, PENDING, "approve", { text_sha256: sha256(fixed) })).toMatchObject({ status: "approved", fix: null });
    expect(entriesOf(file)[PENDING]).toEqual({ status: "approved", sha256: sha256(fixed) });
    expect(logLines(ctx2).at(-1)?.previous).toEqual({ status: "held", reason: FIX_REASON, fix: "Use verse 2.", sha256: sha256(text) });
  });
});

describe("passage summaries over HTTP", () => {
  it("serves the queue and records a decision", async () => {
    const t = createTempStaging();
    cleanups.push(() => t.cleanup());
    const { file } = await setup();
    const running = await startReviewServer({
      port: 0,
      staticDir: null,
      env: { YADA_STAGING_DB: t.dbPath, YADA_REVIEW_DIR: t.reviewDir, YADA_REVIEWER: "tester", YADA_PASSAGE_REVIEWS: file },
      summaryLoader: () => Promise.resolve(LIST),
    });
    cleanups.push(() => new Promise<void>((resolve) => running.server.close(() => resolve())));
    await running.ctx.summaries.settled();

    const list = (await (await fetch(`${running.url}/api/summaries`)).json()) as SummariesResponse;
    expect(list.state === "ready" ? list.items.length : 0).toBe(LIST.length);

    const url = `${running.url}/api/summaries/${encodeURIComponent(PENDING)}/reject`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text_sha256: sha256("The Word was with God.") }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SummaryDecisionResponse;
    expect(body.item.status).toBe("held");
    expect(body.logged_to).toBe(decisionsPath(t.reviewDir));

    const fix = await fetch(`${running.url}/api/summaries/${encodeURIComponent(PENDING)}/fix`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text_sha256: sha256("The Word was with God."), note: "More context." }),
    });
    expect(fix.status).toBe(200);
    expect(((await fix.json()) as SummaryDecisionResponse).item).toMatchObject({ status: "fix", fix: "More context." });

    expect((await fetch(url, { method: "POST", body: "{}" })).status).toBe(415);
    expect((await fetch(`${running.url}/api/summaries/${PENDING}/skip`, { method: "POST" })).status).toBe(404);
  });
});
