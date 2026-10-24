/**
 * The Swift the app and the widget extension must share: an intent a widget button runs must be the same type in
 * both targets (SX-05, SX-09).
 * Each is kept as two identical copies, one per target; this fails when one is edited alone.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PALETTES } from "../design/palette";

const MOBILE = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(MOBILE, p), "utf8");

describe("Swift shared by the app and the widget extension", () => {
  it.each([
    ["modules/yada-system/app/YadaSharedIntents.swift", "targets/widget/YadaSharedIntents.swift"],
    ["targets/watch/WatchData.swift", "targets/watch-widget/WatchData.swift"],
  ])("%s and %s are identical", (a, b) => {
    expect(read(b)).toBe(read(a));
  });

  it("the watch decodes every field of a WatchPart the phone sends (AW-01, AW-03)", () => {
    const swift = read("targets/watch/WatchData.swift");
    const struct = swift.slice(swift.indexOf("struct WatchPart"), swift.indexOf("var start"));
    const ts = read("src/lib/systemSurfaces.ts");
    const part = ts.slice(ts.indexOf("export interface WatchPart"), ts.indexOf("export function watchPart"));
    const top = [...part.matchAll(/^ {2}readonly (\w+):/gm)].map((m) => m[1]).sort();
    expect([...struct.matchAll(/^ {2}let (\w+):/gm)].map((m) => m[1]).sort()).toEqual(top);
  });

  it("the watch's colours are the palette's dark ones", () => {
    const load = createRequire(__filename);
    for (const target of ["watch", "watch-widget"]) {
      const config = (load(resolve(MOBILE, `targets/${target}/expo-target.config.js`)) as () => { colors: Record<string, string> })();
      for (const [name, value] of Object.entries(config.colors)) {
        expect(value, `${target} ${name}`).toBe(PALETTES.dark[name as keyof typeof PALETTES.dark]);
      }
    }
  });
});

/**
 * Design QA X1, X2 (18 Oct 2026): the widgets and the reminder's long-press kept the chalk palette
 * for three builds after the app went white, because their colours are a copy in each target's config.
 */
describe("the extensions' colours are the app's palette", () => {
  const load = createRequire(__filename);
  const colors = (target: string): Record<string, { light: string; dark: string }> =>
    (load(resolve(MOBILE, `targets/${target}/expo-target.config.js`)) as () => { colors: Record<string, { light: string; dark: string }> })().colors;

  it.each(["widget", "notification"])("%s", (target) => {
    for (const [name, c] of Object.entries(colors(target))) {
      const key = name as keyof typeof PALETTES.light;
      expect({ name, light: c.light, dark: c.dark }).toEqual({ name, light: PALETTES.light[key], dark: PALETTES.dark[key] });
    }
  });

  it("each colour set in the asset catalogue is the config's", () => {
    for (const target of ["widget", "notification"]) {
      for (const [name, c] of Object.entries(colors(target))) {
        const set = JSON.parse(read(`targets/${target}/Assets.xcassets/${name}.colorset/Contents.json`)) as {
          colors: { color: { components: { red: number; green: number; blue: number } } }[];
        };
        const hex = ({ red, green, blue }: { red: number; green: number; blue: number }) =>
          `#${[red, green, blue].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
        expect(set.colors.map((x) => hex(x.color.components))).toEqual([c.light, c.dark]);
      }
    }
  });
});
