import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BUNDLE_FORMAT } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { contrast } from "../design/contrast";
import { sha256Hex } from "./sha256";
import {
  afterRemove, COVER_TONES, coverTone, downloadedLine, downloadLine, notInLine, onPhoneOrder, parseCatalogue, resolveUrl, rowLabel,
  schemaName, sweepTranslations, UPDATE_LINE, verifyDownload, verseTextIn, bsbStandsIn,
} from "./translations";

const entries = (manifest: unknown) => parseCatalogue(manifest, MANIFEST).entries;

const MANIFEST = "https://cdn.example/v1/manifest.json";
const sha = "a".repeat(64);
/** The shape `yada package translation` writes into the manifest (TranslationInfoSchema). */
const ylt = {
  code: "YLT",
  name: "Young’s Literal Translation",
  year: 1898,
  version: 1,
  file: "translation-ylt.v1.db",
  sha256: sha,
  bytes: 1_300_000,
  format: BUNDLE_FORMAT,
  license: "PUBLIC_DOMAIN",
  attribution: "Young's Literal Translation, by Robert Young. Public domain.",
  cover: "paper",
  verses: 31_102,
  missing: [],
};

describe("parseCatalogue", () => {
  it("reads the pipeline's entry and resolves its file against the manifest", () => {
    const [entry] = entries({ translations: [ylt] });
    expect(entry).toMatchObject({ code: "YLT", year: 1898, version: 1, cover: "paper", license: "PUBLIC_DOMAIN", missing: [] });
    expect(entry?.url).toBe("https://cdn.example/v1/translation-ylt.v1.db");
  });

  it("takes a new version's cover from the manifest, and falls back on a tone it does not know", () => {
    const next = { ...ylt, code: "NEW", file: "translation-new.v1.db" };
    expect(entries({ translations: [{ ...next, cover: "sage" }] })[0]?.cover).toBe("sage");
    expect(entries({ translations: [{ ...next, cover: "purple" }] })[0]?.cover).toBe("paper");
  });

  it("keeps the verses a version does not print", () => {
    const asv = { ...ylt, code: "ASV", file: "translation-asv.v1.db", verses: 31_099, missing: ["MAT.23.14", "ACT.8.37", "ACT.15.34"] };
    expect(entries({ translations: [asv] })[0]?.missing).toEqual(["MAT.23.14", "ACT.8.37", "ACT.15.34"]);
  });

  it("drops entries the schema refuses, and duplicates", () => {
    const list = [
      { ...ylt, sha256: "nope" },
      { ...ylt, code: "ASV", file: "translation-asv.v1.db", license: "" },
      { ...ylt, code: "WEB", file: "translation-web.v1.db", license: "Public domain" },
      { ...ylt, code: "ASV", file: "translation-asv.v1.db", bytes: 0 },
      { ...ylt, code: "MSB", file: "../translation-msb.v1.db" },
      { ...ylt, code: "MSB", file: "translation-msb.v1.db", attribution: "" },
      { ...ylt, code: "KJV", file: "translation-kjv.v1.db", missing: ["not a verse"] },
      { ...ylt, code: "x y" },
      // The app's first entry shape: a url and no file.
      { code: "LSV", name: "LSV", year: 2020, version: 1, bytes: 1, sha256: sha, url: "x.db", license: "CC-BY-SA-4.0" },
      ylt,
      { ...ylt, name: "Second YLT" },
    ];
    expect(parseCatalogue({ translations: list }, MANIFEST)).toEqual({
      entries: [expect.objectContaining({ name: "Young’s Literal Translation" })],
      needsUpdate: false,
    });
    expect(parseCatalogue({ bundles: [] }, MANIFEST)).toEqual({ entries: [], needsUpdate: false });
    expect(parseCatalogue(null, MANIFEST)).toEqual({ entries: [], needsUpdate: false });
  });

  it("re-reads its own saved copy", () => {
    const saved = JSON.parse(JSON.stringify({ translations: entries({ translations: [ylt] }) })) as unknown;
    expect(parseCatalogue(saved, MANIFEST)).toEqual(parseCatalogue({ translations: [ylt] }, MANIFEST));
  });

  it("keeps the gzipped size, and reads an entry written before it existed", () => {
    expect(entries({ translations: [{ ...ylt, download_bytes: 3_300_000 }] })[0]?.download_bytes).toBe(3_300_000);
    expect(entries({ translations: [ylt] })[0]?.download_bytes).toBeUndefined();
  });

  it("keeps a newer format out of Download, and says an update is needed", () => {
    const newer = { ...ylt, code: "ASV", file: "translation-asv.v1.db", format: BUNDLE_FORMAT + 1 };
    const one = parseCatalogue({ format: BUNDLE_FORMAT, translations: [ylt, newer] }, MANIFEST);
    expect(one.entries.map((e) => e.code)).toEqual(["YLT"]);
    expect(one.needsUpdate).toBe(true);

    // A newer entry whose shape this build does not know at all is still counted, not dropped quietly.
    expect(parseCatalogue({ translations: [{ code: "ESV", format: BUNDLE_FORMAT + 1, parts: [] }] }, MANIFEST)).toEqual({
      entries: [],
      needsUpdate: true,
    });

    // A newer manifest: none of its entries is offered, however familiar they look.
    expect(parseCatalogue({ format: BUNDLE_FORMAT + 1, translations: [ylt] }, MANIFEST)).toEqual({ entries: [], needsUpdate: true });
    expect(parseCatalogue({ format: BUNDLE_FORMAT + 1, translations: [] }, MANIFEST).needsUpdate).toBe(false);
    expect(parseCatalogue({ format: "3", translations: [ylt] }, MANIFEST).entries).toHaveLength(1);
    expect(UPDATE_LINE).toBe("Update Yada to get more translations.");
  });

  it("keeps saying so from the saved copy, offline", () => {
    // The shape refreshCatalogue saves when the manifest offered a newer format.
    const saved = JSON.parse(JSON.stringify({ translations: [...entries({ translations: [ylt] }), { format: BUNDLE_FORMAT + 1 }] })) as unknown;
    expect(parseCatalogue(saved, MANIFEST)).toEqual({ entries: entries({ translations: [ylt] }), needsUpdate: true });
  });
});

describe("verifyDownload", () => {
  it("wants the manifest's size and digest both", async () => {
    const bytes = new TextEncoder().encode("a translation file");
    const entry = { bytes: bytes.length, sha256: await sha256Hex(bytes) };
    expect(await verifyDownload(bytes, entry)).toBe(true);
    expect(await verifyDownload(bytes, { ...entry, bytes: bytes.length + 1 })).toBe(false);
    expect(await verifyDownload(bytes, { ...entry, sha256: sha })).toBe(false);
    expect(await verifyDownload(bytes.slice(1), entry)).toBe(false);
  });
});

describe("sweepTranslations", () => {
  const row = (code: string, removed: number) => ({ code, file: `translation-${code.toLowerCase()}.v1.db`, removed });

  it("attaches live rows and drops removed ones with their files", () => {
    const plan = sweepTranslations([row("ASV", 0), row("YLT", 1)], ["translation-asv.v1.db", "translation-ylt.v1.db"]);
    expect(plan.attach.map((r) => r.code)).toEqual(["ASV"]);
    expect(plan.dropRows).toEqual(["YLT"]);
    expect(plan.deleteFiles).toEqual(["translation-ylt.v1.db"]);
  });

  it("deletes a file no row names: a download whose check failed after ATTACH, and a .partial", () => {
    const plan = sweepTranslations([row("ASV", 0)], ["translation-asv.v1.db", "translation-msb.v1.db", "translation-dby.v1.db.partial"]);
    expect(plan.attach.map((r) => r.code)).toEqual(["ASV"]);
    expect(plan.dropRows).toEqual([]);
    expect(plan.deleteFiles).toEqual(["translation-msb.v1.db", "translation-dby.v1.db.partial"]);
  });

  it("keeps a live row whose file is missing; attach then finds it gone", () => {
    expect(sweepTranslations([row("ASV", 0)], [])).toEqual({ attach: [row("ASV", 0)], dropRows: [], deleteFiles: [] });
  });

  it("leaves a folder holding only what live rows name, over two launches", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "yada-sweep-"));
    try {
      const rows = new Map([["ASV", row("ASV", 0)], ["YLT", row("YLT", 0)]]);
      for (const name of ["translation-asv.v1.db", "translation-ylt.v1.db", "translation-msb.v1.db"]) writeFileSync(path.join(dir, name), "x");
      const launch = () => {
        const plan = sweepTranslations([...rows.values()], readdirSync(dir));
        for (const name of plan.deleteFiles) rmSync(path.join(dir, name));
        for (const code of plan.dropRows) rows.delete(code);
        return plan;
      };
      // First launch: the orphaned MSB download goes; YLT attaches but fails its check, so it is marked, not deleted.
      launch();
      expect(readdirSync(dir).sort()).toEqual(["translation-asv.v1.db", "translation-ylt.v1.db"]);
      rows.set("YLT", row("YLT", 1));
      // Second launch, before anything attaches: YLT's file and row go.
      launch();
      expect(readdirSync(dir)).toEqual(["translation-asv.v1.db"]);
      expect([...rows.keys()]).toEqual(["ASV"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("bsbStandsIn", () => {
  it("is true only where BSB's words are shown under another version's name", () => {
    expect(bsbStandsIn({ BSB: "b" }, "NIV", false)).toBe(true);
    expect(bsbStandsIn({ BSB: "b", KJV: "k" }, "KJV", false)).toBe(false);
    expect(bsbStandsIn({ BSB: "b" }, "BSB", false)).toBe(false);
    // A download without the verse says "Not in the ASV." instead (CP-08).
    expect(bsbStandsIn({ BSB: "b" }, "ASV", true)).toBe(false);
  });
});

describe("verseTextIn", () => {
  it("never puts BSB's words under a downloaded version's name", () => {
    expect(verseTextIn({ BSB: "b", ASV: "a" }, "ASV", true)).toBe("a");
    expect(verseTextIn({ BSB: "b" }, "ASV", true)).toBeNull();
    expect(notInLine("ASV")).toBe("Not in the ASV.");
  });

  it("keeps the BSB fallback for a version that is not in these files", () => {
    expect(verseTextIn({ BSB: "b" }, "NIV", false)).toBe("b");
    expect(verseTextIn({}, "NIV", false)).toBe("");
  });
});

describe("files and urls", () => {
  it("names schemas and resolves urls", () => {
    expect(schemaName("YLT", 2)).toBe("tr_ylt_v2");
    expect(resolveUrl("https://cdn.example/v1/manifest.json", "translation-ylt.v1.db")).toBe("https://cdn.example/v1/translation-ylt.v1.db");
    expect(resolveUrl("https://cdn.example/v1/manifest.json", "https://other.example/x.db")).toBe("https://other.example/x.db");
    expect(resolveUrl("http://localhost:8787/manifest.json", "/t/translation-ylt.v1.db")).toBe("http://localhost:8787/t/translation-ylt.v1.db");
  });
});

describe("row words", () => {
  it("matches MT-02–04", () => {
    expect(downloadLine(ylt)).toBe("1.3 MB");
    expect(downloadedLine(1_300_000)).toBe("Downloaded · 1.3 MB");
  });

  it("offers the download's own size when the file travels gzipped, and no year", () => {
    const gz = { ...ylt, bytes: 7_200_000, download_bytes: 3_300_000 };
    expect(downloadLine(gz)).toBe("3.3 MB");
    expect(rowLabel.download({ ...gz, name: "Young's Literal Translation" }, true)).toBe(
      "Young's Literal Translation, 3.3 megabytes, download",
    );
  });

  it("speaks each row as one element (plan, accessibility 4)", () => {
    expect(rowLabel.download({ ...ylt, name: "Young's Literal Translation" }, true)).toBe(
      "Young's Literal Translation, 1.3 megabytes, download",
    );
    expect(rowLabel.download(ylt, false)).toMatch(/needs a connection$/);
    expect(rowLabel.builtIn("Berean Standard Bible", true)).toBe("Berean Standard Bible, selected");
    expect(rowLabel.downloading("ASV", 46)).toBe("ASV, downloading, 46 percent");
  });
});

describe("order and removal", () => {
  it("lists the built-ins first, then downloads", () => {
    expect(onPhoneOrder(["BSB", "WEB", "KJV", "LSV"], ["YLT", "BSB", "ASV"])).toEqual(["BSB", "WEB", "KJV", "LSV", "YLT", "ASV"]);
  });

  it("falls back to BSB only when the removed one was being read", () => {
    expect(afterRemove("YLT", "YLT")).toBe("BSB");
    expect(afterRemove("KJV", "YLT")).toBe("KJV");
  });
});

describe("cover tones", () => {
  it("are fixed per version", () => {
    expect(["BSB", "WEB", "KJV", "LSV", "ASV"].map((c) => coverTone(c))).toEqual(["forest", "paper", "ink", "lime", "sage"]);
  });

  it("keep the abbreviation legible: 4.5:1 on every ground", () => {
    for (const tone of Object.values(COVER_TONES)) {
      expect(contrast(tone.text, tone.ground)).toBeGreaterThanOrEqual(4.5);
      if (tone.groundDark !== undefined) expect(contrast(tone.text, tone.groundDark)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
