import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32 } from "node:zlib";

import { afterAll, describe, expect, it } from "vitest";

import {
  GRAMMARS,
  GRAMMAR_CREDIT,
  GrammarRefused,
  appGrammarModule,
  buildGrammar,
  CORRECTIONS,
  MACHEN,
  MACHEN_SENTENCES,
  machenText,
  readMachen,
  cleanRst,
  firstParagraph,
  firstSentence,
  grammarCommand,
  grammarFiles,
  grammarSentence,
  includePath,
  readGrammar,
  type Grammar,
  type GrammarEntry,
  type GrammarFiles,
} from "./grammar.js";
import type { GrammarLanguage } from "@yada/schema";
import { lastDecisions } from "./reviewLog.testkit.js";
import { UNDERSTAND_DATA, understandPaths } from "./understand/package.js";

const LICENCE = "*unfoldingWord® Grammar*\n\nThis work is made available under the Creative Commons Attribution-ShareAlike 4.0 International License.\n";

/** A stored (uncompressed) zip, as door43's archives hold each repo under "<repo>/". */
function zipOf(files: ReadonlyMap<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text, "utf8");
    const n = Buffer.from(name, "utf8");
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** content/raw in small: uw-grammar/<repo>.zip for each grammar, and the pins those zips match. */
function fixture(): { raw: string; grammars: Record<GrammarLanguage, Grammar> } {
  const tree = new Map<string, string>();
  const put = (file: string, text: string) => tree.set(file, text);
  for (const repo of ["en_uhg", "en_ugg", "en_uag"]) put(`${repo}/LICENSE.md`, LICENCE);
  put(
    "en_uhg/content/verb_imperfect.rst",
    ":github_url: x\n\n.. _verb_imperfect:\n\nVerb Imperfect\n==============\n\nSummary\n-------\n\nAn Imperfect verb is used generally to indicate an action that is not complete. More follows.\n\nArticle\n-------\n\nLong article.\n",
  );
  put(
    "en_ugg/content/tense_imperfect.rst",
    ".. _tense_imperfect:\n\nTense imperfect\n===============\n\nGlossary\n________\n\n**Imperfect**   -\nImperfect is a verb tense-form (e.g. he was going). It has more.\n\n.. csv-table:: Example\n\n  a,b\n",
  );
  put(
    "en_uhg/content/state_absolute.rst",
    ".. _state_absolute:\n\nState Absolute\n==============\n\nSummary\n-------\n.. include:: includes/state_absolute-summary.rst\n\nArticle\n-------\n",
  );
  put("en_uhg/content/includes/state_absolute-summary.rst", "The absolute state is the :ref:`standard form<form>` of a word. A second sentence.\n");
  put("en_uag/content/state_determined.rst", ".. _state_absolute:\n\nState Absolute\n==============\n\nSummary\n-------\n\nThe absolute state is the standard form.\n");
  put("en_uag/content/gender_common.rst", ".. _gender_common:\nGender Common\n=============\nSummary\n-------\n.. include:: en_uhg/content/includes/gender_common-summary.rst\n");
  put("en_uhg/content/includes/gender_common-summary.rst", 'A word is classified as "common gender" if it can refer to either.\n');
  put("en_ugg/content/mood_optative.rst", ".. _mood_optative:\n\nMood optative\n=============\n\nGlossary     [UNDER CONSTRUCTION]\n--------\n\nThe **Optative mood** indicates a possibility.\n");
  const raw = mkdtempSync(path.join(tmpdir(), "yada-grammar-"));
  mkdirSync(path.join(raw, "uw-grammar"));
  const grammars = { ...GRAMMARS };
  for (const [language, g] of Object.entries(GRAMMARS) as Array<[GrammarLanguage, Grammar]>) {
    const zip = zipOf(new Map([...tree].filter(([f]) => f.startsWith(`${g.repo}/`))));
    writeFileSync(path.join(raw, "uw-grammar", `${g.repo}.zip`), zip);
    grammars[language] = { ...g, zipSha256: createHash("sha256").update(zip).digest("hex") };
  }
  return { raw, grammars };
}

const { raw: RAW_FIXTURE, grammars: PINS } = fixture();
const raw: GrammarFiles = grammarFiles(path.join(RAW_FIXTURE, "uw-grammar"), PINS);
afterAll(() => rmSync(RAW_FIXTURE, { recursive: true, force: true }));

describe("the pinned zips are what is read (code review, 15 Oct 2026)", () => {
  const dir = path.join(RAW_FIXTURE, "uw-grammar");

  it("refuses a zip that does not match its pin", () => {
    const zip = path.join(dir, "en_ugg.zip");
    const good = readFileSync(zip);
    const bad = Buffer.from(good);
    bad[bad.indexOf("Imperfect is")] = "X".charCodeAt(0);
    writeFileSync(zip, bad);
    try {
      expect(() => grammarFiles(dir, PINS)).toThrow(/en_ugg.zip does not match its pin/);
    } finally {
      writeFileSync(zip, good);
    }
  });

  it("refuses a missing zip", () => {
    expect(() => grammarFiles(path.join(RAW_FIXTURE, "nowhere"), PINS)).toThrow(/is missing/);
  });

  it("an extracted tree beside the zips is never read", () => {
    mkdirSync(path.join(dir, "en_ugg/content"), { recursive: true });
    writeFileSync(path.join(dir, "en_ugg/content/tense_imperfect.rst"), ".. _tense_imperfect:\n\nTense imperfect\n===============\n\nGlossary\n--------\n\nAn edited sentence.\n");
    writeFileSync(path.join(dir, "en_ugg/LICENSE.md"), "All rights reserved.");
    expect(grammarSentence(grammarFiles(dir, PINS), "greek", "imperfect")).toMatchObject({ text: "Imperfect is a verb tense-form (e.g. he was going)." });
  });

  it("an include never leaves the grammars", () => {
    expect(includePath("en_uag", "en_uhg/content/includes/x.rst")).toBe("en_uhg/content/includes/x.rst");
    expect(includePath("en_uhg", "includes/x.rst")).toBe("en_uhg/content/includes/x.rst");
    expect(includePath("en_uhg", "../../../secrets.rst")).toBeNull();
    expect(includePath("en_uag", "en_uhg/../../x.rst")).toBeNull();
    expect(includePath("en_uag", "en_uhg-copy/content/x.rst")).toBe("en_uag/content/en_uhg-copy/content/x.rst");
  });

  it("`yada grammar` exits 1 on a zip that does not match its pin, and writes nothing", () => {
    const out = mkdtempSync(path.join(tmpdir(), "yada-grammar-out-"));
    try {
      const options = { raw: RAW_FIXTURE, bundles: out, dataDir: out, appFile: path.join(out, "grammar.generated.ts") };
      expect(grammarCommand(["--write"], options)).toBe(1);
      expect(grammarCommand(["--write"], { ...options, grammars: PINS })).toBe(1); // pins pass; no core bundle in `out`
      expect(existsSync(options.appFile)).toBe(false);
      expect(existsSync(path.join(out, "grammar.json"))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("reading the unfoldingWord grammars (build 6, item H)", () => {
  it("takes the Summary's first sentence word for word", () => {
    expect(grammarSentence(raw, "hebrew", "imperfect")).toMatchObject({ text: "An Imperfect verb is used generally to indicate an action that is not complete." });
  });

  it("Greek and Hebrew imperfect come from different articles", () => {
    const greek = grammarSentence(raw, "greek", "imperfect");
    expect(greek).toMatchObject({ text: "Imperfect is a verb tense-form (e.g. he was going).", ref: "en_ugg/content/tense_imperfect.rst Glossary" });
    expect(grammarSentence(raw, "hebrew", "imperfect")).toMatchObject({ ref: "en_uhg/content/verb_imperfect.rst Summary" });
  });

  it("reads an included summary and takes the markup off", () => {
    expect(grammarSentence(raw, "hebrew", "absolute")).toMatchObject({ text: "The absolute state is the standard form of a word." });
  });

  it("follows en_uag's includes into the Hebrew grammar", () => {
    expect(grammarSentence(raw, "aramaic", "common")).toMatchObject({ text: 'A word is classified as "common gender" if it can refer to either.' });
  });

  it("refuses an article that is a copy of another (en_uag state_determined is state_absolute)", () => {
    expect(grammarSentence(raw, "aramaic", "determined")).toEqual({ reason: expect.stringMatching(/copy of another article/) });
  });

  it("marks an article the source calls unfinished, for John", () => {
    expect(grammarSentence(raw, "greek", "optative")).toMatchObject({ text: "The Optative mood indicates a possibility.", ref: expect.stringMatching(/UNDER CONSTRUCTION/) });
  });

  it("gives nothing for a term with no article", () => {
    expect(grammarSentence(raw, "hebrew", "pilel")).toEqual({ reason: "no en_uhg/stem_pilel.rst" });
    expect(grammarSentence(raw, "hebrew", "unknown term")).toEqual({ reason: "no article for this term" });
  });

  it("first sentence: e.g. and i.e. do not end it", () => {
    expect(firstSentence("A verb (e.g. he ran) is here. Next one.")).toBe("A verb (e.g. he ran) is here.");
    expect(firstSentence("One only (i.e., this).")).toBe("One only (i.e., this).");
  });

  it("cleanRst keeps a reference's words and drops literals' backticks", () => {
    expect(cleanRst("the ``genitive`` case of a :ref:`noun<noun>` or :ref:`verb`")).toBe("the genitive case of a noun or verb");
  });

  it("skips a directive in the summary", () => {
    expect(firstParagraph("Summary\n-------\n\n.. note:: aside\n   more\n\nThe real sentence.\n", () => null)?.text).toBe("The real sentence.");
  });
});

describe("the table and its review state (rule 2)", () => {
  const terms = [
    { label: "imperfect", language: "greek" as const, tokens: 3 },
    { label: "imperfect", language: "hebrew" as const, tokens: 5 },
    { label: "determined", language: "aramaic" as const, tokens: 1 },
  ];

  it("builds one entry per label and language, every one draft, gaps listed", () => {
    const { entries, gaps } = buildGrammar(raw, terms, []);
    expect(entries.map((e) => [e.key, e.status])).toEqual([["greek:imperfect", "draft"], ["hebrew:imperfect", "draft"]]);
    expect(gaps.map((g) => g.key)).toEqual(["aramaic:determined"]);
  });

  it("keeps John's decision only while the sentence is unchanged", () => {
    const first = buildGrammar(raw, terms, []).entries;
    const approved: GrammarEntry[] = first.map((e) => ({ ...e, status: "approved" }));
    approved[1] = { ...(approved[1] as GrammarEntry), text: "An older sentence." };
    const again = buildGrammar(raw, terms, approved).entries;
    expect(again.map((e) => e.status)).toEqual(["approved", "draft"]);
  });

  it("the app gets approved entries only, with credits that say it was shortened and drop the ® mark", () => {
    const entries = buildGrammar(raw, terms, []).entries.map((e, i) => ({ ...e, status: i === 0 ? ("approved" as const) : ("draft" as const) }));
    const module = appGrammarModule(entries);
    expect(module).toContain('"greek:imperfect": "Imperfect is a verb tense-form (e.g. he was going)."');
    expect(module).not.toContain("hebrew:imperfect");
    for (const credit of Object.values(GRAMMAR_CREDIT)) {
      expect(credit).toMatch(/shortened/);
      expect(credit).not.toMatch(/®/);
    }
  });

  it("refuses a grammar whose LICENSE.md no longer grants CC BY-SA 4.0 (rule 3)", () => {
    const relicensed: GrammarFiles = (f) => (f === "en_uag/LICENSE.md" ? "All rights reserved." : raw(f));
    expect(() => buildGrammar(relicensed, terms, [])).toThrow(GrammarRefused);
  });

  it("approves only what John approved in the review tool, on the text he read", () => {
    // As intro.test.ts: John's review (bb61acf) approved 67, each his last logged decision on this text.
    const log = lastDecisions("grammar");
    for (const e of readGrammar(UNDERSTAND_DATA).filter((e) => e.status === "approved")) {
      expect(log.get(e.key), e.key).toEqual({ decision: "approved", reviewer: "john", text_sha256: createHash("sha256").update(e.text, "utf8").digest("hex") });
    }
    expect(readGrammar(UNDERSTAND_DATA).length).toBeGreaterThanOrEqual(85);
  });
});

const RAW = path.join(understandPaths().raw, "uw-grammar");
describe.skipIf(!existsSync(path.join(RAW, "en_uhg.zip")))("against the pinned grammars", { timeout: 60_000 }, () => {
  const pinned = existsSync(path.join(RAW, "en_uhg.zip")) ? grammarFiles(RAW) : () => null;
  it("the committed table matches the sources", () => {
    for (const e of readGrammar(UNDERSTAND_DATA)) {
      if (e.source === "machen") continue;
      const fix = CORRECTIONS[e.key];
      const text = e.note === undefined || fix === undefined ? e.text : e.text.replace(fix[1], fix[0]);
      expect(grammarSentence(pinned, e.language, e.label)).toMatchObject({ text });
    }
  });

  it("Aramaic “determined” has nothing: en_uag's article is a copy of the absolute one", () => {
    expect("reason" in grammarSentence(pinned, "aramaic", "determined")).toBe(true);
  });
});

describe("fixes from John's rejections (decisions 23 and 24)", () => {
  /** A grammar tree in memory: the three licences and the articles given. */
  const tree = (articles: Record<string, string>): GrammarFiles => {
    const files = new Map<string, string>(Object.entries(articles));
    for (const repo of ["en_uhg", "en_ugg", "en_uag"]) files.set(`${repo}/LICENSE.md`, LICENCE);
    return (file) => files.get(file) ?? null;
  };
  const summary = (id: string, sentence: string): string => `.. _${id}:\n\n${id}\n${"=".repeat(id.length)}\n\nSummary\n-------\n\n${sentence}\n`;

  it("corrects a listed slip with a note for John, and only while the original is there", () => {
    const files = tree({ "en_uhg/content/stem_qal.rst": summary("stem_qal", "The Qal stem is the stem formation that is the simplest of form in Biblical Hebrew.") });
    const [qal] = buildGrammar(files, [{ label: "qal", language: "hebrew", tokens: 1 }], []).entries;
    expect(qal).toMatchObject({ text: "The Qal stem is the stem formation that is the simplest form in Biblical Hebrew.", note: expect.stringMatching(/simplest of form/) });
    const fixed = tree({ "en_uhg/content/stem_qal.rst": summary("stem_qal", "The Qal stem is the simplest stem.") });
    expect(buildGrammar(fixed, [{ label: "qal", language: "hebrew", tokens: 1 }], []).entries[0]).not.toHaveProperty("note");
  });

  it("takes Machen's sentence for a listed Greek term, and refuses one the pinned scan does not hold", () => {
    const files = tree({ "en_ugg/content/mood_optative.rst": summary("mood_optative", "The Optative mood indicates a possibility.") });
    const terms = [{ label: "optative", language: "greek" as const, tokens: 1 }];
    const scan = machenText("classical uses have disappeared. The optative is still re-\n  tained to express a wish. Thus …");
    expect(buildGrammar(files, terms, [], scan).entries[0]).toMatchObject({ text: "The optative is still retained to express a wish.", source: "machen" });
    expect(() => buildGrammar(files, terms, [], "another book")).toThrow(/not in the pinned scan/);
    // Without the scan on this Mac, the unfoldingWord sentence is kept.
    expect(buildGrammar(files, terms, []).entries[0]?.text).toBe("The Optative mood indicates a possibility.");
  });

  it("a rejected sentence stays rejected, here and for the same term in another language", () => {
    const files = tree({
      "en_uhg/content/state_construct.rst": summary("state_construct", "The construct state is a modified form."),
      "en_uag/content/state_construct.rst": summary("state_construct", "The contruct state is a modified form."),
    });
    const terms = [
      { label: "construct", language: "hebrew" as const, tokens: 2 },
      { label: "construct", language: "aramaic" as const, tokens: 1 },
    ];
    const previous = buildGrammar(files, terms, []).entries.map((e) => ({ ...e, status: "rejected" as const }));
    const again = buildGrammar(files, terms, previous).entries;
    // The Aramaic slip is corrected, and the result is the Hebrew sentence John rejected.
    expect(again.map((e) => [e.key, e.text, e.status])).toEqual([
      ["hebrew:construct", "The construct state is a modified form.", "rejected"],
      ["aramaic:construct", "The construct state is a modified form.", "rejected"],
    ]);
  });

  it("John's later approval of a once-rejected sentence wins on the next run", () => {
    const files = tree({ "en_uhg/content/stem_qal.rst": summary("stem_qal", "The Qal stem is the simplest stem.") });
    const terms = [{ label: "qal", language: "hebrew" as const, tokens: 1 }];
    const [first] = buildGrammar(files, terms, []).entries;
    const approved = { ...(first as GrammarEntry), status: "approved" as const, rejected: ["The Qal stem is the simplest stem."] };
    expect(buildGrammar(files, terms, [approved]).entries[0]?.status).toBe("approved");
  });

  it("credits an approved Machen sentence as Machen's in the app", () => {
    const files = tree({ "en_ugg/content/mood_optative.rst": summary("mood_optative", "The Optative mood indicates a possibility.") });
    const [e] = buildGrammar(files, [{ label: "optative", language: "greek", tokens: 1 }], [], machenText("The optative is still retained to express a wish.")).entries;
    const module = appGrammarModule([{ ...(e as GrammarEntry), status: "approved" }]);
    expect(module).toContain(`"greek:optative": ${JSON.stringify(MACHEN.credit)}`);
  });

  it("holds two terms of one language that share a sentence word for word", () => {
    const same = "An extremely rare stem formation that is similar to the Hiphil.";
    const files = tree({ "en_uhg/content/stem_tiphil.rst": summary("stem_tiphil", same), "en_uhg/content/stem_hishtaphel.rst": summary("stem_hishtaphel", same) });
    const { entries, gaps } = buildGrammar(files, [{ label: "tiphil", language: "hebrew", tokens: 1 }, { label: "hishtaphel", language: "hebrew", tokens: 1 }], []);
    expect(entries).toEqual([]);
    expect(gaps.map((g) => g.reason)).toEqual(["same sentence as hebrew:hishtaphel", "same sentence as hebrew:tiphil"]);
  });
});

describe.skipIf(!existsSync(path.join(understandPaths().raw, MACHEN.file)))("against the pinned Machen scan", () => {
  it("holds each chosen sentence exactly once", () => {
    const scan = readMachen(understandPaths().raw) ?? "";
    for (const { text } of Object.values(MACHEN_SENTENCES)) expect(scan.split(text)).toHaveLength(2);
  });
});
