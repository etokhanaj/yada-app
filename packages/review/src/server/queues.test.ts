import { afterEach, describe, expect, it } from "vitest";

import type { QueueResponse, TargetReason } from "../shared/api.js";
import { openReviewDb } from "./db.js";
import { buildEntry, buildQueue, type QueueOptions } from "./queues.js";
import { asVerse, createTempStaging, golden, goldenPayloads, type Payload, type TempStaging } from "./test-staging.js";

const OPTIONS: QueueOptions = { sampleSeed: "test-seed", sampleRate: 0.07 };

const open: TempStaging[] = [];
function staging(payloads?: Payload[]): TempStaging {
  const t = createTempStaging(payloads);
  open.push(t);
  return t;
}
afterEach(() => {
  for (const t of open.splice(0)) t.cleanup();
});

const ids = (q: QueueResponse): string[] => q.items.map((item) => item.verse_id);

/** 40 John entries and 25 Genesis entries, plus the other golden fixtures. */
function corpus(): Payload[] {
  const john = Array.from({ length: 40 }, (_, i) => asVerse(golden("JHN.1.1"), `JHN.1.${i + 1}`));
  const genesis = Array.from({ length: 25 }, (_, i) => asVerse(golden("GEN.1.1"), `GEN.1.${i + 1}`));
  const others = goldenPayloads().filter((p) => !["JHN.1.1", "GEN.1.1"].includes(String(p["verse_id"])));
  return [...john, ...genesis, ...others];
}

describe("flagged queue", () => {
  it("holds every flagged entry, in canonical verse order", () => {
    const t = staging();
    expect(ids(buildQueue(t.db, "flagged", OPTIONS))).toEqual([
      "GEN.1.1",
      "LEV.19.18",
      "PSA.23.1",
      "ISA.53.5",
      "JHN.1.1",
      "1CO.14.34",
      "REV.13.18",
    ]);
  });
});

describe("random sample per book", () => {
  it("is the same on every call, on a fresh connection, and whatever the insertion order", () => {
    const entries = corpus();
    const a = staging(entries);
    const b = staging([...entries].reverse());

    const first = buildQueue(a.db, "random_sample", OPTIONS);
    const second = buildQueue(a.db, "random_sample", OPTIONS);
    const reopened = openReviewDb(a.dbPath);
    const third = buildQueue(reopened, "random_sample", OPTIONS);
    reopened.close();
    const shuffled = buildQueue(b.db, "random_sample", OPTIONS);

    expect(ids(second)).toEqual(ids(first));
    expect(ids(third)).toEqual(ids(first));
    expect(ids(shuffled)).toEqual(ids(first));
  });

  it("records the seed and samples 5-10% of each sizeable book, at least one of every book", () => {
    const t = staging(corpus());
    const queue = buildQueue(t.db, "random_sample", OPTIONS);

    expect(queue.sample?.seed).toBe("test-seed");
    expect(queue.sample?.rate).toBe(0.07);
    const books = Object.fromEntries((queue.sample?.books ?? []).map((b) => [b.book, b]));
    expect(books["JHN"]).toEqual({ book: "JHN", total: 40, sampled: 3 });
    expect(books["GEN"]).toEqual({ book: "GEN", total: 25, sampled: 2 });
    expect(books["1CO"]).toEqual({ book: "1CO", total: 1, sampled: 1 });

    for (const book of ["JHN", "GEN"]) {
      const share = ids(queue).filter((id) => id.startsWith(`${book}.`)).length / (books[book]?.total ?? 1);
      expect(share).toBeGreaterThanOrEqual(0.05);
      expect(share).toBeLessThanOrEqual(0.1);
    }
    expect(ids(queue)).toHaveLength(3 + 2 + 5);
  });

  it("does not move one book's sample when another book grows", () => {
    const t = staging(corpus());
    const johnBefore = ids(buildQueue(t.db, "random_sample", OPTIONS)).filter((id) => id.startsWith("JHN."));
    for (let verse = 26; verse <= 31; verse += 1) t.insert(asVerse(golden("GEN.1.1"), `GEN.1.${verse}`));
    const johnAfter = ids(buildQueue(t.db, "random_sample", OPTIONS)).filter((id) => id.startsWith("JHN."));
    expect(johnAfter).toEqual(johnBefore);
  });

  it("draws a different sample under a different seed", () => {
    const t = staging(corpus());
    const one = ids(buildQueue(t.db, "random_sample", OPTIONS));
    const other = ids(buildQueue(t.db, "random_sample", { ...OPTIONS, sampleSeed: "another-seed" }));
    expect(other).toHaveLength(one.length);
    expect(other).not.toEqual(one);
  });
});

const describeReasons = (reasons: readonly TargetReason[]): string[] =>
  reasons.map((r) => [r.kind, r.claim_id ?? r.ref].filter((part) => part !== null).join(" "));

/** A copy of JHN.1.1 with every targeted-expert trigger removed. */
function untriggered(verseId: string): Payload {
  const payload = asVerse(golden("JHN.1.1"), verseId);
  const claims = payload["claims"] as Array<Record<string, unknown>>;
  payload["claims"] = claims.filter((c) => c["category"] !== "debated" && c["grounding"] !== "model_knowledge");
  delete payload["translation_note"];
  payload["related_passages"] = (payload["related_passages"] as Array<Record<string, unknown>>).filter(
    (r) => !["quotation", "allusion", "fulfillment"].includes(String(r["relationship"])),
  );
  return payload;
}

describe("targeted expert queue", () => {
  it("selects every golden fixture, each for the right reasons", () => {
    const t = staging();
    const queue = buildQueue(t.db, "targeted_expert", OPTIONS);
    expect(ids(queue)).toEqual(["GEN.1.1", "LEV.19.18", "PSA.23.1", "ISA.53.5", "JHN.1.1", "1CO.14.34", "REV.13.18"]);

    const reasonsFor = (id: string): string[] =>
      describeReasons(queue.items.find((item) => item.verse_id === id)?.reasons ?? []);

    // 1 Cor 14:34: c6 is model knowledge; c7 is debated; c9 is both. Its
    // related passages are contrast, development and thematic, none of which trigger.
    expect(reasonsFor("1CO.14.34")).toEqual([
      "model_knowledge_claim 1CO.14.34.c6",
      "debated_claim 1CO.14.34.c7",
      "debated_claim 1CO.14.34.c9",
      "model_knowledge_claim 1CO.14.34.c9",
      "translation_note",
    ]);
    // Lev 19:18 is quoted twice in the NT; LEV.19.34 (development) does not trigger.
    expect(reasonsFor("LEV.19.18")).toEqual([
      "model_knowledge_claim LEV.19.18.c8",
      "debated_claim LEV.19.18.c9",
      "translation_note",
      "related_passage MAT.22.39",
      "related_passage ROM.13.9",
    ]);
    expect(reasonsFor("PSA.23.1")).toContain("related_passage JHN.10.11");
    expect(reasonsFor("PSA.23.1")).not.toContain("related_passage EZK.34.11-34.16");

    const lev = queue.items.find((item) => item.verse_id === "LEV.19.18");
    expect(lev?.reasons.find((r) => r.ref === "MAT.22.39")?.detail).toBe(
      "related passage MAT.22.39 is marked quotation",
    );
  });

  it("leaves out an entry with no trigger, and picks it up on a critical adversary flag alone", () => {
    const t = staging();
    t.insert(untriggered("JHN.1.2"));
    expect(ids(buildQueue(t.db, "targeted_expert", OPTIONS))).not.toContain("JHN.1.2");

    t.flag({ verse_id: "JHN.1.2", claim_id: "JHN.1.1.c1", verdict: "unsupported", severity: "minor" });
    expect(ids(buildQueue(t.db, "targeted_expert", OPTIONS))).not.toContain("JHN.1.2");

    t.flag({
      verse_id: "JHN.1.2",
      claim_id: "JHN.1.1.c2",
      verdict: "overclaimed",
      severity: "critical",
      model: "second-model",
    });
    const item = buildQueue(t.db, "targeted_expert", OPTIONS).items.find((i) => i.verse_id === "JHN.1.2");
    expect(describeReasons(item?.reasons ?? [])).toEqual(["critical_adversary_flag JHN.1.1.c2"]);
    expect(item?.reasons[0]?.detail).toBe("second-model judged JHN.1.1.c2 overclaimed, severity critical");
  });

  it("picks up each trigger on its own: allusion, fulfillment, translation note, model knowledge, debated", () => {
    const t = staging();
    const withRelated = (verseId: string, relationship: string): Payload => {
      const payload = untriggered(verseId);
      payload["related_passages"] = [{ ref: "ISA.7.14", relationship }];
      return payload;
    };
    t.insert(withRelated("JHN.1.3", "allusion"));
    t.insert(withRelated("JHN.1.4", "fulfillment"));
    t.insert(withRelated("JHN.1.5", "parallel"));
    t.insert({ ...untriggered("JHN.1.6"), translation_note: "Why this wording." });
    const modelKnowledge = untriggered("JHN.1.7");
    const claims = modelKnowledge["claims"] as Array<Record<string, unknown>>;
    const firstContext = claims.find((c) => c["category"] === "context");
    if (firstContext === undefined) throw new Error("fixture has no context claim");
    firstContext["grounding"] = "model_knowledge";
    t.insert(modelKnowledge);

    const reasons = Object.fromEntries(
      buildQueue(t.db, "targeted_expert", OPTIONS).items.map((i) => [i.verse_id, describeReasons(i.reasons)]),
    );
    expect(reasons["JHN.1.3"]).toEqual(["related_passage ISA.7.14"]);
    expect(reasons["JHN.1.4"]).toEqual(["related_passage ISA.7.14"]);
    expect(reasons["JHN.1.5"]).toBeUndefined();
    expect(reasons["JHN.1.6"]).toEqual(["translation_note"]);
    expect(reasons["JHN.1.7"]).toEqual([`model_knowledge_claim ${String(firstContext["id"])}`]);
  });
});

describe("adversary disagreement queue", () => {
  it("holds entries with a non-upheld verdict, critical first", () => {
    const t = staging();
    // Inserted minor-first, so the order cannot come from insertion.
    t.flag({ verse_id: "JHN.1.1", claim_id: "JHN.1.1.c1", verdict: "unsupported", severity: "minor" });
    t.flag({ verse_id: "PSA.23.1", claim_id: "PSA.23.1.c1", verdict: "compound", severity: "minor" });
    t.flag({ verse_id: "PSA.23.1", claim_id: "PSA.23.1.c2", verdict: "miscategorised", severity: "minor" });
    t.flag({ verse_id: "GEN.1.1", claim_id: "GEN.1.1.c1", verdict: "upheld", severity: "none" });
    t.flag({ verse_id: "GEN.1.1", claim_id: "GEN.1.1.c2", verdict: "upheld", severity: "none" });
    t.flag({ verse_id: "REV.13.18", claim_id: "REV.13.18.c1", verdict: "overclaimed", severity: "critical" });
    t.flag({ verse_id: "1CO.14.34", claim_id: "1CO.14.34.c1", verdict: "upheld", severity: "none" });
    t.flag({ verse_id: "1CO.14.34", claim_id: "1CO.14.34.c7", verdict: "unsupported", severity: "critical" });

    const queue = buildQueue(t.db, "adversary_disagreement", OPTIONS);
    // Critical (1CO, REV tie; verse order breaks it), then minor (PSA has two, JHN one). GEN is all upheld.
    expect(ids(queue)).toEqual(["1CO.14.34", "REV.13.18", "PSA.23.1", "JHN.1.1"]);
    expect(queue.items[0]?.adversary).toEqual({ disagreements: 1, critical: 1, minor: 0, worst: "critical" });
    expect(queue.items[2]?.adversary).toEqual({ disagreements: 2, critical: 0, minor: 2, worst: "minor" });
  });

  it("is empty before the adversary pass has written anything", () => {
    const t = staging();
    expect(buildQueue(t.db, "adversary_disagreement", OPTIONS).items).toEqual([]);
  });
});

describe("entry view", () => {
  it("returns the parsed entry, verse text, findings and inline flags", () => {
    const t = staging();
    t.flag({ verse_id: "1CO.14.34", claim_id: "1CO.14.34.c7", verdict: "unsupported", severity: "critical" });
    const view = buildEntry(t.db, "1CO.14.34");
    expect(view?.entry?.verse_id).toBe("1CO.14.34");
    expect(view?.parse_issues).toEqual([]);
    expect(view?.findings).toEqual([]);
    expect(view?.texts).toEqual([{ translation: "BSB", text: "Women are to be silent in the churches." }]);
    expect(view?.adversary_flags.map((f) => f.claim_id)).toEqual(["1CO.14.34.c7"]);
    expect(view?.script).toBe("greek");
    expect(view?.display_ref).toBe("1 Corinthians 14:34");
    expect(buildEntry(t.db, "GEN.1.1")?.script).toBe("hebrew");
    expect(buildEntry(t.db, "JHN.3.16")).toBeNull();
  });

  it("reports parse issues instead of failing when a payload no longer matches the schema", () => {
    const t = staging();
    const broken = asVerse(golden("JHN.1.1"), "JHN.1.9");
    delete broken["whats_happening"];
    t.insert(broken);
    const view = buildEntry(t.db, "JHN.1.9");
    expect(view?.entry).toBeNull();
    expect(view?.parse_issues.some((issue) => issue.startsWith("whats_happening"))).toBe(true);
  });
});
