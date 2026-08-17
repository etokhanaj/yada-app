# The genre gate

PRD §11.5: the schema and prompt must survive six literary types before any batch run. This is the
paper version — every fixture hand-authored against pinned source data, no generation, no spend.

Date: 17 Aug 2026. Schema at `1.1.0`. Seven fixtures, zero findings from `validateVerseEntry`,
122 tests green.

## Verdicts

| Genre | Fixture | Verdict |
|---|---|---|
| Gospel narrative | `JHN.1.1` | **SURVIVED** |
| Pauline argument | `1CO.14.34` | **SURVIVED** |
| Hebrew narrative | `GEN.1.1` | **SURVIVED** (after v1.1) |
| Hebrew poetry | `PSA.23.1` | **STRAINED** |
| Law | `LEV.19.18` | **SURVIVED** |
| Prophecy | `ISA.53.5` | **SURVIVED** |
| Apocalyptic | `REV.13.18` | **STRAINED** |

Two strained, and in both cases the strain is a missing capability rather than a broken one. Details
below, including the places I wrote around a problem — those are the findings that matter, because a
genre that "passed" by avoiding its hard part is a failure recorded as a success.

## What v1.1 changed, and why

**`WordGloss.morphemes[]`.** One Hebrew written word routinely carries several morphemes with their
own lemma references. `וּבַחֲבֻרָתוֹ` in Isaiah 53:5 is four — conjunction, preposition, noun in
construct, and a third person suffix — written by OSHB as `c/b/2250` with morph `HC/R/Ncfsc/Sp3ms`.
Before v1.1 the schema flattened that to one gloss and lost the structure the Original layer exists
to show.

**Homograph letters preserved.** OSHB writes `7462 b` for the participle in Psalm 23:1 and `1254 a`
for בָּרָא. The old single `strongs` string dropped the letter, silently merging distinct lexemes.
`StrongsSchema` now accepts `H7462b` and enforces the shape.

**`LexicalEvidenceRef.analysis_tradition`, enforced for the Old Testament.** See below.

## The Text-definition problem, and a proposed amendment

The sharpest finding of 0A, now enforced in code. OSHB parses רֵאשִׁית as absolute — and that parse
*is* the Masoretic vocalisation, added centuries after the consonantal text, and it is the decisive
evidence for one side of Genesis 1:1's central dispute. Stating it bare looks neutral and takes a
side.

`validate.ts` now errors when an Old Testament `text` claim cites lexical evidence without naming the
tradition the parse depends on. Greek needs no equivalent: SBLGNT's accents do not carry comparable
interpretive weight.

PRD §11.4 currently defines a Text claim as *"directly recoverable from the supplied
original-language text, grammar, morphology, or immediate textual structure, without requiring
historical inference."* Proposed addition:

> Where the supplied morphology depends on an editorial tradition rather than on the base text — most
> importantly the Masoretic vocalisation and accentuation of the Hebrew Bible — a Text claim must name
> that tradition. The parse is evidence of what that tradition read, not of what the consonantal text
> requires. A claim that merely needs the tradition named remains a Text claim; a claim that would be
> false if the tradition were set aside is an Interpretation claim.

## Hebrew poetry — STRAINED

Two problems, one of which I could only write around.

**1. Versification, and the superscription that has nowhere to live.** The Masoretic text counts
מִזְמוֹר לְדָוִד inside verse 1; English versification places it before the numbered verse. OSHB
marks the divergence explicitly with an inline `<note>KJV:Ps.23.1</note>`, so the data is there.

I chose English numbering, because that is what the shipped translations use, and excluded the
superscription from the gloss. **That is a written-around problem, not a solved one:** a reader who
taps "Original Hebrew" on Psalm 23:1 sees four Hebrew words, while the Hebrew verse has six. The
schema has no superscription field and no field recording which versification scheme a `verse_id`
follows. Psalms is 150 chapters and a named pilot in PRD §11.8; this will not stay quiet.

**2. Parallelism has no home at verse level.** A poetic line's meaning lives in the relation between
its cola — and the claim model expresses propositions *about* the text, not relations *between its
parts*. `PericopeEntry` has `movement[]` for how a passage moves; `VerseEntry` has no equivalent, and
in Hebrew poetry a single verse is itself a structured unit. I could assert "no verb joins יְהוָה to
רֹעִי" as a Text claim, but nothing in the schema can say "the second colon states the consequence
of the first" as *structure* rather than as another flat assertion.

The narrow fix is `movement[]` on `VerseEntry`. Whether that is right, or whether poetry wants its
own shape, is a judgement call — but Psalms should not be generated until it is made.

## Apocalyptic — STRAINED

`ApparatusEvidenceRef` works structurally. The **datasets do not support it**, and that is now
blocking rather than theoretical.

SBLGNT marks *that* there is variation at Revelation 13:18 — it brackets ἑξακόσιοι ἑξήκοντα ἕξ and
flags the preceding αὐτοῦ — but it does not supply *what* the competing readings are. So the claim
that the variation point exists is `source_data`; the claim that the alternative reading is 616 had
to be `model_knowledge`, capped at `supported`. That is the honest handling, and it is also a
warning: **every text-critical claim in the corpus will be model knowledge until an apparatus dataset
is selected.** PRD §17 lists that selection as open. It is now on the critical path for Revelation,
Mark's ending, the Johannine comma, and 1 Corinthians 14.

A second, softer strain: for apocalyptic the 30-second answer is inherently "here is the puzzle the
text sets", not "here is what it means". The schema handled it; whether that satisfies a reader is a
product question for the UX regression test, not a schema one.

## Law — SURVIVED, with a standing risk

`whats_happening` for a command is not a narrative, and writing it as *what the command does and
where it sits* worked without bending anything. The scope question (how far רֵעֲךָ extends) fell
naturally into a debated claim, and Leviticus 19:34 supplies real in-text evidence for the second
position rather than a manufactured balance.

The risk is not structural but behavioural: the pull toward stating **application** as though it were
context ("this means you should…") is much stronger in law than in narrative. The category
discipline held here only because I was watching for it. That belongs in the prompt as an explicit
instruction, not left to the categories to catch.

## Prophecy — SURVIVED

The best case for the schema so far. Isaiah 53:5's identity question fits `debated` with both
readings named — Israel collectively, and an individual distinct from the people — each with its own
case and evidence, and the absence of a winner field does real work. The second dispute, over what
relation the preposition מִן marks, sits alongside it without competing.

One observation: those two debated claims are different *kinds* of dispute — one about referent, one
about grammar — and `display_rank` orders them while nothing records that difference. Not a gap worth
fixing now; noted in case the Compare view later wants it.

## Smaller findings

- **Maqqef.** OSHB writes the joining stroke as its own `<seg>` element between words. The derive
  stage has to decide whether maqqef-joined words display as one unit or two; the fixtures treat them
  as separate words.
- **Not every Hebrew word has a Strong's number.** `לָנוּ` in Isaiah 53:5 carries lemma `l` alone.
  `strongs` is optional and that is correct, but a UI that assumes a Strong's link on every word will
  break.
- **`morph` holds two different notations.** MorphGNT uses fixed-width strings (`V- 3AAD-S--`); OSHB
  uses slash-separated codes (`HC/R/Ncfsc/Sp3ms`). One `string` field carries both. Fine for now,
  worth typing if anything ever parses it.
- **Apparatus policy settled.** `1co.14.34.json` now carries an apparatus claim for the three
  variation points SBLGNT marks inside the verse, and a debated claim about where vv. 34–35 stood.
  The canonical regression verse is no longer silent on text-criticism. The competing placements are
  `model_knowledge` for the same reason as Revelation.

## A licensing finding that contradicts the PRD

Recording the source manifest meant reading the licences rather than assuming them, and the Greek is
not what PRD §11.1 says it is.

**PRD §11.1 lists "SBLGNT (CC BY 4.0)". That is wrong.** The repository carries two different
licences for two different things:

- the **morphological annotations** are CC BY-SA 3.0 — a *share-alike* licence, and not the 4.0
  version the schema's enum previously allowed;
- the **SBLGNT Greek text itself** is issued under its own EULA at `sblgnt.com/license/`, not under
  any Creative Commons licence.

Two consequences, neither of them theoretical for a product intended to be sold:

1. **Share-alike.** CC BY-SA 3.0 on the annotations raises a question nobody has asked yet about what
   share-alike obligations attach when derived glosses ship inside a closed-source app. That is a
   question for a lawyer, not for a schema.
2. **A bespoke EULA on the primary NT text.** The whole v1 proposition rests on shipping the Greek to
   every reader. Its terms have not been read.

The Hebrew is cleaner: the WLC text is public domain and the OSHB lemma/morphology data is CC BY 4.0,
both confirmed from the repository.

Schema changes made in response: `CC-BY-SA-3.0` and `CUSTOM_EULA` added to the licence union, with
`isCommercialSafe` returning **false** for `CUSTOM_EULA` — unreviewed bespoke terms fail closed, not
open. `sources.manifest.json` now records eight datasets, splits SBLGNT text from MorphGNT
annotations into separate entries with different verdicts, and a test asserts the text is flagged
while the annotations are not.

This belongs in PRD §11.1 and in the 0E legal gate, and it moves ahead of the trademark search in
priority: a name can be changed, but a Greek text that cannot be shipped commercially would reshape
the product.

## Recommendation

**Lock schema v1.1 for the New Testament and for Hebrew prose, law, and prophecy. Do not lock it for
Psalms.**

The gate is genuinely passed for five of seven genres, and the two Hebrew changes v1.1 introduced are
the difference between a schema that can represent Hebrew and one that quietly cannot. Generation can
proceed on that basis, and PRD §11.8 already sequences the NT ahead of the Hebrew pilots.

Two conditions, both written down rather than remembered:

1. **Before the Psalms pilot**, close the versification/superscription gap and decide whether
   `movement[]` belongs on `VerseEntry`. Psalms is where both bite, and it is a named pilot.
2. **Before any text-critical claim ships**, select the apparatus dataset (PRD §17). Until then every
   such claim is model knowledge, and Revelation 13:18 is not an edge case.

The two prompt rules this session produced — name the analysis tradition, and never state application
as context — belong in the master prompt before Milestone 2, not in a reviewer's head.

All six hand-authored fixtures remain `review.status: flagged`. They are the seed of the permanent
regression suite and should be read end to end before they are trusted as one.

---

## Addendum, same day: both conditions closed but one

The verdicts above stand as written. What follows changed after them, and is recorded here rather
than edited into the report, because the point-in-time judgement is part of the record.

**Condition 2 (apparatus) is closed.** STEPBible TAGNT supplies edition-level variants under CC BY
4.0 — see `docs/dataset-selection.md`. Text-critical claims can now be `source_data` at the level of
"the printed editions differ here", though not at manuscript level.

**Condition 1 is half closed.** Schema **1.2.0** adds `TITLE_VERSE`: verse 0 addresses a
superscription, so `PSA.23.0` is now a real id, `formatDisplayRef` renders it as *Psalms 23, title*
rather than *23:0*, and ranges may start at it. Human input still rejects verse zero, because someone
typing "Psalm 23:0" has made a mistake rather than asked for a title. `VersificationSchema` and
`CANONICAL_VERSIFICATION` name the scheme the corpus normalises to instead of leaving it implicit.
STEPBible's TVTMS supplies the mappings. **The Psalms versification gap is closed.**

**What remains open: parallelism, and it is harder than the report implied.** I suggested porting
`movement[]` from `PericopeEntry` to `VerseEntry`. On inspection that does not work: `movement[]`
addresses *verse ranges*, and the parts of a poetic line are cola, which have no addresses. There is
no way to say "colon A of Psalm 23:1" in the current id scheme.

A real fix needs one of:

- **colon addressing** — extending verse ids again, which is a large change for one genre; or
- **structure indexed into `gloss[]`** — a `structure[]` field on `VerseEntry` whose parts point at
  word ranges within the entry rather than at verse ids. This is the cheaper option and it reuses
  data the entry already carries.

I would not decide this in passing. It is the last genuinely open schema question, it only affects
poetry, and PRD §11.8 puts Psalms after the NT — so it can be settled before the Psalms pilot
without holding anything else up. **The lock recommendation is therefore upgraded: schema 1.2.0 is
ready to lock for the whole New Testament and for Hebrew prose, law, and prophecy, with poetic
structure the single remaining amendment.**
