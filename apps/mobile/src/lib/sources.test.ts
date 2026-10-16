import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import type { SourceRow } from "../data/queries";
import { DAILY_LIGHT_DATASET, PICTURES_DATASET, SPURGEON_DATASET, licenceLabel, sourceItems } from "./sources";

const row = (dataset: string, license: string, encumbered: string | null = null): SourceRow => ({
  dataset,
  license,
  encumbered,
  source: "",
  attribution: "",
  url: `https://example.org/${license}`,
});

describe("licenceLabel", () => {
  it("says SBLGNT's EULA is its own licence (S11)", () => {
    expect(licenceLabel("CUSTOM_EULA")).toBe("Own licence");
    expect(licenceLabel("CC-BY-SA-3.0")).toBe("CC BY-SA 3.0");
    expect(licenceLabel("SOME_NEW_CODE")).toBe("SOME NEW CODE");
  });
});

describe("sourceItems", () => {
  it("puts the role first and the dataset with its licence beneath (S15, S16)", () => {
    const [item] = sourceItems([row("morphgnt/sblgnt (morphological annotations)", "CC-BY-SA-3.0")]);
    expect(item).toMatchObject({ group: "Words and people", title: "Greek parsing", subtitle: "MorphGNT · CC BY-SA 3.0" });
    expect(item?.label).toBe("Greek parsing, MorphGNT, CC BY-SA 3.0, opens the source");
  });

  it("names English translations first (S20)", () => {
    const [item] = sourceItems([row("Berean Standard Bible (text)", "PUBLIC_DOMAIN")]);
    expect(item).toMatchObject({ group: "Bible text", title: "Berean Standard Bible", subtitle: "English · BSB · Public domain" });
  });

  it("never carries the encumbered notes into the UI (S15)", () => {
    const items = sourceItems([row("SBLGNT (Greek text)", "CUSTOM_EULA", "SBLGNT EULA has not been reviewed")]);
    const shown = items.map((i) => [i.title, i.subtitle, i.label].join(" "));
    expect(shown.join(" ")).not.toMatch(/EULA|reviewed/);
  });

  it("shows the LSV's copyright line as its source file gives it, whatever the row says", () => {
    const file = "Literal Standard Version. Copyright © 2020 Covenant Press. Licensed under CC BY-SA 4.0. From eBible.org.";
    const lsv = { ...row("Literal Standard Version (englsv)", "CC-BY-SA-4.0"), attribution: "An older wording." };
    expect(sourceItems([lsv])[0]?.attribution).toBe(file);
    expect(sourceItems([row("Literal Standard Version (englsv)", "CC-BY-SA-4.0")])[0]?.attribution).toBe(file);
    const other = { ...row("Some share-alike text", "CC-BY-SA-4.0"), attribution: "As the row states it." };
    expect(sourceItems([other])[0]?.attribution).toBe("As the row states it.");
    expect(sourceItems([row("Berean Standard Bible (text)", "PUBLIC_DOMAIN")])[0]?.attribution).toBeNull();
  });

  it("lists a downloaded translation as Bible text, after the built-in versions", () => {
    const ylt = { ...row("Young's Literal Translation (engylt)", "PUBLIC_DOMAIN"), translation: { code: "YLT", name: "Young’s Literal Translation" } };
    const items = sourceItems([row("morphgnt/sblgnt (morphological annotations)", "CC-BY-SA-3.0"), ylt, row("King James Version, 1769 standardised text (eng-kjv2006)", "PUBLIC_DOMAIN")]);
    expect(items.map((i) => i.title)).toEqual(["King James Version", "Young’s Literal Translation", "Greek parsing"]);
    expect(items[1]).toMatchObject({ group: "Bible text", subtitle: "English · YLT · Public domain" });
  });

  it("holds JPS 1917 back until the app handles an Old Testament-only text", () => {
    const jps = row("JPS Tanakh 1917, The Holy Scriptures According to the Masoretic Text (engjps)", "PUBLIC_DOMAIN");
    const downloaded = { ...row("Some JPS file", "PUBLIC_DOMAIN"), translation: { code: "JPS", name: "JPS 1917" } };
    expect(sourceItems([jps, downloaded])).toEqual([]);
    expect(sourceItems([jps], { otOnlyTexts: true })[0]).toMatchObject({ group: "Bible text", title: "JPS 1917", subtitle: "English · JPS · Public domain" });
  });

  it("lists Understand's sources by what they give, with the share-alike notice", () => {
    const ust = { ...row("unfoldingWord Simplified Text (en_ust)", "CC-BY-SA-4.0"), attribution: "Adapted from unfoldingWord Simplified Text." };
    expect(sourceItems([ust])[0]).toMatchObject({ group: "Understand", title: "In plain words", attribution: "Adapted from unfoldingWord Simplified Text." });
    const clarke = row("Adam Clarke's Commentary and Critical Notes on the Bible (CrossWire SWORD module Clarke 2.0)", "PUBLIC_DOMAIN");
    expect(sourceItems([clarke])[0]).toMatchObject({ group: "Understand", subtitle: "Adam Clarke’s Commentary · Public domain" });
  });

  it("gives every dataset in sources.manifest.json a reader's name, except those listed elsewhere (audit item 7)", () => {
    const manifest = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../sources.manifest.json"), "utf8")) as Array<{ dataset: string; license: string }>;
    // Downloaded translations show under their own names from their files; study sources in their own group.
    // The readings (BSB audio, Kokoro) are Sources' Audio group, read from the manifest's `audio` list.
    const elsewhere = /^(American Standard Version|Young's Literal Translation|Majority Standard Bible|Tyndale Open Study Notes|OpenBible\.info|BSB Audio Bible|Kokoro-82M)/;
    const unnamed = manifest
      .filter((e) => !elsewhere.test(e.dataset))
      .flatMap((e) => sourceItems([row(e.dataset, e.license)], { otOnlyTexts: true }))
      .filter((i) => i.title === i.dataset);
    expect(unnamed.map((i) => i.dataset)).toEqual([]);
  });

  it("leaves out datasets with no reader-facing role", () => {
    expect(sourceItems([row("Literata", "OFL-1.1")])).toEqual([]);
  });
});

const corePath = path.resolve(__dirname, "../../../../content/bundles/core.v4.db");

describe.skipIf(!existsSync(corePath))("sourceItems against the core bundle", () => {
  it("maps every text and data source the bundle lists, in Bible text then Word data order", () => {
    const db = new DatabaseSync(corePath, { readOnly: true });
    const rows = db.prepare("SELECT * FROM sources").all() as unknown as SourceRow[];
    const items = sourceItems(rows);
    expect(items.map((i) => i.title)).toEqual([
      "Greek New Testament",
      "Hebrew Bible",
      "Berean Standard Bible",
      "World English Bible",
      "King James Version",
      "Literal Standard Version",
      "Greek parsing",
      "Hebrew parsing",
      "Greek word glosses",
      "Hebrew word glosses",
      "Greek dictionary forms",
      "Hebrew dictionary forms",
      "Verse numbering",
    ]);
    expect(items[0]?.subtitle).toBe("SBLGNT · CC BY 4.0");
    const lsv = items.find((i) => i.title === "Literal Standard Version");
    expect(lsv?.subtitle).toBe("English · LSV · CC BY-SA 4.0");
    expect(lsv?.url).toBe("https://ebible.org/englsv/");
    expect(lsv?.attribution).toBe(
      "Literal Standard Version. Copyright © 2020 Covenant Press. Licensed under CC BY-SA 4.0. From eBible.org.",
    );
    expect(items.filter((i) => i.attribution !== null).map((i) => i.title)).toEqual(["Literal Standard Version"]);
    const unmapped = rows.filter((r) => !items.some((i) => i.dataset === r.dataset)).map((r) => r.dataset);
    // Fonts and the early WEB excerpt file only.
    expect(unmapped.every((d) => /Literata|Noto|Gentium|John 1, Genesis 1/.test(d))).toBe(true);
  });
});

describe("Today's sources (build 7a)", () => {
  it("lists Spurgeon, Daily Light and the pictures under Today", () => {
    const items = sourceItems([
      { dataset: SPURGEON_DATASET, license: "PUBLIC_DOMAIN", url: "https://www.ccel.org/ccel/spurgeon/morneve.xml" },
      { dataset: DAILY_LIGHT_DATASET, license: "PUBLIC_DOMAIN", url: "https://www.ccel.org/ccel/anonymous/daily_light.html" },
      { dataset: PICTURES_DATASET, license: "Public domain and CC0", url: "https://commons.wikimedia.org" },
    ]);
    expect(items.map((i) => [i.group, i.title, i.value])).toEqual([
      ["Today", "Devotional", "Spurgeon, Morning and Evening · Public domain"],
      ["Today", "The day’s verse", "Daily Light on the Daily Path · Public domain"],
      ["Today", "Today’s pictures", "Wikimedia Commons · Public domain and CC0"],
    ]);
  });
});
