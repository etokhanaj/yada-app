# Dataset selection for 0B

PRD §17 leaves four dataset questions open, and three of them block 0B. This is the research pass
that closes what can be closed and states plainly what cannot.

Date: 17 Aug 2026. Every licence below was read from the source, not inferred from a repository
badge — the SBLGNT surprise in the genre gate is the reason that is now the standing method.

| Question | Status | Answer |
|---|---|---|
| Textual-critical apparatus | **RESOLVED** | STEPBible TAGNT, with a stated limit |
| Versification standard | **RESOLVED** | STEPBible TVTMS — also closes the Psalms gap |
| OT lexical gloss source | **CONDITIONAL** | STEPBible TBESH, blocked on a third-party permission |
| Pericope boundaries | **STILL OPEN** | No open source found; options below |

Candidate pin for all STEPBible data: `079db44a434e7f2bf5e33f95058e43d7437be92b`, CC BY 4.0.

## Apparatus — RESOLVED, with a limit worth stating

**STEPBible TAGNT** (Translators Amalgamated Greek NT) carries, in its own words, *"All the words
from standard Greek editions (NA27/28, TR, SBL, TH, Byz, WH, Treg) with translations, grammar,
sources & variants that affect translation."*

Every word is typed by which tradition carries it — `N` for Nestlé-Aland, `K` for the Textus Receptus
behind the KJV, `O` for other editions — and case marks whether the difference is large enough to
change a translation. The dataset's own summary: 3,084 words differ in the Traditional manuscripts,
470 of them consequentially; 4,164 words appear in Traditional but not Ancient manuscripts, 2,347 of
them consequentially.

**The limit:** this is an *edition-level* apparatus, not a manuscript-level one. Yada could ground
"the printed editions differ here, and the difference changes the translation." It could not ground
"616 is attested in Papyrus 115." For a reader-facing product that is arguably the right altitude —
naming manuscript sigla would be Logos behaviour, not Yada behaviour — but it must be an explicit
decision rather than a limitation discovered later.

Consequence for the genre gate's Revelation finding: the variation point at 13:18 becomes
`source_data` rather than `model_knowledge`, and the same holds for the three variation points inside
1 Corinthians 14:34. The competing *readings* stay model knowledge unless a manuscript-level source
is added.

TAGNT would also replace MorphGNT as the Greek morphology source, which resolves the SBLGNT EULA
problem for annotations — though **not** for the Greek text itself, which is a separate question
still outstanding in 0E.

## Versification — RESOLVED, and it closes the Psalms gap

**STEPBible TVTMS** maps between the English/KJV, Hebrew, Latin, and Greek traditions with an explicit
mapping syntax. It carries a field defined as *"TRUE if there is canonical text (ie a Psalm Title)
before the verse code of v.1"*, and rows of the form:

```
OneToOne   Psa.3:Title   Psa.3:1   Psa.3:1   Psa.3:1   Absent [=Psa.3:1]
             English KJV   Hebrew    Latin     Greek
```

It also covers every case the build plan named as the known swamp — 3 John 14–15, Revelation
12:18/13:1, Acts 19:40–41, 2 Corinthians 13:12–14, Philippians 1:16–17 — and publishes JSword-style
mapping strings that can be consumed directly.

**This closes the gap the genre gate opened.** The superscription is not homeless: it has a
first-class identity (`Psa.3:Title`) in the English tradition and a verse number in the Hebrew, and
TVTMS states the correspondence.

Two schema consequences for v1.2, both now specifiable rather than speculative:

1. **`verse_id` must admit a title pseudo-verse.** Psalm superscriptions are canonical text and need
   an addressable id. `PSA.23.0` is the obvious candidate, and `refs.ts` currently rejects verse `0`.
2. **Entries should record which versification tradition their `verse_id` follows.** TAGNT uses NRSV
   numbering, OSHB uses Hebrew, the shipped English translations use KJV-style. Normalising against
   one canonical scheme is a build-plan requirement; recording which one is a schema requirement.

## OT lexical glosses — CONDITIONAL, and this is the trap

**STEPBible TBESH** (Translators Brief lexicon of Extended Strongs for Hebrew) is the obvious answer
to §17's "OT sourced-gloss dataset selection", on which the PRD says the v1 Hebrew interlinear
depends. Its Extended Strongs convention also matches the homograph handling schema v1.1 just added
(`H7462b`).

**But its own header says:** the brief lexicon is based on the Abridged BDB from Online Bible, is
provided for guidance only, and *permission should be gained from Online Bible before these
definitions are applied in any project.*

So the CC BY 4.0 wrapper covers STEPBible's work, while the underlying definitions carry a
third-party permission requirement. This is the same shape of trap as SBLGNT: an open licence on the
container, encumbered content inside. **Yada cannot ship TBESH glosses without contacting Online
Bible**, and that is an email that belongs in 0E alongside the Cambridge one.

Alternatives if permission is refused: the full BDB via STEPBible's TFLSJ-equivalent Hebrew lexicon
(public domain by age, but bulky and archaic), or deriving glosses from the BSB alignment tables as
the PRD's long-term plan already intends.

One further note on all STEPBible data: the licence block asks users to *refer others to the GitHub
repository rather than redistributing the data themselves*. CC BY permits redistribution, so this
reads as a request rather than a condition — but Yada's whole delivery model is bundling data into
per-book SQLite files. Worth one email to confirm they consider that acceptable.

## Pericope boundaries — STILL OPEN

Nothing suitable found. STEPBible's only tagged Bible with section structure is **TTESV, licensed
CC BY-NC**, which PRD §11.1 excludes from commercial builds and which `isCommercialSafe` now rejects
automatically.

This matters more than it looks: §17 notes that two of the ten proof verses require pericope entries,
and passage Understand — a first-class v1 feature — resolves selections to pre-generated pericopes.
Three options, in the order I would try them:

1. **Berean Standard Bible section headings.** The BSB is already the default translation and is
   published without copyright restriction. If its headings carry machine-readable boundaries, this
   is the cheapest answer and it aligns the pericope structure with the text the reader is reading.
2. **Derive from the alignment tables plus paragraph markers.** OSHB and the Greek editions mark
   paragraph structure; that is boundary evidence, if coarser than editorial section headings.
3. **Author manually for John.** Roughly 20 pericopes. That is a defensible way to unblock 0B and
   Milestone 3 without committing to a source for all 66 books, which is what the seven hand-authored
   fixtures already do informally.

I would take option 3 for John and settle 1 or 2 before the NT batch.

## Cross-references

Unchanged from the PRD: **TSK** is public domain and adequate for untyped cross-references.
`scrollmapper/bible_databases` (MIT) is a convenient delivery vehicle for it. The typed
quotation/allusion dataset §17 asks for remains unfound; TAGNT's tagging does not extend to OT
quotation marking. Related passages currently carry hand-assigned relationship labels, which is fine
at fixture scale and will not survive 31,000 verses.

## What this changes

- **The apparatus question is no longer blocking**, at edition-level granularity.
- **The versification question is answered**, and the Psalms condition from the genre gate can be
  lifted once schema v1.2 admits title verses.
- **Two more emails belong in 0E**: Online Bible about the abridged BDB definitions, and STEPBible
  about bundling. Together with the SBLGNT EULA question, the legal gate now has three live items and
  is firmly on the critical path.
- **Pericope boundaries are the remaining engineering unknown** before 0B, and manual authoring for
  John is enough to proceed.
