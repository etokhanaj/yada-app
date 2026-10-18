import { describe, expect, it } from "vitest";

import { sidebarWidthFor, tabPlacementFor } from "./wide";

describe("tab placement by window size (TB-01–03, DU-01)", () => {
  it("keeps the iPhone's bar on phones, slide over and a half split", () => {
    expect(tabPlacementFor(402, 874)).toBe("bottom");
    expect(tabPlacementFor(320, 1024)).toBe("bottom");
    expect(tabPlacementFor(678, 1024)).toBe("bottom");
    // DU-01 closed: the cover is the iPhone layout.
    expect(tabPlacementFor(474, 696)).toBe("bottom");
  });

  it("puts the tabs at the top on an iPad in portrait, iPad mini included", () => {
    expect(tabPlacementFor(834, 1194)).toBe("top");
    expect(tabPlacementFor(744, 1133)).toBe("top");
  });

  it("draws the sidebar on an iPad in landscape and on an open Duo", () => {
    expect(tabPlacementFor(1194, 834)).toBe("side");
    expect(tabPlacementFor(904, 640)).toBe("side");
    expect(sidebarWidthFor(1194)).toBe(250);
    expect(sidebarWidthFor(904)).toBe(200);
  });
});
