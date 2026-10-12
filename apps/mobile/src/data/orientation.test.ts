/**
 * Start here's Next line shows reviewed Yada text only: the row has no Unreviewed label
 * (rule 2; gate review, 11 Oct 2026).
 */

import { describe, expect, it, vi } from "vitest";

import type { PericopeRow } from "../lib/pericopes";

const entry = { reviewStatus: "human_reviewed", entry: { whats_happening: "The Word was there before anything began. More follows." } };
vi.mock("./understand", () => ({
  isUnreviewed: (status: string | null | undefined) => status !== "human_reviewed" && status !== "expert_reviewed",
  loadEntry: async () => entry,
  loadPericopes: async () => [],
  parsePericopePayload: () => null,
}));
vi.mock("./passageNote", () => ({ loadPassageNote: async () => null }));
vi.mock("./queries", () => ({}));

const { loadOrientation } = await import("./guide");

const row = (over: Partial<PericopeRow>): PericopeRow => ({
  pericope_id: "JHN.1.19-1.34",
  label: "John's witness",
  start_ord: 0,
  end_ord: 0,
  review_status: null,
  payload: null,
  ...over,
});

describe("loadOrientation", () => {
  it("shows a reviewed orientation and hides a draft one", async () => {
    const payload = JSON.stringify({ orientation: "John points away from himself." });
    expect(await loadOrientation(row({ payload, review_status: "human_reviewed" }))).toBe("John points away from himself.");
    expect(await loadOrientation(row({ payload, review_status: "flagged" }))).toBeNull();
  });

  it("follows the entry's own review status for a picked passage", async () => {
    const picked = row({ pericope_id: "JHN.1.1-1.18" });
    expect(await loadOrientation(picked)).toBe("The Word was there before anything began.");
    entry.reviewStatus = "flagged";
    expect(await loadOrientation(picked)).toBeNull();
  });
});
