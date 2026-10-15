import { describe, expect, it } from "vitest";

import { parseBookIntro } from "./bookIntro";

const meta = (status: string, text = "Paul wrote this letter to the Christians in Rome.") =>
  JSON.stringify({ text, source: "tn", credit: "Translation Notes, adapted from unfoldingWord (book introduction, first paragraph shortened) · CC BY-SA 4.0", status });

describe("book introduction (build 6, item G)", () => {
  it("shows an approved paragraph with its credit", () => {
    expect(parseBookIntro(meta("approved"))).toEqual({
      text: "Paul wrote this letter to the Christians in Rome.",
      credit: "Translation Notes, adapted from unfoldingWord (book introduction, first paragraph shortened) · CC BY-SA 4.0",
    });
  });

  it("holds back a flagged paragraph (rule 2)", () => {
    expect(parseBookIntro(meta("flagged"))).toBeNull();
  });

  it("shows nothing for a book with none (Genesis), an old file, or a broken value", () => {
    expect(parseBookIntro(null)).toBeNull();
    expect(parseBookIntro(undefined)).toBeNull();
    expect(parseBookIntro("{not json")).toBeNull();
    expect(parseBookIntro(meta("approved", " "))).toBeNull();
    expect(parseBookIntro(JSON.stringify({ text: "x", status: "approved" }))).toBeNull();
  });
});
