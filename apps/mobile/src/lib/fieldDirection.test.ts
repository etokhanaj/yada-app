import { describe, expect, it } from "vitest";

import { fieldDirection } from "./fieldDirection";

describe("fieldDirection", () => {
  it("types Hebrew right to left, pointed or not", () => {
    expect(fieldDirection("בְּרֵאשִׁית")).toBe("rtl");
    expect(fieldDirection("ברא")).toBe("rtl");
  });

  it("keeps English, references and Greek left to right", () => {
    expect(fieldDirection("shepherd")).toBe("ltr");
    expect(fieldDirection("jn 3 16")).toBe("ltr");
    expect(fieldDirection("λόγος")).toBe("ltr");
    expect(fieldDirection("ἐν ἀρχῇ")).toBe("ltr");
  });

  it("takes the first strong character, not the majority", () => {
    expect(fieldDirection("בְּרֵאשִׁית in Genesis")).toBe("rtl");
    expect(fieldDirection("Genesis בְּרֵאשִׁית")).toBe("ltr");
  });

  it("skips digits, spaces, punctuation and marks before the first letter", () => {
    expect(fieldDirection("  3:16 “אֱלֹהִים")).toBe("rtl");
    // A lone vowel point (qamats) and a maqaf are not strong.
    expect(fieldDirection("ָ־אֶרֶץ")).toBe("rtl");
    expect(fieldDirection("1 cor")).toBe("ltr");
  });

  it("stays LTR, like the page, when nothing typed is strong", () => {
    expect(fieldDirection("")).toBe("ltr");
    expect(fieldDirection("3:16")).toBe("ltr");
    expect(fieldDirection("ָ")).toBe("ltr");
  });
});
