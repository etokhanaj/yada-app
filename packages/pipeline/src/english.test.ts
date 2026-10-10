import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import { cleanKjv, loadTexts, parseBsb, parseVpl } from "./english.js";
import { RAW } from "./paths.js";

describe("KJV display text", () => {
  it("removes pilcrows and the brackets marking supplied words", () => {
    expect(cleanKjv("¶ And the earth was without form, and void; and darkness [was] upon the face")).toBe(
      "And the earth was without form, and void; and darkness was upon the face",
    );
  });
});

const HAVE = existsSync(path.join(RAW, "bsb.txt")) && existsSync(path.join(RAW, "engwebp_vpl.txt"));
const describeIfIngested = HAVE ? describe : describe.skip;

describeIfIngested("the three English texts", () => {
  it("parses every BSB verse, including the header-less first row", () => {
    const bsb = parseBsb();
    expect(bsb.length).toBe(31102);
    expect(bsb[0]?.verse_id).toBe("GEN.1.1");
    expect(bsb.at(-1)?.verse_id).toBe("REV.22.21");
  });

  it("maps BSB's two non-canonical book names", () => {
    const ids = new Set(parseBsb().map((v) => v.verse_id));
    expect(ids.has("PSA.23.1")).toBe(true); // printed as "Psalm"
    expect(ids.has("SNG.1.1")).toBe(true); // printed as "Song of Solomon"
  });

  it("maps every eBible code that differs from USFM", () => {
    const ids = new Set(parseVpl("engwebp_vpl.txt", "WEB").map((v) => v.verse_id));
    for (const id of ["JHN.3.16", "MRK.1.1", "PHP.4.13", "JAS.1.1", "1JN.4.8", "3JN.1.14", "SNG.2.1", "EZK.37.1", "JOL.2.28", "NAM.1.1"]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("keeps a psalm superscription inside English verse 1, where English prints it", () => {
    const psa = parseBsb().find((v) => v.verse_id === "PSA.3.1");
    expect(psa?.text.startsWith("A Psalm of David")).toBe(true);
  });

  it("loads all three translations", () => {
    const { report } = loadTexts();
    expect(report.byTranslation.BSB).toBe(31102);
    expect(report.byTranslation.KJV).toBe(31102);
    expect(report.byTranslation.WEB).toBeGreaterThanOrEqual(31102);
    expect(report.byTranslation.LSV).toBeGreaterThanOrEqual(31102);
  });
});
