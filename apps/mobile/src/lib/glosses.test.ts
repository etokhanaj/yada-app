import { describe, expect, it } from "vitest";

import { displayGloss } from "./glosses";

describe("displayGloss (decision 5)", () => {
  it("expands TAHOT's obj (Gen 1:1 אֵת, וְאֵת)", () => {
    expect(displayGloss("obj")).toBe("[object]");
    expect(displayGloss("and obj")).toBe("and [object]");
  });

  it("leaves every other gloss as the source has it", () => {
    expect(displayGloss("they should be silent")).toBe("they should be silent");
    expect(displayGloss("object of")).toBe("object of");
  });
});
