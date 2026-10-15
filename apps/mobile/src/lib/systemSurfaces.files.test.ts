/**
 * The Swift the app and the widget extension must share: ActivityKit matches the Live Activity's attributes
 * by name, and an intent a widget button runs must be the same type in both targets (SX-05, SX-09, SX-17).
 * Each is kept as two identical copies, one per target; this fails when one is edited alone.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(MOBILE, p), "utf8");

describe("Swift shared by the app and the widget extension", () => {
  it.each([
    ["modules/yada-system/ios/ReadingActivity.swift", "targets/widget/ReadingActivity.swift"],
    ["modules/yada-system/app/YadaSharedIntents.swift", "targets/widget/YadaSharedIntents.swift"],
  ])("%s and %s are identical", (a, b) => {
    expect(read(b)).toBe(read(a));
  });

  it("the Live Activity's state has every field the app sends", () => {
    const swift = read("modules/yada-system/ios/ReadingActivity.swift");
    const fields = ["title", "ref", "verse", "spoken", "line", "lineGlyph", "segments", "ring", "playing"];
    for (const f of fields) expect(swift).toMatch(new RegExp(`public var ${f}:`));
    const ts = read("src/lib/systemSurfaces.ts");
    const state = ts.slice(ts.indexOf("export interface ActivityState"), ts.indexOf("export interface ActivityInput"));
    expect([...state.matchAll(/readonly (\w+):/g)].map((m) => m[1]).sort()).toEqual([...fields].sort());
  });
});
