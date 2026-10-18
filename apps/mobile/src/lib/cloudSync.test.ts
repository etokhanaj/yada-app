import { describe, expect, it } from "vitest";

import { changedEntries, EMPTY_STATE, mergeRegisters, mergeState, nextStamp, parseCloud, POSITION_KEY, serializeRegisters, type SyncState } from "./cloudSync";

const state = (partial: Partial<SyncState>): SyncState => ({ ...EMPTY_STATE, ...partial });

describe("merging the reader's data with iCloud", () => {
  it("keeps everything local when iCloud is empty", () => {
    const local = state({
      bookmarks: { "JHN.3.16": [true, 100] },
      position: { [POSITION_KEY]: ["PSA.23.1", 200] },
      threads: { "start-here-john": [4, 300] },
      settings: { appearance: ["dark", 400] },
    });
    expect(mergeState(local, EMPTY_STATE)).toEqual(local);
  });

  it("takes everything from iCloud on a second device's first launch", () => {
    const remote = state({
      bookmarks: { "JHN.3.16": [true, 100], "ROM.8.28": [false, 150] },
      position: { [POSITION_KEY]: ["PSA.23.1", 200] },
      threads: { "start-here-john": [4, 300] },
      settings: { textScale: ["1.1", 400] },
    });
    expect(mergeState(EMPTY_STATE, remote)).toEqual(remote);
  });

  it("keeps bookmarks added on two devices that had not seen each other", () => {
    const merged = mergeState(
      state({ bookmarks: { "JHN.3.16": [true, 100] } }),
      state({ bookmarks: { "ROM.8.28": [true, 90] } }),
    );
    expect(merged.bookmarks).toEqual({ "JHN.3.16": [true, 100], "ROM.8.28": [true, 90] });
  });

  it("lets a removal on one device beat the earlier add on the other", () => {
    const iphone = state({ bookmarks: { "JHN.3.16": [true, 100] } });
    const ipad = state({ bookmarks: { "JHN.3.16": [false, 200] } });
    expect(mergeState(iphone, ipad).bookmarks["JHN.3.16"]).toEqual([false, 200]);
    expect(mergeState(ipad, iphone).bookmarks["JHN.3.16"]).toEqual([false, 200]);
  });

  it("lets a later re-add beat an older removal", () => {
    const merged = mergeState(
      state({ bookmarks: { "JHN.3.16": [true, 300] } }),
      state({ bookmarks: { "JHN.3.16": [false, 200] } }),
    );
    expect(merged.bookmarks["JHN.3.16"]).toEqual([true, 300]);
  });

  it("takes the later setting and reading place", () => {
    const local = state({ settings: { appearance: ["dark", 100] }, position: { [POSITION_KEY]: ["GEN.1.1", 500] } });
    const remote = state({ settings: { appearance: ["light", 200] }, position: { [POSITION_KEY]: ["JHN.1.1", 400] } });
    const merged = mergeState(local, remote);
    expect(merged.settings["appearance"]).toEqual(["light", 200]);
    expect(merged.position[POSITION_KEY]).toEqual(["GEN.1.1", 500]);
  });

  // thread.tsx: tapping an earlier passage makes the one after it next. A
  // maximum would put the later step back at the next sync.
  it("takes the later thread step, even when it is a smaller one", () => {
    const merged = mergeState(state({ threads: { t: [2, 900] } }), state({ threads: { t: [7, 800] } }));
    expect(merged.threads["t"]).toEqual([2, 900]);
  });

  it("settles a tie the same way on both devices", () => {
    const a = state({ settings: { appearance: ["dark", 100] }, bookmarks: { "JHN.3.16": [true, 5] } });
    const b = state({ settings: { appearance: ["light", 100] }, bookmarks: { "JHN.3.16": [false, 5] } });
    expect(mergeState(a, b)).toEqual(mergeState(b, a));
  });

  it("is idempotent, so a sync repeated after a crash changes nothing", () => {
    const a = state({ bookmarks: { "JHN.3.16": [true, 100] }, threads: { t: [1, 10] } });
    const b = state({ bookmarks: { "ROM.8.28": [false, 50] }, threads: { t: [3, 20] } });
    const once = mergeState(a, b);
    expect(mergeState(once, b)).toEqual(once);
    expect(mergeState(once, once)).toEqual(once);
  });

  it("prefers iCloud's reading place on the initial download, where the new device opened John 1 first", () => {
    const fresh = state({ position: { [POSITION_KEY]: ["JHN.1.1", 2_000] }, settings: { appearance: ["dark", 2_000] } });
    const backup = state({ position: { [POSITION_KEY]: ["ROM.8.1", 1_000] }, settings: { appearance: ["light", 1_000] } });
    const merged = mergeState(fresh, backup, { initialSync: true });
    expect(merged.position[POSITION_KEY]).toEqual(["ROM.8.1", 1_000]);
    // Only the place: a setting chosen on the new device still stands.
    expect(merged.settings["appearance"]).toEqual(["dark", 2_000]);
    // With nothing in iCloud, the local place stays.
    expect(mergeState(fresh, EMPTY_STATE, { initialSync: true }).position).toEqual(fresh.position);
  });
});

describe("clock skew", () => {
  it("stamps a local write after the value it replaces when this clock is behind", () => {
    // The iPad's clock is an hour fast and it bookmarked at 10:00 + 1h.
    const ipadAdd = 3_600_000 + 36_000_000;
    // The iPhone sees that bookmark, then removes it at its own 10:05.
    const phoneNow = 36_300_000;
    const removal = nextStamp(phoneNow, ipadAdd);
    expect(removal).toBeGreaterThan(ipadAdd);
    const merged = mergeRegisters({ "JHN.3.16": [true, ipadAdd] as const }, { "JHN.3.16": [false, removal] as const });
    expect(merged["JHN.3.16"]).toEqual([false, removal]);
  });

  it("uses the clock when it is ahead of the value replaced, or there is none", () => {
    expect(nextStamp(500, 100)).toBe(500);
    expect(nextStamp(500, undefined)).toBe(500);
    expect(nextStamp(500, 500)).toBe(501);
  });
});

describe("what changed", () => {
  it("lists entries added or changed, not ones only the old side has", () => {
    const from = { a: [true, 1] as const, b: [true, 2] as const, c: [true, 3] as const };
    const to = { a: [true, 1] as const, b: [false, 4] as const, d: [true, 5] as const };
    expect(changedEntries(from, to)).toEqual([
      ["b", [false, 4]],
      ["d", [true, 5]],
    ]);
  });

  it("serializes equal registers equally whatever their order", () => {
    expect(serializeRegisters({ b: [1, 2], a: [3, 4] })).toBe(serializeRegisters({ a: [3, 4], b: [1, 2] }));
  });
});

describe("reading iCloud's values", () => {
  it("reads nothing from an absent or unreadable value", () => {
    expect(parseCloud("bookmarks", null)).toEqual({});
    expect(parseCloud("bookmarks", "not json")).toEqual({});
    expect(parseCloud("bookmarks", "[1,2]")).toEqual({});
    expect(parseCloud("settings", "null")).toEqual({});
  });

  it("drops bad entries one by one and keeps the good ones", () => {
    const raw = JSON.stringify({
      "JHN.3.16": [true, 100],
      "XYZ.1.1": [true, 100],
      "ROM.8.28": ["yes", 100],
      "GEN.1.1": [true, -1],
      "PSA.23.1": [false],
    });
    expect(parseCloud("bookmarks", raw)).toEqual({ "JHN.3.16": [true, 100] });
  });

  it("reads only the settings that sync, and only a real verse as the place", () => {
    const settings = JSON.stringify({ appearance: ["dark", 1], launched: ["1", 1], textScale: [1.1, 1] });
    expect(parseCloud("settings", settings)).toEqual({ appearance: ["dark", 1] });
    expect(parseCloud("position", JSON.stringify({ [POSITION_KEY]: ["JHN.99.1", 1] }))).toEqual({});
    expect(parseCloud("position", JSON.stringify({ [POSITION_KEY]: ["JHN.3.16", 1] }))).toEqual({ [POSITION_KEY]: ["JHN.3.16", 1] });
  });

  it("reads whole, non-negative thread steps", () => {
    expect(parseCloud("threads", JSON.stringify({ t: [3, 1], u: [1.5, 1], v: [-1, 1] }))).toEqual({ t: [3, 1] });
  });

  it("round-trips what it serializes", () => {
    const bookmarks = { "JHN.3.16": [true, 100] as const, "ROM.8.28": [false, 200] as const };
    expect(parseCloud("bookmarks", serializeRegisters(bookmarks))).toEqual(bookmarks);
  });
});

describe("the streak's days (build 7)", () => {
  it("merges two devices' days as a union", () => {
    const phone = { ...EMPTY_STATE, days: { "2026-10-14": [true, 0] as const } };
    const ipad = { ...EMPTY_STATE, days: { "2026-10-15": [true, 0] as const } };
    expect(Object.keys(mergeState(phone, ipad).days).sort()).toEqual(["2026-10-14", "2026-10-15"]);
  });
  it("reads only dates marked true", () => {
    expect(parseCloud("days", JSON.stringify({ "2026-10-16": [true, 0], nonsense: [true, 0], "2026-10-17": [false, 0] }))).toEqual({ "2026-10-16": [true, 0] });
  });
});

describe("chapters read (build 10a)", () => {
  it("merges two devices' chapters as a union", () => {
    const phone = { ...EMPTY_STATE, chapters: { "MRK.4": [true, 0] as const } };
    const ipad = { ...EMPTY_STATE, chapters: { "MRK.5": [true, 0] as const } };
    expect(Object.keys(mergeState(phone, ipad).chapters).sort()).toEqual(["MRK.4", "MRK.5"]);
  });
  it("reads only real chapters marked true", () => {
    expect(parseCloud("chapters", JSON.stringify({ "MRK.4": [true, 0], "MRK.99": [true, 0], nonsense: [true, 0], "MRK.5": [false, 0] }))).toEqual({ "MRK.4": [true, 0] });
  });
});

describe("Your space: highlights and notes (PS-01–PS-03)", () => {
  it("keeps two devices' highlights on different verses, and the later colour on the same verse", () => {
    const phone = state({ highlights: { "JHN.3.16": ["yellow", 100], "JHN.3.17": ["green", 300] } });
    const ipad = state({ highlights: { "JHN.3.16": ["blue", 200], "PSA.1.3": ["pink", 100] } });
    expect(mergeState(phone, ipad).highlights).toEqual({ "JHN.3.16": ["blue", 200], "JHN.3.17": ["green", 300], "PSA.1.3": ["pink", 100] });
  });

  it("lets a removal beat the older highlight it removed", () => {
    const phone = state({ highlights: { "JHN.3.16": ["", 300] } });
    const ipad = state({ highlights: { "JHN.3.16": ["yellow", 200] } });
    expect(mergeState(phone, ipad).highlights["JHN.3.16"]).toEqual(["", 300]);
  });

  it("reads only the four colours, or a removal, on a real verse", () => {
    const raw = JSON.stringify({ "JHN.3.16": ["yellow", 1], "JHN.3.17": ["", 2], "JHN.3.18": ["purple", 1], "XYZ.1.1": ["blue", 1] });
    expect(parseCloud("highlights", raw)).toEqual({ "JHN.3.16": ["yellow", 1], "JHN.3.17": ["", 2] });
  });

  it("reads a note on a verse or a whole chapter, and drops one longer than the editor allows", () => {
    const raw = JSON.stringify({ "JHN.3.16": ["Loved.", 1], "JHN.3": ["The new birth.", 1], "JHN.99": ["no", 1], "ROM.8.28": ["x".repeat(2001), 1] });
    expect(parseCloud("notes", raw)).toEqual({ "JHN.3.16": ["Loved.", 1], "JHN.3": ["The new birth.", 1] });
  });

  it("keeps the later edit of the same note", () => {
    const phone = state({ notes: { "JHN.3.16": ["first", 100] } });
    const ipad = state({ notes: { "JHN.3.16": ["second", 200] } });
    expect(mergeState(phone, ipad).notes["JHN.3.16"]).toEqual(["second", 200]);
  });
});
