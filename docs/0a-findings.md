# Milestone 0A — findings

**Status: PARTIAL.** Part 1 (fixtures) is complete. Parts 2-4 (Expo spike screen, on-device SQLite
probe, Dynamic Type matrix) are **blocked on the environment**, so all eight rubric verdicts are
still open. Nothing in this document claims a rendering result that was not observed.

Date: 16 Aug 2026.

## Environment blocker

The build machine has **Command Line Tools only — Xcode is not installed**.

```
xcode-select -p   -> /Library/Developer/CommandLineTools
xcodebuild        -> error: requires Xcode
xcrun simctl      -> no devices available
pod, watchman     -> not found
```

No iOS Simulator exists, so no dev build can be produced, no screenshot matrix can be captured, and
the SQLite capability probe cannot be run on device. Installing Xcode from the App Store is a
multi-gigabyte download plus a first-launch component install that requires the user's password; it
is not something the build can do for itself.

Everything downstream of "does this render" waits on that. Everything upstream of it was done.

## Sources used

Fetched to `content/raw/` (gitignored), pinned at the commits below.

| Dataset | File | Commit | License |
|---|---|---|---|
| MorphGNT / SBLGNT | `64-Jn-morphgnt.txt`, `67-1Co-morphgnt.txt` | `aaed91e57c8e4a8dc9a2383e129ca5e75fe6393d` | CC BY-SA 3.0 (MorphGNT), CC BY 4.0 (SBLGNT text) — **to confirm at ingest** |
| OpenScriptures Hebrew Bible | `wlc/Gen.xml` | `3d15126fb1ef74867fc1434be1942e837932691f` | CC BY 4.0 — **to confirm at ingest** |

Every parsing asserted in the two new fixtures was read out of these files. Nothing was recalled
from memory. License strings above are provisional and are a 0E task, not a claim.

## Deliverable 1 — fixtures (COMPLETE)

`golden/jhn.1.1.json` and `golden/gen.1.1.json`, both marked
`prompt_version: "hand-authored@0a-spike"` and `review.status: "flagged"`. **They are not reviewed
corpus.** They graduate to regression fixtures only after John reads them.

Both parse as `VerseEntry` and return **zero findings** from `validateVerseEntry`. Density: John 1:1
carries 12 claims including 2 debated items (one with three named positions); Genesis 1:1 carries 10
claims including 2 debated items. Full suite: 92 tests green.

## Findings from authoring — these are genre-gate results

Authoring against real data surfaced four schema and prompt problems that would have cost a
regeneration if they had been found mid-corpus. This is the spike doing its job before it renders a
single pixel.

### 1. A Hebrew "text" claim can smuggle in the pointing tradition

OSHB parses בְּרֵאשִׁית as `HR/Ncfsa` — preposition plus a common feminine singular noun in the
**absolute** state. That parse is the decisive evidence for one side of the verse's central debate
("In the beginning God created" vs "When God began to create").

But the absolute parse *is* the Masoretic analysis, encoded in pointing added centuries after the
consonantal text. A generator following the current prompt would emit "רֵאשִׁית is an absolute noun"
as a `text` claim with `evidence_strength: strong`, and it would be quietly taking a side.

The fixture works around it by attributing the parse rather than asserting it (claim `GEN.1.1.c5`:
"The Masoretic pointing of the Westminster Leningrad Codex parses רֵאשִׁית here as an absolute noun
rather than a construct"). **That workaround needs to become a prompt rule before any Hebrew batch
runs**: morphology claims over pointed Hebrew are claims about a tradition's analysis, not about the
consonantal text, and must name the source. The PRD's normative Text definition — "directly
recoverable from the supplied original-language text, grammar, morphology" — does not currently make
this distinction, and Hebrew is where it breaks.

### 2. `WordGloss` cannot express a Hebrew word

Two concrete mismatches, both visible in Genesis 1:1:

- **Morpheme structure.** OSHB writes בְּ/רֵאשִׁ֖ית and הַ/שָּׁמַ֖יִם with an explicit `/` separator
  and compound lemma refs (`b/7225`, `d/8064`). One surface word carries two morphemes with two
  lemma references. `WordGloss` has a single `strongs` string and a single `gloss`, so the fixture
  flattens בְּרֵאשִׁית to one entry glossed "in beginning" and drops the structure.
- **Homograph suffixes.** OSHB lemma refs carry disambiguating letters (`1254 a` for בָּרָא). The
  schema's `strongs` field has no place for the suffix, so the fixture stores `H1254` and loses it.

Neither breaks the schema today, but both mean the Hebrew interlinear cannot render morpheme-level
alignment, which is exactly what the Original layer promises. **Recommendation:** `WordGloss` gains
an optional `morphemes[]` before the Hebrew pilots, not after.

### 3. The Hebrew text carries cantillation as well as niqqud

The WLC text includes te'amim (בְּרֵאשִׁ֖ית has a tipcha, בָּרָ֣א a munach) on top of the vowel
points. The rendering test is therefore harder than "niqqud stacking", and there is a product
decision hiding here: strip the accents for readability, or keep them and accept the vertical
density. The fixture keeps them, so the spike tests the worst case. **Decide before the Hebrew
pilots.**

### 4. SBLGNT marks textual variants inline, and our canonical fixture ignores them

MorphGNT carries SBLGNT's apparatus markers in the surface text: `⸀γυναῖκες`, `⸀ἐπιτρέπεται`,
`⸀ὑποτασσέσθωσαν` in 1 Cor 14:34, and `⸂λαλεῖν ... ἐκκλησίᾳ⸃` in v. 35. Two consequences:

- The derive stage must strip these from display surfaces, or every Greek word renders with a stray
  reference mark. They are not part of the text.
- **1 Corinthians 14:34 is a verse whose textual stability is itself disputed** — three variant
  points inside one verse, plus the well-known question of whether vv. 34-35 are transposed in part
  of the manuscript tradition. `golden/1co.14.34.json` currently makes **no apparatus claim at all**.
  For the canonical regression verse, that is a real omission: the entry is honest about
  interpretation and silent about text-criticism.

This is flagged, not fixed — amending the approved regression fixture is a decision, not a chore.

### 5. Verified: the Prompt 01 fixture's parsings are correct

Checked against MorphGNT rather than assumed. σιγάτωσαν is `3PAD-P` (present active imperative, 3rd
plural). σιγάτω in v. 28 and v. 30 is `3PAD-S` — the same tense, voice, and mood, differing only in
number. αἱ γυναῖκες is `NPF`. The claims in `golden/1co.14.34.json` hold.

## Rubric verdicts

All eight are **BLOCKED** pending Xcode. None can be assessed honestly without a simulator.

| # | Question | Verdict |
|---|---|---|
| 1 | Pointed Hebrew renders correctly at every Dynamic Type size | BLOCKED |
| 2 | Polytonic Greek renders correctly at every size | BLOCKED |
| 3 | FTS5 and ATTACH work on device; driver decision recorded | BLOCKED |
| 4 | Tap-to-extend selection works without pixel-precise dragging | BLOCKED |
| 5 | Word tap opens a popover, reading position untouched | BLOCKED |
| 6 | Back to reading returns to the exact verse | BLOCKED |
| 7 | Understand default state answers the question without significant scrolling, at default and AX3 | BLOCKED |
| 8 | 1 Cor 14:34's full depth lands within 60 seconds on the first screen | BLOCKED |

## Recommendation

**Corpus generation does not proceed yet**, and not because anything failed — because the rendering
questions are still unanswered and two schema findings are now open.

Order of work from here:

1. Install Xcode, then run Parts 2-4. The rendering verdicts are still the gate.
2. Decide finding 2 (`WordGloss` morphemes) and finding 3 (te'amim) before the Hebrew pilots. Both
   are cheap now and expensive after Psalms and Genesis are generated.
3. Turn finding 1 into an explicit prompt rule before any Hebrew batch. It is the difference between
   a schema that survives the genre gate and one that quietly takes sides in Hebrew.
4. Decide whether 1 Cor 14:34 gains apparatus claims (finding 4). If the canonical regression verse
   stays silent on text-criticism, the corpus will be silent on it everywhere.

The two new fixtures should be read end to end before they are trusted, per the standing rule that
John reads John.
