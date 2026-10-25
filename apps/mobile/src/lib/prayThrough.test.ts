import { describe, expect, it } from "vitest";

import { prayedByPlace, type Turn } from "./prayThrough";

const turn = (place: string, kind: Turn["kind"], n: number): Turn => ({ key: `${place}-${n}`, place, text: "", kind });

describe("who you prayed for, by place (PF-32)", () => {
  it("counts each place once, in the order you prayed", () => {
    expect(prayedByPlace([turn("Your list", "list", 1), turn("Your list", "list", 2), turn("Home group", "circle", 1), turn("Someone on Yada", "public", 1)])).toEqual([
      { place: "Your list", kind: "list", line: "2 prayers" },
      { place: "Home group", kind: "circle", line: "1 request" },
      { place: "Someone on Yada", kind: "public", line: "1 request" },
    ]);
  });

  it("lists nothing when nothing was prayed", () => {
    expect(prayedByPlace([])).toEqual([]);
  });
});
