import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  MAX_VERSES_PER_REQUEST,
  OUTPUT_TOKEN_CAP,
  PLANNING_MARGIN,
  PLANNING_OUTPUT_PER_VERSE,
  WORST_MEASURED_OUTPUT_PER_VERSE,
  chunkVerses,
  partId,
} from "./generate.js";

/**
 * Pericopes too long for one response (docs/milestone-0.md §"Fix before
 * scaling" item 5). The limit is planned on the worst measured per-verse
 * output plus a margin (code review, 10 Oct 2026), which makes it 15 verses.
 * JHN.11.1-11.44 is John's longest pericope.
 *
 * The request tests run against a temp content/ like submit-spend.test.ts, with
 * a fake client: no sources, no key, no network, and the real spend log is
 * never touched.
 */

describe("chunkVerses", () => {
  const verses = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it("derives its limit from the worst measured rate with a margin, not a guess", () => {
    expect(PLANNING_OUTPUT_PER_VERSE).toBe(Math.ceil(WORST_MEASURED_OUTPUT_PER_VERSE * PLANNING_MARGIN));
    expect(MAX_VERSES_PER_REQUEST).toBe(Math.floor(OUTPUT_TOKEN_CAP / PLANNING_OUTPUT_PER_VERSE));
    expect(MAX_VERSES_PER_REQUEST).toBe(15);
  });

  it("keeps a full chunk under the cap at every measured rate", () => {
    // docs/cost-model.md: the six measured rates and the two pooled ones.
    for (const rate of [6_697, 6_254, 6_242, 4_742, 3_824, 3_221, 4_259, 4_902]) {
      expect(MAX_VERSES_PER_REQUEST * rate).toBeLessThan(OUTPUT_TOKEN_CAP);
    }
  });

  it("leaves a pericope at or under the limit whole", () => {
    expect(chunkVerses(verses(15))).toEqual([verses(15)]);
    expect(chunkVerses(verses(7))).toEqual([verses(7)]);
    expect(chunkVerses([])).toEqual([[]]);
  });

  it("splits into the fewest chunks, as even as possible, earlier chunks longer", () => {
    expect(chunkVerses(verses(44)).map((c) => c.length)).toEqual([15, 15, 14]);
    expect(chunkVerses(verses(35)).map((c) => c.length)).toEqual([12, 12, 11]);
    expect(chunkVerses(verses(31)).map((c) => c.length)).toEqual([11, 10, 10]);
    expect(chunkVerses(verses(67)).map((c) => c.length)).toEqual([14, 14, 13, 13, 13]);
    expect(chunkVerses(verses(176)).map((c) => c.length)).toEqual([15, 15, 15, 15, 15, 15, 15, 15, 14, 14, 14, 14]);
  });

  it("keeps every verse once, contiguous and in order", () => {
    for (const n of [34, 41, 100, 176]) {
      const chunks = chunkVerses(verses(n));
      expect(chunks.flat()).toEqual(verses(n));
      expect(chunks.every((c) => c.length <= MAX_VERSES_PER_REQUEST)).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(chunkVerses(verses(44))).toEqual(chunkVerses(verses(44)));
  });

  it("names a part only when there is more than one", () => {
    expect(partId("JHN.4.1-4.42", 1, 1)).toBe("JHN.4.1-4.42");
    expect(partId("JHN.4.1-4.42", 2, 2)).toBe("JHN.4.1-4.42.part2of2");
  });
});

let tempDir: string;

vi.mock("./paths.js", async () => {
  const actual = await vi.importActual<typeof import("./paths.js")>("./paths.js");
  return {
    ...actual,
    get CONTENT() { return tempDir; },
    get STAGING_DB() { return path.join(tempDir, "staging.db"); },
    get RESPONSES() { return path.join(tempDir, "responses"); },
    ensureDirs: () => mkdirSync(path.join(tempDir, "responses"), { recursive: true }),
  };
});

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "yada-chunks-"));
  vi.resetModules();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const LONG = { id: "JHN.11.1-11.44", label: "The raising of Lazarus" };

/** John 11 with one token per verse, plus John 10:42 and 12:1 so the range edges are real. */
async function load() {
  const generate = await import("./generate.js");
  const submit = await import("./submit.js");
  const db = await import("./db.js");
  const staging = await import("./test-staging.js");
  const seeded = db.openStaging();
  for (let verse = 1; verse <= 44; verse += 1) {
    staging.seedVerse(seeded, `JHN.11.${verse}`, [{ surface: "καὶ", lemma: "καί", strongs: "G2532", morph: "C- --------" }]);
  }
  staging.seedVerse(seeded, "JHN.10.42", [{ surface: "καὶ", lemma: "καί", strongs: "G2532" }]);
  seeded.close();
  return { ...generate, ...submit };
}

/** Answers the token count and the stream; records every body it was sent. */
function recordingClient(sent: string[]): any {
  return {
    messages: {
      countTokens: async () => ({ input_tokens: 4000 }),
      stream: (params: { messages: Array<{ content: string }> }) => {
        sent.push(params.messages[0]?.content ?? "");
        return {
          finalMessage: async () => ({
            content: [{ type: "text", text: "{}" }],
            usage: { input_tokens: 4000, output_tokens: 9000 },
            stop_reason: "end_turn",
          }),
        };
      },
    },
  };
}

describe("requests for a long pericope", () => {
  it("builds one request per chunk, each asking only for its verses", async () => {
    const { buildRequests } = await load();
    const requests = buildRequests("JHN", LONG);
    expect(requests.map((r) => [r.custom_id, r.part, r.parts, r.verses.length])).toEqual([
      ["JHN.11.1-11.44.part1of3", 1, 3, 15],
      ["JHN.11.1-11.44.part2of3", 2, 3, 15],
      ["JHN.11.1-11.44.part3of3", 3, 3, 14],
    ]);
    expect(requests[1]?.verses[0]).toBe("JHN.11.16");
    expect(requests[2]?.verses[0]).toBe("JHN.11.31");
    expect(requests[2]?.body).toMatch(/Verses to emit entries for: JHN\.11\.31, .*JHN\.11\.44\n/);
    expect(requests[1]?.body).not.toMatch(/Verses to emit entries for: JHN\.11\.1,/);
    // The whole chapter is context in every part.
    for (const r of requests) expect(r.body).toMatch(/JHN\.11\.1\t.*JHN\.11\.44\t/s);
    expect(requests[0]?.body).toMatch(/Write the pericope object for the whole passage/);
    for (const r of requests.slice(1)) expect(r.body).toMatch(/Part 1 writes the pericope object/);
  });

  it("leaves a short pericope's request without any part wording", async () => {
    const { buildRequests } = await load();
    const [only, ...rest] = buildRequests("JHN", { id: "JHN.11.1-11.15", label: "short" });
    expect(rest).toEqual([]);
    expect(only?.custom_id).toBe("JHN.11.1-11.15");
    expect(only?.body).not.toMatch(/Request part/);
  });

  it("carries every chapter a pericope spans, not only the two ends", async () => {
    const { buildRequests } = await load();
    // 10:42 to 12:x: chapter 11 is the middle one and was dropped before.
    const requests = buildRequests("JHN", { id: "JHN.10.42-12.1", label: "span" });
    expect(requests.flatMap((r) => r.verses)).toContain("JHN.11.20");
  });

  it("refuses to generate a split pericope without naming the part, before anything is sent", async () => {
    const { generatePericope } = await load();
    const sent: string[] = [];
    await expect(generatePericope("JHN", LONG, "claude-opus-5", { confirm: true, client: recordingClient(sent) })).rejects.toThrow(
      /split into 3 requests/,
    );
    expect(sent).toEqual([]);
    expect(existsSync(path.join(tempDir, "usage.jsonl"))).toBe(false);
  });

  it("generates one part: its own response file, verse list and usage line", async () => {
    const { generatePericope } = await load();
    const sent: string[] = [];
    const result = await generatePericope("JHN", LONG, "claude-opus-5", { confirm: true, client: recordingClient(sent), part: 2 });
    expect([result.part, result.parts, result.verses.length]).toEqual([2, 3, 15]);
    expect(sent).toHaveLength(1);

    const files = readdirSync(path.join(tempDir, "responses"));
    expect(files).toEqual(["JHN.11.1-11.44.part2of3.claude-opus-5.json"]);
    const body = JSON.parse(readFileSync(path.join(tempDir, "responses", files[0] as string), "utf8"));
    expect(body).toMatchObject({ pericope_id: LONG.id, part: 2, parts: 3 });
    expect(body.verses).toEqual(result.verses);

    const usage = JSON.parse(readFileSync(path.join(tempDir, "usage.jsonl"), "utf8").trim());
    expect(usage).toMatchObject({ pericope_id: "JHN.11.1-11.44.part2of3", verses: 15 });
  });
});
