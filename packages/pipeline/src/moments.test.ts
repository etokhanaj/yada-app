import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { candidates, hasApproved, MOMENTS, MomentsRefused, parseTopicScores } from "./moments.js";
import { understandPaths } from "./understand/package.js";

const HEADER = "Topic\tOSIS\tQuality Score (based on percentage of votes for the passage)\t# Generated 2026-10-12. CC-BY License: www.openbible.info/topics";

describe("OpenBible topic scores", () => {
  it("refuses a file that has lost its CC-BY line (rule 3)", () => {
    expect(() => parseTopicScores("Topic\tOSIS\tQuality Score\n")).toThrow(MomentsRefused);
  });

  it("orders each topic's references by score", () => {
    const t = parseTopicScores([HEADER, "worry\tPs.94.19\t30", "worry\tPhil.4.6-Phil.4.7\t90", "fear\tIsa.41.10\t50"].join("\n"));
    expect(t.get("worry")?.map((r) => r.osis)).toEqual(["Phil.4.6-Phil.4.7", "Ps.94.19"]);
  });

  it("offers no verse twice and nothing with no votes", () => {
    const t = parseTopicScores([HEADER, "worry\tPhil.4.6-Phil.4.7\t90", "worry\tPhil.4.6\t80", "worry\tMatt.6.34\t10", "worry\tMatt.6.25\t0"].join("\n"));
    expect(candidates(t.get("worry") ?? []).map((r) => r.osis)).toEqual(["Phil.4.6-Phil.4.7", "Matt.6.34"]);
  });

  const raw = path.join(understandPaths().raw, "openbible-topics", "topic-scores.txt");
  it.skipIf(!existsSync(raw))("the pinned file has every moment's topic, and Anxious starts at Philippians 4:6-7", () => {
    const topics = parseTopicScores(readFileSync(raw, "utf8"));
    for (const { topic } of MOMENTS) expect(topics.has(topic), topic).toBe(true);
    expect(candidates(topics.get("worry") ?? [])[0]?.osis).toBe("Phil.4.6-Phil.4.7");
  });
});

describe("the review file (rule 2)", () => {
  it("sees John's approvals, so --write never overwrites them with drafts", () => {
    expect(hasApproved(JSON.stringify({ moments: [{ status: "draft" }, { status: "approved" }] }))).toBe(true);
    expect(hasApproved(JSON.stringify({ moments: [{ status: "draft" }] }))).toBe(false);
  });

  it("holds all six moments approved, as John decided on 22 Oct 2026", () => {
    const file = JSON.parse(readFileSync(path.resolve(__dirname, "../prototypes/data/moments.json"), "utf8")) as {
      moments: { moment: string; status: string; candidates: { decision: string }[] }[];
    };
    expect(file.moments.map((m) => m.status)).toEqual(Array(6).fill("approved"));
    expect(file.moments.flatMap((m) => m.candidates).filter((c) => c.decision === "keep")).toHaveLength(38);
  });
});
