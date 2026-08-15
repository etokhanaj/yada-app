import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  BookEntrySchema,
  PericopeEntrySchema,
  SCHEMA_VERSION,
  VerseEntrySchema,
} from "./entries.js";

const goldenUrl = new URL("../../../golden/1co.14.34.json", import.meta.url);
const golden: unknown = JSON.parse(readFileSync(goldenUrl, "utf8"));

describe("golden/1co.14.34.json", () => {
  it("parses as a VerseEntry", () => {
    const result = VerseEntrySchema.safeParse(golden);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("carries the current schema version", () => {
    const entry = VerseEntrySchema.parse(golden);
    expect(entry.schema_version).toBe(SCHEMA_VERSION);
  });

  it("demonstrates the claim shapes the regression suite depends on", () => {
    const entry = VerseEntrySchema.parse(golden);
    const text = entry.claims.filter((c) => c.category === "text");
    const context = entry.claims.filter((c) => c.category === "context");
    const debated = entry.claims.filter((c) => c.category === "debated");

    expect(text.length).toBeGreaterThanOrEqual(3);
    expect(text.every((c) => c.evidence_strength === "strong" && c.grounding === "source_data")).toBe(
      true,
    );

    expect(context.length).toBeGreaterThanOrEqual(3);
    expect(context.filter((c) => c.grounding === "source_data").length).toBeGreaterThanOrEqual(2);

    const modelKnowledge = context.filter((c) => c.grounding === "model_knowledge");
    expect(modelKnowledge).toHaveLength(1);
    expect(modelKnowledge[0]?.evidence_strength).toBe("supported");

    expect(debated).toHaveLength(1);
    expect(debated[0]?.positions).toHaveLength(2);
  });

  it("keeps the derived gloss separate from the composed close rendering", () => {
    const entry = VerseEntrySchema.parse(golden);
    expect(entry.gloss.length).toBeGreaterThan(0);
    expect(entry.close_rendering.length).toBeGreaterThan(0);
    expect(entry.key_words.length).toBeGreaterThan(0);
  });

  it("rejects an entry missing schema_version", () => {
    const withoutVersion: Record<string, unknown> = { ...(golden as Record<string, unknown>) };
    delete withoutVersion["schema_version"];
    expect(VerseEntrySchema.safeParse(withoutVersion).success).toBe(false);
  });
});

describe("PericopeEntrySchema", () => {
  const pericope = {
    pericope_id: "1CO.14.26-14.40",
    book: "1CO",
    schema_version: SCHEMA_VERSION,
    prompt_version: "pericope@0.1.0-seed",
    span: { start: "1CO.14.26", end: "1CO.14.40" },
    summary_one_sentence: "Paul closes his instructions on gathered worship by ordering its speech.",
    key_ideas: ["Everything is for building up", "Order serves participation"],
    discussion_questions: ["What does orderly worship protect?"],
    claims: [],
    movement: [
      { range: "1CO.14.26-33", label: "Order in worship" },
      { range: "1CO.14.34-36", label: "The disputed instruction" },
      { range: "1CO.14.37-40", label: "Closing appeal" },
    ],
    review: { status: "auto_passed", flags: [] },
  };

  it("accepts a pericope entry with movement steps", () => {
    const result = PericopeEntrySchema.safeParse(pericope);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("rejects a malformed pericope id", () => {
    expect(PericopeEntrySchema.safeParse({ ...pericope, pericope_id: "1CO.14" }).success).toBe(false);
  });
});

describe("BookEntrySchema", () => {
  it("accepts a book entry whose sections are claims", () => {
    const result = BookEntrySchema.safeParse({
      book: "JHN",
      schema_version: SCHEMA_VERSION,
      prompt_version: "book@0.1.0-seed",
      author: [],
      setting: [],
      audience: [],
      structure: [],
      themes: [],
      review: { status: "flagged", flags: ["authorship needs expert review"] },
    });
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown book code", () => {
    expect(
      BookEntrySchema.safeParse({
        book: "XYZ",
        schema_version: SCHEMA_VERSION,
        prompt_version: "book@0.1.0-seed",
        author: [],
        setting: [],
        audience: [],
        structure: [],
        themes: [],
        review: { status: "auto_passed", flags: [] },
      }).success,
    ).toBe(false);
  });
});
