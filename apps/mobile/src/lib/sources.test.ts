import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import type { SourceRow } from "../data/queries";
import { licenceLabel, sourceItems } from "./sources";

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
    expect(item).toMatchObject({ group: "Word data", title: "Greek parsing", subtitle: "MorphGNT · CC BY-SA 3.0" });
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

  it("leaves out datasets with no reader-facing role", () => {
    expect(sourceItems([row("Literata", "OFL-1.1")])).toEqual([]);
  });
});

const corePath = path.resolve(__dirname, "../../../../content/bundles/core.v2.db");

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
      "Greek parsing",
      "Hebrew parsing",
      "Greek word glosses",
      "Hebrew word glosses",
      "Greek dictionary forms",
      "Hebrew dictionary forms",
      "Verse numbering",
    ]);
    expect(items[0]?.subtitle).toBe("SBLGNT · Own licence");
    const unmapped = rows.filter((r) => !items.some((i) => i.dataset === r.dataset)).map((r) => r.dataset);
    // Fonts and the early WEB excerpt file only.
    expect(unmapped.every((d) => /Literata|Noto|Gentium|John 1, Genesis 1/.test(d))).toBe(true);
  });
});
